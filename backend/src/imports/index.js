const importFaculty = require('./importFaculty');
const importStudents = require('./importStudents');

/**
 * Unified import entry point.
 * @param {string} entityType - 'faculty' or 'students'
 * @param {Array<Object>} rows - Parsed rows from the file parser.
 * @returns {Object} Summary of import results.
 */
async function runImport(entityType, rows) {
  switch (entityType.toLowerCase()) {
    case 'faculty':
      return importFaculty(rows);
    case 'students':
      return importStudents(rows);
    default:
      throw new Error(`Unknown entity type: "${entityType}". Supported: faculty, students`);
  }
}

module.exports = { runImport };
