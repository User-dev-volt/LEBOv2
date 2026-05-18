# Deferred Work

## Deferred from: code review of 7-6-optimization-backward-compatibility-and-re-run-clear (2026-05-18)

- `MOCK_BUILD.schemaVersion: 1` in `SuggestionsList.test.tsx:46` is missing `sliderPosition`/`fineTuneWeights` fields — pre-existing fixture, update when migrating tests to v2 shape.
- `derivedSpeed` hardcoded to `0` in `FineTunePanel` (`FineTunePanel.tsx:16`) — pre-existing design from story 7-2; speed weight is always zero in derived mode.
- Same-id build reload does not resync `optimizationStore.sliderPosition` — if a build is replaced in the store with the same id (e.g., export/re-import same build), the `activeBuild.id` guard in `App.tsx:92` returns early and the slider is not resynced. Not a primary workflow; address if re-import flow is added.
- `setActiveBuildFineTuneWeights` in `buildStore` accepts any numeric object with no validation — NaN/Infinity could be persisted to disk. Pre-existing pattern across all buildStore setters; add validation layer if needed.

## Deferred from: code review of 7-5-structured-gear-context-in-optimization-payload (2026-05-18)

- Affix name uses build-stored `a.name` rather than canonical DB entry name (`useOptimizationStream.ts` structuredGear construction): name is written from DB at selection time (via `buildAffixEntries()`) so divergence only occurs if the DB updates after the build was saved. Pre-existing design decision — no action needed unless DB-to-build name sync becomes a product concern.

## Deferred from: code review of 7-4-level-budget-aware-ai-optimization-context (2026-05-18)

- `#[allow(dead_code)]` on `allocated_passive_points` in Rust `LevelContext` struct (`claude_commands.rs:13-14`): field is intentionally accepted from TypeScript per AC1 payload spec but not emitted in the AI prompt string per AC2. Suppressing the warning is acceptable; if the prompt format ever gains an "allocated" line, remove the attribute.
- No test coverage for negative `unspentPassivePoints` over-budget case (`useOptimizationStream.ts:26`): dev notes explicitly acknowledge `i32` to support negative values when a player over-allocates in free theory-craft mode then toggles enforcement on. Add a test with `characterLevel: 3` (1 point) and `nodeAllocations: { n: 5 }` to verify the negative value is passed through without error.

## Deferred from: code review of 7-3-optimization-weight-computation-in-rust-and-prompt-construction (2026-05-18)

- No Rust unit test for `compute_optimization_intent` (`claude_commands.rs:171`): pure function with two branches (slider-only path and fine-tune path) is unverified in isolation. Pre-existing pattern — no Rust unit tests exist in codebase. Add `#[cfg(test)] mod tests` covering at least: slider-only at 0/50/100, fine-tune with sum≠100, fine-tune with negative values.
- `setFineTuneWeights` has no input clamping (`optimizationStore.ts:104`): raw `set({fineTuneWeights: weights})` with no range validation on individual fields. Pre-existing gap from story 7-2; FineTunePanel is responsible for UI-level bounds. Also note: `isFineTuneWeights` validator in `buildPersistence.ts` does not range-check values on disk-load — a persisted `damage: 999` would load unclipped. Fix both when adding validation in a future story.

## Deferred from: code review of 7-2-finetunepanel-component (2026-05-17)

- **AC4 proportional vs delta scaling**: AC4 says "maintain relative ratios" but impl uses additive delta. Must be resolved in story 7-3 alongside Rust weight computation — the scaling semantics are meaningless without knowing how the engine consumes the weights.
- **Weight sum invariant**: damage+survivability+speed can sum to any value (0–300). If Rust engine expects normalized weights (sum=100), the payload is wrong. Normalization strategy deferred to story 7-3.
- `fineTuneWeights` ↔ `buildStore.activeBuild` sync gap: persisted fine-tune weights in a saved build are not pushed into `optimizationStore` after load; `App.tsx` only bridges `nodeAllocations`. Pre-existing architectural gap; likely addressed in story 7-5 or 7-6.
- `handleChange` stale closure risk: reads `fineTuneWeights` from render closure rather than functional `set()` callback; theoretically stale under rapid concurrent updates, low risk for single-focus range slider UI.
- No reset UI for `fineTuneWeights`: once any sub-slider is moved, there is no "Reset to auto" button to return to null; `(Custom)` label persists for the session. Not in ACs; likely a future UX story.
- `isFineTuneWeights` validator in `buildPersistence.ts` does not range-check values: out-of-range persisted weights (damage: 999) load without clamping. Pre-existing; should clamp on load.
- `(Custom)` label persists even if delta-scaled weights happen to equal derived values: no round-trip check to auto-clear `fineTuneWeights` to null. Spec does not require auto-clear.
- Opacity-only panel transition does not animate height; AC1 says "smooth ease-out transition" but dev notes explicitly specify opacity-only. By-design per dev notes; revisit if UX feedback requests height animation.

## Deferred from: code review of 7-1-optimizationslider-component-and-useoptimizationstore-extension (2026-05-17)

- `aria-valuetext` formula only tested at position=50 (symmetric case); a position=30 test would confirm "70% Survivability / 30% Damage" direction is correct — formula is simple so risk is low, but an asymmetric coverage test would give full confidence (`OptimizationSlider.test.tsx`).


## Deferred from: code review of 6-4-phase-2-save-format-and-settings-version-display (2026-05-17)

- Two duplicate `createBuild` paths (`buildStore.ts:74` and `:134`) can drift independently — both now stamp v2 defaults, but there is no single factory; future changes risk re-diverging.
- `initialGameDataState` captured at module evaluation time in `Settings.test.tsx` — if a prior test file in the same Vitest worker mutates the store before this module is evaluated, the reset baseline is dirty.
- Undo stack rehydrates v1-era build snapshots lacking `sliderPosition`/`fineTuneWeights` — `BuildState` declares them optional, so undo into a pre-diff snapshot silently produces undefined for these fields.
- `migrateBuildState` treats `schemaVersion === undefined` as v1 — a v2 build with a corrupted/null version field would be pushed through v1 migration and have its `sliderPosition` replaced by a preset-derived default.
- Early-return guard in `createBuild` (`buildStore.ts:73`) silently no-ops when user selects same class/mastery — prevents resetting to fresh v2 defaults without a class switch.
- Auto-create path in `applyNodeChange` (`buildStore.ts:136`) silently commits `sliderPosition: 50` with no undo path to "no build" — pre-existing undo design, now more consequential with a visible default.

## Deferred from: code review of 6-3-manifest-v2-and-atomic-data-update-pipeline (2026-05-17)

- Concurrent read-modify-write race on `manifest.json`: `update_manifest_icon_source` and `update_item_data` both do load → mutate → atomic_write with no lock; they also share the same `manifest.tmp` path when running concurrently, so the last rename wins and the other's fields are silently lost. Spec accepts this as best-effort (`icon_commands.rs`, `item_commands.rs`).
- No JSON validation on item file downloads before atomic write: `update_item_data` writes raw HTTP response bytes to disk without a `serde_json` parse step. A truncated CDN response atomically replaces a valid file with corrupt data. Contrast with `download_class_files`, which validates before writing. Pre-dates this story (`item_commands.rs`).
- `temp_dir` test helper uniqueness via `subsec_nanos`: potential collision under high parallelism or low-resolution system clocks; `create_dir_all` would silently reuse a dirty directory. Low risk in practice (`game_data_service.rs` tests).

## Deferred from: code review of 6-2-optimization-preset-migration-and-build-persistence-integration (2026-05-17)

- Schema version guard runs after `sharedFields` construction — `crypto.randomUUID()` may fire before the throw; no behavioral impact, just ordering noise (`buildPersistence.ts:68`).
- String `schemaVersion` (e.g., `"2"`) bypasses the v2 branch and falls to v1 migration — strict equality `=== 2` rejects strings; theoretical with normal JSON serialization (`buildPersistence.ts:68-73`).
- v2 passthrough gear arrays cast without structural validation — `ctx!.gear as GearItemV2[]` trusts array contents blindly; same pattern also in 6-1 defer list (`buildPersistence.ts:78`).
- `slotId` empty-string fallback and `itemName` `String()` coercion in v1 gear migration — story 6-1 scope; corrupt data silently becomes blank strings (`buildPersistence.ts:93-95`).
- `AffixEntryV2` blank-name fallback for unrecognized affix shapes — story 6-1 design choice; corrupt affix becomes `{ name: '' }` (`buildPersistence.ts:101-103`).
- v2 builds with stale `goalPreset` field silently drop it — v2 passthrough ignores `goalPreset`; a corrupt v2 build with a stale key would silently default `sliderPosition` to 50 (`buildPersistence.ts:73-85`).

## Deferred from: code review of 6-1-buildstate-v2-typescript-types-and-core-migration-function (2026-05-17)

- `AffixEntryV2.value` intentionally not populated by `buildAffixEntries` — deferred to story 7-5 (structured gear context in optimization payload). `value?: number` can't represent the old min–max range; `affixId + tier` is sufficient to reconstruct full values from the item DB when 7-5 runs. Clarifying comments added to `GearSlot.tsx` and `build.ts` as part of 6-1 review.
- v2 passthrough gear items not structurally validated — `schemaVersion === 2` branch casts gear/skills/idols without field-level validation; a corrupted v2 build passes through silently (`buildPersistence.ts:46-54`). Full validation layer is out of scope for this story; revisit after 6-4 (Phase 2 save format) when the write path is finalised.
- `AffixEntryV2.value` semantics — design decision deferred to story 7-5 (structured gear context in optimization payload). Comment added to `build.ts` and `GearSlot.tsx` marking the field as reserved.
- `GearSlot.test.tsx` hardcodes `tier: 3` — test depends on game data fixture stability. Low risk; revisit when 7-5 touches the GearSlot test suite.
- ~~`characterLevel` has no bounds validation~~ — **FIXED in 6-1 review**: `migrateBuildState` now clamps to `[1, MAX_CHARACTER_LEVEL]`. UI (`BudgetToggle`) was already clamping; disk-load path is now also protected.
- `tier: 0` possible from `medianTier` when tiers array is empty (`GearSlot.tsx:buildAffixEntries`). Story 7-5 (structured gear context in optimization payload) will serialize affix tiers into the AI prompt — a `tier: 0` would produce output like "Health T0 (+0 HP)" which is wrong. Fix `buildAffixEntries` to guard against `tier <= 0` and either omit the tier or clamp to 1 before 7-5 ships.
- `GearItem` kept with no deprecation marker — TODO comment added to `build.ts`. Remove after story 6-4 ships and v1 saves are no longer expected in the wild.

## Deferred from: code review of 5-6-item-data-freshness-check-and-stalenessbar-extension (2026-05-17)

- Partial write leaves mixed-version item DB when network fails mid-loop (`item_commands.rs`). `update_item_data` downloads and commits files sequentially — if the 2nd or 3rd file fails after the 1st is already renamed, the item DB on disk has mixed versions. Fixing requires a two-phase pattern (download all to temp, then rename all). Spec prescribed sequential atomic-per-file; risk is low and banner retries are available.
- `itemDataStaleAcknowledged` never resets after a successful update (`gameDataStore.ts`). After `setIsItemDataStale(false)`, the acknowledged flag remains `true`. If `checkItemDataFreshness` fires again in the same session (currently it doesn't — startup-only), a new stale condition would be silently suppressed. Same structural pattern as the existing game data banner.
- `schemaVersion` bumped from 1 to 2 in `manifest.json` with no migration guard. Old installs with v1 manifests deserialize cleanly via `#[serde(default)]` on the new `item_data_version` field. No active migration path needed unless future code branches on `schemaVersion`.
- TOCTOU: `check_item_data_freshness` and `update_item_data` each fetch the remote manifest independently. A remote release between the two calls could cause the version written to disk to differ from the files downloaded. Inherent to the command-per-operation architecture; cosmetic version mismatch only.
- `versions_behind` in `DataVersionCheckResult` is always 0 or 1 for item data (semver comparison yields no real count). Matches the existing game data check pattern; no regression.
- `http_client()` in `game_data_service.rs` promoted to `pub` for reuse by `item_commands.rs`. Acceptable DRY choice per dev notes; no hidden coupling risk given the single timeout setting.
- `copy_bundled_item_resources` all-or-nothing existence check: once all three item files exist, bundled resources are never refreshed. A prior partial update could leave a mixed-version state that persists forever. Pre-existing behavior; item data freshness check (this story) is the intended remedy.

## Deferred from: code review of 3-3-enforce-level-budget-toggle-and-allocation-enforcement (2026-05-13)

- Budget check in `applyNodeChange` / `applySkillNodeChange` only verifies ≥1 unspent point exists, not that `delta` points are available. A caller passing `delta > 1` could allocate multiple points past the budget ceiling (`buildStore.ts:165`). In practice the UI always passes `delta = ±1`; spec doesn't address multi-delta; fix would add complexity for a theoretical case.

## Deferred from: code review of 4-3-weaver-tree-renderer-conditional-on-research-spike-go (2026-05-14)

- `weaverSearchHighlighted`/`weaverSearchDimmed` memos depend on `weaverGameNodes` Zustand selector reference (`SkillTreeView.tsx`). If any unrelated `gameDataStore` update fires, both memos re-run unnecessarily. Benign in practice (weaverGameNodes set once at startup) — pre-existing project-wide selector pattern.
- `migrateBuildState` for `weaverAllocations` uses object-shape check + type cast without validating individual value types (`buildPersistence.ts`). A corrupted save with string values would produce NaN for unspent point count. Same pattern as all other allocation fields — pre-existing project-wide issue.

## Deferred from: code review of 5-5-custom-affix-addition-and-free-text-fallback (2026-05-17)

- No removal mechanism for individual custom affixes — `customAffixIds` can only grow; only `handleClear` resets the slot entirely (`GearSlot.tsx`). Out of scope for 5.5.
- `excludeIds.includes()` in `AffixPicker` is O(n×m) — a `Set` conversion would give O(1) lookup (`AffixPicker.tsx:22`). With only a handful of excluded IDs in practice this is premature optimization.
- `+ Add affix` button rendered whenever `selectedItem !== null`, even if `itemDatabase` becomes null post-selection — button has no visible feedback when picker can't open (`GearSlot.tsx`). Game-data failure scenario; `selectedItem` can only be set while `itemDatabase !== null` so this requires an in-session reload failure.
- `AffixPicker value={null}` + `immediate` prop — if `onClose` doesn't fire synchronously, Headless UI may re-open the dropdown on the next focus event (`AffixPicker.tsx:29`). Theoretical concurrent-mode edge; all tests pass.

## Deferred from: code review of 5-4-gearslot-component-with-typeahead-item-search (2026-05-16)

- `ComboboxButton` (▾) added to GearSlot without AC coverage — functional but undocumented scope creep (`GearSlot.tsx`). Pre-existing.
- Inline style + Tailwind mixing — `var(--color-bg-elevated)` used for both slot border and dropdown background; border may be invisible when dropdown is open (`GearSlot.tsx`). Pre-existing project-wide pattern.
- Off-by-one tier stale reference if DB hot-reloads while item is selected — `resolvedAffixes` memo updates but `affixTiers` retains old keys, leading to mismatched tier state (`GearSlot.tsx:81–84`). Pre-existing edge case, out of scope for this story.
- `isEmptyContext` `.trim()` throws if `itemName` is null/undefined — schema violation that TypeScript should prevent at compile time (`RightPanel.tsx:40`). Pre-existing project-wide concern.

## Deferred from: code review of 5-1-item-database-load-and-typescript-types (2026-05-14)

- Version staleness: `copy_bundled_item_resources` skips copy if `base-items.json` exists, so updated bundled data after an app upgrade will never overwrite the cached copy (`item_data_service.rs:18`). Story 5.6 handles data freshness; no version/hash mechanism added in this story.
- `AffixEntry.type` TypeScript union includes `'implicit'` but current data only emits `"prefix"` / `"suffix"`; Rust model deserializes `type` as an unvalidated `String`. If future data adds new type values they'll pass through silently.
- No `isLoadingItemDatabase` flag in `gameDataStore` — downstream components (Stories 5.3–5.5) can't distinguish "still loading" from "load failed". Null-handling pattern to be defined when GearSlot is built.
- Concurrent race on `copy_bundled_item_resources`: two simultaneous invocations can both pass the `exists()` guard and interleave writes to the same destination files. Pre-existing pattern in game_data_service; startup fires the command once so race is unlikely in practice.
- Blocking sync I/O (`std::fs::read_to_string`, `serde_json::from_str`) runs on the async Tauri executor without `spawn_blocking`. Pre-existing pattern across all service files in the project.
- `UniqueItem` / `RawUniqueItem` have no `implicitAffixIds` field — unique item implicits silently omitted. Known gap documented in dev notes; source data has implicits as text strings not IDs.

## Deferred from: code review of 4-2-weaver-tree-tab-and-placeholder-component (2026-05-13)

- Magic hardcoded indices (6, 7) for Weaver tab across `SkillTreeView.tsx` and tests — pre-existing pattern used for all other tab indices; no named constant.
- `openPickerForCurrentSlot` latent bug: `safeTabIndex - 1` would yield slot 5 (out-of-range) if Weaver early return is removed. Currently unreachable; guarded by early return.
- Redundant double-guard: `useEffect` at line ~99 resets `activeTabIndex > 6` redundantly with inline clamp at line ~161 — defensive, pre-existing pattern from old tab count guard.
- `handleReset` has no explicit Weaver guard but is implicitly safe because `TreeControls` never renders on the Weaver tab early-return path — fragile implicit dependency if JSX structure changes.

## Deferred from: code review of 5-3-affixtiercontrol-pip-based-tier-selection (2026-05-16)

- Out-of-range `currentTier` crash risk: `affixEntry.tiers[currentTier - 1]` throws if caller passes 0, negative, or > tiers.length. Spec-deliberate — "caller guarantees within [1, tiers.length]"; Story 5.4 GearSlot owns clamping. Add a defensive guard if any runtime crash is observed.
- Gap mismatch: AC #1 says "4px gap" but Dev Notes example and implementation use `gap: 8` (8px). Dev Notes are authoritative; AC text has minor inconsistency. Cosmetic only.
- Missing Home/End key support: WAI-ARIA Authoring Practices slider pattern recommends Home (go to min) and End (go to max) keys. Story only specifies Left/Right. Address in an accessibility polish story post-MVP.
- Inline pip style objects recreated per render: `Array.from` map creates new style object literals every render. Project-wide inline style pattern; benign for small pip counts. Optimize with CSS classes if profiling shows cost.
- No `userEvent.setup()` in tests: tests use v14+ legacy direct API. Tests pass. Project-wide concern to address in bulk test refactor.
- `width: 40` overflow risk: the 40px monospace span may silently clip very large tier value strings. Spec-specified value. Acceptable for current Last Epoch affix data range.
- `aria-valuemin={1}` hardcoded: assumes all affix tier numbering starts at 1. Current data always uses 1-based tiers; theoretical type concern if future data changes.

## Deferred from: code review of 4-1-weaver-tree-research-spike (2026-05-13)

- Official wiki (wiki.lastepoch.com) returned ECONNREFUSED — may be a transient outage rather than permanently offline. A future spike or re-evaluation should retry this source.
- "Duel Destruction / Dual Destruction" node name ambiguity in partial catalog — two different names from different guides for the same node; not flagged as a data quality issue in the report.
- "Low-value node" / "endgame node" labels in node catalog are editorial judgments without a cited source.
- Musholic repo version discrepancy — story spec referenced v0.11.0 (2026-04-02), WebFetch during spike returned v0.12.0 (April 2025); current actual version is uncertain. Verify at next epic boundary.
- prowner/last-epoch-data is unlicensed (all-rights-reserved by default) — legal risk not discussed. Moot under NO-GO but relevant if data becomes available.
- Re-evaluation triggers for Story 4.3 (Musholic repo, community dump, lastepochtools API) have no assigned process owner or check schedule. Risk of unplanned Story 4.3 restart mid-sprint.
- Echo point total is approximate (~40 from echoes). Story 4.3's Weaver point counter will need a plan for detecting when EHG patches echo reward values — the point formula is not versioned in the current `gameVersion` staleness system.
- Weaver node prerequisites: the Weaver Tree likely has node prerequisite relationships; Story 4.3 will need to decide whether to implement prerequisite validation logic (analogous to passive tree prerequisite checking in `applyNodeChange`).
