import express from 'express';
import { auditLogStore } from '../security/auditLogStore.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';

const router = express.Router();
router.use(authenticateToken);

// Get recent audit logs with filters
router.get('/', requirePermission('VIEW_AUDIT_LOGS'), (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = auditLogStore.getRecentLogs(limit);
    const integrity = auditLogStore.verifyChainIntegrity();

    res.json({
      logs,
      integrity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify cryptographic hash chain integrity
router.get('/verify', requirePermission('VIEW_AUDIT_LOGS'), (req, res) => {
  try {
    const verification = auditLogStore.verifyChainIntegrity();
    res.json(verification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
