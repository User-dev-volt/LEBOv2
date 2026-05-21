use serde::{Deserialize, Serialize};

// --- idol-data.json models ---

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolGrid {
    pub rows: u32,
    pub cols: u32,
    pub blocked_cells: Vec<(u32, u32)>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolAffixTier {
    pub tier: u32,
    pub min_value: f64,
    pub max_value: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolAffix {
    pub id: String,
    pub display_name: String,
    #[serde(rename = "type")]
    pub affix_type: String,
    pub tiers: Vec<IdolAffixTier>,
    pub stat_key: String,
    pub modifier_type: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolType {
    pub id: String,
    pub display_name: String,
    pub rows: u32,
    pub cols: u32,
    pub requires_both: bool,
    pub prefix_pool: Vec<IdolAffix>,
    pub suffix_pool: Vec<IdolAffix>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IdolData {
    pub version: String,
    pub default_grid: IdolGrid,
    pub altar_variants: Vec<serde_json::Value>,
    pub idol_types: Vec<IdolType>,
}

// --- blessings.json models ---

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatEffect {
    pub stat_key: String,
    pub value: f64,
    pub modifier_type: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlessingEntry {
    pub id: String,
    pub timeline_id: String,
    pub timeline_name: String,
    pub display_name: String,
    pub stat_effects: Vec<StatEffect>,
}

pub type BlessingsDatabase = Vec<BlessingEntry>;

// --- conditions.json models ---

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionOption {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionFilter {
    #[serde(default)]
    pub class_id: Option<String>,
    #[serde(default)]
    pub skill_tag: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConditionEntry {
    pub id: String,
    #[serde(default)]
    pub display_label: String,
    pub category: String,
    #[serde(rename = "type")]
    pub condition_type: String,
    #[serde(default)]
    pub options: Vec<ConditionOption>,
    #[serde(default)]
    pub min: Option<f64>,
    #[serde(default)]
    pub max: Option<f64>,
    #[serde(default)]
    pub step: Option<f64>,
    #[serde(default)]
    pub default_value: serde_json::Value,
    #[serde(default)]
    pub filter: Option<ConditionFilter>,
}

pub type ConditionsDatabase = Vec<ConditionEntry>;
