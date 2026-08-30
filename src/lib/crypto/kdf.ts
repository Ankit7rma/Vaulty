import { argon2id } from 'hash-wasm';
import { utf8ToBytes, type Bytes } from './encoding';

/**
 * Key derivation. The master password is stretched into a 256-bit AES-GCM key
 * that lives only in memory. The derived key is imported as NON-EXTRACTABLE so
 * it can never be read back out of the CryptoKey, even by our own code.
 *
 * Reproducibility is the whole point: the exact KDF + params + salt used at
 * enrolment must be reused to re-derive the same key later. Callers persist the
 * salt (public) and the chosen params; they are passed back in explicitly here.
 */

export const KEY_LENGTH_BYTES = 32; // AES-256
export const SALT_LENGTH_BYTES = 16;
export const IV_LENGTH_BYTES = 12; // AES-GCM standard nonce size
export const MIN_SALT_BYTES = 8; // Argon2 requires at least 8

export type KdfName = 'argon2id' | 'pbkdf2';

export interface Argon2Params {
  /** memory cost in KiB */
  memorySizeKiB: number;
  /** time cost (passes) */
  iterations: number;
  /** lanes / parallelism */
  parallelism: number;
}

/** OWASP-aligned interactive defaults: m = 19 MiB, t = 2, p = 1. */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  memorySizeKiB: 19_456,
  iterations: 2,
  parallelism: 1,
};

/** PBKDF2 fallback per PRD: 600k iterations, SHA-256. */
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;

export interface DeriveKeyOptions {
  /** which KDF to use; defaults to Argon2id */
  kdf?: KdfName;
  /** Argon2id cost parameters (only used when kdf === 'argon2id') */
  argon2?: Argon2Params;
  /** PBKDF2 iteration count (only used when kdf === 'pbkdf2') */
  pbkdf2Iterations?: number;
}

export function generateSalt(): Bytes {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  // Copy into a plain ArrayBuffer-backed view (the argon2 output is typed as
  // ArrayBufferLike-backed) so it satisfies BufferSource.
  return crypto.subtle.importKey('raw', new Uint8Array(raw), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

async function deriveArgon2(
  masterPassword: string,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<CryptoKey> {
  const raw = await argon2id({
    password: masterPassword,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memorySizeKiB,
    hashLength: KEY_LENGTH_BYTES,
    outputType: 'binary',
  });
  return importAesKey(raw);
}

async function derivePbkdf2(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  // Copy into fresh ArrayBuffer-backed views so they satisfy BufferSource under
  // the newer lib types (which reject the SharedArrayBuffer-possible variant).
  const passwordBytes = new Uint8Array(utf8ToBytes(masterPassword));
  const saltBytes = new Uint8Array(salt);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveKey(
  masterPassword: string,
  salt: Uint8Array,
  options: DeriveKeyOptions = {},
): Promise<CryptoKey> {
  if (salt.length < MIN_SALT_BYTES) {
    throw new Error(`salt must be at least ${MIN_SALT_BYTES} bytes`);
  }
  const kdf = options.kdf ?? 'argon2id';
  if (kdf === 'pbkdf2') {
    return derivePbkdf2(
      masterPassword,
      salt,
      options.pbkdf2Iterations ?? DEFAULT_PBKDF2_ITERATIONS,
    );
  }
  return deriveArgon2(masterPassword, salt, options.argon2 ?? DEFAULT_ARGON2_PARAMS);
}

/**
 * Probe whether Argon2id (wasm) works in the current runtime. Used once at
 * enrolment to choose the KDF; the choice is then persisted so derivation stays
 * reproducible for that user.
 */
export async function isArgon2idAvailable(): Promise<boolean> {
  try {
    await argon2id({
      password: 'probe',
      salt: new Uint8Array(MIN_SALT_BYTES),
      parallelism: 1,
      iterations: 1,
      memorySize: 8,
      hashLength: 16,
      outputType: 'binary',
    });
    return true;
  } catch {
    return false;
  }
}
