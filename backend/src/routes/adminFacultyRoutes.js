const express = require('express');
const router = express.Router();
const adminFacultyController = require('../controllers/AdminFacultyController');
const upload = require('../middleware/upload');

// NOTE: Specific static paths must come before parameterised /:id

// GET  /api/v1/admin/faculty           — paginated browse + search via ?q=
router.get('/', adminFacultyController.getFaculty);

// POST /api/v1/admin/faculty/upload    — bulk replace via Excel
router.post('/upload', upload.single('file'), adminFacultyController.uploadFaculty);

// POST /api/v1/admin/faculty           — add a single faculty member
router.post('/', adminFacultyController.addFaculty);

// PATCH /api/v1/admin/faculty/promote-superadmin — grant SUPER_ADMIN role to selected faculty
router.patch('/promote-superadmin', adminFacultyController.promoteToSuperAdmin);

// PATCH /api/v1/admin/faculty/revoke-superadmin  — revert selected faculty back to FACULTY role
router.patch('/revoke-superadmin', adminFacultyController.revokeSuperAdmin);

// DELETE /api/v1/admin/faculty/:id     — remove a single faculty member
router.delete('/:id', adminFacultyController.deleteFaculty);

module.exports = router;
