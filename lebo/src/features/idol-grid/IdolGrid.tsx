import { useState } from 'react'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { IdolType } from '../../shared/types/contextDatabase'
import { validatePlacement, getOccupantAt } from './idolGridUtils'

export function IdolGrid() {
  const idolData = useGameDataStore((s) => s.idolData)
  const idolGrid = useBuildStore((s) => s.activeBuild?.idolGrid ?? [])

  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null)
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
    if (occupant) return
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
    useBuildStore.getState().placeIdol({
      id: crypto.randomUUID(),
      row,
      col,
      idolTypeId: idolType.id,
    })
  }

  function handleClear(idolId: string) {
    setPlacementError(null)
    useBuildStore.getState().clearIdolSlot(idolId)
  }

  function handleReset() {
    setPlacementError(null)
    useBuildStore.getState().resetIdolGrid()
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
                  aria-hidden="true"
                  className="aspect-square rounded text-xs flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--color-bg-base)',
                    cursor: 'not-allowed',
                    opacity: 0.3,
                  }}
                />
              )
            }

            if (occupant && isTopLeft) {
              const idolType = idolTypes.find((t) => t.id === occupant.idolTypeId)
              return (
                <div
                  key={`${row}-${col}`}
                  className="aspect-square rounded text-xs flex flex-col items-center justify-center gap-0.5 p-0.5"
                  style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)', gridColumn: `span ${idolType?.cols ?? 1}`, gridRow: `span ${idolType?.rows ?? 1}` }}
                >
                  <span className="font-semibold leading-tight text-center" style={{ fontSize: '0.6rem' }}>
                    {idolType?.displayName ?? occupant.idolTypeId}
                  </span>
                  <button
                    onClick={() => handleClear(occupant.id)}
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

            if (occupant && !isTopLeft) {
              return (
                <div
                  key={`${row}-${col}`}
                  aria-hidden="true"
                  className="aspect-square rounded"
                  style={{ backgroundColor: 'var(--color-accent-gold)', opacity: 0.5 }}
                />
              )
            }

            if (isPending) {
              return (
                <div
                  key={`${row}-${col}`}
                  className="aspect-square rounded text-xs flex flex-col items-start gap-0.5 p-0.5 overflow-auto"
                  style={{ backgroundColor: 'var(--color-bg-elevated)', gridColumn: 'span 1' }}
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
                    onBlur={() => setPendingCell(null)}
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
