import { describe, it, expect } from 'vitest'
import { enrollMasterKey, deriveAndVerify } from './master-key'
import { encryptString, decryptString } from '@/lib/crypto'

describe('master key enrol + unlock', () => {
  it('produces a descriptor whose key unlocks with the same password', async () => {
    const { key, descriptor } = await enrollMasterKey('correct horse battery')
    const unlocked = await deriveAndVerify('correct horse battery', descriptor)
    expect(unlocked).not.toBeNull()
    // The re-derived key must be the same key: seal with one, open with the other.
    const blob = await encryptString(key, 'hello')
    expect(await decryptString(unlocked as CryptoKey, blob)).toBe('hello')
  })

  it('returns null for a wrong master password', async () => {
    const { descriptor } = await enrollMasterKey('the-right-one')
    expect(await deriveAndVerify('the-wrong-one', descriptor)).toBeNull()
  })

  it('defaults to argon2id in this runtime', async () => {
    const { descriptor } = await enrollMasterKey('x')
    expect(descriptor.kdfName).toBe('argon2id')
    expect(descriptor.kdfSalt.length).toBeGreaterThan(0)
    expect(descriptor.verifyBlob.length).toBeGreaterThan(0)
    expect(descriptor.verifyIv.length).toBeGreaterThan(0)
  })
})
