import { create } from 'zustand'
import type { OptimizationGoal, SuggestionResult, BuildScore, FineTuneWeights } from '../types/optimization'
import type { AppError } from '../types/errors'
import type { StatSheet, NodeEfficiency } from '../types/statSheet'

export interface HighlightedNodeIds {
  glowing: Set<string>
  dimmed: Set<string>
}

interface OptimizationStore {
  goal: OptimizationGoal
  suggestions: SuggestionResult[]
  skippedSuggestions: SuggestionResult[]
  appliedRanks: number[]
  previewSuggestionRank: number | null
  highlightedNodeIds: HighlightedNodeIds | null
  isOptimizing: boolean
  hasOptimizationCompleted: boolean
  scores: BuildScore | null
  // Rust scoring engine fields (Story 2.2+ populates)
  statSheet: StatSheet | null
  isComputingStats: boolean
  nodeEfficiencies: NodeEfficiency[] | null
  setStatSheet: (sheet: StatSheet | null) => void
  setIsComputingStats: (computing: boolean) => void
  setNodeEfficiencies: (efficiencies: NodeEfficiency[] | null) => void
  streamError: AppError | null
  currentModel: string | null
  optimizationBuildId: string | null
  setGoal: (goal: OptimizationGoal) => void
  setSuggestions: (suggestions: SuggestionResult[]) => void
  addSuggestion: (suggestion: SuggestionResult) => void
  clearSuggestions: () => void
  setIsOptimizing: (optimizing: boolean) => void
  setOptimizationBuildId: (id: string | null) => void
  setHasOptimizationCompleted: (value: boolean) => void
  setScores: (scores: BuildScore | null) => void
  setStreamError: (error: AppError | null) => void
  skipSuggestion: (rank: number) => void
  setAppliedRank: (rank: number) => void
  setPreviewSuggestionRank: (rank: number | null) => void
  setHighlightedNodeIds: (nodes: HighlightedNodeIds | null) => void
  setCurrentModel: (model: string | null) => void
  sliderPosition: number
  fineTuneWeights: FineTuneWeights | null
  setSliderPosition: (pos: number) => void
  setFineTuneWeights: (weights: FineTuneWeights | null) => void
}

export const useOptimizationStore = create<OptimizationStore>()((set) => ({
  goal: 'balanced',
  suggestions: [],
  skippedSuggestions: [],
  appliedRanks: [],
  previewSuggestionRank: null,
  highlightedNodeIds: null,
  isOptimizing: false,
  hasOptimizationCompleted: false,
  scores: null,
  statSheet: null,
  isComputingStats: false,
  nodeEfficiencies: null,
  setStatSheet: (sheet) => set({ statSheet: sheet }),
  setIsComputingStats: (computing) => set({ isComputingStats: computing }),
  setNodeEfficiencies: (efficiencies) => set({ nodeEfficiencies: efficiencies }),
  streamError: null,
  currentModel: null,
  optimizationBuildId: null,
  setGoal: (goal) => set({ goal }),
  setSuggestions: (suggestions) => set({ suggestions }),
  addSuggestion: (suggestion) =>
    set((s) => ({ suggestions: [...s.suggestions, suggestion] })),
  clearSuggestions: () =>
    set({
      suggestions: [],
      skippedSuggestions: [],
      appliedRanks: [],
      previewSuggestionRank: null,
      highlightedNodeIds: null,
      streamError: null,
      hasOptimizationCompleted: false,
      currentModel: null,
      isOptimizing: false,
      optimizationBuildId: null,
      statSheet: null,
      isComputingStats: false,
      nodeEfficiencies: null,
    }),
  setIsOptimizing: (optimizing) => set({ isOptimizing: optimizing }),
  setOptimizationBuildId: (id) => set({ optimizationBuildId: id }),
  setHasOptimizationCompleted: (value) => set({ hasOptimizationCompleted: value }),
  setScores: (scores) => set({ scores }),
  setStreamError: (error) => set({ streamError: error }),
  skipSuggestion: (rank) =>
    set((s) => {
      const suggestion = s.suggestions.find((sg) => sg.rank === rank)
      if (!suggestion) return {}
      return {
        suggestions: s.suggestions.filter((sg) => sg.rank !== rank),
        skippedSuggestions: [...s.skippedSuggestions, suggestion],
      }
    }),
  setAppliedRank: (rank) =>
    set((s) => ({ appliedRanks: [...s.appliedRanks, rank] })),
  setPreviewSuggestionRank: (rank) => set({ previewSuggestionRank: rank }),
  setHighlightedNodeIds: (nodes) => set({ highlightedNodeIds: nodes }),
  setCurrentModel: (model) => set({ currentModel: model }),
  sliderPosition: 50,
  fineTuneWeights: null,
  setSliderPosition: (pos) =>
    set(() => ({ sliderPosition: Math.max(0, Math.min(100, pos)) })),
  setFineTuneWeights: (weights) => set({ fineTuneWeights: weights }),
}))
