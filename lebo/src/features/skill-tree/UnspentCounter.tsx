interface UnspentCounterProps {
  count: number
  treeType: 'passive' | 'skill' | 'weaver'
  budgetEnforced: boolean
}

export function UnspentCounter({ count, treeType, budgetEnforced }: UnspentCounterProps) {
  const countColor = count > 0 ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)'

  return (
    <span
      aria-live="polite"
      aria-label={`Unspent ${treeType} points: ${count}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13 }}
    >
      <span aria-hidden="true" style={{ color: countColor, fontSize: 10 }}>◆</span>
      <span style={{ color: countColor, fontWeight: 600 }}>{count}</span>
      {!budgetEnforced && (
        <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>(Budget off)</span>
      )}
    </span>
  )
}
