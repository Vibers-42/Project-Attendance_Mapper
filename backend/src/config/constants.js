/**
 * Authentication and authorization constants.
 * Centralizes all auth-related magic values to avoid hardcoding throughout the app.
 */

const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  FACULTY: 'FACULTY',
});

const AUTH_MESSAGES = Object.freeze({
  LOGIN_SUCCESS: 'Login successful.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  TOKEN_MISSING: 'Access denied. No authentication token provided.',
  TOKEN_INVALID: 'Access denied. Invalid or malformed token.',
  TOKEN_EXPIRED: 'Access denied. Token has expired.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  ACCOUNT_NOT_FOUND: 'No account found with this email.',
});

const TOKEN_HEADER = 'authorization';
const TOKEN_PREFIX = 'Bearer ';

module.exports = {
  ROLES,
  AUTH_MESSAGES,
  TOKEN_HEADER,
  TOKEN_PREFIX,
};
