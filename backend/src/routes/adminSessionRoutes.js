const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/AdminSessionController');

// ─── IMPORTANT: static paths must come BEFORE parameterised /:id ───────────

// Workbook-level routes (class-centric)
router.get('/',              ctrl.listSessions);       // GET  /admin/sessions           — grouped workbooks
router.get('/raw',           ctrl.listRawSessions);    // GET  /admin/sessions/raw        — individual sessions
router.get('/download',      ctrl.downloadSession);    // GET  /admin/sessions/download   — consolidated xlsx stream
router.delete('/workbook',   ctrl.deleteWorkbook);     // DELETE /admin/sessions/workbook — delete all sessions for a class

// Bulk / single session management
router.post('/bulk-delete',  ctrl.bulkDeleteSessions);     // POST   /admin/sessions/bulk-delete
router.get('/:id/download',  ctrl.downloadSingleSession);  // GET    /admin/sessions/:id/download — single session worksheet
router.delete('/:id',        ctrl.deleteSession);          // DELETE /admin/sessions/:id

module.exports = router;
