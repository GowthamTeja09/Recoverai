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
    let channel = diagnosis.suggested_channel || 'NONE';

    // 1. If policy decided ESCALATED or AI recommended ESCALATE / ESCALATE_TO_HUMAN
    if (policyDecision.decision === 'ESCALATED' || actionType === 'ESCALATE' || actionType === 'ESCALATE_TO_HUMAN') {
      actionType = 'ESCALATE_TO_HUMAN';
      channel = 'CRM_TICKET';

      auditLogStore.logEvent({
        caseId: recoveryCase.id,
        eventType: 'ACTION_INITIATED',
        actor: 'RecoveryOrchestrator',
        action: 'INITIATE_ESCALATION',
        details: {
          tool: 'CRM White-Glove Escalation (Zendesk/Freshdesk)',
          actionType: 'ESCALATE_TO_HUMAN',
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

      db.prepare(`
        UPDATE recovery_cases
        SET status = 'ESCALATED', attempts_count = attempts_count + 1, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(recoveryCase.id);

      console.log(`[RECOVERY] Case #${recoveryCase.id} escalated to CRM ticket (${externalRefId})`);

    } else if (policyDecision.decision === 'APPROVED') {
      // Execute approved recovery tool
      switch (actionType) {
        case 'STOP_RECOVERY': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'STOP_RECOVERY',
            details: {
              tool: 'Recovery Policy Governor',
              actionType: 'STOP_RECOVERY',
              reason: diagnosis.reasoning || 'Recovery attempts concluded per safety limits'
            }
          });

          responseData = {
            status: 'STOPPED',
            message: 'Autonomous recovery stopped to prevent customer fatigue or excessive retries'
          };
          externalRefId = `stop_${recoveryCase.id}`;

          db.prepare(`
            UPDATE recovery_cases
            SET status = 'STOPPED', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(recoveryCase.id);

          console.log(`[RECOVERY] Case #${recoveryCase.id} recovery stopped per policy`);
          break;
        }

        case 'RETRY_PAYMENT': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_PAYMENT_RETRY',
            details: {
              tool: 'Razorpay Instant Payment Gateway Retry',
              actionType: 'RETRY_PAYMENT',
              amount: recoveryCase.amount
            }
          });

          responseData = await razorpayClient.createRecoveryOrder({
            amount: recoveryCase.amount,
            currency: recoveryCase.currency,
            customerId: customer?.id,
            receipt: `rcv_ret_${recoveryCase.id}`
          });
          externalRefId = responseData.id;

          if (channel && channel !== 'NONE') {
            await notificationChannels.dispatch({
              channel: channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
              customer,
              template: diagnosis.customer_messaging,
              caseId: recoveryCase.id
            });
          }

          console.log(`[RECOVERY] Automated payment retry initiated for #${recoveryCase.id} (Order: ${externalRefId})`);
          break;
        }

        case 'DELAY_AND_RETRY': {
          const delayHours = diagnosis.optimal_delay_hours || 24;
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_DELAYED_RETRY',
            details: {
              tool: 'Razorpay Smart Delay & Retry Scheduler',
              actionType: 'DELAY_AND_RETRY',
              delayHours
            }
          });

          if (recoveryCase.payment_id?.startsWith('sub_') || recoveryCase.subscription_id) {
            responseData = await razorpayClient.scheduleSubscriptionRetry({
              subscriptionId: recoveryCase.payment_id,
              delayHours
            });
            externalRefId = responseData.retry_id;
          } else {
            responseData = await razorpayClient.createPaymentLink({
              amount: recoveryCase.amount,
              currency: recoveryCase.currency,
              description: `Recovery Payment for #${recoveryCase.id}`,
              customer,
              referenceId: recoveryCase.id
            });
            externalRefId = responseData.id;
          }

          if (channel && channel !== 'NONE') {
            await notificationChannels.dispatch({
              channel: channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
              customer,
              template: diagnosis.customer_messaging,
              linkUrl: responseData.short_url,
              caseId: recoveryCase.id
            });
          }

          console.log(`[RECOVERY] Delayed retry scheduled (${delayHours}h) for #${recoveryCase.id}`);
          break;
        }

        case 'SUBSCRIPTION_RETRY': {
          const delayHours = diagnosis.optimal_delay_hours || 4;
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_SUBSCRIPTION_RETRY',
            details: {
              tool: 'Razorpay Subscription Auto-Charge Retry API',
              actionType: 'SUBSCRIPTION_RETRY',
              delayHours
            }
          });

          responseData = await razorpayClient.scheduleSubscriptionRetry({
            subscriptionId: recoveryCase.payment_id,
            delayHours
          });
          externalRefId = responseData.retry_id;

          if (channel && channel !== 'NONE') {
            await notificationChannels.dispatch({
              channel: channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
              customer,
              template: diagnosis.customer_messaging,
              caseId: recoveryCase.id
            });
          }

          console.log(`[RECOVERY] Subscription retry scheduled (${delayHours}h) for #${recoveryCase.id}`);
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

          await notificationChannels.dispatch({
            channel: channel === 'NONE' || channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
            customer,
            template: diagnosis.customer_messaging,
            linkUrl: `https://rzp.io/l/order-checkout-${responseData.id}`,
            caseId: recoveryCase.id
          });

          console.log(`[RECOVERY] Recovery order created: ${externalRefId} for #${recoveryCase.id}`);
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

          await notificationChannels.dispatch({
            channel: channel === 'NONE' || channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
            customer,
            template: diagnosis.customer_messaging,
            linkUrl: responseData.short_url,
            caseId: recoveryCase.id
          });

          console.log(`[RECOVERY] Payment link generated: ${responseData.short_url} for #${recoveryCase.id}`);
          break;
        }

        case 'SEND_REMINDER':
        case 'REMINDER': {
          auditLogStore.logEvent({
            caseId: recoveryCase.id,
            eventType: 'ACTION_INITIATED',
            actor: 'RecoveryOrchestrator',
            action: 'INITIATE_REMINDER',
            details: {
              tool: `Multi-Channel Reminder (${channel})`,
              actionType: 'SEND_REMINDER'
            }
          });

          responseData = await notificationChannels.dispatch({
            channel: channel === 'NONE' || channel === 'CRM_TICKET' ? 'WHATSAPP' : channel,
            customer,
            template: diagnosis.customer_messaging,
            caseId: recoveryCase.id
          });
          externalRefId = responseData.dispatchId;

          console.log(`[RECOVERY] Reminder sent to customer for #${recoveryCase.id}`);
          break;
        }

        default:
          throw new Error(`Unsupported recovery action: ${actionType}`);
      }

      // If not stopped, update case to IN_PROGRESS
      if (actionType !== 'STOP_RECOVERY') {
        db.prepare(`
          UPDATE recovery_cases
          SET status = 'IN_PROGRESS', attempts_count = attempts_count + 1, last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(recoveryCase.id);
      }

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
      console.log(`[RECOVERY] Execution rejected by policy for #${recoveryCase.id}: ${policyDecision.escalationReason}`);
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
      actionType === 'STOP_RECOVERY' ? 'STOPPED' : 'DISPATCHED',
      externalRefId,
      JSON.stringify(diagnosis),
      JSON.stringify(responseData)
    );

    return {
      actionId,
      actionType,
      channel,
      status: actionType === 'STOP_RECOVERY' ? 'STOPPED' : 'DISPATCHED',
      externalRefId,
      responseData
    };
  }
}

export const recoveryOrchestrator = new RecoveryOrchestrator();
