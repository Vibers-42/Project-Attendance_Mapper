const express = require('express');
const router = express.Router();
const MappingController = require('../controllers/MappingController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all mapping routes
router.use(authMiddleware);

// Define routes
router.get('/prepare/:sessionId', MappingController.prepareContext);
router.get('/status/:sessionId', MappingController.checkStatus);

module.exports = router;
