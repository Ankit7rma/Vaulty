import { describe, it, expect } from 'vitest'
import { normalizeSettings, DEFAULT_SETTINGS } from './settings'

describe('normalizeSettings', () => {
  it('passes through valid values', () => {
    expect(
      normalizeSettings({ autoLockMinutes: 15, clipboardClearSeconds: 30 }),
    ).toEqual({ autoLockMinutes: 15, clipboardClearSeconds: 30 })
  })

  it('falls back to defaults for missing or non-numeric input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
    expect(
      normalizeSettings({ autoLockMinutes: 'abc', clipboardClearSeconds: NaN }),
    ).toEqual(DEFAULT_SETTINGS)
  })

  it('allows 0 (never) for both timeouts', () => {
    expect(
      normalizeSettings({ autoLockMinutes: 0, clipboardClearSeconds: 0 }),
    ).toEqual({ autoLockMinutes: 0, clipboardClearSeconds: 0 })
  })

  it('clamps negative and absurd values into range', () => {
    const s = normalizeSettings({
      autoLockMinutes: -5,
      clipboardClearSeconds: 999999,
    })
    expect(s.autoLockMinutes).toBe(0)
    expect(s.clipboardClearSeconds).toBe(600)
  })

  it('floors fractional values', () => {
    expect(normalizeSettings({ autoLockMinutes: 5.9 }).autoLockMinutes).toBe(5)
  })
})
