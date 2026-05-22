import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('renders timeline headers', () => {
    render(<BlessingsPanel />)
    expect(screen.getByText('Blood, Frost, and Death')).toBeInTheDocument()
    expect(screen.getByText('The Age of Winter')).toBeInTheDocument()
  })

  it('renders dropdown per timeline with None option and blessings', () => {
    render(<BlessingsPanel />)
    const selects = screen.getAllByRole('combobox')
    expect(selects).toHaveLength(2)
    const noneOptions = screen.getAllByRole('option', { name: '— None —' })
    expect(noneOptions).toHaveLength(2)
    expect(screen.getByRole('option', { name: 'Twisted Memory' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bone Armor' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Gift of Winter' })).toBeInTheDocument()
  })

  it('selecting a blessing calls setBlessing with timelineId and blessingId', () => {
    render(<BlessingsPanel />)
    const bfdSelect = screen.getByRole('combobox', {
      name: 'Select blessing for Blood, Frost, and Death',
    })
    fireEvent.change(bfdSelect, { target: { value: 'bfd-twisted-memory' } })
    expect(mockSetBlessing).toHaveBeenCalledWith('blood-frost-death', 'bfd-twisted-memory')
  })

  it('selecting None calls setBlessing with null', () => {
    setupMocks({ activeBlessings: { 'blood-frost-death': 'bfd-twisted-memory' } })
    render(<BlessingsPanel />)
    const bfdSelect = screen.getByRole('combobox', {
      name: 'Select blessing for Blood, Frost, and Death',
    })
    fireEvent.change(bfdSelect, { target: { value: '' } })
    expect(mockSetBlessing).toHaveBeenCalledWith('blood-frost-death', null)
  })

  it('shows selected blessing stat summary', () => {
    setupMocks({ activeBlessings: { 'blood-frost-death': 'bfd-twisted-memory' } })
    render(<BlessingsPanel />)
    expect(
      screen.getByLabelText('Active blessing: Twisted Memory'),
    ).toBeInTheDocument()
    expect(screen.getByText(/\+30% increased cold damage/i)).toBeInTheDocument()
  })

  it('search filters visible options by name', () => {
    render(<BlessingsPanel />)
    const searchInput = screen.getByRole('textbox', {
      name: 'Search blessings for Blood, Frost, and Death',
    })
    fireEvent.change(searchInput, { target: { value: 'armor' } })
    expect(screen.getByRole('option', { name: 'Bone Armor' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Twisted Memory' })).not.toBeInTheDocument()
  })

  it('search is case-insensitive', () => {
    render(<BlessingsPanel />)
    const searchInput = screen.getByRole('textbox', {
      name: 'Search blessings for Blood, Frost, and Death',
    })
    fireEvent.change(searchInput, { target: { value: 'ARMOR' } })
    expect(screen.getByRole('option', { name: 'Bone Armor' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Twisted Memory' })).not.toBeInTheDocument()
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
