const path = require('path');
const parseCsv = require('./csvParser');
const parseExcel = require('./excelParser');
const parseJson = require('./jsonParser');

/**
 * Auto-selects the correct parser based on file extension.
 * @param {string} filePath - Absolute or relative path to the data file.
 * @returns {Array<Object>} Parsed rows as an array of plain objects.
 */
function parseFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.csv':
      return parseCsv(filePath);
    case '.xlsx':
    case '.xls':
      return parseExcel(filePath);
    case '.json':
      return parseJson(filePath);
    default:
      throw new Error(`Unsupported file format: "${ext}". Supported formats: .csv, .xlsx, .json`);
  }
}

module.exports = parseFile;
