# Deferred Work

## Deferred from: code review of 1-1-game-data-type-extension-and-schema-definition (2026-05-20)

## Deferred from: code review of 1-2-season-4-node-and-class-data-ingestion (2026-05-20)

- `MANIFEST_PATH` is declared and conditionally reassigned in `annotate_s4_nodes.py` but never read by any function — dead variable; cosmetic but misleading for future runners of the script.
- `resolve_tree` hardcodes sub-tree field name (`.get("passiveTree")` / `.get("skillTree")`) instead of using the third path segment `parts[2]` — fragile for future tree key formats; works for all current S4_ADDITIONS entries.
- `modifier_type: Option<String>` in Rust accepts any string value — no type-safety guarantee against invalid values from JSON. Address by replacing with a proper serde enum when Epic 2 scoring begins consuming the field.
- S4 injected nodes use hard-coded pixel coordinates with no spatial collision check against existing nodes. Verify visually when the tree renders; update to real coordinates from lastepochtools.com when placeholder data is replaced.
- `inject_s4_nodes` builds `existing_ids` once before the injection loop — if two entries in S4_ADDITIONS for the same tree share an `id`, both would be appended. Not triggered by current data; guard if S4_ADDITIONS grows.
- `copy_bundled_resources` overwrites any user-fetched remote data on `dataVersion` mismatch — a user on remote patch `1.1.x` would have it silently replaced by S4 bundle data on next app launch. Pre-existing behavior; document or add a merge/prompt strategy in a future data-management story.
- Permanent staleness bar if CDN manifest is not updated to `"Season 4 (Shattered Omens)"` before/simultaneously with the app bundle — `check_data_version` uses pure string equality and can never resolve until CDN is updated. Deployment sequencing concern; track in release checklist.

## Deferred from: code review of 1-3-season-4-affix-and-item-data-ingestion (2026-05-21)

- `classify_scope` ignores `itemSlots` as a secondary scope signal — using slot data (e.g., weapon+gloves → melee) would reduce the 98% generic fallback rate; enhancement beyond spec scope.
- Rust `Option<String>` for `scope`/`modifierType` vs TypeScript literal union types without `| null` — latent type gap if remote data ever omits these fields; `damageType` already correctly allows null; fix by adding `| null` to scope/modifierType TS types when Epic 2 consumes them.
- Stale app-data-dir: `copy_bundled_item_resources` is existence-only (no version check) — upgraded users silently run old data until they manually trigger a remote update; staleness check is the recovery path; address in a future data-management story.
- Script crashes with `KeyError` if an affix entry lacks a `name` field — fails safely (no data corruption, clear traceback); add a guard if data pipeline expands to external/user-supplied sources.
- `itemSlots: []` on 4171/4176 entries creates data asymmetry vs. the 5 annotated RoC entries — future slot-filter code must audit this pre-existing empty-array convention before using `itemSlots` as a filter signal.

## Deferred from: code review of 1-4-new-game-database-files-and-staleness-integration (2026-05-21)

- **Double remote manifest fetch in freshness commands** [`context_data_commands.rs`] — `check_idol_data_freshness` and `check_blessings_data_freshness` each independently call `fetch_remote_manifest`, causing two network requests to the same URL. Batch into a single fetch when wired up in Epic 3.
- **`acknowledgeIdolDataStaleness` doesn't reset flag on re-staleness** [`gameDataStore.ts`] — `setIsIdolDataStale(true)` after acknowledgment leaves `idolDataStaleAcknowledged: true`, hiding the re-appeared indicator. Same flaw for blessings. Pre-existing item data pattern; fix when staleness UI is implemented in Epic 3.
- **Freshness loader functions propagate errors without store state update** [`contextDatabaseLoader.ts:34-42`] — `checkIdolDataFreshness`/`checkBlessingsDataFreshness` have no try/catch; callers must add `.catch()`. Consistent with item pattern; add guards when wired in Epic 3.
- **Triple redundant `copy_bundled_context_resources` calls on each startup** [`context_data_service.rs`] — Three loaders each trigger existence checks independently (9 stat calls). Correct behavior, minor perf waste; consistent with item data service pattern.
- **`versions_behind` hard-coded to 0 or 1** [`context_data_commands.rs:37,57`] — Not a real version distance; consistent with item service convention. Revisit if multi-version upgrade paths are needed.
- **TypeScript narrow union types not validated in Rust** [`context_data.rs`, `contextDatabase.ts`] — `'prefix' | 'suffix'`, `'increased' | 'more' | 'flat'`, `'universal' | 'build-specific'` etc. are Rust `String` fields. Project-wide pattern; low risk with controlled data; no change warranted until Epic 2 scoring consumes these.

## Deferred from: code review of 1-1-game-data-type-extension-and-schema-definition (2026-05-20)

- `as unknown as ReturnType<...>` double-cast in `useOptimizationStream.test.ts` (lines 315, 353, 381, 417) weakens test mock type coverage. Root cause: partial mock objects for `useBuildStore` and `useGameDataStore` don't fully satisfy store return types (likely `schemaVersion: 2 as const` vs `schemaVersion: 1 | 2` union). Fix: make mocks complete or use `satisfies` with `Partial<>`. Deferred as pre-existing; address in a dedicated test-cleanup story.

## Deferred from: code review of 2-1-scoring-engine-foundation-crate-setup-and-type-system (2026-05-21)

- **Open `String` vs closed union at IPC boundary** — `NodeEfficiency.tier`, `SynergyFlag.flag_type`, `SynergyFlag.priority` are `String` in Rust but closed literal unions in TypeScript. No runtime enforcement at the Tauri IPC seam. A Rust value outside the union silently passes TypeScript type-checking. Address with Rust enums + `#[serde(rename_all = "lowercase")]` when IPC is wired in Story 2.4.
- **`slider_position` unbounded `u32`** — `BuildSnapshot.slider_position` accepts full `u32` range; spec documents 0–100. No validation or clamping. Add a constructor guard or `TryFrom` impl when Story 2.2 starts consuming it.
- **`Condition::Composite` unbounded recursion + `Condition` Deserialize** — Composite holds `Vec<Condition>` with no depth limit; `Condition` derives `Deserialize`. If Condition ever comes from user-supplied JSON (future), this is a potential stack-overflow DoS vector. Add a `MAX_CONDITION_DEPTH` guard before any external deserialization is wired.
- **No unit tests in `scoring-core` crate** — `Condition::Stacked.is_active()` contains non-trivial prefix-parsing logic with no test coverage. Add at minimum: `Always`, `Named` hit/miss, `Stacked` boundary cases, `Composite` with always/named sub-conditions, `Threshold` always-false invariant.
- **`Stacked { count: 0 }` footgun** — `count = 0` causes `n >= 0` to always be true for any string of form `{name}_<digits>`. Effectively becomes an unconditional match, not a stack-count gate. Document or add an `assert!(count > 0)` debug assertion when `Stacked` conditions are first constructed with real data in Phase 4.
- **`GearSlotRanking` / `WishlistAffix` not re-exported from `lib.rs`** — Epic 5 types are accessible only via full path `scoring_core::stat_sheet::GearSlotRanking`. Add to `pub use` block in `lib.rs` when Epic 5 begins consuming them.

## Deferred from: code review of 2-2-stage-1-build-score-function-implementation (2026-05-21)

- **`archetype_weights` lookup assumes sorted ascending** — `resolve_archetype_weights` does a first-match-wins scan; if the table is unsorted (e.g. wrong JSON object order from Story 2.4 loader), the wrong weight band is returned silently. Enforce sort or add a debug assertion in Story 2.4's game data loader when the table is constructed.

## Deferred from: code review of 2-3-defensive-floor-check (2026-05-21)

- **`no_sustain_layer` warning `gap: 0.0` has no semantic value** [`compute.rs`] — `current_value: 0.0, gap: 0.0` is uninformative for a boolean check; a renderer using `gap` uniformly (progress bar, percentage) will show 0/0. Deferred to Story 2.5 which defines how warnings are rendered.
- **HP_REGEN sustain threshold boundary not tested** [`compute.rs`] — `floor_check_sustain_via_hp_regen` uses 120.0; the boundary case (exactly 100.0 should pass, 99.9 should warn) is not covered. Low-risk since the formula is simple (`>= 100.0`), but an off-by-one would go undetected. Add boundary tests when revisiting the test suite.

## Deferred from: code review of 2-4-tauri-ipc-wiring-compute-stats-command (2026-05-21)

- **Startup `write().unwrap()` panics on poisoned RwLock** [`lib.rs setup()`] — Pattern inconsistency with `compute_stats` which uses `map_err`; RwLock poison in single-threaded setup is effectively impossible but worth making consistent when touching lib.rs again.
- **Fresh-install silent scoring degradation** [`game_data_loader.rs`] — `ensure_game_data_dir` doesn't call `copy_bundled_resources`; if manifest absent on first install, `load_manifest` returns Err and scoring silently uses empty `GameData` (base stats only). Pre-existing init ordering concern; address in a data-management story.
- **Bare CRIT catch-all in `tags_to_stat_key`** [`game_data_loader.rs`] — Any node tagged `["CRIT"]` alone silently maps to `CriticalStrikeChance`; future crit tag variants that don't match earlier guards will be silently misclassified. Extend with explicit guards as new tag combinations are discovered.
- **Mastery-to-skill affinity context lost** [`game_data_loader.rs`] — Skills inside the mastery loop iterate all class skills, not mastery-scoped ones; `RawSkillEntry.mastery_id` field is ignored. Architectural limitation for future mastery-gated scoring in Epic 4.

## Deferred from: code review of 2-5-typescript-integration-serializer-hook-and-store (2026-05-21)

- **`skillNodeAllocations` inner mutation isolation not tested** [`buildSnapshotSerializer.test.ts:92-97`] — `copies allocations without mutating the original build` test only verifies `nodeAllocations`; the same shallow-copy pattern on `skillNodeAllocations` inner objects is untested. Code is correct; add test when test suite is next touched.
- **All gear affixes classified as `prefixes`; `suffixes` always empty** [`buildSnapshotSerializer.ts:69-76`] — `GearItemV2.affixes` has no prefix/suffix discriminator field, making correct splitting impossible until Epic 3 adds that field. Acknowledged in code comment.

## Deferred from: code review of 3-1-idol-grid-builder-layout-and-placement (2026-05-22)

- Stale `idolGrid` closure in validation handlers — `idolGrid` captured at render time; low practical risk with Zustand reactive selectors and React 18 batching.
- Unknown `idolTypeId` silently skipped in `isOccupiedByAnother` — corrupted PlacedIdol becomes invisible to overlap detection; edge case for saved data; address in 3.2 data validation or a cleanup story.
- `idolSize` field sends full `idolTypeId` string (e.g. `"grand-2x2"`) to Rust — Rust contract for this field not yet defined; intentional scaffolding per comments; revisit in 3.2 when scoring consumes idol placements.
- `applyNodeChange` fallback build construction missing `idolGrid`/`blessings`/`activeConditions` — pre-existing pattern, not introduced by this story.
- Build persistence round-trip for `idolGrid` untested — `buildPersistence.test.ts` does not verify `idolGrid` survives a save/load cycle.

## Deferred from: code review of 3-2-idol-affix-selection-and-stat-contribution (2026-05-22)

- **`prefixTier` undefined risk in placement mode** [`IdolAffixPicker.tsx:useState init`] — If `prefixId` prop is defined but `prefixTier` is undefined on mount, `isConfirmBlocked` passes but `onConfirm` receives `prefixTier: undefined`; serializer silently drops the prefix. Not triggerable in current code paths (configuringNew always initializes without affixes), but latent if callers change.
- **`stat_key_from_str` has 28 arms vs. spec's stated 27** [`game_data_loader.rs:stat_key_from_str`] — Extra arm is harmless (matched but unused); likely spec miscounted. Verify against actual `idol-data.json` when data pipeline is revisited.
- **Empty tier list → empty `values_by_tier` → silent zero contribution** [`game_data_loader.rs:values_by_tier`] — Affix registered with no tier values causes every `values_by_tier.get(&tier)` miss in `compute.rs`; affix silently contributes nothing. Pre-existing game-data quality risk.

## Deferred from: code review of 2-6-stat-sheet-ui-five-tab-display (2026-05-21)

- **`warningGap=0` renders `(+0% needed)`** [`StatSheetPanel.tsx`] — If the scoring engine emits a `StatWarning` with `gap: 0`, the Defense tab renders the warning label in negative color with `(+0% needed)`. A gap of 0 means the resistance is exactly at cap, which should not be warned. Fix the `gap` floor in the scoring engine rather than the display code.
- **RightPanel `shrink-0` layout on small windows** [`RightPanel.tsx`] — The stat sheet container uses `shrink-0` + `maxHeight: 280px`. On short windows the fixed-height gear and stat sections can push the Optimization section (also `shrink-0`) off-screen with no scroll path. Revisit in Epic 6 layout polish — options: `min-h` floor, or collapsible stat sheet section.
