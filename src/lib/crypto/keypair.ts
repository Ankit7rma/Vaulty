import type { EncryptedBlob } from './types';
import { base64ToBytes, bytesToBase64 } from './encoding';
import { encryptBytes, decryptBytes } from './cipher';

/**
 * Per-user RSA-OAEP keypair used to wrap shared-vault symmetric keys.
 *
 * Design:
 *   - Modulus 4096 bits, SHA-256 hash — mainstream, well-supported in every
 *     browser's WebCrypto and long-lived for the sensitivity involved here.
 *   - Public key exported as SPKI base64 so it can round-trip through JSON.
 *   - Private key is exported as PKCS8, then encrypted with the user's vault
 *     key (AES-GCM). The wrapped blob is what the server stores; the server
 *     never sees the raw private key.
 *   - `deriveBits` is intentionally NOT enabled on the wrapping key — we only
 *     use it to encrypt+decrypt the small (~2 KiB) PKCS8 payload.
 */

export const KEYPAIR_ALG = 'rsa-oaep-4096' as const;
export type KeypairAlg = typeof KEYPAIR_ALG;

const RSA_PARAMS: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 4096,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
  hash: 'SHA-256',
};

const IMPORT_PARAMS: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};

/** Generate a fresh RSA-OAEP keypair. The private key is extractable so we can
 * wrap it under the vault key before it leaves the browser. */
export async function generateWrappingKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_PARAMS, true, ['encrypt', 'decrypt']);
}

/** SPKI base64 for on-wire storage of the public key. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return bytesToBase64(new Uint8Array(spki));
}

export async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  const spki = base64ToBytes(spkiB64);
  return crypto.subtle.importKey('spki', spki, IMPORT_PARAMS, false, ['encrypt']);
}

/** Wrap the private key with the user's vault key so the server never sees it. */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  vaultKey: CryptoKey,
): Promise<EncryptedBlob> {
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey);
  return encryptBytes(vaultKey, new Uint8Array(pkcs8));
}

export async function unwrapPrivateKey(
  wrapped: EncryptedBlob,
  vaultKey: CryptoKey,
): Promise<CryptoKey> {
  const pkcs8 = await decryptBytes(vaultKey, wrapped);
  return crypto.subtle.importKey(
    'pkcs8',
    new Uint8Array(pkcs8),
    IMPORT_PARAMS,
    false,
    ['decrypt'],
  );
}

/**
 * Encrypt a raw symmetric key (32 bytes for AES-256) with a recipient's public
 * key. Small payloads only — RSA-OAEP is not for bulk data.
 */
export async function rsaEncrypt(
  publicKey: CryptoKey,
  data: Uint8Array,
): Promise<string> {
  const buf = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    new Uint8Array(data),
  );
  return bytesToBase64(new Uint8Array(buf));
}

export async function rsaDecrypt(
  privateKey: CryptoKey,
  cipherB64: string,
): Promise<Uint8Array> {
  const buf = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToBytes(cipherB64),
  );
  return new Uint8Array(buf);
}

/**
 * Generate a fresh random symmetric key suitable for wrapping under a
 * recipient's RSA public key. Returned as both the CryptoKey (for immediate use)
 * and the raw bytes (for wrapping).
 */
export async function generateSymmetricVaultKey(): Promise<{
  key: CryptoKey;
  raw: Uint8Array;
}> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, raw };
}

export async function importSymmetricVaultKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(raw),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}
