const prisma = require('../config/prisma');

class FacultyRepository {
  async findById(id) {
    return prisma.faculty.findUnique({ where: { id } });
  }

  async findByFacultyId(facultyId) {
    return prisma.faculty.findUnique({ where: { facultyId } });
  }
  
  async update(id, data) {
    return prisma.faculty.update({ where: { id }, data });
  }
  async findAll(filters = {}, skip = 0, take = 50) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return prisma.faculty.findMany({
      where,
      skip,
      take,
      orderBy: { facultyId: 'asc' },
      select: {
        id: true,
        facultyId: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      }
    });
  }

  async count(filters = {}) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return prisma.faculty.count({ where });
  }

  async search(query, limit = 10) {
    return prisma.faculty.findMany({
      where: {
        OR: [
          { facultyId: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      select: {
        id: true,
        facultyId: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      }
    });
  }

  async replaceFaculty(facultyData) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete all existing faculty (Cascade handles related sessions/timetable)
      await tx.faculty.deleteMany({});
      
      // 2. Insert new faculty
      const result = await tx.faculty.createMany({
        data: facultyData,
        skipDuplicates: true,
      });
      
      return result.count;
    });
  }
}

module.exports = new FacultyRepository();
