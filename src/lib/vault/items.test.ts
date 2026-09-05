import { describe, it, expect } from 'vitest'
import {
  encryptFields,
  decryptRecord,
  filterItems,
  type ItemRecord,
  type ItemType,
  type LoginFields,
  type NoteFields,
  type VaultItem,
} from './items'
import type { EncryptedBlob } from '@/lib/crypto'

async function randomKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

function recordFrom(type: ItemType, blob: EncryptedBlob): ItemRecord {
  return {
    id: 'id-1',
    type,
    cipher: blob.cipher,
    iv: blob.iv,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('item codec', () => {
  it('round-trips a login item', async () => {
    const key = await randomKey()
    const fields: LoginFields = {
      title: 'GitHub',
      username: 'me@example.com',
      password: 'p@ssw0rd',
      url: 'https://github.com',
      notes: 'personal',
    }
    const blob = await encryptFields(key, fields)
    const item = await decryptRecord(key, recordFrom('login', blob))
    expect(item.type).toBe('login')
    expect(item.fields).toEqual(fields)
  })

  it('round-trips a note item', async () => {
    const key = await randomKey()
    const fields: NoteFields = { title: 'Wifi', body: 'the password is hunter2' }
    const blob = await encryptFields(key, fields)
    const item = await decryptRecord(key, recordFrom('note', blob))
    expect(item.type).toBe('note')
    expect(item.fields).toEqual(fields)
  })

  it('fails to decrypt with the wrong key', async () => {
    const key = await randomKey()
    const other = await randomKey()
    const blob = await encryptFields(key, { title: 't', body: 'b' })
    await expect(decryptRecord(other, recordFrom('note', blob))).rejects.toThrow()
  })
})

describe('filterItems', () => {
  const base = { createdAt: '', updatedAt: '' }
  const items: VaultItem[] = [
    {
      ...base,
      id: '1',
      type: 'login',
      fields: { title: 'GitHub', username: 'octocat', password: '', url: '', notes: '' },
    },
    { ...base, id: '2', type: 'note', fields: { title: 'Wifi password', body: '' } },
    {
      ...base,
      id: '3',
      type: 'login',
      fields: { title: 'Bank', username: 'alice@example.com', password: '', url: '', notes: '' },
    },
  ]

  it('returns everything for an empty/whitespace query', () => {
    expect(filterItems(items, '')).toHaveLength(3)
    expect(filterItems(items, '   ')).toHaveLength(3)
  })

  it('matches title case-insensitively', () => {
    expect(filterItems(items, 'git').map((i) => i.id)).toEqual(['1'])
    expect(filterItems(items, 'WIFI').map((i) => i.id)).toEqual(['2'])
  })

  it('matches login username but not on notes', () => {
    expect(filterItems(items, 'octo').map((i) => i.id)).toEqual(['1'])
    expect(filterItems(items, 'alice@').map((i) => i.id)).toEqual(['3'])
  })

  it('returns nothing when there is no match', () => {
    expect(filterItems(items, 'zzz')).toHaveLength(0)
  })
})
