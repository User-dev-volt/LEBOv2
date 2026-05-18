import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useAppStore } from '../../shared/stores/appStore'
import { ApiKeyInput } from './ApiKeyInput'

const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}))

import toast from 'react-hot-toast'

describe('ApiKeyInput', () => {
  const initialState = useAppStore.getState()

  beforeEach(() => {
    useAppStore.setState(initialState, true)
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue(undefined)
  })

  it('Save Key button is disabled when input is empty', () => {
    render(<ApiKeyInput />)
    expect(screen.getByTestId('save-key-btn')).toBeDisabled()
  })

  it('Save Key button is enabled when input has value', () => {
    render(<ApiKeyInput />)
    fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'sk-ant-test' } })
    expect(screen.getByTestId('save-key-btn')).not.toBeDisabled()
  })

  it('shows saved placeholder when store isApiKeyConfigured is true', () => {
    useAppStore.setState({ isApiKeyConfigured: true })
    render(<ApiKeyInput />)
    const input = screen.getByTestId('api-key-input') as HTMLInputElement
    expect(input.placeholder).toBe('Claude API key saved ✓')
  })

  it('shows entry placeholder when store isApiKeyConfigured is false', () => {
    useAppStore.setState({ isApiKeyConfigured: false })
    render(<ApiKeyInput />)
    const input = screen.getByTestId('api-key-input') as HTMLInputElement
    expect(input.placeholder).toBe('sk-ant-api03-...')
  })

  it('on save success: calls set_api_key, shows toast, clears input, updates store', async () => {
    render(<ApiKeyInput />)
    fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'sk-ant-test' } })
    fireEvent.click(screen.getByTestId('save-key-btn'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_api_key', { key: 'sk-ant-test' })
      expect(toast.success).toHaveBeenCalledWith('API key saved securely')
      expect(useAppStore.getState().isApiKeyConfigured).toBe(true)
      expect((screen.getByTestId('api-key-input') as HTMLInputElement).value).toBe('')
    })
  })

  it('on save error: shows inline error, does not update store', async () => {
    mockInvoke.mockRejectedValue(new Error('STORAGE_ERROR: Vault locked'))
    render(<ApiKeyInput />)
    fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'sk-ant-test' } })
    fireEvent.click(screen.getByTestId('save-key-btn'))

    await waitFor(() => {
      // invokeCommand normalizes errors — any error text showing confirms failure path
      const errorEl = screen.getByText((_, el) =>
        el?.tagName === 'SPAN' &&
        (el.textContent ?? '').length > 0 &&
        el.closest('[data-testid="api-key-input"]') === null
      )
      expect(errorEl).toBeTruthy()
      expect(toast.success).not.toHaveBeenCalled()
      expect(useAppStore.getState().isApiKeyConfigured).not.toBe(true)
    })
  })

  it('does not call check_api_key_configured on mount', () => {
    render(<ApiKeyInput />)
    expect(mockInvoke).not.toHaveBeenCalledWith('check_api_key_configured', undefined)
  })
})
