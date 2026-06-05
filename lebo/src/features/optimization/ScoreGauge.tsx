import type { BuildScore } from '../../shared/types/optimization'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'

interface ScoreGaugeProps {
  baselineScore: BuildScore | null
  previewScore?: BuildScore | null
}

const GAUGE_RADIUS = 64
const GAUGE_CX = 90
const GAUGE_CY = 90
// 3/4 arc (270°) sweep; rotate(135) places the gap at the bottom (UX-DR4).
const ARC_LENGTH = Math.PI * GAUGE_RADIUS * 1.5
const TICK_COUNT = 11

function formatScore(val: number | null): string {
  return val === null ? '—' : String(val)
}

function computeComposite(score: BuildScore | null): number | null {
  if (!score) return null
  const values = [score.damage, score.survivability, score.speed].filter(
    (v): v is number => v !== null
  )
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

export function ScoreGauge({ baselineScore, previewScore }: ScoreGaugeProps) {
  const reducedMotion = useReducedMotion()

  const baseComposite = computeComposite(baselineScore)
  const previewComposite = computeComposite(previewScore ?? null)

  const gaugeValue = baseComposite ?? 0
  const pct = Math.max(0, Math.min(100, gaugeValue)) / 100

  const delta =
    previewScore != null && baseComposite !== null && previewComposite !== null
      ? Math.round((previewComposite - baseComposite) * 10) / 10
      : null
  const showDelta = delta !== null && delta !== 0

  return (
    <div
      className="relative flex flex-col items-center"
      role="region"
      aria-label="Build scores"
      data-testid="score-gauge"
    >
      <svg width="180" height="160" viewBox="0 0 180 160" aria-hidden="true">
        <defs>
          <linearGradient id="score-gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-accent-gold-dim)" />
            <stop offset="60%" stopColor="var(--color-accent-gold)" />
            <stop offset="100%" stopColor="var(--color-accent-gold-soft)" />
          </linearGradient>
        </defs>

        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_RADIUS}
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth="8"
          strokeDasharray={`${ARC_LENGTH} 9999`}
          transform={`rotate(135 ${GAUGE_CX} ${GAUGE_CY})`}
          strokeLinecap="round"
        />

        <circle
          cx={GAUGE_CX}
          cy={GAUGE_CY}
          r={GAUGE_RADIUS}
          fill="none"
          stroke="url(#score-gauge-grad)"
          strokeWidth="8"
          strokeDasharray={`${ARC_LENGTH * pct} 9999`}
          transform={`rotate(135 ${GAUGE_CX} ${GAUGE_CY})`}
          strokeLinecap="round"
          style={reducedMotion ? undefined : { transition: 'stroke-dasharray 400ms ease' }}
        />

        {Array.from({ length: TICK_COUNT }).map((_, i) => {
          const angle = -135 + (270 * i) / (TICK_COUNT - 1)
          const rad = (angle * Math.PI) / 180
          const major = i % 2 === 0
          const outer = GAUGE_RADIUS + 8
          const inner = GAUGE_RADIUS + 4
          return (
            <line
              key={i}
              x1={GAUGE_CX + Math.cos(rad) * inner}
              y1={GAUGE_CY + Math.sin(rad) * inner}
              x2={GAUGE_CX + Math.cos(rad) * outer}
              y2={GAUGE_CY + Math.sin(rad) * outer}
              stroke={major ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'}
              strokeWidth={major ? 1.4 : 1}
              opacity={major ? 1 : 0.5}
            />
          )
        })}
      </svg>

      <div
        className="absolute flex flex-col items-center"
        style={{ top: 52 }}
        data-testid="gauge-center"
      >
        <span
          className="text-3xl tabular-nums leading-none"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
        >
          {formatScore(baseComposite)}
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wide mt-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Build Score
        </span>
        {showDelta && (
          <span
            className="text-xs tabular-nums mt-1"
            style={{
              fontFamily: 'var(--font-mono)',
              color: delta > 0 ? 'var(--color-data-positive)' : 'var(--color-data-negative)',
            }}
            data-testid="gauge-delta"
          >
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}
