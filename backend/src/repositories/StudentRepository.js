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
    if (filters.batch)          where.rollNumber     = { startsWith: filters.batch };

    // Year filter: match by roll-number prefix (same rules as AttendanceQueryService).
    // 2nd Year: 25B1 (2025 regular)  + 26B[2-7] (2026 lateral entry)
    // 3rd Year: 24B1 (2024 regular)  + 25B[2-7] (2025 lateral entry)
    if (filters.academicYear === '2nd Year') {
      where.OR = [
        { rollNumber: { startsWith: '25B1' } },
        { rollNumber: { startsWith: '26B2' } },
        { rollNumber: { startsWith: '26B3' } },
        { rollNumber: { startsWith: '26B4' } },
        { rollNumber: { startsWith: '26B5' } },
        { rollNumber: { startsWith: '26B6' } },
        { rollNumber: { startsWith: '26B7' } },
      ];
    } else if (filters.academicYear === '3rd Year') {
      where.OR = [
        { rollNumber: { startsWith: '24B1' } },
        { rollNumber: { startsWith: '25B2' } },
        { rollNumber: { startsWith: '25B3' } },
        { rollNumber: { startsWith: '25B4' } },
        { rollNumber: { startsWith: '25B5' } },
        { rollNumber: { startsWith: '25B6' } },
        { rollNumber: { startsWith: '25B7' } },
      ];
    } else if (filters.academicYear) {
      where.academicYear = { name: filters.academicYear };
    }

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
      where: { AND: [this._buildSearchWhere(query), filterWhere] },
      skip,
      take,
      include: { department: true, academicYear: true, section: true },
      orderBy: { rollNumber: 'asc' },
    });
  }

  async searchCount(query, filters = {}) {
    const filterWhere = this._buildFiltersWhere(filters);
    return prisma.student.count({
      where: { AND: [this._buildSearchWhere(query), filterWhere] },
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
   * Upsert upload:
   *   - New roll numbers → inserted (with academicYearId if provided)
   *   - Existing roll numbers → timetable (and academicYearId) updated when the
   *     uploaded file has that data, so re-uploading always refreshes timetable.
   * Returns { count (inserts), updateCount (timetable updates), newStudents }.
   */
  async upsertStudents(studentsData, academicYearId = null) {
    const allRollNumbers = studentsData.map((s) => s.rollNumber);

    // 1. Fetch existing records (only those in the uploaded file)
    const existing = await prisma.student.findMany({
      where: { rollNumber: { in: allRollNumbers } },
      select: { rollNumber: true },
    });
    const existingSet = new Set(existing.map((s) => s.rollNumber));

    // 2. Split: new students to insert, existing students to patch timetable
    const newStudents = studentsData.filter((s) => !existingSet.has(s.rollNumber));
    const toUpdateTt  = studentsData.filter((s) => existingSet.has(s.rollNumber) && s.timetable);

    // 3. Bulk-insert new students in a transaction (fast single query)
    let insertCount = 0;
    if (newStudents.length > 0) {
      const toInsert = academicYearId
        ? newStudents.map((s) => ({ ...s, academicYearId }))
        : newStudents;
      const result = await prisma.student.createMany({ data: toInsert, skipDuplicates: true });
      insertCount = result.count;
    }

    // 4. Update timetable for existing students — group by timetable value so we
    //    do one updateMany per distinct timetable (e.g. 2-3 queries) instead of
    //    N individual updates, which avoids transaction timeout on large uploads.
    let updateCount = 0;
    if (toUpdateTt.length > 0) {
      const byTimetable = new Map();
      for (const s of toUpdateTt) {
        if (!byTimetable.has(s.timetable)) byTimetable.set(s.timetable, []);
        byTimetable.get(s.timetable).push(s.rollNumber);
      }
      await Promise.all(
        [...byTimetable.entries()].map(([timetable, rollNumbers]) =>
          prisma.student.updateMany({
            where: { rollNumber: { in: rollNumbers } },
            data: { timetable, ...(academicYearId ? { academicYearId } : {}) },
          })
        )
      );
      updateCount = toUpdateTt.length;
    }

    return { count: insertCount, updateCount, newStudents };
  }

  /**
   * Bulk delete students matching a set of filters (same logic as _buildFiltersWhere).
   */
  async deleteByFilters(filters = {}) {
    const where = this._buildFiltersWhere(filters);
    const result = await prisma.student.deleteMany({ where });
    return result.count;
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
