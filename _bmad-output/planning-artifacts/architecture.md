---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-19/addendum.md'
  - '_bmad-output/project-context.md'
workflowType: 'architecture'
project_name: 'LEBOv2'
user_name: 'Alec'
date: '2026-05-19'
scope: 'brownfield-partial — Rust scoring engine, TypeScript↔Rust IPC surface, data ingestion pipeline'
---

# Architecture Decision Document — LEBOv2 Phase 3 (Partial)

_Brownfield addendum — existing architecture unchanged. This document covers only the three new subsystems called out in the skill invocation: (1) Rust scoring engine module, (2) TypeScript ↔ Rust IPC surface for scoring commands, (3) data ingestion pipeline._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements (scoped to three subsystems):**

Epic A (28 FRs) defines a 6-stage deterministic scoring pipeline: Build Score Function → Defensive Floor Check → Passive Tree Efficiency Scan (Dijkstra, O(N log N)) → Budget Knapsack Solver (greedy + DP) → Gear Affix Scorer (skill-role-aware) → Cross-Domain Synergy Detector. Claude's role is narrative-only — suggestion list, priority order, and delta values are entirely deterministic from the engine (FR-A23–A25).

Epic G (5 FRs) requires Season 4 data ingestion plus two critical schema fields absent from the current game data: `modifierType` (increased/more/flat) and `scope`/delivery type on affix entries. Source confirmed as lastepochtools.com community DB (OQ-1/OQ-2 resolved). Three new game databases are also needed: idol database, blessings database, conditions metadata.

FR-B7 requires all stat sheet values to recompute on every state change: node click, affix tier change, idol placement, condition toggle, character level change, skill level change.

**Non-Functional Requirements driving architecture:**

- NFR-1: Full scoring pipeline (defensive floor + passive scan + gear scoring + synergy) < 100ms
- NFR-2: Stat sheet recalculation on any single state change < 16ms
- NFR-4: All stat values and scoring weights data-driven — no numeric constants in source code
- NFR-5: Scoring engine structured for pluggable class-specific modules (Paradox Class readiness)
- NFR-8/9: Damage formula and defensive floor check have dedicated unit tests; formula regression fails CI

**Scale & Complexity:**

- Complexity: **High** — Dijkstra + DP knapsack in Rust, new IPC surface, new data schema fields, three new game databases, pluggable class module system
- Primary domain: Rust backend + Tauri IPC
- Phase 3 stat calculator depth: approximately "PoB circa 2016" — correct for the core damage loop, missing ailment DPS, conditional modifiers, damage conversions, and full derivation chains. **The calculator will need to grow substantially to match top-tier tools.**

### Technical Constraints & Dependencies

- **Data availability gate:** The scoring engine cannot produce correct results until Epic G is complete. `modifierType` is the most critical field — without it, every modifier defaults to `"increased"`, making `"more"` modifier nodes (the highest-value nodes in LE) score identically to `"increased"` nodes.
- **Brownfield IPC constraint:** All new Tauri commands must follow the existing `invokeCommand<T>()` pattern and be registered in `lib.rs invoke_handler!`. No new IPC patterns.
- **Stat display vs. optimization:** The full 6-stage pipeline (NFR-1: <100ms) is only invoked on an explicit "Optimize" trigger. Stat sheet display (NFR-2: <16ms) needs only Stage 1 (Build Score Function) — the cheapest computation in the pipeline.

### Cross-Cutting Concerns Identified

1. **IPC latency budget vs. correctness** — resolved in favour of debounced Rust IPC (see §IPC Strategy below)
2. **Modifier model extensibility** — the single most load-bearing architectural decision; drives all future stat complexity
3. **Data schema forward-compatibility** — Epic G must produce a schema that Phase 4 can extend without full re-ingestion
4. **Condition model extensibility** — conditions panel must be data-driven, not hardcoded, to survive Season patches

---

## Scoring Engine Bedrock — Foundational Decisions

### The Core Architectural Tension

NFR-2 (<16ms stat display) and the PRD's mandate of Rust-side computation appear to conflict. They don't — but only if the IPC strategy and computation scope are chosen correctly.

**Key insight:** The stat sheet does not need the full 6-stage pipeline. It needs only Stage 1 (Build Score Function). Stage 1 Rust computation takes ~0.3ms. Tauri IPC overhead on target hardware: ~1–3ms. Total per state change: **~1.5–3.5ms** — well within 16ms for single events.

The real constraint is **rapid successive state changes** (e.g., `Shift+click` allocating multiple nodes, FR-F10). Firing one IPC call per allocation in a multi-node sequence serializes them, potentially approaching the 16ms ceiling. Additionally, as the stat calculator grows toward PoB-level complexity (ailment DPS, conditional modifiers, damage conversions), Stage 1 computation will no longer be ~0.3ms.

### IPC Strategy Decision

**Chosen: Path C — Debounced rAF + Rust IPC**

State changes accumulate within a 16ms window. At each `requestAnimationFrame` boundary, if state changed, exactly one Rust IPC call fires with the latest build snapshot. Rust returns computed stats; display updates at the next frame.

```
State change (t=0ms)  → mark dirty
State change (t=3ms)  → mark dirty (supersedes)
State change (t=9ms)  → mark dirty (supersedes)
rAF fires  (t=16ms)   → one invokeCommand('compute_stats', latestSnapshot)
Rust returns (~t=19ms) → StatSheet → display updates
```

**Why not Path B (direct IPC per change):** Works for Phase 3's simple computation but breaks as stat complexity grows toward PoB levels (50–200ms computations). Debounce is free architectural insurance.

**Why not Path A (TypeScript mirrors Stage 1):** Creates two implementations of the same formula. Divergence is silent — displayed stats drift from the optimizer's internal numbers, eroding player trust.

**Why not WASM:** Solves the latency problem but adds wasm-pack toolchain, Vite WASM plugin, and Tauri 2 asset loading complexity. Only warranted if Path C proves insufficient after measurement.

**Upgrade path:** If Path C shows lag under heavy computation (Phase 4+), upgrade to **Path E — Persistent Rust Channel Worker**. A long-lived Rust worker thread receives build state diffs over a Tauri 2 `Channel`, pushes `StatSheet` updates back as they complete. This eliminates per-call spawn overhead and pipelines state changes. The TypeScript debounce layer is unchanged; only the Rust side gains a persistent worker. This upgrade requires no TypeScript architectural changes.

### The Modifier Registry — The Load-Bearing Foundation

The single most critical architectural decision. Every stat calculator that has been painted into a corner made the same mistake: treating stat computation as a formula rather than a data transformation.

**The wrong approach:**
```rust
// Works for Phase 3, breaks when conditionals arrive
fn compute_damage(build: &BuildSnapshot) -> f64 {
    build.base_damage * (1.0 + build.increased_pct) * build.more_multiplier
}
```

**The right approach — a Modifier Registry:**

Every source (passive node, affix, idol, blessing, condition toggle) registers its modifiers into a central collection before any computation runs. Each modifier is a struct:

```rust
pub struct Modifier {
    pub stat_key:      StatKey,       // e.g. StatKey::IncreasedDamage
    pub modifier_type: ModifierType,  // Increased, More, Flat, Conversion
    pub value:         f64,
    pub condition:     Condition,     // see Condition enum below
    pub source:        SourceId,      // NodeId, AffixId, BlessingId, etc.
}

pub struct ModifierRegistry {
    modifiers: Vec<Modifier>,
}

impl ModifierRegistry {
    pub fn query(&self, stat: StatKey, active_conditions: &[Condition]) -> Vec<&Modifier> {
        self.modifiers.iter()
            .filter(|m| m.stat_key == stat && m.condition.is_active(active_conditions))
            .collect()
    }
}
```

Computation becomes: build the registry from the snapshot, query by stat key, apply in sequence. Adding ailment stacking (Phase 4) means adding `StatKey::BleedDpsPerStack` and `ModifierType::AilmentStacking` — the registry absorbs them with zero changes to existing computation logic.

### The `Condition` Enum — Designed for Growth

Phase 3 conditions are simple named toggles. The enum is defined now for Phase 4's conditional modifiers:

```rust
pub enum Condition {
    Always,
    Named(String),                            // Phase 3: "on_boss", "power_charges_3"
    Stacked { name: String, count: u32 },     // charge count thresholds
    Threshold { stat: StatKey, above: f64 },  // "if crit_chance > 0.50"
    Composite(Vec<Condition>),                // "A AND B"
}
```

Phase 3 only uses `Always` and `Named`. The remaining variants are defined but not instantiated — zero dead code, zero runtime cost, full extensibility for Phase 4 conditional mechanics ("while channeling", "if recently used flask").

**Conditions panel is data-driven:** Available conditions are read from a game data file, not hardcoded in the React component. New Season conditions are added via a data update, not a code change.

### The `compute_stats` Function — Pure and Tauri-Free

The scoring engine lives in its own Rust crate (`scoring-core`) with no Tauri dependencies:

```rust
// scoring-core/src/lib.rs — no tauri, no async, no side effects
pub fn compute_stats(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    options:   ComputeOptions,
) -> StatSheet
```

**Why purity matters:**
- Unit tests need no mocking — call the function with a snapshot, assert on the output
- WASM compilation is possible with no changes if IPC latency ever becomes a problem
- The optimization scan (Stage 3) calls this function in a tight loop across hundreds of candidate paths — pure functions parallelize trivially with `rayon`

### The `StatSheet` — Designed for `Option<T>` Expansion

```rust
pub struct StatSheet {
    pub offense:  OffenseStats,
    pub defense:  DefenseStats,
    pub scores:   ScoreComponents,
    pub ailment:  Option<AilmentStats>,   // None in Phase 3; populated Phase 4
    pub minion:   Option<MinionStats>,    // None unless active minion skills present
    pub warnings: Vec<StatWarning>,       // "fire_resistance_uncapped", etc.
}
```

`Option<T>` slots are the expansion joints. Phase 3 returns `None` for `ailment` and `minion`. Phase 4 populates them. TypeScript renders `null` gracefully — it already handles optional display sections. No contract break, no migration.

### The `ClassModule` Trait — Paradox Class Readiness (NFR-5)

```rust
pub trait ClassModule: Send + Sync {
    fn class_id(&self) -> ClassId;
    fn apply_modifiers(
        &self,
        registry: &mut ModifierRegistry,
        snapshot: &BuildSnapshot,
    );
    fn compute_class_stats(
        &self,
        base:     &StatSheet,
        snapshot: &BuildSnapshot,
    ) -> Option<ClassStats>;
}
```

Phase 3 ships five class modules (Sentinel, Mage, Primalist, Rogue, Acolyte) implementing this trait. Paradox Classes (Orobyss expansion) are new structs implementing the same trait, registered at startup. The engine's `compute_stats` function never changes — it calls `module.apply_modifiers()` before building the registry, then `module.compute_class_stats()` after the base sheet is computed.

---

## Data Ingestion Pipeline — Foundational Schema

### The Schema Gap (Epic G Prerequisite)

Current game data files (classes/{classId}.json, item database) are missing two fields required by the scoring engine:

| Field | Missing From | Required For | Phase 3 Source |
|---|---|---|---|
| `modifierType` | Passive nodes + affixes | Stage 1 damage formula, Stage 3 efficiency scoring | lastepochtools.com community DB |
| `scope` / delivery type | Affixes | Stage 4 gear affix scorer (FR-A19) | lastepochtools.com community DB |

These gaps block all scoring engine work. Epic G data ingestion is the critical path dependency.

### Forward-Compatible Affix Schema

Designed now to survive Phase 4 additions with only field population, not schema migration:

```json
{
  "affixId":       "melee_crit_chance",
  "statKey":       "crit_chance",
  "modifierType":  "increased",
  "scope":         "melee",
  "damageType":    null,
  "condition":     null,
  "ailmentType":   null,
  "valuePerTier":  [4, 8, 12, 16, 20, 24, 28]
}
```

`condition`, `damageType`, and `ailmentType` are `null` in Phase 3 output. Phase 4 ingestion populates them from the community DB as they become available. No re-ingestion of the full dataset required — only new/changed records need updating.

### Three New Game Databases

Following the existing staleness-check pattern (manifest.json tracks version, staleness flags in `gameDataStore`):

| Database | File | Staleness flags |
|---|---|---|
| Idol grid + affix database | `idol-data.json` | `isIdolDataStale`, `idolDataStaleAcknowledged` |
| Blessings database | `blessings.json` | `isBlessingsDataStale`, `blessingsDataStaleAcknowledged` |
| Conditions metadata | `conditions.json` | sourced from game data — not network-stale |

`conditions.json` defines available simulation conditions and their display labels. It is bundled with the app and updated on app releases, not via the network staleness pipeline — conditions change with patches, not player-initiated updates.

---

## Foundation — Brownfield Stack & Crate Structure

Existing stack unchanged: Tauri 2 / React 19 / TypeScript 5.8 / Vite 7 / Zustand 5 / PixiJS 8. All patterns from `project-context.md` apply. No new frontend dependencies. One new Rust dependency: `rayon`.

### ADR-001: Cargo Workspace Layout

**Decision: Separate workspace crate (`src-tauri/scoring-core/`)**

`src-tauri/Cargo.toml` becomes a workspace root with two members: `.` (the existing Tauri crate, unchanged) and `scoring-core` (new pure Rust crate).

```
src-tauri/
  Cargo.toml              ← workspace root: members = [".", "scoring-core"]
  src/                    ← Tauri crate (unchanged)
    lib.rs
    scoring_commands.rs   ← new: Tauri command handlers only
    game_data_loader.rs   ← new: disk → GameData construction
    ...existing modules...
  scoring-core/
    Cargo.toml            ← deps: serde, serde_json, rayon only — NO tauri, NO tokio
    src/
      lib.rs
      modifier.rs
      build_snapshot.rs
      stat_sheet.rs
      game_data.rs
      compute.rs
      scan.rs
      gear.rs
      synergy.rs
      class_module.rs
      classes/
        sentinel.rs
        mage.rs
        primalist.rs
        rogue.rs
        acolyte.rs
```

**Rejected: inline module** (`src-tauri/src/scoring/`) — purity is convention-only; compiler does not enforce it. Silent drift under deadline pressure breaks the WASM and unit-test guarantees.

**Rejected: top-level workspace** — adds complexity without benefit; Vite and Cargo toolchains are independent.

### ADR-002: Module Boundaries

**`scoring-core` owns — pure computation, no Tauri:**

| Module | Responsibility |
|---|---|
| `modifier.rs` | `Modifier`, `ModifierType`, `Condition`, `ModifierRegistry` |
| `build_snapshot.rs` | `BuildSnapshot` — player state as IDs only (node IDs, affix IDs, tiers, idol placements, blessings, active conditions, level, class, mastery, slider) |
| `game_data.rs` | `GameData` — read-only reference tables (node effects, affix value-per-tier tables, tree graph, class definitions) |
| `stat_sheet.rs` | `StatSheet` and all sub-types (`OffenseStats`, `DefenseStats`, `ScoreComponents`, `Option<AilmentStats>`, `Option<MinionStats>`, `Vec<StatWarning>`) |
| `compute.rs` | `compute_stats(snapshot, game_data, options) -> StatSheet` — Stage 1 only, fast path |
| `scan.rs` | `run_efficiency_scan(snapshot, game_data) -> Vec<NodeEfficiency>` — Stages 2–3, uses rayon internally |
| `gear.rs` | `run_gear_scoring(snapshot, game_data) -> GearAnalysis` — Stage 4 |
| `synergy.rs` | `run_synergy_detection(snapshot, game_data) -> Vec<SynergyFlag>` — Stage 5 |
| `class_module.rs` | `ClassModule` trait definition |
| `classes/` | Five class module implementations |

**Tauri crate owns — IPC wiring only:**

| Module | Responsibility |
|---|---|
| `scoring_commands.rs` | `#[tauri::command]` handlers that call `scoring_core::*` |
| `game_data_loader.rs` | Reads JSON from disk → constructs `scoring_core::GameData`; held in `AppState`, loaded once at startup |

**Key boundary rule:** `BuildSnapshot` contains IDs only — not resolved data. `GameData` is the resolution table. `compute_stats` resolves IDs internally. `GameData` is loaded once at startup, held in Tauri `AppState`, passed by reference — zero per-call disk I/O.

### ADR-003: Parallelism Primitive

**Decision: `rayon` inside `scoring-core`; `spawn_blocking` at the Tauri command boundary for the full optimization run**

The Stage 3 efficiency scan is embarrassingly parallel: each node's path computation is fully independent. Sequential estimate on a 150-node tree: ~52ms — within NFR-1 (100ms) but with no headroom as computation grows in Phase 4. `rayon` provides ~4× speedup on a 4-core machine (~13ms) with zero async overhead.

```rust
// scan.rs — pure sync, rayon parallelism
let efficiencies: Vec<NodeEfficiency> = unallocated_nodes
    .par_iter()
    .map(|node| compute_node_efficiency(node, &snapshot, &game_data))
    .collect();
```

Two Tauri command shapes:

```rust
// Fast path — stat sheet only (~2ms total). Sync: no spawn_blocking needed.
#[tauri::command]
fn compute_stats(
    snapshot: BuildSnapshot,
    state: tauri::State<'_, AppState>,
) -> Result<StatSheet, String> {
    let game_data = state.game_data.read().unwrap();
    Ok(scoring_core::compute_stats(&snapshot, &game_data, ComputeOptions::default()))
}

// Full optimization — all 6 stages (~15–50ms). Async: spawn_blocking keeps tokio event loop free.
#[tauri::command]
async fn run_optimization(
    snapshot: BuildSnapshot,
    state: tauri::State<'_, AppState>,
) -> Result<OptimizationResult, String> {
    let game_data = state.game_data.read().unwrap().clone();
    tokio::task::spawn_blocking(move || {
        scoring_core::run_full_optimization(&snapshot, &game_data)
    })
    .await
    .map_err(|e| e.to_string())?
}
```

`scoring-core` is entirely synchronous — no async primitives inside the crate. The async boundary lives only in `scoring_commands.rs`. `rayon` and `spawn_blocking` compose cleanly: `spawn_blocking` moves computation off the tokio thread; `rayon` handles internal CPU parallelism.

**Rejected: `tokio::spawn_blocking` loops per node** — tokio is I/O-bound async infrastructure, not a CPU parallelism primitive. 150 `spawn_blocking` calls per scan = excessive task scheduling overhead.

**Rejected: sequential scan** — acceptable for Phase 3 but leaves no headroom. As `compute_stats` grows more complex in Phase 4, sequential cost multiplies directly into the NFR-1 budget.
