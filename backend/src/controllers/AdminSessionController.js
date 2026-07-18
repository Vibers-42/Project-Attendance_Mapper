const adminSessionReportService = require('../services/AdminSessionReportService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminSessionController {

  /**
   * GET /api/v1/admin/sessions
   * Returns grouped "workbook" records — one per (academicYear, topic, date) class.
   */
  async listSessions(req, res) {
    const { academicYear, topic, date, search, page = 1, limit = 50 } = req.query;
    const result = await adminSessionReportService.listWorkbooks({
      academicYear, topic, date, search,
      page: parseInt(page), limit: parseInt(limit),
    });
    return sendSuccess(res, { message: 'Workbooks retrieved successfully.', data: result.workbooks, meta: result.meta });
  }

  /**
   * GET /api/v1/admin/sessions/raw
   * Returns individual sessions (not grouped) for the session-wise view tab.
   */
  async listRawSessions(req, res) {
    const { academicYear, topic, date, search, page = 1, limit = 50 } = req.query;
    const result = await adminSessionReportService.listRawSessions({
      academicYear, topic, date, search,
      page: parseInt(page), limit: parseInt(limit),
    });
    return sendSuccess(res, { message: 'Sessions retrieved successfully.', data: result.sessions, meta: result.meta });
  }

  /**
   * GET /api/v1/admin/sessions/download?topic=...&date=...&academicYearId=...
   * Generates a consolidated in-memory workbook for ONE class and streams it.
   */
  async downloadSession(req, res) {
    const { academicYearId, topic, date } = req.query;
    // topic can be null/empty — sessions with no topic are valid.
    // Only date is required; service normalises null/empty topic.
    if (!date) throw new BadRequestError('date query parameter is required.');

    const { buffer, fileName } = await adminSessionReportService.downloadWorkbook({ academicYearId, topic, date });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /**
   * DELETE /api/v1/admin/sessions/workbook?topic=...&date=...&academicYearId=...
   * Deletes ALL sessions belonging to a workbook group (same class).
   */
  async deleteWorkbook(req, res) {
    const { academicYearId, topic, date } = req.query;
    // topic can be null/empty; only date is required.
    if (!date) throw new BadRequestError('date query parameter is required.');

    const { count } = await adminSessionReportService.deleteWorkbook({ academicYearId, topic, date });
    return sendSuccess(res, {
      message: `${count} session(s) and all related records deleted successfully.`,
      data: { deletedCount: count },
    });
  }

  /**
   * GET /api/v1/admin/sessions/:id/download
   * Generates a single-sheet Excel worksheet for one session and streams it.
   * Contains: present students table + session info block.
   * No file saved to disk.
   */
  async downloadSingleSession(req, res) {
    const { id } = req.params;
    if (!id) throw new BadRequestError('Session ID is required.');

    const { buffer, fileName } = await adminSessionReportService.downloadSingleSession(id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  /**
   * DELETE /api/v1/admin/sessions/:id — single session hard delete.
   */
  async deleteSession(req, res) {
    const { id } = req.params;
    if (!id) throw new BadRequestError('Session ID is required.');
    await adminSessionReportService.deleteSession(id);
    return sendSuccess(res, { message: 'Session and all related records deleted successfully.', data: null });
  }

  /**
   * POST /api/v1/admin/sessions/bulk-delete
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
