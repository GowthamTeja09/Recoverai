import { db } from '../db/database.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { riskEngine } from './riskEngine.js';
import { aiDiagnosticAgent } from './aiDiagnosticAgent.js';
import { policySafetyEngine } from './policySafetyEngine.js';
import { recoveryOrchestrator } from './recoveryOrchestrator.js';
import { outcomeAnalyzer } from '../verification/outcomeAnalyzer.js';
import { eventQueue } from '../ingestion/eventQueue.js';

export async function processPipelineEvent(queueItem) {
  const { eventId, eventType, payload } = queueItem.data;
  const paymentEntity = payload.payload?.payment?.entity || payload.payload?.subscription?.entity || payload;

  // Handle Payment Success / Capture Events (Verification Loop)
  if (['payment.captured', 'order.paid', 'invoice.paid'].includes(eventType)) {
    const result = await outcomeAnalyzer.processPaymentVerification({
      paymentEntity,
      externalRefId: paymentEntity.notes?.external_ref_id || paymentEntity.order_id
    });
    eventQueue.acknowledge(queueItem.streamId);
    return result;
  }

  // Handle Payment Failure Events (Recovery Loop)
  if (['payment.failed', 'subscription.charge.failed', 'invoice.payment_failed'].includes(eventType)) {
    const amount = paymentEntity.amount ? paymentEntity.amount / 100 : 2499;
    const currency = paymentEntity.currency || 'INR';
    const paymentId = paymentEntity.id || `pay_${Date.now()}`;
    const customerId = paymentEntity.customer_id || `cust_${paymentEntity.contact || 'demo_01'}`;
    const merchantId = 'mcht_enterprise_001';

    // Ensure customer exists
    let customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      db.prepare(`
        INSERT INTO customers (id, merchant_id, name, email, phone, ltv, total_orders, failed_payments_count, risk_tier, preferred_channel)
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'MEDIUM', 'WHATSAPP')
      `).run(
        customerId,
        merchantId,
        paymentEntity.customer_name || paymentEntity.notes?.customer_name || 'Customer',
        paymentEntity.email || 'customer@example.com',
        paymentEntity.contact || '+919876543210',
        amount * 2
      );
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    } else {
      db.prepare('UPDATE customers SET failed_payments_count = failed_payments_count + 1 WHERE id = ?').run(customerId);
    }

    // Insert payment record
    const isSubscription = eventType.includes('subscription') || !!paymentEntity.subscription_id;
    try {
      db.prepare(`
        INSERT INTO payments (
          id, merchant_id, customer_id, order_id, subscription_id, amount, currency, status, method,
          error_code, error_description, error_source, error_step, error_reason, attempts, payment_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentId,
        merchantId,
        customerId,
        paymentEntity.order_id || null,
        paymentEntity.subscription_id || null,
        amount,
        currency,
        paymentEntity.method || 'card',
        paymentEntity.error_code || 'GATEWAY_ERROR',
        paymentEntity.error_description || 'Payment failed at bank gateway',
        paymentEntity.error_source || 'issuer',
        paymentEntity.error_step || 'payment_authorization',
        paymentEntity.error_reason || 'payment_failed',
        paymentEntity.attempts || 1,
        isSubscription ? 'SUBSCRIPTION' : 'ONE_TIME'
      );
    } catch (e) {
      // payment may already exist
    }

    // Create Recovery Case
    const caseId = `RC-${Date.now().toString().slice(-6)}`;

    // Log Step 1: Event Received
    // Example format: 14:32:04 | Event Received | type: webhook, id: wh_987, status: Payment Failed
    auditLogStore.logEvent({
      caseId,
      eventType: 'EVENT_RECEIVED',
      actor: 'System',
      action: 'INGEST_FAILURE_EVENT',
      details: {
        type: 'webhook',
        id: eventId,
        status: 'Payment Failed',
        amount,
        currency,
        errorCode: paymentEntity.error_code || 'GATEWAY_ERROR',
        customer: customer.name
      }
    });

    const paymentRecord = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) || {
      id: paymentId,
      amount,
      currency,
      payment_type: isSubscription ? 'SUBSCRIPTION' : 'ONE_TIME',
      error_code: paymentEntity.error_code || 'GATEWAY_ERROR',
      error_source: paymentEntity.error_source || 'issuer',
      attempts: paymentEntity.attempts || 1,
      method: paymentEntity.method || 'card'
    };

    // Step 2: Revenue Risk Engine
    // 14:32:05 | Risk Scored | engine: RevenueRisk, risk: High (0.87)
    const riskAnalysis = riskEngine.analyze(paymentRecord, customer, caseId);

    // Step 3: AI Diagnostic Agent
    // 14:32:06 | Action Recommended | agent: AIDiagnosticAgent, action: RETRY/PAYMENT_LINK, reason: ..., confidence: 0.92
    const diagnosis = await aiDiagnosticAgent.diagnose({
      paymentData: paymentRecord,
      customerData: customer,
      riskAnalysis,
      caseId
    });

    // Save initial Recovery Case to DB
    db.prepare(`
      INSERT INTO recovery_cases (
        id, merchant_id, payment_id, customer_id, amount, currency, status, risk_score, risk_level,
        root_cause, ai_diagnosis, recommended_action, confidence_score, policy_decision
      ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(
      caseId,
      merchantId,
      paymentId,
      customerId,
      amount,
      currency,
      riskAnalysis.riskScore,
      riskAnalysis.riskLevel,
      diagnosis.root_cause,
      JSON.stringify(diagnosis),
      diagnosis.recommended_action,
      diagnosis.confidence
    );

    const initialCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(caseId);

    // Step 4: Policy / Safety Engine (THE GUARDRAIL)
    // 14:32:06 | Policy Decision | engine: PolicySafetyEngine, decision: APPROVED, checks: all passed
    const policyDecision = policySafetyEngine.evaluate({
      recoveryCase: initialCase,
      diagnosis,
      customer,
      previousActions: []
    });

    // Update case with policy decision
    db.prepare(`
      UPDATE recovery_cases
      SET policy_decision = ?, policy_checks = ?
      WHERE id = ?
    `).run(policyDecision.decision, JSON.stringify(policyDecision.checks), caseId);

    const updatedCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(caseId);

    // Step 5: Recovery Orchestration
    // 14:32:07 | Action Initiated | orchestrator: RecoveryOrchestrator, tool: ...
    const orchestrationResult = await recoveryOrchestrator.execute({
      recoveryCase: updatedCase,
      diagnosis,
      policyDecision,
      customer
    });

    const finalCaseState = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(caseId);

    // Section 12 Audit Trail: Record comprehensive 11-field AI decision audit
    auditLogStore.logEvent({
      caseId,
      eventType: 'AI_RECOVERY_DECISION_AUDIT',
      actor: 'AIDiagnosticAgent',
      action: 'RECORD_RECOVERY_DECISION',
      details: {
        transactionId: paymentId,
        timestamp: new Date().toISOString(),
        riskScore: riskAnalysis.riskScore,
        aiRootCause: diagnosis.root_cause,
        aiRecommendedAction: diagnosis.recommended_action,
        aiConfidence: diagnosis.confidence,
        policyDecision: policyDecision.decision,
        finalAction: orchestrationResult?.actionType || diagnosis.recommended_action,
        recoveryResult: finalCaseState?.status || 'IN_PROGRESS',
        recoveredAmount: finalCaseState?.recovered_amount || 0,
        fallbackUsed: diagnosis.fallback_used ?? false
      }
    });

    eventQueue.acknowledge(queueItem.streamId);

    return {
      success: true,
      caseId,
      riskAnalysis,
      diagnosis,
      policyDecision,
      orchestrationResult
    };
  }

  eventQueue.acknowledge(queueItem.streamId);
  return { status: 'IGNORED_EVENT_TYPE', eventType };
}

// Attach listener to EventQueue
eventQueue.on('event:process', async (item) => {
  try {
    await processPipelineEvent(item);
  } catch (err) {
    console.error('Error processing pipeline event:', err);
  }
});
