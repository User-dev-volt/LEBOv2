import type { StatSheet } from '../types/statSheet'

// Extracted from StatSheetPanel (feature-local) so the skill-tree canvas tooltip can reuse the SAME
// preview-vs-baseline diff (cross-feature imports are forbidden — route through shared/). The field
// set is deliberately the concrete, loader-sourced stats: it omits the perpetual ±0 inert stats
// (stun_chance, ailment chances/avoidances, penetration) entirely, so anything built from this can
// never surface a sourced-looking ±0 for a stat the build cannot move (Story 3.3 Source Audit).
export interface StatDeltas {
  damage_score: number
  avg_hit_damage: number
  avg_hit_damage_crit_weighted: number
  critical_strike_chance: number
  critical_strike_multiplier: number
  attack_speed: number | null
  cast_speed: number | null
  aoe_modifier: number
  effective_hp: number
  raw_hp: number
  ward: number
  endurance_percent: number
  endurance_threshold: number
  armor: number
  fire_resistance: number
  cold_resistance: number
  lightning_resistance: number
  void_resistance: number
  necrotic_resistance: number
  poison_resistance: number
  physical_resistance: number
  crit_avoidance: number
  dodge_chance: number
  score_damage: number
  score_survivability: number
  score_speed: number
  score_build: number
}

export function computeStatDeltas(base: StatSheet, preview: StatSheet): StatDeltas {
  return {
    damage_score: preview.offense.damage_score - base.offense.damage_score,
    avg_hit_damage: preview.offense.avg_hit_damage - base.offense.avg_hit_damage,
    avg_hit_damage_crit_weighted: preview.offense.avg_hit_damage_crit_weighted - base.offense.avg_hit_damage_crit_weighted,
    critical_strike_chance: preview.offense.critical_strike_chance - base.offense.critical_strike_chance,
    critical_strike_multiplier: preview.offense.critical_strike_multiplier - base.offense.critical_strike_multiplier,
    attack_speed: preview.offense.attack_speed != null && base.offense.attack_speed != null
      ? preview.offense.attack_speed - base.offense.attack_speed
      : null,
    cast_speed: preview.offense.cast_speed != null && base.offense.cast_speed != null
      ? preview.offense.cast_speed - base.offense.cast_speed
      : null,
    aoe_modifier: preview.offense.aoe_modifier - base.offense.aoe_modifier,
    effective_hp: preview.defense.effective_hp - base.defense.effective_hp,
    raw_hp: preview.defense.raw_hp - base.defense.raw_hp,
    ward: preview.defense.ward - base.defense.ward,
    endurance_percent: preview.defense.endurance_percent - base.defense.endurance_percent,
    endurance_threshold: preview.defense.endurance_threshold - base.defense.endurance_threshold,
    armor: preview.defense.armor - base.defense.armor,
    fire_resistance: preview.defense.fire_resistance - base.defense.fire_resistance,
    cold_resistance: preview.defense.cold_resistance - base.defense.cold_resistance,
    lightning_resistance: preview.defense.lightning_resistance - base.defense.lightning_resistance,
    void_resistance: preview.defense.void_resistance - base.defense.void_resistance,
    necrotic_resistance: preview.defense.necrotic_resistance - base.defense.necrotic_resistance,
    poison_resistance: preview.defense.poison_resistance - base.defense.poison_resistance,
    physical_resistance: preview.defense.physical_resistance - base.defense.physical_resistance,
    crit_avoidance: preview.defense.crit_avoidance - base.defense.crit_avoidance,
    dodge_chance: preview.defense.dodge_chance - base.defense.dodge_chance,
    score_damage: preview.scores.damage_score - base.scores.damage_score,
    score_survivability: preview.scores.survivability_score - base.scores.survivability_score,
    score_speed: preview.scores.speed_score - base.scores.speed_score,
    score_build: preview.scores.build_score - base.scores.build_score,
  }
}

export interface StatDeltaEntry {
  label: string
  delta: number
  unit: string
}

// Concrete per-stat fields surfaced in the compact canvas tooltip (FR-18), with display labels +
// units mirroring StatSheetPanel. Score aggregates are intentionally excluded — the suggestion card
// already shows the composite ΔBuildScore.
const TOOLTIP_FIELDS: Array<{ key: keyof StatDeltas; label: string; unit: string }> = [
  { key: 'avg_hit_damage', label: 'Avg Hit', unit: '' },
  { key: 'critical_strike_chance', label: 'Crit Chance', unit: '%' },
  { key: 'critical_strike_multiplier', label: 'Crit Multi', unit: '%' },
  { key: 'attack_speed', label: 'Attack Speed', unit: '' },
  { key: 'cast_speed', label: 'Cast Speed', unit: '' },
  { key: 'aoe_modifier', label: 'AoE', unit: '' },
  { key: 'effective_hp', label: 'EHP', unit: '' },
  { key: 'raw_hp', label: 'HP', unit: '' },
  { key: 'ward', label: 'Ward', unit: '' },
  { key: 'armor', label: 'Armor', unit: '' },
  { key: 'endurance_percent', label: 'Endurance', unit: '%' },
  { key: 'fire_resistance', label: 'Fire Res', unit: '%' },
  { key: 'cold_resistance', label: 'Cold Res', unit: '%' },
  { key: 'lightning_resistance', label: 'Lightning Res', unit: '%' },
  { key: 'void_resistance', label: 'Void Res', unit: '%' },
  { key: 'necrotic_resistance', label: 'Necrotic Res', unit: '%' },
  { key: 'poison_resistance', label: 'Poison Res', unit: '%' },
  { key: 'physical_resistance', label: 'Physical Res', unit: '%' },
  { key: 'dodge_chance', label: 'Dodge', unit: '%' },
  { key: 'crit_avoidance', label: 'Crit Avoid', unit: '%' },
]

// The compact, labeled per-stat delta list for the canvas tooltip — filtered to CHANGED fields only
// (a null or exactly-0 delta is dropped). Never lists an inert ±0 stat because none are in the field
// set above (Story 3.3 Source Audit: no displayed-but-not-sourced numbers).
export function tooltipStatDeltaEntries(base: StatSheet, preview: StatSheet): StatDeltaEntry[] {
  const deltas = computeStatDeltas(base, preview)
  const entries: StatDeltaEntry[] = []
  for (const { key, label, unit } of TOOLTIP_FIELDS) {
    const delta = deltas[key]
    if (delta == null || delta === 0) continue
    entries.push({ label, delta, unit })
  }
  return entries
}
