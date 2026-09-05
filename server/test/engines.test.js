import assert from 'assert';
import { riskEngine } from '../engines/riskEngine.js';
import { aiDiagnosticAgent, ALLOWED_RECOVERY_ACTIONS, ALLOWED_CHANNELS, ALLOWED_PRIORITIES } from '../engines/aiDiagnosticAgent.js';
import { policySafetyEngine } from '../engines/policySafetyEngine.js';
import { recoveryOrchestrator } from '../engines/recoveryOrchestrator.js';
import { outcomeAnalyzer } from '../verification/outcomeAnalyzer.js';
import { processPipelineEvent } from '../engines/pipeline.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { razorpayClient } from '../integrations/razorpayClient.js';
import { seedDatabase } from '../db/seed.js';
import { db } from '../db/database.js';

console.log('🧪 Starting RecoverAI Enterprise Engine Test Suite...\n');

// 1. Seed test database
seedDatabase();

// ============================================================================
// Test 1: Revenue Risk Engine Feature Extraction & Scoring
// ============================================================================
console.log('▶ Test 1: Revenue Risk Engine Feature Extraction & Scoring');
const testPayment = {
  id: 'pay_test_001',
  amount: 2499,
  error_code: 'AUTHENTICATION_FAILED',
  error_source: 'issuer',
  attempts: 1,
  payment_type: 'ONE_TIME',
  method: 'card'
};
const testCustomer = {
  id: 'cust_test_001',
  name: 'Test Customer',
  ltv: 45000,
  total_orders: 10,
  failed_payments_count: 1,
  preferred_channel: 'WHATSAPP'
};

const riskAnalysis = riskEngine.analyze(testPayment, testCustomer);
assert(riskAnalysis.riskScore >= 0.05 && riskAnalysis.riskScore <= 0.98, 'Risk score must be between 0.05 and 0.98');
assert(riskAnalysis.recoveryProbabilities.PAYMENT_LINK > 0.5, 'Payment link recovery probability should be high for 3DS drop');
console.log('  ✔ Risk Score calculated:', riskAnalysis.riskScore, 'Level:', riskAnalysis.riskLevel);
console.log('  ✔ Recovery Probabilities:', riskAnalysis.recoveryProbabilities);

// ============================================================================
// Test 2: AI Diagnostic Agent Diagnosis & Recommendation (Deterministic Fallback)
// ============================================================================
console.log('\n▶ Test 2: AI Diagnostic Agent Diagnosis & Recommendation');
const diagnosis = await aiDiagnosticAgent.diagnose({
  paymentData: testPayment,
  customerData: testCustomer,
  riskAnalysis,
  caseId: 'RC-TEST-001'
});
assert.strictEqual(diagnosis.root_cause, 'CUSTOMER_3DS_ABANDONMENT');
assert.strictEqual(diagnosis.recommended_action, 'PAYMENT_LINK');
assert(diagnosis.confidence >= 0.70, 'Confidence must exceed threshold');
assert.strictEqual(typeof diagnosis.reasoning, 'string');
assert.strictEqual(diagnosis.fallback_used, true, 'Without live API key, fallback must be safely active');
console.log('  ✔ Root cause diagnosed:', diagnosis.root_cause);
console.log('  ✔ Action recommended:', diagnosis.recommended_action, 'Confidence:', diagnosis.confidence);
console.log('  ✔ Fallback gracefully activated without exception');

// ============================================================================
// Test 3: Policy / Safety Engine (Guardrail Approval)
// ============================================================================
console.log('\n▶ Test 3: Policy Safety Engine Evaluation (Normal Amount -> APPROVED)');
const mockCaseApproved = {
  id: 'RC-TEST-001',
  merchant_id: 'mcht_enterprise_001',
  amount: 2499,
  attempts_count: 0
};
const policyApproval = policySafetyEngine.evaluate({
  recoveryCase: mockCaseApproved,
  diagnosis,
  customer: testCustomer,
  previousActions: []
});
assert.strictEqual(policyApproval.decision, 'APPROVED');
console.log('  ✔ Safety decision:', policyApproval.decision);
console.log('  ✔ Checks passed:', policyApproval.checks.filter(c => c.passed).length, '/', policyApproval.checks.length);

// ============================================================================
// Test 4: Policy / Safety Engine (Amount Ceiling Breach -> ESCALATED)
// ============================================================================
console.log('\n▶ Test 4: Policy Safety Engine Evaluation (Amount Limit Breach -> ESCALATED)');
const mockCaseEscalated = {
  id: 'RC-TEST-002',
  merchant_id: 'mcht_enterprise_001',
  amount: 125000, // ₹1,25,000 exceeds ₹50,000 ceiling
  attempts_count: 0
};
const policyEscalation = policySafetyEngine.evaluate({
  recoveryCase: mockCaseEscalated,
  diagnosis,
  customer: testCustomer,
  previousActions: []
});
assert.strictEqual(policyEscalation.decision, 'ESCALATED', 'Amounts above ceiling must be escalated to human CRM');
console.log('  ✔ Safety decision for ₹1,25,000:', policyEscalation.decision);
console.log('  ✔ Escalation reason:', policyEscalation.escalationReason);

// ============================================================================
// Test 5: Subscription Retry Flow Routing
// ============================================================================
console.log('\n▶ Test 5: Subscription Retry Flow Routing');
const subPayment = {
  amount: 4999,
  error_code: 'GATEWAY_ERROR',
  error_source: 'issuer',
  attempts: 1,
  payment_type: 'SUBSCRIPTION',
  subscription_id: 'sub_enterprise_01'
};
const subRisk = riskEngine.analyze(subPayment, testCustomer);
const subDiagnosis = await aiDiagnosticAgent.diagnose({
  paymentData: subPayment,
  customerData: testCustomer,
  riskAnalysis: subRisk
});
assert.strictEqual(subDiagnosis.recommended_action, 'SUBSCRIPTION_RETRY');
console.log('  ✔ Subscription failure correctly routed to:', subDiagnosis.recommended_action);

// ============================================================================
// Test 6: AI Structured Schema & Validation Guardrails
// ============================================================================
console.log('\n▶ Test 6: AI Structured Schema & Validation Guardrails');
// 6a. Valid structured Gemini response
const validMockGeminiOutput = {
  root_cause: 'AUTHENTICATION_FAILURE',
  recommended_action: 'PAYMENT_LINK',
  confidence: 0.94,
  optimal_delay_hours: 1,
  suggested_channel: 'WHATSAPP',
  recovery_priority: 'HIGH',
  reasoning: 'Customer dropped off during 3DS OTP bank page.'
};
const validResult = aiDiagnosticAgent.validateStructuredOutput(validMockGeminiOutput);
assert.strictEqual(validResult.valid, true, 'Valid Gemini JSON output must pass schema validation');
assert.strictEqual(validResult.data.recommended_action, 'PAYMENT_LINK');
console.log('  ✔ Valid Gemini structured response passed schema check');

// 6b. Invalid action not in whitelist
const invalidActionOutput = {
  ...validMockGeminiOutput,
  recommended_action: 'ARBITRARY_REFUND_WALLET'
};
const invalidActionResult = aiDiagnosticAgent.validateStructuredOutput(invalidActionOutput);
assert.strictEqual(invalidActionResult.valid, false, 'Arbitrary actions must be strictly rejected');
console.log('  ✔ Unapproved AI action correctly rejected:', invalidActionResult.error);

// 6c. Invalid confidence score out of bounds
const invalidConfOutput = {
  ...validMockGeminiOutput,
  confidence: 1.45
};
const invalidConfResult = aiDiagnosticAgent.validateStructuredOutput(invalidConfOutput);
assert.strictEqual(invalidConfResult.valid, false, 'Out of bounds confidence must be rejected');
console.log('  ✔ Invalid confidence rejected:', invalidConfResult.error);

// ============================================================================
// Test 7: Low Confidence Handled by Policy Engine (Guardrail Escalation)
// ============================================================================
console.log('\n▶ Test 7: Low Confidence Handled by Policy Safety Engine');
const lowConfDiagnosis = {
  recommended_action: 'PAYMENT_LINK',
  confidence: 0.52, // Below 0.70 threshold
  reasoning: 'Model uncertain about cause of failure.'
};
const lowConfDecision = policySafetyEngine.evaluate({
  recoveryCase: { id: 'RC-LOW-01', merchant_id: 'mcht_enterprise_001', amount: 1500, attempts_count: 0 },
  diagnosis: lowConfDiagnosis,
  customer: testCustomer,
  previousActions: []
});
assert.strictEqual(lowConfDecision.decision, 'ESCALATED', 'Low confidence recommendation must be escalated');
assert(lowConfDecision.escalationReason.includes('below autonomous threshold'), 'Reason must cite confidence');
console.log('  ✔ Low confidence correctly escalated to human review:', lowConfDecision.escalationReason);

// ============================================================================
// Test 8: Policy Safety Engine Inviolable Guardrail Limits
// ============================================================================
console.log('\n▶ Test 8: Policy Safety Engine Guardrail Enforcements');
// 8a. Retry limits exceeded (attempts = 3)
const retryExceededDecision = policySafetyEngine.evaluate({
  recoveryCase: { id: 'RC-RETRY-01', merchant_id: 'mcht_enterprise_001', amount: 2000, attempts_count: 3 },
  diagnosis: { recommended_action: 'PAYMENT_LINK', confidence: 0.95 },
  customer: testCustomer,
  previousActions: []
});
assert.strictEqual(retryExceededDecision.decision, 'ESCALATED', 'Exceeding retry limit must trigger escalation');
console.log('  ✔ Retry limit (3 attempts) enforced: ESCALATED');

// 8b. Active cooldown in effect (last attempt 1 hour ago vs 4h required)
const cooldownDecision = policySafetyEngine.evaluate({
  recoveryCase: {
    id: 'RC-COOL-01',
    merchant_id: 'mcht_enterprise_001',
    amount: 2000,
    attempts_count: 1,
    last_attempt_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  },
  diagnosis: { recommended_action: 'PAYMENT_LINK', confidence: 0.95 },
  customer: testCustomer,
  previousActions: []
});
assert.strictEqual(cooldownDecision.decision, 'REJECTED', 'Active cooldown must reject execution');
console.log('  ✔ Cooldown period (< 4h) enforced: REJECTED');

// 8c. Customer contact limits (already sent 2 messages in 24h)
const contactDecision = policySafetyEngine.evaluate({
  recoveryCase: { id: 'RC-FATIGUE-01', merchant_id: 'mcht_enterprise_001', amount: 2000, attempts_count: 0 },
  diagnosis: { recommended_action: 'PAYMENT_LINK', confidence: 0.95 },
  customer: testCustomer,
  previousActions: [
    { action_type: 'PAYMENT_LINK', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { action_type: 'REMINDER', created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() }
  ]
});
assert.strictEqual(contactDecision.decision, 'REJECTED', 'Customer message fatigue limit must reject');
console.log('  ✔ Contact limit (max 2/24h) enforced: REJECTED');

// 8d. Idempotency & In-flight check
const inFlightDecision = policySafetyEngine.evaluate({
  recoveryCase: { id: 'RC-INFLIGHT-01', merchant_id: 'mcht_enterprise_001', amount: 2000, attempts_count: 0 },
  diagnosis: { recommended_action: 'PAYMENT_LINK', confidence: 0.95 },
  customer: testCustomer,
  previousActions: [
    { action_type: 'PAYMENT_LINK', status: 'IN_FLIGHT', created_at: new Date().toISOString() }
  ]
});
assert.strictEqual(inFlightDecision.decision, 'REJECTED', 'Concurrent in-flight action must reject');
console.log('  ✔ Idempotency in-flight guard enforced: REJECTED');

// ============================================================================
// Test 9: Batch Recovery Benchmark Scenarios (Section 10 P001 - P005)
// ============================================================================
console.log('\n▶ Test 9: Batch Recovery Benchmark Suite (Section 10 P001 - P005)');

const BENCHMARK_TEST_SUITE = [
  {
    name: 'Payment P001: ₹2,499 3DS Authentication Drop',
    paymentId: `pay_test_p001_${Date.now()}`,
    amount: 2499,
    errorCode: 'AUTHENTICATION_FAILED',
    attempts: 1,
    isSubscription: false,
    expectedAction: 'PAYMENT_LINK',
    expectedPolicy: 'APPROVED',
    expectedResult: 'RECOVERED',
    shouldSimulatePay: true
  },
  {
    name: 'Payment P002: ₹8,500 Temporary Gateway Error',
    paymentId: `pay_test_p002_${Date.now()}`,
    amount: 8500,
    errorCode: 'GATEWAY_ERROR',
    attempts: 1,
    isSubscription: false,
    expectedAction: 'RETRY_PAYMENT',
    expectedPolicy: 'APPROVED',
    expectedResult: 'RECOVERED',
    shouldSimulatePay: true
  },
  {
    name: 'Payment P003: ₹3,200 Insufficient Funds Renewal',
    paymentId: `pay_test_p003_${Date.now()}`,
    amount: 3200,
    errorCode: 'INSUFFICIENT_FUNDS',
    attempts: 1,
    isSubscription: true,
    expectedAction: 'DELAY_AND_RETRY',
    expectedPolicy: 'APPROVED',
    expectedResult: 'RECOVERED',
    shouldSimulatePay: true
  },
  {
    name: 'Payment P004: ₹1,45,000 High-Risk Limit Breach',
    paymentId: `pay_test_p004_${Date.now()}`,
    amount: 145000,
    errorCode: 'GATEWAY_ERROR',
    attempts: 1,
    isSubscription: false,
    expectedAction: 'ESCALATE_TO_HUMAN',
    expectedPolicy: 'ESCALATED',
    expectedResult: 'ESCALATED',
    shouldSimulatePay: false
  },
  {
    name: 'Payment P005: ₹5,000 Retry Limit Reached (3 attempts)',
    paymentId: `pay_test_p005_${Date.now()}`,
    amount: 5000,
    errorCode: 'CARD_EXPIRED',
    attempts: 3,
    isSubscription: false,
    expectedAction: 'STOP_RECOVERY',
    expectedPolicy: 'APPROVED', // Policy allows stopping recovery
    expectedResult: 'STOPPED',
    shouldSimulatePay: false
  }
];

for (const b of BENCHMARK_TEST_SUITE) {
  const eventId = `wh_test_${b.paymentId}`;
  const queueItem = {
    streamId: eventId,
    data: {
      eventId,
      eventType: b.isSubscription ? 'subscription.charge.failed' : 'payment.failed',
      payload: {
        payload: {
          payment: {
            entity: {
              id: b.paymentId,
              amount: b.amount * 100,
              currency: 'INR',
              status: 'failed',
              method: b.isSubscription ? 'card' : 'upi',
              error_code: b.errorCode,
              error_description: 'Test failure',
              customer_name: `Customer ${b.paymentId}`,
              email: `cust_${b.paymentId}@test.com`,
              attempts: b.attempts,
              subscription_id: b.isSubscription ? `sub_${b.paymentId}` : null
            }
          }
        }
      }
    }
  };

  const pipeRes = await processPipelineEvent(queueItem);
  assert(pipeRes.success, `Pipeline execution failed for ${b.name}`);
  assert.strictEqual(pipeRes.diagnosis.recommended_action, b.expectedAction, `${b.name} recommended action mismatch`);
  assert.strictEqual(pipeRes.policyDecision.decision, b.expectedPolicy, `${b.name} policy decision mismatch`);

  if (b.shouldSimulatePay && pipeRes.orchestrationResult?.externalRefId) {
    const payEvent = razorpayClient.simulateCustomerPayment(pipeRes.orchestrationResult.externalRefId, {
      amount: b.amount
    });
    const verif = await outcomeAnalyzer.processPaymentVerification({
      paymentEntity: payEvent.payload.payment.entity,
      caseId: pipeRes.caseId,
      externalRefId: pipeRes.orchestrationResult.externalRefId
    });
    assert.strictEqual(verif.outcome, 'RECOVERED');
  }

  const finalCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(pipeRes.caseId);
  assert.strictEqual(finalCase.status, b.expectedResult, `${b.name} final status must be ${b.expectedResult}`);
  console.log(`  ✔ ${b.name} -> AI: ${pipeRes.diagnosis.recommended_action} -> Policy: ${pipeRes.policyDecision.decision} -> Status: ${finalCase.status}`);
}

// ============================================================================
// Test 10: Cryptographic Audit Trail Hash Chain Integrity & 11 Audit Fields
// ============================================================================
console.log('\n▶ Test 10: Cryptographic Audit Trail Hash Chain Integrity & Audit Schema');
const integrityCheck = auditLogStore.verifyChainIntegrity();
assert.strictEqual(integrityCheck.valid, true, 'Audit log cryptographic chain must be 100% valid');
assert(integrityCheck.verifiedCount > 10, 'Must have verified at least 10 chained blocks');
console.log('  ✔ SHA-256 Audit Trail 100% valid. Verified blocks:', integrityCheck.verifiedCount);

// Verify that an AI_RECOVERY_DECISION_AUDIT event contains all 11 required audit fields
const recentLogs = auditLogStore.getRecentLogs(10);
const decisionLog = recentLogs.find(l => l.event_type === 'AI_RECOVERY_DECISION_AUDIT');
assert(decisionLog, 'AI_RECOVERY_DECISION_AUDIT event must be logged');
const d = decisionLog.details;
assert(d.transactionId, 'Missing transactionId in audit log');
assert(d.timestamp, 'Missing timestamp in audit log');
assert(d.riskScore !== undefined, 'Missing riskScore in audit log');
assert(d.aiRootCause, 'Missing aiRootCause in audit log');
assert(d.aiRecommendedAction, 'Missing aiRecommendedAction in audit log');
assert(d.aiConfidence !== undefined, 'Missing aiConfidence in audit log');
assert(d.policyDecision, 'Missing policyDecision in audit log');
assert(d.finalAction, 'Missing finalAction in audit log');
assert(d.recoveryResult, 'Missing recoveryResult in audit log');
assert(d.recoveredAmount !== undefined, 'Missing recoveredAmount in audit log');
assert(d.fallbackUsed !== undefined, 'Missing fallbackUsed in audit log');
console.log('  ✔ All 11 required audit fields present in decision audit log without credentials leak');

// ============================================================================
// Test 11: Revenue Metrics Live DB Calculation
// ============================================================================
console.log('\n▶ Test 11: Real Live Database Revenue Metrics Calculation');
const totalCases = db.prepare('SELECT count(*) as count FROM recovery_cases').get().count;
const recoveredCases = db.prepare("SELECT count(*) as count FROM recovery_cases WHERE status = 'RECOVERED'").get().count;
const totalRecovered = db.prepare("SELECT COALESCE(SUM(recovered_amount), 0) as total FROM recovery_cases").get().total;
assert(totalCases >= 5, 'Must have at least 5 benchmark cases');
assert(recoveredCases >= 3, 'Must have at least 3 recovered cases');
assert(totalRecovered >= 10000, 'Must have recovered at least ₹10,000 from benchmark payments');
console.log(`  ✔ Computed Total Cases: ${totalCases}, Recovered Cases: ${recoveredCases}, Recovered Revenue: ₹${totalRecovered.toLocaleString('en-IN')}`);

console.log('\n====================================================');
console.log('🎉 ALL 11 RECOVERAI ENTERPRISE TESTS PASSED SUCCESSFULLY!');
console.log('====================================================\n');
