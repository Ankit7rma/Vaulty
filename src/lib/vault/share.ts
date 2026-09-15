import { argon2id } from 'hash-wasm';
import {
  encryptJson,
  decryptJson,
  bytesToBase64,
  base64ToBytes,
} from '@/lib/crypto';
import type { ItemFields, ItemType } from './items';

// Cheap Argon2id parameters for share passphrases. Full vault-key parameters
// (19 MiB, 2 iters) would take multiple seconds on mobile; the URL fragment
// key still carries 256 bits of entropy, so the passphrase only needs to
// resist casual guessing, not offline attack.
const SHARE_ARGON2_MEMORY_KIB = 8 * 1024; // 8 MiB
const SHARE_ARGON2_ITERATIONS = 2;
const SHARE_KEY_BYTES = 32;

async function derivePassphraseBytes(
  passphrase: string,
  salt: Uint8Array,
): Promise<Uint8Array> {
  const raw = await argon2id({
    password: passphrase,
    salt,
    parallelism: 1,
    iterations: SHARE_ARGON2_ITERATIONS,
    memorySize: SHARE_ARGON2_MEMORY_KIB,
    hashLength: SHARE_KEY_BYTES,
    outputType: 'binary',
  });
  // Normalize to a plain ArrayBuffer-backed Uint8Array so downstream types
  // (crypto.subtle, XOR helpers) align regardless of hash-wasm's internal
  // buffer variant.
  return new Uint8Array(raw);
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/**
 * One-time item sharing. A fresh random 256-bit key is generated in the
 * browser, used to encrypt the item, and placed in the URL fragment (#...) of
 * the share link. The server stores only the ciphertext, so it can never read
 * the shared item. Opening the link fetches the ciphertext once (the server
 * then deletes it) and decrypts it with the key from the fragment.
 */

export interface SharedPayload {
  type: ItemType;
  fields: ItemFields;
  /** Optional message from the sender, encrypted with the same key as fields. */
  note?: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  return base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/'));
}

export interface CreateShareOptions {
  expiresInHours?: number;
  maxViews?: number;
  note?: string;
  /**
   * When provided, the passphrase is combined with the URL-fragment key via
   * Argon2id + XOR before AES-GCM encryption. The recipient needs both the
   * link AND the passphrase to decrypt.
   */
  passphrase?: string;
}

export async function createShareLink(
  type: ItemType,
  fields: ItemFields,
  ...args:
    | [expiresInHours?: number, maxViews?: number, note?: string]
    | [options: CreateShareOptions]
): Promise<string> {
  // Backwards-compatible signature: allow either positional args (as before)
  // or an options object.
  const opts: CreateShareOptions =
    args.length === 1 && typeof args[0] === 'object' && args[0] !== null
      ? args[0]
      : {
          expiresInHours: args[0] as number | undefined,
          maxViews: args[1] as number | undefined,
          note: args[2] as string | undefined,
        };
  const { expiresInHours = 24, maxViews = 1, note, passphrase } = opts;

  const fragmentBytes = crypto.getRandomValues(new Uint8Array(SHARE_KEY_BYTES));

  let effectiveKeyBytes: Uint8Array = fragmentBytes;
  let passSaltBase64: string | undefined;
  if (passphrase && passphrase.trim().length > 0) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passBytes = await derivePassphraseBytes(passphrase, salt);
    effectiveKeyBytes = xorBytes(fragmentBytes, passBytes);
    passSaltBase64 = bytesToBase64(salt);
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(effectiveKeyBytes),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const trimmedNote = note?.trim();
  const payload: SharedPayload = trimmedNote
    ? { type, fields, note: trimmedNote }
    : { type, fields };
  const blob = await encryptJson(key, payload);

  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cipher: blob.cipher,
      iv: blob.iv,
      expiresInHours,
      maxViews,
      passSalt: passSaltBase64,
    }),
  });
  if (!res.ok) throw new Error('share failed');
  const { token } = (await res.json()) as { token: string };

  // The fragment carries the raw fragment key; browsers never send it to the
  // server. When a passphrase is set, this alone cannot decrypt.
  return `${window.location.origin}/share/${token}#${bytesToBase64Url(fragmentBytes)}`;
}

export interface OpenedShare extends SharedPayload {
  /** Views remaining after this call (0 on the last read). */
  remaining: number;
}

export interface SharePrelude {
  cipher: string;
  iv: string;
  remaining: number;
  /** If present, the recipient must supply a passphrase before decrypt. */
  passSalt: string | null;
}

/**
 * Consumes one view of the share (deletes / decrements server-side) and
 * returns the ciphertext together with whatever additional gate (a passSalt
 * indicating a passphrase is required) the recipient still has to satisfy.
 */
export async function fetchShare(token: string): Promise<SharePrelude> {
  const res = await fetch(`/api/share/${token}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('share not available');
  const data = (await res.json()) as SharePrelude;
  return {
    cipher: data.cipher,
    iv: data.iv,
    remaining: data.remaining ?? 0,
    passSalt: data.passSalt ?? null,
  };
}

/**
 * Combines the URL-fragment key with an optional Argon2id-derived passphrase
 * key and returns the decrypted payload. `prelude` must come from fetchShare.
 */
export async function decryptShare(
  prelude: SharePrelude,
  keyFromFragment: string,
  passphrase?: string,
): Promise<OpenedShare> {
  const fragmentBytes = base64UrlToBytes(keyFromFragment);

  let effectiveKeyBytes: Uint8Array = fragmentBytes;
  if (prelude.passSalt) {
    if (!passphrase) throw new Error('passphrase required');
    const passBytes = await derivePassphraseBytes(
      passphrase,
      base64ToBytes(prelude.passSalt),
    );
    effectiveKeyBytes = xorBytes(fragmentBytes, passBytes);
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(effectiveKeyBytes),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const payload = await decryptJson<SharedPayload>(key, {
    cipher: prelude.cipher,
    iv: prelude.iv,
  });
  return { ...payload, remaining: prelude.remaining };
}

/**
 * Convenience one-shot: fetch and decrypt (no passphrase). Kept for callers
 * that don't need the two-step flow.
 */
export async function openShare(
  token: string,
  keyFromFragment: string,
): Promise<OpenedShare> {
  const prelude = await fetchShare(token);
  return decryptShare(prelude, keyFromFragment);
}
