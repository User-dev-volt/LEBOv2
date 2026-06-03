//! Ailment stat computation (ignite/poison/bleed duration, stacks, freeze rate). FR-8.
//! Story 1.5: the FR-8 ailment *chances* live on `OffenseStats` and *avoidance* on `DefenseStats`
//! (both honest 0.0, no shipped source); this module fills the `AilmentStats` sub-sheet with the
//! duration/stack/freeze figures. `IgniteDuration` and `FreezeRateMultiplier` are sourced today
//! (idol affixes + blessings); `PoisonDuration` / `BleedDuration` / `MaxPoisonStacks` have no
//! loader path in the shipped data, so they query an empty key and surface 0.0 until one lands.

use crate::modifier::{ModifierRegistry, StatKey};
use crate::stat_sheet::AilmentStats;

/// Sum of a key's active modifiers, with a NaN/inf guard (bad data must not poison the sheet).
fn sum(registry: &ModifierRegistry, active: &[String], key: &StatKey) -> f64 {
    let total: f64 = registry.query(key, active).iter().map(|m| m.value).sum();
    if total.is_finite() {
        total
    } else {
        0.0
    }
}

pub(super) fn compute_ailment(registry: &ModifierRegistry, active: &[String]) -> AilmentStats {
    AilmentStats {
        ignite_duration: sum(registry, active, &StatKey::IgniteDuration),
        freeze_rate_multiplier: sum(registry, active, &StatKey::FreezeRateMultiplier),
        // Keys exist but no shipped loader path produces them → 0.0 (querying keeps them
        // forward-compatible: a future source flows in with no code change here).
        poison_duration: sum(registry, active, &StatKey::PoisonDuration),
        bleed_duration: sum(registry, active, &StatKey::BleedDuration),
        max_poison_stacks: sum(registry, active, &StatKey::MaxPoisonStacks),
    }
}

/// True when the build carries at least one non-zero ailment figure — drives the
/// `StatSheet.ailment` Some/None conditional presence (mirrors the Minion rule).
pub(super) fn has_ailment_data(a: &AilmentStats) -> bool {
    a.ignite_duration != 0.0
        || a.freeze_rate_multiplier != 0.0
        || a.poison_duration != 0.0
        || a.bleed_duration != 0.0
        || a.max_poison_stacks != 0.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modifier::{Condition, Modifier, ModifierType};

    fn registry_with(mods: Vec<(StatKey, f64)>) -> ModifierRegistry {
        let mut registry = ModifierRegistry::new();
        for (stat_key, value) in mods {
            registry.add(Modifier {
                stat_key,
                modifier_type: ModifierType::Increased,
                value,
                condition: Condition::Always,
                source: "test".to_string(),
            });
        }
        registry
    }

    #[test]
    fn sourced_duration_keys_populate() {
        let registry = registry_with(vec![
            (StatKey::IgniteDuration, 50.0),
            (StatKey::IgniteDuration, 10.0),
            (StatKey::FreezeRateMultiplier, 40.0),
        ]);
        let a = compute_ailment(&registry, &[]);
        assert_eq!(a.ignite_duration, 60.0);
        assert_eq!(a.freeze_rate_multiplier, 40.0);
    }

    #[test]
    fn unsourced_keys_are_zero() {
        // PoisonDuration/BleedDuration/MaxPoisonStacks have no loader path → 0.0.
        let a = compute_ailment(&registry_with(vec![]), &[]);
        assert_eq!(a.poison_duration, 0.0);
        assert_eq!(a.bleed_duration, 0.0);
        assert_eq!(a.max_poison_stacks, 0.0);
    }

    #[test]
    fn presence_rule_some_only_when_nonzero() {
        assert!(!has_ailment_data(&AilmentStats::default()), "all-zero → None");
        let a = compute_ailment(&registry_with(vec![(StatKey::IgniteDuration, 1.0)]), &[]);
        assert!(has_ailment_data(&a), "any non-zero figure → Some");
    }
}
