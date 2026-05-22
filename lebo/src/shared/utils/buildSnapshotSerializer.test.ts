import { describe, it, expect } from 'vitest'
import { toBuildSnapshot } from './buildSnapshotSerializer'
import type { BuildState } from '../types/build'
import type { GameData } from '../types/gameData'

const minimalGameData = {} as GameData

function makeBuild(overrides: Partial<BuildState> = {}): BuildState {
  return {
    schemaVersion: 2,
    id: 'test-id',
    name: 'Test Build',
    classId: 'sentinel',
    masteryId: 'void-knight',
    characterLevel: 50,
    budgetEnforced: true,
    nodeAllocations: { 'node-1': 2, 'node-2': 1 },
    skillNodeAllocations: { 'slot-0': { 'skill-node-a': 1 } },
    activeSkillLevels: { 'slot-0': 15 },
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    sliderPosition: 70,
    isPersisted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('toBuildSnapshot', () => {
  it('maps core identity and allocation fields', () => {
    const snapshot = toBuildSnapshot(makeBuild(), minimalGameData)
    expect(snapshot.classId).toBe('sentinel')
    expect(snapshot.masteryId).toBe('void-knight')
    expect(snapshot.characterLevel).toBe(50)
    expect(snapshot.nodeAllocations).toEqual({ 'node-1': 2, 'node-2': 1 })
    expect(snapshot.skillNodeAllocations).toEqual({ 'slot-0': { 'skill-node-a': 1 } })
  })

  it('uses sliderPosition from build', () => {
    expect(toBuildSnapshot(makeBuild({ sliderPosition: 80 }), minimalGameData).sliderPosition).toBe(80)
  })

  it('defaults sliderPosition to 50 when absent', () => {
    expect(toBuildSnapshot(makeBuild({ sliderPosition: undefined }), minimalGameData).sliderPosition).toBe(50)
  })

  it('clamps sliderPosition to 0–100', () => {
    expect(toBuildSnapshot(makeBuild({ sliderPosition: 150 }), minimalGameData).sliderPosition).toBe(100)
    expect(toBuildSnapshot(makeBuild({ sliderPosition: -10 }), minimalGameData).sliderPosition).toBe(0)
  })

  it('excludes UI-only BuildState fields', () => {
    const snapshot = toBuildSnapshot(makeBuild(), minimalGameData) as unknown as Record<string, unknown>
    expect(snapshot['schemaVersion']).toBeUndefined()
    expect(snapshot['name']).toBeUndefined()
    expect(snapshot['isPersisted']).toBeUndefined()
    expect(snapshot['createdAt']).toBeUndefined()
    expect(snapshot['id']).toBeUndefined()
  })

  it('includes gear affixes with both affixId and tier; excludes incomplete entries', () => {
    const build = makeBuild({
      contextData: {
        gear: [
          {
            slotId: 'helm',
            itemName: 'Test Helm',
            affixes: [
              { name: 'Fire Res', affixId: 'fire-res', tier: 3 },
              { name: 'No ID affix', tier: 2 },         // missing affixId — excluded
              { name: 'No tier affix', affixId: 'x' },  // missing tier — excluded
            ],
          },
        ],
        skills: [],
        idols: [],
      },
    })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.gearSlots['helm']?.prefixes).toEqual([{ affixId: 'fire-res', tier: 3 }])
    expect(snapshot.gearSlots['helm']?.suffixes).toEqual([])
  })

  it('returns empty collections when Epic 3 fields absent from BuildState', () => {
    const snapshot = toBuildSnapshot(makeBuild(), minimalGameData)
    expect(snapshot.activeConditions).toEqual([])
    expect(snapshot.idolPlacements).toEqual([])
    expect(snapshot.blessings).toEqual([])
  })

  it('maps idolGrid placements to idolPlacements with row, col, idolSize', () => {
    const build = makeBuild({
      idolGrid: [
        { id: 'a1', row: 1, col: 0, idolTypeId: 'humble-1x2' },
        { id: 'b2', row: 3, col: 3, idolTypeId: 'grand-2x2' },
      ],
    })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.idolPlacements).toEqual([
      { row: 1, col: 0, idolSize: 'humble-1x2' },
      { row: 3, col: 3, idolSize: 'grand-2x2' },
    ])
  })

  it('maps activeConditions from BuildState', () => {
    const build = makeBuild({ activeConditions: ['on-hit', 'channelling'] })
    expect(toBuildSnapshot(build, minimalGameData).activeConditions).toEqual(['on-hit', 'channelling'])
  })

  it('maps placed idol with no affixes to idolPlacement without prefix/suffix fields', () => {
    const build = makeBuild({ idolGrid: [{ id: 'a1', row: 1, col: 0, idolTypeId: 'humble-1x2' }] })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.idolPlacements).toHaveLength(1)
    expect(snapshot.idolPlacements[0]).toEqual({ row: 1, col: 0, idolSize: 'humble-1x2' })
  })

  it('maps placed idol with prefix only (Small Idol pattern) to idolPlacement with prefix', () => {
    const build = makeBuild({
      idolGrid: [{
        id: 's1', row: 0, col: 1, idolTypeId: 'small-1x1',
        prefixId: 'idol-small-fire-res', prefixTier: 2,
      }],
    })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.idolPlacements[0]).toEqual({
      row: 0, col: 1, idolSize: 'small-1x1',
      prefix: { affixId: 'idol-small-fire-res', tier: 2 },
    })
    expect(snapshot.idolPlacements[0].suffix).toBeUndefined()
  })

  it('maps placed idol with prefix and suffix to full idolPlacement', () => {
    const build = makeBuild({
      idolGrid: [{
        id: 'idol-1',
        row: 1,
        col: 0,
        idolTypeId: 'humble-1x2',
        prefixId: 'idol-humble-max-hp',
        prefixTier: 2,
        suffixId: 'idol-humble-crit-chance',
        suffixTier: 3,
      }],
    })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.idolPlacements).toHaveLength(1)
    expect(snapshot.idolPlacements[0]).toEqual({
      row: 1,
      col: 0,
      idolSize: 'humble-1x2',
      prefix: { affixId: 'idol-humble-max-hp', tier: 2 },
      suffix: { affixId: 'idol-humble-crit-chance', tier: 3 },
    })
  })

  it('copies allocations without mutating the original build', () => {
    const build = makeBuild()
    const snapshot = toBuildSnapshot(build, minimalGameData)
    snapshot.nodeAllocations['injected'] = 99
    expect(build.nodeAllocations['injected']).toBeUndefined()
  })

  it('handles build with no gear gracefully', () => {
    const build = makeBuild({ contextData: { gear: [], skills: [], idols: [] } })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.gearSlots).toEqual({})
  })
})
