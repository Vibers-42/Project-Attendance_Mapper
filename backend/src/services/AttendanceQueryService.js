const sessionRepository = require('../repositories/AttendanceSessionRepository');
const recordRepository = require('../repositories/AttendanceRecordRepository');
const { NotFoundError, ForbiddenError } = require('../utils/AppError');

class AttendanceQueryService {
  /**
   * Retrieves paginated attendance sessions with optional filtering.
   */
  async getSessions(facultyId, queryParams) {
    const page = Math.max(1, parseInt(queryParams.page) || 1);
    const limit = Math.max(1, parseInt(queryParams.limit) || 10);
    const skip = (page - 1) * limit;

    // Construct dynamic where clause
    const where = { facultyId };

    if (queryParams.status) {
      where.status = queryParams.status.toUpperCase();
    }
    if (queryParams.startDate && queryParams.endDate) {
      // endDate is inclusive — extend to end of that UTC day so single-day queries work.
      const endOfDay = new Date(queryParams.endDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.date = {
        gte: new Date(queryParams.startDate),
        lte: endOfDay,
      };
    } else if (queryParams.date) {
      where.date = new Date(queryParams.date);
    }
    
    if (queryParams.roomId) where.roomId = queryParams.roomId;
    if (queryParams.subjectId) where.subjectId = queryParams.subjectId;
    if (queryParams.academicYearId) where.academicYearId = queryParams.academicYearId;
    if (queryParams.sectionId) where.sectionId = queryParams.sectionId;
    // Subject filter: matched via relation name (works when subjectId is stored on session)
    if (queryParams.subject) where.subject = { name: queryParams.subject };

    // Year filter: AcademicYear.name is "2024-2025" format, not "Second Year"/"Third Year".
    // Match by roll number prefix instead: sessions that have records for that cohort.
    // B1 = regular, B[2-7] = lateral entry (one year ahead of their batch).
    // Second Year: 25B1 (2025 regular) + 26B[2-7] (2026 lateral entry)
    // Third Year:  24B1 (2024 regular) + 25B[2-7] (2025 lateral entry)
    if (queryParams.year === '2nd Year') {
      where.records = {
        some: {
          OR: [
            { studentRollNumber: { startsWith: '25B1' } },
            { studentRollNumber: { startsWith: '26B2' } },
            { studentRollNumber: { startsWith: '26B3' } },
            { studentRollNumber: { startsWith: '26B4' } },
            { studentRollNumber: { startsWith: '26B5' } },
            { studentRollNumber: { startsWith: '26B6' } },
            { studentRollNumber: { startsWith: '26B7' } },
          ],
        },
      };
    } else if (queryParams.year === '3rd Year') {
      where.records = {
        some: {
          OR: [
            { studentRollNumber: { startsWith: '24B1' } },
            { studentRollNumber: { startsWith: '25B2' } },
            { studentRollNumber: { startsWith: '25B3' } },
            { studentRollNumber: { startsWith: '25B4' } },
            { studentRollNumber: { startsWith: '25B5' } },
            { studentRollNumber: { startsWith: '25B6' } },
            { studentRollNumber: { startsWith: '25B7' } },
          ],
        },
      };
    }

    const { sessions, totalCount } = await sessionRepository.findAll({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' }, // Can be made dynamic if needed
    });

    return {
      sessions,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Retrieves the currently active session for a faculty member.
   * Useful for app boot to immediately resume attendance.
   */
  async getActiveSession(facultyId) {
    const { sessions } = await sessionRepository.findAll({
      where: {
        facultyId,
        status: { in: ['CREATED', 'ACTIVE'] },
      },
      take: 1,
      orderBy: { date: 'desc' },
    });

    if (sessions.length === 0) {
      throw new NotFoundError('No active attendance session found.');
    }

    return sessions[0];
  }

  /**
   * Retrieves all scanned attendance records for a specific session.
   */
  async getSessionRecords(sessionId, facultyId) {
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Attendance session not found.');
    }

    if (session.facultyId !== facultyId) {
      throw new ForbiddenError('You do not have permission to view these records.');
    }

    const records = await recordRepository.findBySessionId(sessionId);
    return records;
  }
}

module.exports = new AttendanceQueryService();
