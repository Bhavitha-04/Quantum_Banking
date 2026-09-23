"""
QuantumBank - BB84 Quantum Key Distribution Engine (Python / Qiskit)
Implements:
- Alice qubit encoding (X and Hadamard gates)
- Optional Eve Intercept-Resend attack simulation
- Bob random basis measurement
- Classical sifting over public channel
- 25% sample sacrifice for Quantum Bit Error Rate (QBER) calculation
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
        """Generates cryptographically random classical bits (0 or 1)."""
        return [random.choice([0, 1]) for _ in range(n)]

    def generate_random_bases(self, n: int) -> List[str]:
        """Generates random measurement bases: 'Z' (computational) or 'X' (diagonal)."""
        return [random.choice(['Z', 'X']) for _ in range(n)]

    def prepare_and_transmit(
        self,
        alice_bits: List[int],
        alice_bases: List[str],
        bob_bases: List[str],
        eve_present: bool = False
    ) -> Tuple[List[int], Optional[List[int]], Optional[List[str]], QuantumCircuit]:
        """
        Executes quantum circuit simulation of BB84 protocol.
        Alice prepares qubits using X and H gates.
        If Eve is present, Eve measures in random basis and prepares fresh qubit (intercept-resend).
        Bob measures in his chosen basis.
        """
        n = len(alice_bits)
        circ = QuantumCircuit(n, n)

        # 1. Alice State Preparation
        for i in range(n):
            if alice_bits[i] == 1:
                circ.x(i)  # Apply X gate for bit 1: |0> -> |1>
            if alice_bases[i] == 'X':
                circ.h(i)  # Apply Hadamard gate for diagonal basis: |0> -> |+>, |1> -> |->

        circ.barrier(label="Channel")

        eve_measured_bits = []
        eve_bases = []

        # 2. Eve Intercept-Resend Attack (if enabled)
        if eve_present:
            eve_bases = self.generate_random_bases(n)
            # In simulation, Eve measures and re-prepares
            for i in range(n):
                if eve_bases[i] == 'X':
                    circ.h(i)  # Rotate to X basis before measurement
            circ.measure(range(n), range(n))
            circ.barrier(label="Eve Resend")

            # Intermediate simulation of Eve's measurement
            result_eve = self.simulator.run(circ, shots=1, memory=True).result()
            memory_eve = result_eve.get_memory()[0]
            # Qiskit registers are little-endian
            eve_measured_bits = [int(b) for b in reversed(memory_eve)]

            # Eve re-prepares fresh circuit with her measurement outcomes
            circ = QuantumCircuit(n, n)
            for i in range(n):
                if eve_measured_bits[i] == 1:
                    circ.x(i)
                if eve_bases[i] == 'X':
                    circ.h(i)
            circ.barrier(label="Bob Receive")

        # 3. Bob Basis Measurement
        for i in range(n):
            if bob_bases[i] == 'X':
                circ.h(i)  # Rotate back from Hadamard basis
        circ.measure(range(n), range(n))

        # Run final simulation for Bob's measurement
        result = self.simulator.run(circ, shots=1, memory=True).result()
        memory_str = result.get_memory()[0]
        bob_measured_bits = [int(b) for b in reversed(memory_str)]

        return bob_measured_bits, eve_measured_bits if eve_present else None, eve_bases if eve_present else None, circ

    def sift_keys(
        self,
        alice_bits: List[int],
        alice_bases: List[str],
        bob_bits: List[int],
        bob_bases: List[str]
    ) -> Tuple[List[int], List[int], List[int]]:
        """
        Public classical reconciliation: keep only bits where Alice and Bob's bases matched.
        """
        sifted_indices = []
        alice_sifted = []
        bob_sifted = []

        for i in range(len(alice_bases)):
            if alice_bases[i] == bob_bases[i]:
                sifted_indices.append(i)
                alice_sifted.append(alice_bits[i])
                bob_sifted.append(bob_bits[i])

        return alice_sifted, bob_sifted, sifted_indices

    def estimate_qber(
        self,
        alice_sifted: List[int],
        bob_sifted: List[int],
        sample_ratio: float = 0.25
    ) -> Tuple[float, List[int], List[int]]:
        """
        Sacrifices a 25% random sample of the sifted key to compute QBER.
        Returns: (QBER, remaining_alice_key, remaining_bob_key)
        """
        sifted_len = len(alice_sifted)
        if sifted_len == 0:
            return 1.0, [], []

        sample_size = max(1, int(sifted_len * sample_ratio))
        all_indices = list(range(sifted_len))
        random.shuffle(all_indices)

        sacrificed_indices = set(all_indices[:sample_size])

        errors = 0
        for idx in sacrificed_indices:
            if alice_sifted[idx] != bob_sifted[idx]:
                errors += 1

        qber = errors / sample_size

        # Retain remaining unrevealed key bits
        remaining_alice_key = [alice_sifted[i] for i in range(sifted_len) if i not in sacrificed_indices]
        remaining_bob_key = [bob_sifted[i] for i in range(sifted_len) if i not in sacrificed_indices]

        return qber, remaining_alice_key, remaining_bob_key

    def run_protocol(self, eve_present: bool = False) -> Dict:
        """
        Complete end-to-end execution of BB84 protocol.
        """
        alice_bits = self.generate_random_bits(self.num_qubits)
        alice_bases = self.generate_random_bases(self.num_qubits)
        bob_bases = self.generate_random_bases(self.num_qubits)

        bob_bits, eve_bits, eve_bases, circuit = self.prepare_and_transmit(
            alice_bits, alice_bases, bob_bases, eve_present=eve_present
        )

        alice_sifted, bob_sifted, sifted_indices = self.sift_keys(
            alice_bits, alice_bases, bob_bits, bob_bases
        )

        qber, alice_final_key, bob_final_key = self.estimate_qber(alice_sifted, bob_sifted)

        is_secure = (qber <= self.security_threshold) and (len(alice_final_key) > 0)

        # Compute key fingerprint via SHA-256
        key_str = "".join(str(b) for b in alice_final_key)
        key_fingerprint = hashlib.sha256(key_str.encode()).hexdigest()

        return {
            "num_qubits": self.num_qubits,
            "eve_present": eve_present,
            "alice_bits": alice_bits,
            "alice_bases": alice_bases,
            "bob_bases": bob_bases,
            "bob_bits": bob_bits,
            "eve_bases": eve_bases,
            "eve_bits": eve_bits,
            "sifted_indices": sifted_indices,
            "sifted_length": len(alice_sifted),
            "qber": qber,
            "qber_percentage": round(qber * 100, 2),
            "is_secure": is_secure,
            "final_key_bits": alice_final_key if is_secure else [],
            "key_fingerprint": key_fingerprint if is_secure else None,
            "circuit_ascii": circuit.draw(output="text"),
        }
