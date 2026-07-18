const express = require('express');
const router = express.Router();
const adminSessionController = require('../controllers/AdminSessionController');

// NOTE: Static paths must come before parameterised /:id

// GET  /api/v1/admin/sessions                — list all sessions (filtered, paginated)
router.get('/', adminSessionController.listSessions);

// GET  /api/v1/admin/sessions/:id/download   — generate + stream workbook (no disk storage)
router.get('/:id/download', adminSessionController.downloadSession);

// POST /api/v1/admin/sessions/bulk-delete — bulk delete sessions
router.post('/bulk-delete', adminSessionController.bulkDeleteSessions);

// DELETE /api/v1/admin/sessions/:id          — hard delete session + cascade records
router.delete('/:id', adminSessionController.deleteSession);

module.exports = router;
