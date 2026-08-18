const express = require('express');
const router = express.Router();
const placementStudentMasterController = require('../controllers/PlacementStudentMasterController');
const upload = require('../middleware/upload');
const PlacementStudentMasterService = require('../services/PlacementStudentMasterService');
const { sendSuccess } = require('../utils/apiResponse');

// List placement students (paginated/search)
router.get('/', placementStudentMasterController.getStudents.bind(placementStudentMasterController));

// Upload placement students via Excel
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('No Excel file uploaded');
      err.statusCode = 400;
      throw err;
    }
    const result = await PlacementStudentMasterService.uploadStudents(req.file.buffer);
    return sendSuccess(res, {
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Add single placement student
router.post('/', placementStudentMasterController.addStudent.bind(placementStudentMasterController));

// Delete single placement student
router.delete('/:id', placementStudentMasterController.deleteStudent.bind(placementStudentMasterController));

module.exports = router;
