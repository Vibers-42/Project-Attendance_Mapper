const prisma = require('../config/prisma');

class TimetableRepository {
  async findAll(filters = {}, skip = 0, take = 50) {
    const where = {};
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.semester) where.semester = parseInt(filters.semester);
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.facultyId) where.facultyId = filters.facultyId;
    if (filters.roomId) where.roomId = filters.roomId;
    if (filters.dayOfWeek) where.dayOfWeek = filters.dayOfWeek;
    if (filters.isLab !== undefined) where.isLab = filters.isLab === 'true' || filters.isLab === true;

    return prisma.timetableEntry.findMany({
      where,
      skip,
      take,
      include: {
        academicYear: true,
        department: true,
        section: true,
        subject: true,
        faculty: true,
        room: true
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });
  }

  async count(filters = {}) {
    const where = {};
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.semester) where.semester = parseInt(filters.semester);
    if (filters.sectionId) where.sectionId = filters.sectionId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.facultyId) where.facultyId = filters.facultyId;
    if (filters.roomId) where.roomId = filters.roomId;
    if (filters.dayOfWeek) where.dayOfWeek = filters.dayOfWeek;
    if (filters.isLab !== undefined) where.isLab = filters.isLab === 'true' || filters.isLab === true;

    return prisma.timetableEntry.count({ where });
  }

  async findByFaculty(facultyId, dayOfWeek) {
    const where = { facultyId };
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;
    
    return prisma.timetableEntry.findMany({
      where,
      include: {
        academicYear: true,
        department: true,
        section: true,
        subject: true,
        room: true
      },
      orderBy: { startTime: 'asc' }
    });
  }

  async findBySection(sectionId, dayOfWeek) {
    const where = { sectionId };
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;
    
    return prisma.timetableEntry.findMany({
      where,
      include: {
        subject: true,
        faculty: true,
        room: true
      },
      orderBy: { startTime: 'asc' }
    });
  }
}

module.exports = new TimetableRepository();
