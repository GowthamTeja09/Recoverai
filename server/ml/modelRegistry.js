import { db } from '../db/database.js';

class ModelRegistry {
  constructor() {
    this.initDefaultModels();
  }

  initDefaultModels() {
    const existing = db.prepare('SELECT count(*) as count FROM model_registry').get();
    if (existing && existing.count > 0) return;

    const defaultModels = [
      {
        id: 'mdl_risk_pred_v2.1',
        name: 'Revenue Loss Risk Predictor',
        version: 'v2.1.4',
        model_type: 'RISK_SCORE',
        status: 'ACTIVE',
        metrics: JSON.stringify({
          roc_auc: 0.942,
          precision: 0.915,
          recall: 0.887,
          f1_score: 0.901,
          training_samples: 148200,
          last_evaluated: '2026-08-28'
        }),
        parameters: JSON.stringify({
          algorithm: 'GradientBoostedTrees_LightGBM',
          features: ['ltv', 'failure_rate', 'ticket_size', 'iso_failure_code', 'card_network_health', 'time_of_day'],
          learning_rate: 0.035,
          max_depth: 7
        })
      },
      {
        id: 'mdl_recov_prob_v1.8',
        name: 'Recovery Strategy Conversion Probability',
        version: 'v1.8.2',
        model_type: 'RECOVERY_PROBABILITY',
        status: 'ACTIVE',
        metrics: JSON.stringify({
          roc_auc: 0.928,
          precision: 0.894,
          recall: 0.912,
          f1_score: 0.903,
          training_samples: 92400,
          last_evaluated: '2026-08-30'
        }),
        parameters: JSON.stringify({
          algorithm: 'MultiClass_DeepCrossNetwork',
          action_targets: ['SUBSCRIPTION_RETRY', 'RECOVERY_ORDER', 'PAYMENT_LINK', 'REMINDER', 'ESCALATE'],
          temperature: 0.65
        })
      },
      {
        id: 'mdl_ai_diagnostic_v3.2',
        name: 'Autonomous Diagnostic & Safety Reasoner',
        version: 'v3.2.0',
        model_type: 'ACTION_SELECTOR',
        status: 'ACTIVE',
        metrics: JSON.stringify({
          accuracy: 0.958,
          hallucination_rate: 0.002,
          guardrail_alignment: 0.999,
          avg_latency_ms: 182,
          last_evaluated: '2026-09-01'
        }),
        parameters: JSON.stringify({
          foundation_model: 'Gemini 1.5 Flash / Domain Tuned FinTech Heuristics',
          structured_schema: 'JSON_STRICT_ACTION_RECOMMENDER_V2'
        })
      }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO model_registry (id, name, version, model_type, status, metrics, parameters)
      VALUES (@id, @name, @version, @model_type, @status, @metrics, @parameters)
    `);

    for (const m of defaultModels) {
      insertStmt.run(m);
    }
  }

  getAllModels() {
    const rows = db.prepare('SELECT * FROM model_registry ORDER BY deployed_at DESC').all();
    return rows.map(r => ({
      ...r,
      metrics: r.metrics ? JSON.parse(r.metrics) : {},
      parameters: r.parameters ? JSON.parse(r.parameters) : {}
    }));
  }

  getModelById(id) {
    const row = db.prepare('SELECT * FROM model_registry WHERE id = ?').get(id);
    if (!row) return null;
    return {
      ...row,
      metrics: row.metrics ? JSON.parse(row.metrics) : {},
      parameters: row.parameters ? JSON.parse(row.parameters) : {}
    };
  }

  updateMetrics(id, newMetrics) {
    const existing = this.getModelById(id);
    if (!existing) return null;
    const merged = { ...existing.metrics, ...newMetrics };
    db.prepare('UPDATE model_registry SET metrics = ? WHERE id = ?').run(JSON.stringify(merged), id);
    return merged;
  }
}

export const modelRegistry = new ModelRegistry();
