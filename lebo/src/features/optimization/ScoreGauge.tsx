import type { BuildScore } from '../../shared/types/optimization'

interface ScoreGaugeProps {
  baselineScore: BuildScore | null
  previewScore?: BuildScore | null
}

interface AxisConfig {
  label: string
  key: keyof BuildScore
  colorVar: string
  dataAttr: string
}

const AXES: AxisConfig[] = [
  { label: 'Damage', key: 'damage', colorVar: 'var(--color-data-damage)', dataAttr: 'data-damage' },
  { label: 'Surv', key: 'survivability', colorVar: 'var(--color-data-surv)', dataAttr: 'data-surv' },
  { label: 'Speed', key: 'speed', colorVar: 'var(--color-data-speed)', dataAttr: 'data-speed' },
]

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

function ScoreBar({ value, colorVar }: { value: number | null; colorVar: string }) {
  const pct = value === null ? 0 : value
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden flex-1"
      style={{ backgroundColor: 'var(--color-bg-hover)' }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${pct}%`, backgroundColor: colorVar }}
      />
    </div>
  )
}

export function ScoreGauge({ baselineScore, previewScore }: ScoreGaugeProps) {
  const isComparisonMode = previewScore != null
  const baseComposite = computeComposite(baselineScore)
  const previewComposite = computeComposite(previewScore ?? null)

  return (
    <div
      className="flex flex-col gap-2"
      role="region"
      aria-label="Build scores"
      data-testid="score-gauge"
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide mb-1"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-ui)' }}
      >
        Build Score
      </p>

      {AXES.map(({ label, key, colorVar, dataAttr }) => {
        const baseVal = baselineScore?.[key] ?? null
        const prevVal = previewScore?.[key] ?? null

        return (
          <div key={key} className="flex flex-col gap-1" data-testid={`axis-${key}`}>
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-xs w-10 shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {label}
              </span>

              {isComparisonMode ? (
                <span
                  className="text-xs tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: colorVar }}
                >
                  {formatScore(baseVal)} → {formatScore(prevVal)}
                </span>
              ) : (
                <span
                  className="text-xs tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)', color: colorVar }}
                  title={`${label}: ${formatScore(baseVal)} / 100`}
                  {...{ [dataAttr]: true }}
                >
                  {formatScore(baseVal)}
                </span>
              )}
            </div>

            {isComparisonMode ? (
              <div className="flex gap-1">
                <ScoreBar value={baseVal} colorVar={colorVar} />
                <ScoreBar value={prevVal} colorVar={colorVar} />
              </div>
            ) : (
              <ScoreBar value={baseVal} colorVar={colorVar} />
            )}
          </div>
        )
      })}

      <div
        className="flex items-center justify-between mt-1 pt-2"
        style={{ borderTop: '1px solid var(--color-bg-elevated)' }}
        data-testid="composite-row"
      >
        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Composite
        </span>
        {isComparisonMode ? (
          <span
            className="text-xs tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}
          >
            {formatScore(baseComposite)} → {formatScore(previewComposite)}
          </span>
        ) : (
          <span
            className="text-xs tabular-nums"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}
          >
            {formatScore(baseComposite)}
          </span>
        )}
      </div>
    </div>
  )
}
