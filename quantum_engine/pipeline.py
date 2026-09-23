"""
QuantumBank - Quantum-Secure Banking Pipeline Integration
Unifies BB84, AES-256-GCM, HMAC-SHA256, and Banking Layer.
"""

import time
import uuid
import hashlib
from typing import Dict, Any, Tuple
from bb84 import BB84Engine
from encryption import QuantumCrypto as QuantumEncryption
from banking import BankingDB

class QuantumTransactionPipeline:
    def __init__(self, db: BankingDB, bb84_qubits: int = 32):
        self.db = db
        self.bb84 = BB84Engine(num_qubits=bb84_qubits)

    def process_transfer(
        self,
        sender_acc: str,
        receiver_acc: str,
        amount: float,
        eve_present: bool = False,
        note: str = ""
    ) -> Dict[str, Any]:
        """
        Executes the 8-step quantum-secure transaction pipeline:
        1. Run BB84 key distribution
        2. Verify QBER <= 11% threshold
        3. Derive 256-bit AES key via SHA-256
        4. Serialize and encrypt transaction payload via AES-256-GCM
        5. Transmit ciphertext and HMAC tag across simulated channel
        6. Decrypt and verify integrity on receiving end
        7. Commit transfer to SQLite database atomically
        8. Log entire event with key fingerprint, QBER, and ciphertext hash
        """
        tx_id = f"TX-QKD-{uuid.uuid4().hex[:8].upper()}"

        # 1. Run BB84 QKD
        qkd_res = self.bb84.run_protocol(eve_present=eve_present)
        qber = qkd_res["qber"]

        # 2. Check QBER threshold
        if not qkd_res["is_secure"]:
            reason = f"Channel compromised by eavesdropper! QBER {qkd_res['qber_percentage']}% > 11.0% threshold."
            self.db.log_abort(tx_id, sender_acc, receiver_acc, amount, qber, reason)
            return {
                "success": False,
                "step_failed": 2,
                "status": "ABORTED_EAVESDROPPER_DETECTED",
                "message": reason,
                "qkd_details": qkd_res
            }

        # 3. Privacy amplification: derive 256-bit AES key
        aes_key = QuantumCrypto.derive_aes_key(qkd_res["final_key_bits"])

        # 4. Serialize payload & encrypt with AES-256-GCM
        payload = {
            "tx_id": tx_id,
            "sender_account": sender_acc,
            "receiver_account": receiver_acc,
            "amount": amount,
            "timestamp": time.time(),
            "nonce": uuid.uuid4().hex,
            "note": note
        }
        encrypted_bundle = QuantumCrypto.encrypt_transaction(payload, aes_key)
        ciphertext_hash = hashlib.sha256(bytes.fromhex(encrypted_bundle["ciphertext"])).hexdigest()

        # 5. Channel transmission (simulated)
        # 6. Decrypt & verify integrity on receiver end
        dec_success, dec_payload, dec_msg = QuantumCrypto.decrypt_transaction(encrypted_bundle, aes_key)
        if not dec_success:
            reason = f"Integrity check failed: {dec_msg}"
            self.db.log_abort(tx_id, sender_acc, receiver_acc, amount, qber, reason)
            return {
                "success": False,
                "step_failed": 6,
                "status": "ABORTED_INTEGRITY_FAILED",
                "message": reason,
                "qkd_details": qkd_res
            }

        # 7. Commit atomic transaction to database
        commit_success = self.db.execute_atomic_transfer(
            tx_id=tx_id,
            sender_acc=sender_acc,
            receiver_acc=receiver_acc,
            amount=amount,
            qber=qber,
            key_fingerprint=qkd_res["key_fingerprint"],
            ciphertext_hash=ciphertext_hash,
            hmac_tag=encrypted_bundle["hmac_tag"]
        )

        if not commit_success:
            return {
                "success": False,
                "step_failed": 7,
                "status": "ABORTED_INSUFFICIENT_FUNDS",
                "message": "Transfer failed due to insufficient funds or database lock.",
                "qkd_details": qkd_res
            }

        # 8. Success audit
        return {
            "success": True,
            "step_failed": None,
            "status": "COMMITTED",
            "tx_id": tx_id,
            "amount": amount,
            "qber": qber,
            "qber_percentage": qkd_res["qber_percentage"],
            "key_fingerprint": qkd_res["key_fingerprint"],
            "ciphertext_hash": ciphertext_hash,
            "hmac_tag": encrypted_bundle["hmac_tag"],
            "qkd_details": qkd_res,
            "decrypted_payload": dec_payload
        }
