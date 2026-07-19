const { ForbiddenError, UnauthorizedError } = require('../utils/AppError');
const { AUTH_MESSAGES } = require('../config/constants');
const authLogger = require('../utils/authLogger');
const prisma = require('../config/prisma');

/**
 * Role-based authorization middleware factory.
 * Returns middleware that checks if the authenticated user's role
 * is included in the list of allowed roles.
 *
 * For SUPER_ADMIN routes, also performs a live DB check so revoked
 * privileges take effect immediately rather than waiting for token expiry.
 *
 * Must be used AFTER the authenticate middleware.
 *
 * Usage: router.get('/admin', authenticate, authorize(ROLES.SUPER_ADMIN), handler);
 *
 * @param  {...string} allowedRoles - One or more role strings.
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      authLogger.forbiddenAccess(
        req.user?.facultyId || 'unknown',
        req.originalUrl,
        req.user?.role || 'none',
      );
      throw new ForbiddenError(AUTH_MESSAGES.FORBIDDEN);
    }

    // Live DB role check for SUPER_ADMIN tokens: the role in the JWT may be stale
    // if privileges were changed after it was issued. Resolve the *current* DB role
    // and re-evaluate access against allowedRoles so that:
    //   - A revoked SUPER_ADMIN can still reach routes that allow FACULTY.
    //   - A revoked SUPER_ADMIN is denied (403) on SUPER_ADMIN-only routes.
    //   - A deactivated account is rejected (401) on every route.
    if (req.user.role === 'SUPER_ADMIN') {
      const { id, source } = req.user;
      let currentDbRole = null;

      if (source === 'faculty') {
        const faculty = await prisma.faculty.findUnique({
          where:  { id },
          select: { role: true, isActive: true },
        });
        if (faculty?.isActive) currentDbRole = faculty.role;
      } else {
        // source === 'superadmin' or null (legacy token) — SuperAdmin table always has SUPER_ADMIN role
        const admin = await prisma.superAdmin.findUnique({
          where:  { id },
          select: { isActive: true },
        });
        if (admin?.isActive) currentDbRole = 'SUPER_ADMIN';
      }

      if (!currentDbRole) {
        // Account deactivated or deleted
        authLogger.forbiddenAccess(req.user?.facultyId || 'unknown', req.originalUrl, 'deactivated');
        throw new UnauthorizedError('Your account has been deactivated. Please log in again.');
      }

      if (!allowedRoles.includes(currentDbRole)) {
        // Privilege was revoked and the current DB role is not permitted on this route
        authLogger.forbiddenAccess(req.user?.facultyId || 'unknown', req.originalUrl, `${req.user.role}→${currentDbRole} (revoked)`);
        throw new ForbiddenError(AUTH_MESSAGES.FORBIDDEN);
      }

      // Propagate the live DB role so downstream handlers see the correct value
      req.user.role = currentDbRole;
    }

    next();
  };
};

module.exports = authorize;
