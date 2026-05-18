import { invokeCommand } from '../utils/invokeCommand'

/** Copies pre-bundled icon resources to the app data cache and emits `icon-pipeline:initialized`. Idempotent. */
export async function initializeIconPipeline(): Promise<void> {
  await invokeCommand<void>('initialize_icon_pipeline')
}

/**
 * Returns the absolute path to the cached icon PNG for the given skill ID,
 * or null if the skill is unmapped or the file is absent (use placeholder fill).
 */
export async function getIconCachePath(skillId: string): Promise<string | null> {
  return invokeCommand<string | null>('get_icon_cache_path', { skillId })
}
