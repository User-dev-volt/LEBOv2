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

## Deferred from: code review of 1-1-game-data-type-extension-and-schema-definition (2026-05-20)

- `as unknown as ReturnType<...>` double-cast in `useOptimizationStream.test.ts` (lines 315, 353, 381, 417) weakens test mock type coverage. Root cause: partial mock objects for `useBuildStore` and `useGameDataStore` don't fully satisfy store return types (likely `schemaVersion: 2 as const` vs `schemaVersion: 1 | 2` union). Fix: make mocks complete or use `satisfies` with `Partial<>`. Deferred as pre-existing; address in a dedicated test-cleanup story.
