const { sendError } = require('../utils/apiResponse');

const notFound = (req, res, next) => {
  sendError(res, {
    message: `Not Found - ${req.originalUrl}`,
    statusCode: 404,
  });
};

module.exports = notFound;
