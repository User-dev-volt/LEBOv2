import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { SkillInput } from './SkillInput'
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
  isPersisted: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const initialState = useBuildStore.getState()

describe('SkillInput', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(mockBuild)
  })

  it('renders all 5 skill slots', () => {
    render(<SkillInput />)
    const slotIds = ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4']
    for (const slotId of slotIds) {
      expect(screen.getByTestId(`skill-slot-${slotId}`)).toBeInTheDocument()
    }
  })

  it('shows assigned skill name from store', () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      contextData: {
        gear: [],
        skills: [{ slotId: 'slot-1', skillId: 'smite', skillName: 'Smite' }],
        idols: [],
      },
    })
    render(<SkillInput />)
    expect(screen.getByTestId('skill-name-slot-1')).toHaveTextContent('Smite')
  })

  it('shows placeholder for empty slots', () => {
    render(<SkillInput />)
    expect(screen.getByTestId('skill-name-slot-0')).toHaveTextContent('No skill selected')
  })

  it('updates display when store changes', () => {
    render(<SkillInput />)
    expect(screen.getByTestId('skill-name-slot-2')).toHaveTextContent('No skill selected')

    act(() => {
      useBuildStore.getState().setActiveBuild({
        ...mockBuild,
        contextData: {
          gear: [],
          skills: [{ slotId: 'slot-2', skillId: 'void-cleave', skillName: 'Void Cleave' }],
          idols: [],
        },
      })
    })

    expect(screen.getByTestId('skill-name-slot-2')).toHaveTextContent('Void Cleave')
  })
})
