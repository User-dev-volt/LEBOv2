import { createPortal } from 'react-dom'
import type { SourceType } from '../../shared/types/statSheet'

const TOOLTIP_WIDTH = 260
const TOOLTIP_HEIGHT_APPROX = 240
const OFFSET = 16

export interface ResolvedSource {
  sourceType: SourceType
  name: string
  value: number
  modifierType: 'flat' | 'increased' | 'more' | 'conversion'
}

// Resistances are capped at 75%; `gap` is null when the row is at/over cap (no below-cap warning).
export interface CapInfo {
  preCapTotal: number
  cap: number
  gap: number | null
}

interface StatSourceTooltipProps {
  id: string
  statLabel: string
  sources: ResolvedSource[]
  position: { x: number; y: number }
  unit?: string
  capInfo?: CapInfo
  reducedMotion?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

// FR-13 fixed category order. Maps SourceType → display header.
const CATEGORY_ORDER: Array<{ type: SourceType; label: string }> = [
  { type: 'passive_node', label: 'Passive Nodes' },
  { type: 'gear_slot', label: 'Gear' },
  { type: 'idol', label: 'Idols' },
  { type: 'blessing', label: 'Blessings' },
  { type: 'skill_node', label: 'Skills' },
  { type: 'condition', label: 'Conditions' },
]

function fmtNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

interface AggregatedSource extends ResolvedSource {
  count: number
}

// Story 1.7 records one source per allocated passive point, so a multi-point node appears N times.
// Collapse identical (name + modifierType) entries into one line, summing value and counting points.
function aggregateSources(items: ResolvedSource[]): AggregatedSource[] {
  const map = new Map<string, AggregatedSource>()
  for (const s of items) {
    const key = `${s.name}|${s.modifierType}`
    const existing = map.get(key)
    if (existing) {
      existing.value += s.value
      existing.count += 1
    } else {
      map.set(key, { ...s, count: 1 })
    }
  }
  return [...map.values()]
}

export function formatContribution(source: ResolvedSource, unit: string): string {
  const v = source.value
  const sign = v < 0 ? '-' : '+'
  const abs = fmtNum(Math.abs(v))
  switch (source.modifierType) {
    case 'increased':
      return `${sign}${abs}% increased`
    case 'more':
      return `${sign}${abs}% more`
    case 'conversion':
      return `${fmtNum(v)}% conversion`
    case 'flat':
    default:
      return `${sign}${abs}${unit}`
  }
}

export function StatSourceTooltip({
  id,
  statLabel,
  sources,
  position,
  unit = '',
  capInfo,
  reducedMotion = false,
  onMouseEnter,
  onMouseLeave,
}: StatSourceTooltipProps) {
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

  const groups = CATEGORY_ORDER.map((c) => ({
    label: c.label,
    items: aggregateSources(sources.filter((s) => s.sourceType === c.type))
      // 1.7 collect_sources returns a non-deterministic HashMap order — sort for stable display.
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0)

  return createPortal(
    <div
      role="tooltip"
      id={id}
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 1000,
        width: `${TOOLTIP_WIDTH}px`,
        maxHeight: '60vh',
        overflowY: 'auto',
        padding: '10px 12px',
        borderRadius: '4px',
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-bg-base)',
        transition: reducedMotion ? 'none' : 'opacity 120ms ease',
      }}
      onWheel={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p
        style={{
          color: 'var(--color-text-primary)',
          fontWeight: 600,
          fontSize: '12px',
          marginBottom: '4px',
        }}
      >
        {statLabel}
      </p>

      {sources.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>Base value only.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} style={{ marginBottom: '4px' }}>
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '1px',
              }}
            >
              {group.label}
            </p>
            {group.items.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px' }}
              >
                <span style={{ color: 'var(--color-text-secondary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </span>
                <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {formatContribution(item, unit)}
                  {item.count > 1 && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {' '}
                      {item.sourceType === 'passive_node' ? `(${item.count} pts)` : `(×${item.count})`}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))
      )}

      {capInfo && (
        <div
          style={{
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid var(--color-bg-base)',
            fontSize: '11px',
          }}
        >
          <p style={{ color: 'var(--color-text-muted)' }}>
            Pre-cap total: {fmtNum(capInfo.preCapTotal)}%
          </p>
          {capInfo.gap != null ? (
            <p style={{ color: 'var(--color-data-negative)' }}>+{fmtNum(capInfo.gap)}% to cap</p>
          ) : (
            // At/over cap: surface the cuttable overcap headroom (pre-cap total − cap) so the
            // player sees how much resistance they can shed (FR-14 "which gear can I drop").
            <p style={{ color: 'var(--color-accent-gold)' }}>
              capped at {capInfo.cap}%
              {capInfo.preCapTotal - capInfo.cap > 0 && ` · ${fmtNum(capInfo.preCapTotal - capInfo.cap)}% over cap`}
            </p>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
