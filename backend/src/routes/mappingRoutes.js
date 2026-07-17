const express = require('express');
const router = express.Router();
const MappingController = require('../controllers/MappingController');
const authenticate = require('../middleware/authenticate');

// Apply authentication to all mapping routes
router.use(authenticate);

// Define routes
router.get('/prepare/:sessionId', MappingController.prepareContext);
router.get('/status/:sessionId', MappingController.checkStatus);

module.exports = router;
