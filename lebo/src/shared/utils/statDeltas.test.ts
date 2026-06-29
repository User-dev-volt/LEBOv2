import { describe, it, expect } from 'vitest'
import { computeStatDeltas, tooltipStatDeltaEntries } from './statDeltas'
import type { StatSheet, OffenseStats, DefenseStats, ScoreComponents, AttributeStats } from '../types/statSheet'

const ZERO_OFFENSE: OffenseStats = {
  damage_score: 0,
  avg_hit_damage: 0,
  avg_hit_damage_crit_weighted: 0,
  critical_strike_chance: 0,
  critical_strike_multiplier: 0,
  attack_speed: null,
  cast_speed: null,
  aoe_modifier: 0,
  stun_chance: 0,
  elemental_penetration: 0,
  physical_penetration: 0,
  void_penetration: 0,
  damage_types: [],
  bleed_chance: 0,
  ignite_chance: 0,
  poison_chance: 0,
  freeze_chance: 0,
  shock_chance: 0,
  armor_shred_chance: 0,
}

const ZERO_DEFENSE: DefenseStats = {
  effective_hp: 0, raw_hp: 0, ward: 0, endurance_percent: 0, endurance_threshold: 0, armor: 0,
  fire_resistance: 0, cold_resistance: 0, lightning_resistance: 0, void_resistance: 0,
  poison_resistance: 0, physical_resistance: 0, necrotic_resistance: 0, crit_avoidance: 0,
  dodge_chance: 0, armor_mitigation_percent: 0, healing_effectiveness: 0, block_chance: 0,
  block_effectiveness: 0, glancing_blow_chance: 0, parry_chance: 0, ward_retention: 0,
  ward_decay_threshold: 0, reduced_bonus_damage_from_crits: 0, ehp_vs_hits: 0, ehp_vs_dots: 0,
  ehp_vs_one_shots: 0, stable_ward: 0, stable_hp: 0, chill_avoidance: 0, stun_avoidance: 0,
  bleed_avoidance: 0,
}

const ZERO_SCORES: ScoreComponents = { damage_score: 0, survivability_score: 0, speed_score: 0, build_score: 0 }
const ZERO_ATTRS: AttributeStats = { strength: 0, dexterity: 0, intelligence: 0, attunement: 0, vitality: 0 }

function sheet(offense: Partial<OffenseStats> = {}, defense: Partial<DefenseStats> = {}, scores: Partial<ScoreComponents> = {}): StatSheet {
  return {
    offense: { ...ZERO_OFFENSE, ...offense },
    defense: { ...ZERO_DEFENSE, ...defense },
    scores: { ...ZERO_SCORES, ...scores },
    attributes: ZERO_ATTRS,
    ailment: null,
    minion: null,
    warnings: [],
  }
}

describe('computeStatDeltas', () => {
  it('diffs preview minus base per field', () => {
    const base = sheet({ avg_hit_damage: 100 }, { raw_hp: 1000 }, { build_score: 40 })
    const preview = sheet({ avg_hit_damage: 130 }, { raw_hp: 1250 }, { build_score: 47 })
    const d = computeStatDeltas(base, preview)
    expect(d.avg_hit_damage).toBe(30)
    expect(d.raw_hp).toBe(250)
    expect(d.score_build).toBe(7)
  })

  it('returns null for a speed delta when either side is null', () => {
    const base = sheet({ cast_speed: null })
    const preview = sheet({ cast_speed: 1.4 })
    expect(computeStatDeltas(base, preview).cast_speed).toBeNull()
  })

  it('computes the speed delta when both sides are present', () => {
    const base = sheet({ cast_speed: 1.2 })
    const preview = sheet({ cast_speed: 1.4 })
    expect(computeStatDeltas(base, preview).cast_speed).toBeCloseTo(0.2)
  })
})

describe('tooltipStatDeltaEntries', () => {
  it('lists only the changed concrete stats, with labels and units', () => {
    const base = sheet({ cast_speed: 1.0, critical_strike_chance: 20 }, { necrotic_resistance: 30 })
    const preview = sheet({ cast_speed: 1.08, critical_strike_chance: 20 }, { necrotic_resistance: 52 })
    const entries = tooltipStatDeltaEntries(base, preview)
    // cast_speed changed (+0.08), necrotic_resistance changed (+22); crit chance unchanged → dropped.
    expect(entries).toEqual([
      { label: 'Cast Speed', delta: expect.closeTo(0.08), unit: '' },
      { label: 'Necrotic Res', delta: 22, unit: '%' },
    ])
  })

  it('returns an empty list when nothing changed', () => {
    const base = sheet({ avg_hit_damage: 100 })
    expect(tooltipStatDeltaEntries(base, base)).toEqual([])
  })

  it('never includes a perpetual ±0 inert stat (stun/ailment/penetration are not in the field set)', () => {
    // Even if the engine reported a (hypothetical) nonzero inert delta, the tooltip field set excludes
    // those keys — so a build-immovable stat can never render a sourced-looking delta.
    const base = sheet({ stun_chance: 0, elemental_penetration: 0, bleed_chance: 0 })
    const preview = sheet({ stun_chance: 5, elemental_penetration: 9, bleed_chance: 12 })
    expect(tooltipStatDeltaEntries(base, preview)).toEqual([])
  })
})
