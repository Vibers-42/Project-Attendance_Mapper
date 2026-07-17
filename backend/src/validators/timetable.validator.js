const Joi = require('joi');

const dayOfWeekValidation = Joi.string().valid(
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
);

const getTimetableQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  academicYearId: Joi.string().uuid().optional(),
  departmentId: Joi.string().uuid().optional(),
  semester: Joi.number().integer().min(1).max(8).optional(),
  sectionId: Joi.string().uuid().optional(),
  subjectId: Joi.string().uuid().optional(),
  facultyId: Joi.string().uuid().optional(),
  roomId: Joi.string().uuid().optional(),
  dayOfWeek: dayOfWeekValidation.optional(),
  isLab: Joi.boolean().optional()
});

const getFacultyScheduleQuerySchema = Joi.object({
  dayOfWeek: dayOfWeekValidation.optional()
});

const getSectionScheduleQuerySchema = Joi.object({
  dayOfWeek: dayOfWeekValidation.optional()
});

module.exports = {
  getTimetableQuerySchema,
  getFacultyScheduleQuerySchema,
  getSectionScheduleQuerySchema
};
