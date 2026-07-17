const express = require('express');
const router = express.Router();
const adminFacultyController = require('../controllers/AdminFacultyController');
const upload = require('../middleware/upload');

// GET /api/v1/admin/faculty
router.get('/', adminFacultyController.getFaculty);

// GET /api/v1/admin/faculty/search
router.get('/search', adminFacultyController.searchFaculty);

// POST /api/v1/admin/faculty/upload
router.post('/upload', upload.single('file'), adminFacultyController.uploadFaculty);

module.exports = router;
