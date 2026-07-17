const FacultyMasterDataService = require('../services/FacultyMasterDataService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminFacultyController {
  
  async getFaculty(req, res) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filters = {};
    
    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';

    const result = await FacultyMasterDataService.getFaculty(filters, page, limit);

    return sendSuccess(res, {
      message: 'Faculty retrieved successfully',
      data: result.faculty,
      meta: result.meta
    });
  }

  async uploadFaculty(req, res) {
    if (!req.file) {
      throw new BadRequestError('No file uploaded.');
    }

    const result = await FacultyMasterDataService.uploadFaculty(req.file.buffer);

    return sendSuccess(res, {
      message: result.message,
      data: {
        insertedCount: result.insertedCount
      }
    });
  }

  async searchFaculty(req, res) {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 10;

    const faculty = await FacultyMasterDataService.searchFaculty(query, limit);

    return sendSuccess(res, {
      message: 'Search results',
      data: faculty
    });
  }
}

module.exports = new AdminFacultyController();
