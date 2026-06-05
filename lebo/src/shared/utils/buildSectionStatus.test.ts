import { describe, it, expect } from 'vitest'
import { getSectionStatus } from './buildSectionStatus'
import type { BuildState } from '../types/build'

function makeBuild(overrides: Partial<BuildState> = {}): BuildState {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    schemaVersion: 2,
    id: 'b1',
    name: 'My Build',
    classId: 'acolyte',
    masteryId: 'necromancer',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    idolGrid: [],
    blessings: {},
    activeConditions: [],
    skillRoles: {},
    sliderPosition: 50,
    fineTuneWeights: null,
    isPersisted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('getSectionStatus — weaver entry', () => {
  it('returns a not-done weaver entry for a null build', () => {
    expect(getSectionStatus(null).weaver).toEqual({ count: '0 pts', full: false, done: false })
  })

  it('is not done with an empty weaverAllocations map', () => {
    expect(getSectionStatus(makeBuild({ weaverAllocations: {} })).weaver).toEqual({
      count: '0 pts',
      full: false,
      done: false,
    })
  })

  it('is done once at least 1 weaver point is allocated', () => {
    expect(getSectionStatus(makeBuild({ weaverAllocations: { x: 1 } })).weaver).toEqual({
      count: '1 pts',
      full: false,
      done: true,
    })
  })

  it('sums weaver points across nodes for the count', () => {
    expect(getSectionStatus(makeBuild({ weaverAllocations: { x: 2, y: 3 } })).weaver.count).toBe('5 pts')
  })

  it('leaves the passive tree entry unchanged', () => {
    expect(getSectionStatus(makeBuild({ nodeAllocations: { n1: 1 } })).tree).toEqual({
      count: '1 pts',
      full: false,
      done: true,
    })
  })
})
