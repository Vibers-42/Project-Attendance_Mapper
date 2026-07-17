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
      where.date = {
        gte: new Date(queryParams.startDate),
        lte: new Date(queryParams.endDate),
      };
    } else if (queryParams.date) {
      where.date = new Date(queryParams.date);
    }
    
    if (queryParams.roomId) where.roomId = queryParams.roomId;
    if (queryParams.subjectId) where.subjectId = queryParams.subjectId;
    if (queryParams.academicYearId) where.academicYearId = queryParams.academicYearId;
    if (queryParams.sectionId) where.sectionId = queryParams.sectionId;

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
