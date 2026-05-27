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

## Deferred from: code review of 3-3-blessings-panel (2026-05-22)

- **Search filtering leaves stale select value when selected blessing is filtered out** [`BlessingsPanel.tsx:53-65`] — When a search term filters out the currently-selected blessing, the `<select>` has no matching `<option>` and browsers snap it to blank. No data corruption; UX confusion only. Fix: inject the selected option into the filtered list regardless of search term, or clear search on selection.
- **`Modifier` in `build_registry` may be missing `source: blessing_id.clone()`** [`compute.rs:~78`] — Spec says to include `source: blessing_id.clone()` but the diff only shows four fields. Code builds, suggesting `source` may have a default. Verify `Modifier` struct definition and confirm source field behavior before Epic 4.
- **Rust test `blessing_fire_resistance_contributes` fragile if base stats non-zero** [`compute.rs:~1234`] — Test asserts `fire_resistance == 18.0` but `snapshot_at(50)` may initialize non-zero resistance from base stats. If baseline is non-zero the assertion fails; if it passes coincidentally the test provides false confidence.

## Deferred from: code review of 3-4-conditions-panel (2026-05-22)

- **Auto-clear writes `false` for all stale condition types** [`ConditionsPanel.tsx`] — `setConditionValue(id, false)` is correct for all current build-specific entries (all toggles), but structurally wrong for `range`/`select` types — those would receive a `boolean false` instead of their defaultValue. No current data is affected. Add a `clearConditionValue` store action that removes the key when non-toggle build-specific conditions are added.
- **Universal-category entries with a `filter` field bypass filter logic** [`ConditionsPanel.tsx`] — `if (entry.category === 'universal') return true` early-returns before checking `filter`. No current data has universal entries with filters, so no impact. Add a guard if the data schema evolves to allow this combination.

## Deferred from: code review of 2-6-stat-sheet-ui-five-tab-display (2026-05-21)

- **`warningGap=0` renders `(+0% needed)`** [`StatSheetPanel.tsx`] — If the scoring engine emits a `StatWarning` with `gap: 0`, the Defense tab renders the warning label in negative color with `(+0% needed)`. A gap of 0 means the resistance is exactly at cap, which should not be warned. Fix the `gap` floor in the scoring engine rather than the display code.
- **RightPanel `shrink-0` layout on small windows** [`RightPanel.tsx`] — The stat sheet container uses `shrink-0` + `maxHeight: 280px`. On short windows the fixed-height gear and stat sections can push the Optimization section (also `shrink-0`) off-screen with no scroll path. Revisit in Epic 6 layout polish — options: `min-h` floor, or collapsible stat sheet section.

## Deferred from: code review of 4-1-passive-tree-efficiency-scan-dijkstra-knapsack-solver (2026-05-22)

- **Small result sets (n < 4) assign no "gold" tier** [`scan.rs:138-139`] — `n/4 = 0` for n < 4 nodes, so the best candidate in a small result set is labeled "dim" instead of "gold". Extremely unlikely in practice (LE passive trees have hundreds of nodes), but the rounding means the top-25% intent breaks down at small n. Fix with `(n / 4).max(1)` if needed.
- **Zero-cost nodes (max_points=0) corrupt knapsack DP chosen table** [`scan.rs:solve_knapsack`] — If game data contains a node with `max_points=0`, Dijkstra assigns it cost=0, and the DP loop `for w in (0..=cap).rev()` iterates every weight with `c=0`, overwriting all prior `chosen` rows. In practice LE passive nodes have `max_points >= 1`.
- **BFS mastery depth assumes first node in passive_tree.nodes is the mastery entry node** [`game_data_loader.rs:73`] — Documented assumption in dev notes ("verified: void-knight-passive-entry is always index 0"). If game data ordering changes, depth values would be wrong. Consider validating or documenting the ordering guarantee more explicitly.

## Deferred from: code review of 4-2-cross-domain-synergy-detection (2026-05-22)

- **`affix_scope` always empty at runtime** [`game_data_loader.rs:165`] — `detect_mismatched_affixes` never fires in production until a future story populates the affix DB from JSON. Intentional per story spec; revisit in Epic 5 affix scoring work.
- **`GameData` clone per unique in `detect_game_changers`** [`synergy.rs:262`] — O(n) deep clones of `node_effects` per unique; acceptable for 3-item Phase 3 seed. Profile if unique count grows past ~20 in Phase 4.
- **Proxy node ID collision unenforced** [`synergy.rs:261`] — `__unique__{item_id}` namespace prefix assumed collision-free by convention. Add a debug_assert or scan in game_data_loader if real game IDs ever use `__` prefix.
- **Exsanguinous seeded with `Flat` modifier for `WardPerSecond`** [`game_data_loader.rs:393`] — Inconsistent with loader's guard that drops flat-ward passive nodes, but documented as intentional Phase-3 approximation. Revisit when full item DB is parsed.
- **"critical" priority rank undefined in synergy sort** [`synergy.rs:74`] — If Story 4.3 produces "critical" floor-check flags and merges them with synergy flags using the same sort, they land at priority 0 alongside "game_changer" (correct by coincidence). Story 4.3 should define the merged sort explicitly.

## Deferred from: code review of 4-3-run-optimization-tauri-command-and-claude-narrative (2026-05-22)

- **`startOptimization` no in-flight guard for concurrent invocations** [`useOptimizationStream.ts`] — UI "Optimize" button disabled via `isOptimizing` state is the only gate; concurrent double-submit (e.g. via keyboard) could interleave two suggestion streams. Pre-existing pattern; same race existed with `invoke_claude_api`.
- **NaN `delta_build_score` causes non-deterministic game-changer sort** [`scoring_commands.rs, assemble_run_optimization_payload`] — `partial_cmp + unwrap_or(Equal)` is standard Rust float sort; NaN in scoring output is a scoring-core engine bug, not a 4.3 issue.
- **OpenRouter errors use `claude_service::OptimizationErrorPayload` type** [`scoring_commands.rs`] — Cross-module coupling; identical pattern from `invoke_claude_api`; refactor both together if claude_service is restructured.
- **Gear suffix affixes never serialized — detect_mismatched_affixes misses suffix-side** [`buildSnapshotSerializer.ts`] — Acknowledged in code comment; no `prefix/suffix` discriminator on `GearItemV2`; address in Epic 5 affix scoring work.
- **Level-0/1 builds: baseline_score == 0 triggers detect_game_changers early-return** [`synergy.rs`] — Pre-existing engine edge case; these builds have no game-changer suggestions. Intentional by coincidence (divide-by-zero guard doubles as degenerate-build guard).


## Deferred from: code review of 4-5-stat-sheet-suggestion-preview-hover-deltas (2026-05-24)

- **`isComputingStats` read from hook subscription, not `.getState()`** [`SuggestionsList.tsx:handleHoverEnter`] — `activeBuild` and `gameData` already use `.getState()` for freshness; `isComputingStats` uses the hook closure (1-render-stale window). Spec dev notes acknowledge this race as acceptable for AC3. Align with `.getState()` pattern if concurrent mode is adopted.
- **`clearSuggestions()` resets store but does not cancel `previewAbortRef`** [`optimizationStore.ts + SuggestionsList.tsx`] — In-flight hover IPC can write `previewStatSheet` back after suggestions are cleared. Benign in practice (`statSheet` is also null so `deltas` never renders), but a minor orphan write. Cancel the ref in the `clearSuggestions` action or in the component's cleanup.
- **AC5 `previewAbortRef` guard pattern untested** [`SuggestionsList.test.tsx`] — The stale-hover-cancellation logic (hover A → hover B before A resolves → A discarded) has no automated test. Requires Promise resolution control (e.g., deferred Promise fixtures). Add when async test infrastructure is mature enough to support it.

## Deferred from: code review of 5-2-gear-affix-scorer-rust-implementation (2026-05-24)

- **`affix_class` and `scope` use unvalidated strings** [`gear.rs`, `game_data.rs`] — Both fields are used as branch discriminators (`== "prefix"`, `== "generic"`) but are plain `String`. A typo in game data (e.g. `"Prefix"`, `"MELEE"`) causes silent misdirection: wrong wishlist bucket or zero weight. Convert to enums at deserialization time when the affix DB pipeline is built in a future story.

## Deferred from: code review of 5-1-skill-role-designation (2026-05-24)

- **`analyzeError` stale across build switch** [`GearOptimizationView.tsx:9`] — `analyzeError` useState is never reset when `activeBuild` changes; if a user triggers an analysis error on build A, loads build B, and returns to gear-optimization, the error from build A persists. Spec acknowledges this pattern as optional polish ("not required for AC compliance"). Fix with a `useEffect` watching `activeBuild` to clear the error on build change.
- **`aria-label` on disabled role buttons uses slot label var** [`SkillRoleDesignator.tsx:52`] — For empty slots, `aria-label` reads `"Primary role for Skill 2"` (slot display name) instead of something like `"Primary role for empty slot"`. Minor a11y polish.
- **`handleAnalyzeGear` clears error before async work begins** [`GearOptimizationView.tsx:18`] — `setAnalyzeError(null)` fires before the IPC call in Story 5.3. When wired, there will be a gap where no error or loading indicator is shown. Add a loading state guard in Story 5.3 when the real command is wired.

## Deferred from: code review of 4-4-node-efficiency-overlay-on-passive-tree (2026-05-23)

- **Listener unmount race condition (unlisten1-5)** [`useOptimizationStream.ts`] — async gap between `await listen()` and `if (!isMounted)` check can write to store on an unmounted component. Pre-existing pattern across all 5 listeners; not isolated to 4.4.
- **`from_node = path[0]` for multi-hop knapsack paths** [`scoring_commands.rs, assemble_run_optimization_payload`] — In cheapest-first paths, `path[0]` is a bridge allocation node, not a deallocation source; sending it as `from_node_id` to Claude is conceptually misleading. Pre-existing code; not introduced by 4.4.
- **Overlay rings stack on top of suggestion glow rings** [`pixiRenderer.ts`] — A Claude-suggested node can simultaneously carry an efficiency tier ring and a suggestion glow ring; both draw on the same node. Minor visual noise.
- **<= 2ms frame-render AC unverifiable** [`pixiRenderer.ts, renderTree()`] — No instrumentation or test asserts render time. O(N) circle strokes by design; add a `performance.now()` guard or DevTools profiling session if jank is reported.

## Deferred from: code review of 5-3-run-gear-scoring-tauri-command-and-typescript-wiring (2026-05-24)

- **`priority_slot` may be empty string in degraded mode** [`scoring-core/src/gear.rs`] — When `gear_affixes` is empty, all 12 slots return `upgrade_score: 0.0`. The `priority_slot` selection logic in `gear.rs` was not inspected in this review. Story 5.4 should guard against `gearAnalysis.priority_slot === ""` when rendering the priority slot display.

## Deferred from: code review of 5-4-gear-optimization-view-priority-ranking-and-wishlists (2026-05-26)

- **`initialOptimizationState` shares mutable object references in test setup** [`GearOptimizationView.test.tsx`] — Pre-existing pattern used consistently for `initialBuildState`/`initialAppState`; nested object mutations in a test would corrupt subsequent tests. Address in a dedicated test-cleanup story.
- **AC7 "correct — keep" tooltip obligation not captured in TODO comment** [`GearSlotRankingList.tsx`] — TODO comment defers the badge itself but omits the tooltip requirement from AC7. Story 5.5 should capture both the badge and the tooltip when wiring the "correct — keep" signal.
- **No test for ranking list visibility during re-analysis** [`GearOptimizationView.test.tsx`] — `isAnalyzingGear: true` + non-null `gearAnalysis` (list stays visible) is intentional per Story 5.3 notes but untested. Add to a future test-coverage story.


## Deferred from: code review of 5-5-claude-gear-narrative-integration (2026-05-26)

- NaN in `max_by` for priority slot selection in `assemble_gear_narrative_payload` — `partial_cmp` fallback to `Ordering::Equal` when `upgrade_score` is NaN can non-deterministically select a slot; pre-existing pattern from scoring_commands.rs.
- `MODELS[0]` hardcoded for gear narrative in `openrouter_service.rs` — no bounds check; spec-intentional (narrative is short, no fallback needed), but a comment would prevent future confusion.
- Composite key `${affix_id}-${i}` in `GearSlotRankingList` — index baked into key defeats React reorder stability; acceptable workaround for duplicate `affix_id` values in Phase 3 data.
- In-flight narrative chunks can pollute a re-triggered run — no stream cancellation mechanism; if user clicks "Analyze Gear" while narrative is streaming, first stream's remaining chunks may append to second run's narrative; same architectural gap as optimization streaming.
- `slot_rankings` empty edge case — `priority_slot_info` is None and Claude receives no slot data; degenerate case not reachable with current Phase 3 game data.
- Payload provides BuildScore weight deltas in `mechanical_reason`, not raw stat percentages — AC1 "specific delta values" cannot be demonstrated in Phase 3 with empty `gear_affixes`; re-evaluate when Phase 4 affix data is ingested.
- Game-changer payload lacks current-stat proximity — `description` covers threshold + delta%, but not current stat value vs threshold; acceptable for Phase 3; add current stat values to payload when Phase 4 stat sheet is available.
- Slider boundary: Rust `26..=74` maps Balanced; `75` is Juggernaut — verify against UI slider label thresholds to ensure consistent archetype labeling at the 75 boundary.
- Stale `assert_eq!(MODELS.len(), 4)` Rust test in `openrouter_service.rs` — `MODELS` has 7 entries; test will fail on `cargo test`; not caught by `pnpm vitest`; fix when Rust tests are next run.

## Deferred from: code review of 6-1-item-rarity-and-damage-type-color-systems (2026-05-26)

- `warningGap === 0` triggers warning UI — StatSheetPanel RESISTANCES map passes `warn?.gap` as `warningGap`; a gap of 0 (resistance exactly at cap) renders red warning text unnecessarily. Fix: change guard to `warningGap !== undefined && warningGap > 0` in StatRow or filter at the call site.
- SetItem silently absent from item search — `itemSearch.ts` only iterates `baseItems` and `uniqueItems`; set items are never searchable. Pre-existing; set item support is explicitly deferred to a future story.
- Unique item affix with missing affixId silently dropped — `resolveAffixes` flatMaps over affix IDs and drops any whose entry is not found in `itemDatabase.affixes`. The unique item renders with fewer affixes than intended with no error indicator. Pre-existing data-integrity gap.
- `delta` cast `as number | undefined` bypasses TypeScript for resistance rows — `deltas?.[field as keyof StatDeltas] as number | undefined` skips exhaustiveness checking; a future nullable field with a matching key name would silently pass `null` through. Pre-existing; currently safe because resistance fields are all non-nullable in StatDeltas.

## Deferred from: code review of 6-2-tree-background-textures (2026-05-26)

- **New `setShowOverlay(false)` branch overrides user's manual toggle** [`SkillTreeView.tsx:135`] — Intentional out-of-scope addition (reset overlay between optimization runs). Side effect: if user manually toggled overlay off before a run, it turns back on when results arrive. Low UX impact; address as part of overlay UX polish.
- **Stone tile loads on weaver canvas renderer instance** [`pixiRenderer.ts:initRenderer`] — `initRenderer` unconditionally loads `bg_stone_tile.png` regardless of `treeLayout`. Weaver canvas (when eventually wired) will show stone tile instead of weaver tile. Latent; weaver `SkillTreeCanvas` never renders currently. Address when implementing weaver tree data.
- **`node.tags` undefined guard missing in `deriveSkillDamageType`** [`SkillTreeView.tsx:31`] — Theoretical crash if a game node arrives without a `tags` field. Data is loader-validated; guard only needed if external/user-supplied node data is ever introduced.

## Deferred from: code review of 6-3-keyboard-shortcuts-and-undo-redo-controls (2026-05-27)

- **`canUndo`/`canRedo` co-provision not type-enforced** [`TreeControls.tsx`] — Props are individually optional; a caller passing `onUndo` without `canUndo` gets a silently-always-disabled button. Fix requires discriminated union type. All current callers supply all four props correctly.
- **`redoStack` not cleared on `setSelectedMastery`** [`buildStore.ts`] — Mirrors pre-existing `undoStack` behavior. Stale redo entries survive mastery changes; redoing could restore allocations from previous mastery. Spec doesn't list this as a required clear-site; architecturally ambiguous.
- **`activeBuild` null guard creates stack asymmetry** [`buildStore.ts`, `undoNodeChange`/`redoNodeChange`] — If `activeBuild` is null when undo/redo fires, the current state is not pushed to the opposite stack (asymmetric undo/redo). Theoretically unreachable since stacks only populated via paths requiring non-null `activeBuild`.
- **`isPersisted` flag snapshotted into `BuildState`** [`buildStore.ts`] — Undo may restore a snapshot that had `isPersisted: true`, making the build appear saved when it may not match disk state. Pre-existing design concern not introduced by this story.


## Deferred from: code review of 6-4-tooltip-polish-and-multi-point-allocation (2026-05-27)

- **Tooltip→node cursor flicker** [`useSkillTree.ts`, `handleTooltipLeave`] — `handleTooltipLeave` clears hover immediately (per spec), creating a transient null before PixiJS fires `pointerover` on the re-entered node. React 18 batching likely mitigates in practice; only observable when moving cursor from tooltip back onto its originating node.
- **Shallow prerequisite check in `applyNodeChangeBulk`** [`buildStore.ts`] — Only direct edge predecessors checked; transitive path prerequisites not validated. Pre-existing behavior identical to `applyNodeChange`. Revisit if deep-tree bulk allocation causes unexpected unlocks.
- **Stale `treeData` closure during game-data reload** [`useSkillTree.ts`, `handleNodeClick`] — `treeData` captured in `useCallback` closure may be stale during concurrent game-data reload. Pre-existing: same pattern in `applyNodeChange`. Low risk; game data reloads are infrequent and user-initiated.
