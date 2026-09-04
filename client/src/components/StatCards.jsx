import React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Cpu, ArrowUpRight } from 'lucide-react';

export default function StatCards({ metrics }) {
  const atRisk = metrics?.revenueAtRisk ?? 168497;
  const recovered = metrics?.totalRevenueRecovered ?? 15998;
  const rate = metrics?.recoverySuccessRate ?? 42.9;
  const activeCases = metrics?.activeCases ?? 3;
  const recoveredCases = metrics?.recoveredCases ?? 3;
  const escalatedCases = metrics?.escalatedCases ?? 1;
  const queuePending = metrics?.queue?.pending ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Revenue at Risk */}
      <div className="glass-panel glass-panel-glow-amber p-5 flex flex-col justify-between relative overflow-hidden bg-[#111827] border border-[#1F2937] rounded-xl shadow-lg">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Revenue at Risk
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Amber Warning
            </span>
          </div>
          <div className="flex items-baseline gap-1 my-2">
            <span className="font-heading text-3xl font-extrabold text-white tracking-tight">
              ₹{atRisk.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-200 font-mono">{activeCases} Active Cases</strong> (Razorpay failed charges & 3DS drop-offs)
          </p>
          <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(20, activeCases * 20))}%` }}></div>
          </div>
        </div>
      </div>

      {/* 2. Revenue Recovered */}
      <div className="glass-panel glass-panel-glow-emerald p-5 flex flex-col justify-between relative overflow-hidden bg-[#111827] border border-[#1F2937] rounded-xl shadow-lg">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Revenue Recovered
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              Emerald Success
            </span>
          </div>
          <div className="flex items-baseline gap-1 my-2">
            <span className="font-heading text-3xl font-extrabold text-emerald-400 tracking-tight">
              ₹{recovered.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-emerald-300 font-mono">+{recoveredCases} Settled</strong> autonomously via Payment Links & Retries
          </p>
          <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, rate)}%` }}></div>
          </div>
        </div>
      </div>

      {/* 3. Recovery Success Rate */}
      <div className="glass-panel p-5 flex flex-col justify-between relative overflow-hidden bg-[#111827] border border-[#1F2937] rounded-xl shadow-lg">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Recovery Success Rate
            </span>
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Target: 75%
            </span>
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-heading text-3xl font-extrabold text-white tracking-tight">
              {rate}%
            </span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center font-mono">
              <ArrowUpRight className="w-3.5 h-3.5" /> High Precision
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Outcome verification closed-loop rate across all attempts
          </p>
          <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full" style={{ width: `${Math.min(100, rate)}%` }}></div>
          </div>
        </div>
      </div>

      {/* 4. Guardrails & Ingestion */}
      <div className="glass-panel p-5 flex flex-col justify-between relative overflow-hidden bg-[#111827] border border-[#1F2937] rounded-xl shadow-lg">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              Guardrails & Ingestion
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              100% Audit Compliant
            </span>
          </div>
          <div className="flex items-baseline gap-2 my-2">
            <span className="font-heading text-3xl font-extrabold text-white tracking-tight">
              6/6 Active
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Queue: <strong className="text-gray-200 font-mono">{queuePending} pending</strong> | Escalated: <strong className="text-gray-200 font-mono">{escalatedCases}</strong>
          </p>
          <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-cyan-400 h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
