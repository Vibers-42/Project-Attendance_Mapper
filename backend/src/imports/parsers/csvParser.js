const fs = require('fs');

/**
 * Parses a CSV file into an array of objects.
 * Uses the first row as column headers.
 */
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

module.exports = parseCsv;
