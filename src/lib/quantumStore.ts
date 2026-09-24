import { useState, useEffect, useCallback } from 'react';
import { BB84Result } from '../types/quantum';
import { runBB84Protocol } from './bb84';

export interface StoredBB84Run {
  result: BB84Result;
  timestamp: string;
  source: 'transaction' | 'manual' | 'default';
  // Required fields specified in requirements:
  aliceBits: number[];
  aliceBases: ('Z' | 'X')[];
  bobBases: ('Z' | 'X')[];
  bobMeasuredBits: number[];
  siftedKey: number[];
  observedQber: number; // e.g. 25.0
  eveStatus: boolean;
  channelDecision: 'SECURE' | 'COMPROMISED';
  aesKey: string | null;
  siftedKeyLength: number;
}

class QuantumStore {
  private lastRun: StoredBB84Run | null = null;
  private listeners: Set<(run: StoredBB84Run) => void> = new Set();

  public setLastRun(bb84: BB84Result, source: 'transaction' | 'manual' | 'default' = 'transaction'): StoredBB84Run {
    const isSecure = bb84.isSecure && !bb84.thresholdExceeded && bb84.qber <= 0.11;
    const run: StoredBB84Run = {
      result: {
        ...bb84,
        isSecure,
        thresholdExceeded: !isSecure,
        derivedAesKeyHex: isSecure ? bb84.derivedAesKeyHex : '',
      },
      timestamp: new Date().toISOString(),
      source,
      aliceBits: [...bb84.aliceRawBits],
      aliceBases: [...bb84.aliceBases],
      bobBases: [...bb84.bobBases],
      bobMeasuredBits: [...bb84.bobRawBits],
      siftedKey: isSecure ? [...bb84.aliceSiftedKey] : [],
      observedQber: Number(bb84.qberPercentage.toFixed(1)),
      eveStatus: bb84.evePresent,
      channelDecision: isSecure ? 'SECURE' : 'COMPROMISED',
      aesKey: isSecure ? bb84.derivedAesKeyHex : null,
      siftedKeyLength: bb84.siftedIndices ? bb84.siftedIndices.length : 0,
    };
    this.lastRun = run;
    this.notify();
    return run;
  }

  public getLastRun(): StoredBB84Run {
    if (!this.lastRun) {
      const defaultResult = runBB84Protocol({ numBits: 32, evePresent: false });
      return this.setLastRun(defaultResult, 'default');
    }
    return this.lastRun;
  }

  public subscribe(listener: (run: StoredBB84Run) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    if (this.lastRun) {
      this.listeners.forEach(fn => {
        try {
          fn(this.lastRun!);
        } catch {
          // ignore error in listener
        }
      });
    }
  }
}

export const quantumStore = new QuantumStore();

export function useQuantumStore(): [StoredBB84Run, (bb84: BB84Result, source?: 'transaction' | 'manual') => void] {
  const [storedRun, setStoredRun] = useState<StoredBB84Run>(() => quantumStore.getLastRun());

  useEffect(() => {
    return quantumStore.subscribe((newRun) => {
      setStoredRun(newRun);
    });
  }, []);

  const updateRun = useCallback((bb84: BB84Result, source: 'transaction' | 'manual' = 'manual') => {
    quantumStore.setLastRun(bb84, source);
  }, []);

  return [storedRun, updateRun];
}
