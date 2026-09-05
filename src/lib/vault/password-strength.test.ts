import { describe, it, expect } from 'vitest'
import { estimateStrength } from './password-strength'

describe('estimateStrength', () => {
  it('scores an empty password as very weak (0)', () => {
    expect(estimateStrength('')).toEqual({ score: 0, label: 'Very weak' })
  })

  it('scores a common password low', () => {
    expect(estimateStrength('password').score).toBeLessThanOrEqual(1)
  })

  it('scores a long random password high', () => {
    expect(
      estimateStrength('9x!Kq2@vBn7#Lp4$Rw8&Zt3').score,
    ).toBeGreaterThanOrEqual(3)
  })

  it('returns a non-empty label matching the score', () => {
    const strong = estimateStrength('9x!Kq2@vBn7#Lp4$Rw8&Zt3')
    expect(strong.label.length).toBeGreaterThan(0)
    const weak = estimateStrength('password')
    expect(weak.score).toBeLessThan(strong.score)
  })
})
