import type { IdolType, IdolGrid as IdolGridConfig } from '../../shared/types/contextDatabase'
import type { PlacedIdol } from '../../shared/types/build'
import { getCellsForPlacement, validatePlacement, getOccupantAt, isBlockedCell } from './idolGridUtils'

interface IdolGridProps {
  gridConfig: IdolGridConfig
  idolTypes: IdolType[]
  idolGrid: PlacedIdol[]
  selectedType: IdolType | null
  hoverCell: { row: number; col: number } | null
  onHoverCell: (cell: { row: number; col: number } | null) => void
  onPlace: (row: number, col: number) => void
  onRemove: (idolId: string) => void
}

export function IdolGrid({
  gridConfig,
  idolTypes,
  idolGrid,
  selectedType,
  hoverCell,
  onHoverCell,
  onPlace,
  onRemove,
}: IdolGridProps) {
  // Preview footprint: only populated when the selected idol fully fits at the hovered origin.
  const previewCells = new Set<string>()
  if (selectedType && hoverCell) {
    const result = validatePlacement(hoverCell.row, hoverCell.col, selectedType, gridConfig, idolGrid, idolTypes)
    if (result.valid) {
      for (const [r, c] of getCellsForPlacement(hoverCell.row, hoverCell.col, selectedType)) {
        previewCells.add(`${r},${c}`)
      }
    }
  }

  function affixText(placed: PlacedIdol): string {
    const type = idolTypes.find((t) => t.id === placed.idolTypeId)
    const parts: string[] = []
    if (placed.prefixId) {
      const a = type?.prefixPool.find((p) => p.id === placed.prefixId)
      parts.push(`${a?.displayName ?? placed.prefixId} T${placed.prefixTier ?? 1}`)
    }
    if (placed.suffixId) {
      const a = type?.suffixPool.find((p) => p.id === placed.suffixId)
      parts.push(`${a?.displayName ?? placed.suffixId} T${placed.suffixTier ?? 1}`)
    }
    return parts.join(' · ')
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div
        data-testid="idol-grid"
        className="grid gap-1"
        aria-label="Idol placement grid"
        style={{ gridTemplateColumns: `repeat(${gridConfig.cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: gridConfig.rows }, (_, row) =>
          Array.from({ length: gridConfig.cols }, (_, col) => {
            const key = `${row}-${col}`
            const blocked = isBlockedCell(row, col, gridConfig)
            const occupant = getOccupantAt(row, col, idolGrid, idolTypes)
            const isTopLeft = occupant ? occupant.row === row && occupant.col === col : false

            if (blocked) {
              return (
                <div
                  key={key}
                  aria-disabled="true"
                  className="aspect-square rounded"
                  style={{ backgroundColor: 'var(--color-bg-base)', cursor: 'not-allowed', opacity: 0.3 }}
                />
              )
            }

            // Interior cells of a placed multi-cell idol are covered by the head cell's span.
            if (occupant && !isTopLeft) return null

            if (occupant && isTopLeft) {
              const type = idolTypes.find((t) => t.id === occupant.idolTypeId)
              const cols = type?.cols ?? 1
              const rows = type?.rows ?? 1
              const affixes = affixText(occupant)
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${type?.displayName ?? occupant.idolTypeId} placed. Click to remove.`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(occupant.id)
                  }}
                  className="rounded text-xs flex flex-col items-center justify-center gap-0.5 p-0.5"
                  style={{
                    backgroundColor: 'var(--color-accent-gold)',
                    color: 'var(--color-bg-base)',
                    cursor: 'pointer',
                    border: 'none',
                    gridColumn: `${col + 1} / span ${cols}`,
                    gridRow: `${row + 1} / span ${rows}`,
                  }}
                >
                  <span className="font-semibold leading-tight text-center" style={{ fontSize: '0.6rem' }}>
                    {type?.displayName ?? occupant.idolTypeId}
                  </span>
                  {affixes && (
                    <span className="leading-tight text-center" style={{ fontSize: '0.55rem' }}>
                      {affixes}
                    </span>
                  )}
                </button>
              )
            }

            // Empty cell.
            const inPreview = previewCells.has(`${row},${col}`)
            const fits = selectedType
              ? validatePlacement(row, col, selectedType, gridConfig, idolGrid, idolTypes).valid
              : false

            // With an idol selected, cells where it cannot fit as an origin are invalid and non-clickable.
            if (selectedType && !fits) {
              return (
                <div
                  key={key}
                  aria-disabled="true"
                  title={`Cannot place ${selectedType.displayName} here`}
                  className="aspect-square rounded"
                  style={{
                    backgroundColor: inPreview ? 'var(--color-bg-hover)' : 'var(--color-bg-elevated)',
                    opacity: 0.45,
                    cursor: 'not-allowed',
                  }}
                />
              )
            }

            const label = selectedType
              ? `Place ${selectedType.displayName} here, row ${row + 1} col ${col + 1}`
              : `Empty cell, row ${row + 1} col ${col + 1}`

            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                onClick={(e) => {
                  e.stopPropagation()
                  if (selectedType && fits) onPlace(row, col)
                }}
                onMouseEnter={() => {
                  if (selectedType) onHoverCell({ row, col })
                }}
                onMouseLeave={() => {
                  if (selectedType) onHoverCell(null)
                }}
                className="aspect-square rounded text-xs flex items-center justify-center"
                style={{
                  backgroundColor: inPreview ? 'var(--color-accent-gold-dim)' : 'var(--color-bg-elevated)',
                  color: inPreview ? 'var(--color-bg-base)' : 'var(--color-text-muted)',
                  cursor: selectedType ? 'pointer' : 'default',
                  border: 'none',
                  gridColumn: `${col + 1}`,
                  gridRow: `${row + 1}`,
                }}
              >
                {selectedType ? (inPreview ? '+' : '') : '+'}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
