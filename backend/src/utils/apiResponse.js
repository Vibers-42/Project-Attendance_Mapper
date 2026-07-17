/**
 * Standardized API response helpers.
 * Every API endpoint should use these to maintain a consistent response format.
 */

const sendSuccess = (res, { data = null, message = 'Success', statusCode = 200 } = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, { message = 'An error occurred.', errors = [], statusCode = 500 } = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { sendSuccess, sendError };
