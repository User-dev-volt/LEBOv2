//! Ward generation and Stable-Ward / Stable-HP equilibrium computation. FR-7.
//!
//! In Last Epoch, Ward is a decaying buffer: it is lost each second at a rate that rises with the
//! current ward amount and is slowed by Ward Retention. The **stable (equilibrium) ward** is the
//! amount at which generation exactly offsets decay (Maxroll, "Defenses Explained"; lastepochtools
//! Ward reference). Modelled here as the closed form the story specifies — *equilibrium ward =
//! generation ÷ effective-decay-rate* — reproducing the calculator's observable output (SM-1), not
//! an independently-derived formula. The `tests/ehp_reference.rs` ±2% gate is the parity authority.
//!
//! **[ASSUMPTION] honesty rule (AC2):** Ward Retention, Ward Decay Threshold, %Current-Health-Lost
//! /sec and %Missing-Health→Ward/sec have **no shipped Season-4 source** (Story 1.3 audit) — they
//! surface as `0.0` with no `StatKey` (no dead keys). So in production Stable Ward is purely
//! generation-driven: `stable_ward = ward_per_sec / BASE_WARD_DECAY_RATE`. The retention and
//! decay-threshold terms below are wired correctly and take effect automatically once a real source
//! is added, without any change here.

use crate::stat_sheet::DefenseStats;

/// Base LE ward decay rate: ward decays toward zero at ~40% of the current amount per second at
/// zero Ward Retention (Maxroll/lastepochtools observable behaviour). Ward Retention slows this.
const BASE_WARD_DECAY_RATE: f64 = 0.40;

/// Stable Ward and Stable HP at equilibrium (FR-7).
pub(super) struct WardEquilibrium {
    pub stable_ward: f64,
    pub stable_hp: f64,
}

/// Computes the FR-7 equilibrium figures from the already-computed defensive layers.
///
/// `defense.ward` is the per-second ward generation proxy (sum of Ward/sec + Ward-on-hit from the
/// registry). Degenerate inputs (zero generation, negative retention) resolve to `0.0` — never
/// `NaN`/`Inf` (AC2).
pub(super) fn compute_ward(defense: &DefenseStats) -> WardEquilibrium {
    let generation = defense.ward;
    let raw_hp = defense.raw_hp.max(0.0);

    // No generation → ward decays to nothing; equilibrium pool is just raw HP.
    if generation <= 0.0 {
        return WardEquilibrium { stable_ward: 0.0, stable_hp: raw_hp };
    }

    // Ward Retention slows decay multiplicatively. Guarded so a (currently impossible) negative
    // retention can never drive the effective rate to zero or negative.
    let retention_mult = (1.0 + defense.ward_retention / 100.0).max(0.01);
    let effective_decay_rate = BASE_WARD_DECAY_RATE / retention_mult; // > 0

    // Ward up to the decay threshold is retained (does not decay); only the portion above it
    // equilibrates where generation == decay. With the threshold at its production 0.0 this reduces
    // to the pure generation-driven form.
    let threshold = defense.ward_decay_threshold.max(0.0);
    let stable_ward = (threshold + generation / effective_decay_rate).max(0.0);

    let stable_ward = finite_or_zero(stable_ward);
    let stable_hp = finite_or_zero(raw_hp + stable_ward);
    WardEquilibrium { stable_ward, stable_hp }
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

    fn defense(raw_hp: f64, ward: f64) -> DefenseStats {
        DefenseStats { raw_hp, ward, ..Default::default() }
    }

    #[test]
    fn zero_generation_yields_zero_stable_ward() {
        let d = defense(1500.0, 0.0);
        let w = compute_ward(&d);
        assert_eq!(w.stable_ward, 0.0);
        assert!((w.stable_hp - 1500.0).abs() < 0.01, "stable_hp = raw_hp when no ward");
    }

    #[test]
    fn generation_driven_equilibrium_at_zero_retention() {
        // 200 ward/sec, retention 0, threshold 0 → 200 / 0.40 = 500.
        let d = defense(2000.0, 200.0);
        let w = compute_ward(&d);
        assert!((w.stable_ward - 500.0).abs() < 0.01, "stable_ward {}", w.stable_ward);
        assert!((w.stable_hp - 2500.0).abs() < 0.01, "stable_hp = raw_hp + stable_ward");
    }

    #[test]
    fn retention_increases_stable_ward() {
        // retention 100% doubles retention_mult (2.0) → rate halves (0.20) → ward doubles to 1000.
        let mut d = defense(2000.0, 200.0);
        d.ward_retention = 100.0;
        let w = compute_ward(&d);
        assert!((w.stable_ward - 1000.0).abs() < 0.01, "stable_ward {}", w.stable_ward);
    }

    #[test]
    fn decay_threshold_is_retained_below_equilibrium() {
        // threshold 300 is retained; the decaying part adds 200/0.40 = 500 → 800 total.
        let mut d = defense(2000.0, 200.0);
        d.ward_decay_threshold = 300.0;
        let w = compute_ward(&d);
        assert!((w.stable_ward - 800.0).abs() < 0.01, "stable_ward {}", w.stable_ward);
    }

    #[test]
    fn degenerate_inputs_never_nan_or_inf() {
        let mut d = defense(0.0, 50.0);
        d.ward_retention = -100.0; // would zero the divisor without the guard
        let w = compute_ward(&d);
        assert!(w.stable_ward.is_finite() && w.stable_hp.is_finite());
    }
}
