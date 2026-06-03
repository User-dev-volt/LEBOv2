// Rust output structs use snake_case (Pattern 2) — TypeScript mirrors exactly.

// Per-damage-type Increased%/More% with an optional DoT-ailment split
// (Ignite under fire, Bleed under physical). FR-1.
export interface DamageTypeBreakdown {
  damage_type: string
  increased: number
  more: number
  increased_dot: number | null
  more_dot: number | null
}

export interface OffenseStats {
  damage_score: number
  avg_hit_damage: number
  avg_hit_damage_crit_weighted: number
  critical_strike_chance: number
  critical_strike_multiplier: number
  attack_speed: number | null
  cast_speed: number | null
  aoe_modifier: number
  stun_chance: number
  elemental_penetration: number
  physical_penetration: number
  void_penetration: number
  damage_types: DamageTypeBreakdown[]
}

export interface DefenseStats {
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
  poison_resistance: number
  physical_resistance: number
  necrotic_resistance: number
  crit_avoidance: number
  dodge_chance: number
  // FR-5 layers added in Story 1.3 (snake_case mirror of DefenseStats). Necrotic-row + new-layer
  // display layout is Story 1.6 — these are type-only additions here.
  armor_mitigation_percent: number
  healing_effectiveness: number
  block_chance: number
  block_effectiveness: number
  glancing_blow_chance: number
  parry_chance: number
  ward_retention: number
  ward_decay_threshold: number
  reduced_bonus_damage_from_crits: number
  // FR-6 EHP triple + FR-7 Stable Ward/HP added in Story 1.4 (snake_case mirror of DefenseStats).
  // Display-only: these do NOT feed survivability_score/build_score. EHP/Ward display rows are
  // Story 1.6 — these are type-only additions here.
  ehp_vs_hits: number
  ehp_vs_dots: number
  ehp_vs_one_shots: number
  stable_ward: number
  stable_hp: number
}

export interface ScoreComponents {
  damage_score: number
  survivability_score: number
  speed_score: number
  build_score: number
}

// Phase 4 placeholder — hidden when null (Pattern 7)
export interface AilmentStats {}

// Phase 4 placeholder — hidden when null (Pattern 7)
export interface MinionStats {}

export interface StatWarning {
  warning_type: string
  current_value: number
  gap: number
  suggested_fix?: string
}

export interface NodeEfficiency {
  node_id: string
  efficiency: number
  path_delta_score: number
  effective_point_cost: number
  tier: 'gold' | 'silver' | 'dim'
}

export interface WishlistAffix {
  affix_id: string
  display_name: string
  target_tier: number
  weight: number
  mechanical_reason: string
  satisfied: boolean
}

export interface GearSlotRanking {
  slot: string
  upgrade_score: number
  efficiency_percent: number
  ideal_prefix: WishlistAffix[]
  ideal_suffix: WishlistAffix[]
}

export interface GearAnalysis {
  slot_rankings: GearSlotRanking[]
  priority_slot: string
}

export interface SynergyFlag {
  flag_type: 'zero_value_allocation' | 'mismatched_affix' | 'game_changer'
  priority: 'critical' | 'high' | 'medium'
  description: string
  node_id?: string
  slot?: string
  delta_build_score?: number
}

export interface StatSheet {
  offense: OffenseStats
  defense: DefenseStats
  scores: ScoreComponents
  ailment: AilmentStats | null
  minion: MinionStats | null
  warnings: StatWarning[]
}
