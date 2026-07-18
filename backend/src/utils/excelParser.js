const xlsx = require('xlsx');
const { BadRequestError } = require('./AppError');

/**
 * Parses an uploaded Excel file and extracts Student Master Data.
 * Expected columns: 'S.No', 'Roll No', 'Student Name', 'Timetable'
 * @param {Buffer} fileBuffer
 * @returns {Array} Array of parsed student objects
 */
const parseStudentExcel = (fileBuffer) => {
  try {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON, using the first row as headers
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new BadRequestError('The uploaded Excel file is empty or has no data rows.');
    }

    // Log detected headers to help debug column name mismatches
    const detectedHeaders = Object.keys(rawData[0]);
    console.log('[ExcelParser] Detected headers:', detectedHeaders);

    const parsedStudents = [];
    const rollNumberSet = new Set();
    const errors = [];

    rawData.forEach((row, index) => {
      // row index starts at 2 (assuming row 1 is header)
      const rowNum = index + 2;

      // Extract values with flexible key matching (case-insensitive, trimming spaces)
      const getVal = (possibleKeys) => {
        const key = Object.keys(row).find(k =>
          possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase())
        );
        return key ? String(row[key]).trim() : '';
      };

      const serialNo = parseInt(getVal(['s.no', 'sno', 's no', 'serial no', 'serial number', 'sl.no', 'sl no']), 10) || null;
      const rollNumber = getVal(['roll no', 'roll number', 'rollno', 'roll_no', 'rollnumber', 'id', 'student id', 'reg no', 'reg number', 'registration no']);
      const name = getVal(['student name', 'name', 'student', 'full name', 'fullname', 'student_name']);
      // timetable is optional — many sheets may not have it
      const timetable = getVal(['timetable', 'time table', 'schedule', 'tt']) || null;

      // Only Roll No and Name are required
      if (!rollNumber) {
        errors.push(`Row ${rowNum}: Missing Roll No. (Expected column: "Roll No" or "Roll Number")`);
        return;
      }
      if (!name) {
        errors.push(`Row ${rowNum}: Missing Student Name. (Expected column: "Student Name" or "Name")`);
        return;
      }

      if (rollNumberSet.has(rollNumber.toLowerCase())) {
        errors.push(`Row ${rowNum}: Duplicate Roll No '${rollNumber}' found in the file.`);
        return;
      }
      rollNumberSet.add(rollNumber.toLowerCase());

      parsedStudents.push({
        serialNo,
        rollNumber: rollNumber.toUpperCase(), // Standardize roll number
        name,
        timetable,
        barcode: rollNumber.toUpperCase(), // Using Roll No as barcode for Master Data
        status: 'ACTIVE',
      });
    });

    if (errors.length > 0) {
      throw new BadRequestError(
        `Excel validation failed with ${errors.length} error(s).\n` +
        errors.slice(0, 10).join('\n') +
        (errors.length > 10 ? `\n...and ${errors.length - 10} more errors.` : '')
      );
    }

    if (parsedStudents.length === 0) {
      throw new BadRequestError('No valid student records found. Ensure the sheet has "Roll No" and "Student Name" columns.');
    }

    return parsedStudents;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls format.');
  }
};

/**
 * Parses an uploaded Excel file and extracts Faculty Master Data.
 * Expected columns: 'Employee ID', 'Faculty Name'
 * @param {Buffer} fileBuffer
 * @returns {Array} Array of parsed faculty objects
 */
const parseFacultyExcel = (fileBuffer) => {
  try {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      throw new BadRequestError('The uploaded Excel file is empty.');
    }

    const parsedFaculty = [];
    const empIdSet = new Set();
    const errors = [];

    rawData.forEach((row, index) => {
      const rowNum = index + 2;

      const getVal = (possibleKeys) => {
        const key = Object.keys(row).find(k => 
          possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase())
        );
        return key ? String(row[key]).trim() : '';
      };

      const employeeId = getVal(['employee id', 'empid', 'id', 'faculty id']);
      const name = getVal(['faculty name', 'name', 'faculty']);

      if (!employeeId) {
        errors.push(`Row ${rowNum}: Missing Employee ID.`);
        return;
      }
      if (!name) {
        errors.push(`Row ${rowNum}: Missing Faculty Name.`);
        return;
      }

      if (empIdSet.has(employeeId.toLowerCase())) {
        errors.push(`Row ${rowNum}: Duplicate Employee ID '${employeeId}' found in the file.`);
        return;
      }
      empIdSet.add(employeeId.toLowerCase());

      parsedFaculty.push({
        facultyId: employeeId,
        name: name,
        role: 'FACULTY',
        isActive: true,
      });
    });

    if (errors.length > 0) {
      throw new BadRequestError(`Excel validation failed with ${errors.length} errors.\n` + errors.slice(0, 10).join('\n') + (errors.length > 10 ? '\n...and more' : ''));
    }

    return parsedFaculty;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('Failed to parse Excel file. Please ensure it is a valid format.');
  }
};

module.exports = {
  parseStudentExcel,
  parseFacultyExcel,
};
