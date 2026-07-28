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

  async submitAttendance(sessionId, facultyId, studentRollNumbers, confirmed = false) {
    const uniqueRollNumbers = [...new Set(studentRollNumbers)];
    if (uniqueRollNumbers.length === 0) return { count: 0, skipped: [] };

    const prisma = require('../config/prisma');
    const { Prisma } = require('@prisma/client');
    const { ValidationError, DuplicateScanError } = require('../utils/AppError');

    try {
      // SERIALIZABLE isolation ensures two concurrent faculty submits cannot
      // both pass the conflict check simultaneously. PostgreSQL aborts the
      // second with P2034, which we convert to a DuplicateScanError below.
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
        // Find any record where the studentRollNumber is in our batch AND it
        // belongs to a DIFFERENT session that is still CREATED or ACTIVE.
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

        // ── 3. Handle conflicts based on the confirmed flag ────────────────
        if (conflictingRecords.length > 0) {
          if (!confirmed) {
            // ── Phase 1: reject and surface conflict details ───────────────
            const conflicts = conflictingRecords.map((rec) => ({
              rollNumber:  rec.studentRollNumber,
              facultyName: rec.session.faculty.name,
              sessionId:   rec.sessionId,
              timestamp:   rec.timestamp.toISOString(),
            }));

            const conflictRolls = [...new Set(conflicts.map((c) => c.rollNumber))];
            throw new DuplicateScanError(
              `${conflictRolls.length === 1
                ? `Roll number ${conflictRolls[0]} is`
                : `Roll numbers ${conflictRolls.join(', ')} are`
              } already present in another active session.`,
              conflicts
            );
          }

          // ── Phase 2: filter conflicts out, insert the rest ────────────────
          // Re-check is always live (inside the same SERIALIZABLE transaction),
          // so the result is accurate even if the situation changed between
          // the faculty seeing the Phase 1 dialog and pressing Continue.
          const conflictingRollSet = new Set(
            conflictingRecords.map((r) => r.studentRollNumber)
          );
          const toInsert = uniqueRollNumbers.filter((r) => !conflictingRollSet.has(r));
          const skipped  = [...conflictingRollSet];

          if (toInsert.length === 0) {
            // Every submitted student was a conflict — nothing to insert.
            return { count: 0, skipped };
          }

          const insertResult = await tx.attendanceRecord.createMany({
            data: toInsert.map((r) => ({ sessionId, studentRollNumber: r })),
            skipDuplicates: true,
          });

          return { count: insertResult.count, skipped };
        }

        // ── 4. No conflicts — insert all ───────────────────────────────────
        const insertResult = await tx.attendanceRecord.createMany({
          data: uniqueRollNumbers.map((r) => ({ sessionId, studentRollNumber: r })),
          skipDuplicates: true,
        });

        return { count: insertResult.count, skipped: [] };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return result; // { count, skipped }
    } catch (error) {
      // Re-throw our custom errors untouched (they carry the right HTTP status).
      if (error.isOperational) throw error;

      // P2003 — foreign key violation: a scanned roll number is not in the Student table.
      if (error.code === 'P2003') {
        throw new ValidationError(
          'One or more scanned students do not exist in the master database.'
        );
      }

      // P2034 — PostgreSQL serialization anomaly from a true simultaneous race.
      // Surface as a duplicate-scan conflict so the faculty gets a clear 409.
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
