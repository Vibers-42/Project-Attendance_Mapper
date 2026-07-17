const attendanceService = require('../services/AttendanceService');
const { sendSuccess } = require('../utils/apiResponse');

const queryService = require('../services/AttendanceQueryService');

class AttendanceSessionController {
  
  async getSessions(req, res) {
    const result = await queryService.getSessions(req.user.id, req.query);
    return sendSuccess(res, {
      data: result,
      message: 'Sessions retrieved successfully.',
    });
  }

  async getActiveSession(req, res) {
    const session = await queryService.getActiveSession(req.user.id);
    return sendSuccess(res, {
      data: { session },
      message: 'Active session retrieved successfully.',
    });
  }

  async getSessionRecords(req, res) {
    const records = await queryService.getSessionRecords(req.params.id, req.user.id);
    return sendSuccess(res, {
      data: { records },
      message: 'Attendance records retrieved successfully.',
    });
  }

  async create(req, res) {
    const session = await attendanceService.createSession(req.user.id, req.body);
    return sendSuccess(res, {
      data: { session },
      message: 'Attendance session created successfully.',
      statusCode: 201,
    });
  }

  async getSession(req, res) {
    const session = await attendanceService.getSession(req.params.id, req.user.id);
    return sendSuccess(res, {
      data: { session },
      message: 'Session retrieved successfully.',
    });
  }

  async updateSession(req, res) {
    const session = await attendanceService.updateSession(req.params.id, req.user.id, req.body);
    return sendSuccess(res, {
      data: { session },
      message: 'Session updated successfully.',
    });
  }

  async completeSession(req, res) {
    const session = await attendanceService.completeSession(req.params.id, req.user.id);
    return sendSuccess(res, {
      data: { session },
      message: 'Session marked as completed.',
    });
  }

  async cancelSession(req, res) {
    const session = await attendanceService.cancelSession(req.params.id, req.user.id);
    return sendSuccess(res, {
      data: { session },
      message: 'Session cancelled.',
    });
  }

  async submitRecords(req, res) {
    // Note: The sessionId comes from req.params.id (as defined in the route),
    // and the student roll numbers come from req.body.scannedStudents.
    // The Joi validator handles ensuring scannedStudents is a non-empty array.
    const { scannedStudents } = req.body;
    
    const result = await attendanceService.submitAttendance(req.params.id, req.user.id, scannedStudents);
    
    return sendSuccess(res, {
      data: result,
      message: `${result.count} attendance records submitted successfully.`,
    }, 201);
  }
}

module.exports = new AttendanceSessionController();
