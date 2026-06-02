# Story 1.1: ModifierType enum migration and compute module split

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer extending the scoring engine,
I want `ModifierType`/`scope`/`position` migrated to serde enums and `compute.rs` split into the `compute/` submodule layout,
so that full stat parity (Stories 1.2–1.5) can be added module-by-module on a type-safe foundation without one unmaintainable file.

This is **Gate 2 (D-P4-1)** of Phase 4 — a prerequisite for *all* `compute/*` stat-engine work. It is a pure type-tightening and structural refactor: **no new stat is computed in this story.** It also performs the **Story-0 error-normalizer setup** (`CHARACTER_IMPORT_ERROR`) that every later import/scoring IPC story depends on.

## Acceptance Criteria

**AC1 — `ModifierType` / `scope` / `position` deserialize as serde enums (closes the data-gate)**
- **Given** game data stores `modifierType` and `scope` as lowercase strings,
- **When** game data is loaded,
- **Then** they map into `ModifierType { Flat, Increased, More, Conversion }` and a `Scope` enum (`Melee | Ranged | Spell | Minion | Generic`), both with `#[serde(rename_all = "lowercase")]`,
- **And** an unknown or absent `modifierType` defaults to `ModifierType::Increased`, preserving the Phase 3 fallback contract (FR-A6), verified by an existing-data regression test that loads every shipped class JSON and asserts no load failure and the same effect count as before.
- **And** the affix prefix/suffix discriminator is represented by an `AffixPosition { Prefix, Suffix }` enum (`rename_all = "lowercase"`, default `Prefix`), replacing the `affix_class: String` field.

**AC2 — `compute.rs` is split into the `compute/` submodule layout, behavior unchanged**
- **Given** the `compute.rs` monolith,
- **When** the split is complete,
- **Then** `compute/mod.rs` exposes the single `compute_stats(snapshot, game_data, options) -> StatSheet` entry, and the eight submodule files (`offense`, `penetration`, `defense`, `ehp`, `ward`, `ailment`, `attributes`, `minion`) exist (empty scaffolds for the not-yet-implemented ones),
- **And** the `compute_stats` IPC contract and the Tauri command signature are byte-for-byte unchanged,
- **And** all Phase 3 formula-regression tests still pass with identical numeric results.

**AC3 — Error normalizer Story-0 setup; no raw-string branching on the migrated discriminators**
- **Given** the error-normalization layer,
- **When** this story completes,
- **Then** `SCORING_ERROR` remains mapped and a `CHARACTER_IMPORT_ERROR` entry is added to `ErrorType` (`errors.ts`) and to both maps in `errorNormalizer.ts`,
- **And** branching on raw `modifier_type` / `scope` / `affix_class` **strings** no longer exists anywhere in `scoring-core` (all such decisions compare enum variants).

## Tasks / Subtasks

- [x] **Task 1 — Migrate `ModifierType` and add `Scope` / `AffixPosition` enums in `scoring-core/src/modifier.rs`** (AC: 1, 3)
  - [x] Extend `ModifierType`: add the `Conversion` variant; add `#[serde(rename_all = "lowercase")]`; derive `Copy` and `Default` with `#[default]` on `Increased` (`#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]`). Adding `Copy` is safe — existing `.clone()` calls on `ModifierType` still compile.
  - [x] Add a single tolerant constructor `impl ModifierType { pub fn from_data_str(raw: Option<&str>) -> Self }` — case-insensitive match on `"flat" | "more" | "conversion" | "increased"`, **any unknown or `None` → `Increased`**. This is the *one* place the fallback contract lives. (Direct serde deserialization handles the strict-lowercase paths; `from_data_str` handles the tolerant boundary the loader uses.)
  - [x] Add `pub enum Scope { Melee, Ranged, Spell, Minion, Generic }` — `#[serde(rename_all = "lowercase")]`, `#[derive(... Default)]` with `#[default] Generic`, plus `Scope::from_data_str(Option<&str>) -> Self` (unknown/None → `Generic`). Add a helper `Scope::matches_delivery(&self, primary: Option<Scope>) -> bool` that returns `true` for `Generic` (preserves today's `scope == "generic"` short-circuit) or when it equals `primary`.
  - [x] Add `pub enum AffixPosition { Prefix, Suffix }` — `#[serde(rename_all = "lowercase")]`, `#[derive(... Default)]` with `#[default] Prefix`, plus `AffixPosition::from_data_str(Option<&str>) -> Self` (unknown/None → `Prefix`, matching today's "absent → prefix" behavior).
  - [x] Export the two new enums from `lib.rs` (`pub use modifier::{... Scope, AffixPosition}`), alongside the existing `ModifierType` re-export.
- [x] **Task 2 — Replace `String` discriminator fields in `scoring-core` data structs** (AC: 1, 3)
  - [x] `game_data.rs`: `GearAffixData.affix_class: String` → `affix_class: AffixPosition`; `GearAffixData.scope: String` → `scope: Scope`; `GameData.affix_scope: HashMap<String, String>` → `HashMap<String, Scope>`.
  - [x] `gear.rs`: change `passes_delivery_filter(scope: &str, primary_delivery: Option<&str>)` to take `scope: Scope` (use `Scope::matches_delivery`); replace `data.affix_class == "prefix"` / `== "suffix"` with `== AffixPosition::Prefix` / `Suffix`; update the in-file `#[cfg(test)]` fixtures (lines ~297–361) from `"prefix".to_string()` / `"melee".to_string()` to the enum variants.
  - [x] **Decision — `BuildSnapshot.primary_offense_delivery_type`:** it is `Option<String>` deserialized from the TS serializer (camelCase). Recommended: migrate to `Option<Scope>` so `passes_delivery_filter` compares `Scope` to `Scope`, deserialized via the lowercase serde. This requires the snapshot to tolerate an unrecognized string → use `#[serde(default, deserialize_with = "...")]` returning `None`/`Generic` rather than erroring (a hard error here would break live scoring on bad input). If the tolerant-deserialize wiring is non-trivial, the acceptable fallback is to keep the field `Option<String>` and convert at the `passes_delivery_filter` call site via `Scope::from_data_str(snapshot.primary_offense_delivery_type.as_deref())`. **Either way, no `&str` scope comparison may remain inside `gear.rs`'s logic.** Note: `primary_offense_damage_elements: Vec<String>` stays `Vec<String>` — element names are an open set, not a closed union; out of scope.
- [x] **Task 3 — Route the loader through the typed boundary** (AC: 1, 3)
  - [x] `src-tauri/src/services/game_data_loader.rs`: delete the local `fn parse_modifier_type(...)` and replace its two call sites + the node path with `ModifierType::from_data_str(...)`. The raw Tauri-side models (`models/game_data.rs`, `models/item_data.rs`) keep their `modifier_type: Option<String>` / `scope: Option<String>` JSON-landing fields — conversion to the typed enum happens once, here at the boundary.
  - [x] Where the loader assigns `affix_class` / `scope` into `GearAffixData` and `affix_scope`, convert via `AffixPosition::from_data_str(...)` / `Scope::from_data_str(...)`. (`RawAffix.affix_type` — the `#[serde(rename = "type")]` field — is the prefix/suffix source; `RawAffix.scope` is the scope source.)
  - [x] Update the seeded-unique builder and any other loader literals to the enum variants where they touch `affix_class`/`scope`.
- [x] **Task 4 — Split `compute.rs` → `compute/` modules** (AC: 2)
  - [x] Rename `scoring-core/src/compute.rs` to `scoring-core/src/compute/mod.rs`. `lib.rs`'s `pub mod compute;` and `pub use compute::compute_stats;` are unchanged — Rust resolves `compute/mod.rs` automatically, and `scan.rs`'s `use crate::compute::{build_registry, compute_stats};` path still resolves. Keep `build_registry` as `pub(crate)` in `mod.rs`.
  - [x] In `mod.rs`, declare the submodules: `mod offense; mod penetration; mod defense; mod ehp; mod ward; mod ailment; mod attributes; mod minion;`.
  - [x] Move `compute_offense` → `compute/offense.rs`; move `compute_defense` + `run_floor_check` + `find_slot_with_open_suffix` → `compute/defense.rs`. Make the moved fns `pub(super)` and update `mod.rs` call sites (`offense::compute_offense(...)`, `defense::compute_defense(...)`). Keep `compute_speed`, `resolve_archetype_weights`, `build_registry`, and the `compute_stats` orchestrator in `mod.rs`. Move the shared `DAMAGE_STAT_KEYS` const next to its only user (`offense.rs`) or keep it `pub(super)` in `mod.rs` — pick whichever avoids an unused-import warning (strict mode treats those as errors).
  - [x] Create the six remaining files (`penetration.rs`, `ehp.rs`, `ward.rs`, `ailment.rs`, `attributes.rs`, `minion.rs`) as scaffolds. A scaffold is a file with a short module doc comment stating its future FR ownership and **no executable code** (or a `//! TODO Story 1.x` only) — they must not be dead code that trips `noUnused`-equivalent Rust warnings. Do not declare a submodule you leave entirely empty if it produces an `unused module` style warning; a doc-comment-only file is fine.
  - [x] Relocate the `#[cfg(test)] mod tests` block (currently lines ~502–end of `compute.rs`). Keep offense/defense-specific tests beside their moved code where it reads naturally; orchestrator-level tests (full `compute_stats` round-trips) stay in `mod.rs`. Every test must still compile and pass unchanged — do not alter expected values.
- [x] **Task 5 — Error normalizer Story-0 setup** (AC: 3)
  - [x] `lebo/src/shared/types/errors.ts`: add `'CHARACTER_IMPORT_ERROR'` to the `ErrorType` union.
  - [x] `lebo/src/shared/utils/errorNormalizer.ts`: add `CHARACTER_IMPORT_ERROR: 'CHARACTER_IMPORT_ERROR'` to `ERROR_TYPE_MAP` and a user-facing string to `USER_MESSAGES` (e.g. `'Character import failed. Check the save file or try again.'`). `USER_MESSAGES` is a `Record<ErrorType, string>`, so a missing entry is a TS compile error — adding the union member forces this.
  - [x] No Rust `character_import.rs` exists yet (Epic 7) — do **not** create it. This is TypeScript-only Story-0 plumbing so the error type is ready when Epic 7 lands.
- [x] **Task 6 — Verify** (AC: 1, 2, 3)
  - [x] `cargo test -p scoring-core` (run from `lebo/src-tauri/`) — all Phase 3 regression + new enum tests green.
  - [x] `cargo build` for the Tauri crate (loader + models compile against the new enum field types).
  - [x] `pnpm build` and `pnpm vitest` (from `lebo/`) — TS strict compile passes with the new `ErrorType` member; add/extend an `errorNormalizer` test asserting a raw string containing `"CHARACTER_IMPORT_ERROR"` normalizes to that type.

## Dev Notes

### What this story is — and is NOT
- **IS:** a type migration (3 stringly-typed discriminators → serde enums) + a file→module refactor + TS error-enum plumbing. Pure foundation. **Zero behavior change.** Every existing numeric result and every existing test must remain identical.
- **IS NOT:** any new stat computation. The six scaffold modules (`penetration/ehp/ward/ailment/attributes/minion`) are created empty here and filled by Stories 1.2–1.5. Do not implement penetration, EHP, ward, ailments, attributes, or minion math in this story. If you find yourself writing a formula, stop — wrong story.

### Critical reality check (the architecture's wording is loose here)
The architecture (ADR-P4-D-P4-1) describes migrating `modifier_type` "from `Option<String>`." **In `scoring-core` it is already the enum `ModifierType { Increased, More, Flat }`** — it just lacks `Conversion`, `Default`, `Copy`, and `rename_all`. The actual `Option<String>` lives in the **Tauri-side raw models** (`src-tauri/src/models/game_data.rs:20`, `models/item_data.rs:21,23`) and is converted to the enum manually by `parse_modifier_type` in `game_data_loader.rs:211`. So:
- The migration's real win is **consolidating the string→enum mapping into one typed constructor** (`from_data_str`) that includes `Conversion`, and **converting the remaining `String` discriminators** (`scope`, `affix_class`) that are *not* yet enums.
- `scoring-core`'s `compute.rs`/`scan.rs` already compare the `ModifierType` enum with `==`, never strings — so AC3's "no raw-string branching in scoring-core" is *already true for modifier_type*; the live string branches to eliminate are in **`gear.rs`** (`affix_class == "prefix"`, `scope == "generic"`).

### Adding the `Conversion` variant is safe
There is **no exhaustive `match` on `ModifierType` anywhere in `scoring-core`** (verified across `compute.rs`, `scan.rs`, `gear.rs`, `synergy.rs`, `modifier.rs`). All usage is `m.modifier_type == ModifierType::X` filters and struct-literal construction. Adding `Conversion` therefore introduces no non-exhaustive-match compile errors. `Conversion` will simply never match the existing `Increased`/`More`/`Flat` filters — which is correct (no consumer handles conversion yet; that's a later story's stat).

### Source tree — exact files to touch
- `lebo/src-tauri/scoring-core/src/modifier.rs` — `ModifierType` extension; new `Scope`, `AffixPosition` enums + `from_data_str` constructors. (Current `ModifierType` at lines 77–82.)
- `lebo/src-tauri/scoring-core/src/game_data.rs` — `GearAffixData.affix_class/scope` and `GameData.affix_scope` field types (lines 8–24, 129–133).
- `lebo/src-tauri/scoring-core/src/gear.rs` — `passes_delivery_filter` signature + the `affix_class`/`scope` comparisons (lines 66–100, 144–158) and the test fixtures (297–361, 373).
- `lebo/src-tauri/scoring-core/src/lib.rs` — add `Scope`, `AffixPosition` to the `pub use modifier::{...}` line (currently line 20).
- `lebo/src-tauri/scoring-core/src/compute.rs` → `compute/mod.rs` + 8 submodule files.
- `lebo/src-tauri/src/services/game_data_loader.rs` — remove `parse_modifier_type`; route through `ModifierType::from_data_str` + the scope/position constructors (call sites at lines 29, 51, 99, 127, 149, 195, 213; seeded uniques at 389+).
- `lebo/src/shared/types/errors.ts` and `lebo/src/shared/utils/errorNormalizer.ts` — `CHARACTER_IMPORT_ERROR`.

### Module-split target (mechanical move, not a rewrite)
```
scoring-core/src/
  compute.rs                  → DELETE (renamed to compute/mod.rs)
  compute/
    mod.rs        compute_stats() orchestrator + build_registry() [pub(crate)]
                  + compute_speed() + resolve_archetype_weights() + orchestrator tests
    offense.rs    compute_offense() [moved]  — FR-1,2,3,4 land here in Story 1.2
    defense.rs    compute_defense() + run_floor_check() + find_slot_with_open_suffix() [moved] — FR-5 in 1.3
    penetration.rs  scaffold — FR-4 (Story 1.2)
    ehp.rs          scaffold — FR-6 (Story 1.4)
    ward.rs         scaffold — FR-7 (Story 1.4)
    ailment.rs      scaffold — FR-8 (Story 1.5)
    attributes.rs   scaffold — FR-9 (Story 1.5)
    minion.rs       scaffold — FR-10 (Story 1.5)
```
`compute_stats` currently (lines 7–35) calls `compute_offense`, `compute_defense`, `compute_speed`, `resolve_archetype_weights`, `run_floor_check`. After the move it calls `offense::compute_offense(...)` and `defense::compute_defense(...)`; the others stay local. The `StatSheet { offense, defense, scores, ailment: None, minion: None, warnings }` shape is unchanged — `ailment`/`minion` stay `None` (their `Option` slots are filled in Story 1.5).

### Project structure & conventions (from project-context.md — must follow)
- **`scoring-core` is a pure crate**: no Tauri, no I/O, no serde-camelCase output. Outputs are snake_case (serde defaults). The new enums use `rename_all = "lowercase"` for *input* (game-data strings), which is the existing pattern for game-data deserialization.
- **No barrel/`mod.rs` re-export sprawl** on the TS side does not apply to Rust module files; `compute/mod.rs` is idiomatic and required here.
- TypeScript strict mode (`noUnusedLocals`/`noUnusedParameters`) — no unused imports. Rust side: keep `cargo build` warning-clean; an unused private fn or module after the move is a problem to fix, not ignore.
- Commands run from the correct root: `cargo` from `lebo/src-tauri/`, `pnpm` from `lebo/`. Package manager is **pnpm**, never npm/yarn.

### Deferred-work items this story closes (cite in completion notes)
Per epics.md AR-1, this migration closes four standing items in `_bmad-output/implementation-artifacts/deferred-work.md`:
1. `modifier_type: Option<String>` accepts any string — no type safety (review of 1-2, line 9).
2. TypeScript narrow union types (`'prefix'|'suffix'`, `'increased'|'more'|'flat'`) not validated in Rust (review of 1-4, line 30).
3. Open `String` vs closed union at the IPC boundary (review of 2-1, line 38).
4. `affix_class` and `scope` use unvalidated strings as branch discriminators (review of 5-2, line 127).

### Testing standards (from project-context.md)
- Rust: `cargo test -p scoring-core`. Co-locate new enum tests in `modifier.rs`'s `#[cfg(test)]` block. Required new tests: lowercase serde round-trip for each enum (`serde_json::from_str("\"more\"")` → `ModifierType::More`); `from_data_str(None)` → `Increased` / `Generic` / `Prefix`; `from_data_str(Some("GARBAGE"))` → same defaults (case-insensitive + unknown fallback); and an **existing-data regression**: load each shipped `resources/game-data/classes/*.json` through the loader and assert effect counts match pre-migration (proves the fallback contract is preserved across real data).
- The Phase 3 formula-regression tests already embedded in `compute.rs` (now split across `mod.rs`/`offense.rs`/`defense.rs`) are the parity gate — they must pass with **byte-identical expected values**. Changing any expected number means you altered behavior, which this story forbids.
- TS: extend `errorNormalizer`'s test (or add one) asserting a raw string containing `CHARACTER_IMPORT_ERROR` → `{ type: 'CHARACTER_IMPORT_ERROR' }`, mirroring the existing `SCORING_ERROR` coverage pattern.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — user story + 3 AC blocks.
- [Source: _bmad-output/planning-artifacts/epics.md#L262] — Epic 1 ownership: AR-1, AR-3, Story-0 `SCORING_ERROR` reuse.
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-P4-D-P4-1] — `ModifierType` enum migration, `rename_all="lowercase"`, `Default` Increased, scope/position by same pattern, "closes four deferred-work items."
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-P4-001] — `compute/` module split layout (1:1 FR-to-module mapping); `compute/mod.rs` keeps the single `compute_stats` entry; IPC contract unchanged.
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Summary #9,#10] — Story-0 `CHARACTER_IMPORT_ERROR`/`SCORING_ERROR` setup; never branch on raw strings.
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — `ModifierType`/`scope` enum migration rules; `ErrorType` ↔ Rust prefix mapping; scoring-core purity; allocation/registry rules.
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs:77-82] — current `ModifierType`.
- [Source: lebo/src-tauri/scoring-core/src/compute.rs:7-35,121,207,389,419] — orchestrator + fn boundaries to split.
- [Source: lebo/src-tauri/scoring-core/src/gear.rs:66-100,144-158] — live `affix_class`/`scope` string branches to migrate.
- [Source: lebo/src-tauri/src/services/game_data_loader.rs:191-219] — `parse_modifier_type` to replace.
- [Source: lebo/src/shared/utils/errorNormalizer.ts:3-30] — `ERROR_TYPE_MAP` + `USER_MESSAGES` to extend.

### Project Structure Notes
- The file→module rename keeps every public path stable (`crate::compute::compute_stats`, `crate::compute::build_registry`), so no other `scoring-core` module or the Tauri command layer needs import changes — verify `scan.rs:7` still compiles untouched.
- The enum field-type changes in `game_data.rs` ripple into `gear.rs` and `game_data_loader.rs` only; `compute.rs`'s `build_registry` reads `effect.modifier_type` (already enum) and is unaffected by the scope/position changes.
- No conflict with the four-store / no-router / IPC rules — this story touches only Rust scoring-core, the Rust loader, and two TS error files.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code dev-story workflow)

### Debug Log References

- `cargo test -p scoring-core` → 65 passed, 0 failed (new enum tests + all Phase 3 formula-regression tests, byte-identical expected values).
- `cargo build -p scoring-core` → warning-clean (no unused imports/modules under Rust strict hygiene).
- `cargo test -p lebo` → Tauri crate compiles against the new enum field types; new `shipped_class_json_effect_count_is_stable` regression test passes (179 effects across all 5 shipped class JSONs). One **pre-existing, unrelated** failure: `openrouter_service::tests::models_list_has_four_entries` (file untouched by this story; asserts the OpenRouter `MODELS` list length).
- `pnpm build` → TS strict compile passes; `USER_MESSAGES` Record completeness enforced the new `CHARACTER_IMPORT_ERROR` member.
- `pnpm vitest run errorNormalizer.test.ts` → 25 passed (incl. new `CHARACTER_IMPORT_ERROR` test).
- Full `pnpm vitest`: 14 pre-existing UI-component test failures (AppHeader, RightPanel, ProviderSelector, Settings, SkillTreeCanvas, TreeControls). **Proven pre-existing** — identical 14 failures with the Story-1.1 TS changes stashed. None touch the migrated error-type code.

### Completion Notes List

- **AC1** — `ModifierType` now derives `Copy, Eq, Default` (`#[default] Increased`) with `#[serde(rename_all = "lowercase")]` and the new `Conversion` variant; added `Scope { Melee, Ranged, Spell, Minion, Generic }` (default `Generic`) and `AffixPosition { Prefix, Suffix }` (default `Prefix`). Each has a tolerant, case-insensitive `from_data_str(Option<&str>)` constructor (unknown/`None` → the variant's default), the single home of the FR-A6 fallback. Existing-data regression test loads every shipped class JSON through the loader's parser and asserts a stable effect count (179) — proving the fallback contract holds across real data. (All shipped `modifierType` values are lowercase `flat|increased|more`, so the count is unchanged by the migration.)
- **AC2** — `compute.rs` split into `compute/mod.rs` (orchestrator `compute_stats`, `build_registry` [pub(crate)], `compute_speed`, `resolve_archetype_weights`, orchestrator round-trip tests) + `offense.rs` (`compute_offense` + `DAMAGE_STAT_KEYS`) + `defense.rs` (`compute_defense` + `run_floor_check` + `find_slot_with_open_suffix` + floor consts) + six doc-comment scaffolds (`penetration/ehp/ward/ailment/attributes/minion`). Public paths (`crate::compute::compute_stats`, `crate::compute::build_registry`) unchanged — `scan.rs`/`synergy.rs`/lib re-exports untouched. `StatSheet` shape (`ailment: None, minion: None`) unchanged. All Phase 3 formula tests pass with identical expected values.
- **AC3** — Added `CHARACTER_IMPORT_ERROR` to the `ErrorType` union, `ERROR_TYPE_MAP`, and `USER_MESSAGES`. Eliminated all raw-string discriminator branching in `scoring-core`: `gear.rs` (`affix_class == "prefix"`, `scope == "generic"`) and `synergy.rs` (`scope == "generic" || scope == primary_str`) now compare enum variants via `AffixPosition`/`Scope::matches_delivery`. The loader's local `parse_modifier_type` was deleted in favour of `ModifierType::from_data_str`.
- **Decision (Task 2)** — `BuildSnapshot.primary_offense_delivery_type` kept as `Option<String>` (the story's documented acceptable fallback); converted to `Scope` at the `gear.rs` call site via `Scope::from_data_str`, so no `&str` scope comparison remains in `gear.rs` logic and live scoring tolerates unrecognized input (→ `Generic`) without erroring.
- **Deferred-work items closed (per epics.md AR-1):** the four standing items in `deferred-work.md` re: unvalidated `modifier_type`/`affix_class`/`scope` strings and open-vs-closed-union IPC discriminators are now resolved by the serde-enum migration.
- **No new stat computed** — pure type-tightening + structural refactor, as scoped.

### File List

- `lebo/src-tauri/scoring-core/src/modifier.rs` (modified) — `ModifierType` migration; new `Scope`, `AffixPosition` enums + `from_data_str`/`matches_delivery`/`as_str`; new `#[cfg(test)]` enum tests.
- `lebo/src-tauri/scoring-core/src/game_data.rs` (modified) — `GearAffixData.affix_class: AffixPosition`, `scope: Scope`; `GameData.affix_scope: HashMap<String, Scope>`; import update.
- `lebo/src-tauri/scoring-core/src/gear.rs` (modified) — `passes_delivery_filter(scope: Scope, primary: Option<Scope>)`; enum comparisons; call-site `Scope::from_data_str` conversion; test fixtures → enum variants.
- `lebo/src-tauri/scoring-core/src/synergy.rs` (modified) — `affix_scope` consumed as `Scope`; `DeliveryType::to_scope()` + `Scope::matches_delivery`/`as_str` replace raw-string branch; test fixture → enum variants.
- `lebo/src-tauri/scoring-core/src/lib.rs` (modified) — re-export `Scope`, `AffixPosition`.
- `lebo/src-tauri/scoring-core/src/compute.rs` (deleted) — renamed into the `compute/` module.
- `lebo/src-tauri/scoring-core/src/compute/mod.rs` (added) — orchestrator + `build_registry` + `compute_speed` + `resolve_archetype_weights` + submodule declarations + orchestrator tests.
- `lebo/src-tauri/scoring-core/src/compute/offense.rs` (added) — `compute_offense` + `DAMAGE_STAT_KEYS`.
- `lebo/src-tauri/scoring-core/src/compute/defense.rs` (added) — `compute_defense` + `run_floor_check` + `find_slot_with_open_suffix` + floor consts.
- `lebo/src-tauri/scoring-core/src/compute/penetration.rs` (added) — scaffold (FR-4, Story 1.2).
- `lebo/src-tauri/scoring-core/src/compute/ehp.rs` (added) — scaffold (FR-6, Story 1.4).
- `lebo/src-tauri/scoring-core/src/compute/ward.rs` (added) — scaffold (FR-7, Story 1.4).
- `lebo/src-tauri/scoring-core/src/compute/ailment.rs` (added) — scaffold (FR-8, Story 1.5).
- `lebo/src-tauri/scoring-core/src/compute/attributes.rs` (added) — scaffold (FR-9, Story 1.5).
- `lebo/src-tauri/scoring-core/src/compute/minion.rs` (added) — scaffold (FR-10, Story 1.5).
- `lebo/src-tauri/src/services/game_data_loader.rs` (modified) — removed `parse_modifier_type`; routed through `ModifierType::from_data_str`; `affix_scope` typed as `HashMap<String, Scope>`; added existing-data regression test module.
- `lebo/src/shared/types/errors.ts` (modified) — `CHARACTER_IMPORT_ERROR` added to `ErrorType`.
- `lebo/src/shared/utils/errorNormalizer.ts` (modified) — `CHARACTER_IMPORT_ERROR` added to `ERROR_TYPE_MAP` and `USER_MESSAGES`.
- `lebo/src/shared/utils/errorNormalizer.test.ts` (modified) — added `CHARACTER_IMPORT_ERROR` normalization test + coverage-list entry.

## Change Log

| Date | Change |
|------|--------|
| 2026-06-02 | Story 1.1 implemented: migrated `ModifierType`/`Scope`/`AffixPosition` to serde enums with tolerant `from_data_str` constructors; replaced all raw-string discriminator branching in `scoring-core` (gear.rs, synergy.rs, loader); split `compute.rs` into the `compute/` submodule layout (offense + defense moved, six scaffolds added) with behavior unchanged; added Story-0 `CHARACTER_IMPORT_ERROR` TS plumbing. Status → review. |
