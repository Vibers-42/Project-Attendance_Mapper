const prisma = require('../config/prisma');
const { generateWorkbookBuffer } = require('../utils/excelGenerator');
const { NotFoundError, BadRequestError } = require('../utils/AppError');

class AdminSessionReportService {

  /**
   * List all attendance sessions (admin view — no facultyId constraint).
   * Supports filtering by academicYear label, topic, and date.
   * Always returns newest sessions first.
   */
  async listSessions({ academicYear, topic, date, search, page = 1, limit = 20 } = {}) {
    const skip = (Math.max(1, page) - 1) * limit;
    const where = {};

    // ── Topic filter ──────────────────────────────────────────────────────────
    if (topic && topic !== 'All') {
      where.topic = topic;
    }

    // ── Date filter ───────────────────────────────────────────────────────────
    if (date) {
      const d = new Date(date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      where.date = { gte: dayStart, lte: dayEnd };
    }

    // ── Academic Year filter (by exact name reference) ────────────────────────
    if (academicYear && academicYear !== 'All') {
      where.academicYear = { name: academicYear };
    }

    // If no search, use DB pagination.
    // If search provided, fetch all matching, construct sessionName, filter/paginate in memory.
    if (!search) {
      const [sessions, total] = await prisma.$transaction([
        prisma.attendanceSession.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            faculty:      { select: { id: true, facultyId: true, name: true } },
            room:         { select: { id: true, name: true } },
            academicYear: { select: { id: true, name: true } },
            subject:      { select: { id: true, name: true } },
            section:      { select: { id: true, name: true } },
            _count:       { select: { records: true } },
          },
        }),
        prisma.attendanceSession.count({ where }),
      ]);

      return {
        sessions,
        meta: {
          total,
          page: Math.max(1, page),
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else {
      // In-memory search: match against the canonical session name
      const allSessions = await prisma.attendanceSession.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          faculty:      { select: { id: true, facultyId: true, name: true } },
          room:         { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
          subject:      { select: { id: true, name: true } },
          section:      { select: { id: true, name: true } },
          _count:       { select: { records: true } },
        },
      });

      const searchLower = search.toLowerCase();

      const filtered = allSessions.filter(session => {
        const name = this._buildSessionName(session).toLowerCase();
        return name.includes(searchLower);
      });

      const total    = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);

      return {
        sessions: paginated,
        meta: {
          total,
          page: Math.max(1, page),
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    }
  }

  /**
   * Builds the canonical Session Name from DB fields.
   *
   * Format:  {AcYear}_{Topic}_{DD-MM-YYYY}_{HH-MMAM/PM}
   * Example: 2ndYear_Aptitude_18-07-2026_09-30AM
   *
   * Rules:
   *  - academicYear.name "2nd Year" → "2ndYear"  (strip whitespace)
   *  - topic spaces replaced with underscores
   *  - date formatted DD-MM-YYYY
   *  - sessionTime "9:30 AM - 12:00 PM" → extracts start time → "09-30AM"
   *    If no sessionTime, the time segment is omitted.
   */
  _buildSessionName(session) {
    const pad = (n) => n.toString().padStart(2, '0');
    const d = session.date;
    const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

    // Academic Year: "2nd Year" → "2ndYear"
    const rawAcYear = session.academicYear?.name || 'AllYears';
    const acYearStr = rawAcYear.replace(/\s+/g, '');

    // Topic: spaces → underscores
    const topicStr = (session.topic || 'Session').replace(/\s+/g, '_');

    // Session Time: extract start time only from "9:30 AM - 12:00 PM"
    let timeSegment = '';
    if (session.sessionTime) {
      // Take only the part before the first '-'
      const startRaw = session.sessionTime.split('-')[0].trim();
      const timeMatch = startRaw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (timeMatch) {
        const hh    = timeMatch[1].padStart(2, '0');
        const mm    = timeMatch[2];
        const ampm  = timeMatch[3].toUpperCase();
        timeSegment = `_${hh}-${mm}${ampm}`;
      }
    }

    return `${acYearStr}_${topicStr}_${dateStr}${timeSegment}`;
  }

  /**
   * Generate and stream an in-memory Excel workbook for one session.
   *
   * Workbook structure:
   *   Sheet 1 — "Overall Attendance"  (ALL students, P or A)
   *   Sheet N — One per unique student.timetable value
   *             (only that timetable's students, P or A)
   *             followed by a SESSION INFORMATION block
   *
   * Nothing is written to disk. The buffer is returned to the controller
   * which streams it directly to the browser.
   */
  async downloadSession(sessionId) {
    // ── 1. Load session with every relation needed ────────────────────────────
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        faculty:      true,
        room:         true,
        subject:      true,
        academicYear: true,   // needed for session name + session info
        records:      true,   // attendance records submitted by faculty
      },
    });

    if (!session) {
      throw new NotFoundError('Attendance session not found.');
    }

    // ── 2. Guard: must have records ───────────────────────────────────────────
    if (session.records.length === 0) {
      throw new BadRequestError(
        'No attendance records have been submitted for this session yet. ' +
        'Download is only available once attendance has been recorded by the faculty.'
      );
    }

    // ── 3. Load ALL active students (ordered by roll number) ──────────────────
    const allStudents = await prisma.student.findMany({
      where:   { status: 'ACTIVE' },
      orderBy: { rollNumber: 'asc' },
    });

    // ── 4. Build the set of present roll numbers ──────────────────────────────
    const presentRollNumbers = new Set(session.records.map(r => r.studentRollNumber));

    // ── 5. Overall Attendance sheet — every student ───────────────────────────
    let sno = 1;
    const overallData = allStudents.map(student => ({
      'S.No':              sno++,
      'Roll No':           student.rollNumber,
      'Student Name':      student.name,
      'Timetable':         student.timetable || '',
      'Attendance Status': presentRollNumbers.has(student.rollNumber) ? 'P' : 'A',
    }));

    // ── 6. Per-timetable sheets ───────────────────────────────────────────────
    // Group students by their timetable label (e.g. "T4(CA2)", "T5(T-HUB)")
    const timetableGroups = {};
    allStudents.forEach(student => {
      const tt = (student.timetable || 'Unassigned').trim();
      if (!timetableGroups[tt]) timetableGroups[tt] = [];
      timetableGroups[tt].push(student);
    });

    // Build the common session info block used in every timetable sheet
    const pad = (n) => n.toString().padStart(2, '0');
    const d = session.date;
    const sessionDateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;

    const sessionInfo = {
      professorName:         session.faculty?.name           || 'N/A',
      labInchargeName:       session.labIncharge             || 'N/A',
      labInchargeEmployeeId: session.labInchargeEmployeeId   || 'N/A',
      sessionDate:           sessionDateStr,
      sessionTime:           session.sessionTime             || 'N/A',
      subject:               session.subject?.name           || 'N/A',
      topic:                 session.topic                   || 'N/A',
    };

    const roomDataMap    = {};
    const sessionInfoMap = {};

    for (const [timetable, students] of Object.entries(timetableGroups)) {
      let ttSno = 1;
      roomDataMap[timetable] = students.map(student => ({
        'S.No':              ttSno++,
        'Roll No':           student.rollNumber,
        'Student Name':      student.name,
        'Timetable':         student.timetable || '',
        'Attendance Status': presentRollNumbers.has(student.rollNumber) ? 'P' : 'A',
      }));

      // Each timetable sheet gets the same session info block.
      // excelGenerator.js prints 'Room: <key>' at the bottom, so the key
      // (timetable label) serves as the Room field automatically.
      sessionInfoMap[timetable] = sessionInfo;
    }

    // ── 7. Generate in-memory Excel buffer (no disk write) ────────────────────
    const buffer = generateWorkbookBuffer(overallData, roomDataMap, sessionInfoMap);

    // ── 8. Build the canonical file name ─────────────────────────────────────
    const sessionName = this._buildSessionName(session);
    // Replace any characters that are illegal in file names
    const fileName = `${sessionName.replace(/[\\/?*[\]:]/g, '_')}.xlsx`;

    return { buffer, fileName };
  }

  /**
   * Hard-delete a session. AttendanceRecords are removed automatically
   * via the onDelete: Cascade constraint defined in the Prisma schema.
   */
  async deleteSession(sessionId) {
    const session = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundError('Attendance session not found.');
    }

    await prisma.attendanceSession.delete({ where: { id: sessionId } });
    return { success: true };
  }

  /**
   * Bulk-delete multiple sessions in a single transaction.
   * AttendanceRecords cascade automatically.
   */
  async bulkDeleteSessions(sessionIds) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      throw new BadRequestError('No session IDs provided for deletion.');
    }

    const { count } = await prisma.attendanceSession.deleteMany({
      where: { id: { in: sessionIds } },
    });

    return { success: true, count };
  }
}

module.exports = new AdminSessionReportService();
