const express = require('express');
const router = express.Router();
const publicAttendanceController = require('../controllers/PublicAttendanceController');

// GET  /attend/:sessionId — mobile attendance form (no auth, serves HTML)
router.get('/:sessionId', publicAttendanceController.showAttendancePage.bind(publicAttendanceController));

// POST /attend/:sessionId — submit attendance (no auth, returns JSON)
router.post('/:sessionId', publicAttendanceController.submitAttendance.bind(publicAttendanceController));

module.exports = router;
