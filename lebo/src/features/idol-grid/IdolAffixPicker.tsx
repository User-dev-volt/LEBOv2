import { useState } from 'react'
import type { IdolType } from '../../shared/types/contextDatabase'

interface IdolAffixPickerProps {
  idolType: IdolType
  prefixId?: string
  prefixTier?: number
  suffixId?: string
  suffixTier?: number
  onPrefixChange: (affixId: string, tier: number) => void
  onSuffixChange: (affixId: string, tier: number) => void
  onConfirm?: (state: {
    prefixId?: string
    prefixTier?: number
    suffixId?: string
    suffixTier?: number
  }) => void
  onCancel?: () => void
}

export function IdolAffixPicker({
  idolType,
  prefixId,
  prefixTier,
  suffixId,
  suffixTier,
  onPrefixChange,
  onSuffixChange,
  onConfirm,
  onCancel,
}: IdolAffixPickerProps) {
  const isPlacementMode = onConfirm !== undefined

  const [localPrefixId, setLocalPrefixId] = useState<string | undefined>(prefixId)
  const [localPrefixTier, setLocalPrefixTier] = useState<number | undefined>(prefixTier)
  const [localSuffixId, setLocalSuffixId] = useState<string | undefined>(suffixId)
  const [localSuffixTier, setLocalSuffixTier] = useState<number | undefined>(suffixTier)

  const effectivePrefixId = isPlacementMode ? localPrefixId : prefixId
  const effectivePrefixTier = isPlacementMode ? localPrefixTier : prefixTier
  const effectiveSuffixId = isPlacementMode ? localSuffixId : suffixId
  const effectiveSuffixTier = isPlacementMode ? localSuffixTier : suffixTier

  const showSuffix = idolType.requiresBoth || idolType.suffixPool.length > 0

  const requiresBothError =
    isPlacementMode && idolType.requiresBoth && (!effectivePrefixId || !effectiveSuffixId)
  const isConfirmBlocked = idolType.requiresBoth
    ? !effectivePrefixId || !effectiveSuffixId
    : !effectivePrefixId

  function handlePrefixAffixChange(affixId: string) {
    const affix = idolType.prefixPool.find((a) => a.id === affixId)
    if (!affix) return
    const defaultTier = affix.tiers[0]?.tier ?? 1
    if (isPlacementMode) {
      setLocalPrefixId(affixId)
      setLocalPrefixTier(defaultTier)
    } else {
      onPrefixChange(affixId, defaultTier)
    }
  }

  function handlePrefixTierChange(tier: number) {
    if (!effectivePrefixId) return
    if (isPlacementMode) {
      setLocalPrefixTier(tier)
    } else {
      onPrefixChange(effectivePrefixId, tier)
    }
  }

  function handleSuffixAffixChange(affixId: string) {
    const affix = idolType.suffixPool.find((a) => a.id === affixId)
    if (!affix) return
    const defaultTier = affix.tiers[0]?.tier ?? 1
    if (isPlacementMode) {
      setLocalSuffixId(affixId)
      setLocalSuffixTier(defaultTier)
    } else {
      onSuffixChange(affixId, defaultTier)
    }
  }

  function handleSuffixTierChange(tier: number) {
    if (!effectiveSuffixId) return
    if (isPlacementMode) {
      setLocalSuffixTier(tier)
    } else {
      onSuffixChange(effectiveSuffixId, tier)
    }
  }

  const selectStyle = {
    backgroundColor: 'var(--color-bg-base)',
    color: 'var(--color-text-primary)',
    fontSize: '0.6rem',
    outline: 'none',
    width: '100%',
  }

  const focusRing = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.outline = '2px solid var(--color-accent-gold)'
  }
  const blurRing = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.outline = 'none'
  }

  return (
    <div className="flex flex-col gap-0.5" style={{ fontSize: '0.6rem' }}>
      {/* Prefix section */}
      <div className="flex flex-col gap-0.5">
        <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.55rem' }}>Prefix</label>
        <select
          aria-label="Select prefix affix"
          value={effectivePrefixId ?? ''}
          onChange={(e) => handlePrefixAffixChange(e.target.value)}
          style={selectStyle}
          className="rounded"
          onFocus={focusRing}
          onBlur={blurRing}
        >
          <option value="" disabled>— Prefix —</option>
          {idolType.prefixPool.map((a) => (
            <option key={a.id} value={a.id}>{a.displayName}</option>
          ))}
        </select>
        {effectivePrefixId && (
          <select
            aria-label="Prefix tier"
            value={effectivePrefixTier ?? ''}
            onChange={(e) => handlePrefixTierChange(Number(e.target.value))}
            style={selectStyle}
            className="rounded"
            onFocus={focusRing}
            onBlur={blurRing}
          >
            {idolType.prefixPool
              .find((a) => a.id === effectivePrefixId)
              ?.tiers.map((t) => (
                <option key={t.tier} value={t.tier}>T{t.tier}</option>
              ))}
          </select>
        )}
      </div>

      {/* Suffix section */}
      {showSuffix && (
        <div className="flex flex-col gap-0.5">
          <label style={{ color: 'var(--color-text-secondary)', fontSize: '0.55rem' }}>Suffix</label>
          <select
            aria-label="Select suffix affix"
            value={effectiveSuffixId ?? ''}
            onChange={(e) => handleSuffixAffixChange(e.target.value)}
            style={selectStyle}
            className="rounded"
            onFocus={focusRing}
            onBlur={blurRing}
          >
            <option value="" disabled>— Suffix —</option>
            {idolType.suffixPool.map((a) => (
              <option key={a.id} value={a.id}>{a.displayName}</option>
            ))}
          </select>
          {effectiveSuffixId && (
            <select
              aria-label="Suffix tier"
              value={effectiveSuffixTier ?? ''}
              onChange={(e) => handleSuffixTierChange(Number(e.target.value))}
              style={selectStyle}
              className="rounded"
              onFocus={focusRing}
              onBlur={blurRing}
            >
              {idolType.suffixPool
                .find((a) => a.id === effectiveSuffixId)
                ?.tiers.map((t) => (
                  <option key={t.tier} value={t.tier}>T{t.tier}</option>
                ))}
            </select>
          )}
        </div>
      )}

      {/* Placement mode confirmation */}
      {isPlacementMode && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {requiresBothError && (
            <p role="alert" style={{ fontSize: '0.55rem', color: 'var(--color-error, #f87171)', margin: 0 }}>
              This idol type requires both a prefix and suffix
            </p>
          )}
          <div className="flex gap-1">
            <button
              disabled={isConfirmBlocked}
              aria-disabled={isConfirmBlocked}
              onClick={() =>
                onConfirm({
                  prefixId: localPrefixId,
                  prefixTier: localPrefixTier,
                  suffixId: localSuffixId,
                  suffixTier: localSuffixTier,
                })
              }
              aria-label="Place idol"
              className="rounded px-1"
              style={{
                fontSize: '0.55rem',
                backgroundColor: isConfirmBlocked ? 'var(--color-bg-base)' : 'var(--color-accent-gold)',
                color: isConfirmBlocked ? 'var(--color-text-muted)' : 'var(--color-bg-base)',
                cursor: isConfirmBlocked ? 'not-allowed' : 'pointer',
                outline: 'none',
                opacity: isConfirmBlocked ? 0.5 : 1,
              }}
              onFocus={(e) => { if (!isConfirmBlocked) e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Place
            </button>
            <button
              onClick={onCancel}
              aria-label="Cancel idol placement"
              className="rounded px-1"
              style={{
                fontSize: '0.55rem',
                backgroundColor: 'var(--color-bg-base)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
              onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
