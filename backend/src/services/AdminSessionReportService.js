const prisma = require('../config/prisma');
const { generateWorkbookBuffer } = require('../utils/excelGenerator');
const { NotFoundError, BadRequestError } = require('../utils/AppError');

class AdminSessionReportService {

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKBOOK LISTING  (Class-Centric View)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Groups all AttendanceSessions by (academicYear, topic, date) and returns
   * one "workbook" record per unique combination.
   *
   * A "workbook" represents ONE class that was conducted across potentially
   * many classrooms/sessions on the same day.
   *
   * Supports:
   *   - Filter by academicYear name, topic, date
   *   - Search by workbook name  ES-"Topic"("AcYear","DD-MM-YYYY")
   *   - Pagination (applied after grouping)
   *
   * Returns:
   *   {
   *     workbooks: WorkbookRecord[],
   *     meta: { total, page, limit, totalPages }
   *   }
   *
   * WorkbookRecord shape:
   *   {
   *     id: string,           // canonical key: "academicYearId|topic|dateISO"
   *     workbookName: string, // ES-Aptitude(2nd Year,18-07-2026)
   *     academicYear: { id, name },
   *     topic: string,
   *     date: string,         // ISO date string of first session in group
   *     sessionCount: number, // how many sessions make up this class
   *     totalRecords: number, // total attendance records across all sessions
   *   }
   */
  async listWorkbooks({ academicYear, topic, date, search, page = 1, limit = 20 } = {}) {
    // ── Build DB filter ──────────────────────────────────────────────────────
    const where = {};

    if (topic && topic !== 'All') {
      where.topic = topic;
    }
    if (date) {
      const d = new Date(date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    }
    if (academicYear && academicYear !== 'All') {
      where.academicYear = { name: academicYear };
    }

    // ── Fetch ALL matching sessions (we group in memory) ──────────────────────
    const allSessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        academicYear: { select: { id: true, name: true } },
        _count:       { select: { records: true } },
      },
    });

    // ── Group by (academicYearId, topic, date-day) ────────────────────────────
    const groupMap = new Map();

    for (const session of allSessions) {
      const acYearId = session.academicYearId || '__none__';
      const topicKey = (session.topic || '').toLowerCase().trim();

      // Use UTC date components to match the UTC day-range used in downloadWorkbook.
      // This prevents a session at 23:xx local time from grouping into the wrong day.
      const d = new Date(session.date);
      const dateKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

      const groupKey = `${acYearId}|${topicKey}|${dateKey}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          _key:         groupKey,
          academicYear: session.academicYear,
          topic:        session.topic,
          date:         session.date,   // representative ISO date (first seen in group)
          sessionCount: 0,
          totalRecords: 0,             // sum of _count.records; > 0 means at least one session has data
        });
      }

      const group = groupMap.get(groupKey);
      group.sessionCount  += 1;
      group.totalRecords  += session._count.records;
    }

    // ── Convert map to array and build workbook records ───────────────────────
    let workbooks = Array.from(groupMap.values()).map((g) => ({
      id:           g._key,
      workbookName: this._buildWorkbookName(g),
      academicYear: g.academicYear,
      topic:        g.topic,
      date:         g.date,
      sessionCount: g.sessionCount,
      totalRecords: g.totalRecords,
    }));

    // ── Apply search filter ───────────────────────────────────────────────────
    if (search) {
      const q = search.toLowerCase();
      workbooks = workbooks.filter(w => w.workbookName.toLowerCase().includes(q));
    }

    // ── Paginate ──────────────────────────────────────────────────────────────
    const total     = workbooks.length;
    const skip      = (Math.max(1, page) - 1) * limit;
    const paginated = workbooks.slice(skip, skip + limit);

    return {
      workbooks: paginated,
      meta: {
        total,
        page:       Math.max(1, page),
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WORKBOOK DOWNLOAD  (Consolidated — all sessions for one class)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generates a consolidated in-memory Excel workbook for ONE class
   * (which may span multiple sessions/classrooms).
   *
   * Params (query params from the download request):
   *   - academicYearId  (string)
   *   - topic           (string)
   *   - date            (ISO string, YYYY-MM-DD)
   *
   * Workbook structure:
   *   Sheet 1 — "Overall Attendance"
   *     ALL students belonging to the same academic year, sorted by timetable.
   *     Attendance Status = P if student appears in ANY of the matching sessions.
   *
   *   Sheet 2+ — One per Attendance Session (classroom)
   *     ONLY students present in that specific classroom.
   *     Attendance Status is always P.
   *     Followed by a SESSION INFORMATION block at the bottom.
   */
  async downloadWorkbook({ academicYearId, topic, date }) {
    // ── 1. Validate inputs ────────────────────────────────────────────────────
    // topic CAN be null — sessions with no topic are valid.
    // Only date is strictly required.
    if (!date) {
      throw new BadRequestError('date is required to generate this workbook.');
    }

    // ── 2. Build UTC-safe date range for the target calendar day ──────────────
    const d        = new Date(date);
    const yr = d.getUTCFullYear(), mo = d.getUTCMonth(), dy = d.getUTCDate();
    const dayStart = new Date(Date.UTC(yr, mo, dy,  0,  0,  0,   0));
    const dayEnd   = new Date(Date.UTC(yr, mo, dy, 23, 59, 59, 999));

    // ── 3. Fetch ALL sessions matching (academicYear, topic, date) ────────────
    // Constraint: academicYear + topic + date ONLY (room & faculty are NOT constraints)
    const where = {
      date: { gte: dayStart, lte: dayEnd },
    };

    // Handle null/empty topic correctly in Prisma:
    // Passing `topic: null` matches NULL DB rows; passing a string matches that string.
    const normTopic = (topic === null || topic === '' || topic === 'null' || topic === 'undefined')
      ? null
      : topic;
    where.topic = normTopic;

    if (academicYearId && academicYearId !== 'null' && academicYearId !== 'undefined') {
      where.academicYearId = academicYearId;
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        faculty:      true,
        room:         true,
        subject:      true,
        academicYear: true,
        records:      true,
      },
    });

    if (sessions.length === 0) {
      throw new NotFoundError('No sessions found for this class. It may have been deleted.');
    }

    // ── 4. Guard: at least one session must have records ─────────────────────
    const sessionsWithRecords = sessions.filter(s => s.records.length > 0);
    if (sessionsWithRecords.length === 0) {
      throw new BadRequestError(
        'No attendance records have been submitted for any session in this class yet. ' +
        'Download is available only after faculty records attendance via the app.'
      );
    }

    // ── 5. Determine academic year context ────────────────────────────────────
    const acYear = sessions[0].academicYear;

    // ── 6. Load ALL students for this academic year, sorted by timetable ──────
    const studentWhere = { status: 'ACTIVE' };
    if (acYear?.id) {
      studentWhere.academicYearId = acYear.id;
    }

    const allStudents = await prisma.student.findMany({
      where:   studentWhere,
      orderBy: [{ timetable: 'asc' }, { rollNumber: 'asc' }],
    });

    // ── 7. Build the UNION of all present roll numbers across all sessions ─────
    const presentRollNumbers = new Set();
    for (const session of sessions) {
      for (const record of session.records) {
        presentRollNumbers.add(record.studentRollNumber);
      }
    }

    // ── 8. Sheet 1 — Overall Attendance ──────────────────────────────────────
    const pad = (n) => n.toString().padStart(2, '0');
    const dateStr = `${pad(dy)}-${pad(mo + 1)}-${yr}`;

    let sno = 1;
    const overallData = allStudents.map(student => ({
      'S.No':              sno++,
      'Roll No':           student.rollNumber,
      'Student Name':      student.name,
      'Timetable':         student.timetable || '',
      'Attendance Status': presentRollNumbers.has(student.rollNumber) ? 'P' : 'A',
    }));

    // ── 9. Sheets 2+ — One sheet per session ─────────────────────────────────
    //
    // IMPORTANT: Multiple faculties may scan in the SAME room simultaneously.
    // Therefore room name alone does NOT create a unique sheet key.
    // We track usage and append a counter for duplicates: T1, T1_2, T1_3 ...
    const roomDataMap    = {};
    const sessionInfoMap = {};
    const roomUsageCount = {};

    for (const session of sessionsWithRecords) {
      const baseRoomName = (session.room?.name || 'Session').slice(0, 28);
      roomUsageCount[baseRoomName] = (roomUsageCount[baseRoomName] || 0) + 1;

      const sheetKey = roomUsageCount[baseRoomName] === 1
        ? baseRoomName
        : `${baseRoomName}_${roomUsageCount[baseRoomName]}`;

      const presentInSession = new Set(session.records.map(r => r.studentRollNumber));
      const presentStudents  = allStudents.filter(s => presentInSession.has(s.rollNumber));

      let ttSno = 1;
      roomDataMap[sheetKey] = presentStudents.map(student => ({
        'S.No':              ttSno++,
        'Roll No':           student.rollNumber,
        'Student Name':      student.name,
        'Timetable':         student.timetable || '',
        'Attendance Status': 'P',
      }));

      sessionInfoMap[sheetKey] = {
        professorId:           session.faculty?.facultyId      || 'N/A',
        professorName:         session.faculty?.name           || 'N/A',
        labInchargeName:       session.labIncharge             || 'N/A',
        labInchargeEmployeeId: session.labInchargeEmployeeId   || 'N/A',
        sessionDate:           dateStr,
        sessionTime:           session.sessionTime             || 'N/A',
        subject:               session.subject?.name           || 'N/A',
        topic:                 session.topic                   || 'N/A',
        room:                  session.room?.name              || 'N/A',
      };
    }

    // ── 10. Build canonical workbook name ─────────────────────────────────────
    const workbookName = this._buildWorkbookName({
      academicYear: acYear,
      topic:        sessions[0].topic,
      date:         sessions[0].date,
    });
    const safeFileName = workbookName.replace(/[/\\?*[\]:|"<>]/g, '_');
    const fileName = `${safeFileName}.xlsx`;

    // ── 11. Generate in-memory buffer ─────────────────────────────────────────
    const buffer = generateWorkbookBuffer(overallData, roomDataMap, sessionInfoMap);
    return { buffer, fileName };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Builds the canonical Workbook Name displayed in the table and used as
   * the downloaded file name.
   *
   * Format: ES-"Topic"("AcYear","DD-MM-YYYY")
   * Example: ES-Aptitude(2nd Year,18-07-2026)
   */
  _buildWorkbookName({ academicYear, topic, date }) {
    const pad = (n) => n.toString().padStart(2, '0');
    const d   = new Date(date);
    const dateStr  = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    const acYearName = academicYear?.name || 'All Years';
    const topicName  = topic || 'Session';
    return `ES-${topicName}(${acYearName},${dateStr})`;
  }

  /**
   * Builds the file name for a single-session worksheet download.
   * Format: ES-{Topic}({AcYear},{DD-MM-YYYY},{Room})
   * Example: ES-Aptitude(2nd Year,18-07-2026,T1)
   */
  _buildSessionFileName({ topic, academicYearName, date, roomName }) {
    const pad = (n) => n.toString().padStart(2, '0');
    const d   = new Date(date);
    const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    return `ES-${topic || 'Session'}(${academicYearName || 'All Years'},${dateStr},${roomName || 'NoRoom'})`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SINGLE-SESSION WORKSHEET DOWNLOAD
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generates a SINGLE-SHEET Excel worksheet for one specific AttendanceSession.
   *
   * Sheet contains:
   *   - Student table: S.No | Roll No | Student Name | Timetable | Attendance Status (always P)
   *     Only students actually present in this session (scanned by the faculty)
   *     Sorted by Timetable then Roll No (same order as master data)
   *   - Blank separator
   *   - Session info block: Faculty ID | Faculty Name | Trainer Name |
   *                         Room Number | Topic | Session Date | Session Time
   *
   * File name: ES-{Topic}({AcYear},{DD-MM-YYYY},{Room}).xlsx
   * Nothing is written to disk — returned as a Buffer.
   */
  async downloadSingleSession(sessionId) {
    // ── 1. Load session ────────────────────────────────────────────────────────
    const session = await prisma.attendanceSession.findUnique({
      where:   { id: sessionId },
      include: { faculty: true, room: true, subject: true, academicYear: true, records: true },
    });

    if (!session) throw new NotFoundError('Attendance session not found.');

    if (session.records.length === 0) {
      throw new BadRequestError(
        'No attendance records have been submitted for this session yet. ' +
        'Download is only available once attendance has been recorded.'
      );
    }

    // ── 2. Collect present roll numbers ────────────────────────────────────────
    const presentRollNumbers = new Set(session.records.map(r => r.studentRollNumber));

    // ── 3. Load only students that are present, preserving timetable order ─────
    const allStudents = await prisma.student.findMany({
      where:   { rollNumber: { in: [...presentRollNumbers] } },
      orderBy: [{ timetable: 'asc' }, { rollNumber: 'asc' }],
    });

    // ── 4. Build student rows ──────────────────────────────────────────────────
    const pad = (n) => n.toString().padStart(2, '0');
    const d   = new Date(session.date);
    const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

    let sno = 1;
    const sheetData = allStudents.map(student => ({
      'S.No':              sno++,
      'Roll No':           student.rollNumber,
      'Student Name':      student.name,
      'Timetable':         student.timetable || '',
      'Attendance Status': 'P',
    }));

    // ── 5. Blank separator ─────────────────────────────────────────────────────
    sheetData.push({});
    sheetData.push({});

    // ── 6. Session info block ──────────────────────────────────────────────────
    const roomName = session.room?.name || 'N/A';
    sheetData.push({ 'S.No': 'SESSION INFORMATION' });
    sheetData.push({ 'S.No': 'Faculty ID',    'Roll No': session.faculty?.facultyId    || 'N/A' });
    sheetData.push({ 'S.No': 'Faculty Name',  'Roll No': session.faculty?.name         || 'N/A' });
    sheetData.push({ 'S.No': 'Trainer Name',  'Roll No': session.labIncharge           || 'N/A' });
    sheetData.push({ 'S.No': 'Room Number',   'Roll No': roomName });
    sheetData.push({ 'S.No': 'Topic',         'Roll No': session.topic                 || 'N/A' });
    sheetData.push({ 'S.No': 'Session Date',  'Roll No': dateStr });
    sheetData.push({ 'S.No': 'Session Time',  'Roll No': session.sessionTime           || 'N/A' });

    // ── 7. Build single-sheet workbook in memory ───────────────────────────────
    const xlsx = require('xlsx');
    const wb   = xlsx.utils.book_new();
    const ws   = xlsx.utils.json_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 22 },  // S.No / Info Label
      { wch: 18 },  // Roll No / Info Value
      { wch: 30 },  // Student Name
      { wch: 15 },  // Timetable
      { wch: 18 },  // Attendance Status
    ];
    xlsx.utils.book_append_sheet(wb, ws, 'Session Report');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // ── 8. Build file name ─────────────────────────────────────────────────────
    const rawName = this._buildSessionFileName({
      topic:           session.topic,
      academicYearName: session.academicYear?.name,
      date:            session.date,
      roomName:        session.room?.name,
    });
    const fileName = `${rawName.replace(/[\\/?*[\]:]/g, '_')}.xlsx`;

    return { buffer, fileName };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETION  (still session-level — unchanged)
  // ─────────────────────────────────────────────────────────────────────────────

  async deleteSession(sessionId) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) throw new NotFoundError('Attendance session not found.');
    await prisma.attendanceSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  async bulkDeleteSessions(sessionIds) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      throw new BadRequestError('No session IDs provided for deletion.');
    }
    const { count } = await prisma.attendanceSession.deleteMany({
      where: { id: { in: sessionIds } },
    });
    return { success: true, count };
  }

  /**
   * Delete ALL sessions that belong to one workbook group
   * (same academicYearId + topic + calendar day).
   * Called when the superadmin clicks Delete on a workbook row.
   */
  async deleteWorkbook({ academicYearId, topic, date }) {
    if (!date) {
      throw new BadRequestError('date is required to delete this workbook.');
    }
    const d        = new Date(date);
    const yr = d.getUTCFullYear(), mo = d.getUTCMonth(), dy = d.getUTCDate();
    const dayStart = new Date(Date.UTC(yr, mo, dy,  0,  0,  0,   0));
    const dayEnd   = new Date(Date.UTC(yr, mo, dy, 23, 59, 59, 999));

    const normTopic = (topic === null || topic === '' || topic === 'null' || topic === 'undefined')
      ? null
      : topic;

    const where = {
      date: { gte: dayStart, lte: dayEnd },
      topic: normTopic,
    };
    if (academicYearId && academicYearId !== 'null' && academicYearId !== 'undefined') {
      where.academicYearId = academicYearId;
    }

    const { count } = await prisma.attendanceSession.deleteMany({ where });
    return { success: true, count };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SESSION-LEVEL LISTING  (for the session-centric view tab)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns raw individual AttendanceSessions (not grouped).
   * Used by the "Session View" tab so the superadmin can see every session
   * individually and manage/delete them one-by-one.
   */
  async listRawSessions({ academicYear, topic, date, search, page = 1, limit = 50 } = {}) {
    const skip  = (Math.max(1, page) - 1) * limit;
    const where = {};

    if (topic && topic !== 'All') where.topic = topic;
    if (date) {
      const d        = new Date(date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      where.date     = { gte: dayStart, lte: dayEnd };
    }
    if (academicYear && academicYear !== 'All') {
      where.academicYear = { name: academicYear };
    }

    const include = {
      faculty:      { select: { id: true, facultyId: true, name: true } },
      room:         { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
      subject:      { select: { id: true, name: true } },
      section:      { select: { id: true, name: true } },
      _count:       { select: { records: true } },
    };

    if (!search) {
      const [sessions, total] = await prisma.$transaction([
        prisma.attendanceSession.findMany({ where, skip, take: limit, orderBy: { date: 'desc' }, include }),
        prisma.attendanceSession.count({ where }),
      ]);
      return { sessions, meta: { total, page: Math.max(1, page), limit, totalPages: Math.ceil(total / limit) || 1 } };
    }

    // In-memory search — match against canonical session name: ES-Topic(AcYear,Date,Room)
    const allSessions = await prisma.attendanceSession.findMany({ where, orderBy: { date: 'desc' }, include });
    const searchLower = search.toLowerCase();
    const filtered    = allSessions.filter(s => {
      const d       = new Date(s.date);
      const pad     = (n) => n.toString().padStart(2, '0');
      const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
      const name    = `ES-${s.topic || 'Session'}(${s.academicYear?.name || 'All Years'},${dateStr},${s.room?.name || 'N/A'})`;
      return name.toLowerCase().includes(searchLower);
    });

    const total     = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);
    return { sessions: paginated, meta: { total, page: Math.max(1, page), limit, totalPages: Math.ceil(total / limit) || 1 } };
  }
}

module.exports = new AdminSessionReportService();

