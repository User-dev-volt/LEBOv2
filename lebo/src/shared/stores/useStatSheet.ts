import { useEffect, useRef } from 'react'
import { useBuildStore } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import { invokeCommand } from '../utils/invokeCommand'
import { normalizeAppError } from '../utils/errorNormalizer'
import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'
import type { StatSheet } from '../types/statSheet'

// Pattern 4: generation counter discards stale IPC results.
// rAF cancel-and-reschedule means only one IPC call fires per frame.
export function useStatSheet(): void {
  const generationRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    function scheduleCompute(): void {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const build = useBuildStore.getState().activeBuild
        const gameData = useGameDataStore.getState().gameData

        if (!build || !gameData) {
          ++generationRef.current  // invalidate any in-flight IPC for prior build
          useOptimizationStore.getState().setStatSheet(null)
          useOptimizationStore.getState().setIsComputingStats(false)
          return
        }

        const generation = ++generationRef.current
        useOptimizationStore.getState().setIsComputingStats(true)

        const snapshot = toBuildSnapshot(build, gameData)
        invokeCommand<StatSheet>('compute_stats', { snapshot })
          .then((result) => {
            if (generationRef.current !== generation) return // stale — discard
            useOptimizationStore.getState().setStatSheet(result)
            useOptimizationStore.getState().setIsComputingStats(false)
          })
          .catch((err: unknown) => {
            if (generationRef.current !== generation) return // stale — discard
            useOptimizationStore.getState().setStreamError(normalizeAppError(err))
            useOptimizationStore.getState().setIsComputingStats(false)
          })
      })
    }

    const unsubBuild = useBuildStore.subscribe(() => scheduleCompute())
    const unsubGameData = useGameDataStore.subscribe((state, prev) => {
      if (state.gameData !== prev.gameData) scheduleCompute()
    })

    scheduleCompute()  // compute on mount if build + gameData already loaded

    return () => {
      unsubBuild()
      unsubGameData()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}
