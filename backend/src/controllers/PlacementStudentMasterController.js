const PlacementStudentMasterService = require('../services/PlacementStudentMasterService');
const { sendSuccess } = require('../utils/apiResponse');
const Joi = require('joi');

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(500).default(50),
  q: Joi.string().allow('').optional()
}).unknown(true);

const addStudentSchema = Joi.object({
  rollNumber: Joi.string().required(),
  name: Joi.string().required(),
  timetable: Joi.string().allow('', null).optional()
});

class PlacementStudentMasterController {
  async getStudents(req, res) {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { page, limit, q } = value;
    const result = await PlacementStudentMasterService.getStudents(page, limit, q);

    return sendSuccess(res, {
      message: 'Placement students retrieved successfully',
      data: result.students,
      meta: result.meta
    });
  }

  async getStudent(req, res) {
    const { rollNumber } = req.params;
    const student = await PlacementStudentMasterService.getStudentProfile(rollNumber);

    return sendSuccess(res, {
      message: 'Placement student retrieved successfully',
      data: student
    });
  }

  async addStudent(req, res) {
    const { error, value } = addStudentSchema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const student = await PlacementStudentMasterService.addStudent(value);
    return sendSuccess(res, {
      message: 'Placement student added successfully',
      data: student
    }, 201);
  }

  async deleteStudent(req, res) {
    const { id } = req.params;
    await PlacementStudentMasterService.deleteStudent(id);

    return sendSuccess(res, {
      message: 'Placement student deleted successfully'
    });
  }
}

module.exports = new PlacementStudentMasterController();
