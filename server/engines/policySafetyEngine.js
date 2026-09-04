import { db } from '../db/database.js';
import { auditLogStore } from '../security/auditLogStore.js';

export class PolicySafetyEngine {
  constructor() {
    this.name = 'PolicySafetyEngine_v1.0';
    this.defaultRules = {
      MAX_AUTO_RECOVERY_AMOUNT: 50000, // ₹50,000 max for automated recovery without human escalation
      MAX_RETRY_ATTEMPTS: 3,
      MIN_COOLDOWN_HOURS: 4,
      MIN_CONFIDENCE_THRESHOLD: 0.70,
      MAX_CUSTOMER_CONTACTS_24H: 2,
      QUIET_HOURS_START: 22, // 10 PM
      QUIET_HOURS_END: 8,    // 8 AM
      ALLOWED_ACTIONS: ['SUBSCRIPTION_RETRY', 'RECOVERY_ORDER', 'PAYMENT_LINK', 'REMINDER', 'ESCALATE']
    };
  }

  getRules(merchantId = 'mcht_enterprise_001') {
    try {
      const rows = db.prepare('SELECT rule_key, rule_value, is_enabled FROM policy_rules WHERE merchant_id = ?').all(merchantId);
      const activeRules = { ...this.defaultRules };
      for (const row of rows) {
        if (row.is_enabled) {
          try {
            activeRules[row.rule_key] = JSON.parse(row.rule_value);
          } catch {
            activeRules[row.rule_key] = isNaN(Number(row.rule_value)) ? row.rule_value : Number(row.rule_value);
          }
        }
      }
      return activeRules;
    } catch {
      return this.defaultRules;
    }
  }

  evaluate({ recoveryCase, diagnosis, customer, previousActions = [] }) {
    const rules = this.getRules(recoveryCase.merchant_id);
    const checks = [];
    let decision = 'APPROVED';
    let escalationReason = null;

    const amount = recoveryCase.amount;
    const recommendedAction = diagnosis.recommended_action;
    const confidence = diagnosis.confidence || 0;
    const attempts = recoveryCase.attempts_count || 0;

    // Check 1: Allowed Actions Whitelist
    const isActionAllowed = rules.ALLOWED_ACTIONS.includes(recommendedAction);
    checks.push({
      rule: 'ALLOWED_ACTIONS_WHITELIST',
      passed: isActionAllowed,
      detail: `Action '${recommendedAction}' is ${isActionAllowed ? 'in' : 'NOT in'} whitelist`
    });
    if (!isActionAllowed) {
      decision = 'REJECTED';
      escalationReason = `Action ${recommendedAction} is not permitted by policy whitelist`;
    }

    // Check 2: Amount Limit Check
    const amountPassed = amount <= rules.MAX_AUTO_RECOVERY_AMOUNT;
    checks.push({
      rule: 'MAX_AMOUNT_LIMIT',
      passed: amountPassed,
      detail: `Transaction amount ₹${amount.toLocaleString('en-IN')} vs ceiling ₹${rules.MAX_AUTO_RECOVERY_AMOUNT.toLocaleString('en-IN')}`
    });
    if (!amountPassed) {
      decision = 'ESCALATED';
      escalationReason = `Amount ₹${amount.toLocaleString('en-IN')} exceeds autonomous safety ceiling of ₹${rules.MAX_AUTO_RECOVERY_AMOUNT.toLocaleString('en-IN')}`;
    }

    // Check 3: Retry Limits Check
    const retryPassed = attempts < rules.MAX_RETRY_ATTEMPTS;
    checks.push({
      rule: 'RETRY_LIMITS',
      passed: retryPassed,
      detail: `Attempts count (${attempts}) vs max allowed (${rules.MAX_RETRY_ATTEMPTS})`
    });
    if (!retryPassed) {
      decision = 'ESCALATED';
      escalationReason = `Exceeded maximum recovery attempts (${rules.MAX_RETRY_ATTEMPTS})`;
    }

    // Check 4: Cooldown Period Check
    if (recoveryCase.last_attempt_at) {
      const lastAttemptMs = new Date(recoveryCase.last_attempt_at).getTime();
      const hoursSinceLast = (Date.now() - lastAttemptMs) / (1000 * 60 * 60);
      const cooldownPassed = hoursSinceLast >= rules.MIN_COOLDOWN_HOURS;
      checks.push({
        rule: 'COOLDOWN_PERIOD',
        passed: cooldownPassed,
        detail: `Elapsed time ${hoursSinceLast.toFixed(1)}h vs required cooldown ${rules.MIN_COOLDOWN_HOURS}h`
      });
      if (!cooldownPassed && decision !== 'ESCALATED') {
        decision = 'REJECTED';
        escalationReason = `Active cooldown period in effect. Must wait ${rules.MIN_COOLDOWN_HOURS}h between attempts.`;
      }
    } else {
      checks.push({
        rule: 'COOLDOWN_PERIOD',
        passed: true,
        detail: 'First attempt, no prior cooldown'
      });
    }

    // Check 5: Confidence Threshold
    const confidencePassed = confidence >= rules.MIN_CONFIDENCE_THRESHOLD;
    checks.push({
      rule: 'CONFIDENCE_THRESHOLD',
      passed: confidencePassed,
      detail: `AI confidence ${(confidence * 100).toFixed(1)}% vs minimum required ${(rules.MIN_CONFIDENCE_THRESHOLD * 100).toFixed(1)}%`
    });
    if (!confidencePassed && decision === 'APPROVED') {
      decision = 'ESCALATED';
      escalationReason = `Confidence score ${(confidence * 100).toFixed(1)}% below autonomous threshold`;
    }

    // Check 6: Customer Contact Limits & Quiet Hours
    const currentHour = new Date().getHours();
    const isQuietHours = currentHour >= rules.QUIET_HOURS_START || currentHour < rules.QUIET_HOURS_END;
    const isCustomerFacing = ['PAYMENT_LINK', 'REMINDER'].includes(recommendedAction);

    // Count messages sent to customer in last 24h
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentContacts = previousActions.filter(a =>
      ['PAYMENT_LINK', 'REMINDER'].includes(a.action_type) &&
      new Date(a.created_at).getTime() > oneDayAgo
    ).length;

    const contactLimitPassed = !isCustomerFacing || recentContacts < rules.MAX_CUSTOMER_CONTACTS_24H;
    checks.push({
      rule: 'CUSTOMER_CONTACT_LIMITS',
      passed: contactLimitPassed,
      detail: `Contact attempts in 24h: ${recentContacts}/${rules.MAX_CUSTOMER_CONTACTS_24H}`
    });
    if (!contactLimitPassed && decision === 'APPROVED') {
      decision = 'REJECTED';
      escalationReason = `Customer message fatigue prevention: Limit of ${rules.MAX_CUSTOMER_CONTACTS_24H} contacts in 24h reached.`;
    }

    // Quiet hours note
    checks.push({
      rule: 'QUIET_HOURS_GUARD',
      passed: !isQuietHours || !isCustomerFacing,
      detail: isQuietHours && isCustomerFacing
        ? `Currently quiet hours (${rules.QUIET_HOURS_START}:00-${rules.QUIET_HOURS_END}:00). Customer message will queue for morning delivery.`
        : 'Active delivery hours'
    });

    // Check 7: Idempotency & In-Flight Check
    const hasInFlight = previousActions.some(a => ['PENDING', 'IN_FLIGHT', 'DISPATCHED'].includes(a.status));
    checks.push({
      rule: 'IDEMPOTENCY_IN_FLIGHT_CHECK',
      passed: !hasInFlight,
      detail: hasInFlight ? 'Another recovery action is currently in-flight' : 'No conflicting in-flight action'
    });
    if (hasInFlight) {
      decision = 'REJECTED';
      escalationReason = 'Concurrent action already executing for this payment';
    }

    // If explicit action is ESCALATE from AI diagnostic, decision is ESCALATED
    if (recommendedAction === 'ESCALATE') {
      decision = 'ESCALATED';
      escalationReason = escalationReason || 'AI diagnostic recommended human escalation';
    }

    const result = {
      engine: this.name,
      decision, // APPROVED, REJECTED, ESCALATED
      escalationReason,
      checks,
      evaluated_at: new Date().toISOString()
    };

    auditLogStore.logEvent({
      caseId: recoveryCase.id,
      eventType: 'POLICY_DECISION',
      actor: 'PolicySafetyEngine',
      action: 'EVALUATE_POLICY',
      details: {
        decision,
        checksPassed: checks.filter(c => c.passed).length,
        totalChecks: checks.length,
        escalationReason,
        action: recommendedAction
      }
    });

    return result;
  }
}

export const policySafetyEngine = new PolicySafetyEngine();
