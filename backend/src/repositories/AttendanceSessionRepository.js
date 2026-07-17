const prisma = require('../config/prisma');

class AttendanceSessionRepository {
  async create(data) {
    return prisma.attendanceSession.create({
      data,
      include: {
        subject: true,
        room: true,
        academicYear: true,
        section: true,
      },
    });
  }

  async findById(id) {
    return prisma.attendanceSession.findUnique({
      where: { id },
      include: {
        subject: true,
        room: true,
        academicYear: true,
        section: true,
      },
    });
  }

  async findByFacultyId(facultyId) {
    return prisma.attendanceSession.findMany({
      where: { facultyId },
      orderBy: { date: 'desc' },
      include: {
        subject: true,
        room: true,
        academicYear: true,
        section: true,
      },
    });
  }

  async findAll({ where = {}, skip = 0, take = 10, orderBy = { date: 'desc' } } = {}) {
    const [sessions, totalCount] = await prisma.$transaction([
      prisma.attendanceSession.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          subject: true,
          room: true,
          academicYear: true,
          section: true,
        },
      }),
      prisma.attendanceSession.count({ where }),
    ]);

    return { sessions, totalCount };
  }

  async update(id, data) {
    return prisma.attendanceSession.update({
      where: { id },
      data,
      include: {
        subject: true,
        room: true,
        academicYear: true,
        section: true,
      },
    });
  }
}

module.exports = new AttendanceSessionRepository();
