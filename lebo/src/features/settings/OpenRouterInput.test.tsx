import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OpenRouterInput } from './OpenRouterInput'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

import toast from 'react-hot-toast'

const noop = () => {}

describe('OpenRouterInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(undefined)
  })

  it('key input is type=password (masked)', () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    const input = screen.getByTestId('openrouter-key-input') as HTMLInputElement
    expect(input.type).toBe('password')
  })

  it('shows saved placeholder when isConfigured=true', () => {
    render(<OpenRouterInput isConfigured={true} onConfigured={noop} />)
    const input = screen.getByTestId('openrouter-key-input') as HTMLInputElement
    expect(input.placeholder).toBe('OpenRouter API key saved ✓')
  })

  it('shows entry placeholder when isConfigured=false', () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    const input = screen.getByTestId('openrouter-key-input') as HTMLInputElement
    expect(input.placeholder).toBe('sk-or-...')
  })

  it('Save button is disabled when key input is empty', () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    expect(screen.getByTestId('save-openrouter-btn')).toBeDisabled()
  })

  it('Save button is disabled when key input is empty even if already configured', () => {
    render(<OpenRouterInput isConfigured={true} onConfigured={noop} />)
    expect(screen.getByTestId('save-openrouter-btn')).toBeDisabled()
  })

  it('Save button is enabled when key input has a value', () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    fireEvent.change(screen.getByTestId('openrouter-key-input'), { target: { value: 'sk-or-test' } })
    expect(screen.getByTestId('save-openrouter-btn')).not.toBeDisabled()
  })

  it('Save calls set_openrouter_api_key with trimmed key', async () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    fireEvent.change(screen.getByTestId('openrouter-key-input'), { target: { value: '  sk-or-test  ' } })
    fireEvent.click(screen.getByTestId('save-openrouter-btn'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_openrouter_api_key', { key: 'sk-or-test' })
    })
  })

  it('calls onConfigured and shows toast on success', async () => {
    const onConfigured = vi.fn()
    render(<OpenRouterInput isConfigured={false} onConfigured={onConfigured} />)
    fireEvent.change(screen.getByTestId('openrouter-key-input'), { target: { value: 'sk-or-test' } })
    fireEvent.click(screen.getByTestId('save-openrouter-btn'))

    await waitFor(() => {
      expect(onConfigured).toHaveBeenCalledOnce()
      expect(toast.success).toHaveBeenCalledWith('OpenRouter API key saved')
    })
  })

  it('clears key input after successful save', async () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    const input = screen.getByTestId('openrouter-key-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'sk-or-test' } })
    fireEvent.click(screen.getByTestId('save-openrouter-btn'))

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('shows inline error and does not call onConfigured on save failure', async () => {
    // invokeCommand normalizes errors — unknown shape produces the generic message
    mockInvoke.mockRejectedValue(new Error('STORAGE_ERROR: Vault locked'))
    const onConfigured = vi.fn()
    render(<OpenRouterInput isConfigured={false} onConfigured={onConfigured} />)
    fireEvent.change(screen.getByTestId('openrouter-key-input'), { target: { value: 'sk-or-test' } })
    fireEvent.click(screen.getByTestId('save-openrouter-btn'))

    await waitFor(() => {
      expect(screen.getByText(/unexpected error|Vault locked|STORAGE_ERROR/i)).toBeInTheDocument()
    })
    expect(onConfigured).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows model rotation description text', () => {
    render(<OpenRouterInput isConfigured={false} onConfigured={noop} />)
    expect(screen.getByText(/Automatically rotates through/)).toBeInTheDocument()
  })
})
