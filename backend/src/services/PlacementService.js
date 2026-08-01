const placementRepository = require('../repositories/PlacementRepository');
const xlsx = require('xlsx');

class PlacementService {
  /**
   * Creates a placement session and auto-grants OWNER to the creator.
   * @param {string} facultyId - JWT user id of the creator
   * @param {Object} body - { title, date, venue, attendanceMode, status }
   * @param {{ rollNumber, name }[]} students
   * @param {{ facultyId, role }[]} extraPermissions - other faculty to grant access
   */
  async createSession(facultyId, body, students, extraPermissions) {
    const { title, date, venue, attendanceMode, status } = body;

    const sessionData = {
      title: title.trim(),
      date: new Date(date),
      venue: venue?.trim() || null,
      description: attendanceMode || null,
      status: status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT',
      createdById: facultyId,
    };

    // Creator always gets OWNER; de-duplicate if they appear in extraPermissions too.
    const permissions = [
      { facultyId, role: 'OWNER' },
      ...extraPermissions.filter((p) => p.facultyId !== facultyId),
    ];

    return placementRepository.createSession(sessionData, students, permissions);
  }

  async getSessions(facultyId) {
    return placementRepository.getSessionsForFaculty(facultyId);
  }

  async getFacultyList() {
    return placementRepository.getActiveFaculty();
  }

  async getSessionById(sessionId) {
    return placementRepository.getSessionById(sessionId);
  }

  async getSessionStudents(sessionId, facultyId) {
    return placementRepository.getSessionStudents(sessionId, facultyId);
  }

  async updateAttendance(sessionId, facultyId, rollNumbers) {
    if (!Array.isArray(rollNumbers) || rollNumbers.length === 0) return { updated: 0 };
    return placementRepository.updateAttendance(sessionId, facultyId, rollNumbers);
  }

  async getSessionReport(sessionId, facultyId) {
    return placementRepository.getSessionReport(sessionId, facultyId);
  }

  generateReportExcel(sessionTitle, presentStudents, absentStudents) {
    const wb = xlsx.utils.book_new();

    const fmt = (d) => {
      if (!d) return '-';
      const dt = new Date(d);
      return dt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    };

    // Sheet 1: Present Students — raw data, no formulas
    const presentRows = [
      ['Roll Number', 'Name', 'Phone Number', 'Marked At'],
      ...presentStudents.map((s) => [s.rollNumber, s.name, s.phoneNumber || '-', fmt(s.markedAt)]),
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(presentRows), 'Present Students');

    // Sheet 2: Absent Students
    const absentRows = [
      ['Roll Number', 'Name'],
      ...absentStudents.map((s) => [s.rollNumber, s.name]),
    ];
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(absentRows), 'Absent Students');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  async finalizeSession(sessionId, facultyId, rollNumbers) {
    return placementRepository.finalizeSession(sessionId, facultyId, rollNumbers);
  }

  async deleteSession(sessionId, facultyId) {
    return placementRepository.deleteSession(sessionId, facultyId);
  }

  async submitVirtualAttendance(sessionId, rollNumber, phoneNumber) {
    return placementRepository.submitVirtualAttendance(sessionId, rollNumber, phoneNumber);
  }
}

module.exports = new PlacementService();
