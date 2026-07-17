const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const sessionRoutes = require('./attendanceSessionRoutes');
const studentRoutes = require('./studentRoutes');
const timetableRoutes = require('./timetableRoutes');
const mappingRoutes = require('./mappingRoutes');

const { sendSuccess } = require('../utils/apiResponse');

// Health Check Endpoint
router.get('/health', (req, res) => {
  return sendSuccess(res, {
    message: 'Attendance Mapping Backend is running',
    data: { status: 'OK' }
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/sessions', sessionRoutes);
router.use('/students', studentRoutes);
router.use('/timetable', timetableRoutes);
router.use('/mapping', mappingRoutes);

module.exports = router;
