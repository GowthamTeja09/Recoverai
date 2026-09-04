import { auditLogStore } from '../security/auditLogStore.js';

class NotificationChannels {
  async dispatch({ channel, customer, template, linkUrl, caseId = null }) {
    const dispatchId = `msg_${channel.toLowerCase()}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const formattedMessage = (template || 'Payment Recovery Notification')
      .replace('{{PAYMENT_LINK}}', linkUrl || 'https://rzp.io/i/demo-link')
      .replace('{{CUSTOMER_NAME}}', customer?.name || 'Customer');

    const result = {
      dispatchId,
      channel,
      recipient: channel === 'EMAIL' ? customer?.email : customer?.phone,
      content: formattedMessage,
      status: 'DELIVERED',
      deliveredAt: timestamp
    };

    if (caseId) {
      auditLogStore.logEvent({
        caseId,
        eventType: 'NOTIFICATION_SENT',
        actor: 'NotificationChannels',
        action: `SEND_${channel}`,
        details: {
          dispatchId,
          channel,
          recipient: result.recipient,
          previewSnippet: formattedMessage.substring(0, 120)
        }
      });
    }

    return result;
  }
}

export const notificationChannels = new NotificationChannels();
