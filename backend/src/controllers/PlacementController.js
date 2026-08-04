const placementService = require('../services/PlacementService');
const { parsePlacementExcel } = require('../utils/excelParser');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class PlacementController {
  async createSession(req, res) {
    const {
      title,
      date,
      venue,
      attendanceMode,
      status,
      students = [],
      permissions = [],
    } = req.body;

    if (!title?.trim()) throw new BadRequestError('Drive name is required.');
    if (!date) throw new BadRequestError('Drive date is required.');

    const session = await placementService.createSession(
      req.user.id,
      { title, date, venue, attendanceMode, status },
      students,
      permissions,
    );

    return sendSuccess(res, {
      data: { session },
      message:
        status === 'ACTIVE'
          ? 'Placement session started successfully.'
          : 'Placement session saved as draft.',
      statusCode: 201,
    });
  }

  async parseExcel(req, res) {
    if (!req.file) throw new BadRequestError('No Excel file uploaded.');
    const students = parsePlacementExcel(req.file.buffer);
    return sendSuccess(res, {
      data: { students, count: students.length },
      message: `${students.length} eligible student(s) parsed from Excel.`,
    });
  }

  async getSessions(req, res) {
    const sessions = await placementService.getSessions(req.user.id);
    return sendSuccess(res, {
      data: { sessions },
      message: 'Placement sessions retrieved.',
    });
  }

  async getFaculty(req, res) {
    const faculty = await placementService.getFacultyList();
    return sendSuccess(res, {
      data: { faculty },
      message: 'Faculty list retrieved.',
    });
  }

  async getSessionStudents(req, res) {
    const { id } = req.params;
    const data = await placementService.getSessionStudents(id, req.user.id);
    return sendSuccess(res, { data, message: 'Students fetched.' });
  }

  async updateAttendance(req, res) {
    const { id } = req.params;
    const { rollNumbers = [] } = req.body;
    if (!Array.isArray(rollNumbers)) throw new BadRequestError('rollNumbers must be an array.');
    const data = await placementService.updateAttendance(id, req.user.id, rollNumbers);
    return sendSuccess(res, { data, message: 'Attendance updated.' });
  }

  async getReport(req, res) {
    const { id } = req.params;
    const data = await placementService.getSessionReport(id, req.user.id);
    return sendSuccess(res, { data, message: 'Report retrieved.' });
  }

  async downloadExcelReport(req, res) {
    const { id } = req.params;
    const reportData = await placementService.getSessionReport(id, req.user.id);
    const buffer = await placementService.generateReportExcel(reportData);
    const safeName = reportData.session.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    res.setHeader('Content-Disposition', `attachment; filename="placement_report_${safeName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }

  async startSession(req, res) {
    const { id } = req.params;
    const session = await placementService.startSession(id, req.user.id);
    return sendSuccess(res, {
      data: { session },
      message: 'Placement session started successfully.',
    });
  }

  async updateDraft(req, res) {
    const { id } = req.params;
    const { title, date, venue, attendanceMode, students } = req.body;
    const session = await placementService.updateDraft(
      req.user.id,
      id,
      { title, date, venue, attendanceMode },
      students,
    );
    return sendSuccess(res, {
      data: { session },
      message: 'Draft updated successfully.',
    });
  }

  async deleteSession(req, res) {
    const { id } = req.params;
    await placementService.deleteSession(id, req.user.id);
    return sendSuccess(res, { message: 'Session deleted successfully.' });
  }

  async finalizeSession(req, res) {
    const { id } = req.params;
    const { rollNumbers = [] } = req.body;
    if (!Array.isArray(rollNumbers)) throw new BadRequestError('rollNumbers must be an array.');
    const data = await placementService.finalizeSession(id, req.user.id, rollNumbers);
    return sendSuccess(res, { data, message: 'Session finalized. Attendance locked.' });
  }
}

module.exports = new PlacementController();
