import crypto from 'crypto';
import { secretsManager } from '../security/secretsManager.js';
import { auditLogStore } from '../security/auditLogStore.js';
import { deduplicator } from './deduplicator.js';
import { eventQueue } from './eventQueue.js';

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret || !rawBody) return false;

  const isProduction = process.env.NODE_ENV === 'production';
  const isDemoMode = (process.env.DEMO_MODE === 'true' || process.env.DEMO_MODE === true) && !isProduction;

  // Unconditional demo bypass is strictly forbidden in production
  if (signature === 'demo_verified_signature_recoverai') {
    return isDemoMode;
  }

  try {
    const rawBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBuffer)
      .digest('hex');

    const sigBuf = Buffer.from(String(signature).trim(), 'utf8');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');

    // Length check prevents timingSafeEqual range exception
    if (sigBuf.length !== expectedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expectedBuf);
  } catch (err) {
    return false;
  }
}

export async function processIncomingWebhook({ rawBody, headers = {}, payload, isSimulated = false }) {
  const signature = headers['x-razorpay-signature'] || headers['x-signature'];
  const secret = secretsManager.get('RAZORPAY_WEBHOOK_SECRET');
  const isProduction = process.env.NODE_ENV === 'production';

  // In production or for real webhook requests, signature must be verified
  if (!isSimulated || isProduction) {
    if (!secret || secret.trim().length === 0) {
      throw new Error('Razorpay webhook secret is not configured on server');
    }

    const isValid = verifyWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      throw new Error('Invalid Razorpay webhook HMAC signature');
    }
  }

  // Idempotency: prioritize Razorpay's official event ID header if provided
  const eventId = headers['x-razorpay-event-id'] || payload.event_id || payload.id || `wh_${Date.now()}`;
  const eventType = payload.event;
  const entity = payload.payload?.payment?.entity || payload.payload?.subscription?.entity || payload.payload?.order?.entity || payload;
  const entityId = entity.id || `ent_${Date.now()}`;

  // Deduplication check
  if (deduplicator.isDuplicate(eventId, entityId, eventType)) {
    auditLogStore.logEvent({
      eventType: 'EVENT_DUPLICATE_DROPPED',
      actor: 'EventValidator',
      action: 'DROP_DUPLICATE',
      details: { eventId, entityId, eventType }
    });
    return { status: 'DUPLICATE_IGNORED', eventId };
  }

  deduplicator.markProcessed(eventId, entityId, eventType);

  // Push to Event Queue (Redis Stream architecture)
  const queueEntry = await eventQueue.enqueue({
    eventId,
    eventType,
    entityId,
    receivedAt: new Date().toISOString(),
    payload
  });

  auditLogStore.logEvent({
    eventType: 'WEBHOOK_RECEIVED',
    actor: 'WebhookReceiver',
    action: 'INGEST_EVENT',
    details: {
      eventId,
      eventType,
      entityId,
      amount: entity.amount ? entity.amount / 100 : null,
      currency: entity.currency || 'INR',
      status: entity.status,
      streamId: queueEntry.streamId
    }
  });

  return {
    status: 'INGESTED',
    eventId,
    streamId: queueEntry.streamId
  };
}
