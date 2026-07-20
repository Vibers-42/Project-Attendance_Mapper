const StudentMasterDataService = require('../services/StudentMasterDataService');
const { getStudentsQuerySchema, searchStudentsQuerySchema } = require('../validators/student.validator');
const { sendSuccess } = require('../utils/apiResponse');

class StudentController {
  async getStudents(req, res) {
    const { error, value } = getStudentsQuerySchema.validate(req.query);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { page, limit, ...filters } = value;
    const result = await StudentMasterDataService.getStudents(filters, page, limit);

    return sendSuccess(res, {
      message: 'Students retrieved successfully',
      data: result.students,
      meta: result.meta
    });
  }

  async getStudent(req, res) {
    const { rollNumber } = req.params;
    const student = await StudentMasterDataService.getStudentProfile(rollNumber);

    return sendSuccess(res, {
      message: 'Student retrieved successfully',
      data: student
    });
  }

  async searchStudents(req, res) {
    const { error, value } = searchStudentsQuerySchema.validate(req.query);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const students = await StudentMasterDataService.searchStudents(value.q, value.limit);

    return sendSuccess(res, {
      message: 'Search results',
      data: students
    });
  }

  async getScanMap(req, res) {
    const students = await StudentMasterDataService.getScanMap();
    return sendSuccess(res, { message: 'Scan map retrieved', data: students });
  }

  async getDepartments(req, res) {
    const departments = await StudentMasterDataService.getDepartments();
    return sendSuccess(res, {
      message: 'Departments retrieved successfully',
      data: departments
    });
  }
}

module.exports = new StudentController();
