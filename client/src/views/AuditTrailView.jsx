import React, { useState } from 'react';
import { ShieldCheck, Hash, CheckCircle2, AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';

export default function AuditTrailView({ auditLogs = [], integrity, onVerifyIntegrity }) {
  const [copiedHash, setCopiedHash] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(integrity);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleCopy = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await onVerifyIntegrity();
      setVerifyResult(res);
    } catch (error) {
      setErrorMsg(
        error.status === 403
          ? 'Access denied: You do not have permission to verify audit integrity.'
          : error.message || 'Verification failed.'
      );
    } finally {
      setVerifying(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => {
    if (filterType !== 'ALL' && log.event_type !== filterType) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Cryptographic Integrity Banner */}
      <div className="glass-card p-5 border-emerald-500/30 bg-emerald-950/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-5 h-5 text-emerald-400" />
            <h3 className="font-heading font-bold text-lg text-white">
              Immutable Cryptographic Audit Trail Store
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            Tamper-evident blockchain-style hash chaining. Every transition is signed with SHA-256(prev_hash + timestamp + actor + action + payload).
          </p>
        </div>

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="btn-primary text-xs"
        >
          {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          <span>Verify Hash Chain Integrity</span>
        </button>
      </div>

      {/* Verification Status Card */}
      {verifyResult && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-fadeIn ${
          verifyResult.valid
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {verifyResult.valid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div>
              <h5 className="font-bold text-sm">
                {verifyResult.valid ? 'Cryptographic Chain Integrity 100% Valid' : 'Integrity Violation Detected!'}
              </h5>
              <p className="text-slate-400 text-[11px]">
                {verifyResult.valid
                  ? `Successfully validated ${verifyResult.verifiedCount || auditLogs.length} consecutive block hashes. Zero tampering detected.`
                  : `Hash mismatch at block #${verifyResult.brokenAtIndex}. Root cause: ${verifyResult.reason}`}
              </p>
            </div>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
            SHA-256 OK
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs text-rose-300 animate-fadeIn">
          {errorMsg}
        </div>
      )}

      {/* Log Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'EVENT_RECEIVED', 'RISK_SCORED', 'ACTION_RECOMMENDED', 'POLICY_DECISION', 'ACTION_INITIATED', 'OUTCOME_VERIFIED', 'REVENUE_RECOVERED'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              filterType === type
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Audit Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase">
                <th className="py-3 px-4">#Block</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4 text-slate-400">
                    #{log.id}
                  </td>
                  <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-indigo-400 font-sans font-medium">{log.actor}</span>
                  </td>
                  <td className="py-3 px-4 text-white font-sans font-semibold">
                    {log.event_type}
                  </td>
                  <td className="py-3 px-4 text-emerald-400">
                    {log.action}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {log.curr_hash?.substring(0, 14)}...
                      </span>
                      <button
                        onClick={() => handleCopy(log.curr_hash)}
                        className="hover:text-white"
                        title="Copy complete SHA-256 block hash"
                      >
                        {copiedHash === log.curr_hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
