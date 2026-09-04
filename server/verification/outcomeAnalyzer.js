import { db } from '../db/database.js';
import { auditLogStore } from '../security/auditLogStore.js';

export class OutcomeAnalyzer {
  constructor() {
    this.name = 'OutcomeAnalyzer_v2.0';
  }

  async processPaymentVerification({ paymentEntity, caseId = null, externalRefId = null }) {
    let targetCase = null;

    // 1. Locate case by caseId
    if (caseId) {
      targetCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(caseId);
    }

    // 2. Locate case by external_ref_id on recovery_actions
    if (!targetCase && externalRefId) {
      const action = db.prepare('SELECT case_id FROM recovery_actions WHERE external_ref_id = ?').get(externalRefId);
      if (action) {
        targetCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(action.case_id);
      }
    }

    // 3. Locate case by payment order_id or notes
    if (!targetCase && paymentEntity.order_id) {
      const action = db.prepare('SELECT case_id FROM recovery_actions WHERE external_ref_id = ?').get(paymentEntity.order_id);
      if (action) {
        targetCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(action.case_id);
      }
    }

    if (!targetCase && paymentEntity.notes?.external_ref_id) {
      const action = db.prepare('SELECT case_id FROM recovery_actions WHERE external_ref_id = ?').get(paymentEntity.notes.external_ref_id);
      if (action) {
        targetCase = db.prepare('SELECT * FROM recovery_cases WHERE id = ?').get(action.case_id);
      }
    }

    if (!targetCase) {
      return { status: 'CASE_NOT_FOUND', error: 'No matching recovery case found for payment event' };
    }

    const paidAmount = paymentEntity.amount ? paymentEntity.amount / 100 : targetCase.amount;
    const isFullRecovery = paidAmount >= targetCase.amount;
    const outcomeStatus = isFullRecovery ? 'RECOVERED' : 'PARTIAL';

    // Verification Engine Audit Log:
    // 14:32:09 | Outcome Verified | engine: VerificationEngine, status: Payment Successful
    auditLogStore.logEvent({
      caseId: targetCase.id,
      eventType: 'OUTCOME_VERIFIED',
      actor: 'VerificationEngine',
      action: 'VERIFY_SETTLEMENT',
      details: {
        status: 'Payment Successful',
        gatewayPaymentId: paymentEntity.id,
        amount: paidAmount,
        currency: paymentEntity.currency || 'INR',
        method: paymentEntity.method || 'upi',
        externalRefId: externalRefId || paymentEntity.order_id
      }
    });

    // 14:32:09 | Revenue Recovered | status: COMPLETE, amount: ₹2,499
    auditLogStore.logEvent({
      caseId: targetCase.id,
      eventType: 'REVENUE_RECOVERED',
      actor: 'OutcomeAnalyzer',
      action: 'COMPLETE_RECOVERY',
      details: {
        status: 'COMPLETE',
        amount: paidAmount,
        currency: targetCase.currency,
        caseId: targetCase.id,
        recoveryMethod: paymentEntity.method || 'upi'
      }
    });

    // Update Recovery Case in DB
    db.prepare(`
      UPDATE recovery_cases
      SET status = ?,
          recovered_amount = ?,
          recovery_method = ?,
          recovered_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(outcomeStatus, paidAmount, paymentEntity.method || 'upi', targetCase.id);

    // Update Action status to VERIFIED_PAID
    if (externalRefId) {
      db.prepare(`
        UPDATE recovery_actions
        SET status = 'VERIFIED_PAID', updated_at = CURRENT_TIMESTAMP
        WHERE external_ref_id = ?
      `).run(externalRefId);
    } else {
      db.prepare(`
        UPDATE recovery_actions
        SET status = 'VERIFIED_PAID', updated_at = CURRENT_TIMESTAMP
        WHERE case_id = ?
      `).run(targetCase.id);
    }

    // Update customer statistics
    db.prepare(`
      UPDATE customers
      SET ltv = ltv + ?, total_orders = total_orders + 1
      WHERE id = ?
    `).run(paidAmount, targetCase.customer_id);

    return {
      success: true,
      caseId: targetCase.id,
      outcome: outcomeStatus,
      amountRecovered: paidAmount,
      currency: targetCase.currency
    };
  }
}

export const outcomeAnalyzer = new OutcomeAnalyzer();
