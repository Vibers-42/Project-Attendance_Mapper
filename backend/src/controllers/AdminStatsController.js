const prisma = require('../config/prisma');
const { sendSuccess } = require('../utils/apiResponse');

class AdminStatsController {
  async getStats(req, res) {
    const [studentCount, facultyCount, sessionCount] = await Promise.all([
      prisma.student.count(),
      prisma.faculty.count(),
      prisma.attendanceSession.count(),
    ]);
    return sendSuccess(res, {
      message: 'Stats retrieved successfully.',
      data: { studentCount, facultyCount, sessionCount },
    });
  }
}

module.exports = new AdminStatsController();
