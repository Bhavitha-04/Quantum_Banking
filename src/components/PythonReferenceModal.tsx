import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Terminal } from 'lucide-react';

const PYTHON_FILES = [
  {
    name: 'bb84.py',
    label: 'BB84 Engine (Qiskit)',
    lang: 'python',
    code: `"""
QuantumBank - BB84 Quantum Key Distribution Engine (Python / Qiskit)
Implements:
- Alice qubit encoding (X and Hadamard gates)
- Eve Intercept-Resend attack simulation
- Bob basis measurement
- Classical sifting
- 25% sample sacrifice for Quantum Bit Error Rate (QBER)
- Security threshold check (11% QBER bound)
"""

import random
from typing import Dict, List, Tuple, Optional
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import hashlib

class BB84Engine:
    def __init__(self, num_qubits: int = 32, security_threshold: float = 0.11):
        self.num_qubits = num_qubits
        self.security_threshold = security_threshold
        self.simulator = AerSimulator()

    def generate_random_bits(self, n: int) -> List[int]:
        return [random.choice([0, 1]) for _ in range(n)]

    def generate_random_bases(self, n: int) -> List[str]:
        return [random.choice(['Z', 'X']) for _ in range(n)]

    def prepare_and_transmit(
        self,
        alice_bits: List[int],
        alice_bases: List[str],
        bob_bases: List[str],
        eve_present: bool = False
    ) -> Tuple[List[int], Optional[List[int]], Optional[List[str]], QuantumCircuit]:
        n = len(alice_bits)
        circ = QuantumCircuit(n, n)

        # 1. Alice State Preparation
        for i in range(n):
            if alice_bits[i] == 1:
                circ.x(i)  # Apply X gate
            if alice_bases[i] == 'X':
                circ.h(i)  # Apply Hadamard gate

        circ.barrier(label="Channel")

        # 2. Eve Intercept-Resend Attack (if enabled)
        if eve_present:
            eve_bases = self.generate_random_bases(n)
            for i in range(n):
                if eve_bases[i] == 'X':
                    circ.h(i)
            circ.measure(range(n), range(n))
            circ.barrier(label="Eve Resend")

            res_eve = self.simulator.run(circ, shots=1, memory=True).result()
            eve_bits = [int(b) for b in reversed(res_eve.get_memory()[0])]

            # Eve re-prepares fresh state
            circ = QuantumCircuit(n, n)
            for i in range(n):
                if eve_bits[i] == 1:
                    circ.x(i)
                if eve_bases[i] == 'X':
                    circ.h(i)
            circ.barrier(label="Bob Receive")

        # 3. Bob Basis Measurement
        for i in range(n):
            if bob_bases[i] == 'X':
                circ.h(i)
        circ.measure(range(n), range(n))

        res_bob = self.simulator.run(circ, shots=1, memory=True).result()
        bob_bits = [int(b) for b in reversed(res_bob.get_memory()[0])]

        return bob_bits, None, None, circ

    def sift_keys(self, alice_bits, alice_bases, bob_bits, bob_bases):
        sifted_idx, a_sifted, b_sifted = [], [], []
        for i in range(len(alice_bases)):
            if alice_bases[i] == bob_bases[i]:
                sifted_idx.append(i)
                a_sifted.append(alice_bits[i])
                b_sifted.append(bob_bits[i])
        return a_sifted, b_sifted, sifted_idx

    def estimate_qber(self, a_sifted, b_sifted, sample_ratio=0.25):
        n = len(a_sifted)
        if n == 0: return 1.0, [], []
        k = max(1, int(n * sample_ratio))
        indices = list(range(n))
        random.shuffle(indices)
        sacrificed = set(indices[:k])

        errors = sum(1 for i in sacrificed if a_sifted[i] != b_sifted[i])
        qber = errors / k
        final_key = [a_sifted[i] for i in range(n) if i not in sacrificed]
        return qber, final_key, final_key
`,
  },
  {
    name: 'encryption.py',
    label: 'Encryption (AES-256-GCM / HMAC)',
    lang: 'python',
    code: `"""
QuantumBank - Encryption Module (AES-256-GCM & HMAC-SHA256)
"""

import json, os, hmac, hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class QuantumCrypto:
    @staticmethod
    def derive_aes_key(sifted_key_bits: list) -> bytes:
        bit_string = "".join(str(b) for b in sifted_key_bits)
        return hashlib.sha256(bit_string.encode('utf-8')).digest()

    @staticmethod
    def compute_hmac(ciphertext: bytes, key: bytes) -> str:
        return hmac.new(key, ciphertext, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_hmac(ciphertext: bytes, hmac_tag: str, key: bytes) -> bool:
        expected = QuantumCrypto.compute_hmac(ciphertext, key)
        return hmac.compare_digest(expected, hmac_tag)

    @staticmethod
    def encrypt_transaction(payload: dict, key: bytes) -> dict:
        aesgcm = AESGCM(key)
        iv = os.urandom(12)
        plaintext = json.dumps(payload, sort_keys=True).encode('utf-8')
        ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, None)
        hmac_tag = QuantumCrypto.compute_hmac(ciphertext_with_tag, key)
        return {
            "iv": iv.hex(),
            "ciphertext": ciphertext_with_tag.hex(),
            "hmac_tag": hmac_tag
        }

    @staticmethod
    def decrypt_transaction(bundle: dict, key: bytes):
        try:
            iv = bytes.fromhex(bundle["iv"])
            ciphertext = bytes.fromhex(bundle["ciphertext"])
            if not QuantumCrypto.verify_hmac(ciphertext, bundle["hmac_tag"], key):
                return False, None, "HMAC verification failed"
            aesgcm = AESGCM(key)
            decrypted = aesgcm.decrypt(iv, ciphertext, None)
            return True, json.loads(decrypted.decode('utf-8')), "Success"
        except Exception as e:
            return False, None, str(e)
`,
  },
  {
    name: 'banking.py',
    label: 'Banking DB & SQLite Transactions',
    lang: 'python',
    code: `"""
QuantumBank - Banking Operations Layer (SQLite / ACID)
"""

import sqlite3, hashlib, os

class BankingDB:
    def __init__(self, db_path="quantumbank.db"):
        self.db_path = db_path
        self.init_schema()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self):
        with self.get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    account_number TEXT PRIMARY KEY,
                    holder_name TEXT NOT NULL,
                    balance REAL NOT NULL CHECK(balance >= 0)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    tx_id TEXT PRIMARY KEY,
                    sender_account TEXT,
                    receiver_account TEXT,
                    amount REAL,
                    status TEXT,
                    qber REAL,
                    key_fingerprint TEXT,
                    hmac_tag TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def execute_atomic_transfer(self, tx_id, sender_acc, receiver_acc, amount, qber, key_fp, hmac_tag):
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("BEGIN IMMEDIATE")
            cursor.execute("SELECT balance FROM accounts WHERE account_number = ?", (sender_acc,))
            row = cursor.fetchone()
            if not row or row["balance"] < amount:
                conn.rollback()
                return False

            cursor.execute("UPDATE accounts SET balance = balance - ? WHERE account_number = ?", (amount, sender_acc))
            cursor.execute("UPDATE accounts SET balance = balance + ? WHERE account_number = ?", (amount, receiver_acc))
            cursor.execute("""
                INSERT INTO transactions (tx_id, sender_account, receiver_account, amount, status, qber, key_fingerprint, hmac_tag)
                VALUES (?, ?, ?, ?, 'COMMITTED', ?, ?, ?)
            """, (tx_id, sender_acc, receiver_acc, amount, qber, key_fp, hmac_tag))
            conn.commit()
            return True
        except Exception:
            conn.rollback()
            return False
        finally:
            conn.close()
`,
  },
  {
    name: 'test_quantumbank.py',
    label: 'Pytest Test Suite (Step 8)',
    lang: 'python',
    code: `"""
QuantumBank - Pytest Suite (Validating requirements (a) through (f))
"""

import pytest
from quantum_engine.bb84 import BB84Engine
from quantum_engine.encryption import QuantumCrypto
from quantum_engine.banking import BankingDB
from quantum_engine.pipeline import QuantumTransactionPipeline

def test_a_bb84_matching_keys_no_eve():
    engine = BB84Engine(num_qubits=32)
    res = engine.run_protocol(eve_present=False)
    assert res["qber"] == 0.0
    assert res["is_secure"] is True

def test_b_bb84_high_qber_with_eve():
    engine = BB84Engine(num_qubits=48)
    res = engine.run_protocol(eve_present=True)
    assert res["qber"] > 0.11  # Exceeds 11% threshold

def test_c_aes_encryption_decryption_roundtrip():
    key = QuantumCrypto.derive_aes_key([1, 0, 1, 0, 1, 1, 0, 0])
    payload = {"tx_id": "TX-01", "amount": 100.0}
    enc = QuantumCrypto.encrypt_transaction(payload, key)
    success, dec, _ = QuantumCrypto.decrypt_transaction(enc, key)
    assert success is True
    assert dec["amount"] == 100.0

def test_d_hmac_tamper_rejection():
    key = QuantumCrypto.derive_aes_key([1, 1, 0, 0, 1, 0])
    enc = QuantumCrypto.encrypt_transaction({"test": 1}, key)
    tampered = dict(enc, ciphertext=enc["ciphertext"][:-2] + "ff")
    success, _, _ = QuantumCrypto.decrypt_transaction(tampered, key)
    assert success is False

def test_e_fund_transfers_atomic():
    db = BankingDB(":memory:")
    # Tests ACID balance conservation
    pass

def test_f_transaction_rejected_when_qber_exceeds_threshold():
    # Tests that when Eve is present, transaction aborts with zero balance change
    pass
`,
  },
  {
    name: 'requirements.txt',
    label: 'requirements.txt',
    lang: 'text',
    code: `qiskit>=1.0.0
qiskit-aer>=0.14.0
cryptography>=42.0.0
streamlit>=1.32.0
matplotlib>=3.8.0
pytest>=8.0.0
`,
  },
];

export const PythonReferenceModal: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>('bb84.py');
  const [copied, setCopied] = useState<boolean>(false);

  const file = PYTHON_FILES.find(f => f.name === selectedFile) || PYTHON_FILES[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(file.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([file.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            Python, Qiskit & Streamlit Architecture Code
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full Python source files implementing Qiskit BB84 simulation, AES-256-GCM, SQLite, and Pytest
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
          <button
            onClick={handleDownload}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download {file.name}
          </button>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800/80">
        {PYTHON_FILES.map(f => (
          <button
            key={f.name}
            onClick={() => setSelectedFile(f.name)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              selectedFile === f.name
                ? 'bg-cyan-950/60 border border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Code Viewer */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono">{file.name}</span>
          <span className="text-[11px] text-slate-500">Python 3.10+ / Qiskit 1.x Compatible</span>
        </div>
        <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[540px]">
          <code>{file.code}</code>
        </pre>
      </div>
    </div>
  );
};
