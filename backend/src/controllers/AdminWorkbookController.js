const WorkbookGenerationService = require('../services/WorkbookGenerationService');
const { sendSuccess } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

class AdminWorkbookController {
  
  async generateWorkbook(req, res) {
    const { academicYearId, topic } = req.body;
    
    // Using req.user.id if authenticated by adminAuth middleware, otherwise null
    const generatedBy = req.user?.id || 'System Admin';

    const workbook = await WorkbookGenerationService.generate(academicYearId, topic, generatedBy);

    return sendSuccess(res, {
      message: 'Workbook generated successfully.',
      data: workbook
    });
  }

  async listWorkbooks(req, res) {
    const workbooks = await WorkbookGenerationService.listWorkbooks();
    
    return sendSuccess(res, {
      message: 'Workbooks retrieved successfully.',
      data: workbooks
    });
  }

  async downloadWorkbook(req, res) {
    const { id } = req.params;
    const { buffer, fileName } = await WorkbookGenerationService.getDownloadBuffer(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }

  async deleteWorkbook(req, res) {
    const { id } = req.params;
    await WorkbookGenerationService.deleteWorkbook(id);
    
    return sendSuccess(res, {
      message: 'Workbook deleted successfully.'
    });
  }

  async deleteMultipleWorkbooks(req, res) {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('An array of workbook IDs is required.');
    }

    const result = await WorkbookGenerationService.deleteMultipleWorkbooks(ids);
    
    return sendSuccess(res, {
      message: `Successfully deleted ${result.count} workbooks.`
    });
  }

  async deleteAllWorkbooks(req, res) {
    const result = await WorkbookGenerationService.deleteAllWorkbooks();
    
    return sendSuccess(res, {
      message: `Successfully deleted all ${result.count} workbooks.`
    });
  }
}

module.exports = new AdminWorkbookController();
