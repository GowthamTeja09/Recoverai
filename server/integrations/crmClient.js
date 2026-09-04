import { auditLogStore } from '../security/auditLogStore.js';

class CrmClient {
  async createEscalationTicket({ recoveryCase, customer, diagnosis, reason }) {
    const ticketId = `TICKET-${Math.floor(100000 + Math.random() * 900000)}`;

    const ticketPayload = {
      ticket_id: ticketId,
      source: 'RecoverAI_Safety_Engine',
      priority: recoveryCase.amount > 50000 ? 'URGENT' : 'HIGH',
      subject: `Revenue Risk Alert: Case #${recoveryCase.id} (₹${recoveryCase.amount.toLocaleString('en-IN')})`,
      customer: {
        id: customer?.id,
        name: customer?.name,
        email: customer?.email,
        phone: customer?.phone,
        ltv: customer?.ltv
      },
      diagnostic_dossier: {
        root_cause: diagnosis?.root_cause,
        ai_reasoning: diagnosis?.reasoning,
        risk_score: recoveryCase.risk_score,
        escalation_reason: reason
      },
      status: 'OPEN',
      created_at: new Date().toISOString()
    };

    auditLogStore.logEvent({
      caseId: recoveryCase.id,
      eventType: 'HUMAN_ESCALATION_CREATED',
      actor: 'CRM_Integrator',
      action: 'CREATE_CRM_TICKET',
      details: {
        ticketId,
        priority: ticketPayload.priority,
        reason,
        customerName: customer?.name
      }
    });

    return ticketPayload;
  }
}

export const crmClient = new CrmClient();
