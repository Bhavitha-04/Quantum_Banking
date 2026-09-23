"""
QuantumBank - Banking Operations Layer (Python / SQLite)
Implements:
- SQLite database schema: users, accounts, transactions, security_logs
- PBKDF2-HMAC-SHA256 password hashing with salt
- Atomic fund transfers (ACID transaction guarantees with rollback)
- Balance inquiry, transaction history, statement generation
"""

import sqlite3
import hashlib
import os
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class BankingDB:
    def __init__(self, db_path: str = "quantumbank.db"):
        self.db_path = db_path
        self.init_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self):
        """Creates tables if they do not exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    user_id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    account_number TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    holder_name TEXT NOT NULL,
                    balance REAL NOT NULL CHECK(balance >= 0),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(user_id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    tx_id TEXT PRIMARY KEY,
                    sender_account TEXT NOT NULL,
                    receiver_account TEXT NOT NULL,
                    amount REAL NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    status TEXT NOT NULL,
                    qber REAL NOT NULL,
                    key_fingerprint TEXT,
                    ciphertext_hash TEXT,
                    hmac_tag TEXT,
                    FOREIGN KEY(sender_account) REFERENCES accounts(account_number),
                    FOREIGN KEY(receiver_account) REFERENCES accounts(account_number)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS security_logs (
                    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tx_id TEXT,
                    event_type TEXT NOT NULL,
                    qber REAL,
                    threshold REAL DEFAULT 0.11,
                    eavesdropper_detected BOOLEAN,
                    details TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    @staticmethod
    def hash_password(password: str, salt: bytes = None) -> Tuple[str, str]:
        if salt is None:
            salt = os.urandom(16)
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return key.hex(), salt.hex()

    def register_user(self, user_id: str, username: str, password: str, account_number: str, holder_name: str, initial_balance: float = 1000.0) -> bool:
        pwd_hash, salt = self.hash_password(password)
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO users (user_id, username, password_hash, salt) VALUES (?, ?, ?, ?)",
                    (user_id, username, pwd_hash, salt)
                )
                cursor.execute(
                    "INSERT INTO accounts (account_number, user_id, holder_name, balance) VALUES (?, ?, ?, ?)",
                    (account_number, user_id, holder_name, initial_balance)
                )
                conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False

    def verify_login(self, username: str, password: str) -> Optional[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            user = cursor.fetchone()
            if not user:
                return None
            salt = bytes.fromhex(user['salt'])
            key, _ = self.hash_password(password, salt)
            if key == user['password_hash']:
                cursor.execute("SELECT * FROM accounts WHERE user_id = ?", (user['user_id'],))
                account = cursor.fetchone()
                return dict(account) if account else None
        return None

    def execute_atomic_transfer(
        self,
        tx_id: str,
        sender_acc: str,
        receiver_acc: str,
        amount: float,
        qber: float,
        key_fingerprint: str,
        ciphertext_hash: str,
        hmac_tag: str
    ) -> bool:
        """
        Executes ACID transfer: debits sender, credits receiver, logs transaction.
        Rolls back automatically if any exception occurs.
        """
        conn = self.get_connection()
        try:
            cursor = conn.cursor()
            # Explicit SQL transaction
            cursor.execute("BEGIN IMMEDIATE")

            # Check sender balance
            cursor.execute("SELECT balance FROM accounts WHERE account_number = ?", (sender_acc,))
            sender_row = cursor.fetchone()
            if not sender_row or sender_row['balance'] < amount:
                conn.rollback()
                return False

            # Debit sender
            cursor.execute("UPDATE accounts SET balance = balance - ? WHERE account_number = ?", (amount, sender_acc))
            # Credit receiver
            cursor.execute("UPDATE accounts SET balance = balance + ? WHERE account_number = ?", (amount, receiver_acc))

            # Record committed transaction
            cursor.execute("""
                INSERT INTO transactions (tx_id, sender_account, receiver_account, amount, status, qber, key_fingerprint, ciphertext_hash, hmac_tag)
                VALUES (?, ?, ?, ?, 'COMMITTED', ?, ?, ?, ?)
            """, (tx_id, sender_acc, receiver_acc, amount, qber, key_fingerprint, ciphertext_hash, hmac_tag))

            # Log security event
            cursor.execute("""
                INSERT INTO security_logs (tx_id, event_type, qber, threshold, eavesdropper_detected, details)
                VALUES (?, 'TRANSFER_COMMITTED', ?, 0.11, 0, 'Quantum-verified transfer successfully committed')
            """, (tx_id, qber))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            return False
        finally:
            conn.close()

    def log_abort(self, tx_id: str, sender_acc: str, receiver_acc: str, amount: float, qber: float, reason: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO transactions (tx_id, sender_account, receiver_account, amount, status, qber, key_fingerprint, ciphertext_hash, hmac_tag)
                VALUES (?, ?, ?, ?, 'ABORTED', ?, 'N/A', 'N/A', 'N/A')
            """, (tx_id, sender_acc, receiver_acc, amount, qber))

            cursor.execute("""
                INSERT INTO security_logs (tx_id, event_type, qber, threshold, eavesdropper_detected, details)
                VALUES (?, 'TRANSFER_ABORTED', ?, 0.11, 1, ?)
            """, (tx_id, qber, reason))
            conn.commit()

    def get_account_statement(self, account_number: str) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM transactions 
                WHERE sender_account = ? OR receiver_account = ?
                ORDER BY timestamp DESC
            """, (account_number, account_number))
            return [dict(row) for row in cursor.fetchall()]

    def get_security_audit_logs(self) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM security_logs ORDER BY timestamp DESC")
            return [dict(row) for row in cursor.fetchall()]
