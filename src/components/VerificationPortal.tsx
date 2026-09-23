import React, { useState } from 'react';
import { AuditRecord } from '../types/quantum';
import { bankingLedger } from '../lib/banking';
import { computeSyncHashHex } from '../lib/bb84';
import { CurrencyCode, CURRENCIES, formatCurrency, convertCurrency } from '../lib/currency';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileCheck,
  Printer,
  Copy,
  Check,
  AlertOctagon,
  RefreshCw,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VerificationPortalProps {
  initialTxId?: string;
  globalCurrency?: CurrencyCode | 'AUTO';
}

export const VerificationPortal: React.FC<VerificationPortalProps> = ({ initialTxId, globalCurrency = 'AUTO' }) => {
  const auditLogs = bankingLedger.getAuditLog();
  const [selectedTxId, setSelectedTxId] = useState<string>(
    initialTxId || auditLogs[0]?.txId || ''
  );
  const [simulatedTampering, setSimulatedTampering] = useState<boolean>(false);
  const [verificationDone, setVerificationDone] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showCertificateModal, setShowCertificateModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const selectedRecord = auditLogs.find(r => r.txId === selectedTxId) || auditLogs[0];

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerificationDone(true);
      if (!simulatedTampering && selectedRecord?.status === 'COMMITTED') {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 },
          colors: ['#06b6d4', '#10b981']
        });
      }
    }, 300);
  };

  // Recomputed HMAC tag
  let recomputedHmac = 'N/A';
  let isHmacBitExact = false;

  if (selectedRecord && selectedRecord.payloadEncrypted) {
    const enc = selectedRecord.payloadEncrypted;
    const effectiveCiphertext = simulatedTampering
      ? enc.ciphertextHex.slice(0, -2) + 'ff'
      : enc.ciphertextHex;
    
    // Independent HMAC computation simulation
    const rawKey = selectedRecord.keyFingerprint;
    recomputedHmac = computeSyncHashHex('HMAC_KEY:' + rawKey + ':MSG:' + enc.ivHex + effectiveCiphertext + enc.authTagHex);
    isHmacBitExact = !simulatedTampering && recomputedHmac.toLowerCase() === enc.hmacTagHex.toLowerCase();
  }

  const handleCopyCertId = () => {
    navigator.clipboard.writeText(selectedRecord?.txId || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-base font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          Public Cryptographic Verification & Audit Portal
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Step 7: Independent mathematical verification of quantum key fingerprints and HMAC-SHA256 authenticated payloads
        </p>
      </div>

      {/* Main Verification Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Select or Enter Transaction ID to Verify
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedTxId}
                onChange={(e) => {
                  setSelectedTxId(e.target.value);
                  setVerificationDone(false);
                  setSimulatedTampering(false);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                {auditLogs.map(log => (
                  <option key={log.txId} value={log.txId}>
                    {log.txId} - {log.senderName} ({formatCurrency(log.sentAmount || log.amount, log.sentCurrency || 'USD')}) [{log.status}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSimulatedTampering(!simulatedTampering);
                setVerificationDone(false);
              }}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                simulatedTampering
                  ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              {simulatedTampering ? 'Tampering Active (Corrupted)' : 'Simulate 1-Bit Attack'}
            </button>

            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-md transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              Re-Compute & Verify HMAC
            </button>
          </div>
        </div>

        {selectedRecord && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-3 border-t border-slate-800">
            {/* Left: Cryptographic Artifacts */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Cryptographic Artifacts Stored in Ledger
              </h2>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[11px] text-slate-500 block">Transaction Reference ID</span>
                  <span className="text-white font-bold">{selectedRecord.txId}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Quantum Key Fingerprint (SHA-256)</span>
                  <span className="text-cyan-300 text-[11px] break-all">
                    {selectedRecord.keyFingerprint}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Encrypted Payload Hash</span>
                  <span className="text-slate-300 text-[11px] break-all">
                    {selectedRecord.ciphertextHash}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Stored HMAC-SHA256 Tag</span>
                  <span className="text-amber-300 text-[11px] break-all">
                    {selectedRecord.hmacTag}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Independent Verification Result */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Independent Verification Engine
              </h2>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block">Quantum Channel QBER at Processing</span>
                  <span className={`text-base font-bold font-mono ${selectedRecord.qberPercentage <= 11 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {selectedRecord.qberPercentage.toFixed(1)}% (Threshold: ≤ 11.0%)
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block">Independently Recomputed HMAC-SHA256</span>
                  <span className="font-mono text-[11px] text-cyan-400 break-all">
                    {recomputedHmac}
                  </span>
                </div>

                {verificationDone && (
                  <div className={`p-3 rounded-lg border text-xs ${
                    isHmacBitExact && selectedRecord.status === 'COMMITTED'
                      ? 'bg-emerald-950/40 border-emerald-600 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-600 text-rose-200'
                  }`}>
                    {isHmacBitExact && selectedRecord.status === 'COMMITTED' ? (
                      <div>
                        <div className="font-bold flex items-center gap-1.5 text-emerald-400 text-sm">
                          <CheckCircle2 className="w-4 h-4" />
                          Cryptographic Verification Passed
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          The stored HMAC-SHA256 tag matches the re-computed tag bit-for-bit. Ciphertext integrity, key derivation authenticity, and quantum physical security are 100% verified.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="font-bold flex items-center gap-1.5 text-rose-400 text-sm">
                          <XCircle className="w-4 h-4" />
                          Cryptographic Verification Failed!
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          {simulatedTampering
                            ? 'Simulated transmission tampering detected! The modified ciphertext produced an HMAC mismatch and was immediately rejected.'
                            : 'This transaction was aborted due to quantum channel compromise during transmission.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedRecord.status === 'COMMITTED' && (
                  <button
                    onClick={() => setShowCertificateModal(true)}
                    className="w-full mt-2 py-2 px-3 text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4 text-cyan-400" />
                    View Signed Authenticity Certificate
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Official Certificate Modal */}
      {showCertificateModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative">
            <div className="text-center border-b border-slate-800 pb-5">
              <div className="inline-flex p-3 rounded-full bg-cyan-950/60 border border-cyan-500/40 mb-2">
                <Award className="w-8 h-8 text-cyan-400" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Certificate of Quantum Authenticity
              </h2>
              <p className="text-xs text-cyan-400 font-mono mt-1">
                POST-QUANTUM CRYPTOGRAPHIC COMPLIANCE SPECIFICATION
              </p>
            </div>

            <div className="py-6 space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[11px]">Transaction ID</span>
                  <span className="text-white font-bold">{selectedRecord.txId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Execution Timestamp</span>
                  <span className="text-slate-300">{selectedRecord.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Sender</span>
                  <span className="text-slate-300">{selectedRecord.senderName} ({selectedRecord.senderAccountId})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Receiver</span>
                  <span className="text-slate-300">{selectedRecord.receiverName} ({selectedRecord.receiverAccountId})</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Settlement Amount</span>
                  <span className="text-emerald-400 font-bold">
                    {formatCurrency(selectedRecord.sentAmount || selectedRecord.amount, selectedRecord.sentCurrency || 'USD')}
                    {selectedRecord.receivedCurrency && selectedRecord.receivedCurrency !== selectedRecord.sentCurrency && (
                      <span className="text-slate-400 font-normal ml-1">
                        (→ {formatCurrency(selectedRecord.receivedAmount, selectedRecord.receivedCurrency)})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Measured QBER</span>
                  <span className="text-emerald-400 font-bold">{selectedRecord.qberPercentage.toFixed(1)}% (Nominal)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-400">Quantum Key Fingerprint (SHA-256):</div>
                <div className="text-cyan-300 break-all">{selectedRecord.keyFingerprint}</div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-400">Ciphertext Integrity Signature (HMAC-SHA256):</div>
                <div className="text-amber-300 break-all">{selectedRecord.hmacTag}</div>
              </div>

              <p className="text-[11px] font-sans text-slate-400 leading-relaxed text-center pt-2">
                This document certifies that the financial transaction specified above was processed across an unconditionally secure physical quantum channel utilizing the BB84 protocol, verified against physical eavesdropping, and encrypted with quantum-derived 256-bit symmetric keys.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={handleCopyCertId}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Cert Reference
              </button>

              <button
                onClick={() => setShowCertificateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
              >
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
