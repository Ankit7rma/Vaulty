import type { ItemFields, ItemType } from '@/lib/vault/items';

/**
 * Item templates seed the form with a sensible starting point (title,
 * placeholder notes, default tags). Selecting one just pre-fills the fields;
 * the user is never locked into the template and can edit anything before
 * saving.
 */

export interface ItemTemplate {
  id: string;
  label: string;
  description: string;
  type: ItemType;
  fields: ItemFields;
}

export const ITEM_TEMPLATES: ItemTemplate[] = [
  {
    id: 'blank-login',
    label: 'Blank login',
    description: 'Empty username/password/URL entry.',
    type: 'login',
    fields: {
      title: '',
      username: '',
      password: '',
      url: '',
      notes: '',
    },
  },
  {
    id: 'blank-note',
    label: 'Blank note',
    description: 'Free-form encrypted text.',
    type: 'note',
    fields: { title: '', body: '' },
  },
  {
    id: 'blank-card',
    label: 'Credit card',
    description: 'Cardholder, number, expiry, CVV.',
    type: 'card',
    fields: { title: '', values: {} },
  },
  {
    id: 'blank-identity',
    label: 'Identity',
    description: 'Name, phone, email, address.',
    type: 'identity',
    fields: { title: '', values: {} },
  },
  {
    id: 'blank-passport',
    label: 'Passport',
    description: 'Travel document details.',
    type: 'passport',
    fields: { title: '', values: {} },
  },
  {
    id: 'blank-ssh-key',
    label: 'SSH key',
    description: 'Public and private key material.',
    type: 'sshKey',
    fields: { title: '', values: {} },
  },
  {
    id: 'blank-api-key',
    label: 'API key',
    description: 'Service credentials (key + secret).',
    type: 'apiKey',
    fields: { title: '', values: {} },
  },
  {
    id: 'blank-license',
    label: 'Software license',
    description: 'Product key, version, holder.',
    type: 'license',
    fields: { title: '', values: {} },
  },
  {
    id: 'email-account',
    label: 'Email account',
    description: 'Pre-tagged with #email.',
    type: 'login',
    fields: {
      title: 'Email',
      username: '',
      password: '',
      url: '',
      notes: '',
      tags: ['email'],
    },
  },
  {
    id: 'bank-login',
    label: 'Bank / financial',
    description: 'Pre-tagged with #bank and #finance.',
    type: 'login',
    fields: {
      title: '',
      username: '',
      password: '',
      url: '',
      notes: '',
      tags: ['bank', 'finance'],
    },
  },
  {
    id: 'blank-wifi',
    label: 'Wi-Fi network',
    description: 'SSID, password, security type.',
    type: 'wifi',
    fields: { title: '', values: {}, tags: ['wifi'] },
  },
  {
    id: 'blank-bank',
    label: 'Bank account',
    description: 'Account, routing, IBAN, SWIFT.',
    type: 'bank',
    fields: { title: '', values: {}, tags: ['bank', 'finance'] },
  },
  {
    id: 'blank-crypto',
    label: 'Crypto wallet',
    description: 'Seed phrase, private key, address.',
    type: 'crypto',
    fields: { title: '', values: {}, tags: ['crypto'] },
  },
  {
    id: 'recovery-codes',
    label: 'Recovery codes',
    description: '2FA backup codes for a service.',
    type: 'note',
    fields: {
      title: 'Recovery codes',
      body: 'Service: \n\nCodes:\n- \n- \n- \n- \n- \n\nGenerated: ',
      tags: ['2fa', 'recovery'],
    },
  },
];
