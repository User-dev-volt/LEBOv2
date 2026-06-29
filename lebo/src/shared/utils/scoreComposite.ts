import type { BuildScore } from '../types/optimization'

// The ScoreGauge composite: rounded average of the non-null damage/survivability/speed axes.
// Extracted from ScoreGauge so the suggestion card's aggregate score delta uses the SAME formula the
// gauge already shows (single-source — Story 3.3 Source Audit), never a duplicated average.
export function computeComposite(score: BuildScore | null): number | null {
  if (!score) return null
  const values = [score.damage, score.survivability, score.speed].filter(
    (v): v is number => v !== null
  )
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

// Composite ΔBuildScore between two scores, to one decimal (the FR-19 score delta, e.g. +4.2).
// Derived from the suggestion's own baselineScore → previewScore (single-node-consistent with the
// per-axis pills and Apply), NOT the echo-fragile toNodeId→nodeEfficiencies join. Returns null when
// either composite is undefined (all axes null).
export function compositeDelta(
  baseline: BuildScore | null,
  preview: BuildScore | null
): number | null {
  const b = computeComposite(baseline)
  const p = computeComposite(preview)
  if (b === null || p === null) return null
  return Math.round((p - b) * 10) / 10
}
