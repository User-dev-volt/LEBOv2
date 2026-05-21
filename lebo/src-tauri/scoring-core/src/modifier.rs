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
    // Speed
    AttackSpeed,
    CastSpeed,
    MovementSpeed,
    AreaOfEffect,
    CooldownRecoverySpeed,
    // Mana
    MaxMana,
    ManaRegenPerSec,
    // Penetration
    FirePenetration,
    ColdPenetration,
    LightningPenetration,
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
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ModifierType {
    Increased,
    More,
    Flat,
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
}

impl ModifierRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, modifier: Modifier) {
        self.modifiers.push(modifier);
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
