import { describe, it, expect } from 'vitest'

// Foundation check: the whole zero-knowledge model rests on the runtime
// exposing the Web Crypto API. If this fails, nothing downstream is safe.
describe('web crypto foundation', () => {
  it('exposes crypto.subtle (AES-GCM / deriveKey primitives)', () => {
    expect(globalThis.crypto).toBeDefined()
    expect(globalThis.crypto.subtle).toBeDefined()
  })

  it('produces unique random bytes via getRandomValues', () => {
    const a = crypto.getRandomValues(new Uint8Array(16))
    const b = crypto.getRandomValues(new Uint8Array(16))
    expect(a).toHaveLength(16)
    // Collision here is astronomically unlikely; a match means a broken RNG.
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
  })
})
