//! Effective-HP triple (vs Hits / vs DoTs / vs one-shots) computation. FR-6.
//!
//! Methodology reproduces the tunklab/Maxroll *observable* EHP output (ADR-P4-001, SM-1) — it is
//! NOT an independently-derived formula. Mitigation layers stack **multiplicatively**: total damage
//! taken = `Π (1 − layer_dr)`, and EHP = `pool / total_damage_taken` (Maxroll, "Defenses Explained").
//!
//! Layer applicability differs per attack class (Maxroll):
//!   - **Hits:** armour, resistance, endurance%, and the hit-only avoidance layers (dodge / parry /
//!     block / glancing) all apply, each as an average damage-reduction term.
//!   - **DoTs:** in LE neither armour nor the avoidance layers reduce damage-over-time — only
//!     resistance and endurance% apply.
//!   - **One-shots:** a single un-averaged maximum hit. The endurance threshold is a **hard floor**
//!     (endurance% mitigates only the portion of the hit taken while below the threshold), and the
//!     avoidance layers are excluded (a dodge/parry/block roll cannot be relied on to survive).
//!
//! All inputs are read from the already-computed (registry-sourced) `DefenseStats` — never from raw
//! `BuildSnapshot` fields (Pattern P4-1). These are display-only values; they deliberately do NOT
//! feed `effective_hp` / `survivability_score` / `build_score` (the frozen Phase-3 parity gate).

use crate::stat_sheet::DefenseStats;

/// LE resistance mitigation cap (75%). Over-cap resistance gives no extra mitigation.
const RESISTANCE_CAP: f64 = 75.0;
/// Armour mitigation cap (85%), mirroring `defense.rs::ARMOR_MITIGATION_CAP`.
const ARMOR_DR_CAP: f64 = 0.85;
/// Endurance mitigation cap (90%), mirroring the clamp in `defense.rs`.
const ENDURANCE_DR_CAP: f64 = 0.90;
/// Parry fully negates a hit when it procs; chance caps at 75% (Maxroll).
const PARRY_DR_CAP: f64 = 0.75;
/// A glancing blow reduces a hit by 35% (Maxroll).
const GLANCING_REDUCTION: f64 = 0.35;
/// Floor on the fraction of damage taken so EHP can never reach `Inf`/`NaN`, guarding the degenerate
/// full-avoidance case (e.g. 100% dodge → `1/(1−1)`), per AC1. As the divisor floor on the `vs_hits`
/// / `vs_dots` branches this caps those two figures at 100× pool; `vs_one_shots` divides by a
/// separately-floored `armor_res_factor` and is intentionally NOT capped at 100× (a high endurance
/// threshold legitimately survives a much larger one-shot — it stays finite via `finite_or_zero`).
const MIN_DAMAGE_TAKEN: f64 = 0.01;

/// The three independent EHP figures (FR-6).
pub(super) struct EhpTriple {
    pub vs_hits: f64,
    pub vs_dots: f64,
    pub vs_one_shots: f64,
}

/// Computes the FR-6 EHP triple from the already-computed defensive layers.
///
/// **Generic-resistance assumption:** the three EHP figures are single scalars, so the seven
/// per-type resistances are collapsed to one value — the **average of the seven capped
/// resistances** — representing EHP in a mixed-damage environment. This is the documented modelling
/// choice (the analogue of Story 1.3's armour `K=1104` reference constant), recorded as an
/// assumption rather than a per-type EHP breakdown (a Story-1.6 display concern if ever needed).
pub(super) fn compute_ehp(defense: &DefenseStats) -> EhpTriple {
    // Ward acts as an extra absorption buffer on top of raw HP (matches the legacy ward-as-pool
    // treatment in `effective_hp`). `stable_ward` (FR-7) is a separate equilibrium figure.
    let pool = (defense.raw_hp + defense.ward).max(0.0);

    let armor_dr = (defense.armor_mitigation_percent / 100.0).clamp(0.0, ARMOR_DR_CAP);
    let endurance_dr = (defense.endurance_percent / 100.0).clamp(0.0, ENDURANCE_DR_CAP);

    // Generic resistance = average of the seven resistances, each capped at 75% (over-cap is wasted;
    // negative resistance is left intact — it legitimately increases damage taken).
    let resistances = [
        defense.fire_resistance,
        defense.cold_resistance,
        defense.lightning_resistance,
        defense.void_resistance,
        defense.poison_resistance,
        defense.physical_resistance,
        defense.necrotic_resistance,
    ];
    let avg_res = resistances.iter().map(|r| r.min(RESISTANCE_CAP)).sum::<f64>()
        / resistances.len() as f64;
    let resistance_dr = avg_res / 100.0;

    // Hit-only avoidance, expressed as an average damage-taken multiplier (1.0 = no avoidance).
    // Dodge avoids the whole hit; parry negates the whole hit; glancing reduces by 35%; block
    // reduces by its effectiveness. All currently 0.0 in production (Story 1.3 audit) — the math is
    // wired so the values flow once a real source lands.
    let dodge = (defense.dodge_chance / 100.0).clamp(0.0, 1.0);
    let parry = (defense.parry_chance / 100.0).clamp(0.0, PARRY_DR_CAP);
    let glancing = (defense.glancing_blow_chance / 100.0).clamp(0.0, 1.0);
    let block = (defense.block_chance / 100.0).clamp(0.0, 1.0)
        * (defense.block_effectiveness / 100.0).clamp(0.0, 1.0);
    let avoidance_factor =
        (1.0 - dodge) * (1.0 - parry) * (1.0 - glancing * GLANCING_REDUCTION) * (1.0 - block);

    // vs Hits — every layer.
    let taken_hits = (1.0 - armor_dr) * (1.0 - resistance_dr) * (1.0 - endurance_dr) * avoidance_factor;
    let vs_hits = finite_or_zero(pool / taken_hits.max(MIN_DAMAGE_TAKEN));

    // vs DoTs — resistance + endurance only (no armour, no avoidance).
    let taken_dots = (1.0 - resistance_dr) * (1.0 - endurance_dr);
    let vs_dots = finite_or_zero(pool / taken_dots.max(MIN_DAMAGE_TAKEN));

    // vs one-shots — single max hit, no averaged avoidance, endurance threshold a hard floor.
    // The pool splits at the endurance threshold T: the band above T takes full (post armour/res)
    // damage; the band at/below T is endurance-mitigated, so it absorbs `T/(1−end_dr)` of incoming
    // post-armour/res damage. Max survivable raw hit = (above + below_capacity) / (armour × res).
    let threshold = defense.endurance_threshold.clamp(0.0, pool);
    let above = pool - threshold;
    let below_capacity = threshold / (1.0 - endurance_dr); // endurance_dr ≤ 0.90 → denom ≥ 0.10
    let post_mitigation_capacity = above + below_capacity;
    let armor_res_factor = ((1.0 - armor_dr) * (1.0 - resistance_dr)).max(MIN_DAMAGE_TAKEN);
    let vs_one_shots = finite_or_zero(post_mitigation_capacity / armor_res_factor);

    EhpTriple { vs_hits, vs_dots, vs_one_shots }
}

/// Returns `v` if finite, else `0.0`. Defensive final guard against any residual `NaN`/`Inf`.
fn finite_or_zero(v: f64) -> f64 {
    if v.is_finite() {
        v
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A defense with only the fields EHP reads; everything else 0.0 (matching production zeros).
    fn defense(raw_hp: f64, ward: f64) -> DefenseStats {
        DefenseStats { raw_hp, ward, ..Default::default() }
    }

    #[test]
    fn no_mitigation_equals_pool() {
        // No layers → all three EHP figures equal the pool (raw_hp + ward).
        let d = defense(1000.0, 0.0);
        let ehp = compute_ehp(&d);
        assert!((ehp.vs_hits - 1000.0).abs() < 0.01);
        assert!((ehp.vs_dots - 1000.0).abs() < 0.01);
        assert!((ehp.vs_one_shots - 1000.0).abs() < 0.01);
    }

    #[test]
    fn ward_is_added_to_the_pool() {
        let d = defense(1000.0, 250.0);
        let ehp = compute_ehp(&d);
        assert!((ehp.vs_hits - 1250.0).abs() < 0.01, "pool should be raw_hp + ward");
    }

    #[test]
    fn armor_and_resistance_multiply_for_hits_but_dots_exclude_armor() {
        // armor_mitigation 50%, all res 75% → hits taken = 0.5 × 0.25 = 0.125 → 8000;
        // dots exclude armor → taken = 0.25 → 4000.
        let mut d = defense(1000.0, 0.0);
        d.armor_mitigation_percent = 50.0;
        d.fire_resistance = 75.0;
        d.cold_resistance = 75.0;
        d.lightning_resistance = 75.0;
        d.void_resistance = 75.0;
        d.poison_resistance = 75.0;
        d.physical_resistance = 75.0;
        d.necrotic_resistance = 75.0;
        let ehp = compute_ehp(&d);
        assert!((ehp.vs_hits - 8000.0).abs() < 1.0, "vs_hits {}", ehp.vs_hits);
        assert!((ehp.vs_dots - 4000.0).abs() < 1.0, "vs_dots {}", ehp.vs_dots);
    }

    #[test]
    fn dodge_helps_hits_only_not_dots_or_one_shots() {
        // 20% dodge boosts vs_hits but is excluded from vs_dots and vs_one_shots.
        let mut d = defense(1000.0, 0.0);
        d.dodge_chance = 20.0;
        let ehp = compute_ehp(&d);
        assert!((ehp.vs_hits - 1250.0).abs() < 1.0, "1000/0.8 = 1250, got {}", ehp.vs_hits);
        assert!((ehp.vs_dots - 1000.0).abs() < 1.0, "dodge excluded from dots");
        assert!((ehp.vs_one_shots - 1000.0).abs() < 1.0, "dodge excluded from one-shots");
    }

    #[test]
    fn endurance_threshold_is_a_hard_floor_for_one_shots() {
        // pool 2000, threshold 1000, endurance 30%:
        // above = 1000, below_capacity = 1000/0.7 = 1428.57 → capacity 2428.57; no armor/res → /1.
        let mut d = defense(2000.0, 0.0);
        d.endurance_percent = 30.0;
        d.endurance_threshold = 1000.0;
        let ehp = compute_ehp(&d);
        assert!(
            (ehp.vs_one_shots - 2428.57).abs() < 1.0,
            "one-shot with endurance threshold, got {}",
            ehp.vs_one_shots
        );
    }

    #[test]
    fn full_avoidance_does_not_produce_inf_or_nan() {
        // 100% dodge would make taken_hits = 0 → guarded by MIN_DAMAGE_TAKEN (EHP capped at 100×).
        let mut d = defense(1000.0, 0.0);
        d.dodge_chance = 100.0;
        let ehp = compute_ehp(&d);
        assert!(ehp.vs_hits.is_finite(), "must not be Inf/NaN");
        assert!((ehp.vs_hits - 100_000.0).abs() < 1.0, "capped at 100× pool, got {}", ehp.vs_hits);
    }

    #[test]
    fn over_cap_resistance_is_clamped_at_75() {
        // 200% fire res is wasted past the 75% cap; with all others 0 the average is 75/7 ≈ 10.71%.
        let mut d = defense(1000.0, 0.0);
        d.fire_resistance = 200.0;
        let ehp = compute_ehp(&d);
        let expected = 1000.0 / (1.0 - (75.0 / 7.0) / 100.0);
        assert!((ehp.vs_dots - expected).abs() < 1.0, "expected {} got {}", expected, ehp.vs_dots);
    }
}
