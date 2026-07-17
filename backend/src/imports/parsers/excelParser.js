const XLSX = require('xlsx');

/**
 * Parses an Excel (.xlsx) file into an array of objects.
 * Reads the first sheet by default.
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  // Trim all string values
  return rows.map(row => {
    const cleaned = {};
    for (const key of Object.keys(row)) {
      const trimmedKey = key.trim();
      cleaned[trimmedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
    }
    return cleaned;
  });
}

module.exports = parseExcel;
