import type { LucideIcon } from 'lucide-react';
import {
  CreditCard,
  KeyRound,
  StickyNote,
  UserSquare,
  BookMarked,
  TerminalSquare,
  KeySquare,
  BadgeCheck,
  Wifi,
  Landmark,
  Coins,
  Fingerprint,
  Paperclip,
} from 'lucide-react';
import type { ItemType } from './items';

/**
 * Registry of item types and their per-type field schemas. Login and Note
 * still use their bespoke form (they carry password-manager-specific UI like
 * generator, breach check, and TOTP display); every other type renders
 * generically from the `fields` schema below.
 *
 * The `type` string is the only plaintext hint the server sees. Every field
 * value declared here still lives inside the encrypted cipher blob.
 */

export type FieldKind = 'text' | 'password' | 'textarea' | 'url' | 'date';

export interface FieldSpec {
  /** Storage key inside CustomFields.values */
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  /** Show a subtle "SENSITIVE" affordance (e.g. seed phrase, private key). */
  sensitive?: boolean;
}

export interface ItemTypeSpec {
  id: ItemType;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Field order in the form. Empty for login/note (they use custom forms). */
  fields: FieldSpec[];
}

const LOGIN_SPEC: ItemTypeSpec = {
  id: 'login',
  label: 'Login',
  shortLabel: 'Login',
  description: 'Username, password, URL, notes.',
  icon: KeyRound,
  fields: [],
};

const NOTE_SPEC: ItemTypeSpec = {
  id: 'note',
  label: 'Secure note',
  shortLabel: 'Note',
  description: 'Free-form encrypted text.',
  icon: StickyNote,
  fields: [],
};

const CARD_SPEC: ItemTypeSpec = {
  id: 'card',
  label: 'Credit card',
  shortLabel: 'Card',
  description: 'Cardholder, number, expiry, CVV, PIN.',
  icon: CreditCard,
  fields: [
    { name: 'cardholderName', label: 'Cardholder name', kind: 'text' },
    { name: 'cardNumber', label: 'Card number', kind: 'password' },
    { name: 'brand', label: 'Brand', kind: 'text', placeholder: 'Visa, Mastercard, ...' },
    { name: 'expiry', label: 'Expiry (MM/YY)', kind: 'text' },
    { name: 'cvv', label: 'CVV', kind: 'password' },
    { name: 'pin', label: 'PIN', kind: 'password' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
  ],
};

// Placeholders for the upcoming types so the registry compiles and the vault
// header/menu wiring can already reference them. Each will be fleshed out in
// its own commit as we add the type end-to-end.
const IDENTITY_SPEC: ItemTypeSpec = {
  id: 'identity',
  label: 'Identity',
  shortLabel: 'Identity',
  description: 'Personal contact information.',
  icon: UserSquare,
  fields: [
    { name: 'firstName', label: 'First name', kind: 'text' },
    { name: 'lastName', label: 'Last name', kind: 'text' },
    { name: 'phone', label: 'Phone', kind: 'text' },
    { name: 'email', label: 'Email', kind: 'text' },
    { name: 'address', label: 'Address', kind: 'textarea' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
  ],
};
const PASSPORT_SPEC: ItemTypeSpec = {
  id: 'passport',
  label: 'Passport',
  shortLabel: 'Passport',
  description: 'Travel document details.',
  icon: BookMarked,
  fields: [
    { name: 'fullName', label: 'Full name', kind: 'text' },
    { name: 'number', label: 'Passport number', kind: 'password' },
    { name: 'country', label: 'Country', kind: 'text' },
    { name: 'nationality', label: 'Nationality', kind: 'text' },
    { name: 'dateOfBirth', label: 'Date of birth', kind: 'text', placeholder: 'YYYY-MM-DD' },
    { name: 'issuedOn', label: 'Issued on', kind: 'text', placeholder: 'YYYY-MM-DD' },
    { name: 'expiresOn', label: 'Expires on', kind: 'text', placeholder: 'YYYY-MM-DD' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
  ],
};
const SSH_KEY_SPEC: ItemTypeSpec = {
  id: 'sshKey',
  label: 'SSH key',
  shortLabel: 'SSH',
  description: 'Public and private key material.',
  icon: TerminalSquare,
  fields: [
    { name: 'keyName', label: 'Key name', kind: 'text', placeholder: 'e.g. laptop-github' },
    { name: 'algorithm', label: 'Algorithm', kind: 'text', placeholder: 'ed25519, rsa-4096, ...' },
    { name: 'publicKey', label: 'Public key', kind: 'textarea' },
    { name: 'privateKey', label: 'Private key', kind: 'textarea', sensitive: true },
    { name: 'passphrase', label: 'Passphrase', kind: 'password' },
    { name: 'fingerprint', label: 'Fingerprint', kind: 'text' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
  ],
};
const API_KEY_SPEC: ItemTypeSpec = {
  id: 'apiKey',
  label: 'API key',
  shortLabel: 'API',
  description: 'Service credentials.',
  icon: KeySquare,
  fields: [],
};
const LICENSE_SPEC: ItemTypeSpec = {
  id: 'license',
  label: 'Software license',
  shortLabel: 'License',
  description: 'Product key, holder, version.',
  icon: BadgeCheck,
  fields: [],
};
const WIFI_SPEC: ItemTypeSpec = {
  id: 'wifi',
  label: 'Wi-Fi network',
  shortLabel: 'Wi-Fi',
  description: 'SSID, password, security type.',
  icon: Wifi,
  fields: [],
};
const BANK_SPEC: ItemTypeSpec = {
  id: 'bank',
  label: 'Bank account',
  shortLabel: 'Bank',
  description: 'Account and routing details.',
  icon: Landmark,
  fields: [],
};
const CRYPTO_SPEC: ItemTypeSpec = {
  id: 'crypto',
  label: 'Crypto wallet',
  shortLabel: 'Wallet',
  description: 'Seed phrase and wallet metadata.',
  icon: Coins,
  fields: [],
};
const PASSKEY_SPEC: ItemTypeSpec = {
  id: 'passkey',
  label: 'Passkey',
  shortLabel: 'Passkey',
  description: 'Stored WebAuthn credential.',
  icon: Fingerprint,
  fields: [],
};
const FILE_SPEC: ItemTypeSpec = {
  id: 'file',
  label: 'File attachment',
  shortLabel: 'File',
  description: 'Encrypted file stored in the vault.',
  icon: Paperclip,
  fields: [],
};

export const ITEM_TYPE_SPECS: Record<ItemType, ItemTypeSpec> = {
  login: LOGIN_SPEC,
  note: NOTE_SPEC,
  card: CARD_SPEC,
  identity: IDENTITY_SPEC,
  passport: PASSPORT_SPEC,
  sshKey: SSH_KEY_SPEC,
  apiKey: API_KEY_SPEC,
  license: LICENSE_SPEC,
  wifi: WIFI_SPEC,
  bank: BANK_SPEC,
  crypto: CRYPTO_SPEC,
  passkey: PASSKEY_SPEC,
  file: FILE_SPEC,
};

/** Types rendered by the generic CustomItemForm (schema-driven). */
export const CUSTOM_ITEM_TYPES: ItemType[] = [
  'card',
  'identity',
  'passport',
  'sshKey',
  'apiKey',
  'license',
  'wifi',
  'bank',
  'crypto',
  'passkey',
  'file',
];

export function isCustomItemType(type: ItemType): boolean {
  return CUSTOM_ITEM_TYPES.includes(type);
}

export function getTypeSpec(type: ItemType): ItemTypeSpec {
  return ITEM_TYPE_SPECS[type] ?? LOGIN_SPEC;
}
