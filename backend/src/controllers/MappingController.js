const AttendanceMappingService = require('../services/AttendanceMappingService');
const { prepareMappingQuerySchema } = require('../validators/mapping.validator');
const { sendSuccess } = require('../utils/apiResponse');

class MappingController {
  async prepareContext(req, res) {
    const { error, value } = prepareMappingQuerySchema.validate(req.params);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const { sessionId } = value;
    
    // 1. Prepare context (gather raw data)
    const context = await AttendanceMappingService.prepareMappingContext(sessionId);
    
    // 2. Validate context (determine status & warnings)
    const { status, warnings } = AttendanceMappingService.validateContext(context);

    return sendSuccess(res, {
      message: 'Mapping context prepared successfully',
      data: {
        sessionId: context.sessionId,
        status,
        warnings,
        metadata: context.metadata
      }
    });
  }

  async checkStatus(req, res) {
    // A lightweight endpoint for checking status without transferring full cohort arrays
    const { error, value } = prepareMappingQuerySchema.validate(req.params);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const context = await AttendanceMappingService.prepareMappingContext(value.sessionId);
    const { status, warnings } = AttendanceMappingService.validateContext(context);

    return sendSuccess(res, {
      message: 'Mapping status retrieved successfully',
      data: {
        sessionId: value.sessionId,
        status,
        warnings
      }
    });
  }
}

module.exports = new MappingController();
