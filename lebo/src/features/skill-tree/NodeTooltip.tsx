import { createPortal } from 'react-dom'
import type { GameNode } from '../../shared/types/gameData'

const TOOLTIP_WIDTH = 240
const TOOLTIP_HEIGHT_APPROX = 200
const OFFSET = 20

interface NodeTooltipProps {
  gameNode: GameNode
  allocatedPoints: number
  position: { x: number; y: number }
  errorMessage?: string
  prerequisiteNames?: string[]
}

export function NodeTooltip({ gameNode, allocatedPoints, position, errorMessage, prerequisiteNames }: NodeTooltipProps) {
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
    pointerEvents: 'none',
    maxWidth: `${TOOLTIP_WIDTH}px`,
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
