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

use crate::modifier::{ModifierRegistry, ModifierType, StatKey};

/// Reference enemy resistance the score is computed against (0% dummy target).
const ENEMY_RES_BASELINE: f64 = 0.0;

/// Returns `(elemental_penetration, physical_penetration, void_penetration)`.
///
/// Only `Flat`-typed penetration modifiers are summed (mirroring the crit/stun pattern). The
/// loader emits all sourced penetration as `Flat`; an `Increased` value would not be a penetration
/// figure and must not be summed in here.
///
/// Elemental penetration is the **sum** of fire/cold/lightning penetration plus any generic
/// `ElementalPenetration` (which applies to all three elements) — a build's penetration sources
/// land on its single damage element, so summing is the simplest faithful figure (cross-element
/// penetration is rare and adds linearly anyway). Void is a modeled LE type with its own pen
/// sources, surfaced separately.
pub(super) fn compute_penetration(registry: &ModifierRegistry, active: &[String]) -> (f64, f64, f64) {
    let sum = |key: StatKey| -> f64 {
        registry
            .query(&key, active)
            .iter()
            .filter(|m| m.modifier_type == ModifierType::Flat)
            .map(|m| m.value)
            .sum()
    };
    let elemental = sum(StatKey::FirePenetration)
        + sum(StatKey::ColdPenetration)
        + sum(StatKey::LightningPenetration)
        + sum(StatKey::ElementalPenetration);
    let physical = sum(StatKey::PhysicalPenetration);
    let void = sum(StatKey::VoidPenetration);
    (elemental, physical, void)
}

/// Damage multiplier the penetration applies to the scored damage of the build's primary
/// damage type(s). Each penetration channel applies when the primary elements include a type
/// served by that channel: elemental → fire/cold/lightning, physical → physical, void → void.
/// A build whose primary type has no penetration channel — or has no primary element set —
/// sees multiplier 1.0, preserving parity.
///
/// When a build is hybrid (multiple primary types, e.g. `["fire","physical"]`), the channel
/// multipliers are **averaged**, not multiplied: the aggregate `damage_score` is a single number
/// representing the build's total damage, and each type's penetration only affects that type's
/// share. With no portion data we assume an equal split, so the effective multiplier on the total
/// is the mean of the applicable channels. (Multiplying them — the pre-fix behaviour — over-counted
/// by applying every channel to the whole aggregate.)
pub(super) fn penetration_multiplier(
    primary_elements: &[String],
    elemental_penetration: f64,
    physical_penetration: f64,
    void_penetration: f64,
) -> f64 {
    let has = |name: &str| primary_elements.iter().any(|e| e.eq_ignore_ascii_case(name));
    // Clamp each channel at 0: net negative penetration (effective enemy resistance
    // above 100%) means full immunity, not inverted/negative damage. Without this floor
    // the orchestrator's `damage_score *= mult` would bypass the `.max(0.01)` guard in
    // compute_offense and could flip the score negative.
    let pen_to_mult = |pen: f64| (1.0 - (ENEMY_RES_BASELINE - pen) / 100.0).max(0.0);

    let mut channels: Vec<f64> = Vec::new();
    if has("fire") || has("cold") || has("lightning") {
        channels.push(pen_to_mult(elemental_penetration));
    }
    if has("physical") {
        channels.push(pen_to_mult(physical_penetration));
    }
    if has("void") {
        channels.push(pen_to_mult(void_penetration));
    }
    if channels.is_empty() {
        return 1.0;
    }
    channels.iter().sum::<f64>() / channels.len() as f64
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
        let (elemental, physical, void) = compute_penetration(&registry, &[]);
        assert!((elemental - 25.0).abs() < 1e-9, "elemental expected 25 got {elemental}");
        assert!((physical - 50.0).abs() < 1e-9, "physical expected 50 got {physical}");
        assert_eq!(void, 0.0, "void expected 0 got {void}");
    }

    #[test]
    fn generic_elemental_pen_folds_into_the_elemental_figure() {
        // A generic ElementalPenetration adds to fire/cold/lightning (it applies to all three).
        let registry = registry_with(vec![
            (StatKey::FirePenetration, 10.0),
            (StatKey::ElementalPenetration, 15.0),
        ]);
        let (elemental, _physical, _void) = compute_penetration(&registry, &[]);
        assert!((elemental - 25.0).abs() < 1e-9, "elemental expected 25 got {elemental}");
    }

    #[test]
    fn void_penetration_is_summed_separately() {
        let registry = registry_with(vec![(StatKey::VoidPenetration, 18.0)]);
        let (elemental, physical, void) = compute_penetration(&registry, &[]);
        assert_eq!(elemental, 0.0);
        assert_eq!(physical, 0.0);
        assert!((void - 18.0).abs() < 1e-9, "void expected 18 got {void}");
    }

    #[test]
    fn increased_typed_pen_is_ignored() {
        // compute_penetration filters Flat only; an Increased-typed pen value is not a real
        // penetration figure and must be dropped (the loader emits sourced pen as Flat).
        let mut registry = ModifierRegistry::new();
        registry.add(Modifier {
            stat_key: StatKey::FirePenetration,
            modifier_type: ModifierType::Increased,
            value: 99.0,
            condition: Condition::Always,
            source: "test".to_string(),
        });
        let (elemental, _physical, _void) = compute_penetration(&registry, &[]);
        assert_eq!(elemental, 0.0, "Increased-typed pen must be ignored, got {elemental}");
    }

    #[test]
    fn no_penetration_yields_unit_multiplier() {
        let mult = penetration_multiplier(&["fire".to_string()], 0.0, 0.0, 0.0);
        assert!((mult - 1.0).abs() < 1e-12, "no-pen multiplier must be 1.0, got {mult}");
    }

    #[test]
    fn elemental_penetration_scales_linearly() {
        // 30% elemental penetration on a fire build → ×1.30 (linear, 0% baseline).
        let mult = penetration_multiplier(&["fire".to_string()], 30.0, 0.0, 0.0);
        assert!((mult - 1.30).abs() < 1e-9, "expected 1.30 got {mult}");
    }

    #[test]
    fn physical_penetration_applies_only_to_physical_primary() {
        // A fire-primary build ignores physical penetration entirely.
        let mult = penetration_multiplier(&["fire".to_string()], 0.0, 80.0, 0.0);
        assert!((mult - 1.0).abs() < 1e-12, "physical pen must not touch a fire build, got {mult}");

        let mult_phys = penetration_multiplier(&["physical".to_string()], 0.0, 80.0, 0.0);
        assert!((mult_phys - 1.80).abs() < 1e-9, "expected 1.80 got {mult_phys}");
    }

    #[test]
    fn void_penetration_applies_to_void_primary() {
        // Void is now a real penetration channel (previously void primaries saw nothing).
        let mult = penetration_multiplier(&["void".to_string()], 0.0, 0.0, 40.0);
        assert!((mult - 1.40).abs() < 1e-9, "void primary with 40 void pen expected 1.40 got {mult}");
        // Elemental/physical pen must not touch a void-primary build.
        let mult_other = penetration_multiplier(&["void".to_string()], 50.0, 50.0, 0.0);
        assert!((mult_other - 1.0).abs() < 1e-12, "non-void pen must not touch void primary, got {mult_other}");
    }

    #[test]
    fn hybrid_primary_averages_channels_not_multiplies() {
        // A fire+physical primary with 50 elemental and 100 physical pen: channels are
        // ×1.50 and ×2.00 → averaged → 1.75 (NOT 1.50 × 2.00 = 3.00, the old over-count).
        let mult = penetration_multiplier(
            &["fire".to_string(), "physical".to_string()],
            50.0,
            100.0,
            0.0,
        );
        assert!((mult - 1.75).abs() < 1e-9, "hybrid average expected 1.75 got {mult}");
    }

    #[test]
    fn negative_penetration_floors_multiplier_at_zero() {
        // pen = -100 → effective res 100% → immunity (×0), never negative damage.
        let mult = penetration_multiplier(&["fire".to_string()], -100.0, 0.0, 0.0);
        assert_eq!(mult, 0.0, "−100 pen must floor at 0, got {mult}");
        let mult_over = penetration_multiplier(&["fire".to_string()], -250.0, 0.0, 0.0);
        assert_eq!(mult_over, 0.0, "pen below −100 must stay floored at 0, got {mult_over}");
    }

    #[test]
    fn non_penetrable_primary_sees_no_effect() {
        // Necrotic/poison primaries have no penetration channel; neither does an empty primary.
        let mult = penetration_multiplier(&["necrotic".to_string()], 40.0, 40.0, 40.0);
        assert!((mult - 1.0).abs() < 1e-12, "necrotic primary must be 1.0, got {mult}");
        let mult_empty = penetration_multiplier(&[], 40.0, 40.0, 40.0);
        assert!((mult_empty - 1.0).abs() < 1e-12, "no primary must be 1.0, got {mult_empty}");
    }
}
