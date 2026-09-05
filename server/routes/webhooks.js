import express from 'express';
import { processIncomingWebhook } from '../ingestion/webhookReceiver.js';
import { razorpayClient } from '../integrations/razorpayClient.js';
import { outcomeAnalyzer } from '../verification/outcomeAnalyzer.js';
import { eventQueue } from '../ingestion/eventQueue.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';
import { webhookRateLimiter, simulatorRateLimiter } from '../security/rateLimiter.js';
import { processPipelineEvent } from '../engines/pipeline.js';
import { db } from '../db/database.js';

const router = express.Router();

// Real Razorpay Webhook Ingestion endpoint
router.post('/razorpay', webhookRateLimiter, async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const rawBody = req.rawBody;

    // Production requires the exact raw request bytes
    if (isProduction && (!rawBody || !Buffer.isBuffer(rawBody))) {
      return res.status(400).json({ error: 'Missing or invalid raw request body for Razorpay webhook verification' });
    }

    const headers = req.headers;
    const payload = req.body;

    const result = await processIncomingWebhook({ rawBody: rawBody || req.body, headers, payload });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Interactive Webhook Simulator endpoint for Live Testing & Demos
router.post('/simulate', simulatorRateLimiter, authenticateToken, requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ error: 'Webhook simulator is disabled in production' });
    }

    const {
      scenario = '3DS_DROP',
      amount = 2499,
      customerName = 'Test User',
      customerEmail = 'test.user@example.com',
      customerPhone = '+919876543210',
      isSubscription = false,
      errorCode = 'AUTHENTICATION_FAILED',
      attempts = 1
    } = req.body;

    const eventId = `wh_sim_${Date.now()}`;
    const paymentId = `pay_sim_${Date.now()}`;
    const orderId = `order_sim_${Date.now()}`;
    const subscriptionId = isSubscription ? `sub_sim_${Date.now()}` : null;

    let computedErrorCode = errorCode;
    let computedErrorDesc = 'Payment authentication was dropped';

    if (scenario === '3DS_DROP' || scenario === 'P001_3DS_AUTH') {
      computedErrorCode = 'AUTHENTICATION_FAILED';
      computedErrorDesc = 'Customer dropped off at OTP bank page';
    } else if (scenario === 'GATEWAY_ERROR' || scenario === 'P002_GATEWAY_ERR') {
      computedErrorCode = 'GATEWAY_ERROR';
      computedErrorDesc = 'Bank core gateway timed out';
    } else if (scenario === 'INSUFFICIENT_FUNDS' || scenario === 'P003_INSUFFICIENT') {
      computedErrorCode = 'INSUFFICIENT_FUNDS';
      computedErrorDesc = 'Debit rejected due to insufficient account balance';
    } else if (scenario === 'HIGH_TICKET_BREACH' || scenario === 'P004_HIGH_RISK') {
      computedErrorCode = 'GATEWAY_ERROR';
      computedErrorDesc = 'High-ticket enterprise invoice payment declined';
    } else if (scenario === 'P005_RETRY_LIMIT') {
      computedErrorCode = 'CARD_EXPIRED';
      computedErrorDesc = 'Retry limit reached (3 previous failed attempts)';
    }

    const payload = {
      event_id: eventId,
      event: isSubscription ? 'subscription.charge.failed' : 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            subscription_id: subscriptionId,
            amount: Math.round(amount * 100),
            currency: 'INR',
            status: 'failed',
            method: isSubscription ? 'card' : 'upi',
            error_code: computedErrorCode,
            error_description: computedErrorDesc,
            error_source: 'issuer',
            error_step: 'payment_authorization',
            error_reason: 'payment_failed',
            customer_name: customerName,
            email: customerEmail,
            contact: customerPhone,
            attempts: parseInt(attempts, 10) || 1
          }
        }
      }
    };

    const rawBodyBuffer = Buffer.from(JSON.stringify(payload), 'utf8');

    const result = await processIncomingWebhook({
      rawBody: rawBodyBuffer,
      headers: { 'x-razorpay-signature': 'demo_verified_signature_recoverai' },
      payload,
      isSimulated: true
    });

    res.status(200).json({
      success: true,
      message: 'Simulated webhook ingested into event queue',
      scenario,
      eventId,
      paymentId,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate customer paying the Payment Link or Recovery Order
router.post('/simulate-pay', simulatorRateLimiter, authenticateToken, requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ error: 'Payment simulation is disabled in production' });
    }

    const { caseId, externalRefId, amount } = req.body;

    const paymentEvent = razorpayClient.simulateCustomerPayment(externalRefId, { amount });

    const result = await outcomeAnalyzer.processPaymentVerification({
      paymentEntity: paymentEvent.payload.payment.entity,
      caseId,
      externalRefId
    });

    res.status(200).json({
      success: true,
      message: 'Customer payment simulated and verified',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dedicated Batch Recovery Benchmark Endpoint (5 Scenarios from Section 10)
// Protected: requires authentication and is disabled in strict production mode
router.post('/demo-batch', simulatorRateLimiter, authenticateToken, requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      return res.status(403).json({ error: 'Batch benchmark demo is disabled in production' });
    }

    const BENCHMARK_CASES = [
      {
        paymentId: `pay_P001_${Date.now()}`,
        amount: 2499,
        errorCode: 'AUTHENTICATION_FAILED',
        errorDesc: 'Customer dropped during 3DS authentication',
        isSubscription: false,
        attempts: 1,
        customerName: 'Priya Sharma (P001)',
        customerEmail: 'priya.p001@example.com',
        customerPhone: '+919820011001',
        shouldVerifyPayment: true
      },
      {
        paymentId: `pay_P002_${Date.now()}`,
        amount: 8500,
        errorCode: 'GATEWAY_ERROR',
        errorDesc: 'Temporary acquirer bank gateway error',
        isSubscription: false,
        attempts: 1,
        customerName: 'Rohan Verma (P002)',
        customerEmail: 'rohan.p002@example.com',
        customerPhone: '+919820011002',
        shouldVerifyPayment: true
      },
      {
        paymentId: `pay_P003_${Date.now()}`,
        amount: 3200,
        errorCode: 'INSUFFICIENT_FUNDS',
        errorDesc: 'Insufficient account balance for auto-renewal',
        isSubscription: true,
        attempts: 1,
        customerName: 'Ananya Iyer (P003)',
        customerEmail: 'ananya.p003@example.com',
        customerPhone: '+919820011003',
        shouldVerifyPayment: true
      },
      {
        paymentId: `pay_P004_${Date.now()}`,
        amount: 145000,
        errorCode: 'GATEWAY_ERROR',
        errorDesc: 'High-risk enterprise transaction decline',
        isSubscription: false,
        attempts: 1,
        customerName: 'Vikramaditya Rao (P004)',
        customerEmail: 'vikram.p004@example.com',
        customerPhone: '+919820011004',
        shouldVerifyPayment: false
      },
      {
        paymentId: `pay_P005_${Date.now()}`,
        amount: 5000,
        errorCode: 'CARD_EXPIRED',
        errorDesc: 'Retry limit reached (3 previous failed attempts)',
        isSubscription: false,
        attempts: 3,
        customerName: 'Karthik Subramanian (P005)',
        customerEmail: 'karthik.p005@example.com',
        customerPhone: '+919820011005',
        shouldVerifyPayment: false
      }
    ];

    const results = [];

    for (const bCase of BENCHMARK_CASES) {
      const eventId = `wh_bench_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const queueItem = {
        streamId: eventId,
        data: {
          eventId,
          eventType: bCase.isSubscription ? 'subscription.charge.failed' : 'payment.failed',
          payload: {
            payload: {
              payment: {
                entity: {
                  id: bCase.paymentId,
                  amount: Math.round(bCase.amount * 100),
                  currency: 'INR',
                  status: 'failed',
                  method: bCase.isSubscription ? 'card' : 'upi',
                  error_code: bCase.errorCode,
                  error_description: bCase.errorDesc,
                  error_source: 'issuer',
                  customer_name: bCase.customerName,
                  email: bCase.customerEmail,
                  contact: bCase.customerPhone,
                  attempts: bCase.attempts,
                  subscription_id: bCase.isSubscription ? `sub_${bCase.paymentId}` : null
                }
              }
            }
          }
        }
      };

      const pipeRes = await processPipelineEvent(queueItem);

      if (bCase.shouldVerifyPayment && pipeRes?.orchestrationResult?.externalRefId) {
        const payEvent = razorpayClient.simulateCustomerPayment(pipeRes.orchestrationResult.externalRefId, {
          amount: bCase.amount
        });
        await outcomeAnalyzer.processPaymentVerification({
          paymentEntity: payEvent.payload.payment.entity,
          caseId: pipeRes.caseId,
          externalRefId: pipeRes.orchestrationResult.externalRefId
        });
      }

      const caseRecord = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(pipeRes.caseId);

      results.push({
        paymentId: bCase.paymentId,
        caseId: pipeRes.caseId,
        amount: bCase.amount,
        failureReason: bCase.errorDesc,
        aiDiagnosis: {
          rootCause: pipeRes.diagnosis.root_cause,
          recommendedAction: pipeRes.diagnosis.recommended_action,
          confidence: pipeRes.diagnosis.confidence,
          fallbackUsed: pipeRes.diagnosis.fallback_used
        },
        policyDecision: pipeRes.policyDecision.decision,
        orchestrationAction: pipeRes.orchestrationResult?.actionType || 'NONE',
        finalResult: caseRecord?.status || 'PENDING',
        recoveredAmount: caseRecord?.recovered_amount || 0,
        executionMode: 'SIMULATED_TEST_MODE'
      });
    }

    const totalAtRisk = results.reduce((acc, r) => acc + r.amount, 0);
    const totalRecovered = results.reduce((acc, r) => acc + r.recoveredAmount, 0);
    const recoveryRate = totalAtRisk > 0 ? (totalRecovered / totalAtRisk) * 100 : 0;

    res.json({
      success: true,
      batchSize: results.length,
      mode: 'SIMULATED_TEST_MODE (Razorpay Sandbox/Test Actions)',
      summary: {
        totalRevenueAtRisk: totalAtRisk,
        recoveredRevenue: totalRecovered,
        recoveryRate: `${recoveryRate.toFixed(1)}%`,
        aiDecisions: results.length,
        escalated: results.filter(r => r.finalResult === 'ESCALATED').length,
        stopped: results.filter(r => r.finalResult === 'STOPPED').length
      },
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
