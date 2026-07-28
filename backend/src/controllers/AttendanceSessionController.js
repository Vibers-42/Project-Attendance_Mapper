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
    // scannedStudents  — roll numbers submitted by the faculty.
    // confirmed        — Phase 2 flag: skip conflicting students instead of rejecting.
    const { scannedStudents, confirmed = false } = req.body;

    const result = await attendanceService.submitAttendance(
      req.params.id,
      req.user.id,
      scannedStudents,
      confirmed,
    );

    // Build a human-readable summary that reflects both inserted and skipped counts.
    let message = `${result.count} attendance record(s) submitted successfully.`;
    if (result.skipped && result.skipped.length > 0) {
      message += ` ${result.skipped.length} student(s) already present in another active session were skipped.`;
    }

    return sendSuccess(res, {
      data: result,
      message,
    }, 201);
  }
}

module.exports = new AttendanceSessionController();
