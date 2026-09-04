import assert from 'assert';
import { riskEngine } from '../engines/riskEngine.js';
import { aiDiagnosticAgent } from '../engines/aiDiagnosticAgent.js';
import { policySafetyEngine } from '../engines/policySafetyEngine.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { razorpayClient } from '../integrations/razorpayClient.js';
import { seedDatabase } from '../db/seed.js';

console.log('🧪 Starting RecoverAI Enterprise Engine Test Suite...\n');

// 1. Seed test database
seedDatabase();

// Test 1: Revenue Risk Engine
console.log('▶ Test 1: Revenue Risk Engine Feature Extraction & Scoring');
const testPayment = {
  amount: 2499,
  error_code: 'AUTHENTICATION_FAILED',
  error_source: 'issuer',
  attempts: 1,
  payment_type: 'ONE_TIME',
  method: 'card'
};
const testCustomer = {
  ltv: 45000,
  total_orders: 10,
  failed_payments_count: 1
};

const riskAnalysis = riskEngine.analyze(testPayment, testCustomer);
assert(riskAnalysis.riskScore >= 0.05 && riskAnalysis.riskScore <= 0.98, 'Risk score must be between 0.05 and 0.98');
assert(riskAnalysis.recoveryProbabilities.PAYMENT_LINK > 0.5, 'Payment link recovery probability should be high for 3DS drop');
console.log('  ✔ Risk Score calculated:', riskAnalysis.riskScore, 'Level:', riskAnalysis.riskLevel);
console.log('  ✔ Recovery Probabilities:', riskAnalysis.recoveryProbabilities);

// Test 2: AI Diagnostic Agent
console.log('\n▶ Test 2: AI Diagnostic Agent Diagnosis & Recommendation');
const diagnosis = await aiDiagnosticAgent.diagnose({
  paymentData: testPayment,
  customerData: testCustomer,
  riskAnalysis
});
assert.strictEqual(diagnosis.root_cause, 'CUSTOMER_3DS_ABANDONMENT');
assert.strictEqual(diagnosis.recommended_action, 'PAYMENT_LINK');
assert(diagnosis.confidence >= 0.70, 'Confidence must exceed threshold');
console.log('  ✔ Root cause diagnosed:', diagnosis.root_cause);
console.log('  ✔ Action recommended:', diagnosis.recommended_action, 'Confidence:', diagnosis.confidence);

// Test 3: Policy / Safety Engine (Guardrail Approval)
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

// Test 4: Policy / Safety Engine (Amount Ceiling Breach -> ESCALATED)
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

// Test 5: Razorpay Recovery Strategy Routing (Subscription Failure)
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

// Test 6: Audit Log Store Cryptographic Chain Integrity
console.log('\n▶ Test 6: Cryptographic Audit Trail Hash Chain Integrity');
const integrityCheck = auditLogStore.verifyChainIntegrity();
assert.strictEqual(integrityCheck.valid, true, 'Audit log cryptographic chain must be 100% valid');
console.log('  ✔ SHA-256 Audit Trail valid. Verified blocks:', integrityCheck.verifiedCount);

console.log('\n====================================================');
console.log('🎉 ALL RECOVERAI ENGINE TESTS PASSED SUCCESSFULLY!');
console.log('====================================================\n');
