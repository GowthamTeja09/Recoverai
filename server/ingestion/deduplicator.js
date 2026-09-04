import crypto from 'crypto';
import { db } from '../db/database.js';

class Deduplicator {
  constructor() {
    this.memoryCache = new Map(); // key -> timestamp
  }

  generateKey(eventId, entityId, eventType) {
    const raw = `${eventId}:${entityId}:${eventType}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  isDuplicate(eventId, entityId, eventType) {
    const key = this.generateKey(eventId, entityId, eventType);

    // 1. Check in-memory fast cache
    if (this.memoryCache.has(key)) {
      return true;
    }

    // 2. Check database
    const existing = db.prepare('SELECT event_id FROM processed_events WHERE idempotency_key = ?').get(key);
    if (existing) {
      this.memoryCache.set(key, Date.now());
      return true;
    }

    return false;
  }

  markProcessed(eventId, entityId, eventType) {
    const key = this.generateKey(eventId, entityId, eventType);
    this.memoryCache.set(key, Date.now());

    try {
      db.prepare(`
        INSERT INTO processed_events (event_id, event_type, idempotency_key, processed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(eventId, eventType, key);
    } catch (e) {
      // Ignore if already inserted
    }
  }

  // Cleanup in-memory cache older than 24 hours
  cleanup() {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, ts] of this.memoryCache.entries()) {
      if (ts < oneDayAgo) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export const deduplicator = new Deduplicator();
