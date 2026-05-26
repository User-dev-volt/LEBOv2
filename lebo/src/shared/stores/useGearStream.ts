import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { invokeCommand } from '../utils/invokeCommand'
import { normalizeAppError } from '../utils/errorNormalizer'
import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'
import { useBuildStore } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import type { GearAnalysis } from '../types/statSheet'

interface GearErrorPayload {
  error_type: string
  message: string
}

export async function startGearAnalysis(): Promise<void> {
  const activeBuild = useBuildStore.getState().activeBuild
  if (!activeBuild) return

  const gameData = useGameDataStore.getState().gameData
  if (!gameData) return

  const snapshot = toBuildSnapshot(activeBuild, gameData)

  useOptimizationStore.getState().setIsAnalyzingGear(true)
  useOptimizationStore.getState().setGearAnalysis(null)
  useOptimizationStore.getState().setGearNarrative(null)
  useOptimizationStore.getState().setIsGeneratingNarrative(false)

  try {
    await invokeCommand('run_gear_scoring', { snapshot })
    // Result arrives via gear:analysis-complete event — no return value from this command
  } catch (err) {
    const appError = normalizeAppError(err)
    useOptimizationStore.getState().setStreamError(appError)
    useOptimizationStore.getState().setIsAnalyzingGear(false)
  }
}

export function useGearStream(): void {
  useEffect(() => {
    const unlisteners: UnlistenFn[] = []
    let isMounted = true

    async function registerListeners(): Promise<void> {
      const unlisten1 = await listen<GearAnalysis>(
        'gear:analysis-complete',
        (event) => {
          useOptimizationStore.getState().setGearAnalysis(event.payload)
          useOptimizationStore.getState().setIsAnalyzingGear(false)
          useOptimizationStore.getState().setIsGeneratingNarrative(true)
        },
      )
      if (!isMounted) { unlisten1(); return }
      unlisteners.push(unlisten1)

      const unlisten2 = await listen<GearErrorPayload>(
        'gear:error',
        (event) => {
          const { error_type, message } = event.payload
          const appError = normalizeAppError(`${error_type}: ${message}`)
          useOptimizationStore.getState().setStreamError(appError)
          useOptimizationStore.getState().setIsAnalyzingGear(false)
        },
      )
      if (!isMounted) { unlisten2(); return }
      unlisteners.push(unlisten2)

      const unlisten3 = await listen<{ chunk: string }>(
        'gear:narrative-chunk',
        (event) => {
          useOptimizationStore.getState().appendGearNarrativeChunk(event.payload.chunk)
        },
      )
      if (!isMounted) { unlisten3(); return }
      unlisteners.push(unlisten3)

      const unlisten4 = await listen(
        'gear:narrative-complete',
        () => {
          useOptimizationStore.getState().setIsGeneratingNarrative(false)
        },
      )
      if (!isMounted) { unlisten4(); return }
      unlisteners.push(unlisten4)

      const unlisten5 = await listen<GearErrorPayload>(
        'gear:narrative-error',
        (event) => {
          const { error_type, message } = event.payload
          const appError = normalizeAppError(`${error_type}: ${message}`)
          useOptimizationStore.getState().setStreamError(appError)
          useOptimizationStore.getState().setIsGeneratingNarrative(false)
        },
      )
      if (!isMounted) { unlisten5(); return }
      unlisteners.push(unlisten5)
    }

    registerListeners().catch(console.error)

    return () => {
      isMounted = false
      for (const unlisten of unlisteners) {
        unlisten()
      }
      useOptimizationStore.getState().setIsAnalyzingGear(false)
      useOptimizationStore.getState().setIsGeneratingNarrative(false)
    }
  }, [])
}
