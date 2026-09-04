import express from 'express';
import { secretsManager } from '../security/secretsManager.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', requirePermission('MANAGE_SECRETS'), (req, res) => {
  res.json({ secrets: secretsManager.getAllMasked() });
});

router.post('/', requirePermission('MANAGE_SECRETS'), (req, res) => {
  const { key, value } = req.body;
  if (!key || !value) {
    return res.status(400).json({ error: 'key and value required' });
  }
  secretsManager.set(key, value);
  res.json({ success: true, message: `Secret ${key} updated` });
});

export default router;
