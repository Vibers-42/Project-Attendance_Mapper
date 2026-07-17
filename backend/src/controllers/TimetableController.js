const TimetableDataService = require('../services/TimetableDataService');
const { getTimetableQuerySchema, getFacultyScheduleQuerySchema, getSectionScheduleQuerySchema } = require('../validators/timetable.validator');
const { sendSuccess } = require('../utils/apiResponse');

class TimetableController {
  async getTimetable(req, res) {
    const { error, value } = getTimetableQuerySchema.validate(req.query);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { page, limit, ...filters } = value;
    const result = await TimetableDataService.getTimetableEntries(filters, page, limit);

    return sendSuccess(res, {
      message: 'Timetable retrieved successfully',
      data: result.entries,
      meta: result.meta
    });
  }

  async getFacultySchedule(req, res) {
    const { facultyId } = req.params;
    const { error, value } = getFacultyScheduleQuerySchema.validate(req.query);
    
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const schedule = await TimetableDataService.getFacultySchedule(facultyId, value.dayOfWeek);

    return sendSuccess(res, {
      message: 'Faculty schedule retrieved successfully',
      data: schedule
    });
  }

  async getSectionSchedule(req, res) {
    const { sectionId } = req.params;
    const { error, value } = getSectionScheduleQuerySchema.validate(req.query);
    
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const schedule = await TimetableDataService.getSectionSchedule(sectionId, value.dayOfWeek);

    return sendSuccess(res, {
      message: 'Section schedule retrieved successfully',
      data: schedule
    });
  }
}

module.exports = new TimetableController();
