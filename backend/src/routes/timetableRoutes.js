const express = require('express');
const router = express.Router();
const TimetableController = require('../controllers/TimetableController');
const authenticate = require('../middleware/authenticate');

// Apply authentication to all timetable routes
router.use(authenticate);

// Define routes
router.get('/', TimetableController.getTimetable);
router.get('/faculty/:facultyId', TimetableController.getFacultySchedule);
router.get('/section/:sectionId', TimetableController.getSectionSchedule);

module.exports = router;
