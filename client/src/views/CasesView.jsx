import React, { useState } from 'react';
import { Search, Filter, Layers, ArrowUpDown, ChevronRight, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export default function CasesView({ cases = [], onSelectCase }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');

  const filteredCases = cases.filter(c => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (riskFilter !== 'ALL' && c.risk_level !== riskFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = c.id?.toLowerCase().includes(q);
      const matchName = c.customer_name?.toLowerCase().includes(q);
      const matchEmail = c.customer_email?.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchEmail) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="glass-card p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-heading font-bold text-lg text-white">Recovery Cases Directory</h3>
            <p className="text-xs text-slate-400">
              Browse, inspect diagnostic dossiers, and track closed-loop revenue verification
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ID, name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
          </div>

          {['ALL', 'OPEN', 'IN_PROGRESS', 'RECOVERED', 'ESCALATED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}

          <div className="h-4 w-[1px] bg-slate-800 mx-2 hidden sm:block"></div>

          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium mr-2">
            <span>Risk:</span>
          </div>

          {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                riskFilter === r
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Root Cause</th>
                <th className="py-3 px-4">AI Recommended Action</th>
                <th className="py-3 px-4">Risk Level</th>
                <th className="py-3 px-4">Guardrail Decision</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Dossier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No recovery cases matched the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c.id)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                      #{c.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{c.customer_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.customer_email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      ₹{c.amount?.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {c.root_cause || 'TRANSIENT_ISSUER_OUTAGE'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-emerald-400 font-medium">
                        {c.recommended_action || 'PAYMENT_LINK'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`badge ${
                        c.risk_level === 'LOW' ? 'badge-risk-low' : c.risk_level === 'MEDIUM' ? 'badge-risk-medium' : 'badge-risk-high'
                      }`}>
                        {c.risk_level} ({(c.risk_score * 100).toFixed(0)}%)
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                        c.policy_decision === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {c.policy_decision || 'APPROVED'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {c.status === 'RECOVERED' && <span className="badge badge-recovered">Recovered</span>}
                      {c.status === 'IN_PROGRESS' && <span className="badge badge-progress">In Progress</span>}
                      {c.status === 'OPEN' && <span className="badge badge-open">Open</span>}
                      {c.status === 'ESCALATED' && <span className="badge badge-escalated">Escalated</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 inline" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
