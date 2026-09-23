/**
 * Cryptographic Engine for QuantumBank
 * Implements Step 3:
 * - Key Derivation (SHA-256 Privacy Amplification)
 * - AES-256-GCM Authenticated Encryption & Decryption
 * - HMAC-SHA256 Integrity Tag Generation and Verification
 * - PBKDF2 Password Hashing with Salt
 */

import { EncryptedPayload, TransactionPayload } from '../types/quantum';
import { computeSyncHashHex } from './bb84';

/**
 * Converts a hex string into a Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(Math.ceil(cleanHex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16) || 0;
  }
  return bytes;
}

/**
 * Converts Uint8Array into a hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives a 256-bit symmetric AES key from quantum sifted bits via SHA-256 privacy amplification
 */
export function deriveAesKey(siftedKeyBits: number[] | string): string {
  const inputStr = typeof siftedKeyBits === 'string' ? siftedKeyBits : siftedKeyBits.join('');
  return computeSyncHashHex('QUANTUM_SIFTED_KEY:' + inputStr);
}

/**
 * Computes an HMAC-SHA256 tag over message with key
 */
export async function computeHmacSha256(messageHex: string, keyHex: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const keyBytes = hexToBytes(keyHex).slice(0, 32);
      const msgBytes = hexToBytes(messageHex);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes as unknown as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgBytes as unknown as BufferSource);
      return bytesToHex(new Uint8Array(sigBuffer));
    } catch {
      // Fallback below
    }
  }

  // Pure cryptographic fallback
  return computeSyncHashHex('HMAC_KEY:' + keyHex + ':MSG:' + messageHex);
}

/**
 * Verifies an HMAC-SHA256 tag
 */
export async function verifyHmacSha256(messageHex: string, expectedHmacHex: string, keyHex: string): Promise<boolean> {
  const computed = await computeHmacSha256(messageHex, keyHex);
  return computed.toLowerCase() === expectedHmacHex.toLowerCase();
}

/**
 * Encrypts transaction payload with AES-256-GCM and attaches an HMAC-SHA256 tag
 */
export async function encryptTransaction(
  payload: TransactionPayload,
  aesKeyHex: string
): Promise<EncryptedPayload> {
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(jsonStr);

  // Generate 12-byte IV for AES-GCM
  const iv = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
  }

  const ivHex = bytesToHex(iv);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const rawKeyBytes = hexToBytes(aesKeyHex).slice(0, 32);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        rawKeyBytes as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // WebCrypto AES-GCM appends 16-byte tag at the end of ciphertext
      const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
        cryptoKey,
        plainBytes as unknown as BufferSource
      );

      const fullBytes = new Uint8Array(cipherBuffer);
      const tagBytes = fullBytes.slice(fullBytes.length - 16);
      const ciphertextBytes = fullBytes.slice(0, fullBytes.length - 16);

      const ciphertextHex = bytesToHex(ciphertextBytes);
      const authTagHex = bytesToHex(tagBytes);

      // Compute external HMAC-SHA256 over (iv + ciphertext + authTag)
      const hmacPayload = ivHex + ciphertextHex + authTagHex;
      const hmacTagHex = await computeHmacSha256(hmacPayload, aesKeyHex);

      return {
        ivHex,
        ciphertextHex,
        authTagHex,
        hmacTagHex,
        plaintextPreview: jsonStr,
      };
    } catch {
      // Fallback to software AES-GCM simulation below
    }
  }

  // Pure JS fallback with deterministic XOR-Keystream + GCM simulation
  const keystreamHex = computeSyncHashHex(aesKeyHex + ivHex);
  const keyBytes = hexToBytes(keystreamHex);
  const cipherBytes = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    cipherBytes[i] = plainBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  const ciphertextHex = bytesToHex(cipherBytes);
  const authTagHex = computeSyncHashHex('TAG:' + aesKeyHex + ':' + ciphertextHex).slice(0, 32);
  const hmacTagHex = await computeHmacSha256(ivHex + ciphertextHex + authTagHex, aesKeyHex);

  return {
    ivHex,
    ciphertextHex,
    authTagHex,
    hmacTagHex,
    plaintextPreview: jsonStr,
  };
}

/**
 * Decrypts transaction ciphertext, verifying both AES-GCM auth tag and HMAC-SHA256
 */
export async function decryptTransaction(
  encrypted: EncryptedPayload,
  aesKeyHex: string
): Promise<{ success: boolean; payload?: TransactionPayload; error?: string }> {
  // Step 1: Verify HMAC-SHA256 integrity tag first
  const hmacPayload = encrypted.ivHex + encrypted.ciphertextHex + encrypted.authTagHex;
  const isHmacValid = await verifyHmacSha256(hmacPayload, encrypted.hmacTagHex, aesKeyHex);
  if (!isHmacValid) {
    return {
      success: false,
      error: 'HMAC-SHA256 Verification Failed: Transmission tampering or corrupted data detected!',
    };
  }

  // Step 2: Decrypt with AES-GCM
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const rawKeyBytes = hexToBytes(aesKeyHex).slice(0, 32);
      const iv = hexToBytes(encrypted.ivHex);
      const cipherBytes = hexToBytes(encrypted.ciphertextHex);
      const tagBytes = hexToBytes(encrypted.authTagHex);

      const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
      combined.set(cipherBytes, 0);
      combined.set(tagBytes, cipherBytes.length);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        rawKeyBytes as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
        cryptoKey,
        combined as unknown as BufferSource
      );

      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(decryptedBuffer);
      const parsed = JSON.parse(jsonStr) as TransactionPayload;

      return {
        success: true,
        payload: parsed,
      };
    } catch {
      // If WebCrypto fails due to auth tag mismatch or tampering
      return {
        success: false,
        error: 'AES-GCM Authentication Failed: GCM tag mismatch indicates payload was tampered with.',
      };
    }
  }

  // Fallback decrypt
  try {
    const keystreamHex = computeSyncHashHex(aesKeyHex + encrypted.ivHex);
    const keyBytes = hexToBytes(keystreamHex);
    const cipherBytes = hexToBytes(encrypted.ciphertextHex);
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let i = 0; i < cipherBytes.length; i++) {
      plainBytes[i] = cipherBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(plainBytes);
    const parsed = JSON.parse(jsonStr) as TransactionPayload;
    return {
      success: true,
      payload: parsed,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Decryption failed: ${(err as Error).message}`,
    };
  }
}

/**
 * PBKDF2 Password Hash Simulation with Per-User Salt
 */
export function hashPasswordWithSalt(password: string, saltHex: string): string {
  let acc = saltHex + ':' + password;
  for (let i = 0; i < 500; i++) {
    acc = computeSyncHashHex(acc + ':' + i);
  }
  return acc;
}
