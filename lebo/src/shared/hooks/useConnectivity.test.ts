import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Event } from '@tauri-apps/api/event'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

import { listen } from '@tauri-apps/api/event'
import { useAppStore } from '../stores/appStore'
import { useConnectivity } from './useConnectivity'

describe('useConnectivity', () => {
  const initialAppState = useAppStore.getState()

  beforeEach(() => {
    useAppStore.setState(initialAppState, true)
    vi.clearAllMocks()
    vi.mocked(listen).mockResolvedValue(vi.fn())
  })

  it('calls check_connectivity on mount', async () => {
    mockInvoke.mockResolvedValueOnce(true)
    renderHook(() => useConnectivity())
    expect(mockInvoke).toHaveBeenCalledWith('check_connectivity', undefined)
  })

  it('calls setOnline(true) when check_connectivity resolves true', async () => {
    mockInvoke.mockResolvedValueOnce(true)
    renderHook(() => useConnectivity())
    await vi.waitFor(() => {
      expect(useAppStore.getState().isOnline).toBe(true)
    })
  })

  it('calls setOnline(false) when check_connectivity rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network error'))
    renderHook(() => useConnectivity())
    await vi.waitFor(() => {
      expect(useAppStore.getState().isOnline).toBe(false)
    })
  })

  it('calls setOnline(false) when app:connectivity-changed event fires with is_online=false', async () => {
    mockInvoke.mockResolvedValueOnce(true)
    renderHook(() => useConnectivity())

    // Wait for listen to be called
    await vi.waitFor(() => expect(listen).toHaveBeenCalled())

    const listenMock = vi.mocked(listen)
    const handler = listenMock.mock.calls[0][1] as (e: Event<{ is_online: boolean }>) => void
    handler({ payload: { is_online: false } } as Event<{ is_online: boolean }>)

    expect(useAppStore.getState().isOnline).toBe(false)
  })

  it('calls setOnline(true) when app:connectivity-changed event fires with is_online=true', async () => {
    mockInvoke.mockResolvedValueOnce(false)
    renderHook(() => useConnectivity())

    await vi.waitFor(() => expect(listen).toHaveBeenCalled())

    const listenMock = vi.mocked(listen)
    const handler = listenMock.mock.calls[0][1] as (e: Event<{ is_online: boolean }>) => void
    handler({ payload: { is_online: true } } as Event<{ is_online: boolean }>)

    expect(useAppStore.getState().isOnline).toBe(true)
  })

  it('calls unlisten on unmount', async () => {
    mockInvoke.mockResolvedValueOnce(true)
    const unlisten = vi.fn()
    vi.mocked(listen).mockResolvedValueOnce(unlisten)

    const { unmount } = renderHook(() => useConnectivity())
    await vi.waitFor(() => expect(listen).toHaveBeenCalled())

    unmount()
    expect(unlisten).toHaveBeenCalled()
  })

  it('calls unlisten immediately when component unmounts before listen resolves', async () => {
    mockInvoke.mockResolvedValueOnce(true)
    const unlisten = vi.fn()
    let resolveListen!: (fn: () => void) => void
    vi.mocked(listen).mockReturnValueOnce(new Promise((res) => { resolveListen = res }))

    const { unmount } = renderHook(() => useConnectivity())
    unmount() // unmount before listen promise settles
    resolveListen(unlisten) // now the promise settles
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalled())
  })
})
