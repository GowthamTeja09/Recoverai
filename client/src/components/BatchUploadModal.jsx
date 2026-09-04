import React, { useState } from 'react';
import { X, UploadCloud, CheckCircle2, RefreshCw } from 'lucide-react';

export default function BatchUploadModal({ onClose, onIngestBatch }) {
  const [jsonText, setJsonText] = useState(JSON.stringify([
    {
      payment_id: "pay_batch_001",
      customer_id: "cust_batch_01",
      name: "Rohan Kapoor",
      email: "rohan.k@fintech.co",
      phone: "+919833445566",
      amount: 5499,
      status: "failed",
      error_code: "GATEWAY_ERROR",
      error_description: "Bank switch timeout",
      subscription_id: "sub_rohan_01"
    },
    {
      payment_id: "pay_batch_002",
      customer_id: "cust_batch_02",
      name: "Sneha Reddy",
      email: "sneha.r@designstudio.in",
      phone: "+919877112233",
      amount: 1999,
      status: "failed",
      error_code: "AUTHENTICATION_FAILED",
      error_description: "3DS session expired"
    }
  ], null, 2));
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSummary(null);
    setLoading(true);

    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error('Root must be an array of transaction objects');
      const res = await onIngestBatch(parsed);
      setSummary(res);
    } catch (err) {
      setError(
        err.status === 403
          ? 'Access denied: You do not have permission to ingest batch transactions.'
          : err.message || 'Batch ingestion failed.'
      );
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
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">Batch & Historical Data Ingestion</h3>
              <p className="text-xs text-slate-400">Bulk ingest payment failures into the deduplicator and queue</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              JSON Batch Array (Transactions):
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={10}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
              {error}
            </div>
          )}

          {summary && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Batch processed: <strong>{summary.ingested}</strong> ingested, <strong>{summary.skippedDuplicates}</strong> duplicates skipped.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Close
            </button>
            <button type="submit" disabled={loading} className="btn-primary text-xs">
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Ingesting...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Start Batch Ingestion</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
