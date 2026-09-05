import React, { useState } from 'react';
import { X, Zap, RefreshCw, CheckCircle2, Play, Layers, AlertTriangle } from 'lucide-react';

export default function WebhookSimulatorModal({ onClose, onSimulateWebhook, onRunDemoBatch }) {
  const [scenario, setScenario] = useState('P001_3DS_AUTH');
  const [amount, setAmount] = useState('2499');
  const [customerName, setCustomerName] = useState('Priya Sharma');
  const [customerEmail, setCustomerEmail] = useState('priya.p001@example.com');
  const [customerPhone, setCustomerPhone] = useState('+919820011001');
  const [isSubscription, setIsSubscription] = useState(false);
  const [errorCode, setErrorCode] = useState('AUTHENTICATION_FAILED');
  const [attempts, setAttempts] = useState(1);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState(null);

  const presetScenarios = [
    {
      id: 'P001_3DS_AUTH',
      title: 'P001: 3DS Auth Drop (₹2,499)',
      desc: '3DS OTP abandoned. AI recommends PAYMENT_LINK via WhatsApp. Outcome: RECOVERED.',
      amount: '2499',
      isSubscription: false,
      code: 'AUTHENTICATION_FAILED',
      attempts: 1,
      targetAction: 'PAYMENT_LINK'
    },
    {
      id: 'P002_GATEWAY_ERR',
      title: 'P002: Gateway Error (₹8,500)',
      desc: 'Transient acquirer switch timeout. AI recommends RETRY_PAYMENT. Outcome: RECOVERED.',
      amount: '8500',
      isSubscription: false,
      code: 'GATEWAY_ERROR',
      attempts: 1,
      targetAction: 'RETRY_PAYMENT'
    },
    {
      id: 'P003_INSUFFICIENT',
      title: 'P003: Insufficient Funds (₹3,200)',
      desc: 'Subscription debit rejected. AI recommends DELAY_AND_RETRY. Outcome: RECOVERED.',
      amount: '3200',
      isSubscription: true,
      code: 'INSUFFICIENT_FUNDS',
      attempts: 1,
      targetAction: 'DELAY_AND_RETRY'
    },
    {
      id: 'P004_HIGH_RISK',
      title: 'P004: High-Risk Limit (₹1,45,000)',
      desc: 'Ticket size breaches ₹50,000 safety ceiling. AI recommends ESCALATE_TO_HUMAN. Outcome: ESCALATED.',
      amount: '145000',
      isSubscription: false,
      code: 'GATEWAY_ERROR',
      attempts: 1,
      targetAction: 'ESCALATE_TO_HUMAN'
    },
    {
      id: 'P005_RETRY_LIMIT',
      title: 'P005: Retry Exhausted (₹5,000)',
      desc: '3 prior failed attempts. Policy ceiling reached. AI recommends STOP_RECOVERY. Outcome: STOPPED.',
      amount: '5000',
      isSubscription: false,
      code: 'CARD_EXPIRED',
      attempts: 3,
      targetAction: 'STOP_RECOVERY'
    }
  ];

  const handleSelectPreset = (p) => {
    setScenario(p.id);
    setAmount(p.amount);
    setIsSubscription(p.isSubscription);
    setErrorCode(p.code);
    setAttempts(p.attempts || 1);
  };

  const handleFireWebhook = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setBatchResult(null);
    setError(null);

    try {
      const payload = {
        scenario,
        amount: parseFloat(amount) || 2499,
        customerName,
        customerEmail,
        customerPhone,
        isSubscription,
        errorCode,
        attempts: parseInt(attempts, 10) || 1
      };

      const res = await onSimulateWebhook(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Webhook simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatch = async () => {
    if (!onRunDemoBatch) return;
    setBatchLoading(true);
    setResult(null);
    setBatchResult(null);
    setError(null);

    try {
      const res = await onRunDemoBatch();
      setBatchResult(res);
    } catch (err) {
      setError(err.message || 'Batch execution failed.');
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="glass-card bg-slate-900 border-slate-700 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">Razorpay Webhook Sandbox & Batch Demo</h3>
              <p className="text-xs text-slate-400">Inject failure events through Risk Engine $\rightarrow$ AI Agent $\rightarrow$ Policy Engine $\rightarrow$ Orchestrator</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Benchmark Batch Trigger */}
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                <Layers className="w-4 h-4" />
                <span>Section 10 Batch Benchmark Suite (P001 – P005)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Automatically execute all 5 benchmark scenarios (Payment Link, Retry, Delay, Escalate, Stop) and verify live revenue outcomes.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunBatch}
              disabled={batchLoading || loading}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 whitespace-nowrap shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              {batchLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run 5-Case Benchmark</span>
                </>
              )}
            </button>
          </div>

          {/* Batch Result Display */}
          {batchResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Batch Benchmark Completed ({batchResult.batchSize} Cases)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {batchResult.mode}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 bg-slate-900/80 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">Revenue at Risk</span>
                  <strong className="text-white font-mono">₹{batchResult.summary?.totalRevenueAtRisk?.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 block">Recovered Revenue</span>
                  <strong className="text-emerald-400 font-mono">₹{batchResult.summary?.recoveredRevenue?.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-400 block">Recovery Rate</span>
                  <strong className="text-indigo-300 font-mono">{batchResult.summary?.recoveryRate}</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="py-1 px-2">Payment</th>
                      <th className="py-1 px-2">Amount</th>
                      <th className="py-1 px-2">AI Action</th>
                      <th className="py-1 px-2">Policy</th>
                      <th className="py-1 px-2">Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {batchResult.results?.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-900/50">
                        <td className="py-1.5 px-2 font-bold text-slate-200">#{r.caseId}</td>
                        <td className="py-1.5 px-2 text-slate-300">₹{r.amount?.toLocaleString('en-IN')}</td>
                        <td className="py-1.5 px-2 text-purple-300">{r.aiDiagnosis?.recommendedAction}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            r.policyDecision === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                          }`}>
                            {r.policyDecision}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 font-bold">
                          <span className={
                            r.finalResult === 'RECOVERED' ? 'text-emerald-400' : r.finalResult === 'ESCALATED' ? 'text-amber-400' : 'text-slate-400'
                          }>
                            {r.finalResult}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Form Body for Single Simulation */}
          <form onSubmit={handleFireWebhook} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Or Simulate Individual Payment Scenario:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {presetScenarios.map((p) => {
                  const isSelected = scenario === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-white shadow-sm ring-1 ring-emerald-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="text-xs font-bold">{p.title}</h5>
                        <span className="font-mono text-[10px] text-slate-400">₹{parseInt(p.amount).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-tight">{p.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Error Code</label>
                <input
                  type="text"
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Prior Attempts</label>
                <input
                  type="number"
                  value={attempts}
                  onChange={(e) => setAttempts(e.target.value)}
                  min="1"
                  max="5"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
                {error}
              </div>
            )}

            {result && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simulated webhook ingested! Case ref: <strong>#{result.caseId || result.eventId}</strong></span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading || batchLoading}
                className="btn-primary text-xs flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Fire Simulated Webhook</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
