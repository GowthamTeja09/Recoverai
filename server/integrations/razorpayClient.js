import crypto from 'crypto';
import { secretsManager } from '../security/secretsManager.js';

class RazorpayClient {
  constructor() {
    this.simulatedLinks = new Map();
    this.simulatedOrders = new Map();
    this.simulatedSubscriptions = new Map();
  }

  getCredentials() {
    return {
      keyId: secretsManager.get('RAZORPAY_KEY_ID'),
      keySecret: secretsManager.get('RAZORPAY_KEY_SECRET')
    };
  }

  async createPaymentLink({ amount, currency = 'INR', description, customer, referenceId, notes = {} }) {
    const id = `plink_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const shortUrl = `https://rzp.io/i/${crypto.randomBytes(4).toString('hex')}`;
    const expireBy = Math.floor(Date.now() / 1000) + 72 * 3600; // 72 hours

    const linkData = {
      id,
      amount: Math.round(amount * 100), // Razorpay handles in paise
      currency,
      accept_partial: false,
      description: description || 'Digital Revenue Recovery Payment',
      customer: {
        name: customer?.name || 'Valued Customer',
        email: customer?.email || 'customer@example.com',
        contact: customer?.phone || '+919876543210'
      },
      notify: {
        sms: true,
        email: true,
        whatsapp: true
      },
      short_url: shortUrl,
      status: 'created',
      reference_id: referenceId,
      notes: {
        ...notes,
        recovered_by: 'RecoverAI_Engine'
      },
      created_at: Math.floor(Date.now() / 1000),
      expire_by: expireBy
    };

    this.simulatedLinks.set(id, linkData);
    return linkData;
  }

  async createRecoveryOrder({ amount, currency = 'INR', receipt, notes = {}, customerId }) {
    const id = `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const orderData = {
      id,
      entity: 'order',
      amount: Math.round(amount * 100),
      amount_paid: 0,
      amount_due: Math.round(amount * 100),
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes: {
        ...notes,
        recovered_by: 'RecoverAI_OrderCheckout',
        recommended_method: 'upi_intent'
      },
      customer_id: customerId,
      created_at: Math.floor(Date.now() / 1000)
    };

    this.simulatedOrders.set(id, orderData);
    return orderData;
  }

  async scheduleSubscriptionRetry({ subscriptionId, invoiceId, delayHours = 4 }) {
    const retryId = `sub_retry_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const scheduledTime = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();

    const result = {
      retry_id: retryId,
      subscription_id: subscriptionId || `sub_${Date.now()}`,
      invoice_id: invoiceId || `inv_${Date.now()}`,
      status: 'SCHEDULED',
      next_retry_at: scheduledTime,
      retry_strategy: 'SMART_INTERVAL_GATEWAY_RECOVERED',
      max_retries_remaining: 2
    };

    this.simulatedSubscriptions.set(retryId, result);
    return result;
  }

  // Simulation test tool: simulate customer paying via link or order
  simulateCustomerPayment(externalRefId, options = {}) {
    const payId = `pay_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    let amount = options.amount || 2499;

    if (this.simulatedLinks.has(externalRefId)) {
      const link = this.simulatedLinks.get(externalRefId);
      link.status = 'paid';
      amount = link.amount / 100;
    } else if (this.simulatedOrders.has(externalRefId)) {
      const order = this.simulatedOrders.get(externalRefId);
      order.status = 'paid';
      order.amount_paid = order.amount;
      amount = order.amount / 100;
    }

    return {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: payId,
            amount: Math.round(amount * 100),
            currency: 'INR',
            status: 'captured',
            order_id: externalRefId.startsWith('order_') ? externalRefId : null,
            invoice_id: null,
            method: options.method || 'upi',
            description: 'RecoverAI Autonomous Recovery Settlement',
            captured: true,
            notes: {
              external_ref_id: externalRefId,
              settled_via: 'RecoverAI'
            },
            created_at: Math.floor(Date.now() / 1000)
          }
        }
      }
    };
  }
}

export const razorpayClient = new RazorpayClient();
