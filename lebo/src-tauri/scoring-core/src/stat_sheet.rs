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
    pub crit_avoidance: f64,
    pub dodge_chance: f64,
    pub life_leech_percent: f64,
    pub hp_regen_per_sec: f64,
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
