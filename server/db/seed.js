import { db, initSchema } from './database.js';
import { auditLogStore } from '../security/auditLogStore.js';

export function seedDatabase() {
  initSchema();

  // Check if already seeded
  const merchantCount = db.prepare('SELECT count(*) as count FROM merchants').get();
  if (merchantCount && merchantCount.count > 0) {
    return;
  }

  // 1. Seed Merchant
  db.prepare(`
    INSERT INTO merchants (id, name, email, currency, plan_tier)
    VALUES ('mcht_enterprise_001', 'CloudScale Technologies Pvt Ltd', 'finance@cloudscale.io', 'INR', 'ENTERPRISE')
  `).run();

  // 2. Seed Policy Rules
  const insertRule = db.prepare(`
    INSERT INTO policy_rules (id, merchant_id, rule_name, rule_key, rule_value, description, is_enabled)
    VALUES (?, 'mcht_enterprise_001', ?, ?, ?, ?, 1)
  `);

  insertRule.run('rule_amt_01', 'Max Auto Recovery Amount', 'MAX_AUTO_RECOVERY_AMOUNT', '50000', 'Maximum transaction amount eligible for autonomous recovery without manual agent review');
  insertRule.run('rule_retry_02', 'Maximum Retry Attempts', 'MAX_RETRY_ATTEMPTS', '3', 'Ceiling on automatic retry attempts per case');
  insertRule.run('rule_cool_03', 'Minimum Cooldown Window', 'MIN_COOLDOWN_HOURS', '4', 'Required waiting hours between automated retry attempts');
  insertRule.run('rule_conf_04', 'Minimum AI Confidence Threshold', 'MIN_CONFIDENCE_THRESHOLD', '0.70', 'Minimum AI Diagnostic confidence level required for autonomous dispatch');
  insertRule.run('rule_contact_05', 'Max Customer Contacts in 24h', 'MAX_CUSTOMER_CONTACTS_24H', '2', 'Limits outbound customer communications per 24 hour rolling window');
  insertRule.run('rule_quiet_06', 'Quiet Hours Window', 'QUIET_HOURS_START', '22', 'Start of quiet hours (10:00 PM IST)');

  // 3. Seed Customers
  const insertCust = db.prepare(`
    INSERT INTO customers (id, merchant_id, name, email, phone, ltv, total_orders, failed_payments_count, risk_tier, preferred_channel)
    VALUES (?, 'mcht_enterprise_001', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertCust.run('cust_priya_01', 'Priya Sharma', 'priya.sharma@example.com', '+919820123456', 84500, 18, 1, 'LOW', 'WHATSAPP');
  insertCust.run('cust_rahul_02', 'Rahul Verma', 'rahul.verma@example.com', '+919811987654', 128000, 24, 0, 'LOW', 'WHATSAPP');
  insertCust.run('cust_ananya_03', 'Ananya Iyer', 'ananya.iyer@example.com', '+919845332211', 42000, 8, 2, 'MEDIUM', 'EMAIL');
  insertCust.run('cust_vikram_04', 'Vikramaditya Rao', 'vikram.rao@enterprise-client.com', '+919988776655', 380000, 36, 1, 'HIGH', 'EMAIL');
  insertCust.run('cust_karthik_05', 'Karthik Subramanian', 'karthik.s@techcorp.in', '+919711223344', 18500, 4, 3, 'CRITICAL', 'SMS');

  // 4. Seed Seeded Cases for instant realistic analytics
  const insertCase = db.prepare(`
    INSERT INTO recovery_cases (
      id, merchant_id, payment_id, customer_id, amount, currency, status, risk_score, risk_level,
      root_cause, ai_diagnosis, recommended_action, confidence_score, policy_decision, policy_checks,
      recovered_amount, recovery_method, attempts_count, last_attempt_at, recovered_at, created_at
    ) VALUES (?, 'mcht_enterprise_001', ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAction = db.prepare(`
    INSERT INTO recovery_actions (
      id, case_id, action_type, channel, status, external_ref_id, payload, response_data, policy_checks_passed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  // Case 1: Successfully Recovered via Payment Link (3DS Auth Drop)
  insertCase.run(
    'RC-804121',
    'pay_demo_recov_01',
    'cust_priya_01',
    2499,
    'RECOVERED',
    0.32,
    'LOW',
    'CUSTOMER_3DS_ABANDONMENT',
    JSON.stringify({
      agent: 'AIDiagnosticAgent_v3.2',
      root_cause: 'CUSTOMER_3DS_ABANDONMENT',
      reasoning: 'Customer dropped off during OTP submission. High intent customer with 18 past successful orders.',
      recommended_action: 'PAYMENT_LINK',
      confidence: 0.94,
      suggested_channel: 'WHATSAPP'
    }),
    'PAYMENT_LINK',
    0.94,
    'APPROVED',
    JSON.stringify([{ rule: 'MAX_AMOUNT_LIMIT', passed: true }, { rule: 'CONFIDENCE_THRESHOLD', passed: true }]),
    2499,
    'upi',
    1,
    '2026-09-04 14:32:07',
    '2026-09-04 14:32:09',
    '2026-09-04 14:32:04'
  );

  insertAction.run(
    'act_demo_01',
    'RC-804121',
    'PAYMENT_LINK',
    'WHATSAPP',
    'VERIFIED_PAID',
    'plink_804121_sharma',
    '{"amount":2499}',
    '{"status":"paid"}',
    '2026-09-04 14:32:07'
  );

  // Seed exact requested audit log chain for Case 1
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'EVENT_RECEIVED',
    actor: 'System',
    action: 'INGEST_FAILURE_EVENT',
    details: { type: 'webhook', id: 'wh_987', status: 'Payment Failed', amount: 2499 },
    timestamp: '2026-09-04T14:32:04.000Z'
  });
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'RISK_SCORED',
    actor: 'RevenueRisk',
    action: 'EVALUATE_RISK',
    details: { engine: 'RevenueRisk', risk: 'Low (0.32)', amount: 2499 },
    timestamp: '2026-09-04T14:32:05.000Z'
  });
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'ACTION_RECOMMENDED',
    actor: 'AIDiagnosticAgent',
    action: 'RECOMMEND_ACTION',
    details: { agent: 'AIDiagnosticAgent', action: 'PAYMENT_LINK', reason: 'Customer 3DS verification dropped', confidence: 0.94 },
    timestamp: '2026-09-04T14:32:06.000Z'
  });
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'POLICY_DECISION',
    actor: 'PolicySafetyEngine',
    action: 'EVALUATE_POLICY',
    details: { engine: 'PolicySafetyEngine', decision: 'APPROVED', checks: 'all passed' },
    timestamp: '2026-09-04T14:32:06.500Z'
  });
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'ACTION_INITIATED',
    actor: 'RecoveryOrchestrator',
    action: 'DISPATCH_RECOVERY_TOOL',
    details: { orchestrator: 'RecoveryOrchestrator', tool: 'Razorpay Payment Links API', externalRef: 'plink_804121_sharma' },
    timestamp: '2026-09-04T14:32:07.000Z'
  });
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'OUTCOME_VERIFIED',
    actor: 'VerificationEngine',
    action: 'VERIFY_PAYMENT',
    details: { engine: 'VerificationEngine', status: 'Payment Successful', gatewayId: 'pay_98721_rec' },
    timestamp: '2026-09-04T14:32:09.000Z'
  });
  auditLogStore.logEvent({
    caseId: 'RC-804121',
    eventType: 'REVENUE_RECOVERED',
    actor: 'OutcomeAnalyzer',
    action: 'RECORD_RECOVERY',
    details: { status: 'COMPLETE', amount: 2499, currency: 'INR' },
    timestamp: '2026-09-04T14:32:09.500Z'
  });

  // Case 2: Subscription Retry Scheduled & Active (Transient Gateway Error)
  insertCase.run(
    'RC-804122',
    'pay_demo_sub_02',
    'cust_rahul_02',
    14999,
    'IN_PROGRESS',
    0.48,
    'MEDIUM',
    'TRANSIENT_ISSUER_OUTAGE',
    JSON.stringify({
      agent: 'AIDiagnosticAgent_v3.2',
      root_cause: 'TRANSIENT_ISSUER_OUTAGE',
      reasoning: 'HDFC Bank network switch timed out during recurring debit. High LTV enterprise subscriber.',
      recommended_action: 'SUBSCRIPTION_RETRY',
      confidence: 0.93,
      suggested_channel: 'RAZORPAY_API'
    }),
    'SUBSCRIPTION_RETRY',
    0.93,
    'APPROVED',
    JSON.stringify([{ rule: 'MAX_AMOUNT_LIMIT', passed: true }, { rule: 'RETRY_LIMITS', passed: true }]),
    0,
    null,
    1,
    '2026-09-04 11:15:20',
    null,
    '2026-09-04 11:15:00'
  );

  insertAction.run(
    'act_demo_02',
    'RC-804122',
    'SUBSCRIPTION_RETRY',
    'RAZORPAY_API',
    'DISPATCHED',
    'sub_retry_804122',
    '{"delayHours":4}',
    '{"status":"SCHEDULED","next_retry_at":"2026-09-04T15:15:20Z"}',
    '2026-09-04 11:15:20'
  );

  // Case 3: Escalated to CRM (Amount Limit Guardrail Breach: ₹1,45,000)
  insertCase.run(
    'RC-804123',
    'pay_demo_esc_03',
    'cust_vikram_04',
    145000,
    'ESCALATED',
    0.88,
    'CRITICAL',
    'HIGH_VALUE_REPEATED_DECLINE',
    JSON.stringify({
      agent: 'AIDiagnosticAgent_v3.2',
      root_cause: 'HIGH_VALUE_REPEATED_DECLINE',
      reasoning: 'Ticket size ₹1,45,000 exceeds safety guardrail limit (₹50,000). Automated recovery halted.',
      recommended_action: 'ESCALATE',
      confidence: 0.96,
      suggested_channel: 'CRM_TICKET'
    }),
    'ESCALATE',
    0.96,
    'ESCALATED',
    JSON.stringify([
      { rule: 'MAX_AMOUNT_LIMIT', passed: false, detail: 'Amount ₹1,45,000 exceeds ₹50,000 threshold' },
      { rule: 'CONFIDENCE_THRESHOLD', passed: true }
    ]),
    0,
    null,
    1,
    '2026-09-04 09:40:10',
    null,
    '2026-09-04 09:40:00'
  );

  insertAction.run(
    'act_demo_03',
    'RC-804123',
    'ESCALATE',
    'CRM_TICKET',
    'DISPATCHED',
    'TICKET-924185',
    '{"priority":"URGENT"}',
    '{"ticket_id":"TICKET-924185","status":"OPEN"}',
    '2026-09-04 09:40:10'
  );

  // Case 4: Recovered Order Checkout Flow (Acquirer Transient Failure)
  insertCase.run(
    'RC-804124',
    'pay_demo_ord_04',
    'cust_ananya_03',
    8500,
    'RECOVERED',
    0.41,
    'MEDIUM',
    'ACQUIRER_TRANSIENT_FAILURE',
    JSON.stringify({
      agent: 'AIDiagnosticAgent_v3.2',
      root_cause: 'ACQUIRER_TRANSIENT_FAILURE',
      reasoning: 'Card network dropped. Prompted UPI recovery checkout.',
      recommended_action: 'RECOVERY_ORDER',
      confidence: 0.89,
      suggested_channel: 'WHATSAPP'
    }),
    'RECOVERY_ORDER',
    0.89,
    'APPROVED',
    JSON.stringify([{ rule: 'MAX_AMOUNT_LIMIT', passed: true }]),
    8500,
    'upi',
    1,
    '2026-09-04 08:20:15',
    '2026-09-04 08:24:45',
    '2026-09-04 08:20:00'
  );

  console.log('Database seeded successfully with enterprise demo cases.');
}
