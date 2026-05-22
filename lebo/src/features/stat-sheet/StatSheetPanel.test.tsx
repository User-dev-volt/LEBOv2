import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { StatSheetPanel } from './StatSheetPanel'
import type { StatSheet } from '../../shared/types/statSheet'

vi.mock('../../shared/stores/optimizationStore', () => ({
  useOptimizationStore: vi.fn(),
}))
vi.mock('../../shared/stores/buildStore', () => ({
  useBuildStore: vi.fn(),
  selectAvailablePassivePoints: (_s: unknown) => 98,
}))
vi.mock('../../shared/stores/gameDataStore', () => ({
  useGameDataStore: vi.fn(),
}))

import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

function makeStatSheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    offense: {
      damage_score: 100,
      avg_hit_damage: 500,
      avg_hit_damage_crit_weighted: 700,
      critical_strike_chance: 45,
      critical_strike_multiplier: 250,
      attack_speed: 1.2,
      cast_speed: null,
      aoe_modifier: 1.0,
    },
    defense: {
      effective_hp: 5000,
      raw_hp: 3500,
      ward: 0,
      endurance_percent: 30,
      endurance_threshold: 300,
      armor: 200,
      fire_resistance: 75,
      cold_resistance: 75,
      lightning_resistance: 75,
      void_resistance: 75,
      poison_resistance: 75,
      physical_resistance: 75,
      crit_avoidance: 100,
      dodge_chance: 0,
    },
    scores: {
      damage_score: 100,
      survivability_score: 80,
      speed_score: 60,
      build_score: 88,
    },
    ailment: null,
    minion: null,
    warnings: [],
    ...overrides,
  }
}

type AnySelector = (s: Record<string, unknown>) => unknown

function setupMocks(opts: {
  statSheet?: StatSheet | null
  isComputingStats?: boolean
} = {}) {
  const optState = {
    statSheet: opts.statSheet ?? null,
    isComputingStats: opts.isComputingStats ?? false,
  }
  const buildState = { activeBuild: null }
  const gameDataState = { gameData: null }

  ;(useOptimizationStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(optState as Record<string, unknown>)
  )
  ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(buildState as Record<string, unknown>)
  )
  ;(useGameDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(gameDataState as Record<string, unknown>)
  )
}

describe('StatSheetPanel', () => {
  beforeEach(() => {
    setupMocks()
  })

  it('renders 4 tabs when statSheet.minion is null', () => {
    setupMocks({ statSheet: makeStatSheet({ minion: null }) })
    render(<StatSheetPanel />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs[0]).toHaveTextContent('General')
    expect(tabs[1]).toHaveTextContent('Offense')
    expect(tabs[2]).toHaveTextContent('Defense')
    expect(tabs[3]).toHaveTextContent('Other')
  })

  it('renders 5 tabs and shows Minion tab when statSheet.minion is non-null', () => {
    setupMocks({ statSheet: makeStatSheet({ minion: {} }) })
    render(<StatSheetPanel />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(5)
    expect(tabs[3]).toHaveTextContent('Minion')
    expect(tabs[4]).toHaveTextContent('Other')
  })

  it('does not render Minion tab when statSheet is null', () => {
    setupMocks({ statSheet: null })
    render(<StatSheetPanel />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(screen.queryByRole('tab', { name: 'Minion' })).toBeNull()
  })

  it('shows loading indicator when isComputingStats is true', () => {
    setupMocks({ isComputingStats: true })
    render(<StatSheetPanel />)
    expect(screen.getByTestId('stat-sheet-loading')).toBeInTheDocument()
  })

  it('does not show loading indicator when isComputingStats is false', () => {
    setupMocks({ isComputingStats: false })
    render(<StatSheetPanel />)
    expect(screen.queryByTestId('stat-sheet-loading')).toBeNull()
  })

  it('shows warning gap label for uncapped resistance', () => {
    setupMocks({
      statSheet: makeStatSheet({
        defense: {
          ...makeStatSheet().defense,
          fire_resistance: 52,
        },
        warnings: [{ warning_type: 'fire_resistance_uncapped', current_value: 52, gap: 23 }],
      }),
    })
    render(<StatSheetPanel />)
    // Defense tab is not active by default — click it to render panel content
    fireEvent.click(screen.getByRole('tab', { name: 'Defense' }))
    expect(screen.getByText(/\+23% needed/)).toBeInTheDocument()
  })

  it('does not show gap label for capped resistance', () => {
    setupMocks({
      statSheet: makeStatSheet({ warnings: [] }),
    })
    render(<StatSheetPanel />)
    expect(screen.queryByText(/needed/)).toBeNull()
  })

  it('renders dash placeholders when statSheet is null', () => {
    setupMocks({ statSheet: null })
    render(<StatSheetPanel />)
    const dashElements = screen.getAllByText('—')
    expect(dashElements.length).toBeGreaterThan(0)
  })

  it('passes axe accessibility check on all tabs', async () => {
    setupMocks({ statSheet: makeStatSheet({ minion: {} }) })
    const { container } = render(<StatSheetPanel />)
    expect(await axe(container)).toHaveNoViolations()
    for (const tabName of ['Offense', 'Defense', 'Minion', 'Other']) {
      fireEvent.click(screen.getByRole('tab', { name: tabName }))
      expect(await axe(container)).toHaveNoViolations()
    }
  })
})
