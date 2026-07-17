const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/StudentController');
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');

// Apply auth middleware to all student routes
router.use(authMiddleware);

// Define routes
router.get('/', StudentController.getStudents);
router.get('/search', StudentController.searchStudents);
router.get('/departments', StudentController.getDepartments);
router.get('/:rollNumber', StudentController.getStudent);

module.exports = router;
