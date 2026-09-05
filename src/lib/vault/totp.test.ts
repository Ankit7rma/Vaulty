import { describe, it, expect } from 'vitest'
import {
  generateTotp,
  totpRemainingSeconds,
  isValidTotpSecret,
  normalizeTotpSecret,
} from './totp'

// RFC 6238 Appendix B test secret (ASCII "12345678901234567890") in base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

describe('generateTotp', () => {
  it('matches RFC 6238 SHA-1 vectors (8 digits)', async () => {
    expect(await generateTotp(RFC_SECRET, { timestamp: 59_000, digits: 8 })).toBe(
      '94287082',
    )
    expect(
      await generateTotp(RFC_SECRET, { timestamp: 1111111109_000, digits: 8 }),
    ).toBe('07081804')
    expect(
      await generateTotp(RFC_SECRET, { timestamp: 1234567890_000, digits: 8 }),
    ).toBe('89005924')
    expect(
      await generateTotp(RFC_SECRET, { timestamp: 2000000000_000, digits: 8 }),
    ).toBe('69279037')
  })

  it('produces the 6-digit code (last 6 of the 8-digit code)', async () => {
    expect(await generateTotp(RFC_SECRET, { timestamp: 59_000 })).toBe('287082')
  })

  it('is stable within a 30s window and changes across windows', async () => {
    const a = await generateTotp(RFC_SECRET, { timestamp: 60_000 })
    const b = await generateTotp(RFC_SECRET, { timestamp: 89_000 })
    const c = await generateTotp(RFC_SECRET, { timestamp: 90_000 })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})

describe('totpRemainingSeconds', () => {
  it('counts down within the window', () => {
    expect(totpRemainingSeconds(60_000)).toBe(30)
    expect(totpRemainingSeconds(75_000)).toBe(15)
    expect(totpRemainingSeconds(89_000)).toBe(1)
  })
})

describe('secret parsing', () => {
  it('accepts a valid base32 secret and rejects junk', () => {
    expect(isValidTotpSecret(RFC_SECRET)).toBe(true)
    expect(isValidTotpSecret('has spaces GEZDGNBV')).toBe(true)
    expect(isValidTotpSecret('!!!! not base32 !!!!')).toBe(false)
    expect(isValidTotpSecret('')).toBe(false)
  })

  it('extracts the secret from an otpauth:// URI', () => {
    const uri = `otpauth://totp/Vaulty:me?secret=${RFC_SECRET}&issuer=Vaulty`
    expect(normalizeTotpSecret(uri)).toBe(RFC_SECRET)
  })
})
