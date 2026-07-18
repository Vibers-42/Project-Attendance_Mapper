const FacultyMasterDataService = require('../services/FacultyMasterDataService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminFacultyController {

  // GET /admin/faculty?page=&limit=&q=
  async getFaculty(req, res) {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const query = req.query.q || '';
    const filters = {};

    if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === 'true';

    const result = await FacultyMasterDataService.getFaculty(filters, page, limit, query);

    return sendSuccess(res, {
      message: 'Faculty retrieved successfully',
      data: result.faculty,
      meta: result.meta,
    });
  }

  // POST /admin/faculty — add a single faculty member
  async addFaculty(req, res) {
    const { facultyId, name } = req.body;

    if (!facultyId || !String(facultyId).trim()) {
      throw new BadRequestError('Employee ID is required.');
    }
    if (!name || !String(name).trim()) {
      throw new BadRequestError('Faculty Name is required.');
    }

    const faculty = await FacultyMasterDataService.addFaculty({ facultyId, name });

    return sendSuccess(res, {
      message: `Faculty "${faculty.facultyId}" added successfully. Default password: webcap`,
      data: faculty,
      statusCode: 201,
    });
  }

  // DELETE /admin/faculty/:id — remove a single faculty member
  async deleteFaculty(req, res) {
    const { id } = req.params;
    if (!id) throw new BadRequestError('Faculty ID is required.');

    await FacultyMasterDataService.deleteFaculty(id);

    return sendSuccess(res, {
      message: 'Faculty member removed from Master Data successfully.',
      data: null,
    });
  }

  // POST /admin/faculty/upload — bulk replace via Excel
  async uploadFaculty(req, res) {
    if (!req.file) {
      throw new BadRequestError('No file uploaded.');
    }

    const result = await FacultyMasterDataService.uploadFaculty(req.file.buffer);

    return sendSuccess(res, {
      message: result.message,
      data: { insertedCount: result.insertedCount },
    });
  }
}

module.exports = new AdminFacultyController();
