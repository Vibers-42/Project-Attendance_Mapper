const express = require('express');
const router = express.Router();
const superAdminAuthController = require('../controllers/SuperAdminAuthController');
const authenticate = require('../middleware/authenticate');

// POST /api/v1/admin/auth/login
// Validates employeeId + password against SuperAdmin table, returns JWT
router.post('/login', superAdminAuthController.login);

// GET /api/v1/admin/auth/me
// Returns the currently authenticated Super Admin's profile (requires valid JWT)
router.get('/me', authenticate, superAdminAuthController.getMe);

module.exports = router;
