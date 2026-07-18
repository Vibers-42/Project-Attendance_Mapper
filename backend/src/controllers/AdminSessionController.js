const adminSessionReportService = require('../services/AdminSessionReportService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminSessionController {

  /**
   * GET /api/v1/admin/sessions
   * Query params: academicYear, topic, date (YYYY-MM-DD), page, limit
   */
  async listSessions(req, res) {
    const {
      academicYear,
      topic,
      date,
      search,
      page  = 1,
      limit = 20,
    } = req.query;

    const result = await adminSessionReportService.listSessions({
      academicYear,
      topic,
      date,
      search,
      page:  parseInt(page),
      limit: parseInt(limit),
    });

    return sendSuccess(res, {
      message: 'Sessions retrieved successfully.',
      data:    result.sessions,
      meta:    result.meta,
    });
  }

  /**
   * GET /api/v1/admin/sessions/:id/download
   * Generates the workbook in memory and streams it to the client.
   * No file is saved to disk.
   */
  async downloadSession(req, res) {
    const { id } = req.params;
    if (!id) throw new BadRequestError('Session ID is required.');

    const { buffer, fileName } = await adminSessionReportService.downloadSession(id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /**
   * DELETE /api/v1/admin/sessions/:id
   * Hard-deletes the session. AttendanceRecords removed via Cascade.
   */
  async deleteSession(req, res) {
    const { id } = req.params;
    if (!id) throw new BadRequestError('Session ID is required.');

    await adminSessionReportService.deleteSession(id);

    return sendSuccess(res, {
      message: 'Attendance session and all related records deleted successfully.',
      data:    null,
    });
  }

  /**
   * POST /api/v1/admin/sessions/bulk-delete
   * Bulk deletes sessions given an array of sessionIds.
   */
  async bulkDeleteSessions(req, res) {
    const { sessionIds } = req.body;
    
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      throw new BadRequestError('An array of sessionIds is required.');
    }

    const { count } = await adminSessionReportService.bulkDeleteSessions(sessionIds);

    return sendSuccess(res, {
      message: `${count} session(s) and their records deleted successfully.`,
      data: { deletedCount: count },
    });
  }
}

module.exports = new AdminSessionController();
