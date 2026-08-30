import { describe, it, expect } from 'vitest'
import {
  deriveKey,
  generateSalt,
  isArgon2idAvailable,
  SALT_LENGTH_BYTES,
  type Argon2Params,
} from './kdf'
import { encryptString, decryptString } from './cipher'

// Small Argon2 params keep the suite fast; correctness is independent of cost.
const FAST_ARGON2: Argon2Params = {
  memorySizeKiB: 64,
  iterations: 1,
  parallelism: 1,
}

// Keys are non-extractable, so we compare them by behaviour: two keys are equal
// iff a blob sealed by one decrypts back under the other.
async function sameKey(a: CryptoKey, b: CryptoKey): Promise<boolean> {
  try {
    const blob = await encryptString(a, 'probe')
    return (await decryptString(b, blob)) === 'probe'
  } catch {
    return false
  }
}

describe('kdf', () => {
  it('generateSalt returns random 16-byte salts', () => {
    const s1 = generateSalt()
    const s2 = generateSalt()
    expect(s1).toHaveLength(SALT_LENGTH_BYTES)
    expect(Array.from(s1)).not.toEqual(Array.from(s2))
  })

  it('rejects a too-short salt', async () => {
    await expect(deriveKey('pw', new Uint8Array(4))).rejects.toThrow()
  })

  describe('argon2id', () => {
    const salt = new Uint8Array(16).fill(7)

    it('is deterministic for the same password + salt + params', async () => {
      const k1 = await deriveKey('correct horse', salt, { argon2: FAST_ARGON2 })
      const k2 = await deriveKey('correct horse', salt, { argon2: FAST_ARGON2 })
      expect(await sameKey(k1, k2)).toBe(true)
    })

    it('changes with a different password', async () => {
      const k1 = await deriveKey('password-a', salt, { argon2: FAST_ARGON2 })
      const k2 = await deriveKey('password-b', salt, { argon2: FAST_ARGON2 })
      expect(await sameKey(k1, k2)).toBe(false)
    })

    it('changes with a different salt', async () => {
      const other = new Uint8Array(16).fill(9)
      const k1 = await deriveKey('pw', salt, { argon2: FAST_ARGON2 })
      const k2 = await deriveKey('pw', other, { argon2: FAST_ARGON2 })
      expect(await sameKey(k1, k2)).toBe(false)
    })

    it('produces a usable AES-GCM key', async () => {
      const key = await deriveKey('pw', salt, { argon2: FAST_ARGON2 })
      expect(await decryptString(key, await encryptString(key, 'hi'))).toBe('hi')
    })

    it('reports availability in this runtime', async () => {
      expect(await isArgon2idAvailable()).toBe(true)
    })
  })

  describe('pbkdf2 fallback', () => {
    const salt = new Uint8Array(16).fill(3)

    it('is deterministic for the same inputs', async () => {
      const k1 = await deriveKey('pw', salt, { kdf: 'pbkdf2', pbkdf2Iterations: 10_000 })
      const k2 = await deriveKey('pw', salt, { kdf: 'pbkdf2', pbkdf2Iterations: 10_000 })
      expect(await sameKey(k1, k2)).toBe(true)
    })

    it('produces a usable AES-GCM key', async () => {
      const key = await deriveKey('pw', salt, { kdf: 'pbkdf2', pbkdf2Iterations: 10_000 })
      expect(await decryptString(key, await encryptString(key, 'hi'))).toBe('hi')
    })
  })

  it('argon2id and pbkdf2 derive different keys from identical inputs', async () => {
    const salt = new Uint8Array(16).fill(5)
    const a = await deriveKey('pw', salt, { argon2: FAST_ARGON2 })
    const b = await deriveKey('pw', salt, { kdf: 'pbkdf2', pbkdf2Iterations: 10_000 })
    expect(await sameKey(a, b)).toBe(false)
  })
})
