const superAdminRepository = require('../repositories/SuperAdminRepository');
const { comparePassword } = require('../utils/passwordUtils');
const { generateToken } = require('../utils/tokenUtils');
const { UnauthorizedError } = require('../utils/AppError');
const authLogger = require('../utils/authLogger');

/**
 * Authentication service for Super Admin users.
 * Completely separate from FacultyService — operates on the SuperAdmin table only.
 * Mirrors the FacultyService.authenticate() pattern for consistency.
 */
class SuperAdminAuthService {
  /**
   * Authenticates a Super Admin by employeeId and password.
   * Steps:
   *   1. Look up SuperAdmin by employeeId
   *   2. Reject if not found or inactive
   *   3. Compare password against bcrypt hash
   *   4. Verify role is SUPER_ADMIN (defense-in-depth)
   *   5. Update lastLoginAt timestamp
   *   6. Generate a signed JWT
   *   7. Return token + safe user object (no passwordHash)
   *
   * @param {string} employeeId
   * @param {string} password
   * @returns {Promise<{ token: string, user: object }>}
   */
  async authenticate(employeeId, password) {
    // 1. Look up SuperAdmin record
    const admin = await superAdminRepository.findByEmployeeId(employeeId);

    // 2. Reject if not found or inactive — same generic message to prevent user enumeration
    if (!admin || !admin.isActive) {
      authLogger.loginFailed(employeeId, 'Super Admin account not found or inactive');
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // 3. Compare plain password against stored bcrypt hash
    const isPasswordValid = await comparePassword(password, admin.passwordHash);

    if (!isPasswordValid) {
      authLogger.loginFailed(employeeId, 'Incorrect password');
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // 4. Defense-in-depth: verify the role is SUPER_ADMIN
    if (admin.role !== 'SUPER_ADMIN') {
      authLogger.loginFailed(employeeId, `Role mismatch: ${admin.role}`);
      throw new UnauthorizedError('You are not authorized to access the Admin Portal.');
    }

    authLogger.loginSuccess(employeeId);

    // 5. Update last login timestamp (non-blocking — if it fails, don't reject the login)
    await superAdminRepository.updateLastLogin(admin.id).catch(() => {});

    // 6. Generate JWT — same shape as Faculty JWT so existing authenticate middleware works
    const token = generateToken({
      id: admin.id,
      facultyId: admin.employeeId,  // reuses the facultyId claim key for middleware compatibility
      role: admin.role,
    });

    // 7. Build safe user object — never expose passwordHash
    const { passwordHash: _, ...safeAdmin } = admin;

    return { token, user: safeAdmin };
  }

  /**
   * Returns the authenticated Super Admin's profile by their ID.
   * @param {string} id - Internal UUID from the JWT payload
   * @returns {Promise<object>} Safe user object without passwordHash
   */
  async getProfile(id) {
    const admin = await superAdminRepository.findById(id);

    if (!admin) {
      throw new UnauthorizedError('Super Admin account not found.');
    }

    const { passwordHash: _, ...safeAdmin } = admin;
    return safeAdmin;
  }
}

module.exports = new SuperAdminAuthService();
