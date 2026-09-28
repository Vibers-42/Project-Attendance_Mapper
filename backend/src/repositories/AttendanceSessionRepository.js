const prisma = require('../config/prisma');

// Shared include block to avoid repetition across all queries.
// Includes _count.records so Flutter can display how many students attended each session.
const SESSION_INCLUDE = {
  subject: true,
  room: true,
  academicYear: true,
  section: true,
  _count: {
    select: { records: true },
  },
};

class AttendanceSessionRepository {
  async create(data) {
    return prisma.attendanceSession.create({
      data,
      include: SESSION_INCLUDE,
    });
  }

  async findById(id) {
    return prisma.attendanceSession.findUnique({
      where: { id },
      include: SESSION_INCLUDE,
    });
  }

  async findByFacultyId(facultyId) {
    return prisma.attendanceSession.findMany({
      where: { facultyId },
      orderBy: { date: 'desc' },
      include: SESSION_INCLUDE,
    });
  }

  /**
   * Lists Superadmin-created session templates currently open for Faculty to
   * join — CREATED or ACTIVE, ordered soonest-first. This is the shared
   * "Active Sessions" source of truth for both Superadmin and Faculty views.
   */
  async findTemplates() {
    // Templates are never closed, so without a date bound the faculty "join"
    // list grows forever with past days (and joining one would create a
    // session dated in the past). Keep from the start of yesterday (UTC) so
    // timezone offsets and late-evening classes are still covered.
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    return prisma.attendanceSession.findMany({
      where: {
        isTemplate: true,
        status: { in: ['CREATED', 'ACTIVE'] },
        date: { gte: since },
      },
      orderBy: { date: 'asc' },
      include: SESSION_INCLUDE,
    });
  }

  async findAll({ where = {}, skip = 0, take = 10, orderBy = { date: 'desc' } } = {}) {
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.attendanceSession.findMany({
        where,
        skip,
        take,
        orderBy,
        include: SESSION_INCLUDE,
      }),
      prisma.attendanceSession.count({ where }),
    ]);

    return { sessions, totalCount };
  }

  async update(id, data) {
    return prisma.attendanceSession.update({
      where: { id },
      data,
      include: SESSION_INCLUDE,
    });
  }
}

module.exports = new AttendanceSessionRepository();
