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
    {
      id: 'small-1x1',
      displayName: 'Small Idol',
      rows: 1,
      cols: 1,
      requiresBoth: false,
      prefixPool: [
        {
          id: 'idol-small-fire-res',
          displayName: 'Fireward',
          type: 'prefix',
          statKey: 'fire_resistance',
          modifierType: 'flat',
          tiers: [{ tier: 1, minValue: 3, maxValue: 4 }, { tier: 2, minValue: 5, maxValue: 6 }, { tier: 3, minValue: 7, maxValue: 9 }],
        },
      ],
      suffixPool: [],
    },
    {
      id: 'humble-1x2',
      displayName: 'Humble Idol',
      rows: 1,
      cols: 2,
      requiresBoth: true,
      prefixPool: [
        {
          id: 'idol-humble-max-hp',
          displayName: 'Stalwart',
          type: 'prefix',
          statKey: 'max_hp',
          modifierType: 'flat',
          tiers: [{ tier: 1, minValue: 20, maxValue: 30 }, { tier: 2, minValue: 35, maxValue: 45 }, { tier: 3, minValue: 50, maxValue: 65 }],
        },
      ],
      suffixPool: [
        {
          id: 'idol-humble-crit-chance',
          displayName: 'Sharpshooting',
          type: 'suffix',
          statKey: 'critical_strike_chance',
          modifierType: 'flat',
          tiers: [{ tier: 1, minValue: 5, maxValue: 7 }, { tier: 2, minValue: 8, maxValue: 10 }, { tier: 3, minValue: 12, maxValue: 15 }],
        },
      ],
    },
    { id: 'stout-1x3', displayName: 'Stout Idol', rows: 1, cols: 3, requiresBoth: true, prefixPool: [], suffixPool: [] },
    { id: 'grand-2x2', displayName: 'Grand Idol', rows: 2, cols: 2, requiresBoth: true, prefixPool: [], suffixPool: [] },
  ],
}

const mockPlaceIdol = vi.fn()
const mockClearIdolSlot = vi.fn()
const mockResetIdolGrid = vi.fn()
const mockUpdateIdolAffix = vi.fn()

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
    updateIdolAffix: mockUpdateIdolAffix,
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
    const blockedCells = grid.querySelectorAll('[aria-disabled="true"]')
    expect(blockedCells).toHaveLength(5)
  })

  it('blocked cells have aria-disabled="true" and no click response', () => {
    render(<IdolGrid />)
    const grid = screen.getByTestId('idol-grid')
    const blocked = grid.querySelectorAll('[aria-disabled="true"]')
    expect(blocked).toHaveLength(5)
    blocked.forEach((cell) => {
      expect(cell.tagName).not.toBe('BUTTON')
    })
  })

  it('clicking empty cell then selecting type and configuring affix calls placeIdol', () => {
    render(<IdolGrid />)
    const emptyCells = screen.getAllByRole('button', { name: /Empty cell, row 2 col 2/i })
    expect(emptyCells.length).toBeGreaterThan(0)
    fireEvent.click(emptyCells[0])

    const typeSelect = screen.getByRole('combobox', { name: /Select idol type/i })
    fireEvent.change(typeSelect, { target: { value: 'small-1x1' } })

    // IdolAffixPicker appears — select prefix
    const prefixSelect = screen.getByRole('combobox', { name: /Select prefix affix/i })
    fireEvent.change(prefixSelect, { target: { value: 'idol-small-fire-res' } })

    // Place button enabled for small-1x1 (requiresBoth: false)
    const placeBtn = screen.getByRole('button', { name: /Place idol/i })
    fireEvent.click(placeBtn)

    expect(mockPlaceIdol).toHaveBeenCalledOnce()
    const call = mockPlaceIdol.mock.calls[0][0] as PlacedIdol
    expect(call.row).toBe(1)
    expect(call.col).toBe(1)
    expect(call.idolTypeId).toBe('small-1x1')
    expect(call.prefixId).toBe('idol-small-fire-res')
    expect(call.prefixTier).toBe(1)
    expect(typeof call.id).toBe('string')
  })

  it('shows error when overlapping placement is attempted', () => {
    const existing: PlacedIdol[] = [
      { id: 'x', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)

    const cell = screen.getByRole('button', { name: /Empty cell, row 2 col 1/i })
    fireEvent.click(cell)
    const select = screen.getByRole('combobox', { name: /Select idol type/i })
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

  it('requiresBoth blocks placement when only prefix selected — Place button disabled with error', () => {
    render(<IdolGrid />)
    // Click a cell that can fit a 1×2 idol
    const cell = screen.getByRole('button', { name: /Empty cell, row 2 col 1/i })
    fireEvent.click(cell)
    const typeSelect = screen.getByRole('combobox', { name: /Select idol type/i })
    fireEvent.change(typeSelect, { target: { value: 'humble-1x2' } })

    // Select prefix only
    const prefixSelect = screen.getByRole('combobox', { name: /Select prefix affix/i })
    fireEvent.change(prefixSelect, { target: { value: 'idol-humble-max-hp' } })

    // Place button should be disabled because no suffix selected
    const placeBtn = screen.getByRole('button', { name: /Place idol/i })
    expect(placeBtn).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(/requires both a prefix and suffix/i)
    expect(mockPlaceIdol).not.toHaveBeenCalled()
  })

  it('clicking placed idol cell enters edit mode showing affix pickers', () => {
    const existing: PlacedIdol[] = [
      { id: 'e1', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)

    // Click on the placed idol div (not the × button)
    const idolCell = screen.getByRole('button', { name: /Humble Idol placed\. Click to edit affixes\./i })
    fireEvent.click(idolCell)

    // Edit mode: affix pickers visible
    expect(screen.getByRole('combobox', { name: /Select prefix affix/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Select suffix affix/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Done editing affix/i })).toBeInTheDocument()
  })

  it('edit mode: changing prefix calls updateIdolAffix with correct args', () => {
    const existing: PlacedIdol[] = [
      { id: 'e2', row: 1, col: 1, idolTypeId: 'humble-1x2' },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)

    const idolCell = screen.getByRole('button', { name: /Humble Idol placed\. Click to edit affixes\./i })
    fireEvent.click(idolCell)

    const prefixSelect = screen.getByRole('combobox', { name: /Select prefix affix/i })
    fireEvent.change(prefixSelect, { target: { value: 'idol-humble-max-hp' } })

    expect(mockUpdateIdolAffix).toHaveBeenCalledWith('e2', { prefixId: 'idol-humble-max-hp', prefixTier: 1 })
  })

  it('placed idol shows configured affix displayName in view mode', () => {
    const existing: PlacedIdol[] = [
      { id: 'v1', row: 1, col: 1, idolTypeId: 'humble-1x2', prefixId: 'idol-humble-max-hp', prefixTier: 2 },
    ]
    setupMocks({ idolGrid: existing })
    render(<IdolGrid />)
    expect(screen.getByText(/Stalwart T2/i)).toBeInTheDocument()
  })

  it('Cancel during placement clears configuringNew — cell returns to empty', () => {
    render(<IdolGrid />)
    const cell = screen.getByRole('button', { name: /Empty cell, row 2 col 1/i })
    fireEvent.click(cell)
    const typeSelect = screen.getByRole('combobox', { name: /Select idol type/i })
    fireEvent.change(typeSelect, { target: { value: 'small-1x1' } })

    // Picker is shown
    expect(screen.getByRole('combobox', { name: /Select prefix affix/i })).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /Cancel idol placement/i })
    fireEvent.click(cancelBtn)

    // Back to empty cell state
    expect(screen.queryByRole('combobox', { name: /Select prefix affix/i })).not.toBeInTheDocument()
  })
})
