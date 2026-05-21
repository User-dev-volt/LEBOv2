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

## Deferred from: code review of 1-1-game-data-type-extension-and-schema-definition (2026-05-20)

- `as unknown as ReturnType<...>` double-cast in `useOptimizationStream.test.ts` (lines 315, 353, 381, 417) weakens test mock type coverage. Root cause: partial mock objects for `useBuildStore` and `useGameDataStore` don't fully satisfy store return types (likely `schemaVersion: 2 as const` vs `schemaVersion: 1 | 2` union). Fix: make mocks complete or use `satisfies` with `Partial<>`. Deferred as pre-existing; address in a dedicated test-cleanup story.
