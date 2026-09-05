// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { useClipboard } from './use-clipboard'
import { SettingsProvider } from '@/lib/settings/settings-context'

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SettingsProvider, null, children)

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.useFakeTimers()
  writeText.mockClear()
  Object.assign(navigator, { clipboard: { writeText } })
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useClipboard', () => {
  it('copies the value, then clears the clipboard after the default delay', async () => {
    const { result } = renderHook(() => useClipboard(), { wrapper })
    await act(async () => {
      await result.current('super-secret')
    })
    expect(writeText).toHaveBeenCalledWith('super-secret')

    // Default clipboardClearSeconds is 20s; nothing cleared before then.
    vi.advanceTimersByTime(19_000)
    expect(writeText).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_000)
    expect(writeText).toHaveBeenLastCalledWith('')
  })

  it('does not schedule a clear for an empty value', async () => {
    const { result } = renderHook(() => useClipboard(), { wrapper })
    await act(async () => {
      await result.current('')
    })
    vi.advanceTimersByTime(60_000)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('')
  })
})
