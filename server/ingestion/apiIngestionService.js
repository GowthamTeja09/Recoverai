import crypto from 'crypto';
import { eventQueue } from './eventQueue.js';
import { deduplicator } from './deduplicator.js';
import { auditLogStore } from '../security/auditLogStore.js';

export async function ingestBatchTransactions(transactions = [], source = 'BATCH_UPLOAD') {
  const results = {
    total: transactions.length,
    ingested: 0,
    skippedDuplicates: 0,
    errors: []
  };

  for (const tx of transactions) {
    try {
      const batchFingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          source,
          payment_id: tx.payment_id || null,
          id: tx.id || null,
          amount: tx.amount ?? null,
          currency: tx.currency || null,
          status: tx.status || null,
          method: tx.method || null,
          error_code: tx.error_code || null,
          error_description: tx.error_description || null,
          error_source: tx.error_source || null,
          error_step: tx.error_step || null,
          error_reason: tx.error_reason || null,
          customer_id: tx.customer_id || null,
          email: tx.email || null,
          phone: tx.phone || null,
          name: tx.name || null,
          order_id: tx.order_id || null,
          subscription_id: tx.subscription_id || null
        }))
        .digest('hex')
        .slice(0, 16);
      const eventId = tx.event_id || `batch_${batchFingerprint}`;
      const entityId = tx.payment_id || tx.id || `pay_${batchFingerprint}`;
      const eventType = tx.event_type || (tx.status === 'failed' ? 'payment.failed' : 'payment.captured');

      if (deduplicator.isDuplicate(eventId, entityId, eventType)) {
        results.skippedDuplicates++;
        continue;
      }

      deduplicator.markProcessed(eventId, entityId, eventType);

      await eventQueue.enqueue({
        eventId,
        eventType,
        entityId,
        source,
        receivedAt: new Date().toISOString(),
        payload: {
          event: eventType,
          payload: {
            payment: {
              entity: {
                id: entityId,
                amount: tx.amount ? Math.round(tx.amount * 100) : 10000,
                currency: tx.currency || 'INR',
                status: tx.status || 'failed',
                method: tx.method || 'card',
                error_code: tx.error_code || 'GATEWAY_ERROR',
                error_description: tx.error_description || 'Transaction failed at bank gateway',
                error_source: tx.error_source || 'issuer',
                error_step: tx.error_step || 'payment_authorization',
                error_reason: tx.error_reason || 'payment_failed',
                customer_id: tx.customer_id || 'cust_demo_01',
                customer_email: tx.email || 'customer@example.com',
                customer_phone: tx.phone || '+919876543210',
                customer_name: tx.name || 'Sample Customer',
                order_id: tx.order_id || null,
                subscription_id: tx.subscription_id || null,
                payment_type: tx.subscription_id ? 'SUBSCRIPTION' : 'ONE_TIME'
              }
            }
          }
        }
      });

      results.ingested++;
    } catch (err) {
      results.errors.push({ tx, error: err.message });
    }
  }

  auditLogStore.logEvent({
    eventType: 'BATCH_INGESTION_COMPLETED',
    actor: 'ApiIngestionService',
    action: 'BATCH_INGEST',
    details: { source, ...results }
  });

  return results;
}
