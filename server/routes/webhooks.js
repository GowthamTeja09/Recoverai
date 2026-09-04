import express from 'express';
import { processIncomingWebhook } from '../ingestion/webhookReceiver.js';
import { razorpayClient } from '../integrations/razorpayClient.js';
import { outcomeAnalyzer } from '../verification/outcomeAnalyzer.js';
import { eventQueue } from '../ingestion/eventQueue.js';
import { authenticateToken } from '../security/auth.js';
import { requirePermission } from '../security/rbac.js';

const router = express.Router();

// Real Razorpay Webhook Ingestion endpoint
router.post('/razorpay', async (req, res) => {
  try {
    const rawBody = req.body;
    const headers = req.headers;
    const payload = req.body;

    const result = await processIncomingWebhook({ rawBody, headers, payload });
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Interactive Webhook Simulator endpoint for Live Testing & Demos
router.post('/simulate', authenticateToken, requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
    const {
      scenario = '3DS_DROP',
      amount = 2499,
      customerName = 'Test User',
      customerEmail = 'test.user@example.com',
      customerPhone = '+919876543210',
      isSubscription = false,
      errorCode = 'AUTHENTICATION_FAILED'
    } = req.body;

    const eventId = `wh_sim_${Date.now()}`;
    const paymentId = `pay_sim_${Date.now()}`;
    const orderId = `order_sim_${Date.now()}`;
    const subscriptionId = isSubscription ? `sub_sim_${Date.now()}` : null;

    let computedErrorCode = errorCode;
    let computedErrorDesc = 'Payment authentication was dropped';

    if (scenario === '3DS_DROP') {
      computedErrorCode = 'AUTHENTICATION_FAILED';
      computedErrorDesc = 'Customer dropped off at OTP bank page';
    } else if (scenario === 'GATEWAY_ERROR') {
      computedErrorCode = 'GATEWAY_ERROR';
      computedErrorDesc = 'Bank core gateway timed out';
    } else if (scenario === 'INSUFFICIENT_FUNDS') {
      computedErrorCode = 'INSUFFICIENT_FUNDS';
      computedErrorDesc = 'Debit rejected due to insufficient account balance';
    } else if (scenario === 'HIGH_TICKET_BREACH') {
      computedErrorCode = 'GATEWAY_ERROR';
      computedErrorDesc = 'High-ticket enterprise invoice payment declined';
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
            attempts: req.body.attempts || 1
          }
        }
      }
    };

    const result = await processIncomingWebhook({
      rawBody: payload,
      headers: { 'x-razorpay-signature': 'demo_verified_signature_recoverai' },
      payload
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
router.post('/simulate-pay', authenticateToken, requirePermission('TRIGGER_MANUAL_ACTION'), async (req, res) => {
  try {
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

export default router;
