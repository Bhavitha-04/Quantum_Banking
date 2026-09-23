/**
 * QuantumBank Core Types & Interfaces
 * Step 1 - Step 8 Data Structures
 */

import { CurrencyCode } from '../lib/currency';

export type Basis = 'Z' | 'X'; // Z = Computational {|0>, |1>}, X = Hadamard {|+>, |->}

export interface QubitTransmission {
  index: number;
  aliceBit: number; // 0 or 1
  aliceBasis: Basis;
  aliceStateSymbol: string; // |0>, |1>, |+>, |->
  eveIntercepted: boolean;
  eveBasis?: Basis;
  eveMeasuredBit?: number;
  bobBasis: Basis;
  bobMeasuredBit: number;
  basesMatch: boolean;
  isSacrificed: boolean;
  errorDetected: boolean;
}

export interface BB84Result {
  numBits: number;
  evePresent: boolean;
  transmissions: QubitTransmission[];
  aliceRawBits: number[];
  aliceBases: Basis[];
  bobBases: Basis[];
  bobRawBits: number[];
  siftedIndices: number[];
  aliceSiftedKey: number[];
  bobSiftedKey: number[];
  sacrificedIndices: number[];
  sacrificedAliceBits: number[];
  sacrificedBobBits: number[];
  mismatchedSacrificedBits: number;
  qber: number; // Quantum Bit Error Rate (0.00 to 1.00)
  qberPercentage: number;
  thresholdExceeded: boolean; // qber > 0.11 (11%)
  isSecure: boolean;
  finalKeyBits: number[]; // remaining unrevealed bits after sacrifice
  finalKeyHex: string;
  derivedAesKeyHex: string; // SHA-256 derived 256-bit AES key
  keyFingerprint: string; // SHA-256 fingerprint for audit
  timestamp: number;
  circuitSummary: {
    gatesCount: number;
    qubitsCount: number;
  };
}

export interface EncryptedPayload {
  ivHex: string; // 12-byte IV for AES-GCM
  ciphertextHex: string;
  authTagHex: string; // 16-byte GCM authentication tag
  hmacTagHex: string; // HMAC-SHA256 integrity tag
  plaintextPreview?: string;
}

export interface TransactionPayload {
  txId: string;
  senderAccountId: string;
  receiverAccountId: string;
  amount: number; // Legacy or sentAmount
  sentAmount: number;
  sentCurrency: CurrencyCode;
  receivedAmount: number;
  receivedCurrency: CurrencyCode;
  exchangeRate: number;
  amountInUSD: number;
  timestamp: string;
  nonce: string;
  note?: string;
}

export type TransactionStatus = 'COMMITTED' | 'ABORTED_EAVESDROPPER_DETECTED' | 'ABORTED_INTEGRITY_FAILED' | 'ABORTED_INSUFFICIENT_FUNDS';

export interface AuditRecord {
  txId: string;
  timestamp: string;
  senderAccountId: string;
  senderName: string;
  receiverAccountId: string;
  receiverName: string;
  amount: number; // Sent amount
  sentAmount: number;
  sentCurrency: CurrencyCode;
  receivedAmount: number;
  receivedCurrency: CurrencyCode;
  exchangeRate: number;
  amountInUSD: number;
  qber: number;
  qberPercentage: number;
  securityThreshold: number; // 0.11
  status: TransactionStatus;
  evePresent: boolean;
  keyFingerprint: string;
  ciphertextHash: string;
  hmacTag: string;
  payloadEncrypted: EncryptedPayload;
  rawPayload: TransactionPayload;
  securityNotes: string;
}

export interface BankAccount {
  accountNumber: string;
  userId: string;
  holderName: string;
  balance: number;
  currency: CurrencyCode;
  createdAt: string;
}

export interface BankUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: 'customer' | 'auditor' | 'admin';
  saltHex: string;
  passwordHashHex: string;
  accountNumber: string;
  preferredCurrency: CurrencyCode;
}

export interface TestResultItem {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details: string;
  metrics?: Record<string, string | number>;
}

