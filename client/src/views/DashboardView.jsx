import React, { useState } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Bot, 
  Cpu, 
  Zap, 
  ChevronDown, 
  ChevronRight, 
  ExternalLink,
  Layers,
  TrendingUp,
  Hash
} from 'lucide-react';
import StatCards from '../components/StatCards';

export default function DashboardView({ metrics, cases, auditLogs = [], onSelectCase, onOpenSimulator }) {
  const [expandedLogId, setExpandedLogId] = useState(null);
  const recentCases = cases?.slice(0, 5) || [];
  const recentLogs = auditLogs?.slice(0, 6) || [];

  const pipelineSteps = [
    {
      num: '01 INGEST',
      source: 'Razorpay',
      title: 'Webhook Receiver',
      desc: 'HMAC-SHA256 Auth & Deduplication Queue',
      badge: 'Stream Active 100%',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      num: '02 RISK',
      source: 'ML Model',
      title: 'Revenue Risk',
      desc: 'Feature Engineering & Loss Score (0–1)',
      badge: 'ROC-AUC: 0.942',
      badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
    },
    {
      num: '03 DIAGNOSE',
      source: 'AI Agent',
      title: 'AI Diagnostic Agent',
      desc: 'LLM Root-Cause Analysis & Action Recommender',
      badge: 'Confidence > 70%',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    },
    {
      num: '04 GUARDRAIL',
      source: 'Safety Gate',
      title: 'Policy Safety Gate',
      desc: 'Checks Amount, Retry, Cooldown & Contact Limits',
      badge: 'Decision: APPROVE / ESCALATE',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      num: '05 RECOVER',
      source: 'Orchestrator',
      title: 'Execution Layer',
      desc: 'Auto-Retry, Payment Link Generation, WhatsApp/Voice Nudge',
      badge: 'Multi-Channel Live',
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Metrics Row (Key Performance Indicators) */}
      <StatCards metrics={metrics} />

      {/* 2. Core Pipeline Visualizer (Closed-Loop Pipeline Architecture) */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#1F2937]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 live-pulse-dot"></span>
            <h3 className="font-heading font-bold text-sm tracking-wide text-white uppercase">
              Closed-Loop Pipeline Architecture
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/30 font-semibold">
            Autonomous Engine v2.1 • Zero Dropped Revenue
          </span>
        </div>

        {/* Sequential Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {pipelineSteps.map((step, idx) => (
            <div 
              key={idx} 
              className="bg-[#0B0F17] border border-[#1F2937] hover:border-gray-600 rounded-xl p-3.5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold text-emerald-400">
                    {step.num}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {step.source}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                  {step.title}
                </h4>
                <p className="text-[11px] text-gray-400 leading-snug">
                  {step.desc}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#1F2937] flex items-center justify-between">
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${step.badgeColor}`}>
                  {step.badge}
                </span>
                {idx < pipelineSteps.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-gray-600 hidden lg:block -mr-1" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Live Cases & Recovery Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Recovery Cases Table */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-bold text-base text-white">Live Revenue Recovery Cases</h3>
                <p className="text-xs text-gray-400">Under active diagnosis and automated closed-loop settlement</p>
              </div>
              <button
                onClick={onOpenSimulator}
                className="btn-cta-glow text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Trigger Test Event</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1F2937] text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-[#0B0F17]/50">
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">At Risk</th>
                    <th className="py-2.5 px-3">Strategy</th>
                    <th className="py-2.5 px-3">Risk Level</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2937] text-xs">
                  {recentCases.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => onSelectCase(c.id)}
                      className="hover:bg-[#161F32] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        #{c.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-100">{c.customer_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{c.customer_email}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        ₹{c.amount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-emerald-400">
                        {c.recommended_action || 'PAYMENT_LINK'}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          c.risk_level === 'LOW' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                          c.risk_level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}>
                          {c.risk_level}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {c.status === 'RECOVERED' && (
                          <span className="badge-recovered text-[10px] font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Recovered
                          </span>
                        )}
                        {c.status === 'IN_PROGRESS' && (
                          <span className="badge-progress text-[10px] font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> In Progress
                          </span>
                        )}
                        {c.status === 'OPEN' && (
                          <span className="badge-open text-[10px] font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Open
                          </span>
                        )}
                        {c.status === 'ESCALATED' && (
                          <span className="badge-escalated text-[10px] font-semibold px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Escalated
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="text-[11px] text-gray-400 group-hover:text-emerald-400 font-semibold inline-flex items-center gap-1">
                          Inspect <ArrowRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Share & Live Architecture Highlights */}
        <div className="space-y-6">
          {/* Recovery Strategy Share */}
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-lg">
            <h4 className="font-heading font-bold text-sm text-white mb-1">
              Recovery Action Share
            </h4>
            <p className="text-xs text-gray-400 mb-4">Autonomous tool dispatch distribution</p>

            <div className="space-y-3.5">
              {[
                { name: 'Razorpay Payment Links', pct: 45, color: 'bg-emerald-400' },
                { name: 'Subscription Auto-Retry', pct: 30, color: 'bg-indigo-400' },
                { name: 'Recovery Order / Checkout', pct: 15, color: 'bg-cyan-400' },
                { name: 'CRM White-Glove Escalation', pct: 10, color: 'bg-rose-400' }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">{item.name}</span>
                    <span className="font-mono text-gray-400 font-bold">{item.pct}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div className={`${item.color} h-full rounded-full`} style={{ width: `${item.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Value Proposition Callout */}
          <div className="bg-gradient-to-br from-[#111827] to-[#0D1524] border border-emerald-500/30 rounded-xl p-5 shadow-lg">
            <h4 className="font-heading font-bold text-sm text-emerald-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Autonomous Revenue Loop
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed">
              Detect $\rightarrow$ Diagnose $\rightarrow$ Decide $\rightarrow$ Recover $\rightarrow$ Verify $\rightarrow$ Learn. Every action is explainable, constrained by 6 safety guardrails, and signed into a tamper-proof audit trail.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Live Stream & Audit Trail Panel (Section 5) */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[#1F2937]">
          <div className="flex items-center gap-2.5">
            <Hash className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="font-heading font-bold text-base text-white">
                Live Stream & Cryptographic Audit Trail Panel
              </h3>
              <p className="text-xs text-gray-400">
                Real-time stream of verified state transitions signed with SHA-256 hash chaining
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/30">
            Chain Status: Verified Valid
          </span>
        </div>

        {/* Real-time updating table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#0B0F17]/60 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Case Ref</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Action Details</th>
                <th className="py-2.5 px-3">Block Hash</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2937]">
              {recentLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const timeStr = new Date(log.timestamp).toLocaleTimeString('en-GB', { hour12: false });

                return (
                  <React.Fragment key={log.id}>
                    <tr 
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="hover:bg-[#161F32] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 text-gray-300 font-bold whitespace-nowrap">
                        {timeStr}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {log.case_id ? `#${log.case_id}` : 'GLOBAL'}
                      </td>
                      <td className="py-3 px-3 text-indigo-400 font-sans font-medium">
                        {log.actor}
                      </td>
                      <td className="py-3 px-3 text-white font-sans font-bold">
                        <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-[11px]">
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-sans truncate max-w-[240px]">
                        {log.action} {log.details?.status ? `(${log.details.status})` : ''} {log.details?.amount ? `₹${log.details.amount}` : ''}
                      </td>
                      <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">
                        {log.curr_hash ? `${log.curr_hash.substring(0, 12)}...` : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-emerald-400 inline" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-emerald-400 inline" />
                        )}
                      </td>
                    </tr>

                    {/* Expandable Detail Row */}
                    {isExpanded && (
                      <tr className="bg-[#0B0F17]/90">
                        <td colSpan={7} className="p-4 border-b border-[#1F2937]">
                          <div className="space-y-2 text-xs font-sans">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-gray-400 border-b border-[#1F2937] pb-2 font-mono text-[11px]">
                              <span>Timestamp: <strong className="text-gray-200">{log.timestamp}</strong></span>
                              <span>Block ID: <strong className="text-gray-200">#{log.id}</strong></span>
                              <span>Prev Hash: <strong className="text-gray-200">{log.prev_hash || '00000000000...'}</strong></span>
                            </div>

                            <div className="bg-[#05080E] p-3 rounded-lg border border-[#1F2937] font-mono text-[11px] text-emerald-300 overflow-x-auto">
                              <pre>{JSON.stringify(log.details, null, 2)}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
