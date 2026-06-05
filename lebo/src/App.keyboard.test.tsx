import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './shared/stores/appStore'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}))

vi.mock('./features/game-data/gameDataLoader', () => ({
  initGameData: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./features/build-manager/buildPersistence', () => ({
  loadBuildsOnStartup: vi.fn().mockResolvedValue(undefined),
  saveBuild: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./features/build-manager/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}))

vi.mock('./shared/hooks/useConnectivity', () => ({
  useConnectivity: vi.fn(),
}))

vi.mock('./shared/hooks/useUpdateCheck', () => ({
  useUpdateCheck: vi.fn(),
  getPendingUpdate: vi.fn().mockReturnValue(null),
}))

vi.mock('./shared/hooks/useAccessibilityAnnouncer', () => ({
  useAccessibilityAnnouncer: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

function pressEscape() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
}

describe('App global Escape navigation (FR-33)', () => {
  let initialState: ReturnType<typeof useAppStore.getState>

  beforeEach(() => {
    initialState = useAppStore.getState()
    useAppStore.setState(initialState, true)
    vi.clearAllMocks()
  })

  it('returns to the Builder from the settings view on Escape', async () => {
    useAppStore.setState({ currentView: 'settings' })
    await act(async () => {
      render(<App />)
    })
    pressEscape()
    expect(useAppStore.getState().currentView).toBe('main')
  })

  it('returns to the Builder from the gear-optimization view on Escape', async () => {
    useAppStore.setState({ currentView: 'gear-optimization' })
    await act(async () => {
      render(<App />)
    })
    pressEscape()
    expect(useAppStore.getState().currentView).toBe('main')
  })

  it('does not navigate away when Escape is pressed in the Builder (main) view', async () => {
    useAppStore.setState({ currentView: 'main' })
    await act(async () => {
      render(<App />)
    })
    pressEscape()
    expect(useAppStore.getState().currentView).toBe('main')
  })
})
