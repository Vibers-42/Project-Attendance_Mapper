const sessionRepository = require('../repositories/AttendanceSessionRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

class AttendanceService {
  /**
   * Initializes a new attendance session.
   * Minimal data required. Default state is CREATED.
   */
  async createSession(facultyId, data) {
    const sessionData = {
      ...data,
      facultyId,
      status: 'CREATED',
      date: data.date ? new Date(data.date) : new Date(),
    };
    
    return sessionRepository.create(sessionData);
  }

  /**
   * Retrieves an attendance session by ID.
   * Enforces that the requesting faculty member owns the session.
   */
  async getSession(sessionId, facultyId) {
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Attendance session not found.');
    }

    if (session.facultyId !== facultyId) {
      throw new ForbiddenError('You do not have permission to access this session.');
    }

    return session;
  }

  /**
   * Updates metadata of an existing session (e.g. room, subject).
   * Only permitted if session is CREATED or ACTIVE.
   */
  async updateSession(sessionId, facultyId, data) {
    const session = await this.getSession(sessionId, facultyId);

    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      throw new ConflictError(`Cannot modify a ${session.status.toLowerCase()} session.`);
    }

    // Filter out restricted updates
    const { status, facultyId: _, date, ...updateData } = data;

    return sessionRepository.update(sessionId, updateData);
  }

  /**
   * Marks a session as COMPLETED.
   */
  async completeSession(sessionId, facultyId) {
    const session = await this.getSession(sessionId, facultyId);

    if (session.status === 'COMPLETED') {
      return session; // Idempotent
    }

    if (session.status === 'CANCELLED') {
      throw new ConflictError('Cannot complete a cancelled session.');
    }

    return sessionRepository.update(sessionId, { status: 'COMPLETED' });
  }

  /**
   * Marks a session as CANCELLED.
   */
  async cancelSession(sessionId, facultyId) {
    const session = await this.getSession(sessionId, facultyId);

    if (session.status === 'COMPLETED') {
      throw new ConflictError('Cannot cancel an already completed session.');
    }

    return sessionRepository.update(sessionId, { status: 'CANCELLED' });
  }

  // Modules 11.2 will implement submitAttendance...
  async submitAttendance(sessionId, facultyId, studentRollNumbers) {
    const session = await this.getSession(sessionId, facultyId);

    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      throw new ConflictError(`Cannot submit attendance to a ${session.status.toLowerCase()} session.`);
    }

    // Dedup roll numbers in-memory to reduce database overhead
    const uniqueRollNumbers = [...new Set(studentRollNumbers)];

    if (uniqueRollNumbers.length === 0) {
      return { count: 0 };
    }

    const records = uniqueRollNumbers.map(rollNumber => ({
      sessionId,
      studentRollNumber: rollNumber,
    }));

    const recordRepository = require('../repositories/AttendanceRecordRepository');

    try {
      const result = await recordRepository.bulkCreate(records);
      return { count: result.count };
    } catch (error) {
      // P2003 is Prisma's error code for Foreign Key constraint failed.
      // Since student master data is not yet imported, this will elegantly catch the failure
      // without leaving dirty state.
      if (error.code === 'P2003') {
        const { ValidationError } = require('../utils/AppError');
        throw new ValidationError('One or more scanned students do not exist in the master database.');
      }
      throw error;
    }
  }
}

module.exports = new AttendanceService();
