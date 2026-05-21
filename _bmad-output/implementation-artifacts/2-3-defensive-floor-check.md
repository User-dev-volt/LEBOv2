# Story 2.3: Defensive Floor Check

Status: review

## Story

As a player,
I want the app to flag uncapped resistances, low crit avoidance, and missing sustain as Critical-priority warnings before showing any offensive suggestions,
so that I never receive offensive optimization suggestions while my build has survivability-breaking gaps.

## Acceptance Criteria

1. **Given** a build with Fire resistance at 52%
   **When** `compute_stats()` runs the defensive floor check
   **Then** `stat_sheet.warnings` contains a `StatWarning` with `warning_type: "fire_resistance_uncapped"`, `current_value: 52`, `gap: 23`
   **And** the warning includes the specific gear slot that has room for a resistance fix (`suggested_fix.is_some()`)

2. **Given** a build with Crit Avoidance at 62%
   **When** `compute_stats()` runs
   **Then** `stat_sheet.warnings` contains a `StatWarning` with `warning_type: "crit_avoidance_low"` and `current_value: 62`

3. **Given** a build with no sustain layer (no life leech, no Ward generation, life regen < 100/s)
   **When** `compute_stats()` runs
   **Then** `stat_sheet.warnings` contains a `StatWarning` with `warning_type: "no_sustain_layer"`

4. **Given** a build that passes all three defensive floor checks (all resistances ≥ 75, crit avoidance ≥ 80, at least one sustain mechanism)
   **When** `compute_stats()` runs
   **Then** `stat_sheet.warnings` is empty

5. **Given** the `scoring-core` unit test suite
   **When** `cargo test -p scoring-core` runs
   **Then** tests cover all failure cases: fire/cold/lightning/void/poison/physical resistance uncapped, crit avoidance below 80%, no sustain layer, and the happy path
   **And** all tests pass

## Tasks / Subtasks

- [x] Task 1: Extend `DefenseStats` with sustain tracking fields (AC: #3, #5)
  - [x] Add `life_leech_percent: f64` field to `DefenseStats` in `stat_sheet.rs`
  - [x] Add `hp_regen_per_sec: f64` field to `DefenseStats` in `stat_sheet.rs`
  - [x] Populate both fields in `compute_defense()` in `compute.rs` (values are already computed locally — move them into the returned struct)

- [x] Task 2: Implement `run_floor_check()` in `compute.rs` (AC: #1–#4)
  - [x] Add `fn run_floor_check(defense: &DefenseStats, snapshot: &BuildSnapshot) -> Vec<StatWarning>` (private function)
  - [x] Check each resistance against 75.0 cap; produce a warning for each uncapped type
  - [x] Check crit avoidance against 80.0 threshold
  - [x] Check sustain layer: passes if `defense.ward > 0.0 || defense.life_leech_percent > 0.0 || defense.hp_regen_per_sec >= 100.0`
  - [x] Add `fn find_slot_with_open_suffix(snapshot: &BuildSnapshot) -> Option<String>` helper for resistance warnings' `suggested_fix`

- [x] Task 3: Wire `run_floor_check()` into `compute_stats()` (AC: #1–#4)
  - [x] Replace `warnings: vec![]` stub with `warnings: run_floor_check(&defense, snapshot)`
  - [x] Ensure `run_floor_check` is called after `compute_defense()` (uses the fully-computed `DefenseStats`)

- [x] Task 4: Write unit tests in `compute.rs` (AC: #5)
  - [x] Test: fire resistance uncapped (52%) → `fire_resistance_uncapped` warning with `current_value: 52.0`, `gap: 23.0`
  - [x] Test: cold resistance uncapped → `cold_resistance_uncapped` warning
  - [x] Test: lightning resistance uncapped → `lightning_resistance_uncapped` warning
  - [x] Test: void resistance uncapped → `void_resistance_uncapped` warning
  - [x] Test: poison resistance uncapped → `poison_resistance_uncapped` warning
  - [x] Test: physical resistance uncapped → `physical_resistance_uncapped` warning
  - [x] Test: crit avoidance low (62%) → `crit_avoidance_low` with `current_value: 62.0`, `gap: 18.0`
  - [x] Test: no sustain (no leech, no ward, regen < 100) → `no_sustain_layer` warning
  - [x] Test: sustain via ward → no `no_sustain_layer` warning
  - [x] Test: sustain via life leech → no `no_sustain_layer` warning
  - [x] Test: sustain via hp_regen ≥ 100 → no `no_sustain_layer` warning
  - [x] Test: all checks pass → `warnings.is_empty()`

- [x] Task 5: Verify builds
  - [x] Run `cargo build -p scoring-core` — zero errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero errors (full workspace)
  - [x] Run `cargo test -p scoring-core` — all new tests pass, existing 14 tests still pass
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors (no TS changes expected; verify `StatSheet` type still matches in `statSheet.ts` if needed)
  - [x] Run `pnpm vitest` — 8 pre-existing failures unchanged, no new regressions

---

## Dev Agent Record

### Completion Notes

All 5 tasks complete. Extended `DefenseStats` with `life_leech_percent` and `hp_regen_per_sec` fields (already computed in `compute_defense()`, just not exposed). Implemented `run_floor_check()` as a pure function over `DefenseStats` + `BuildSnapshot` — checks 6 resistance types against 75% cap, crit avoidance against 80%, and sustain layer (ward/leech/regen). `find_slot_with_open_suffix()` scans gear slots in priority order and falls back to "helm" when slots are empty (expected until Story 2.4 wires IPC). Wired into `compute_stats()` replacing the `vec![]` stub. All 26 Rust tests pass (14 from 2.2 + 12 new); full workspace builds clean; TypeScript build clean; frontend failures unchanged at 8 pre-existing.

### File List

- `lebo/src-tauri/scoring-core/src/stat_sheet.rs` — added `life_leech_percent: f64` and `hp_regen_per_sec: f64` to `DefenseStats`
- `lebo/src-tauri/scoring-core/src/compute.rs` — added `run_floor_check()`, `find_slot_with_open_suffix()`, `RESISTANCE_CAP`/`CRIT_AVOIDANCE_FLOOR`/`HP_REGEN_SUSTAIN_THRESHOLD` constants, populated new `DefenseStats` fields in `compute_defense()`, wired floor check into `compute_stats()`, added 12 new unit tests

### Change Log

- 2026-05-21: Implemented defensive floor check (Story 2.3) — `DefenseStats` extended with sustain fields, `run_floor_check()` implemented and wired into `compute_stats()`, 12 unit tests added (26 total passing)

---

## Dev Notes

### Architecture Overview

This story implements the defensive floor check — Stage 2 of the scoring pipeline. It is a **pure Rust addition** to `compute.rs` with a minor extension to `stat_sheet.rs`. No TypeScript changes, no new Tauri commands, no IPC changes.

**Scope:**
1. **`DefenseStats` extension** (Task 1): Add `life_leech_percent` and `hp_regen_per_sec` to the struct. These fields are already computed locally in `compute_defense()` but discarded. The floor check needs them. Story 2.6 (stat sheet UI) will also display them.
2. **`run_floor_check()` implementation** (Task 2): Takes the completed `DefenseStats` and `BuildSnapshot`, returns `Vec<StatWarning>`. No registry access needed — all values are already in `DefenseStats`.
3. **Wire into `compute_stats()`** (Task 3): Replace the `warnings: vec![]` stub that already exists in `compute_stats()`.

**No Tauri commands are registered or changed in this story.** That is Story 2.4.

---

### Task 1 — `DefenseStats` Extension (Exact)

In `lebo/src-tauri/scoring-core/src/stat_sheet.rs`, add two fields to `DefenseStats`:

```rust
/// Survivability and defensive stats.
#[derive(Debug, Clone, Default, Serialize)]
pub struct DefenseStats {
    pub effective_hp: f64,
    pub raw_hp: f64,
    pub ward: f64,
    pub endurance_percent: f64,
    pub endurance_threshold: f64,
    pub armor: f64,
    pub fire_resistance: f64,
    pub cold_resistance: f64,
    pub lightning_resistance: f64,
    pub void_resistance: f64,
    pub poison_resistance: f64,
    pub physical_resistance: f64,
    pub crit_avoidance: f64,
    pub dodge_chance: f64,
    // Added in Story 2.3 — used by floor check and Defense/Other stat sheet tabs
    pub life_leech_percent: f64,
    pub hp_regen_per_sec: f64,
}
```

Then in `compute_defense()` in `compute.rs`, populate the two fields by including them in the returned `DefenseStats` struct literal. The values are already computed locally as `life_leech` and `hp_regen`:

```rust
    DefenseStats {
        effective_hp,
        raw_hp,
        ward,
        endurance_percent: endurance_pct * 100.0,
        endurance_threshold,
        armor,
        fire_resistance: fire_res,
        cold_resistance: cold_res,
        lightning_resistance: lightning_res,
        void_resistance: void_res,
        poison_resistance: poison_res,
        physical_resistance: physical_res,
        crit_avoidance,
        dodge_chance,
        life_leech_percent: life_leech,   // add this
        hp_regen_per_sec: hp_regen,       // add this
    }
```

---

### Task 2 — `run_floor_check()` Implementation (Exact)

Add to the bottom of the non-test section of `compute.rs` (before `#[cfg(test)]`):

#### Resistance cap constant and check helper

```rust
const RESISTANCE_CAP: f64 = 75.0;
const CRIT_AVOIDANCE_FLOOR: f64 = 80.0;
const HP_REGEN_SUSTAIN_THRESHOLD: f64 = 100.0;

fn run_floor_check(defense: &DefenseStats, snapshot: &BuildSnapshot) -> Vec<StatWarning> {
    let mut warnings = Vec::new();

    // Resistance checks — one warning per uncapped type
    let resistance_checks = [
        ("fire_resistance_uncapped", defense.fire_resistance),
        ("cold_resistance_uncapped", defense.cold_resistance),
        ("lightning_resistance_uncapped", defense.lightning_resistance),
        ("void_resistance_uncapped", defense.void_resistance),
        ("poison_resistance_uncapped", defense.poison_resistance),
        ("physical_resistance_uncapped", defense.physical_resistance),
    ];
    for (warning_type, current_value) in resistance_checks {
        if current_value < RESISTANCE_CAP {
            let gap = RESISTANCE_CAP - current_value;
            let suggested_fix = find_slot_with_open_suffix(snapshot)
                .map(|slot| format!("{} has room for a Resistance suffix", slot));
            warnings.push(StatWarning {
                warning_type: warning_type.to_string(),
                current_value,
                gap,
                suggested_fix,
            });
        }
    }

    // Crit avoidance check
    if defense.crit_avoidance < CRIT_AVOIDANCE_FLOOR {
        warnings.push(StatWarning {
            warning_type: "crit_avoidance_low".to_string(),
            current_value: defense.crit_avoidance,
            gap: CRIT_AVOIDANCE_FLOOR - defense.crit_avoidance,
            suggested_fix: None,
        });
    }

    // Sustain layer check: ward generation, life leech, or adequate hp regen
    let has_sustain = defense.ward > 0.0
        || defense.life_leech_percent > 0.0
        || defense.hp_regen_per_sec >= HP_REGEN_SUSTAIN_THRESHOLD;
    if !has_sustain {
        warnings.push(StatWarning {
            warning_type: "no_sustain_layer".to_string(),
            current_value: 0.0,
            gap: 0.0,
            suggested_fix: Some(
                "Add Life Leech, Ward generation, or Life Regeneration ≥ 100/s".to_string(),
            ),
        });
    }

    warnings
}

/// Finds the first gear slot with an open suffix slot (< 2 suffixes).
/// Preference order: helm → chest → gloves → boots → belt → amulet → ring_1 → ring_2.
/// Falls back to "helm" if no snapshot gear data is present.
fn find_slot_with_open_suffix(snapshot: &BuildSnapshot) -> Option<String> {
    const PRIORITY: &[&str] = &[
        "helm", "chest", "gloves", "boots", "belt", "amulet", "ring_1", "ring_2",
    ];
    for slot_id in PRIORITY {
        match snapshot.gear_slots.get(*slot_id) {
            Some(slot) if slot.suffixes.len() < 2 => return Some(slot_id.to_string()),
            None => return Some(slot_id.to_string()), // empty slot = room available
            _ => {}
        }
    }
    Some("helm".to_string()) // fallback: all priority slots full, suggest helm anyway
}
```

---

### Task 3 — Wire into `compute_stats()` (Exact)

In `compute_stats()`, replace:

```rust
    StatSheet {
        offense,
        defense,
        scores,
        ailment: None,
        minion: None,
        warnings: vec![], // populated in Story 2.3
    }
```

With:

```rust
    let warnings = run_floor_check(&defense, snapshot);
    StatSheet {
        offense,
        defense,
        scores,
        ailment: None,
        minion: None,
        warnings,
    }
```

---

### Task 4 — Unit Test Structure (Exact)

Tests go in the `#[cfg(test)]` mod at the bottom of `compute.rs`. Add after the existing tests:

```rust
    // --- Defensive floor check tests ---

    fn make_defense_snapshot_with_res(fire: f64, cold: f64, lightning: f64, void_r: f64, poison: f64, physical: f64) -> (GameData, BuildSnapshot) {
        // Build nodes that set each resistance to the given value
        // Use AllResistances + element-specific to construct precise values
        // Simplest approach: use FireResistance etc. directly as Flat modifiers
        let mut node_effects = HashMap::new();
        let mut nodes = vec![];
        if fire != 0.0 { nodes.push(NodeEffect { stat_key: StatKey::FireResistance, modifier_type: ModifierType::Flat, value: fire, condition: Condition::Always }); }
        if cold != 0.0 { nodes.push(NodeEffect { stat_key: StatKey::ColdResistance, modifier_type: ModifierType::Flat, value: cold, condition: Condition::Always }); }
        if lightning != 0.0 { nodes.push(NodeEffect { stat_key: StatKey::LightningResistance, modifier_type: ModifierType::Flat, value: lightning, condition: Condition::Always }); }
        if void_r != 0.0 { nodes.push(NodeEffect { stat_key: StatKey::VoidResistance, modifier_type: ModifierType::Flat, value: void_r, condition: Condition::Always }); }
        if poison != 0.0 { nodes.push(NodeEffect { stat_key: StatKey::PoisonResistance, modifier_type: ModifierType::Flat, value: poison, condition: Condition::Always }); }
        if physical != 0.0 { nodes.push(NodeEffect { stat_key: StatKey::PhysicalResistance, modifier_type: ModifierType::Flat, value: physical, condition: Condition::Always }); }
        node_effects.insert("res_node".to_string(), nodes);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("res_node".to_string(), 1);
        (game_data, snapshot)
    }

    #[test]
    fn floor_check_fire_resistance_uncapped() {
        let (game_data, snapshot) = make_defense_snapshot_with_res(52.0, 75.0, 75.0, 75.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let fire_warn = sheet.warnings.iter().find(|w| w.warning_type == "fire_resistance_uncapped");
        assert!(fire_warn.is_some(), "expected fire_resistance_uncapped warning");
        let w = fire_warn.unwrap();
        assert!((w.current_value - 52.0).abs() < 0.1, "current_value expected 52 got {}", w.current_value);
        assert!((w.gap - 23.0).abs() < 0.1, "gap expected 23 got {}", w.gap);
        assert!(w.suggested_fix.is_some(), "suggested_fix should be present");
    }

    #[test]
    fn floor_check_cold_resistance_uncapped() {
        let (game_data, snapshot) = make_defense_snapshot_with_res(75.0, 50.0, 75.0, 75.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.iter().any(|w| w.warning_type == "cold_resistance_uncapped"));
    }

    #[test]
    fn floor_check_lightning_resistance_uncapped() {
        let (game_data, snapshot) = make_defense_snapshot_with_res(75.0, 75.0, 40.0, 75.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.iter().any(|w| w.warning_type == "lightning_resistance_uncapped"));
    }

    #[test]
    fn floor_check_void_resistance_uncapped() {
        let (game_data, snapshot) = make_defense_snapshot_with_res(75.0, 75.0, 75.0, 30.0, 75.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.iter().any(|w| w.warning_type == "void_resistance_uncapped"));
    }

    #[test]
    fn floor_check_poison_resistance_uncapped() {
        let (game_data, snapshot) = make_defense_snapshot_with_res(75.0, 75.0, 75.0, 75.0, 0.0, 75.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.iter().any(|w| w.warning_type == "poison_resistance_uncapped"));
    }

    #[test]
    fn floor_check_physical_resistance_uncapped() {
        let (game_data, snapshot) = make_defense_snapshot_with_res(75.0, 75.0, 75.0, 75.0, 75.0, 0.0);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.iter().any(|w| w.warning_type == "physical_resistance_uncapped"));
    }

    #[test]
    fn floor_check_crit_avoidance_low() {
        // 62% crit avoidance → gap 18
        let mut node_effects = HashMap::new();
        node_effects.insert("avoid_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::CriticalStrikeAvoidance,
            modifier_type: ModifierType::Flat,
            value: 62.0,
            condition: Condition::Always,
        }]);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("avoid_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let warn = sheet.warnings.iter().find(|w| w.warning_type == "crit_avoidance_low");
        assert!(warn.is_some(), "expected crit_avoidance_low warning");
        let w = warn.unwrap();
        assert!((w.current_value - 62.0).abs() < 0.1);
        assert!((w.gap - 18.0).abs() < 0.1);
    }

    #[test]
    fn floor_check_no_sustain_layer() {
        // No ward, no leech, no regen → no_sustain_layer warning
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let snapshot = snapshot_at(50);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "expected no_sustain_layer, got: {:?}", sheet.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>());
    }

    #[test]
    fn floor_check_sustain_via_ward() {
        let mut node_effects = HashMap::new();
        node_effects.insert("ward_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::WardPerSecond,
            modifier_type: ModifierType::Flat,
            value: 50.0,
            condition: Condition::Always,
        }]);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("ward_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(!sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "ward should satisfy sustain layer");
    }

    #[test]
    fn floor_check_sustain_via_life_leech() {
        let mut node_effects = HashMap::new();
        node_effects.insert("leech_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::LifeLeechPercent,
            modifier_type: ModifierType::Flat,
            value: 2.0,
            condition: Condition::Always,
        }]);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("leech_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(!sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "life leech should satisfy sustain layer");
    }

    #[test]
    fn floor_check_sustain_via_hp_regen() {
        let mut node_effects = HashMap::new();
        node_effects.insert("regen_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::HpRegenPerSec,
            modifier_type: ModifierType::Flat,
            value: 120.0,
            condition: Condition::Always,
        }]);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("regen_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(!sheet.warnings.iter().any(|w| w.warning_type == "no_sustain_layer"),
            "hp_regen >= 100 should satisfy sustain layer");
    }

    #[test]
    fn floor_check_happy_path_no_warnings() {
        // All resistances ≥ 75, crit avoidance ≥ 80, ward > 0 → no warnings
        let mut node_effects = HashMap::new();
        node_effects.insert("all_res_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::AllResistances,
            modifier_type: ModifierType::Flat,
            value: 75.0,
            condition: Condition::Always,
        }]);
        node_effects.insert("avoid_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::CriticalStrikeAvoidance,
            modifier_type: ModifierType::Flat,
            value: 80.0,
            condition: Condition::Always,
        }]);
        node_effects.insert("ward_node".to_string(), vec![NodeEffect {
            stat_key: StatKey::WardPerSecond,
            modifier_type: ModifierType::Flat,
            value: 1.0,
            condition: Condition::Always,
        }]);
        let game_data = make_game_data_with_effects(node_effects);
        let mut snapshot = snapshot_at(50);
        snapshot.node_allocations.insert("all_res_node".to_string(), 1);
        snapshot.node_allocations.insert("avoid_node".to_string(), 1);
        snapshot.node_allocations.insert("ward_node".to_string(), 1);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!(sheet.warnings.is_empty(),
            "expected no warnings, got: {:?}", sheet.warnings.iter().map(|w| &w.warning_type).collect::<Vec<_>>());
    }
```

---

### Key Implementation Notes

**`find_slot_with_open_suffix` logic:**
- Called for every resistance warning — the same slot can be suggested for multiple missing resistances (e.g., both fire and cold point to "helm")
- `snapshot.gear_slots` will be empty until Story 2.4 wires up IPC, so most builds will hit the `None` arm and return `"helm"` — this is correct and expected
- A slot that has `suffixes.len() < 2` has room (LE's 2-suffix max per item)

**Sustain layer definition (from Dev Notes in Story 2.2):**
`WardPerSecond` is NOT double-counted. The `ward` field in `DefenseStats` already sums `WardPerSecond + WardOnHit`. Using `defense.ward > 0.0` to detect ward generation is correct — any ward present means ward generation exists somewhere.

**Resistance zero-floor:**
A build with no resistance nodes at all has `fire_resistance = 0.0`, which is below the 75 cap → fires warning. This is intentional and correct behavior.

**Floor check runs after `compute_defense()` completes:**
All defensive stats (including resistances, ward, leech, regen) are fully resolved in `DefenseStats` before the floor check runs. The floor check is a pure read of `DefenseStats` — no registry access needed.

---

### What This Story Does NOT Do

- ❌ Do NOT create `scoring_commands.rs` or register any Tauri command — that is Story 2.4
- ❌ Do NOT create `game_data_loader.rs` — that is Story 2.4
- ❌ Do NOT implement `buildSnapshotSerializer.ts` or `useStatSheet.ts` — that is Story 2.5
- ❌ Do NOT implement the stat sheet UI — that is Story 2.6
- ❌ Do NOT surface warnings to the TypeScript layer in this story (they flow through via `StatSheet` in Story 2.5)
- ❌ Do NOT add NecroticResistance to the floor check — there is no Necrotic resistance cap in the current LE game mechanic; the six canonical resistance types are fire/cold/lightning/void/poison/physical

---

### Known Pre-existing Test Failures

8 frontend test failures remain from stories 1.1/1.2: `SkillTreeCanvas` ×1, `ProviderSelector` ×5, `Settings` ×1, `TreeControls` ×1 — all pre-existing. `pnpm vitest` will show them; do not fix them.

After this story, `cargo test -p scoring-core` must show **26 passing tests** (14 from Story 2.2 + 12 new from Story 2.3).

---

### Project Structure Notes

**Modified files:**
- `lebo/src-tauri/scoring-core/src/stat_sheet.rs` — add `life_leech_percent`, `hp_regen_per_sec` to `DefenseStats`
- `lebo/src-tauri/scoring-core/src/compute.rs` — add `run_floor_check()`, `find_slot_with_open_suffix()`, populate `warnings`, expand `DefenseStats` literal in `compute_defense()`, add 12 new unit tests

**No new files created in this story.**

---

### References

- [Source: epics.md § Story 2.3 — Defensive Floor Check]
- [Source: epics.md § FR-A7 — Defensive floor check (resistances, crit avoidance, sustain)]
- [Source: epics.md § FR-A8 — Critical-priority suggestion for any defensive floor failure]
- [Source: epics.md § NFR-9 — Defensive floor check has unit tests covering all failure conditions]
- [Source: epics.md § NFR-4 — All stat values and thresholds data-driven; floor thresholds as named constants (not magic numbers)]
- [Source: architecture.md § The `compute_stats` Function — Pure and Tauri-Free]
- [Source: architecture.md § ADR-001 — Cargo Workspace Layout]
- [Source: story 2.2 Dev Notes — "sustain layer check restricted to LifeLeechPercent and HpRegenPerSec; WardPerSecond captured by ward layer"]
- [Source: story 2.2 Completion Notes — "WardPerSecond is NOT double-counted in the sustain layer check"]
- [Source: lebo/src-tauri/scoring-core/src/compute.rs — current compute_stats, compute_defense, existing tests]
- [Source: lebo/src-tauri/scoring-core/src/stat_sheet.rs — StatWarning, DefenseStats definitions]
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs — StatKey variants (LifeLeechPercent, HpRegenPerSec, WardPerSecond)]
- [Source: project-context.md § Critical Don't-Miss Rules — no barrel files, no raw invoke(), four stores only]
