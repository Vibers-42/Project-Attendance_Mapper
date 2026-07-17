const express = require('express');
const router = express.Router();
const adminWorkbookController = require('../controllers/AdminWorkbookController');

// POST /api/v1/admin/workbooks/generate
router.post('/generate', adminWorkbookController.generateWorkbook);

// GET /api/v1/admin/workbooks
router.get('/', adminWorkbookController.listWorkbooks);

// DELETE /api/v1/admin/workbooks/bulk
router.delete('/bulk', adminWorkbookController.deleteMultipleWorkbooks);

// DELETE /api/v1/admin/workbooks/all
router.delete('/all', adminWorkbookController.deleteAllWorkbooks);

// GET /api/v1/admin/workbooks/:id/download
router.get('/:id/download', adminWorkbookController.downloadWorkbook);

// DELETE /api/v1/admin/workbooks/:id
router.delete('/:id', adminWorkbookController.deleteWorkbook);

module.exports = router;
