const prisma = require('../config/prisma');

class StudentRepository {
  async findByRollNumber(rollNumber) {
    return prisma.student.findUnique({ where: { rollNumber } });
  }

  async findByBarcode(barcode) {
    return prisma.student.findUnique({ where: { barcode } });
  }

  // Finds all students belonging to a specific academic year and section.
  // Used by Attendance Mapping to identify which students should be in a session.
  async findAllByYearAndSection(academicYearId, sectionId) {
    return prisma.student.findMany({
      where: { academicYearId, sectionId },
      orderBy: { rollNumber: 'asc' },
    });
  }

  async findAll(filters = {}, skip = 0, take = 50) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.semester) where.semester = parseInt(filters.semester);
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;

    return prisma.student.findMany({
      where,
      skip,
      take,
      include: {
        department: true,
        academicYear: true,
        section: true,
      },
      orderBy: { rollNumber: 'asc' },
    });
  }

  async count(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.semester) where.semester = parseInt(filters.semester);
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;

    return prisma.student.count({ where });
  }

  async search(query, limit = 10) {
    return prisma.student.findMany({
      where: {
        OR: [
          { rollNumber: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      include: {
        department: true,
        section: true,
      },
    });
  }
  async replaceStudents(studentsData) {
    // Perform deletion and insertion in a single transaction
    return prisma.$transaction(async (tx) => {
      // 1. Delete all existing students (Cascade will handle AttendanceRecords)
      await tx.student.deleteMany({});
      
      // 2. Insert all new students
      const result = await tx.student.createMany({
        data: studentsData,
        skipDuplicates: true,
      });
      
      return result.count;
    });
  }
}

module.exports = new StudentRepository();
