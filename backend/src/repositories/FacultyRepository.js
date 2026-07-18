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

  // ─── Paginated browse (no search) ────────────────────────────────────────
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
      },
    });
  }

  async count(filters = {}) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    return prisma.faculty.count({ where });
  }

  // ─── Paginated search (SQLite-safe: no mode:'insensitive') ───────────────
  async searchPaginated(query, skip = 0, take = 50) {
    const q = query.trim();
    return prisma.faculty.findMany({
      where: {
        OR: [
          { facultyId: { contains: q } },
          { name:      { contains: q } },
        ],
      },
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
      },
    });
  }

  async searchCount(query) {
    const q = query.trim();
    return prisma.faculty.count({
      where: {
        OR: [
          { facultyId: { contains: q } },
          { name:      { contains: q } },
        ],
      },
    });
  }

  // ─── Single-record add ────────────────────────────────────────────────────
  async createOne(data) {
    return prisma.faculty.create({
      data,
      select: {
        id: true,
        facultyId: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
  }

  // ─── Hard delete ──────────────────────────────────────────────────────────
  async deleteById(id) {
    return prisma.faculty.delete({ where: { id } });
  }

  // ─── Bulk replace via Excel ───────────────────────────────────────────────
  async replaceFaculty(facultyData) {
    return prisma.$transaction(async (tx) => {
      // Delete all existing faculty first (cascade removes sessions/timetable)
      await tx.faculty.deleteMany({});

      // Insert the new batch
      const result = await tx.faculty.createMany({
        data: facultyData,
        skipDuplicates: true,
      });

      return result.count;
    });
  }
}

module.exports = new FacultyRepository();
