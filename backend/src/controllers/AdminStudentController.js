const StudentMasterDataService = require('../services/StudentMasterDataService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminStudentController {
  
  // Reuse existing logic from StudentController for viewing students
  async getStudents(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {};
    
    if (req.query.status) filters.status = req.query.status;

    const result = await StudentMasterDataService.getStudents(filters, page, limit);

    return sendSuccess(res, {
      message: 'Students retrieved successfully',
      data: result.students,
      meta: result.meta
    });
  }

  // Handle uploading and replacing Student Master Data
  async uploadStudents(req, res) {
    if (!req.file) {
      throw new BadRequestError('No file uploaded.');
    }

    const result = await StudentMasterDataService.uploadStudents(req.file.buffer);

    return sendSuccess(res, {
      message: result.message,
      data: {
        insertedCount: result.insertedCount
      }
    });
  }

  async searchStudents(req, res) {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    const students = await StudentMasterDataService.searchStudents(query, limit);

    return sendSuccess(res, {
      message: 'Search results',
      data: students
    });
  }
}

module.exports = new AdminStudentController();
