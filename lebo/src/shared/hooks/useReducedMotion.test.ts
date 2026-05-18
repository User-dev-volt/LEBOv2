import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReducedMotion } from './useReducedMotion'

type ChangeHandler = (e: MediaQueryListEvent) => void

function mockMatchMedia(matches: boolean) {
  const listeners: ChangeHandler[] = []
  const mq = {
    matches,
    addEventListener: vi.fn((_event: string, handler: ChangeHandler) => {
      listeners.push(handler)
    }),
    removeEventListener: vi.fn((_event: string, handler: ChangeHandler) => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    }),
    dispatchChange: (newMatches: boolean) => {
      listeners.forEach((fn) => fn({ matches: newMatches } as MediaQueryListEvent))
    },
  }
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockReturnValue(mq),
  })
  return mq
}

describe('useReducedMotion', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when prefers-reduced-motion does not match', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true when prefers-reduced-motion matches', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('updates when media query change event fires', () => {
    const mq = mockMatchMedia(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    act(() => {
      mq.dispatchChange(true)
    })
    expect(result.current).toBe(true)
  })

  it('removes event listener on unmount', () => {
    const mq = mockMatchMedia(false)
    const { unmount } = renderHook(() => useReducedMotion())
    unmount()
    expect(mq.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
