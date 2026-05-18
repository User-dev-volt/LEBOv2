import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UnlistenFn } from '@tauri-apps/api/event'

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}))
vi.mock('../../shared/commands/iconCommands', () => ({
  getIconCachePath: vi.fn(),
}))
vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn() },
  Texture: class {},
}))
vi.mock('../../shared/stores/appStore', () => ({
  useAppStore: { getState: () => ({ setIconSource: vi.fn() }) },
}))

import { listen } from '@tauri-apps/api/event'
import { getIconCachePath } from '../../shared/commands/iconCommands'
import { Assets } from 'pixi.js'
import { useIconTextures } from './useIconTextures'

const mockListen = vi.mocked(listen)
const mockGetIconCachePath = vi.mocked(getIconCachePath)
const mockAssetsLoad = vi.mocked(Assets.load)

describe('useIconTextures', () => {
  type InitEvent = { payload: { iconSource: 'game-files' | 'community-cdn' | 'placeholder' } }
  let triggerInitialized: (event?: InitEvent) => void
  let capturedUnlisten: UnlistenFn
  const defaultInitEvent: InitEvent = { payload: { iconSource: 'placeholder' } }

  beforeEach(() => {
    vi.clearAllMocks()
    capturedUnlisten = vi.fn()
    mockListen.mockImplementation((_event, callback) => {
      triggerInitialized = (event = defaultInitEvent) => (callback as (e: InitEvent) => void)(event)
      return Promise.resolve(capturedUnlisten)
    })
  })

  it('does not call getIconCachePath before icon-pipeline:initialized fires', async () => {
    renderHook(() => useIconTextures(['skill-a', 'skill-b']))
    // Give promises time to settle
    await act(async () => {})
    expect(mockGetIconCachePath).not.toHaveBeenCalled()
  })

  it('calls getIconCachePath for each skillId after event fires', async () => {
    mockGetIconCachePath.mockResolvedValue(null)
    const { } = renderHook(() => useIconTextures(['skill-a', 'skill-b']))
    await act(async () => {})
    await act(async () => { triggerInitialized() })
    await act(async () => {})
    expect(mockGetIconCachePath).toHaveBeenCalledWith('skill-a')
    expect(mockGetIconCachePath).toHaveBeenCalledWith('skill-b')
  })

  it('excludes null paths from the returned Map', async () => {
    mockGetIconCachePath.mockResolvedValue(null)
    const { result } = renderHook(() => useIconTextures(['skill-a']))
    await act(async () => {})
    await act(async () => { triggerInitialized() })
    await act(async () => {})
    expect(result.current.size).toBe(0)
  })

  it('passes non-null paths through convertFileSrc then to Assets.load', async () => {
    mockGetIconCachePath.mockImplementation((id) =>
      Promise.resolve(id === 'skill-a' ? '/cache/skill-a.png' : null)
    )
    mockAssetsLoad.mockResolvedValue({} as never)
    renderHook(() => useIconTextures(['skill-a', 'skill-b']))
    await act(async () => {})
    await act(async () => { triggerInitialized() })
    await act(async () => {})
    expect(mockAssetsLoad).toHaveBeenCalledWith('asset:///cache/skill-a.png')
    expect(mockAssetsLoad).not.toHaveBeenCalledWith(expect.stringContaining('skill-b'))
  })

  it('returned Map contains resolved textures for non-null paths', async () => {
    const fakeTexture = { id: 'fake-texture' }
    mockGetIconCachePath.mockImplementation((id) =>
      Promise.resolve(id === 'skill-a' ? '/cache/skill-a.png' : null)
    )
    mockAssetsLoad.mockResolvedValue(fakeTexture as never)
    const { result } = renderHook(() => useIconTextures(['skill-a']))
    await act(async () => {})
    await act(async () => { triggerInitialized() })
    await act(async () => {})
    expect(result.current.get('skill-a')).toBe(fakeTexture)
  })

  it('calls unlisten on unmount', async () => {
    const { unmount } = renderHook(() => useIconTextures(['skill-a']))
    await act(async () => {})
    unmount()
    expect(capturedUnlisten).toHaveBeenCalled()
  })

  it('calls unlisten immediately when listen Promise resolves after unmount (P1 race)', async () => {
    let resolveUnlisten!: (fn: UnlistenFn) => void
    const delayedUnlisten = vi.fn()
    mockListen.mockImplementation((_event, callback) => {
      triggerInitialized = (event = defaultInitEvent) => (callback as (e: InitEvent) => void)(event)
      return new Promise((res) => { resolveUnlisten = res })
    })
    const { unmount } = renderHook(() => useIconTextures(['skill-a']))
    await act(async () => {})
    unmount()
    // Promise resolves after unmount — unlisten must be called immediately
    await act(async () => { resolveUnlisten(delayedUnlisten) })
    expect(delayedUnlisten).toHaveBeenCalled()
  })

  it('null-path skillId is not added to loadedIdsRef — can be retried on next effect run (P3)', async () => {
    // First call returns null, second call returns a path
    mockGetIconCachePath
      .mockResolvedValueOnce(null)
      .mockResolvedValue('/cache/skill-a.png')
    mockAssetsLoad.mockResolvedValue({} as never)
    const { rerender } = renderHook(() => useIconTextures(['skill-a']))
    await act(async () => {})
    await act(async () => { triggerInitialized() })
    await act(async () => {})
    // skill-a got null — not in loadedIdsRef, so a re-render with same ids should retry
    expect(mockGetIconCachePath).toHaveBeenCalledTimes(1)
    rerender()
    await act(async () => {})
    // Effect B re-runs because skillIds reference is new — skill-a not in ref, retried
    expect(mockGetIconCachePath).toHaveBeenCalledTimes(2)
  })

  it('Assets.load rejection is caught and does not throw (P4)', async () => {
    mockGetIconCachePath.mockResolvedValue('/cache/skill-a.png')
    mockAssetsLoad.mockRejectedValue(new Error('decode error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { } = renderHook(() => useIconTextures(['skill-a']))
    await act(async () => {})
    await act(async () => { triggerInitialized() })
    await act(async () => {})
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
