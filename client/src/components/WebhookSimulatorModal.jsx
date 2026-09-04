import React, { useState } from 'react';
import { X, Zap, RefreshCw, CheckCircle2, Play } from 'lucide-react';

export default function WebhookSimulatorModal({ onClose, onSimulateWebhook }) {
  const [scenario, setScenario] = useState('3DS_DROP');
  const [amount, setAmount] = useState('2499');
  const [customerName, setCustomerName] = useState('Anand Mehta');
  const [customerEmail, setCustomerEmail] = useState('anand.mehta@fintech.in');
  const [customerPhone, setCustomerPhone] = useState('+919820011223');
  const [isSubscription, setIsSubscription] = useState(false);
  const [errorCode, setErrorCode] = useState('AUTHENTICATION_FAILED');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const presetScenarios = [
    {
      id: '3DS_DROP',
      title: '3DS Bank OTP Abandonment',
      desc: 'Customer dropped during bank 3DS authentication. High intent, low friction.',
      amount: '2499',
      isSubscription: false,
      code: 'AUTHENTICATION_FAILED'
    },
    {
      id: 'GATEWAY_ERROR',
      title: 'Subscription Bank Gateway Timeout',
      desc: 'HDFC core switch timeout during auto-debit. Ideal for Razorpay subscription retry.',
      amount: '14999',
      isSubscription: true,
      code: 'GATEWAY_ERROR'
    },
    {
      id: 'INSUFFICIENT_FUNDS',
      title: 'Insufficient Balance Decline',
      desc: 'Card debit rejected. Generates Payment Link for customer to use UPI or alternate card.',
      amount: '4999',
      isSubscription: true,
      code: 'INSUFFICIENT_FUNDS'
    },
    {
      id: 'HIGH_TICKET_BREACH',
      title: 'Enterprise High-Ticket Limit Breach',
      desc: '₹1,45,000 transaction. Breaches the ₹50,000 guardrail ceiling; escalates to CRM ticket.',
      amount: '145000',
      isSubscription: false,
      code: 'GATEWAY_ERROR'
    }
  ];

  const handleSelectPreset = (p) => {
    setScenario(p.id);
    setAmount(p.amount);
    setIsSubscription(p.isSubscription);
    setErrorCode(p.code);
  };

  const handleFireWebhook = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const payload = {
        scenario,
        amount: parseFloat(amount) || 2499,
        customerName,
        customerEmail,
        customerPhone,
        isSubscription,
        errorCode
      };

      const res = await onSimulateWebhook(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Webhook simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="glass-card bg-slate-900 border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">Razorpay Webhook & Payment Gateway Sandbox</h3>
              <p className="text-xs text-slate-400">Inject real-time failure events into the RecoverAI event queue</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFireWebhook} className="p-6 overflow-y-auto space-y-5">
          {/* Preset Scenarios */}
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Select Failure Scenario Preset:
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Transaction Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Customer Phone</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isSub"
                checked={isSubscription}
                onChange={(e) => setIsSubscription(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <label htmlFor="isSub" className="text-xs text-slate-300 font-medium cursor-pointer">
                Recurring Subscription Payment
              </label>
            </div>
          </div>

          {/* Result Banner */}
          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Webhook Ingested! Event ID: <strong className="font-mono">{result.eventId}</strong>. Pipeline processed event.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2 animate-fadeIn">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-rose-400/60 text-[10px] font-bold">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs">
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting into Queue...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Trigger Razorpay Webhook</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
