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
    id: 'wifi-network',
    label: 'Wi-Fi network',
    description: 'Note with SSID and password fields.',
    type: 'note',
    fields: {
      title: 'Wi-Fi network',
      body: 'SSID: \nPassword: \nSecurity: \nNotes: ',
      tags: ['wifi'],
    },
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
