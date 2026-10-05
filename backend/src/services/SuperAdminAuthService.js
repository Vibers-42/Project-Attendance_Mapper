const superAdminRepository = require('../repositories/SuperAdminRepository');
const { comparePassword }  = require('../utils/passwordUtils');
const { generateToken }    = require('../utils/tokenUtils');
const { UnauthorizedError } = require('../utils/AppError');
const authLogger           = require('../utils/authLogger');
const prisma               = require('../config/prisma');

/**
 * Authentication service for the website Admin Portal.
 *
 * WHO CAN LOG IN TO THE WEBSITE:
 *   1. Original super admins stored in the `SuperAdmin` table (legacy/dedicated admins).
 *   2. Faculty members in the `Faculty` table whose role has been promoted to SUPER_ADMIN
 *      via the "Manage Super Admin" feature on the Faculty Master Data page.
 *
 * WHO CAN LOG IN TO THE APP:
 *   All Faculty rows (any role) — handled by FacultyService, not this service.
 *
 * CREDENTIAL LIFECYCLE:
 *   - Faculty promoted   → Faculty.role = SUPER_ADMIN → website login immediately works.
 *   - Faculty revoked    → Faculty.role = FACULTY     → website login immediately fails.
 *   - Faculty deleted    → row removed from Faculty   → both app and website login fail.
 *   - SuperAdmin account → managed in SuperAdmin table, unaffected by faculty changes.
 */
class SuperAdminAuthService {

  /**
   * Authenticate a user for the Admin Portal website.
   * Strategy (two-table lookup):
   *   1. Check the `SuperAdmin` table by employeeId (original/dedicated admins).
   *   2. If not found there, check the `Faculty` table by facultyId — only grant
   *      access if Faculty.role === 'SUPER_ADMIN'.
   *
   * @param {string} employeeId  — the login identifier submitted
   * @param {string} password    — the plain-text password submitted
   * @returns {Promise<{ token: string, user: object }>}
   */
  async authenticate(rawEmployeeId, password) {
    // The route has no body validator; a missing field used to reach Prisma or
    // bcrypt and surface as a 500. Trim so a trailing space from autofill or
    // copy-paste doesn't turn a correct ID into "invalid credentials".
    const employeeId = typeof rawEmployeeId === 'string' ? rawEmployeeId.trim() : '';
    if (!employeeId || typeof password !== 'string' || !password) {
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // ── Step 1: Try the dedicated SuperAdmin table ─────────────────────────
    const admin = await superAdminRepository.findByEmployeeId(employeeId);
    const adminIsActiveSuperAdmin = !!admin && admin.isActive && admin.role === 'SUPER_ADMIN';

    if (adminIsActiveSuperAdmin && await comparePassword(password, admin.passwordHash)) {
      return this._issueSuperAdminSession(admin);
    }

    // ── Step 2: Fallback — check Faculty table ─────────────────────────────
    // Used when a faculty member was promoted to Super Admin, and also when
    // the person has a SuperAdmin row but its password no longer matches:
    // password changes (e.g. from the app) only update Faculty.password, so
    // the SuperAdmin row's hash goes stale and used to lock them out here.
    const faculty = await prisma.faculty.findUnique({
      where: { facultyId: employeeId },
    });

    // No record in either table
    if (!faculty) {
      authLogger.loginFailed(employeeId, admin
        ? 'Incorrect password or inactive (SuperAdmin table), no Faculty row'
        : 'Not found in SuperAdmin or Faculty table');
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // Account exists in Faculty table but is inactive
    if (!faculty.isActive) {
      authLogger.loginFailed(employeeId, 'Faculty account inactive');
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // Faculty exists but has not been granted Super Admin privilege either way
    // Return the SAME generic error to prevent user enumeration
    if (faculty.role !== 'SUPER_ADMIN' && !adminIsActiveSuperAdmin) {
      authLogger.loginFailed(employeeId, `Faculty role ${faculty.role} — not authorized for Admin Portal`);
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // Faculty has SUPER_ADMIN role — verify password (Faculty table uses 'password' field)
    const isPasswordValid = await comparePassword(password, faculty.password);
    if (!isPasswordValid) {
      authLogger.loginFailed(employeeId, 'Incorrect password (Faculty table, SUPER_ADMIN)');
      throw new UnauthorizedError('Invalid Employee ID or Password.');
    }

    // Super Admin access comes from the SuperAdmin row, not Faculty.role:
    // issue that session so /me resolves the profile from the same table.
    if (faculty.role !== 'SUPER_ADMIN') {
      return this._issueSuperAdminSession(admin);
    }

    authLogger.loginSuccess(employeeId);

    // Update lastLoginAt in Faculty table (non-blocking)
    await prisma.faculty.update({
      where: { id: faculty.id },
      data:  { lastLoginAt: new Date() },
    }).catch(() => {});

    // Generate JWT — same shape as SuperAdmin JWT for middleware compatibility
    const token = generateToken({
      id:        faculty.id,
      facultyId: faculty.facultyId,
      role:      faculty.role,   // 'SUPER_ADMIN'
      source:    'faculty',       // indicates this user came from the Faculty table
    });

    // Return safe user object (no password hash)
    return {
      token,
      user: {
        id:           faculty.id,
        employeeId:   faculty.facultyId,
        employeeName: faculty.name,
        role:         faculty.role,
        isActive:     faculty.isActive,
        lastLoginAt:  faculty.lastLoginAt,
        source:       'faculty',
      },
    };
  }

  /** Logs the success and returns { token, user } for a SuperAdmin-table account. */
  async _issueSuperAdminSession(admin) {
    authLogger.loginSuccess(admin.employeeId);
    await superAdminRepository.updateLastLogin(admin.id).catch(() => {});

    const token = generateToken({
      id:        admin.id,
      facultyId: admin.employeeId,   // reuse 'facultyId' JWT claim for middleware compatibility
      role:      admin.role,
      source:    'superadmin',        // indicates which table this user came from
    });

    const { passwordHash: _, ...safeAdmin } = admin;
    return { token, user: { ...safeAdmin, source: 'superadmin' } };
  }

  /**
   * Returns the currently authenticated admin's profile by JWT payload.
   * Handles both SuperAdmin table users and promoted Faculty users.
   *
   * @param {object} jwtPayload — { id, facultyId, role, source }
   * @returns {Promise<object>} Safe user object
   */
  async getProfile(jwtPayload) {
    const { id, source } = jwtPayload;

    if (source === 'faculty') {
      // This user was authenticated from the Faculty table
      const faculty = await prisma.faculty.findUnique({ where: { id } });
      if (!faculty || !faculty.isActive || faculty.role !== 'SUPER_ADMIN') {
        throw new UnauthorizedError('Super Admin account not found or access revoked.');
      }
      const { password: _, ...safe } = faculty;
      return {
        id:           safe.id,
        employeeId:   safe.facultyId,
        employeeName: safe.name,
        role:         safe.role,
        isActive:     safe.isActive,
        lastLoginAt:  safe.lastLoginAt,
        source:       'faculty',
      };
    }

    // source === 'superadmin' or null (legacy token minted before the source claim was added)
    const admin = await superAdminRepository.findById(id);
    if (admin) {
      if (!admin.isActive) {
        throw new UnauthorizedError('Super Admin account not found or inactive.');
      }
      const { passwordHash: _, ...safeAdmin } = admin;
      return { ...safeAdmin, source: 'superadmin' };
    }

    // Legacy null-source token issued for a Faculty-table user — try Faculty as fallback.
    if (source === null) {
      const faculty = await prisma.faculty.findUnique({ where: { id } });
      if (faculty?.isActive && faculty.role === 'SUPER_ADMIN') {
        const { password: _, ...safe } = faculty;
        return {
          id:           safe.id,
          employeeId:   safe.facultyId,
          employeeName: safe.name,
          role:         safe.role,
          isActive:     safe.isActive,
          lastLoginAt:  safe.lastLoginAt,
          source:       'faculty',
        };
      }
    }

    throw new UnauthorizedError('Super Admin account not found or inactive.');
  }
}

module.exports = new SuperAdminAuthService();
