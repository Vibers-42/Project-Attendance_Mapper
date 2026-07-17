const Joi = require('joi');

const prepareMappingQuerySchema = Joi.object({
  sessionId: Joi.string().uuid().required().messages({
    'string.guid': 'Session ID must be a valid UUID.',
    'any.required': 'Session ID is required.'
  })
});

module.exports = {
  prepareMappingQuerySchema
};
