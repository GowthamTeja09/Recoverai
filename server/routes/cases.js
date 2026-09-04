import express from 'express';
import { db } from '../db/database.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';
import { recoveryOrchestrator } from '../engines/recoveryOrchestrator.js';

const router = express.Router();

router.use(authenticateToken);

// List all recovery cases with filtering
router.get('/', (req, res) => {
  try {
    const { status, riskLevel, search } = req.query;
    let query = `
      SELECT rc.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.ltv as customer_ltv
      FROM recovery_cases rc
      LEFT JOIN customers c ON rc.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      query += ` AND rc.status = ?`;
      params.push(status);
    }
    if (riskLevel && riskLevel !== 'ALL') {
      query += ` AND rc.risk_level = ?`;
      params.push(riskLevel);
    }
    if (search) {
      query += ` AND (rc.id LIKE ? OR c.name LIKE ? OR c.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY rc.created_at DESC`;

    const cases = db.prepare(query).all(...params);

    const parsedCases = cases.map(c => {
      let aiDiag = null;
      let polChecks = [];
      try {
        aiDiag = typeof c.ai_diagnosis === 'string' ? JSON.parse(c.ai_diagnosis) : c.ai_diagnosis;
      } catch (e) {
        aiDiag = { recommended_action: c.recommended_action || 'PAYMENT_LINK', root_cause: c.root_cause };
      }
      try {
        polChecks = typeof c.policy_checks === 'string' ? JSON.parse(c.policy_checks) : c.policy_checks;
      } catch (e) {
        polChecks = [];
      }

      return {
        ...c,
        ai_diagnosis: aiDiag,
        policy_checks: polChecks || []
      };
    });

    res.json({ cases: parsedCases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get case detail and its execution timeline audit trail
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const caseItem = db.prepare(`
      SELECT rc.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.ltv as customer_ltv, c.preferred_channel
      FROM recovery_cases rc
      LEFT JOIN customers c ON rc.customer_id = c.id
      WHERE rc.id = ?
    `).get(id);

    if (!caseItem) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    const actions = db.prepare('SELECT * FROM recovery_actions WHERE case_id = ? ORDER BY created_at DESC').all(id);
    const timeline = auditLogStore.getLogsByCaseId(id);

    res.json({
      case: {
        ...caseItem,
        ai_diagnosis: caseItem.ai_diagnosis ? JSON.parse(caseItem.ai_diagnosis) : null,
        policy_checks: caseItem.policy_checks ? JSON.parse(caseItem.policy_checks) : []
      },
      actions: actions.map(a => ({
        ...a,
        payload: a.payload ? JSON.parse(a.payload) : {},
        response_data: a.response_data ? JSON.parse(a.response_data) : {}
      })),
      timeline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger manual override action on a case
router.post('/:id/action', requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, notes } = req.body;

    const caseItem = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(id);
    if (!caseItem) {
      return res.status(404).json({ error: 'Recovery case not found' });
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(caseItem.customer_id);

    auditLogStore.logEvent({
      caseId: id,
      eventType: 'MANUAL_ACTION_TRIGGERED',
      actor: `${req.user.name} (${req.user.role})`,
      action: `TRIGGER_${actionType}`,
      details: { actionType, notes }
    });

    const diagnosis = {
      recommended_action: actionType,
      suggested_channel: req.body.channel || 'WHATSAPP',
      customer_messaging: req.body.message || `Manual recovery notification for #${id}: {{PAYMENT_LINK}}`
    };

    const policyDecision = {
      decision: 'APPROVED',
      checks: [{ rule: 'MANUAL_AGENT_OVERRIDE', passed: true, detail: `Approved by ${req.user.role}` }]
    };

    const result = await recoveryOrchestrator.execute({
      recoveryCase: caseItem,
      diagnosis,
      policyDecision,
      customer
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
