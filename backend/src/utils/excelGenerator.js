const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Shared helper: builds the workbook object (in memory only, no I/O).
 * Called by both the disk-save variant and the buffer variant.
 */
const buildWorkbook = (overallData, roomDataMap, sessionInfoMap) => {
  const workbook = xlsx.utils.book_new();

  // 1. Overall Attendance sheet
  const overallSheet = xlsx.utils.json_to_sheet(overallData);
  overallSheet['!cols'] = [
    { wch: 5 },   // S.No
    { wch: 15 },  // Roll No
    { wch: 30 },  // Student Name
    { wch: 15 },  // Timetable
    { wch: 18 },  // Attendance Status
  ];
  xlsx.utils.book_append_sheet(workbook, overallSheet, 'Overall Attendance');

  // 2. Per-room sheets
  for (const [roomName, students] of Object.entries(roomDataMap)) {
    const sheetData = [];

    students.forEach(student => {
      sheetData.push({
        'S.No': student['S.No'],
        'Roll No': student['Roll No'],
        'Student Name': student['Student Name'],
        'Timetable': student['Timetable'],
        'Attendance Status': student['Attendance Status'],
      });
    });

    sheetData.push({});
    sheetData.push({});

    const sessionInfo = sessionInfoMap[roomName] || {};
    sheetData.push({ 'S.No': 'SESSION INFORMATION' });
    sheetData.push({ 'S.No': 'Professor Name',            'Roll No': sessionInfo.professorName          || 'N/A' });
    sheetData.push({ 'S.No': 'Lab Incharge Name',         'Roll No': sessionInfo.labInchargeName        || 'N/A' });
    sheetData.push({ 'S.No': 'Lab Incharge Employee ID',  'Roll No': sessionInfo.labInchargeEmployeeId  || 'N/A' });
    sheetData.push({ 'S.No': 'Session Date',              'Roll No': sessionInfo.sessionDate            || 'N/A' });
    sheetData.push({ 'S.No': 'Session Time',              'Roll No': sessionInfo.sessionTime            || 'N/A' });
    sheetData.push({ 'S.No': 'Subject',                   'Roll No': sessionInfo.subject                || 'N/A' });
    sheetData.push({ 'S.No': 'Topic',                     'Roll No': sessionInfo.topic                  || 'N/A' });
    sheetData.push({ 'S.No': 'Room',                      'Roll No': roomName });

    const roomSheet = xlsx.utils.json_to_sheet(sheetData);
    roomSheet['!cols'] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 18 },
    ];

    const safeRoomName = roomName.substring(0, 31).replace(/[\\/?*[\]]/g, '_');
    xlsx.utils.book_append_sheet(workbook, roomSheet, safeRoomName);
  }

  return workbook;
};

/**
 * Generates an in-memory Buffer of the Excel workbook.
 * Nothing is written to disk. Used by the on-demand download endpoint.
 *
 * @returns {Buffer}
 */
const generateWorkbookBuffer = (overallData, roomDataMap, sessionInfoMap) => {
  const wb = buildWorkbook(overallData, roomDataMap, sessionInfoMap);
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Builds and SAVES a multi-sheet Excel workbook for attendance.
 * Kept for backward compatibility with AdminWorkbookController.
 *
 * @returns {String} Absolute path to the saved file
 */
const generateWorkbook = (overallData, roomDataMap, sessionInfoMap, fileName) => {
  const wb = buildWorkbook(overallData, roomDataMap, sessionInfoMap);

  const uploadsDir = path.join(__dirname, '../../uploads/workbooks');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, fileName);
  xlsx.writeFile(wb, filePath);
  return filePath;
};

module.exports = {
  generateWorkbook,
  generateWorkbookBuffer,
};

