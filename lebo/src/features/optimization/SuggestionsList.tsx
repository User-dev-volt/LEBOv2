import { useState, useEffect, useRef, useCallback } from 'react'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useAppStore } from '../../shared/stores/appStore'
import { isRetryable } from '../../shared/types/errors'
import type { GameData } from '../../shared/types/gameData'
import { buildTreeData } from '../skill-tree/treeDataTransformer'
import type { SuggestionResult } from '../../shared/types/optimization'
import { SuggestionCard } from './SuggestionCard'
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { toBuildSnapshot } from '../../shared/utils/buildSnapshotSerializer'
import type { StatSheet } from '../../shared/types/statSheet'

function getNodeName(
  nodeId: string,
  gameData: GameData | null,
  classId: string,
  masteryId: string
): string {
  if (!gameData) return nodeId
  const classData = gameData.classes[classId]
  if (!classData) return nodeId
  return (
    classData.masteries[masteryId]?.nodes[nodeId]?.name ??
    classData.baseTree[nodeId]?.name ??
    nodeId
  )
}

/** Synthetic node IDs are used for informational suggestions (warnings, unique/synergy context).
 *  They are not real passive tree nodes and cannot be applied to the tree. */
function isSyntheticNodeId(id: string): boolean {
  return id.startsWith('warning:') || id.startsWith('unique:') || id.startsWith('synergy:')
}

/** Derive the informational variant from the synthetic node ID prefix. */
function getSyntheticVariant(id: string): 'warning' | 'unique' | 'synergy' {
  if (id.startsWith('warning:')) return 'warning'
  if (id.startsWith('unique:')) return 'unique'
  return 'synergy'
}

/** Convert a synthetic node ID like "warning:fire_resistance_uncapped" into a readable label. */
function formatSyntheticLabel(id: string): string {
  const parts = id.split(':')
  const body = parts.slice(1).join(' ').replace(/_/g, ' ')
  return body.charAt(0).toUpperCase() + body.slice(1)
}


const GOAL_LABELS: Record<string, string> = {
  maximize_damage: 'Maximize Damage',
  maximize_survivability: 'Maximize Survivability',
  maximize_speed: 'Maximize Speed',
  balanced: 'Balanced',
}

function mapApplyError(err: string | undefined): string {
  if (!err) return 'Cannot apply: unknown error'
  if (err.includes('Prerequisite') || err.includes('prerequisite')) {
    return 'Cannot apply: prerequisite node not allocated'
  }
  if (err.includes('depend')) {
    return `Cannot apply: ${err}`
  }
  return `Cannot apply: ${err}`
}

interface SuggestionsListProps {
  onRetry: () => void
}

export function SuggestionsList({ onRetry }: SuggestionsListProps) {
  const suggestions = useOptimizationStore((s) => s.suggestions)
  const skippedSuggestions = useOptimizationStore((s) => s.skippedSuggestions)
  const appliedRanks = useOptimizationStore((s) => s.appliedRanks)
  const previewSuggestionRank = useOptimizationStore((s) => s.previewSuggestionRank)
  const isOptimizing = useOptimizationStore((s) => s.isOptimizing)
  const hasOptimizationCompleted = useOptimizationStore((s) => s.hasOptimizationCompleted)
  const goal = useOptimizationStore((s) => s.goal)
  const streamError = useOptimizationStore((s) => s.streamError)
  const setStreamError = useOptimizationStore((s) => s.setStreamError)
  const skipSuggestion = useOptimizationStore((s) => s.skipSuggestion)
  const setAppliedRank = useOptimizationStore((s) => s.setAppliedRank)
  const setPreviewSuggestionRank = useOptimizationStore((s) => s.setPreviewSuggestionRank)
  const setHighlightedNodeIds = useOptimizationStore((s) => s.setHighlightedNodeIds)
  const clearSuggestions = useOptimizationStore((s) => s.clearSuggestions)
  const setPreviewStatSheet = useOptimizationStore((s) => s.setPreviewStatSheet)
  const isComputingStats = useOptimizationStore((s) => s.isComputingStats)

  const activeBuild = useBuildStore((s) => s.activeBuild)
  const applyNodeChange = useBuildStore((s) => s.applyNodeChange)
  const gameData = useGameDataStore((s) => s.gameData)

  const [applyErrors, setApplyErrors] = useState<Record<number, string>>({})
  const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null)
  const [expandedRank, setExpandedRank] = useState<number | null>(null)
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const previewAbortRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  const classId = activeBuild?.classId ?? ''
  const masteryId = activeBuild?.masteryId ?? ''

  const count = suggestions.length
  const countLabel = count === 1 ? '1 suggestion found' : `${count} suggestions found`

  // Reset keyboard focus when the suggestions array is replaced (e.g. after a re-run)
  const prevSuggestionsRef = useRef(suggestions)
  useEffect(() => {
    if (prevSuggestionsRef.current !== suggestions) {
      prevSuggestionsRef.current = suggestions
      setFocusedCardIndex(null)
      setExpandedRank(null)
    }
  }, [suggestions])

  // Focus card element when focusedCardIndex changes
  useEffect(() => {
    if (focusedCardIndex === null) return
    const suggestion = suggestions[focusedCardIndex]
    if (!suggestion) return
    const el = cardRefs.current.get(suggestion.rank)
    el?.focus()
  }, [focusedCardIndex, suggestions])

  // Listen for global keyboard:escape event from App.tsx
  useEffect(() => {
    function handleEscape() {
      setFocusedCardIndex(null)
      setExpandedRank(null)
    }
    window.addEventListener('keyboard:escape', handleEscape)
    return () => window.removeEventListener('keyboard:escape', handleEscape)
  }, [])

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (suggestions.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedCardIndex((prev) => {
          if (prev === null) return 0
          return Math.min(prev + 1, suggestions.length - 1)
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedCardIndex((prev) => {
          if (prev === null) return 0
          return Math.max(prev - 1, 0)
        })
        return
      }

      if (focusedCardIndex === null) return
      const focused = suggestions[focusedCardIndex]
      if (!focused) return

      if (e.key === 'Enter') {
        e.preventDefault()
        if (expandedRank === focused.rank) {
          // Already expanded — second Enter applies
          handleApply(focused)
        } else {
          setExpandedRank(focused.rank)
        }
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setPreviewSuggestionRank(
          previewSuggestionRank === focused.rank ? null : focused.rank
        )
        return
      }

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        skipSuggestion(focused.rank)
        setFocusedCardIndex(null)
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setFocusedCardIndex(null)
        setExpandedRank(null)
        setPreviewSuggestionRank(null)
        return
      }
    },
    [suggestions, focusedCardIndex, expandedRank, previewSuggestionRank, setPreviewSuggestionRank, skipSuggestion]
  )

  async function handleHoverEnter(suggestion: SuggestionResult) {
    // Synthetic IDs are informational context — no tree node to highlight or preview
    if (isSyntheticNodeId(suggestion.nodeChange.toNodeId)) return

    setHighlightedNodeIds({
      glowing: new Set([suggestion.nodeChange.toNodeId]),
      dimmed: suggestion.nodeChange.fromNodeId
        ? new Set([suggestion.nodeChange.fromNodeId])
        : new Set(),
    })

    if (isComputingStats) return

    const activeBuild = useBuildStore.getState().activeBuild
    const gameData = useGameDataStore.getState().gameData
    if (!activeBuild || !gameData) return

    const { toNodeId, fromNodeId, pointsChange } = suggestion.nodeChange
    const modifiedAllocations = { ...activeBuild.nodeAllocations }
    modifiedAllocations[toNodeId] = Math.max(0, (modifiedAllocations[toNodeId] ?? 0) + pointsChange)
    if (fromNodeId) {
      modifiedAllocations[fromNodeId] = Math.max(
        0,
        (modifiedAllocations[fromNodeId] ?? 0) - pointsChange,
      )
    }

    const snapshot = toBuildSnapshot({ ...activeBuild, nodeAllocations: modifiedAllocations }, gameData)
    const guard = { cancelled: false }
    previewAbortRef.current = guard

    try {
      const previewSheet = await invokeCommand<StatSheet>('compute_stats', { snapshot })
      if (!guard.cancelled) {
        setPreviewStatSheet(previewSheet)
      }
    } catch {
      // IPC failure = no delta shown; correct behavior
    }
  }

  function handleHoverLeave() {
    setHighlightedNodeIds(null)
    previewAbortRef.current.cancelled = true
    setPreviewStatSheet(null)
  }

  function handlePreview(rank: number) {
    setPreviewSuggestionRank(rank === previewSuggestionRank ? null : rank)
  }

  function handleApply(suggestion: SuggestionResult) {
    const { nodeChange, rank } = suggestion

    // Synthetic IDs are informational context — they do not represent passive tree nodes
    if (isSyntheticNodeId(nodeChange.toNodeId)) {
      setApplyErrors((prev) => ({ ...prev, [rank]: 'This is an informational suggestion — no passive tree change to apply.' }))
      return
    }

    const currentBuild = useBuildStore.getState().activeBuild
    if (!currentBuild) return

    const classData = gameData?.classes[currentBuild.classId]
    if (!classData) {
      setApplyErrors((prev) => ({ ...prev, [suggestion.rank]: 'Cannot apply: class data not available' }))
      return
    }

    const treeData = buildTreeData(classData, currentBuild.masteryId, currentBuild.nodeAllocations)

    let fromRemovedPoints: number | null = null

    if (nodeChange.fromNodeId) {
      const currentFromPoints = currentBuild.nodeAllocations[nodeChange.fromNodeId] ?? 0
      if (currentFromPoints > 0) {
        const removeResult = applyNodeChange(nodeChange.fromNodeId, -currentFromPoints, treeData)
        if (!removeResult.success) {
          setApplyErrors((prev) => ({ ...prev, [rank]: mapApplyError(removeResult.error ?? 'source node not found in tree') }))
          return
        }
        fromRemovedPoints = currentFromPoints
      }
    }

    const result = applyNodeChange(nodeChange.toNodeId, nodeChange.pointsChange, treeData)
    if (!result.success) {
      if (nodeChange.fromNodeId && fromRemovedPoints !== null) {
        applyNodeChange(nodeChange.fromNodeId, fromRemovedPoints, treeData)
      }
      setApplyErrors((prev) => ({ ...prev, [rank]: mapApplyError(result.error ?? 'target node not found in tree') }))
      return
    }

    setAppliedRank(rank)
    if (previewSuggestionRank === rank) {
      setPreviewSuggestionRank(null)
    }
    setApplyErrors((prev) => {
      const next = { ...prev }
      delete next[rank]
      return next
    })
  }

  function applyPreview() {
    const previewSuggestion = suggestions.find((s) => s.rank === previewSuggestionRank)
    if (previewSuggestion) {
      handleApply(previewSuggestion)
    }
  }

  function renderCard(suggestion: SuggestionResult, allowInteraction: boolean, index?: number) {
    const isFocused = index !== undefined && focusedCardIndex === index
    const syntheticTo = isSyntheticNodeId(suggestion.nodeChange.toNodeId)
    const toNodeName = syntheticTo
      ? formatSyntheticLabel(suggestion.nodeChange.toNodeId)
      : getNodeName(suggestion.nodeChange.toNodeId, gameData, classId, masteryId)
    const fromNodeName = suggestion.nodeChange.fromNodeId
      ? getNodeName(suggestion.nodeChange.fromNodeId, gameData, classId, masteryId)
      : undefined
    return (
      <SuggestionCard
        key={`${suggestion.rank}-${suggestion.nodeChange.toNodeId}`}
        ref={(el) => {
          if (el) cardRefs.current.set(suggestion.rank, el)
          else cardRefs.current.delete(suggestion.rank)
        }}
        suggestion={suggestion}
        toNodeName={toNodeName}
        fromNodeName={fromNodeName}
        isInformational={syntheticTo}
        informationalVariant={syntheticTo ? getSyntheticVariant(suggestion.nodeChange.toNodeId) : undefined}
        isApplied={appliedRanks.includes(suggestion.rank)}
        applyError={applyErrors[suggestion.rank] ?? null}
        isPreviewActive={previewSuggestionRank === suggestion.rank}
        isFocused={isFocused}
        isExpanded={expandedRank === suggestion.rank}
        onApply={() => handleApply(suggestion)}
        onSkip={() => { if (allowInteraction) skipSuggestion(suggestion.rank) }}
        onPreview={() => { if (allowInteraction) handlePreview(suggestion.rank) }}
        onHoverEnter={() => handleHoverEnter(suggestion)}
        onHoverLeave={handleHoverLeave}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2" data-testid="suggestions-list">
      {previewSuggestionRank !== null && (
        <div
          className="flex items-center justify-between gap-2 px-3 py-2 rounded text-xs"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            borderLeft: '2px solid var(--color-accent-gold)',
          }}
          data-testid="preview-banner"
        >
          <span style={{ color: 'var(--color-text-primary)' }}>
            Previewing suggestion #{previewSuggestionRank}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={applyPreview}
              data-testid="preview-apply-btn"
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: 'var(--color-data-positive)',
                border: '1px solid var(--color-data-positive)',
              }}
            >
              Apply
            </button>
            <button
              onClick={() => setPreviewSuggestionRank(null)}
              data-testid="preview-cancel-btn"
              className="text-xs px-2 py-0.5 rounded"
              style={{
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-bg-hover)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {streamError && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded text-xs"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-data-negative)',
            borderLeft: '2px solid var(--color-data-negative)',
          }}
          data-testid="stream-error-banner"
        >
          <span className="flex-1 flex flex-col gap-1">
            <span>{streamError.message}</span>
            {streamError.detail && streamError.detail !== streamError.message && (
              <span
                className="text-xs opacity-60 break-all"
                style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                {String(streamError.detail)}
              </span>
            )}
          </span>
          {streamError.type === 'AUTH_ERROR' && (
            <button
              onClick={() => useAppStore.getState().setCurrentView('settings')}
              data-testid="auth-error-settings-link"
              className="text-xs shrink-0 underline"
              style={{ color: 'var(--color-accent-gold)' }}
            >
              Go to Settings
            </button>
          )}
          {isRetryable(streamError.type) && (
            <button
              onClick={onRetry}
              data-testid="retry-optimization-button"
              className="text-xs shrink-0 underline"
              style={{ color: 'var(--color-accent-gold)' }}
            >
              Retry
            </button>
          )}
          <button
            onClick={() => setStreamError(null)}
            aria-label="Dismiss error"
            className="shrink-0 leading-none"
            style={{ color: 'var(--color-text-muted)' }}
          >
            ×
          </button>
        </div>
      )}

      {isOptimizing && suggestions.length === 0 && !streamError && (
        <div className="flex flex-col gap-2" data-testid="suggestion-skeletons">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded px-3 py-2 animate-pulse"
              style={{ backgroundColor: 'var(--color-bg-elevated)', height: '64px' }}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <p
          className="text-xs font-semibold"
          style={{ color: 'var(--color-text-muted)' }}
          data-testid="suggestions-count"
        >
          {countLabel}
        </p>
      )}

      {suggestions.length > 0 && !isOptimizing && (
        <button
          onClick={clearSuggestions}
          data-testid="clear-suggestions-button"
          className="text-xs self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: 'var(--color-text-muted)', textDecoration: 'underline', outlineColor: 'var(--color-accent-gold)' }}
        >
          Clear suggestions
        </button>
      )}

      {suggestions.length > 0 && (
        <div
          role="list"
          aria-label="Optimization suggestions"
          onKeyDown={handleListKeyDown}
          className="flex flex-col gap-2"
        >
          {suggestions.map((suggestion, idx) => renderCard(suggestion, true, idx))}
        </div>
      )}

      {suggestions.length === 0 && !isOptimizing && !streamError && (
        hasOptimizationCompleted ? (
          <p
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            data-testid="suggestions-well-optimized"
          >
            {`Your build is well-optimized for ${GOAL_LABELS[goal] ?? goal}. Try a different goal or keep building!`}
          </p>
        ) : (
          <p
            className="text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            data-testid="suggestions-empty-state"
          >
            Select an optimization goal and click Optimize to get AI-powered suggestions.
          </p>
        )
      )}

      {skippedSuggestions.length > 0 && (
        <details data-testid="skipped-section">
          <summary
            className="text-xs cursor-pointer"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Skipped ({skippedSuggestions.length})
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            {skippedSuggestions.map((suggestion) => renderCard(suggestion, false))}
          </div>
        </details>
      )}
    </div>
  )
}
