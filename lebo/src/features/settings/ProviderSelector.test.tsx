import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAppStore } from '../../shared/stores/appStore'
import { ProviderSelector } from './ProviderSelector'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

import toast from 'react-hot-toast'

describe('ProviderSelector', () => {
  const initialState = useAppStore.getState()

  beforeEach(() => {
    useAppStore.setState(initialState, true)
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(undefined)
  })

  it('renders provider-selector control', () => {
    render(<ProviderSelector />)
    expect(screen.getByTestId('provider-selector')).toBeInTheDocument()
    expect(screen.getByTestId('provider-claude')).toBeInTheDocument()
    expect(screen.getByTestId('provider-openrouter')).toBeInTheDocument()
  })

  it('shows AI Provider heading', () => {
    render(<ProviderSelector />)
    expect(screen.getByText('AI Provider')).toBeInTheDocument()
  })

  it('shows neither provider input when llmProvider is null', () => {
    useAppStore.setState({ llmProvider: null })
    render(<ProviderSelector />)
    expect(screen.queryByTestId('api-key-input')).not.toBeInTheDocument()
    expect(screen.queryByTestId('openrouter-key-input')).not.toBeInTheDocument()
  })

  it('shows ApiKeyInput when store has claude', () => {
    useAppStore.setState({ llmProvider: 'claude' })
    render(<ProviderSelector />)
    expect(screen.getByTestId('api-key-input')).toBeInTheDocument()
  })

  it('shows OpenRouterInput when store has openrouter', () => {
    useAppStore.setState({ llmProvider: 'openrouter', isOpenRouterConfigured: false })
    render(<ProviderSelector />)
    expect(screen.getByTestId('openrouter-key-input')).toBeInTheDocument()
  })

  it('does not call get_llm_provider on mount', () => {
    render(<ProviderSelector />)
    expect(mockInvoke).not.toHaveBeenCalledWith('get_llm_provider', undefined)
  })

  it('switching to OpenRouter calls set_llm_provider and updates store', async () => {
    useAppStore.setState({ llmProvider: 'claude' })
    render(<ProviderSelector />)

    fireEvent.click(screen.getByTestId('provider-openrouter'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_llm_provider', { provider: 'openrouter' })
    })
    expect(useAppStore.getState().llmProvider).toBe('openrouter')
    expect(toast.success).toHaveBeenCalledWith('Switched to OpenRouter')
  })

  it('switching back to Claude calls set_llm_provider with "claude"', async () => {
    useAppStore.setState({ llmProvider: 'openrouter', isOpenRouterConfigured: false })
    render(<ProviderSelector />)

    fireEvent.click(screen.getByTestId('provider-claude'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_llm_provider', { provider: 'claude' })
    })
    expect(toast.success).toHaveBeenCalledWith('Switched to Claude')
  })

  it('reverts provider on set_llm_provider failure', async () => {
    useAppStore.setState({ llmProvider: 'claude' })
    mockInvoke.mockRejectedValue(new Error('vault error'))
    render(<ProviderSelector />)

    fireEvent.click(screen.getByTestId('provider-openrouter'))

    await waitFor(() => {
      expect(useAppStore.getState().llmProvider).toBe('claude')
    })
    expect(toast.error).toHaveBeenCalledWith('Failed to save provider selection')
  })
})
