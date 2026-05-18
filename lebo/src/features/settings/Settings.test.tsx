import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useAppStore } from '../../shared/stores/appStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { Settings } from './Settings'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string) => {
    if (cmd === 'get_llm_provider') return Promise.resolve('claude')
    if (cmd === 'check_api_key_configured') return Promise.resolve(false)
    if (cmd === 'check_openrouter_configured') return Promise.resolve(false)
    if (cmd === 'get_model_preference') return Promise.resolve('free-first')
    return Promise.resolve(undefined)
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

const initialGameDataState = useGameDataStore.getState()

describe('Settings', () => {
  const initialState = useAppStore.getState()

  beforeEach(() => {
    useAppStore.setState(initialState, true)
    useGameDataStore.setState(initialGameDataState, true)
  })

  it('renders the Settings heading', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders the Back button', () => {
    render(<Settings />)
    expect(screen.getByTestId('settings-back-btn')).toBeInTheDocument()
    expect(screen.getByText('← Back')).toBeInTheDocument()
  })

  it('renders the ProviderSelector (AI Provider section)', () => {
    render(<Settings />)
    expect(screen.getByTestId('provider-selector')).toBeInTheDocument()
  })

  it('renders the AI Provider heading', () => {
    render(<Settings />)
    expect(screen.getByText('AI Provider')).toBeInTheDocument()
  })

  it('Back button calls setCurrentView("main")', () => {
    useAppStore.setState({ currentView: 'settings' })
    render(<Settings />)
    fireEvent.click(screen.getByTestId('settings-back-btn'))
    expect(useAppStore.getState().currentView).toBe('main')
  })

  it('shows game data version when store has data', () => {
    useGameDataStore.setState({ dataVersion: '1.4.4', dataUpdatedAt: '2026-04-22T00:00:00Z' })
    render(<Settings />)
    const text = screen.getByTestId('game-data-version').textContent!
    expect(text).toContain('1.4.4')
    expect(text).toContain('last updated')
  })

  it('shows item data version when manifest has itemDataVersion', () => {
    useGameDataStore.setState({
      gameData: {
        manifest: {
          schemaVersion: 1,
          gameVersion: '1.4.4',
          dataVersion: '1.4.4',
          generatedAt: '2026-04-22T00:00:00Z',
          classes: [],
          itemDataVersion: '1.0.0',
        },
        classes: {},
      },
    })
    render(<Settings />)
    expect(screen.getByTestId('item-data-version').textContent).toContain('1.0.0')
  })

  it('shows em-dash when versions not yet loaded', () => {
    render(<Settings />)
    expect(screen.getByTestId('game-data-version').textContent).toBe('—')
    expect(screen.getByTestId('item-data-version').textContent).toBe('—')
  })

  it('shows em-dash for item data version when manifest lacks itemDataVersion', () => {
    useGameDataStore.setState({
      gameData: {
        manifest: {
          schemaVersion: 1,
          gameVersion: '1.4.4',
          dataVersion: '1.4.4',
          generatedAt: '2026-04-22T00:00:00Z',
          classes: [],
        },
        classes: {},
      },
    })
    render(<Settings />)
    expect(screen.getByTestId('item-data-version').textContent).toBe('—')
  })
})
