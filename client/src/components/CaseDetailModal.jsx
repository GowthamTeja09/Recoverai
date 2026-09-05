import React, { useState } from 'react';
import { 
  X, 
  Bot, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle, 
  CreditCard, 
  Check, 
  User,
  Clock
} from 'lucide-react';
import ExecutionTimeline from './ExecutionTimeline';

export default function CaseDetailModal({ caseData, onClose, onSimulatePayment, loading, canTriggerManualAction = true }) {
  const [simulating, setSimulating] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!caseData || !caseData.case) return null;

  const { case: c, actions = [], timeline = [] } = caseData;
  const diagnosis = c.ai_diagnosis || {};
  const policyChecks = c.policy_checks || [];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RECOVERED':
        return <span className="badge badge-recovered"><CheckCircle className="w-3 h-3" /> Recovered</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-progress"><Clock className="w-3 h-3" /> In Progress</span>;
      case 'ESCALATED':
        return <span className="badge badge-escalated"><AlertTriangle className="w-3 h-3" /> Escalated to CRM</span>;
      default:
        return <span className="badge badge-open"><AlertTriangle className="w-3 h-3" /> {status}</span>;
    }
  };

  const getRiskBadge = (level, score) => {
    const cls = level === 'LOW' ? 'badge-risk-low' : level === 'MEDIUM' ? 'badge-risk-medium' : level === 'HIGH' ? 'badge-risk-high' : 'badge-risk-critical';
    return (
      <span className={`badge ${cls}`}>
        {level} ({(score * 100).toFixed(0)}%)
      </span>
    );
  };

  const handleSimulatePay = async () => {
    setSimulating(true);
    setErrorMsg(null);
    const activeRef = actions[0]?.external_ref_id || `plink_${c.id}`;
    try {
      await onSimulatePayment(c.id, activeRef, c.amount);
    } catch (error) {
      setErrorMsg(
        error.status === 403
          ? 'Access denied: You do not have permission to trigger this recovery action.'
          : error.message || 'Payment simulation failed.'
      );
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="glass-card bg-slate-900 border-slate-700 w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
              #{c.id}
            </span>
            <div className="flex items-center gap-2">
              {getStatusBadge(c.status)}
              {getRiskBadge(c.risk_level, c.risk_score)}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Grid: Case Financials & Customer Profile */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Financial Overview */}
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Revenue At Risk Breakdown
              </span>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="font-heading text-3xl font-extrabold text-white">
                  ₹{c.amount?.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-slate-400 font-mono">INR</span>
              </div>
              {c.status === 'RECOVERED' ? (
                <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Fully Recovered ₹{c.recovered_amount?.toLocaleString('en-IN')} via {c.recovery_method?.toUpperCase()}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Revenue pending recovery — Attempts: {c.attempts_count || 0}</span>
                </div>
              )}
            </div>

            {/* Customer Dossier */}
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Customer Context & LTV
              </span>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-200 text-xs">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{c.customer_name}</h4>
                  <p className="text-xs text-slate-400 font-mono">{c.customer_email} | {c.customer_phone}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                <div>
                  <span className="text-slate-500">Customer LTV: </span>
                  <strong className="text-slate-200">₹{(c.customer_ltv || 0).toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Channel: </span>
                  <strong className="text-slate-200">{c.preferred_channel || 'WHATSAPP'}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* AI Diagnostic Agent Output */}
          <div className="glass-card p-5 border-purple-500/30 bg-purple-950/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                <div>
                  <h4 className="text-sm font-heading font-bold text-white">
                    AI Diagnostic Agent (Gemini Flash Recommender)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Model: {diagnosis.model_used || 'gemini-2.5-flash'} {diagnosis.fallback_used ? '(Fallback Active)' : '(Active)'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {diagnosis.recovery_priority && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                    diagnosis.recovery_priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                    diagnosis.recovery_priority === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  }`}>
                    {diagnosis.recovery_priority} PRIORITY
                  </span>
                )}
                <span className="text-xs font-mono text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded border border-purple-500/20 font-semibold">
                  Confidence: {diagnosis.confidence ? `${(diagnosis.confidence * 100).toFixed(0)}%` : '92%'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Root-Cause Diagnosis: </span>
                <span className="font-mono font-bold text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded ml-1">
                  {c.root_cause || diagnosis.root_cause || 'TRANSIENT_ISSUER_OUTAGE'}
                </span>
              </div>

              <p className="text-slate-300 leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-purple-900/30">
                {diagnosis.reasoning || 'Automated AI root cause analysis indicated a transient failure during authentication.'}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div>
                  <span className="text-slate-400">Recommended Action: </span>
                  <strong className="text-emerald-400 font-mono ml-1">{c.recommended_action || diagnosis.recommended_action}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Channel: </span>
                  <strong className="text-slate-200 font-mono ml-1">{diagnosis.suggested_channel || 'WHATSAPP'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Delay: </span>
                  <strong className="text-indigo-300 font-mono ml-1">{diagnosis.optimal_delay_hours ? `${diagnosis.optimal_delay_hours} Hours` : 'Immediate'}</strong>
                </div>
              </div>

              {diagnosis.customer_messaging && (
                <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-slate-300">
                  <span className="text-[10px] font-mono text-slate-500 uppercase block mb-1">Customer Messaging Template:</span>
                  <p className="italic font-sans text-slate-300">"{diagnosis.customer_messaging}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Policy & Safety Engine (The Guardrail) */}
          <div className="glass-card p-5 border-emerald-500/30 bg-emerald-950/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-heading font-bold text-white">
                  Policy & Safety Engine Guardrail Evaluation
                </h4>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${
                c.policy_decision === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                DECISION: {c.policy_decision || 'APPROVED'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              {policyChecks.map((chk, i) => (
                <div key={i} className="flex items-start gap-2 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
                  {chk.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-200 block text-[11px]">{chk.rule}</span>
                    <span className="text-slate-400 text-[10px]">{chk.detail || (chk.passed ? 'Guardrail passed' : 'Ceiling reached')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canTriggerManualAction && (
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-heading font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  Active Recovery Tools & Simulation Testbed
                </h4>
                {actions[0]?.external_ref_id && (
                  <span className="font-mono text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    Ref: {actions[0].external_ref_id}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div>
                  <h5 className="text-xs font-bold text-slate-200 mb-1">
                    Simulate Closed-Loop Customer Payment
                  </h5>
                  <p className="text-xs text-slate-400 max-w-md">
                    Simulate the customer completing payment on the Razorpay Payment Link or Recovery Order. Verifies closed loop and settles revenue.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {c.status !== 'RECOVERED' ? (
                    <button
                      onClick={handleSimulatePay}
                      disabled={simulating || loading}
                      className="btn-primary text-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{simulating ? 'Verifying Gateway...' : 'Simulate Customer Payment'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-4 h-4" />
                      <span>Payment Verified & Closed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Granular Execution Timeline Audit Trail */}
          <div className="pt-2">
            <ExecutionTimeline timeline={timeline} />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs text-rose-300">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            RecoverAI Autonomous Engine • Hash-Chained Audit Trail
          </span>
          <button onClick={onClose} className="btn-secondary text-xs">
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
