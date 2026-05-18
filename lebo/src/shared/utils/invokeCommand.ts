import { invoke } from '@tauri-apps/api/core'
import { normalizeAppError } from './errorNormalizer'

export async function invokeCommand<T>(command: string, args?: unknown): Promise<T> {
  try {
    return await invoke<T>(command, args as Record<string, unknown>)
  } catch (error) {
    throw normalizeAppError(error)
  }
}
