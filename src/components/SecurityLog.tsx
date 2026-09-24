import React, { useState } from 'react';
import { AuditRecord } from '../types/quantum';
import { bankingLedger } from '../lib/banking';
import { CurrencyCode, CURRENCIES, formatCurrency, convertCurrency } from '../lib/currency';
import {
  Shield,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  TrendingDown,
  Lock
} from 'lucide-react';

interface SecurityLogProps {
  onSelectTxForVerification?: (txId: string) => void;
  globalCurrency?: CurrencyCode | 'AUTO';
}

export const SecurityLog: React.FC<SecurityLogProps> = ({ onSelectTxForVerification, globalCurrency = 'AUTO' }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMMITTED' | 'ABORTED'>('ALL');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const logs = bankingLedger.getAuditLog();

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.txId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.senderAccountId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.receiverAccountId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.receiverName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'COMMITTED'
        ? log.status === 'COMMITTED'
        : log.status.startsWith('ABORTED');

    return matchesSearch && matchesStatus;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportJSON = () => {
    const exportData = {
      institution: 'QuantumBank Post-Quantum Financial Infrastructure',
      auditLedgerVersion: '1.0.0-QKD',
      exportedAt: new Date().toISOString(),
      recordCount: logs.length,
      records: logs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantumBank_Audit_Ledger_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Immutable Cryptographic Security Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically sealed chronological audit trail of all transactions and quantum channel states
          </p>
        </div>

        <button
          onClick={handleExportJSON}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export Audit Ledger (JSON)
        </button>
      </div>

      {/* Historical QBER Trend Ribbon */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
          <span className="font-semibold text-slate-200">Historical Quantum Channel Disturbance (QBER Trend)</span>
          <span className="font-mono text-[11px] text-rose-400">Security Threshold: 11.0%</span>
        </div>

        <div className="h-28 w-full bg-slate-950 rounded-lg border border-slate-800 p-3 relative flex items-end justify-between gap-1 overflow-x-auto">
          {/* 11% line */}
          <div
            className="absolute left-0 right-0 border-b border-dashed border-rose-500/80 z-10 pointer-events-none"
            style={{ top: `${100 - (11 / 40) * 100}%` }}
          />

          {logs.slice(0, 30).reverse().map((log, idx) => {
            const heightPercent = Math.min(100, Math.max(4, (log.qberPercentage / 40) * 100));
            const isAborted = log.qberPercentage > 11;
            return (
              <div
                key={log.txId + idx}
                className="flex-1 min-w-[12px] h-full flex items-end justify-center group relative cursor-pointer"
                onClick={() => onSelectTxForVerification && onSelectTxForVerification(log.txId)}
              >
                <div
                  className={`w-full rounded-t transition-all ${
                    isAborted
                      ? 'bg-rose-500 group-hover:bg-rose-400'
                      : 'bg-cyan-500/80 group-hover:bg-cyan-400'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-1 hidden group-hover:block z-30 bg-slate-900 border border-slate-700 text-[10px] text-slate-200 p-1.5 rounded whitespace-nowrap shadow-xl">
                  <div className="font-bold">{log.txId}</div>
                  <div>QBER: {log.qberPercentage.toFixed(1)}%</div>
                  <div>Status: {isAborted ? 'Aborted (Eve)' : 'Committed'}</div>
                  {isAborted && <div className="text-rose-400 font-mono">Reason: EAVESDROPPER_DETECTED</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Tx ID, account, name..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Status Filter:</span>
          {(['ALL', 'COMMITTED', 'ABORTED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                statusFilter === st
                  ? st === 'ABORTED'
                    ? 'bg-rose-950/60 border-rose-500/60 text-rose-300'
                    : 'bg-slate-800 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'COMMITTED' ? 'Committed' : 'Aborted'}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-950/60">
                <th className="py-2.5 px-4 font-medium">Tx ID</th>
                <th className="py-2.5 px-4 font-medium">Timestamp</th>
                <th className="py-2.5 px-4 font-medium">Parties</th>
                <th className="py-2.5 px-4 font-medium text-right">Amount</th>
                <th className="py-2.5 px-4 font-medium text-center">QBER</th>
                <th className="py-2.5 px-4 font-medium text-center">Decision</th>
                <th className="py-2.5 px-4 font-medium">Quantum Fingerprint</th>
                <th className="py-2.5 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(record => {
                  const isCommitted = record.status === 'COMMITTED';
                  return (
                    <tr key={record.txId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {record.txId}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs whitespace-nowrap">
                        {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 font-sans text-xs">
                        <div className="text-slate-300">{record.senderName} → {record.receiverName}</div>
                        <div className="text-[10px] text-slate-500">{record.senderAccountId}</div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-bold text-slate-200">
                        {globalCurrency !== 'AUTO' ? (
                          formatCurrency(
                            convertCurrency(
                              record.sentAmount || record.amount,
                              record.sentCurrency || 'USD',
                              globalCurrency
                            ),
                            globalCurrency
                          )
                        ) : (
                          <>
                            <div>{formatCurrency(record.sentAmount || record.amount, record.sentCurrency || 'USD')}</div>
                            {record.receivedCurrency && record.receivedCurrency !== record.sentCurrency && (
                              <div className="text-[10px] text-emerald-400 font-normal">
                                → {formatCurrency(record.receivedAmount, record.receivedCurrency)}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            record.qberPercentage > 11
                              ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                              : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {record.qberPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {isCommitted ? (
                          <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Committed
                          </span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="text-rose-400 font-semibold flex items-center justify-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Aborted (Eve)
                            </span>
                            <span className="text-[10px] text-rose-400/90 font-mono mt-0.5">
                              Reason: EAVESDROPPER_DETECTED
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {record.keyFingerprint && record.keyFingerprint !== 'N/A' ? (
                          <div className="flex items-center gap-1 text-slate-400">
                            <span className="text-cyan-300 font-mono text-[10px]">
                              {record.keyFingerprint.slice(0, 14)}...
                            </span>
                            <button
                              onClick={() => handleCopy(record.keyFingerprint, record.txId)}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                              title="Copy SHA-256 fingerprint"
                            >
                              {copiedKey === record.txId ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Purged (Zeroed)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => onSelectTxForVerification && onSelectTxForVerification(record.txId)}
                          className="px-2.5 py-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/60 rounded transition-colors"
                        >
                          Verify Integrity
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
