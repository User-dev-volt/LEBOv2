import { useState } from 'react'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { PlacedIdol } from '../../shared/types/build'
import { IdolGrid } from './IdolGrid'
import { IdolTray } from './IdolTray'

const EMPTY_IDOL_GRID: PlacedIdol[] = []

interface AffixConfig {
  prefixId?: string
  prefixTier?: number
  suffixId?: string
  suffixTier?: number
}

export function IdolEditor() {
  const idolData = useGameDataStore((s) => s.idolData)
  const idolGrid = useBuildStore((s) => s.activeBuild?.idolGrid ?? EMPTY_IDOL_GRID)

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [affixConfig, setAffixConfig] = useState<AffixConfig>({})
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null)

  if (!idolData) {
    return (
      <div data-testid="idol-grid-loading" className="p-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Loading idol data…
      </div>
    )
  }

  const { defaultGrid: gridConfig, idolTypes } = idolData
  const selectedType = selectedTypeId ? idolTypes.find((t) => t.id === selectedTypeId) ?? null : null

  const isConfigComplete = selectedType
    ? selectedType.requiresBoth
      ? Boolean(affixConfig.prefixId && affixConfig.suffixId)
      : Boolean(affixConfig.prefixId)
    : false

  function deselect() {
    setSelectedTypeId(null)
    setAffixConfig({})
    setHoverCell(null)
  }

  function handleSelect(typeId: string) {
    if (typeId === selectedTypeId) {
      deselect()
      return
    }
    setSelectedTypeId(typeId)
    setAffixConfig({})
    setHoverCell(null)
  }

  function handlePrefixChange(affixId: string, tier: number) {
    setAffixConfig((c) => ({ ...c, prefixId: affixId, prefixTier: tier }))
  }

  function handleSuffixChange(affixId: string, tier: number) {
    setAffixConfig((c) => ({ ...c, suffixId: affixId, suffixTier: tier }))
  }

  function handlePlace(row: number, col: number) {
    if (!selectedType || !isConfigComplete) return
    useBuildStore.getState().placeIdol({
      id: crypto.randomUUID(),
      row,
      col,
      idolTypeId: selectedType.id,
      ...affixConfig,
    })
    setHoverCell(null)
  }

  function handleRemove(idolId: string) {
    useBuildStore.getState().clearIdolSlot(idolId)
  }

  function handleReset() {
    deselect()
    useBuildStore.getState().resetIdolGrid()
  }

  function describePlaced(placed: PlacedIdol): { name: string; affixes: string } {
    const type = idolTypes.find((t) => t.id === placed.idolTypeId)
    const name = type?.displayName ?? placed.idolTypeId
    const parts: string[] = []
    if (placed.prefixId) {
      const a = type?.prefixPool.find((p) => p.id === placed.prefixId)
      parts.push(`${a?.displayName ?? placed.prefixId} T${placed.prefixTier ?? 1}`)
    }
    if (placed.suffixId) {
      const a = type?.suffixPool.find((p) => p.id === placed.suffixId)
      parts.push(`${a?.displayName ?? placed.suffixId} T${placed.suffixTier ?? 1}`)
    }
    return { name, affixes: parts.join(', ') || 'No affixes set' }
  }

  const placedCount = idolGrid.length

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start" onClick={deselect} data-testid="idol-editor">
      <div className="flex flex-col gap-3 md:flex-1 min-w-0">
        <IdolGrid
          gridConfig={gridConfig}
          idolTypes={idolTypes}
          idolGrid={idolGrid}
          selectedType={selectedType}
          hoverCell={hoverCell}
          onHoverCell={setHoverCell}
          onPlace={handlePlace}
          onRemove={handleRemove}
        />

        <section
          aria-label="Active idol stats"
          className="rounded-lg p-3"
          style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-bg-hover)' }}
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Active Idol Stats
          </h3>
          {placedCount === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              No idols placed.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {idolGrid.map((placed) => {
                const { name, affixes } = describePlaced(placed)
                return (
                  <li key={placed.id} className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-accent-gold-soft)' }}>{name}</span>: {affixes}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {placedCount} idol{placedCount !== 1 ? 's' : ''} placed
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleReset()
            }}
            className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            Reset all idols
          </button>
        </div>
      </div>

      <IdolTray
        idolTypes={idolTypes}
        selectedTypeId={selectedTypeId}
        affixConfig={affixConfig}
        isConfigComplete={isConfigComplete}
        onSelect={handleSelect}
        onPrefixChange={handlePrefixChange}
        onSuffixChange={handleSuffixChange}
      />
    </div>
  )
}
