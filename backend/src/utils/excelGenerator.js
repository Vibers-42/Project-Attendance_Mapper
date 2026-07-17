const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

/**
 * Builds and saves a multi-sheet Excel workbook for attendance.
 * 
 * @param {Array} overallData - Array of objects for Worksheet 1
 * @param {Object} roomDataMap - Keys are room names, values are arrays of objects
 * @param {Object} sessionInfoMap - Keys are room names, values are objects containing session metadata
 * @param {String} fileName - The desired name for the generated file
 * @returns {String} The absolute path to the saved file
 */
const generateWorkbook = (overallData, roomDataMap, sessionInfoMap, fileName) => {
  const workbook = xlsx.utils.book_new();

  // 1. Create Overall Attendance Worksheet
  const overallSheet = xlsx.utils.json_to_sheet(overallData);
  
  // Set column widths for Overall Sheet
  overallSheet['!cols'] = [
    { wch: 5 },  // S.No
    { wch: 15 }, // Roll No
    { wch: 30 }, // Student Name
    { wch: 15 }, // Timetable
    { wch: 18 }  // Attendance Status
  ];
  
  xlsx.utils.book_append_sheet(workbook, overallSheet, 'Overall Attendance');

  // 2. Create Room Worksheets
  for (const [roomName, students] of Object.entries(roomDataMap)) {
    const sheetData = [];
    
    // Convert students to plain objects with exact columns
    students.forEach(student => {
      sheetData.push({
        'S.No': student['S.No'],
        'Roll No': student['Roll No'],
        'Student Name': student['Student Name'],
        'Timetable': student['Timetable'],
        'Attendance Status': student['Attendance Status']
      });
    });

    // Add empty rows for spacing
    sheetData.push({});
    sheetData.push({});

    // Append Session Information Table
    const sessionInfo = sessionInfoMap[roomName] || {};
    sheetData.push({ 'S.No': 'SESSION INFORMATION' });
    sheetData.push({ 'S.No': 'Professor Name', 'Roll No': sessionInfo.professorName || 'N/A' });
    sheetData.push({ 'S.No': 'Lab Incharge Name', 'Roll No': sessionInfo.labInchargeName || 'N/A' });
    sheetData.push({ 'S.No': 'Lab Incharge Employee ID', 'Roll No': sessionInfo.labInchargeEmployeeId || 'N/A' });
    sheetData.push({ 'S.No': 'Session Date', 'Roll No': sessionInfo.sessionDate || 'N/A' });
    sheetData.push({ 'S.No': 'Session Time', 'Roll No': sessionInfo.sessionTime || 'N/A' });
    sheetData.push({ 'S.No': 'Subject', 'Roll No': sessionInfo.subject || 'N/A' });
    sheetData.push({ 'S.No': 'Topic', 'Roll No': sessionInfo.topic || 'N/A' });
    sheetData.push({ 'S.No': 'Room', 'Roll No': roomName });

    const roomSheet = xlsx.utils.json_to_sheet(sheetData);
    
    // Set column widths for Room Sheets
    roomSheet['!cols'] = [
      { wch: 25 }, // S.No / Label
      { wch: 25 }, // Roll No / Value
      { wch: 30 }, // Student Name
      { wch: 15 }, // Timetable
      { wch: 18 }  // Attendance Status
    ];

    // Truncate room name if it exceeds Excel's 31 character limit for sheet names
    const safeRoomName = roomName.substring(0, 31).replace(/[\\/?*\[\]]/g, '_');
    xlsx.utils.book_append_sheet(workbook, roomSheet, safeRoomName);
  }

  // 3. Save the Workbook
  const uploadsDir = path.join(__dirname, '../../uploads/workbooks');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, fileName);
  xlsx.writeFile(workbook, filePath);

  return filePath;
};

module.exports = {
  generateWorkbook
};
