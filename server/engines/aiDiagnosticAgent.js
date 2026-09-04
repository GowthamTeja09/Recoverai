import { secretsManager } from '../security/secretsManager.js';
import { auditLogStore } from '../security/auditLogStore.js';

export class AIDiagnosticAgent {
  constructor() {
    this.name = 'AIDiagnosticAgent_v3.2';
  }

  async diagnose({ paymentData, customerData, riskAnalysis, caseId = null }) {
    const { features, riskScore, recoveryProbabilities } = riskAnalysis;
    const isSubscription = features.isSubscription;
    const amount = features.amount;
    const errorCode = features.errorCode;
    const attempts = features.attempts;
    const customerLtv = features.customerLtv;

    let rootCause = 'UNKNOWN_DECLINE';
    let reasoning = '';
    let recommendedAction = 'PAYMENT_LINK';
    let confidence = 0.85;
    let optimalDelayHours = 0;
    let channel = 'WHATSAPP';
    let suggestedCopy = '';

    // Advanced Diagnostic Logic aligned with authentic Razorpay workflows
    if (amount > 50000 || attempts >= 3 || errorCode === 'FRAUD_SUSPECTED') {
      rootCause = errorCode === 'FRAUD_SUSPECTED' ? 'RISK_SECURITY_BLOCK' : 'HIGH_VALUE_REPEATED_DECLINE';
      reasoning = `High monetary exposure (₹${amount.toLocaleString('en-IN')}) or ${attempts} prior unsuccessful attempts detected. Customer lifetime value is ₹${customerLtv.toLocaleString('en-IN')}. Autonomous automated recovery poses friction; high-touch human escalation required to prevent customer churn.`;
      recommendedAction = 'ESCALATE';
      confidence = 0.94;
      channel = 'CRM_TICKET';
      suggestedCopy = `Priority Account Alert: High-value transaction ₹${amount} failed (${errorCode}). Assign dedicated account manager for white-glove outreach.`;
    } else if (isSubscription) {
      if (errorCode === 'GATEWAY_ERROR' || errorCode === 'BANK_NETWORK_UNAVAILABLE') {
        rootCause = 'TRANSIENT_ISSUER_OUTAGE';
        reasoning = `Issuing bank switch encountered network timeout during recurring authorization. Customer account active with ₹${customerLtv.toLocaleString('en-IN')} LTV. Transient error is ideal for Razorpay native subscription retry after switch recovery.`;
        recommendedAction = 'SUBSCRIPTION_RETRY';
        confidence = 0.93;
        optimalDelayHours = 4;
        channel = 'RAZORPAY_API';
        suggestedCopy = `We noticed a momentary bank network glitch while processing your subscription. We've scheduled an automatic re-charge so your access remains uninterrupted.`;
      } else if (errorCode === 'INSUFFICIENT_FUNDS') {
        rootCause = 'INSUFFICIENT_FUNDS_RECURRING';
        reasoning = `Customer bank balance insufficient for automated recurring debit. Sending a personalized payment link via WhatsApp allows the customer to pay with alternate UPI or credit card immediately.`;
        recommendedAction = 'PAYMENT_LINK';
        confidence = 0.88;
        optimalDelayHours = 1;
        channel = 'WHATSAPP';
        suggestedCopy = `Hi ${customerData?.name || 'there'}, your renewal payment of ₹${amount} couldn't be completed due to insufficient balance. Click here to renew seamlessly using UPI or Card: {{PAYMENT_LINK}}`;
      } else {
        rootCause = 'SUBSCRIPTION_TOKEN_EXPIRED';
        reasoning = `Card token expired or recurring mandate invalid. Direct link needed to re-authenticate card credentials.`;
        recommendedAction = 'PAYMENT_LINK';
        confidence = 0.91;
        channel = 'EMAIL';
        suggestedCopy = `Your card mandate for your subscription requires re-authorization. Please update your payment method here: {{PAYMENT_LINK}}`;
      }
    } else {
      // Normal one-time payment
      if (errorCode === 'AUTHENTICATION_FAILED' || errorCode === '3DS_DROPPED') {
        rootCause = 'CUSTOMER_3DS_ABANDONMENT';
        reasoning = `User dropped off during bank OTP / 3DS authentication step. Intent is high. Instant Razorpay Payment Link dispatched via ${customerData?.preferred_channel || 'WhatsApp'} offers the least friction.`;
        recommendedAction = 'PAYMENT_LINK';
        confidence = 0.92;
        channel = 'WHATSAPP';
        suggestedCopy = `Hi ${customerData?.name || 'Customer'}, it looks like your session was interrupted during bank OTP verification. You can complete your purchase securely here: {{PAYMENT_LINK}}`;
      } else if (errorCode === 'GATEWAY_ERROR') {
        rootCause = 'ACQUIRER_TRANSIENT_FAILURE';
        reasoning = `Acquiring gateway transient timeout. Creating a fresh recovery order and prompting alternate methods (UPI / Netbanking) maximizes checkout conversion.`;
        recommendedAction = 'RECOVERY_ORDER';
        confidence = 0.89;
        channel = 'RAZORPAY_API';
        suggestedCopy = `Bank network was temporarily unreachable. Try checking out using UPI for instant confirmation.`;
      } else {
        rootCause = 'GENERAL_DECLINE';
        reasoning = `Transaction failed with reason: ${paymentData.error_description || errorCode}. Payment link with multi-method checkout provides customer flexibility.`;
        recommendedAction = 'PAYMENT_LINK';
        confidence = 0.82;
        channel = 'EMAIL';
        suggestedCopy = `Your payment of ₹${amount} could not be completed. Click to retry with UPI, Debit/Credit Card or Netbanking: {{PAYMENT_LINK}}`;
      }
    }

    const diagnosis = {
      agent: this.name,
      root_cause: rootCause,
      reasoning,
      recommended_action: recommendedAction,
      confidence,
      optimal_delay_hours: optimalDelayHours,
      suggested_channel: channel,
      customer_messaging: suggestedCopy,
      risk_score_at_diagnosis: riskScore,
      diagnosed_at: new Date().toISOString()
    };

    if (caseId) {
      auditLogStore.logEvent({
        caseId,
        eventType: 'ACTION_RECOMMENDED',
        actor: 'AIDiagnosticAgent',
        action: 'RECOMMEND_ACTION',
        details: {
          action: recommendedAction,
          rootCause,
          reason: reasoning,
          confidence,
          channel
        }
      });
    }

    return diagnosis;
  }
}

export const aiDiagnosticAgent = new AIDiagnosticAgent();
