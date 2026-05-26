import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useAppStore } from '../../shared/stores/appStore'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { GearOptimizationView } from './GearOptimizationView'
import type { BuildState } from '../../shared/types/build'

const initialBuildState = useBuildStore.getState()
const initialAppState = useAppStore.getState()
const initialOptimizationState = useOptimizationStore.getState()

function makeBuild(skillRoles: Record<string, string> = {}): BuildState {
  return {
    schemaVersion: 2 as const,
    id: 'test',
    name: 'Test',
    classId: 'sentinel',
    masteryId: 'void-knight',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    idolGrid: [],
    blessings: {},
    skillRoles: skillRoles as BuildState['skillRoles'],
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('GearOptimizationView', () => {
  beforeEach(() => {
    useBuildStore.setState(initialBuildState, true)
    useAppStore.setState(initialAppState, true)
    useOptimizationStore.setState(initialOptimizationState, true)
  })

  it('shows no-roles prompt when no roles are set', () => {
    useBuildStore.setState({ activeBuild: makeBuild({}) })
    render(<GearOptimizationView />)
    expect(screen.getByTestId('gear-optimization-no-roles-prompt')).toBeInTheDocument()
  })

  it('hides no-roles prompt when any role is set', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'secondary_offense' }) })
    render(<GearOptimizationView />)
    expect(screen.queryByTestId('gear-optimization-no-roles-prompt')).toBeNull()
  })

  it('clicking Analyze Gear with no Primary Offense shows error message', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'secondary_offense' }) })
    render(<GearOptimizationView />)
    fireEvent.click(screen.getByTestId('analyze-gear-button'))
    expect(screen.getByTestId('analyze-gear-error')).toHaveTextContent(
      'Please designate at least one skill as Primary Offense before running gear analysis'
    )
  })

  it('clicking Analyze Gear with Primary Offense set does NOT show error message', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'primary_offense' }) })
    render(<GearOptimizationView />)
    fireEvent.click(screen.getByTestId('analyze-gear-button'))
    expect(screen.queryByTestId('analyze-gear-error')).toBeNull()
  })

  it('back button navigates to main view', () => {
    useBuildStore.setState({ activeBuild: makeBuild() })
    render(<GearOptimizationView />)
    fireEvent.click(screen.getByTestId('gear-optimization-back-button'))
    expect(useAppStore.getState().currentView).toBe('main')
  })

  it('shows slot ranking list when gearAnalysis is available', () => {
    useOptimizationStore.setState({
      gearAnalysis: {
        slot_rankings: [{ slot: 'helmet', upgrade_score: 0, efficiency_percent: 100, ideal_prefix: [], ideal_suffix: [] }],
        priority_slot: '',
      },
      isAnalyzingGear: false,
    })
    useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'primary_offense' }) })
    render(<GearOptimizationView />)
    expect(screen.getByText('Helmet')).toBeInTheDocument()
    expect(screen.getByText('100% of ideal')).toBeInTheDocument()
  })

  it('hides slot ranking list when gearAnalysis is null', () => {
    useOptimizationStore.setState({ gearAnalysis: null })
    useBuildStore.setState({ activeBuild: makeBuild() })
    render(<GearOptimizationView />)
    expect(screen.queryByTestId('gear-slot-ranking-list')).toBeNull()
  })
})
