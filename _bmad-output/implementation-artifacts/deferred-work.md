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

## Deferred from: code review of 6-5-real-game-art-assets (2026-05-27)

- **Inconsistent filename casing in icon map** [`skill-icon-map.json`] — `skillIcon-Lightning Bolt.png` and `skillIcon-Divine bolt.png` use mixed case. No impact on Windows+macOS (case-insensitive FS). Flag if Linux CI is ever added.
- **Spaces in icon filenames** [`skill-icon-map.json`] — `skillIcon-Lightning Bolt.png` contains a space. Pre-existing pattern (`skillIcon-rip blood.png`). Tauri asset protocol handles encoding; no current breakage.
- **`skillCanvasIconTextures` allocates new inner `Map` per memo recompute** [`SkillTreeView.tsx`] — Each texture that loads triggers a full rebuild of all per-skill Maps. Correct behavior (canvas must update); perf concern only at high skill counts.
- **Test mock `convertFileSrc` omits URL encoding** [`SkillPickerGrid.test.tsx`] — Mock returns raw concatenation; real Tauri API encodes spaces etc. Current test paths are space-free so assertions pass. Risk emerges if tests are added for Lightning Bolt icon path.
- **No retry mechanism for `getIconCachePath` returning null** [`SkillTreeView.tsx`, `skillIconUrls` useEffect] — Icons whose cache files aren't ready at class-load time are permanently absent from the tab bar until the user switches classes. Pre-existing limitation from `useIconTextures`.
- **`convertFileSrc` test verifies call but not stored value** [`SkillPickerGrid.test.tsx`] — `expect(convertFileSrc).toHaveBeenCalledWith(mockPath)` would pass even if the return value was discarded before storage. Minor coverage gap.

## Deferred from: code review of story-1.1 (2026-06-02)

- **Typed `affix_scope`/`affix_class` boundary not yet exercised** [`game_data_loader.rs`, `game_data.rs`] — The migration correctly types `GearAffixData.affix_class: AffixPosition`, `scope: Scope`, and `GameData.affix_scope: HashMap<String, Scope>`, but the loader seeds `gear_affixes`/`affix_scope` empty and wires only `ModifierType::from_data_str` — no `AffixPosition::from_data_str`/`Scope::from_data_str` conversion runs at the loader boundary yet. The string→enum tolerance therefore lives only in tests, not on a live data path. Correct scaffolding ahead of data; verify the conversion is actually wired when the affix DB is populated (Epic 4 / story 4-1 affix data gate). Not caused by this change.

## Deferred from: code review of story-1.2 (2026-06-02)

- **✅ RE-OPENED INTO STORY 1.2 (Tasks 9–13), not a separate story** — Alec 2026-06-02 chose to fold this back into story 1.2 and return it to `ready-for-dev` for a second `dev-story` pass. Kept here for the constraint analysis; the actionable tasks live in the 1.2 story file. **Penetration sourcing & multi-stat effect parsing** [`game_data_loader.rs`, `modifier.rs`, `compute/penetration.rs`] — Story 1.2 implemented correct penetration *math* in `scoring-core` but it is never sourced: no loader path produces any `*Penetration` StatKey, so `pen_mult` is always `1.0` (AC4 "applied to score" is structural only). Correct sourcing is blocked by two constraints discovered in the shipped data and parser: **(1)** the dominant penetration tags are `VOID`/`HOLY`/`CHAOS`/`ELEMENTAL`, none of which have StatKeys (Holy/Chaos aren't modeled LE types — same class as the dropped "Corruption"); only `FIRE`/`LIGHTNING` map to existing keys. **(2)** `parse_node_effects` emits **one stat + one value per effect** (single `tags_to_stat_key` + first-number `extract_value`), so multi-stat nodes like `"+4% Void Damage. +2% Void Penetration per point"` (tags `[VOID,DAMAGE,PENETRATION]`) cannot express both — wiring penetration would drop their damage (breaking the Phase-3 aggregate parity) or misread the `4%` damage as `4%` pen. **Scope of the follow-up:** (a) parser-split multi-stat descriptions into multiple modifiers; (b) add the missing pen StatKeys + decide Holy/Chaos/Elemental modeling; (c) extend `compute_penetration` (per-type, filter `ModifierType`, fix hybrid multiplicative compounding, `.trim()` element match); (d) re-derive the golden effect-count baseline (currently 179 — will change once pure-pen nodes are captured); (e) re-verify Phase-3 parity. Decided by Alec 2026-06-02; the negative-pen clamp hardening was applied in 1.2's review.
- **`DAMAGE`+`PENETRATION` class-node tags are mis-scored as increased damage** [`game_data_loader.rs` `tags_to_stat_key`] — Nodes like `["VOID","DAMAGE","PENETRATION"]` hit the `has("DAMAGE")` branch and route to `IncreasedVoidDamage`; pure `["FIRE","PENETRATION"]` nodes fall through to `None`. The loader had no `PENETRATION` branch before 1.2, so this is pre-existing, not a regression. Resolved if/when the penetration-sourcing decision wires a `PENETRATION` branch.
- **`StunChance` never produced by the loader; `Flat`-only filter will drop the default `Increased` type when wired** [`offense.rs:132` / `game_data_loader.rs`] — Knowingly deferred per Task 2 (a `STUN` mapping would break the golden count of 179). Tracked in MEMORY `project_stun_chance_unsourced`. When eventually wired: the consumer filters `ModifierType::Flat` only, but the loader's missing-field fallback is `Increased`, so naive wiring would silently yield 0.
- **"Byte-identical" parity is theoretically fragile under float non-commutativity** [`compute/mod.rs` `build_registry`] — Modifiers are added while iterating `HashMap`s, and `sum`/`product` are not associative in IEEE-754; run-to-run `damage_score` bytes could in principle differ. Pre-existing (registry build predates 1.2); Phase-3 parity tests currently pass.
- **`damage_type: "necrotic"` has no `DAMAGE_TYPE_COLORS` token** [`rarityColors.ts`] — Story 1.6 scope; already documented in 1.2 Completion Notes. The 1.6 UI must add a `necrotic` color token and decide how to surface the Bleed/Ignite DoT split.
- **`More`-typed per-type/DoT mods appear in the breakdown but never reach the aggregate `damage_score`** [`offense.rs:66-71`] — The aggregate `more_factor` only multiplies `StatKey::MoreDamage`; a `More`-typed `IncreasedFireDamage`/`IncreasedIgniteDamage` shows in `fire.more`/`more_dot` but does not move the score. Aggregate behavior is unchanged from Phase 3; no current data path produces such a mod. Informational for the 1.6 UI.
- **`IGNITE` checked before `FIRE` in the remap — verify no generic fire-hit node is co-tagged `IGNITE`** [`game_data_loader.rs`] — Aggregate parity is preserved (both keys are in `DAMAGE_STAT_KEYS`) and the DoT-before-parent ordering is intentional, but a generic "increased fire damage" node co-tagged `IGNITE` would shift from the fire-hit bucket to the fire-DoT bucket. Spot-check the shipped JSONs to confirm none exist.

## Deferred from: code review of story-1.2 (2026-06-02, second review — penetration sourcing pass)

- **Typed/DoT `More` damage mods surface in the breakdown but never reach `damage_score`** [`compute/offense.rs:48-71`] — `more_factor` queries only `StatKey::MoreDamage`; `total_increased` filters `Increased`. A `More`-typed `IncreasedFireDamage`/`IncreasedIgniteDamage` appears in `fire.more`/`more_dot` but does not score. Pre-existing aggregate behavior; the new breakdown only makes the gap visible. Story 1.6 UI reconciliation concern. (Re-confirmation of the first-pass defer.)
- **`StunChance` consumed but never sourced; `Flat`-only filter would drop a future `Increased`-typed stun source** [`compute/offense.rs` / `game_data_loader.rs`] — no STUN→StatKey branch exists, so `stun_chance` is always 0 in production. Same "computed-but-not-sourced" class that re-opened AC4 penetration. Tracked in MEMORY `project_stun_chance_unsourced`. (Re-confirmation.)
- **`parse_penetration_clause` prose parser is brittle and the golden test can't catch its failure modes** [`game_data_loader.rs:239-271`] — clause split only on `". "` (misses `".\n"`/`"; "`); only the first pen clause is read (`.find`); element resolved by first-substring-match (`"Fire and Lightning Penetration"` → fire only; `"void"` ⊂ `"avoidance"`). Inert on shipped data (golden 185 passes) but `shipped_class_json_effect_count_is_stable` counts effects only — a mis-valued/mis-element pen leaves the count at 185 and goes undetected. Recommend a value+element assertion test over the real pen nodes before relying on the parser for new data.
- **Single-stat path `extract_value` reads the first number in the whole description** [`game_data_loader.rs:212`] — path (1) of `parse_node_effects` is byte-identical to pre-1.2 parsing and assumes the damage clause leads; correct for shipped multi-clause DAMAGE+PENETRATION nodes but order-dependent. A pen-first or lead-number-prose node would mis-value the damage key. Pre-existing; surfaced now that multi-clause pen nodes exist.
- **Per-type breakdown does not reconcile to the aggregate** [`compute/offense.rs:7-37`] — delivery/generic keys (`IncreasedSpellDamage`/`MeleeDamage`/`RangedDamage`/`AreaDamage`/`IncreasedDamage`) feed `DAMAGE_STAT_KEYS` (aggregate) but have no entry in the `DAMAGE_TYPES` breakdown table, so Σ(breakdown.increased) < aggregate `total_increased` when such mods exist. By design; informational for any Story 1.6 UI that sums the breakdown rows.

## Deferred from: code review of 1-4-ehp-triple-and-stable-ward-hp-equilibrium (2026-06-03)

- **AC3 reference figures are closed-form, not live tunklab captures** [`ehp_reference.rs`] — the ±2% expected literals are hand-derived from the Maxroll closed form (tunklab is JS-gated/unreachable from the headless env — Story 1.3 precedent). The gate therefore proves internal arithmetic regression-drift, not independent agreement with the tunklab calculator (the SM-1 authority). Story-sanctioned fallback, recorded in-file + Dev Agent Record. Swap to live tunklab captures when capturable.
- **`ehp_reference.rs` fixtures couple to the unseen `compute_defense` armor formula** [`ehp_reference.rs`] — fixtures A/C assume `Armor 1104 → 50%` mitigation (`armor/(armor+1104)`), a formula not in this diff. A future change to the armor constant K would break the EHP-layer tests for a reason unrelated to the EHP code under test. Maintainability/coupling note.
- **EHP cap constants re-declared instead of shared with `defense.rs`** [`ehp.rs`] — `ARMOR_DR_CAP` (0.85), `RESISTANCE_CAP` (75), `ENDURANCE_DR_CAP` (0.90) are local consts in `ehp.rs`; values currently match `defense.rs` but a future cap change there would silently desync the EHP layer. Story scoped `ehp.rs`/`ward.rs` standalone, so accepted for now; share the constants when next touching this module.
- **`stable_ward` has no finite upper sanity bound** [`ward.rs:45-52`] — only `finite_or_zero` (Inf→0) bounds the output; a large-but-finite `ward_retention` (if a real source ever lands) yields an unrealistically high stable_ward. Unreachable today (production retention = 0.0). Add a sanity clamp when a retention source is wired.

## Deferred from: code review of 1-5-ailment-attribute-and-minion-stats (2026-06-03)

- **`has_minion_skill` probes unsourced `IncreasedMinionCount`/`IncreasedMinionHp` → forward-compat "empty Some" minion sheet** [`compute/minion.rs:46-52`] — the presence probe queries two keys the loader does not produce today (always empty → no current effect; matches Story 1.5 Decision 1's `IncreasedMinion*` wildcard). When a real source lands, `compute_minion` still hardcodes `minion_count`/`minion_hp_multi`/`minion_speed` to `0.0`, so `has_minion_skill` would fire `minion: Some(MinionStats{0,0,0,0})` — an all-zero `Some`, unlike ailment's `has_ailment_data` non-zero gate. The two probe branches also have no test coverage. Resolve as part of the tracked **post–Epic-5 "Minion stat correctness"** story (which wires `skill_node_allocations` into the registry and de-conflates minion HP/speed). Either add a `has_minion_data` non-zero gate or drop the unsourced keys from the probe at that time.

## Deferred from: code review of 1-6-five-tab-stat-sheet-panel-with-live-recompute (2026-06-03)

- **`DAMAGE_TYPE_COLORS` has no `necrotic` key** [`rarityColors.ts:17-25`] — the per-type damage breakdown rows added to the Offense tab (`offense.damage_types.map`) look up `DAMAGE_TYPE_COLORS[dt.damage_type as DamageType]`; a `"necrotic"` entry would fall back to `var(--color-text-secondary)` rather than the new `--color-dmg-necrotic` token. Out of this story's three-file scope (fixing it edits `rarityColors.ts`) and only reachable once the engine populates `offense.damage_types[]` (empty today). Already noted from the Story 1.2 review — add the `necrotic` map entry when per-type damage rows go live.
- **Pre-existing duplicate "Damage Score" row on the Other tab** [`StatSheetPanel.tsx:365`] — the Other tab renders `scores.damage_score` (labeled "Damage Score") in addition to the Offense-tab "Damage Score", but the addendum-F Other-tab field map lists only Survivability Score / Speed Score. Unchanged context in the 1.6 diff (pre-existing, not introduced by this story). Remove or confirm-as-intentional when the Other tab is next touched.

## Deferred from: code review of story-1.7 (2026-06-04)

- `stat_key_key` (modifier.rs:107-112) silently maps a non-string serde result to `""`. Unreachable today (all `StatKey` are unit variants); fires only if a future `StatKey` variant carries associated data, which would silently collapse unrelated stats under one empty-string key. Harden with a debug_assert / loud-fail when the StatKey shape changes.
- Parallel `modifiers`/`sources` lists in `ModifierRegistry` (modifier.rs:288-335) must be hand-synced at every `build_registry` ingestion site (4 blocks in compute/mod.rs). Deliberate, documented tradeoff to avoid churning the frozen-parity `Modifier` literals, but a future 5th source producer can silently drift (modifier added, source forgotten or field mismatched). Consider a debug-only invariant check if more source producers are added.
- `collect_sources` (modifier.rs:320-335) returns a `std::collections::HashMap` whose cross-key iteration/serialization order is non-deterministic. Harmless now (current tests index by key), but Story 1.8 must not rely on key order or stable JSON output — switch to a BTreeMap or sort if stable output is ever needed.
- No NaN/Inf guard on the recorded source `value` (compute/mod.rs source blocks). serde_json serializes non-finite f64 to `null`, so malformed game data would yield `value: null` despite the TS type declaring `value: number`. Pre-existing serialization behavior across the entire StatSheet (not unique to Story 1.7) — best addressed at the game-data ingestion layer.
