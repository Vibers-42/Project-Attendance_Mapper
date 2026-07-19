const ExcelJS = require('exceljs');
const path    = require('path');
const fs      = require('fs');

// ── Style helpers ──────────────────────────────────────────────────────────────
const thin = { style: 'thin', color: { argb: 'FF94A3B8' } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };

const FILL = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: hex } });
const FONT = (hex, { bold = false, size = 10 } = {}) =>
  ({ name: 'Calibri', bold, size, color: { argb: hex } });
const ALIGN = (h, indent = 0) => ({ horizontal: h, vertical: 'middle', indent, wrapText: false });

const S = (cell, { bg, fg, bold, size, alignH = 'left', indent = 0, border = false } = {}) => {
  if (bg)     cell.fill      = FILL(bg);
  if (fg)     cell.font      = FONT(fg, { bold, size });
  if (border) cell.border    = BORDER;
  cell.alignment = ALIGN(alignH, indent);
};

// ── Core builder (returns an ExcelJS Workbook) ────────────────────────────────
const buildWorkbook = async (overallData, roomDataMap, sessionInfoMap) => {
  const wb = new ExcelJS.Workbook();

  // ── 1. Overall Attendance sheet ────────────────────────────────────────────
  const ows = wb.addWorksheet('Overall Attendance');
  ows.columns = [
    { width: 6  }, // A S.No
    { width: 18 }, // B Roll No
    { width: 32 }, // C Student Name
    { width: 15 }, // D Timetable
    { width: 18 }, // E Attendance Status
  ];

  const oCols = ['A','B','C','D','E'];
  // Header
  ows.getRow(1).height = 22;
  ['S.No','Roll No','Student Name','Timetable','Attendance Status'].forEach((h, ci) => {
    const cell = ows.getCell(`${oCols[ci]}1`);
    cell.value = h;
    S(cell, { bg: 'FF2563EB', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
  });
  // Data rows
  overallData.forEach((row, idx) => {
    const rn = idx + 2;
    ows.getRow(rn).height = 18;
    const bg  = idx % 2 === 1 ? 'FFEFF6FF' : 'FFFFFFFF';
    const vals = [row['S.No'], row['Roll No'], row['Student Name'], row['Timetable'], row['Attendance Status']];
    vals.forEach((val, ci) => {
      const cell = ows.getCell(`${oCols[ci]}${rn}`);
      cell.value = val;
      // S.No (ci=0) and Attendance Status (ci=4) are centered; rest left-aligned with indent
      S(cell, { bg, fg: 'FF1F2937', border: true, alignH: ci === 0 || ci === 4 ? 'center' : 'left', indent: ci === 0 || ci === 4 ? 0 : 1 });
    });
  });

  // ── 2. Per-room sheets ─────────────────────────────────────────────────────
  // Layout: student table left (A-F), gap (G), session info right (H-I)
  for (const [roomName, students] of Object.entries(roomDataMap)) {
    const info = sessionInfoMap[roomName] || {};

    const infoRows = [
      ['Faculty ID',       info.professorId     || 'N/A'],
      ['Faculty Name',     info.professorName   || 'N/A'],
      ['Trainer Name',     info.labInchargeName || 'N/A'],
      ['Room Number',      info.room            || roomName],
      ['Session Date',     info.sessionDate     || 'N/A'],
      ['Session Time',     info.sessionTime     || 'N/A'],
      ['Students Present', students.length],
    ];

    const safeRoom = roomName.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
    const rws = wb.addWorksheet(safeRoom);
    rws.columns = [
      { width: 6  }, // A S.No
      { width: 18 }, // B Roll No
      { width: 32 }, // C Student Name
      { width: 15 }, // D Timetable
      { width: 18 }, // E Attendance Status
      { width: 3  }, // F gap
      { width: 22 }, // G Field
      { width: 24 }, // H Value
    ];

    const sCols     = ['A','B','C','D','E'];
    const totalRows = Math.max(1 + students.length, 2 + infoRows.length);

    for (let i = 0; i < totalRows; i++) {
      const rn = i + 1;
      rws.getRow(rn).height = 20;

      // Left: student table
      if (i === 0) {
        ['S.No','Roll No','Student Name','Timetable','Attendance Status'].forEach((h, ci) => {
          const cell = rws.getCell(`${sCols[ci]}${rn}`);
          cell.value = h;
          S(cell, { bg: 'FF2563EB', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        });
      } else {
        const student = students[i - 1];
        if (student) {
          const bg   = (i - 1) % 2 === 1 ? 'FFEFF6FF' : 'FFFFFFFF';
          const vals = [student['S.No'], student['Roll No'], student['Student Name'], student['Timetable'], student['Attendance Status']];
          vals.forEach((val, ci) => {
            const cell = rws.getCell(`${sCols[ci]}${rn}`);
            cell.value = val;
            // S.No (ci=0) and Attendance Status (ci=4) are centered; rest left-aligned with indent
            S(cell, { bg, fg: 'FF1F2937', border: true, alignH: ci === 0 || ci === 4 ? 'center' : 'left', indent: ci === 0 || ci === 4 ? 0 : 1 });
          });
        }
      }

      // Right: session info — column letters shift one left (G→F gap removed, now F=gap, G=Field, H=Value)
      if (i === 0) {
        rws.mergeCells(`G${rn}:H${rn}`);
        const tc = rws.getCell(`G${rn}`);
        tc.value = 'SESSION INFORMATION';
        S(tc, { bg: 'FF1E40AF', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        rws.getCell(`H${rn}`).border = BORDER;
      } else if (i === 1) {
        const fh = rws.getCell(`G${rn}`);
        const vh = rws.getCell(`H${rn}`);
        fh.value = 'FIELD';  vh.value = 'VALUE';
        S(fh, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
        S(vh, { bg: 'FF1E3A8A', fg: 'FFFFFFFF', bold: true, border: true, alignH: 'center' });
      } else if (i - 2 < infoRows.length) {
        const [label, value] = infoRows[i - 2];
        const lc = rws.getCell(`G${rn}`);
        const vc = rws.getCell(`H${rn}`);
        lc.value = label;  vc.value = value;
        S(lc, { bg: 'FFDBEAFE', fg: 'FF1E3A8A', bold: true, border: true, indent: 1 });
        S(vc, { bg: 'FFF8FAFC', fg: 'FF1F2937', border: true, indent: 1 });
      }
    }
  }

  return wb;
};

// ── Public API ─────────────────────────────────────────────────────────────────

const generateWorkbookBuffer = async (overallData, roomDataMap, sessionInfoMap) => {
  const wb = await buildWorkbook(overallData, roomDataMap, sessionInfoMap);
  return wb.xlsx.writeBuffer();
};

const generateWorkbook = async (overallData, roomDataMap, sessionInfoMap, fileName) => {
  const wb         = await buildWorkbook(overallData, roomDataMap, sessionInfoMap);
  const uploadsDir = path.join(__dirname, '../../uploads/workbooks');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  await wb.xlsx.writeFile(filePath);
  return filePath;
};

module.exports = { generateWorkbook, generateWorkbookBuffer };
