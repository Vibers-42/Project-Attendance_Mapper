const placementRepository = require('../repositories/PlacementRepository');
const ExcelJS = require('exceljs');

// ── Style helpers (mirrors excelGenerator.js conventions) ─────────────────────
const _thin = { style: 'thin', color: { argb: 'FF94A3B8' } };
const _BORDER = { top: _thin, left: _thin, bottom: _thin, right: _thin };
const _FILL = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
const _FONT = (hex, { bold = false, size = 10 } = {}) =>
  ({ name: 'Calibri', bold, size, color: { argb: hex } });
const _ALIGN = (h, indent = 0) => ({ horizontal: h, vertical: 'middle', indent, wrapText: false });

const _S = (cell, { bg, fg, bold, size, alignH = 'left', indent = 0, border = false } = {}) => {
  if (bg)     cell.fill      = _FILL(bg);
  if (fg)     cell.font      = _FONT(fg, { bold, size });
  if (border) cell.border    = _BORDER;
  cell.alignment = _ALIGN(alignH, indent);
};

class PlacementService {
  // ── Session CRUD ──────────────────────────────────────────────────────────────

  /**
   * Creates a placement session and auto-grants OWNER to the creator.
   * When the session is created as ACTIVE (startImmediately), conductedById is
   * set to the creator so the live-session lock works correctly.
   */
  async createSession(facultyId, body, students, extraPermissions) {
    const { title, date, venue, attendanceMode, status } = body;
    const isActive = status === 'ACTIVE';

    const sessionData = {
      title: title.trim(),
      date: new Date(date),
      venue: venue?.trim() || null,
      description: attendanceMode || null,
      status: isActive ? 'ACTIVE' : 'DRAFT',
      createdById: facultyId,
      conductedById: isActive ? facultyId : null,
    };

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

  async finalizeSession(sessionId, facultyId, rollNumbers) {
    return placementRepository.finalizeSession(sessionId, facultyId, rollNumbers);
  }

  async startSession(sessionId, facultyId) {
    return placementRepository.startSession(sessionId, facultyId);
  }

  async updateDraft(facultyId, sessionId, body, students) {
    const { title, date, venue, attendanceMode } = body;
    const sessionData = {
      ...(title !== undefined && { title: title.trim() }),
      ...(date !== undefined && { date: new Date(date) }),
      ...(venue !== undefined && { venue: venue?.trim() || null }),
      ...(attendanceMode !== undefined && { description: attendanceMode }),
    };
    return placementRepository.updateDraft(sessionId, facultyId, sessionData, students);
  }

  async deleteSession(sessionId, facultyId) {
    return placementRepository.deleteSession(sessionId, facultyId);
  }

  async submitVirtualAttendance(sessionId, rollNumber, phoneNumber) {
    return placementRepository.submitVirtualAttendance(sessionId, rollNumber, phoneNumber);
  }

  // ── Excel report generation ───────────────────────────────────────────────────

  /**
   * Generates a professionally formatted 3-sheet Excel workbook for a completed
   * placement session. Matches the visual style of the website workbook generator.
   *
   * Sheet 1 — Session Summary   (metadata table)
   * Sheet 2 — Present Students  (student table + summary sidebar)
   * Sheet 3 — Absent Students   (student table + summary sidebar)
   *
   * @param {Object} reportData - Full object returned by getSessionReport
   * @returns {Promise<Buffer>}
   */
  async generateReportExcel({ session, eligible, present, absent, presentStudents, absentStudents }) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Attendance Mapper — Placement Module';
    wb.created = new Date();

    const fmtDate = (d) => {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    };
    const fmtTime = (d) => {
      if (!d) return '-';
      return new Date(d).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    };
    const fmtDateTime = (d) => {
      if (!d) return '-';
      const dt = new Date(d);
      return `${dt.toLocaleDateString('en-IN')} ${dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    };

    // ── Sheet 1: Session Summary ─────────────────────────────────────────────────
    const ss = wb.addWorksheet('Session Summary');
    ss.columns = [
      { width: 3  },   // A  left margin
      { width: 30 },   // B  field label
      { width: 42 },   // C  value
      { width: 3  },   // D  right margin
    ];

    const summaryRows = [
      ['Drive Name',        session.title || '-'],
      ['Date',              fmtDate(session.date)],
      ['Time',              fmtTime(session.date)],
      ['Attendance Mode',   session.attendanceMode === 'OFFLINE' ? 'Offline'
                           : session.attendanceMode === 'VIRTUAL' ? 'Virtual' : '-'],
      ['Venue / Link',      session.venue || '-'],
      ['Created By',        session.createdByName || '-'],
      ['Session Status',    'Completed'],
      ['Eligible Students', String(eligible)],
      ['Present Students',  String(present)],
      ['Absent Students',   String(absent)],
      ['Attendance Rate',   eligible > 0 ? `${((present / eligible) * 100).toFixed(1)}%` : '0%'],
    ];

    // Title
    ss.getRow(1).height = 30;
    ss.mergeCells('B1:C1');
    const titleCell = ss.getCell('B1');
    titleCell.value = 'PLACEMENT SESSION REPORT';
    _S(titleCell, { bg: 'FF1E40AF', fg: 'FFFFFFFF', bold: true, size: 13, alignH: 'center', border: true });

    // Sub-header
    ss.getRow(2).height = 20;
    const fhCell = ss.getCell('B2');
    const vhCell = ss.getCell('C2');
    fhCell.value = 'FIELD';  vhCell.value = 'VALUE';
    _S(fhCell, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, alignH: 'center', border: true });
    _S(vhCell, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, alignH: 'center', border: true });

    // Data rows
    summaryRows.forEach(([label, value], idx) => {
      const rn = idx + 3;
      ss.getRow(rn).height = 20;
      const lc = ss.getCell(`B${rn}`);
      const vc = ss.getCell(`C${rn}`);
      lc.value = label;
      vc.value = value;
      _S(lc, { bg: 'FFDBEAFE', fg: 'FF1E3A8A', bold: true, border: true, indent: 1 });
      _S(vc, { bg: 'FFF8FAFC', fg: 'FF1F2937', border: true, indent: 1 });
    });

    // ── Sheet 2: Present Students ─────────────────────────────────────────────────
    const pws = wb.addWorksheet('Present Students');
    pws.columns = [
      { width: 6  },   // A  S.No
      { width: 18 },   // B  Roll Number
      { width: 32 },   // C  Name
      { width: 18 },   // D  Phone Number
      { width: 22 },   // E  Marked At
      { width: 3  },   // F  gap
      { width: 24 },   // G  Summary field
      { width: 20 },   // H  Summary value
    ];

    const pCols    = ['A', 'B', 'C', 'D', 'E'];
    const pHeaders = ['S.No', 'Roll Number', 'Name', 'Phone Number', 'Marked At'];

    const pSummaryRows = [
      ['Total Students',   String(eligible)],
      ['Present Students', String(present)],
      ['Attendance Rate',  eligible > 0 ? `${((present / eligible) * 100).toFixed(1)}%` : '0%'],
    ];

    const pTotalRows = Math.max(1 + presentStudents.length, 2 + pSummaryRows.length);

    for (let i = 0; i < pTotalRows; i++) {
      const rn = i + 1;
      pws.getRow(rn).height = 20;

      // ── Left side: student table ─────────────────────────────────────────────
      if (i === 0) {
        pHeaders.forEach((h, ci) => {
          const cell = pws.getCell(`${pCols[ci]}${rn}`);
          cell.value = h;
          _S(cell, { bg: 'FF2563EB', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        });
      } else {
        const student = presentStudents[i - 1];
        if (student) {
          const bg   = (i - 1) % 2 === 1 ? 'FFEFF6FF' : 'FFFFFFFF';
          const vals = [
            i,
            student.rollNumber,
            student.name,
            student.phoneNumber || '-',
            fmtDateTime(student.markedAt),
          ];
          vals.forEach((val, ci) => {
            const cell = pws.getCell(`${pCols[ci]}${rn}`);
            cell.value = val;
            _S(cell, { bg, fg: 'FF1F2937', border: true,
              alignH: ci === 0 ? 'center' : 'left', indent: ci === 0 ? 0 : 1 });
          });
        }
      }

      // ── Right side: summary table ────────────────────────────────────────────
      if (i === 0) {
        pws.mergeCells(`G${rn}:H${rn}`);
        const sc = pws.getCell(`G${rn}`);
        sc.value = 'SUMMARY';
        _S(sc, { bg: 'FF1E40AF', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
      } else if (i === 1) {
        const mh = pws.getCell(`G${rn}`); const vh = pws.getCell(`H${rn}`);
        mh.value = 'METRIC'; vh.value = 'VALUE';
        _S(mh, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        _S(vh, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
      } else if (i - 2 < pSummaryRows.length) {
        const [label, value] = pSummaryRows[i - 2];
        const lc = pws.getCell(`G${rn}`); const vc = pws.getCell(`H${rn}`);
        lc.value = label; vc.value = value;
        _S(lc, { bg: 'FFDBEAFE', fg: 'FF1E3A8A', bold: true, border: true, indent: 1 });
        _S(vc, { bg: 'FFF8FAFC', fg: 'FF1F2937', border: true, indent: 1 });
      }
    }

    // ── Sheet 3: Absent Students ──────────────────────────────────────────────────
    const aws = wb.addWorksheet('Absent Students');
    aws.columns = [
      { width: 6  },   // A  S.No
      { width: 18 },   // B  Roll Number
      { width: 32 },   // C  Name
      { width: 18 },   // D  Phone Number
      { width: 3  },   // E  gap
      { width: 24 },   // F  Summary field
      { width: 20 },   // G  Summary value
    ];

    const aCols    = ['A', 'B', 'C', 'D'];
    const aHeaders = ['S.No', 'Roll Number', 'Name', 'Phone Number'];

    const aSummaryRows = [
      ['Total Students',  String(eligible)],
      ['Absent Students', String(absent)],
      ['Absence Rate',    eligible > 0 ? `${((absent / eligible) * 100).toFixed(1)}%` : '0%'],
    ];

    const aTotalRows = Math.max(1 + absentStudents.length, 2 + aSummaryRows.length);

    for (let i = 0; i < aTotalRows; i++) {
      const rn = i + 1;
      aws.getRow(rn).height = 20;

      // ── Left side: student table ─────────────────────────────────────────────
      if (i === 0) {
        aHeaders.forEach((h, ci) => {
          const cell = aws.getCell(`${aCols[ci]}${rn}`);
          cell.value = h;
          _S(cell, { bg: 'FF2563EB', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        });
      } else {
        const student = absentStudents[i - 1];
        if (student) {
          const bg   = (i - 1) % 2 === 1 ? 'FFEFF6FF' : 'FFFFFFFF';
          const vals = [
            i,
            student.rollNumber,
            student.name,
            student.phoneNumber || '-',
          ];
          vals.forEach((val, ci) => {
            const cell = aws.getCell(`${aCols[ci]}${rn}`);
            cell.value = val;
            _S(cell, { bg, fg: 'FF1F2937', border: true,
              alignH: ci === 0 ? 'center' : 'left', indent: ci === 0 ? 0 : 1 });
          });
        }
      }

      // ── Right side: summary table ────────────────────────────────────────────
      if (i === 0) {
        aws.mergeCells(`F${rn}:G${rn}`);
        const sc = aws.getCell(`F${rn}`);
        sc.value = 'SUMMARY';
        _S(sc, { bg: 'FF1E40AF', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
      } else if (i === 1) {
        const mh = aws.getCell(`F${rn}`); const gh = aws.getCell(`G${rn}`);
        mh.value = 'METRIC'; gh.value = 'VALUE';
        _S(mh, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        _S(gh, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
      } else if (i - 2 < aSummaryRows.length) {
        const [label, value] = aSummaryRows[i - 2];
        const lc = aws.getCell(`F${rn}`); const vc = aws.getCell(`G${rn}`);
        lc.value = label; vc.value = value;
        _S(lc, { bg: 'FFDBEAFE', fg: 'FF1E3A8A', bold: true, border: true, indent: 1 });
        _S(vc, { bg: 'FFF8FAFC', fg: 'FF1F2937', border: true, indent: 1 });
      }
    }

    return wb.xlsx.writeBuffer();
  }
}

module.exports = new PlacementService();
