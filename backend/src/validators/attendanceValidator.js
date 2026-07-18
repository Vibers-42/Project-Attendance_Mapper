const Joi = require('joi');

const startSessionSchema = Joi.object({
  subjectId: Joi.string().uuid().optional(),
  academicYearId: Joi.string().uuid().optional(),
  sectionId: Joi.string().uuid().optional(),
  roomId: Joi.string().uuid().optional(),
  sessionTime: Joi.string().optional(),
  labIncharge: Joi.string().allow('').optional(),
  date: Joi.date().iso().optional(),
  // Text-based names from the mobile app — resolved to IDs in the service layer
  year: Joi.string().optional(),
  subject: Joi.string().optional(),
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
