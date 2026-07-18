/**
 * Base application error class.
 * All custom errors should extend this class.
 * The global error handler recognizes this class to produce structured responses.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes expected errors from unexpected crashes
    Error.captureStackTrace(this, this.constructor);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed.', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists.') {
    super(message, 409);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request.') {
    super(message, 400);
  }
}

module.exports = {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
  ConflictError,
  BadRequestError,
};
