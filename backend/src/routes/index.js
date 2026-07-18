const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const sessionRoutes = require('./attendanceSessionRoutes');
const studentRoutes = require('./studentRoutes');
const timetableRoutes = require('./timetableRoutes');
const mappingRoutes = require('./mappingRoutes');
const adminAuthRoutes = require('./adminAuthRoutes');
const adminStudentRoutes = require('./adminStudentRoutes');
const adminFacultyRoutes = require('./adminFacultyRoutes');
const adminWorkbookRoutes = require('./adminWorkbookRoutes');
const adminSessionRoutes = require('./adminSessionRoutes');

const { sendSuccess } = require('../utils/apiResponse');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Health Check Endpoint
router.get('/health', (req, res) => {
  return sendSuccess(res, {
    message: 'Attendance Mapping Backend is running',
    data: { status: 'OK' }
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/students', authenticate, authorize('SUPER_ADMIN'), adminStudentRoutes);
router.use('/admin/faculty', authenticate, authorize('SUPER_ADMIN'), adminFacultyRoutes);
router.use('/admin/workbooks', authenticate, authorize('SUPER_ADMIN'), adminWorkbookRoutes);
router.use('/admin/sessions', authenticate, authorize('SUPER_ADMIN'), adminSessionRoutes);
router.use('/sessions', sessionRoutes);
router.use('/students', studentRoutes);
router.use('/timetable', timetableRoutes);
router.use('/mapping', mappingRoutes);

module.exports = router;
