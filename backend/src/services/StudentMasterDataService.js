const StudentRepository = require('../repositories/StudentRepository');
const DepartmentRepository = require('../repositories/DepartmentRepository');
const { parseStudentExcel } = require('../utils/excelParser');
const { ConflictError, NotFoundError } = require('../utils/AppError');
const prisma = require('../config/prisma');

class StudentMasterDataService {
  // Returns all students as a flat map of { rollNumber, barcode } — used by mobile app for scan validation.
  // No pagination cap: fetches everything in one shot.
  async getScanMap() {
    const prisma = require('../config/prisma');
    const students = await prisma.student.findMany({
      select: { rollNumber: true, barcode: true },
      orderBy: { rollNumber: 'asc' },
    });
    return students;
  }

  // Unified: handles both browse (no query) and search (with query), both paginated
  async getStudents(filters = {}, page = 1, limit = 50, query = '') {
    const skip = (page - 1) * limit;

    let students, total;

    if (query && query.trim().length > 0) {
      [students, total] = await Promise.all([
        StudentRepository.searchPaginated(query.trim(), filters, skip, limit),
        StudentRepository.searchCount(query.trim(), filters),
      ]);
    } else {
      [students, total] = await Promise.all([
        StudentRepository.findAll(filters, skip, limit),
        StudentRepository.count(filters),
      ]);
    }

    return {
      students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentProfile(rollNumber) {
    const student = await StudentRepository.findByRollNumber(rollNumber);
    if (!student) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }
    return student;
  }

  async searchStudents(query, limit = 10) {
    if (!query) return [];
    return await StudentRepository.search(query, limit);
  }

  async getDepartments() {
    return await DepartmentRepository.findAll();
  }

  /**
   * Fetch all sections — used by the frontend Add Student dropdown.
   */
  async getSections() {
    return await StudentRepository.getAllSections();
  }

  /**
   * Add a single student to the Master Data.
   * - Roll number is normalised to UPPERCASE.
   * - barcode is set to rollNumber (required by the scanning app).
   * - timetable is stored directly as a string field on the Student record.
   */
  async addStudent({ rollNumber, name, timetable }) {
    const normRoll = String(rollNumber).toUpperCase().trim();

    // Guard: duplicate roll number
    const existing = await StudentRepository.findByRollNumber(normRoll);
    if (existing) {
      throw new ConflictError(`A student with Roll No "${normRoll}" already exists.`);
    }

    const studentData = {
      rollNumber: normRoll,
      name: String(name).trim(),
      barcode: normRoll, // barcode = rollNumber — used by the scanning app
      timetable: timetable ? String(timetable).trim() : null,
      status: 'ACTIVE',
    };

    return await StudentRepository.createOne(studentData);
  }

  /**
   * Delete a single student by their internal UUID.
   * AttendanceRecord rows are removed automatically via Prisma cascade.
   */
  async deleteStudent(id) {
    // Verify the student exists first so we can surface a clean 404
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundError('Student not found.');
    return await StudentRepository.deleteById(id);
  }

  async uploadStudents(fileBuffer, academicYear = null) {
    const parsedStudents = parseStudentExcel(fileBuffer);

    // Resolve academicYearId from the year name supplied by the upload form
    let academicYearId = null;
    if (academicYear) {
      const yr = await prisma.academicYear.findFirst({ where: { name: academicYear } });
      academicYearId = yr?.id ?? null;
    }

    const { count, updateCount, newStudents } = await StudentRepository.upsertStudents(parsedStudents, academicYearId);
    const skippedCount = parsedStudents.length - count - updateCount;

    const parts = [];
    if (count > 0)        parts.push(`${count} new student(s) added${academicYear ? ` as ${academicYear}` : ''}`);
    if (updateCount > 0)  parts.push(`${updateCount} timetable(s) updated`);
    if (skippedCount > 0) parts.push(`${skippedCount} already existed with no changes`);
    const message = parts.length > 0 ? parts.join(', ') + '.' : 'No changes made.';

    return {
      insertedCount: count,
      updatedCount: updateCount,
      skippedCount,
      totalInFile: parsedStudents.length,
      message,
    };
  }

  async deleteStudentsByYear(academicYear) {
    return await StudentRepository.deleteByFilters({ academicYear });
  }
}

module.exports = new StudentMasterDataService();
