import { createPortal } from 'react-dom'
import type { GameNode } from '../../shared/types/gameData'
import type { StatDeltaEntry } from '../../shared/utils/statDeltas'
import { formatCostLine } from '../../shared/utils/formatCost'
import { formatDelta, getDeltaColor } from '../../shared/utils/formatDelta'

const TOOLTIP_WIDTH = 240
const TOOLTIP_HEIGHT_APPROX = 200
const OFFSET = 20

// % stats read to one decimal. Flat stats split by magnitude: large ones (HP/EHP/Ward/Armor/Avg Hit)
// read as whole numbers, small ones (speed multipliers like +0.08) keep one decimal so they don't
// round away to ±0.
function roundForUnit(delta: number, unit: string): number {
  if (unit === '%') return Math.round(delta * 10) / 10
  return Math.abs(delta) >= 10 ? Math.round(delta) : Math.round(delta * 10) / 10
}

interface NodeTooltipProps {
  gameNode: GameNode
  allocatedPoints: number
  position: { x: number; y: number }
  errorMessage?: string
  prerequisiteNames?: string[]
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  // ── Story 3.3 compact card-interaction variant (FR-18) ──
  /** Renders the lean node-name + cost + per-stat-delta layout instead of the full node tooltip. */
  compact?: boolean
  pointCost?: number
  pathCost?: number
  scoreDelta?: number | null
  /** Changed, non-inert per-stat deltas (already filtered by tooltipStatDeltaEntries). */
  statDeltas?: StatDeltaEntry[]
}

export function NodeTooltip({ gameNode, allocatedPoints, position, errorMessage, prerequisiteNames, onMouseEnter, onMouseLeave, compact, pointCost, pathCost, scoreDelta, statDeltas }: NodeTooltipProps) {
  const viewportWidth = window.innerWidth || 10000
  const viewportHeight = window.innerHeight || 10000

  const left =
    position.x + OFFSET + TOOLTIP_WIDTH > viewportWidth
      ? position.x - OFFSET - TOOLTIP_WIDTH
      : position.x + OFFSET

  const top =
    position.y + OFFSET + TOOLTIP_HEIGHT_APPROX > viewportHeight
      ? position.y - OFFSET - TOOLTIP_HEIGHT_APPROX
      : position.y + OFFSET

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    left,
    top,
    zIndex: 1000,
    borderRadius: '4px',
    maxWidth: `${TOOLTIP_WIDTH}px`,
    maxHeight: '60vh',
    overflowY: 'auto',
  }

  // Compact card-interaction variant (FR-18): node name + point/path cost + per-stat deltas. Reuses
  // the shared delta formatting for visual consistency with the suggestion card.
  if (compact) {
    const hasDeltas = !!statDeltas && statDeltas.length > 0
    return createPortal(
      <div
        style={{
          ...baseStyle,
          padding: '10px 12px',
          minWidth: 160,
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-accent-gold)',
        }}
        onWheel={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        data-testid="node-tooltip-compact"
      >
        <p style={{ color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
          {gameNode.name}
        </p>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            marginBottom: '6px',
          }}
          data-testid="node-tooltip-cost"
        >
          {formatCostLine(pointCost ?? 0, pathCost ?? 0)}
        </p>
        {scoreDelta != null && (
          <p
            style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: getDeltaColor(scoreDelta), marginBottom: '4px' }}
            data-testid="node-tooltip-score-delta"
          >
            Δ Build Score {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)}
          </p>
        )}
        {hasDeltas ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }} data-testid="node-tooltip-deltas">
            {statDeltas!.map((d) => {
              const rounded = roundForUnit(d.delta, d.unit)
              return (
                <span
                  key={d.label}
                  style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: getDeltaColor(rounded) }}
                >
                  {formatDelta(rounded)}{d.unit} {d.label}
                </span>
              )
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontStyle: 'italic' }} data-testid="node-tooltip-deltas-pending">
            Stat changes pending…
          </p>
        )}
      </div>,
      document.body
    )
  }

  if (errorMessage) {
    return createPortal(
      <div
        style={{
          ...baseStyle,
          padding: '8px 12px',
          fontSize: '12px',
          color: 'var(--color-accent-gold)',
          backgroundColor: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-accent-gold)',
        }}
        onWheel={(e) => e.stopPropagation()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {errorMessage}
      </div>,
      document.body
    )
  }

  return createPortal(
    <div
      style={{
        ...baseStyle,
        padding: '12px',
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-bg-base)',
      }}
      onWheel={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p
        style={{
          color: 'var(--color-text-primary)',
          fontWeight: 600,
          fontSize: '13px',
          marginBottom: '4px',
        }}
      >
        {gameNode.name}
      </p>

      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: '11px',
          marginBottom: '6px',
        }}
      >
        {allocatedPoints}/{gameNode.maxPoints} pts allocated · {gameNode.pointCost} pt/node
      </p>

      <p
        style={{
          color: 'var(--color-text-primary)',
          fontSize: '12px',
          marginBottom: gameNode.tags.length > 0 || gameNode.prerequisiteNodeIds.length > 0 ? '6px' : '0',
        }}
      >
        {gameNode.effectDescription}
      </p>

      {gameNode.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
          {gameNode.tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-muted)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {(prerequisiteNames ?? gameNode.prerequisiteNodeIds).length > 0 && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
          Requires: {(prerequisiteNames ?? gameNode.prerequisiteNodeIds).join(', ')}
        </p>
      )}
    </div>,
    document.body
  )
}
