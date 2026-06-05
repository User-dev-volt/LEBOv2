import type { BuildScore } from '../../shared/types/optimization'

interface ScoreTrioProps {
  scores: BuildScore | null
}

interface PillConfig {
  label: string
  key: keyof BuildScore
  colorVar: string
}

const PILLS: PillConfig[] = [
  { label: 'DMG', key: 'damage', colorVar: 'var(--color-data-damage)' },
  { label: 'SURV', key: 'survivability', colorVar: 'var(--color-data-surv)' },
  { label: 'SPD', key: 'speed', colorVar: 'var(--color-data-speed)' },
]

function formatPill(val: number | null | undefined): string {
  return val === null || val === undefined ? '—' : String(Math.round(val))
}

export function ScoreTrio({ scores }: ScoreTrioProps) {
  return (
    <div className="flex gap-2" data-testid="score-trio">
      {PILLS.map(({ label, key, colorVar }) => (
        <div
          key={key}
          className="flex-1 flex flex-col items-center gap-0.5 rounded px-2 py-1.5"
          style={{ backgroundColor: 'var(--color-bg-elevated)' }}
          data-testid={`score-pill-${key}`}
        >
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: colorVar }}
          >
            {label}
          </span>
          <span
            className="text-sm tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}
          >
            {formatPill(scores?.[key])}
          </span>
        </div>
      ))}
    </div>
  )
}
