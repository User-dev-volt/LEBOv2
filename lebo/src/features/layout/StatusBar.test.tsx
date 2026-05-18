import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from './StatusBar'
import { useAppStore } from '../../shared/stores/appStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

const initialAppState = useAppStore.getState()
const initialGameDataState = useGameDataStore.getState()

describe('StatusBar', () => {
  beforeEach(() => {
    useAppStore.setState(initialAppState, true)
    useGameDataStore.setState(initialGameDataState, true)
  })

  it('shows Offline when isOnline is false', () => {
    render(<StatusBar />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('shows Online when isOnline is true', () => {
    useAppStore.getState().setOnline(true)
    render(<StatusBar />)
    expect(screen.getByText('Online')).toBeInTheDocument()
  })

  it('hides data version when none is set', () => {
    render(<StatusBar />)
    expect(screen.queryByText(/Data:/)).not.toBeInTheDocument()
  })

  it('displays data version when set', () => {
    useGameDataStore.getState().setDataVersion('v42')
    render(<StatusBar />)
    expect(screen.getByText('Data: v42')).toBeInTheDocument()
  })

  it('displays version and date when both dataVersion and dataUpdatedAt are set', () => {
    useGameDataStore.getState().setDataVersion('1.4.4')
    useGameDataStore.getState().setDataUpdatedAt('2026-04-22T00:00:00Z')
    render(<StatusBar />)
    expect(screen.getByText('Data: 1.4.4 — 2026-04-22')).toBeInTheDocument()
  })

  it('displays only version when dataUpdatedAt is null', () => {
    useGameDataStore.getState().setDataVersion('1.4.4')
    render(<StatusBar />)
    expect(screen.getByText('Data: 1.4.4')).toBeInTheDocument()
    expect(screen.queryByText(/—/)).not.toBeInTheDocument()
  })

  it('has an aria-live region for status announcements', () => {
    render(<StatusBar />)
    expect(screen.getByRole('contentinfo').querySelector('[aria-live="polite"]')).toBeTruthy()
  })
})
