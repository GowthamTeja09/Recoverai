import React from 'react';
import { Shield, Activity, Layers, ShieldCheck, CheckCircle2, Zap, Terminal, PlusCircle, RefreshCw } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, currentRole, setCurrentRole, onOpenSimulator, onOpenBatch }) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'cases', label: 'Recovery Cases', icon: Layers },
    { id: 'policies', label: 'Safety Guardrails', icon: ShieldCheck },
    { id: 'audit', label: 'Audit Trail', icon: CheckCircle2 },
    { id: 'models', label: 'Model Registry', icon: Zap },
    { id: 'integrations', label: 'Integrations', icon: Terminal }
  ];

  const roles = [
    { id: 'SUPER_ADMIN', label: 'Super Admin' },
    { id: 'MERCHANT_OPERATOR', label: 'Merchant Operator' },
    { id: 'RISK_OFFICER', label: 'Risk Officer' },
    { id: 'SUPPORT_AGENT', label: 'Support Agent' }
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#1F2937] bg-[#0B0F17]/95 backdrop-blur-md px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Navigation */}
        <div className="flex flex-wrap items-center gap-6 w-full md:w-auto justify-between md:justify-start">
          {/* Brand Badge */}
          <div 
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  Recover<span className="text-emerald-400">AI</span>
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-pulse-dot"></span>
                  Live
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono tracking-wide">
                v2.1 Enterprise • Autonomous Revenue Recovery
              </p>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-[#1F2937] overflow-x-auto max-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-[#1F2937] text-white shadow-sm border border-gray-700'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#161F32]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-gray-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Action Header Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Simulate Webhook (Primary CTA Button with glowing hover effect) */}
          <button
            onClick={onOpenSimulator}
            className="btn-cta-glow text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer"
            title="Inject real-time Razorpay failure webhooks into the pipeline"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Webhook</span>
          </button>

          {/* Batch Ingest (Secondary Outline Button) */}
          <button
            onClick={onOpenBatch}
            className="bg-transparent hover:bg-[#1F2937] text-gray-200 border border-[#1F2937] hover:border-gray-600 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Ingest historical batch data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            <span>Batch Ingest</span>
          </button>

          {/* Role Selector Dropdown */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-[#1F2937]">
            <span className="text-[11px] text-gray-400 hidden xl:inline font-mono">Role:</span>
            <select
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              className="bg-[#111827] border border-[#1F2937] text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
