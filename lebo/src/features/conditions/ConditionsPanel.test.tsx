import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { ConditionsPanel } from './ConditionsPanel'
import type { ConditionEntry } from '../../shared/types/contextDatabase'

vi.mock('../../shared/stores/gameDataStore', () => ({
  useGameDataStore: vi.fn(),
}))
vi.mock('../../shared/stores/buildStore', () => ({
  useBuildStore: vi.fn(),
}))

import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

type AnySelector = (s: Record<string, unknown>) => unknown

const mockConditions: ConditionEntry[] = [
  {
    id: 'enemy_type',
    displayLabel: 'Enemy Type',
    category: 'universal',
    type: 'select',
    options: [
      { value: 'standard_mob', label: 'Standard Mob' },
      { value: 'pinnacle_boss', label: 'Pinnacle Boss' },
    ],
    defaultValue: 'standard_mob',
  },
  {
    id: 'power_charges',
    displayLabel: 'Power Charges',
    category: 'universal',
    type: 'range',
    min: 0,
    max: 3,
    step: 1,
    defaultValue: 0,
    options: [],
  },
  {
    id: 'sigil_of_hope_active',
    displayLabel: 'Sigil of Hope active',
    category: 'build-specific',
    type: 'toggle',
    defaultValue: false,
    options: [],
    filter: { classId: 'sentinel', skillTag: 'sigil_of_hope' },
  },
]

const mockSetConditionValue = vi.fn()

function setupMocks(opts: {
  conditionsDatabase?: ConditionEntry[] | null
  conditionValues?: Record<string, string | number | boolean>
  classId?: string
  skills?: { slotId: string; skillName: string; skillId: string }[]
} = {}) {
  const gameDataState = {
    conditionsDatabase: opts.conditionsDatabase !== undefined ? opts.conditionsDatabase : mockConditions,
  }
  const buildState = {
    activeBuild: {
      conditionValues: opts.conditionValues ?? {},
      classId: opts.classId ?? 'acolyte',
      contextData: { skills: opts.skills ?? [], gear: [], idols: [] },
    },
    setConditionValue: mockSetConditionValue,
  }

  ;(useGameDataStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(gameDataState as Record<string, unknown>),
  )
  ;(useBuildStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (sel: AnySelector) => sel(buildState as Record<string, unknown>),
  )
}

describe('ConditionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  it('renders empty state when no conditions database', () => {
    setupMocks({ conditionsDatabase: null })
    render(<ConditionsPanel />)
    expect(screen.getByText('Conditions data not loaded.')).toBeInTheDocument()
  })

  it('renders empty state when conditions database is empty array', () => {
    setupMocks({ conditionsDatabase: [] })
    render(<ConditionsPanel />)
    expect(screen.getByText('Conditions data not loaded.')).toBeInTheDocument()
  })

  it('renders universal conditions when database is loaded', () => {
    render(<ConditionsPanel />)
    expect(screen.getByLabelText('Enemy Type')).toBeInTheDocument()
    expect(screen.getByLabelText('Power Charges')).toBeInTheDocument()
  })

  it('calls setConditionValue with string when select changes', () => {
    render(<ConditionsPanel />)
    const select = screen.getByLabelText('Enemy Type')
    fireEvent.change(select, { target: { value: 'pinnacle_boss' } })
    expect(mockSetConditionValue).toHaveBeenCalledWith('enemy_type', 'pinnacle_boss')
  })

  it('calls setConditionValue with number when range changes', () => {
    render(<ConditionsPanel />)
    const slider = screen.getByLabelText('Power Charges')
    fireEvent.change(slider, { target: { value: '3' } })
    expect(mockSetConditionValue).toHaveBeenCalledWith('power_charges', 3)
  })

  it('hides build-specific condition when class filter does not match', () => {
    setupMocks({ classId: 'acolyte' })
    render(<ConditionsPanel />)
    expect(screen.queryByLabelText('Sigil of Hope active')).not.toBeInTheDocument()
  })

  it('hides build-specific condition when skill tag filter does not match', () => {
    setupMocks({
      classId: 'sentinel',
      skills: [{ slotId: 'slot-0', skillName: 'Warpath', skillId: 'warpath' }],
    })
    render(<ConditionsPanel />)
    expect(screen.queryByLabelText('Sigil of Hope active')).not.toBeInTheDocument()
  })

  it('shows build-specific condition when both class and skill filters match', () => {
    setupMocks({
      classId: 'sentinel',
      skills: [{ slotId: 'slot-0', skillName: 'Sigil of Hope', skillId: 'sigil_of_hope' }],
    })
    render(<ConditionsPanel />)
    expect(screen.getByLabelText('Sigil of Hope active')).toBeInTheDocument()
  })

  it('calls setConditionValue with boolean when toggle changes', () => {
    setupMocks({
      classId: 'sentinel',
      skills: [{ slotId: 'slot-0', skillName: 'Sigil of Hope', skillId: 'sigil_of_hope' }],
    })
    render(<ConditionsPanel />)
    const checkbox = screen.getByLabelText('Sigil of Hope active')
    fireEvent.click(checkbox)
    expect(mockSetConditionValue).toHaveBeenCalledWith('sigil_of_hope_active', true)
  })

  it('shows Build-specific section header only when build-specific conditions are visible', () => {
    // With acolyte class — sigil_of_hope_active is hidden — no "Build-specific" header
    setupMocks({ classId: 'acolyte' })
    render(<ConditionsPanel />)
    expect(screen.queryByText('Build-specific')).not.toBeInTheDocument()
  })

  it('accessibility: no violations', async () => {
    const { container } = render(<ConditionsPanel />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
