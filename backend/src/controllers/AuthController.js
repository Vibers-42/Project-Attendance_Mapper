const facultyService = require('../services/FacultyService');
const facultyRepository = require('../repositories/FacultyRepository');
const { sendSuccess } = require('../utils/apiResponse');
const { AUTH_MESSAGES } = require('../config/constants');
const { NotFoundError } = require('../utils/AppError');

class AuthController {
  async login(req, res) {
    const { facultyId, password } = req.body;
    
    // The request body is already validated by the validateRequest middleware
    const authResult = await facultyService.authenticate(facultyId, password);
    
    return sendSuccess(res, {
      data: authResult,
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
    });
  }

  async getMe(req, res) {
    // req.user is populated by the authenticate middleware
    const faculty = await facultyRepository.findById(req.user.id);
    
    if (!faculty) {
      throw new NotFoundError(AUTH_MESSAGES.ACCOUNT_NOT_FOUND);
    }
    
    // Remove sensitive data before returning
    const { password: _, ...facultyWithoutPassword } = faculty;

    return sendSuccess(res, {
      data: { faculty: facultyWithoutPassword },
      message: 'Current user fetched successfully.',
    });
  }

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;
    
    await facultyService.changePassword(req.user.id, currentPassword, newPassword);
    
    return sendSuccess(res, {
      message: 'Password changed successfully.',
    });
  }
}

module.exports = new AuthController();
