import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { SkillRoleDesignator } from './SkillRoleDesignator'
import type { BuildState } from '../../shared/types/build'

const initialState = useBuildStore.getState()

function makeBuild(overrides: Partial<BuildState> = {}): BuildState {
  return {
    schemaVersion: 2 as const,
    id: 'test',
    name: 'Test Build',
    classId: 'sentinel',
    masteryId: 'void-knight',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: {
      gear: [],
      skills: [{ slotId: 'slot-0', skillId: 'erasing-strike', skillName: 'Erasing Strike' }],
      idols: [],
    },
    idolGrid: [],
    blessings: {},
    skillRoles: {},
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('SkillRoleDesignator', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('renders all 5 SKILL_SLOTS', () => {
    useBuildStore.setState({ activeBuild: makeBuild() })
    render(<SkillRoleDesignator />)
    expect(screen.getByText('Skill 1: Erasing Strike')).toBeInTheDocument()
    expect(screen.getByText(/Skill 2: Empty/)).toBeInTheDocument()
    expect(screen.getByText(/Skill 3: Empty/)).toBeInTheDocument()
    expect(screen.getByText(/Skill 4: Empty/)).toBeInTheDocument()
    expect(screen.getByText(/Skill 5: Empty/)).toBeInTheDocument()
  })

  it('shows skill name for assigned skills and Empty for unassigned', () => {
    useBuildStore.setState({ activeBuild: makeBuild() })
    render(<SkillRoleDesignator />)
    expect(screen.getByText('Skill 1: Erasing Strike')).toBeInTheDocument()
    expect(screen.getByText(/Skill 2: Empty/)).toBeInTheDocument()
  })

  it('clicking a role button sets the role via setSkillRole', () => {
    useBuildStore.setState({ activeBuild: makeBuild() })
    render(<SkillRoleDesignator />)
    fireEvent.click(screen.getByTestId('role-button-slot-0-primary_offense'))
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBe('primary_offense')
  })

  it('clicking the active role button clears the role via clearSkillRole', () => {
    useBuildStore.setState({
      activeBuild: makeBuild({ skillRoles: { 'slot-0': 'primary_offense' } }),
    })
    render(<SkillRoleDesignator />)
    fireEvent.click(screen.getByTestId('role-button-slot-0-primary_offense'))
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBeUndefined()
  })

  it('role buttons for empty slots are disabled', () => {
    useBuildStore.setState({ activeBuild: makeBuild() })
    render(<SkillRoleDesignator />)
    // slot-1 has no skill assigned
    const btn = screen.getByTestId('role-button-slot-1-primary_offense')
    expect(btn).toBeDisabled()
  })

  it('returns null when no active build', () => {
    useBuildStore.setState({ activeBuild: null })
    const { container } = render(<SkillRoleDesignator />)
    expect(container.firstChild).toBeNull()
  })
})
