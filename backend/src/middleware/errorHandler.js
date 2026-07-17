const environment = require('../config/environment');
const { AppError, ValidationError } = require('../utils/AppError');
const { sendError } = require('../utils/apiResponse');

/**
 * Global error handler middleware.
 * Recognizes AppError subclasses and produces standardized responses.
 * Handles Prisma-specific errors gracefully.
 * Never exposes stack traces in production.
 */
const errorHandler = (err, req, res, next) => {
  // Log the error for debugging (stack only in development)
  if (environment.nodeEnv === 'development') {
    console.error('[Error]:', err);
  } else {
    console.error('[Error]:', err.message);
  }

  // Handle our custom AppError hierarchy
  if (err instanceof AppError) {
    return sendError(res, {
      message: err.message,
      errors: err instanceof ValidationError ? err.errors : [],
      statusCode: err.statusCode,
    });
  }

  // Handle Prisma known request errors (e.g., unique constraint violations)
  if (err.code === 'P2002') {
    return sendError(res, {
      message: 'A record with this value already exists.',
      errors: [`Unique constraint violation on: ${err.meta?.target?.join(', ') || 'unknown field'}`],
      statusCode: 409,
    });
  }

  // Handle Prisma not found errors
  if (err.code === 'P2025') {
    return sendError(res, {
      message: 'The requested record was not found.',
      statusCode: 404,
    });
  }

  // Handle JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return sendError(res, {
      message: 'Invalid JSON in request body.',
      statusCode: 400,
    });
  }

  // Fallback for unexpected errors
  return sendError(res, {
    message: environment.nodeEnv === 'production'
      ? 'An unexpected error occurred.'
      : err.message || 'Internal Server Error',
    statusCode: 500,
  });
};

module.exports = errorHandler;
