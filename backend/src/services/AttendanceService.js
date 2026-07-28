const sessionRepository = require('../repositories/AttendanceSessionRepository');
const { NotFoundError, ForbiddenError, ConflictError } = require('../utils/AppError');

class AttendanceService {
  /**
   * Initializes a new attendance session.
   * Minimal data required. Default state is CREATED.
   */
  async createSession(facultyId, data) {
    const prisma = require('../config/prisma');

    // Resolve text names → UUIDs (mobile app sends human-readable labels)
    let subjectId = data.subjectId;
    let academicYearId = data.academicYearId;
    let derivedTopic = null;

    if (data.subject && !subjectId) {
      const found = await prisma.subject.findFirst({ where: { name: data.subject } });
      if (found) {
        subjectId = found.id;
      } else if (!data.topic) {
        // Subject not yet in DB — derive short topic name so it isn't lost
        const idx = data.subject.lastIndexOf(' - ');
        derivedTopic = idx !== -1 ? data.subject.slice(idx + 3).trim() : data.subject.trim();
      }
    }
    if (data.year && !academicYearId) {
      const found = await prisma.academicYear.findFirst({ where: { name: data.year } });
      academicYearId = found?.id;
    }

    let roomId = data.roomId;
    if (data.roomNumber && data.roomNumber.trim() && !roomId) {
      const room = await prisma.room.upsert({
        where:  { name: data.roomNumber.trim() },
        update: {},
        create: { name: data.roomNumber.trim() },
      });
      roomId = room.id;
    }

    // Strip frontend-only text fields and id (prevent client-controlled primary key).
    const { subject, year, roomNumber: _r, subjectId: _s, academicYearId: _a, id: _id, ...rest } = data;

    const sessionData = {
      ...rest,
      facultyId,
      status: 'CREATED',
      date: data.date ? new Date(data.date) : new Date(),
      ...(subjectId && { subjectId }),
      ...(academicYearId && { academicYearId }),
      ...(roomId && { roomId }),
      // Store derived topic only when no explicit topic was provided and subject wasn't in DB
      ...(derivedTopic && !rest.topic && { topic: derivedTopic }),
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

    const prisma = require('../config/prisma');

    // Resolve text names → relation IDs (same logic as createSession)
    let subjectId = data.subjectId;
    let academicYearId = data.academicYearId;

    if (data.subject && !subjectId) {
      const found = await prisma.subject.findFirst({ where: { name: data.subject } });
      subjectId = found?.id;
    }
    if (data.year && !academicYearId) {
      const found = await prisma.academicYear.findFirst({ where: { name: data.year } });
      academicYearId = found?.id;
    }

    let roomId = data.roomId;
    if (data.roomNumber && data.roomNumber.trim() && !roomId) {
      const room = await prisma.room.upsert({
        where:  { name: data.roomNumber.trim() },
        update: {},
        create: { name: data.roomNumber.trim() },
      });
      roomId = room.id;
    }

    // Strip restricted and frontend-only fields
    const { status, facultyId: _, date, subject, year, roomNumber: _r, subjectId: _s, academicYearId: _a, ...updateData } = data;

    return sessionRepository.update(sessionId, {
      ...updateData,
      ...(subjectId && { subjectId }),
      ...(academicYearId && { academicYearId }),
      ...(roomId && { roomId }),
    });
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
    const { Prisma } = require('@prisma/client');
    const { ValidationError, DuplicateScanError } = require('../utils/AppError');

    try {
      // Use SERIALIZABLE isolation so that two concurrent faculty members submitting
      // the same student at the same moment cannot both pass the conflict check.
      // PostgreSQL will detect the anomaly and abort one transaction with P2034,
      // which we catch below and convert into a user-friendly DuplicateScanError.
      const result = await prisma.$transaction(async (tx) => {
        // ── 1. Verify session ownership and status ─────────────────────────
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

        // ── 2. Cross-session conflict check ────────────────────────────────
        // Find any record where:
        //   a) the studentRollNumber is one we are about to insert, AND
        //   b) it belongs to a DIFFERENT session that is still CREATED or ACTIVE.
        // We join AttendanceSession and Faculty in a single raw-ish Prisma query
        // using nested includes so we can surface the faculty name to the caller.
        const conflictingRecords = await tx.attendanceRecord.findMany({
          where: {
            studentRollNumber: { in: uniqueRollNumbers },
            sessionId:         { not: sessionId },
            session: {
              status: { in: ['CREATED', 'ACTIVE'] },
            },
          },
          select: {
            studentRollNumber: true,
            timestamp:         true,
            sessionId:         true,
            session: {
              select: {
                faculty: { select: { name: true } },
              },
            },
          },
        });

        if (conflictingRecords.length > 0) {
          // Build a structured conflicts list for the frontend.
          const conflicts = conflictingRecords.map((rec) => ({
            rollNumber:  rec.studentRollNumber,
            facultyName: rec.session.faculty.name,
            sessionId:   rec.sessionId,
            timestamp:   rec.timestamp.toISOString(),
          }));

          // Create a deduplicated list of roll numbers for the error message.
          const conflictRolls = [...new Set(conflicts.map((c) => c.rollNumber))];
          throw new DuplicateScanError(
            `${conflictRolls.length === 1
              ? `Roll number ${conflictRolls[0]} is`
              : `Roll numbers ${conflictRolls.join(', ')} are`
            } already present in another active session.`,
            conflicts
          );
        }

        // ── 3. Insert attendance records ───────────────────────────────────
        return tx.attendanceRecord.createMany({
          data: uniqueRollNumbers.map((r) => ({ sessionId, studentRollNumber: r })),
          skipDuplicates: true,
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return { count: result.count };
    } catch (error) {
      // Re-throw our custom errors untouched (they carry the right HTTP status).
      if (error.isOperational) throw error;

      // P2003 — foreign key violation: a scanned roll number is not in the Student table.
      if (error.code === 'P2003') {
        throw new ValidationError(
          'One or more scanned students do not exist in the master database.'
        );
      }

      // P2034 — PostgreSQL detected a serialization anomaly (two concurrent submits
      // raced to insert the same student). Surface this as a duplicate-scan conflict
      // so the faculty sees a meaningful message instead of a generic 500.
      if (error.code === 'P2034') {
        throw new DuplicateScanError(
          'A concurrent submission conflict was detected. Please retry — one of your students may have just been scanned by another faculty member.'
        );
      }

      throw error;
    }
  }
}

module.exports = new AttendanceService();
