//! FR-6 / FR-7 EHP-triple + Stable-Ward parity gate (NFR-1 / SM-1).
//!
//! Cargo auto-discovers `tests/*.rs` as a separate integration crate — no `[[test]]` entry in
//! `Cargo.toml` is required. Each reference build is constructed through the **public** crate API
//! (`scoring_core::compute_stats` + the re-exported `GameData`/`BuildSnapshot`/… types), and every
//! computed `ehp_vs_*` / `stable_ward` / `stable_hp` is asserted within **±2%** of a recorded
//! reference figure. A drift beyond ±2% fails CI (NFR-1).
//!
//! REFERENCE SOURCE (auditable, reproducible)
//! ------------------------------------------
//! The SM-1 authority is the live tunklab EHP/Ward calculator. That calculator is a client-side
//! JS app and is unreachable from this headless build environment (Story 1.3 hit HTTP 403 on
//! lastepochtools; tunklab is JS-gated), so — per the Story 1.4 "primary risk" fallback — the
//! recorded expected values below are taken from the **documented LE closed form** (Maxroll,
//! "Defenses Explained": multiplicative mitigation `EHP = pool / Π(1 − layer_dr)`, armour cap 85%,
//! resistance cap 75%, endurance cap 90% with the threshold as a hard floor for single hits; ward
//! decay ~40%/sec at zero retention). Each fixture records its exact inputs and the hand-computed
//! arithmetic that produced the literal, so the gate is reproducible and a future formula drift
//! breaks the assertion. When the live tunklab numbers are captured, swap the literals here and
//! note the source/date.
//!
//! Recorded: 2026-06-03 (closed-form reference; see above).

use scoring_core::{
    compute_stats, BaseClassStats, BuildSnapshot, ComputeOptions, Condition, GameData, ModifierType,
    NodeEffect, StatKey,
};
use std::collections::HashMap;

/// ±2% tolerance per NFR-1 / SM-1.
const TOLERANCE: f64 = 0.02;

fn assert_within_2pct(label: &str, actual: f64, expected: f64) {
    let denom = if expected.abs() < 1e-9 { 1.0 } else { expected.abs() };
    let rel = (actual - expected).abs() / denom;
    assert!(
        rel <= TOLERANCE,
        "{label}: expected {expected} (±2%), got {actual} (relative drift {:.4})",
        rel
    );
}

/// Builds GameData with one node per effect and a single class base-HP entry.
fn game_data_with(class_id: &str, base_hp: f64, node_effects: HashMap<String, Vec<NodeEffect>>) -> GameData {
    let mut class_base_stats = HashMap::new();
    class_base_stats.insert(
        class_id.to_string(),
        BaseClassStats { base_hp, hp_per_level: 0.0 },
    );
    GameData { node_effects, class_base_stats, ..Default::default() }
}

fn flat(stat_key: StatKey, value: f64) -> NodeEffect {
    NodeEffect { stat_key, modifier_type: ModifierType::Flat, value, condition: Condition::Always }
}

/// Level-1 snapshot for `class_id` with every listed node allocated 1 point.
fn snapshot_for(class_id: &str, node_ids: &[&str]) -> BuildSnapshot {
    let mut s = BuildSnapshot::default();
    s.class_id = class_id.to_string();
    s.character_level = 1;
    s.slider_position = 50;
    for id in node_ids {
        s.node_allocations.insert((*id).to_string(), 1);
    }
    s
}

// ---------------------------------------------------------------------------
// Fixture A — armour + resistance hit-tank. Distinguishes vs Hits (armour applies)
// from vs DoTs (armour excluded).
//   Inputs: raw_hp 1000 (base_hp 1000, lvl 1), no ward; Armor 1104 → 1104/(1104+1104) = 50%
//   mitigation; AllResistances 75 → avg of 7 capped res = 75% ; endurance 0; avoidance 0.
//   pool = 1000.
//   vs_hits      = 1000 / ((1-0.50)·(1-0.75))            = 1000 / 0.125 = 8000
//   vs_dots      = 1000 / (1-0.75)                       = 1000 / 0.25  = 4000   (armour excluded)
//   vs_one_shots = 1000 / ((1-0.50)·(1-0.75))            = 1000 / 0.125 = 8000   (no endurance/avoid)
//   stable_ward  = 0 (no generation) ; stable_hp = 1000
// ---------------------------------------------------------------------------
#[test]
fn fixture_a_armor_resistance_hit_tank() {
    let mut effects = HashMap::new();
    effects.insert("armor".to_string(), vec![flat(StatKey::Armor, 1104.0)]);
    effects.insert("res".to_string(), vec![flat(StatKey::AllResistances, 75.0)]);
    let game_data = game_data_with("sentinel", 1000.0, effects);
    let snapshot = snapshot_for("sentinel", &["armor", "res"]);

    let d = compute_stats(&snapshot, &game_data, ComputeOptions::default()).defense;
    assert_within_2pct("A vs_hits", d.ehp_vs_hits, 8000.0);
    assert_within_2pct("A vs_dots", d.ehp_vs_dots, 4000.0);
    assert_within_2pct("A vs_one_shots", d.ehp_vs_one_shots, 8000.0);
    assert_within_2pct("A stable_hp", d.stable_hp, 1000.0);
    assert_eq!(d.stable_ward, 0.0, "no ward generation → stable_ward 0");
}

// ---------------------------------------------------------------------------
// Fixture B — ward + endurance build with an endurance threshold. Exercises the one-shot hard
// floor and the ward equilibrium.
//   Inputs: raw_hp 2000 (base_hp 2000, lvl 1); Ward/sec 200 → pool = 2200; AllResistances 60 →
//   avg res 60%; EndurancePercent 30 → 30%; EnduranceThreshold 1100; armour 0; avoidance 0.
//   vs_hits      = 2200 / ((1-0.60)·(1-0.30))                    = 2200 / 0.28 = 7857.14
//   vs_dots      = 2200 / ((1-0.60)·(1-0.30))                    = 2200 / 0.28 = 7857.14
//   vs_one_shots: above = 2200-1100 = 1100 ; below = 1100/(1-0.30) = 1571.43 ;
//                 capacity = 2671.43 ; armour·res = (1)·(1-0.60) = 0.40 →
//                 2671.43 / 0.40 = 6678.57
//   stable_ward  = 200 / 0.40 = 500 ; stable_hp = 2000 + 500 = 2500
// ---------------------------------------------------------------------------
#[test]
fn fixture_b_ward_endurance_one_shot() {
    let mut effects = HashMap::new();
    effects.insert("ward".to_string(), vec![flat(StatKey::WardPerSecond, 200.0)]);
    effects.insert("res".to_string(), vec![flat(StatKey::AllResistances, 60.0)]);
    effects.insert("end_pct".to_string(), vec![flat(StatKey::EndurancePercent, 30.0)]);
    effects.insert("end_thr".to_string(), vec![flat(StatKey::EnduranceThreshold, 1100.0)]);
    let game_data = game_data_with("sentinel", 2000.0, effects);
    let snapshot = snapshot_for("sentinel", &["ward", "res", "end_pct", "end_thr"]);

    let d = compute_stats(&snapshot, &game_data, ComputeOptions::default()).defense;
    assert_within_2pct("B vs_hits", d.ehp_vs_hits, 7857.14);
    assert_within_2pct("B vs_dots", d.ehp_vs_dots, 7857.14);
    assert_within_2pct("B vs_one_shots", d.ehp_vs_one_shots, 6678.57);
    assert_within_2pct("B stable_ward", d.stable_ward, 500.0);
    assert_within_2pct("B stable_hp", d.stable_hp, 2500.0);
}

// ---------------------------------------------------------------------------
// Fixture C — dodge avoidance. Confirms a hit-only avoidance layer raises vs Hits but is excluded
// from vs DoTs and vs one-shots.
//   Inputs: raw_hp 1500 (base_hp 1500, lvl 1), no ward; Armor 1104 → 50% ; AllResistances 75 →
//   75% ; DodgeRating 20 → dodge_chance 20 → 20% average avoidance; endurance 0.
//   pool = 1500.
//   vs_hits      = 1500 / ((1-0.50)·(1-0.75)·(1-0.20))   = 1500 / 0.10  = 15000
//   vs_dots      = 1500 / (1-0.75)                       = 1500 / 0.25  = 6000   (no armour/dodge)
//   vs_one_shots = 1500 / ((1-0.50)·(1-0.75))            = 1500 / 0.125 = 12000  (no dodge)
// ---------------------------------------------------------------------------
#[test]
fn fixture_c_dodge_hits_only() {
    let mut effects = HashMap::new();
    effects.insert("armor".to_string(), vec![flat(StatKey::Armor, 1104.0)]);
    effects.insert("res".to_string(), vec![flat(StatKey::AllResistances, 75.0)]);
    effects.insert("dodge".to_string(), vec![flat(StatKey::DodgeRating, 20.0)]);
    let game_data = game_data_with("rogue", 1500.0, effects);
    let snapshot = snapshot_for("rogue", &["armor", "res", "dodge"]);

    let d = compute_stats(&snapshot, &game_data, ComputeOptions::default()).defense;
    assert_within_2pct("C vs_hits", d.ehp_vs_hits, 15000.0);
    assert_within_2pct("C vs_dots", d.ehp_vs_dots, 6000.0);
    assert_within_2pct("C vs_one_shots", d.ehp_vs_one_shots, 12000.0);
    assert!(
        d.ehp_vs_hits > d.ehp_vs_one_shots,
        "dodge must raise vs_hits above vs_one_shots (hits-only avoidance)"
    );
}

// ---------------------------------------------------------------------------
// Parity guard — the legacy `effective_hp` scoring aggregate must NOT be perturbed by the new EHP
// fields (it stays the Phase-3 heuristic that drives survivability_score/build_score). Fixture B's
// effective_hp is the frozen value: 2000 × (1 + 200/2000) × 1/(1-0.30) = 2000 × 1.1 × 1.428571 =
// 3142.857 (endurance + ward = 2 layers → no 1.05^(n-2) bonus). survivability_score must equal it.
// ---------------------------------------------------------------------------
#[test]
fn legacy_effective_hp_unchanged_by_ehp_additions() {
    let mut effects = HashMap::new();
    effects.insert("ward".to_string(), vec![flat(StatKey::WardPerSecond, 200.0)]);
    effects.insert("res".to_string(), vec![flat(StatKey::AllResistances, 60.0)]);
    effects.insert("end_pct".to_string(), vec![flat(StatKey::EndurancePercent, 30.0)]);
    effects.insert("end_thr".to_string(), vec![flat(StatKey::EnduranceThreshold, 1100.0)]);
    let game_data = game_data_with("sentinel", 2000.0, effects);
    let snapshot = snapshot_for("sentinel", &["ward", "res", "end_pct", "end_thr"]);

    let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
    let expected_effective_hp = 2000.0 * (1.0 + 200.0 / 2000.0) * (1.0 / (1.0 - 0.30));
    assert!(
        (sheet.defense.effective_hp - expected_effective_hp).abs() < 1.0,
        "effective_hp must stay frozen at {}, got {}",
        expected_effective_hp,
        sheet.defense.effective_hp
    );
    assert!(
        (sheet.scores.survivability_score - sheet.defense.effective_hp).abs() < 1e-9,
        "survivability_score must keep tracking the legacy effective_hp, not the new EHP"
    );
}
