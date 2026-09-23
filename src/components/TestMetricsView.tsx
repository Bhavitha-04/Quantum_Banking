import React, { useState, useEffect } from 'react';
import { TestResultItem } from '../types/quantum';
import { runFullTestSuite, calculateAggregateMetrics, AggregateMetrics } from '../lib/testRunner';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  Clock,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export const TestMetricsView: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<TestResultItem[]>([]);
  const [summary, setSummary] = useState<{ passed: number; failed: number; totalDuration: number } | null>(null);
  const [metrics, setMetrics] = useState<AggregateMetrics>(() => calculateAggregateMetrics());

  const executeTests = async () => {
    setIsRunning(true);
    try {
      const res = await runFullTestSuite();
      setTestResults(res.results);
      setSummary({
        passed: res.passedCount,
        failed: res.failedCount,
        totalDuration: res.totalDurationMs,
      });
      setMetrics(calculateAggregateMetrics());
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeTests();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Testing, Reproducibility & Metrics Dashboard (Step 8)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated test suite validating all 6 core quantum and banking cryptographic assertions
          </p>
        </div>

        <button
          onClick={executeTests}
          disabled={isRunning}
          className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Executing Pytest Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Automated Test Suite</span>
            </>
          )}
        </button>
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block">Total BB84 Quantum Runs</span>
          <span className="text-2xl font-bold font-mono text-white mt-1 block tabular-nums">
            {metrics.totalBB84Runs}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Includes test & pipeline cycles</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block">Mean QBER: Eve OFF vs ON</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {metrics.avgQberWithoutEve.toFixed(1)}%
            </span>
            <span className="text-slate-500 font-mono text-xs">/</span>
            <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {metrics.avgQberWithEve.toFixed(1)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Expected: ~0% / ~25%</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block">Transfers: Committed vs Aborted</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {metrics.committedTransfers}
            </span>
            <span className="text-slate-500 font-mono text-xs">/</span>
            <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
              {metrics.abortedTransfers}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {metrics.totalTransfers} Total Transactions
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-[11px] text-slate-400 block">Avg Key Exchange Latency</span>
          <span className="text-2xl font-bold font-mono text-cyan-300 mt-1 block tabular-nums">
            {metrics.avgKeyExchangeMs.toFixed(1)} ms
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Sub-millisecond sifting</span>
        </div>
      </div>

      {/* Feature 5: Multi-Currency & User Registration Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Total Users Registered</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
              PBKDF2 Salted
            </span>
          </div>
          <span className="text-2xl font-bold font-mono text-white mt-1 block tabular-nums">
            {metrics.totalUsers} Accounts
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Pre-seeded & registered clients</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Currency Pairs Used</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
              FX Cross-Border
            </span>
          </div>
          <div className="text-sm font-bold font-mono text-cyan-300 mt-1.5 flex flex-wrap gap-1.5">
            {metrics.currencyPairsUsed.map(pair => (
              <span key={pair} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-xs">
                {pair}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">Active quantum payment corridors</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Avg Transfer Amount (USD Eq.)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
              Normalized
            </span>
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block tabular-nums">
            ${metrics.avgTransferAmountUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Across all currency transactions</span>
        </div>
      </div>

      {/* Test Suite Run Results */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white">Pytest Unit & Integration Suite</span>
            {summary && (
              <span className="text-[11px] font-mono text-slate-400">
                Executed in {summary.totalDuration}ms
              </span>
            )}
          </div>

          {summary && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                {summary.passed} Passed
              </span>
              {summary.failed > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                  {summary.failed} Failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Test Items */}
        <div className="space-y-3">
          {testResults.map(test => (
            <div
              key={test.id}
              className={`p-3.5 rounded-lg border text-xs transition-colors ${
                test.passed
                  ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  : 'bg-rose-950/30 border-rose-600/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {test.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-200">
                        {test.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-sans">·</span>
                      <span className="text-[11px] text-slate-400 font-sans">{test.category}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      {test.details}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-[11px] text-slate-500 block">
                    {test.durationMs}ms
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      test.passed ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>

              {test.metrics && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap gap-4 text-[10px] font-mono text-slate-400">
                  {Object.entries(test.metrics).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-slate-500">{key}: </span>
                      <span className="text-slate-300 font-semibold">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
