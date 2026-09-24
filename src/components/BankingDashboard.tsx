import React, { useState } from 'react';
import { BankAccount, AuditRecord, BB84Result } from '../types/quantum';
import { bankingLedger, PipelineExecutionResult } from '../lib/banking';
import {
  CurrencyCode,
  CURRENCIES,
  convertCurrency,
  formatCurrency,
  getExchangeRate,
  SUPPORTED_CURRENCY_CODES,
  toUSD
} from '../lib/currency';
import {
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Radio,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeftRight,
  RefreshCw,
  Coins
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BankingDashboardProps {
  accounts: BankAccount[];
  activeAccountId: string;
  globalCurrency: CurrencyCode | 'AUTO';
  onRefresh: () => void;
  onViewAudit: () => void;
  onViewQuantumConsole: (bb84Result?: BB84Result) => void;
}

export const BankingDashboard: React.FC<BankingDashboardProps> = ({
  accounts,
  activeAccountId,
  globalCurrency,
  onRefresh,
  onViewAudit,
  onViewQuantumConsole,
}) => {
  const currentAccount = accounts.find(a => a.accountNumber === activeAccountId) || accounts[0];
  const otherAccounts = accounts.filter(a => a.accountNumber !== currentAccount.accountNumber);

  // Transfer Form State
  const [recipientAccount, setRecipientAccount] = useState<string>(
    otherAccounts[0]?.accountNumber || ''
  );
  const [sendAmount, setSendAmount] = useState<number>(1000);
  const [sendCurrency, setSendCurrency] = useState<CurrencyCode>(currentAccount.currency);
  const [note, setNote] = useState<string>('Cross-border interbank settlement');
  const [evePresent, setEvePresent] = useState<boolean>(false);
  const [qubitCount, setQubitCount] = useState<number>(32);

  // Execution & Modal State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<PipelineExecutionResult | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [showExecutionModal, setShowExecutionModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Selected Recipient Account
  const targetRecipient = accounts.find(a => a.accountNumber === recipientAccount) || otherAccounts[0];

  // Dynamic calculations for live preview
  const recipientNativeCurrency: CurrencyCode = targetRecipient?.currency || 'USD';
  const exchangeRate = getExchangeRate(sendCurrency, recipientNativeCurrency);
  const estimatedReceived = convertCurrency(sendAmount, sendCurrency, recipientNativeCurrency);
  const debitFromSender = convertCurrency(sendAmount, sendCurrency, currentAccount.currency);

  // Display Balance formatting
  const displayCurrency: CurrencyCode = globalCurrency === 'AUTO' ? currentAccount.currency : globalCurrency;
  const convertedBalance = convertCurrency(currentAccount.balance, currentAccount.currency, displayCurrency);

  // Filter recent transactions for this account
  const auditLogs = bankingLedger.getAuditLog();
  const accountTransactions = auditLogs.filter(
    tx => tx.senderAccountId === currentAccount.accountNumber || tx.receiverAccountId === currentAccount.accountNumber
  );

  const PIPELINE_STEPS = [
    { num: 1, title: 'BB84 Key Generation', desc: 'Alice encodes qubits with X & Hadamard gates, transmits to Bob' },
    { num: 2, title: 'QBER & Eavesdropper Check', desc: 'Sacrifice 25% sample, verify QBER ≤ 11.0% security threshold' },
    { num: 3, title: 'SHA-256 Privacy Amplification', desc: 'Hash sifted key to derive uniform 256-bit AES symmetric key' },
    { num: 4, title: 'AES-256-GCM Payload Encryption', desc: 'Serialize payload JSON and compute 128-bit authentication tag' },
    { num: 5, title: 'Channel Transmission & HMAC Tag', desc: 'Transmit ciphertext bundle with independent HMAC-SHA256 signature' },
    { num: 6, title: 'Decryption & Integrity Verification', desc: 'Verify HMAC and AES-GCM tags bit-for-bit on receiving node' },
    { num: 7, title: 'Atomic Balance Commit (Multi-Currency)', desc: 'Debit sender & credit recipient in respective currencies' },
    { num: 8, title: 'Immutable Audit Ledgering', desc: 'Append cryptographic fingerprint and hash to audit log' },
  ];

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sendAmount <= 0 || !recipientAccount) return;

    if (currentAccount.balance < debitFromSender) {
      setToastMessage({
        type: 'error',
        message: `Insufficient funds! Available: ${formatCurrency(currentAccount.balance, currentAccount.currency)}, required: ${formatCurrency(debitFromSender, currentAccount.currency)}`
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    setIsProcessing(true);
    setShowExecutionModal(true);
    setActiveStepIndex(1);

    const stepDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

    try {
      await stepDelay(350);
      setActiveStepIndex(2);
      await stepDelay(250);

      const result = await bankingLedger.executePipeline({
        senderAccountId: currentAccount.accountNumber,
        receiverAccountId: recipientAccount,
        amount: sendAmount,
        sendCurrency,
        note,
        evePresent,
        eveEnabled: evePresent,
        numQubits: qubitCount,
      });

      setExecutionResult(result);
      setActiveStepIndex(result.stageReached);

      if (result.success) {
        confetti({
          particleCount: 55,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#06b6d4', '#10b981', '#38bdf8']
        });
        setToastMessage({
          type: 'success',
          message: `Transfer of ${formatCurrency(sendAmount, sendCurrency)} successfully committed to ${targetRecipient.holderName} (${formatCurrency(estimatedReceived, recipientNativeCurrency)})!`
        });
      } else {
        setToastMessage({
          type: 'error',
          message: `Transaction Aborted (Eavesdropper Detected)! QBER: ${result.bb84Result.qberPercentage.toFixed(1)}% > 11.0% threshold. Balances preserved.`
        });
      }

      setTimeout(() => setToastMessage(null), 6000);
      onRefresh();
    } catch (err: unknown) {
      console.error('Transfer execution error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadStatement = () => {
    const statement = {
      bank: 'QuantumBank Post-Quantum Financial Institution',
      accountNumber: currentAccount.accountNumber,
      holderName: currentAccount.holderName,
      baseCurrency: currentAccount.currency,
      currentBalance: currentAccount.balance,
      displayCurrency,
      displayBalance: convertedBalance,
      generatedAt: new Date().toISOString(),
      compliance: 'Quantum Key Distribution (QKD) BB84 Verified',
      transactions: accountTransactions,
    };

    const blob = new Blob([JSON.stringify(statement, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QuantumBank_Statement_${currentAccount.accountNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-xl transition-all ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
            : 'bg-rose-950/90 border-rose-500 text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{toastMessage.message}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner & Account Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance Card */}
        <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{CURRENCIES[currentAccount.currency].flag}</span>
              <span className="font-semibold text-slate-200">{currentAccount.holderName}</span>
              <span>·</span>
              <span className="font-mono">{currentAccount.accountNumber}</span>
              <span>·</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300">
                Base: {currentAccount.currency}
              </span>
            </div>
            <span className="text-emerald-400 flex items-center gap-1 font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Quantum Channel Active
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-3xl md:text-4xl font-bold font-mono tracking-tight text-white tabular-nums">
              {formatCurrency(convertedBalance, displayCurrency)}
            </span>
            {globalCurrency !== 'AUTO' && globalCurrency !== currentAccount.currency && (
              <span className="text-xs text-slate-400 font-mono">
                (Native: {formatCurrency(currentAccount.balance, currentAccount.currency)})
              </span>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-6 text-slate-400">
              <div>
                <span className="block text-[11px] text-slate-500">Encryption Standard</span>
                <span className="font-medium text-slate-200">AES-256-GCM + HMAC</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Key Exchange Protocol</span>
                <span className="font-medium text-slate-200">BB84 QKD</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-500">Security Threshold</span>
                <span className="font-medium text-slate-200 font-mono">QBER ≤ 11.0%</span>
              </div>
            </div>

            <button
              onClick={handleDownloadStatement}
              className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/80 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Download Statement
            </button>
          </div>
        </div>

        {/* Currency Rates & Defense Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-cyan-400" />
                Live Fixed Conversion Rates
              </span>
              <span className="text-[10px] text-slate-500 font-mono">1 USD Base</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">🇮🇳 INR (Rupee)</span>
                <span className="text-slate-200 font-bold">₹83.00</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">🇪🇺 EUR (Euro)</span>
                <span className="text-slate-200 font-bold">€0.92</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">🇬🇧 GBP (Pound)</span>
                <span className="text-slate-200 font-bold">£0.79</span>
              </div>
              <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                <span className="text-slate-500 block text-[10px]">🇯🇵 JPY (Yen)</span>
                <span className="text-slate-200 font-bold">¥150.00</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={() => onViewQuantumConsole()}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
            >
              Open Quantum Console
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Multi-Currency Transfer Form & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Transfer Form (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Quantum-Secure Transfer
            </h2>
            <span className="text-[11px] text-cyan-400 font-mono">Multi-Currency</span>
          </div>

          <form onSubmit={handleExecuteTransfer} className="space-y-4">
            {/* Recipient Account Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Recipient Account & Native Currency
              </label>
              <select
                value={recipientAccount}
                onChange={(e) => setRecipientAccount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              >
                {otherAccounts.map(acc => (
                  <option key={acc.accountNumber} value={acc.accountNumber}>
                    {CURRENCIES[acc.currency].flag} {acc.holderName} — receives in {acc.currency} ({acc.accountNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount and Send Currency Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Transfer Amount & Currency
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Sender Balance: {formatCurrency(currentAccount.balance, currentAccount.currency)}
                </span>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-slate-400 font-mono">
                    {CURRENCIES[sendCurrency].symbol}
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <select
                  value={sendCurrency}
                  onChange={(e) => setSendCurrency(e.target.value as CurrencyCode)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                >
                  {SUPPORTED_CURRENCY_CODES.map(code => (
                    <option key={code} value={code}>
                      {CURRENCIES[code].flag} {code} ({CURRENCIES[code].symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Amount Presets in selected send currency */}
              <div className="flex items-center gap-1.5 mt-2">
                {[100, 500, 2500, 10000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSendAmount(val)}
                    className="px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-950 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                  >
                    +{CURRENCIES[sendCurrency].symbol}{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature 3: Live Conversion Preview */}
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between text-cyan-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
                  Live Conversion Preview
                </span>
                <span className="font-mono text-[11px]">
                  Rate: 1 {sendCurrency} = {exchangeRate.toFixed(6)} {recipientNativeCurrency}
                </span>
              </div>
              <p className="text-slate-200 font-mono text-xs pt-1">
                You send <span className="font-bold text-white">{formatCurrency(sendAmount, sendCurrency)} {sendCurrency}</span> → {targetRecipient?.holderName} receives <span className="font-bold text-emerald-400">{formatCurrency(estimatedReceived, recipientNativeCurrency)} {recipientNativeCurrency}</span>
              </p>
              {sendCurrency !== currentAccount.currency && (
                <div className="text-[11px] text-slate-400 font-mono pt-0.5">
                  Debited from your account: {formatCurrency(debitFromSender, currentAccount.currency)}
                </div>
              )}
            </div>

            {/* Transfer Note */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Transaction Memo (Encrypted in Payload)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reference or memo"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Quantum Channel Security Mode Control */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  Quantum Channel Security Mode
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEvePresent(false)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    !evePresent
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100 ring-1 ring-emerald-500/50 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <span className={`w-2 h-2 rounded-full ${!evePresent ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    Nominal Link
                  </div>
                  <span className="text-[11px] text-emerald-400/90 block mt-0.5">Eve OFF (QBER ≈ 0%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEvePresent(true)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                    evePresent
                      ? 'bg-rose-950/60 border-rose-500 text-rose-100 ring-1 ring-rose-500/50 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-400">
                    <span className={`w-2 h-2 rounded-full ${evePresent ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'}`} />
                    Eve Intercept
                  </div>
                  <span className="text-[11px] text-rose-400/90 block mt-0.5">Eve ON (QBER ≈ 25%)</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 leading-normal">
                {evePresent ? (
                  <span className="text-rose-400 font-medium">
                    ⚠️ Attack simulation active: Eve will intercept and resend each photon, disturbing quantum states by ~25% and triggering an automatic transaction abort!
                  </span>
                ) : (
                  <span>
                    Channel is clear. Alice and Bob will establish a secure sifted key with 0% error rate.
                  </span>
                )}
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isProcessing || sendAmount <= 0 || currentAccount.balance < debitFromSender}
              className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                evePresent
                  ? 'bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-950/50'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg shadow-emerald-950/50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Modulating Quantum States...</span>
                </>
              ) : (
                <>
                  <span>{evePresent ? 'Send Compromised Transfer' : 'Send Secure Transfer'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Transaction Ledger Table with Multi-Currency Columns */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Multi-Currency Transaction Ledger</h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  Showing transactions for {currentAccount.holderName} ({currentAccount.accountNumber})
                </div>
              </div>
              <button
                onClick={onViewAudit}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                View Full Audit
              </button>
            </div>

            {accountTransactions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
                <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No transactions recorded yet</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Use the transfer form to execute your first quantum-encrypted multi-currency transaction.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2 font-medium">Tx ID</th>
                      <th className="py-2 font-medium">Direction</th>
                      <th className="py-2 font-medium text-right">Amount Sent</th>
                      <th className="py-2 font-medium text-right">Amount Received</th>
                      <th className="py-2 font-medium text-center">Rate</th>
                      <th className="py-2 font-medium text-center">QBER</th>
                      <th className="py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {accountTransactions.slice(0, 7).map(tx => {
                      const isSender = tx.senderAccountId === currentAccount.accountNumber;
                      const isCommitted = tx.status === 'COMMITTED';
                      const sentCurr = tx.sentCurrency || 'USD';
                      const recvCurr = tx.receivedCurrency || 'USD';
                      const sentAmt = tx.sentAmount || tx.amount;
                      const recvAmt = tx.receivedAmount || tx.amount;
                      const rate = tx.exchangeRate || 1.0;

                      return (
                        <tr key={tx.txId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 text-slate-300 font-mono text-[11px]">{tx.txId}</td>
                          <td className="py-2.5 text-slate-400 font-sans text-xs">
                            {isSender ? (
                              <span className="text-amber-400">Debit (To {tx.receiverName})</span>
                            ) : (
                              <span className="text-emerald-400">Credit (From {tx.senderName})</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-slate-100 font-medium">
                            {formatCurrency(sentAmt, sentCurr)}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-emerald-400 font-medium">
                            {formatCurrency(recvAmt, recvCurr)}
                          </td>
                          <td className="py-2.5 text-center text-slate-400 text-[11px]">
                            {rate < 1 ? rate.toFixed(4) : rate.toFixed(2)}
                          </td>
                          <td className="py-2.5 text-center tabular-nums">
                            <span className={tx.qberPercentage > 11 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                              {tx.qberPercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-sans">
                            {isCommitted ? (
                              <span className="text-emerald-400 font-medium text-[11px]">
                                Committed
                              </span>
                            ) : (
                              <span className="text-rose-400 font-medium text-[11px]">
                                Aborted (Eve)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Instant currency conversion at quantum physical layer with Indian numbering (₹) & European formats.</span>
            <span className="font-mono text-cyan-400">ACID Atomic Conservation</span>
          </div>
        </div>
      </div>

      {/* Live Pipeline Execution Stepper Modal */}
      {showExecutionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                <h3 className="text-sm font-semibold text-white">Quantum Pipeline Execution (8-Step)</h3>
              </div>
              <button
                onClick={() => setShowExecutionModal(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>

            {/* Stepper Progress */}
            <div className="mt-4 space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {PIPELINE_STEPS.map(step => {
                const isDone = executionResult ? executionResult.stageReached >= step.num : activeStepIndex > step.num;
                const isCurrent = !executionResult && activeStepIndex === step.num;
                const isFailed = executionResult && !executionResult.success && executionResult.stageReached === step.num;

                return (
                  <div
                    key={step.num}
                    className={`p-2.5 rounded-lg border text-xs transition-all flex items-start gap-3 ${
                      isFailed
                        ? 'bg-rose-950/30 border-rose-600/60 text-rose-200'
                        : isDone
                        ? 'bg-slate-950/50 border-emerald-500/30 text-slate-300'
                        : isCurrent
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                        : 'bg-slate-950/20 border-slate-800 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isFailed ? (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px]">
                          {step.num}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-100">
                          Step {step.num}: {step.title}
                        </span>
                        {step.num === 2 && executionResult && (
                          <span
                            className={`font-mono font-bold text-[11px] ${
                              executionResult.bb84Result.qberPercentage > 11
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            QBER: {executionResult.bb84Result.qberPercentage.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Execution Result Banner */}
            {executionResult && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                {executionResult.success ? (
                  <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-xl p-3.5 text-xs text-emerald-200">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Transaction Committed Successfully
                    </div>
                    <p className="mt-1 text-slate-300 text-[11px]">
                      Sent {formatCurrency(sendAmount, sendCurrency)} → {targetRecipient?.holderName} received {formatCurrency(estimatedReceived, recipientNativeCurrency)} (Rate: {exchangeRate.toFixed(4)}).
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded">
                      <div>Key Fingerprint: {executionResult.bb84Result.keyFingerprint.slice(0, 16)}...</div>
                      <div>HMAC Tag: {executionResult.encryptedPayload?.hmacTagHex.slice(0, 16)}...</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-rose-950/40 border border-rose-600/40 rounded-xl p-3.5 text-xs text-rose-200">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      Transaction Aborted by Quantum Physical Layer
                    </div>
                    <p className="mt-1 text-slate-300 text-[11px] leading-relaxed">
                      {executionResult.errorMessage}
                    </p>
                    <div className="mt-2 text-[11px] font-semibold text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 p-2 rounded">
                      ✓ Atomic Rollback Verified: Zero balances were deducted from sender or credited to recipient.
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      const bb84 = executionResult?.bb84Result;
                      setShowExecutionModal(false);
                      onViewQuantumConsole(bb84);
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium text-cyan-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-lg border border-cyan-500/40 hover:border-cyan-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-cyan-950/40"
                  >
                    <Radio className="w-3.5 h-3.5 text-cyan-400" />
                    Inspect in Quantum Console
                  </button>
                  <button
                    onClick={() => setShowExecutionModal(false)}
                    className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
