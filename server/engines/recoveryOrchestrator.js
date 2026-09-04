import { db } from '../db/database.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { razorpayClient } from '../integrations/razorpayClient.js';
import { notificationChannels } from '../integrations/notificationChannels.js';
import { crmClient } from '../integrations/crmClient.js';

export class RecoveryOrchestrator {
  constructor() {
    this.name = 'RecoveryOrchestrator_v2.0';
  }

  async execute({ recoveryCase, diagnosis, policyDecision, customer }) {
    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let actionType = diagnosis.recommended_action;
    let externalRefId = null;
    let responseData = null;
    let channel = diagnosis.suggested_channel || 'RAZORPAY_API';

    // If safety policy decided ESCALATED, override action to ESCALATE
    if (policyDecision.decision === 'ESCALATED' || actionType === 'ESCALATE') {
      actionType = 'ESCALATE';
      channel = 'CRM_TICKET';

      auditLogStore.logEvent({
        caseId: recoveryCase.id,
        eventType: 'ACTION_INITIATED',
        actor: 'RecoveryOrchestrator',
        action: 'INITIATE_ESCALATION',
        details: {
          tool: 'CRM Ticket Integration (Zendesk/Freshdesk)',
          actionType: 'ESCALATE',
          reason: policyDecision.escalationReason || 'Policy Guardrail Escalation'
        }
      });

      responseData = await crmClient.createEscalationTicket({
        recoveryCase,
        customer,
        diagnosis,
        reason: policyDecision.escalationReason
      });
      externalRefId = responseData.ticket_id;

      // Update case
      db.prepare(`
        UPDATE recovery_cases
        SET status = 'ESCALATED', attempts_count = attempts_count + 1, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(recoveryCase.id);

    } else if (policyDecision.decision === 'APPROVED') {
      // Execute approved recovery tool
      switch (actionType) {
        case 'SUBSCRIPTION_RETRY': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_SUBSCRIPTION_RETRY',
            details: {
              tool: 'Razorpay Subscription Auto-Charge Retry API',
              actionType: 'SUBSCRIPTION_RETRY',
              delayHours: diagnosis.optimal_delay_hours || 4
            }
          });

          responseData = await razorpayClient.scheduleSubscriptionRetry({
            subscriptionId: recoveryCase.payment_id,
            delayHours: diagnosis.optimal_delay_hours || 4
          });
          externalRefId = responseData.retry_id;

          // Also trigger friendly customer notification
          await notificationChannels.dispatch({
            channel: 'WHATSAPP',
            customer,
            template: diagnosis.customer_messaging,
            caseId: recoveryCase.id
          });
          break;
        }

        case 'RECOVERY_ORDER': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_RECOVERY_ORDER',
            details: {
              tool: 'Razorpay Order & Checkout Recovery Flow',
              actionType: 'RECOVERY_ORDER',
              amount: recoveryCase.amount
            }
          });

          responseData = await razorpayClient.createRecoveryOrder({
            amount: recoveryCase.amount,
            currency: recoveryCase.currency,
            customerId: customer?.id,
            receipt: `rcv_ord_${recoveryCase.id}`
          });
          externalRefId = responseData.id;

          // Send checkout reminder with link
          await notificationChannels.dispatch({
            channel: 'WHATSAPP',
            customer,
            template: diagnosis.customer_messaging,
            linkUrl: `https://rzp.io/l/order-checkout-${responseData.id}`,
            caseId: recoveryCase.id
          });
          break;
        }

        case 'PAYMENT_LINK': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_PAYMENT_LINK',
            details: {
              tool: 'Razorpay Payment Links API',
              actionType: 'PAYMENT_LINK',
              amount: recoveryCase.amount
            }
          });

          responseData = await razorpayClient.createPaymentLink({
            amount: recoveryCase.amount,
            currency: recoveryCase.currency,
            description: `Recovery Payment for #${recoveryCase.id}`,
            customer,
            referenceId: recoveryCase.id
          });
          externalRefId = responseData.id;

          // Dispatch multi-channel notification
          await notificationChannels.dispatch({
            channel: channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
            customer,
            template: diagnosis.customer_messaging,
            linkUrl: responseData.short_url,
            caseId: recoveryCase.id
          });
          break;
        }

        case 'REMINDER': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_REMINDER',
            details: {
              tool: `Multi-Channel Reminder (${channel})`,
              actionType: 'REMINDER'
            }
          });

          responseData = await notificationChannels.dispatch({
            channel,
            customer,
            template: diagnosis.customer_messaging,
            caseId: recoveryCase.id
          });
          externalRefId = responseData.dispatchId;
          break;
        }

        default:
          throw new Error(`Unsupported recovery action: ${actionType}`);
      }

      // Update case to IN_PROGRESS
      db.prepare(`
        UPDATE recovery_cases
        SET status = 'IN_PROGRESS', attempts_count = attempts_count + 1, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(recoveryCase.id);

    } else {
      // REJECTED by policy
      auditLogStore.logEvent({
        caseId: recoveryCase.id,
        eventType: 'ACTION_REJECTED',
        actor: 'RecoveryOrchestrator',
        action: 'REJECT_EXECUTION',
        details: {
          reason: policyDecision.escalationReason || 'Policy Guardrail Violation'
        }
      });
      return { status: 'REJECTED', reason: policyDecision.escalationReason };
    }

    // Insert record in recovery_actions
    db.prepare(`
      INSERT INTO recovery_actions (
        id, case_id, action_type, channel, status, external_ref_id, payload, response_data, policy_checks_passed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      actionId,
      recoveryCase.id,
      actionType,
      channel,
      'DISPATCHED',
      externalRefId,
      JSON.stringify(diagnosis),
      JSON.stringify(responseData)
    );

    return {
      actionId,
      actionType,
      channel,
      status: 'DISPATCHED',
      externalRefId,
      responseData
    };
  }
}

export const recoveryOrchestrator = new RecoveryOrchestrator();
