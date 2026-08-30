import { describe, it, expect } from 'vitest'
import { createVerifyBlob, verifyKey, VERIFY_MARKER } from './verify'
import { base64ToBytes, bytesToBase64 } from './encoding'

async function randomAesKey(): Promise<CryptoKey> {
  const raw = crypto.getRandomValues(new Uint8Array(32))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ])
}

describe('check blob verification', () => {
  it('verifies the correct key', async () => {
    const key = await randomAesKey()
    const blob = await createVerifyBlob(key)
    expect(await verifyKey(key, blob)).toBe(true)
  })

  it('rejects the wrong key without throwing', async () => {
    const key = await randomAesKey()
    const wrong = await randomAesKey()
    const blob = await createVerifyBlob(key)
    expect(await verifyKey(wrong, blob)).toBe(false)
  })

  it('rejects a tampered blob', async () => {
    const key = await randomAesKey()
    const blob = await createVerifyBlob(key)
    const bytes = base64ToBytes(blob.cipher)
    bytes[0] ^= 0xff
    expect(
      await verifyKey(key, { ...blob, cipher: bytesToBase64(bytes) }),
    ).toBe(false)
  })

  it('exposes a stable marker constant', () => {
    expect(VERIFY_MARKER).toBe('vaulty:verify:v1')
  })
})
