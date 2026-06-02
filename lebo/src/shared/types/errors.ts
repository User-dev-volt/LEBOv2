export type ErrorType =
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'DATA_STALE'
  | 'STORAGE_ERROR'
  | 'AUTH_ERROR'
  | 'ICON_ERROR'
  | 'ITEM_DATA_ERROR'
  | 'CONTEXT_DATA_ERROR'
  | 'SCORING_ERROR'
  | 'CHARACTER_IMPORT_ERROR'
  | 'UNKNOWN'

export interface AppError {
  type: ErrorType
  message: string
  detail?: string
}

export const RETRYABLE_ERROR_TYPES: readonly ErrorType[] = ['API_ERROR', 'NETWORK_ERROR', 'TIMEOUT']

export function isRetryable(type: ErrorType): boolean {
  return RETRYABLE_ERROR_TYPES.includes(type)
}
