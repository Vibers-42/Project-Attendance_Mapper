/**
 * Security-aware authentication event logger.
 * Logs auth events with timestamps for debugging and auditing.
 * NEVER logs passwords, tokens, secrets, or PII.
 */

const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const sanitized = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'hash', 'authorization', 'jwt'];

  for (const [key, val] of Object.entries(obj)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      sanitized[key] = sanitizeObject(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

const logAuthEvent = (event, details = {}) => {
  const timestamp = new Date().toISOString();
  const safeDetails = sanitizeObject(details);

  console.log(`[AUTH ${timestamp}] ${event}`, Object.keys(safeDetails).length > 0 ? safeDetails : '');
};

const authLogger = {
  loginSuccess: (facultyId) => {
    logAuthEvent('LOGIN_SUCCESS', { facultyId });
  },

  loginFailed: (facultyId, reason) => {
    logAuthEvent('LOGIN_FAILED', { facultyId, reason });
  },

  unauthorizedAccess: (path, reason) => {
    logAuthEvent('UNAUTHORIZED', { path, reason });
  },

  forbiddenAccess: (facultyId, path, role) => {
    logAuthEvent('FORBIDDEN', { facultyId, path, requiredRole: 'elevated', currentRole: role });
  },

  tokenExpired: (path) => {
    logAuthEvent('TOKEN_EXPIRED', { path });
  },
};

module.exports = authLogger;
