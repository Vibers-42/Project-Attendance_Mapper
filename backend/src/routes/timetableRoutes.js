const express = require('express');
const router = express.Router();
const TimetableController = require('../controllers/TimetableController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all timetable routes
router.use(authMiddleware);

// Define routes
router.get('/', TimetableController.getTimetable);
router.get('/faculty/:facultyId', TimetableController.getFacultySchedule);
router.get('/section/:sectionId', TimetableController.getSectionSchedule);

module.exports = router;
