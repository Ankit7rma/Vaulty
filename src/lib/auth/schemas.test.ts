import { describe, it, expect } from 'vitest'
import { signupSchema, loginSchema } from './schemas'

describe('auth schemas', () => {
  it('accepts a valid signup and normalizes the email', () => {
    const result = signupSchema.safeParse({
      email: '  User@Example.COM ',
      password: 'longenough',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('user@example.com')
  })

  it('rejects a short account password', () => {
    expect(
      signupSchema.safeParse({ email: 'a@b.com', password: 'short' }).success,
    ).toBe(false)
  })

  it('rejects an invalid email', () => {
    expect(
      signupSchema.safeParse({ email: 'not-an-email', password: 'longenough' })
        .success,
    ).toBe(false)
  })

  it('login accepts any non-empty password but rejects empty', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success,
    ).toBe(true)
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: '' }).success,
    ).toBe(false)
  })
})
