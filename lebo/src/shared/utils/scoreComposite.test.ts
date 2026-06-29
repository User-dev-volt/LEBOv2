import { describe, it, expect } from 'vitest'
import { computeComposite, compositeDelta } from './scoreComposite'
import type { BuildScore } from '../types/optimization'

const FULL: BuildScore = { damage: 80, survivability: 60, speed: 20 }
const PARTIAL: BuildScore = { damage: 50, survivability: null, speed: 10 }
const ALL_NULL: BuildScore = { damage: null, survivability: null, speed: null }

describe('computeComposite', () => {
  it('rounds the average of all three axes', () => {
    // (80 + 60 + 20) / 3 = 53.33 → 53
    expect(computeComposite(FULL)).toBe(53)
  })

  it('averages only the non-null axes', () => {
    // (50 + 10) / 2 = 30
    expect(computeComposite(PARTIAL)).toBe(30)
  })

  it('returns null when every axis is null', () => {
    expect(computeComposite(ALL_NULL)).toBeNull()
  })

  it('returns null when the score itself is null', () => {
    expect(computeComposite(null)).toBeNull()
  })
})

describe('compositeDelta', () => {
  it('returns the signed composite delta to one decimal', () => {
    // base = 53, preview = round((90+70+25)/3) = 62 → +9.0
    expect(compositeDelta(FULL, { damage: 90, survivability: 70, speed: 25 })).toBe(9)
  })

  it('returns a negative delta when the preview composite is lower', () => {
    // base = 53, preview = round((60+50+10)/3) = 40 → -13.0
    expect(compositeDelta(FULL, { damage: 60, survivability: 50, speed: 10 })).toBe(-13)
  })

  it('returns 0 when the composites are equal', () => {
    expect(compositeDelta(FULL, FULL)).toBe(0)
  })

  it('returns null when either composite is undefined', () => {
    expect(compositeDelta(ALL_NULL, FULL)).toBeNull()
    expect(compositeDelta(FULL, ALL_NULL)).toBeNull()
  })
})
