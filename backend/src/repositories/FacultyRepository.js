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

  _buildFiltersWhere(filters = {}) {
    const where = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.role)                   where.role     = filters.role;
    return where;
  }

  // ─── Paginated browse (no search) ────────────────────────────────────────
  async findAll(filters = {}, skip = 0, take = 50) {
    return prisma.faculty.findMany({
      where: this._buildFiltersWhere(filters),
      skip,
      take,
      orderBy: { facultyId: 'asc' },
      select: { id: true, facultyId: true, name: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
    });
  }

  async count(filters = {}) {
    return prisma.faculty.count({ where: this._buildFiltersWhere(filters) });
  }

  // ─── Paginated search (PostgreSQL: mode:'insensitive' for case-insensitive) ──
  async searchPaginated(query, skip = 0, take = 50) {
    const q = query.trim();
    return prisma.faculty.findMany({
      where: {
        OR: [
          { facultyId: { contains: q, mode: 'insensitive' } },
          { name:      { contains: q, mode: 'insensitive' } },
        ],
      },
      skip,
      take,
      orderBy: { facultyId: 'asc' },
      select: {
        id:          true,
        facultyId:   true,
        name:        true,
        role:        true,
        isActive:    true,
        createdAt:   true,
        lastLoginAt: true,
      },
    });
  }

  async searchCount(query) {
    const q = query.trim();
    return prisma.faculty.count({
      where: {
        OR: [
          { facultyId: { contains: q, mode: 'insensitive' } },
          { name:      { contains: q, mode: 'insensitive' } },
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

  // ─── Additive upload via Excel (keeps existing records) ──────────────────
  async upsertFaculty(facultyData) {
    // Find which Employee IDs already exist in one query
    const incomingIds = facultyData.map((f) => f.facultyId);
    const existing = await prisma.faculty.findMany({
      where: { facultyId: { in: incomingIds } },
      select: { facultyId: true },
    });
    const existingIds = new Set(existing.map((f) => f.facultyId));

    // Only insert genuinely new faculty — existing accounts are left untouched
    const newFaculty = facultyData.filter((f) => !existingIds.has(f.facultyId));
    if (newFaculty.length === 0) return { count: 0, newFaculty: [] };

    await prisma.faculty.createMany({ data: newFaculty, skipDuplicates: true });
    return { count: newFaculty.length, newFaculty };
  }
}

module.exports = new FacultyRepository();
