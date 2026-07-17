/**
 * Parses a JSON file into an array of objects.
 */
function parseJson(filePath) {
  const data = require(filePath);

  if (Array.isArray(data)) {
    return data;
  }

  throw new Error('JSON file must contain an array of objects.');
}

module.exports = parseJson;
