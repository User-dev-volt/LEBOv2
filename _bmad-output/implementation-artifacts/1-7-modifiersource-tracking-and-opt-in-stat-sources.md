# Story 1.7: ModifierSource tracking and opt-in stat_sources

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer building attribution,
I want every Modifier to carry a `ModifierSource` surfaced via an opt-in `stat_sources` response field,
so that the UI can show where any stat comes from without a second computation pass or a hot-path cost.

This story adds the **data plumbing** for Stat Source Attribution (FR-12). It is a **backend-first Rust story** in `scoring-core`, plus a small TypeScript type-sync so the `StatSheet` output type stays honest. After this story, the display `compute_stats` call returns `stat_sources: Some(HashMap<StatKey-string, Vec<ModifierSource>>)`; every scan/knapsack/gear/synergy/complete-opt internal call returns `stat_sources: None` and pays zero source-collection cost (Pattern P4-2). The hover tooltip that **renders** this data is **Story 1.8** — do not build it here.

**The defining discipline:** source tracking is *purely additive metadata*. It must not change a single computed stat. Epic 1's frozen-parity gate (`effective_hp`, `damage_score`, `survivability_score`, `speed_score`, `build_score`, and `tests/ehp_reference.rs`) must stay byte-identical whether tracking is on or off. The opt-in flag exists precisely so the hot loops never pay for it (SM-C2 / NFR-9).

## Acceptance Criteria

**AC1 — Opt-in tracking returns populated sources (FR-12)**
- **Given** `ComputeOptions.track_sources == true`
- **When** the display `compute_stats` call runs
- **Then** the returned `StatSheet.stat_sources` is `Some(HashMap<String, Vec<ModifierSource>>)` keyed by the `StatKey` string, where each `ModifierSource` carries `source_type`, `source_label`, `value`, and `modifier_type` (FR-12).
- **And** a stat with no contributing modifiers has **no key** in the map (the map contains only sourced stats — no empty `Vec`s, no dead keys, mirroring the engine's honest-source rule).
- **And** a stat fed by multiple modifiers (e.g. a passive node *and* a blessing both granting Fire Resistance) lists **all** contributing `ModifierSource`s under that one `StatKey` key.

**AC2 — Tracking is off by default; loop paths collect nothing (Pattern P4-2)**
- **Given** any scan / knapsack / gear / synergy / complete-opt internal `compute_stats` (or `build_registry`) call running with `track_sources == false` (the `ComputeOptions::default()` value)
- **When** it runs
- **Then** `StatSheet.stat_sources` is `None` and **no** per-modifier `ModifierSource` is constructed or allocated on that path (Pattern P4-2 — no source collection inside the hot loops).

**AC3 — Source presence reflects active conditions only (honesty)**
- **Given** a conditional modifier whose `Condition` is **not** active under the snapshot's `active_conditions`
- **When** sources are collected with `track_sources == true`
- **Then** that modifier does **not** appear in `stat_sources` (sources are filtered exactly like `ModifierRegistry::query` filters computed values — a source only appears when it actually contributes).
- **And** each `SourceType` is correctly assigned at ingestion: passive nodes → `passive_node`, gear affixes → `gear_slot`, idol affixes → `idol`, blessings → `blessing`.

**AC4 — Frozen-parity gate holds; build stays green (NFR-9, NFR-10)**
- **Given** any build
- **When** `compute_stats` runs with `track_sources == true` vs `false`
- **Then** every computed field is **byte-identical** between the two runs (`offense`, `defense`, `scores`, `attributes`, `ailment`, `minion`, `warnings`) — only `stat_sources` differs (`Some` vs `None`). Source tracking adds no more than 20ms to the round-trip (NFR-9), satisfied by construction: a single pass over the already-built registry, `Vec` append only, no recompute.
- **And** `cargo test -p scoring-core` passes (including the existing orchestrator and `tests/ehp_reference.rs` parity suites — unchanged expected values), `cargo build` is clean, and `pnpm exec tsc --noEmit` stays at exit 0 after the TypeScript type-sync.

## Tasks / Subtasks

- [x] **Task 1 — Add `SourceType` + `ModifierSource` to `modifier.rs` (AC: 1, 3)** — `lebo/src-tauri/scoring-core/src/modifier.rs`
  - [x] Add `pub enum SourceType { PassiveNode, GearSlot, Idol, Blessing, SkillNode, Condition }` with `#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]` and `#[serde(rename_all = "snake_case")]` → serializes as `"passive_node" | "gear_slot" | "idol" | "blessing" | "skill_node" | "condition"`. Define **all six** variants per ADR-P4-D-P4-3 even though only four (`PassiveNode`/`GearSlot`/`Idol`/`Blessing`) are produced today — `SkillNode` and `Condition` are forward-compat, exactly like the unused `Condition::Stacked/Threshold/Composite` variants already in this file. Add a one-line `// Why:` comment noting they are ADR-defined forward-compat (not dead code) so a future reviewer doesn't "clean them up."
  - [x] Add `pub struct ModifierSource { pub source_type: SourceType, pub source_label: String, pub value: f64, pub modifier_type: ModifierType }` with `#[derive(Debug, Clone, Serialize)]`. (No `Deserialize` needed — it is output-only.)

- [x] **Task 2 — Record sources in a gated `ModifierRegistry` (AC: 1, 2, 3)** — `lebo/src-tauri/scoring-core/src/modifier.rs`
  - [x] Add a private field to `ModifierRegistry`: `sources: Vec<(StatKey, ModifierSource)>` (defaults empty via `#[derive(Default)]`, already present). Keep `modifiers` exactly as-is — **do not** change `Modifier` or the existing `add`/`query` signatures (this avoids touching every `Modifier { … }` literal in the parity tests).
  - [x] Add `pub fn add_source(&mut self, stat_key: StatKey, source: ModifierSource) { self.sources.push((stat_key, source)); }`. The **caller** (`build_registry`) decides whether to call it, so this method itself does no gating.
  - [x] Add `pub fn collect_sources(&self, active: &[String]) -> std::collections::HashMap<String, Vec<ModifierSource>>`. It walks `self.sources`, includes an entry **only when** its modifier is active — note `add_source` is only ever called for active-by-construction modifiers in `build_registry` (gear/idol/blessing use `Condition::Always`; nodes carry the node's condition), so the cleanest design is to **record the source alongside the same active check the registry uses** (see Task 3) rather than re-deriving condition here. Group by the **StatKey string key** (Task 5). Return only keys that have ≥1 source.

- [x] **Task 3 — Gate source recording in `build_registry` via `track_sources` (AC: 1, 2, 3)** — `lebo/src-tauri/scoring-core/src/compute/mod.rs`
  - [x] Change `pub(crate) fn build_registry(snapshot, game_data)` → `build_registry(snapshot, game_data, track_sources: bool)`. There are exactly **two** call sites (confirm with a `build_registry(` grep): the orchestrator at `compute/mod.rs:21` (pass `options.track_sources`) and `scan.rs:42` (pass `false`). Update both.
  - [x] In each of the **four** ingestion blocks (nodes `:93-108`, idols `:111-124`, blessings `:127-140`, gear `:144-156`), after the existing `registry.add(Modifier { … })`, add: `if track_sources { registry.add_source(stat_key.clone(), ModifierSource { source_type: SourceType::X, source_label: <label>, value, modifier_type }); }`. This keeps the **String label allocation entirely out of the hot loop** (scan's per-candidate `compute_stats` passes `track_sources == false`) — satisfying Pattern P4-2 and NFR-9 by construction.
  - [x] Labels (best identifier available at ingestion; richer display-name resolution is Story 1.8's render concern, not required here):
    - PassiveNode → `node_id.clone()`
    - Idol → `entry.affix_id.clone()` (`SourceType::Idol`)
    - Blessing → `blessing_id.clone()` (`SourceType::Blessing`)
    - GearSlot → `format!("{}:{}", slot_id, entry.affix_id)` (`SourceType::GearSlot`) — same string already used as the modifier `source`, so it stays consistent.
  - [x] **Per-point nodes:** the node block loops `for _ in 0..point_count`. Record one `ModifierSource` **per point** (matching how the registry stores one `Modifier` per point), so a 3-point node contributing +5 each shows three sources — consistent with how the value aggregates. (Do not pre-multiply; keep it parallel to `add`.)

- [x] **Task 4 — Add `track_sources` to `ComputeOptions` (AC: 2)** — `lebo/src-tauri/scoring-core/src/compute_options.rs`
  - [x] Add `pub track_sources: bool` to the struct. Keep `#[derive(Debug, Clone, Default)]` — `Default` gives `false`, so **every existing `ComputeOptions::default()` caller** (scan, gear, synergy, the `run_optimization` handler, all tests, `tests/ehp_reference.rs`) keeps compiling and stays on the loop path with zero behavior change. Remove the now-stale `// Story 2.2 may add options…` placeholder comment; replace with a short note that `track_sources` is `true` only on the display call (Pattern P4-2).

- [x] **Task 5 — Thread sources through `compute_stats` into `StatSheet` (AC: 1, 4)** — `lebo/src-tauri/scoring-core/src/compute/mod.rs` + `stat_sheet.rs`
  - [x] In `stat_sheet.rs`: add `pub stat_sources: Option<std::collections::HashMap<String, Vec<crate::modifier::ModifierSource>>>` to `StatSheet` (`:242-254`). Update the manual `Default` impl (`:256-268`) to set `stat_sources: None`. Add the `HashMap` import / `ModifierSource` import as needed. Document it: `Some` only when `options.track_sources`; key = StatKey string.
  - [x] In `compute/mod.rs compute_stats` (`:16-89`): rename `_options` → `options`; pass `options.track_sources` into `build_registry`; after the registry is built compute `let stat_sources = if options.track_sources { Some(registry.collect_sources(active)) } else { None };` and set it on the returned `StatSheet`. **Do not** reorder or alter any existing computation — append the field only.
  - [x] **StatKey → String key:** `serde_json` is already a normal dependency of `scoring-core`. Derive the key once via serde so it can never drift from an 80-arm hand-written match: e.g. a private helper `fn stat_key_key(k: &StatKey) -> String { match serde_json::to_value(k) { Ok(serde_json::Value::String(s)) => s, _ => String::new() } }`. `StatKey` has no `#[serde(rename)]`, so this yields the PascalCase variant name (`"FireResistance"`, `"IncreasedDamage"`). Document this so Story 1.8 queries by the same string.

- [x] **Task 6 — Re-export the new types (AC: 1)** — `lebo/src-tauri/scoring-core/src/lib.rs`
  - [x] Add `ModifierSource, SourceType` to the `pub use modifier::{ … }` re-export block (`:20-22`) so the Tauri crate and integration tests can name them.

- [x] **Task 7 — Turn tracking ON for the display command only (AC: 1, 2)** — `lebo/src-tauri/src/commands/scoring_commands.rs`
  - [x] In the `compute_stats` Tauri command (`:8-16`), change the `:15` call to pass `ComputeOptions { track_sources: true, ..Default::default() }`. This is the **only** site in the whole codebase that enables tracking (Pattern P4-2). Leave the `run_optimization` handler's internal `compute_stats` call (`:36-40`) on `ComputeOptions::default()`.

- [x] **Task 8 — Sync the TypeScript `StatSheet` output type (AC: 4)** — `lebo/src/shared/types/statSheet.ts`
  - [x] Add `export type SourceType = 'passive_node' | 'gear_slot' | 'idol' | 'blessing' | 'skill_node' | 'condition'`.
  - [x] Add `export interface ModifierSource { source_type: SourceType; source_label: string; value: number; modifier_type: 'flat' | 'increased' | 'more' | 'conversion' }` (snake_case field names — these mirror Rust serde output; do **not** camelCase them, per project-context rule).
  - [x] Add `stat_sources?: Record<string, ModifierSource[]> | null` to the `StatSheet` interface (`:164-172`). Optional + nullable: the Rust `Option` serializes to `null` on loop paths, and only the display call populates it. **Scope note:** this story only keeps the *type* honest. The store consumer (`optimizationStore`) and the hover tooltip (`StatSourceTooltip`) are **Story 1.8** — do not add them here.

- [x] **Task 9 — Tests (AC: 1, 2, 3, 4)** — `lebo/src-tauri/scoring-core/src/compute/mod.rs` test module
  - [x] `stat_sources_none_by_default`: `compute_stats(..., ComputeOptions::default())` → `sheet.stat_sources.is_none()`.
  - [x] `stat_sources_some_when_tracking`: a single Fire Resistance passive node, `track_sources: true` → `stat_sources` is `Some`; `stat_sources["FireResistance"]` has one `ModifierSource` with `source_type == SourceType::PassiveNode`, `source_label == "<node_id>"`, the right `value`, `modifier_type == ModifierType::Flat`.
  - [x] `stat_sources_groups_multiple_contributors`: a passive node **and** a blessing both granting Fire Resistance → `stat_sources["FireResistance"].len() == 2` with the node's `source_type == passive_node` and the blessing's `== blessing`.
  - [x] `stat_sources_assigns_source_type_per_origin`: one of each (node / gear affix / idol affix / blessing) → asserts each lands with its correct `SourceType`. (Reuse the existing idol/blessing/gear test fixtures in this module.)
  - [x] `stat_sources_excludes_inactive_conditional`: a `Condition::Named("x")` modifier with `active_conditions == []` → its `StatKey` is **absent** from `stat_sources`; with `active_conditions == ["x"]` → present. (Honesty / AC3.)
  - [x] `tracking_does_not_perturb_frozen_aggregates`: run the same heavy snapshot with `track_sources: false` and `true`; assert `offense.damage_score`, `defense.effective_hp`, `scores.*`, `attributes`, `ailment`, `minion`, `warnings` are all equal across the two runs (mirror the existing `story_1_5_stats_do_not_perturb_frozen_aggregates` pattern at `:1288`). Only `stat_sources` differs.
  - [x] `unsourced_stat_has_no_key`: an empty/minimal build with `track_sources: true` → `stat_sources` is `Some` and does **not** contain a key for any unsourced stat (no empty `Vec`s).

- [x] **Task 10 — Verify the full gate (AC: 4)**
  - [x] `cargo test -p scoring-core` (all green, incl. `tests/ehp_reference.rs` parity gate and the orchestrator suite — expected values unchanged).
  - [x] `cargo build` (workspace) clean — confirms the Tauri crate compiles against the new `ComputeOptions` field and re-exports.
  - [x] `pnpm exec tsc --noEmit` → exit 0 (TS type-sync compiles; no consumers broken).

## Dev Notes

### Why this design (read before coding)

The temptation is to add `source_type` to the `Modifier` struct ("attach to every Modifier" per the ADR). **Do not.** `Modifier { … }` literals exist in **six** test modules (`compute/offense.rs`, `ailment.rs`, `attributes.rs`, `minion.rs`, `penetration.rs`, plus `modifier.rs`) — adding a required field forces churn across all of them and bloats the diff right next to the **frozen-parity gate**. Instead, record sources in a **parallel `Vec` inside `ModifierRegistry`**, written **only** by the four `build_registry` ingestion blocks, **gated** on a `track_sources` bool. Benefits:
- **Zero churn** to `Modifier` and its many test literals → parity tests are physically unchanged.
- The **String label allocation never runs in the hot loop** — scan's per-candidate `compute_stats` (`scan.rs:264`) passes `ComputeOptions::default()` → `track_sources == false` → `build_registry` skips `add_source` entirely. This *is* Pattern P4-2, enforced by construction, and is why NFR-9 (≤20ms) holds with margin.
- The ingestion site is the **right place** to build a good `source_label` — it has the `node_id` / `slot_id` / `affix_id` in hand. Post-hoc collection from `Modifier.source` (an ID string) would give weaker labels.

### What `compute_stats` does today (preserve all of it)

`compute/mod.rs:16-89` builds the registry once, then computes offense → penetration scaling → defense → EHP triple → Stable Ward → attributes/ailment/minion sub-sheets → speed → archetype-weighted scores → floor-check warnings, and assembles `StatSheet`. **Your only changes:** rename `_options`→`options`, pass `options.track_sources` to `build_registry`, and append `stat_sources` to the returned struct. Every `compute/*` module reads the registry via `query` (Pattern P4-1) — you add **no** new read path; `collect_sources` reads the registry's own recorded sources, not the snapshot.

`build_registry` (`:91-159`) has four blocks. Each already constructs the `stat_key`, `modifier_type`, and `value` you need for a `ModifierSource` right before `registry.add(...)`. The node block iterates `for _ in 0..point_count` — record one source per point (parallel to `add`).

### Source-tracking contract (ADR-P4-D-P4-3, Patterns P4-1/P4-2)

- `ComputeOptions.track_sources` is `true` **exactly once**: the display `compute_stats` Tauri command (`scoring_commands.rs:15`). Everywhere else — scan, gear, synergy, the `run_optimization` handler, complete-opt (future) — stays on `ComputeOptions::default()` (`false`). [Source: architecture.md#Pattern-P4-2; epics.md#Story-1.7 AC2]
- `stat_sources` is `Option`; loop paths return `None`. Tooltip (1.8) reads `statSheet.stat_sources[statKey]` as a pure render of already-present data — **no second IPC call**, which is how SM-2's 50ms tooltip budget is met. [Source: architecture.md#ADR-P4-D-P4-3, lines 181-204]
- Source attribution is **additive metadata only** — it must never feed `scores`, `effective_hp`, or any computed field. [Source: architecture.md "Source attribution is purely additive metadata", line 655]

### Output-type discipline (project-context rules)

- Rust output structs serialize **snake_case field names** — `source_type`, `source_label`, `modifier_type`, `stat_sources`. The TS mirror must use the same snake_case keys; never camelCase Rust-output field accesses. [project-context.md, rule on StatSheet/OffenseStats snake_case]
- `ModifierType` already serializes lowercase (`"flat" | "increased" | "more" | "conversion"`) via its `#[serde(rename_all = "lowercase")]` — the TS `modifier_type` union must match exactly.
- `compute_stats` returns a `StatSheet` directly (no events). Frontend calls it via `invokeCommand<StatSheet>('compute_stats', { snapshot })` — already wired in `useStatSheet`; this story does not touch the IPC signature or the hook. [project-context.md]

### Scope boundary (do NOT do these here — they are Story 1.8)

- No `StatSourceTooltip.tsx`. No hover wiring. No grouping-by-category UI. No cap-gap annotation.
- No `optimizationStore` change. The store already holds the `StatSheet`; the new field rides along untouched.
- No display-name resolution for labels (IDs are sufficient for 1.7; 1.8 can prettify at render time).
[Source: epics.md#Story-1.8, lines 456-477; Story 1.6 scope note that explicitly defers `StatSourceTooltip` to 1.7-1.8]

### Source tree — files to touch

| File | Change |
|------|--------|
| `scoring-core/src/modifier.rs` | NEW `SourceType`, `ModifierSource`; `ModifierRegistry.sources` field + `add_source` + `collect_sources` |
| `scoring-core/src/compute_options.rs` | EXTEND `track_sources: bool` (keep `Default`) |
| `scoring-core/src/compute/mod.rs` | `build_registry(.., track_sources)`; record sources in 4 blocks; thread `stat_sources` into `StatSheet`; StatKey→String helper; new tests |
| `scoring-core/src/stat_sheet.rs` | EXTEND `StatSheet.stat_sources: Option<HashMap<..>>` + `Default` |
| `scoring-core/src/scan.rs` | UPDATE the one `build_registry(..)` call (`:42`) to pass `false` |
| `scoring-core/src/lib.rs` | Re-export `ModifierSource, SourceType` |
| `src/commands/scoring_commands.rs` | Display `compute_stats` passes `track_sources: true` |
| `src/shared/types/statSheet.ts` | NEW `SourceType`, `ModifierSource`; `stat_sources?` on `StatSheet` |

[Source: architecture.md file map, lines 493-505 (`scoring_commands.rs … compute_stats track_sources wiring`; `modifier.rs … ModifierSource + SourceType`; `stat_sheet.rs … stat_sources: Option<HashMap<..>>`)]

### Testing standards

- Rust unit tests co-locate in the module's `#[cfg(test)] mod tests` — add the source-tracking cases to `compute/mod.rs`'s existing test module (it already exercises the full `compute_stats` round-trip and has node/idol/blessing/gear fixtures to reuse). Engine tests are no-mock, pure-function. [project-context.md]
- The `tests/ehp_reference.rs` parity suite imports `ComputeOptions` and uses `::default()` — your `Default`-derived `false` keeps it compiling and its expected values frozen. Run it; it is the CI parity gate.
- The frontend full suite has a **known pre-existing 14-failure UI baseline** (`SkillTreeCanvas`/`TreeControls`/`AppHeader`/`RightPanel`/`ProviderSelector`/`Settings` — jsdom/Headless-UI/canvas-environment, unrelated). This story adds **no** frontend runtime code (type-only), so it introduces no new TS test failures; the gate for the TS side is `tsc --noEmit` exit 0. [Source: Story 1.6 Dev Agent Record]

### Project Structure Notes

- All stat math stays inside `scoring-core` (pure crate, no Tauri/I/O types) — `ModifierSource`/`SourceType` are plain data, safe to live there. [project-context.md: "never add Tauri/I/O types to the crate"]
- `ComputeOptions` adding a field is backward-compatible by virtue of `#[derive(Default)]`; this is the intended extension point (the placeholder comment in the file anticipated it).
- No new IPC command, no `lib.rs invoke_handler!` change, no new event namespace — this is an output-shape extension of the existing `compute_stats` command.

### References

- [Source: epics.md#Story-1.7 — ModifierSource tracking and opt-in stat_sources, lines 436-454]
- [Source: epics.md#Epic-1 implementation notes, lines 259-263 — `track_sources` on only for the display call (Pattern P4-2); registry-only stat math (Pattern P4-1)]
- [Source: epics.md — FR-12 (line 55), NFR-9/SM-C2 (line 136), AR-4/D-P4-3 (line 158)]
- [Source: architecture.md#ADR-P4-D-P4-3 — Stat Source Attribution: Response Shape & Opt-In Tracking, lines 181-204]
- [Source: architecture.md#Pattern-P4-1 (lines 353-363), #Pattern-P4-2 (lines 366-368)]
- [Source: architecture.md — Cross-cutting "Source tracking vs. hot-path cost", line 75; file map lines 493-505]
- [Source: project-context.md — snake_case Rust output rule (line 48); `compute_stats` returns StatSheet directly (line 57); pure-crate boundary]
- Current code: `compute/mod.rs:16-159` (`compute_stats` + `build_registry`), `modifier.rs:240-282` (`Modifier`/`ModifierRegistry`), `compute_options.rs:1-5`, `stat_sheet.rs:242-268` (`StatSheet` + `Default`), `scoring_commands.rs:8-16`, `scan.rs:38-42` & `:264`, `lib.rs:20-28`, `statSheet.ts:164-172`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- `cargo test --manifest-path lebo/src-tauri/Cargo.toml -p scoring-core` → **130 passed; 0 failed** (incl. 7 new source-tracking tests + `tests/ehp_reference.rs` parity gate, expected values unchanged).
- `cargo build --manifest-path lebo/src-tauri/Cargo.toml` → clean (`Finished dev profile`). Confirms the Tauri crate compiles against the new `ComputeOptions.track_sources` field and `ModifierSource`/`SourceType` re-exports.
- `pnpm exec tsc --noEmit` (from `lebo/`) → **exit 0**. TS type-sync compiles; no consumers broken.

### Completion Notes List

- **Additive-metadata discipline held.** Source tracking is recorded in a parallel `Vec<(StatKey, Condition, ModifierSource)>` inside `ModifierRegistry`, written only by the four `build_registry` ingestion blocks and gated on `track_sources`. `Modifier` and its `add`/`query` signatures are untouched → every parity-test `Modifier { … }` literal is physically unchanged. The new `tracking_does_not_perturb_frozen_aggregates` test asserts `offense`/`defense`/`scores`/`attributes`/`ailment`/`minion`/`warnings` are byte-identical (via serde value equality) between `track_sources` false vs true — only `stat_sources` (None vs Some) differs.
- **AC3 honesty by construction.** Each recorded source carries the modifier's `Condition`; `collect_sources(active)` filters with the same `Condition::is_active` check `query` uses, so inactive conditional sources never appear. (Design note: the story suggested re-using the registry's active check rather than re-deriving condition — storing the `Condition` alongside the source is the cleanest realization of that and is what mirrors `query` exactly.)
- **StatKey→String key** is derived once via `serde_json` in a single canonical `stat_key_key()` helper in `modifier.rs` (placed there, not `compute/mod.rs`, because the consumer `collect_sources` lives in `modifier.rs` and `StatKey` is defined there — keeps module layering clean and avoids an 80-arm match). Yields PascalCase variant names (`"FireResistance"`). Story 1.8 must query by this same string.
- **Pattern P4-2 enforced.** `ComputeOptions::default()` gives `track_sources: false`, so all 60+ existing call sites (scan/knapsack/gear/synergy/`run_optimization`/tests/`ehp_reference.rs`) stay on the loop path with zero source-collection cost. The display `compute_stats` Tauri command (`scoring_commands.rs:15`) is the only site that enables tracking.
- **All six `SourceType` variants defined** per ADR-P4-D-P4-3 (only PassiveNode/GearSlot/Idol/Blessing produced today; SkillNode/Condition are forward-compat) with a `// Why:` comment so a future reviewer doesn't prune them.
- **Scope respected:** no `StatSourceTooltip`, no `optimizationStore` change, no display-name resolution — those are Story 1.8. This story is data-plumbing + a type-only TS sync.

### File List

- `lebo/src-tauri/scoring-core/src/modifier.rs` — NEW `SourceType` enum + `ModifierSource` struct; `stat_key_key()` helper; `ModifierRegistry.sources` field + `add_source()` + `collect_sources()`.
- `lebo/src-tauri/scoring-core/src/compute_options.rs` — added `pub track_sources: bool` (kept `#[derive(Default)]`); replaced stale placeholder comment.
- `lebo/src-tauri/scoring-core/src/compute/mod.rs` — `build_registry(.., track_sources)`; gated source recording in the 4 ingestion blocks; `compute_stats` threads `options.track_sources` and appends `stat_sources`; new import of `ModifierSource`/`SourceType`; 7 new tests.
- `lebo/src-tauri/scoring-core/src/stat_sheet.rs` — `StatSheet.stat_sources: Option<HashMap<String, Vec<ModifierSource>>>` + `Default` impl set to `None`.
- `lebo/src-tauri/scoring-core/src/scan.rs` — updated the one `build_registry(..)` call to pass `false`.
- `lebo/src-tauri/scoring-core/src/lib.rs` — re-exported `ModifierSource, SourceType`.
- `lebo/src-tauri/src/commands/scoring_commands.rs` — display `compute_stats` passes `ComputeOptions { track_sources: true, ..Default::default() }`.
- `lebo/src/shared/types/statSheet.ts` — NEW `SourceType`, `ModifierSource`; `stat_sources?` on `StatSheet`.

## Change Log

| Date | Change |
|------|--------|
| 2026-06-03 | Story 1.7 drafted by create-story context engine. Backend-first `scoring-core`: add `SourceType`/`ModifierSource`, an opt-in `ComputeOptions.track_sources` flag, parallel gated source recording in `build_registry` (no `Modifier` struct change → parity-test literals untouched), `StatSheet.stat_sources: Option<HashMap<StatKey-string, Vec<ModifierSource>>>`, display-only `track_sources: true` at `scoring_commands.rs`, lib re-exports, and a TS `StatSheet` type-sync. Tooltip/store consumption deferred to Story 1.8. Frozen-parity gate must stay byte-identical (NFR-9/Pattern P4-2). Status → ready-for-dev. |
| 2026-06-03 | Story 1.7 implemented (dev-story, claude-opus-4-8). All 10 tasks complete. Added `SourceType`/`ModifierSource` + `stat_key_key()` helper + gated `ModifierRegistry` source log (`add_source`/`collect_sources`) in `modifier.rs`; `track_sources` on `ComputeOptions`; gated recording in `build_registry`'s 4 blocks; `StatSheet.stat_sources` threaded through `compute_stats`; `scan.rs` call updated; lib re-exports; display-only tracking at `scoring_commands.rs`; TS type-sync. 7 new tests cover AC1–AC4 (default-None, tracking-Some, multi-contributor grouping, per-origin SourceType, inactive-conditional exclusion, frozen-parity, no-dead-keys). Gate green: `cargo test -p scoring-core` 130/130, `cargo build` clean, `tsc --noEmit` exit 0. Status → review. |
| 2026-06-04 | Code review (bmad-code-review, 3 adversarial layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 4 ACs PASS, all 10 tasks done, scope respected, no Phase-1 files touched. Gate independently re-run & confirmed green (cargo test 130/130 + ehp_reference 4/4, tsc 0). 1 decision-needed, 1 patch, 4 deferred, 7 dismissed. See Review Findings below. |

## Review Findings — Code Review (2026-06-04)

_3-layer adversarial review (Blind Hunter / Edge Case Hunter / Acceptance Auditor). Acceptance: AC1–AC4 all PASS; gate independently verified green (cargo test 130/130 + ehp parity 4/4, tsc exit 0)._

- [x] [Review][Decision→Resolved] Aggregate/fan-out modifiers are keyed under their raw `StatKey`, not the derived stats they feed [modifier.rs `collect_sources`/`stat_key_key`; compute/defense.rs:84-131; compute/offense.rs:8,60] — A node/affix granting `AllResistances` is recorded only under `"AllResistances"`, but the engine adds that value into each of Fire/Cold/Lightning/Void/Poison/Physical/Necrotic resistance. Same for `IncreasedDamage` (many derived offense stats) and `ElementalPenetration` (per element). **RESOLVED 2026-06-04 → defer to Story 1.8 renderer (Option 1, no 1.7 code change).** Reason: AC1's contract is "key = StatKey string" and the story scopes display resolution to 1.8; keeping the umbrella→derived fan-out logic in one place (the renderer) avoids a second copy that could drift from the engine. **Story 1.8 REQUIREMENT (carry into the 1.8 story):** `StatSourceTooltip` for any element-specific resistance must also surface `AllResistances` (and `AllElementalResistances` if present) sources; likewise `IncreasedDamage`/`ElementalPenetration` tooltips must fold in their umbrella contributors so each tooltip's listed sources reconcile with the displayed stat value.
- [ ] [Review][Patch] Strengthen source-tracking test coverage [scoring-core/src/compute/mod.rs test module] — load-bearing claims are untested: (a) per-point nodes emit one source per allocated point (all node tests use point_count==1, yet "3-point → 3 sources" is the central comment claim); (b) idol & gear sources assert only `source_type`, never `value` or `modifier_type` (the fields most likely to drift from `add`); (c) two same-origin contributors to one stat; (d) optional: assert the false/loop path records nothing rather than only checking the output flag is `None`.
- [x] [Review][Defer] `stat_key_key` silently maps a non-string serde result to `""` [modifier.rs:107-112] — deferred; unreachable today (all `StatKey` are unit variants), fires only if a future `StatKey` gains associated data, silently collapsing unrelated stats under one empty key. Harden (debug_assert/loud-fail) when the StatKey shape changes.
- [x] [Review][Defer] Parallel `modifiers`/`sources` lists must be hand-synced at every ingestion site [modifier.rs:288-335; compute/mod.rs 4 blocks] — deferred; deliberate, documented tradeoff (avoids churning frozen-parity `Modifier` literals), but a future 5th source producer can silently drift. Consider a debug-only invariant check if more producers are added.
- [x] [Review][Defer] `collect_sources` returns a `HashMap` with non-deterministic cross-key order [modifier.rs:320-335] — deferred; harmless now (tests index by key), but Story 1.8 must not rely on key/JSON order — use a BTreeMap or sort if stable output is needed.
- [x] [Review][Defer] No NaN/Inf guard on recorded `value`; serde_json serializes non-finite f64 to `null` [compute/mod.rs source blocks] — deferred; pre-existing serialization behavior across the entire StatSheet (not unique to 1.7), best addressed at game-data ingestion.
