import { describe, it, expect } from 'vitest'
import { normalizeAppError } from './errorNormalizer'
import { isRetryable } from '../types/errors'

describe('normalizeAppError', () => {
  it('wraps unknown string errors as UNKNOWN type', () => {
    const result = normalizeAppError('some rust error string')
    expect(result.type).toBe('UNKNOWN')
    expect(result.message).toBeTruthy()
  })

  it('wraps unknown Error instances as UNKNOWN type', () => {
    const result = normalizeAppError(new Error('unexpected crash'))
    expect(result.type).toBe('UNKNOWN')
    expect(result.detail).toBe('unexpected crash')
  })

  it('detects API_ERROR from string', () => {
    const result = normalizeAppError('API_ERROR: rate limit exceeded')
    expect(result.type).toBe('API_ERROR')
    expect(result.detail).toBe('API_ERROR: rate limit exceeded')
  })

  it('detects AUTH_ERROR from string', () => {
    const result = normalizeAppError('AUTH_ERROR: no key configured')
    expect(result.type).toBe('AUTH_ERROR')
  })

  it('AUTH_ERROR preserves provider-specific backend message for Claude', () => {
    const result = normalizeAppError('AUTH_ERROR: No API key configured. Add your Claude API key in Settings.')
    expect(result.type).toBe('AUTH_ERROR')
    expect(result.message).toBe('No API key configured. Add your Claude API key in Settings.')
  })

  it('AUTH_ERROR preserves provider-specific backend message for OpenRouter', () => {
    const result = normalizeAppError('AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings.')
    expect(result.type).toBe('AUTH_ERROR')
    expect(result.message).toBe('No OpenRouter API key configured. Add your key in Settings.')
  })

  it('AUTH_ERROR strips duplicate parenthetical from Rust error propagation', () => {
    const raw = 'AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings. (AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings.)'
    const result = normalizeAppError(raw)
    expect(result.message).toBe('No OpenRouter API key configured. Add your key in Settings.')
  })

  it('detects ICON_ERROR from string', () => {
    const result = normalizeAppError('ICON_ERROR: copy failed')
    expect(result.type).toBe('ICON_ERROR')
    expect(result.detail).toBe('ICON_ERROR: copy failed')
  })

  it('detects STORAGE_ERROR from string', () => {
    const result = normalizeAppError('STORAGE_ERROR: sqlite write failed')
    expect(result.type).toBe('STORAGE_ERROR')
  })

  it('detects NETWORK_ERROR from string', () => {
    const result = normalizeAppError('NETWORK_ERROR: connection refused')
    expect(result.type).toBe('NETWORK_ERROR')
  })

  it('detects TIMEOUT from string', () => {
    const result = normalizeAppError('TIMEOUT: request exceeded 45s')
    expect(result.type).toBe('TIMEOUT')
  })

  it('passes through already-normalized AppError objects', () => {
    const existing = { type: 'AUTH_ERROR' as const, message: 'No API key' }
    const result = normalizeAppError(existing)
    expect(result).toBe(existing)
  })

  it('handles null/undefined gracefully', () => {
    const result = normalizeAppError(null)
    expect(result.type).toBe('UNKNOWN')
    expect(result.message).toBeTruthy()
  })

  it('detects SCORING_ERROR from string', () => {
    const result = normalizeAppError('SCORING_ERROR: compute failed')
    expect(result.type).toBe('SCORING_ERROR')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('detects CHARACTER_IMPORT_ERROR from string', () => {
    const result = normalizeAppError('CHARACTER_IMPORT_ERROR: save file unreadable')
    expect(result.type).toBe('CHARACTER_IMPORT_ERROR')
    expect(result.detail).toBe('CHARACTER_IMPORT_ERROR: save file unreadable')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('detects CONTEXT_DATA_ERROR from string', () => {
    const result = normalizeAppError('CONTEXT_DATA_ERROR: idol db unavailable')
    expect(result.type).toBe('CONTEXT_DATA_ERROR')
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('all error types have non-empty user-facing messages', () => {
    const types = [
      'API_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'PARSE_ERROR',
      'DATA_STALE', 'STORAGE_ERROR', 'AUTH_ERROR', 'ICON_ERROR',
      'ITEM_DATA_ERROR', 'CONTEXT_DATA_ERROR', 'SCORING_ERROR',
      'CHARACTER_IMPORT_ERROR', 'UNKNOWN',
    ]
    for (const type of types) {
      const result = normalizeAppError(`${type}: test`)
      if (result.type === type) {
        expect(result.message.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('isRetryable', () => {
  it('returns true for API_ERROR', () => {
    expect(isRetryable('API_ERROR')).toBe(true)
  })

  it('returns true for NETWORK_ERROR', () => {
    expect(isRetryable('NETWORK_ERROR')).toBe(true)
  })

  it('returns true for TIMEOUT', () => {
    expect(isRetryable('TIMEOUT')).toBe(true)
  })

  it('returns false for AUTH_ERROR', () => {
    expect(isRetryable('AUTH_ERROR')).toBe(false)
  })

  it('returns false for PARSE_ERROR', () => {
    expect(isRetryable('PARSE_ERROR')).toBe(false)
  })

  it('returns false for STORAGE_ERROR', () => {
    expect(isRetryable('STORAGE_ERROR')).toBe(false)
  })

  it('returns false for DATA_STALE', () => {
    expect(isRetryable('DATA_STALE')).toBe(false)
  })

  it('returns false for UNKNOWN', () => {
    expect(isRetryable('UNKNOWN')).toBe(false)
  })
})
