import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAppStore } from '../stores/appStore'
import type { Update } from '@tauri-apps/plugin-updater'

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

// Import after mock so the mock is in place
import { check } from '@tauri-apps/plugin-updater'
import { useUpdateCheck } from './useUpdateCheck'

describe('useUpdateCheck', () => {
  const initialState = useAppStore.getState()

  beforeEach(() => {
    useAppStore.setState({ ...initialState }, true)
    vi.clearAllMocks()
  })

  it('calls setUpdateInfo when check resolves with an update', async () => {
    const mockUpdate = {
      version: '1.2.0',
      body: 'Bug fixes and improvements',
      download: vi.fn(),
      install: vi.fn(),
    } as unknown as Update

    vi.mocked(check).mockResolvedValue(mockUpdate)

    renderHook(() => useUpdateCheck())

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAppStore.getState().updateInfo).toEqual({
      version: '1.2.0',
      body: 'Bug fixes and improvements',
    })
  })

  it('does not call setUpdateInfo when check resolves with null', async () => {
    vi.mocked(check).mockResolvedValue(null)

    renderHook(() => useUpdateCheck())

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAppStore.getState().updateInfo).toBeNull()
  })

  it('does not propagate error when check rejects', async () => {
    vi.mocked(check).mockRejectedValue(new Error('network error'))

    // Should not throw
    renderHook(() => useUpdateCheck())

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAppStore.getState().updateInfo).toBeNull()
  })

  it('uses body null when update body is undefined', async () => {
    const mockUpdate = {
      version: '2.0.0',
      body: undefined,
      download: vi.fn(),
      install: vi.fn(),
    } as unknown as Update

    vi.mocked(check).mockResolvedValue(mockUpdate)

    renderHook(() => useUpdateCheck())

    await act(async () => {
      await Promise.resolve()
    })

    expect(useAppStore.getState().updateInfo).toEqual({
      version: '2.0.0',
      body: null,
    })
  })
})
