import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContextPanel } from './ContextPanel'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { BuildState } from '../../shared/types/build'

const mockBuild: BuildState = {
  schemaVersion: 1,
  id: 'build-1',
  name: 'Test Lich',
  classId: 'acolyte',
  masteryId: 'lich',
  characterLevel: 1,
  budgetEnforced: false,
  nodeAllocations: {},
  skillNodeAllocations: {},
  activeSkillLevels: {},
  weaverAllocations: {},
  contextData: { gear: [], skills: [], idols: [] },
  idolGrid: [],
  isPersisted: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const initialState = useBuildStore.getState()

describe('ContextPanel', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('renders three section testids when activeBuild exists', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    render(<ContextPanel />)
    expect(screen.getByTestId('context-section-gear')).toBeInTheDocument()
    expect(screen.getByTestId('context-section-skills')).toBeInTheDocument()
    expect(screen.getByTestId('context-section-idols')).toBeInTheDocument()
  })

  it('renders context-panel root testid', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    render(<ContextPanel />)
    expect(screen.getByTestId('context-panel')).toBeInTheDocument()
  })

  it('shows gear count indicator as 0 / 11 when no gear filled', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    render(<ContextPanel />)
    expect(screen.getByText('0 / 11')).toBeInTheDocument()
  })

  it('shows gear count indicator reflecting filled slots', () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      contextData: {
        gear: [
          { slotId: 'helmet', itemName: 'Iron Helm', affixes: [] },
          { slotId: 'body', itemName: 'Plate', affixes: [] },
          { slotId: 'gloves', itemName: '', affixes: [] },
        ],
        skills: [],
        idols: [],
      },
    })
    render(<ContextPanel />)
    expect(screen.getByText('2 / 11')).toBeInTheDocument()
  })

  it('shows skill count indicator as 0 / 5 when no skills filled', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    render(<ContextPanel />)
    expect(screen.getByText('0 / 5')).toBeInTheDocument()
  })

  it('shows idol count indicator as "0 placed" when no idols placed', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    render(<ContextPanel />)
    expect(screen.getByText('0 placed')).toBeInTheDocument()
  })
})
