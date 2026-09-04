import React, { useMemo, useState } from 'react';
import { ShieldCheck, Check, RefreshCw, Save } from 'lucide-react';

export default function PolicyStudioView({ policies = [], onUpdatePolicy, canEdit = true }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const rules = useMemo(
    () => policies.map((rule) => ({ ...rule, ...(drafts[rule.id] || {}) })),
    [policies, drafts]
  );

  const updateDraft = (ruleId, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [ruleId]: {
        ...(prev[ruleId] || {}),
        ...patch
      }
    }));
  };

  const handleToggle = (id) => {
    const current = rules.find((rule) => rule.id === id);
    updateDraft(id, { is_enabled: current?.is_enabled ? 0 : 1 });
  };

  const handleValueChange = (id, newVal) => {
    updateDraft(id, { rule_value: newVal });
  };

  const handleSave = async (rule) => {
    if (!canEdit) return;

    setSavingId(rule.id);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const response = await onUpdatePolicy(rule.id, {
        rule_value: rule.rule_value,
        is_enabled: rule.is_enabled
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
      setSuccessMsg(response?.message || `Guardrail rule '${rule.rule_name}' successfully updated`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
      setErrorMsg(
        error.status === 403
          ? 'Access denied: You do not have permission to update guardrail rules.'
          : error.message || 'Update denied.'
      );
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 border-emerald-500/30 bg-emerald-950/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-heading font-bold text-lg text-white">Policy & Safety Engine (The Guardrail)</h3>
          </div>
          <p className="text-xs text-slate-300">
            Enforce mandatory safety boundaries before any autonomous recovery action can execute. Every decision is verified: APPROVE, REJECT, or ESCALATE.
          </p>
        </div>

        {successMsg && (
          <div className="text-xs text-emerald-300 bg-emerald-900/60 px-3 py-1.5 rounded-lg border border-emerald-500/40 flex items-center gap-1.5 animate-fadeIn">
            <Check className="w-3.5 h-3.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="text-xs text-rose-300 bg-rose-950/60 px-3 py-1.5 rounded-lg border border-rose-500/40 flex items-center gap-1.5 animate-fadeIn">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-rose-400/60 text-[10px] font-bold">!</span>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {rules.map((rule) => {
          const isSaving = savingId === rule.id;
          const currentValue =
            rule.rule_key === 'MAX_AUTO_RECOVERY_AMOUNT'
              ? `₹${parseInt(rule.rule_value || 50000, 10).toLocaleString('en-IN')}`
              : rule.rule_key === 'MIN_CONFIDENCE_THRESHOLD'
                ? `${(parseFloat(rule.rule_value || 0.7) * 100).toFixed(0)}%`
                : rule.rule_key === 'MAX_RETRY_ATTEMPTS'
                  ? `${rule.rule_value || 3} attempts`
                  : rule.rule_key === 'MIN_COOLDOWN_HOURS'
                    ? `${rule.rule_value || 4} hours`
                    : rule.rule_key === 'MAX_CUSTOMER_CONTACTS_24H'
                      ? `${rule.rule_value || 2} messages / 24h`
                      : rule.rule_key === 'QUIET_HOURS_START'
                        ? `${rule.rule_value || 22}:00 IST`
                        : `${rule.rule_value ?? 'Configured'}`;

          return (
            <div key={rule.id} className="glass-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-heading font-bold text-sm text-white mb-1">{rule.rule_name}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{rule.description}</p>
                </div>
                {canEdit ? (
                  <button
                    onClick={() => handleToggle(rule.id)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                      rule.is_enabled
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {rule.is_enabled ? 'Active' : 'Disabled'}
                  </button>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700">
                    View Only
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800">
                {canEdit ? (
                  <>
                    {rule.rule_key === 'MAX_AUTO_RECOVERY_AMOUNT' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Ceiling Threshold:</span>
                          <strong className="font-mono text-emerald-400">₹{parseInt(rule.rule_value || 50000, 10).toLocaleString('en-IN')}</strong>
                        </div>
                        <input
                          type="range"
                          min="5000"
                          max="200000"
                          step="5000"
                          value={rule.rule_value || 50000}
                          onChange={(e) => handleValueChange(rule.id, e.target.value)}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-500 block mt-1">
                          Transactions above this ceiling automatically trigger white-glove human CRM escalation.
                        </span>
                      </div>
                    )}

                    {rule.rule_key === 'MIN_CONFIDENCE_THRESHOLD' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Minimum AI Confidence:</span>
                          <strong className="font-mono text-purple-400">{(parseFloat(rule.rule_value || 0.7) * 100).toFixed(0)}%</strong>
                        </div>
                        <input
                          type="range"
                          min="0.50"
                          max="0.95"
                          step="0.05"
                          value={rule.rule_value || 0.7}
                          onChange={(e) => handleValueChange(rule.id, e.target.value)}
                          className="w-full accent-purple-500 cursor-pointer"
                        />
                        <span className="text-[10px] text-slate-500 block mt-1">
                          AI agent must meet or exceed this confidence to execute autonomous actions.
                        </span>
                      </div>
                    )}

                    {rule.rule_key === 'MAX_RETRY_ATTEMPTS' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Max Retry Attempts:</span>
                          <strong className="font-mono text-white">{rule.rule_value} Attempts</strong>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={rule.rule_value || 3}
                          onChange={(e) => handleValueChange(rule.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-24"
                        />
                      </div>
                    )}

                    {rule.rule_key === 'MIN_COOLDOWN_HOURS' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Cooldown Window:</span>
                          <strong className="font-mono text-white">{rule.rule_value} Hours</strong>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="24"
                          value={rule.rule_value || 4}
                          onChange={(e) => handleValueChange(rule.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-24"
                        />
                      </div>
                    )}

                    {rule.rule_key === 'MAX_CUSTOMER_CONTACTS_24H' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Customer Outreach Cap:</span>
                          <strong className="font-mono text-white">{rule.rule_value} messages / 24h</strong>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="4"
                          value={rule.rule_value || 2}
                          onChange={(e) => handleValueChange(rule.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-24"
                        />
                      </div>
                    )}

                    {rule.rule_key === 'QUIET_HOURS_START' && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Quiet Hours Start:</span>
                          <strong className="font-mono text-white">{rule.rule_value}:00 IST (Night)</strong>
                        </div>
                        <input
                          type="number"
                          min="18"
                          max="23"
                          value={rule.rule_value || 22}
                          onChange={(e) => handleValueChange(rule.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono w-24"
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Current Setting</div>
                    <div className="mt-2 font-mono text-sm text-emerald-300">{currentValue}</div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{rule.description}</p>
                  </div>
                )}
              </div>

              {canEdit && (
                <div className="pt-2 flex justify-end">
                  <button onClick={() => handleSave(rule)} disabled={isSaving} className="btn-secondary text-xs py-1 px-3">
                    {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    <span>Save Guardrail Rule</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
