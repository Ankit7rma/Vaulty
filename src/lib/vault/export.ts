import {
  bytesToBase64,
  base64ToBytes,
  deriveKey,
  encryptString,
  decryptString,
  generateSalt,
  DEFAULT_ARGON2_PARAMS,
  type Argon2Params,
} from '@/lib/crypto';
import type { VaultItem } from './items';

/**
 * Portable vault export/import file formats.
 *
 * Two flavours:
 *  - "vaulty-plain-1": plaintext JSON containing every decrypted item.
 *    Useful for one-way migration to another tool. Users get a warning that
 *    the file is unencrypted.
 *  - "vaulty-encrypted-1": AES-GCM ciphertext derived from a user-supplied
 *    passphrase via Argon2id (same primitives as the master password). Safe
 *    to store anywhere; requires the passphrase to open.
 */

export interface PlainExport {
  format: 'vaulty-plain-1';
  exportedAt: string;
  items: Array<Pick<VaultItem, 'type' | 'fields' | 'createdAt' | 'updatedAt'>>;
}

export interface EncryptedExport {
  format: 'vaulty-encrypted-1';
  exportedAt: string;
  kdf: {
    name: 'argon2id';
    params: Argon2Params;
    salt: string; // base64
  };
  cipher: string; // base64
  iv: string; // base64
}

export type VaultExport = PlainExport | EncryptedExport;

export function buildPlainExport(items: VaultItem[]): PlainExport {
  return {
    format: 'vaulty-plain-1',
    exportedAt: new Date().toISOString(),
    items: items.map((i) => ({
      type: i.type,
      fields: i.fields,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    })),
  };
}

export async function buildEncryptedExport(
  items: VaultItem[],
  passphrase: string,
): Promise<EncryptedExport> {
  if (passphrase.length < 12) {
    throw new Error('Export passphrase must be at least 12 characters.');
  }
  const salt = generateSalt();
  const key = await deriveKey(passphrase, salt, {
    kdf: 'argon2id',
    argon2: DEFAULT_ARGON2_PARAMS,
  });
  const plain = buildPlainExport(items);
  const { cipher, iv } = await encryptString(key, JSON.stringify(plain));
  return {
    format: 'vaulty-encrypted-1',
    exportedAt: plain.exportedAt,
    kdf: {
      name: 'argon2id',
      params: DEFAULT_ARGON2_PARAMS,
      salt: bytesToBase64(salt),
    },
    cipher,
    iv,
  };
}

export async function openEncryptedExport(
  file: EncryptedExport,
  passphrase: string,
): Promise<PlainExport> {
  if (file.format !== 'vaulty-encrypted-1') {
    throw new Error('Unrecognized encrypted export.');
  }
  const salt = base64ToBytes(file.kdf.salt);
  const key = await deriveKey(passphrase, salt, {
    kdf: file.kdf.name,
    argon2: file.kdf.params,
  });
  const jsonText = await decryptString(key, { cipher: file.cipher, iv: file.iv });
  const parsed = JSON.parse(jsonText) as PlainExport;
  if (parsed.format !== 'vaulty-plain-1') {
    throw new Error('Encrypted payload was not a Vaulty export.');
  }
  return parsed;
}

/** Trigger a browser download for the given JSON blob. */
export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
