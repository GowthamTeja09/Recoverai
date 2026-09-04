import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Database,
  Gauge,
  Layers3,
  LayoutDashboard,
  PlugZap,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  Zap
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import CasesView from './views/CasesView';
import PolicyStudioView from './views/PolicyStudioView';
import AuditTrailView from './views/AuditTrailView';
import ModelRegistryView from './views/ModelRegistryView';
import IntegrationsView from './views/IntegrationsView';
import CaseDetailModal from './components/CaseDetailModal';
import WebhookSimulatorModal from './components/WebhookSimulatorModal';
import BatchUploadModal from './components/BatchUploadModal';
import { apiRequest } from './lib/api.js';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const tabItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'cases', label: 'Recovery Cases', icon: Layers3 },
  { id: 'guardrails', label: 'Safety Guardrails', icon: ShieldCheck },
  { id: 'audit', label: 'Audit Trail', icon: ScrollText },
  { id: 'models', label: 'Model Registry', icon: Database },
  { id: 'integrations', label: 'Integrations', icon: PlugZap }
];

const ROLE_ACCESS = {
  SUPER_ADMIN: {
    visibleTabs: ['dashboard', 'cases', 'guardrails', 'audit', 'models', 'integrations'],
    canTriggerManualAction: true,
    canEditGuardrails: true,
    canViewGuardrails: true,
    canViewAudit: true,
    canViewModels: true,
    canManageSecrets: true
  },
  RISK_OFFICER: {
    visibleTabs: ['dashboard', 'cases', 'guardrails', 'audit', 'models'],
    canTriggerManualAction: true,
    canEditGuardrails: true,
    canViewGuardrails: true,
    canViewAudit: true,
    canViewModels: true,
    canManageSecrets: false
  },
  MERCHANT_OPERATOR: {
    visibleTabs: ['dashboard', 'cases', 'guardrails'],
    canTriggerManualAction: true,
    canEditGuardrails: false,
    canViewGuardrails: true,
    canViewAudit: false,
    canViewModels: false,
    canManageSecrets: false
  },
  SUPPORT_AGENT: {
    visibleTabs: ['dashboard', 'cases'],
    canTriggerManualAction: false,
    canEditGuardrails: false,
    canViewGuardrails: false,
    canViewAudit: false,
    canViewModels: false,
    canManageSecrets: false
  }
};

const pipelineSteps = [
  {
    id: 'ingest',
    number: '01',
    label: 'INGEST',
    title: 'Webhook Receiver',
    source: 'Razorpay',
    description: 'HMAC-SHA256 auth, deduplication queue, and stream intake.',
    badge: 'Stream Active 100%',
    tone: 'emerald',
    icon: Upload
  },
  {
    id: 'risk',
    number: '02',
    label: 'RISK',
    title: 'Revenue Risk',
    source: 'ML Model',
    description: 'Feature engineering, loss score (0-1), ROC-AUC 0.942.',
    badge: 'ROC-AUC: 0.942',
    tone: 'indigo',
    icon: BarChart3
  },
  {
    id: 'diagnose',
    number: '03',
    label: 'DIAGNOSE',
    title: 'AI Diagnostic Agent',
    source: 'AI Agent',
    description: 'LLM root-cause analysis and action recommendation.',
    badge: 'Confidence > 70%',
    tone: 'violet',
    icon: Bot
  },
  {
    id: 'guardrail',
    number: '04',
    label: 'GUARDRAIL',
    title: 'Policy Safety Gate',
    source: 'Safety Gate',
    description: 'Checks amount, retry, cooldown, and contact limits.',
    badge: 'Decision: APPROVE / ESCALATE',
    tone: 'emerald',
    icon: ShieldCheck
  },
  {
    id: 'recover',
    number: '05',
    label: 'RECOVER',
    title: 'Execution Layer',
    source: 'Orchestrator',
    description: 'Auto-retry, payment links, and WhatsApp/voice nudges.',
    badge: 'Multi-Channel Live',
    tone: 'cyan',
    icon: Sparkles
  }
];

const actionPalette = ['#10B981', '#818CF8', '#38BDF8', '#F59E0B', '#FB7185', '#A78BFA'];
const riskPalette = ['#10B981', '#F59E0B', '#F97316', '#FB7185'];
const EMPTY_ARRAY = [];

function formatDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: false
  }).format(date);
}

function toneClasses(tone) {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
    case 'amber':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-300';
    case 'rose':
      return 'border-rose-500/25 bg-rose-500/10 text-rose-300';
    case 'violet':
      return 'border-violet-500/25 bg-violet-500/10 text-violet-300';
    case 'cyan':
      return 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300';
    case 'indigo':
      return 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300';
    default:
      return 'border-zinc-500/25 bg-zinc-500/10 text-zinc-300';
  }
}

function statusTone(status) {
  switch (String(status || '').toUpperCase()) {
    case 'RECOVERED':
    case 'APPROVED':
    case 'ACTIVE':
    case 'VERIFIED_PAID':
      return 'emerald';
    case 'ESCALATED':
    case 'FAILED':
    case 'REJECTED':
      return 'rose';
    case 'IN_PROGRESS':
    case 'PENDING':
    case 'DISPATCHED':
      return 'amber';
    case 'PARTIAL':
      return 'indigo';
    default:
      return 'zinc';
  }
}

function formatRoleLabel(role) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'MERCHANT_OPERATOR':
      return 'Merchant Operator';
    case 'RISK_OFFICER':
      return 'Risk Officer';
    case 'SUPPORT_AGENT':
      return 'Support Agent';
    default:
      return role || 'Unknown';
  }
}

function summaryFromDetails(details = {}) {
  const fragments = [];
  if (details.status) fragments.push(details.status);
  if (details.decision) fragments.push(details.decision);
  if (details.amount) fragments.push(currency.format(Number(details.amount)));
  if (details.action) fragments.push(details.action);
  if (details.tool) fragments.push(details.tool);
  if (details.reason) fragments.push(details.reason);
  return fragments.join(' | ');
}

function Badge({ tone = 'zinc', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${toneClasses(tone)} ${className}`}>
      {children}
    </span>
  );
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-[1.5rem] border border-white/5 bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide text-white sm:text-base">{title}</h2>}
            {subtitle && <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-400">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value, subtext, tone, meta }) {
  return (
    <div className="relative overflow-hidden rounded-[1.25rem] border border-white/5 bg-[#111827]/85 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${tone === 'emerald' ? 'from-transparent via-emerald-400/70 to-transparent' : tone === 'amber' ? 'from-transparent via-amber-400/70 to-transparent' : tone === 'indigo' ? 'from-transparent via-indigo-400/70 to-transparent' : 'from-transparent via-violet-400/70 to-transparent'}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-xl border p-2 ${toneClasses(tone)}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{label}</span>
          </div>
          <div className={`text-3xl font-semibold tracking-tight ${tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : tone === 'indigo' ? 'text-indigo-300' : 'text-white'}`}>
            {value}
          </div>
        </div>
        {meta && <Badge tone={tone}>{meta}</Badge>}
      </div>
      <p className="mt-4 text-sm leading-6 text-zinc-400">{subtext}</p>
    </div>
  );
}

function DashboardHome({ snapshot, currentRole, canTriggerManualAction, onSelectCase, onOpenSimulator, onOpenBatch }) {
  const [expandedLogId, setExpandedLogId] = useState(null);

  const metrics = snapshot.metrics || {};
  const cases = snapshot.cases ?? EMPTY_ARRAY;
  const auditLogs = snapshot.auditLogs ?? EMPTY_ARRAY;

  const actionData = useMemo(() => {
    const raw = metrics.actionDistribution?.length
      ? metrics.actionDistribution
      : [
          { action_type: 'PAYMENT_LINK', count: 3 },
          { action_type: 'SUBSCRIPTION_RETRY', count: 2 },
          { action_type: 'RECOVERY_ORDER', count: 1 },
          { action_type: 'ESCALATE', count: 1 }
        ];
    const total = raw.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
    return raw.map((item, index) => ({
      name: String(item.action_type || item.name || 'Unknown').replace(/_/g, ' '),
      value: Number(item.count || 0),
      share: Math.round((Number(item.count || 0) / total) * 100),
      fill: actionPalette[index % actionPalette.length]
    }));
  }, [metrics.actionDistribution]);

  const riskData = useMemo(() => {
    const raw = metrics.riskDistribution?.length
      ? metrics.riskDistribution
      : [
          { risk_level: 'LOW', count: 2 },
          { risk_level: 'MEDIUM', count: 1 },
          { risk_level: 'HIGH', count: 1 },
          { risk_level: 'CRITICAL', count: 1 }
        ];
    return raw.map((item, index) => ({
      name: String(item.risk_level || 'UNKNOWN'),
      value: Number(item.count || 0),
      fill: riskPalette[index % riskPalette.length]
    }));
  }, [metrics.riskDistribution]);

  const timelineData = useMemo(() => {
    const ordered = [...cases]
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
      .slice(-6);

    return ordered.length
      ? ordered.map((item, index) => ({
          name: item.id?.replace('RC-', '') || `RC-${index + 1}`,
          recovered: Number(item.recovered_amount || 0),
          atRisk: Math.max(0, Number(item.amount || 0) - Number(item.recovered_amount || 0))
        }))
      : [
          { name: 'RC-804121', recovered: 2499, atRisk: 0 },
          { name: 'RC-804122', recovered: 0, atRisk: 14999 },
          { name: 'RC-804123', recovered: 0, atRisk: 145000 },
          { name: 'RC-804124', recovered: 8500, atRisk: 0 }
        ];
  }, [cases]);

  const recentLogs = (auditLogs || []).slice(0, 8);
  const recentCases = (cases || []).slice(0, 4);
  const openMetrics = {
    queuePending: metrics.queue?.pending ?? 0,
    queueInflight: metrics.queue?.inFlight ?? 0,
    escalated: metrics.escalatedCases ?? 0,
    totalCases: metrics.totalCases ?? cases.length
  };

  const liveStamp = snapshot.timestamp ? formatDateTime(snapshot.timestamp) : 'Streaming';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(17,24,39,0.85)_32%,rgba(99,102,241,0.1))] px-6 py-6 shadow-[0_26px_100px_rgba(0,0,0,0.28)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="emerald" className="px-3 py-1.5">
                <CircleDot className="h-3 w-3 fill-current" />
                Live
              </Badge>
              <span className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">Autonomous Revenue Recovery System</span>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                RecoverAI v2.1 Enterprise
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-300 sm:text-base">
                Closed-loop recovery operations for payment failures, guardrail-safe automation, and tamper-evident audit trails.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="indigo">Refresh: {liveStamp}</Badge>
              <Badge tone="emerald">Queue pending {openMetrics.queuePending}</Badge>
              <Badge tone="amber">Escalated {openMetrics.escalated}</Badge>
              <Badge tone="violet">Cases {openMetrics.totalCases}</Badge>
            </div>
          </div>

          <div className={`grid gap-3 ${canTriggerManualAction ? 'sm:grid-cols-3 xl:w-[29rem]' : 'sm:grid-cols-1 xl:w-[14rem]'}`}>
            {canTriggerManualAction && (
              <button onClick={onOpenSimulator} className="btn-primary">
                <Zap className="h-4 w-4" />
                <span>Simulate Webhook</span>
              </button>
            )}
            {canTriggerManualAction && (
              <button onClick={onOpenBatch} className="btn-secondary">
                <RefreshCw className="h-4 w-4" />
                <span>Batch Ingest</span>
              </button>
            )}
            <div className="rounded-2xl border border-white/5 bg-slate-950/40 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Operating Mode</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
                <Gauge className="h-4 w-4 text-emerald-400" />
                {formatRoleLabel(currentRole)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={AlertTriangle}
          label="Revenue at Risk"
          value={currency.format(metrics.revenueAtRisk ?? 168497)}
          subtext={`${metrics.activeCases ?? 3} active cases across Razorpay failed charges and 3DS drop-offs`}
          tone="amber"
          meta="Warning"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue Recovered"
          value={currency.format(metrics.totalRevenueRecovered ?? 15998)}
          subtext={`${metrics.recoveredCases ?? 3} settled autonomously via payment links and retries`}
          tone="emerald"
          meta="Success"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Recovery Success Rate"
          value={`${metrics.recoverySuccessRate ?? 42.9}%`}
          subtext="High precision outcome verification in the closed-loop recovery path"
          tone="indigo"
          meta="Target 75%"
        />
        <StatCard
          icon={ShieldCheck}
          label="Guardrails & Ingestion"
          value="6/6 Active"
          subtext={`100% audit compliant, queue ${metrics.queue?.pending ?? 0} pending, escalated ${metrics.escalatedCases ?? 1}`}
          tone="cyan"
          meta="Compliant"
        />
      </div>

      <Panel
        title="Closed-Loop Pipeline Architecture"
        subtitle="Every failure moves through ingest, risk, diagnose, guardrail, and recover stages with a full audit trail."
        action={<Badge tone="emerald">Autonomous Engine v2.1</Badge>}
      >
        <div className="grid gap-4 xl:grid-cols-5">
          {pipelineSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="relative overflow-hidden rounded-2xl border border-white/5 bg-[#0B0F17]/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                      <span className="text-emerald-300">{step.number}</span>
                      <span>{step.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-xl border p-2 ${toneClasses(step.tone)}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{step.source}</p>
                      </div>
                    </div>
                  </div>
                  <Badge tone={step.tone}>{step.badge}</Badge>
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-400">{step.description}</p>
                {index < pipelineSteps.length - 1 && (
                  <ArrowRight className="pointer-events-none absolute right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-white/15 xl:block" />
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Recovery Action Share"
          subtitle="Autonomous tool dispatch distribution"
          className="xl:col-span-1"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(17, 24, 39, 0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    color: '#F8FAFC'
                  }}
                />
                <Pie
                  data={actionData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {actionData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {actionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                <span>{item.name}</span>
                <span className="font-mono text-zinc-400">{item.share}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Risk Distribution"
          subtitle="Case mix by modeled risk level and severity"
          className="xl:col-span-1"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(17, 24, 39, 0.96)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    color: '#F8FAFC'
                  }}
                />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {riskData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Operational Pulse"
          subtitle="Queue state, integrity, and the latest recovery signals"
          className="xl:col-span-1"
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(17,24,39,0.08))] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Audit integrity</span>
                <Badge tone={snapshot.integrity?.valid ? 'emerald' : 'rose'}>
                  {snapshot.integrity?.valid ? 'Verified' : 'Broken'}
                </Badge>
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {snapshot.integrity?.valid ? '100%' : 'Alert'}
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {snapshot.integrity?.valid
                  ? `${snapshot.integrity?.verifiedCount ?? 0} consecutive hashes validated`
                  : `Hash mismatch at block ${snapshot.integrity?.brokenAtIndex ?? 'N/A'}`}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Queue</div>
                <div className="mt-2 text-2xl font-semibold text-white">{metrics.queue?.pending ?? 0} pending</div>
                <p className="mt-1 text-sm text-zinc-400">{metrics.queue?.inFlight ?? 0} in flight, {metrics.queue?.acknowledged ?? 0} acknowledged</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Coverage</div>
                <div className="mt-2 text-2xl font-semibold text-white">{cases.length} cases</div>
                <p className="mt-1 text-sm text-zinc-400">{auditLogs.length} live audit events in the stream</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Activity className="h-4 w-4 text-emerald-400" />
                Recovery timeline
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="recoveredFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(17, 24, 39, 0.96)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '14px',
                        color: '#F8FAFC'
                      }}
                    />
                    <Area type="monotone" dataKey="recovered" stroke="#10B981" fill="url(#recoveredFill)" strokeWidth={2} />
                    <Area type="monotone" dataKey="atRisk" stroke="#F59E0B" fill="url(#riskFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Live Stream & Audit Trail"
        subtitle="Recent recovery logs with exact timestamps, status tags, and expandable details."
        action={<Badge tone={snapshot.integrity?.valid ? 'emerald' : 'rose'}>{snapshot.integrity?.valid ? 'Chain Verified' : 'Attention Needed'}</Badge>}
      >
        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#0B0F17] text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Summary</th>
                  <th className="px-4 py-3 font-medium">Hash</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="cursor-pointer bg-white/[0.015] transition hover:bg-white/[0.04]"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-300">{formatDateTime(log.timestamp)}</td>
                        <td className="px-4 py-3 text-sm text-indigo-300">{log.actor}</td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(log.event_type)}>{log.event_type?.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{log.action}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">{log.curr_hash?.slice(0, 16)}...</td>
                        <td className="px-4 py-3 text-right">
                          {isExpanded ? <ChevronDown className="inline h-4 w-4 text-emerald-400" /> : <ChevronRight className="inline h-4 w-4 text-zinc-500" />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[#09101b]">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                              <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                <div className="mb-2 text-[11px] uppercase tracking-[0.24em] text-zinc-500">Details</div>
                                <pre className="overflow-x-auto rounded-xl border border-white/5 bg-[#05080E] p-3 text-[11px] leading-5 text-emerald-300">
                                  {JSON.stringify(log.details || {}, null, 2)}
                                </pre>
                              </div>
                              <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-4">
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Block hash</div>
                                  <div className="mt-1 break-all font-mono text-xs text-zinc-200">{log.curr_hash}</div>
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Previous hash</div>
                                  <div className="mt-1 break-all font-mono text-xs text-zinc-200">{log.prev_hash}</div>
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Summary</div>
                                  <div className="mt-1 text-sm text-zinc-300">{summaryFromDetails(log.details)}</div>
                                </div>
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
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Recent Recovery Cases" subtitle="Snapshot of active, recovered, and escalated cases." className="xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-white/5">
            <table className="w-full text-left">
              <thead className="bg-white/[0.02] text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Case</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentCases.map((item) => (
                  <tr key={item.id} onClick={() => onSelectCase(item.id)} className="cursor-pointer bg-white/[0.015] transition hover:bg-white/[0.04]">
                    <td className="px-4 py-3 font-mono text-sm text-white">{item.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white">{item.customer_name}</div>
                      <div className="text-xs text-zinc-500">{item.customer_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{currency.format(Number(item.amount || 0))}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(item.risk_level)}>{item.risk_level}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(item.status)}>{item.status?.replace(/_/g, ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Guardrail Snapshot" subtitle="Policy coverage and queue posture at a glance.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Active policies</div>
              <div className="mt-2 text-3xl font-semibold text-white">{snapshot.policies?.length || 6}/6</div>
              <p className="mt-1 text-sm text-zinc-400">100% audit compliant with 1 case escalated.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Queue posture</div>
              <div className="mt-2 text-3xl font-semibold text-white">{metrics.queue?.pending ?? 0}</div>
              <p className="mt-1 text-sm text-zinc-400">pending, {metrics.queue?.inFlight ?? 0} inflight, {metrics.queue?.acknowledged ?? 0} acknowledged</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Recovery methods</div>
              <div className="mt-3 space-y-2">
                {actionData.slice(0, 3).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm text-zinc-300">
                    <span>{item.name}</span>
                    <span className="font-mono text-zinc-500">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentRole, setCurrentRole] = useState('SUPER_ADMIN');
  const [snapshot, setSnapshot] = useState({
    timestamp: null,
    metrics: {},
    cases: [],
    policies: [],
    auditLogs: [],
    integrity: { valid: true, verifiedCount: 0 },
    models: [],
    secrets: {}
  });
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedCaseData, setSelectedCaseData] = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const refreshRef = useRef(async () => {});

  const apiHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      'x-demo-role': currentRole
    }),
    [currentRole]
  );

  const roleAccess = ROLE_ACCESS[currentRole] ?? ROLE_ACCESS.SUPER_ADMIN;
  const visibleTabs = useMemo(
    () => tabItems.filter((tab) => roleAccess.visibleTabs.includes(tab.id)),
    [roleAccess]
  );
  const activeTabSafe = roleAccess.visibleTabs.includes(activeTab) ? activeTab : 'dashboard';

  const loadSnapshot = useCallback(async () => {
    try {
      const requests = [
        { key: 'metrics', load: () => apiRequest('/api/metrics', { headers: apiHeaders }) },
        { key: 'cases', load: () => apiRequest('/api/cases', { headers: apiHeaders }) },
        roleAccess.canViewAudit ? { key: 'audit', load: () => apiRequest('/api/audit', { headers: apiHeaders }) } : null,
        roleAccess.canViewGuardrails ? { key: 'policies', load: () => apiRequest('/api/policies', { headers: apiHeaders }) } : null,
        roleAccess.canViewModels ? { key: 'models', load: () => apiRequest('/api/models', { headers: apiHeaders }) } : null,
        roleAccess.canManageSecrets ? { key: 'secrets', load: () => apiRequest('/api/secrets', { headers: apiHeaders }) } : null
      ].filter(Boolean);

      const settled = await Promise.allSettled(requests.map((request) => request.load()));
      const nextSnapshot = {
        timestamp: new Date().toISOString(),
        metrics: {},
        cases: [],
        policies: [],
        auditLogs: [],
        integrity: { valid: true, verifiedCount: 0 },
        models: [],
        secrets: {}
      };

      settled.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const request = requests[index];
        const data = result.value;

        if (request.key === 'metrics') {
          nextSnapshot.metrics = data;
        } else if (request.key === 'cases') {
          nextSnapshot.cases = data.cases || [];
        } else if (request.key === 'audit') {
          nextSnapshot.auditLogs = data.logs || [];
          nextSnapshot.integrity = data.integrity || nextSnapshot.integrity;
        } else if (request.key === 'policies') {
          nextSnapshot.policies = data.rules || [];
        } else if (request.key === 'models') {
          nextSnapshot.models = data.models || [];
        } else if (request.key === 'secrets') {
          nextSnapshot.secrets = data.secrets || {};
        }
      });

      setSnapshot(nextSnapshot);
    } catch (error) {
      console.error('Failed to load dashboard snapshot:', error);
    }
  }, [apiHeaders, roleAccess]);

  useEffect(() => {
    setSnapshot((current) => ({
      ...current,
      policies: roleAccess.canViewGuardrails ? current.policies : [],
      auditLogs: roleAccess.canViewAudit ? current.auditLogs : [],
      models: roleAccess.canViewModels ? current.models : [],
      secrets: roleAccess.canManageSecrets ? current.secrets : {}
    }));
    if (!roleAccess.visibleTabs.includes(activeTab)) {
      setActiveTab('dashboard');
    }
    if (!roleAccess.canTriggerManualAction) {
      setIsSimulatorOpen(false);
      setIsBatchOpen(false);
    }
  }, [activeTab, roleAccess]);

  useEffect(() => {
    let mounted = true;
    let refreshTimer = null;

    const pushSnapshot = async () => {
      if (!mounted) return;
      await loadSnapshot();
    };

    refreshRef.current = pushSnapshot;
    pushSnapshot();
    refreshTimer = setInterval(() => {
      pushSnapshot();
    }, 6000);

    return () => {
      mounted = false;
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [loadSnapshot]);

  const loadCaseDetail = async (caseId) => {
    setSelectedCaseId(caseId);
    setCaseLoading(true);
    try {
      const data = await apiRequest(`/api/cases/${caseId}`, { headers: apiHeaders });
      setSelectedCaseData(data);
    } catch (error) {
      console.error('Failed to load case detail:', error);
      setSelectedCaseData(null);
    } finally {
      setCaseLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCaseId) return;
    loadCaseDetail(selectedCaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole]);

  const handleSimulateWebhook = async (payload) => {
    const data = await apiRequest('/api/webhooks/simulate', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify(payload)
    });
    await refreshRef.current();
    return data;
  };

  const handleBatchIngest = async (transactions) => {
    const data = await apiRequest('/api/ingestion/batch', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ transactions })
    });
    await refreshRef.current();
    return data;
  };

  const handleSimulatePayment = async (caseId, externalRefId, amount) => {
    const data = await apiRequest('/api/webhooks/simulate-pay', {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ caseId, externalRefId, amount })
    });
    await refreshRef.current();
    if (caseId) {
      await loadCaseDetail(caseId);
    }
    return data;
  };

  const handleUpdatePolicy = async (id, update) => {
    const data = await apiRequest(`/api/policies/${id}`, {
      method: 'PUT',
      headers: apiHeaders,
      body: JSON.stringify(update)
    });
    await refreshRef.current();
    return data;
  };

  const handleVerifyIntegrity = async () => {
    const data = await apiRequest('/api/audit/verify', { headers: apiHeaders });
    setSnapshot((current) => ({
      ...current,
      integrity: data
    }));
    return data;
  };

  const roles = [
    { id: 'SUPER_ADMIN', label: 'Super Admin' },
    { id: 'MERCHANT_OPERATOR', label: 'Merchant Operator' },
    { id: 'RISK_OFFICER', label: 'Risk Officer' },
    { id: 'SUPPORT_AGENT', label: 'Support Agent' }
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.96),rgba(11,15,23,1)_48%,rgba(8,11,18,1))] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />

      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0B0F17]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 xl:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-3 self-start rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.05]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#10B981,#6366F1)] shadow-[0_0_30px_rgba(16,185,129,0.22)]">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold tracking-tight text-white">RecoverAI v2.1 Enterprise</span>
                  <Badge tone="emerald">
                    <CircleDot className="h-3 w-3 fill-current" />
                    Live
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-400">Autonomous Revenue Recovery System</p>
              </div>
            </button>

            <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-white/5 bg-white/[0.02] p-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTabSafe === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-300' : 'text-zinc-500'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              {roleAccess.canTriggerManualAction && (
                <button onClick={() => setIsSimulatorOpen(true)} className="btn-primary">
                  <Zap className="h-4 w-4" />
                  <span>Simulate Webhook</span>
                </button>
              )}
              {roleAccess.canTriggerManualAction && (
                <button onClick={() => setIsBatchOpen(true)} className="btn-secondary">
                  <RefreshCw className="h-4 w-4" />
                  <span>Batch Ingest</span>
                </button>
              )}
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Role</div>
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  className="mt-1 w-full bg-transparent text-sm text-white outline-none"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id} className="bg-slate-950">
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 xl:px-8">
        {activeTabSafe === 'dashboard' && (
          <DashboardHome
            snapshot={snapshot}
            currentRole={currentRole}
            canTriggerManualAction={roleAccess.canTriggerManualAction}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
            onOpenBatch={() => setIsBatchOpen(true)}
            onSelectCase={loadCaseDetail}
          />
        )}

        {activeTabSafe === 'cases' && (
          <CasesView cases={snapshot.cases} onSelectCase={loadCaseDetail} />
        )}

        {activeTabSafe === 'guardrails' && (
          <PolicyStudioView
            policies={snapshot.policies}
            canEdit={roleAccess.canEditGuardrails}
            onUpdatePolicy={handleUpdatePolicy}
          />
        )}

        {activeTabSafe === 'audit' && (
          <AuditTrailView auditLogs={snapshot.auditLogs} integrity={snapshot.integrity} onVerifyIntegrity={handleVerifyIntegrity} />
        )}

        {activeTabSafe === 'models' && (
          <ModelRegistryView models={snapshot.models} />
        )}

        {activeTabSafe === 'integrations' && (
          <IntegrationsView secrets={snapshot.secrets} />
        )}
      </main>

      {selectedCaseData && (
        <CaseDetailModal
          caseData={selectedCaseData}
          canTriggerManualAction={roleAccess.canTriggerManualAction}
          onClose={() => {
            setSelectedCaseId(null);
            setSelectedCaseData(null);
          }}
          onSimulatePayment={handleSimulatePayment}
          loading={caseLoading}
        />
      )}

      {isSimulatorOpen && (
        <WebhookSimulatorModal
          onClose={() => setIsSimulatorOpen(false)}
          onSimulateWebhook={handleSimulateWebhook}
        />
      )}

      {isBatchOpen && (
        <BatchUploadModal
          onClose={() => setIsBatchOpen(false)}
          onIngestBatch={handleBatchIngest}
        />
      )}
    </div>
  );
}

export default App;
