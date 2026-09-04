import express from 'express';
import { db } from '../db/database.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';
import { auditLogStore } from '../security/auditLogStore.js';

const router = express.Router();
router.use(authenticateToken);

// List all policy rules
router.get('/', requirePermission('VIEW_GUARDRAILS'), (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM policy_rules ORDER BY id ASC').all();
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a policy rule (Thresholds, Cooldowns, Quiet hours)
router.put('/:id', requirePermission('UPDATE_POLICY_RULES'), (req, res) => {
  try {
    const { id } = req.params;
    const { rule_value, is_enabled } = req.body;

    const currentRule = db.prepare('SELECT * FROM policy_rules WHERE id = ?').get(id);
    if (!currentRule) {
      return res.status(404).json({ error: 'Policy rule not found' });
    }

    db.prepare(`
      UPDATE policy_rules
      SET rule_value = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(String(rule_value), is_enabled !== undefined ? (is_enabled ? 1 : 0) : currentRule.is_enabled, id);

    auditLogStore.logEvent({
      eventType: 'POLICY_RULE_MODIFIED',
      actor: `${req.user.name} (${req.user.role})`,
      action: 'UPDATE_RULE',
      details: {
        ruleId: id,
        ruleKey: currentRule.rule_key,
        oldValue: currentRule.rule_value,
        newValue: rule_value
      }
    });

    res.json({ success: true, message: 'Policy rule updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
