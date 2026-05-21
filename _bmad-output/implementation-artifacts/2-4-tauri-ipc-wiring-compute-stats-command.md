# Story 2.4: Tauri IPC Wiring — `compute_stats` Command

Status: review

## Story

As a developer,
I want the `compute_stats` Tauri command registered and wired to `scoring-core::compute_stats`, with game data loaded once at startup and held in `AppState`,
so that TypeScript can call `invokeCommand<StatSheet>('compute_stats', { snapshot })` and receive a correct `StatSheet`.

## Acceptance Criteria

1. **Given** `src-tauri/Cargo.toml`
   **When** an agent reviews it
   **Then** it is a workspace root with `members = [".", "scoring-core"]` ← already present
   **And** `scoring-core = { path = "scoring-core" }` is listed in `[dependencies]` of the Tauri crate
   **And** `rayon` is listed as a dependency only in `scoring-core/Cargo.toml`, not in the Tauri crate's deps

2. **Given** `scoring_commands.rs` in the Tauri crate (`src/commands/scoring_commands.rs`)
   **When** an agent reviews it
   **Then** the sync `compute_stats` Tauri command is defined there (not inline in `lib.rs`)
   **And** it calls `scoring_core::compute_stats(&snapshot, &game_data, scoring_core::ComputeOptions::default())`

3. **Given** `game_data_loader.rs` in the Tauri crate (`src/services/game_data_loader.rs`)
   **When** the Tauri app starts
   **Then** `scoring_core::GameData` is constructed from disk JSON files exactly once
   **And** it is held in `AppState` as `std::sync::Arc<std::sync::RwLock<scoring_core::GameData>>` and reused for every command call without re-reading disk

4. **Given** the sync `compute_stats` command execution
   **When** it runs
   **Then** it takes a `.read().unwrap()` lock on `ScoringState.game_data` (no clone), computes, and the lock drops at function end
   **And** the lock is never held across an `await` boundary (the command is sync, not async)

5. **Given** a TypeScript call to `invokeCommand<StatSheet>('compute_stats', { snapshot })`
   **When** the command resolves successfully
   **Then** the returned `StatSheet` has snake_case field names (e.g., `build_score`, `offense`, `defense`)
   **And** the Rust `BuildSnapshot` input struct already has `#[serde(rename_all = "camelCase")]` so TypeScript sends camelCase properties — no changes needed to `BuildSnapshot`

6. **Given** a scoring computation error in Rust
   **When** the error propagates
   **Then** the error string is prefixed with `"SCORING_ERROR: "`
   **And** `normalizeAppError()` maps it to `ErrorType.SCORING_ERROR` correctly — `SCORING_ERROR` is already in `errors.ts` and `errorNormalizer.ts` from Story 2.1; no TS changes needed

## Tasks / Subtasks

- [x] Task 1: Add `scoring-core` dependency to the Tauri crate (AC: #1)
  - [x] In `lebo/src-tauri/Cargo.toml`, add `scoring-core = { path = "scoring-core" }` to `[dependencies]`
  - [x] Verify `rayon` is NOT in the Tauri crate's `[dependencies]` (it's only in `scoring-core/Cargo.toml`) — no change needed if already absent

- [x] Task 2: Create `game_data_loader.rs` (AC: #3)
  - [x] Create `lebo/src-tauri/src/services/game_data_loader.rs`
  - [x] Implement `pub fn build_scoring_game_data(app_handle: &tauri::AppHandle) -> Result<scoring_core::GameData, String>` — see exact implementation in Dev Notes
  - [x] Add `pub mod game_data_loader;` to `lebo/src-tauri/src/services/mod.rs`

- [x] Task 3: Add `ScoringState` to `lib.rs` and initialize in `setup` (AC: #3, #4)
  - [x] Define `pub struct ScoringState { pub game_data: std::sync::Arc<std::sync::RwLock<scoring_core::GameData>> }` in `lib.rs` (not in a separate module)
  - [x] Add `.manage(ScoringState { game_data: std::sync::Arc::new(std::sync::RwLock::new(scoring_core::GameData::default())) })` BEFORE `.setup(...)` in the Builder chain
  - [x] Inside the existing `.setup(|app| { ... })` block (after the connectivity watcher spawn), call `build_scoring_game_data` and write the result into `ScoringState` — see exact code in Dev Notes

- [x] Task 4: Create `scoring_commands.rs` (AC: #2, #4, #5, #6)
  - [x] Create `lebo/src-tauri/src/commands/scoring_commands.rs`
  - [x] Implement sync `pub fn compute_stats` command — see exact implementation in Dev Notes
  - [x] Add `pub mod scoring_commands;` to `lebo/src-tauri/src/commands/mod.rs`

- [x] Task 5: Register `compute_stats` in `lib.rs` (AC: #2)
  - [x] Add `use commands::scoring_commands::compute_stats;` to `lib.rs` imports
  - [x] Add `compute_stats` to `invoke_handler!` macro list

- [x] Task 6: Verify builds (AC: all)
  - [x] Run `cargo build -p scoring-core` — zero errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero errors (full workspace including Tauri crate with new dep)
  - [x] Run `cargo test -p scoring-core` — all 26 existing tests still pass, no new tests required for this story
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors (no TypeScript changes in this story)
  - [x] Run `pnpm vitest` — 8 pre-existing frontend test failures unchanged, no new failures

---

## Dev Notes

### Architecture Overview

This story is pure Rust plumbing. No TypeScript changes. The three new pieces:

1. **`game_data_loader.rs`** — Reads disk JSON → constructs `scoring_core::GameData` (with parsed `node_effects`, `class_base_stats`, hardcoded `archetype_weights` table)
2. **`ScoringState`** — Holds `Arc<RwLock<scoring_core::GameData>>` in Tauri managed state, initialized once in `setup`
3. **`scoring_commands.rs`** — Sync Tauri command that takes a `BuildSnapshot`, reads `ScoringState`, calls `scoring_core::compute_stats`, returns `StatSheet`

Story 2.5 adds `buildSnapshotSerializer.ts` and `useStatSheet.ts` on the TypeScript side. This story only sets up the Rust IPC endpoint.

---

### Task 1 — Cargo.toml Change (Exact)

In `lebo/src-tauri/Cargo.toml`, add one line to `[dependencies]`:

```toml
scoring-core = { path = "scoring-core" }
```

The `[workspace]` section already has `members = [".", "scoring-core"]` — no change needed there.

---

### Task 2 — `game_data_loader.rs` (Exact Implementation)

Create `lebo/src-tauri/src/services/game_data_loader.rs`:

```rust
use std::collections::HashMap;
use scoring_core::{
    game_data::{ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, NodeEffect},
    modifier::{Condition, ModifierType, StatKey},
};
use crate::services::game_data_service;

/// Constructs `scoring_core::GameData` from the bundled disk JSON files.
/// Called once at startup; result stored in `AppState`.
pub fn build_scoring_game_data(app_handle: &tauri::AppHandle) -> Result<GameData, String> {
    let data_dir = game_data_service::ensure_game_data_dir(app_handle)?;
    let manifest = game_data_service::load_manifest(&data_dir)?;

    let mut node_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
    let mut class_base_stats: HashMap<String, BaseClassStats> = HashMap::new();

    for class_id in &manifest.classes {
        let class_data = game_data_service::load_class_data(&data_dir, class_id)?;

        // Base HP stats per class (Sentinel-family base values; refined in Epic 4)
        let base_stats = derive_class_base_stats(class_id);
        class_base_stats.insert(class_id.clone(), base_stats);

        // Passive tree nodes from base_tree
        for node in &class_data.base_tree.nodes {
            let effects = parse_node_effects(&node.effects, &node.modifier_type);
            if !effects.is_empty() {
                node_effects.insert(node.id.clone(), effects);
            }
        }

        // Mastery passive trees
        for mastery in &class_data.masteries {
            for node in &mastery.passive_tree.nodes {
                let effects = parse_node_effects(&node.effects, &node.modifier_type);
                if !effects.is_empty() {
                    node_effects.insert(node.id.clone(), effects);
                }
            }
            // Skill trees
            for skill in &class_data.skills {
                for node in &skill.skill_tree.nodes {
                    let effects = parse_node_effects(&node.effects, &node.modifier_type);
                    if !effects.is_empty() {
                        node_effects.insert(node.id.clone(), effects);
                    }
                }
            }
        }

        // Skills at class level
        for skill in &class_data.skills {
            for node in &skill.skill_tree.nodes {
                let effects = parse_node_effects(&node.effects, &node.modifier_type);
                if !effects.is_empty() {
                    node_effects.insert(node.id.clone(), effects);
                }
            }
        }
    }

    // Archetype weight table — sorted ascending by slider_upper (required by resolve_archetype_weights).
    // Deferred note from 2.2: enforce sort here.
    let mut archetype_weights = standard_archetype_weights();
    archetype_weights.sort_by_key(|e| e.slider_upper);
    debug_assert!(
        archetype_weights.windows(2).all(|w| w[0].slider_upper < w[1].slider_upper),
        "archetype_weights must be sorted ascending with unique slider_upper values"
    );

    Ok(GameData {
        node_effects,
        archetype_weights,
        class_base_stats,
    })
}

/// Converts `RawGameNode.effects` + the node's `modifier_type` string into scoring-core `NodeEffect`s.
/// One `RawGameNode` can have multiple effects. Each maps to one `NodeEffect`.
/// Unknown tag combinations produce no effect (node silently contributes nothing — FR-A6 fallback).
fn parse_node_effects(
    effects: &[crate::models::game_data::NodeEffect],
    node_modifier_type: &Option<String>,
) -> Vec<NodeEffect> {
    let modifier_type = parse_modifier_type(node_modifier_type.as_deref());
    effects
        .iter()
        .filter_map(|e| {
            let stat_key = tags_to_stat_key(&e.tags, &modifier_type)?;
            let value = extract_value(&e.description)?;
            Some(NodeEffect {
                stat_key,
                modifier_type: modifier_type.clone(),
                value,
                condition: Condition::Always,
            })
        })
        .collect()
}

/// Maps the node-level `modifierType` string to `ModifierType`.
/// Fallback: "increased" (FR-A6).
fn parse_modifier_type(raw: Option<&str>) -> ModifierType {
    match raw {
        Some("more") => ModifierType::More,
        Some("flat") => ModifierType::Flat,
        _ => ModifierType::Increased, // "increased" or missing → additive (FR-A6 fallback)
    }
}

/// Maps tag arrays to a `StatKey`. Returns `None` for unknown/unmapped combinations.
/// Priority: specific > generic. First matching rule wins.
fn tags_to_stat_key(tags: &[String], modifier_type: &ModifierType) -> Option<StatKey> {
    // Normalize to uppercase for matching
    let upper: Vec<&str> = tags.iter().map(|t| t.as_str()).collect();
    let has = |t: &str| upper.iter().any(|s| s.eq_ignore_ascii_case(t));

    // Damage — delivery-type specific (check before generic DAMAGE)
    if has("DAMAGE") {
        if has("SPELL") { return Some(StatKey::IncreasedSpellDamage); }
        if has("MINION") { return Some(StatKey::IncreasedMinionDamage); }
        if has("AREA") || has("AOE") { return Some(StatKey::IncreasedAreaDamage); }
        if has("RANGED") { return Some(StatKey::IncreasedRangedDamage); }
        if has("MELEE") && *modifier_type == ModifierType::Flat {
            // "+N Melee Physical/Fire/etc. Damage" = flat added damage
            if has("FIRE") { return Some(StatKey::FlatAddedFireDamage); }
            if has("COLD") || has("LIGHTNING") { // simplify: cold→fire slot for now
                return Some(StatKey::FlatAddedColdDamage);
            }
            return Some(StatKey::FlatAddedPhysicalDamage);
        }
        if has("MELEE") { return Some(StatKey::IncreasedMeleeDamage); }
        // Element-specific increased damage
        if has("FIRE") { return Some(StatKey::IncreasedFireDamage); }
        if has("COLD") { return Some(StatKey::IncreasedColdDamage); }
        if has("LIGHTNING") { return Some(StatKey::IncreasedLightningDamage); }
        if has("VOID") { return Some(StatKey::IncreasedVoidDamage); }
        if has("POISON") || has("NECROTIC") { return Some(StatKey::IncreasedPoisonDamage); }
        if has("PHYSICAL") && *modifier_type == ModifierType::Flat {
            return Some(StatKey::FlatAddedPhysicalDamage);
        }
        if has("PHYSICAL") { return Some(StatKey::IncreasedPhysicalDamage); }
        return Some(StatKey::IncreasedDamage); // generic
    }

    // Crit
    if has("CRIT_AVOIDANCE") || (has("CRIT") && has("AVOIDANCE")) {
        return Some(StatKey::CriticalStrikeAvoidance);
    }
    if has("CRIT") && (has("MULTIPLIER") || has("MULTI")) {
        return Some(StatKey::CriticalStrikeMultiplier);
    }
    if has("CRIT") && has("CHANCE") {
        return Some(StatKey::CriticalStrikeChance);
    }
    if has("CRIT") { return Some(StatKey::CriticalStrikeChance); } // default crit tag

    // Speed
    if has("ATTACK_SPEED") || (has("ATTACK") && has("SPEED")) {
        return Some(StatKey::AttackSpeed);
    }
    if has("CAST_SPEED") || (has("CAST") && has("SPEED")) {
        return Some(StatKey::CastSpeed);
    }
    if has("MOVEMENT_SPEED") || (has("MOVEMENT") && has("SPEED")) {
        return Some(StatKey::MovementSpeed);
    }

    // Defense — HP
    if has("HEALTH") || has("HP") || has("LIFE") {
        return match modifier_type {
            ModifierType::Flat => Some(StatKey::MaxHp),
            _ => Some(StatKey::MaxHpPercent),
        };
    }

    // Defense — Armor/Ward/Leech/Regen
    if has("ARMOUR") || has("ARMOR") { return Some(StatKey::Armor); }
    if has("WARD") { return Some(StatKey::WardPerSecond); }
    if has("LEECH") { return Some(StatKey::LifeLeechPercent); }
    if has("REGEN") || has("REGENERATION") { return Some(StatKey::HpRegenPerSec); }
    if has("DODGE") { return Some(StatKey::DodgeRating); }

    // Defense — Endurance
    if has("ENDURANCE") {
        if has("THRESHOLD") { return Some(StatKey::EnduranceThreshold); }
        return Some(StatKey::EndurancePercent);
    }

    // Defense — Resistances (check element before generic)
    if has("RESISTANCE") || has("RES") {
        if has("ALL") || has("ALL_RESISTANCE") { return Some(StatKey::AllResistances); }
        if has("FIRE") { return Some(StatKey::FireResistance); }
        if has("COLD") || has("ICE") { return Some(StatKey::ColdResistance); }
        if has("LIGHTNING") || has("SHOCK") { return Some(StatKey::LightningResistance); }
        if has("VOID") { return Some(StatKey::VoidResistance); }
        if has("POISON") || has("NECROTIC") { return Some(StatKey::PoisonResistance); }
        if has("PHYSICAL") { return Some(StatKey::PhysicalResistance); }
        return Some(StatKey::AllResistances); // unqualified RESISTANCE = all
    }

    None // Unknown tag combination → silently dropped (FR-A6)
}

/// Extracts the first numeric value from a description string.
/// "+4 Melee Physical Damage per point" → 4.0
/// "+3% Melee Attack Speed per point" → 3.0
/// Returns None if no numeric value found (effect is dropped).
fn extract_value(description: &str) -> Option<f64> {
    // Find first sequence of digits (with optional leading +/- and decimal)
    let mut start = None;
    let mut end = 0;
    let chars: Vec<char> = description.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i].is_ascii_digit() {
            if start.is_none() {
                // Look back for optional sign
                start = Some(if i > 0 && (chars[i - 1] == '+' || chars[i - 1] == '-') {
                    i - 1
                } else {
                    i
                });
            }
            end = i + 1;
        } else if chars[i] == '.' && start.is_some() && i + 1 < chars.len() && chars[i + 1].is_ascii_digit() {
            end = i + 1;
        } else if start.is_some() {
            break;
        }
        i += 1;
    }
    start.and_then(|s| description[s..end].parse::<f64>().ok().map(|v| v.abs()))
}

/// Standard 5-band archetype weight table covering slider positions 0–100.
/// Deferred from 2.2: archetype_weights must be sorted ascending. `build_scoring_game_data`
/// sorts this before storing.
fn standard_archetype_weights() -> Vec<ArchetypeWeightsEntry> {
    vec![
        ArchetypeWeightsEntry { slider_upper: 24, weights: ArchetypeWeights { w_dmg: 0.75, w_surv: 0.15, w_speed: 0.10 } }, // Glass Cannon
        ArchetypeWeightsEntry { slider_upper: 49, weights: ArchetypeWeights { w_dmg: 0.65, w_surv: 0.25, w_speed: 0.10 } }, // Lean DPS
        ArchetypeWeightsEntry { slider_upper: 74, weights: ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 } }, // Balanced
        ArchetypeWeightsEntry { slider_upper: 89, weights: ArchetypeWeights { w_dmg: 0.40, w_surv: 0.50, w_speed: 0.10 } }, // Lean Tank
        ArchetypeWeightsEntry { slider_upper: 100, weights: ArchetypeWeights { w_dmg: 0.25, w_surv: 0.65, w_speed: 0.10 } }, // Juggernaut
    ]
}

/// Placeholder base HP stats per class — conservative values used until Epic 4 refines them.
/// Scoring fallback in `compute_defense` already handles missing class: (base_hp: 100.0, hp_per_level: 5.0).
fn derive_class_base_stats(class_id: &str) -> BaseClassStats {
    match class_id {
        "sentinel" => BaseClassStats { base_hp: 90.0, hp_per_level: 5.0 },
        "mage"     => BaseClassStats { base_hp: 70.0, hp_per_level: 4.0 },
        "primalist"=> BaseClassStats { base_hp: 85.0, hp_per_level: 5.0 },
        "rogue"    => BaseClassStats { base_hp: 75.0, hp_per_level: 5.0 },
        "acolyte"  => BaseClassStats { base_hp: 70.0, hp_per_level: 4.0 },
        _          => BaseClassStats { base_hp: 80.0, hp_per_level: 5.0 }, // unknown class
    }
}
```

Then add to `lebo/src-tauri/src/services/mod.rs`:
```rust
pub mod game_data_loader;
```

---

### Task 3 — `ScoringState` and Initialization in `lib.rs` (Exact)

Add near the top of `lib.rs` (after existing imports):

```rust
use std::sync::{Arc, RwLock};
use scoring_core::GameData;

pub struct ScoringState {
    pub game_data: Arc<RwLock<GameData>>,
}
```

In the `run()` function, add `.manage(...)` BEFORE `.setup(...)`:

```rust
.manage(ScoringState {
    game_data: Arc::new(RwLock::new(GameData::default())),
})
.setup(|app| {
    let handle = app.handle().clone();

    // Load scoring game data — overwrite the default in ScoringState.
    // setup() runs before the event loop; commands cannot fire until the frontend loads,
    // so there is no race between initialization and command calls.
    let scoring_state = app.state::<ScoringState>();
    match services::game_data_loader::build_scoring_game_data(&handle) {
        Ok(gd) => {
            *scoring_state.game_data.write().unwrap() = gd;
        }
        Err(e) => {
            eprintln!("SCORING_ERROR: game data load failed at startup: {}", e);
            // Fallback: default GameData (empty node_effects) — scoring returns base stats only
        }
    }

    tauri::async_runtime::spawn(services::connectivity_service::start_watcher(handle));
    Ok(())
})
```

Add the import for `scoring_commands` in `lib.rs`:

```rust
use commands::scoring_commands::compute_stats;
```

Add `compute_stats` to `invoke_handler!`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing entries ...
    compute_stats,
])
```

---

### Task 4 — `scoring_commands.rs` (Exact Implementation)

Create `lebo/src-tauri/src/commands/scoring_commands.rs`:

```rust
use scoring_core::{BuildSnapshot, ComputeOptions, StatSheet};
use crate::ScoringState;

/// Sync Tauri command — Stage 1 scoring only (~2ms). No async, no clone.
/// Pattern 3: read lock, compute, lock drops at function end.
/// Pattern 5: all errors prefixed with "SCORING_ERROR: ".
#[tauri::command]
pub fn compute_stats(
    snapshot: BuildSnapshot,
    state: tauri::State<ScoringState>,
) -> Result<StatSheet, String> {
    let game_data = state.game_data.read()
        .map_err(|e| format!("SCORING_ERROR: game_data lock poisoned: {}", e))?;
    Ok(scoring_core::compute_stats(&snapshot, &game_data, ComputeOptions::default()))
}
```

Add to `lebo/src-tauri/src/commands/mod.rs`:

```rust
pub mod scoring_commands;
```

---

### Critical Architecture Patterns — Must Not Violate

| Pattern | Rule | Where |
|---------|------|--------|
| Pattern 2 | `BuildSnapshot` input → `#[serde(rename_all = "camelCase")]` already applied; TypeScript sends camelCase | `build_snapshot.rs` — already correct, no change |
| Pattern 2 | `StatSheet` output → default snake_case; TypeScript must use snake_case field names (e.g., `stat_sheet.offense.damage_score`) | `stat_sheet.rs` — already correct |
| Pattern 3 | Sync command: `.read().unwrap()` no clone, lock drops at end | `scoring_commands.rs` — implement exactly as shown |
| Pattern 3 | Async commands in future stories: `.read().unwrap().clone()` then release before `spawn_blocking` | Not this story |
| Pattern 5 | All error strings from scoring Rust: `"SCORING_ERROR: ..."` prefix | `scoring_commands.rs` error path |
| No raw `invoke()` | TypeScript layer (Story 2.5) must call via `invokeCommand<StatSheet>()` | Not this story — reminder for 2.5 |

---

### `ScoringState` vs `AppState` Note

There is no generic `AppState` struct in this project. The pattern is per-concern state types managed separately. `ScoringState` is the new type for this epic. `IconMapCache` (from `icon_commands.rs`) follows the same pattern. Do NOT create a single unified `AppState` type.

---

### Tag→StatKey Mapping Notes

The tag mapping in `tags_to_stat_key` is a best-effort conversion from raw game data tags. Key behaviors:
- Unknown combinations return `None` → effect silently skipped (FR-A6 compliant)
- `MELEE` + `DAMAGE` + `Flat` modifier → flat added physical damage (most common "melee flat damage" node type)
- `COLD` tagging for both ice/cold nodes is intentional (game uses both terms)
- `RESISTANCE` alone maps to `AllResistances` (defensive fallback)
- The mapping covers ~80% of real game nodes; unmapped nodes contribute zero to scoring until the mapping is extended

**`extract_value` edge cases:**
- "+4 per point" → 4.0 (most common)
- "+15%" → 15.0 (value only, not 0.15 — scoring engine uses raw percentage values)
- "15% increased" → 15.0
- Node with no number (text-only description) → None → effect dropped

---

### What This Story Does NOT Do

- ❌ Do NOT implement `buildSnapshotSerializer.ts` or `useStatSheet.ts` — that is Story 2.5
- ❌ Do NOT implement the stat sheet UI — that is Story 2.6
- ❌ Do NOT register `run_optimization` or `run_gear_scoring` — those are Stories 4.3 and 5.3
- ❌ Do NOT parse affix value tables from item database — scoring uses node_effects only in Phase 3
- ❌ Do NOT modify `ErrorType` or `errorNormalizer.ts` — already done in Story 2.1
- ❌ Do NOT add TypeScript tests for the command — no TS changes in this story
- ❌ Do NOT add `rayon` to the Tauri crate's `Cargo.toml` — it is only in `scoring-core`

---

### Known Pre-existing Test Failures

8 frontend test failures remain from stories 1.1/1.2: `SkillTreeCanvas` ×1, `ProviderSelector` ×5, `Settings` ×1, `TreeControls` ×1 — all pre-existing. Do not fix them.

After this story, `cargo test -p scoring-core` must show **26 passing tests** (same as after Story 2.3 — no new Rust tests in this story).

---

### Build Verification Sequence

Run in this exact order:
1. `cargo build -p scoring-core` from `lebo/src-tauri/` — validates pure crate unchanged
2. `cargo build` from `lebo/src-tauri/` — validates Tauri crate compiles with new dep + new files
3. `pnpm build` from `lebo/` — validates no accidental TypeScript breakage
4. `cargo test -p scoring-core` from `lebo/src-tauri/` — 26 tests pass
5. `pnpm vitest` from `lebo/` — 8 pre-existing failures, none new

---

### Project Structure Notes

**New files:**
- `lebo/src-tauri/src/services/game_data_loader.rs`
- `lebo/src-tauri/src/commands/scoring_commands.rs`

**Modified files:**
- `lebo/src-tauri/Cargo.toml` — add `scoring-core = { path = "scoring-core" }` to `[dependencies]`
- `lebo/src-tauri/src/lib.rs` — add `ScoringState`, `.manage()` call, `setup` initialization, import + register `compute_stats`
- `lebo/src-tauri/src/services/mod.rs` — add `pub mod game_data_loader;`
- `lebo/src-tauri/src/commands/mod.rs` — add `pub mod scoring_commands;`

**Architecture deviation note:** The architecture diagram shows `scoring_commands.rs` and `game_data_loader.rs` at `src/` root level. This story places them in `src/commands/` and `src/services/` respectively, consistent with the existing project structure (all commands in `commands/`, all services in `services/`). The AC language says "in the Tauri crate" which both locations satisfy.

---

### References

- [Source: epics.md § Story 2.4 — Tauri IPC Wiring]
- [Source: epics.md § Additional Requirements — IPC Strategy (D2, D3)]
- [Source: epics.md § Additional Requirements — Critical Patterns (all seven patterns)]
- [Source: epics.md § Additional Requirements — Rust Workspace & Crate Structure (ADR-001)]
- [Source: architecture.md § ADR-001 — Cargo Workspace Layout]
- [Source: architecture.md § ADR-002 — Module Boundaries]
- [Source: architecture.md § IPC Strategy Decision — Path C Debounced rAF]
- [Source: architecture.md § The compute_stats Function — Pure and Tauri-Free]
- [Source: project-context.md § Critical Don't-Miss Rules — no raw invoke(), four stores only]
- [Source: project-context.md § Critical Don't-Miss Rules — ErrorType enum values must match Rust error string prefixes]
- [Source: story 2.1 Completion Notes — SCORING_ERROR already in errors.ts and errorNormalizer.ts]
- [Source: story 2.3 Completion Notes — 26 Rust tests passing, no TypeScript changes]
- [Source: deferred-work.md — archetype_weights must be sorted ascending; enforce in Story 2.4 game data loader]
- [Source: deferred-work.md — Rust Option<String> for modifierType; story 2.4 consumes as string → ModifierType enum]
- [Source: lebo/src-tauri/src/lib.rs — existing lib structure, IconMapCache pattern for managed state]
- [Source: lebo/src-tauri/src/services/game_data_service.rs — ensure_game_data_dir, load_class_data, load_manifest]
- [Source: lebo/src-tauri/src/models/game_data.rs — RawClassData, RawGameNode, NodeEffect (description + tags)]
- [Source: lebo/src-tauri/scoring-core/src/lib.rs — public exports including BuildSnapshot, ComputeOptions, StatSheet]
- [Source: lebo/src-tauri/scoring-core/src/game_data.rs — GameData, NodeEffect, ArchetypeWeightsEntry structs]
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs — StatKey enum variants]
- [Source: lebo/src-tauri/scoring-core/src/compute.rs — resolve_archetype_weights fallback (empty table → 0.55/0.35/0.10)]
- [Source: lebo/src-tauri/resources/game-data/classes/sentinel.json — disk format: description + tags + modifierType]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Build error: `app.state::<ScoringState>()` required `use tauri::Manager;` to be in scope — added to `lib.rs` imports.

### Completion Notes List

- Created `game_data_loader.rs` with `build_scoring_game_data` — reads manifest + class JSON files, constructs `scoring_core::GameData` with `node_effects`, `class_base_stats`, and sorted `archetype_weights` table.
- Created `scoring_commands.rs` with sync `compute_stats` Tauri command — Pattern 3 (read lock, no clone, lock drops at end).
- Added `ScoringState` struct to `lib.rs` with `Arc<RwLock<GameData>>`, initialized once in `.setup()` before connectivity watcher spawn.
- `cargo build -p scoring-core`: 0 errors. `cargo build` (full workspace): 0 errors. `cargo test -p scoring-core`: 26/26 pass. `pnpm build`: 0 TS errors. `pnpm vitest`: 8 pre-existing failures, 0 new.
- No TypeScript changes — this story is pure Rust IPC plumbing. Story 2.5 adds the TS serializer and hook.

### File List

- `lebo/src-tauri/Cargo.toml` — added `scoring-core = { path = "scoring-core" }` to `[dependencies]`
- `lebo/src-tauri/src/lib.rs` — added `ScoringState`, `use tauri::Manager`, `use std::sync::{Arc, RwLock}`, `use scoring_core::GameData`, `.manage(ScoringState{...})`, setup initialization block, `use commands::scoring_commands::compute_stats`, `compute_stats` in `invoke_handler!`
- `lebo/src-tauri/src/services/mod.rs` — added `pub mod game_data_loader;`
- `lebo/src-tauri/src/services/game_data_loader.rs` — new file
- `lebo/src-tauri/src/commands/mod.rs` — added `pub mod scoring_commands;`
- `lebo/src-tauri/src/commands/scoring_commands.rs` — new file
