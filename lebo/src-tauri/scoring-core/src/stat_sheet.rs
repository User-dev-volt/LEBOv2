use serde::Serialize;

/// Damage, crit, and speed offensive stats.
#[derive(Debug, Clone, Default, Serialize)]
pub struct OffenseStats {
    pub damage_score: f64,
    pub avg_hit_damage: f64,
    pub avg_hit_damage_crit_weighted: f64,
    pub critical_strike_chance: f64,
    pub critical_strike_multiplier: f64,
    /// None if the build uses cast speed instead
    pub attack_speed: Option<f64>,
    /// None if the build uses attack speed instead
    pub cast_speed: Option<f64>,
    pub aoe_modifier: f64,
    /// Stun chance %, clamped to [0, 100] (FR-2).
    pub stun_chance: f64,
    /// Combined fire/cold/lightning penetration figure (sum of the three, plus any generic
    /// elemental penetration) (FR-4).
    pub elemental_penetration: f64,
    /// Physical penetration figure (FR-4).
    pub physical_penetration: f64,
    /// Void penetration figure — Void is a modeled LE type with shipped pen sources (FR-4).
    pub void_penetration: f64,
    /// Per-damage-type Increased%/More% breakdown, one entry per LE damage type
    /// in a fixed order (FR-1). Independent of the aggregate `damage_score`.
    pub damage_types: Vec<DamageTypeBreakdown>,
}

/// Increased%/More% for a single damage type, with an optional DoT-ailment split
/// (e.g. Ignite under Fire, Bleed under Physical) (FR-1).
#[derive(Debug, Clone, Default, Serialize)]
pub struct DamageTypeBreakdown {
    /// Lowercase LE damage-type label: "physical" | "fire" | "cold" | "lightning"
    /// | "void" | "necrotic" | "poison".
    pub damage_type: String,
    /// Σ Increased% for this type.
    pub increased: f64,
    /// Π More multipliers for this type, expressed as a multiplier (1.0 = none).
    pub more: f64,
    /// Σ Increased% for this type's DoT ailment variant; None when the type has none.
    pub increased_dot: Option<f64>,
    /// Π More multipliers for this type's DoT ailment variant; None when the type has none.
    pub more_dot: Option<f64>,
}

/// Survivability and defensive stats.
#[derive(Debug, Clone, Default, Serialize)]
pub struct DefenseStats {
    pub effective_hp: f64,
    pub raw_hp: f64,
    pub ward: f64,
    pub endurance_percent: f64,
    pub endurance_threshold: f64,
    pub armor: f64,
    pub fire_resistance: f64,
    pub cold_resistance: f64,
    pub lightning_resistance: f64,
    pub void_resistance: f64,
    pub poison_resistance: f64,
    pub physical_resistance: f64,
    /// 7th resistance — split off the Poison bucket in Story 1.3 (FR-5/AC2).
    pub necrotic_resistance: f64,
    pub crit_avoidance: f64,
    pub dodge_chance: f64,
    pub life_leech_percent: f64,
    pub hp_regen_per_sec: f64,
    // --- FR-5 layers added in Story 1.3 ---
    /// Derived display value: LE `armor / (armor + K)` capped at 85%. Pure function of `armor`,
    /// no StatKey. Does NOT feed `effective_hp` (parity gate) — EHP integration is Story 1.4.
    pub armor_mitigation_percent: f64,
    /// Sourced from the `HEALING` passive tag (`StatKey::HealingEffectiveness`).
    pub healing_effectiveness: f64,
    /// Sourced from the `BLOCK` passive tag (`StatKey::BlockChance`), capped 100%.
    pub block_chance: f64,
    /// No distinct shipped source (the `BLOCK` tag conflates chance + effectiveness); surfaced
    /// 0.0 per AC5. Base-50% block effectiveness is a Story-1.6 display concern.
    pub block_effectiveness: f64,
    /// No `GLANCING` tag in shipped Season-4 data; surfaced 0.0 (cap 100% when later sourced).
    pub glancing_blow_chance: f64,
    /// OQ-1 branch 2: Parry is player-accessible (cap 75%) but no shipped node sources it;
    /// surfaced 0.0 with no StatKey.
    pub parry_chance: f64,
    /// No distinct `WARD`+retention source (only prose on Ward-per-sec nodes); surfaced 0.0.
    pub ward_retention: f64,
    /// No shipped source; surfaced 0.0.
    pub ward_decay_threshold: f64,
    /// No shipped source (all CRIT nodes are offensive); surfaced 0.0.
    pub reduced_bonus_damage_from_crits: f64,
    // --- FR-6 EHP triple + FR-7 Stable Ward/HP, added in Story 1.4 ---
    /// FR-6: tunklab-aligned EHP vs single hits — armor, resistance, endurance%, and the hit-only
    /// avoidance layers (dodge/parry/block/glancing) applied multiplicatively as average damage
    /// reduction. Display-only; does NOT feed `effective_hp`/`survivability_score` (parity gate).
    pub ehp_vs_hits: f64,
    /// FR-6: EHP vs damage-over-time — excludes armor and all avoidance layers (hits-only in LE);
    /// only resistance and endurance% apply. Display-only; does NOT feed `effective_hp`.
    pub ehp_vs_dots: f64,
    /// FR-6: EHP vs a single un-averaged maximum hit — endurance threshold is a hard floor and the
    /// avoidance layers are NOT averaged in (a dodge roll cannot be relied on). Display-only.
    pub ehp_vs_one_shots: f64,
    /// FR-7: Stable Ward at equilibrium (ward generation == ward decay). Generation-driven in
    /// production until retention/decay-threshold sources land (Story 1.3 audit). Display-only.
    pub stable_ward: f64,
    /// FR-7: Stable HP at equilibrium — `raw_hp + stable_ward`. Display-only; does NOT feed scoring.
    pub stable_hp: f64,
}

/// Weighted composite scoring breakdown.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ScoreComponents {
    pub damage_score: f64,
    pub survivability_score: f64,
    pub speed_score: f64,
    pub build_score: f64,
}

/// A defensive floor or stat floor violation.
#[derive(Debug, Clone, Serialize)]
pub struct StatWarning {
    /// Kebab-style identifier, e.g. "fire_resistance_uncapped", "crit_avoidance_low", "no_sustain_layer"
    pub warning_type: String,
    pub current_value: f64,
    pub gap: f64,
    /// Human-readable fix suggestion, e.g. "Helm slot has room for a Fire Resistance suffix at T5"
    pub suggested_fix: Option<String>,
}

/// Efficiency score for one unallocated passive node (Epic 4).
#[derive(Debug, Clone, Serialize)]
pub struct NodeEfficiency {
    pub node_id: String,
    pub efficiency: f64,
    pub path_delta_score: f64,
    pub effective_point_cost: u32,
    /// "gold" | "silver" | "dim"
    pub tier: String,
}

/// Per-slot ranking in a gear analysis (Epic 5).
#[derive(Debug, Clone, Default, Serialize)]
pub struct GearSlotRanking {
    pub slot: String,
    pub upgrade_score: f64,
    pub efficiency_percent: f64,
    pub ideal_prefix: Vec<WishlistAffix>,
    pub ideal_suffix: Vec<WishlistAffix>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WishlistAffix {
    pub affix_id: String,
    pub display_name: String,
    pub target_tier: u32,
    pub weight: f64,
    pub mechanical_reason: String,
    pub satisfied: bool,
}

/// Full gear analysis result (Epic 5).
#[derive(Debug, Clone, Default, Serialize)]
pub struct GearAnalysis {
    pub slot_rankings: Vec<GearSlotRanking>,
    pub priority_slot: String,
}

/// Cross-domain synergy or anti-synergy detection result (Epic 4).
#[derive(Debug, Clone, Serialize)]
pub struct SynergyFlag {
    /// "zero_value_allocation" | "mismatched_affix" | "game_changer"
    pub flag_type: String,
    /// "critical" | "high" | "medium"
    pub priority: String,
    pub description: String,
    pub node_id: Option<String>,
    pub slot: Option<String>,
    pub delta_build_score: Option<f64>,
}

/// Phase 4 placeholder — populated when ailment DPS tracking is implemented.
#[derive(Debug, Clone, Default, Serialize)]
pub struct AilmentStats {}

/// Phase 4 placeholder — populated when minion builds are fully modeled.
#[derive(Debug, Clone, Default, Serialize)]
pub struct MinionStats {}

/// Complete stat sheet returned by `compute_stats`.
/// `None` sub-sheets are hidden sections — never rendered as errors (Pattern 7).
#[derive(Debug, Clone, Serialize)]
pub struct StatSheet {
    pub offense: OffenseStats,
    pub defense: DefenseStats,
    pub scores: ScoreComponents,
    /// None in Phase 3; populated Phase 4
    pub ailment: Option<AilmentStats>,
    /// None unless active minion skills present
    pub minion: Option<MinionStats>,
    pub warnings: Vec<StatWarning>,
}

impl Default for StatSheet {
    fn default() -> Self {
        Self {
            offense: OffenseStats::default(),
            defense: DefenseStats::default(),
            scores: ScoreComponents::default(),
            ailment: None,
            minion: None,
            warnings: Vec::new(),
        }
    }
}
