import {
  encryptJson,
  decryptJson,
  bytesToBase64,
  base64ToBytes,
} from '@/lib/crypto';
import type { ItemFields, ItemType } from './items';

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

export async function createShareLink(
  type: ItemType,
  fields: ItemFields,
  expiresInHours = 24,
): Promise<string> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const blob = await encryptJson(key, { type, fields } satisfies SharedPayload);

  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cipher: blob.cipher, iv: blob.iv, expiresInHours }),
  });
  if (!res.ok) throw new Error('share failed');
  const { token } = (await res.json()) as { token: string };

  // The key rides in the fragment, which browsers never send to the server.
  return `${window.location.origin}/share/${token}#${bytesToBase64Url(rawKey)}`;
}

export async function openShare(
  token: string,
  keyFromFragment: string,
): Promise<SharedPayload> {
  // no-store so the destructive read always reaches the server; a cached 200
  // would let a consumed link appear to open again.
  const res = await fetch(`/api/share/${token}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('share not available');
  const { cipher, iv } = (await res.json()) as { cipher: string; iv: string };

  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(base64UrlToBytes(keyFromFragment)),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  return decryptJson<SharedPayload>(key, { cipher, iv });
}
