import { forwardRef, useState } from 'react'
import type { SuggestionResult, NodeChange } from '../../shared/types/optimization'

interface DeltaPillProps {
  label: string
  value: number | null
  axisColor: string
  testId: string
}

function formatDelta(v: number | null): string {
  if (v === null) return '?'
  if (v === 0) return '±0'
  return v > 0 ? `+${v}` : String(v)
}

function getDeltaIndicator(v: number | null): string {
  if (v === null || v === 0) return '◈'
  return v > 0 ? '▲' : '▼'
}

function getDeltaColor(v: number | null): string {
  if (v === null || v === 0) return 'var(--color-data-neutral)'
  return v > 0 ? 'var(--color-data-positive)' : 'var(--color-data-negative)'
}

function DeltaPill({ label, value, axisColor, testId }: DeltaPillProps) {
  return (
    <span
      data-testid={testId}
      style={{ color: getDeltaColor(value), fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
    >
      {getDeltaIndicator(value)}{' '}
      <span style={{ color: axisColor }}>{label}</span>{' '}
      {formatDelta(value)}
    </span>
  )
}

function getChangeType(nodeChange: NodeChange): 'ADD' | 'REMOVE' | 'SWAP' {
  if (nodeChange.fromNodeId !== null) return 'SWAP'
  return nodeChange.pointsChange > 0 ? 'ADD' : 'REMOVE'
}

function getChangeDescription(changeType: 'ADD' | 'REMOVE' | 'SWAP', pointsChange: number): string {
  if (changeType === 'ADD') return `Allocate ${pointsChange} pt`
  if (changeType === 'REMOVE') return `Deallocate ${Math.abs(pointsChange)} pt`
  return 'Swap'
}

function getTypeBadgeColor(changeType: 'ADD' | 'REMOVE' | 'SWAP'): string {
  if (changeType === 'ADD') return 'var(--color-data-positive)'
  if (changeType === 'REMOVE') return 'var(--color-data-negative)'
  return 'var(--color-accent-gold)'
}

interface SuggestionCardProps {
  suggestion: SuggestionResult
  toNodeName: string
  fromNodeName?: string
  /** True when the suggestion's node ID is synthetic (warning/unique/synergy context).
   *  No passive tree change can be applied; Apply/Preview buttons are hidden. */
  isInformational?: boolean
  /** Sub-type for informational badge styling */
  informationalVariant?: 'warning' | 'unique' | 'synergy'
  isApplied?: boolean
  applyError?: string | null
  isPreviewActive?: boolean
  isFocused?: boolean
  isExpanded?: boolean
  onApply: () => void
  onSkip: () => void
  onPreview: () => void
  onHoverEnter: () => void
  onHoverLeave: () => void
}

export const SuggestionCard = forwardRef<HTMLDivElement, SuggestionCardProps>(
  function SuggestionCard(
    {
      suggestion,
      toNodeName,
      isInformational = false,
      informationalVariant = 'warning',
      isApplied = false,
      applyError,
      isPreviewActive = false,
      isFocused = false,
      isExpanded = false,
      onApply,
      onSkip,
      onPreview,
      onHoverEnter,
      onHoverLeave,
    },
    ref
  ) {
    const [isHovered, setIsHovered] = useState(false)

    const changeType = getChangeType(suggestion.nodeChange)
    const changeDescription = getChangeDescription(changeType, suggestion.nodeChange.pointsChange)
    const typeBadgeColor = getTypeBadgeColor(changeType)

    const showExplanation = (isExpanded || isHovered) && !!suggestion.explanation

    function formatScore(v: number | null): string {
      return v === null ? '—' : String(v)
    }
    const ariaLabel = [
      `[Rank ${suggestion.rank}]`,
      isInformational
        ? `Context: ${toNodeName}.`
        : `${changeType} ${toNodeName} — ${changeDescription}.`,
      !isInformational && `Damage: ${formatScore(suggestion.baselineScore.damage)} → ${formatScore(suggestion.previewScore.damage)}.`,
      !isInformational && `Survivability: ${formatScore(suggestion.baselineScore.survivability)} → ${formatScore(suggestion.previewScore.survivability)}.`,
      !isInformational && `Speed: ${formatScore(suggestion.baselineScore.speed)} → ${formatScore(suggestion.previewScore.speed)}.`,
      suggestion.explanation,
    ].filter(Boolean).join(' ')

    const informationalIcon = informationalVariant === 'warning' ? '⚠' : informationalVariant === 'unique' ? '✦' : '◎'
    const informationalIconColor =
      informationalVariant === 'warning'
        ? 'var(--color-data-negative)'
        : informationalVariant === 'unique'
          ? 'var(--color-accent-gold)'
          : 'var(--color-text-secondary)'

    function handleMouseEnter() {
      setIsHovered(true)
      onHoverEnter()
    }

    function handleMouseLeave() {
      setIsHovered(false)
      onHoverLeave()
    }

    return (
      <div
        ref={ref}
        role="article"
        aria-label={ariaLabel}
        tabIndex={-1}
        className="rounded px-3 py-2"
        style={{
          backgroundColor: 'var(--color-bg-elevated)',
          opacity: isApplied ? 0.5 : 1,
          borderLeft: isPreviewActive
            ? '2px solid var(--color-accent-gold)'
            : isFocused
              ? '2px solid var(--color-text-secondary)'
              : undefined,
          outline: isFocused ? '1px solid var(--color-text-secondary)' : undefined,
        }}
        data-testid={`suggestion-card-${suggestion.rank}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Informational card layout ── */}
        {isInformational && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="text-xs font-semibold shrink-0"
                  style={{ color: informationalIconColor }}
                  aria-hidden="true"
                >
                  {informationalIcon}
                </span>
                <span
                  data-testid="suggestion-node-name"
                  className="text-xs font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {toNodeName}
                </span>
              </div>
              <span
                className="text-xs shrink-0"
                style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-mono)' }}
              >
                {suggestion.rank}
              </span>
            </div>

            {suggestion.explanation && (
              <p
                className="text-xs mt-1.5 leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
                data-testid="suggestion-explanation"
              >
                {suggestion.explanation}
              </p>
            )}

            {applyError && (
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--color-data-negative)' }}
                data-testid="suggestion-apply-error"
              >
                {applyError}
              </p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span
                data-testid="suggestion-informational-badge"
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-bg-hover)',
                }}
              >
                Context only
              </span>
              <button
                onClick={onSkip}
                data-testid="suggestion-skip-btn"
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-bg-hover)',
                }}
              >
                Dismiss
              </button>
            </div>
          </>
        )}

        {/* ── Actionable (tree-change) card layout ── */}
        {!isInformational && (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  data-testid="suggestion-type-badge"
                  className="text-xs font-semibold shrink-0"
                  style={{ color: typeBadgeColor }}
                >
                  {changeType}
                </span>
                <span
                  data-testid="suggestion-node-name"
                  className="text-xs truncate"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {toNodeName}
                </span>
                <span
                  className="text-xs shrink-0"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {changeDescription}
                </span>
              </div>
              {isApplied ? (
                <span
                  data-testid="suggestion-applied-badge"
                  className="text-xs shrink-0 font-semibold"
                  style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-mono)' }}
                >
                  ✓ Applied
                </span>
              ) : (
                <span
                  className="text-xs shrink-0"
                  style={{ color: 'var(--color-accent-gold)', fontFamily: 'var(--font-mono)' }}
                >
                  {suggestion.rank}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1">
              <DeltaPill
                label="DMG"
                value={suggestion.deltaDamage}
                axisColor="var(--color-data-damage)"
                testId="delta-damage"
              />
              <DeltaPill
                label="SUR"
                value={suggestion.deltaSurvivability}
                axisColor="var(--color-data-surv)"
                testId="delta-surv"
              />
              <DeltaPill
                label="SPD"
                value={suggestion.deltaSpeed}
                axisColor="var(--color-data-speed)"
                testId="delta-speed"
              />
            </div>

            {showExplanation && (
              <p
                className="text-xs mt-2 leading-relaxed"
                style={{ color: 'var(--color-text-secondary)' }}
                data-testid="suggestion-explanation"
              >
                {suggestion.explanation}
              </p>
            )}

            {applyError && (
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--color-data-negative)' }}
                data-testid="suggestion-apply-error"
              >
                {applyError}
              </p>
            )}

            {!isApplied && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={onPreview}
                  data-testid="suggestion-preview-btn"
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-text-muted)',
                  }}
                >
                  Preview
                </button>
                <button
                  onClick={onApply}
                  data-testid="suggestion-apply-btn"
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--color-data-positive)',
                    border: '1px solid var(--color-data-positive)',
                  }}
                >
                  Apply
                </button>
                <button
                  onClick={onSkip}
                  data-testid="suggestion-skip-btn"
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    color: 'var(--color-data-negative)',
                    border: '1px solid var(--color-data-negative)',
                  }}
                >
                  Skip
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
)
