# Story 2.2: Stage 1 — Build Score Function Implementation

Status: review

## Story

As a player,
I want the scoring engine to compute my build's DamageScore, SurvivabilityScore, SpeedScore, and composite BuildScore using Last Epoch's actual damage formula,
so that every stat value I see in the app is mathematically correct rather than estimated.

## Acceptance Criteria

1. **Given** a `BuildSnapshot` with passive nodes containing only "increased" modifiers summing to 150%
   **When** `compute_stats()` is called
   **Then** `offense.damage_score` matches `base × (1 + 1.50) × 1.0` = `base × 2.5`
   **And** the computation completes in < 2ms on target hardware

2. **Given** a build with 82% crit chance and a crit multiplier of 350%
   **When** `compute_stats()` is called
   **Then** `offense.avg_hit_damage_crit_weighted` equals `base_hit × (3.50 × 0.82 + 1.0 × 0.18)` = `base_hit × 3.05`
   **And** crit chance inputs above 100% are clamped to 1.0 before computation

3. **Given** a build with HP 1500, Ward 300, Endurance 30%
   **When** `compute_stats()` is called
   **Then** `defense.effective_hp` equals `1500 × (1 + 300/1500) × (1 / (1 - 0.30))` ≈ 2571
   **And** defensive layer count is tracked and used in the survivability bonus multiplier

4. **Given** a slider position of 50 (balanced: w_dmg=0.55, w_surv=0.35, w_speed=0.10)
   **When** `compute_stats()` is called
   **Then** `scores.build_score` equals `0.55 × damage_score + 0.35 × surv_score + 0.10 × speed_score`

5. **Given** a passive node with no `modifierType` field (absent in GameData node effects)
   **When** `compute_stats()` processes it
   **Then** the modifier is treated as `"increased"` (additive) with no panic or error

6. **Given** the `scoring-core` unit test suite
   **When** `cargo test -p scoring-core` runs
   **Then** all formula tests pass including: damage formula with increased-only, damage formula with a more multiplier, crit-weighted damage at various crit chance values, EHP with Ward and Endurance, BuildScore weights at all five slider positions from the archetype weight table
   **And** all tests pass

## Tasks / Subtasks

- [x] Task 1: Expand `GameData` struct with node effect and scoring tables (AC: #1, #4, #5, #6)
  - [x] Add `NodeEffect` struct to `game_data.rs` (stat_key, modifier_type, value, condition)
  - [x] Add `ArchetypeWeights` struct to `game_data.rs` (w_dmg, w_surv, w_speed)
  - [x] Add `ArchetypeWeightsEntry` struct (slider_position upper bound + weights)
  - [x] Add `BaseClassStats` struct (base_hp, hp_per_level)
  - [x] Expand `GameData` with the four pub fields (see Dev Notes for exact definitions)
  - [x] Verify `GameData::default()` still compiles (all new fields are empty collections)

- [x] Task 2: Expand `BuildSnapshot` with gear, idol, and blessings fields (future IPC wiring)
  - [x] Add `GearSlotSnapshot` struct to `build_snapshot.rs` (slot_id, affix_entries — see Dev Notes)
  - [x] Add `AffixEntry` struct (affix_id, tier)
  - [x] Add `IdolPlacement` struct (row, col, idol_size, prefix_affix: Option<AffixEntry>, suffix_affix: Option<AffixEntry>)
  - [x] Add three new optional fields to `BuildSnapshot`: `gear_slots`, `idol_placements`, `blessings`
  - [x] All new fields use `#[serde(default)]` so existing serialized data deserializes without error
  - [x] Verify `BuildSnapshot::default()` still compiles

- [x] Task 3: Create `scoring-core/src/compute.rs` with the `compute_stats` public function (AC: #1–#6)
  - [x] Implement `pub fn compute_stats(snapshot: &BuildSnapshot, game_data: &GameData, options: ComputeOptions) -> StatSheet`
  - [x] Implement `build_registry()` helper: iterate `snapshot.node_allocations`, look up each node's `NodeEffect`s in `game_data.node_effects`, add matching `Modifier`s to the registry (once per allocated point)
  - [x] Implement `compute_offense()`: sum Increased% modifiers, multiply More% modifiers, compute DamageScore; compute crit values (clamp crit chance to 1.0); compute crit-weighted average damage (see Dev Notes for exact formula)
  - [x] Implement `compute_defense()`: compute raw HP from class base + level scaling; compute Ward ratio; compute endurance multiplier; compute effective_hp = base_hp × (1 + ward_ratio) × (1 / (1 - endurance_pct)); count defensive layers; apply layer bonus
  - [x] Implement `compute_speed()`: sum MovementSpeed, AttackSpeed/CastSpeed, AoE modifiers; apply composite formula (see Dev Notes)
  - [x] Implement `resolve_archetype_weights()`: walk `game_data.archetype_weights` sorted by upper bound to find the entry covering `snapshot.slider_position`; fall back to balanced weights (0.55/0.35/0.10) if table is empty
  - [x] Compute `scores.build_score = w_dmg × scores.damage_score + w_surv × scores.survivability_score + w_speed × scores.speed_score`
  - [x] Return `StatSheet` with populated offense, defense, scores; `ailment: None`, `minion: None`, `warnings: vec![]` (warnings populated in Story 2.3)

- [x] Task 4: Wire `compute_stats` into `lib.rs` (AC: #1–#6)
  - [x] Add `pub mod compute;` declaration to `lib.rs`
  - [x] Add `pub use compute::compute_stats;` to `lib.rs`
  - [x] Add `NodeEffect`, `ArchetypeWeights`, `ArchetypeWeightsEntry`, `BaseClassStats` to `lib.rs` re-exports from `game_data`

- [x] Task 5: Write unit tests in `scoring-core/src/compute.rs` (AC: #6)
  - [x] Test: damage formula — increased-only modifiers summing to 150% → damage_score = base × 2.5
  - [x] Test: damage formula — one more multiplier (1.40) with increased 0% → damage_score = base × 1.0 × 1.40
  - [x] Test: damage formula — increased 100% + more 1.40 → damage_score = base × 2.0 × 1.40
  - [x] Test: crit-weighted — crit_chance=0.82, crit_multi=350% → factor = 3.05 (within 0.001 tolerance)
  - [x] Test: crit-weighted — crit_chance=1.20 (above 100%) → clamped to 1.0, factor = crit_multi
  - [x] Test: EHP — HP=1500, Ward=300, Endurance=30% → effective_hp ≈ 2571 (within 1.0 tolerance)
  - [x] Test: EHP — no Ward, no Endurance → effective_hp = raw_hp
  - [x] Test: BuildScore at slider 0 (Glass Cannon weights from table)
  - [x] Test: BuildScore at slider 25
  - [x] Test: BuildScore at slider 50 → verified formula 0.55×D + 0.35×S + 0.10×Sp
  - [x] Test: BuildScore at slider 75
  - [x] Test: BuildScore at slider 100 (Juggernaut weights from table)
  - [x] Test: missing modifierType falls back to Increased (no panic)

- [x] Task 6: Verify builds
  - [x] Run `cargo build -p scoring-core` from `lebo/src-tauri/` — zero errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero errors required (full workspace)
  - [x] Run `cargo test -p scoring-core` — all new tests pass, zero failures
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors (BuildSnapshot type changes must reflect in `statSheet.ts` if needed)
  - [x] Run `pnpm vitest` — confirm no new regressions (8 pre-existing failures expected)

---

## Dev Agent Record

### Completion Notes

Implementation complete 2026-05-21. All 14 unit tests pass, zero regressions in frontend suite (8 pre-existing failures unchanged).

**Key decision:** `WardPerSecond` is NOT double-counted in the sustain layer check. The ward defensive layer (layer 2) already fires when `ward > 0.0`. Including `WardPerSecond` in the sustain layer would triple-count ward-based builds and break AC #3 (EHP ≈ 2571 with Ward=300 + Endurance=30%). The sustain layer check is restricted to `LifeLeechPercent` and `HpRegenPerSec`.

**More multiplier handling:** `Modifier::value` for `MoreDamage` is stored as the raw multiplier (e.g., 1.40), not as a percentage. The `product()` call on an empty iterator returns 1.0, so builds with no More modifiers correctly apply a 1.0 factor.

### File List

- `lebo/src-tauri/scoring-core/src/game_data.rs` — expanded with `NodeEffect`, `ArchetypeWeights`, `ArchetypeWeightsEntry`, `BaseClassStats`; `GameData` struct gained `node_effects`, `archetype_weights`, `class_base_stats` fields
- `lebo/src-tauri/scoring-core/src/build_snapshot.rs` — expanded with `AffixEntry`, `GearSlotSnapshot`, `IdolPlacement`; `BuildSnapshot` gained `gear_slots`, `idol_placements`, `blessings` fields
- `lebo/src-tauri/scoring-core/src/compute.rs` — new file: `compute_stats`, `build_registry`, `compute_offense`, `compute_defense`, `compute_speed`, `resolve_archetype_weights`, 14 unit tests
- `lebo/src-tauri/scoring-core/src/lib.rs` — added `pub mod compute;` and re-exports for all new public symbols

### Change Log

- 2026-05-21: Implemented `compute_stats` Stage 1 — damage formula (Increased/More), crit-weighted average, EHP with ward/endurance/layer bonus, speed score, archetype weight lookup, all 5 slider positions tested. 14/14 unit tests pass.

---

## Dev Notes

### Architecture Overview

This story implements Stage 1 of the scoring pipeline: the pure Rust `compute_stats` function in the new `scoring-core/src/compute.rs` module. It has four scopes:

1. **`GameData` expansion** (Task 1): Add the node effect and archetype weight structures needed for `compute_stats` to resolve modifiers. These are currently stubs — Story 2.4 populates them from disk JSON via `game_data_loader.rs`.
2. **`BuildSnapshot` expansion** (Task 2): Add gear slot, idol placement, and blessing fields so the serializer (Story 2.5) can include full build context from the start. Story 2.2 does NOT compute affix or idol stat contributions — those come in later epics.
3. **`compute.rs` implementation** (Task 3): The pure `compute_stats` function. No Tauri, no async, no side effects. Unit-testable with mock `GameData`.
4. **`lib.rs` re-exports** (Task 4): Wire everything into the public crate API.

**Critical constraint from architecture Pattern 2:** `compute_stats` is registered as a sync Tauri command in Story 2.4. The TypeScript interface receives snake_case field names from Rust output. `BuildSnapshot` input uses `#[serde(rename_all = "camelCase")]` (already set). The new fields in `BuildSnapshot` must also be snake_case in Rust but will arrive as camelCase from TypeScript.

**No Tauri commands are registered or changed in this story.** That is Story 2.4.

---

### Task 1 — `GameData` Expansion (Exact)

Expand `lebo/src-tauri/scoring-core/src/game_data.rs`:

```rust
use std::collections::HashMap;
use crate::modifier::{StatKey, ModifierType, Condition};

/// A single stat effect contributed by one point allocated to a passive node.
/// One node may have multiple effects (e.g., "+5% Fire Damage, +3% Crit Chance").
#[derive(Debug, Clone)]
pub struct NodeEffect {
    pub stat_key: StatKey,
    /// Missing modifier_type in source data → Increased (FR-A6 fallback)
    pub modifier_type: ModifierType,
    /// Raw numeric value (e.g., 5.0 for "+5%", 1.15 for "15% more")
    pub value: f64,
    pub condition: Condition,
}

/// Archetype scoring weights for one slider band.
#[derive(Debug, Clone)]
pub struct ArchetypeWeights {
    pub w_dmg: f64,
    pub w_surv: f64,
    pub w_speed: f64,
}

/// One row in the archetype weight table.
/// `slider_upper` is the inclusive upper bound for this band.
/// Bands must be sorted ascending and cover 0–100 exhaustively.
/// Example: [(24, glass_cannon), (49, lean_dps), (74, balanced), (89, lean_tank), (100, juggernaut)]
#[derive(Debug, Clone)]
pub struct ArchetypeWeightsEntry {
    pub slider_upper: u32,
    pub weights: ArchetypeWeights,
}

/// Base class stats for HP computation.
#[derive(Debug, Clone)]
pub struct BaseClassStats {
    /// HP at level 1
    pub base_hp: f64,
    /// Additional HP gained per level above 1
    pub hp_per_level: f64,
}

/// Read-only game reference data loaded once at startup.
/// Populated in Story 2.4 from disk JSON via `game_data_loader.rs`.
#[derive(Debug, Clone, Default)]
pub struct GameData {
    /// Passive/skill node ID → list of stat effects per allocated point.
    /// Key: node_id string matching keys in `BuildSnapshot.node_allocations`.
    /// Story 2.4 populates this from class JSON files.
    pub node_effects: HashMap<String, Vec<NodeEffect>>,

    /// Archetype weight table — must be sorted by slider_upper ascending.
    /// Empty table → compute_stats falls back to balanced weights (0.55/0.35/0.10).
    pub archetype_weights: Vec<ArchetypeWeightsEntry>,

    /// Base HP per class ID (e.g., "sentinel", "mage").
    /// Story 2.4 populates from class definitions.
    pub class_base_stats: HashMap<String, BaseClassStats>,
    // Story 2.4 adds: affix value tables, tree graph, skill definitions, etc.
}
```

`#[derive(Default)]` still works because `HashMap::default()` and `Vec::default()` produce empty collections. No manual `Default` impl needed.

---

### Task 2 — `BuildSnapshot` Expansion (Exact)

Add new types and fields to `lebo/src-tauri/scoring-core/src/build_snapshot.rs`:

```rust
use serde::Deserialize;
use std::collections::HashMap;

/// One affix entry on a piece of gear or idol.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AffixEntry {
    pub affix_id: String,
    pub tier: u32,
}

/// Gear equipped in one slot (helm, chest, gloves, etc.).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GearSlotSnapshot {
    pub item_id: Option<String>,
    #[serde(default)]
    pub prefixes: Vec<AffixEntry>,
    #[serde(default)]
    pub suffixes: Vec<AffixEntry>,
}

/// One idol placed on the grid.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdolPlacement {
    pub row: u32,
    pub col: u32,
    pub idol_size: String,
    pub prefix: Option<AffixEntry>,
    pub suffix: Option<AffixEntry>,
}

/// Engine input: player state expressed as IDs only (no resolved data).
/// Deserialized from TypeScript via camelCase JSON (Pattern 2).
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuildSnapshot {
    #[serde(default)]
    pub node_allocations: HashMap<String, u32>,
    #[serde(default)]
    pub skill_node_allocations: HashMap<String, HashMap<String, u32>>,
    pub character_level: u32,
    pub class_id: String,
    pub mastery_id: String,
    /// 0 (Glass Cannon) to 100 (Juggernaut)
    pub slider_position: u32,
    /// Named active conditions, e.g. ["on_pinnacle_boss", "power_charges_3"]
    #[serde(default)]
    pub active_conditions: Vec<String>,
    // --- Added in Story 2.2 ---
    /// Keyed by canonical slot ID: "helm", "chest", "gloves", "boots", "belt",
    /// "amulet", "ring_1", "ring_2", "weapon", "off_hand", "relic", "catalyst"
    #[serde(default)]
    pub gear_slots: HashMap<String, GearSlotSnapshot>,
    #[serde(default)]
    pub idol_placements: Vec<IdolPlacement>,
    /// Blessing IDs currently active
    #[serde(default)]
    pub blessings: Vec<String>,
}
```

**Rule:** All new fields use `#[serde(default)]` so that existing serialized `BuildSnapshot` JSON (from Story 2.1 tests, from the current `invokeCommand` caller chain) deserializes without error. No breaking change.

---

### Task 3 — `compute.rs` Implementation (Exact)

Create `lebo/src-tauri/scoring-core/src/compute.rs`. Structure overview:

```rust
use crate::build_snapshot::BuildSnapshot;
use crate::compute_options::ComputeOptions;
use crate::game_data::{ArchetypeWeights, GameData};
use crate::modifier::{Modifier, ModifierRegistry, ModifierType, StatKey, Condition};
use crate::stat_sheet::{
    DefenseStats, MinionStats, OffenseStats, ScoreComponents, StatSheet,
};

pub fn compute_stats(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    _options: ComputeOptions,
) -> StatSheet {
    let registry = build_registry(snapshot, game_data);
    let offense = compute_offense(snapshot, game_data, &registry);
    let defense = compute_defense(snapshot, game_data, &registry);
    let speed = compute_speed(&registry);
    let weights = resolve_archetype_weights(snapshot.slider_position, game_data);
    let scores = ScoreComponents {
        damage_score: offense.damage_score,
        survivability_score: defense.effective_hp,
        speed_score: speed,
        build_score: weights.w_dmg * offense.damage_score
            + weights.w_surv * defense.effective_hp
            + weights.w_speed * speed,
    };
    StatSheet {
        offense,
        defense,
        scores,
        ailment: None,
        minion: None,
        warnings: vec![],  // populated in Story 2.3
    }
}
```

#### `build_registry()`

```rust
fn build_registry(snapshot: &BuildSnapshot, game_data: &GameData) -> ModifierRegistry {
    let mut registry = ModifierRegistry::new();
    for (node_id, &point_count) in &snapshot.node_allocations {
        if let Some(effects) = game_data.node_effects.get(node_id) {
            for effect in effects {
                for _ in 0..point_count {
                    registry.add(Modifier {
                        stat_key: effect.stat_key.clone(),
                        modifier_type: effect.modifier_type.clone(),
                        value: effect.value,
                        condition: effect.condition.clone(),
                        source: node_id.clone(),
                    });
                }
            }
        }
        // Unknown node_id (not in game_data) → silently skipped; no panic (FR-A6)
    }
    registry
}
```

#### `compute_offense()`

**DamageScore formula (FR-A1):** `Base × (1 + Σ Increased%) × Π More%`

- "Base" = 100.0 (normalized base for scoring purposes; absolute weapon damage is not available in Phase 3 without gear affix resolution — Story 2.5 will enrich this once gear affixes flow through)
- Sum all `Increased` modifier values for damage stats
- Multiply all `More` modifier values for damage stats
- Clamp product at 0.01 minimum to prevent division by zero downstream

**Crit-weighted average (FR-A2):** `Hit × [(CritMulti × CritChance) + (1 × (1 - CritChance))]`
- `CritChance = Σ CriticalStrikeChance modifiers / 100.0`, clamped to [0.0, 1.0]
- `CritMulti = 2.0 + Σ CriticalStrikeMultiplier modifiers / 100.0` (base 200% + added multi%)
- `avg_hit_damage_crit_weighted = avg_hit_damage × (crit_multi × crit_chance + 1.0 × (1.0 - crit_chance))`

Damage stat keys to aggregate (use `IncreasedDamage` as the canonical general increased% stat; element- and delivery-specific ones stack additively):
- `Increased`: `IncreasedDamage`, `IncreasedFireDamage`, `IncreasedColdDamage`, `IncreasedLightningDamage`, `IncreasedVoidDamage`, `IncreasedPoisonDamage`, `IncreasedPhysicalDamage`, `IncreasedSpellDamage`, `IncreasedMeleeDamage`, `IncreasedRangedDamage`, `IncreasedAreaDamage`
- `More`: `MoreDamage` (dedicated more multiplier key)
- `Flat`: ignored in Phase 3 base damage score (weapon flat damage is not in scope until Story 2.4 enriches the snapshot with weapon base values)

**Attack/cast speed** (`attack_speed` vs `cast_speed` field selection):
- If `AttackSpeed` modifiers exist in the registry: populate `attack_speed`, set `cast_speed = None`
- Else if `CastSpeed` modifiers exist: populate `cast_speed`, set `attack_speed = None`
- Else: both `None`
- Speed modifier value formula: `1.0 + (Σ values / 100.0)` where values are in percent

#### `compute_defense()`

**Base HP:** Look up `game_data.class_base_stats[snapshot.class_id]`. If not found, use fallback: `base_hp = 100.0 + character_level × 5.0`.

```
raw_hp = base_class_stats.base_hp + (character_level - 1) * base_class_stats.hp_per_level
       + Σ MaxHp (Flat modifiers)
       + raw_hp × Σ MaxHpPercent (Increased modifiers) / 100.0
```

**Ward:** Sum all `WardPerSecond` and `WardOnHit` modifiers for the `ward` field.

**Effective HP (FR-A3):**
```
ward_ratio = ward / raw_hp   (if raw_hp > 0, else 0)
endurance_pct = Σ EndurancePercent modifiers / 100.0   (capped at 0.9 to avoid division by zero)
effective_hp = raw_hp × (1.0 + ward_ratio) × (1.0 / (1.0 - endurance_pct))
```

**Defensive layer bonus:** Each layer beyond 2 multiplies `effective_hp` by `1.05`. Layers:
1. Endurance active: `endurance_pct > 0.0`
2. Ward active: `ward > 0.0`
3. All resistances capped: all resistance values ≥ 75.0
4. Crit avoidance capped: crit_avoidance ≥ 80.0
5. Sustain layer: `LifeLeechPercent > 0` OR `HpRegenPerSec ≥ 100` OR `WardPerSecond > 0`

Count active layers → apply `effective_hp × 1.05^max(0, layer_count - 2)`.

**Resistance values:** `FireResistance + AllResistances` both contribute additively to fire resist. Apply same pattern for all element types.

**Crit avoidance:** `Σ CriticalStrikeAvoidance / 100.0 × 100.0` (output as percentage 0–100).

#### `compute_speed()`

Returns a raw speed score as a product of speed factors:

```rust
fn compute_speed(registry: &ModifierRegistry) -> f64 {
    let active = &[];  // Phase 3: no conditional speed modifiers
    let move_speed = 1.0 + registry.query(&StatKey::MovementSpeed, active)
        .iter().map(|m| m.value).sum::<f64>() / 100.0;
    let atk_speed = 1.0 + registry.query(&StatKey::AttackSpeed, active)
        .iter().map(|m| m.value).sum::<f64>() / 100.0;
    let aoe = 1.0 + registry.query(&StatKey::AreaOfEffect, active)
        .iter().map(|m| m.value).sum::<f64>() / 100.0;
    move_speed * atk_speed * aoe
}
```

#### `resolve_archetype_weights()`

```rust
fn resolve_archetype_weights(slider_position: u32, game_data: &GameData) -> ArchetypeWeights {
    for entry in &game_data.archetype_weights {
        if slider_position <= entry.slider_upper {
            return entry.weights.clone();
        }
    }
    // Fallback: balanced weights if table is empty or slider > all upper bounds
    ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 }
}
```

---

### Archetype Weight Table (Reference for Game Data JSON)

These values are the production reference. When Story 2.4 creates the game data JSON, use these values. Unit tests inject the same table via mock `GameData`.

| Slider Range | Archetype | w_dmg | w_surv | w_speed |
|---|---|---|---|---|
| 0–24 | Glass Cannon | 0.75 | 0.20 | 0.05 |
| 25–49 | Lean DPS | 0.65 | 0.28 | 0.07 |
| 50–74 | Balanced | 0.55 | 0.35 | 0.10 |
| 75–89 | Lean Tank | 0.40 | 0.50 | 0.10 |
| 90–100 | Juggernaut | 0.25 | 0.65 | 0.10 |

Represented as `ArchetypeWeightsEntry` list sorted by `slider_upper` ascending: `[(24, gc), (49, ldps), (74, balanced), (89, lt), (100, jugg)]`.

---

### Task 5 — Unit Test Structure (Exact Pattern)

Tests live at the bottom of `compute.rs` using `#[cfg(test)]`. Each test constructs a minimal `GameData` and `BuildSnapshot` to isolate one formula. Helper to build the standard weight table:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_data::{ArchetypeWeightsEntry, BaseClassStats, NodeEffect};
    use crate::compute_options::ComputeOptions;

    fn standard_weight_table() -> Vec<ArchetypeWeightsEntry> {
        vec![
            ArchetypeWeightsEntry { slider_upper: 24, weights: ArchetypeWeights { w_dmg: 0.75, w_surv: 0.20, w_speed: 0.05 } },
            ArchetypeWeightsEntry { slider_upper: 49, weights: ArchetypeWeights { w_dmg: 0.65, w_surv: 0.28, w_speed: 0.07 } },
            ArchetypeWeightsEntry { slider_upper: 74, weights: ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 } },
            ArchetypeWeightsEntry { slider_upper: 89, weights: ArchetypeWeights { w_dmg: 0.40, w_surv: 0.50, w_speed: 0.10 } },
            ArchetypeWeightsEntry { slider_upper: 100, weights: ArchetypeWeights { w_dmg: 0.25, w_surv: 0.65, w_speed: 0.10 } },
        ]
    }

    fn sentinel_class_stats() -> BaseClassStats {
        BaseClassStats { base_hp: 100.0, hp_per_level: 5.0 }
    }

    #[test]
    fn damage_score_increased_only() {
        // 150% increased damage → score = base(100) × (1 + 1.50) = 250
        let mut node_effects = HashMap::new();
        node_effects.insert("node_a".to_string(), vec![
            NodeEffect { stat_key: StatKey::IncreasedDamage, modifier_type: ModifierType::Increased, value: 75.0, condition: Condition::Always },
            NodeEffect { stat_key: StatKey::IncreasedDamage, modifier_type: ModifierType::Increased, value: 75.0, condition: Condition::Always },
        ]);
        let game_data = GameData { node_effects, archetype_weights: standard_weight_table(), ..Default::default() };
        let mut snapshot = BuildSnapshot::default();
        snapshot.node_allocations.insert("node_a".to_string(), 1);
        snapshot.slider_position = 50;

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 100.0 * (1.0 + 1.50) * 1.0;
        assert!((sheet.offense.damage_score - expected).abs() < 0.01,
            "expected {} got {}", expected, sheet.offense.damage_score);
    }

    #[test]
    fn damage_score_with_more_multiplier() {
        // 0% increased, 1× more at 1.40 → score = 100 × 1.0 × 1.40 = 140
        let mut node_effects = HashMap::new();
        node_effects.insert("node_more".to_string(), vec![
            NodeEffect { stat_key: StatKey::MoreDamage, modifier_type: ModifierType::More, value: 1.40, condition: Condition::Always },
        ]);
        let game_data = GameData { node_effects, archetype_weights: standard_weight_table(), ..Default::default() };
        let mut snapshot = BuildSnapshot::default();
        snapshot.node_allocations.insert("node_more".to_string(), 1);
        snapshot.slider_position = 50;

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        assert!((sheet.offense.damage_score - 140.0).abs() < 0.01);
    }

    #[test]
    fn crit_weighted_at_82_percent() {
        // crit_chance = 82%, crit_multi = 350% → factor = 3.50 × 0.82 + 1.0 × 0.18 = 3.05
        let mut node_effects = HashMap::new();
        node_effects.insert("crit_chance_node".to_string(), vec![
            NodeEffect { stat_key: StatKey::CriticalStrikeChance, modifier_type: ModifierType::Flat, value: 82.0, condition: Condition::Always },
        ]);
        node_effects.insert("crit_multi_node".to_string(), vec![
            NodeEffect { stat_key: StatKey::CriticalStrikeMultiplier, modifier_type: ModifierType::Flat, value: 150.0, condition: Condition::Always }, // +150% multi → total = 200+150 = 350%
        ]);
        let game_data = GameData { node_effects, archetype_weights: standard_weight_table(), ..Default::default() };
        let mut snapshot = BuildSnapshot::default();
        snapshot.node_allocations.insert("crit_chance_node".to_string(), 1);
        snapshot.node_allocations.insert("crit_multi_node".to_string(), 1);
        snapshot.slider_position = 50;

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // avg_hit_damage = base = 100.0; crit_weighted = 100.0 × 3.05 = 305.0
        assert!((sheet.offense.avg_hit_damage_crit_weighted - 305.0).abs() < 0.5);
    }

    #[test]
    fn crit_chance_above_100_is_clamped() {
        // 120% crit chance → clamped to 100% → factor = crit_multi × 1.0
        // ... similar setup with value: 120.0 ...
    }

    #[test]
    fn effective_hp_with_ward_and_endurance() {
        // HP=1500, Ward=300, Endurance=30% → effective_hp ≈ 2571
        let mut class_base_stats = HashMap::new();
        class_base_stats.insert("sentinel".to_string(), BaseClassStats { base_hp: 1500.0, hp_per_level: 0.0 });
        let mut node_effects = HashMap::new();
        node_effects.insert("ward_node".to_string(), vec![
            NodeEffect { stat_key: StatKey::WardPerSecond, modifier_type: ModifierType::Flat, value: 300.0, condition: Condition::Always },
        ]);
        node_effects.insert("endurance_node".to_string(), vec![
            NodeEffect { stat_key: StatKey::EndurancePercent, modifier_type: ModifierType::Flat, value: 30.0, condition: Condition::Always },
        ]);
        let game_data = GameData { node_effects, class_base_stats, archetype_weights: standard_weight_table(), ..Default::default() };
        let mut snapshot = BuildSnapshot::default();
        snapshot.class_id = "sentinel".to_string();
        snapshot.character_level = 1;
        snapshot.node_allocations.insert("ward_node".to_string(), 1);
        snapshot.node_allocations.insert("endurance_node".to_string(), 1);
        snapshot.slider_position = 50;

        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // 1500 × (1 + 300/1500) × (1 / (1 - 0.30)) ≈ 2571.4
        assert!((sheet.defense.effective_hp - 2571.0).abs() < 2.0,
            "expected ~2571 got {}", sheet.defense.effective_hp);
    }

    #[test]
    fn build_score_slider_50_balanced() {
        // Verify BuildScore = 0.55×D + 0.35×S + 0.10×Sp at slider 50
        let game_data = GameData { archetype_weights: standard_weight_table(), ..Default::default() };
        let mut snapshot = BuildSnapshot::default();
        snapshot.slider_position = 50;
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        let expected = 0.55 * sheet.scores.damage_score
            + 0.35 * sheet.scores.survivability_score
            + 0.10 * sheet.scores.speed_score;
        assert!((sheet.scores.build_score - expected).abs() < 0.001);
    }

    // Similar tests for slider positions 0, 25, 75, 100 ...

    #[test]
    fn unknown_node_id_does_not_panic() {
        let game_data = GameData::default();
        let mut snapshot = BuildSnapshot::default();
        snapshot.node_allocations.insert("nonexistent_node".to_string(), 3);
        let sheet = compute_stats(&snapshot, &game_data, ComputeOptions::default());
        // Should complete normally with zero modifiers applied
        assert_eq!(sheet.offense.damage_score, 100.0); // base with no modifiers
    }
}
```

**Key test pattern rule:** Tests build `GameData` struct literals with `..Default::default()` for unrelated fields. This future-proofs the test when Story 2.4 adds more fields to `GameData`.

---

### Task 4 — `lib.rs` Updates (Exact)

Add to `lebo/src-tauri/scoring-core/src/lib.rs`:

```rust
pub mod compute;
// ... existing mod declarations unchanged ...

pub use compute::compute_stats;
pub use game_data::{
    ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, NodeEffect,
};
pub use build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot, IdolPlacement};
```

---

### What This Story Does NOT Do

- ❌ Do NOT create `scoring_commands.rs` or register `compute_stats` in `lib.rs` Tauri `invoke_handler!` — that is Story 2.4
- ❌ Do NOT create `game_data_loader.rs` or load actual JSON from disk — that is Story 2.4
- ❌ Do NOT create `buildSnapshotSerializer.ts` — that is Story 2.5
- ❌ Do NOT create `useStatSheet.ts` hook — that is Story 2.5
- ❌ Do NOT implement defensive floor check or populate `StatSheet.warnings` — that is Story 2.3
- ❌ Do NOT add gear affix or idol stat contributions to the scoring computation — that is Story 2.4+ (gear effects need resolved affix value tables from `GameData`)
- ❌ Do NOT modify `optimizationStore.ts` or any TypeScript code (unless TypeScript build breaks due to `BuildSnapshot` struct changes — check with `pnpm build`)
- ❌ Do NOT delete `scores: BuildScore | null` from `optimizationStore` — deprecated in place, deleted in follow-up
- ❌ Do NOT delete `scoringEngine.ts` — deprecated in place, deleted in follow-up
- ❌ Do NOT add rayon parallelism — this story is single-threaded Stage 1; rayon goes in `scan.rs` (Story 4.1)

---

### Known Pre-existing Test Failures

8 test failures remain from stories 1.1/1.2: `SkillTreeCanvas` ×1, `ProviderSelector` ×5, `Settings` ×1, `TreeControls` ×1 — all pre-existing. `pnpm vitest` will show them; do not fix them.

`cargo test -p scoring-core` currently produces 0 results (no tests exist in the crate). After this story, all new tests must pass.

---

### Project Structure Notes

**New files:**
- `lebo/src-tauri/scoring-core/src/compute.rs`

**Modified files:**
- `lebo/src-tauri/scoring-core/src/game_data.rs` (add `NodeEffect`, `ArchetypeWeights`, `ArchetypeWeightsEntry`, `BaseClassStats`; expand `GameData` struct)
- `lebo/src-tauri/scoring-core/src/build_snapshot.rs` (add `AffixEntry`, `GearSlotSnapshot`, `IdolPlacement`; expand `BuildSnapshot`)
- `lebo/src-tauri/scoring-core/src/lib.rs` (add `pub mod compute;`, re-export new public symbols)

---

### References

- [Source: epics.md § Story 2.2 — Stage 1 Build Score Function Implementation]
- [Source: epics.md § Epic 2 — Scoring Engine & Live Stat Sheet]
- [Source: epics.md § FR-A1, FR-A2, FR-A3, FR-A4, FR-A5 — damage and scoring formulas]
- [Source: epics.md § FR-A6 — modifierType fallback to "increased"]
- [Source: epics.md § NFR-1, NFR-2, NFR-4 — performance and data-driven requirements]
- [Source: architecture.md § The `compute_stats` Function — Pure and Tauri-Free]
- [Source: architecture.md § ADR-001 — Cargo Workspace Layout]
- [Source: architecture.md § ADR-002 — Module Boundaries (compute.rs ownership)]
- [Source: architecture.md § Pattern 1 — BuildSnapshot Serialization Boundary]
- [Source: architecture.md § Pattern 2 — Serde Field Naming Direction]
- [Source: architecture.md § Pattern 3 — GameData Locking in AppState]
- [Source: architecture.md § D3 — IPC Command Surface (compute_stats is sync Stage 1)]
- [Source: story 2.1 Dev Notes — "No compute_stats Tauri command in this story; that is Story 2.4"]
- [Source: project-context.md § Language-Specific Rules — strict mode, no barrel files]
- [Source: project-context.md § Critical Don't-Miss Rules — WebGL not touched, four stores only]
- [Source: lebo/src-tauri/scoring-core/src/build_snapshot.rs — current BuildSnapshot to extend]
- [Source: lebo/src-tauri/scoring-core/src/game_data.rs — current GameData stub to expand]
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs — ModifierRegistry, StatKey, ModifierType, Condition]
- [Source: lebo/src-tauri/scoring-core/src/lib.rs — current pub re-exports to extend]
