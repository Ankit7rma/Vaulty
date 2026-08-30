import type { EncryptedBlob } from './types';
import { IV_LENGTH_BYTES } from './kdf';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToUtf8,
  utf8ToBytes,
  type Bytes,
} from './encoding';

/**
 * AES-GCM encryption. Every call mints a fresh random 12-byte IV, so encrypting
 * the same plaintext twice yields different ciphertext. AES-GCM is
 * authenticated: any tampering with the ciphertext or IV, or use of the wrong
 * key, makes decrypt() throw rather than return garbage.
 */

export async function encryptBytes(
  key: CryptoKey,
  data: Bytes,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    cipher: bytesToBase64(new Uint8Array(cipherBuf)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptBytes(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<Uint8Array> {
  const iv = base64ToBytes(blob.iv);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBytes(blob.cipher),
  );
  return new Uint8Array(plainBuf);
}

export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedBlob> {
  return encryptBytes(key, utf8ToBytes(plaintext));
}

export async function decryptString(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<string> {
  return bytesToUtf8(await decryptBytes(key, blob));
}

/** Encrypt a whole item payload. Titles and every other field go through here. */
export async function encryptJson(
  key: CryptoKey,
  value: unknown,
): Promise<EncryptedBlob> {
  return encryptString(key, JSON.stringify(value));
}

export async function decryptJson<T = unknown>(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  return JSON.parse(await decryptString(key, blob)) as T;
}
