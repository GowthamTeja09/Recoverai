import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Cpu, 
  Bot, 
  ShieldCheck, 
  Send, 
  DollarSign, 
  ChevronDown, 
  ChevronRight, 
  Hash,
  Copy,
  Check
} from 'lucide-react';

export default function ExecutionTimeline({ timeline = [] }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);

  const getStepVisuals = (eventType) => {
    switch (eventType) {
      case 'EVENT_RECEIVED':
      case 'WEBHOOK_RECEIVED':
        return {
          icon: Clock,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10 border-amber-500/30',
          label: 'Event Received'
        };
      case 'RISK_SCORED':
        return {
          icon: Cpu,
          color: 'text-indigo-400',
          bgColor: 'bg-indigo-500/10 border-indigo-500/30',
          label: 'Risk Scored'
        };
      case 'ACTION_RECOMMENDED':
        return {
          icon: Bot,
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10 border-purple-500/30',
          label: 'Action Recommended'
        };
      case 'POLICY_DECISION':
        return {
          icon: ShieldCheck,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10 border-emerald-500/30',
          label: 'Policy Decision'
        };
      case 'ACTION_INITIATED':
      case 'NOTIFICATION_SENT':
        return {
          icon: Send,
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10 border-cyan-500/30',
          label: 'Action Initiated'
        };
      case 'OUTCOME_VERIFIED':
        return {
          icon: CheckCircle2,
          color: 'text-teal-400',
          bgColor: 'bg-teal-500/10 border-teal-500/30',
          label: 'Outcome Verified'
        };
      case 'REVENUE_RECOVERED':
        return {
          icon: DollarSign,
          color: 'text-emerald-300',
          bgColor: 'bg-emerald-500/20 border-emerald-500/40',
          label: 'Revenue Recovered'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-slate-300',
          bgColor: 'bg-slate-800 border-slate-700',
          label: eventType.replace(/_/g, ' ')
        };
    }
  };

  const formatTimestamp = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '14:32:00';
    }
  };

  const handleCopy = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  if (!timeline || timeline.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        No execution timeline logs recorded for this event yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Hash className="w-4 h-4 text-emerald-400" />
          Audit Trail Execution Timeline (Immutable SHA-256 Chain)
        </h4>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          {timeline.length} Verified Transitions
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-amber-500/40 via-indigo-500/40 to-emerald-500/50">
        {timeline.map((step, idx) => {
          const visual = getStepVisuals(step.event_type);
          const Icon = visual.icon;
          const isExpanded = expandedIndex === idx;
          const formattedTime = formatTimestamp(step.timestamp);

          return (
            <div key={step.id || idx} className="relative group">
              {/* Timeline Node Icon */}
              <div className={`absolute -left-6 top-1 w-6 h-6 rounded-full flex items-center justify-center border ${visual.bgColor} bg-slate-950 shadow-sm transition-transform group-hover:scale-110`}>
                <Icon className={`w-3.5 h-3.5 ${visual.color}`} />
              </div>

              {/* Step Card */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 transition-all hover:border-slate-700">
                <div 
                  className="flex items-center justify-between cursor-pointer select-none"
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
                      {formattedTime}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {visual.label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                      actor: <strong className="text-slate-300">{step.actor}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick Summary Pill */}
                    {step.details && (
                      <span className="text-[11px] text-slate-400 font-medium max-w-[280px] truncate hidden md:inline">
                        {step.details.status && `status: ${step.details.status} | `}
                        {step.details.action && `action: ${step.details.action} | `}
                        {step.details.tool && `tool: ${step.details.tool} | `}
                        {step.details.decision && `decision: ${step.details.decision} | `}
                        {step.details.amount && `₹${step.details.amount.toLocaleString('en-IN')}`}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                    )}
                  </div>
                </div>

                {/* Expanded Payload & Cryptographic Block Hash */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2.5 text-xs animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                      <div>
                        <span className="text-slate-500 font-mono">Action: </span>
                        <span className="font-medium text-slate-200">{step.action}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-mono">Timestamp: </span>
                        <span className="font-mono text-slate-400">{step.timestamp}</span>
                      </div>
                    </div>

                    {/* JSON Details */}
                    {step.details && (
                      <div className="bg-slate-950 rounded-lg p-2.5 border border-slate-800 font-mono text-[11px] overflow-x-auto text-emerald-300">
                        <pre>{JSON.stringify(step.details, null, 2)}</pre>
                      </div>
                    )}

                    {/* Cryptographic Hash Block info */}
                    <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600">Block Hash:</span>
                        <span className="text-slate-400">{step.curr_hash ? `${step.curr_hash.substring(0, 16)}...` : 'N/A'}</span>
                        {step.curr_hash && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCopy(step.curr_hash); }}
                            className="p-1 hover:text-white" 
                            title="Copy full SHA-256 hash"
                          >
                            {copiedHash === step.curr_hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-600">Prev Hash:</span>
                        <span className="text-slate-400">{step.prev_hash ? `${step.prev_hash.substring(0, 12)}...` : '00000000...'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
