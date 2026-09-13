import type { ItemFields, ItemType, LoginFields, NoteFields } from './items';
import { openEncryptedExport, type EncryptedExport, type PlainExport } from './export';

/**
 * Import parsers for common vault-migration formats. Everything runs in the
 * browser over pasted text or an uploaded file; nothing is uploaded until the
 * user commits the import.
 *
 * Supported:
 *  - Vaulty native (plain and encrypted)
 *  - Bitwarden JSON export
 *  - Generic CSV (LastPass / Chrome / 1Password CSV shape)
 */

export type ImportSourceFormat =
  | 'vaulty-plain'
  | 'vaulty-encrypted'
  | 'bitwarden'
  | 'csv'
  | 'otpauth';

export interface ParsedImportItem {
  type: ItemType;
  fields: ItemFields;
}

export interface ImportPreview {
  format: ImportSourceFormat;
  items: ParsedImportItem[];
  warnings: string[];
}

// --- Minimal CSV parser -----------------------------------------------------

/**
 * RFC 4180-lite CSV parser: comma separators, double-quoted fields with
 * embedded newlines and escaped double quotes. First row is treated as the
 * header.
 */
export function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const text = input.replace(/^﻿/, ''); // strip BOM
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // Handle CRLF as a single line break.
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === '') continue;
    const record: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      record[header[c]] = (cells[c] ?? '').trim();
    }
    out.push(record);
  }
  return out;
}

// --- Format detection -------------------------------------------------------

interface DetectedJson {
  kind: 'plain' | 'encrypted' | 'bitwarden' | 'unknown';
  raw: unknown;
}

function detectJson(text: string): DetectedJson | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (obj.format === 'vaulty-plain-1') return { kind: 'plain', raw: obj };
      if (obj.format === 'vaulty-encrypted-1') return { kind: 'encrypted', raw: obj };
      if (Array.isArray(obj.items) && obj.encrypted === false) {
        return { kind: 'bitwarden', raw: obj };
      }
      // Some Bitwarden exports don't include `encrypted`; fall back on shape.
      if (Array.isArray(obj.items) && obj.items[0] && typeof obj.items[0] === 'object') {
        const first = obj.items[0] as Record<string, unknown>;
        if ('type' in first && ('login' in first || 'notes' in first)) {
          return { kind: 'bitwarden', raw: obj };
        }
      }
    }
  } catch {
    // not JSON
  }
  return null;
}

// --- Vaulty plain -----------------------------------------------------------

function importVaultyPlain(raw: PlainExport): ImportPreview {
  return {
    format: 'vaulty-plain',
    items: raw.items.map((i) => ({ type: i.type, fields: i.fields })),
    warnings: [],
  };
}

// --- Bitwarden JSON ---------------------------------------------------------

interface BitwardenItem {
  type?: number; // 1=login, 2=note, 3=card, 4=identity
  name?: string;
  notes?: string;
  favorite?: boolean;
  login?: {
    username?: string;
    password?: string;
    uris?: Array<{ uri?: string }>;
    totp?: string;
  };
  card?: {
    cardholderName?: string;
    brand?: string;
    number?: string;
    expMonth?: string;
    expYear?: string;
    code?: string;
  };
  identity?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address1?: string;
    address2?: string;
    city?: string;
    country?: string;
  };
}

function importBitwarden(raw: unknown): ImportPreview {
  const warnings: string[] = [];
  const src = raw as { items?: BitwardenItem[] };
  const items: ParsedImportItem[] = [];
  for (const b of src.items ?? []) {
    const title = b.name?.trim() || 'Untitled';
    const favorite = b.favorite ? { favorite: true } : {};
    if (b.type === 1 && b.login) {
      const login: LoginFields = {
        title,
        username: b.login.username ?? '',
        password: b.login.password ?? '',
        url: b.login.uris?.[0]?.uri ?? '',
        notes: b.notes ?? '',
        ...(b.login.totp ? { totp: b.login.totp } : {}),
        ...favorite,
      };
      items.push({ type: 'login', fields: login });
    } else if (b.type === 2) {
      const note: NoteFields = {
        title,
        body: b.notes ?? '',
        ...favorite,
      };
      items.push({ type: 'note', fields: note });
    } else if (b.type === 3 && b.card) {
      const values: Record<string, string> = {};
      if (b.card.cardholderName) values.cardholderName = b.card.cardholderName;
      if (b.card.brand) values.brand = b.card.brand;
      if (b.card.number) values.cardNumber = b.card.number;
      const expiry = [b.card.expMonth, b.card.expYear].filter(Boolean).join('/');
      if (expiry) values.expiry = expiry;
      if (b.card.code) values.cvv = b.card.code;
      if (b.notes) values.notes = b.notes;
      items.push({ type: 'card', fields: { title, values, ...favorite } });
    } else if (b.type === 4 && b.identity) {
      const values: Record<string, string> = {};
      if (b.identity.firstName) values.firstName = b.identity.firstName;
      if (b.identity.lastName) values.lastName = b.identity.lastName;
      if (b.identity.email) values.email = b.identity.email;
      if (b.identity.phone) values.phone = b.identity.phone;
      const address = [
        b.identity.address1,
        b.identity.address2,
        b.identity.city,
        b.identity.country,
      ]
        .filter(Boolean)
        .join('\n');
      if (address) values.address = address;
      if (b.notes) values.notes = b.notes;
      items.push({ type: 'identity', fields: { title, values, ...favorite } });
    } else {
      warnings.push(`Skipped Bitwarden item "${title}" (unsupported type ${b.type ?? '?'}).`);
    }
  }
  return { format: 'bitwarden', items, warnings };
}

// --- Generic CSV (LastPass / Chrome / 1Password CSV) -----------------------

/**
 * Handles the common browser + password-manager CSV shape: some subset of
 * `name`, `url`, `username`, `password`, `note(s)`, `otpauth`. Missing
 * columns are ignored. Rows with no title AND no username become notes.
 */
function importCsv(text: string): ImportPreview {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  const items: ParsedImportItem[] = [];
  for (const row of rows) {
    const title =
      row.name ??
      row.title ??
      row.item ??
      row.website ??
      row.url ??
      row.hostname ??
      '';
    const username = row.username ?? row.user ?? row.login ?? row.email ?? '';
    const password = row.password ?? row.passwd ?? row.pass ?? '';
    const url = row.url ?? row.website ?? row.uri ?? row.hostname ?? '';
    const notes = row.notes ?? row.note ?? row.extra ?? row.comments ?? '';
    const totp = row.totp ?? row.otpauth ?? row['2fa'] ?? '';

    if (!title && !username && !password) continue;

    if (password || username) {
      const fields: LoginFields = {
        title: title || url || 'Untitled',
        username,
        password,
        url,
        notes,
        ...(totp ? { totp } : {}),
      };
      items.push({ type: 'login', fields });
    } else if (notes || title) {
      const fields: NoteFields = {
        title: title || 'Untitled note',
        body: notes,
      };
      items.push({ type: 'note', fields });
    }
  }
  if (rows.length > 0 && items.length === 0) {
    warnings.push('CSV had rows but no recognizable columns.');
  }
  return { format: 'csv', items, warnings };
}

// --- otpauth:// URIs --------------------------------------------------------

/**
 * Parses one or more otpauth:// URIs (any URI on its own line, or a single
 * URI on any line). Each becomes a login item with the URI in the TOTP field.
 */
function importOtpauth(lines: string[]): ImportPreview {
  const items: ParsedImportItem[] = [];
  for (const raw of lines) {
    const uri = raw.trim();
    if (!uri.toLowerCase().startsWith('otpauth://')) continue;
    let issuer = '';
    let label = '';
    try {
      // otpauth://<type>/<label>?issuer=...&...
      const url = new URL(uri);
      const path = decodeURIComponent(url.pathname.replace(/^\//, ''));
      const [maybeIssuer, maybeAccount] = path.split(':');
      if (maybeAccount) {
        issuer = maybeIssuer.trim();
        label = maybeAccount.trim();
      } else {
        label = maybeIssuer.trim();
      }
      const paramIssuer = url.searchParams.get('issuer');
      if (paramIssuer) issuer = paramIssuer;
    } catch {
      // fall through with empty strings; totp field still gets the raw URI
    }
    const title = issuer || label || 'One-time code';
    const fields: LoginFields = {
      title,
      username: label,
      password: '',
      url: '',
      notes: '',
      totp: uri,
    };
    items.push({ type: 'login', fields });
  }
  return { format: 'otpauth', items, warnings: [] };
}

// --- Public API -------------------------------------------------------------

export interface ParseImportOptions {
  passphrase?: string;
}

export async function parseImport(
  text: string,
  options: ParseImportOptions = {},
): Promise<ImportPreview> {
  const trimmed = text.trim();
  // Any input dominated by otpauth:// URIs is treated as a batch of TOTP
  // additions, regardless of surrounding whitespace. Cheaper to check first
  // than to feed to the JSON parser.
  const otpLines = trimmed
    .split(/\r?\n/)
    .filter((l) => l.trim().toLowerCase().startsWith('otpauth://'));
  if (otpLines.length > 0 && otpLines.length * 15 >= trimmed.length / 20) {
    return importOtpauth(otpLines);
  }

  const detected = detectJson(text);
  if (detected?.kind === 'plain') {
    return importVaultyPlain(detected.raw as PlainExport);
  }
  if (detected?.kind === 'encrypted') {
    if (!options.passphrase) {
      throw new Error('This is an encrypted Vaulty export. Enter the passphrase.');
    }
    const plain = await openEncryptedExport(
      detected.raw as EncryptedExport,
      options.passphrase,
    );
    return {
      format: 'vaulty-encrypted',
      items: plain.items.map((i) => ({ type: i.type, fields: i.fields })),
      warnings: [],
    };
  }
  if (detected?.kind === 'bitwarden') {
    return importBitwarden(detected.raw);
  }
  // Fall back to CSV. Empty output means we could not recognize the format.
  const csvPreview = importCsv(text);
  if (csvPreview.items.length === 0) {
    throw new Error(
      'Unrecognized format. Expected Vaulty, Bitwarden, CSV, or otpauth:// URI.',
    );
  }
  return csvPreview;
}
