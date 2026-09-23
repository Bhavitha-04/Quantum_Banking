"""
QuantumBank - Encryption & Privacy Amplification Module (Python)
Implements:
- Privacy amplification: derives fixed 256-bit AES key via SHA-256 from quantum sifted bits
- AES-256-GCM authenticated encryption and decryption
- HMAC-SHA256 independent integrity verification
"""

import json
import os
import hmac
import hashlib
from typing import Dict, Tuple, Any
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class QuantumCrypto:
    @staticmethod
    def derive_aes_key(sifted_key_bits: list) -> bytes:
        """
        Privacy Amplification:
        Hashes quantum sifted bits using SHA-256 to generate a uniform 256-bit (32-byte) AES key.
        """
        bit_string = "".join(str(b) for b in sifted_key_bits)
        return hashlib.sha256(bit_string.encode('utf-8')).digest()

    @staticmethod
    def compute_hmac(ciphertext: bytes, key: bytes) -> str:
        """
        Computes HMAC-SHA256 tag over ciphertext using quantum-derived key.
        """
        return hmac.new(key, ciphertext, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_hmac(ciphertext: bytes, hmac_tag: str, key: bytes) -> bool:
        """
        Verifies HMAC-SHA256 tag in constant time.
        """
        expected_tag = QuantumCrypto.compute_hmac(ciphertext, key)
        return hmac.compare_digest(expected_tag, hmac_tag)

    @staticmethod
    def encrypt_transaction(payload: Dict[str, Any], key: bytes) -> Dict[str, str]:
        """
        Serializes payload to JSON, encrypts with AES-256-GCM, and produces HMAC-SHA256 tag.
        Returns: {
            "iv": hex,
            "ciphertext": hex,
            "hmac_tag": hex
        }
        """
        aesgcm = AESGCM(key)
        # 12-byte IV standard for AES-GCM
        iv = os.urandom(12)
        plaintext = json.dumps(payload, sort_keys=True).encode('utf-8')
        
        # AESGCM.encrypt appends 16-byte authentication tag to ciphertext
        ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, None)
        
        # Generate independent HMAC-SHA256 tag
        hmac_tag = QuantumCrypto.compute_hmac(ciphertext_with_tag, key)

        return {
            "iv": iv.hex(),
            "ciphertext": ciphertext_with_tag.hex(),
            "hmac_tag": hmac_tag
        }

    @staticmethod
    def decrypt_transaction(encrypted_bundle: Dict[str, str], key: bytes) -> Tuple[bool, Any, str]:
        """
        Verifies HMAC integrity and decrypts AES-256-GCM ciphertext.
        Returns: (success_bool, decrypted_payload_dict, message)
        """
        try:
            iv = bytes.fromhex(encrypted_bundle["iv"])
            ciphertext = bytes.fromhex(encrypted_bundle["ciphertext"])
            stored_hmac = encrypted_bundle["hmac_tag"]

            # 1. Independent HMAC verification
            if not QuantumCrypto.verify_hmac(ciphertext, stored_hmac, key):
                return False, None, "HMAC-SHA256 verification failed: Tampering detected!"

            # 2. AES-256-GCM authenticated decryption
            aesgcm = AESGCM(key)
            decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
            payload = json.loads(decrypted_bytes.decode('utf-8'))

            return True, payload, "Decryption and authentication successful"
        except Exception as e:
            return False, None, f"Decryption failed: {str(e)}"
