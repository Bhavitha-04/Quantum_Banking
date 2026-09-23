import React from 'react';
import { BB84Result } from '../types/quantum';

interface CircuitDiagramProps {
  bb84Result: BB84Result;
  maxQubitsToShow?: number;
}

export const CircuitDiagram: React.FC<CircuitDiagramProps> = ({
  bb84Result,
  maxQubitsToShow = 8,
}) => {
  const qubits = bb84Result.transmissions.slice(0, maxQubitsToShow);
  const rowHeight = 52;
  const totalHeight = Math.max(160, qubits.length * rowHeight + 40);
  const width = 860;

  // Gate column positions
  const colQubitLabel = 40;
  const colAlicePrep = 110;
  const colAliceBasis = 180;
  const colChannelStart = 240;
  const colEveBox = 380;
  const colChannelEnd = 520;
  const colBobBasis = 620;
  const colBobMeasure = 700;
  const colResult = 790;

  return (
    <div className="w-full overflow-x-auto bg-slate-900/90 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-200">Quantum Circuit Schematic</span>
          <span>·</span>
          <span>Showing {qubits.length} of {bb84Result.numBits} Qubits</span>
          <span>·</span>
          <span>Qiskit Aer Quantum Circuit Equivalent</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500/20 border border-cyan-400"></span>
            Alice (Encoding)
          </span>
          {bb84Result.evePresent && (
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-400"></span>
              Eve (Intercept-Resend)
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-400"></span>
            Bob (Measurement)
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        className="w-full select-none font-mono"
        style={{ minWidth: '780px' }}
      >
        <defs>
          <linearGradient id="channelGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="50%" stopColor={bb84Result.evePresent ? "#f43f5e" : "#0284c7"} stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Section Column Headers */}
        <text x={colAlicePrep + 35} y={16} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">
          ALICE ENCODING
        </text>
        <text x={colEveBox} y={16} fill={bb84Result.evePresent ? "#fb7185" : "#64748b"} fontSize="10" textAnchor="middle" fontWeight="600">
          {bb84Result.evePresent ? 'EVE INTERCEPT / RESEND' : 'QUANTUM FIBER CHANNEL'}
        </text>
        <text x={colBobBasis + 40} y={16} fill="#94a3b8" fontSize="10" textAnchor="middle" fontWeight="600">
          BOB MEASUREMENT
        </text>

        {qubits.map((q, idx) => {
          const y = 44 + idx * rowHeight;
          const aBit = q.aliceBit;
          const aBasis = q.aliceBasis;
          const bBasis = q.bobBasis;
          const eveActive = q.eveIntercepted;

          return (
            <g key={q.index} className="transition-opacity hover:opacity-100">
              {/* Qubit line */}
              <text x={colQubitLabel} y={y + 4} fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">
                |q{idx}⟩
              </text>

              {/* Wire line */}
              <line
                x1={colQubitLabel + 20}
                y1={y}
                x2={colResult - 10}
                y2={y}
                stroke="#334155"
                strokeWidth="1.5"
              />

              {/* Alice Bit Preparation (X Gate if bit is 1) */}
              {aBit === 1 ? (
                <g transform={`translate(${colAlicePrep - 14}, ${y - 12})`}>
                  <rect width="28" height="24" rx="4" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  <text x="14" y="16" fill="#22d3ee" fontSize="11" textAnchor="middle" fontWeight="bold">
                    X
                  </text>
                </g>
              ) : (
                <g transform={`translate(${colAlicePrep - 14}, ${y - 12})`}>
                  <rect width="28" height="24" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1" strokeDasharray="2 2" />
                  <text x="14" y="15" fill="#64748b" fontSize="10" textAnchor="middle">
                    I
                  </text>
                </g>
              )}

              {/* Alice Basis Preparation (H Gate if basis is X) */}
              {aBasis === 'X' ? (
                <g transform={`translate(${colAliceBasis - 14}, ${y - 12})`}>
                  <rect width="28" height="24" rx="4" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.5" />
                  <text x="14" y="16" fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
                    H
                  </text>
                </g>
              ) : (
                <circle cx={colAliceBasis} cy={y} r="4" fill="#0284c7" />
              )}

              {/* Quantum channel wire with photon packet styling */}
              <line
                x1={colChannelStart}
                y1={y}
                x2={colChannelEnd}
                y2={y}
                stroke="url(#channelGrad)"
                strokeWidth="2"
                strokeDasharray="4 2"
              />

              {/* Eve Intercept-Resend Gate or Pass-Through */}
              {eveActive ? (
                <g transform={`translate(${colEveBox - 36}, ${y - 14})`}>
                  <rect width="72" height="28" rx="5" fill="#1e1020" stroke="#f43f5e" strokeWidth="1.5" />
                  <text x="36" y="13" fill="#fb7185" fontSize="9" textAnchor="middle" fontWeight="600">
                    EVE {q.eveBasis}
                  </text>
                  <text x="36" y="23" fill="#fca5a5" fontSize="9" textAnchor="middle">
                    [{q.eveMeasuredBit}] ↷
                  </text>
                </g>
              ) : (
                <g transform={`translate(${colEveBox - 16}, ${y - 8})`}>
                  <circle cx="16" cy="8" r="6" fill="#0369a1" opacity="0.3" />
                  <circle cx="16" cy="8" r="3" fill="#38bdf8" />
                </g>
              )}

              {/* Bob Basis Rotation (H Gate if basis is X) */}
              {bBasis === 'X' ? (
                <g transform={`translate(${colBobBasis - 14}, ${y - 12})`}>
                  <rect width="28" height="24" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
                  <text x="14" y="16" fill="#34d399" fontSize="11" textAnchor="middle" fontWeight="bold">
                    H
                  </text>
                </g>
              ) : (
                <circle cx={colBobBasis} cy={y} r="4" fill="#059669" />
              )}

              {/* Bob Measurement Detector Symbol */}
              <g transform={`translate(${colBobMeasure - 16}, ${y - 14})`}>
                <rect width="32" height="28" rx="4" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
                {/* Meter gauge arc */}
                <path d="M 6 20 A 10 10 0 0 1 26 20" fill="none" stroke="#6ee7b7" strokeWidth="1.5" />
                <line x1="16" y1="20" x2="22" y2="10" stroke="#ecfdf5" strokeWidth="1.5" />
              </g>

              {/* Classical output double wire & measurement outcome */}
              <line x1={colBobMeasure + 16} y1={y - 2} x2={colResult - 20} y2={y - 2} stroke="#475569" strokeWidth="1" />
              <line x1={colBobMeasure + 16} y1={y + 2} x2={colResult - 20} y2={y + 2} stroke="#475569" strokeWidth="1" />

              {/* Sifted & Error Status Flag */}
              <g transform={`translate(${colResult - 16}, ${y - 12})`}>
                <rect
                  width="54"
                  height="24"
                  rx="4"
                  fill={q.errorDetected ? "#450a0a" : q.basesMatch ? "#064e3b" : "#1e293b"}
                  stroke={q.errorDetected ? "#ef4444" : q.basesMatch ? "#10b981" : "#475569"}
                  strokeWidth="1"
                />
                <text
                  x="27"
                  y="15"
                  fill={q.errorDetected ? "#fca5a5" : q.basesMatch ? "#a7f3d0" : "#94a3b8"}
                  fontSize="10"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {q.errorDetected ? "ERR" : q.basesMatch ? `b=${q.bobMeasuredBit}` : "DISC"}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
