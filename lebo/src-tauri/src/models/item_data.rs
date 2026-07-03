use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AffixTier {
    pub tier: u32,
    pub min_value: f64,
    pub max_value: f64,
}

/// One additional stat clause of a hybrid affix (Story 4.0). The primary stat lives on the parent
/// `RawAffix` (item-search back-compat); hybrids carry their second stat here.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawAffixStat {
    #[serde(default)]
    pub stat_key: Option<String>,
    #[serde(default)]
    pub modifier_type: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub damage_type: Option<String>,
    pub tiers: Vec<AffixTier>,
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
    #[serde(default)]
    pub modifier_type: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub damage_type: Option<String>,
    // Story 4.0 — enriched corpus. Additive/back-compat: the item-search path ignores these.
    #[serde(default)]
    pub stat_key: Option<String>,
    #[serde(default)]
    pub extra_stats: Vec<RawAffixStat>,
}

/// A base item's inline implicit (Story 4.1.5). The transform already emits `implicits[].text`
/// (821/897 bases populated); this struct carries it the last mile so Story 4.2 can render real
/// implicit lines. `text` is the universal display string; `stat_key` is nullable and unused by 4.2.
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawImplicit {
    pub text: String,
    #[serde(default)]
    pub stat_key: Option<String>,
    #[serde(default)]
    pub modifier_type: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub damage_type: Option<String>,
    #[serde(default)]
    pub min_value: f64,
    #[serde(default)]
    pub max_value: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawBaseItem {
    pub id: String,
    pub name: String,
    pub base_type: String,
    pub slot: String,
    pub implicit_affix_ids: Vec<String>,
    // Story 4.1.5 — additive/back-compat. `req.level` from PoB4LE (100% populated); implicit display
    // text the transform already emits but the struct previously dropped serde-side.
    #[serde(default)]
    pub level_requirement: u32,
    #[serde(default)]
    pub implicits: Vec<RawImplicit>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawUniqueItemAffix {
    pub affix_id: String,
    pub fixed_min_value: f64,
    pub fixed_max_value: f64,
    // Story 4.1.5 — the transform emits inline mod `text` (100%) + nullable `statKey` (~41%); carried
    // additively so Story 4.2 renders real unique stat lines. `text` is the display source.
    #[serde(default)]
    pub stat_key: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawUniqueItem {
    pub id: String,
    pub name: String,
    pub base_type: String,
    pub slot: String,
    pub affixes: Vec<RawUniqueItemAffix>,
    #[serde(default)]
    pub description: Option<String>,
    // Story 4.1.5 — `req.level` from PoB4LE (100% populated), additive.
    #[serde(default)]
    pub level_requirement: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawSetBonus {
    pub pieces_required: u32,
    pub description: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RawSetItem {
    pub id: String,
    pub name: String,
    pub base_type: String,
    pub slot: String,
    pub set_name: String,
    pub affixes: Vec<RawUniqueItemAffix>,
    pub set_bonuses: Vec<RawSetBonus>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ItemDatabase {
    pub base_items: Vec<RawBaseItem>,
    pub unique_items: Vec<RawUniqueItem>,
    pub affixes: Vec<RawAffix>,
    pub set_items: Vec<RawSetItem>,
}
