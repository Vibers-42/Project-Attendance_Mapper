const express = require('express');
const router = express.Router();
const adminStudentController = require('../controllers/AdminStudentController');
const upload = require('../middleware/upload');

// Admin authentication is bypassed for MVP, but normally you would add an adminAuthenticate middleware here.

// GET /api/v1/admin/students
router.get('/', adminStudentController.getStudents);

// GET /api/v1/admin/students/search
router.get('/search', adminStudentController.searchStudents);

// POST /api/v1/admin/students/upload
router.post('/upload', upload.single('file'), adminStudentController.uploadStudents);

module.exports = router;
