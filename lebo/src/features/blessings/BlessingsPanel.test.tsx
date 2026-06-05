import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { BlessingsPanel } from './BlessingsPanel'
import type { BlessingEntry } from '../../shared/types/contextDatabase'

vi.mock('../../shared/stores/gameDataStore', () => ({
  useGameDataStore: vi.fn(),
}))
vi.mock('../../shared/stores/buildStore', () => ({
  useBuildStore: vi.fn(),
}))

import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

type AnySelector = (s: Record<string, unknown>) => unknown

const mockBlessings: BlessingEntry[] = [
  {
    id: 'bfd-twisted-memory',
    timelineId: 'blood-frost-death',
    timelineName: 'Blood, Frost, and Death',
    displayName: 'Twisted Memory',
    statEffects: [{ statKey: 'increased_cold_damage', value: 30, modifierType: 'increased' }],
  },
  {
    id: 'bfd-bone-armor',
    timelineId: 'blood-frost-death',
    timelineName: 'Blood, Frost, and Death',
    displayName: 'Bone Armor',
    statEffects: [{ statKey: 'armor', value: 120, modifierType: 'flat' }],
  },
  {
    id: 'aow-gift-of-winter',
    timelineId: 'age-of-winter',
    timelineName: 'The Age of Winter',
    displayName: 'Gift of Winter',
    statEffects: [{ statKey: 'cold_resistance', value: 18, modifierType: 'flat' }],
  },
]

const mockSetBlessing = vi.fn()
const mockAcknowledge = vi.fn()

function setupMocks(opts: {
  blessingsDatabase?: BlessingEntry[]
  isBlessingsDataStale?: boolean
  blessingsDataStaleAcknowledged?: boolean
  activeBlessings?: Record<string, string | null>
} = {}) {
  const gameDataState = {
    blessingsDatabase: opts.blessingsDatabase ?? mockBlessings,
    isBlessingsDataStale: opts.isBlessingsDataStale ?? false,
    blessingsDataStaleAcknowledged: opts.blessingsDataStaleAcknowledged ?? false,
    acknowledgeBlessingsDataStaleness: mockAcknowledge,
  }
  const buildState = {
    activeBuild: { blessings: opts.activeBlessings ?? {} },
    setBlessing: mockSetBlessing,
  }

  ;(useGameDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(gameDataState as Record<string, unknown>),
  )
  ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(buildState as Record<string, unknown>),
  )
}

describe('BlessingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders empty state when no blessings database', () => {
    setupMocks({ blessingsDatabase: [] })
    render(<BlessingsPanel />)
    expect(screen.getByText('Blessings data not loaded.')).toBeInTheDocument()
  })

  it('renders one card per timeline with timeline-name header', () => {
    render(<BlessingsPanel />)
    expect(screen.getByText('Blood, Frost, and Death')).toBeInTheDocument()
    expect(screen.getByText('The Age of Winter')).toBeInTheDocument()
    expect(screen.getByTestId('blessing-card-blood-frost-death')).toBeInTheDocument()
    expect(screen.getByTestId('blessing-card-age-of-winter')).toBeInTheDocument()
  })

  it('renders no combobox/dropdown anywhere in the panel', () => {
    render(<BlessingsPanel />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders each blessing as an inline button row plus a None row per card', () => {
    render(<BlessingsPanel />)
    const bfdCard = screen.getByTestId('blessing-card-blood-frost-death')
    expect(within(bfdCard).getByRole('button', { name: /Twisted Memory/ })).toBeInTheDocument()
    expect(within(bfdCard).getByRole('button', { name: /Bone Armor/ })).toBeInTheDocument()
    expect(within(bfdCard).getByRole('button', { name: 'None' })).toBeInTheDocument()

    const aowCard = screen.getByTestId('blessing-card-age-of-winter')
    expect(within(aowCard).getByRole('button', { name: /Gift of Winter/ })).toBeInTheDocument()
    expect(within(aowCard).getByRole('button', { name: 'None' })).toBeInTheDocument()
  })

  it('clicking a blessing row calls setBlessing with timelineId and blessingId', () => {
    render(<BlessingsPanel />)
    const bfdCard = screen.getByTestId('blessing-card-blood-frost-death')
    fireEvent.click(within(bfdCard).getByRole('button', { name: /Twisted Memory/ }))
    expect(mockSetBlessing).toHaveBeenCalledWith('blood-frost-death', 'bfd-twisted-memory')
  })

  it('clicking the None row clears that timeline blessing', () => {
    setupMocks({ activeBlessings: { 'blood-frost-death': 'bfd-twisted-memory' } })
    render(<BlessingsPanel />)
    const bfdCard = screen.getByTestId('blessing-card-blood-frost-death')
    fireEvent.click(within(bfdCard).getByRole('button', { name: 'None' }))
    expect(mockSetBlessing).toHaveBeenCalledWith('blood-frost-death', null)
  })

  it('marks the active blessing row with aria-pressed', () => {
    setupMocks({ activeBlessings: { 'blood-frost-death': 'bfd-twisted-memory' } })
    render(<BlessingsPanel />)
    const bfdCard = screen.getByTestId('blessing-card-blood-frost-death')
    expect(within(bfdCard).getByRole('button', { name: /Twisted Memory/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(bfdCard).getByRole('button', { name: /Bone Armor/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(bfdCard).getByRole('button', { name: 'None' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks the None row active when no blessing is set for the timeline', () => {
    render(<BlessingsPanel />)
    const bfdCard = screen.getByTestId('blessing-card-blood-frost-death')
    expect(within(bfdCard).getByRole('button', { name: 'None' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(bfdCard).getByRole('button', { name: /Twisted Memory/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('renders the per-row statEffects summary text', () => {
    render(<BlessingsPanel />)
    expect(screen.getByText(/\+30% increased cold damage/i)).toBeInTheDocument()
  })

  it('staleness banner shows when stale and not acknowledged', () => {
    setupMocks({ isBlessingsDataStale: true, blessingsDataStaleAcknowledged: false })
    render(<BlessingsPanel />)
    expect(screen.getByText('Blessings data may be outdated')).toBeInTheDocument()
  })

  it('staleness banner is hidden when acknowledged', () => {
    setupMocks({ isBlessingsDataStale: true, blessingsDataStaleAcknowledged: true })
    render(<BlessingsPanel />)
    expect(screen.queryByText('Blessings data may be outdated')).not.toBeInTheDocument()
  })

  it('dismiss button calls acknowledgeBlessingsDataStaleness', () => {
    setupMocks({ isBlessingsDataStale: true, blessingsDataStaleAcknowledged: false })
    render(<BlessingsPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss blessings staleness notice' }))
    expect(mockAcknowledge).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<BlessingsPanel />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
