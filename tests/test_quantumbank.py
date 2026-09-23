"""
QuantumBank - Pytest Test Suite
Validates all 6 requirements specified in Step 8:
(a) BB84 produces matching keys when no eavesdropper is present
(b) BB84 produces high QBER when Eve is enabled (~25%)
(c) AES encryption and decryption round-trip correctly
(d) HMAC verification rejects tampered data
(e) Fund transfers are atomic
(f) Transactions are rejected when QBER exceeds threshold
"""

import os
import pytest
from quantum_engine.bb84 import BB84Engine
from quantum_engine.encryption import QuantumCrypto
from quantum_engine.banking import BankingDB
from quantum_engine.pipeline import QuantumTransactionPipeline

TEST_DB_PATH = "test_quantumbank.db"

@pytest.fixture
def clean_db():
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    db = BankingDB(TEST_DB_PATH)
    db.register_user("u1", "alice", "pass123", "ACC_ALICE", "Alice Vance", 1000.0)
    db.register_user("u2", "bob", "pass123", "ACC_BOB", "Bob Martinez", 500.0)
    yield db
    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)

def test_a_bb84_matching_keys_no_eve():
    """Validates BB84 produces matching keys when no eavesdropper is present."""
    engine = BB84Engine(num_qubits=32)
    # Run multiple times to verify deterministic match on sifted bases
    for _ in range(5):
        res = engine.run_protocol(eve_present=False)
        assert res["qber"] == 0.0, f"Expected 0% QBER without Eve, got {res['qber']}"
        assert res["is_secure"] is True
        assert len(res["final_key_bits"]) > 0

def test_b_bb84_high_qber_with_eve():
    """Validates BB84 produces high QBER when Eve performs intercept-resend attack (~25%)."""
    engine = BB84Engine(num_qubits=64)
    total_qber = 0
    runs = 10
    for _ in range(runs):
        res = engine.run_protocol(eve_present=True)
        total_qber += res["qber"]
    avg_qber = total_qber / runs
    # Average QBER with Eve should cluster around 25% (0.25), significantly above 11%
    assert avg_qber >= 0.15, f"Expected QBER with Eve >= 15%, got {avg_qber * 100}%"

def test_c_aes_encryption_decryption_roundtrip():
    """Validates AES-256-GCM encryption and decryption round-trip correctly."""
    key = QuantumCrypto.derive_aes_key([1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0])
    payload = {
        "tx_id": "TX-12345",
        "sender": "ACC_ALICE",
        "receiver": "ACC_BOB",
        "amount": 250.75
    }
    encrypted = QuantumCrypto.encrypt_transaction(payload, key)
    success, decrypted, msg = QuantumCrypto.decrypt_transaction(encrypted, key)

    assert success is True
    assert decrypted["tx_id"] == payload["tx_id"]
    assert decrypted["amount"] == payload["amount"]

def test_d_hmac_tamper_rejection():
    """Validates HMAC verification rejects tampered data."""
    key = QuantumCrypto.derive_aes_key([1, 1, 0, 0, 1, 0, 1, 0])
    payload = {"account": "ACC_ALICE", "balance": 1000}
    encrypted = QuantumCrypto.encrypt_transaction(payload, key)

    # Tamper with ciphertext
    cipher_bytes = bytearray.fromhex(encrypted["ciphertext"])
    cipher_bytes[-1] ^= 0xFF
    tampered_bundle = {
        "iv": encrypted["iv"],
        "ciphertext": cipher_bytes.hex(),
        "hmac_tag": encrypted["hmac_tag"]
    }

    success, _, err = QuantumCrypto.decrypt_transaction(tampered_bundle, key)
    assert success is False
    assert "verification failed" in err.lower() or "decryption failed" in err.lower()

def test_e_fund_transfers_atomic(clean_db):
    """Validates fund transfers are atomic (sender debited, receiver credited)."""
    alice_acc = clean_db.get_account_statement("ACC_ALICE")
    bob_acc = clean_db.get_account_statement("ACC_BOB")

    success = clean_db.execute_atomic_transfer(
        tx_id="TX-ATOM-01",
        sender_acc="ACC_ALICE",
        receiver_acc="ACC_BOB",
        amount=200.0,
        qber=0.0,
        key_fingerprint="fp123",
        ciphertext_hash="hash123",
        hmac_tag="hmac123"
    )
    assert success is True

    # Re-verify balances
    with clean_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM accounts WHERE account_number = 'ACC_ALICE'")
        alice_bal = cursor.fetchone()["balance"]
        cursor.execute("SELECT balance FROM accounts WHERE account_number = 'ACC_BOB'")
        bob_bal = cursor.fetchone()["balance"]

    assert alice_bal == 800.0
    assert bob_bal == 700.0

def test_f_transaction_rejected_when_qber_exceeds_threshold(clean_db):
    """Validates transactions are aborted and no balances are modified when QBER > 11%."""
    pipeline = QuantumTransactionPipeline(clean_db, bb84_qubits=48)
    
    # Run with Eve present
    aborted_seen = False
    for _ in range(5):
        res = pipeline.process_transfer(
            sender_acc="ACC_ALICE",
            receiver_acc="ACC_BOB",
            amount=150.0,
            eve_present=True
        )
        if not res["success"] and res["status"] == "ABORTED_EAVESDROPPER_DETECTED":
            aborted_seen = True
            break

    assert aborted_seen is True

    # Ensure balances remained untouched
    with clean_db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM accounts WHERE account_number = 'ACC_ALICE'")
        alice_bal = cursor.fetchone()["balance"]

    assert alice_bal == 1000.0
