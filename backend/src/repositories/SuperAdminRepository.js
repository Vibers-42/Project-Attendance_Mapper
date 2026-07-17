const prisma = require('../config/prisma');

/**
 * Repository for SuperAdmin data access.
 * Follows the same pattern as FacultyRepository.
 * Handles all database interactions for the SuperAdmin model.
 */
class SuperAdminRepository {
  /**
   * Find a SuperAdmin by their unique employee ID.
   * @param {string} employeeId
   * @returns {Promise<SuperAdmin|null>}
   */
  async findByEmployeeId(employeeId) {
    return prisma.superAdmin.findUnique({ where: { employeeId } });
  }

  /**
   * Find a SuperAdmin by their internal UUID.
   * @param {string} id
   * @returns {Promise<SuperAdmin|null>}
   */
  async findById(id) {
    return prisma.superAdmin.findUnique({ where: { id } });
  }

  /**
   * Update the last login timestamp for a SuperAdmin.
   * Called after successful authentication.
   * @param {string} id - Internal UUID of the SuperAdmin
   * @returns {Promise<SuperAdmin>}
   */
  async updateLastLogin(id) {
    return prisma.superAdmin.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}

module.exports = new SuperAdminRepository();
