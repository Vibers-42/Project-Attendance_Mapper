const facultyRepository = require('../repositories/FacultyRepository');
const { comparePassword } = require('../utils/passwordUtils');
const { generateToken } = require('../utils/tokenUtils');
const { UnauthorizedError } = require('../utils/AppError');
const { AUTH_MESSAGES } = require('../config/constants');
const authLogger = require('../utils/authLogger');

class FacultyService {
  async authenticate(facultyId, password) {
    const faculty = await facultyRepository.findByFacultyId(facultyId);

    if (!faculty || !faculty.isActive) {
      authLogger.loginFailed(facultyId, 'Account not found or inactive');
      throw new UnauthorizedError('Invalid faculty ID or password.');
    }

    const isPasswordValid = await comparePassword(password, faculty.password);

    if (!isPasswordValid) {
      authLogger.loginFailed(facultyId, 'Incorrect password');
      throw new UnauthorizedError('Invalid faculty ID or password.');
    }

    authLogger.loginSuccess(facultyId);

    // Update last login
    await facultyRepository.update(faculty.id, { lastLoginAt: new Date() });

    const payload = {
      id: faculty.id,
      facultyId: faculty.facultyId,
      role: faculty.role,
    };

    const token = generateToken(payload);

    // Remove sensitive data before returning
    const { password: _, ...facultyWithoutPassword } = faculty;

    return { token, faculty: facultyWithoutPassword };
  }

  async changePassword(facultyId, currentPassword, newPassword) {
    const faculty = await facultyRepository.findById(facultyId);
    if (!faculty) {
      throw new UnauthorizedError(AUTH_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    const isPasswordValid = await comparePassword(currentPassword, faculty.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Incorrect current password');
    }

    // We need hashPassword from passwordUtils. Let's make sure we have it imported.
    const { hashPassword } = require('../utils/passwordUtils');
    const hashedPassword = await hashPassword(newPassword);

    await facultyRepository.update(facultyId, { password: hashedPassword });
  }
}

module.exports = new FacultyService();
