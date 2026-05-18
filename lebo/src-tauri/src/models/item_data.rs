use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AffixTier {
    pub tier: u32,
    pub min_value: f64,
    pub max_value: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawAffix {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub affix_type: String,
    pub item_slots: Vec<String>,
    pub tiers: Vec<AffixTier>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawBaseItem {
    pub id: String,
    pub name: String,
    pub base_type: String,
    pub slot: String,
    pub implicit_affix_ids: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawUniqueItemAffix {
    pub affix_id: String,
    pub fixed_min_value: f64,
    pub fixed_max_value: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawUniqueItem {
    pub id: String,
    pub name: String,
    pub base_type: String,
    pub slot: String,
    pub affixes: Vec<RawUniqueItemAffix>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ItemDatabase {
    pub base_items: Vec<RawBaseItem>,
    pub unique_items: Vec<RawUniqueItem>,
    pub affixes: Vec<RawAffix>,
}
