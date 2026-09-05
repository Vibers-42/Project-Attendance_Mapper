const prisma = require('../config/prisma');
const { ForbiddenError, NotFoundError, BadRequestError } = require('../utils/AppError');

class PlacementRepository {
  // ── Session creation ──────────────────────────────────────────────────────────

  /**
   * Creates a PlacementSession with its students and permissions in one transaction.
   * @param {Object} sessionData  - Prisma-ready session fields
   * @param {{ rollNumber, name, phoneNumber? }[]} students
   * @param {{ facultyId, role }[]} permissions - sessionId is injected inside tx
   */
  async createSession(sessionData, students, permissions) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.placementSession.create({ data: sessionData });

      if (students.length > 0) {
        await tx.placementStudent.createMany({
          data: students.map((s) => ({
            rollNumber: s.rollNumber,
            name: s.name,
            phoneNumber: s.phoneNumber ?? null,
            sessionId: session.id,
          })),
        });
      }

      if (permissions.length > 0) {
        await tx.placementSessionPermission.createMany({
          data: permissions.map((p) => ({
            facultyId: p.facultyId,
            role: p.role,
            sessionId: session.id,
          })),
          skipDuplicates: true,
        });
      }

      return tx.placementSession.findUnique({
        where: { id: session.id },
        include: {
          _count: { select: { students: true, permissions: true } },
          createdBy: { select: { name: true } },
        },
      });
    });
  }

  // ── Session list ──────────────────────────────────────────────────────────────

  /**
   * Returns ALL placement sessions visible to every faculty.
   * myRole is the requesting faculty's permission role, or null if they have no
   * explicit permission entry (visibility-only, no access to session internals).
   * @param {string} facultyId
   */
  async getSessionsForFaculty(facultyId) {
    const raw = await prisma.placementSession.findMany({
      include: {
        _count: { select: { students: true } },
        permissions: {
          where: { facultyId },
          select: { role: true },
          take: 1,
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    return raw.map(({ permissions, createdBy, ...session }) => ({
      ...session,
      myRole: permissions[0]?.role ?? null,        // null = no permission
      createdByName: createdBy?.name ?? null,
    }));
  }

  // ── Faculty list ──────────────────────────────────────────────────────────────

  async getActiveFaculty() {
    return prisma.faculty.findMany({
      where: { isActive: true, role: 'FACULTY' },
      select: { id: true, facultyId: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Session lookup ────────────────────────────────────────────────────────────

  async getSessionById(sessionId) {
    return prisma.placementSession.findUnique({
      where: { id: sessionId },
      select: { id: true, title: true, status: true },
    });
  }

  // ── Eligibility list ──────────────────────────────────────────────────────────

  /**
   * Returns the complete eligibility list for a session including phone numbers.
   * Permission-gated: faculty must have an explicit permission entry.
   */
  async getSessionStudents(sessionId, facultyId) {
    const permission = await prisma.placementSessionPermission.findFirst({
      where: { sessionId, facultyId },
    });
    if (!permission) {
      throw new ForbiddenError('You do not have permission to access this session.');
    }

    const students = await prisma.placementStudent.findMany({
      where: { sessionId },
      select: {
        rollNumber: true,
        name: true,
        attendanceStatus: true,
        phoneNumber: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

    return {
      students,
      counts: {
        eligible: students.length,
        present: students.filter((s) => s.attendanceStatus === 'PRESENT').length,
        absent: students.filter((s) => s.attendanceStatus === 'ABSENT').length,
        pending: students.filter((s) => s.attendanceStatus === 'PENDING').length,
      },
    };
  }

  // ── Attendance update ─────────────────────────────────────────────────────────

  async updateAttendance(sessionId, facultyId, rollNumbers) {
    // Session and permission are independent lookups — run them together.
    const [session, permission] = await Promise.all([
      prisma.placementSession.findUnique({ where: { id: sessionId }, select: { status: true } }),
      prisma.placementSessionPermission.findFirst({
        where: { sessionId, facultyId, role: { in: ['OWNER', 'EDITOR'] } },
      }),
    ]);
    if (!session) throw new NotFoundError('Session not found.');
    if (session.status !== 'ACTIVE') {
      throw new BadRequestError('Session is not active.');
    }
    if (!permission) {
      throw new ForbiddenError('You do not have permission to update attendance for this session.');
    }

    const result = await prisma.placementStudent.updateMany({
      where: { sessionId, rollNumber: { in: rollNumbers } },
      data: { attendanceStatus: 'PRESENT', markedAt: new Date() },
    });
    return { updated: result.count };
  }

  // ── Report ────────────────────────────────────────────────────────────────────

  /**
   * Returns the full attendance report for a completed session.
   * Includes createdByName for the Excel workbook summary sheet.
   */
  async getSessionReport(sessionId, facultyId) {
    // Permission and session are independent lookups — run them together.
    const [permission, session] = await Promise.all([
      prisma.placementSessionPermission.findFirst({ where: { sessionId, facultyId } }),
      prisma.placementSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          title: true,
          status: true,
          date: true,
          venue: true,
          description: true,       // attendanceMode
          conductedById: true,
          createdBy: { select: { name: true, facultyId: true } },
        },
      }),
    ]);
    if (!permission) {
      throw new ForbiddenError('You do not have permission to view this report.');
    }
    if (!session) throw new NotFoundError('Session not found.');
    if (session.status !== 'COMPLETED') {
      throw new BadRequestError('Report is only available for completed sessions.');
    }

    const students = await prisma.placementStudent.findMany({
      where: { sessionId },
      select: {
        rollNumber: true,
        name: true,
        attendanceStatus: true,
        phoneNumber: true,
        markedAt: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

    const presentStudents = students.filter((s) => s.attendanceStatus === 'PRESENT');
    const absentStudents = students.filter((s) => s.attendanceStatus === 'ABSENT');

    return {
      session: {
        ...session,
        attendanceMode: session.description,
        createdByName: session.createdBy?.name ?? null,
      },
      eligible: students.length,
      present: presentStudents.length,
      absent: absentStudents.length,
      presentStudents,
      absentStudents,
    };
  }

  // ── Finalize ──────────────────────────────────────────────────────────────────

  async finalizeSession(sessionId, facultyId, rollNumbers = []) {
    return prisma.$transaction(async (tx) => {
      // Session and permission are independent lookups — run them together.
      const [session, permission] = await Promise.all([
        tx.placementSession.findUnique({ where: { id: sessionId }, select: { status: true } }),
        tx.placementSessionPermission.findFirst({
          where: { sessionId, facultyId, role: { in: ['OWNER', 'EDITOR'] } },
        }),
      ]);
      if (!session) throw new NotFoundError('Session not found.');
      if (session.status !== 'ACTIVE') {
        throw new BadRequestError('Session is not active and cannot be finalized.');
      }
      if (!permission) {
        throw new ForbiddenError('You do not have permission to finalize this session.');
      }

      // Mark scanned (offline) roll numbers as PRESENT.
      if (rollNumbers.length > 0) {
        await tx.placementStudent.updateMany({
          where: { sessionId, rollNumber: { in: rollNumbers } },
          data: { attendanceStatus: 'PRESENT', markedAt: new Date() },
        });
      }

      // All remaining PENDING students become ABSENT.
      const absentResult = await tx.placementStudent.updateMany({
        where: { sessionId, attendanceStatus: 'PENDING' },
        data: { attendanceStatus: 'ABSENT' },
      });

      const presentCount = await tx.placementStudent.count({
        where: { sessionId, attendanceStatus: 'PRESENT' },
      });

      // Clear conductedById on completion — session is no longer "live".
      await tx.placementSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', conductedById: null },
      });

      return { presentCount, absentCount: absentResult.count };
    });
  }

  // ── Start session ─────────────────────────────────────────────────────────────

  /**
   * Transitions a DRAFT session to ACTIVE and records the conducting faculty.
   * Only OWNER or EDITOR may start a session.
   */
  async startSession(sessionId, facultyId) {
    // Permission and session are independent lookups — run them together.
    const [permission, session] = await Promise.all([
      prisma.placementSessionPermission.findFirst({
        where: { sessionId, facultyId, role: { in: ['OWNER', 'EDITOR'] } },
      }),
      prisma.placementSession.findUnique({ where: { id: sessionId }, select: { status: true } }),
    ]);
    if (!permission) {
      throw new ForbiddenError('You do not have permission to start this session.');
    }
    if (!session) throw new NotFoundError('Session not found.');
    if (session.status !== 'DRAFT') {
      throw new BadRequestError('Only draft sessions can be started.');
    }

    const raw = await prisma.placementSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE', conductedById: facultyId },
      include: {
        _count: { select: { students: true, permissions: true } },
        permissions: { where: { facultyId }, select: { role: true }, take: 1 },
        createdBy: { select: { name: true } },
      },
    });

    const { permissions, createdBy, ...sessionData } = raw;
    return {
      ...sessionData,
      myRole: permissions[0]?.role ?? 'VIEWER',
      createdByName: createdBy?.name ?? null,
    };
  }

  // ── Update draft ──────────────────────────────────────────────────────────────

  async updateDraft(sessionId, facultyId, sessionData, students) {
    // Permission and session are independent lookups — run them together.
    const [permission, existing] = await Promise.all([
      prisma.placementSessionPermission.findFirst({
        where: { sessionId, facultyId, role: { in: ['OWNER', 'EDITOR'] } },
      }),
      prisma.placementSession.findUnique({ where: { id: sessionId }, select: { status: true } }),
    ]);
    if (!permission) {
      throw new ForbiddenError('You do not have permission to edit this session.');
    }
    if (!existing) throw new NotFoundError('Session not found.');
    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('Only draft sessions can be edited.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.placementSession.update({ where: { id: sessionId }, data: sessionData });

      if (students && students.length > 0) {
        await tx.placementStudent.deleteMany({ where: { sessionId } });
        await tx.placementStudent.createMany({
          data: students.map((s) => ({
            rollNumber: s.rollNumber,
            name: s.name,
            phoneNumber: s.phoneNumber ?? null,
            sessionId,
          })),
        });
      }

      const raw = await tx.placementSession.findUnique({
        where: { id: sessionId },
        include: {
          _count: { select: { students: true, permissions: true } },
          permissions: { where: { facultyId }, select: { role: true }, take: 1 },
          createdBy: { select: { name: true } },
        },
      });
      const { permissions, createdBy, ...updated } = raw;
      return {
        ...updated,
        myRole: permissions[0]?.role ?? 'VIEWER',
        createdByName: createdBy?.name ?? null,
      };
    });
  }

  // ── Delete session ────────────────────────────────────────────────────────────

  /**
   * Hard-deletes a session. Cascade deletes all students and permissions automatically
   * (defined in schema via onDelete: Cascade). Only OWNER may delete.
   */
  async deleteSession(sessionId, facultyId) {
    const permission = await prisma.placementSessionPermission.findFirst({
      where: { sessionId, facultyId, role: 'OWNER' },
    });
    if (!permission) {
      throw new ForbiddenError('Only the session owner can delete this session.');
    }
    await prisma.placementSession.delete({ where: { id: sessionId } });
  }

  // ── Virtual attendance ────────────────────────────────────────────────────────

  /**
   * Records a student's attendance via the public QR-code page.
   * Validates that the session is ACTIVE and the roll number is in the eligibility list.
   */
  async submitVirtualAttendance(sessionId, rollNumber, phoneNumber) {
    const session = await prisma.placementSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (!session) throw new NotFoundError('Session not found.');
    if (session.status !== 'ACTIVE') {
      throw new BadRequestError('This session is no longer accepting attendance.');
    }

    const student = await prisma.placementStudent.findUnique({
      where: { sessionId_rollNumber: { sessionId, rollNumber } },
    });
    if (!student) {
      const err = new BadRequestError('Roll number is not in the eligibility list for this session.');
      err.statusCode = 422;
      throw err;
    }
    if (student.attendanceStatus === 'PRESENT') {
      throw new BadRequestError('Attendance has already been marked for this roll number.');
    }

    const updated = await prisma.placementStudent.update({
      where: { id: student.id },
      data: { attendanceStatus: 'PRESENT', phoneNumber, markedAt: new Date() },
    });
    return { name: updated.name, rollNumber: updated.rollNumber };
  }
}

module.exports = new PlacementRepository();
