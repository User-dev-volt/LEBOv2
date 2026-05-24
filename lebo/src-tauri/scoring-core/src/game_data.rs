use std::collections::HashMap;

use crate::modifier::{Condition, ModifierType, StatKey};

/// Gear affix scoring data — one entry per affix ID in the affix database.
/// Populated by game_data_loader.rs from the affix DB (initially empty; loaded in a future story).
#[derive(Debug, Clone)]
pub struct GearAffixData {
    /// Human-readable affix name for WishlistAffix.display_name.
    pub display_name: String,
    /// Stat contributed by this affix.
    pub stat_key: StatKey,
    pub modifier_type: ModifierType,
    /// Average stat value at each tier. Key = 1-indexed tier number.
    pub values_by_tier: HashMap<u32, f64>,
    /// "prefix" or "suffix" — determines which wishlist bucket this affix goes into.
    pub affix_class: String,
    /// Delivery-type scope: "melee" | "ranged" | "spell" | "minion" | "generic".
    /// "generic" affixes apply to all delivery types (e.g., % Fire Resistance).
    pub scope: String,
    /// Damage elements this affix applies to: e.g. ["fire", "cold"].
    /// Empty = applies to all damage elements (no element filtering).
    pub damage_elements: Vec<String>,
}

/// A single stat effect contributed by one point allocated to a passive node.
/// One node may have multiple effects (e.g., "+5% Fire Damage, +3% Crit Chance").
#[derive(Debug, Clone)]
pub struct NodeEffect {
    pub stat_key: StatKey,
    /// Missing modifier_type in source data → Increased (FR-A6 fallback)
    pub modifier_type: ModifierType,
    /// Raw numeric value (e.g., 5.0 for "+5%", 1.15 for "15% more")
    pub value: f64,
    pub condition: Condition,
}

/// Archetype scoring weights for one slider band.
#[derive(Debug, Clone)]
pub struct ArchetypeWeights {
    pub w_dmg: f64,
    pub w_surv: f64,
    pub w_speed: f64,
}

/// One row in the archetype weight table.
/// `slider_upper` is the inclusive upper bound for this band.
/// Bands must be sorted ascending and cover 0–100 exhaustively.
/// Example: [(24, glass_cannon), (49, lean_dps), (74, balanced), (89, lean_tank), (100, juggernaut)]
#[derive(Debug, Clone)]
pub struct ArchetypeWeightsEntry {
    pub slider_upper: u32,
    pub weights: ArchetypeWeights,
}

/// Base class stats for HP computation.
#[derive(Debug, Clone)]
pub struct BaseClassStats {
    /// HP at level 1
    pub base_hp: f64,
    /// Additional HP gained per level above 1
    pub hp_per_level: f64,
}

/// Scoring effect for one idol affix ID.
/// Keyed by affix ID in `GameData.idol_affixes`.
#[derive(Debug, Clone)]
pub struct IdolAffixEffect {
    pub stat_key: StatKey,
    pub modifier_type: ModifierType,
    /// Average stat value per tier, keyed by 1-indexed tier number.
    pub values_by_tier: HashMap<u32, f64>,
}

/// A build-enabling unique item with scoring effects for Game-Changer detection (FR-A22, Story 4.2).
#[derive(Debug, Clone, Default)]
pub struct UniqueItem {
    /// Canonical item ID (e.g., "exsanguinous").
    pub item_id: String,
    /// Display name for the suggestion description (e.g., "Exsanguinous").
    pub display_name: String,
    /// The scoring stat effects this unique contributes when equipped.
    /// Injected into a temporary build snapshot to compute BuildScore delta.
    pub scoring_effects: Vec<NodeEffect>,
    /// Human-readable description of what stat threshold enables this unique's value
    /// (e.g., "Ward generation from passives"). Used in Game-Changer suggestion description.
    pub threshold_description: String,
}

/// Read-only game reference data loaded once at startup.
/// Populated in Story 2.4 from disk JSON via `game_data_loader.rs`.
#[derive(Debug, Clone, Default)]
pub struct GameData {
    /// Passive/skill node ID → list of stat effects per allocated point.
    /// Key: node_id string matching keys in `BuildSnapshot.node_allocations`.
    /// Story 2.4 populates this from class JSON files.
    pub node_effects: HashMap<String, Vec<NodeEffect>>,

    /// Archetype weight table — must be sorted by slider_upper ascending.
    /// Empty table → compute_stats falls back to balanced weights (0.55/0.35/0.10).
    pub archetype_weights: Vec<ArchetypeWeightsEntry>,

    /// Base HP per class ID (e.g., "sentinel", "mage").
    /// Story 2.4 populates from class definitions.
    pub class_base_stats: HashMap<String, BaseClassStats>,

    /// Idol affix ID → scoring effect. Populated by `game_data_loader.rs` from idol-data.json.
    pub idol_affixes: HashMap<String, IdolAffixEffect>,

    /// Blessing ID → scoring effects. Populated by `game_data_loader.rs` from blessings.json.
    /// Reuses NodeEffect (stat_key, modifier_type, value, condition: Always) — same fields apply.
    pub blessing_effects: HashMap<String, Vec<NodeEffect>>,

    /// Undirected adjacency list for passive tree graph traversal (Story 4.1).
    /// Key: node_id. Value: directly connected node_ids.
    /// Built from base_tree.edges + mastery.passive_tree.edges for all classes.
    pub node_connections: HashMap<String, Vec<String>>,

    /// Maximum allocatable points per passive node (Story 4.1).
    /// Used as Dijkstra edge weight when computing EffectivePointCost.
    pub node_max_points: HashMap<String, u32>,

    /// BFS depth from mastery entry node for each mastery sub-tree node (Story 4.1).
    /// Key: node_id. Value: depth (1-indexed; mastery entry node is depth 1).
    /// Only mastery sub-tree nodes appear here; base tree nodes are absent.
    /// Depth 7–10 nodes receive the 1.2× efficiency multiplier (FR-A13).
    pub node_mastery_depth: HashMap<String, u32>,

    /// Delivery-type scope for each affix ID (Story 4.2).
    /// Key: affix_id. Value: "melee" | "ranged" | "spell" | "minion" | "generic".
    /// Missing entries → treat as "generic" (no mismatch flag).
    /// Populated from the affix database in game_data_loader.rs when scope data is available.
    pub affix_scope: HashMap<String, String>,

    /// Build-enabling unique items used for Game-Changer detection (FR-A22, Story 4.2).
    /// Each entry describes a unique that could dramatically increase BuildScore.
    /// Seeded in game_data_loader.rs; expanded when the full item DB is richer.
    pub unique_items: Vec<UniqueItem>,

    /// Gear affix database for the affix scorer (Story 5.2).
    /// Initially empty; populated from affix DB when the full affix pipeline is integrated.
    /// run_gear_scoring degrades gracefully when this is empty.
    pub gear_affixes: HashMap<String, GearAffixData>,
}
