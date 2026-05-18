import { describe, it, expect } from 'vitest'
import {
  calculatePassivePoints,
  calculateSkillPoints,
  calculateWeaverPoints,
  WEAVER_TOTAL_POINTS,
  MAX_PASSIVE_POINTS,
  MAX_CHARACTER_LEVEL,
  MAX_SKILL_LEVEL,
  MAX_SKILL_POINTS,
} from './budgetCalculator'

describe('calculatePassivePoints', () => {
  it('level 1 → 0 (no points before level 3)', () => {
    expect(calculatePassivePoints(1)).toBe(0)
  })

  it('level 2 → 0 (first point granted at level 3)', () => {
    expect(calculatePassivePoints(2)).toBe(0)
  })

  it('level 3 → 1 (first passive point)', () => {
    expect(calculatePassivePoints(3)).toBe(1)
  })

  it('level 50 → 48', () => {
    expect(calculatePassivePoints(50)).toBe(48)
  })

  it('level 100 → 98', () => {
    expect(calculatePassivePoints(100)).toBe(98)
  })
})

describe('MAX_PASSIVE_POINTS', () => {
  it('equals calculatePassivePoints at MAX_CHARACTER_LEVEL', () => {
    expect(MAX_PASSIVE_POINTS).toBe(calculatePassivePoints(MAX_CHARACTER_LEVEL))
  })

  it('is 98 at level 100', () => {
    expect(MAX_PASSIVE_POINTS).toBe(98)
  })
})

describe('calculateSkillPoints', () => {
  it('level 1 → 1 (minimum skill points)', () => {
    expect(calculateSkillPoints(1)).toBe(1)
  })

  it('level 10 → 10 (mid-range)', () => {
    expect(calculateSkillPoints(10)).toBe(10)
  })

  it('level 20 → 20 (maximum skill points)', () => {
    expect(calculateSkillPoints(20)).toBe(20)
  })
})

describe('MAX_SKILL_LEVEL', () => {
  it('is 20', () => {
    expect(MAX_SKILL_LEVEL).toBe(20)
  })
})

describe('MAX_SKILL_POINTS', () => {
  it('equals calculateSkillPoints(MAX_SKILL_LEVEL)', () => {
    expect(MAX_SKILL_POINTS).toBe(calculateSkillPoints(MAX_SKILL_LEVEL))
  })

  it('is 20', () => {
    expect(MAX_SKILL_POINTS).toBe(20)
  })
})

describe('calculateWeaverPoints', () => {
  it('returns 53 at level 1', () => {
    expect(calculateWeaverPoints(1)).toBe(53)
  })

  it('returns 53 at level 100', () => {
    expect(calculateWeaverPoints(100)).toBe(53)
  })

  it('returns the same value regardless of level (not level-gated)', () => {
    const levels = [1, 10, 50, 100]
    const results = levels.map(calculateWeaverPoints)
    expect(new Set(results).size).toBe(1)
  })
})

describe('WEAVER_TOTAL_POINTS', () => {
  it('is 53', () => {
    expect(WEAVER_TOTAL_POINTS).toBe(53)
  })

  it('equals calculateWeaverPoints(1)', () => {
    expect(WEAVER_TOTAL_POINTS).toBe(calculateWeaverPoints(1))
  })
})
