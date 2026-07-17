const sessionRepository = require('../repositories/AttendanceSessionRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

class AttendanceService {
  /**
   * Initializes a new attendance session.
   * Minimal data required. Default state is CREATED.
   */
  async createSession(facultyId, data) {
    const prisma = require('../config/prisma');

    // Resolve text subject name → subjectId (if the Subject table has the exact name)
    let subjectId;
    if (data.subject) {
      const found = await prisma.subject.findFirst({ where: { name: data.subject } });
      subjectId = found?.id;
    }

    // Strip frontend-only text fields that have no direct DB column
    const { subject, year, ...rest } = data;

    const sessionData = {
      ...rest,
      facultyId,
      status: 'CREATED',
      date: data.date ? new Date(data.date) : new Date(),
      ...(subjectId && { subjectId }),
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

  async submitAttendance(sessionId, facultyId, studentRollNumbers) {
    const uniqueRollNumbers = [...new Set(studentRollNumbers)];
    if (uniqueRollNumbers.length === 0) return { count: 0 };

    const prisma = require('../config/prisma');
    const { ValidationError } = require('../utils/AppError');

    try {
      // Atomic: status check + record insert in one transaction — prevents
      // a race condition where two concurrent submits both pass the status check.
      const result = await prisma.$transaction(async (tx) => {
        const current = await tx.attendanceSession.findUnique({
          where: { id: sessionId },
          select: { status: true, facultyId: true },
        });

        if (!current) throw new NotFoundError('Attendance session not found.');
        if (current.facultyId !== facultyId) {
          throw new ForbiddenError('You do not have permission to submit to this session.');
        }
        if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
          throw new ConflictError(
            `Cannot submit attendance to a ${current.status.toLowerCase()} session.`
          );
        }

        return tx.attendanceRecord.createMany({
          data: uniqueRollNumbers.map((r) => ({ sessionId, studentRollNumber: r })),
          skipDuplicates: true,
        });
      });

      return { count: result.count };
    } catch (error) {
      if (error.code === 'P2003') {
        throw new ValidationError(
          'One or more scanned students do not exist in the master database.'
        );
      }
      throw error;
    }
  }
}

module.exports = new AttendanceService();
