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
        const __nfr10_t0 = performance.now() // TEMP NFR-10 instrumentation — REMOVE BEFORE COMMIT
        invokeCommand<StatSheet>('compute_stats', { snapshot })
          .then((result) => {
            // TEMP NFR-10 instrumentation — REMOVE BEFORE COMMIT (target: < 16ms steady-state; ignore first/cold call)
            // On-screen overlay (release builds have no DevTools console). Shows latest + max-so-far.
            {
              const __ms = performance.now() - __nfr10_t0
              let __el = document.getElementById('__nfr10')
              if (!__el) {
                __el = document.createElement('div')
                __el.id = '__nfr10'
                __el.style.cssText =
                  'position:fixed;bottom:8px;left:8px;z-index:99999;background:#000;color:#0f0;' +
                  'font:12px monospace;padding:4px 8px;border-radius:4px;pointer-events:none'
                document.body.appendChild(__el)
              }
              const __max = Math.max(Number(__el.dataset.max ?? 0), __ms)
              __el.dataset.max = String(__max)
              __el.textContent = `compute_stats: ${__ms.toFixed(1)}ms   max: ${__max.toFixed(1)}ms`
              console.log(`[NFR-10] compute_stats round-trip: ${__ms.toFixed(2)}ms`)
            }
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
