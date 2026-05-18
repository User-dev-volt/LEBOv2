import { describe, it, expect, beforeEach } from 'vitest'
import { useOptimizationStore } from './optimizationStore'
import type { SuggestionResult, BuildScore } from '../types/optimization'
import type { AppError } from '../types/errors'

const initialState = useOptimizationStore.getState()

const baseScore: BuildScore = { damage: 100, survivability: 80, speed: 60 }

const mockSuggestion: SuggestionResult = {
  rank: 1,
  nodeChange: { fromNodeId: null, toNodeId: 'node-abc', pointsChange: 1 },
  explanation: 'Allocate node-abc for +10% damage',
  deltaDamage: 10,
  deltaSurvivability: null,
  deltaSpeed: null,
  baselineScore: baseScore,
  previewScore: { damage: 110, survivability: 80, speed: 60 },
}

describe('optimizationStore', () => {
  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
  })

  it('starts with balanced goal and empty suggestions', () => {
    const s = useOptimizationStore.getState()
    expect(s.goal).toBe('balanced')
    expect(s.suggestions).toHaveLength(0)
    expect(s.isOptimizing).toBe(false)
    expect(s.scores).toBeNull()
  })

  it('setGoal changes optimization goal', () => {
    useOptimizationStore.getState().setGoal('maximize_damage')
    expect(useOptimizationStore.getState().goal).toBe('maximize_damage')
  })

  it('setGoal accepts all valid goals', () => {
    const goals = ['maximize_damage', 'maximize_survivability', 'maximize_speed', 'balanced'] as const
    for (const goal of goals) {
      useOptimizationStore.getState().setGoal(goal)
      expect(useOptimizationStore.getState().goal).toBe(goal)
    }
  })

  it('setSuggestions replaces the list', () => {
    useOptimizationStore.getState().setSuggestions([mockSuggestion])
    expect(useOptimizationStore.getState().suggestions).toHaveLength(1)
    expect(useOptimizationStore.getState().suggestions[0].rank).toBe(1)
  })

  it('addSuggestion appends without replacing', () => {
    useOptimizationStore.getState().addSuggestion(mockSuggestion)
    useOptimizationStore.getState().addSuggestion({ ...mockSuggestion, rank: 2 })
    expect(useOptimizationStore.getState().suggestions).toHaveLength(2)
    expect(useOptimizationStore.getState().suggestions[1].rank).toBe(2)
  })

  it('clearSuggestions empties the list', () => {
    useOptimizationStore.getState().setSuggestions([mockSuggestion])
    useOptimizationStore.getState().clearSuggestions()
    expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
  })

  it('setIsOptimizing toggles flag', () => {
    useOptimizationStore.getState().setIsOptimizing(true)
    expect(useOptimizationStore.getState().isOptimizing).toBe(true)
    useOptimizationStore.getState().setIsOptimizing(false)
    expect(useOptimizationStore.getState().isOptimizing).toBe(false)
  })

  it('setScores stores a BuildScore', () => {
    useOptimizationStore.getState().setScores(baseScore)
    expect(useOptimizationStore.getState().scores).toEqual(baseScore)
  })

  it('setScores accepts null to clear scores', () => {
    useOptimizationStore.getState().setScores(baseScore)
    useOptimizationStore.getState().setScores(null)
    expect(useOptimizationStore.getState().scores).toBeNull()
  })

  it('starts with null streamError', () => {
    expect(useOptimizationStore.getState().streamError).toBeNull()
  })

  it('setStreamError stores an AppError', () => {
    const err: AppError = { type: 'API_ERROR', message: 'rate limit', detail: 'API_ERROR: rate limit' }
    useOptimizationStore.getState().setStreamError(err)
    expect(useOptimizationStore.getState().streamError).toEqual(err)
  })

  it('setStreamError accepts null to clear', () => {
    const err: AppError = { type: 'TIMEOUT', message: 'timed out' }
    useOptimizationStore.getState().setStreamError(err)
    useOptimizationStore.getState().setStreamError(null)
    expect(useOptimizationStore.getState().streamError).toBeNull()
  })

  it('clearSuggestions also clears streamError', () => {
    const err: AppError = { type: 'NETWORK_ERROR', message: 'connection failed' }
    useOptimizationStore.getState().setStreamError(err)
    useOptimizationStore.getState().setSuggestions([mockSuggestion])
    useOptimizationStore.getState().clearSuggestions()
    expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
    expect(useOptimizationStore.getState().streamError).toBeNull()
  })

  // Story 3.5: skip / apply / preview / highlight

  it('skipSuggestion moves suggestion from suggestions to skippedSuggestions', () => {
    useOptimizationStore.getState().setSuggestions([mockSuggestion, { ...mockSuggestion, rank: 2 }])
    useOptimizationStore.getState().skipSuggestion(1)
    const s = useOptimizationStore.getState()
    expect(s.suggestions).toHaveLength(1)
    expect(s.suggestions[0].rank).toBe(2)
    expect(s.skippedSuggestions).toHaveLength(1)
    expect(s.skippedSuggestions[0].rank).toBe(1)
  })

  it('skipSuggestion with unknown rank does nothing', () => {
    useOptimizationStore.getState().setSuggestions([mockSuggestion])
    useOptimizationStore.getState().skipSuggestion(99)
    expect(useOptimizationStore.getState().suggestions).toHaveLength(1)
    expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(0)
  })

  it('setAppliedRank appends rank to appliedRanks', () => {
    useOptimizationStore.getState().setAppliedRank(1)
    useOptimizationStore.getState().setAppliedRank(2)
    expect(useOptimizationStore.getState().appliedRanks).toEqual([1, 2])
  })

  it('setPreviewSuggestionRank sets preview rank', () => {
    useOptimizationStore.getState().setPreviewSuggestionRank(3)
    expect(useOptimizationStore.getState().previewSuggestionRank).toBe(3)
  })

  it('setPreviewSuggestionRank accepts null to clear', () => {
    useOptimizationStore.getState().setPreviewSuggestionRank(1)
    useOptimizationStore.getState().setPreviewSuggestionRank(null)
    expect(useOptimizationStore.getState().previewSuggestionRank).toBeNull()
  })

  it('setHighlightedNodeIds stores node sets', () => {
    const nodes = { glowing: new Set(['node-a']), dimmed: new Set(['node-b']) }
    useOptimizationStore.getState().setHighlightedNodeIds(nodes)
    expect(useOptimizationStore.getState().highlightedNodeIds).toEqual(nodes)
  })

  it('setHighlightedNodeIds accepts null to clear', () => {
    useOptimizationStore.getState().setHighlightedNodeIds({ glowing: new Set(), dimmed: new Set() })
    useOptimizationStore.getState().setHighlightedNodeIds(null)
    expect(useOptimizationStore.getState().highlightedNodeIds).toBeNull()
  })

  it('clearSuggestions resets all 3.5 state', () => {
    useOptimizationStore.getState().setSuggestions([mockSuggestion])
    useOptimizationStore.getState().skipSuggestion(1)
    useOptimizationStore.getState().setAppliedRank(2)
    useOptimizationStore.getState().setPreviewSuggestionRank(3)
    useOptimizationStore.getState().setHighlightedNodeIds({ glowing: new Set(['x']), dimmed: new Set() })
    useOptimizationStore.getState().clearSuggestions()
    const s = useOptimizationStore.getState()
    expect(s.suggestions).toHaveLength(0)
    expect(s.skippedSuggestions).toHaveLength(0)
    expect(s.appliedRanks).toHaveLength(0)
    expect(s.previewSuggestionRank).toBeNull()
    expect(s.highlightedNodeIds).toBeNull()
  })

  // Story 3.6: hasOptimizationCompleted

  it('hasOptimizationCompleted starts as false', () => {
    expect(useOptimizationStore.getState().hasOptimizationCompleted).toBe(false)
  })

  it('setHasOptimizationCompleted(true) sets the flag', () => {
    useOptimizationStore.getState().setHasOptimizationCompleted(true)
    expect(useOptimizationStore.getState().hasOptimizationCompleted).toBe(true)
  })

  it('clearSuggestions resets hasOptimizationCompleted to false', () => {
    useOptimizationStore.getState().setHasOptimizationCompleted(true)
    useOptimizationStore.getState().clearSuggestions()
    expect(useOptimizationStore.getState().hasOptimizationCompleted).toBe(false)
  })
})
