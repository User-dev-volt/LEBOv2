//! Penetration computation (fire/cold/lightning/physical/void penetration). FR-4.
//!
//! Scoring assumption: penetration is modelled against a **0%-resistance reference
//! target** (the standard theorycrafting dummy / build-planner default). Last Epoch's
//! penetration is *linear* — it subtracts from enemy resistance (which may go negative,
//! with no floor), and each 1% of negative resistance is +1% damage of that type:
//! `effective_enemy_res = 0 − pen` → damage × `(1 − effective_enemy_res/100)` = `(1 + pen/100)`.
//! This is NOT the `1/(1−r)` defensive-mitigation form (that is the player's own DR).
//! A no-penetration build therefore yields multiplier 1.0, keeping `damage_score`
//! byte-identical to the Phase-3 aggregate.
//!
//! Each penetration type only boosts the scored damage of its own element. Because the engine
//! has no per-type *damage-share* data yet, a multi-type ("hybrid") primary is modelled as an
//! **equal split** across its primary types — every primary type contributes one share, and a
//! type with no penetration (necrotic/poison) contributes an unpenetrated ×1.0 share. The result
//! is the mean of the per-type multipliers. When real damage-share data lands, replace the mean
//! with `Σ(shareᵢ × multᵢ)` — the per-type structure here is already that weighted sum with equal
//! weights.

use crate::modifier::{ModifierRegistry, ModifierType, StatKey};

/// Reference enemy resistance the score is computed against (0% dummy target).
const ENEMY_RES_BASELINE: f64 = 0.0;

/// Flat-summed penetration broken out per element, so each element's penetration can be applied
/// to its own damage share (not the whole aggregate). `generic_elemental` is `ElementalPenetration`,
/// which applies to fire/cold/lightning alike.
pub(super) struct PenByElement {
    pub fire: f64,
    pub cold: f64,
    pub lightning: f64,
    pub physical: f64,
    pub void: f64,
    pub generic_elemental: f64,
}

impl PenByElement {
    /// Surfaced AC4 "Elemental Penetration (fire/cold/lightning)" display figure: the sum of the
    /// three elemental channels plus generic `ElementalPenetration`. This is a reporting roll-up;
    /// the *multiplier* applies each element's penetration only to that element (see
    /// [`penetration_multiplier`]).
    pub fn elemental(&self) -> f64 {
        self.fire + self.cold + self.lightning + self.generic_elemental
    }
}

/// Sums the `Flat`-typed penetration modifiers per element.
///
/// Only `Flat`-typed penetration is summed (mirroring the crit/stun pattern). The loader emits all
/// sourced penetration as `Flat`; an `Increased` value would not be a penetration figure and must
/// not be summed here.
pub(super) fn compute_penetration(registry: &ModifierRegistry, active: &[String]) -> PenByElement {
    let sum = |key: StatKey| -> f64 {
        registry
            .query(&key, active)
            .iter()
            .filter(|m| m.modifier_type == ModifierType::Flat)
            .map(|m| m.value)
            .sum()
    };
    PenByElement {
        fire: sum(StatKey::FirePenetration),
        cold: sum(StatKey::ColdPenetration),
        lightning: sum(StatKey::LightningPenetration),
        physical: sum(StatKey::PhysicalPenetration),
        void: sum(StatKey::VoidPenetration),
        generic_elemental: sum(StatKey::ElementalPenetration),
    }
}

/// Damage multiplier penetration applies to the build's scored damage.
///
/// Each primary damage type draws only the penetration that applies to it: fire/cold/lightning each
/// take their own channel plus the generic elemental figure, physical takes physical, void takes
/// void, and a non-penetrable type (necrotic/poison/unmodeled) takes none → an unpenetrated ×1.0
/// share. The multiplier is the **mean** across all primary types (equal-split assumption; see the
/// module doc). A build with no primary element set — or all-zero penetration — yields 1.0,
/// preserving Phase-3 parity.
pub(super) fn penetration_multiplier(primary_elements: &[String], pen: &PenByElement) -> f64 {
    if primary_elements.is_empty() {
        return 1.0;
    }
    // Clamp each channel at 0: net negative penetration (effective enemy resistance above 100%)
    // means full immunity, not inverted/negative damage. Without this floor the orchestrator's
    // `damage_score *= mult` would bypass the `.max(0.01)` guard in compute_offense and could flip
    // the score negative.
    let pen_to_mult = |p: f64| (1.0 - (ENEMY_RES_BASELINE - p) / 100.0).max(0.0);

    let total: f64 = primary_elements
        .iter()
        .map(|el| {
            let applicable = match el.to_ascii_lowercase().as_str() {
                "fire" => pen.fire + pen.generic_elemental,
                "cold" => pen.cold + pen.generic_elemental,
                "lightning" => pen.lightning + pen.generic_elemental,
                "physical" => pen.physical,
                "void" => pen.void,
                // necrotic / poison / unmodeled: no penetration channel → unpenetrated share.
                _ => 0.0,
            };
            pen_to_mult(applicable)
        })
        .sum();
    total / primary_elements.len() as f64
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

    /// Builds a `PenByElement` for multiplier tests: (fire, cold, lightning, physical, void, generic).
    fn pen(fire: f64, cold: f64, lightning: f64, physical: f64, void: f64, generic: f64) -> PenByElement {
        PenByElement { fire, cold, lightning, physical, void, generic_elemental: generic }
    }

    fn elements(names: &[&str]) -> Vec<String> {
        names.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn elemental_and_physical_are_separated() {
        let registry = registry_with(vec![
            (StatKey::FirePenetration, 20.0),
            (StatKey::ColdPenetration, 5.0),
            (StatKey::PhysicalPenetration, 50.0),
        ]);
        let p = compute_penetration(&registry, &[]);
        assert!((p.elemental() - 25.0).abs() < 1e-9, "elemental expected 25 got {}", p.elemental());
        assert!((p.physical - 50.0).abs() < 1e-9, "physical expected 50 got {}", p.physical);
        assert_eq!(p.void, 0.0, "void expected 0 got {}", p.void);
    }

    #[test]
    fn generic_elemental_pen_folds_into_the_elemental_figure() {
        // A generic ElementalPenetration adds to the elemental roll-up (it applies to all three).
        let registry = registry_with(vec![
            (StatKey::FirePenetration, 10.0),
            (StatKey::ElementalPenetration, 15.0),
        ]);
        let p = compute_penetration(&registry, &[]);
        assert!((p.elemental() - 25.0).abs() < 1e-9, "elemental expected 25 got {}", p.elemental());
    }

    #[test]
    fn void_penetration_is_summed_separately() {
        let registry = registry_with(vec![(StatKey::VoidPenetration, 18.0)]);
        let p = compute_penetration(&registry, &[]);
        assert_eq!(p.elemental(), 0.0);
        assert_eq!(p.physical, 0.0);
        assert!((p.void - 18.0).abs() < 1e-9, "void expected 18 got {}", p.void);
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
        let p = compute_penetration(&registry, &[]);
        assert_eq!(p.elemental(), 0.0, "Increased-typed pen must be ignored, got {}", p.elemental());
    }

    #[test]
    fn no_penetration_yields_unit_multiplier() {
        let mult = penetration_multiplier(&elements(&["fire"]), &pen(0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        assert!((mult - 1.0).abs() < 1e-12, "no-pen multiplier must be 1.0, got {mult}");
    }

    #[test]
    fn elemental_penetration_scales_linearly() {
        // 30% fire penetration on a fire build → ×1.30 (linear, 0% baseline).
        let mult = penetration_multiplier(&elements(&["fire"]), &pen(30.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        assert!((mult - 1.30).abs() < 1e-9, "expected 1.30 got {mult}");
    }

    #[test]
    fn physical_penetration_applies_only_to_physical_primary() {
        // A fire-primary build ignores physical penetration entirely.
        let mult = penetration_multiplier(&elements(&["fire"]), &pen(0.0, 0.0, 0.0, 80.0, 0.0, 0.0));
        assert!((mult - 1.0).abs() < 1e-12, "physical pen must not touch a fire build, got {mult}");

        let mult_phys = penetration_multiplier(&elements(&["physical"]), &pen(0.0, 0.0, 0.0, 80.0, 0.0, 0.0));
        assert!((mult_phys - 1.80).abs() < 1e-9, "expected 1.80 got {mult_phys}");
    }

    #[test]
    fn void_penetration_applies_to_void_primary() {
        // Void is a real penetration channel (previously void primaries saw nothing).
        let mult = penetration_multiplier(&elements(&["void"]), &pen(0.0, 0.0, 0.0, 0.0, 40.0, 0.0));
        assert!((mult - 1.40).abs() < 1e-9, "void primary with 40 void pen expected 1.40 got {mult}");
        // Elemental/physical pen must not touch a void-primary build.
        let mult_other = penetration_multiplier(&elements(&["void"]), &pen(50.0, 0.0, 0.0, 50.0, 0.0, 0.0));
        assert!((mult_other - 1.0).abs() < 1e-12, "non-void pen must not touch void primary, got {mult_other}");
    }

    #[test]
    fn hybrid_primary_averages_channels_not_multiplies() {
        // A fire+physical primary with 50 fire and 100 physical pen: per-type multipliers are
        // ×1.50 and ×2.00 → averaged → 1.75 (NOT 1.50 × 2.00 = 3.00, the old over-count).
        let mult = penetration_multiplier(
            &elements(&["fire", "physical"]),
            &pen(50.0, 0.0, 0.0, 100.0, 0.0, 0.0),
        );
        assert!((mult - 1.75).abs() < 1e-9, "hybrid average expected 1.75 got {mult}");
    }

    #[test]
    fn hybrid_with_non_penetrable_type_dilutes_the_multiplier() {
        // A fire+necrotic primary with 50 fire pen: fire half is ×1.50, the necrotic half has no
        // penetration channel so it is an unpenetrated ×1.0 share → mean 1.25. (Regression for the
        // review finding: necrotic/poison primaries must dilute, not vanish from the denominator.)
        let mult = penetration_multiplier(
            &elements(&["fire", "necrotic"]),
            &pen(50.0, 0.0, 0.0, 0.0, 0.0, 0.0),
        );
        assert!((mult - 1.25).abs() < 1e-9, "fire+necrotic with 50 fire pen expected 1.25 got {mult}");
    }

    #[test]
    fn elemental_pen_applies_only_to_its_own_element() {
        // A pure-fire build with only Cold penetration sees no effect — cold pen must not fold into
        // a fire build's multiplier. (Regression for the review finding: the summed elemental figure
        // must not be applied whole to a single elemental primary.)
        let mult = penetration_multiplier(&elements(&["fire"]), &pen(0.0, 20.0, 0.0, 0.0, 0.0, 0.0));
        assert!((mult - 1.0).abs() < 1e-12, "cold pen must not touch a fire-only build, got {mult}");
    }

    #[test]
    fn generic_elemental_applies_to_each_elemental_primary() {
        // Generic ElementalPenetration applies to every elemental primary type.
        let mult = penetration_multiplier(&elements(&["fire", "cold"]), &pen(0.0, 0.0, 0.0, 0.0, 0.0, 30.0));
        assert!((mult - 1.30).abs() < 1e-9, "fire+cold with 30 generic elemental expected 1.30 got {mult}");
    }

    #[test]
    fn negative_penetration_floors_multiplier_at_zero() {
        // pen = -100 → effective res 100% → immunity (×0), never negative damage.
        let mult = penetration_multiplier(&elements(&["fire"]), &pen(-100.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        assert_eq!(mult, 0.0, "−100 pen must floor at 0, got {mult}");
        let mult_over = penetration_multiplier(&elements(&["fire"]), &pen(-250.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        assert_eq!(mult_over, 0.0, "pen below −100 must stay floored at 0, got {mult_over}");
    }

    #[test]
    fn non_penetrable_primary_sees_no_effect() {
        // Necrotic/poison primaries have no penetration channel; neither does an empty primary.
        let mult = penetration_multiplier(&elements(&["necrotic"]), &pen(40.0, 0.0, 0.0, 40.0, 40.0, 0.0));
        assert!((mult - 1.0).abs() < 1e-12, "necrotic primary must be 1.0, got {mult}");
        let mult_empty = penetration_multiplier(&[], &pen(40.0, 0.0, 0.0, 40.0, 40.0, 0.0));
        assert!((mult_empty - 1.0).abs() < 1e-12, "no primary must be 1.0, got {mult_empty}");
    }
}
