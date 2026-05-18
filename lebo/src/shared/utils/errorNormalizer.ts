import type { AppError, ErrorType } from '../types/errors'

const ERROR_TYPE_MAP: Record<string, ErrorType> = {
  API_ERROR: 'API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  PARSE_ERROR: 'PARSE_ERROR',
  DATA_STALE: 'DATA_STALE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  ICON_ERROR: 'ICON_ERROR',
  ITEM_DATA_ERROR: 'ITEM_DATA_ERROR',
}

const USER_MESSAGES: Record<ErrorType, string> = {
  API_ERROR: 'The AI API returned an error. Please try again.',
  NETWORK_ERROR: 'Network connection failed. Check your connection and retry.',
  TIMEOUT: 'Request timed out. Please try again.',
  PARSE_ERROR: 'Could not parse the provided data. Check the format and try again.',
  DATA_STALE: 'Game data may be outdated. Consider updating your game data.',
  STORAGE_ERROR: 'A storage error occurred. Your data in memory is safe — try saving again.',
  AUTH_ERROR: 'No API key configured. Add your Claude API key in Settings.',
  ICON_ERROR: 'Could not load skill icons. Icons will show as placeholders.',
  ITEM_DATA_ERROR: 'Item database unavailable. Gear input will use free-text mode.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
}

export function normalizeAppError(raw: unknown): AppError {
  if (isAppError(raw)) return raw

  if (typeof raw === 'string') {
    const upperRaw = raw.toUpperCase()
    for (const [key, type] of Object.entries(ERROR_TYPE_MAP)) {
      if (upperRaw.includes(key)) {
        const message = type === 'AUTH_ERROR' ? extractAuthMessage(raw, key) : USER_MESSAGES[type]
        return { type, message, detail: raw }
      }
    }
    return { type: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN, detail: raw }
  }

  if (raw instanceof Error) {
    return { type: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN, detail: raw.message }
  }

  return { type: 'UNKNOWN', message: USER_MESSAGES.UNKNOWN }
}

// The Rust backend sends provider-specific messages (e.g. "Add your OpenRouter key…")
// so we preserve them rather than substituting the hardcoded static fallback.
function extractAuthMessage(raw: string, key: string): string {
  const idx = raw.toUpperCase().indexOf(key)
  const after = raw
    .slice(idx + key.length)
    .replace(/^:\s*/, '')
    // Strip duplicate parenthetical appended by the Rust error propagation
    .replace(/\s*\([^)]*AUTH_ERROR[^)]*\)\s*$/, '')
    .trim()
  return after.length > 0 ? after : USER_MESSAGES.AUTH_ERROR
}

function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'message' in value &&
    typeof (value as AppError).type === 'string' &&
    typeof (value as AppError).message === 'string'
  )
}
