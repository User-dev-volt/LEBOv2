import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { calculateScore } from '../../features/optimization/scoringEngine'
import { invokeCommand } from '../utils/invokeCommand'
import { normalizeAppError } from '../utils/errorNormalizer'
import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'
import { useBuildStore, selectUnspentPassivePoints, selectAvailablePassivePoints } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import type { SuggestionResult } from '../types/optimization'
import type { NodeEfficiency } from '../types/statSheet'

// Payload shapes emitted by claude_service.rs (snake_case from serde)
interface SuggestionReceivedPayload {
  rank: number
  from_node_id: string | null
  to_node_id: string
  points_change: number
  explanation: string
}

interface OptimizationCompletePayload {
  suggestion_count: number
}

interface OptimizationErrorPayload {
  error_type: string
  message: string
}

interface ModelActivePayload {
  model_id: string
  model_name: string
}

// AC3: shown verbatim when the optimizer is run with zero unspent passive points (all points spent).
export const EMPTY_BUDGET_MESSAGE =
  'No unspent passive points available. Allocate additional points or use the Complete Build Optimizer for a full reallocation analysis.'

// DN-2 (code review): the <= 0 guard also fires for two states where "allocate additional points"
// is the wrong advice. Keep the verbatim AC3 string for the genuine all-spent zero case; give the
// over-allocated (negative budget) and no-budget-yet (level 1-2) cases their own accurate copy.
export const OVER_BUDGET_MESSAGE =
  'This build is over its passive point budget. Remove allocated points or use the Complete Build Optimizer for a full reallocation analysis.'
export const LOW_LEVEL_BUDGET_MESSAGE =
  'No passive points available at this level. Level up to earn passive points, or use the Complete Build Optimizer for a full reallocation analysis.'

function emptyBudgetMessage(available: number, unspent: number): string {
  if (unspent < 0) return OVER_BUDGET_MESSAGE
  if (available <= 0) return LOW_LEVEL_BUDGET_MESSAGE
  return EMPTY_BUDGET_MESSAGE
}

export async function startOptimization() {
  const buildState = useBuildStore.getState()
  const activeBuild = buildState.activeBuild
  if (!activeBuild) return

  const gameData = useGameDataStore.getState().gameData
  if (!gameData) return

  useOptimizationStore.getState().clearSuggestions()

  // AC3: empty-budget pre-flight guard. With no unspent passive points there is nothing the
  // passive optimizer can suggest — surface the reason (client-known) instead of making a paid
  // Claude call and falling through to the generic "well-optimized" copy.
  const unspent = selectUnspentPassivePoints(buildState)
  if (unspent <= 0) {
    const available = selectAvailablePassivePoints(buildState)
    useOptimizationStore.getState().setOptimizationNotice(emptyBudgetMessage(available, unspent))
    return
  }

  const snapshot = toBuildSnapshot(activeBuild, gameData)

  useOptimizationStore.getState().setIsOptimizing(true)
  useOptimizationStore.getState().setOptimizationBuildId(activeBuild.id)

  try {
    await invokeCommand('run_optimization', { snapshot })
  } catch (err) {
    const appError = normalizeAppError(err)
    useOptimizationStore.getState().setStreamError(appError)
    useOptimizationStore.getState().setIsOptimizing(false)
    useOptimizationStore.getState().setCurrentModel(null)
  }
}

export function useOptimizationStream() {
  const { addSuggestion, clearSuggestions, setIsOptimizing, setStreamError } =
    useOptimizationStore.getState()

  useEffect(() => {
    const unlisteners: UnlistenFn[] = []
    let isMounted = true

    async function registerListeners() {
      const unlisten1 = await listen<SuggestionReceivedPayload>(
        'optimization:suggestion-received',
        (event) => {
          const payload = event.payload
          const activeBuild = useBuildStore.getState().activeBuild
          const gameData = useGameDataStore.getState().gameData

          if (!activeBuild || !gameData) return
          if (useOptimizationStore.getState().optimizationBuildId !== activeBuild.id) return

          const baselineScore = calculateScore(activeBuild, gameData)

          // Apply the suggested change to a clone of allocations to compute preview
          const modifiedAllocations = { ...activeBuild.nodeAllocations }
          const toNode = payload.to_node_id
          const fromNode = payload.from_node_id
          const pts = payload.points_change

          modifiedAllocations[toNode] = (modifiedAllocations[toNode] ?? 0) + pts
          if (fromNode) {
            modifiedAllocations[fromNode] = Math.max(
              0,
              (modifiedAllocations[fromNode] ?? 0) - pts,
            )
          }

          const modifiedBuild = { ...activeBuild, nodeAllocations: modifiedAllocations }
          const previewScore = calculateScore(modifiedBuild, gameData)

          const suggestion: SuggestionResult = {
            rank: payload.rank,
            nodeChange: {
              fromNodeId: fromNode,
              toNodeId: toNode,
              pointsChange: pts,
            },
            explanation: payload.explanation,
            deltaDamage:
              previewScore.damage !== null && baselineScore.damage !== null
                ? previewScore.damage - baselineScore.damage
                : null,
            deltaSurvivability:
              previewScore.survivability !== null && baselineScore.survivability !== null
                ? previewScore.survivability - baselineScore.survivability
                : null,
            deltaSpeed:
              previewScore.speed !== null && baselineScore.speed !== null
                ? previewScore.speed - baselineScore.speed
                : null,
            baselineScore,
            previewScore,
          }

          useOptimizationStore.getState().addSuggestion(suggestion)
        },
      )
      if (!isMounted) { unlisten1(); return }
      unlisteners.push(unlisten1)

      const unlisten2 = await listen<OptimizationCompletePayload>(
        'optimization:complete',
        () => {
          useOptimizationStore.getState().setIsOptimizing(false)
          useOptimizationStore.getState().setHasOptimizationCompleted(true)
          useOptimizationStore.getState().setCurrentModel(null)
        },
      )
      if (!isMounted) { unlisten2(); return }
      unlisteners.push(unlisten2)

      const unlisten3 = await listen<OptimizationErrorPayload>(
        'optimization:error',
        (event) => {
          const { error_type, message } = event.payload
          const appError = normalizeAppError(`${error_type}: ${message}`)
          useOptimizationStore.getState().setStreamError(appError)
          useOptimizationStore.getState().setIsOptimizing(false)
          useOptimizationStore.getState().setCurrentModel(null)
        },
      )
      if (!isMounted) { unlisten3(); return }
      unlisteners.push(unlisten3)

      const unlisten4 = await listen<ModelActivePayload>(
        'optimization:model-active',
        (event) => {
          useOptimizationStore.getState().setCurrentModel(event.payload.model_name)
        },
      )
      if (!isMounted) { unlisten4(); return }
      unlisteners.push(unlisten4)

      const unlisten5 = await listen<string>(
        'optimization:node-efficiencies',
        (event) => {
          const activeBuild = useBuildStore.getState().activeBuild
          if (!activeBuild) return
          if (useOptimizationStore.getState().optimizationBuildId !== activeBuild.id) return
          try {
            const efficiencies = JSON.parse(event.payload) as NodeEfficiency[]
            useOptimizationStore.getState().setNodeEfficiencies(efficiencies)
          } catch {
            // parse failure = no overlay; correct behavior
          }
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
      useOptimizationStore.getState().setIsOptimizing(false)
    }
  }, [addSuggestion, clearSuggestions, setIsOptimizing, setStreamError])
}
