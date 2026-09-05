import { encryptJson, decryptJson, type EncryptedBlob } from '@/lib/crypto';

/**
 * Item types and the client-side codec. The server only ever holds `type`
 * (a rendering hint) plus opaque cipher/iv; every field value below is encrypted
 * into that ciphertext here in the browser.
 */

export type ItemType = 'login' | 'note';

export interface LoginFields {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  // Optional TOTP (2FA) secret, base32 or otpauth:// URI. Encrypted like every
  // other field; older items simply won't have it.
  totp?: string;
}

export interface NoteFields {
  title: string;
  body: string;
}

export type ItemFields = LoginFields | NoteFields;

/** Encrypted record as stored by / returned from the server. */
export interface ItemRecord {
  id: string;
  type: ItemType;
  cipher: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}

interface BaseItem {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** A decrypted item held in memory on the client (discriminated on `type`). */
export type VaultItem =
  | (BaseItem & { type: 'login'; fields: LoginFields })
  | (BaseItem & { type: 'note'; fields: NoteFields });

/**
 * Case-insensitive search over already-decrypted items. Matches title (all
 * types) and username (logins). Runs entirely in memory; the server never sees
 * the query or any plaintext.
 */
export function filterItems(items: VaultItem[], query: string): VaultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.fields.title.toLowerCase().includes(q)) return true;
    return item.type === 'login' && item.fields.username.toLowerCase().includes(q);
  });
}

export async function encryptFields(
  key: CryptoKey,
  fields: ItemFields,
): Promise<EncryptedBlob> {
  return encryptJson(key, fields);
}

export async function decryptRecord(
  key: CryptoKey,
  record: ItemRecord,
): Promise<VaultItem> {
  const base = {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  const blob: EncryptedBlob = { cipher: record.cipher, iv: record.iv };
  if (record.type === 'login') {
    return { ...base, type: 'login', fields: await decryptJson<LoginFields>(key, blob) };
  }
  return { ...base, type: 'note', fields: await decryptJson<NoteFields>(key, blob) };
}
