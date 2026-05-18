import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { axe } from 'vitest-axe'
import 'vitest-axe/extend-expect'
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

describe('App accessibility (axe)', () => {
  let initialState: ReturnType<typeof useAppStore.getState>

  beforeEach(() => {
    initialState = useAppStore.getState()
    useAppStore.setState(initialState, true)
    vi.clearAllMocks()
  })

  it('main view has no axe violations', async () => {
    let container!: HTMLElement
    await act(async () => {
      const result = render(<App />)
      container = result.container
    })
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })

  it('settings view has no axe violations', async () => {
    useAppStore.setState({ currentView: 'settings' })
    let container!: HTMLElement
    await act(async () => {
      const result = render(<App />)
      container = result.container
    })
    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })
    expect(results).toHaveNoViolations()
  })
})
