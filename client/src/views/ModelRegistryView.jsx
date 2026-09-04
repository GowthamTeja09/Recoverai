import React, { useState } from 'react';
import { Zap, Cpu, Sparkles, CheckCircle2, TrendingUp, BarChart2, Play, Terminal } from 'lucide-react';

export default function ModelRegistryView({ models = [] }) {
  // AI Diagnostic Sandbox state
  const [testAmount, setTestAmount] = useState('8500');
  const [testErrorCode, setTestErrorCode] = useState('AUTHENTICATION_FAILED');
  const [testLtv, setTestLtv] = useState('50000');
  const [testIsSub, setTestIsSub] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleRunTest = (e) => {
    e.preventDefault();
    const amt = parseFloat(testAmount) || 8500;
    const ltv = parseFloat(testLtv) || 50000;

    let score = 0.40;
    if (amt > 50000) score += 0.30;
    if (testErrorCode === 'INSUFFICIENT_FUNDS') score += 0.18;
    if (testErrorCode === 'GATEWAY_ERROR') score -= 0.12;
    if (ltv > 50000) score -= 0.10;
    score = Math.min(0.98, Math.max(0.05, score));

    let action = 'PAYMENT_LINK';
    let channel = 'WHATSAPP';
    if (amt > 50000) {
      action = 'ESCALATE';
      channel = 'CRM_TICKET';
    } else if (testIsSub) {
      action = testErrorCode === 'GATEWAY_ERROR' ? 'SUBSCRIPTION_RETRY' : 'PAYMENT_LINK';
    }

    setTestResult({
      risk_score: score.toFixed(2),
      risk_level: score >= 0.8 ? 'CRITICAL' : score >= 0.6 ? 'HIGH' : score >= 0.35 ? 'MEDIUM' : 'LOW',
      recommended_action: action,
      suggested_channel: channel,
      confidence: 0.93,
      reasoning: `Context analyzed: Amount ₹${amt}, Error: ${testErrorCode}, LTV: ₹${ltv}. Strategy '${action}' selected.`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 border-purple-500/30 bg-purple-950/10">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-5 h-5 text-purple-400" />
          <h3 className="font-heading font-bold text-lg text-white">Model Registry & Active Learning</h3>
        </div>
        <p className="text-xs text-slate-300">
          Track production ML models, version deployments, validation metrics (ROC-AUC, Precision, Recall), and evaluate diagnostic reasoning.
        </p>
      </div>

      {/* Model Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {models.map((m) => (
          <div key={m.id} className="glass-card p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {m.model_type}
                </span>
                <h4 className="font-heading font-bold text-sm text-white mt-2 mb-0.5">{m.name}</h4>
                <span className="text-xs font-mono text-slate-400">{m.version}</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 live-pulse"></span>
            </div>

            {/* Metrics */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">ROC-AUC / Acc:</span>
                <strong className="font-mono text-emerald-400">{m.metrics?.roc_auc || m.metrics?.accuracy || 0.94}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Precision:</span>
                <strong className="font-mono text-indigo-400">{m.metrics?.precision || '91.5%'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recall / Latency:</span>
                <strong className="font-mono text-cyan-400">{m.metrics?.recall || `${m.metrics?.avg_latency_ms || 180}ms`}</strong>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Status: <span className="text-slate-300">{m.status}</span> • Deployed: <span className="text-slate-400">{m.deployed_at ? m.deployed_at.substring(0, 10) : '2026-09-01'}</span>
            </div>
          </div>
        ))}
      </div>

      {/* AI Diagnostic Sandbox */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h4 className="font-heading font-bold text-base text-white">AI Diagnostic & Risk Scoring Sandbox</h4>
        </div>
        <p className="text-xs text-slate-400">
          Simulate risk scoring and structured recovery recommendation on hypothetical failure conditions:
        </p>

        <form onSubmit={handleRunTest} className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Transaction Amount (₹)</label>
            <input
              type="number"
              value={testAmount}
              onChange={(e) => setTestAmount(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Failure Error Code</label>
            <select
              value={testErrorCode}
              onChange={(e) => setTestErrorCode(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            >
              <option value="AUTHENTICATION_FAILED">AUTHENTICATION_FAILED (3DS Drop)</option>
              <option value="GATEWAY_ERROR">GATEWAY_ERROR (Network Timeout)</option>
              <option value="INSUFFICIENT_FUNDS">INSUFFICIENT_FUNDS (Liquidity)</option>
              <option value="CARD_EXPIRED">CARD_EXPIRED (Hard Decline)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">Customer LTV (₹)</label>
            <input
              type="number"
              value={testLtv}
              onChange={(e) => setTestLtv(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
            />
          </div>

          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full text-xs py-2">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Diagnostic</span>
            </button>
          </div>
        </form>

        {testResult && (
          <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/40 text-xs space-y-2 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Risk Score:</span>
                <strong className="font-mono text-white">{testResult.risk_score} ({testResult.risk_level})</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Recommended Action:</span>
                <strong className="font-mono text-emerald-400">{testResult.recommended_action}</strong>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Channel:</span>
                <strong className="font-mono text-purple-300">{testResult.suggested_channel}</strong>
              </div>
            </div>
            <p className="text-slate-300 font-sans">{testResult.reasoning}</p>
          </div>
        )}
      </div>
    </div>
  );
}
