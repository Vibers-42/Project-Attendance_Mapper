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
      // Match sessions whose topic field contains the keyword OR whose linked
      // subject name contains it (e.g. "Aptitude" matches "Employability Skills - Aptitude")
      where.OR = [
        { topic: { contains: topic, mode: 'insensitive' } },
        { subject: { name: { contains: topic, mode: 'insensitive' } } },
      ];
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
        subject:      { select: { id: true, name: true } },
        _count:       { select: { records: true } },
      },
    });

    // ── Group by (academicYearId, derived-topic, date-day) ────────────────────
    const groupMap = new Map();

    for (const session of allSessions) {
      const acYearId = session.academicYearId || '__none__';
      // Prefer the session's own topic; fall back to the short name derived from subject
      const derivedTopic = session.topic || this._deriveTopicFromSubject(session.subject?.name);
      const topicKey = (derivedTopic || '').toLowerCase().trim();

      // Use UTC date components to match the UTC day-range used in downloadWorkbook.
      // This prevents a session at 23:xx local time from grouping into the wrong day.
      const d = new Date(session.date);
      const dateKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

      const groupKey = `${acYearId}|${topicKey}|${dateKey}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          _key:         groupKey,
          academicYear: session.academicYear,
          topic:        derivedTopic,  // use derived topic so name shows "Aptitude" not null
          date:         session.date,
          sessionCount: 0,
          totalRecords: 0,
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

    // Handle null/empty topic correctly in Prisma.
    const normTopic = (topic === null || topic === '' || topic === 'null' || topic === 'undefined')
      ? null
      : topic;

    // Sessions may have been created with topic=null + a linked subject (Flutter-created sessions).
    // In that case, the display topic is derived from subject.name (e.g. "Aptitude").
    // We need to find those sessions too, so match EITHER the explicit topic field OR
    // sessions whose subject name contains the derived topic keyword.
    if (normTopic !== null) {
      where.OR = [
        { topic: normTopic },
        { topic: null, subject: { name: { contains: normTopic, mode: 'insensitive' } } },
      ];
    } else {
      where.topic = null;
    }

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

    // ── 6. Build the UNION of all present roll numbers across all sessions ─────
    // (done before student query so we can use it as a fallback filter)
    const presentRollNumbers = new Set();
    for (const session of sessions) {
      for (const record of session.records) {
        presentRollNumbers.add(record.studentRollNumber);
      }
    }

    // ── 7. Load ALL students for this academic year, sorted by timetable ──────
    const studentWhere = { status: 'ACTIVE' };
    if (acYear?.id) {
      studentWhere.academicYearId = acYear.id;
    }

    let allStudents = await prisma.student.findMany({
      where:   studentWhere,
      orderBy: [{ timetable: 'asc' }, { rollNumber: 'asc' }],
    });

    // If no students found via academicYearId (students may not have the link yet),
    // fall back to showing only the students who were actually present in these sessions.
    if (allStudents.length === 0 && presentRollNumbers.size > 0) {
      allStudents = await prisma.student.findMany({
        where:   { rollNumber: { in: [...presentRollNumbers] } },
        orderBy: [{ timetable: 'asc' }, { rollNumber: 'asc' }],
      });
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
    // Derive topic from subject name if session.topic is null (Flutter app creates sessions
    // with topic stored in the subject relation, not the topic field directly).
    const resolvedTopic = sessions[0].topic
      || this._deriveTopicFromSubject(sessions[0].subject?.name);

    const workbookName = this._buildWorkbookName({
      academicYear: acYear,
      topic:        resolvedTopic,
      date:         sessions[0].date,
    });
    const safeFileName = workbookName.replace(/[/\\?*[\]:|">]/g, '_');
    const fileName = `${safeFileName}.xlsx`;

    // ── 11. Generate in-memory buffer ─────────────────────────────────────────
    const buffer = generateWorkbookBuffer(overallData, roomDataMap, sessionInfoMap);
    return { buffer, fileName };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extracts a short display topic from a full subject name.
   * "Employability Skills - Aptitude" → "Aptitude"
   * "Employability Skills - Soft Skills" → "Soft Skills"
   * Returns null if subjectName is falsy.
   */
  _deriveTopicFromSubject(subjectName) {
    if (!subjectName) return null;
    const idx = subjectName.lastIndexOf(' - ');
    return idx !== -1 ? subjectName.slice(idx + 3).trim() : subjectName.trim();
  }

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
        'No attendance records submitted yet. Download is available once attendance is recorded.'
      );
    }

    // ── 2. Collect present students ────────────────────────────────────────────
    const presentRollNumbers = new Set(session.records.map(r => r.studentRollNumber));
    const allStudents = await prisma.student.findMany({
      where:   { rollNumber: { in: [...presentRollNumbers] } },
      orderBy: [{ timetable: 'asc' }, { rollNumber: 'asc' }],
    });

    const pad = (n) => n.toString().padStart(2, '0');
    const d   = new Date(session.date);
    const dateStr      = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    const roomName     = session.room?.name || 'N/A';
    const topicDisplay = session.topic || this._deriveTopicFromSubject(session.subject?.name) || 'N/A';

    // ── 3. Build styled workbook with ExcelJS ──────────────────────────────────
    const ExcelJS  = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const ws       = workbook.addWorksheet('Session Report', { pageSetup: { fitToPage: true } });

    // Column definitions (A–E)
    ws.columns = [
      { width: 22 },  // A: label / S.No
      { width: 26 },  // B: (label continued / Roll No)
      { width: 34 },  // C: value / Student Name
      { width: 15 },  // D: value continued / Timetable
      { width: 18 },  // E: value continued / Status
    ];

    // ── Shared style helpers ───────────────────────────────────────────────────
    const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } };
    const thinBorder = { top: thin, left: thin, bottom: thin, right: thin };

    const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
    const font = (hex, { bold = false, size = 10, name = 'Calibri' } = {}) =>
      ({ name, bold, size, color: { argb: hex } });
    const align = (h, v = 'middle', indent = 0) =>
      ({ horizontal: h, vertical: v, indent, wrapText: false });

    const styleCell = (ref, { bg, fg, bold, size, alignH = 'left', indent = 0, border = false } = {}) => {
      const cell = typeof ref === 'string' ? ws.getCell(ref) : ref;
      if (bg)     cell.fill      = fill(bg);
      if (fg)     cell.font      = font(fg, { bold, size });
      if (border) cell.border    = thinBorder;
      cell.alignment = align(alignH, 'middle', indent);
      return cell;
    };

    let rn = 0; // current row number tracker

    // ── Row 1: Big title ───────────────────────────────────────────────────────
    rn++;
    ws.mergeCells(`A${rn}:E${rn}`);
    ws.getRow(rn).height = 34;
    const titleCell = ws.getCell(`A${rn}`);
    titleCell.value = 'ATTENDANCE REPORT';
    styleCell(titleCell, { bg: 'FF1E40AF', fg: 'FFFFFFFF', bold: true, size: 16, alignH: 'center' });

    // ── Row 2: Subtitle ────────────────────────────────────────────────────────
    rn++;
    ws.mergeCells(`A${rn}:E${rn}`);
    ws.getRow(rn).height = 22;
    const subCell = ws.getCell(`A${rn}`);
    subCell.value = `${topicDisplay}   ·   ${dateStr}   ·   ${roomName}   ·   ${session.academicYear?.name || 'All Years'}`;
    styleCell(subCell, { bg: 'FF2563EB', fg: 'FFFFFFFF', size: 10, alignH: 'center' });

    // ── Row 3: Gap ─────────────────────────────────────────────────────────────
    rn++;
    ws.getRow(rn).height = 10;

    // ── Rows 4–12: Session info table ──────────────────────────────────────────
    const infoRows = [
      ['Faculty ID',          session.faculty?.facultyId    || 'N/A'],
      ['Faculty Name',        session.faculty?.name         || 'N/A'],
      ['Trainer Name',        session.labIncharge           || 'N/A'],
      ['Trainer Employee ID', session.labInchargeEmployeeId || 'N/A'],
      ['Room Number',         roomName],
      ['Topic',               topicDisplay],
      ['Session Date',        dateStr],
      ['Session Time',        session.sessionTime           || 'N/A'],
      ['Students Present',    presentRollNumbers.size],
    ];

    for (const [label, value] of infoRows) {
      rn++;
      ws.getRow(rn).height = 20;
      ws.mergeCells(`A${rn}:B${rn}`);
      ws.mergeCells(`C${rn}:E${rn}`);

      const lCell = ws.getCell(`A${rn}`);
      const vCell = ws.getCell(`C${rn}`);
      lCell.value = label;
      vCell.value = value;

      styleCell(lCell, { bg: 'FFDBEAFE', fg: 'FF1E3A8A', bold: true, border: true, indent: 1 });
      styleCell(vCell, { bg: 'FFF8FAFC', fg: 'FF1F2937', border: true, indent: 1 });
      // Apply border to the B and D/E cells of the merged ranges too
      ws.getCell(`B${rn}`).border = thinBorder;
      ws.getCell(`D${rn}`).border = thinBorder;
      ws.getCell(`E${rn}`).border = thinBorder;
    }

    // ── Gap ────────────────────────────────────────────────────────────────────
    rn++;
    ws.getRow(rn).height = 12;

    // ── Section header ─────────────────────────────────────────────────────────
    rn++;
    ws.mergeCells(`A${rn}:E${rn}`);
    ws.getRow(rn).height = 26;
    const secCell = ws.getCell(`A${rn}`);
    secCell.value = 'STUDENT ATTENDANCE LIST';
    styleCell(secCell, { bg: 'FF1E40AF', fg: 'FFFFFFFF', bold: true, size: 11, alignH: 'center' });

    // ── Table header ───────────────────────────────────────────────────────────
    rn++;
    ws.getRow(rn).height = 22;
    const headers = ['S.No', 'Roll No', 'Student Name', 'Timetable', 'Status'];
    const headerCols = ['A', 'B', 'C', 'D', 'E'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(`${headerCols[i]}${rn}`);
      cell.value = h;
      styleCell(cell, { bg: 'FF2563EB', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
    });

    // ── Student data rows ──────────────────────────────────────────────────────
    if (allStudents.length === 0) {
      rn++;
      ws.getRow(rn).height = 20;
      ws.mergeCells(`A${rn}:E${rn}`);
      const emptyCell = ws.getCell(`A${rn}`);
      emptyCell.value = 'No matching students found in Master Data for this session.';
      styleCell(emptyCell, { bg: 'FFFFF7ED', fg: 'FFB45309', alignH: 'center', border: true });
      ws.getCell(`B${rn}`).border = thinBorder;
      ws.getCell(`C${rn}`).border = thinBorder;
      ws.getCell(`D${rn}`).border = thinBorder;
      ws.getCell(`E${rn}`).border = thinBorder;
    } else {
      allStudents.forEach((student, idx) => {
        rn++;
        ws.getRow(rn).height = 18;
        const isEven = idx % 2 === 1;
        const rowBg  = isEven ? 'FFEFF6FF' : 'FFFFFFFF';
        const values = [idx + 1, student.rollNumber, student.name, student.timetable || '', 'P'];
        values.forEach((val, ci) => {
          const cell = ws.getCell(`${headerCols[ci]}${rn}`);
          cell.value = val;
          styleCell(cell, {
            bg:     rowBg,
            fg:     'FF1F2937',
            border: true,
            alignH: ci === 0 || ci === 4 ? 'center' : 'left',
            indent: ci === 0 || ci === 4 ? 0 : 1,
          });
        });
      });
    }

    // ── Generate buffer ────────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();

    // ── File name ──────────────────────────────────────────────────────────────
    const rawName = this._buildSessionFileName({
      topic:            session.topic || this._deriveTopicFromSubject(session.subject?.name),
      academicYearName: session.academicYear?.name,
      date:             session.date,
      roomName:         session.room?.name,
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

    const where = { date: { gte: dayStart, lte: dayEnd } };
    if (normTopic !== null) {
      where.OR = [
        { topic: normTopic },
        { topic: null, subject: { name: { contains: normTopic, mode: 'insensitive' } } },
      ];
    } else {
      where.topic = null;
    }
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

    if (topic && topic !== 'All') {
      where.OR = [
        { topic: { contains: topic, mode: 'insensitive' } },
        { subject: { name: { contains: topic, mode: 'insensitive' } } },
      ];
    }
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
      const topicDisplay = s.topic || this._deriveTopicFromSubject(s.subject?.name) || 'Session';
      const name    = `ES-${topicDisplay}(${s.academicYear?.name || 'All Years'},${dateStr},${s.room?.name || 'N/A'})`;
      return name.toLowerCase().includes(searchLower);
    });

    const total     = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);
    return { sessions: paginated, meta: { total, page: Math.max(1, page), limit, totalPages: Math.ceil(total / limit) || 1 } };
  }
}

module.exports = new AdminSessionReportService();

