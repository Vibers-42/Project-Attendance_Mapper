const express = require('express');
const router = express.Router();
const authController = require('../controllers/AuthController');
const authenticate = require('../middleware/authenticate');
const validateRequest = require('../middleware/validateRequest');
const { loginSchema } = require('../validators/facultyValidator');

// POST /api/auth/login
// Public endpoint for faculty login
router.post('/login', validateRequest(loginSchema), authController.login);

// GET /api/auth/me
// Protected endpoint to get the current authenticated faculty
router.get('/me', authenticate, authController.getMe);

// PUT /api/auth/password
// Protected endpoint to change faculty password
router.put(
  '/password',
  authenticate,
  validateRequest(require('../validators/facultyValidator').changePasswordSchema),
  authController.changePassword
);

module.exports = router;
