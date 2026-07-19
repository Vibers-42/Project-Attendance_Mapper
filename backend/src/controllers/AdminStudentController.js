const StudentMasterDataService = require('../services/StudentMasterDataService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminStudentController {

  // GET /admin/students — list with optional search + pagination
  async getStudents(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const query = req.query.q || '';
    const batch = req.query.batch || '';   // e.g. "25" → filter rollNumber starting with "25"
    const filters = {};

    if (req.query.status)       filters.status       = req.query.status;
    if (req.query.academicYear) filters.academicYear = req.query.academicYear;
    if (batch)                  filters.batch        = batch;

    const result = await StudentMasterDataService.getStudents(filters, page, limit, query);

    return sendSuccess(res, {
      message: 'Students retrieved successfully',
      data: result.students,
      meta: result.meta,
    });
  }

  // POST /admin/students — add a single student
  async addStudent(req, res) {
    const { rollNumber, name, timetable } = req.body;

    if (!rollNumber || !String(rollNumber).trim()) {
      throw new BadRequestError('Roll No is required.');
    }
    if (!name || !String(name).trim()) {
      throw new BadRequestError('Student Name is required.');
    }
    if (!timetable || !String(timetable).trim()) {
      throw new BadRequestError('Timetable is required.');
    }

    const student = await StudentMasterDataService.addStudent({ rollNumber, name, timetable });

    return sendSuccess(res, {
      message: `Student "${student.rollNumber}" added successfully.`,
      data: student,
      statusCode: 201,
    });
  }

  // DELETE /admin/students/:id — remove a single student
  async deleteStudent(req, res) {
    const { id } = req.params;
    if (!id) throw new BadRequestError('Student ID is required.');

    await StudentMasterDataService.deleteStudent(id);

    return sendSuccess(res, {
      message: 'Student removed from Master Data successfully.',
      data: null,
    });
  }

  // POST /admin/students/upload — additive bulk upload via Excel
  async uploadStudents(req, res) {
    if (!req.file) {
      throw new BadRequestError('No file uploaded.');
    }

    const academicYear = req.body?.academicYear?.trim() || null;
    const result = await StudentMasterDataService.uploadStudents(req.file.buffer, academicYear);

    return sendSuccess(res, {
      message: result.message,
      data: {
        insertedCount: result.insertedCount,
        skippedCount: result.skippedCount,
        totalInFile: result.totalInFile,
      },
    });
  }

  // DELETE /admin/students?academicYear=3rd+Year — bulk delete filtered students
  async deleteStudentsByFilter(req, res) {
    const academicYear = req.query.academicYear?.trim();
    if (!academicYear) {
      throw new BadRequestError('academicYear query parameter is required for bulk delete.');
    }
    const count = await StudentMasterDataService.deleteStudentsByYear(academicYear);
    return sendSuccess(res, {
      message: `Deleted ${count} student(s) from ${academicYear}.`,
      data: { count },
    });
  }

  // GET /admin/students/search — legacy endpoint, kept for backwards compat
  async searchStudents(req, res) {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    const students = await StudentMasterDataService.searchStudents(query, limit);

    return sendSuccess(res, {
      message: 'Search results',
      data: students,
    });
  }
}

module.exports = new AdminStudentController();
