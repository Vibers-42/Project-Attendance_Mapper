const prisma = require('../config/prisma');

class PlacementRepository {
  /**
   * Creates a PlacementSession with its students and permissions in a single transaction.
   * @param {Object} sessionData - Prisma-ready session fields (no id, no relations)
   * @param {{ rollNumber: string, name: string }[]} students
   * @param {{ facultyId: string, role: string }[]} permissions - sessionId injected inside tx
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
        },
      });
    });
  }

  /**
   * Returns all placement sessions accessible to a faculty member (via permissions),
   * with the faculty's own role flattened onto each session.
   * @param {string} facultyId
   */
  async getSessionsForFaculty(facultyId) {
    const raw = await prisma.placementSession.findMany({
      where: {
        permissions: { some: { facultyId } },
      },
      include: {
        _count: { select: { students: true } },
        permissions: {
          where: { facultyId },
          select: { role: true },
          take: 1,
        },
      },
      orderBy: { date: 'desc' },
    });

    return raw.map(({ permissions, ...session }) => ({
      ...session,
      myRole: permissions[0]?.role ?? 'VIEWER',
    }));
  }

  async getActiveFaculty() {
    return prisma.faculty.findMany({
      where: { isActive: true, role: 'FACULTY' },
      select: { id: true, facultyId: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getSessionById(sessionId) {
    return prisma.placementSession.findUnique({
      where: { id: sessionId },
      select: { id: true, title: true, status: true },
    });
  }

  async getSessionStudents(sessionId, facultyId) {
    const permission = await prisma.placementSessionPermission.findFirst({
      where: { sessionId, facultyId },
    });
    if (!permission) {
      throw Object.assign(new Error('You do not have permission to access this session.'), { statusCode: 403 });
    }
    const students = await prisma.placementStudent.findMany({
      where: { sessionId },
      select: { rollNumber: true, name: true, attendanceStatus: true },
      orderBy: { rollNumber: 'asc' },
    });
    return { students, counts: { eligible: students.length } };
  }

  async updateAttendance(sessionId, facultyId, rollNumbers) {
    const session = await prisma.placementSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
    if (session.status !== 'ACTIVE') {
      throw Object.assign(new Error('Session is not active.'), { statusCode: 400 });
    }
    const permission = await prisma.placementSessionPermission.findFirst({
      where: { sessionId, facultyId, role: { in: ['OWNER', 'EDITOR'] } },
    });
    if (!permission) {
      throw Object.assign(new Error('You do not have permission to update attendance for this session.'), { statusCode: 403 });
    }
    const result = await prisma.placementStudent.updateMany({
      where: { sessionId, rollNumber: { in: rollNumbers } },
      data: { attendanceStatus: 'PRESENT', markedAt: new Date() },
    });
    return { updated: result.count };
  }

  async getSessionReport(sessionId, facultyId) {
    const permission = await prisma.placementSessionPermission.findFirst({
      where: { sessionId, facultyId },
    });
    if (!permission) {
      throw Object.assign(new Error('You do not have permission to view this report.'), { statusCode: 403 });
    }

    const session = await prisma.placementSession.findUnique({
      where: { id: sessionId },
      select: { id: true, title: true, status: true, date: true, venue: true, description: true },
    });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
    if (session.status !== 'COMPLETED') {
      throw Object.assign(new Error('Report is only available for completed sessions.'), { statusCode: 400 });
    }

    const students = await prisma.placementStudent.findMany({
      where: { sessionId },
      select: { rollNumber: true, name: true, attendanceStatus: true, phoneNumber: true, markedAt: true },
      orderBy: { rollNumber: 'asc' },
    });

    const presentStudents = students.filter((s) => s.attendanceStatus === 'PRESENT');
    const absentStudents = students.filter((s) => s.attendanceStatus === 'ABSENT');

    return {
      session,
      eligible: students.length,
      present: presentStudents.length,
      absent: absentStudents.length,
      presentStudents,
      absentStudents,
    };
  }

  async finalizeSession(sessionId, facultyId, rollNumbers = []) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.placementSession.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });
      if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
      if (session.status !== 'ACTIVE') {
        throw Object.assign(new Error('Session is not active and cannot be finalized.'), { statusCode: 400 });
      }

      const permission = await tx.placementSessionPermission.findFirst({
        where: { sessionId, facultyId, role: { in: ['OWNER', 'EDITOR'] } },
      });
      if (!permission) {
        throw Object.assign(new Error('You do not have permission to finalize this session.'), { statusCode: 403 });
      }

      // Mark any locally-scanned (offline) roll numbers as PRESENT.
      if (rollNumbers.length > 0) {
        await tx.placementStudent.updateMany({
          where: { sessionId, rollNumber: { in: rollNumbers } },
          data: { attendanceStatus: 'PRESENT', markedAt: new Date() },
        });
      }

      // Convert all remaining PENDING students to ABSENT.
      const absentResult = await tx.placementStudent.updateMany({
        where: { sessionId, attendanceStatus: 'PENDING' },
        data: { attendanceStatus: 'ABSENT' },
      });

      const presentCount = await tx.placementStudent.count({
        where: { sessionId, attendanceStatus: 'PRESENT' },
      });

      await tx.placementSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED' },
      });

      return { presentCount, absentCount: absentResult.count };
    });
  }

  async deleteSession(sessionId, facultyId) {
    const permission = await prisma.placementSessionPermission.findFirst({
      where: { sessionId, facultyId, role: 'OWNER' },
    });
    if (!permission) {
      throw Object.assign(new Error('Only the session owner can delete this session.'), { statusCode: 403 });
    }
    await prisma.placementSession.delete({ where: { id: sessionId } });
  }

  async submitVirtualAttendance(sessionId, rollNumber, phoneNumber) {
    const session = await prisma.placementSession.findUnique({
      where: { id: sessionId },
      select: { status: true },
    });
    if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
    if (session.status !== 'ACTIVE') {
      throw Object.assign(new Error('This session is no longer accepting attendance.'), { statusCode: 400 });
    }

    const student = await prisma.placementStudent.findUnique({
      where: { sessionId_rollNumber: { sessionId, rollNumber } },
    });
    if (!student) {
      throw Object.assign(new Error('Roll number is not in the eligibility list for this session.'), { statusCode: 422 });
    }
    if (student.attendanceStatus === 'PRESENT') {
      throw Object.assign(new Error('Attendance has already been marked for this roll number.'), { statusCode: 409 });
    }

    const updated = await prisma.placementStudent.update({
      where: { id: student.id },
      data: { attendanceStatus: 'PRESENT', phoneNumber, markedAt: new Date() },
    });
    return { name: updated.name, rollNumber: updated.rollNumber };
  }
}

module.exports = new PlacementRepository();
