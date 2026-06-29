// Shared signed-delta formatting. The optimization suggestion card and the skill-tree canvas tooltip
// both render deltas and cross-feature imports are forbidden, so the integer-style formatters live in
// shared/. `±0` for zero, `?` for an unknown (null) delta.
export function formatDelta(v: number | null): string {
  if (v === null) return '?'
  if (v === 0) return '±0'
  return v > 0 ? `+${v}` : String(v)
}

export function getDeltaIndicator(v: number | null): string {
  if (v === null || v === 0) return '◈'
  return v > 0 ? '▲' : '▼'
}

export function getDeltaColor(v: number | null): string {
  if (v === null || v === 0) return 'var(--color-data-neutral)'
  return v > 0 ? 'var(--color-data-positive)' : 'var(--color-data-negative)'
}
