const Joi = require('joi');

const getStudentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED').optional(),
  departmentId: Joi.string().uuid().optional(),
  semester: Joi.number().integer().min(1).max(8).optional(),
  academicYearId: Joi.string().uuid().optional()
});

const searchStudentsQuerySchema = Joi.object({
  q: Joi.string().min(2).required().messages({
    'string.min': 'Search query must be at least 2 characters long',
    'any.required': 'Search query parameter "q" is required'
  }),
  limit: Joi.number().integer().min(1).max(20).default(10)
});

module.exports = {
  getStudentsQuerySchema,
  searchStudentsQuerySchema
};
