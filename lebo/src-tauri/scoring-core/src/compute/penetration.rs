//! Penetration computation (fire/cold/lightning/physical penetration). FR-4.
//!
//! Scoring assumption: penetration is modelled against a **0%-resistance reference
//! target** (the standard theorycrafting dummy / build-planner default). Last Epoch's
//! penetration is *linear* — it subtracts from enemy resistance (which may go negative,
//! with no floor), and each 1% of negative resistance is +1% damage of that type:
//! `effective_enemy_res = 0 − pen` → damage × `(1 − effective_enemy_res/100)` = `(1 + pen/100)`.
//! This is NOT the `1/(1−r)` defensive-mitigation form (that is the player's own DR).
//! A no-penetration build therefore yields multiplier 1.0, keeping `damage_score`
//! byte-identical to the Phase-3 aggregate.

use crate::modifier::{ModifierRegistry, StatKey};

/// Reference enemy resistance the score is computed against (0% dummy target).
const ENEMY_RES_BASELINE: f64 = 0.0;

/// Returns `(elemental_penetration, physical_penetration)`.
///
/// Elemental penetration is the **sum** of fire/cold/lightning penetration — a build's
/// penetration sources land on its single damage element, so summing is the simplest
/// faithful figure (cross-element penetration is rare and adds linearly anyway).
pub(super) fn compute_penetration(registry: &ModifierRegistry, active: &[String]) -> (f64, f64) {
    let sum = |key: StatKey| -> f64 {
        registry.query(&key, active).iter().map(|m| m.value).sum()
    };
    let elemental = sum(StatKey::FirePenetration)
        + sum(StatKey::ColdPenetration)
        + sum(StatKey::LightningPenetration);
    let physical = sum(StatKey::PhysicalPenetration);
    (elemental, physical)
}

/// Damage multiplier the penetration applies to the scored damage of the build's
/// primary damage type(s). Elemental penetration applies when the primary elements
/// include fire/cold/lightning; physical penetration when they include physical.
/// A build whose primary element is neither (void/necrotic/poison) — or has no primary
/// element set — sees no penetration effect (multiplier 1.0), preserving parity.
pub(super) fn penetration_multiplier(
    primary_elements: &[String],
    elemental_penetration: f64,
    physical_penetration: f64,
) -> f64 {
    let has = |name: &str| {
        primary_elements
            .iter()
            .any(|e| e.eq_ignore_ascii_case(name))
    };
    let pen_to_mult = |pen: f64| 1.0 - (ENEMY_RES_BASELINE - pen) / 100.0;

    let mut mult = 1.0;
    if has("fire") || has("cold") || has("lightning") {
        mult *= pen_to_mult(elemental_penetration);
    }
    if has("physical") {
        mult *= pen_to_mult(physical_penetration);
    }
    mult
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
    fn elemental_and_physical_are_separated() {
        let registry = registry_with(vec![
            (StatKey::FirePenetration, 20.0),
            (StatKey::ColdPenetration, 5.0),
            (StatKey::PhysicalPenetration, 50.0),
        ]);
        let (elemental, physical) = compute_penetration(&registry, &[]);
        assert!((elemental - 25.0).abs() < 1e-9, "elemental expected 25 got {elemental}");
        assert!((physical - 50.0).abs() < 1e-9, "physical expected 50 got {physical}");
    }

    #[test]
    fn no_penetration_yields_unit_multiplier() {
        let mult = penetration_multiplier(&["fire".to_string()], 0.0, 0.0);
        assert!((mult - 1.0).abs() < 1e-12, "no-pen multiplier must be 1.0, got {mult}");
    }

    #[test]
    fn elemental_penetration_scales_linearly() {
        // 30% elemental penetration on a fire build → ×1.30 (linear, 0% baseline).
        let mult = penetration_multiplier(&["fire".to_string()], 30.0, 0.0);
        assert!((mult - 1.30).abs() < 1e-9, "expected 1.30 got {mult}");
    }

    #[test]
    fn physical_penetration_applies_only_to_physical_primary() {
        // A fire-primary build ignores physical penetration entirely.
        let mult = penetration_multiplier(&["fire".to_string()], 0.0, 80.0);
        assert!((mult - 1.0).abs() < 1e-12, "physical pen must not touch a fire build, got {mult}");

        let mult_phys = penetration_multiplier(&["physical".to_string()], 0.0, 80.0);
        assert!((mult_phys - 1.80).abs() < 1e-9, "expected 1.80 got {mult_phys}");
    }

    #[test]
    fn non_penetrable_primary_sees_no_effect() {
        // Void/necrotic/poison primaries have no penetration channel here.
        let mult = penetration_multiplier(&["void".to_string()], 40.0, 40.0);
        assert!((mult - 1.0).abs() < 1e-12, "void primary must be 1.0, got {mult}");
        let mult_empty = penetration_multiplier(&[], 40.0, 40.0);
        assert!((mult_empty - 1.0).abs() < 1e-12, "no primary must be 1.0, got {mult_empty}");
    }
}
