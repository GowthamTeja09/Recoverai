import express from 'express';
import { db } from '../db/database.js';
import { eventQueue } from '../ingestion/eventQueue.js';
import { authenticateToken } from '../security/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const totalCases = db.prepare('SELECT count(*) as count FROM recovery_cases').get().count;
    const recoveredCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'RECOVERED'").get().count;
    const partialCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'PARTIAL'").get().count;
    const inProgressCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'IN_PROGRESS'").get().count;
    const escalatedCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'ESCALATED'").get().count;
    const openCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'OPEN'").get().count;

    const totalRecoveredAmount = db.prepare("SELECT COALESCE(SUM(recovered_amount), 0) as total FROM recovery_cases").get().total;
    const totalAtRiskAmount = db.prepare("SELECT COALESCE(SUM(amount - recovered_amount), 0) as total FROM recovery_cases WHERE status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED')").get().total;

    const recoveryRate = totalCases > 0 ? ((recoveredCases + partialCases * 0.5) / totalCases) * 100 : 0;

    // Action breakdown
    const actionCounts = db.prepare(`
      SELECT action_type, count(*) as count
      FROM recovery_actions
      GROUP BY action_type
    `).all();

    // Risk levels breakdown
    const riskCounts = db.prepare(`
      SELECT risk_level, count(*) as count
      FROM recovery_cases
      GROUP BY risk_level
    `).all();

    // Queue metrics
    const queueMetrics = eventQueue.getMetrics();

    res.json({
      revenueAtRisk: Math.round(totalAtRiskAmount),
      totalRevenueRecovered: Math.round(totalRecoveredAmount),
      recoverySuccessRate: Math.round(recoveryRate * 10) / 10,
      totalCases,
      activeCases: inProgressCases + openCases,
      recoveredCases,
      escalatedCases,
      actionDistribution: actionCounts,
      riskDistribution: riskCounts,
      queue: queueMetrics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
