const Joi = require('joi');

const startSessionSchema = Joi.object({
  subjectId: Joi.string().uuid().optional(),
  academicYearId: Joi.string().uuid().optional(),
  sectionId: Joi.string().uuid().optional(),
  roomId: Joi.string().uuid().optional(),
  sessionTime: Joi.string().optional(),
  semester: Joi.number().integer().min(1).optional(),
  topic: Joi.string().optional(),
  labIncharge: Joi.string().optional(),
  labInchargeEmployeeId: Joi.string().optional(),
  date: Joi.date().iso().optional(),
});

const submitAttendanceSchema = Joi.object({
  scannedStudents: Joi.array().items(
    Joi.string().required()
  ).min(1).required(),
});

module.exports = {
  startSessionSchema,
  submitAttendanceSchema
};
