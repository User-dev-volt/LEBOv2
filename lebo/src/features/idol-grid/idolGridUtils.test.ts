import { describe, it, expect } from 'vitest'
import {
  getCellsForPlacement,
  validatePlacement,
  getOccupantAt,
} from './idolGridUtils'
import type { IdolType } from '../../shared/types/contextDatabase'
import type { PlacedIdol } from '../../shared/types/build'

const gridConfig = {
  rows: 5,
  cols: 5,
  blockedCells: [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2]] as [number, number][],
}

const small: IdolType = {
  id: 'small-1x1',
  displayName: 'Small Idol',
  rows: 1,
  cols: 1,
  requiresBoth: false,
  prefixPool: [],
  suffixPool: [],
}

const humble: IdolType = {
  id: 'humble-1x2',
  displayName: 'Humble Idol',
  rows: 1,
  cols: 2,
  requiresBoth: true,
  prefixPool: [],
  suffixPool: [],
}

const stout: IdolType = {
  id: 'stout-1x3',
  displayName: 'Stout Idol',
  rows: 1,
  cols: 3,
  requiresBoth: true,
  prefixPool: [],
  suffixPool: [],
}

const grand: IdolType = {
  id: 'grand-2x2',
  displayName: 'Grand Idol',
  rows: 2,
  cols: 2,
  requiresBoth: true,
  prefixPool: [],
  suffixPool: [],
}

const allTypes = [small, humble, stout, grand]

describe('getCellsForPlacement', () => {
  it('returns single cell for 1×1 idol', () => {
    expect(getCellsForPlacement(1, 1, small)).toEqual([[1, 1]])
  })

  it('returns correct cells for 2×2 idol at (0,0)', () => {
    expect(getCellsForPlacement(0, 0, grand)).toEqual([
      [0, 0], [0, 1], [1, 0], [1, 1],
    ])
  })

  it('returns correct cells for 1×3 idol', () => {
    expect(getCellsForPlacement(2, 0, stout)).toEqual([[2, 0], [2, 1], [2, 2]])
  })
})

describe('validatePlacement', () => {
  it('accepts a valid 1×1 placement on an empty grid', () => {
    expect(validatePlacement(1, 1, small, gridConfig, [], allTypes)).toEqual({ valid: true })
  })

  it('rejects placement at a blocked corner cell', () => {
    const result = validatePlacement(0, 0, small, gridConfig, [], allTypes)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('blocked')
  })

  it('rejects placement at the center blocked cell', () => {
    const result = validatePlacement(2, 2, small, gridConfig, [], allTypes)
    expect(result.valid).toBe(false)
  })

  it('rejects 1×3 at col 3 (extends out of bounds to col 5)', () => {
    const result = validatePlacement(1, 3, stout, gridConfig, [], allTypes)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('does not fit')
  })

  it('rejects overlapping placement', () => {
    const existing: PlacedIdol[] = [
      { id: 'a', row: 1, col: 0, idolTypeId: 'humble-1x2' },
    ]
    const result = validatePlacement(1, 1, small, gridConfig, existing, allTypes)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('overlaps')
  })

  it('accepts a valid 2×2 in the bottom area (rows 3-4, cols 1-2)', () => {
    // (3,1),(3,2),(4,1),(4,2) — none are blocked cells
    expect(validatePlacement(3, 1, grand, gridConfig, [], allTypes)).toEqual({ valid: true })
  })

  it('rejects 2×2 when a 1×2 already occupies part of that space', () => {
    const existing: PlacedIdol[] = [
      { id: 'b', row: 3, col: 1, idolTypeId: 'humble-1x2' },
    ]
    // Grand at (3,1) would overlap humble at (3,1)+(3,2)
    const result = validatePlacement(3, 1, grand, gridConfig, existing, allTypes)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('overlaps')
  })
})

describe('getOccupantAt', () => {
  it('returns null when grid is empty', () => {
    expect(getOccupantAt(1, 1, [], allTypes)).toBeNull()
  })

  it('returns the placed idol occupying a cell', () => {
    const placed: PlacedIdol[] = [
      { id: 'x', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    expect(getOccupantAt(1, 1, placed, allTypes)).toEqual(placed[0])
    expect(getOccupantAt(1, 2, placed, allTypes)).toEqual(placed[0])
  })

  it('returns null for adjacent non-occupied cell', () => {
    const placed: PlacedIdol[] = [
      { id: 'y', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    expect(getOccupantAt(1, 3, placed, allTypes)).toBeNull()
  })

  it('returns correct idol when multiple idols placed', () => {
    const placed: PlacedIdol[] = [
      { id: 'p1', row: 0, col: 1, idolTypeId: 'small-1x1' },
      { id: 'p2', row: 3, col: 3, idolTypeId: 'grand-2x2' },
    ]
    expect(getOccupantAt(0, 1, placed, allTypes)).toEqual(placed[0])
    expect(getOccupantAt(4, 4, placed, allTypes)).toEqual(placed[1])
    expect(getOccupantAt(1, 1, placed, allTypes)).toBeNull()
  })
})
