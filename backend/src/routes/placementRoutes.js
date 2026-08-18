const express = require('express');
const router = express.Router();
const placementController = require('../controllers/PlacementController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const upload = require('../middleware/upload');

router.use(authenticate);
router.use(authorize('FACULTY', 'SUPER_ADMIN'));

// GET /api/v1/placement/faculty — list active faculty for permission picker
router.get('/faculty', placementController.getFaculty.bind(placementController));

// POST /api/v1/placement/parse-excel — upload an Excel file and return parsed students
router.post('/parse-excel', upload.single('file'), placementController.parseExcel.bind(placementController));

// POST /api/v1/placement/sessions/add-missing-students — add missing students to session
router.post('/sessions/add-missing-students', placementController.addMissingStudents.bind(placementController));

// GET /api/v1/placement/sessions — list sessions accessible to the requesting faculty
router.get('/sessions', placementController.getSessions.bind(placementController));

// POST /api/v1/placement/sessions — create a placement session
router.post('/sessions', placementController.createSession.bind(placementController));

// GET /api/v1/placement/sessions/:id/students — eligibility list for scanner
router.get('/sessions/:id/students', placementController.getSessionStudents.bind(placementController));

// POST /api/v1/placement/sessions/:id/attendance — submit scanned roll numbers
router.post('/sessions/:id/attendance', placementController.updateAttendance.bind(placementController));

// GET /api/v1/placement/sessions/:id/report — fetch attendance report (COMPLETED sessions only)
router.get('/sessions/:id/report', placementController.getReport.bind(placementController));

// GET /api/v1/placement/sessions/:id/report/excel — download Excel workbook
router.get('/sessions/:id/report/excel', placementController.downloadExcelReport.bind(placementController));

// PATCH /api/v1/placement/sessions/:id/start — transition DRAFT → ACTIVE
router.patch('/sessions/:id/start', placementController.startSession.bind(placementController));

// PATCH /api/v1/placement/sessions/:id — update a draft session's fields / students
router.patch('/sessions/:id', placementController.updateDraft.bind(placementController));

// DELETE /api/v1/placement/sessions/:id — owner-only hard delete
router.delete('/sessions/:id', placementController.deleteSession.bind(placementController));

// POST /api/v1/placement/sessions/:id/finalize — lock attendance permanently
router.post('/sessions/:id/finalize', placementController.finalizeSession.bind(placementController));

module.exports = router;
