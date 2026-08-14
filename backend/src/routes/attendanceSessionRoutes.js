const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/AttendanceSessionController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const { startSessionSchema, joinTemplateSchema } = require('../validators/attendanceValidator');

// Apply authentication to all session routes
router.use(authenticate);

// We allow both FACULTY and SUPER_ADMIN to manage sessions.
router.use(authorize('FACULTY', 'SUPER_ADMIN'));

// ─── IMPORTANT: static paths must come BEFORE parameterised /:id ───────────

// GET /api/v1/sessions
// List paginated sessions
router.get('/', sessionController.getSessions);

// GET /api/v1/sessions/active
// Get currently active session for faculty
router.get('/active', sessionController.getActiveSession);

// GET /api/v1/sessions/templates
// List Superadmin-created session templates open for Faculty to join
router.get('/templates', sessionController.listTemplates);

// POST /api/v1/sessions/templates/:id/join
// Faculty joins a template with their own room number
router.post('/templates/:id/join', validateRequest(joinTemplateSchema), sessionController.joinTemplate);

// POST /api/v1/sessions
// Create a new session template — SUPER_ADMIN only
router.post('/', authorize('SUPER_ADMIN'), validateRequest(startSessionSchema), sessionController.create);

// GET /api/v1/sessions/:id
// Get a specific session
router.get('/:id', sessionController.getSession);

// GET /api/v1/sessions/:id/records
// Get all attendance records for a session
router.get('/:id/records', sessionController.getSessionRecords);

// PATCH /api/v1/sessions/:id
// Update session metadata
router.patch('/:id', validateRequest(startSessionSchema), sessionController.updateSession);

// POST /api/v1/sessions/:id/complete
// Complete the session
router.post('/:id/complete', sessionController.completeSession);

// POST /api/v1/sessions/:id/cancel
// Cancel the session
router.post('/:id/cancel', sessionController.cancelSession);

const { submitAttendanceSchema } = require('../validators/attendanceValidator');

// POST /api/v1/sessions/:id/records
// Batch submit attendance records for this session
router.post('/:id/records', validateRequest(submitAttendanceSchema), sessionController.submitRecords);

module.exports = router;
