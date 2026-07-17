const { ValidationError } = require('../utils/AppError');

/**
 * Request validation middleware factory.
 * Validates the specified request property (body, params, query)
 * against a Joi schema.
 *
 * Usage: router.post('/login', validateRequest(loginSchema), handler);
 *        router.get('/users/:id', validateRequest(paramsSchema, 'params'), handler);
 *
 * @param {Object} schema - A Joi validation schema.
 * @param {string} source - The request property to validate ('body', 'params', 'query').
 */
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      throw new ValidationError('Validation failed.', errors);
    }

    // Replace with validated and stripped value
    req[source] = value;
    next();
  };
};

module.exports = validateRequest;
