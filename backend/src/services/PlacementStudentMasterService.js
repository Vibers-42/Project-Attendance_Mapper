const PlacementStudentMasterRepository = require('../repositories/PlacementStudentMasterRepository');
const { parseStudentExcel } = require('../utils/excelParser');
const { ConflictError, NotFoundError } = require('../utils/AppError');
const prisma = require('../config/prisma');

class PlacementStudentMasterService {
  async getStudents(page = 1, limit = 50, query = '') {
    const skip = (page - 1) * limit;

    let students, total;

    if (query && query.trim().length > 0) {
      [students, total] = await Promise.all([
        PlacementStudentMasterRepository.searchPaginated(query.trim(), skip, limit),
        PlacementStudentMasterRepository.searchCount(query.trim()),
      ]);
    } else {
      [students, total] = await Promise.all([
        PlacementStudentMasterRepository.findAll(skip, limit),
        PlacementStudentMasterRepository.count(),
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
    const student = await PlacementStudentMasterRepository.findByRollNumber(rollNumber);
    if (!student) {
      const error = new Error('Placement student not found');
      error.statusCode = 404;
      throw error;
    }
    return student;
  }

  async addStudent({ rollNumber, name, timetable }) {
    const normRoll = String(rollNumber).toUpperCase().trim();

    const existing = await PlacementStudentMasterRepository.findByRollNumber(normRoll);
    if (existing) {
      throw new ConflictError(`A placement student with Roll No "${normRoll}" already exists.`);
    }

    const studentData = {
      rollNumber: normRoll,
      name: String(name).trim(),
      timetable: timetable ? String(timetable).trim() : null,
    };

    return await PlacementStudentMasterRepository.createOne(studentData);
  }

  async deleteStudent(id) {
    const student = await prisma.placementStudentMaster.findUnique({ where: { id } });
    if (!student) throw new NotFoundError('Placement student not found.');
    return await PlacementStudentMasterRepository.deleteById(id);
  }

  async uploadStudents(fileBuffer) {
    // Reusing the same parser used for Attendance Master Data
    const parsedStudents = parseStudentExcel(fileBuffer);

    const { count, updateCount } = await PlacementStudentMasterRepository.upsertStudents(parsedStudents);
    const skippedCount = parsedStudents.length - count - updateCount;

    const parts = [];
    if (count > 0)        parts.push(`${count} new placement student(s) added`);
    if (updateCount > 0)  parts.push(`${updateCount} student(s) updated`);
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
}

module.exports = new PlacementStudentMasterService();
