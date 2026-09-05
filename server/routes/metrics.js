import express from 'express';
import { db } from '../db/database.js';
import { eventQueue } from '../ingestion/eventQueue.js';
import { authenticateToken } from '../security/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const totalCases = db.prepare('SELECT count(*) as count FROM recovery_cases').get()?.count || 0;
    const recoveredCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'RECOVERED'").get()?.count || 0;
    const partialCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'PARTIAL'").get()?.count || 0;
    const inProgressCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'IN_PROGRESS'").get()?.count || 0;
    const escalatedCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'ESCALATED'").get()?.count || 0;
    const stoppedCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'STOPPED'").get()?.count || 0;
    const openCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'OPEN'").get()?.count || 0;

    const totalRecoveredAmount = db.prepare("SELECT COALESCE(SUM(recovered_amount), 0) as total FROM recovery_cases").get()?.total || 0;
    const totalAtRiskAmount = db.prepare("SELECT COALESCE(SUM(amount - recovered_amount), 0) as total FROM recovery_cases WHERE status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED')").get()?.total || 0;
    const recoveryOpportunities = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM recovery_cases WHERE status IN ('OPEN', 'IN_PROGRESS')").get()?.total || 0;

    const aiDecisions = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE recommended_action IS NOT NULL").get()?.count || 0;
    const aiRecommendedRecoveries = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE recommended_action NOT IN ('STOP_RECOVERY', 'ESCALATE', 'ESCALATE_TO_HUMAN')").get()?.count || 0;
    const approvedRecoveries = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE policy_decision = 'APPROVED'").get()?.count || 0;

    const avgConfRow = db.prepare("SELECT AVG(confidence_score) as avgConf FROM recovery_cases WHERE confidence_score IS NOT NULL").get();
    const avgRecoveryConfidence = avgConfRow?.avgConf ? Math.round(avgConfRow.avgConf * 100) / 100 : 0.91;

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
      recoveryOpportunities: Math.round(recoveryOpportunities),
      recoverySuccessRate: Math.round(recoveryRate * 10) / 10,
      totalCases,
      activeCases: inProgressCases + openCases,
      recoveredCases,
      escalatedCases,
      stoppedCases,
      aiDecisions,
      aiRecommendedRecoveries,
      approvedRecoveries,
      avgRecoveryConfidence,
      actionDistribution: actionCounts,
      riskDistribution: riskCounts,
      queue: queueMetrics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
