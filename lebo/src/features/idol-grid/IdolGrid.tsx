import { useState } from 'react'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { IdolType } from '../../shared/types/contextDatabase'
import type { PlacedIdol } from '../../shared/types/build'
import { validatePlacement, getOccupantAt } from './idolGridUtils'
import { IdolAffixPicker } from './IdolAffixPicker'

export function IdolGrid() {
  const idolData = useGameDataStore((s) => s.idolData)
  const idolGrid = useBuildStore((s) => s.activeBuild?.idolGrid ?? [])

  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null)
  const [configuringNew, setConfiguringNew] = useState<{
    row: number
    col: number
    idolType: IdolType
    prefixId?: string
    prefixTier?: number
    suffixId?: string
    suffixTier?: number
  } | null>(null)
  const [editingIdolId, setEditingIdolId] = useState<string | null>(null)
  const [placementError, setPlacementError] = useState<string | null>(null)

  if (!idolData) {
    return (
      <div data-testid="idol-grid-loading" className="p-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Loading idol data…
      </div>
    )
  }

  const { defaultGrid: gridConfig, idolTypes } = idolData

  function handleCellClick(row: number, col: number) {
    const occupant = getOccupantAt(row, col, idolGrid, idolTypes)
    if (occupant) {
      setPendingCell(null)
      return
    }
    // If another placement config is active, cancel it first
    if (configuringNew !== null) {
      setConfiguringNew(null)
    }
    setPlacementError(null)
    setPendingCell({ row, col })
  }

  function handleTypeSelect(row: number, col: number, idolType: IdolType) {
    const result = validatePlacement(row, col, idolType, gridConfig, idolGrid, idolTypes)
    if (!result.valid) {
      setPlacementError(result.error ?? 'Cannot place idol here')
      setPendingCell(null)
      return
    }
    setPlacementError(null)
    setPendingCell(null)
    setConfiguringNew({ row, col, idolType })
  }

  function handleConfirmPlacement(state: {
    prefixId?: string
    prefixTier?: number
    suffixId?: string
    suffixTier?: number
  }) {
    if (!configuringNew) return
    useBuildStore.getState().placeIdol({
      id: crypto.randomUUID(),
      row: configuringNew.row,
      col: configuringNew.col,
      idolTypeId: configuringNew.idolType.id,
      ...state,
    })
    setConfiguringNew(null)
  }

  function handleClear(idolId: string) {
    setPlacementError(null)
    if (editingIdolId === idolId) setEditingIdolId(null)
    useBuildStore.getState().clearIdolSlot(idolId)
  }

  function handleReset() {
    setPlacementError(null)
    setEditingIdolId(null)
    setConfiguringNew(null)
    useBuildStore.getState().resetIdolGrid()
  }

  function handleAffixUpdate(
    idolId: string,
    update: { prefixId?: string | null; prefixTier?: number; suffixId?: string | null; suffixTier?: number }
  ) {
    useBuildStore.getState().updateIdolAffix(idolId, update)
  }

  function getPrefixName(placed: PlacedIdol): string {
    if (!placed.prefixId) return ''
    const type = idolTypes.find((t) => t.id === placed.idolTypeId)
    return type?.prefixPool.find((a) => a.id === placed.prefixId)?.displayName ?? placed.prefixId
  }

  function getSuffixName(placed: PlacedIdol): string {
    if (!placed.suffixId) return ''
    const type = idolTypes.find((t) => t.id === placed.idolTypeId)
    return type?.suffixPool.find((a) => a.id === placed.suffixId)?.displayName ?? placed.suffixId
  }

  const placedCount = idolGrid.length

  return (
    <div className="flex flex-col gap-2 p-1">
      <div
        data-testid="idol-grid"
        className="grid gap-1"
        aria-label="Idol placement grid"
        style={{ gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridConfig.rows }, (_, row) =>
          Array.from({ length: gridConfig.cols }, (_, col) => {
            const isBlocked = gridConfig.blockedCells.some(([br, bc]) => br === row && bc === col)
            const occupant = getOccupantAt(row, col, idolGrid, idolTypes)
            const isTopLeft = occupant ? occupant.row === row && occupant.col === col : false
            const isPending = pendingCell?.row === row && pendingCell?.col === col

            if (isBlocked) {
              return (
                <div
                  key={`${row}-${col}`}
                  aria-disabled="true"
                  className="aspect-square rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-base)',
                    cursor: 'not-allowed',
                    opacity: 0.3,
                  }}
                />
              )
            }

            // Interior cells of a new-idol-being-configured — skip (top-left cell's span covers this area)
            const isInConfiguringArea =
              configuringNew !== null &&
              row >= configuringNew.row &&
              row < configuringNew.row + configuringNew.idolType.rows &&
              col >= configuringNew.col &&
              col < configuringNew.col + configuringNew.idolType.cols &&
              !(row === configuringNew.row && col === configuringNew.col)
            if (isInConfiguringArea) return null

            // New idol being configured — show picker at top-left
            if (
              configuringNew !== null &&
              row === configuringNew.row &&
              col === configuringNew.col
            ) {
              const { idolType } = configuringNew
              return (
                <div
                  key={`${row}-${col}`}
                  className="rounded p-0.5 overflow-auto"
                  style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    gridColumn: `${col + 1} / span ${idolType.cols}`,
                    gridRow: `${row + 1} / span ${idolType.rows}`,
                  }}
                >
                  <span
                    className="leading-tight"
                    style={{ fontSize: '0.55rem', color: 'var(--color-text-secondary)', display: 'block' }}
                  >
                    {idolType.displayName}
                  </span>
                  <IdolAffixPicker
                    idolType={idolType}
                    prefixId={configuringNew.prefixId}
                    prefixTier={configuringNew.prefixTier}
                    suffixId={configuringNew.suffixId}
                    suffixTier={configuringNew.suffixTier}
                    onPrefixChange={(affixId, tier) =>
                      setConfiguringNew((c) => (c ? { ...c, prefixId: affixId, prefixTier: tier } : null))
                    }
                    onSuffixChange={(affixId, tier) =>
                      setConfiguringNew((c) => (c ? { ...c, suffixId: affixId, suffixTier: tier } : null))
                    }
                    onConfirm={handleConfirmPlacement}
                    onCancel={() => {
                      setConfiguringNew(null)
                      setPlacementError(null)
                    }}
                  />
                </div>
              )
            }

            if (occupant && isTopLeft) {
              const idolType = idolTypes.find((t) => t.id === occupant.idolTypeId)
              const cols = idolType?.cols ?? 1
              const rows = idolType?.rows ?? 1

              // Edit mode
              if (editingIdolId === occupant.id) {
                return (
                  <div
                    key={`${row}-${col}`}
                    className="rounded p-0.5 overflow-auto"
                    style={{
                      backgroundColor: 'var(--color-accent-gold)',
                      gridColumn: `${col + 1} / span ${cols}`,
                      gridRow: `${row + 1} / span ${rows}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--color-bg-base)' }}>
                        {idolType?.displayName}
                      </span>
                      <button
                        onClick={() => setEditingIdolId(null)}
                        aria-label="Done editing affix"
                        className="rounded px-1"
                        style={{
                          fontSize: '0.55rem',
                          color: 'var(--color-bg-base)',
                          backgroundColor: 'transparent',
                          outline: 'none',
                        }}
                        onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-bg-base)' }}
                        onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                      >
                        Done
                      </button>
                    </div>
                    {idolType && (
                      <IdolAffixPicker
                        idolType={idolType}
                        prefixId={occupant.prefixId}
                        prefixTier={occupant.prefixTier}
                        suffixId={occupant.suffixId}
                        suffixTier={occupant.suffixTier}
                        onPrefixChange={(affixId, tier) =>
                          handleAffixUpdate(occupant.id, { prefixId: affixId, prefixTier: tier })
                        }
                        onSuffixChange={(affixId, tier) =>
                          handleAffixUpdate(occupant.id, { suffixId: affixId, suffixTier: tier })
                        }
                      />
                    )}
                  </div>
                )
              }

              // View mode
              return (
                <div
                  key={`${row}-${col}`}
                  className="rounded text-xs flex flex-col items-center justify-center gap-0.5 p-0.5 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--color-accent-gold)',
                    color: 'var(--color-bg-base)',
                    gridColumn: `${col + 1} / span ${cols}`,
                    gridRow: `${row + 1} / span ${rows}`,
                    outline: 'none',
                  }}
                  role="button"
                  aria-label={`${idolType?.displayName ?? occupant.idolTypeId} placed. Click to edit affixes.`}
                  tabIndex={0}
                  onClick={() => setEditingIdolId(occupant.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setEditingIdolId(occupant.id)
                  }}
                  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-bg-base)' }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                >
                  <span className="font-semibold leading-tight text-center" style={{ fontSize: '0.6rem' }}>
                    {idolType?.displayName ?? occupant.idolTypeId}
                  </span>
                  {occupant.prefixId ? (
                    <span
                      className="leading-tight text-center"
                      style={{ fontSize: '0.55rem' }}
                      aria-label={`Prefix: ${getPrefixName(occupant)} T${occupant.prefixTier}`}
                    >
                      {getPrefixName(occupant)} T{occupant.prefixTier}
                    </span>
                  ) : (
                    <span
                      className="leading-tight text-center"
                      style={{ fontSize: '0.55rem', opacity: 0.6 }}
                      aria-label="Prefix slot (empty)"
                    >
                      — Prefix —
                    </span>
                  )}
                  {(idolType?.requiresBoth ?? false) && (
                    occupant.suffixId ? (
                      <span
                        className="leading-tight text-center"
                        style={{ fontSize: '0.55rem' }}
                        aria-label={`Suffix: ${getSuffixName(occupant)} T${occupant.suffixTier}`}
                      >
                        {getSuffixName(occupant)} T{occupant.suffixTier}
                      </span>
                    ) : (
                      <span
                        className="leading-tight text-center"
                        style={{ fontSize: '0.55rem', opacity: 0.6 }}
                        aria-label="Suffix slot (empty)"
                      >
                        — Suffix —
                      </span>
                    )
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleClear(occupant.id) }}
                    aria-label={`${idolType?.displayName ?? occupant.idolTypeId} placed. Press to clear.`}
                    className="rounded px-1 leading-tight"
                    style={{
                      fontSize: '0.55rem',
                      backgroundColor: 'var(--color-bg-base)',
                      color: 'var(--color-text-primary)',
                      outline: 'none',
                    }}
                    onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
                    onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                  >
                    ×
                  </button>
                </div>
              )
            }

            // Interior cells of placed multi-cell idols — skip
            if (occupant && !isTopLeft) {
              return null
            }

            if (isPending) {
              return (
                <div
                  key={`${row}-${col}`}
                  className="aspect-square rounded text-xs flex flex-col items-start gap-0.5 p-0.5 overflow-auto"
                  style={{ backgroundColor: 'var(--color-bg-elevated)', gridColumn: `${col + 1}`, gridRow: `${row + 1}` }}
                >
                  <select
                    autoFocus
                    aria-label="Select idol type"
                    className="w-full text-xs rounded"
                    style={{
                      backgroundColor: 'var(--color-bg-base)',
                      color: 'var(--color-text-primary)',
                      outline: 'none',
                      fontSize: '0.6rem',
                    }}
                    defaultValue=""
                    onChange={(e) => {
                      const type = idolTypes.find((t) => t.id === e.target.value)
                      if (type) handleTypeSelect(row, col, type)
                    }}
                    onBlur={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return
                      setPendingCell((current) =>
                        current?.row === row && current?.col === col ? null : current
                      )
                      setPlacementError(null)
                    }}
                    onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
                  >
                    <option value="" disabled>Pick size</option>
                    {idolTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.displayName}</option>
                    ))}
                  </select>
                </div>
              )
            }

            return (
              <button
                key={`${row}-${col}`}
                aria-label={`Empty cell, row ${row + 1} col ${col + 1}. Click to place an idol.`}
                onClick={() => handleCellClick(row, col)}
                className="aspect-square rounded text-xs flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  outline: 'none',
                  gridColumn: `${col + 1}`,
                  gridRow: `${row + 1}`,
                }}
                onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
                onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
              >
                +
              </button>
            )
          })
        )}
      </div>

      {placementError && (
        <p role="alert" className="text-xs" style={{ color: 'var(--color-error, #f87171)' }}>
          {placementError}
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {placedCount} idol{placedCount !== 1 ? 's' : ''} placed
        </span>
        <button
          onClick={handleReset}
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-secondary)',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-accent-gold)' }}
          onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
        >
          Reset all idols
        </button>
      </div>
    </div>
  )
}
