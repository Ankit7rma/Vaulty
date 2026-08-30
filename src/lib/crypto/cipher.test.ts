import { describe, it, expect } from 'vitest'
import {
  encryptString,
  decryptString,
  encryptJson,
  decryptJson,
  decryptBytes,
} from './cipher'
import { base64ToBytes, bytesToBase64 } from './encoding'

async function randomAesKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

describe('cipher (AES-GCM)', () => {
  it('round-trips a string', async () => {
    const key = await randomAesKey()
    const blob = await encryptString(key, 'super secret')
    expect(await decryptString(key, blob)).toBe('super secret')
  })

  it('round-trips unicode and the empty string', async () => {
    const key = await randomAesKey()
    for (const s of ['', '日本語 🔐 café']) {
      expect(await decryptString(key, await encryptString(key, s))).toBe(s)
    }
  })

  it('round-trips a JSON item payload', async () => {
    const key = await randomAesKey()
    const item = {
      title: 'GitHub',
      username: 'me@example.com',
      password: 'p@ss',
      url: 'https://github.com',
      notes: 'personal',
    }
    const blob = await encryptJson(key, item)
    expect(await decryptJson(key, blob)).toEqual(item)
  })

  it('uses a fresh IV per call (same plaintext -> different ciphertext)', async () => {
    const key = await randomAesKey()
    const a = await encryptString(key, 'same')
    const b = await encryptString(key, 'same')
    expect(a.iv).not.toBe(b.iv)
    expect(a.cipher).not.toBe(b.cipher)
  })

  it('produces a 12-byte IV', async () => {
    const key = await randomAesKey()
    const { iv } = await encryptString(key, 'x')
    expect(base64ToBytes(iv)).toHaveLength(12)
  })

  it('fails to decrypt with the wrong key', async () => {
    const key = await randomAesKey()
    const other = await randomAesKey()
    const blob = await encryptString(key, 'secret')
    await expect(decryptString(other, blob)).rejects.toThrow()
  })

  it('rejects tampered ciphertext', async () => {
    const key = await randomAesKey()
    const blob = await encryptString(key, 'secret')
    const bytes = base64ToBytes(blob.cipher)
    bytes[0] ^= 0xff
    await expect(
      decryptBytes(key, { ...blob, cipher: bytesToBase64(bytes) }),
    ).rejects.toThrow()
  })
})
