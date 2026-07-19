const { verifyToken } = require('../utils/tokenUtils');
const { UnauthorizedError } = require('../utils/AppError');
const { AUTH_MESSAGES, TOKEN_HEADER, TOKEN_PREFIX } = require('../config/constants');
const authLogger = require('../utils/authLogger');

/**
 * Authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it, and attaches the decoded user to req.user.
 *
 * Must be applied before any route that requires authentication.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers[TOKEN_HEADER];

  if (!authHeader || !authHeader.startsWith(TOKEN_PREFIX)) {
    authLogger.unauthorizedAccess(req.originalUrl, 'Missing or malformed token');
    throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_MISSING);
  }

  const token = authHeader.slice(TOKEN_PREFIX.length);

  try {
    const decoded = verifyToken(token);
    req.user = {
      id:        decoded.id,
      facultyId: decoded.facultyId,
      role:      decoded.role,
      source:    decoded.source ?? null,  // null for legacy tokens minted before this field was added
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      authLogger.tokenExpired(req.originalUrl);
      throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_EXPIRED);
    }
    authLogger.unauthorizedAccess(req.originalUrl, 'Invalid token');
    throw new UnauthorizedError(AUTH_MESSAGES.TOKEN_INVALID);
  }
};

module.exports = authenticate;
