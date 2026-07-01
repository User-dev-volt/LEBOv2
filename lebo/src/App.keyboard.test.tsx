import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { App } from './App'
import { useAppStore } from './shared/stores/appStore'
import { useBuildStore } from './shared/stores/buildStore'

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

function pressKey(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
  })
}

function pressCtrl(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true }))
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

describe('App center-tab keyboard shortcuts 1–6 (FR-36)', () => {
  let initialState: ReturnType<typeof useAppStore.getState>

  beforeEach(() => {
    initialState = useAppStore.getState()
    useAppStore.setState(initialState, true)
    useAppStore.setState({ currentView: 'main', centerTab: 'tree' })
    vi.clearAllMocks()
  })

  it('maps keys 1–6 to tree/weaver/gear/skill/idol/blessing', async () => {
    await act(async () => {
      render(<App />)
    })
    const cases: [string, string][] = [
      ['1', 'tree'],
      ['2', 'weaver'],
      ['3', 'gear'],
      ['4', 'skill'],
      ['5', 'idol'],
      ['6', 'blessing'],
    ]
    for (const [key, tab] of cases) {
      pressKey(key)
      expect(useAppStore.getState().centerTab).toBe(tab)
    }
  })

  it('does not switch tabs when the shortcut is pressed in the settings view', async () => {
    useAppStore.setState({ currentView: 'settings', centerTab: 'tree' })
    await act(async () => {
      render(<App />)
    })
    pressKey('2')
    expect(useAppStore.getState().centerTab).toBe('tree')
  })
})

describe('App shortcuts suppressed while a blocking modal is open (Story 3.5)', () => {
  let initialState: ReturnType<typeof useAppStore.getState>

  beforeEach(() => {
    initialState = useAppStore.getState()
    useAppStore.setState(initialState, true)
    useAppStore.setState({ currentView: 'main', centerTab: 'tree', isBlockingModalOpen: false })
    vi.clearAllMocks()
  })

  it('does not switch center tabs while a blocking modal is open', async () => {
    await act(async () => {
      render(<App />)
    })
    useAppStore.setState({ isBlockingModalOpen: true })
    pressKey('2')
    expect(useAppStore.getState().centerTab).toBe('tree')
  })

  it('does not fire undo or redo while a blocking modal is open', async () => {
    await act(async () => {
      render(<App />)
    })
    const undoSpy = vi.spyOn(useBuildStore.getState(), 'undoNodeChange')
    const redoSpy = vi.spyOn(useBuildStore.getState(), 'redoNodeChange')
    useAppStore.setState({ isBlockingModalOpen: true })
    pressCtrl('z')
    pressCtrl('y')
    expect(undoSpy).not.toHaveBeenCalled()
    expect(redoSpy).not.toHaveBeenCalled()
  })

  it('resumes shortcuts once the modal closes', async () => {
    await act(async () => {
      render(<App />)
    })
    useAppStore.setState({ isBlockingModalOpen: true })
    pressKey('2')
    expect(useAppStore.getState().centerTab).toBe('tree')
    useAppStore.setState({ isBlockingModalOpen: false })
    pressKey('2')
    expect(useAppStore.getState().centerTab).toBe('weaver')
  })
})
