const superAdminAuthService = require('../services/SuperAdminAuthService');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * Controller for Super Admin authentication endpoints.
 * Delegates all business logic to SuperAdminAuthService.
 * Does NOT modify or touch Faculty authentication in any way.
 */
class SuperAdminAuthController {
  /**
   * POST /api/v1/admin/auth/login
   * Authenticates a Super Admin with employeeId and password.
   * Returns a JWT token and safe user object on success.
   * Throws UnauthorizedError (401) on invalid credentials or wrong role.
   */
  async login(req, res) {
    const { employeeId, password } = req.body;

    const { token, user } = await superAdminAuthService.authenticate(employeeId, password);

    return sendSuccess(res, {
      data: { user, token },
      message: 'Login successful.',
    });
  }

  /**
   * GET /api/v1/admin/auth/me
   * Returns the currently authenticated Super Admin's profile.
   * req.user is populated by the authenticate middleware from the JWT payload.
   * We pass the full payload (not just id) so getProfile knows which table to query.
   */
  async getMe(req, res) {
    const user = await superAdminAuthService.getProfile(req.user);

    return sendSuccess(res, {
      data: { user },
      message: 'Current Super Admin fetched successfully.',
    });
  }
}

module.exports = new SuperAdminAuthController();
