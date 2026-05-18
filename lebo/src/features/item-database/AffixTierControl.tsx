import type { AffixEntry } from '../../shared/types/itemDatabase'

interface AffixTierControlProps {
  affixEntry: AffixEntry
  currentTier: number
  onChange: (tier: number) => void
}

export function AffixTierControl({ affixEntry, currentTier, onChange }: AffixTierControlProps) {
  const tierCount = affixEntry.tiers.length
  const tierData = affixEntry.tiers[currentTier - 1]
  const valueText =
    tierData.minValue === tierData.maxValue
      ? String(tierData.minValue)
      : `${tierData.minValue}–${tierData.maxValue}`

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (currentTier < tierCount) onChange(currentTier + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (currentTier > 1) onChange(currentTier - 1)
    }
  }

  return (
    <div
      role="slider"
      aria-valuemin={1}
      aria-valuemax={tierCount}
      aria-valuenow={currentTier}
      aria-label={`${affixEntry.name} tier`}
      aria-valuetext={`Tier ${currentTier}: ${valueText}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      {Array.from({ length: tierCount }, (_, i) => {
        const pip = i + 1
        const filled = pip <= currentTier
        return (
          <div
            key={pip}
            aria-hidden={true}
            onClick={() => { if (pip !== currentTier) onChange(pip) }}
            style={
              filled
                ? {
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-tier-pip-active)',
                  }
                : {
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-tier-pip-inactive)',
                    border: '1px solid var(--color-text-muted)',
                  }
            }
          />
        )
      })}
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          width: 40,
          textAlign: 'right',
          fontSize: 13,
          color: 'var(--color-text-primary)',
        }}
      >
        {valueText}
      </span>
    </div>
  )
}
