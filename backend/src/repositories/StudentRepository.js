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

  _buildFiltersWhere(filters = {}) {
    const where = {};
    if (filters.status)       where.status       = filters.status;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.semester)     where.semester      = parseInt(filters.semester);
    if (filters.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters.academicYear)   where.academicYear   = { name: filters.academicYear };
    return where;
  }

  async findAll(filters = {}, skip = 0, take = 50) {
    return prisma.student.findMany({
      where: this._buildFiltersWhere(filters),
      skip,
      take,
      include: { department: true, academicYear: true, section: true },
      orderBy: { rollNumber: 'asc' },
    });
  }

  async count(filters = {}) {
    return prisma.student.count({ where: this._buildFiltersWhere(filters) });
  }

  /**
   * Build a SQLite-compatible search WHERE clause.
   * SQLite does not support Prisma's `mode: 'insensitive'` (that is Postgres-only).
   * SQLite's LIKE is case-insensitive for ASCII characters by default, so plain
   * `contains` works correctly for roll numbers and names.
   */
  _buildSearchWhere(query) {
    return {
      OR: [
        { rollNumber: { contains: query } },
        { name: { contains: query } },
      ],
    };
  }

  // Paginated search — used by admin student listing when a query is present
  async searchPaginated(query, filters = {}, skip = 0, take = 50) {
    const filterWhere = this._buildFiltersWhere(filters);
    return prisma.student.findMany({
      where: { ...this._buildSearchWhere(query), ...filterWhere },
      skip,
      take,
      include: { department: true, academicYear: true, section: true },
      orderBy: { rollNumber: 'asc' },
    });
  }

  async searchCount(query, filters = {}) {
    const filterWhere = this._buildFiltersWhere(filters);
    return prisma.student.count({
      where: { ...this._buildSearchWhere(query), ...filterWhere },
    });
  }

  // Legacy — used by old /search endpoint, kept for backwards compat
  async search(query, limit = 10) {
    return prisma.student.findMany({
      where: this._buildSearchWhere(query),
      take: limit,
      include: {
        department: true,
        section: true,
      },
    });
  }

  /**
   * Additive upload — only inserts students whose rollNumber does NOT
   * already exist.  Existing records are left completely untouched.
   * Returns { count, newStudents } where count is the number of truly new rows.
   */
  async upsertStudents(studentsData) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch all existing rollNumbers in one query
      const existing = await tx.student.findMany({
        select: { rollNumber: true },
      });
      const existingSet = new Set(existing.map((s) => s.rollNumber));

      // 2. Filter to only genuinely new students
      const newStudents = studentsData.filter(
        (s) => !existingSet.has(s.rollNumber)
      );

      if (newStudents.length === 0) {
        return { count: 0, newStudents: [] };
      }

      // 3. Bulk insert only the new records
      const result = await tx.student.createMany({
        data: newStudents,
        skipDuplicates: true,   // extra safety net
      });

      return { count: result.count, newStudents };
    });
  }

  /**
   * Create a single student record.
   * barcode defaults to rollNumber (used for app scanning).
   */
  async createOne(data) {
    return prisma.student.create({
      data,
      include: { section: true, department: true, academicYear: true },
    });
  }

  /**
   * Delete a single student by their internal ID.
   * Cascade on AttendanceRecord ensures no orphaned records remain.
   */
  async deleteById(id) {
    return prisma.student.delete({ where: { id } });
  }

  /**
   * Return all Section records sorted by name — used to populate the
   * Section dropdown when adding a new student.
   */
  async getAllSections() {
    return prisma.section.findMany({ orderBy: { name: 'asc' } });
  }
}

module.exports = new StudentRepository();
