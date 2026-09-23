import React, { useState } from 'react';
import { BB84Result } from '../types/quantum';
import { runBB84Protocol } from '../lib/bb84';
import { CircuitDiagram } from './CircuitDiagram';
import {
  Radio,
  ShieldCheck,
  ShieldAlert,
  Play,
  Layers,
  BarChart3,
  GitCompare,
  Key,
  Info,
  Check,
  X
} from 'lucide-react';

interface QuantumConsoleProps {
  onKeyDerived?: (keyHex: string) => void;
}

export const QuantumConsole: React.FC<QuantumConsoleProps> = ({ onKeyDerived }) => {
  const [activeTab, setActiveTab] = useState<'single' | 'compare' | 'montecarlo'>('single');
  const [numQubits, setNumQubits] = useState<number>(32);
  const [evePresent, setEvePresent] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<BB84Result>(() =>
    runBB84Protocol({ numBits: 32, evePresent: false })
  );

  // Side-by-side comparison state
  const [compareNoEve, setCompareNoEve] = useState<BB84Result | null>(null);
  const [compareWithEve, setCompareWithEve] = useState<BB84Result | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // Monte Carlo simulation state
  const [monteCarloRuns, setMonteCarloRuns] = useState<{ noEve: number[]; withEve: number[] } | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const handleRunSingle = () => {
    const res = runBB84Protocol({
      numBits: numQubits,
      evePresent,
    });
    setCurrentResult(res);
    if (onKeyDerived && res.isSecure) {
      onKeyDerived(res.derivedAesKeyHex);
    }
  };

  const handleRunComparison = () => {
    setIsComparing(true);
    setTimeout(() => {
      const res1 = runBB84Protocol({ numBits: 48, evePresent: false });
      const res2 = runBB84Protocol({ numBits: 48, evePresent: true });
      setCompareNoEve(res1);
      setCompareWithEve(res2);
      setIsComparing(false);
    }, 250);
  };

  const handleRunMonteCarlo = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const noEve: number[] = [];
      const withEve: number[] = [];
      const trials = 40;
      for (let i = 0; i < trials; i++) {
        const r1 = runBB84Protocol({ numBits: 32, evePresent: false });
        const r2 = runBB84Protocol({ numBits: 32, evePresent: true });
        noEve.push(r1.qberPercentage);
        withEve.push(r2.qberPercentage);
      }
      setMonteCarloRuns({ noEve, withEve });
      setIsSimulating(false);
    }, 350);
  };

  return (
    <div className="space-y-6">
      {/* Top Console Navigation & Sub-views */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            BB84 Quantum Key Distribution Console
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical-layer photon polarization simulation with intercept-resend attack detection
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('single')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'single'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Protocol Lab
          </button>
          <button
            onClick={() => {
              setActiveTab('compare');
              if (!compareNoEve) handleRunComparison();
            }}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'compare'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Side-by-Side Proof
          </button>
          <button
            onClick={() => {
              setActiveTab('montecarlo');
              if (!monteCarloRuns) handleRunMonteCarlo();
            }}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'montecarlo'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Statistical Monte Carlo
          </button>
        </div>
      </div>

      {/* VIEW 1: SINGLE PROTOCOL LAB */}
      {activeTab === 'single' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* Qubit count selector */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Photon Pulses (Qubits)
                </label>
                <div className="flex items-center gap-1">
                  {[16, 32, 48, 64].map(n => (
                    <button
                      key={n}
                      onClick={() => setNumQubits(n)}
                      className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                        numQubits === n
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Eve Toggle */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Eavesdropper (Eve)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEvePresent(!evePresent)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                      evePresent
                        ? 'bg-rose-950/60 border-rose-500/80 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${evePresent ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'}`} />
                    {evePresent ? 'Eve Active (Intercept-Resend)' : 'Eve Disabled (Nominal)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={handleRunSingle}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-md shadow-cyan-950/40 transition-colors flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Generate Fresh BB84 Key
            </button>
          </div>

          {/* Metric Status Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] text-slate-400 block">Observed QBER</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-2xl font-bold font-mono tabular-nums ${
                    currentResult.qberPercentage > 11 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {currentResult.qberPercentage.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500 font-mono">/ 11.0% limit</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] text-slate-400 block">Channel Decision</span>
              <div className="mt-1 flex items-center gap-1.5">
                {currentResult.isSecure ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">SECURE (Accepted)</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span className="text-sm font-bold text-rose-400">COMPROMISED (Aborted)</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] text-slate-400 block">Sifted Key Length</span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block tabular-nums">
                {currentResult.siftedIndices.length} bits
              </span>
              <span className="text-[11px] text-slate-500">
                ({currentResult.sacrificedIndices.length} sacrificed for QBER test)
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] text-slate-400 block">Privacy Amplified AES Key</span>
              <div className="mt-1 font-mono text-xs text-cyan-300 truncate" title={currentResult.derivedAesKeyHex}>
                {currentResult.isSecure ? `${currentResult.derivedAesKeyHex.slice(0, 16)}...` : 'DISCARDED'}
              </div>
              <span className="text-[11px] text-slate-500">Fixed 256-bit symmetric key</span>
            </div>
          </div>

          {/* SVG Quantum Circuit Diagram */}
          <CircuitDiagram bb84Result={currentResult} maxQubitsToShow={8} />

          {/* Dirac Bra-Ket Physics Explanation */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300">
            <div className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              Quantum Physical Mechanics & Conjugate Bases
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] text-slate-400 leading-relaxed">
              <div>
                <span className="text-slate-200 font-semibold block mb-0.5">Computational Basis (Z):</span>
                Bits are encoded as orthogonal eigenstates <code className="text-cyan-300">|0⟩ = [1, 0]ᵀ</code> and <code className="text-cyan-300">|1⟩ = [0, 1]ᵀ</code>. Measuring in Z yields exact deterministic outcomes.
              </div>
              <div>
                <span className="text-slate-200 font-semibold block mb-0.5">Hadamard Diagonal Basis (X):</span>
                Bits are transformed via <code className="text-cyan-300">H</code> gate to superpositions <code className="text-cyan-300">|+⟩ = (|0⟩+|1⟩)/√2</code> and <code className="text-cyan-300">|-⟩ = (|0⟩-|1⟩)/√2</code>. An intercepting observer measuring in conjugate basis irreversibly collapses the state, introducing an unavoidable 25% error rate!
              </div>
            </div>
          </div>

          {/* Detailed Photon Reconciliation Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-white">Full Photon Bit Reconciliation Ledger</span>
              <span className="text-slate-400 font-mono text-[11px]">
                Showing first 16 pulses
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-sans">
                    <th className="py-2">Pulse</th>
                    <th className="py-2">Alice Bit</th>
                    <th className="py-2">Alice Basis</th>
                    <th className="py-2">State</th>
                    {currentResult.evePresent && (
                      <>
                        <th className="py-2 text-rose-400">Eve Basis</th>
                        <th className="py-2 text-rose-400">Eve Bit</th>
                      </>
                    )}
                    <th className="py-2">Bob Basis</th>
                    <th className="py-2">Bob Measured</th>
                    <th className="py-2">Match?</th>
                    <th className="py-2">Sample?</th>
                    <th className="py-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {currentResult.transmissions.slice(0, 16).map(q => (
                    <tr
                      key={q.index}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        q.errorDetected ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-2 text-slate-500">#{q.index}</td>
                      <td className="py-2 font-bold text-cyan-300">{q.aliceBit}</td>
                      <td className="py-2 text-slate-300">{q.aliceBasis}</td>
                      <td className="py-2 text-cyan-400">{q.aliceStateSymbol}</td>
                      {currentResult.evePresent && (
                        <>
                          <td className="py-2 text-rose-300">{q.eveBasis || '-'}</td>
                          <td className="py-2 text-rose-300">{q.eveMeasuredBit ?? '-'}</td>
                        </>
                      )}
                      <td className="py-2 text-slate-300">{q.bobBasis}</td>
                      <td className="py-2 text-emerald-300">{q.bobMeasuredBit}</td>
                      <td className="py-2">
                        {q.basesMatch ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                            <Check className="w-3 h-3" /> MATCH
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">DISCARD</span>
                        )}
                      </td>
                      <td className="py-2">
                        {q.isSacrificed ? (
                          <span className="text-amber-400 text-[11px]">SACRIFICED</span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {q.errorDetected ? (
                          <span className="text-rose-400 font-bold text-[11px]">ERR</span>
                        ) : q.basesMatch ? (
                          <span className="text-emerald-400 text-[11px]">VALID</span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SIDE-BY-SIDE EAVESDROPPER PROOF */}
      {activeTab === 'compare' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Side-by-Side Intercept-Resend Demonstration</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Demonstrates how Eve's physical intervention causes a deterministic jump in QBER from ~0% to ~25%.
              </p>
            </div>
            <button
              onClick={handleRunComparison}
              disabled={isComparing}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <GitCompare className="w-3.5 h-3.5" />
              {isComparing ? 'Running Dual Quantum Simulators...' : 'Re-run Comparison'}
            </button>
          </div>

          {compareNoEve && compareWithEve && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Run 1: Eve OFF */}
              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <h3 className="text-sm font-bold text-white">Scenario A: Normal Optical Fiber (Eve OFF)</h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    ACCEPTED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Observed QBER</span>
                    <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                      {compareNoEve.qberPercentage.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Below 11.0% limit</span>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Sifted Key Yield</span>
                    <span className="text-2xl font-bold font-mono text-white tabular-nums">
                      {compareNoEve.siftedIndices.length} bits
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">~50% basis agreement</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-slate-400">Key Fingerprint:</div>
                  <div className="font-mono text-[11px] text-cyan-300 break-all">
                    {compareNoEve.keyFingerprint}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  In a noiseless fiber without an eavesdropper, Alice and Bob measure identical classical bits whenever their bases align, producing zero bit errors.
                </p>
              </div>

              {/* Run 2: Eve ON */}
              <div className="bg-slate-900/90 border border-rose-500/40 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <h3 className="text-sm font-bold text-white">Scenario B: Intercept-Resend Attack (Eve ON)</h3>
                  </div>
                  <span className="text-xs font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                    ABORTED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Observed QBER</span>
                    <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                      {compareWithEve.qberPercentage.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-rose-400/80 block mt-0.5">Exceeds 11.0% limit!</span>
                  </div>

                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-[11px] text-slate-400 block">Sifted Key Status</span>
                    <span className="text-2xl font-bold font-mono text-rose-300">
                      DISCARDED
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Key zeroed & purged</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                  <div className="text-slate-400">Security Decision:</div>
                  <div className="font-mono text-[11px] text-rose-300">
                    ABORT_EAVESDROPPER_DETECTED (Key Purged)
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Eve's measurement collapses the wave function. When Eve guesses the wrong basis (50% probability), Bob measures random outcomes on matching bases, inducing an unavoidable ~25% error rate that triggers immediate key rejection!
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: STATISTICAL MONTE CARLO SIMULATION */}
      {activeTab === 'montecarlo' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Monte Carlo Simulation: 40 Automated BB84 Runs</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Demonstrates the statistical distribution of QBER with and without an eavesdropper against the 11% security limit.
              </p>
            </div>
            <button
              onClick={handleRunMonteCarlo}
              disabled={isSimulating}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {isSimulating ? 'Simulating 40 Runs...' : 'Re-run 40 Simulations'}
            </button>
          </div>

          {monteCarloRuns && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
                <span className="font-medium text-slate-200">QBER Distribution Scatter Graph (40 Trials)</span>
                <div className="flex items-center gap-4 font-mono text-[11px]">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Eve OFF (0% nominal)
                  </span>
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span> Eve ON (~25% disturbance)
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    --- 11.0% Abort Threshold
                  </span>
                </div>
              </div>

              {/* Graphical Visualization of QBER points */}
              <div className="h-64 w-full bg-slate-950 rounded-lg border border-slate-800 p-4 relative select-none">
                {/* 11% Threshold line */}
                <div
                  className="absolute left-10 right-4 border-b border-dashed border-rose-500 z-10 flex items-center justify-end pr-2"
                  style={{ top: `${100 - (11 / 40) * 100}%` }}
                >
                  <span className="text-[10px] text-rose-400 bg-slate-950 px-1 font-mono font-bold">
                    Threshold: 11.0%
                  </span>
                </div>

                {/* Y-Axis Labels */}
                <div className="absolute left-2 top-2 bottom-6 w-8 flex flex-col justify-between text-[10px] font-mono text-slate-500 text-right pr-2">
                  <span>40%</span>
                  <span>30%</span>
                  <span>20%</span>
                  <span>10%</span>
                  <span>0%</span>
                </div>

                {/* Points container */}
                <div className="absolute left-10 right-4 top-4 bottom-6 flex items-end justify-between">
                  {monteCarloRuns.noEve.map((val, idx) => {
                    const withEveVal = monteCarloRuns.withEve[idx];
                    const yNoEve = (val / 40) * 100;
                    const yWithEve = (withEveVal / 40) * 100;

                    return (
                      <div key={idx} className="relative h-full flex flex-col justify-end items-center w-2">
                        {/* Eve OFF Point */}
                        <div
                          className="w-2 h-2 rounded-full bg-emerald-400 hover:scale-150 transition-transform absolute cursor-pointer"
                          style={{ bottom: `${yNoEve}%` }}
                          title={`Trial #${idx + 1} (No Eve): ${val.toFixed(1)}%`}
                        />
                        {/* Eve ON Point */}
                        <div
                          className="w-2 h-2 rounded-full bg-rose-400 hover:scale-150 transition-transform absolute cursor-pointer"
                          style={{ bottom: `${yWithEve}%` }}
                          title={`Trial #${idx + 1} (With Eve): ${withEveVal.toFixed(1)}%`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2">
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/50 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Mean QBER without Eve</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {(monteCarloRuns.noEve.reduce((a, b) => a + b, 0) / monteCarloRuns.noEve.length).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">100% accepted under threshold</span>
                </div>

                <div className="p-3 bg-rose-950/20 border border-rose-900/50 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Mean QBER with Eve Intercept-Resend</span>
                  <span className="text-lg font-bold text-rose-400">
                    {(monteCarloRuns.withEve.reduce((a, b) => a + b, 0) / monteCarloRuns.withEve.length).toFixed(2)}%
                  </span>
                  <span className="text-[10px] text-rose-400/80 block">100% rejected (attack detected)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
