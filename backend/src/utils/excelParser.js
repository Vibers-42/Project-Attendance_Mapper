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

    // ---------- Auto-detect header row ----------
    // Convert the entire sheet to a 2D array (no header assumption).
    const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!allRows || allRows.length === 0) {
      throw new BadRequestError('The uploaded Excel file is empty or has no data rows.');
    }

    // Known aliases for the Roll Number column (lowercase).
    const rollAliases = new Set([
      'roll no', 'roll number', 'rollno', 'roll_no', 'rollnumber',
      'roll.no', 'roll.number', 'id', 'student id',
      'reg no', 'reg number', 'registration no',
    ]);

    // Scan rows to find the one that looks like a header.
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const cells = allRows[i].map((c) => String(c).toLowerCase().trim());
      if (cells.some((c) => rollAliases.has(c))) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new BadRequestError(
        'Could not find a header row containing "Roll No" (or similar). ' +
        'Ensure your Excel file has a row with columns like "Roll.No", "Student Name", etc.'
      );
    }

    // Re-parse using the detected header row — skip everything above it.
    const rawData = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      range: headerRowIdx,   // treat this row as the header
    });

    if (!rawData || rawData.length === 0) {
      throw new BadRequestError('The uploaded Excel file has a header row but no data rows beneath it.');
    }

    const detectedHeaders = Object.keys(rawData[0]);
    console.log(`[ExcelParser] Header detected at row ${headerRowIdx + 1}:`, detectedHeaders);

    // ---------- Parse data rows ----------
    const parsedStudents = [];
    const rollNumberSet = new Set();
    const errors = [];

    rawData.forEach((row, index) => {
      // +2 because: headerRowIdx is 0-based, data starts on the next row, and Excel is 1-based
      const excelRowNum = headerRowIdx + index + 2;

      const getVal = (possibleKeys) => {
        const key = Object.keys(row).find(k =>
          possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase())
        );
        return key ? String(row[key]).trim() : '';
      };

      const serialNo = parseInt(getVal(['s.no', 'sno', 's no', 'serial no', 'serial number', 'sl.no', 'sl no']), 10) || null;
      const rollNumber = getVal([...rollAliases]);
      const name = getVal(['student name', 'name', 'student', 'full name', 'fullname', 'student_name']);
      const timetable = getVal(['timetable', 'time table', 'schedule', 'tt']) || null;

      // Skip completely empty rows silently
      if (!rollNumber && !name) return;

      if (!rollNumber) {
        errors.push(`Row ${excelRowNum}: Missing Roll No.`);
        return;
      }
      if (!name) {
        errors.push(`Row ${excelRowNum}: Missing Student Name.`);
        return;
      }

      if (rollNumberSet.has(rollNumber.toLowerCase())) {
        errors.push(`Row ${excelRowNum}: Duplicate Roll No '${rollNumber}' found in the file.`);
        return;
      }
      rollNumberSet.add(rollNumber.toLowerCase());

      parsedStudents.push({
        serialNo,
        rollNumber: rollNumber.toUpperCase(),
        name,
        timetable,
        barcode: rollNumber.toUpperCase(),
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

    // ---------- Auto-detect header row ----------
    const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!allRows || allRows.length === 0) {
      throw new BadRequestError('The uploaded Excel file is empty.');
    }

    // Known aliases for the Employee ID column (lowercase).
    const empIdAliases = new Set([
      'employee id', 'employee.id', 'emp id', 'emp.id', 'empid',
      'id', 'faculty id', 'faculty.id', 'fac id', 'fac.id',
      'employee no', 'employee.no', 'emp no', 'emp.no',
    ]);

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const cells = allRows[i].map((c) => String(c).toLowerCase().trim());
      if (cells.some((c) => empIdAliases.has(c))) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      throw new BadRequestError(
        'Could not find a header row containing "Employee ID" (or similar). ' +
        'Ensure your Excel file has a row with columns like "Employee ID", "Faculty Name", etc.'
      );
    }

    const rawData = xlsx.utils.sheet_to_json(sheet, {
      defval: '',
      range: headerRowIdx,
    });

    if (!rawData || rawData.length === 0) {
      throw new BadRequestError('The uploaded Excel file has a header row but no data rows beneath it.');
    }

    const detectedHeaders = Object.keys(rawData[0]);
    console.log(`[ExcelParser] Faculty header detected at row ${headerRowIdx + 1}:`, detectedHeaders);

    // ---------- Parse data rows ----------
    const parsedFaculty = [];
    const empIdSet = new Set();
    const errors = [];

    rawData.forEach((row, index) => {
      const excelRowNum = headerRowIdx + index + 2;

      const getVal = (possibleKeys) => {
        const key = Object.keys(row).find(k => 
          possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase())
        );
        return key ? String(row[key]).trim() : '';
      };

      const employeeId = getVal([...empIdAliases]);
      const name = getVal(['faculty name', 'faculty.name', 'name', 'faculty', 'full name', 'fullname']);

      // Skip completely empty rows silently
      if (!employeeId && !name) return;

      if (!employeeId) {
        errors.push(`Row ${excelRowNum}: Missing Employee ID.`);
        return;
      }
      if (!name) {
        errors.push(`Row ${excelRowNum}: Missing Faculty Name.`);
        return;
      }

      if (empIdSet.has(employeeId.toLowerCase())) {
        errors.push(`Row ${excelRowNum}: Duplicate Employee ID '${employeeId}' found in the file.`);
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
