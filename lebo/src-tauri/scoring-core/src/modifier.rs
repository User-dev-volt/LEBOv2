use serde::{Deserialize, Serialize};

/// All stat dimensions the scoring engine tracks.
/// Add new variants here as Phase 4+ adds stat complexity.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StatKey {
    // Damage — generic
    IncreasedDamage,
    MoreDamage,
    // Damage — element-specific
    IncreasedFireDamage,
    IncreasedColdDamage,
    IncreasedLightningDamage,
    IncreasedVoidDamage,
    IncreasedPoisonDamage,
    IncreasedPhysicalDamage,
    IncreasedNecroticDamage,
    // Damage — DoT ailment variants, tracked under their parent type's breakdown
    IncreasedBleedDamage,
    IncreasedIgniteDamage,
    // Damage — delivery-type-specific
    IncreasedSpellDamage,
    IncreasedMeleeDamage,
    IncreasedRangedDamage,
    IncreasedMinionDamage,
    IncreasedAreaDamage,
    // Flat added damage
    FlatAddedFireDamage,
    FlatAddedColdDamage,
    FlatAddedLightningDamage,
    FlatAddedVoidDamage,
    FlatAddedPhysicalDamage,
    // Crit
    CriticalStrikeChance,
    CriticalStrikeMultiplier,
    CriticalStrikeAvoidance,
    StunChance,
    // Defense
    MaxHp,
    MaxHpPercent,
    HpRegenPerSec,
    WardPerSecond,
    WardOnHit,
    Armor,
    EnduranceThreshold,
    EndurancePercent,
    FireResistance,
    ColdResistance,
    LightningResistance,
    VoidResistance,
    PoisonResistance,
    PhysicalResistance,
    NecroticResistance,
    AllResistances,
    DodgeRating,
    LifeLeechPercent,
    // FR-5 layers sourced from the shipped passive-tag path (Story 1.3 audit). Only keys with a
    // proven shipped source live here — Parry/Glancing/WardRetention/WardDecay/ReducedCritBonus
    // have no shipped source and are surfaced as 0.0 on DefenseStats with no key (no dead keys).
    HealingEffectiveness,
    BlockChance,
    // Speed
    AttackSpeed,
    CastSpeed,
    MovementSpeed,
    AreaOfEffect,
    CooldownRecoverySpeed,
    // Mana
    MaxMana,
    ManaRegenPerSec,
    // Penetration. Void is a modeled LE type with shipped pen sources; Elemental is a
    // generic pen that applies across fire/cold/lightning. Necrotic/Poison penetration
    // keys are intentionally omitted — no shipped node produces them, and the project
    // forbids StatKey variants that are never sourced (dead keys). Holy/Chaos penetration
    // are dropped at the loader (not modeled LE types — same class as "Corruption").
    FirePenetration,
    ColdPenetration,
    LightningPenetration,
    VoidPenetration,
    ElementalPenetration,
    PhysicalPenetration,
    // Ailments (Phase 4 placeholders)
    IgniteDuration,
    PoisonDuration,
    BleedDuration,
    FreezeRateMultiplier,
    MaxPoisonStacks,
    // Minion
    IncreasedMinionCount,
    IncreasedMinionHp,
    // Attributes (FR-9, Story 1.5). Sourced from standalone passive tags
    // (`["STRENGTH"]`, `["DEXTERITY"]`, `["INTELLIGENCE"]`, `["ATTUNEMENT"]`) — audit-proven, not
    // dead keys. VITALITY ships no passive tag in the current Season-4 data (the "Vitality" node is
    // tagged HEALTH), so Vitality totals 0.0 today; its loader branch keys the real LE tag so a
    // future VITALITY-tagged source flows in with no further loader change.
    Strength,
    Dexterity,
    Intelligence,
    Attunement,
    Vitality,
}

/// Canonical `StatKey` → string key used for the `stat_sources` map (FR-12). Derived once via
/// serde so it can never drift from an 80-arm hand-written match. `StatKey` has no `#[serde(rename)]`,
/// so this yields the PascalCase variant name (`"FireResistance"`, `"IncreasedDamage"`). Story 1.8
/// must query the map by this same string.
pub(crate) fn stat_key_key(k: &StatKey) -> String {
    match serde_json::to_value(k) {
        Ok(serde_json::Value::String(s)) => s,
        _ => String::new(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ModifierType {
    #[default]
    Increased,
    More,
    Flat,
    Conversion,
}

impl ModifierType {
    /// Tolerant boundary constructor for game-data strings. Case-insensitive.
    /// Any unknown value or `None` falls back to `Increased` (FR-A6). This is the
    /// single place the fallback contract lives — direct serde deserialization
    /// handles the strict-lowercase paths.
    pub fn from_data_str(raw: Option<&str>) -> Self {
        match raw.map(|s| s.trim().to_ascii_lowercase()) {
            Some(s) if s == "flat" => ModifierType::Flat,
            Some(s) if s == "more" => ModifierType::More,
            Some(s) if s == "conversion" => ModifierType::Conversion,
            _ => ModifierType::Increased,
        }
    }
}

/// Delivery-type scope of an affix or stat. Deserialized from lowercase game-data
/// strings ("melee" | "ranged" | "spell" | "minion" | "generic").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Melee,
    Ranged,
    Spell,
    Minion,
    #[default]
    Generic,
}

impl Scope {
    /// Tolerant boundary constructor. Case-insensitive; unknown/`None` → `Generic`.
    pub fn from_data_str(raw: Option<&str>) -> Self {
        match raw.map(|s| s.trim().to_ascii_lowercase()) {
            Some(s) if s == "melee" => Scope::Melee,
            Some(s) if s == "ranged" => Scope::Ranged,
            Some(s) if s == "spell" => Scope::Spell,
            Some(s) if s == "minion" => Scope::Minion,
            _ => Scope::Generic,
        }
    }

    /// `true` when this scope applies to a build with the given primary delivery type.
    /// `Generic` always applies (preserves the historical `scope == "generic"` short-circuit);
    /// a specific scope applies only when it equals the primary, and never when no primary is set.
    pub fn matches_delivery(&self, primary: Option<Scope>) -> bool {
        if *self == Scope::Generic {
            return true;
        }
        primary == Some(*self)
    }

    /// Lowercase string label for human-readable descriptions. Display only —
    /// never use this for branching decisions (compare `Scope` variants instead).
    pub fn as_str(&self) -> &'static str {
        match self {
            Scope::Melee => "melee",
            Scope::Ranged => "ranged",
            Scope::Spell => "spell",
            Scope::Minion => "minion",
            Scope::Generic => "generic",
        }
    }
}

/// Affix prefix/suffix discriminator. Deserialized from lowercase game-data strings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AffixPosition {
    #[default]
    Prefix,
    Suffix,
}

impl AffixPosition {
    /// Tolerant boundary constructor. Case-insensitive; unknown/`None` → `Prefix`
    /// (matches the historical "absent → prefix" behavior).
    pub fn from_data_str(raw: Option<&str>) -> Self {
        match raw.map(|s| s.trim().to_ascii_lowercase()) {
            Some(s) if s == "suffix" => AffixPosition::Suffix,
            _ => AffixPosition::Prefix,
        }
    }
}

/// Condition under which a modifier applies.
/// Phase 3 only uses `Always` and `Named` — the remaining variants
/// are defined for Phase 4 conditional mechanics.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Condition {
    /// Modifier always applies.
    Always,
    /// Applies when the named condition string is in `active_conditions`.
    Named(String),
    /// Applies when the named charge/stack count is at or above `count`.
    Stacked { name: String, count: u32 },
    /// Applies when a computed stat value crosses a threshold.
    /// Cannot be evaluated from condition strings alone — the compute layer
    /// resolves these after the base registry is built.
    Threshold { stat: StatKey, above: f64 },
    /// All sub-conditions must be active (logical AND).
    Composite(Vec<Condition>),
}

impl Condition {
    /// Returns true if this condition is satisfied by the given active condition strings.
    /// `Threshold` always returns false here — the compute layer handles it separately.
    pub fn is_active(&self, active_conditions: &[String]) -> bool {
        match self {
            Condition::Always => true,
            Condition::Named(name) => active_conditions.contains(name),
            Condition::Stacked { name, count } => {
                let prefix = format!("{}_", name);
                active_conditions.iter().any(|c| {
                    if let Some(suffix) = c.strip_prefix(&prefix) {
                        suffix.parse::<u32>().map(|n| n >= *count).unwrap_or(false)
                    } else {
                        false
                    }
                })
            }
            Condition::Threshold { .. } => false,
            Condition::Composite(conditions) => {
                conditions.iter().all(|c| c.is_active(active_conditions))
            }
        }
    }
}

/// Origin category of a stat modifier, surfaced via opt-in source attribution (FR-12).
/// Serializes snake_case ("passive_node" | "gear_slot" | "idol" | "blessing" | "skill_node" |
/// "condition"). Output-only metadata — never feeds a computed stat.
// Why: all six variants are ADR-defined forward-compat (ADR-P4-D-P4-3). Only PassiveNode/GearSlot/
// Idol/Blessing are produced today; SkillNode and Condition are reserved like the unused
// Condition::Stacked/Threshold/Composite variants above — not dead code, do not "clean up."
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    PassiveNode,
    GearSlot,
    Idol,
    Blessing,
    SkillNode,
    Condition,
}

/// One attributed contribution to a stat, recorded only when `track_sources` is enabled
/// (the display `compute_stats` call). Output-only — no `Deserialize` needed.
#[derive(Debug, Clone, Serialize)]
pub struct ModifierSource {
    pub source_type: SourceType,
    pub source_label: String,
    pub value: f64,
    pub modifier_type: ModifierType,
}

/// A single stat modifier from any source (passive node, affix, idol, blessing).
#[derive(Debug, Clone)]
pub struct Modifier {
    pub stat_key: StatKey,
    pub modifier_type: ModifierType,
    pub value: f64,
    pub condition: Condition,
    /// Source identifier: NodeId, AffixId, BlessingId, IdolSlotId, etc.
    pub source: String,
}

/// Central collection of all active modifiers for a build.
/// Built from `BuildSnapshot` before any computation runs.
#[derive(Debug, Default, Clone)]
pub struct ModifierRegistry {
    modifiers: Vec<Modifier>,
    /// Parallel source-attribution log, populated only when the caller (`build_registry` with
    /// `track_sources == true`) opts in. Each entry carries the modifier's `Condition` so
    /// `collect_sources` can honor the exact same active-check `query` applies (FR-12, AC3).
    /// Empty on every loop path (Pattern P4-2) — zero allocation when tracking is off.
    sources: Vec<(StatKey, Condition, ModifierSource)>,
}

impl ModifierRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, modifier: Modifier) {
        self.modifiers.push(modifier);
    }

    /// Records one attributed source contribution. The caller decides whether to call this
    /// (gated on `track_sources` in `build_registry`), so this method itself does no gating.
    pub fn add_source(&mut self, stat_key: StatKey, condition: Condition, source: ModifierSource) {
        self.sources.push((stat_key, condition, source));
    }

    /// Groups recorded sources by their `StatKey` string key, including a source only when its
    /// condition is active under `active` — mirroring `query`'s honesty filter (AC3). Returns
    /// only keys with ≥1 active source (no empty `Vec`s, no dead keys). Always empty `None`-side
    /// when nothing was recorded.
    pub fn collect_sources(
        &self,
        active: &[String],
    ) -> std::collections::HashMap<String, Vec<ModifierSource>> {
        let mut grouped: std::collections::HashMap<String, Vec<ModifierSource>> =
            std::collections::HashMap::new();
        for (stat_key, condition, source) in &self.sources {
            if condition.is_active(active) {
                grouped
                    .entry(stat_key_key(stat_key))
                    .or_default()
                    .push(source.clone());
            }
        }
        grouped
    }

    /// Returns all modifiers for the given stat that are active under the current conditions.
    pub fn query(&self, stat: &StatKey, active_conditions: &[String]) -> Vec<&Modifier> {
        self.modifiers
            .iter()
            .filter(|m| &m.stat_key == stat && m.condition.is_active(active_conditions))
            .collect()
    }

    pub fn len(&self) -> usize {
        self.modifiers.len()
    }

    pub fn is_empty(&self) -> bool {
        self.modifiers.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Lowercase serde round-trip ---

    #[test]
    fn modifier_type_lowercase_serde_round_trip() {
        assert_eq!(
            serde_json::from_str::<ModifierType>("\"more\"").unwrap(),
            ModifierType::More
        );
        assert_eq!(
            serde_json::from_str::<ModifierType>("\"conversion\"").unwrap(),
            ModifierType::Conversion
        );
        assert_eq!(serde_json::to_string(&ModifierType::Flat).unwrap(), "\"flat\"");
    }

    #[test]
    fn scope_lowercase_serde_round_trip() {
        assert_eq!(serde_json::from_str::<Scope>("\"melee\"").unwrap(), Scope::Melee);
        assert_eq!(serde_json::from_str::<Scope>("\"generic\"").unwrap(), Scope::Generic);
        assert_eq!(serde_json::to_string(&Scope::Spell).unwrap(), "\"spell\"");
    }

    #[test]
    fn affix_position_lowercase_serde_round_trip() {
        assert_eq!(
            serde_json::from_str::<AffixPosition>("\"suffix\"").unwrap(),
            AffixPosition::Suffix
        );
        assert_eq!(serde_json::to_string(&AffixPosition::Prefix).unwrap(), "\"prefix\"");
    }

    // --- from_data_str: None and unknown fall back to the default ---

    #[test]
    fn modifier_type_from_data_str_defaults() {
        assert_eq!(ModifierType::from_data_str(None), ModifierType::Increased);
        assert_eq!(ModifierType::from_data_str(Some("GARBAGE")), ModifierType::Increased);
        assert_eq!(ModifierType::default(), ModifierType::Increased);
    }

    #[test]
    fn scope_from_data_str_defaults() {
        assert_eq!(Scope::from_data_str(None), Scope::Generic);
        assert_eq!(Scope::from_data_str(Some("GARBAGE")), Scope::Generic);
        assert_eq!(Scope::default(), Scope::Generic);
    }

    #[test]
    fn affix_position_from_data_str_defaults() {
        assert_eq!(AffixPosition::from_data_str(None), AffixPosition::Prefix);
        assert_eq!(AffixPosition::from_data_str(Some("GARBAGE")), AffixPosition::Prefix);
        assert_eq!(AffixPosition::default(), AffixPosition::Prefix);
    }

    // --- from_data_str: case-insensitive recognized values ---

    #[test]
    fn from_data_str_is_case_insensitive() {
        assert_eq!(ModifierType::from_data_str(Some("MORE")), ModifierType::More);
        assert_eq!(ModifierType::from_data_str(Some("Conversion")), ModifierType::Conversion);
        assert_eq!(Scope::from_data_str(Some("SPELL")), Scope::Spell);
        assert_eq!(AffixPosition::from_data_str(Some("Suffix")), AffixPosition::Suffix);
    }

    // --- from_data_str: surrounding whitespace is tolerated ---

    #[test]
    fn from_data_str_trims_whitespace() {
        assert_eq!(ModifierType::from_data_str(Some(" flat ")), ModifierType::Flat);
        assert_eq!(Scope::from_data_str(Some("melee\n")), Scope::Melee);
        assert_eq!(AffixPosition::from_data_str(Some(" suffix")), AffixPosition::Suffix);
    }

    // --- Scope::matches_delivery preserves the historical short-circuit ---

    #[test]
    fn scope_matches_delivery_generic_always_matches() {
        assert!(Scope::Generic.matches_delivery(None));
        assert!(Scope::Generic.matches_delivery(Some(Scope::Melee)));
    }

    #[test]
    fn scope_matches_delivery_specific() {
        assert!(Scope::Melee.matches_delivery(Some(Scope::Melee)));
        assert!(!Scope::Melee.matches_delivery(Some(Scope::Spell)));
        // No primary designated → a specific scope never matches.
        assert!(!Scope::Melee.matches_delivery(None));
    }
}
