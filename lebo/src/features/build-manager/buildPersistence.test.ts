import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BuildState, BuildMeta } from '../../shared/types/build'
import { MAX_CHARACTER_LEVEL } from '../../shared/utils/budgetCalculator'

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

vi.mock('../../shared/components/Toast', () => ({
  showErrorToast: vi.fn(),
  showInfoToast: vi.fn(),
  showSuccessToast: vi.fn(),
}))

import { invokeCommand } from '../../shared/utils/invokeCommand'
import { showErrorToast } from '../../shared/components/Toast'
import {
  migrateBuildState,
  saveBuild,
  loadBuildsList,
  loadBuild,
  deleteBuild,
  renameBuild,
} from './buildPersistence'
import { useBuildStore } from '../../shared/stores/buildStore'

const mockInvoke = vi.mocked(invokeCommand)
const mockShowErrorToast = vi.mocked(showErrorToast)

const mockBuild: BuildState = {
  schemaVersion: 1,
  id: 'build-1',
  name: 'Void Knight',
  classId: 'sentinel',
  masteryId: 'void_knight',
  characterLevel: 1,
  budgetEnforced: false,
  nodeAllocations: { 'node-a': 1 },
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
  name: 'Void Knight',
  classId: 'sentinel',
  masteryId: 'void_knight',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const initialBuildState = useBuildStore.getState()

describe('migrateBuildState', () => {
  it('migrates a schemaVersion 1 build to schemaVersion 2', () => {
    const raw = { ...mockBuild }
    const result = migrateBuildState(raw)
    expect(result.schemaVersion).toBe(2)
    expect(result.id).toBe('build-1')
    expect(result.name).toBe('Void Knight')
    expect(result.classId).toBe('sentinel')
    expect(result.masteryId).toBe('void_knight')
    expect(result.nodeAllocations).toEqual({ 'node-a': 1 })
    expect(result.isPersisted).toBe(true)
  })

  it('applies defaults for missing fields', () => {
    const raw = { id: 'x', name: 'Test' }
    const result = migrateBuildState(raw)
    expect(result.classId).toBe('')
    expect(result.masteryId).toBe('')
    expect(result.nodeAllocations).toEqual({})
    expect(result.contextData).toEqual({ gear: [], skills: [], idols: [] })
    expect(result.isPersisted).toBe(true)
  })

  it('throws for null input', () => {
    expect(() => migrateBuildState(null)).toThrow('STORAGE_ERROR')
  })

  it('clamps characterLevel below 1 to 1', () => {
    const result = migrateBuildState({ ...mockBuild, characterLevel: -50 })
    expect(result.characterLevel).toBe(1)
  })

  it('clamps characterLevel above MAX_CHARACTER_LEVEL to MAX_CHARACTER_LEVEL', () => {
    const result = migrateBuildState({ ...mockBuild, characterLevel: 9999 })
    expect(result.characterLevel).toBe(MAX_CHARACTER_LEVEL)
  })

  it('throws for non-object input', () => {
    expect(() => migrateBuildState('invalid')).toThrow('STORAGE_ERROR')
  })

  it('always sets isPersisted = true (loaded from DB)', () => {
    const raw = { ...mockBuild, isPersisted: false }
    const result = migrateBuildState(raw)
    expect(result.isPersisted).toBe(true)
  })

  it('defaults missing activeSkillLevels to {}', () => {
    const { activeSkillLevels: _, ...rawWithout } = mockBuild
    const result = migrateBuildState(rawWithout)
    expect(result.activeSkillLevels).toEqual({})
  })

  it('passes through existing activeSkillLevels', () => {
    const raw = { ...mockBuild, activeSkillLevels: { 'slot-0': 10 } }
    const result = migrateBuildState(raw)
    expect(result.activeSkillLevels).toEqual({ 'slot-0': 10 })
  })
})

describe('migrateBuildState — v2 migration', () => {
  it('converts v1 string affixes to AffixEntryV2 objects (AC2)', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: 'Test',
      contextData: {
        gear: [{ slotId: 'chest', itemName: 'Plate', affixes: ['Health', 'Armor'] }],
        skills: [],
        idols: [],
      },
    }
    const result = migrateBuildState(raw)
    expect(result.schemaVersion).toBe(2)
    expect(result.contextData.gear[0].affixes).toEqual([
      { name: 'Health', tier: undefined, value: undefined },
      { name: 'Armor', tier: undefined, value: undefined },
    ])
  })

  it('coerces null gear to [] and sets schemaVersion 2 (AC3)', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: 'Test',
      contextData: { gear: null, skills: [], idols: [] },
    }
    const result = migrateBuildState(raw)
    expect(result.schemaVersion).toBe(2)
    expect(result.contextData.gear).toEqual([])
  })

  it('coerces undefined gear to [] (AC3)', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: 'Test',
      contextData: { skills: [], idols: [] },
    }
    const result = migrateBuildState(raw)
    expect(result.schemaVersion).toBe(2)
    expect(result.contextData.gear).toEqual([])
  })

  it('preserves empty affixes array as empty AffixEntryV2[] (AC4)', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: 'Test',
      contextData: {
        gear: [{ slotId: 'helm', itemName: 'Crown', affixes: [] }],
        skills: [],
        idols: [],
      },
    }
    const result = migrateBuildState(raw)
    expect(result.schemaVersion).toBe(2)
    expect(result.contextData.gear[0].affixes).toEqual([])
  })

  it('v2 build preserves non-default sliderPosition and fineTuneWeights through passthrough (AC2 idempotency)', () => {
    const v2Build = {
      schemaVersion: 2,
      sliderPosition: 75,
      fineTuneWeights: { damage: 50, survivability: 25, speed: 25 },
      id: 'build-v2-idem',
      name: 'V2 Idempotency',
      classId: 'sentinel',
      masteryId: 'void_knight',
      characterLevel: 20,
      budgetEnforced: true,
      nodeAllocations: { 'node-a': 2 },
      skillNodeAllocations: {},
      activeSkillLevels: { 'skill-1': 15 },
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    }
    const result = migrateBuildState(v2Build)
    expect(result.schemaVersion).toBe(2)
    expect(result.sliderPosition).toBe(75)
    expect(result.fineTuneWeights).toEqual({ damage: 50, survivability: 25, speed: 25 })
    expect(result.nodeAllocations).toEqual({ 'node-a': 2 })
    expect(result.activeSkillLevels).toEqual({ 'skill-1': 15 })
    expect(result.characterLevel).toBe(20)
  })

  it('v2 build passes through migrateBuildState unchanged (AC5)', () => {
    const v2Build = {
      schemaVersion: 2,
      id: 'build-v2',
      name: 'V2 Build',
      classId: 'sentinel',
      masteryId: 'void_knight',
      characterLevel: 10,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: {
        gear: [{ slotId: 'chest', itemName: 'Plate', affixes: [{ name: 'Health', tier: 2 }] }],
        skills: [],
        idols: [],
      },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const result = migrateBuildState(v2Build)
    expect(result.schemaVersion).toBe(2)
    expect(result.contextData.gear[0].affixes).toEqual([{ name: 'Health', tier: 2 }])
  })

  it('v2 passthrough preserves affixId on affix entries', () => {
    const v2Build = {
      schemaVersion: 2,
      id: 'build-v2b',
      name: 'V2 Build',
      classId: 'sentinel',
      masteryId: 'void_knight',
      characterLevel: 10,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: {
        gear: [{ slotId: 'chest', itemName: 'Plate', affixes: [{ affixId: 'added_armor_15', name: 'Added Armor', tier: 3 }] }],
        skills: [],
        idols: [],
      },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const result = migrateBuildState(v2Build)
    expect(result.contextData.gear[0].affixes).toEqual([{ affixId: 'added_armor_15', name: 'Added Armor', tier: 3 }])
  })

  it('throws STORAGE_ERROR for unknown schemaVersion', () => {
    expect(() => migrateBuildState({ schemaVersion: 3, id: 'x', name: 'x' })).toThrow('STORAGE_ERROR: unknown schemaVersion 3')
  })

  it('v1 migration coerces object affix missing name to empty string name', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: 'Test',
      contextData: {
        gear: [{ slotId: 'chest', itemName: 'Plate', affixes: [{ affixId: 'orphan' }] }],
        skills: [],
        idols: [],
      },
    }
    const result = migrateBuildState(raw)
    expect(result.contextData.gear[0].affixes).toEqual([{ name: '', tier: undefined, value: undefined }])
  })
})

describe('migrateBuildState — goalPreset migration', () => {
  const base = { id: 'x', name: 'T', schemaVersion: 1 as const }

  it('maps "Maximize Damage" to sliderPosition 100 (AC1)', () => {
    const result = migrateBuildState({ ...base, goalPreset: 'Maximize Damage' })
    expect(result.sliderPosition).toBe(100)
    expect(result.fineTuneWeights).toBeNull()
    expect(result).not.toHaveProperty('goalPreset')
  })

  it('maps "Maximize Survivability" to sliderPosition 0 (AC2)', () => {
    const result = migrateBuildState({ ...base, goalPreset: 'Maximize Survivability' })
    expect(result.sliderPosition).toBe(0)
    expect(result.fineTuneWeights).toBeNull()
  })

  it('maps "Balanced" to sliderPosition 50 (AC3)', () => {
    const result = migrateBuildState({ ...base, goalPreset: 'Balanced' })
    expect(result.sliderPosition).toBe(50)
    expect(result.fineTuneWeights).toBeNull()
  })

  it('maps "Maximize Speed" to sliderPosition 50 with fineTuneWeights (AC4)', () => {
    const result = migrateBuildState({ ...base, goalPreset: 'Maximize Speed' })
    expect(result.sliderPosition).toBe(50)
    expect(result.fineTuneWeights).toEqual({ damage: 25, survivability: 0, speed: 75 })
  })

  it('defaults null goalPreset to sliderPosition 50 (AC5)', () => {
    const result = migrateBuildState({ ...base, goalPreset: null })
    expect(result.sliderPosition).toBe(50)
    expect(result.fineTuneWeights).toBeNull()
  })

  it('defaults absent goalPreset to sliderPosition 50 (AC5)', () => {
    const result = migrateBuildState({ ...base })
    expect(result.sliderPosition).toBe(50)
    expect(result.fineTuneWeights).toBeNull()
  })

  it('v2 passthrough preserves non-null fineTuneWeights (AC6)', () => {
    const v2 = {
      schemaVersion: 2 as const,
      id: 'v2',
      name: 'V2',
      classId: '',
      masteryId: '',
      characterLevel: 1,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      sliderPosition: 50,
      fineTuneWeights: { damage: 25, survivability: 0, speed: 75 },
    }
    const result = migrateBuildState(v2)
    expect(result.sliderPosition).toBe(50)
    expect(result.fineTuneWeights).toEqual({ damage: 25, survivability: 0, speed: 75 })
  })

  it('v2 passthrough preserves existing sliderPosition and fineTuneWeights (AC6)', () => {
    const v2 = {
      schemaVersion: 2 as const,
      id: 'v2',
      name: 'V2',
      classId: '',
      masteryId: '',
      characterLevel: 1,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      sliderPosition: 100,
      fineTuneWeights: null,
    }
    const result = migrateBuildState(v2)
    expect(result.sliderPosition).toBe(100)
    expect(result.fineTuneWeights).toBeNull()
  })

  it('v2 passthrough defaults absent sliderPosition to 50 (AC7)', () => {
    const v2 = {
      schemaVersion: 2 as const,
      id: 'v2',
      name: 'V2',
      classId: '',
      masteryId: '',
      characterLevel: 1,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const result = migrateBuildState(v2)
    expect(result.sliderPosition).toBe(50)
    expect(result.fineTuneWeights).toBeNull()
  })
})

describe('migrateBuildState — goalPreset loadBuild integration (AC8)', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useBuildStore.setState(initialBuildState, true)
  })

  it('loadBuild with v1 "Maximize Damage" produces activeBuild.sliderPosition = 100', async () => {
    const v1Build = {
      schemaVersion: 1,
      id: 'build-ac8',
      name: 'Damage Build',
      classId: 'sentinel',
      masteryId: 'void_knight',
      characterLevel: 50,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      goalPreset: 'Maximize Damage',
    }
    mockInvoke.mockResolvedValue(JSON.stringify(v1Build))
    await loadBuild('build-ac8')
    expect(useBuildStore.getState().activeBuild?.sliderPosition).toBe(100)
    expect(useBuildStore.getState().activeBuild?.fineTuneWeights).toBeNull()
  })
})

describe('saveBuild', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockShowErrorToast.mockReset()
    useBuildStore.setState(initialBuildState, true)
    mockInvoke.mockResolvedValue(undefined)
  })

  it('calls save_build command with correct args', async () => {
    await saveBuild(mockBuild)
    expect(mockInvoke).toHaveBeenCalledWith('save_build', expect.objectContaining({
      id: 'build-1',
      name: 'Void Knight',
      classId: 'sentinel',
      masteryId: 'void_knight',
      schemaVersion: 1,
      data: JSON.stringify(mockBuild),
      createdAt: mockBuild.createdAt,
      updatedAt: mockBuild.updatedAt,
    }))
  })

  it('sets activeBuild.isPersisted = true after save', async () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    await saveBuild(mockBuild)
    expect(useBuildStore.getState().activeBuild?.isPersisted).toBe(true)
  })

  it('adds new build to savedBuilds when not already in list', async () => {
    await saveBuild(mockBuild)
    const { savedBuilds } = useBuildStore.getState()
    expect(savedBuilds).toHaveLength(1)
    expect(savedBuilds[0].id).toBe('build-1')
  })

  it('updates existing entry in savedBuilds when build already saved', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    const updatedBuild = { ...mockBuild, name: 'Renamed VK' }
    await saveBuild(updatedBuild)
    const { savedBuilds } = useBuildStore.getState()
    expect(savedBuilds).toHaveLength(1)
    expect(savedBuilds[0].name).toBe('Renamed VK')
  })

  it('saves a v2 build with schemaVersion 2 in invoke args', async () => {
    const v2Build: BuildState = {
      schemaVersion: 2,
      sliderPosition: 50,
      fineTuneWeights: null,
      id: 'build-v2',
      name: 'V2 Build',
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
    await saveBuild(v2Build)
    expect(mockInvoke).toHaveBeenCalledWith('save_build', expect.objectContaining({
      schemaVersion: 2,
    }))
    const callArgs = mockInvoke.mock.calls.at(-1)![1] as Record<string, unknown>
    const parsed = JSON.parse(callArgs.data as string) as Record<string, unknown>
    expect(parsed.sliderPosition).toBe(50)
    expect(parsed.fineTuneWeights).toBeNull()
  })

  it('calls showErrorToast and re-throws when invokeCommand rejects', async () => {
    mockInvoke.mockRejectedValue(new Error('db write failed'))
    await expect(saveBuild(mockBuild)).rejects.toThrow('db write failed')
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'Failed to save build. Your work is safe in memory — try again.'
    )
  })
})

describe('loadBuildsList', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useBuildStore.setState(initialBuildState, true)
  })

  it('calls load_builds_list and populates savedBuilds', async () => {
    mockInvoke.mockResolvedValue([mockMeta])
    await loadBuildsList()
    expect(useBuildStore.getState().savedBuilds).toHaveLength(1)
    expect(useBuildStore.getState().savedBuilds[0].id).toBe('build-1')
  })

  it('clears savedBuilds when list returns empty', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    mockInvoke.mockResolvedValue([])
    await loadBuildsList()
    expect(useBuildStore.getState().savedBuilds).toHaveLength(0)
  })
})

describe('loadBuild', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useBuildStore.setState(initialBuildState, true)
  })

  it('calls load_build with id and sets activeBuild', async () => {
    mockInvoke.mockResolvedValue(JSON.stringify(mockBuild))
    await loadBuild('build-1')
    expect(mockInvoke).toHaveBeenCalledWith('load_build', { id: 'build-1' })
    const s = useBuildStore.getState()
    expect(s.activeBuild?.id).toBe('build-1')
    expect(s.selectedClassId).toBe('sentinel')
    expect(s.selectedMasteryId).toBe('void_knight')
  })

  it('loaded build has isPersisted = true', async () => {
    mockInvoke.mockResolvedValue(JSON.stringify({ ...mockBuild, isPersisted: false }))
    await loadBuild('build-1')
    expect(useBuildStore.getState().activeBuild?.isPersisted).toBe(true)
  })

  it('preserves sliderPosition and fineTuneWeights on a v2 build loaded from disk', async () => {
    const v2Payload = {
      schemaVersion: 2,
      id: 'build-v2',
      name: 'V2 Build',
      classId: 'sentinel',
      masteryId: 'void_knight',
      characterLevel: 50,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      sliderPosition: 75,
      fineTuneWeights: { damage: 50, survivability: 25, speed: 25 },
    }
    mockInvoke.mockResolvedValue(JSON.stringify(v2Payload))
    await loadBuild('build-v2')
    expect(useBuildStore.getState().activeBuild?.sliderPosition).toBe(75)
    expect(useBuildStore.getState().activeBuild?.fineTuneWeights).toEqual({ damage: 50, survivability: 25, speed: 25 })
  })
})

describe('deleteBuild', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useBuildStore.setState(initialBuildState, true)
    mockInvoke.mockResolvedValue(undefined)
  })

  it('calls delete_build command and removes from savedBuilds', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    await deleteBuild('build-1')
    expect(mockInvoke).toHaveBeenCalledWith('delete_build', { id: 'build-1' })
    expect(useBuildStore.getState().savedBuilds).toHaveLength(0)
  })

  it('clears activeBuild if deleted build was active', async () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    useBuildStore.getState().setSavedBuilds([mockMeta])
    await deleteBuild('build-1')
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('does not clear activeBuild if a different build is active', async () => {
    const otherBuild = { ...mockBuild, id: 'build-2' }
    useBuildStore.getState().setActiveBuild(otherBuild)
    useBuildStore.getState().setSavedBuilds([mockMeta, { ...mockMeta, id: 'build-2', name: 'Other' }])
    await deleteBuild('build-1')
    expect(useBuildStore.getState().activeBuild?.id).toBe('build-2')
  })
})

describe('renameBuild', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useBuildStore.setState(initialBuildState, true)
    mockInvoke.mockResolvedValue(undefined)
  })

  it('calls rename_build command and updates savedBuilds name', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    await renameBuild('build-1', 'New Name')
    expect(mockInvoke).toHaveBeenCalledWith('rename_build', { id: 'build-1', newName: 'New Name' })
    expect(useBuildStore.getState().savedBuilds[0].name).toBe('New Name')
  })

  it('updates activeBuild name if rename target is active', async () => {
    useBuildStore.getState().setActiveBuild(mockBuild)
    useBuildStore.getState().setSavedBuilds([mockMeta])
    await renameBuild('build-1', 'Renamed')
    expect(useBuildStore.getState().activeBuild?.name).toBe('Renamed')
  })
})
