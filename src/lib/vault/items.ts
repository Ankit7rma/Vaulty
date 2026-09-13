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
  // Star / pinned flag. Encrypted like every other field so the server does
  // not see which items you have starred.
  favorite?: boolean;
  // User-chosen tags. Encrypted like everything else, so the server does not
  // learn how items are grouped.
  tags?: string[];
}

export interface NoteFields {
  title: string;
  body: string;
  favorite?: boolean;
  tags?: string[];
}

export function isFavorite(item: VaultItem): boolean {
  return Boolean(item.fields.favorite);
}

export function getTags(item: VaultItem): string[] {
  return item.fields.tags ?? [];
}

/** Case-insensitive, deduplicated tag list drawn from an item collection. */
export function collectTags(items: VaultItem[]): string[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    for (const tag of getTags(item)) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Normalize a raw tag entry: trimmed, deduplicated by lowercase, capped. */
export function normalizeTags(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= 20) break;
  }
  return out;
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
 * Ranked, multi-token, fuzzy-tolerant search over already-decrypted items.
 * Runs entirely in memory; the server never sees the query or any plaintext.
 *
 * - Whitespace splits the query into tokens; every token must match somewhere.
 * - Each token first tries a case-insensitive substring match (word-start
 *   matches score higher), then falls back to a subsequence match ("gh" fuzzy
 *   matches "GitHub"). Missing tokens exclude the item.
 * - Fields are weighted: title > username > url > notes > body — so a title
 *   match wins over an incidental hit in a long note.
 */

interface WeightedField {
  text: string;
  weight: number;
}

function searchableFields(item: VaultItem): WeightedField[] {
  if (item.type === 'login') {
    return [
      { text: item.fields.title, weight: 5 },
      { text: item.fields.username, weight: 3 },
      { text: item.fields.url, weight: 2 },
      { text: item.fields.notes, weight: 1 },
    ];
  }
  return [
    { text: item.fields.title, weight: 5 },
    { text: item.fields.body, weight: 1 },
  ];
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function tokenScore(token: string, text: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  const idx = t.indexOf(token);
  if (idx !== -1) {
    // Word-start substring matches score noticeably higher than mid-word.
    return idx === 0 || /\W/.test(t[idx - 1]) ? 10 : 6;
  }
  return isSubsequence(token, t) ? 2 : 0;
}

export function filterItems(items: VaultItem[], query: string): VaultItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  const tokens = trimmed.split(/\s+/);

  const ranked: Array<{ item: VaultItem; score: number }> = [];
  for (const item of items) {
    const fields = searchableFields(item);
    let total = 0;
    let matchedAll = true;
    for (const token of tokens) {
      let bestForToken = 0;
      for (const f of fields) {
        const s = tokenScore(token, f.text);
        if (s > 0) bestForToken = Math.max(bestForToken, s * f.weight);
      }
      if (bestForToken === 0) {
        matchedAll = false;
        break;
      }
      total += bestForToken;
    }
    if (matchedAll) ranked.push({ item, score: total });
  }
  return ranked.sort((a, b) => b.score - a.score).map((r) => r.item);
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
