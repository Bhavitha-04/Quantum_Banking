/**
 * Banking Operations Layer & Quantum-Secure Transaction Pipeline
 * Implements Multi-Currency, PBKDF2 Authentication, SQLite-like persistence, and BB84 QKD.
 */

import {
  AuditRecord,
  BankAccount,
  BankUser,
  BB84Result,
  EncryptedPayload,
  TransactionPayload,
  TransactionStatus,
} from '../types/quantum';
import { runBB84Protocol, computeSyncHashHex } from './bb84';
import {
  decryptTransaction,
  deriveAesKey,
  encryptTransaction,
  hashPasswordWithSalt,
} from './crypto';
import {
  CurrencyCode,
  convertCurrency,
  getExchangeRate,
  toUSD,
} from './currency';

const STORAGE_KEY_USERS = 'quantumbank_users_v2';
const STORAGE_KEY_ACCOUNTS = 'quantumbank_accounts_v2';
const STORAGE_KEY_AUDIT = 'quantumbank_audit_v2';
const STORAGE_KEY_CURRENT_USER = 'quantumbank_session_user_v2';

// Pre-seeded demo accounts specified in Feature 2:
// - Bob Martinez / username: bob / password: bob123 / currency: USD / balance: $46,200
// - Alice Vance / username: alice / password: alice123 / currency: INR / balance: ₹25,00,000 (2,500,000 INR)
// - Charlie Kumar / username: charlie / password: charlie123 / currency: USD / balance: $12,500
const INITIAL_USERS: BankUser[] = [
  {
    id: 'usr_bob',
    username: 'bob',
    displayName: 'Bob Martinez',
    email: 'bob@quantumbank.io',
    role: 'customer',
    saltHex: 'b2c3d4e5f60718293a4b',
    passwordHashHex: hashPasswordWithSalt('bob123', 'b2c3d4e5f60718293a4b'),
    accountNumber: 'QB-3309-8812',
    preferredCurrency: 'USD',
  },
  {
    id: 'usr_alice',
    username: 'alice',
    displayName: 'Alice Vance',
    email: 'alice@quantumbank.io',
    role: 'customer',
    saltHex: 'a1b2c3d4e5f60718293a',
    passwordHashHex: hashPasswordWithSalt('alice123', 'a1b2c3d4e5f60718293a'),
    accountNumber: 'QB-7701-4491',
    preferredCurrency: 'INR',
  },
  {
    id: 'usr_charlie',
    username: 'charlie',
    displayName: 'Charlie Kumar',
    email: 'charlie@quantumbank.io',
    role: 'customer',
    saltHex: 'c3d4e5f60718293a4b5c',
    passwordHashHex: hashPasswordWithSalt('charlie123', 'c3d4e5f60718293a4b5c'),
    accountNumber: 'QB-5510-9923',
    preferredCurrency: 'USD',
  },
  {
    id: 'usr_eve',
    username: 'eve',
    displayName: 'Eve Sterling',
    email: 'eve@quantumbank.io',
    role: 'customer',
    saltHex: 'e5f60718293a4b5c6d7e',
    passwordHashHex: hashPasswordWithSalt('eve123', 'e5f60718293a4b5c6d7e'),
    accountNumber: 'QB-9912-1004',
    preferredCurrency: 'EUR',
  },
];

const INITIAL_ACCOUNTS: BankAccount[] = [
  {
    accountNumber: 'QB-3309-8812',
    userId: 'usr_bob',
    holderName: 'Bob Martinez',
    balance: 46200.0,
    currency: 'USD',
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    accountNumber: 'QB-7701-4491',
    userId: 'usr_alice',
    holderName: 'Alice Vance',
    balance: 2500000.0, // ₹25,00,000 INR
    currency: 'INR',
    createdAt: '2026-01-15T08:30:00Z',
  },
  {
    accountNumber: 'QB-5510-9923',
    userId: 'usr_charlie',
    holderName: 'Charlie Kumar',
    balance: 12500.0,
    currency: 'USD',
    createdAt: '2026-02-01T12:00:00Z',
  },
  {
    accountNumber: 'QB-9912-1004',
    userId: 'usr_eve',
    holderName: 'Eve Sterling',
    balance: 11400.0, // €11,400 EUR
    currency: 'EUR',
    createdAt: '2026-02-18T14:45:00Z',
  },
];

function loadState<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveState<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save banking state:', e);
  }
}

export interface PipelineExecutionResult {
  success: boolean;
  stageReached: number; // 1 to 8
  stageName: string;
  txId: string;
  status: TransactionStatus;
  errorMessage?: string;
  bb84Result: BB84Result;
  derivedAesKeyHex?: string;
  encryptedPayload?: EncryptedPayload;
  decryptedPayload?: TransactionPayload;
  auditRecord?: AuditRecord;
  updatedSenderBalance?: number;
  updatedReceiverBalance?: number;
  sentAmount?: number;
  sentCurrency?: CurrencyCode;
  receivedAmount?: number;
  receivedCurrency?: CurrencyCode;
  exchangeRate?: number;
}

export class BankingLedger {
  private users: BankUser[];
  private accounts: BankAccount[];
  private auditLog: AuditRecord[];
  private currentUser: BankUser | null;

  constructor() {
    this.users = loadState<BankUser[]>(STORAGE_KEY_USERS, INITIAL_USERS);
    this.accounts = loadState<BankAccount[]>(STORAGE_KEY_ACCOUNTS, INITIAL_ACCOUNTS);
    this.auditLog = loadState<AuditRecord[]>(STORAGE_KEY_AUDIT, []);
    this.currentUser = loadState<BankUser | null>(STORAGE_KEY_CURRENT_USER, INITIAL_USERS[0]);

    // If audit log is empty, seed demo transactions showing multi-currency transfers
    if (this.auditLog.length === 0) {
      this.seedInitialAuditLog();
    }
  }

  private seedInitialAuditLog() {
    const mockTx1: AuditRecord = {
      txId: 'TX-QKD-982103',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      senderAccountId: 'QB-3309-8812',
      senderName: 'Bob Martinez',
      receiverAccountId: 'QB-7701-4491',
      receiverName: 'Alice Vance',
      amount: 1200.0,
      sentAmount: 1200.0,
      sentCurrency: 'USD',
      receivedAmount: 99600.0, // 1200 * 83
      receivedCurrency: 'INR',
      exchangeRate: 83.0,
      amountInUSD: 1200.0,
      qber: 0.0,
      qberPercentage: 0.0,
      securityThreshold: 0.11,
      status: 'COMMITTED',
      evePresent: false,
      keyFingerprint: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      ciphertextHash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      hmacTag: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      payloadEncrypted: {
        ivHex: '3a8f1b2c4d5e6f7a8b9c0d1e',
        ciphertextHex: 'a4b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
        authTagHex: '7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c',
        hmacTagHex: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
      },
      rawPayload: {
        txId: 'TX-QKD-982103',
        senderAccountId: 'QB-3309-8812',
        receiverAccountId: 'QB-7701-4491',
        amount: 1200.0,
        sentAmount: 1200.0,
        sentCurrency: 'USD',
        receivedAmount: 99600.0,
        receivedCurrency: 'INR',
        exchangeRate: 83.0,
        amountInUSD: 1200.0,
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        nonce: 'seed-nonce-982103',
        note: 'Cross-border interbank settlement USD→INR',
      },
      securityNotes: 'Quantum channel verified secure: QBER 0.0% ≤ 11.0% threshold. Sifted key privacy amplified. Converted $1,200.00 USD to ₹99,600.00 INR.',
    };

    const mockTx2: AuditRecord = {
      txId: 'TX-QKD-441920',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      senderAccountId: 'QB-7701-4491',
      senderName: 'Alice Vance',
      receiverAccountId: 'QB-5510-9923',
      receiverName: 'Charlie Kumar',
      amount: 100000.0, // ₹1,00,000 INR
      sentAmount: 100000.0,
      sentCurrency: 'INR',
      receivedAmount: 1204.82, // 100000 / 83
      receivedCurrency: 'USD',
      exchangeRate: 0.012048,
      amountInUSD: 1204.82,
      qber: 0.0,
      qberPercentage: 0.0,
      securityThreshold: 0.11,
      status: 'COMMITTED',
      evePresent: false,
      keyFingerprint: 'a8b7c6d5e4f30219283746501928374650192837465019283746501928374650',
      ciphertextHash: '6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
      hmacTag: '8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      payloadEncrypted: {
        ivHex: '4b5c6d7e8f9a0b1c2d3e4f5a',
        ciphertextHex: 'b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
        authTagHex: '8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d',
        hmacTagHex: '8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      },
      rawPayload: {
        txId: 'TX-QKD-441920',
        senderAccountId: 'QB-7701-4491',
        receiverAccountId: 'QB-5510-9923',
        amount: 100000.0,
        sentAmount: 100000.0,
        sentCurrency: 'INR',
        receivedAmount: 1204.82,
        receivedCurrency: 'USD',
        exchangeRate: 0.012048,
        amountInUSD: 1204.82,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        nonce: 'seed-nonce-441920',
        note: 'Quantum sensor research grant settlement INR→USD',
      },
      securityNotes: 'Quantum channel verified secure. Sifted key privacy amplified. Converted ₹1,00,000.00 INR to $1,204.82 USD.',
    };

    this.auditLog.push(mockTx2, mockTx1);
    saveState(STORAGE_KEY_AUDIT, this.auditLog);
  }

  // Auth Methods
  public getCurrentUser(): BankUser | null {
    return this.currentUser;
  }

  public setCurrentUser(user: BankUser | null): void {
    this.currentUser = user;
    saveState(STORAGE_KEY_CURRENT_USER, user);
  }

  public login(username: string, passwordPlain: string): { success: boolean; user?: BankUser; error?: string } {
    const cleanUsername = username.trim().toLowerCase();
    const user = this.users.find(u => u.username.toLowerCase() === cleanUsername);

    if (!user) {
      return { success: false, error: 'User account not found. Please register or verify username.' };
    }

    const calculatedHash = hashPasswordWithSalt(passwordPlain, user.saltHex);
    if (calculatedHash !== user.passwordHashHex) {
      return { success: false, error: 'Invalid password. Please check your credentials.' };
    }

    this.setCurrentUser(user);
    return { success: true, user };
  }

  public logout(): void {
    this.setCurrentUser(null);
  }

  public register(params: {
    fullName: string;
    username: string;
    email: string;
    passwordPlain: string;
    preferredCurrency: CurrencyCode;
    initialDeposit: number;
    depositCurrency: CurrencyCode;
  }): { success: boolean; user?: BankUser; error?: string } {
    const cleanUsername = params.username.trim().toLowerCase();

    if (this.users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return { success: false, error: `Username "${params.username}" is already taken.` };
    }

    const userId = `usr_${Math.random().toString(36).substring(2, 9)}`;
    const accountNumber = `QB-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate random 16-byte hex salt
    const saltHex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const passwordHashHex = hashPasswordWithSalt(params.passwordPlain, saltHex);

    // Initial deposit converted to preferred currency
    const initialBalanceInPreferred = convertCurrency(
      params.initialDeposit,
      params.depositCurrency,
      params.preferredCurrency
    );

    const newUser: BankUser = {
      id: userId,
      username: cleanUsername,
      displayName: params.fullName.trim(),
      email: params.email.trim(),
      role: 'customer',
      saltHex,
      passwordHashHex,
      accountNumber,
      preferredCurrency: params.preferredCurrency,
    };

    const newAccount: BankAccount = {
      accountNumber,
      userId,
      holderName: params.fullName.trim(),
      balance: initialBalanceInPreferred,
      currency: params.preferredCurrency,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    this.accounts.push(newAccount);

    saveState(STORAGE_KEY_USERS, this.users);
    saveState(STORAGE_KEY_ACCOUNTS, this.accounts);

    this.setCurrentUser(newUser);
    return { success: true, user: newUser };
  }

  public getUsers(): BankUser[] {
    return [...this.users];
  }

  public getAccounts(): BankAccount[] {
    return [...this.accounts];
  }

  public getAccount(accountNumber: string): BankAccount | undefined {
    return this.accounts.find(a => a.accountNumber === accountNumber);
  }

  public getAccountByUserId(userId: string): BankAccount | undefined {
    return this.accounts.find(a => a.userId === userId);
  }

  public getAuditLog(): AuditRecord[] {
    return [...this.auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getAuditRecord(txId: string): AuditRecord | undefined {
    return this.auditLog.find(r => r.txId === txId);
  }

  public resetToDefault(): void {
    this.users = [...INITIAL_USERS];
    this.accounts = [...INITIAL_ACCOUNTS];
    this.auditLog = [];
    this.seedInitialAuditLog();
    this.currentUser = INITIAL_USERS[0];
    saveState(STORAGE_KEY_USERS, this.users);
    saveState(STORAGE_KEY_ACCOUNTS, this.accounts);
    saveState(STORAGE_KEY_AUDIT, this.auditLog);
    saveState(STORAGE_KEY_CURRENT_USER, this.currentUser);
  }

  /**
   * Executes the Complete 8-Step Quantum-Secure Multi-Currency Transaction Pipeline
   */
  public async executePipeline(params: {
    senderAccountId: string;
    receiverAccountId: string;
    amount: number;
    sendCurrency?: CurrencyCode;
    note?: string;
    evePresent: boolean;
    numQubits?: number;
    simulateTampering?: boolean;
  }): Promise<PipelineExecutionResult> {
    const {
      senderAccountId,
      receiverAccountId,
      amount,
      note,
      evePresent,
      numQubits = 32,
      simulateTampering = false,
    } = params;

    const txId = `TX-QKD-${Math.floor(100000 + Math.random() * 900000)}`;
    const timestamp = new Date().toISOString();
    const nonce = computeSyncHashHex(txId + ':' + Date.now() + ':' + Math.random()).slice(0, 16);

    const sender = this.getAccount(senderAccountId);
    const receiver = this.getAccount(receiverAccountId);

    if (!sender) {
      throw new Error(`Sender account ${senderAccountId} does not exist`);
    }
    if (!receiver) {
      throw new Error(`Receiver account ${receiverAccountId} does not exist`);
    }
    if (senderAccountId === receiverAccountId) {
      throw new Error('Sender and receiver accounts cannot be the same');
    }
    if (amount <= 0) {
      throw new Error('Transfer amount must be strictly greater than 0');
    }

    // Currency calculations
    const sentCurrency: CurrencyCode = params.sendCurrency || sender.currency;
    const receivedCurrency: CurrencyCode = receiver.currency;

    // Sender is debited in their account's native currency
    const amountToDebitSender = convertCurrency(amount, sentCurrency, sender.currency);
    // Receiver is credited in their account's native currency
    const amountToCreditReceiver = convertCurrency(amount, sentCurrency, receivedCurrency);

    const exchangeRate = getExchangeRate(sentCurrency, receivedCurrency);
    const amountInUSD = toUSD(amount, sentCurrency);

    // Pre-check balance in sender's currency
    if (sender.balance < amountToDebitSender) {
      const abortRecord: AuditRecord = {
        txId,
        timestamp,
        senderAccountId,
        senderName: sender.holderName,
        receiverAccountId,
        receiverName: receiver.holderName,
        amount,
        sentAmount: amount,
        sentCurrency,
        receivedAmount: amountToCreditReceiver,
        receivedCurrency,
        exchangeRate,
        amountInUSD,
        qber: 0,
        qberPercentage: 0,
        securityThreshold: 0.11,
        status: 'ABORTED_INSUFFICIENT_FUNDS',
        evePresent,
        keyFingerprint: 'N/A',
        ciphertextHash: 'N/A',
        hmacTag: 'N/A',
        payloadEncrypted: {
          ivHex: '',
          ciphertextHex: '',
          authTagHex: '',
          hmacTagHex: '',
        },
        rawPayload: {
          txId,
          senderAccountId,
          receiverAccountId,
          amount,
          sentAmount: amount,
          sentCurrency,
          receivedAmount: amountToCreditReceiver,
          receivedCurrency,
          exchangeRate,
          amountInUSD,
          timestamp,
          nonce,
          note,
        },
        securityNotes: `Transaction aborted: Insufficient balance in ${sender.currency} (${sender.balance.toFixed(2)} available, requested debit ${amountToDebitSender.toFixed(2)}).`,
      };
      this.auditLog.unshift(abortRecord);
      saveState(STORAGE_KEY_AUDIT, this.auditLog);

      const emptyBB84 = runBB84Protocol({ numBits: 16, evePresent: false });
      return {
        success: false,
        stageReached: 0,
        stageName: 'Pre-flight Balance Check',
        txId,
        status: 'ABORTED_INSUFFICIENT_FUNDS',
        errorMessage: `Insufficient funds: Available ${sender.balance.toFixed(2)} ${sender.currency}, required ${amountToDebitSender.toFixed(2)} ${sender.currency}`,
        bb84Result: emptyBB84,
        sentAmount: amount,
        sentCurrency,
        receivedAmount: amountToCreditReceiver,
        receivedCurrency,
        exchangeRate,
      };
    }

    // ==========================================
    // STEP 1: Run BB84 Quantum Key Distribution
    // ==========================================
    const bb84Result = runBB84Protocol({
      numBits: numQubits,
      evePresent,
      eveInterceptRate: 1.0,
    });

    // ==========================================
    // STEP 2: Evaluate QBER against 11% Threshold
    // ==========================================
    if (bb84Result.thresholdExceeded || !bb84Result.isSecure) {
      // Eavesdropper disturbance detected!
      const abortRecord: AuditRecord = {
        txId,
        timestamp,
        senderAccountId,
        senderName: sender.holderName,
        receiverAccountId,
        receiverName: receiver.holderName,
        amount,
        sentAmount: amount,
        sentCurrency,
        receivedAmount: amountToCreditReceiver,
        receivedCurrency,
        exchangeRate,
        amountInUSD,
        qber: bb84Result.qber,
        qberPercentage: bb84Result.qberPercentage,
        securityThreshold: 0.11,
        status: 'ABORTED_EAVESDROPPER_DETECTED',
        evePresent,
        keyFingerprint: bb84Result.keyFingerprint,
        ciphertextHash: 'ABORTED_BEFORE_ENCRYPTION',
        hmacTag: 'NONE',
        payloadEncrypted: {
          ivHex: '',
          ciphertextHex: '',
          authTagHex: '',
          hmacTagHex: '',
        },
        rawPayload: {
          txId,
          senderAccountId,
          receiverAccountId,
          amount,
          sentAmount: amount,
          sentCurrency,
          receivedAmount: amountToCreditReceiver,
          receivedCurrency,
          exchangeRate,
          amountInUSD,
          timestamp,
          nonce,
          note,
        },
        securityNotes: `CRITICAL ALERT: Eavesdropping disturbance detected on quantum channel! QBER is ${bb84Result.qberPercentage.toFixed(1)}%, exceeding maximum theoretical bound of 11.0%. Key discarded; zero financial funds transferred.`,
      };

      // Atomic Rollback: No balances modified!
      this.auditLog.unshift(abortRecord);
      saveState(STORAGE_KEY_AUDIT, this.auditLog);

      return {
        success: false,
        stageReached: 2,
        stageName: 'Quantum Channel QBER Verification',
        txId,
        status: 'ABORTED_EAVESDROPPER_DETECTED',
        errorMessage: `Quantum channel compromised! QBER of ${bb84Result.qberPercentage.toFixed(1)}% exceeds the 11.0% security threshold. Transaction aborted.`,
        bb84Result,
        auditRecord: abortRecord,
        sentAmount: amount,
        sentCurrency,
        receivedAmount: amountToCreditReceiver,
        receivedCurrency,
        exchangeRate,
      };
    }

    // ==========================================
    // STEP 3: Quantum-to-Classical Key Derivation (SHA-256 Privacy Amplification)
    // ==========================================
    const aesKeyHex = deriveAesKey(bb84Result.finalKeyBits);

    // ==========================================
    // STEP 4: Payload Serialization & AES-256-GCM Encryption
    // ==========================================
    const rawPayload: TransactionPayload = {
      txId,
      senderAccountId,
      receiverAccountId,
      amount,
      sentAmount: amount,
      sentCurrency,
      receivedAmount: amountToCreditReceiver,
      receivedCurrency,
      exchangeRate,
      amountInUSD,
      timestamp,
      nonce,
      note,
    };

    let encrypted = await encryptTransaction(rawPayload, aesKeyHex);

    if (simulateTampering) {
      encrypted = {
        ...encrypted,
        ciphertextHex: encrypted.ciphertextHex.slice(0, -2) + 'ff',
      };
    }

    const ciphertextHash = computeSyncHashHex(encrypted.ciphertextHex);

    // ==========================================
    // STEP 5 & 6: Simulated Channel & Decryption / HMAC Verification
    // ==========================================
    const decryptResult = await decryptTransaction(encrypted, aesKeyHex);

    if (!decryptResult.success || !decryptResult.payload) {
      const abortRecord: AuditRecord = {
        txId,
        timestamp,
        senderAccountId,
        senderName: sender.holderName,
        receiverAccountId,
        receiverName: receiver.holderName,
        amount,
        sentAmount: amount,
        sentCurrency,
        receivedAmount: amountToCreditReceiver,
        receivedCurrency,
        exchangeRate,
        amountInUSD,
        qber: bb84Result.qber,
        qberPercentage: bb84Result.qberPercentage,
        securityThreshold: 0.11,
        status: 'ABORTED_INTEGRITY_FAILED',
        evePresent,
        keyFingerprint: bb84Result.keyFingerprint,
        ciphertextHash,
        hmacTag: encrypted.hmacTagHex,
        payloadEncrypted: encrypted,
        rawPayload,
        securityNotes: `Integrity check failed during transmission: ${decryptResult.error}`,
      };

      this.auditLog.unshift(abortRecord);
      saveState(STORAGE_KEY_AUDIT, this.auditLog);

      return {
        success: false,
        stageReached: 6,
        stageName: 'Decryption & HMAC-SHA256 Verification',
        txId,
        status: 'ABORTED_INTEGRITY_FAILED',
        errorMessage: decryptResult.error || 'Integrity failure on receiving node',
        bb84Result,
        derivedAesKeyHex: aesKeyHex,
        encryptedPayload: encrypted,
        auditRecord: abortRecord,
        sentAmount: amount,
        sentCurrency,
        receivedAmount: amountToCreditReceiver,
        receivedCurrency,
        exchangeRate,
      };
    }

    // ==========================================
    // STEP 7: Atomic Database Commit (Debit Sender, Credit Receiver in respective currencies)
    // ==========================================
    sender.balance -= amountToDebitSender;
    receiver.balance += amountToCreditReceiver;

    saveState(STORAGE_KEY_ACCOUNTS, this.accounts);

    // ==========================================
    // STEP 8: Immutable Audit Logging
    // ==========================================
    const commitRecord: AuditRecord = {
      txId,
      timestamp,
      senderAccountId,
      senderName: sender.holderName,
      receiverAccountId,
      receiverName: receiver.holderName,
      amount,
      sentAmount: amount,
      sentCurrency,
      receivedAmount: amountToCreditReceiver,
      receivedCurrency,
      exchangeRate,
      amountInUSD,
      qber: bb84Result.qber,
      qberPercentage: bb84Result.qberPercentage,
      securityThreshold: 0.11,
      status: 'COMMITTED',
      evePresent,
      keyFingerprint: bb84Result.keyFingerprint,
      ciphertextHash,
      hmacTag: encrypted.hmacTagHex,
      payloadEncrypted: encrypted,
      rawPayload,
      securityNotes: `Transaction completed under verified quantum security. QBER: ${bb84Result.qberPercentage.toFixed(1)}% ≤ 11.0%. AES-256-GCM authenticated, HMAC-SHA256 validated. Converted ${amount} ${sentCurrency} to ${amountToCreditReceiver.toFixed(2)} ${receivedCurrency} (rate: ${exchangeRate}).`,
    };

    this.auditLog.unshift(commitRecord);
    saveState(STORAGE_KEY_AUDIT, this.auditLog);

    return {
      success: true,
      stageReached: 8,
      stageName: 'Transaction Committed & Audit Logged',
      txId,
      status: 'COMMITTED',
      bb84Result,
      derivedAesKeyHex: aesKeyHex,
      encryptedPayload: encrypted,
      decryptedPayload: decryptResult.payload,
      auditRecord: commitRecord,
      updatedSenderBalance: sender.balance,
      updatedReceiverBalance: receiver.balance,
      sentAmount: amount,
      sentCurrency,
      receivedAmount: amountToCreditReceiver,
      receivedCurrency,
      exchangeRate,
    };
  }
}

export const bankingLedger = new BankingLedger();
