import { describe, it, expect } from 'vitest'
import { onboardSchema, itemInputSchema } from './schemas'

const argon2Payload = {
  kdfName: 'argon2id',
  kdfParams: { memorySizeKiB: 19456, iterations: 2, parallelism: 1 },
  kdfSalt: 'c2FsdA==',
  verifyBlob: 'Y2lwaGVy',
  verifyIv: 'aXY=',
}

describe('onboardSchema', () => {
  it('accepts a valid argon2id payload', () => {
    expect(onboardSchema.safeParse(argon2Payload).success).toBe(true)
  })

  it('accepts a valid pbkdf2 payload', () => {
    const payload = {
      ...argon2Payload,
      kdfName: 'pbkdf2',
      kdfParams: { iterations: 600000 },
    }
    expect(onboardSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects an unknown kdfName', () => {
    expect(
      onboardSchema.safeParse({ ...argon2Payload, kdfName: 'scrypt' }).success,
    ).toBe(false)
  })

  it('rejects argon2 params on a pbkdf2 record and vice versa', () => {
    expect(
      onboardSchema.safeParse({ ...argon2Payload, kdfName: 'pbkdf2' }).success,
    ).toBe(false)
  })

  it('rejects an empty salt or blob', () => {
    expect(
      onboardSchema.safeParse({ ...argon2Payload, kdfSalt: '' }).success,
    ).toBe(false)
    expect(
      onboardSchema.safeParse({ ...argon2Payload, verifyBlob: '' }).success,
    ).toBe(false)
  })
})

describe('itemInputSchema', () => {
  const valid = { type: 'login', cipher: 'Y2lwaGVy', iv: 'aXY=' }

  it('accepts a valid login and note item', () => {
    expect(itemInputSchema.safeParse(valid).success).toBe(true)
    expect(itemInputSchema.safeParse({ ...valid, type: 'note' }).success).toBe(true)
  })

  it('rejects an unknown type', () => {
    expect(itemInputSchema.safeParse({ ...valid, type: 'card' }).success).toBe(false)
  })

  it('rejects empty cipher or iv', () => {
    expect(itemInputSchema.safeParse({ ...valid, cipher: '' }).success).toBe(false)
    expect(itemInputSchema.safeParse({ ...valid, iv: '' }).success).toBe(false)
  })
})
