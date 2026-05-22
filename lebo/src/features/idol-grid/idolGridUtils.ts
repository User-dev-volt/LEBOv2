import type { IdolType, IdolGrid as IdolGridConfig } from '../../shared/types/contextDatabase'
import type { PlacedIdol } from '../../shared/types/build'

export function getCellsForPlacement(
  row: number,
  col: number,
  idolType: IdolType,
): [number, number][] {
  const cells: [number, number][] = []
  for (let r = row; r < row + idolType.rows; r++) {
    for (let c = col; c < col + idolType.cols; c++) {
      cells.push([r, c])
    }
  }
  return cells
}

export function isBlockedCell(
  row: number,
  col: number,
  gridConfig: IdolGridConfig,
): boolean {
  return gridConfig.blockedCells.some(([br, bc]) => br === row && bc === col)
}

export function isOccupiedByAnother(
  cells: [number, number][],
  existing: PlacedIdol[],
  types: IdolType[],
): boolean {
  const occupiedCells = new Set<string>()
  for (const p of existing) {
    const t = types.find((t) => t.id === p.idolTypeId)
    if (!t) continue
    for (let r = p.row; r < p.row + t.rows; r++) {
      for (let c = p.col; c < p.col + t.cols; c++) {
        occupiedCells.add(`${r},${c}`)
      }
    }
  }
  return cells.some(([r, c]) => occupiedCells.has(`${r},${c}`))
}

export interface PlacementResult {
  valid: boolean
  error?: string
}

export function validatePlacement(
  row: number,
  col: number,
  idolType: IdolType,
  gridConfig: IdolGridConfig,
  existing: PlacedIdol[],
  allTypes: IdolType[],
): PlacementResult {
  const cells = getCellsForPlacement(row, col, idolType)
  for (const [r, c] of cells) {
    if (r < 0 || r >= gridConfig.rows || c < 0 || c >= gridConfig.cols) {
      return { valid: false, error: `${idolType.displayName} does not fit within the grid at this position` }
    }
    if (isBlockedCell(r, c, gridConfig)) {
      return { valid: false, error: `${idolType.displayName} would overlap a blocked cell` }
    }
  }
  if (isOccupiedByAnother(cells, existing, allTypes)) {
    return { valid: false, error: `${idolType.displayName} overlaps an existing idol` }
  }
  return { valid: true }
}

export function getOccupantAt(
  row: number,
  col: number,
  placed: PlacedIdol[],
  types: IdolType[],
): PlacedIdol | null {
  for (const p of placed) {
    const t = types.find((t) => t.id === p.idolTypeId)
    if (!t) continue
    if (row >= p.row && row < p.row + t.rows && col >= p.col && col < p.col + t.cols) {
      return p
    }
  }
  return null
}
