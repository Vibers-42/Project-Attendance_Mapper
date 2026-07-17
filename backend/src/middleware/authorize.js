const { ForbiddenError } = require('../utils/AppError');
const { AUTH_MESSAGES } = require('../config/constants');
const authLogger = require('../utils/authLogger');

/**
 * Role-based authorization middleware factory.
 * Returns middleware that checks if the authenticated user's role
 * is included in the list of allowed roles.
 *
 * Must be used AFTER the authenticate middleware.
 *
 * Usage: router.get('/admin', authenticate, authorize(ROLES.SUPER_ADMIN), handler);
 *
 * @param  {...string} allowedRoles - One or more role strings.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      authLogger.forbiddenAccess(
        req.user?.facultyId || 'unknown',
        req.originalUrl,
        req.user?.role || 'none',
      );
      throw new ForbiddenError(AUTH_MESSAGES.FORBIDDEN);
    }
    next();
  };
};

module.exports = authorize;
