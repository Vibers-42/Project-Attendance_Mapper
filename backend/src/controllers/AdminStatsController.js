const prisma = require('../config/prisma');
const { sendSuccess } = require('../utils/apiResponse');

class AdminStatsController {
  async getStats(req, res) {
    const [studentCount, facultyCount, sessionCount] = await Promise.all([
      prisma.student.count(),
      prisma.faculty.count(),
      // Same rule as the reports pages: templates and cancelled sessions aren't real classes.
      prisma.attendanceSession.count({ where: { isTemplate: false, status: { not: 'CANCELLED' } } }),
    ]);
    return sendSuccess(res, {
      message: 'Stats retrieved successfully.',
      data: { studentCount, facultyCount, sessionCount },
    });
  }
}

module.exports = new AdminStatsController();
