const express = require('express');
const router = express.Router();
const adminPlacementReportController = require('../controllers/AdminPlacementReportController');

// GET /api/v1/admin/placements/reports
router.get('/', adminPlacementReportController.listReports.bind(adminPlacementReportController));

// GET /api/v1/admin/placements/reports/:id/download
router.get('/:id/download', adminPlacementReportController.downloadReport.bind(adminPlacementReportController));

module.exports = router;
