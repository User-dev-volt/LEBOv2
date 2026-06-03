//! Attribute stat computation (strength/dexterity/intelligence/attunement/vitality). FR-9.
//! Story 1.5: totals only — attribute→secondary-stat conversion is deferred to Phase 5 (no
//! parseable conversion ratio ships in the Season-4 data). Each total sums the registry
//! modifiers for that attribute's `StatKey` (Pattern P4-1); the attribute keys are sourced
//! from standalone passive tags via the loader and feed ONLY these totals — they never reach
//! `damage_score` / `effective_hp` / any existing aggregate.

use crate::modifier::{ModifierRegistry, StatKey};
use crate::stat_sheet::AttributeStats;

fn sum(registry: &ModifierRegistry, active: &[String], key: &StatKey) -> f64 {
    registry.query(key, active).iter().map(|m| m.value).sum()
}

pub(super) fn compute_attributes(registry: &ModifierRegistry, active: &[String]) -> AttributeStats {
    AttributeStats {
        strength: sum(registry, active, &StatKey::Strength),
        dexterity: sum(registry, active, &StatKey::Dexterity),
        intelligence: sum(registry, active, &StatKey::Intelligence),
        attunement: sum(registry, active, &StatKey::Attunement),
        // No VITALITY-tagged source ships today; this queries the (currently empty) key so a
        // future VITALITY source flows in with no further code change. 0.0 until then.
        vitality: sum(registry, active, &StatKey::Vitality),
    }
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
                modifier_type: ModifierType::Flat,
                value,
                condition: Condition::Always,
                source: "test".to_string(),
            });
        }
        registry
    }

    #[test]
    fn each_attribute_sums_independently() {
        let registry = registry_with(vec![
            (StatKey::Strength, 4.0),
            (StatKey::Strength, 6.0),
            (StatKey::Dexterity, 8.0),
        ]);
        let attrs = compute_attributes(&registry, &[]);
        assert_eq!(attrs.strength, 10.0, "strength must sum its own modifiers");
        assert_eq!(attrs.dexterity, 8.0);
        // No cross-bleed into the other attributes.
        assert_eq!(attrs.intelligence, 0.0);
        assert_eq!(attrs.attunement, 0.0);
        assert_eq!(attrs.vitality, 0.0);
    }

    #[test]
    fn vitality_unsourced_is_zero() {
        // No VITALITY-tagged source in shipped data → 0.0 even with other attributes present.
        let registry = registry_with(vec![(StatKey::Intelligence, 4.0)]);
        let attrs = compute_attributes(&registry, &[]);
        assert_eq!(attrs.vitality, 0.0);
        assert_eq!(attrs.intelligence, 4.0);
    }

    #[test]
    fn no_attribute_sources_yields_all_zero() {
        let attrs = compute_attributes(&registry_with(vec![]), &[]);
        assert_eq!(attrs.strength, 0.0);
        assert_eq!(attrs.dexterity, 0.0);
        assert_eq!(attrs.intelligence, 0.0);
        assert_eq!(attrs.attunement, 0.0);
        assert_eq!(attrs.vitality, 0.0);
    }
}
