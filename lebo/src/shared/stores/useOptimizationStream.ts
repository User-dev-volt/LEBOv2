import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { calculateScore } from '../../features/optimization/scoringEngine'
import { invokeCommand } from '../utils/invokeCommand'
import { normalizeAppError } from '../utils/errorNormalizer'
import { calculatePassivePoints } from '../utils/budgetCalculator'
import { useBuildStore } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import type { SuggestionResult, LevelContext, StructuredGearAffix, StructuredGearSlot } from '../types/optimization'

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

export async function startOptimization() {
  const activeBuild = useBuildStore.getState().activeBuild
  const { sliderPosition, fineTuneWeights } = useOptimizationStore.getState()
  if (!activeBuild) return

  let levelContext: LevelContext | null = null
  if (activeBuild.budgetEnforced) {
    const availablePassivePoints = calculatePassivePoints(activeBuild.characterLevel)
    const allocatedPassivePoints = Object.values(activeBuild.nodeAllocations ?? {}).reduce((sum, v) => sum + v, 0)
    levelContext = {
      characterLevel: activeBuild.characterLevel,
      availablePassivePoints,
      allocatedPassivePoints,
      unspentPassivePoints: availablePassivePoints - allocatedPassivePoints,
      activeSkillLevels: { ...(activeBuild.activeSkillLevels ?? {}) },
    }
  }

  const itemDatabase = useGameDataStore.getState().itemDatabase
  const gearItems = activeBuild.contextData?.gear ?? []
  const populatedGear = gearItems.filter((g) => g.itemName !== '')
  const structuredGear: StructuredGearSlot[] | null = populatedGear.length > 0
    ? populatedGear.map((g): StructuredGearSlot => {
        const dbAffixes = g.affixes.filter((a) => a.affixId !== undefined && a.tier !== undefined)
        if (dbAffixes.length === 0) {
          return { slot: g.slotId, itemName: g.itemName, affixes: [] }
        }
        const affixes: StructuredGearAffix[] = dbAffixes.map((a) => {
          const entry = itemDatabase.affixes.find((e) => e.id === a.affixId)
          const tierEntry = entry?.tiers.find((t) => t.tier === a.tier)
          const value = tierEntry
            ? Math.round((tierEntry.minValue + tierEntry.maxValue) / 2)
            : undefined
          return { name: a.name, tier: a.tier, value }
        })
        return { slot: g.slotId, itemName: g.itemName, affixes }
      })
    : null

  useOptimizationStore.getState().clearSuggestions()
  useOptimizationStore.getState().setIsOptimizing(true)
  useOptimizationStore.getState().setOptimizationBuildId(activeBuild.id)

  try {
    await invokeCommand('invoke_claude_api', {
      buildState: activeBuild,
      sliderPosition,
      fineTuneWeights,
      levelContext,
      structuredGear,
    })
  } catch (err) {
    const appError = normalizeAppError(err)
    useOptimizationStore.getState().setStreamError(appError)
    useOptimizationStore.getState().setIsOptimizing(false)
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
