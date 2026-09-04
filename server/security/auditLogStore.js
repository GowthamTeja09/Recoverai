import crypto from 'crypto';
import { db } from '../db/database.js';

class AuditLogStore {
  constructor() {
    this.initLastHash();
  }

  initLastHash() {
    const row = db.prepare('SELECT curr_hash FROM audit_logs ORDER BY id DESC LIMIT 1').get();
    this.lastHash = row ? row.curr_hash : '0000000000000000000000000000000000000000000000000000000000000000';
  }

  logEvent({ caseId = null, eventType, actor, action, details = {}, timestamp = new Date().toISOString() }) {
    const eventId = `audit_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const prevHash = this.lastHash;
    const dataToHash = `${prevHash}|${timestamp}|${actor}|${action}|${JSON.stringify(details)}`;
    const currHash = crypto.createHash('sha256').update(dataToHash).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO audit_logs (event_id, case_id, event_type, actor, action, details, prev_hash, curr_hash, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(eventId, caseId, eventType, actor, action, JSON.stringify(details), prevHash, currHash, timestamp);
    this.lastHash = currHash;

    return {
      eventId,
      caseId,
      eventType,
      actor,
      action,
      details,
      prevHash,
      currHash,
      timestamp
    };
  }

  getLogsByCaseId(caseId) {
    const rows = db.prepare('SELECT * FROM audit_logs WHERE case_id = ? ORDER BY id ASC').all(caseId);
    return rows.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : {}
    }));
  }

  getRecentLogs(limit = 50) {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
    return rows.map(r => ({
      ...r,
      details: r.details ? JSON.parse(r.details) : {}
    }));
  }

  verifyChainIntegrity() {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id ASC').all();
    let prev = '0000000000000000000000000000000000000000000000000000000000000000';
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.prev_hash !== prev) {
        return { valid: false, brokenAtIndex: i, reason: 'Previous hash mismatch', row };
      }
      const dataToHash = `${row.prev_hash}|${row.timestamp}|${row.actor}|${row.action}|${row.details}`;
      const calculatedHash = crypto.createHash('sha256').update(dataToHash).digest('hex');
      if (calculatedHash !== row.curr_hash) {
        return { valid: false, brokenAtIndex: i, reason: 'Current hash mismatch', row };
      }
      prev = row.curr_hash;
    }
    return { valid: true, verifiedCount: rows.length };
  }
}

export const auditLogStore = new AuditLogStore();
