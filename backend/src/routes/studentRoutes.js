const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/StudentController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Apply authentication to all student routes
router.use(authenticate);

// Define routes
router.get('/', StudentController.getStudents);
router.get('/search', StudentController.searchStudents);
router.get('/departments', StudentController.getDepartments);
router.get('/:rollNumber', StudentController.getStudent);

module.exports = router;
