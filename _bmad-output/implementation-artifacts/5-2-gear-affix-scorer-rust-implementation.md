---
title: 'Gear Affix Scorer — Rust Implementation'
story_id: '5.2'
story_key: '5-2-gear-affix-scorer-rust-implementation'
epic: 5
status: review
created: '2026-05-24'
---

## Story

**As a player,**
I want the scoring engine to compute skill-context-aware affix weights that zero out inapplicable affixes, identify ideal affix configurations per slot, and rank slots by upgrade priority,
**so that** gear recommendations are specific to my build's damage type and delivery method rather than generic.

---

## Context

This is Story 5.2 — the second story in Epic 5 (Gear Optimization Screen). **It is pure Rust — zero TypeScript changes.** All implementation lives inside `scoring-core/` (the pure Rust crate) and `src-tauri/src/` (minimal data init change).

**What exists today (from Epics 1–4 and Story 5.1):**

- `scoring-core/src/stat_sheet.rs` already defines `GearAnalysis`, `GearSlotRanking`, and `WishlistAffix` — these types are ready to use.
- `scoring-core/src/lib.rs` already re-exports `GearAnalysis` from `stat_sheet`. The `run_gear_scoring` function does NOT yet exist.
- `scoring-core/src/synergy.rs` already has `DeliveryType` and `infer_delivery_type()` — the delivery-type pattern is established. Story 5.2 extends this with explicit `primary_offense_delivery_type` carried in `BuildSnapshot`.
- `scoring-core/src/compute.rs` has `compute_stats()` — gear scoring injects modified snapshots and calls it to measure ΔBuildScore.
- `scoring-core/src/game_data.rs` has `GameData` with `affix_scope: HashMap<String, String>` (currently empty). Story 5.2 adds `gear_affixes: HashMap<String, GearAffixData>` (also initially empty — populated once the full affix DB pipeline is integrated).
- `src-tauri/src/services/game_data_loader.rs` uses `stat_key_from_str()` for string → StatKey mapping. The same mapping is the source of truth for story 5.2's GearAffixData deserialization path.
- `src-tauri/src/lib.rs` registers `compute_stats` and `run_optimization` in `invoke_handler!`. Story 5.2 does NOT register `run_gear_scoring` — that is Story 5.3's responsibility.
- `BuildSnapshot` in `build_snapshot.rs` currently has no `skill_roles` or `primary_offense_*` fields. Story 5.2 adds them so `run_gear_scoring()` has the full skill context it needs.

**Canonical 12 gear slot IDs** (established in Story 1.3, must be used exactly):
`helm`, `chest`, `gloves`, `boots`, `belt`, `amulet`, `ring_1`, `ring_2`, `weapon`, `off_hand`, `relic`, `catalyst`

**What this story adds:**

1. Three new fields on `BuildSnapshot`: `skill_roles`, `primary_offense_delivery_type`, `primary_offense_damage_elements`
2. New `GearAffixData` struct and `gear_affixes` field on `GameData`
3. New `scoring-core/src/gear.rs` module with `run_gear_scoring()` + unit tests
4. `scoring-core/src/lib.rs` updated to export `run_gear_scoring`
5. `game_data_loader.rs` updated to initialize `gear_affixes: HashMap::new()` in the GameData struct

**What this story does NOT do:**
- Register a `run_gear_scoring` Tauri command — that's Story 5.3
- Add TypeScript serializer changes for the new `BuildSnapshot` fields — that's Story 5.3
- Implement `GearOptimizationView` UI — that's Story 5.4
- Integrate Claude narrative for gear — that's Story 5.5
- Populate `game_data.gear_affixes` from an actual JSON file — the field is present and the system degrades gracefully when it's empty (all slots produce `upgrade_score: 0.0`, `efficiency_percent: 100.0`, empty wishlists)

---

## Acceptance Criteria

**AC1 — Delivery-type zero-weight filtering:**
**Given** a Poison Bladedancer build with `primary_offense_delivery_type: Some("spell")` in the snapshot
**When** `run_gear_scoring()` computes affix weights
**Then** a `GearAffixData` with `scope: "melee"` receives weight = 0.0
**And** a `GearAffixData` with `scope: "spell"` or `scope: "generic"` receives non-zero weight (if its stat contributes to BuildScore)

**AC2 — Damage-element zero-weight filtering:**
**Given** a snapshot with `primary_offense_damage_elements: ["poison", "physical"]`
**When** `run_gear_scoring()` computes affix weights
**Then** a `GearAffixData` with non-empty `damage_elements: ["fire"]` (no overlap) receives weight = 0.0
**And** a `GearAffixData` with `damage_elements: ["poison"]` (overlap) receives non-zero weight
**And** a `GearAffixData` with `damage_elements: []` (empty = applies to all elements) always passes the element filter

**AC3 — Slot ranking by UpgradeScore:**
**Given** all 12 gear slots evaluated
**When** `run_gear_scoring()` returns a `GearAnalysis`
**Then** `slot_rankings` contains an entry for each of the 12 canonical slot IDs
**And** entries are sorted by `upgrade_score` descending
**And** `priority_slot` matches the `slot` field of the first entry

**AC4 — Ideal prefix/suffix wishlist and satisfied detection:**
**Given** a gear slot with `gear_affixes` containing known prefix and suffix affixes
**When** `run_gear_scoring()` builds the wishlist for that slot
**Then** `ideal_prefix` contains up to 2 affixes with the highest `weight` among `affix_class: "prefix"` affixes (passing delivery and element filters)
**And** `ideal_suffix` contains up to 2 affixes with the highest `weight` among `affix_class: "suffix"` affixes
**And** a wishlist affix with `affix_id` matching one of the current slot's prefix/suffix affix entries at `tier >= target_tier` has `satisfied: true`
**And** all others have `satisfied: false`

**AC5 — UpgradeScore and efficiency computation:**
**Given** a slot where the current affixes score 60% of the ideal configuration
**When** `run_gear_scoring()` computes that slot's ranking
**Then** `efficiency_percent` equals approximately 60.0
**And** `upgrade_score` is the numeric gap between ideal total weight and current total weight

**AC6 — Unit tests pass:**
**Given** the `scoring-core` unit test suite
**When** `cargo test -p scoring-core` runs
**Then** the following tests pass:
- `gear::tests::test_delivery_type_zero_weight` — melee-scoped affix scores 0.0 on a spell build
- `gear::tests::test_element_filter_zero_weight` — fire affix scores 0.0 on a poison build
- `gear::tests::test_element_filter_generic_passes` — `damage_elements: []` always passes
- `gear::tests::test_ideal_prefix_suffix_ranking` — correct top-2 prefix and suffix selected
- `gear::tests::test_upgrade_score_and_efficiency` — correct UpgradeScore and efficiency_percent

---

## Tasks / Subtasks

- [x] Task 1: Extend `BuildSnapshot` in `build_snapshot.rs` (AC1, AC2)
  - [x] Add `skill_roles: HashMap<String, String>` — slotId → role string; `#[serde(default)]`
  - [x] Add `primary_offense_delivery_type: Option<String>` — "melee" | "ranged" | "spell" | "minion" | None; `#[serde(default)]`
  - [x] Add `primary_offense_damage_elements: Vec<String>` — e.g. `["poison", "physical"]`; `#[serde(default)]`
  - [x] All three fields get `#[serde(default)]` — existing callers (compute_stats, run_optimization) work unchanged
  - [x] `cargo build -p scoring-core` passes

- [x] Task 2: Add `GearAffixData` and `gear_affixes` to `game_data.rs` (AC1, AC2, AC4)
  - [x] Add `pub struct GearAffixData { ... }` — see Technical Requirements for exact field list
  - [x] Add `pub gear_affixes: HashMap<String, GearAffixData>` to `GameData`
  - [x] Add `gear_affixes: HashMap::new()` to the `GameData::default()` impl (currently `#[derive(Default)]` — if adding `GearAffixData` breaks the derive, implement `Default` manually)
  - [x] Add `pub use game_data::GearAffixData` to `scoring-core/src/lib.rs`
  - [x] `cargo build -p scoring-core` passes

- [x] Task 3: Update `game_data_loader.rs` to initialize the new field (AC3–AC5)
  - [x] Add `gear_affixes: HashMap::new()` to the `Ok(GameData { ... })` struct literal at the end of `build_scoring_game_data()`
  - [x] `cargo build` (full Tauri crate) passes

- [x] Task 4: Implement `scoring-core/src/gear.rs` (AC1–AC5)
  - [x] See Technical Requirements for the complete implementation blueprint
  - [x] `pub fn run_gear_scoring(snapshot: &BuildSnapshot, game_data: &GameData) -> GearAnalysis`
  - [x] Delivery-type filtering logic: zero-weight when `scope != "generic"` and `scope != primary_offense_delivery_type`
  - [x] Damage-element filtering logic: zero-weight when `damage_elements` is non-empty and has no overlap with `primary_offense_damage_elements`
  - [x] Weight computation: inject affix at T5 into a clone of the snapshot, call `compute_stats()`, measure ΔBuildScore against baseline
  - [x] Ideal wishlist per slot: top 2 prefix by weight, top 2 suffix by weight
  - [x] UpgradeScore = sum of top-4 ideal weights - sum of current affix weights (clamped ≥ 0.0)
  - [x] `efficiency_percent = (current_total_weight / ideal_total_weight * 100.0).clamp(0.0, 100.0)` when ideal > 0.0, else 100.0
  - [x] `satisfied = true` when current slot already has a matching affix at tier ≥ target_tier
  - [x] All 12 canonical slot IDs always appear in output — slots missing from `snapshot.gear_slots` get ideal-only analysis (0% efficiency)
  - [x] `priority_slot` = slot with highest `upgrade_score`; empty string when all slots tied at 0.0
  - [x] `cargo build -p scoring-core` passes

- [x] Task 5: Export from `lib.rs` (AC6)
  - [x] Add `pub mod gear;` to `scoring-core/src/lib.rs`
  - [x] Add `pub use gear::run_gear_scoring;` to `scoring-core/src/lib.rs`
  - [x] `cargo build -p scoring-core` passes

- [x] Task 6: Unit tests (AC1–AC6)
  - [x] Write 5 unit tests in `gear.rs` — see Technical Requirements for exact test bodies
  - [x] `cargo test -p scoring-core` passes — all 5 new tests green, existing tests unaffected

---

## Technical Requirements

### 1. `build_snapshot.rs` additions

Add these three fields to the `BuildSnapshot` struct:

```rust
/// Skill role designations: slotId → "primary_offense" | "secondary_offense" | "defensive" | "utility"
/// Set by TypeScript in Story 5.3 via buildSnapshotSerializer. Default = empty (no role context).
#[serde(default)]
pub skill_roles: HashMap<String, String>,

/// Delivery type of the Primary Offense skill: "melee" | "ranged" | "spell" | "minion"
/// None when no Primary Offense is designated. Zero-weights delivery-scoped affixes that mismatch.
#[serde(default)]
pub primary_offense_delivery_type: Option<String>,

/// Damage elements active for the Primary Offense skill: e.g. ["poison", "physical"].
/// Empty = no element filtering applied. Non-empty = affixes with mismatching elements score 0.0.
#[serde(default)]
pub primary_offense_damage_elements: Vec<String>,
```

All three have `#[serde(default)]` so existing `compute_stats` and `run_optimization` callers that don't serialize these fields continue to work without change.

### 2. `game_data.rs` additions

**New struct:**

```rust
/// Gear affix scoring data — one entry per affix ID in the affix database.
/// Populated by game_data_loader.rs from the affix DB (initially empty; loaded in a future story).
#[derive(Debug, Clone)]
pub struct GearAffixData {
    /// Human-readable affix name for WishlistAffix.display_name.
    pub display_name: String,
    /// Stat contributed by this affix.
    pub stat_key: StatKey,
    pub modifier_type: ModifierType,
    /// Average stat value at each tier. Key = 1-indexed tier number.
    pub values_by_tier: HashMap<u32, f64>,
    /// "prefix" or "suffix" — determines which wishlist bucket this affix goes into.
    pub affix_class: String,
    /// Delivery-type scope: "melee" | "ranged" | "spell" | "minion" | "generic".
    /// "generic" affixes apply to all delivery types (e.g., % Fire Resistance).
    /// Non-generic affixes receive weight 0.0 when scope mismatches primary offense delivery type.
    pub scope: String,
    /// Damage elements this affix applies to: e.g. ["fire", "cold"].
    /// Empty = applies to all damage elements (no element filtering).
    /// Non-empty + no overlap with primary_offense_damage_elements → weight 0.0.
    pub damage_elements: Vec<String>,
}
```

**`GameData` field addition:**

```rust
/// Gear affix database for the affix scorer. Initially empty; populated from affix DB.
/// An empty map is valid — run_gear_scoring degrades gracefully (all slots show 0 upgrade score).
pub gear_affixes: HashMap<String, GearAffixData>,
```

Add `gear_affixes: HashMap::new()` to `GameData::default()`. If `#[derive(Default)]` breaks because `GearAffixData` doesn't derive `Default`, implement `Default` manually for `GameData`.

### 3. `game_data_loader.rs` change

In `build_scoring_game_data()`, add `gear_affixes: HashMap::new()` to the `Ok(GameData { ... })` struct literal. No other changes to this file.

### 4. `gear.rs` — complete implementation blueprint

```rust
// scoring-core/src/gear.rs

use std::collections::HashMap;

use crate::build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot};
use crate::compute::{compute_stats, ComputeOptions};
use crate::game_data::{GameData, GearAffixData};
use crate::modifier::StatKey;
use crate::stat_sheet::{GearAnalysis, GearSlotRanking, WishlistAffix};

/// Canonical 12 gear slot IDs — every run_gear_scoring result includes all 12.
const SLOT_IDS: &[&str] = &[
    "helm", "chest", "gloves", "boots", "belt", "amulet",
    "ring_1", "ring_2", "weapon", "off_hand", "relic", "catalyst",
];

/// Computes skill-context-aware affix weights, ideal slot configurations, and slot rankings.
/// Pure function — no side effects. Safe to call from spawn_blocking in Story 5.3.
///
/// Degrades gracefully when game_data.gear_affixes is empty: all slots return
/// upgrade_score: 0.0, efficiency_percent: 100.0, empty wishlists.
pub fn run_gear_scoring(snapshot: &BuildSnapshot, game_data: &GameData) -> GearAnalysis {
    let baseline = compute_stats(snapshot, game_data, ComputeOptions::default());
    let baseline_score = baseline.scores.build_score;

    // Compute per-affix weights once; filtering by delivery type and element.
    let affix_weights: HashMap<&str, f64> = game_data
        .gear_affixes
        .iter()
        .map(|(id, data)| {
            let weight = compute_weight(id, data, snapshot, game_data, baseline_score);
            (id.as_str(), weight)
        })
        .collect();

    // Build per-slot rankings for all 12 canonical slots.
    let mut slot_rankings: Vec<GearSlotRanking> = SLOT_IDS
        .iter()
        .map(|&slot_id| {
            score_slot(slot_id, snapshot, game_data, &affix_weights)
        })
        .collect();

    // Sort by upgrade_score descending. Stable sort preserves slot order when tied.
    slot_rankings.sort_by(|a, b| {
        b.upgrade_score
            .partial_cmp(&a.upgrade_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let priority_slot = slot_rankings
        .first()
        .filter(|r| r.upgrade_score > 0.0)
        .map(|r| r.slot.clone())
        .unwrap_or_default();

    GearAnalysis { slot_rankings, priority_slot }
}

// ── Weight computation ────────────────────────────────────────────────────────

fn compute_weight(
    affix_id: &str,
    data: &GearAffixData,
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    baseline_score: f64,
) -> f64 {
    // Delivery-type filter: non-generic scope must match primary offense delivery type.
    if !passes_delivery_filter(&data.scope, snapshot.primary_offense_delivery_type.as_deref()) {
        return 0.0;
    }
    // Damage-element filter: non-empty damage_elements must overlap primary elements.
    if !passes_element_filter(&data.damage_elements, &snapshot.primary_offense_damage_elements) {
        return 0.0;
    }

    // ΔBuildScore = compute_stats with affix injected at T5 minus baseline.
    let t5 = t5_value(&data.values_by_tier);
    if t5 == 0.0 {
        return 0.0;
    }

    // Inject the affix at T5 into a temporary snapshot. We add it to the first slot
    // in the snapshot that doesn't already have this affix, or to "helm" if no slot exists.
    // Weight is a build-level concept (FR-A16: ΔBuildScore when affix present at T5).
    let mut modified = snapshot.clone();
    let inject_slot = modified.gear_slots.entry("helm".to_string()).or_default();
    let entry = AffixEntry { affix_id: affix_id.to_string(), tier: 5 };
    if data.affix_class == "prefix" {
        inject_slot.prefixes.push(entry);
    } else {
        inject_slot.suffixes.push(entry);
    }

    let modified_score = compute_stats(&modified, game_data, ComputeOptions::default())
        .scores
        .build_score;
    (modified_score - baseline_score).max(0.0)
}

fn passes_delivery_filter(scope: &str, primary_delivery: Option<&str>) -> bool {
    if scope == "generic" {
        return true;
    }
    // If no primary offense is designated, non-generic affixes receive no weight.
    match primary_delivery {
        Some(dt) => dt == scope,
        None => false,
    }
}

fn passes_element_filter(affix_elements: &[String], primary_elements: &[String]) -> bool {
    if affix_elements.is_empty() {
        return true; // no element restriction
    }
    if primary_elements.is_empty() {
        return true; // no element context specified — allow all
    }
    affix_elements.iter().any(|e| primary_elements.contains(e))
}

fn t5_value(values_by_tier: &HashMap<u32, f64>) -> f64 {
    // T5 preferred; fall back to highest available tier.
    if let Some(&v) = values_by_tier.get(&5) {
        return v;
    }
    values_by_tier
        .iter()
        .max_by_key(|(&t, _)| t)
        .map(|(_, &v)| v)
        .unwrap_or(0.0)
}

// ── Per-slot scoring ──────────────────────────────────────────────────────────

fn score_slot(
    slot_id: &str,
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    affix_weights: &HashMap<&str, f64>,
) -> GearSlotRanking {
    let current_slot = snapshot.gear_slots.get(slot_id);

    // Separate affixes by class, sort by weight descending, take top 2 each.
    let mut prefix_candidates: Vec<(&str, &GearAffixData, f64)> = game_data
        .gear_affixes
        .iter()
        .filter(|(id, d)| d.affix_class == "prefix")
        .filter_map(|(id, d)| {
            let w = *affix_weights.get(id.as_str())?;
            if w > 0.0 { Some((id.as_str(), d, w)) } else { None }
        })
        .collect();
    prefix_candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let mut suffix_candidates: Vec<(&str, &GearAffixData, f64)> = game_data
        .gear_affixes
        .iter()
        .filter(|(id, d)| d.affix_class == "suffix")
        .filter_map(|(id, d)| {
            let w = *affix_weights.get(id.as_str())?;
            if w > 0.0 { Some((id.as_str(), d, w)) } else { None }
        })
        .collect();
    suffix_candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

    let ideal_prefix = build_wishlist(&prefix_candidates[..prefix_candidates.len().min(2)], current_slot);
    let ideal_suffix = build_wishlist(&suffix_candidates[..suffix_candidates.len().min(2)], current_slot);

    let ideal_total: f64 = ideal_prefix.iter().chain(ideal_suffix.iter()).map(|w| w.weight).sum();
    let current_total = current_affix_total(current_slot, &ideal_prefix, &ideal_suffix, affix_weights);

    let upgrade_score = (ideal_total - current_total).max(0.0);
    let efficiency_percent = if ideal_total > 0.0 {
        (current_total / ideal_total * 100.0).clamp(0.0, 100.0)
    } else {
        100.0
    };

    GearSlotRanking {
        slot: slot_id.to_string(),
        upgrade_score,
        efficiency_percent,
        ideal_prefix,
        ideal_suffix,
    }
}

fn build_wishlist(
    candidates: &[(&str, &GearAffixData, f64)],
    current_slot: Option<&GearSlotSnapshot>,
) -> Vec<WishlistAffix> {
    candidates
        .iter()
        .map(|(id, data, weight)| {
            let target_tier = data.values_by_tier.keys().copied().max().unwrap_or(5);
            let satisfied = is_satisfied(id, target_tier, current_slot);
            WishlistAffix {
                affix_id: id.to_string(),
                display_name: data.display_name.clone(),
                target_tier,
                weight: *weight,
                mechanical_reason: format!(
                    "{} — contributes +{:.2} to BuildScore at T{}",
                    stat_display_name(&data.stat_key),
                    weight,
                    target_tier
                ),
                satisfied,
            }
        })
        .collect()
}

fn is_satisfied(affix_id: &str, target_tier: u32, slot: Option<&GearSlotSnapshot>) -> bool {
    let Some(slot) = slot else { return false };
    slot.prefixes.iter().chain(slot.suffixes.iter()).any(|a| {
        a.affix_id == affix_id && a.tier >= target_tier
    })
}

/// Computes the summed weight of current affix entries in a slot using ideal weights.
/// Only counts affixes that appear in the ideal wishlist (others have no upgrade impact).
fn current_affix_total(
    slot: Option<&GearSlotSnapshot>,
    ideal_prefix: &[WishlistAffix],
    ideal_suffix: &[WishlistAffix],
    affix_weights: &HashMap<&str, f64>,
) -> f64 {
    let Some(slot) = slot else { return 0.0 };
    let all_ideal: Vec<&str> = ideal_prefix.iter().chain(ideal_suffix.iter())
        .map(|w| w.affix_id.as_str())
        .collect();
    slot.prefixes.iter().chain(slot.suffixes.iter())
        .filter(|a| all_ideal.contains(&a.affix_id.as_str()))
        .filter_map(|a| affix_weights.get(a.affix_id.as_str()).copied())
        .sum()
}

fn stat_display_name(key: &StatKey) -> &'static str {
    match key {
        StatKey::IncreasedDamage => "% Increased Damage",
        StatKey::IncreasedFireDamage => "% Increased Fire Damage",
        StatKey::IncreasedColdDamage => "% Increased Cold Damage",
        StatKey::IncreasedLightningDamage => "% Increased Lightning Damage",
        StatKey::IncreasedVoidDamage => "% Increased Void Damage",
        StatKey::IncreasedPoisonDamage => "% Increased Poison Damage",
        StatKey::IncreasedPhysicalDamage => "% Increased Physical Damage",
        StatKey::IncreasedSpellDamage => "% Increased Spell Damage",
        StatKey::IncreasedMeleeDamage => "% Increased Melee Damage",
        StatKey::IncreasedRangedDamage => "% Increased Ranged Damage",
        StatKey::IncreasedMinionDamage => "% Increased Minion Damage",
        StatKey::CriticalStrikeChance => "% Critical Strike Chance",
        StatKey::CriticalStrikeMultiplier => "% Critical Strike Multiplier",
        StatKey::MaxHp => "Maximum HP",
        StatKey::MaxHpPercent => "% Maximum HP",
        StatKey::FireResistance => "% Fire Resistance",
        StatKey::ColdResistance => "% Cold Resistance",
        StatKey::LightningResistance => "% Lightning Resistance",
        StatKey::VoidResistance => "% Void Resistance",
        StatKey::PoisonResistance => "% Poison Resistance",
        StatKey::AllResistances => "% All Resistances",
        StatKey::EnduranceThreshold => "Endurance Threshold",
        StatKey::EndurancePercent => "% Endurance",
        StatKey::AttackSpeed => "% Attack Speed",
        StatKey::CastSpeed => "% Cast Speed",
        _ => "Stat Bonus",
    }
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_data::GearAffixData;
    use crate::modifier::{ModifierType, StatKey};

    /// Creates a minimal GameData with one melee-scoped prefix and one spell-scoped prefix.
    fn make_game_data_with_affixes() -> GameData {
        let mut gear_affixes = HashMap::new();
        gear_affixes.insert(
            "melee_crit_chance".to_string(),
            GearAffixData {
                display_name: "Melee Critical Strike Chance".to_string(),
                stat_key: StatKey::CriticalStrikeChance,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 30.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "melee".to_string(),
                damage_elements: vec![],
            },
        );
        gear_affixes.insert(
            "spell_crit_chance".to_string(),
            GearAffixData {
                display_name: "Spell Critical Strike Chance".to_string(),
                stat_key: StatKey::CriticalStrikeChance,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 30.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "spell".to_string(),
                damage_elements: vec![],
            },
        );
        gear_affixes.insert(
            "fire_damage".to_string(),
            GearAffixData {
                display_name: "% Increased Fire Damage".to_string(),
                stat_key: StatKey::IncreasedFireDamage,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 60.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "generic".to_string(),
                damage_elements: vec!["fire".to_string()],
            },
        );
        gear_affixes.insert(
            "poison_damage".to_string(),
            GearAffixData {
                display_name: "% Increased Poison Damage".to_string(),
                stat_key: StatKey::IncreasedPoisonDamage,
                modifier_type: ModifierType::Increased,
                values_by_tier: [(5u32, 60.0)].into_iter().collect(),
                affix_class: "prefix".to_string(),
                scope: "generic".to_string(),
                damage_elements: vec!["poison".to_string()],
            },
        );
        gear_affixes.insert(
            "all_res_suffix".to_string(),
            GearAffixData {
                display_name: "% All Resistances".to_string(),
                stat_key: StatKey::AllResistances,
                modifier_type: ModifierType::Flat,
                values_by_tier: [(5u32, 15.0)].into_iter().collect(),
                affix_class: "suffix".to_string(),
                scope: "generic".to_string(),
                damage_elements: vec![],
            },
        );
        let mut game_data = GameData::default();
        game_data.gear_affixes = gear_affixes;
        game_data
    }

    fn make_spell_poison_snapshot() -> BuildSnapshot {
        BuildSnapshot {
            class_id: "rogue".to_string(),
            mastery_id: "bladedancer".to_string(),
            character_level: 75,
            primary_offense_delivery_type: Some("spell".to_string()),
            primary_offense_damage_elements: vec!["poison".to_string(), "physical".to_string()],
            skill_roles: [("slot-0".to_string(), "primary_offense".to_string())].into_iter().collect(),
            ..Default::default()
        }
    }

    #[test]
    fn test_delivery_type_zero_weight() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // "melee_crit_chance" must have weight 0.0 on a spell build — it should NOT appear in any wishlist.
        for ranking in &analysis.slot_rankings {
            for affix in ranking.ideal_prefix.iter().chain(ranking.ideal_suffix.iter()) {
                assert_ne!(affix.affix_id, "melee_crit_chance",
                    "melee-scoped affix must not appear in wishlist for a spell build");
            }
        }
    }

    #[test]
    fn test_element_filter_zero_weight() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // "fire_damage" has damage_elements: ["fire"] — no overlap with ["poison", "physical"].
        for ranking in &analysis.slot_rankings {
            for affix in ranking.ideal_prefix.iter().chain(ranking.ideal_suffix.iter()) {
                assert_ne!(affix.affix_id, "fire_damage",
                    "fire damage affix must not appear for a poison/physical build");
            }
        }
    }

    #[test]
    fn test_element_filter_generic_passes() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // "all_res_suffix" has damage_elements: [] — must appear in suffix wishlist.
        let found = analysis.slot_rankings.iter().any(|r| {
            r.ideal_suffix.iter().any(|a| a.affix_id == "all_res_suffix")
        });
        assert!(found, "all_res_suffix (generic, no element restriction) must appear in a suffix wishlist");
    }

    #[test]
    fn test_ideal_prefix_suffix_ranking() {
        let game_data = make_game_data_with_affixes();
        let snapshot = make_spell_poison_snapshot();
        let analysis = run_gear_scoring(&snapshot, &game_data);

        // For any slot, the top prefix should be either "spell_crit_chance" or "poison_damage"
        // (both pass filters). "melee_crit_chance" and "fire_damage" must NOT be selected.
        let helm = analysis.slot_rankings.iter().find(|r| r.slot == "helm");
        assert!(helm.is_some(), "helm slot must be present in rankings");
        let helm = helm.unwrap();

        // Up to 2 prefixes, each must be from the valid set.
        let valid_prefixes = ["spell_crit_chance", "poison_damage"];
        for affix in &helm.ideal_prefix {
            assert!(valid_prefixes.contains(&affix.affix_id.as_str()),
                "unexpected prefix affix in wishlist: {}", affix.affix_id);
        }
    }

    #[test]
    fn test_upgrade_score_and_efficiency() {
        let game_data = make_game_data_with_affixes();
        let mut snapshot = make_spell_poison_snapshot();

        // Pre-populate the helm slot with the spell_crit_chance affix at T5.
        // The ideal has 2 prefixes + 1 suffix. With one prefix already at T5,
        // efficiency_percent must be between 0 and 100, and upgrade_score > 0.
        let mut helm_slot = GearSlotSnapshot::default();
        helm_slot.prefixes.push(AffixEntry {
            affix_id: "spell_crit_chance".to_string(),
            tier: 5,
        });
        snapshot.gear_slots.insert("helm".to_string(), helm_slot);

        let analysis = run_gear_scoring(&snapshot, &game_data);
        let helm = analysis.slot_rankings.iter().find(|r| r.slot == "helm").unwrap();

        // With one prefix satisfied, efficiency < 100% (still missing affixes).
        assert!(helm.efficiency_percent < 100.0,
            "efficiency must be < 100 when slot is partially equipped");
        assert!(helm.efficiency_percent > 0.0,
            "efficiency must be > 0 when slot has some matching affixes");

        // The satisfied prefix in the wishlist must have satisfied: true.
        let satisfied_count = helm.ideal_prefix.iter()
            .filter(|a| a.affix_id == "spell_crit_chance" && a.satisfied)
            .count();
        assert_eq!(satisfied_count, 1, "spell_crit_chance at T5 must be marked satisfied");
    }
}
```

**Key implementation notes:**

1. **`compute_weight` injects into "helm"** — this is a simplification for the weight computation. FR-A16 says "ΔBuildScore when this affix is present at T5", which is a build-level concept, not slot-specific. Injecting into helm is deterministic and avoids per-slot computation. The story 5.4 display is about slot rankings, not per-affix-per-slot weights.

2. **`ComputeOptions`** — `compute_stats` is called with `ComputeOptions::default()`. Do NOT use `crate::compute_options::ComputeOptions`; use the public re-export `crate::compute::ComputeOptions` (or just use `Default::default()` and let Rust infer the type).

3. **`BuildSnapshot::default()`** — the `Default` derive on `BuildSnapshot` currently works because all fields have defaults (empty HashMaps, empty Vecs, `u32 = 0`, `String = ""`). The three new fields all have `Default` impl (`HashMap::new()`, `None`, `Vec::new()`), so the derive continues to work.

4. **`GameData::default()`** — `GearAffixData` does NOT derive `Default` (it has no sensible default). This is fine because `gear_affixes` is a `HashMap<String, GearAffixData>` — the Default for HashMap is empty, which is valid. The `GameData` derive should continue to work as long as `HashMap::new()` suffices for the new field.

5. **Sorting stability** — `sort_by` is stable on `Vec`, so equal `upgrade_score` slots maintain SLOT_IDS insertion order (alphabetical within tie group). This is deterministic.

6. **`AffixEntry` import** — `build_snapshot.rs` exports `AffixEntry` publicly. Import it at the top of `gear.rs` from `crate::build_snapshot::AffixEntry`.

7. **`GearSlotSnapshot::default()`** — `GearSlotSnapshot` already derives `Default` (confirmed from `build_snapshot.rs`). The `or_default()` call in `compute_weight` works correctly.

### 5. `lib.rs` exports to add

```rust
pub mod gear;
pub use gear::run_gear_scoring;
```

Add `pub mod gear;` to the module declarations and `pub use gear::run_gear_scoring;` to the `pub use` block. Do NOT export `GearAffixData` from `lib.rs` — it's used internally by the loader and does not need a public re-export at this stage.

### 6. `build_snapshot.rs` import

The `HashMap` import is already at the top of `build_snapshot.rs` (used by `node_allocations`, etc.). The three new fields do not require new imports.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/scoring-core/src/build_snapshot.rs` | MODIFY | Add 3 new fields: `skill_roles`, `primary_offense_delivery_type`, `primary_offense_damage_elements` — all `#[serde(default)]` |
| `lebo/src-tauri/scoring-core/src/game_data.rs` | MODIFY | Add `GearAffixData` struct; add `gear_affixes` field to `GameData` |
| `lebo/src-tauri/scoring-core/src/lib.rs` | MODIFY | Add `pub mod gear;` and `pub use gear::run_gear_scoring;` |
| `lebo/src-tauri/scoring-core/src/gear.rs` | CREATE | New module with `run_gear_scoring()` + 5 unit tests |
| `lebo/src-tauri/src/services/game_data_loader.rs` | MODIFY | Add `gear_affixes: HashMap::new()` to `GameData` struct literal in `build_scoring_game_data()` |

**Do NOT touch:**
- Any TypeScript files — the new `BuildSnapshot` fields are serialized in Story 5.3
- `src-tauri/src/lib.rs` — `run_gear_scoring` is NOT registered as a Tauri command in this story (Story 5.3 does that)
- `scoring_commands.rs` — no new commands in this story
- `stat_sheet.rs` — `GearAnalysis`, `GearSlotRanking`, `WishlistAffix` are already defined and correct

---

## Architecture & Pattern Compliance

**Pattern 3 (lock ownership):** `run_gear_scoring` is a pure function taking `&BuildSnapshot` and `&GameData`. It never touches `RwLock` — the Tauri command in Story 5.3 will clone `game_data` before calling `spawn_blocking`, following Pattern 3 exactly.

**Pattern 5 (SCORING_ERROR prefix):** `run_gear_scoring` returns `GearAnalysis` directly (not `Result`). Errors in gear scoring are silently degraded to zero-score slots rather than propagating (consistent with `compute_stats` behavior). Story 5.3's Tauri command emits the `gear:error` event using the `SCORING_ERROR:` prefix when `run_gear_scoring` panics (via `spawn_blocking` panic propagation).

**Pattern 6 (gear namespace):** `run_gear_scoring` emits NO events — it's a pure function. Events (`gear:analysis-complete`, `gear:error`) are emitted by the Tauri command in Story 5.3. Do NOT use `optimization:*` namespace for any gear analysis.

**Pattern 7 (null sub-sheets):** `GearAnalysis` is NOT a sub-sheet of `StatSheet`. It's a separate return type from `run_gear_scoring`. The `StatSheet.ailment` / `StatSheet.minion` null-pattern does not apply here.

**No barrel files:** `gear.rs` is accessed via `pub mod gear;` in `lib.rs`. No `index.rs` or re-export files.

**`SkillTreeCanvas` is props-only:** Not relevant to this story (pure Rust).

**Four stores only:** Not relevant (pure Rust, no TypeScript stores touched).

---

## Testing Requirements

### Verification commands

From `lebo/src-tauri/`:
```bash
cargo build -p scoring-core          # Zero Rust compile errors
cargo test -p scoring-core           # All 5 new tests green + all existing tests pass
cargo build                          # Full Tauri crate builds (game_data_loader change is valid)
```

### Expected test output

```
running 5 tests
test gear::tests::test_delivery_type_zero_weight ... ok
test gear::tests::test_element_filter_zero_weight ... ok
test gear::tests::test_element_filter_generic_passes ... ok
test gear::tests::test_ideal_prefix_suffix_ranking ... ok
test gear::tests::test_upgrade_score_and_efficiency ... ok
```

All existing `scoring-core` tests (compute, scan, synergy, stat_sheet, modifier) must remain green.

---

## Dev Notes

**`run_gear_scoring` degrades gracefully when `gear_affixes` is empty.** The affix data will be populated once the full affix DB pipeline is integrated (a future story). For now, `all slot rankings have `upgrade_score: 0.0` and `efficiency_percent: 100.0` with empty wishlists — the UI in Story 5.4 will show "100% of ideal" for all slots, which is the correct degraded-mode behavior.

**Weight computation injects into "helm" slot.** This is a deliberate simplification. The affix weight is a build-level concept (FR-A16), not per-slot. Injecting into the same slot for all affixes ensures deterministic comparisons. Injecting on top of existing helm contents means an affix that overlaps with what's already in helm will show lower weight — this is actually correct behavior (diminishing returns from stacking the same stat type).

**`primary_offense_delivery_type: None` causes all non-generic affixes to receive weight 0.0.** This is intentional — when no Primary Offense is designated, the gear scorer cannot be delivery-type-aware and falls back to only generic affixes (resistances, HP, etc.). Story 5.3 ensures this field is populated from `skillRoles` before calling `run_gear_scoring`.

**`current_affix_total` only counts affixes in the ideal wishlist.** An equipped affix that is NOT in the ideal wishlist has no upgrade impact — it's irrelevant to the gap calculation. This keeps `upgrade_score` purely about the wishlist items, not about overall slot quality.

**`sort_by` on `GearAnalysis.slot_rankings` uses `partial_cmp` with fallback.** Rust `f64::partial_cmp` returns `None` for NaN. The fallback to `Equal` ensures no panic on NaN inputs (which shouldn't occur in practice but defensive coding is correct here).

**`stat_display_name` matches `_` to `"Stat Bonus"`.** This covers StatKey variants not yet in the match arm. New StatKey variants added in Phase 4 will produce "Stat Bonus" until `stat_display_name` is updated.

---

## Previous Story Intelligence (from 5.1)

- **Story 5.1 completed cleanly with no blockers.** `pnpm build` + `pnpm vitest` (918 passed / 8 pre-existing failures) — the 8 pre-existing failures (`ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls`) are unrelated and will still be present.
- **`BuildSnapshot` is already `#[derive(Default)]`** — the new fields all have Default impls, so the derive continues to work. Do NOT manually implement `Default` for `BuildSnapshot`.
- **`skill_roles` field matches the TypeScript `SkillRole` type** added in Story 5.1 (`buildStore.ts`). TypeScript will serialize this in Story 5.3; for now the field is present in Rust but always deserialized as `HashMap::new()` (no TypeScript sends it yet).
- **`GearOptimizationView.tsx` currently shows "Not yet implemented" placeholder** when "Analyze Gear" is clicked with a valid Primary Offense. Story 5.3 will wire the real command — this story just implements the pure Rust engine.
- **No Rust changes were made in Story 5.1** — the Rust codebase is in the same state as at the end of Story 4.5.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

**Blocker 1 — `build_registry` missing gear slot processing:**
`test_element_filter_generic_passes` and `test_upgrade_score_and_efficiency` failed because `compute.rs`'s `build_registry()` processed idols and blessings but not gear slot affixes. Injecting affixes into `snapshot.gear_slots["helm"]` had zero effect on `compute_stats`. Fixed by adding a gear slot loop to `build_registry` in `compute.rs` — this was an undocumented gap in the existing engine that story 5.2 revealed and fixed.

**Blocker 2 — Blueprint test affixes don't move `build_score`:**
The story blueprint used `CriticalStrikeChance` (for prefix tests) and `AllResistances` (for suffix test) as test affixes. Neither stat directly affects `build_score` in the current engine: crit only affects `avg_hit_damage_crit_weighted`; AllResistances only contributes to a `layer_count` bonus when ALL resistances ≥ 75% simultaneously (not triggered by a single 15% affix). All 5 gear tests were written/rewritten to use stats that demonstrably move `build_score`: `IncreasedSpellDamage`, `IncreasedMeleeDamage`, `IncreasedPoisonDamage` (via DAMAGE_STAT_KEYS → damage_score), and `MaxHp` Flat (raw_hp → effective_hp → survivability_score).

### Completion Notes List

- Added gear slot processing to `compute.rs::build_registry()` — modifiers from all slot prefix/suffix entries are now injected into the registry using `game_data.gear_affixes` lookup. Unknown affix IDs silently skipped (FR-A6 pattern).
- `GearAffixData` struct added to `game_data.rs` before `NodeEffect`. `GameData.gear_affixes` field added; `#[derive(Default)]` continues to work (HashMap default is empty).
- `lib.rs` now exports `pub mod gear` and `pub use gear::run_gear_scoring`. `GearAffixData` is NOT re-exported from lib.rs (internal to loader).
- `game_data_loader.rs` extended with `gear_affixes: std::collections::HashMap::new()`.
- `gear.rs` implements delivery-type filter, element filter, ΔBuildScore weight computation (inject into "helm"), top-2 prefix/suffix wishlist per slot, UpgradeScore, efficiency_percent, satisfied flag, all 12 canonical slots, graceful empty-map degradation.
- 5 unit tests pass; all 51 pre-existing tests remain green (56 total).
- Full `cargo build` clean (no warnings, no errors).

### File List

| File | Action |
|------|--------|
| `lebo/src-tauri/scoring-core/src/build_snapshot.rs` | MODIFIED — added `skill_roles`, `primary_offense_delivery_type`, `primary_offense_damage_elements` fields |
| `lebo/src-tauri/scoring-core/src/game_data.rs` | MODIFIED — added `GearAffixData` struct; added `gear_affixes` field to `GameData` |
| `lebo/src-tauri/scoring-core/src/compute.rs` | MODIFIED — added gear slot affix processing loop in `build_registry()` |
| `lebo/src-tauri/scoring-core/src/lib.rs` | MODIFIED — added `pub mod gear` and `pub use gear::run_gear_scoring` |
| `lebo/src-tauri/scoring-core/src/gear.rs` | CREATED — `run_gear_scoring()` + 5 unit tests |
| `lebo/src-tauri/src/services/game_data_loader.rs` | MODIFIED — added `gear_affixes: HashMap::new()` to `build_scoring_game_data()` |
