const express = require('express');
const router = express.Router();
const adminStudentController = require('../controllers/AdminStudentController');
const upload = require('../middleware/upload');

// NOTE: Order matters — specific paths must come before parameterised ones.

// GET  /api/v1/admin/students          — paginated list (+ optional ?q= search)
router.get('/', adminStudentController.getStudents);

// GET  /api/v1/admin/students/search   — legacy search endpoint
router.get('/search', adminStudentController.searchStudents);

// POST /api/v1/admin/students/upload   — bulk replace via Excel
router.post('/upload', upload.single('file'), adminStudentController.uploadStudents);

// POST /api/v1/admin/students          — add a single student
router.post('/', adminStudentController.addStudent);

// DELETE /api/v1/admin/students/:id    — remove a single student
router.delete('/:id', adminStudentController.deleteStudent);

module.exports = router;
