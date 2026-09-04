import React from 'react';
import { CreditCard, MessageSquare, Mail, Phone, LifeBuoy, CheckCircle2, Shield } from 'lucide-react';

export default function IntegrationsView({ secrets = {} }) {
  return (
    <div className="space-y-6">
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-emerald-400" />
          <h3 className="font-heading font-bold text-lg text-white">External Integrations & Notification Hub</h3>
        </div>
        <p className="text-xs text-slate-400">
          Configured payment gateways, communication channels, and CRM ticketing endpoints.
        </p>
      </div>

      {/* Gateway & Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Razorpay Platform */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                RZP
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-white">Razorpay Platform API</h4>
                <span className="text-[11px] text-slate-400">Orders, Payment Links, Subscriptions, Invoices</span>
              </div>
            </div>
            <span className="badge badge-recovered">CONNECTED</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Key ID:</span>
              <span className="text-slate-200">{secrets.RAZORPAY_KEY_ID || 'rzp_live_••••••45'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Key Secret:</span>
              <span className="text-slate-200">{secrets.RAZORPAY_KEY_SECRET || 'sec_••••••••••••Yz'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Webhook Secret:</span>
              <span className="text-slate-200">{secrets.RAZORPAY_WEBHOOK_SECRET || 'whsec_••••••••23'}</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Cloud API */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-white">WhatsApp Business Cloud</h4>
                <span className="text-[11px] text-slate-400">High-conversion recovery messaging</span>
              </div>
            </div>
            <span className="badge badge-recovered">ACTIVE</span>
          </div>

          {/* WhatsApp Bubble Preview */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1">
            <span className="text-[10px] text-emerald-400 font-bold block">TEMPLATE PREVIEW (3DS Drop):</span>
            <p className="text-slate-200 italic font-sans leading-relaxed">
              "Hi Priya, it looks like your payment session was interrupted during OTP verification. Complete your purchase safely here: https://rzp.io/i/78a9c"
            </p>
          </div>
        </div>

        {/* Multi-Channel Email & SMS */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-white">Email & SMS Dispatches</h4>
                <span className="text-[11px] text-slate-400">Responsive recovery templates</span>
              </div>
            </div>
            <span className="badge badge-recovered">ACTIVE</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Email Gateway:</span>
              <span className="font-mono text-slate-200">Amazon SES (Primary)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">SMS Gateway:</span>
              <span className="font-mono text-slate-200">DLT Registered Sender</span>
            </div>
          </div>
        </div>

        {/* Human Support / CRM */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center">
                <LifeBuoy className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-sm text-white">Zendesk / Freshdesk CRM</h4>
                <span className="text-[11px] text-slate-400">Escalation dispatcher for high-ticket / high-risk cases</span>
              </div>
            </div>
            <span className="badge badge-recovered">LINKED</span>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Target Endpoint:</span>
              <span className="font-mono text-slate-200">recoverai.zendesk.com/api/v2</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dossier Inclusion:</span>
              <span className="text-emerald-400">Full AI Root Cause + LTV Payload</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
