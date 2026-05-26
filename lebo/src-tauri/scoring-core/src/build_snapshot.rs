use serde::Deserialize;
use std::collections::HashMap;

/// One affix entry on a piece of gear or idol.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AffixEntry {
    pub affix_id: String,
    pub tier: u32,
}

/// Gear equipped in one slot (helm, chest, gloves, etc.).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GearSlotSnapshot {
    pub item_id: Option<String>,
    #[serde(default)]
    pub prefixes: Vec<AffixEntry>,
    #[serde(default)]
    pub suffixes: Vec<AffixEntry>,
}

/// One idol placed on the grid.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdolPlacement {
    pub row: u32,
    pub col: u32,
    pub idol_size: String,
    pub prefix: Option<AffixEntry>,
    pub suffix: Option<AffixEntry>,
}

/// Engine input: player state expressed as IDs only (no resolved data).
/// Deserialized from TypeScript via camelCase JSON (Pattern 2).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuildSnapshot {
    #[serde(default)]
    pub node_allocations: HashMap<String, u32>,
    #[serde(default)]
    pub skill_node_allocations: HashMap<String, HashMap<String, u32>>,
    pub character_level: u32,
    pub class_id: String,
    pub mastery_id: String,
    /// 0 (Glass Cannon) to 100 (Juggernaut)
    pub slider_position: u32,
    /// Named active conditions, e.g. ["on_pinnacle_boss", "power_charges_3"]
    #[serde(default)]
    pub active_conditions: Vec<String>,
    // --- Added in Story 2.2 ---
    /// Keyed by canonical slot ID: "helm", "chest", "gloves", "boots", "belt",
    /// "amulet", "ring_1", "ring_2", "weapon", "off_hand", "relic", "catalyst"
    #[serde(default)]
    pub gear_slots: HashMap<String, GearSlotSnapshot>,
    #[serde(default)]
    pub idol_placements: Vec<IdolPlacement>,
    /// Blessing IDs currently active
    #[serde(default)]
    pub blessings: Vec<String>,
    /// Active skill levels keyed by slot ID (e.g. "slot1" → 15)
    #[serde(default)]
    pub active_skill_levels: HashMap<String, u32>,
    /// Skill role designations: slotId → "primary_offense" | "secondary_offense" | "defensive" | "utility"
    /// Populated by TypeScript in Story 5.3 via buildSnapshotSerializer. Default = empty (no role context).
    #[serde(default)]
    pub skill_roles: HashMap<String, String>,
    /// Delivery type of the Primary Offense skill: "melee" | "ranged" | "spell" | "minion"
    /// None when no Primary Offense is designated. Zero-weights delivery-scoped affixes that mismatch.
    #[serde(default)]
    pub primary_offense_delivery_type: Option<String>,
    /// Damage elements active for the Primary Offense skill: e.g. ["poison", "physical"].
    /// Empty = no element filtering applied. Non-empty = affixes with mismatching elements score 0.0.
    #[serde(default)]
    pub primary_offense_damage_elements: Vec<String>,
    /// Human-readable name of the Primary Offense skill (e.g., "Poison Eruption").
    /// Populated by TypeScript via buildSnapshotSerializer. None when no Primary Offense is set.
    #[serde(default)]
    pub primary_offense_skill_name: Option<String>,
}
