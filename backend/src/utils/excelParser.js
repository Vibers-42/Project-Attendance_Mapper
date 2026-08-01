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

      const getVal = (possibleKeys, { fuzzy = false } = {}) => {
        const keys = Object.keys(row);
        // 1. Exact match (case-insensitive)
        let key = keys.find(k =>
          possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase())
        );
        // 2. Fuzzy fallback: column name contains any alias (used for columns like "Timetable Group")
        if (!key && fuzzy) {
          key = keys.find(k =>
            possibleKeys.some(pk => k.toLowerCase().trim().includes(pk.toLowerCase()))
          );
        }
        return key ? String(row[key]).trim() : '';
      };

      const serialNo = parseInt(getVal(['s.no', 'sno', 's no', 'serial no', 'serial number', 'sl.no', 'sl no']), 10) || null;
      const rollNumber = getVal([...rollAliases]);
      const name = getVal(['student name', 'name', 'student', 'full name', 'fullname', 'student_name']);
      const timetable = getVal([
        'timetable', 'time table', 'time-table', 'schedule', 'tt',
        'timetable group', 'tt group', 'time table group', 'timetable grp', 'tt grp',
        'timetable batch', 'tt batch', 't.t.',
      ], { fuzzy: true }) || null;

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
      'staff id', 'staff.id', 'staffid', 'staff no', 'staff number',
      'emp_id', 'employee_id', 'faculty_id', 'fac_id', 'staff_id',
      'code', 'faculty code', 'emp code', 'employee code',
    ]);

    // Keywords used for fuzzy matching (a cell that CONTAINS any of these is a candidate)
    const empIdKeywords = ['emp', 'employee', 'faculty', 'staff', 'id', 'code', 'no'];
    const nameKeywords = ['name', 'faculty', 'lecturer', 'instructor', 'professor'];

    let headerRowIdx = -1;

    // Pass 1: exact match
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const cells = allRows[i].map((c) => String(c).toLowerCase().trim());
      if (cells.some((c) => empIdAliases.has(c))) {
        headerRowIdx = i;
        break;
      }
    }

    // Pass 2: fuzzy/contains match — find a row that has both an ID-like and a name-like column
    if (headerRowIdx === -1) {
      for (let i = 0; i < Math.min(allRows.length, 20); i++) {
        const cells = allRows[i].map((c) => String(c).toLowerCase().trim());
        const hasIdCol = cells.some((c) => empIdKeywords.some((kw) => c.includes(kw)));
        const hasNameCol = cells.some((c) => nameKeywords.some((kw) => c.includes(kw)));
        if (hasIdCol && hasNameCol) {
          headerRowIdx = i;
          console.log(`[ExcelParser] Faculty header found via fuzzy match at row ${i + 1}:`, allRows[i]);
          break;
        }
      }
    }

    // Pass 3: positional fallback — treat the first non-empty row as the header
    if (headerRowIdx === -1) {
      headerRowIdx = 0;
      console.warn('[ExcelParser] Could not detect faculty header row; falling back to row 1 as header.');
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

      const getVal = (possibleKeys, { fuzzy = false } = {}) => {
        const keys = Object.keys(row);
        // 1. Exact match (case-insensitive)
        let key = keys.find(k =>
          possibleKeys.some(pk => k.toLowerCase().trim() === pk.toLowerCase())
        );
        // 2. Fuzzy: column name contains any alias keyword
        if (!key && fuzzy) {
          key = keys.find(k =>
            possibleKeys.some(pk => k.toLowerCase().trim().includes(pk.toLowerCase()))
          );
        }
        return key ? String(row[key]).trim() : '';
      };

      const employeeId = getVal([...empIdAliases], { fuzzy: true });
      const name = getVal(
        ['faculty name', 'faculty.name', 'name of the staff', 'staff name',
         'name', 'faculty', 'full name', 'fullname', 'lecturer', 'instructor'],
        { fuzzy: true },
      );

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
        facultyId: employeeId.toUpperCase(),
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

/**
 * Lightweight parser for placement eligibility Excel files.
 * Requires "Roll No" (or aliases) and "Name" (or aliases) columns.
 * Returns [{ rollNumber, name }] — duplicates are silently skipped.
 * @param {Buffer} fileBuffer
 * @returns {{ rollNumber: string, name: string }[]}
 */
const parsePlacementExcel = (fileBuffer) => {
  try {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const allRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!allRows || allRows.length === 0) {
      throw new BadRequestError('The uploaded Excel file is empty.');
    }

    // Columns that look like serial/sequence numbers — never treat as roll numbers.
    const serialPatterns = ['s.no', 'sno', 's no', 'sr.no', 'sr no', 'sl.no', 'sl no',
      'si.no', 'si no', 'serial no', 'serial number', '#', 's/n'];
    const isSerialCol = (h) => {
      const l = h.toLowerCase().trim();
      return serialPatterns.includes(l);
    };

    // Keywords that suggest a roll/ID column or a name column.
    const rollKeywords = ['roll', 'reg', 'enroll', 'scholar', 'htno', 'ht no', 'h.t',
      'hall ticket', 'hallticket', 'admission', 'regno', 'rno', 'student id', 'no', 'num', 'id'];
    const nameKeywords = ['name', 'student', 'candidate', 'full'];

    // Find the first row (within 20) that has at least one roll-like and one name-like header.
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(allRows.length, 20); i++) {
      const cells = allRows[i].map((c) => String(c).toLowerCase().trim());
      const hasRoll = cells.some((c) => !isSerialCol(c) && rollKeywords.some((kw) => c.includes(kw)));
      const hasName = cells.some((c) => nameKeywords.some((kw) => c.includes(kw)));
      if (hasRoll || hasName) {
        headerRowIdx = i;
        break;
      }
    }

    // Positional fallback: treat the first non-empty row as the header.
    if (headerRowIdx === -1) {
      headerRowIdx = allRows.findIndex((r) => r.some((c) => String(c).trim() !== ''));
    }
    if (headerRowIdx === -1) {
      throw new BadRequestError('The uploaded Excel file appears to be empty.');
    }

    const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '', range: headerRowIdx });
    if (!rawData || rawData.length === 0) {
      throw new BadRequestError('No data rows found beneath the header row.');
    }

    const headers = Object.keys(rawData[0]);
    console.log(`[PlacementParser] Header row ${headerRowIdx + 1}:`, headers);

    // Two-tier scoring: specific keywords score 2, broad keywords score 1.
    // This ensures "Roll No" (2+1=3) beats "Phone No" (0+1=1).
    const rollHigh = ['roll', 'reg', 'enroll', 'scholar', 'htno', 'ht no', 'h.t',
      'hall ticket', 'hallticket', 'admission', 'regno', 'rno', 'student id'];
    const rollLow  = ['no', 'num', 'id', 'number'];
    const nameHigh = ['name', 'student', 'candidate'];
    const nameLow  = ['full'];
    const phoneKws = ['phone', 'mobile', 'contact', 'cell', 'whatsapp'];

    const isPhoneCol = (h) => phoneKws.some((kw) => h.toLowerCase().includes(kw));

    const scoreRoll = (h) => {
      const l = h.toLowerCase();
      return rollHigh.reduce((s, kw) => s + (l.includes(kw) ? 2 : 0), 0) +
             rollLow.reduce((s,  kw) => s + (l.includes(kw) ? 1 : 0), 0);
    };
    const scoreName = (h) => {
      const l = h.toLowerCase();
      return nameHigh.reduce((s, kw) => s + (l.includes(kw) ? 2 : 0), 0) +
             nameLow.reduce((s,  kw) => s + (l.includes(kw) ? 1 : 0), 0);
    };

    // Roll column: exclude serial-number and phone columns.
    const rollCandidates = headers.filter((h) => !isSerialCol(h) && !isPhoneCol(h));
    const rollColPool = rollCandidates.length > 0 ? rollCandidates : headers.filter((h) => !isSerialCol(h));
    const rollCol = rollColPool.reduce((best, h) =>
      scoreRoll(h) > scoreRoll(best) ? h : best, rollColPool[0]);

    // Name column: exclude rollCol and phone columns.
    const nameCandidates = headers.filter((h) => h !== rollCol && !isPhoneCol(h));
    const nameColPool = nameCandidates.length > 0 ? nameCandidates : headers.filter((h) => h !== rollCol);
    const nameCol = nameColPool.reduce((best, h) =>
      scoreName(h) > scoreName(best) ? h : best, nameColPool[0]);

    // Phone number column (optional — null if not found).
    const phoneColPool = headers.filter((h) => h !== rollCol && h !== nameCol && isPhoneCol(h));
    const phoneCol = phoneColPool.length > 0 ? phoneColPool[0] : null;

    console.log(`[PlacementParser] Roll: "${rollCol}", Name: "${nameCol}"${phoneCol ? `, Phone: "${phoneCol}"` : ''}`);

    // Sanitize a cell value: handle numbers (avoid "123.0"), non-breaking spaces, etc.
    const clean = (val) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'number') return String(Number.isInteger(val) ? val : Math.round(val));
      return String(val).replace(/[ ​\t\r\n]+/g, ' ').trim();
    };

    const rollColHeader = rollCol.toUpperCase().trim();
    const students = [];
    const seen = new Set();

    rawData.forEach((row) => {
      const rollNumber = clean(row[rollCol]).toUpperCase();
      const name = clean(row[nameCol]);

      if (!rollNumber && !name) return;           // fully empty row
      if (!rollNumber || !name) return;           // partial row
      if (rollNumber === rollColHeader) return;   // repeated header row
      if (seen.has(rollNumber)) return;
      seen.add(rollNumber);

      const phoneNumber = phoneCol ? clean(row[phoneCol]) || null : null;
      students.push({ rollNumber, name, ...(phoneNumber ? { phoneNumber } : {}) });
    });

    if (students.length === 0) {
      throw new BadRequestError(
        'No valid student records found. Make sure the file has student roll numbers and names.',
      );
    }

    return students;
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls format.');
  }
};

module.exports = {
  parseStudentExcel,
  parseFacultyExcel,
  parsePlacementExcel,
};
