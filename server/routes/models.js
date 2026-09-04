import express from 'express';
import { modelRegistry } from '../ml/modelRegistry.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', requirePermission('VIEW_MODELS'), (req, res) => {
  try {
    const models = modelRegistry.getAllModels();
    res.json({ models });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requirePermission('VIEW_MODELS'), (req, res) => {
  try {
    const model = modelRegistry.getModelById(req.params.id);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json({ model });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
