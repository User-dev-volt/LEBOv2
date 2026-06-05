import { useState } from 'react'
import type { IdolType } from '../../shared/types/contextDatabase'
import { IdolAffixPicker } from './IdolAffixPicker'

interface AffixConfig {
  prefixId?: string
  prefixTier?: number
  suffixId?: string
  suffixTier?: number
}

interface IdolTrayProps {
  idolTypes: IdolType[]
  selectedTypeId: string | null
  affixConfig: AffixConfig
  isConfigComplete: boolean
  onSelect: (typeId: string) => void
  onPrefixChange: (affixId: string, tier: number) => void
  onSuffixChange: (affixId: string, tier: number) => void
}

function affixDescriptor(type: IdolType): string {
  const names = [...type.prefixPool, ...type.suffixPool].map((a) => a.displayName)
  if (names.length === 0) return 'No affixes'
  const shown = names.slice(0, 2).join(', ')
  return names.length > 2 ? `${shown} +${names.length - 2} more` : shown
}

export function IdolTray({
  idolTypes,
  selectedTypeId,
  affixConfig,
  isConfigComplete,
  onSelect,
  onPrefixChange,
  onSuffixChange,
}: IdolTrayProps) {
  const [filter, setFilter] = useState('')

  const q = filter.trim().toLowerCase()
  const visible = q ? idolTypes.filter((t) => t.displayName.toLowerCase().includes(q)) : idolTypes
  const selectedType = selectedTypeId ? idolTypes.find((t) => t.id === selectedTypeId) ?? null : null

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col rounded-lg"
      style={{
        width: '18rem',
        flexShrink: 0,
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-bg-hover)',
      }}
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
          Idol Tray
        </span>
        <span
          className="text-xs rounded px-1.5 py-0.5"
          style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}
        >
          {idolTypes.length}
        </span>
      </div>

      <div className="px-3 pt-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter idols…"
          aria-label="Filter idols by name"
          className="w-full text-xs rounded px-2 py-1"
          style={{
            backgroundColor: 'var(--color-bg-base)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-bg-hover)',
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5 p-2 overflow-y-auto" style={{ maxHeight: '24rem' }}>
        {visible.length === 0 && (
          <p className="text-xs px-1 py-2" style={{ color: 'var(--color-text-muted)' }}>
            No idols match “{filter}”.
          </p>
        )}
        {visible.map((type) => {
          const isSelected = type.id === selectedTypeId
          return (
            <button
              key={type.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(type.id)}
              className="flex items-center gap-2 rounded p-2 text-left"
              style={{
                backgroundColor: isSelected ? 'var(--color-bg-hover)' : 'var(--color-bg-surface)',
                border: isSelected ? '1px solid var(--color-accent-gold)' : '1px solid var(--color-bg-elevated)',
                cursor: 'pointer',
              }}
            >
              <span
                className="flex items-center justify-center rounded shrink-0"
                aria-hidden="true"
                style={{
                  width: `${14 + type.cols * 8}px`,
                  height: `${14 + type.rows * 8}px`,
                  backgroundColor: isSelected ? 'var(--color-accent-gold-dim)' : 'var(--color-bg-elevated)',
                  color: isSelected ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                  fontSize: '0.5rem',
                }}
              >
                {type.rows}×{type.cols}
              </span>
              <span className="flex flex-col min-w-0">
                <span
                  className="text-xs font-medium leading-tight"
                  style={{ color: isSelected ? 'var(--color-accent-gold-soft)' : 'var(--color-text-primary)' }}
                >
                  {type.displayName}
                </span>
                <span className="leading-tight truncate" style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
                  {type.rows}×{type.cols} · {affixDescriptor(type)}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {selectedType && (
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--color-bg-hover)' }}>
          <span className="text-xs font-medium" style={{ color: 'var(--color-accent-gold-soft)' }}>
            {selectedType.displayName}
          </span>
          <div className="mt-1.5">
            <IdolAffixPicker
              key={selectedType.id}
              idolType={selectedType}
              prefixId={affixConfig.prefixId}
              prefixTier={affixConfig.prefixTier}
              suffixId={affixConfig.suffixId}
              suffixTier={affixConfig.suffixTier}
              onPrefixChange={onPrefixChange}
              onSuffixChange={onSuffixChange}
            />
          </div>
          {isConfigComplete ? (
            <p className="mt-1.5" style={{ fontSize: '0.6rem', color: 'var(--color-accent-gold)' }}>
              Click a valid grid cell to place {selectedType.displayName}.
            </p>
          ) : selectedType.requiresBoth ? (
            <p role="alert" className="mt-1.5" style={{ fontSize: '0.6rem', color: 'var(--color-error, #f87171)' }}>
              This idol type requires both a prefix and suffix
            </p>
          ) : (
            <p className="mt-1.5" style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
              Choose a prefix, then click a valid grid cell to place.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
