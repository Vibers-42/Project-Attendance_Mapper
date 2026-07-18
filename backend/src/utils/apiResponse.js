/**
 * Standardized API response helpers.
 * Every API endpoint should use these to maintain a consistent response format.
 */

const sendSuccess = (res, { data = null, message = 'Success', statusCode = 200, meta = null } = {}) => {
  const body = { success: true, message, data };
  if (meta !== null) body.meta = meta;
  return res.status(statusCode).json(body);
};

const sendError = (res, { message = 'An error occurred.', errors = [], statusCode = 500 } = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { sendSuccess, sendError };
