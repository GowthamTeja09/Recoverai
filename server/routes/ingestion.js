import express from 'express';
import { ingestBatchTransactions } from '../ingestion/apiIngestionService.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';

const router = express.Router();
router.use(authenticateToken);

router.post('/batch', requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
    const { transactions, source } = req.body;
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'transactions array is required' });
    }

    const result = await ingestBatchTransactions(transactions, source || 'BATCH_UPLOAD_API');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
