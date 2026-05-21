use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct NodeEffect {
    pub description: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawGameNode {
    pub id: String,
    pub name: String,
    pub x: f64,
    pub y: f64,
    pub size: String,
    pub max_points: u32,
    pub effects: Vec<NodeEffect>,
    #[serde(default)]
    pub modifier_type: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawEdge {
    pub from_id: String,
    pub to_id: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct RawTreeData {
    pub nodes: Vec<RawGameNode>,
    pub edges: Vec<RawEdge>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawMastery {
    pub id: String,
    pub name: String,
    pub passive_tree: RawTreeData,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawSkillEntry {
    pub id: String,
    pub name: String,
    pub mastery_id: Option<String>,
    pub mastery_gate_points: Option<u32>,
    pub skill_tree: RawTreeData,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawClassData {
    pub id: String,
    pub name: String,
    pub base_tree: RawTreeData,
    pub masteries: Vec<RawMastery>,
    #[serde(default)]
    pub skills: Vec<RawSkillEntry>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameDataManifest {
    pub schema_version: u32,
    pub game_version: String,
    pub data_version: String,
    pub generated_at: String,
    pub classes: Vec<String>,
    #[serde(default)]
    pub item_data_version: Option<String>,
    #[serde(default)]
    pub icon_cache_version: Option<String>,
    #[serde(default)]
    pub icon_source: Option<String>,
    #[serde(default)]
    pub idol_data_version: Option<String>,
    #[serde(default)]
    pub blessings_data_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DataVersionCheckResult {
    pub is_stale: bool,
    pub local_version: String,
    pub remote_version: String,
    pub versions_behind: u32,
}
