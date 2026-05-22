import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { IdolGrid } from './IdolGrid'
import type { IdolData } from '../../shared/types/contextDatabase'
import type { PlacedIdol } from '../../shared/types/build'

vi.mock('../../shared/stores/gameDataStore', () => ({
  useGameDataStore: vi.fn(),
}))
vi.mock('../../shared/stores/buildStore', () => ({
  useBuildStore: vi.fn(),
}))

import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

type AnySelector = (s: Record<string, unknown>) => unknown

const mockIdolData: IdolData = {
  version: 's4.1',
  defaultGrid: {
    rows: 5,
    cols: 5,
    blockedCells: [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2]],
  },
  altarVariants: [],
  idolTypes: [
    { id: 'small-1x1', displayName: 'Small Idol', rows: 1, cols: 1, requiresBoth: false, prefixPool: [], suffixPool: [] },
    { id: 'humble-1x2', displayName: 'Humble Idol', rows: 1, cols: 2, requiresBoth: true, prefixPool: [], suffixPool: [] },
    { id: 'stout-1x3', displayName: 'Stout Idol', rows: 1, cols: 3, requiresBoth: true, prefixPool: [], suffixPool: [] },
    { id: 'grand-2x2', displayName: 'Grand Idol', rows: 2, cols: 2, requiresBoth: true, prefixPool: [], suffixPool: [] },
  ],
}

const mockPlaceIdol = vi.fn()
const mockClearIdolSlot = vi.fn()
const mockResetIdolGrid = vi.fn()

function setupMocks(opts: {
  idolData?: IdolData | null
  idolGrid?: PlacedIdol[]
} = {}) {
  const gameDataState = { idolData: opts.idolData !== undefined ? opts.idolData : mockIdolData }
  const idolGrid = opts.idolGrid ?? []
  const buildState = {
    activeBuild: { idolGrid },
  }

  ;(useGameDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(gameDataState as Record<string, unknown>)
  )
  ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((sel: AnySelector) => {
    if (typeof sel === 'function') {
      return sel(buildState as Record<string, unknown>)
    }
    return buildState
  })
  // Provide getState for imperative calls
  ;(useBuildStore as unknown as { getState: () => unknown }).getState = () => ({
    placeIdol: mockPlaceIdol,
    clearIdolSlot: mockClearIdolSlot,
    resetIdolGrid: mockResetIdolGrid,
  })
}

describe('IdolGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders loading placeholder when idolData is null', () => {
    setupMocks({ idolData: null })
    render(<IdolGrid />)
    expect(screen.getByTestId('idol-grid-loading')).toBeInTheDocument()
  })

  it('renders 5×5 grid (20 interactive + 5 blocked cells) when idolData is present', () => {
    render(<IdolGrid />)
    const grid = screen.getByTestId('idol-grid')
    expect(grid).toBeInTheDocument()
    // 25 total cells (5×5), but blocked cells render as non-interactive divs
    // Interactive cells render as buttons; blocked cells render as divs with aria-hidden
    const blockedCells = grid.querySelectorAll('[aria-hidden="true"][aria-disabled="true"]')
    expect(blockedCells).toHaveLength(5)
  })

  it('blocked cells have aria-disabled="true" and no click response', () => {
    render(<IdolGrid />)
    const grid = screen.getByTestId('idol-grid')
    const blocked = grid.querySelectorAll('[aria-disabled="true"]')
    expect(blocked).toHaveLength(5)
    // They are not buttons
    blocked.forEach((cell) => {
      expect(cell.tagName).not.toBe('BUTTON')
    })
  })

  it('clicking empty cell then selecting type calls placeIdol', () => {
    render(<IdolGrid />)
    const emptyCells = screen.getAllByRole('button', { name: /Empty cell, row 2 col 2/i })
    expect(emptyCells.length).toBeGreaterThan(0)
    fireEvent.click(emptyCells[0])

    const select = screen.getByRole('combobox', { name: /Select idol type/i })
    fireEvent.change(select, { target: { value: 'small-1x1' } })

    expect(mockPlaceIdol).toHaveBeenCalledOnce()
    const call = mockPlaceIdol.mock.calls[0][0] as PlacedIdol
    expect(call.row).toBe(1)
    expect(call.col).toBe(1)
    expect(call.idolTypeId).toBe('small-1x1')
    expect(typeof call.id).toBe('string')
  })

  it('shows error when overlapping placement is attempted', () => {
    const existing: PlacedIdol[] = [
      { id: 'x', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)

    // Try to place at (1,0) which doesn't overlap, then at (1,2) as grand (would hit the humble at (1,1)-(1,2))
    // Find cell at row 1 col 0
    const cell = screen.getByRole('button', { name: /Empty cell, row 2 col 1/i })
    fireEvent.click(cell)
    const select = screen.getByRole('combobox', { name: /Select idol type/i })
    // Grand idol 2×2 at (1,0) → cells (1,0),(1,1),(2,0),(2,1) — (1,1) is occupied
    fireEvent.change(select, { target: { value: 'grand-2x2' } })

    expect(screen.getByRole('alert')).toHaveTextContent(/overlaps/i)
    expect(mockPlaceIdol).not.toHaveBeenCalled()
  })

  it('clicking clear button calls clearIdolSlot with idol id', () => {
    const existing: PlacedIdol[] = [
      { id: 'abc', row: 1, col: 1, idolTypeId: 'small-1x1' },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)

    const clearBtn = screen.getByRole('button', { name: /Small Idol placed\. Press to clear\./i })
    fireEvent.click(clearBtn)
    expect(mockClearIdolSlot).toHaveBeenCalledWith('abc')
  })

  it('"Reset all idols" button calls resetIdolGrid', () => {
    render(<IdolGrid />)
    const resetBtn = screen.getByRole('button', { name: /Reset all idols/i })
    fireEvent.click(resetBtn)
    expect(mockResetIdolGrid).toHaveBeenCalledOnce()
  })

  it('renders occupied cells when store has placed idols', () => {
    const existing: PlacedIdol[] = [
      { id: 'z', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)
    expect(screen.getByText('Humble Idol')).toBeInTheDocument()
  })

  it('accessibility: no violations', async () => {
    const { container } = render(<IdolGrid />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
