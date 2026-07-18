const Joi = require('joi');

const startSessionSchema = Joi.object({
  // Relation IDs (sent when UUIDs are known)
  subjectId:     Joi.string().uuid().optional(),
  academicYearId: Joi.string().uuid().optional(),
  sectionId:     Joi.string().uuid().optional(),
  roomId:        Joi.string().uuid().optional(),

  // Text-based names from the mobile app — resolved to IDs in the service layer
  year:       Joi.string().optional(),
  subject:    Joi.string().optional(),
  roomNumber: Joi.string().allow('').optional(),

  // Session metadata
  sessionTime:          Joi.string().optional(),
  semester:             Joi.number().integer().min(1).optional(),
  topic:                Joi.string().optional(),
  labIncharge:          Joi.string().allow('').optional(),
  labInchargeEmployeeId: Joi.string().allow('').optional(),
  date:                 Joi.date().iso().optional(),
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
