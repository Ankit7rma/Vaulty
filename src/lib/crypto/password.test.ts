import { describe, it, expect } from 'vitest'
import { generatePassword } from './password'

describe('generatePassword', () => {
  it('respects the requested length', () => {
    for (const length of [1, 8, 16, 64, 128]) {
      expect(generatePassword({ length, lowercase: true })).toHaveLength(length)
    }
  })

  it('only uses characters from the enabled sets', () => {
    const pw = generatePassword({ length: 200, numbers: true })
    expect(/^[0-9]+$/.test(pw)).toBe(true)
  })

  it('includes at least one character from every enabled set', () => {
    const pw = generatePassword({
      length: 40,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    })
    expect(/[A-Z]/.test(pw)).toBe(true)
    expect(/[a-z]/.test(pw)).toBe(true)
    expect(/[0-9]/.test(pw)).toBe(true)
    expect(/[^A-Za-z0-9]/.test(pw)).toBe(true)
  })

  it('excludes ambiguous characters when asked', () => {
    const pw = generatePassword({
      length: 500,
      uppercase: true,
      lowercase: true,
      numbers: true,
      excludeAmbiguous: true,
    })
    expect(/[0O1lI]/.test(pw)).toBe(false)
  })

  it('throws when no character set is enabled', () => {
    expect(() => generatePassword({ length: 10 })).toThrow()
  })

  it('throws on an invalid length', () => {
    expect(() => generatePassword({ length: 0, lowercase: true })).toThrow()
    expect(() => generatePassword({ length: -5, lowercase: true })).toThrow()
    expect(() => generatePassword({ length: 1.5, lowercase: true })).toThrow()
  })

  it('is practically never repeated across many generations', () => {
    const opts = {
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    }
    const generated = new Set(
      Array.from({ length: 50 }, () => generatePassword(opts)),
    )
    expect(generated.size).toBe(50)
  })
})
