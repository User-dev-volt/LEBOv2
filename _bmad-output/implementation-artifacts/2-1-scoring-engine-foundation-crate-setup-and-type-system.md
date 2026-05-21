# Story 2.1: Scoring Engine Foundation — Crate Setup & Type System

Status: review

## Story

As a developer,
I want the `scoring-core` Rust workspace crate scaffolded with all core types, the `ClassModule` trait, five class module stubs, and the `SCORING_ERROR` prefix wired into the TypeScript error system,
so that all subsequent Epic 2 stories have a stable, compiler-enforced foundation to build against.

## Acceptance Criteria

1. **Given** the `src-tauri/` directory
   **When** a developer runs `cargo build -p scoring-core`
   **Then** the crate compiles without errors
   **And** `scoring-core/Cargo.toml` has no Tauri, no tokio, no async runtime dependencies — only serde, serde_json, rayon

2. **Given** `scoring-core/src/modifier.rs`
   **When** an agent reviews it
   **Then** `Modifier`, `ModifierType`, `Condition`, and `ModifierRegistry` are defined and public
   **And** `ModifierRegistry::query(stat, active_conditions)` filters by `stat_key` and `condition.is_active(active_conditions)`
   **And** the `Condition` enum includes `Always`, `Named(String)`, `Stacked { name, count }`, `Threshold { stat, above }`, and `Composite(Vec<Condition>)` variants

3. **Given** the `ClassModule` trait in `scoring-core/src/class_module.rs`
   **When** an agent reviews it
   **Then** the trait requires `class_id()`, `apply_modifiers(&mut registry, &snapshot)`, and `compute_class_stats(&base, &snapshot) -> Option<ClassStats>` methods
   **And** five stub class modules exist in `scoring-core/src/classes/` (sentinel, mage, primalist, rogue, acolyte), each compiling with no-op implementations

4. **Given** `shared/types/errors.ts`
   **When** an agent inspects the `ErrorType` type
   **Then** `'SCORING_ERROR'` is present as a member of the union type
   **And** `'CONTEXT_DATA_ERROR'` is also present (deferred from Story 1.4)

5. **Given** `shared/utils/errorNormalizer.ts`
   **When** a Rust error string `"SCORING_ERROR: ..."` arrives
   **Then** `normalizeAppError()` maps it to `ErrorType` `'SCORING_ERROR'` via case-insensitive substring match in `ERROR_TYPE_MAP`
   **And** `CONTEXT_DATA_ERROR` is also mapped with a user-facing message

6. **Given** `shared/types/statSheet.ts` (new file)
   **When** a developer imports from it
   **Then** `StatSheet`, `OffenseStats`, `DefenseStats`, `ScoreComponents`, `StatWarning`, `NodeEfficiency`, `GearAnalysis`, `SynergyFlag` are all exported
   **And** `AilmentStats` and `MinionStats` are exported as Phase 4 placeholder interfaces (empty interfaces)
   **And** no `index.ts` barrel file is created

7. **Given** `optimizationStore.ts`
   **When** an agent reviews it
   **Then** `statSheet: StatSheet | null`, `isComputingStats: boolean`, `setStatSheet()`, and `setIsComputingStats()` are all present
   **And** `nodeEfficiencies: NodeEfficiency[] | null` and its setter are present (wired in Epic 4 Story 4.4)

8. **Given** the TypeScript build
   **When** `pnpm build` runs after this story
   **Then** zero TypeScript errors occur

## Tasks / Subtasks

- [x] Task 1: Convert `src-tauri/Cargo.toml` to workspace root (AC: #1)
  - [x] Add `[workspace]` section above `[package]` with `members = [".", "scoring-core"]` and `resolver = "2"`
  - [x] Verify `cargo build` (no `-p` flag) still succeeds for the Tauri crate

- [x] Task 2: Create `scoring-core` crate (AC: #1)
  - [x] Create directory `lebo/src-tauri/scoring-core/`
  - [x] Create `lebo/src-tauri/scoring-core/Cargo.toml` (see Dev Notes for exact content)
  - [x] Create `lebo/src-tauri/scoring-core/src/lib.rs` (see Dev Notes for exact content)

- [x] Task 3: Create `scoring-core/src/modifier.rs` — `StatKey`, `Modifier`, `ModifierType`, `Condition`, `ModifierRegistry` (AC: #2)
  - [x] Define `StatKey` enum covering all damage/defense/speed stat dimensions (see Dev Notes for full list)
  - [x] Define `ModifierType` enum: `Increased`, `More`, `Flat`
  - [x] Define `Condition` enum with all five variants including `is_active(&self, active_conditions: &[String]) -> bool`
  - [x] Define `Modifier` struct with `stat_key`, `modifier_type`, `value`, `condition`, `source` fields
  - [x] Define `ModifierRegistry` with `new()`, `add()`, `query()`, `len()`, `is_empty()` methods

- [x] Task 4: Create stub type modules in `scoring-core/src/` (AC: #3)
  - [x] Create `build_snapshot.rs` — minimal `BuildSnapshot` struct (see Dev Notes)
  - [x] Create `stat_sheet.rs` — `StatSheet`, `OffenseStats`, `DefenseStats`, `ScoreComponents`, `StatWarning`, `NodeEfficiency`, `GearAnalysis`, `SynergyFlag`, `AilmentStats`, `MinionStats` (see Dev Notes for exact definitions)
  - [x] Create `game_data.rs` — placeholder `GameData` struct with `#[derive(Default)]`
  - [x] Create `compute_options.rs` — placeholder `ComputeOptions` struct with `#[derive(Default)]`

- [x] Task 5: Create `class_module.rs` and class stubs (AC: #3)
  - [x] Create `lebo/src-tauri/scoring-core/src/class_module.rs` (see Dev Notes for exact trait + `ClassStats` definition)
  - [x] Create `lebo/src-tauri/scoring-core/src/classes/mod.rs` (see Dev Notes)
  - [x] Create five stub modules: `sentinel.rs`, `mage.rs`, `primalist.rs`, `rogue.rs`, `acolyte.rs` (see Dev Notes for pattern)

- [x] Task 6: Update `shared/types/errors.ts` (AC: #4)
  - [x] Add `'SCORING_ERROR'` to the `ErrorType` union type
  - [x] Add `'CONTEXT_DATA_ERROR'` to the `ErrorType` union type (deferred from Story 1.4)

- [x] Task 7: Update `shared/utils/errorNormalizer.ts` (AC: #5)
  - [x] Add `SCORING_ERROR: 'SCORING_ERROR'` to `ERROR_TYPE_MAP`
  - [x] Add `CONTEXT_DATA_ERROR: 'CONTEXT_DATA_ERROR'` to `ERROR_TYPE_MAP`
  - [x] Add user-facing messages for both new types in `USER_MESSAGES`

- [x] Task 8: Create `shared/types/statSheet.ts` (AC: #6)
  - [x] Create new file with all interfaces (see Dev Notes for exact definitions)
  - [x] Do NOT create a barrel `index.ts` file

- [x] Task 9: Extend `optimizationStore.ts` (AC: #7)
  - [x] Add imports for `StatSheet`, `NodeEfficiency` from `'../types/statSheet'`
  - [x] Add `statSheet: StatSheet | null` field + `setStatSheet()` action
  - [x] Add `isComputingStats: boolean` field + `setIsComputingStats()` action
  - [x] Add `nodeEfficiencies: NodeEfficiency[] | null` field + `setNodeEfficiencies()` action
  - [x] Initialize all new fields to `null` / `false` in the store factory

- [x] Task 10: Verify builds (AC: #1, #8)
  - [x] Run `cargo build -p scoring-core` from `lebo/src-tauri/` — zero errors required
  - [x] Run `cargo build` from `lebo/src-tauri/` — zero errors required (full workspace)
  - [x] Run `pnpm build` from `lebo/` — zero TypeScript errors required
  - [x] Run `pnpm vitest` — confirm no new regressions (8 pre-existing failures expected)

---

## Dev Notes

### Architecture Overview

This story has four scopes:

1. **Cargo workspace conversion** (Task 1): Convert the single-crate `src-tauri/Cargo.toml` to a Cargo workspace root, enabling the new `scoring-core` pure Rust crate.
2. **`scoring-core` crate scaffold** (Tasks 2–5): Create the pure Rust crate with all core type definitions, the `ClassModule` trait, five no-op class stubs, and stub types for modules that future stories will flesh out. The crate must compile cleanly with only `serde`, `serde_json`, and `rayon` as dependencies — **never Tauri, never tokio**.
3. **TypeScript type extensions** (Tasks 6–8): Wire `SCORING_ERROR` and `CONTEXT_DATA_ERROR` into the error normalization system; create `shared/types/statSheet.ts` with all scoring type interfaces.
4. **`optimizationStore` extension** (Task 9): Add `statSheet`, `isComputingStats`, `nodeEfficiencies` fields alongside the existing `scores: BuildScore | null` (which is deprecated but NOT deleted in this story — that's a follow-up).

**No Tauri commands are registered in this story.** `compute_stats` command wiring happens in Story 2.4.

**No `buildSnapshotSerializer.ts` is created in this story.** That's Story 2.5.

**No `useStatSheet.ts` hook is created in this story.** That's Story 2.5.

**Key constraint from architecture Pattern 5:**
> `SCORING_ERROR:` prefix must be added to `ErrorType` and `errorNormalizer.ts` BEFORE any scoring IPC story begins. This story is the setup prerequisite.

---

### Task 1 — `src-tauri/Cargo.toml` Workspace Conversion (Exact)

Open `lebo/src-tauri/Cargo.toml` and insert the `[workspace]` section at the very top, before `[package]`:

```toml
[workspace]
members = [".", "scoring-core"]
resolver = "2"

[package]
name = "lebo"
# ... rest unchanged
```

`resolver = "2"` is required for Cargo edition 2021 workspaces. Without it, Cargo 1.x warns; future Cargo versions will fail. The existing `[package]`, `[dependencies]`, etc. remain exactly as they are — do NOT restructure them.

---

### Task 2 — `scoring-core/Cargo.toml` (Exact)

Create `lebo/src-tauri/scoring-core/Cargo.toml`:

```toml
[package]
name = "scoring-core"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rayon = "1"
```

**Forbidden dependencies:** `tauri`, `tokio`, `reqwest`, `rusqlite`, `argon2`, `futures-util` — none of these belong in `scoring-core`. The Cargo.toml is the compiler-enforced boundary.

Create `lebo/src-tauri/scoring-core/src/lib.rs`:

```rust
pub mod build_snapshot;
pub mod class_module;
pub mod classes;
pub mod compute_options;
pub mod game_data;
pub mod modifier;
pub mod stat_sheet;

pub use build_snapshot::BuildSnapshot;
pub use class_module::{ClassModule, ClassStats};
pub use compute_options::ComputeOptions;
pub use game_data::GameData;
pub use modifier::{Condition, Modifier, ModifierRegistry, ModifierType, StatKey};
pub use stat_sheet::{
    AilmentStats, DefenseStats, GearAnalysis, MinionStats, NodeEfficiency, OffenseStats,
    ScoreComponents, StatSheet, StatWarning, SynergyFlag,
};
```

---

### Task 3 — `scoring-core/src/modifier.rs` (Exact)

Create `lebo/src-tauri/scoring-core/src/modifier.rs`:

```rust
use serde::{Deserialize, Serialize};

/// All stat dimensions the scoring engine tracks.
/// Add new variants here as Phase 4+ adds stat complexity.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum StatKey {
    // Damage — generic
    IncreasedDamage,
    MoreDamage,
    // Damage — element-specific
    IncreasedFireDamage,
    IncreasedColdDamage,
    IncreasedLightningDamage,
    IncreasedVoidDamage,
    IncreasedPoisonDamage,
    IncreasedPhysicalDamage,
    // Damage — delivery-type-specific
    IncreasedSpellDamage,
    IncreasedMeleeDamage,
    IncreasedRangedDamage,
    IncreasedMinionDamage,
    IncreasedAreaDamage,
    // Flat added damage
    FlatAddedFireDamage,
    FlatAddedColdDamage,
    FlatAddedLightningDamage,
    FlatAddedVoidDamage,
    FlatAddedPhysicalDamage,
    // Crit
    CriticalStrikeChance,
    CriticalStrikeMultiplier,
    CriticalStrikeAvoidance,
    // Defense
    MaxHp,
    MaxHpPercent,
    HpRegenPerSec,
    WardPerSecond,
    WardOnHit,
    Armor,
    EnduranceThreshold,
    EndurancePercent,
    FireResistance,
    ColdResistance,
    LightningResistance,
    VoidResistance,
    PoisonResistance,
    PhysicalResistance,
    NecroticResistance,
    AllResistances,
    DodgeRating,
    LifeLeechPercent,
    // Speed
    AttackSpeed,
    CastSpeed,
    MovementSpeed,
    AreaOfEffect,
    CooldownRecoverySpeed,
    // Mana
    MaxMana,
    ManaRegenPerSec,
    // Penetration
    FirePenetration,
    ColdPenetration,
    LightningPenetration,
    PhysicalPenetration,
    // Ailments (Phase 4 placeholders)
    IgniteDuration,
    PoisonDuration,
    BleedDuration,
    FreezeRateMultiplier,
    MaxPoisonStacks,
    // Minion
    IncreasedMinionCount,
    IncreasedMinionHp,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ModifierType {
    Increased,
    More,
    Flat,
}

/// Condition under which a modifier applies.
/// Phase 3 only uses `Always` and `Named` — the remaining variants
/// are defined for Phase 4 conditional mechanics.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Condition {
    /// Modifier always applies.
    Always,
    /// Applies when the named condition string is in `active_conditions`.
    /// Convention: condition strings match those in `BuildSnapshot.active_conditions`
    /// e.g. "on_pinnacle_boss", "power_charges_3".
    Named(String),
    /// Applies when the named charge/stack count is at or above `count`.
    /// Convention: active condition is encoded as `"{name}_{count}"` in the snapshot.
    Stacked { name: String, count: u32 },
    /// Applies when a computed stat value crosses a threshold.
    /// Cannot be evaluated from condition strings alone — the compute layer
    /// resolves these after the base registry is built.
    Threshold { stat: StatKey, above: f64 },
    /// All sub-conditions must be active (logical AND).
    Composite(Vec<Condition>),
}

impl Condition {
    /// Returns true if this condition is satisfied by the given active condition strings.
    /// `Threshold` always returns false here — the compute layer handles it separately.
    pub fn is_active(&self, active_conditions: &[String]) -> bool {
        match self {
            Condition::Always => true,
            Condition::Named(name) => active_conditions.contains(name),
            Condition::Stacked { name, count } => {
                active_conditions.iter().any(|c| {
                    if let Some(suffix) = c.strip_prefix(&format!("{}_", name)) {
                        suffix.parse::<u32>().map(|n| n >= *count).unwrap_or(false)
                    } else {
                        false
                    }
                })
            }
            Condition::Threshold { .. } => false,
            Condition::Composite(conditions) => {
                conditions.iter().all(|c| c.is_active(active_conditions))
            }
        }
    }
}

/// A single stat modifier from any source (passive node, affix, idol, blessing).
#[derive(Debug, Clone)]
pub struct Modifier {
    pub stat_key: StatKey,
    pub modifier_type: ModifierType,
    pub value: f64,
    pub condition: Condition,
    /// Source identifier: NodeId, AffixId, BlessingId, IdolSlotId, etc.
    pub source: String,
}

/// Central collection of all active modifiers for a build.
/// Built from `BuildSnapshot` before any computation runs.
#[derive(Debug, Default, Clone)]
pub struct ModifierRegistry {
    modifiers: Vec<Modifier>,
}

impl ModifierRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, modifier: Modifier) {
        self.modifiers.push(modifier);
    }

    /// Returns all modifiers for the given stat that are active under the current conditions.
    pub fn query(&self, stat: &StatKey, active_conditions: &[String]) -> Vec<&Modifier> {
        self.modifiers
            .iter()
            .filter(|m| &m.stat_key == stat && m.condition.is_active(active_conditions))
            .collect()
    }

    pub fn len(&self) -> usize {
        self.modifiers.len()
    }

    pub fn is_empty(&self) -> bool {
        self.modifiers.is_empty()
    }
}
```

---

### Task 4 — Stub Type Modules (Exact)

**`scoring-core/src/build_snapshot.rs`** — minimal struct; Story 2.2 fills in all fields:

```rust
use serde::Deserialize;
use std::collections::HashMap;

/// Engine input: player state expressed as IDs only (no resolved data).
/// Deserialized from TypeScript via camelCase JSON (Pattern 2).
/// Fields marked TODO will be populated in Story 2.2+.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuildSnapshot {
    pub node_allocations: HashMap<String, u32>,
    pub skill_node_allocations: HashMap<String, HashMap<String, u32>>,
    pub character_level: u32,
    pub class_id: String,
    pub mastery_id: String,
    /// 0 (Glass Cannon) to 100 (Juggernaut)
    pub slider_position: u32,
    /// Named active conditions, e.g. ["on_pinnacle_boss", "power_charges_3"]
    pub active_conditions: Vec<String>,
    // Story 2.2 adds: gear slots, idol placements, blessings
}
```

**`scoring-core/src/game_data.rs`** — placeholder; Story 2.4 populates via `game_data_loader.rs`:

```rust
/// Read-only game reference data loaded once at startup.
/// Holds resolved stat tables, tree graphs, affix value tables, class definitions.
/// Populated in Story 2.4 (Tauri IPC wiring) from disk JSON files.
#[derive(Debug, Clone, Default)]
pub struct GameData {
    // Story 2.4 adds: passive tree graph, affix value tables, class node data, etc.
}
```

**`scoring-core/src/compute_options.rs`**:

```rust
/// Options controlling scoring computation behavior.
#[derive(Debug, Clone, Default)]
pub struct ComputeOptions {
    // Story 2.2 may add options for which scoring stages to run.
}
```

**`scoring-core/src/stat_sheet.rs`** — Rust-side output structs (snake_case output per Pattern 2):

```rust
use serde::Serialize;

/// Damage, crit, and speed offensive stats.
#[derive(Debug, Clone, Default, Serialize)]
pub struct OffenseStats {
    pub damage_score: f64,
    pub avg_hit_damage: f64,
    pub avg_hit_damage_crit_weighted: f64,
    pub critical_strike_chance: f64,
    pub critical_strike_multiplier: f64,
    /// None if the build uses cast speed instead
    pub attack_speed: Option<f64>,
    /// None if the build uses attack speed instead
    pub cast_speed: Option<f64>,
    pub aoe_modifier: f64,
}

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
}

/// Weighted composite scoring breakdown.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ScoreComponents {
    pub damage_score: f64,
    pub survivability_score: f64,
    pub speed_score: f64,
    pub build_score: f64,
}

/// A defensive floor or stat floor violation.
#[derive(Debug, Clone, Serialize)]
pub struct StatWarning {
    /// Kebab-style identifier, e.g. "fire_resistance_uncapped", "crit_avoidance_low", "no_sustain_layer"
    pub warning_type: String,
    pub current_value: f64,
    pub gap: f64,
    /// Human-readable fix suggestion, e.g. "Helm slot has room for a Fire Resistance suffix at T5"
    pub suggested_fix: Option<String>,
}

/// Efficiency score for one unallocated passive node (Epic 4).
#[derive(Debug, Clone, Serialize)]
pub struct NodeEfficiency {
    pub node_id: String,
    pub efficiency: f64,
    pub path_delta_score: f64,
    pub effective_point_cost: u32,
    /// "gold" | "silver" | "dim"
    pub tier: String,
}

/// Per-slot ranking in a gear analysis (Epic 5).
#[derive(Debug, Clone, Default, Serialize)]
pub struct GearSlotRanking {
    pub slot: String,
    pub upgrade_score: f64,
    pub efficiency_percent: f64,
    pub ideal_prefix: Vec<WishlistAffix>,
    pub ideal_suffix: Vec<WishlistAffix>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WishlistAffix {
    pub affix_id: String,
    pub display_name: String,
    pub target_tier: u32,
    pub weight: f64,
    pub mechanical_reason: String,
    pub satisfied: bool,
}

/// Full gear analysis result (Epic 5).
#[derive(Debug, Clone, Default, Serialize)]
pub struct GearAnalysis {
    pub slot_rankings: Vec<GearSlotRanking>,
    pub priority_slot: String,
}

/// Cross-domain synergy or anti-synergy detection result (Epic 4).
#[derive(Debug, Clone, Serialize)]
pub struct SynergyFlag {
    /// "zero_value_allocation" | "mismatched_affix" | "game_changer"
    pub flag_type: String,
    /// "critical" | "high" | "medium"
    pub priority: String,
    pub description: String,
    pub node_id: Option<String>,
    pub slot: Option<String>,
    pub delta_build_score: Option<f64>,
}

/// Phase 4 placeholder — populated when ailment DPS tracking is implemented.
#[derive(Debug, Clone, Default, Serialize)]
pub struct AilmentStats {}

/// Phase 4 placeholder — populated when minion builds are fully modeled.
#[derive(Debug, Clone, Default, Serialize)]
pub struct MinionStats {}

/// Complete stat sheet returned by `compute_stats`.
/// `None` sub-sheets are hidden sections — never rendered as errors (Pattern 7).
#[derive(Debug, Clone, Serialize)]
pub struct StatSheet {
    pub offense: OffenseStats,
    pub defense: DefenseStats,
    pub scores: ScoreComponents,
    /// None in Phase 3; populated Phase 4
    pub ailment: Option<AilmentStats>,
    /// None unless active minion skills present
    pub minion: Option<MinionStats>,
    pub warnings: Vec<StatWarning>,
}

impl Default for StatSheet {
    fn default() -> Self {
        Self {
            offense: OffenseStats::default(),
            defense: DefenseStats::default(),
            scores: ScoreComponents::default(),
            ailment: None,
            minion: None,
            warnings: Vec::new(),
        }
    }
}
```

---

### Task 5 — `class_module.rs` and Class Stubs (Exact)

**`scoring-core/src/class_module.rs`**:

```rust
use crate::build_snapshot::BuildSnapshot;
use crate::modifier::ModifierRegistry;
use crate::stat_sheet::StatSheet;

/// Type alias for class identifiers — matches the `classId` in `BuildSnapshot`.
pub type ClassId = String;

/// Class-specific derived stats computed after the base `StatSheet`.
/// Empty in Phase 3; Phase 4 adds class-specific fields per Paradox Class.
#[derive(Debug, Clone, Default)]
pub struct ClassStats {}

/// Trait for pluggable class-specific scoring modules (NFR-5).
/// Phase 3 ships five stubs. Paradox Classes implement this trait without
/// modifying the base scoring engine.
pub trait ClassModule: Send + Sync {
    fn class_id(&self) -> &ClassId;

    /// Registers class-specific modifiers into the registry before computation.
    /// E.g., mastery-granted flat stats, class-unique conditional bonuses.
    fn apply_modifiers(&self, registry: &mut ModifierRegistry, snapshot: &BuildSnapshot);

    /// Computes class-specific stats from the base sheet.
    /// Returns `None` if no class-specific adjustments are needed.
    fn compute_class_stats(&self, base: &StatSheet, snapshot: &BuildSnapshot) -> Option<ClassStats>;
}
```

**`scoring-core/src/classes/mod.rs`**:

```rust
pub mod acolyte;
pub mod mage;
pub mod primalist;
pub mod rogue;
pub mod sentinel;
```

**Pattern for each class stub** (shown for `sentinel.rs`; replicate for all five):

`scoring-core/src/classes/sentinel.rs`:

```rust
use crate::build_snapshot::BuildSnapshot;
use crate::class_module::{ClassId, ClassModule, ClassStats};
use crate::modifier::ModifierRegistry;
use crate::stat_sheet::StatSheet;

pub struct SentinelModule {
    id: ClassId,
}

impl Default for SentinelModule {
    fn default() -> Self {
        Self { id: "sentinel".to_string() }
    }
}

impl ClassModule for SentinelModule {
    fn class_id(&self) -> &ClassId {
        &self.id
    }

    fn apply_modifiers(&self, _registry: &mut ModifierRegistry, _snapshot: &BuildSnapshot) {
        // Phase 3: no-op. Story 2.2 may add mastery-specific flat stats.
    }

    fn compute_class_stats(&self, _base: &StatSheet, _snapshot: &BuildSnapshot) -> Option<ClassStats> {
        None
    }
}
```

Replace `SentinelModule` / `"sentinel"` with the appropriate name for each class:
- `mage.rs` → `MageModule`, `"mage"`
- `primalist.rs` → `PrimalistModule`, `"primalist"`
- `rogue.rs` → `RogueModule`, `"rogue"`
- `acolyte.rs` → `AcolyteModule`, `"acolyte"`

---

### Task 6 — `shared/types/errors.ts` (Exact Changes)

Current `ErrorType` union type:

```typescript
export type ErrorType =
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'DATA_STALE'
  | 'STORAGE_ERROR'
  | 'AUTH_ERROR'
  | 'ICON_ERROR'
  | 'ITEM_DATA_ERROR'
  | 'UNKNOWN'
```

Add two new members (append before `'UNKNOWN'`):

```typescript
export type ErrorType =
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'DATA_STALE'
  | 'STORAGE_ERROR'
  | 'AUTH_ERROR'
  | 'ICON_ERROR'
  | 'ITEM_DATA_ERROR'
  | 'CONTEXT_DATA_ERROR'
  | 'SCORING_ERROR'
  | 'UNKNOWN'
```

No other changes to `errors.ts`.

---

### Task 7 — `shared/utils/errorNormalizer.ts` (Exact Changes)

Add to `ERROR_TYPE_MAP` (alongside existing entries):

```typescript
CONTEXT_DATA_ERROR: 'CONTEXT_DATA_ERROR',
SCORING_ERROR: 'SCORING_ERROR',
```

Add to `USER_MESSAGES` (alongside existing entries):

```typescript
CONTEXT_DATA_ERROR: 'Context database unavailable. Idol, blessing, and condition inputs may be limited.',
SCORING_ERROR: 'Scoring engine error. Build score could not be computed.',
```

The map key `SCORING_ERROR` does case-insensitive substring match in `normalizeAppError` — no additional changes required to the normalization logic.

---

### Task 8 — `shared/types/statSheet.ts` (Exact)

Create `lebo/src/shared/types/statSheet.ts`:

```typescript
// Rust output structs use snake_case (Pattern 2) — TypeScript mirrors exactly.

export interface OffenseStats {
  damage_score: number
  avg_hit_damage: number
  avg_hit_damage_crit_weighted: number
  critical_strike_chance: number
  critical_strike_multiplier: number
  attack_speed: number | null
  cast_speed: number | null
  aoe_modifier: number
}

export interface DefenseStats {
  effective_hp: number
  raw_hp: number
  ward: number
  endurance_percent: number
  endurance_threshold: number
  armor: number
  fire_resistance: number
  cold_resistance: number
  lightning_resistance: number
  void_resistance: number
  poison_resistance: number
  physical_resistance: number
  crit_avoidance: number
  dodge_chance: number
}

export interface ScoreComponents {
  damage_score: number
  survivability_score: number
  speed_score: number
  build_score: number
}

// Phase 4 placeholder — hidden when null (Pattern 7)
export interface AilmentStats {}

// Phase 4 placeholder — hidden when null (Pattern 7)
export interface MinionStats {}

export interface StatWarning {
  warning_type: string
  current_value: number
  gap: number
  suggested_fix?: string
}

export interface NodeEfficiency {
  node_id: string
  efficiency: number
  path_delta_score: number
  effective_point_cost: number
  tier: 'gold' | 'silver' | 'dim'
}

export interface WishlistAffix {
  affix_id: string
  display_name: string
  target_tier: number
  weight: number
  mechanical_reason: string
  satisfied: boolean
}

export interface GearSlotRanking {
  slot: string
  upgrade_score: number
  efficiency_percent: number
  ideal_prefix: WishlistAffix[]
  ideal_suffix: WishlistAffix[]
}

export interface GearAnalysis {
  slot_rankings: GearSlotRanking[]
  priority_slot: string
}

export interface SynergyFlag {
  flag_type: 'zero_value_allocation' | 'mismatched_affix' | 'game_changer'
  priority: 'critical' | 'high' | 'medium'
  description: string
  node_id?: string
  slot?: string
  delta_build_score?: number
}

export interface StatSheet {
  offense: OffenseStats
  defense: DefenseStats
  scores: ScoreComponents
  ailment: AilmentStats | null
  minion: MinionStats | null
  warnings: StatWarning[]
}
```

**Rules enforced:**
- Named exports only — no default export
- No barrel `index.ts` file — import directly from `statSheet.ts`
- All field names in snake_case — mirrors Rust output struct field names exactly (Pattern 2)
- `AilmentStats` and `MinionStats` are empty interfaces (Phase 4 placeholder)
- `null` sub-sheets are hidden sections, never error states (Pattern 7)

---

### Task 9 — `optimizationStore.ts` Extension (Exact Changes)

Add imports at the top of `lebo/src/shared/stores/optimizationStore.ts`:

```typescript
import type { StatSheet, NodeEfficiency } from '../types/statSheet'
```

Add to `OptimizationStore` interface (alongside existing fields after `scores: BuildScore | null`):

```typescript
  // Rust scoring engine fields (Story 2.2+ populates)
  statSheet: StatSheet | null
  isComputingStats: boolean
  nodeEfficiencies: NodeEfficiency[] | null
  setStatSheet: (sheet: StatSheet | null) => void
  setIsComputingStats: (computing: boolean) => void
  setNodeEfficiencies: (efficiencies: NodeEfficiency[] | null) => void
```

Add to the store factory `create<OptimizationStore>()(...)` implementation (alongside `scores: null`):

```typescript
  statSheet: null,
  isComputingStats: false,
  nodeEfficiencies: null,
  setStatSheet: (sheet) => set({ statSheet: sheet }),
  setIsComputingStats: (computing) => set({ isComputingStats: computing }),
  setNodeEfficiencies: (efficiencies) => set({ nodeEfficiencies: efficiencies }),
```

**`scores: BuildScore | null` is NOT removed.** It is deprecated once `useStatSheet` is live (Story 2.5), but deletion is a follow-up story. Both fields coexist through Story 2.4 inclusive.

---

### What This Story Does NOT Do

- ❌ Do NOT create `scoring_commands.rs` or register `compute_stats` in `lib.rs` — that is Story 2.4
- ❌ Do NOT create `game_data_loader.rs` — that is Story 2.4
- ❌ Do NOT create `buildSnapshotSerializer.ts` — that is Story 2.5
- ❌ Do NOT create `useStatSheet.ts` hook — that is Story 2.5
- ❌ Do NOT implement any actual scoring computation in `compute.rs` — that is Story 2.2
- ❌ Do NOT delete `scores: BuildScore | null` from `optimizationStore` — deprecated in place, deleted in follow-up
- ❌ Do NOT delete `scoringEngine.ts` — deprecated in place, deleted in follow-up
- ❌ Do NOT create `compute.rs`, `scan.rs`, `gear.rs`, or `synergy.rs` — those are Stories 2.2, 4.1, 5.2, 4.2
- ❌ Do NOT add `AppState` with `Arc<RwLock<GameData>>` to `lib.rs` — that is Story 2.4
- ❌ Do NOT add `rayon` to the **Tauri crate** `Cargo.toml` — it belongs only in `scoring-core/Cargo.toml`
- ❌ Do NOT create barrel `index.ts` files anywhere

---

### Known Pre-existing Test Failures

8 test failures remain from stories 1.1/1.2: `SkillTreeCanvas` ×1, `ProviderSelector` ×5, `Settings` ×1, `TreeControls` ×1 — all pre-existing. `pnpm vitest` will show them; do not fix them.

After Task 9 extends `optimizationStore`, check `optimizationStore.test.ts` to ensure existing tests still pass. The new fields have initial values of `null`/`false` which are valid defaults; no existing test should break.

---

### Deferred Work Context

From Story 1.1 deferred (now addressable):
> `modifier_type: Option<String>` in Rust accepts any string value — no type-safety guarantee. Address by replacing with a proper serde enum when Epic 2 scoring begins consuming the field.

The `ModifierType` enum defined in this story is the proper Rust serde enum. However, the **game data model** (`lebo/src-tauri/src/models/game_data.rs`) still uses `Option<String>` for `modifier_type` in node effect types. That model is NOT changed here — it is read by the Tauri crate and remains as-is. The `scoring-core` engine will receive `modifierType` as a string from JSON (`BuildSnapshot`) and map it to `ModifierType` at Story 2.2 computation time. The game data structs in `lebo/src-tauri/src/models/` are separate from `scoring-core/src/game_data.rs`.

From Story 1.3 deferred (now addressable):
> Fix by adding `| null` to scope/modifierType TS types when Epic 2 scoring begins consuming them.

The TypeScript game data types in `shared/types/gameData.ts` have `modifierType` and `scope` as `string | undefined`. These are used by the Tauri crate only. The new `statSheet.ts` types do not introduce this issue (they use proper TypeScript types from the start). **Do not modify `gameData.ts` in this story** — that is a separate type-cleanup task.

---

### Project Structure Notes

**New files:**
- `lebo/src-tauri/scoring-core/Cargo.toml`
- `lebo/src-tauri/scoring-core/src/lib.rs`
- `lebo/src-tauri/scoring-core/src/modifier.rs`
- `lebo/src-tauri/scoring-core/src/build_snapshot.rs`
- `lebo/src-tauri/scoring-core/src/stat_sheet.rs`
- `lebo/src-tauri/scoring-core/src/game_data.rs`
- `lebo/src-tauri/scoring-core/src/compute_options.rs`
- `lebo/src-tauri/scoring-core/src/class_module.rs`
- `lebo/src-tauri/scoring-core/src/classes/mod.rs`
- `lebo/src-tauri/scoring-core/src/classes/sentinel.rs`
- `lebo/src-tauri/scoring-core/src/classes/mage.rs`
- `lebo/src-tauri/scoring-core/src/classes/primalist.rs`
- `lebo/src-tauri/scoring-core/src/classes/rogue.rs`
- `lebo/src-tauri/scoring-core/src/classes/acolyte.rs`
- `lebo/src/shared/types/statSheet.ts`

**Modified files:**
- `lebo/src-tauri/Cargo.toml` (add `[workspace]` section)
- `lebo/src/shared/types/errors.ts` (add `SCORING_ERROR`, `CONTEXT_DATA_ERROR`)
- `lebo/src/shared/utils/errorNormalizer.ts` (add both to maps and messages)
- `lebo/src/shared/stores/optimizationStore.ts` (add `statSheet`, `isComputingStats`, `nodeEfficiencies` fields + setters)

### References

- [Source: epics.md § Story 2.1 — Scoring Engine Foundation: Crate Setup & Type System]
- [Source: epics.md § Epic 2 — Scoring Engine & Live Stat Sheet]
- [Source: architecture.md § ADR-001 — Cargo Workspace Layout]
- [Source: architecture.md § ADR-002 — Module Boundaries]
- [Source: architecture.md § ADR-003 — Parallelism Primitive]
- [Source: architecture.md § The Modifier Registry — The Load-Bearing Foundation]
- [Source: architecture.md § The Condition Enum — Designed for Growth]
- [Source: architecture.md § The StatSheet — Designed for Option<T> Expansion]
- [Source: architecture.md § The ClassModule Trait — Paradox Class Readiness (NFR-5)]
- [Source: architecture.md § D1 — StatSheet Store Placement]
- [Source: architecture.md § D4 — StatSheet TypeScript Type File]
- [Source: architecture.md § Pattern 2 — Serde Field Naming Direction]
- [Source: architecture.md § Pattern 5 — SCORING_ERROR Error Type Prefix]
- [Source: architecture.md § Pattern 7 — StatSheet Null Sub-Sheets = Hidden, Not Errored]
- [Source: architecture.md § New File Tree]
- [Source: project-context.md § Language-Specific Rules — no barrel files, strict mode, ErrorType convention]
- [Source: project-context.md § Framework-Specific Rules — four stores only]
- [Source: story 1.4 Dev Notes — "Do NOT add CONTEXT_DATA_ERROR to ErrorType — that is Story 2.1"]
- [Source: deferred-work.md — Story 1.1: modifier_type Rust enum deferred to Epic 2]
- [Source: deferred-work.md — Story 1.3: TypeScript null union type deferred to Epic 2]
- [Source: lebo/src-tauri/Cargo.toml — current single-crate configuration]
- [Source: lebo/src/shared/types/errors.ts — current ErrorType union]
- [Source: lebo/src/shared/utils/errorNormalizer.ts — current ERROR_TYPE_MAP and normalizer]
- [Source: lebo/src/shared/stores/optimizationStore.ts — current store fields to extend]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all builds and tests passed cleanly on first attempt.

### Completion Notes List

- Converted `lebo/src-tauri/Cargo.toml` to a Cargo workspace root with `members = [".", "scoring-core"]` and `resolver = "2"`. Full workspace build verified.
- Created `scoring-core` pure Rust crate with only `serde`, `serde_json`, `rayon` dependencies — no Tauri, no tokio, no async runtime.
- Implemented `modifier.rs` with full `StatKey` enum (70+ variants), `ModifierType`, `Condition` (5 variants including `is_active()`), `Modifier` struct, and `ModifierRegistry` with `query()` filtering by stat and active conditions.
- Created all stub type modules: `build_snapshot.rs`, `stat_sheet.rs`, `game_data.rs`, `compute_options.rs`.
- Created `class_module.rs` with `ClassModule` trait and `ClassStats`. Created five class stubs (sentinel, mage, primalist, rogue, acolyte) all with no-op implementations.
- Added `'SCORING_ERROR'` and `'CONTEXT_DATA_ERROR'` to `ErrorType` union and wired both into `ERROR_TYPE_MAP` and `USER_MESSAGES` in `errorNormalizer.ts`.
- Created `shared/types/statSheet.ts` with all 10 interfaces in snake_case — no barrel file created.
- Extended `optimizationStore.ts` with `statSheet`, `isComputingStats`, `nodeEfficiencies` fields and their setters. Existing `scores: BuildScore | null` left in place per story spec.
- `cargo build -p scoring-core`: 0 errors. `cargo build` (full workspace): 0 errors. `pnpm build`: 0 TypeScript errors. `pnpm vitest`: 8 pre-existing failures only, 0 regressions.

### File List

**New files:**
- `lebo/src-tauri/scoring-core/Cargo.toml`
- `lebo/src-tauri/scoring-core/src/lib.rs`
- `lebo/src-tauri/scoring-core/src/modifier.rs`
- `lebo/src-tauri/scoring-core/src/build_snapshot.rs`
- `lebo/src-tauri/scoring-core/src/stat_sheet.rs`
- `lebo/src-tauri/scoring-core/src/game_data.rs`
- `lebo/src-tauri/scoring-core/src/compute_options.rs`
- `lebo/src-tauri/scoring-core/src/class_module.rs`
- `lebo/src-tauri/scoring-core/src/classes/mod.rs`
- `lebo/src-tauri/scoring-core/src/classes/sentinel.rs`
- `lebo/src-tauri/scoring-core/src/classes/mage.rs`
- `lebo/src-tauri/scoring-core/src/classes/primalist.rs`
- `lebo/src-tauri/scoring-core/src/classes/rogue.rs`
- `lebo/src-tauri/scoring-core/src/classes/acolyte.rs`
- `lebo/src/shared/types/statSheet.ts`

**Modified files:**
- `lebo/src-tauri/Cargo.toml`
- `lebo/src/shared/types/errors.ts`
- `lebo/src/shared/utils/errorNormalizer.ts`
- `lebo/src/shared/stores/optimizationStore.ts`
