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
