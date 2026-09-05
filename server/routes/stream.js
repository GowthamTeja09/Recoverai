import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { eventQueue } from '../ingestion/eventQueue.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { modelRegistry } from '../ml/modelRegistry.js';
import { secretsManager } from '../security/secretsManager.js';
import { getJwtSecret } from '../security/auth.js';
import { ROLES } from '../security/rbac.js';

const router = express.Router();
const STREAM_ACCESS = {
  SUPER_ADMIN: {
    canViewGuardrails: true,
    canViewAudit: true,
    canViewModels: true,
    canManageSecrets: true
  },
  RISK_OFFICER: {
    canViewGuardrails: true,
    canViewAudit: true,
    canViewModels: true,
    canManageSecrets: false
  },
  MERCHANT_OPERATOR: {
    canViewGuardrails: true,
    canViewAudit: false,
    canViewModels: false,
    canManageSecrets: false
  },
  SUPPORT_AGENT: {
    canViewGuardrails: false,
    canViewAudit: false,
    canViewModels: false,
    canManageSecrets: false
  }
};

function resolveRequestRole(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const isProduction = process.env.NODE_ENV === 'production';
  const isDemoMode = (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === true) && !isProduction;

  if (token) {
    try {
      const user = jwt.verify(token, getJwtSecret());
      if (user?.role && Object.values(ROLES).includes(String(user.role).toUpperCase())) {
        return String(user.role).toUpperCase();
      }
    } catch {
      // Fall back to demo role only if demo mode is active
    }
  }

  if (isDemoMode) {
    const demoRole = String(req.headers['x-demo-role'] || '').toUpperCase();
    if (Object.values(ROLES).includes(demoRole)) {
      return demoRole;
    }
  }

  return ROLES.SUPPORT_AGENT;
}

function parseJsonField(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadMetrics() {
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

  const actionCounts = db.prepare(`
    SELECT action_type, count(*) as count
    FROM recovery_actions
    GROUP BY action_type
  `).all();

  const riskCounts = db.prepare(`
    SELECT risk_level, count(*) as count
    FROM recovery_cases
    GROUP BY risk_level
  `).all();

  return {
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
    queue: eventQueue.getMetrics()
  };
}

function loadCases(limit = 12) {
  const rows = db.prepare(`
    SELECT rc.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.ltv as customer_ltv, c.preferred_channel
    FROM recovery_cases rc
    LEFT JOIN customers c ON rc.customer_id = c.id
    ORDER BY rc.created_at DESC
    LIMIT ?
  `).all(limit);

  return rows.map((row) => ({
    ...row,
    ai_diagnosis: parseJsonField(row.ai_diagnosis, {
      recommended_action: row.recommended_action || 'PAYMENT_LINK',
      root_cause: row.root_cause
    }),
    policy_checks: parseJsonField(row.policy_checks, [])
  }));
}

function loadAudit(limit = 24) {
  return auditLogStore.getRecentLogs(limit);
}

function buildDashboardSnapshot(role) {
  const access = STREAM_ACCESS[role] || STREAM_ACCESS.SUPPORT_AGENT;
  const snapshot = {
    timestamp: new Date().toISOString(),
    metrics: loadMetrics(),
    cases: loadCases(),
    integrity: auditLogStore.verifyChainIntegrity(),
  };

  snapshot.policies = access.canViewGuardrails ? db.prepare('SELECT * FROM policy_rules ORDER BY id ASC').all() : [];
  snapshot.auditLogs = access.canViewAudit ? loadAudit() : [];
  snapshot.models = access.canViewModels ? modelRegistry.getAllModels() : [];
  snapshot.secrets = access.canManageSecrets ? secretsManager.getAllMasked() : {};

  return snapshot;
}

router.get('/dashboard', (req, res) => {
  const role = resolveRequestRole(req);
  const accept = String(req.headers.accept || '').toLowerCase();

  if (!accept.includes('text/event-stream')) {
    return res.json(buildDashboardSnapshot(role));
  }

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const sendSnapshot = () => {
    res.write(`data: ${JSON.stringify(buildDashboardSnapshot(role))}\n\n`);
  };

  sendSnapshot();
  const snapshotTimer = setInterval(sendSnapshot, 4000);
  const heartbeatTimer = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(snapshotTimer);
    clearInterval(heartbeatTimer);
    res.end();
  });
});

export default router;
