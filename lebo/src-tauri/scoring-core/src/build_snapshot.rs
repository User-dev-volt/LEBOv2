use serde::Deserialize;
use std::collections::HashMap;

/// Engine input: player state expressed as IDs only (no resolved data).
/// Deserialized from TypeScript via camelCase JSON (Pattern 2).
/// Fields marked TODO will be populated in Story 2.2+.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuildSnapshot {
    pub node_allocations: HashMap<String, u32>,
    pub skill_node_allocations: HashMap<String, HashMap<String, u32>>,
    pub character_level: u32,
    pub class_id: String,
    pub mastery_id: String,
    /// 0 (Glass Cannon) to 100 (Juggernaut)
    pub slider_position: u32,
    /// Named active conditions, e.g. ["on_pinnacle_boss", "power_charges_3"]
    pub active_conditions: Vec<String>,
    // Story 2.2 adds: gear slots, idol placements, blessings
}
