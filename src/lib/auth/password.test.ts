import { describe, it, expect } from 'vitest'
import {
  hashAccountPassword,
  verifyAccountPassword,
  type AccountHashParams,
} from './password'

// Low cost params keep the suite fast; correctness is independent of cost.
const FAST: AccountHashParams = {
  memorySizeKiB: 64,
  iterations: 1,
  parallelism: 1,
}

describe('account password hashing', () => {
  it('verifies a correct password', async () => {
    const hash = await hashAccountPassword('correct horse battery staple', FAST)
    expect(
      await verifyAccountPassword('correct horse battery staple', hash),
    ).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashAccountPassword('right-password', FAST)
    expect(await verifyAccountPassword('wrong-password', hash)).toBe(false)
  })

  it('produces a distinct salted hash each time', async () => {
    const a = await hashAccountPassword('same', FAST)
    const b = await hashAccountPassword('same', FAST)
    expect(a).not.toBe(b)
    expect(await verifyAccountPassword('same', a)).toBe(true)
    expect(await verifyAccountPassword('same', b)).toBe(true)
  })

  it('produces an argon2id PHC-encoded hash', async () => {
    const hash = await hashAccountPassword('x', FAST)
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  it('returns false for a malformed stored hash', async () => {
    expect(await verifyAccountPassword('x', 'not-a-valid-hash')).toBe(false)
  })
})
