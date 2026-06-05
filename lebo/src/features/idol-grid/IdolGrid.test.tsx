import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { IdolEditor } from './IdolEditor'
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
  const buildState = { activeBuild: { idolGrid } }

  ;(useGameDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(gameDataState as Record<string, unknown>)
  )
  ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((sel: AnySelector) => {
    if (typeof sel === 'function') return sel(buildState as Record<string, unknown>)
    return buildState
  })
  ;(useBuildStore as unknown as { getState: () => unknown }).getState = () => ({
    placeIdol: mockPlaceIdol,
    clearIdolSlot: mockClearIdolSlot,
    resetIdolGrid: mockResetIdolGrid,
    updateIdolAffix: mockUpdateIdolAffix,
  })
}

function selectTray(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function setPrefix(value: string) {
  fireEvent.change(screen.getByRole('combobox', { name: /Select prefix affix/i }), { target: { value } })
}

function setSuffix(value: string) {
  fireEvent.change(screen.getByRole('combobox', { name: /Select suffix affix/i }), { target: { value } })
}

describe('IdolEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders loading placeholder when idolData is null', () => {
    setupMocks({ idolData: null })
    render(<IdolEditor />)
    expect(screen.getByTestId('idol-grid-loading')).toBeInTheDocument()
  })

  it('renders the configured grid (5×5) with blocked cells aria-disabled and not buttons', () => {
    render(<IdolEditor />)
    const grid = screen.getByTestId('idol-grid')
    const blocked = grid.querySelectorAll('[aria-disabled="true"]')
    expect(blocked).toHaveLength(5)
    blocked.forEach((cell) => expect(cell.tagName).not.toBe('BUTTON'))
  })

  it('tray lists one card per idol type, each with W×H label and name', () => {
    render(<IdolEditor />)
    expect(screen.getByRole('button', { name: /Small Idol/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Humble Idol/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stout Idol/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Grand Idol/i })).toBeInTheDocument()
    // Humble is 1×2 — its W×H label is present (shape box + descriptor line both show it)
    expect(within(screen.getByRole('button', { name: /Humble Idol/i })).getAllByText(/1×2/).length).toBeGreaterThan(0)
  })

  it('filter input narrows the tray cards by name (case-insensitive)', () => {
    render(<IdolEditor />)
    fireEvent.change(screen.getByLabelText(/Filter idols by name/i), { target: { value: 'humble' } })
    expect(screen.getByRole('button', { name: /Humble Idol/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Small Idol/i })).not.toBeInTheDocument()
  })

  it('selecting a tray card sets aria-pressed and reveals the affix picker', () => {
    render(<IdolEditor />)
    const card = screen.getByRole('button', { name: /Small Idol/i })
    expect(card).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: /Select prefix affix/i })).toBeInTheDocument()
  })

  it('clicking the same selected card again deselects it', () => {
    render(<IdolEditor />)
    const card = screen.getByRole('button', { name: /Small Idol/i })
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(card)
    expect(card).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('combobox', { name: /Select prefix affix/i })).not.toBeInTheDocument()
  })

  it('select → configure prefix → click a valid cell calls placeIdol with configured affixes', () => {
    render(<IdolEditor />)
    selectTray(/Small Idol/i)
    setPrefix('idol-small-fire-res')

    fireEvent.click(screen.getByRole('button', { name: /Place Small Idol here, row 2 col 2/i }))

    expect(mockPlaceIdol).toHaveBeenCalledOnce()
    const call = mockPlaceIdol.mock.calls[0][0] as PlacedIdol
    expect(call.row).toBe(1)
    expect(call.col).toBe(1)
    expect(call.idolTypeId).toBe('small-1x1')
    expect(call.prefixId).toBe('idol-small-fire-res')
    expect(call.prefixTier).toBe(1)
    expect(typeof call.id).toBe('string')
  })

  it('requiresBoth idol with only a prefix set does not place on cell click and shows the requires-both hint', () => {
    render(<IdolEditor />)
    selectTray(/Humble Idol/i)
    setPrefix('idol-humble-max-hp')

    fireEvent.click(screen.getByRole('button', { name: /Place Humble Idol here, row 2 col 2/i }))

    expect(mockPlaceIdol).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/requires both a prefix and suffix/i)
  })

  it('requiresBoth idol with both affixes set places with prefix and suffix', () => {
    render(<IdolEditor />)
    selectTray(/Humble Idol/i)
    setPrefix('idol-humble-max-hp')
    setSuffix('idol-humble-crit-chance')

    fireEvent.click(screen.getByRole('button', { name: /Place Humble Idol here, row 2 col 2/i }))

    expect(mockPlaceIdol).toHaveBeenCalledOnce()
    const call = mockPlaceIdol.mock.calls[0][0] as PlacedIdol
    expect(call.idolTypeId).toBe('humble-1x2')
    expect(call.prefixId).toBe('idol-humble-max-hp')
    expect(call.suffixId).toBe('idol-humble-crit-chance')
  })

  it('hovering a valid cell with a configured idol previews the footprint', () => {
    render(<IdolEditor />)
    selectTray(/Humble Idol/i)
    setPrefix('idol-humble-max-hp')
    setSuffix('idol-humble-crit-chance')

    // Hover the origin of a 1×2 placement — both footprint cells expose the place affordance.
    fireEvent.mouseEnter(screen.getByRole('button', { name: /Place Humble Idol here, row 2 col 2/i }))
    expect(screen.getByRole('button', { name: /Place Humble Idol here, row 2 col 3/i })).toBeInTheDocument()
  })

  it('clicking an occupied cell calls clearIdolSlot with the occupant id', () => {
    setupMocks({ idolGrid: [{ id: 'abc', row: 1, col: 1, idolTypeId: 'small-1x1' }] })
    render(<IdolEditor />)
    fireEvent.click(screen.getByRole('button', { name: /Small Idol placed\. Click to remove\./i }))
    expect(mockClearIdolSlot).toHaveBeenCalledWith('abc')
  })

  it('clicking outside the grid deselects the placing idol', () => {
    render(<IdolEditor />)
    selectTray(/Small Idol/i)
    expect(screen.getByRole('combobox', { name: /Select prefix affix/i })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('idol-editor'))
    expect(screen.queryByRole('combobox', { name: /Select prefix affix/i })).not.toBeInTheDocument()
  })

  it('Active Idol Stats summary lists a placed idol affix text', () => {
    setupMocks({
      idolGrid: [{ id: 'v1', row: 1, col: 1, idolTypeId: 'humble-1x2', prefixId: 'idol-humble-max-hp', prefixTier: 2 }],
    })
    render(<IdolEditor />)
    const summary = screen.getByRole('region', { name: /Active idol stats/i })
    expect(within(summary).getByText(/Stalwart T2/i)).toBeInTheDocument()
  })

  it('Active Idol Stats shows empty state when no idols are placed', () => {
    render(<IdolEditor />)
    expect(screen.getByText(/No idols placed\./i)).toBeInTheDocument()
  })

  it('"Reset all idols" calls resetIdolGrid', () => {
    render(<IdolEditor />)
    fireEvent.click(screen.getByRole('button', { name: /Reset all idols/i }))
    expect(mockResetIdolGrid).toHaveBeenCalledOnce()
  })

  it('accessibility: no violations (empty grid)', async () => {
    const { container } = render(<IdolEditor />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('accessibility: no violations with a selected idol and a placed idol', async () => {
    setupMocks({ idolGrid: [{ id: 'a', row: 0, col: 1, idolTypeId: 'small-1x1', prefixId: 'idol-small-fire-res', prefixTier: 1 }] })
    const { container } = render(<IdolEditor />)
    selectTray(/Humble Idol/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})
