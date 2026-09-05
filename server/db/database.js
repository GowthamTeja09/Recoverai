import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbFilePath = path.join(dataDir, 'recoverai_store.json');

class EnterpriseRelationalDB {
  constructor() {
    this.tables = {
      merchants: [],
      customers: [],
      payments: [],
      recovery_cases: [],
      recovery_actions: [],
      audit_logs: [],
      policy_rules: [],
      model_registry: [],
      processed_events: []
    };
    this.autoIncrement = {
      audit_logs: 1
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(dbFilePath)) {
        const raw = fs.readFileSync(dbFilePath, 'utf8');
        const data = JSON.parse(raw);
        this.tables = { ...this.tables, ...data.tables };
        this.autoIncrement = { ...this.autoIncrement, ...data.autoIncrement };
      }
    } catch (err) {
      console.warn('Initializing fresh DB store:', err.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(dbFilePath, JSON.stringify({
        tables: this.tables,
        autoIncrement: this.autoIncrement
      }, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save DB:', err);
    }
  }

  pragma(stmt) {
    // No-op for compatibility
  }

  exec(sql) {
    // Schema creation no-op since tables exist
  }

  prepare(sql) {
    const trimmed = sql.trim();
    const self = this;

    return {
      run(...args) {
        return self._executeRun(trimmed, args);
      },
      get(...args) {
        const rows = self._executeSelect(trimmed, args);
        return rows.length > 0 ? rows[0] : undefined;
      },
      all(...args) {
        return self._executeSelect(trimmed, args);
      }
    };
  }

  _executeRun(sql, args) {
    const upper = sql.toUpperCase();

    // 1. INSERT INTO table (supports standard and INSERT OR IGNORE / REPLACE)
    if (upper.includes('INSERT')) {
      const match = sql.match(/INSERT(?:\s+OR\s+\w+)?\s+INTO\s+(\w+)\s*\(([\s\S]+?)\)\s*VALUES\s*\(([\s\S]+?)\)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const cols = match[2].split(',').map(c => c.trim());
        const valTokens = match[3].split(',').map(v => v.trim());
        const row = {};

        if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          // Object parameter binding (@col)
          const obj = args[0];
          for (const col of cols) {
            row[col] = obj[col] !== undefined ? obj[col] : null;
          }
        } else {
          // Positional binding (? or literal)
          let argIdx = 0;
          for (let i = 0; i < cols.length; i++) {
            const col = cols[i];
            const token = valTokens[i] || '?';
            if (token === '?') {
              row[col] = args[argIdx++] !== undefined ? args[argIdx - 1] : null;
            } else {
              row[col] = token.replace(/^['"]|['"]$/g, '');
            }
          }
        }

        if (table === 'audit_logs' && !row.id) {
          row.id = this.autoIncrement.audit_logs++;
        }
        if (!row.created_at) row.created_at = new Date().toISOString();
        if (!row.updated_at) row.updated_at = new Date().toISOString();

        if (!this.tables[table]) this.tables[table] = [];
        this.tables[table].push(row);
        this.save();
        return { changes: 1, lastInsertRowid: row.id || 1 };
      }
    }

    // 2. UPDATE table SET ... WHERE ...
    if (upper.startsWith('UPDATE')) {
      const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)/i);
      if (match) {
        const table = match[1].toLowerCase();
        const setClause = match[2];
        const whereClause = match[3];

        const setParts = setClause.split(',').map(p => p.trim());
        const rows = this.tables[table] || [];
        let updatedCount = 0;

        let argIdx = 0;
        const setMap = {};
        for (const part of setParts) {
          const col = part.split('=')[0].trim();
          const valExpr = part.split('=')[1]?.trim() || '';

          if (valExpr === '?') {
            setMap[col] = args[argIdx++];
          } else if (valExpr.toUpperCase().includes('CURRENT_TIMESTAMP')) {
            setMap[col] = new Date().toISOString();
          } else if (valExpr.includes('+')) {
            const isParam = valExpr.includes('?');
            setMap[col] = { incrementBy: isParam ? args[argIdx++] : 1 };
          } else {
            // Literal value like 'IN_PROGRESS' or 'ESCALATED'
            setMap[col] = valExpr.replace(/^['"]|['"]$/g, '');
          }
        }

        // Where condition (simple where id = ? or external_ref_id = ?)
        const whereCol = whereClause.split('=')[0].trim();
        const whereVal = args[argIdx++];

        for (const row of rows) {
          if (String(row[whereCol]) === String(whereVal)) {
            for (const [k, v] of Object.entries(setMap)) {
              if (v && typeof v === 'object' && v.incrementBy !== undefined) {
                row[k] = (Number(row[k]) || 0) + Number(v.incrementBy);
              } else {
                row[k] = v;
              }
            }
            row.updated_at = new Date().toISOString();
            updatedCount++;
          }
        }

        this.save();
        return { changes: updatedCount };
      }
    }

    return { changes: 0 };
  }

  _executeSelect(sql, args) {
    const upper = sql.toUpperCase();

    // 1. GROUP BY queries
    if (upper.includes('GROUP BY ACTION_TYPE')) {
      const rows = this.tables.recovery_actions || [];
      const counts = {};
      for (const r of rows) {
        counts[r.action_type] = (counts[r.action_type] || 0) + 1;
      }
      return Object.entries(counts).map(([action_type, count]) => ({ action_type, count }));
    }

    if (upper.includes('GROUP BY RISK_LEVEL')) {
      const rows = this.tables.recovery_cases || [];
      const counts = {};
      for (const r of rows) {
        counts[r.risk_level] = (counts[r.risk_level] || 0) + 1;
      }
      return Object.entries(counts).map(([risk_level, count]) => ({ risk_level, count }));
    }

    // 2. COUNT(*) queries
    if (upper.includes('COUNT(*)')) {
      const matchTable = sql.match(/FROM\s+(\w+)/i);
      if (!matchTable) return [{ count: 0 }];
      const table = matchTable[1].toLowerCase();
      let rows = this.tables[table] || [];

      if (upper.includes("WHERE STATUS = 'RECOVERED'")) {
        rows = rows.filter(r => r.status === 'RECOVERED');
      } else if (upper.includes("WHERE STATUS = 'PARTIAL'")) {
        rows = rows.filter(r => r.status === 'PARTIAL');
      } else if (upper.includes("WHERE STATUS = 'IN_PROGRESS'")) {
        rows = rows.filter(r => r.status === 'IN_PROGRESS');
      } else if (upper.includes("WHERE STATUS = 'ESCALATED'")) {
        rows = rows.filter(r => r.status === 'ESCALATED');
      } else if (upper.includes("WHERE STATUS = 'OPEN'")) {
        rows = rows.filter(r => r.status === 'OPEN');
      }

      return [{ count: rows.length }];
    }

    // 3. SUM queries
    if (upper.includes('COALESCE(SUM(RECOVERED_AMOUNT)')) {
      const rows = this.tables.recovery_cases || [];
      const total = rows.reduce((acc, r) => acc + (Number(r.recovered_amount) || 0), 0);
      return [{ total }];
    }

    if (upper.includes('COALESCE(SUM(AMOUNT - RECOVERED_AMOUNT)')) {
      const rows = (this.tables.recovery_cases || []).filter(r =>
        ['OPEN', 'IN_PROGRESS', 'ESCALATED'].includes(r.status)
      );
      const total = rows.reduce((acc, r) => acc + ((Number(r.amount) || 0) - (Number(r.recovered_amount) || 0)), 0);
      return [{ total }];
    }

    // 4. Standard Table SELECT
    const fromMatch = sql.match(/FROM\s+(\w+)/i);
    if (!fromMatch) return [];
    const mainTable = fromMatch[1].toLowerCase();
    let rows = [...(this.tables[mainTable] || [])];

    // JOIN handling for recovery_cases + customers
    if (mainTable === 'recovery_cases' && upper.includes('JOIN CUSTOMERS')) {
      const customers = this.tables.customers || [];
      rows = rows.map(rc => {
        const cust = customers.find(c => c.id === rc.customer_id) || {};
        return {
          ...rc,
          customer_name: cust.name || 'Unknown',
          customer_email: cust.email || '',
          customer_phone: cust.phone || '',
          customer_ltv: cust.ltv || 0,
          preferred_channel: cust.preferred_channel || 'WHATSAPP'
        };
      });
    }

    // WHERE filtering
    if (upper.includes('WHERE')) {
      let argIdx = 0;

      if (sql.includes('case_id = ?')) {
        const val = args[argIdx++];
        rows = rows.filter(r => String(r.case_id) === String(val));
      } else if (sql.includes('rc.id = ?') || /\bid\s*=\s*\?/i.test(sql)) {
        const val = args[argIdx++];
        rows = rows.filter(r => String(r.id) === String(val));
      } else if (sql.includes('merchant_id = ?')) {
        const val = args[argIdx++];
        rows = rows.filter(r => String(r.merchant_id) === String(val));
      } else if (sql.includes('idempotency_key = ?')) {
        const val = args[argIdx++];
        rows = rows.filter(r => String(r.idempotency_key) === String(val));
      } else if (sql.includes('external_ref_id = ?')) {
        const val = args[argIdx++];
        rows = rows.filter(r => String(r.external_ref_id) === String(val));
      } else {
        // Multi-condition filter (cases grid)
        for (const arg of args) {
          if (!arg) continue;
          if (['OPEN', 'IN_PROGRESS', 'RECOVERED', 'PARTIAL', 'FAILED', 'ESCALATED', 'CLOSED'].includes(arg)) {
            rows = rows.filter(r => r.status === arg);
          } else if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(arg)) {
            rows = rows.filter(r => r.risk_level === arg);
          } else if (typeof arg === 'string' && arg.startsWith('%')) {
            const clean = arg.replace(/%/g, '').toLowerCase();
            rows = rows.filter(r =>
              (r.id && r.id.toLowerCase().includes(clean)) ||
              (r.customer_name && r.customer_name.toLowerCase().includes(clean)) ||
              (r.customer_email && r.customer_email.toLowerCase().includes(clean))
            );
          }
        }
      }
    }

    // ORDER BY handling
    if (upper.includes('ORDER BY')) {
      if (upper.includes('CREATED_AT DESC') || upper.includes('ID DESC')) {
        rows.reverse();
      } else if (upper.includes('CREATED_AT ASC') || upper.includes('ID ASC')) {
        // Natural order
      }
    }

    // LIMIT handling
    if (upper.includes('LIMIT ?') && args.length > 0) {
      const limitVal = Number(args[args.length - 1]) || 50;
      rows = rows.slice(0, limitVal);
    } else if (upper.includes('LIMIT 1')) {
      rows = rows.slice(0, 1);
    }

    return rows;
  }
}

export const db = new EnterpriseRelationalDB();

export function initSchema() {
  // Pure JS DB initializes tables in constructor
}
