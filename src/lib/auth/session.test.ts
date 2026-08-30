import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSessionToken,
  verifySessionToken,
  getSessionTtlHours,
} from './session'

const VALID_SECRET = 'test-secret-at-least-16-chars-long'

beforeEach(() => {
  process.env.JWT_SECRET = VALID_SECRET
  delete process.env.SESSION_TTL_HOURS
})

describe('session tokens', () => {
  it('round-trips a valid session', async () => {
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' })
    expect(await verifySessionToken(token)).toEqual({
      userId: 'u1',
      email: 'a@b.com',
    })
  })

  it('returns null for a garbage token', async () => {
    expect(await verifySessionToken('not-a-jwt')).toBeNull()
    expect(await verifySessionToken('')).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken({ userId: 'u1', email: 'a@b.com' })
    process.env.JWT_SECRET = 'a-completely-different-secret-value'
    expect(await verifySessionToken(token)).toBeNull()
  })

  it('throws when JWT_SECRET is missing or too short', async () => {
    process.env.JWT_SECRET = 'short'
    await expect(
      createSessionToken({ userId: 'u1', email: 'a@b.com' }),
    ).rejects.toThrow()
    delete process.env.JWT_SECRET
    await expect(
      createSessionToken({ userId: 'u1', email: 'a@b.com' }),
    ).rejects.toThrow()
  })

  it('reads the TTL from env with a sane default', () => {
    expect(getSessionTtlHours()).toBe(12)
    process.env.SESSION_TTL_HOURS = '24'
    expect(getSessionTtlHours()).toBe(24)
    process.env.SESSION_TTL_HOURS = 'garbage'
    expect(getSessionTtlHours()).toBe(12)
  })
})
