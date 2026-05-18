import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAppStore } from '../../shared/stores/appStore'
import { AppHeader } from './AppHeader'

vi.mock('../../shared/hooks/useUpdateCheck', () => ({
  getPendingUpdate: vi.fn(),
}))

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn().mockResolvedValue(undefined),
}))

import { getPendingUpdate } from '../../shared/hooks/useUpdateCheck'

describe('AppHeader', () => {
  const initialState = useAppStore.getState()

  beforeEach(() => {
    useAppStore.setState({ ...initialState, currentView: 'main' }, true)
    vi.clearAllMocks()
    vi.mocked(getPendingUpdate).mockReturnValue(null)
  })

  // ── Existing navigation tests ────────────────────────────────────────────

  it('renders the app name', () => {
    render(<AppHeader />)
    expect(screen.getByText('LEBOv2')).toBeInTheDocument()
  })

  it('renders the full product title', () => {
    render(<AppHeader />)
    expect(screen.getByText('Last Epoch Build Optimizer')).toBeInTheDocument()
  })

  it('renders a header landmark', () => {
    render(<AppHeader />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('shows Settings button when currentView is "main"', () => {
    useAppStore.setState({ currentView: 'main' })
    render(<AppHeader />)
    expect(screen.getByTestId('settings-button')).toBeInTheDocument()
  })

  it('hides Settings button when currentView is "settings"', () => {
    useAppStore.setState({ currentView: 'settings' })
    render(<AppHeader />)
    expect(screen.queryByTestId('settings-button')).toBeNull()
  })

  it('Settings button navigates to settings view on click', () => {
    useAppStore.setState({ currentView: 'main' })
    render(<AppHeader />)
    fireEvent.click(screen.getByTestId('settings-button'))
    expect(useAppStore.getState().currentView).toBe('settings')
  })

  // ── Update banner: no banner by default ─────────────────────────────────

  it('does not render update banner when updateInfo is null', () => {
    useAppStore.setState({ updateInfo: null })
    render(<AppHeader />)
    expect(screen.queryByTestId('update-banner')).toBeNull()
  })

  it('does not render update banner when updateDismissed is true', () => {
    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'idle',
      updateDismissed: true,
    })
    render(<AppHeader />)
    expect(screen.queryByTestId('update-banner')).toBeNull()
  })

  // ── Update banner: idle state ────────────────────────────────────────────

  it('renders update banner with version text when update is available', () => {
    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'idle',
      updateProgress: 0,
      updateDismissed: false,
    })
    render(<AppHeader />)
    expect(screen.getByTestId('update-banner')).toBeInTheDocument()
    expect(screen.getByTestId('update-version-text')).toHaveTextContent('LEBOv2 1.2.0 is available.')
    expect(screen.getByTestId('install-update-button')).toBeInTheDocument()
  })

  it('dismiss button calls setUpdateDismissed(true)', () => {
    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'idle',
      updateDismissed: false,
    })
    render(<AppHeader />)
    fireEvent.click(screen.getByTestId('dismiss-update-button'))
    expect(useAppStore.getState().updateDismissed).toBe(true)
  })

  // ── Update banner: downloading state ────────────────────────────────────

  it('shows downloading progress text when updateStatus is downloading', () => {
    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'downloading',
      updateProgress: 42,
      updateDismissed: false,
    })
    render(<AppHeader />)
    expect(screen.getByTestId('download-progress-text')).toHaveTextContent('Downloading... 42%')
    expect(screen.queryByTestId('install-update-button')).toBeNull()
    expect(screen.queryByTestId('dismiss-update-button')).toBeNull()
  })

  // ── Update banner: ready state ───────────────────────────────────────────

  it('shows restart prompt when updateStatus is ready', () => {
    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'ready',
      updateDismissed: false,
    })
    render(<AppHeader />)
    expect(screen.getByTestId('update-ready-text')).toHaveTextContent('Update ready. Restart LEBOv2 to apply?')
    expect(screen.getByTestId('restart-now-button')).toBeInTheDocument()
    expect(screen.getByTestId('dismiss-update-button')).toBeInTheDocument()
  })

  it('Restart Now calls update.install() and restart_app command', async () => {
    const mockInstall = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getPendingUpdate).mockReturnValue({
      version: '1.2.0',
      body: null,
      download: vi.fn(),
      install: mockInstall,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { invokeCommand } = await import('../../shared/utils/invokeCommand')

    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'ready',
      updateDismissed: false,
    })
    render(<AppHeader />)
    fireEvent.click(screen.getByTestId('restart-now-button'))

    await vi.waitFor(() => {
      expect(mockInstall).toHaveBeenCalled()
      expect(invokeCommand).toHaveBeenCalledWith('restart_app')
    })
  })

  // ── Update banner: error state ───────────────────────────────────────────

  it('shows error text and dismiss button when updateStatus is error', () => {
    useAppStore.setState({
      updateInfo: { version: '1.2.0', body: null },
      updateStatus: 'error',
      updateDismissed: false,
    })
    render(<AppHeader />)
    expect(screen.getByTestId('update-error-text')).toBeInTheDocument()
    expect(screen.getByTestId('dismiss-update-button')).toBeInTheDocument()
    expect(screen.queryByTestId('install-update-button')).toBeNull()
    expect(screen.queryByTestId('download-progress-text')).toBeNull()
  })
})
