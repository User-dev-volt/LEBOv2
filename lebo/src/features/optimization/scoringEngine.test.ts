import { describe, it, expect } from 'vitest'
import { calculateScore } from './scoringEngine'
import type { BuildState } from '../../shared/types/build'
import type { GameData, GameNode } from '../../shared/types/gameData'

function makeNode(id: string, tags: string[], maxPoints = 4): GameNode {
  return {
    id,
    name: id,
    pointCost: 1,
    maxPoints,
    prerequisiteNodeIds: [],
    effectDescription: '',
    tags,
    position: { x: 0, y: 0 },
    size: 'small',
  }
}

function makeBuild(
  classId: string,
  masteryId: string,
  nodeAllocations: Record<string, number> = {}
): BuildState {
  return {
    schemaVersion: 1,
    id: 'test-build',
    name: 'Test',
    classId,
    masteryId,
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations,
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

const DAMAGE_NODE = makeNode('dmg-node', ['DAMAGE', 'VOID'], 6)
const SURV_NODE = makeNode('surv-node', ['HEALTH', 'DEFENCE'], 5)
const SPEED_NODE = makeNode('spd-node', ['ATTACK_SPEED'], 4)
const NEUTRAL_NODE = makeNode('neutral-node', ['MASTERY', 'MINION'], 4)
const MIXED_NODE = makeNode('mixed-node', ['VOID', 'BLOCK', 'DEFENCE'], 4)

const TEST_GAME_DATA: GameData = {
  manifest: {
    schemaVersion: 1,
    gameVersion: '1.0',
    dataVersion: '1.0',
    generatedAt: '2026-01-01',
    classes: ['test-class'],
  },
  classes: {
    'test-class': {
      classId: 'test-class',
      className: 'Test Class',
      baseTree: {
        'dmg-node': DAMAGE_NODE,
        'neutral-node': NEUTRAL_NODE,
      },
      masteries: {
        'test-mastery': {
          masteryId: 'test-mastery',
          masteryName: 'Test Mastery',
          nodes: {
            'surv-node': SURV_NODE,
            'spd-node': SPEED_NODE,
            'mixed-node': MIXED_NODE,
          },
        },
      },
      skills: [],
      skillTrees: {},
    },
  },
}

describe('calculateScore', () => {
  it('returns all zeros for empty node allocations', () => {
    const build = makeBuild('test-class', 'test-mastery')
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: 0, survivability: 0, speed: 0 })
  })

  it('returns null for all axes when classId has no game data', () => {
    const build = makeBuild('missing-class', 'test-mastery')
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: null, survivability: null, speed: null })
  })

  it('returns null for all axes when masteryId has no game data', () => {
    const build = makeBuild('test-class', 'missing-mastery')
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: null, survivability: null, speed: null })
  })

  it('returns null for all axes when classId is empty string', () => {
    const build = makeBuild('', 'test-mastery')
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: null, survivability: null, speed: null })
  })

  it('allocated damage node produces non-zero damage score', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'dmg-node': 6 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result.damage).toBeGreaterThan(0)
    expect(result.damage).toBeLessThanOrEqual(100)
    expect(result.survivability).toBe(0)
    expect(result.speed).toBe(0)
  })

  it('allocated survivability node produces non-zero surv score', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'surv-node': 5 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result.survivability).toBeGreaterThan(0)
    expect(result.survivability).toBeLessThanOrEqual(100)
    expect(result.damage).toBe(0)
    expect(result.speed).toBe(0)
  })

  it('allocated speed node produces non-zero speed score', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'spd-node': 4 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result.speed).toBeGreaterThan(0)
    expect(result.speed).toBeLessThanOrEqual(100)
    expect(result.damage).toBe(0)
    expect(result.survivability).toBe(0)
  })

  it('neutral node contributes nothing to any axis', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'neutral-node': 4 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: 0, survivability: 0, speed: 0 })
  })

  it('node with VOID + DEFENCE tags goes to survivability (surv beats damage)', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'mixed-node': 4 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result.survivability).toBeGreaterThan(0)
    expect(result.damage).toBe(0)
  })

  it('unknown nodeId in allocations is silently skipped (no null contribution)', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'ghost-node': 3 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: 0, survivability: 0, speed: 0 })
  })

  it('allocatedPoints=0 node is skipped', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'dmg-node': 0 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result).toEqual({ damage: 0, survivability: 0, speed: 0 })
  })

  it('node with maxPoints=0 is skipped and contributes nothing', () => {
    const zeroNode = makeNode('zero-node', ['DAMAGE'], 0)
    const gameData: GameData = {
      ...TEST_GAME_DATA,
      classes: {
        'test-class': {
          ...TEST_GAME_DATA.classes['test-class'],
          baseTree: { ...TEST_GAME_DATA.classes['test-class'].baseTree, 'zero-node': zeroNode },
        },
      },
    }
    const build = makeBuild('test-class', 'test-mastery', { 'zero-node': 1 })
    const result = calculateScore(build, gameData)
    expect(result).toEqual({ damage: 0, survivability: 0, speed: 0 })
  })

  it('scores are integers (no decimals)', () => {
    const build = makeBuild('test-class', 'test-mastery', { 'dmg-node': 3, 'surv-node': 2 })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(Number.isInteger(result.damage)).toBe(true)
    expect(Number.isInteger(result.survivability)).toBe(true)
    expect(Number.isInteger(result.speed)).toBe(true)
  })

  it('scores never exceed 100', () => {
    // Allocate a very high-weight node
    const bigNode = makeNode('big-dmg', ['DAMAGE'], 100)
    const gameData: GameData = {
      ...TEST_GAME_DATA,
      classes: {
        'test-class': {
          ...TEST_GAME_DATA.classes['test-class'],
          baseTree: { 'big-dmg': bigNode },
        },
      },
    }
    const build = makeBuild('test-class', 'test-mastery', { 'big-dmg': 100 })
    const result = calculateScore(build, gameData)
    expect(result.damage).toBe(100)
    expect(result.damage).toBeLessThanOrEqual(100)
  })

  it('pure damage build skews damage score higher than surv or speed', () => {
    const build = makeBuild('test-class', 'test-mastery', {
      'dmg-node': 6,
    })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result.damage!).toBeGreaterThan(result.survivability!)
    expect(result.damage!).toBeGreaterThan(result.speed!)
  })

  it('pure defence build skews survivability score higher than damage or speed', () => {
    const build = makeBuild('test-class', 'test-mastery', {
      'surv-node': 5,
    })
    const result = calculateScore(build, TEST_GAME_DATA)
    expect(result.survivability!).toBeGreaterThan(result.damage!)
    expect(result.survivability!).toBeGreaterThan(result.speed!)
  })

  it('weight formula uses allocatedPoints × maxPoints', () => {
    // dmg-node: maxPoints=6, allocate 3 → raw = 3*6 = 18
    // score = round(18/650*100) = round(2.77) = 3
    const build = makeBuild('test-class', 'test-mastery', { 'dmg-node': 3 })
    const result = calculateScore(build, TEST_GAME_DATA)
    const expectedRaw = 3 * 6
    const expectedScore = Math.min(100, Math.round((expectedRaw / 650) * 100))
    expect(result.damage).toBe(expectedScore)
  })
})
