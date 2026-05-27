import { describe, it, expect, beforeEach } from 'vitest'
import { useBuildStore, selectAvailablePassivePoints } from './buildStore'
import type { BuildState, BuildMeta } from '../types/build'
import type { TreeData } from '../types/treeData'

const initialState = useBuildStore.getState()

const mockBuild: BuildState = {
  schemaVersion: 1,
  id: 'build-1',
  name: 'Test Lich',
  classId: 'acolyte',
  masteryId: 'lich',
  characterLevel: 1,
  budgetEnforced: false,
  nodeAllocations: { 'node-a': 1, 'node-b': 2 },
  skillNodeAllocations: {},
  activeSkillLevels: {},
  weaverAllocations: {},
  contextData: { gear: [], skills: [], idols: [] },
  isPersisted: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const mockMeta: BuildMeta = {
  id: 'build-1',
  name: 'Test Lich',
  classId: 'acolyte',
  masteryId: 'lich',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('buildStore', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('starts with null activeBuild and empty savedBuilds', () => {
    const s = useBuildStore.getState()
    expect(s.activeBuild).toBeNull()
    expect(s.savedBuilds).toHaveLength(0)
    expect(s.isImporting).toBe(false)
  })

  it('setActiveBuild stores the build', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    expect(useBuildStore.getState().activeBuild).toEqual(mockBuild)
  })

  it('setActiveBuild clears the build with null', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    useBuildStore.getState().setActiveBuild(null)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('setSavedBuilds replaces the full list', () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    expect(useBuildStore.getState().savedBuilds).toHaveLength(1)
    expect(useBuildStore.getState().savedBuilds[0].id).toBe('build-1')
  })

  it('setSavedBuilds can clear the list', () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    useBuildStore.getState().setSavedBuilds([])
    expect(useBuildStore.getState().savedBuilds).toHaveLength(0)
  })

  it('setIsImporting toggles the importing flag', () => {
    useBuildStore.getState().setIsImporting(true)
    expect(useBuildStore.getState().isImporting).toBe(true)
    useBuildStore.getState().setIsImporting(false)
    expect(useBuildStore.getState().isImporting).toBe(false)
  })

  it('starts with null selectedClassId and selectedMasteryId', () => {
    const s = useBuildStore.getState()
    expect(s.selectedClassId).toBeNull()
    expect(s.selectedMasteryId).toBeNull()
  })

  it('setSelectedClass sets classId and clears masteryId', () => {
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().setSelectedClass('sentinel')
    const s = useBuildStore.getState()
    expect(s.selectedClassId).toBe('sentinel')
    expect(s.selectedMasteryId).toBeNull()
  })

  it('setSelectedClass clears activeBuild and undoStack', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    useBuildStore.getState().setSelectedClass('mage')
    const s = useBuildStore.getState()
    expect(s.activeBuild).toBeNull()
    expect(s.undoStack).toHaveLength(0)
  })

  it('createBuild creates a BuildState with the given mastery name', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().createBuild('Void Knight')
    const s = useBuildStore.getState()
    expect(s.activeBuild).not.toBeNull()
    expect(s.activeBuild!.name).toBe('Void Knight')
    expect(s.activeBuild!.classId).toBe('sentinel')
    expect(s.activeBuild!.masteryId).toBe('void_knight')
    expect(s.activeBuild!.nodeAllocations).toEqual({})
    expect(s.activeBuild!.schemaVersion).toBe(2)
    expect(s.activeBuild!.isPersisted).toBe(false)
    expect(s.undoStack).toHaveLength(0)
  })

  it('createBuild initializes characterLevel: 1 and budgetEnforced: false', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().createBuild('Void Knight')
    const s = useBuildStore.getState()
    expect(s.activeBuild!.characterLevel).toBe(1)
    expect(s.activeBuild!.budgetEnforced).toBe(false)
  })

  it('createBuild initializes activeSkillLevels: {}', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().createBuild('Void Knight')
    const s = useBuildStore.getState()
    expect(s.activeBuild!.activeSkillLevels).toEqual({})
  })

  it('createBuild initializes with schemaVersion 2', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().createBuild('Void Knight')
    const s = useBuildStore.getState()
    expect(s.activeBuild!.schemaVersion).toBe(2)
    expect(s.activeBuild!.sliderPosition).toBe(50)
    expect(s.activeBuild!.fineTuneWeights).toBeNull()
  })

  it('createBuild is a no-op when class or mastery is not selected', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    // no mastery selected
    useBuildStore.getState().createBuild('Void Knight')
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('createBuild is idempotent when same class and mastery already active', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().createBuild('Void Knight')
    const firstId = useBuildStore.getState().activeBuild!.id
    // Allocate a point so we can verify the build is not wiped
    useBuildStore.getState().setActiveBuild({
      ...useBuildStore.getState().activeBuild!,
      nodeAllocations: { 'node-a': 1 },
    })
    useBuildStore.getState().createBuild('Void Knight')
    const s = useBuildStore.getState()
    expect(s.activeBuild!.id).toBe(firstId)
    expect(s.activeBuild!.nodeAllocations['node-a']).toBe(1)
  })

  it('setActiveBuildPersisted sets isPersisted = true on activeBuild', () => {
    useBuildStore.getState().setActiveBuild({ ...mockBuild, isPersisted: false })
    useBuildStore.getState().setActiveBuildPersisted()
    expect(useBuildStore.getState().activeBuild!.isPersisted).toBe(true)
  })

  it('setActiveBuildPersisted is a no-op when activeBuild is null', () => {
    useBuildStore.getState().setActiveBuildPersisted()
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('clearActiveBuild clears build, classId, masteryId, and undoStack', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    useBuildStore.getState().setActiveBuild(mockBuild)
    useBuildStore.getState().clearActiveBuild()
    const s = useBuildStore.getState()
    expect(s.activeBuild).toBeNull()
    expect(s.selectedClassId).toBeNull()
    expect(s.selectedMasteryId).toBeNull()
    expect(s.undoStack).toHaveLength(0)
  })

  it('setSelectedMastery sets masteryId without touching classId', () => {
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    const s = useBuildStore.getState()
    expect(s.selectedClassId).toBe('sentinel')
    expect(s.selectedMasteryId).toBe('void_knight')
  })
})

describe('buildStore — setCharacterLevel and setBudgetEnforced', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(mockBuild)
  })

  it('setCharacterLevel updates activeBuild.characterLevel', () => {
    useBuildStore.getState().setCharacterLevel(50)
    expect(useBuildStore.getState().activeBuild!.characterLevel).toBe(50)
  })

  it('setCharacterLevel sets isPersisted: false and updates updatedAt', () => {
    useBuildStore.getState().setActiveBuild({ ...mockBuild, isPersisted: true })
    const before = useBuildStore.getState().activeBuild!.updatedAt
    useBuildStore.getState().setCharacterLevel(42)
    const s = useBuildStore.getState().activeBuild!
    expect(s.isPersisted).toBe(false)
    expect(s.updatedAt).not.toBe(before)
  })

  it('setCharacterLevel is a no-op when activeBuild is null', () => {
    useBuildStore.getState().setActiveBuild(null)
    useBuildStore.getState().setCharacterLevel(50)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('setBudgetEnforced updates activeBuild.budgetEnforced', () => {
    useBuildStore.getState().setBudgetEnforced(true)
    expect(useBuildStore.getState().activeBuild!.budgetEnforced).toBe(true)
  })

  it('setBudgetEnforced sets isPersisted: false and updates updatedAt', () => {
    useBuildStore.getState().setActiveBuild({ ...mockBuild, isPersisted: true })
    const before = useBuildStore.getState().activeBuild!.updatedAt
    useBuildStore.getState().setBudgetEnforced(true)
    const s = useBuildStore.getState().activeBuild!
    expect(s.isPersisted).toBe(false)
    expect(s.updatedAt).not.toBe(before)
  })

  it('setBudgetEnforced is a no-op when activeBuild is null', () => {
    useBuildStore.getState().setActiveBuild(null)
    useBuildStore.getState().setBudgetEnforced(true)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('buildStore — setSkillLevel', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(mockBuild)
  })

  it('sets activeSkillLevels[slotId] for the given slot', () => {
    useBuildStore.getState().setSkillLevel('slot-0', 12)
    expect(useBuildStore.getState().activeBuild!.activeSkillLevels['slot-0']).toBe(12)
  })

  it('sets isPersisted: false and updates updatedAt', () => {
    useBuildStore.getState().setActiveBuild({ ...mockBuild, isPersisted: true })
    const before = useBuildStore.getState().activeBuild!.updatedAt
    useBuildStore.getState().setSkillLevel('slot-0', 5)
    const s = useBuildStore.getState().activeBuild!
    expect(s.isPersisted).toBe(false)
    expect(s.updatedAt).not.toBe(before)
  })

  it('preserves existing skill levels for other slots', () => {
    useBuildStore.getState().setSkillLevel('slot-0', 10)
    useBuildStore.getState().setSkillLevel('slot-1', 15)
    const s = useBuildStore.getState().activeBuild!
    expect(s.activeSkillLevels['slot-0']).toBe(10)
    expect(s.activeSkillLevels['slot-1']).toBe(15)
  })

  it('is a no-op when activeBuild is null', () => {
    useBuildStore.getState().setActiveBuild(null)
    useBuildStore.getState().setSkillLevel('slot-0', 10)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('selectAvailablePassivePoints', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('returns 0 when activeBuild is null', () => {
    const s = useBuildStore.getState()
    expect(selectAvailablePassivePoints(s)).toBe(0)
  })

  it('returns calculatePassivePoints(characterLevel) for the active build', () => {
    useBuildStore.getState().setActiveBuild({ ...mockBuild, characterLevel: 50 })
    const s = useBuildStore.getState()
    expect(selectAvailablePassivePoints(s)).toBe(48)
  })

  it('updates when setCharacterLevel is called', () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    useBuildStore.getState().setCharacterLevel(100)
    expect(selectAvailablePassivePoints(useBuildStore.getState())).toBe(98)
  })
})

// TreeData for applyNodeChange tests:
// root (maxPoints: 5, no prerequisites) → child (maxPoints: 3, requires root)
const mockTreeData: TreeData = {
  nodes: [
    { id: 'root', x: 0, y: 0, size: 'large', maxPoints: 5, connections: ['child'], state: 'available' },
    { id: 'child', x: 100, y: 0, size: 'medium', maxPoints: 3, connections: ['root'], state: 'available' },
  ],
  edges: [{ fromId: 'root', toId: 'child' }],
}

describe('buildStore — applyNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
  })

  it('creates activeBuild on first allocation when activeBuild is null', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    const s = useBuildStore.getState()
    expect(s.activeBuild).not.toBeNull()
    expect(s.activeBuild!.classId).toBe('sentinel')
    expect(s.activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('auto-creates activeBuild with schemaVersion 2 defaults on first applyNodeChange', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    const s = useBuildStore.getState()
    expect(s.activeBuild!.schemaVersion).toBe(2)
    expect(s.activeBuild!.sliderPosition).toBe(50)
    expect(s.activeBuild!.fineTuneWeights).toBeNull()
  })

  it('allocates a root node (no prerequisites)', () => {
    const result = useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('fails to allocate child node when prerequisite not met', () => {
    const result = useBuildStore.getState().applyNodeChange('child', 1, mockTreeData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Prerequisite not met')
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('allocates child node when prerequisite is met', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    const result = useBuildStore.getState().applyNodeChange('child', 1, mockTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['child']).toBe(1)
  })

  it('deallocates a node with no dependents', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    const result = useBuildStore.getState().applyNodeChange('root', -1, mockTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBeUndefined()
  })

  it('blocks deallocation when a dependent node is allocated', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().applyNodeChange('child', 1, mockTreeData)
    const result = useBuildStore.getState().applyNodeChange('root', -1, mockTreeData)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Cannot remove/)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('blockedByDependents contains the dependent nodeId when decrement is blocked', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().applyNodeChange('child', 1, mockTreeData)
    const result = useBuildStore.getState().applyNodeChange('root', -1, mockTreeData)
    expect(result.blockedByDependents).toEqual(['child'])
  })

  it('does not exceed maxPoints on repeated left-clicks (AC#4)', () => {
    // root.maxPoints = 5; allocate 5 times then attempt a 6th
    for (let i = 0; i < 5; i++) {
      useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    }
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(5)
    const result = useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    expect(result.success).toBe(false)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(5)
  })

  it('does not go below 0 on right-click at zero allocation (AC#5)', () => {
    const result = useBuildStore.getState().applyNodeChange('root', -1, mockTreeData)
    expect(result.success).toBe(false)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('undoNodeChange restores previous allocations', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('undoNodeChange is a no-op when undoStack is empty', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().activeBuild).not.toBeNull()
  })
})

describe('buildStore — redoNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
  })

  it('redoNodeChange is a no-op when redoStack is empty', () => {
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('undoNodeChange pushes current state to redoStack', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    const afterAlloc = useBuildStore.getState().activeBuild
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(1)
    expect(useBuildStore.getState().redoStack[0]).toEqual(afterAlloc)
  })

  it('redoNodeChange restores the undone allocation', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    const afterAlloc = useBuildStore.getState().activeBuild
    useBuildStore.getState().undoNodeChange()
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['root']).toBe(1)
    expect(useBuildStore.getState().activeBuild).toEqual(afterAlloc)
  })

  it('new allocation clears redoStack', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(1)
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    expect(useBuildStore.getState().redoStack).toHaveLength(0)
  })

  it('redo pushes current state to undoStack (redo is undoable)', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    const beforeRedo = useBuildStore.getState().activeBuild
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().undoStack).toHaveLength(1)
    expect(useBuildStore.getState().undoStack[0]).toEqual(beforeRedo)
  })

  it('redoNodeChange clears redoStack entry after restoring', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().undoNodeChange()
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(2)
    useBuildStore.getState().redoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(1)
  })
})

describe('buildStore — updateContextGear', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('updates contextData.gear on activeBuild', () => {
    useBuildStore.getState().setActiveBuild({
      schemaVersion: 1,
      id: 'build-1',
      name: 'Test',
      classId: 'sentinel',
      masteryId: 'void_knight',
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
    })
    const gear = [{ slotId: 'helmet', itemName: 'Iron Helm', affixes: [{ name: '+10 HP' }] }]
    useBuildStore.getState().updateContextGear(gear)
    expect(useBuildStore.getState().activeBuild!.contextData.gear).toEqual(gear)
  })

  it('is a no-op when activeBuild is null', () => {
    const gear = [{ slotId: 'helmet', itemName: 'Iron Helm', affixes: [] }]
    useBuildStore.getState().updateContextGear(gear)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('buildStore — updateContextSkills', () => {
  const activeBuildBase = {
    schemaVersion: 1 as const,
    id: 'build-1',
    name: 'Test',
    classId: 'sentinel',
    masteryId: 'void_knight',
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

  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('updates contextData.skills on activeBuild', () => {
    useBuildStore.getState().setActiveBuild(activeBuildBase)
    const skills = [{ slotId: 'skill1', skillId: '', skillName: 'Void Cleave' }]
    useBuildStore.getState().updateContextSkills(skills)
    expect(useBuildStore.getState().activeBuild!.contextData.skills).toEqual(skills)
  })

  it('sets isPersisted: false and updates updatedAt', () => {
    useBuildStore.getState().setActiveBuild({ ...activeBuildBase, isPersisted: true })
    const before = useBuildStore.getState().activeBuild!.updatedAt
    const skills = [{ slotId: 'skill1', skillId: '', skillName: 'Smite' }]
    useBuildStore.getState().updateContextSkills(skills)
    const state = useBuildStore.getState().activeBuild!
    expect(state.isPersisted).toBe(false)
    expect(state.updatedAt).not.toBe(before)
  })

  it('is a no-op when activeBuild is null', () => {
    const skills = [{ slotId: 'skill1', skillId: '', skillName: 'Void Cleave' }]
    useBuildStore.getState().updateContextSkills(skills)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('buildStore — updateContextIdols', () => {
  const activeBuildBase = {
    schemaVersion: 1 as const,
    id: 'build-1',
    name: 'Test',
    classId: 'sentinel',
    masteryId: 'void_knight',
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

  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('updates contextData.idols on activeBuild', () => {
    useBuildStore.getState().setActiveBuild(activeBuildBase)
    const idols = [{ slotId: 'idol1', idolType: 'Ornate Idol', modifiers: ['+50% Poison Damage'] }]
    useBuildStore.getState().updateContextIdols(idols)
    expect(useBuildStore.getState().activeBuild!.contextData.idols).toEqual(idols)
  })

  it('sets isPersisted: false and updates updatedAt', () => {
    useBuildStore.getState().setActiveBuild({ ...activeBuildBase, isPersisted: true })
    const before = useBuildStore.getState().activeBuild!.updatedAt
    const idols = [{ slotId: 'idol1', idolType: 'Grand Idol', modifiers: [] }]
    useBuildStore.getState().updateContextIdols(idols)
    const state = useBuildStore.getState().activeBuild!
    expect(state.isPersisted).toBe(false)
    expect(state.updatedAt).not.toBe(before)
  })

  it('is a no-op when activeBuild is null', () => {
    const idols = [{ slotId: 'idol1', idolType: 'Grand Idol', modifiers: [] }]
    useBuildStore.getState().updateContextIdols(idols)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

const buildWithSkill: BuildState = {
  schemaVersion: 1,
  id: 'build-2',
  name: 'Test Void Knight',
  classId: 'sentinel',
  masteryId: 'void_knight',
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

describe('buildStore — assignSkillToSlot', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(buildWithSkill)
  })

  it('adds entry to contextData.skills for the given slot', () => {
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'smite', skillName: 'Smite' })
    const skills = useBuildStore.getState().activeBuild!.contextData.skills
    expect(skills).toHaveLength(1)
    expect(skills[0]).toEqual({ slotId: 'slot-0', skillId: 'smite', skillName: 'Smite' })
  })

  it('replaces an existing skill in the same slot', () => {
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'smite', skillName: 'Smite' })
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'judgement', skillName: 'Judgement' })
    const skills = useBuildStore.getState().activeBuild!.contextData.skills
    expect(skills).toHaveLength(1)
    expect(skills[0].skillId).toBe('judgement')
  })

  it('clears skillNodeAllocations for the slot when a different skill is assigned', () => {
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'smite', skillName: 'Smite' })
    useBuildStore.setState((s) => ({
      activeBuild: s.activeBuild
        ? { ...s.activeBuild, skillNodeAllocations: { 'slot-0': { 'smite-core': 1 } } }
        : null,
    }))
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'judgement', skillName: 'Judgement' })
    const alloc = useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']
    expect(alloc).toEqual({})
  })

  it('preserves skillNodeAllocations when the same skill is re-assigned', () => {
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'smite', skillName: 'Smite' })
    useBuildStore.setState((s) => ({
      activeBuild: s.activeBuild
        ? { ...s.activeBuild, skillNodeAllocations: { 'slot-0': { 'smite-core': 1 } } }
        : null,
    }))
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'smite', skillName: 'Smite' })
    const alloc = useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']
    expect(alloc).toEqual({ 'smite-core': 1 })
  })
})

describe('buildStore — resetActiveTree', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
  })

  it('resetActiveTree("passive") clears passive allocations and pushes undo snapshot', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
    useBuildStore.getState().resetActiveTree('passive')
    expect(useBuildStore.getState().activeBuild!.nodeAllocations).toEqual({})
    expect(useBuildStore.getState().undoStack.length).toBeGreaterThan(0)
  })

  it('undoNodeChange after passive reset restores allocations', () => {
    useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    useBuildStore.getState().resetActiveTree('passive')
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('resetActiveTree("skill", slotId) clears only the targeted slot allocations', () => {
    useBuildStore.getState().setActiveBuild({
      schemaVersion: 1,
      id: 'build-x',
      name: 'Test',
      classId: 'sentinel',
      masteryId: 'void_knight',
      characterLevel: 1,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: { 'slot-0': { 'skill-root': 2 }, 'slot-1': { 'other-node': 1 } },
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
    useBuildStore.getState().resetActiveTree('skill', 'slot-0')
    const s = useBuildStore.getState()
    expect(s.activeBuild!.skillNodeAllocations['slot-0']).toEqual({})
    expect(s.activeBuild!.skillNodeAllocations['slot-1']).toEqual({ 'other-node': 1 })
  })

  it('resetActiveTree does nothing when activeBuild is null', () => {
    expect(() => useBuildStore.getState().resetActiveTree('passive')).not.toThrow()
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('buildStore — budget enforcement in applyNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
  })

  it('budgetEnforced: false allows allocation even when unspent = 0 (AC #1)', () => {
    // level 3 → calculatePassivePoints(3) = 1; root already allocated → budget exhausted
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      characterLevel: 3,
      budgetEnforced: false,
      nodeAllocations: { root: 1 },
    })
    // child prereq (root) is met; budget OFF → should succeed
    const result = useBuildStore.getState().applyNodeChange('child', 1, mockTreeData)
    expect(result.success).toBe(true)
  })

  it('budgetEnforced: true blocks allocation when unspent = 0 (AC #2)', () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      characterLevel: 3,
      budgetEnforced: true,
      nodeAllocations: { root: 1 },
    })
    const result = useBuildStore.getState().applyNodeChange('child', 1, mockTreeData)
    expect(result.success).toBe(false)
    expect(result.error).toBeUndefined()
  })

  it('budgetEnforced: true allows allocation when unspent > 0', () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      characterLevel: 5,
      budgetEnforced: true,
      nodeAllocations: {},
    })
    // calculatePassivePoints(5) = 3; 0 allocated → 3 unspent → should succeed
    const result = useBuildStore.getState().applyNodeChange('root', 1, mockTreeData)
    expect(result.success).toBe(true)
  })

  it('budget guard does not block deallocation (delta = -1) when enforced', () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      characterLevel: 3,
      budgetEnforced: true,
      nodeAllocations: { root: 1 },
    })
    const result = useBuildStore.getState().applyNodeChange('root', -1, mockTreeData)
    expect(result.success).toBe(true)
  })
})

describe('buildStore — budget enforcement in applySkillNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
  })

  it('budgetEnforced: true blocks allocation when skill unspent = 0 (AC #3)', () => {
    // activeSkillLevels['slot-0'] = 1 → calculateSkillPoints(1) = 1; root allocated → exhausted
    useBuildStore.getState().setActiveBuild({
      ...buildWithSkill,
      budgetEnforced: true,
      activeSkillLevels: { 'slot-0': 1 },
      skillNodeAllocations: { 'slot-0': { 'skill-root': 1 } },
    })
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-child', 1, mockSkillTreeData)
    expect(result.success).toBe(false)
    expect(result.error).toBeUndefined()
  })

  it('budgetEnforced: false allows allocation when skill unspent = 0 (AC #1)', () => {
    useBuildStore.getState().setActiveBuild({
      ...buildWithSkill,
      budgetEnforced: false,
      activeSkillLevels: { 'slot-0': 1 },
      skillNodeAllocations: { 'slot-0': { 'skill-root': 1 } },
    })
    // prereq met (skill-root allocated), budget OFF → should succeed
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-child', 1, mockSkillTreeData)
    expect(result.success).toBe(true)
  })

  it('budgetEnforced: true allows allocation when skill unspent > 0', () => {
    useBuildStore.getState().setActiveBuild({
      ...buildWithSkill,
      budgetEnforced: true,
      activeSkillLevels: { 'slot-0': 3 },
      skillNodeAllocations: {},
    })
    // calculateSkillPoints(3) = 3; 0 allocated → 3 unspent → should succeed
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-root', 1, mockSkillTreeData)
    expect(result.success).toBe(true)
  })

  it('budget guard does not block deallocation (delta = -1) when enforced', () => {
    useBuildStore.getState().setActiveBuild({
      ...buildWithSkill,
      budgetEnforced: true,
      activeSkillLevels: { 'slot-0': 1 },
      skillNodeAllocations: { 'slot-0': { 'skill-root': 1 } },
    })
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-root', -1, mockSkillTreeData)
    expect(result.success).toBe(true)
  })
})

const mockSkillTreeData: TreeData = {
  nodes: [
    { id: 'skill-root', x: 0, y: 0, size: 'large', maxPoints: 1, connections: ['skill-child'], state: 'available' },
    { id: 'skill-child', x: 100, y: 0, size: 'medium', maxPoints: 3, connections: ['skill-root'], state: 'locked' },
  ],
  edges: [{ fromId: 'skill-root', toId: 'skill-child' }],
}

describe('buildStore — applySkillNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(buildWithSkill)
  })

  it('increments allocation in skillNodeAllocations for the given slot', () => {
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-root', 1, mockSkillTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']['skill-root']).toBe(1)
  })

  it('blocks allocation when prerequisite not met', () => {
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-child', 1, mockSkillTreeData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Prerequisite not met')
  })

  it('allocates child node when prerequisite is met', () => {
    useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-root', 1, mockSkillTreeData)
    const result = useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-child', 1, mockSkillTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']['skill-child']).toBe(1)
  })

  it('does not affect nodeAllocations (passive tree)', () => {
    useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-root', 1, mockSkillTreeData)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations).toEqual({})
  })

  it('undoNodeChange restores previous skillNodeAllocations', () => {
    useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-root', 1, mockSkillTreeData)
    useBuildStore.getState().applySkillNodeChange('slot-0', 'skill-child', 1, mockSkillTreeData)
    useBuildStore.getState().undoNodeChange()
    const alloc = useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']
    expect(alloc['skill-root']).toBe(1)
    expect(alloc['skill-child']).toBeUndefined()
  })
})

const mockWeaverTreeData: TreeData = {
  nodes: [
    { id: 'w-hub', x: 0, y: 0, size: 'large', maxPoints: 3, connections: ['w-ring1'], state: 'available' },
    { id: 'w-ring1', x: 120, y: 0, size: 'medium', maxPoints: 3, connections: ['w-hub'], state: 'available' },
  ],
  edges: [{ fromId: 'w-hub', toId: 'w-ring1' }],
}

describe('buildStore — applyWeaverNodeChange', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild({ ...mockBuild, budgetEnforced: false, weaverAllocations: {} })
  })

  it('increments weaverAllocations for a given node', () => {
    const result = useBuildStore.getState().applyWeaverNodeChange('w-hub', 1, mockWeaverTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.weaverAllocations['w-hub']).toBe(1)
  })

  it('decrements weaverAllocations correctly', () => {
    useBuildStore.getState().applyWeaverNodeChange('w-hub', 1, mockWeaverTreeData)
    useBuildStore.getState().applyWeaverNodeChange('w-hub', 1, mockWeaverTreeData)
    const result = useBuildStore.getState().applyWeaverNodeChange('w-hub', -1, mockWeaverTreeData)
    expect(result.success).toBe(true)
    expect(useBuildStore.getState().activeBuild!.weaverAllocations['w-hub']).toBe(1)
  })

  it('does not go below 0', () => {
    const result = useBuildStore.getState().applyWeaverNodeChange('w-hub', -1, mockWeaverTreeData)
    expect(result.success).toBe(false)
  })

  it('does not affect nodeAllocations (passive tree)', () => {
    useBuildStore.getState().applyWeaverNodeChange('w-hub', 1, mockWeaverTreeData)
    expect(useBuildStore.getState().activeBuild!.nodeAllocations).toEqual({ 'node-a': 1, 'node-b': 2 })
  })

  it('pushes an undo snapshot on successful allocation', () => {
    const before = useBuildStore.getState().undoStack.length
    useBuildStore.getState().applyWeaverNodeChange('w-hub', 1, mockWeaverTreeData)
    expect(useBuildStore.getState().undoStack.length).toBe(before + 1)
  })

  it('blocks allocation when budget is exceeded (budgetEnforced=true)', () => {
    // Fill all 53 weaver points using w-hub (maxPoints: 1) by stuffing the store directly
    const filledAllocations: Record<string, number> = {}
    for (let i = 0; i < 53; i++) filledAllocations[`fake-node-${i}`] = 1
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      budgetEnforced: true,
      weaverAllocations: filledAllocations,
    })
    const result = useBuildStore.getState().applyWeaverNodeChange('w-hub', 1, mockWeaverTreeData)
    expect(result.success).toBe(false)
  })
})

describe('buildStore — resetActiveTree("weaver")', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild({ ...mockBuild, weaverAllocations: { 'w-hub': 1, 'w-ring1': 2 } })
  })

  it('clears weaverAllocations', () => {
    useBuildStore.getState().resetActiveTree('weaver')
    expect(useBuildStore.getState().activeBuild!.weaverAllocations).toEqual({})
  })

  it('does not clear nodeAllocations (passive tree)', () => {
    useBuildStore.getState().resetActiveTree('weaver')
    expect(useBuildStore.getState().activeBuild!.nodeAllocations).toEqual({ 'node-a': 1, 'node-b': 2 })
  })

  it('pushes an undo snapshot', () => {
    const before = useBuildStore.getState().undoStack.length
    useBuildStore.getState().resetActiveTree('weaver')
    expect(useBuildStore.getState().undoStack.length).toBe(before + 1)
  })

  it('does nothing when activeBuild is null', () => {
    useBuildStore.setState({ activeBuild: null })
    expect(() => useBuildStore.getState().resetActiveTree('weaver')).not.toThrow()
  })
})

describe('buildStore — setActiveBuildSliderPosition', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild({ ...mockBuild, sliderPosition: 50, isPersisted: true })
  })

  it('updates sliderPosition and marks build not persisted', () => {
    useBuildStore.getState().setActiveBuildSliderPosition(75)
    const s = useBuildStore.getState().activeBuild!
    expect(s.sliderPosition).toBe(75)
    expect(s.isPersisted).toBe(false)
  })

  it('clamps to 100 when value exceeds maximum', () => {
    useBuildStore.getState().setActiveBuildSliderPosition(150)
    expect(useBuildStore.getState().activeBuild!.sliderPosition).toBe(100)
  })

  it('clamps to 0 when value is below minimum', () => {
    useBuildStore.getState().setActiveBuildSliderPosition(-10)
    expect(useBuildStore.getState().activeBuild!.sliderPosition).toBe(0)
  })

  it('is a no-op when activeBuild is null', () => {
    useBuildStore.setState({ activeBuild: null })
    useBuildStore.getState().setActiveBuildSliderPosition(50)
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('buildStore — setActiveBuildFineTuneWeights', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild({ ...mockBuild, fineTuneWeights: null, isPersisted: true })
  })

  it('updates fineTuneWeights and marks build not persisted', () => {
    useBuildStore.getState().setActiveBuildFineTuneWeights({ damage: 40, survivability: 40, speed: 20 })
    const s = useBuildStore.getState().activeBuild!
    expect(s.fineTuneWeights).toEqual({ damage: 40, survivability: 40, speed: 20 })
    expect(s.isPersisted).toBe(false)
  })

  it('accepts null to clear fine-tune override', () => {
    useBuildStore.getState().setActiveBuildFineTuneWeights({ damage: 60, survivability: 30, speed: 10 })
    useBuildStore.getState().setActiveBuildFineTuneWeights(null)
    expect(useBuildStore.getState().activeBuild!.fineTuneWeights).toBeNull()
  })

  it('is a no-op when activeBuild is null', () => {
    useBuildStore.setState({ activeBuild: null })
    useBuildStore.getState().setActiveBuildFineTuneWeights({ damage: 50, survivability: 40, speed: 10 })
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })
})

describe('buildStore — skill role designation', () => {
  beforeEach(() => {
    useBuildStore.setState({
      ...initialState,
      activeBuild: mockBuild,
    }, true)
  })

  it('setSkillRole persists role for a slot', () => {
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBe('primary_offense')
  })

  it('clearSkillRole removes role for a slot', () => {
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    useBuildStore.getState().clearSkillRole('slot-0')
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBeUndefined()
  })

  it('assignSkillToSlot clears role when skill changes, preserves role when same skill re-assigned', () => {
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    // First assignment (slot was empty — counts as a skill change from undefined to erasing-strike)
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'erasing-strike', skillName: 'Erasing Strike' })
    // Re-assign same skill: role should persist
    useBuildStore.getState().setSkillRole('slot-0', 'primary_offense')
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'erasing-strike', skillName: 'Erasing Strike' })
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBe('primary_offense')
    // Different skill: role should be cleared
    useBuildStore.getState().assignSkillToSlot('slot-0', { skillId: 'warpath', skillName: 'Warpath' })
    expect(useBuildStore.getState().activeBuild?.skillRoles?.['slot-0']).toBeUndefined()
  })
})
