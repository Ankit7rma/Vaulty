import { describe, it, expect } from 'vitest'
import { utf8ToBytes, bytesToUtf8, bytesToBase64, base64ToBytes } from './encoding'

describe('encoding', () => {
  it('utf8 round-trips ascii and unicode', () => {
    for (const s of ['', 'hello', 'pa$$word 123', 'café ☕ 日本語 🔐']) {
      expect(bytesToUtf8(utf8ToBytes(s))).toBe(s)
    }
  })

  it('base64 round-trips arbitrary bytes of varied length', () => {
    for (const len of [0, 1, 2, 3, 16, 255, 1000]) {
      const bytes = crypto.getRandomValues(new Uint8Array(len))
      const restored = base64ToBytes(bytesToBase64(bytes))
      expect(Array.from(restored)).toEqual(Array.from(bytes))
    }
  })

  it('matches a known base64 vector', () => {
    expect(bytesToBase64(utf8ToBytes('hello'))).toBe('aGVsbG8=')
    expect(bytesToUtf8(base64ToBytes('aGVsbG8='))).toBe('hello')
  })
})
