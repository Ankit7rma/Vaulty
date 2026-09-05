// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoLock } from './use-auto-lock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useAutoLock', () => {
  it('locks after the idle timeout elapses', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(1, onLock))
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('resets the countdown on user activity', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(1, onLock))
    vi.advanceTimersByTime(50_000)
    window.dispatchEvent(new Event('mousemove'))
    vi.advanceTimersByTime(50_000) // 50s since reset, not yet locked
    expect(onLock).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10_000) // now 60s since reset
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('never locks when disabled (minutes <= 0)', () => {
    const onLock = vi.fn()
    renderHook(() => useAutoLock(0, onLock))
    vi.advanceTimersByTime(60 * 60_000)
    expect(onLock).not.toHaveBeenCalled()
  })

  it('cleans up its timer on unmount', () => {
    const onLock = vi.fn()
    const { unmount } = renderHook(() => useAutoLock(1, onLock))
    unmount()
    vi.advanceTimersByTime(120_000)
    expect(onLock).not.toHaveBeenCalled()
  })
})
