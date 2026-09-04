import { db } from '../db/database.js';
import { auditLogStore } from '../security/auditLogStore.js';

export class RevenueRiskEngine {
  constructor() {
    this.name = 'RevenueRiskEngine_v2.1';
  }

  extractFeatures(paymentData, customerData) {
    const amount = paymentData.amount || 0;
    const errorCode = (paymentData.error_code || 'UNKNOWN').toUpperCase();
    const errorSource = (paymentData.error_source || 'unknown').toLowerCase();
    const attempts = paymentData.attempts || 1;
    const isSubscription = paymentData.payment_type === 'SUBSCRIPTION' || !!paymentData.subscription_id;
    const customerLtv = customerData ? customerData.ltv || 0 : 0;
    const customerFailures = customerData ? customerData.failed_payments_count || 0 : 0;
    const customerOrders = customerData ? customerData.total_orders || 0 : 1;
    const method = (paymentData.method || 'card').toLowerCase();

    const failureRate = customerOrders > 0 ? customerFailures / customerOrders : 0.5;

    return {
      amount,
      errorCode,
      errorSource,
      attempts,
      isSubscription,
      customerLtv,
      customerOrders,
      customerFailures,
      failureRate,
      method
    };
  }

  calculateRiskScore(features) {
    let score = 0.40; // Base baseline risk

    // Amount weight (High ticket size increases revenue loss severity)
    if (features.amount > 50000) score += 0.25;
    else if (features.amount > 15000) score += 0.15;
    else if (features.amount < 1500) score -= 0.10;

    // Error code analysis
    switch (features.errorCode) {
      case 'INSUFFICIENT_FUNDS':
        score += 0.18; // Chronic liquidity risk
        break;
      case 'CARD_EXPIRED':
        score += 0.22; // Hard decline risk
        break;
      case 'AUTHENTICATION_FAILED':
      case '3DS_DROPPED':
        score += 0.10; // Customer friction risk
        break;
      case 'GATEWAY_ERROR':
      case 'BANK_NETWORK_UNAVAILABLE':
        score -= 0.12; // Transient technical failure, highly recoverable!
        break;
      case 'FRAUD_SUSPECTED':
      case 'CARD_BLOCKED':
        score += 0.45;
        break;
      default:
        score += 0.05;
    }

    // Customer history weight (High LTV = critical to retain, but lower inherent credit risk)
    if (features.customerLtv > 100000) score -= 0.15;
    else if (features.customerLtv > 25000) score -= 0.08;

    if (features.failureRate > 0.4) score += 0.15;
    if (features.attempts > 2) score += 0.20;

    // Clamp score between 0.05 and 0.98
    const riskScore = Math.min(0.98, Math.max(0.05, Math.round(score * 100) / 100));

    let riskLevel = 'LOW';
    if (riskScore >= 0.80) riskLevel = 'CRITICAL';
    else if (riskScore >= 0.60) riskLevel = 'HIGH';
    else if (riskScore >= 0.35) riskLevel = 'MEDIUM';

    return { riskScore, riskLevel };
  }

  predictRecoveryProbabilities(features, riskScore) {
    // Predict success likelihood for each distinct recovery strategy
    let pSubscription = 0.0;
    let pOrder = 0.45;
    let pLink = 0.60;
    let pReminder = 0.50;
    let pEscalate = 0.20;

    if (features.isSubscription) {
      // Subscriptions have high probability via automated subscription retry if transient
      if (features.errorCode === 'GATEWAY_ERROR' || features.errorCode === 'BANK_NETWORK_UNAVAILABLE') {
        pSubscription = 0.88;
        pLink = 0.72;
      } else if (features.errorCode === 'INSUFFICIENT_FUNDS') {
        pSubscription = 0.65; // Best retried on month-end/salary days
        pLink = 0.78; // Instant alternative card link
      } else {
        pSubscription = 0.45;
        pLink = 0.82;
      }
    } else {
      // One-time payment
      if (features.errorCode === 'AUTHENTICATION_FAILED' || features.errorCode === '3DS_DROPPED') {
        pLink = 0.91; // Clean webview payment link converts best
        pOrder = 0.85;
      } else if (features.errorCode === 'GATEWAY_ERROR') {
        pOrder = 0.88;
        pLink = 0.84;
      } else {
        pLink = 0.79;
        pOrder = 0.70;
      }
    }

    // High amount or repeated failures favor human touch
    if (features.amount > 50000 || features.attempts >= 3) {
      pEscalate = 0.85;
    }

    return {
      SUBSCRIPTION_RETRY: Math.round(pSubscription * 100) / 100,
      RECOVERY_ORDER: Math.round(pOrder * 100) / 100,
      PAYMENT_LINK: Math.round(pLink * 100) / 100,
      REMINDER: Math.round(pReminder * 100) / 100,
      ESCALATE: Math.round(pEscalate * 100) / 100
    };
  }

  analyze(paymentData, customerData, caseId = null) {
    const features = this.extractFeatures(paymentData, customerData);
    const { riskScore, riskLevel } = this.calculateRiskScore(features);
    const recoveryProbabilities = this.predictRecoveryProbabilities(features, riskScore);

    if (caseId) {
      auditLogStore.logEvent({
        caseId,
        eventType: 'RISK_SCORED',
        actor: 'RevenueRisk',
        action: 'EVALUATE_RISK',
        details: {
          riskScore,
          riskLevel,
          features: {
            amount: features.amount,
            errorCode: features.errorCode,
            customerLtv: features.customerLtv,
            isSubscription: features.isSubscription
          },
          recoveryProbabilities
        }
      });
    }

    return {
      features,
      riskScore,
      riskLevel,
      recoveryProbabilities,
      modelName: this.name
    };
  }
}

export const riskEngine = new RevenueRiskEngine();
