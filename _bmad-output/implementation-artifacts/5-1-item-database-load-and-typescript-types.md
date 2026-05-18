# Story 5.1: Item Database Load and TypeScript Types

Status: done

## Story

As a developer,
I want the item database (base items, uniques, affixes) to load from bundled JSON files at app startup and be accessible in the TypeScript layer via gameDataStore,
so that all gear input features in Epic 5 have a populated item database to query against.

## Acceptance Criteria

1. **Given** `base-items.json`, `uniques.json`, and `affixes.json` are bundled in `src-tauri/resources/items/`
   **When** the app starts
   **Then** the Rust command `load_item_database()` reads all three files, deserializes them via serde, and returns an `ItemDatabase` struct; the TypeScript side calls `invokeCommand<ItemDatabase>('load_item_database')` and stores the result in `useGameDataStore.itemDatabase`

2. **Given** `load_item_database()` succeeds
   **When** the corpus sizes are checked
   **Then** itemDatabase contains ≥674 base items, ≥445 unique items, and ≥1,112 affixes

3. **Given** `load_item_database()` fails (file missing or corrupt)
   **When** the error is caught in TypeScript
   **Then** `useGameDataStore.itemDatabase` is set to null; no error toast is shown; all GearSlot components (Stories 5.3–5.5) will detect null and render free-text mode with a "Database unavailable" muted label (NFR11)

4. **And** TypeScript types `ItemDatabase`, `BaseItem`, `UniqueItem`, `AffixEntry`, `AffixTier` are defined in `src/shared/types/itemDatabase.ts` with no barrel file

5. **And** `load_item_database` is registered in `lib.rs` with `AppResult<ItemDatabase>` return; error strings prefixed `"ITEM_DATA_ERROR: "`; `ITEM_DATA_ERROR` added to `ErrorType` enum in `errors.ts` and `errorNormalizer.ts`

6. **And** the item database load runs in parallel with game data load at startup (non-blocking) — added to the `useEffect` in `App.tsx` with no `await` dependency on other startup calls

## Tasks / Subtasks

- [x] Task 0: Source and bundle item database JSON files (AC: #1, #2)
  - [x] Source Last Epoch community item data (see Dev Notes: Data Sourcing section for target format and community sources)
  - [x] Transform/validate data to produce three JSON files matching the TypeScript type schemas defined in Task 1:
    - `base-items.json` — array of `BaseItem` objects (≥674 entries)
    - `uniques.json` — array of `UniqueItem` objects (≥445 entries)
    - `affixes.json` — array of `AffixEntry` objects (≥1,112 entries; includes prefixes, suffixes, and implicits)
  - [x] Place all three files in `src-tauri/resources/items/` (create this directory)
  - [x] Add resources entries to `tauri.conf.json` `bundle.resources` array:
    ```json
    "resources/items/base-items.json",
    "resources/items/uniques.json",
    "resources/items/affixes.json"
    ```
  - [x] Verify corpus counts meet minimums: ≥674 base items, ≥445 unique items, ≥1,112 affixes

- [x] Task 1: Define TypeScript types in `src/shared/types/itemDatabase.ts` (AC: #4)
  - [x] Create `src/shared/types/itemDatabase.ts` (no barrel file; no `index.ts` in this directory)
  - [x] Export the following interfaces (see Dev Notes: TypeScript Type Schema for field rationale)
  - [x] **No default exports** — all exports are named (project convention)

- [x] Task 2: Add `ITEM_DATA_ERROR` to errors.ts and errorNormalizer.ts (AC: #5)
  - [x] In `src/shared/types/errors.ts`, add `'ITEM_DATA_ERROR'` to the `ErrorType` union (after `'ICON_ERROR'`)
  - [x] In `src/shared/utils/errorNormalizer.ts`, add to both `ERROR_TYPE_MAP` and `USER_MESSAGES`
  - [x] Verified `RETRYABLE_ERROR_TYPES` does NOT include `ITEM_DATA_ERROR`

- [x] Task 3: Create Rust models for item database (AC: #1, #5)
  - [x] Create `src-tauri/src/models/item_data.rs` with structs matching the JSON schema
  - [x] Add `pub mod item_data;` to `src-tauri/src/models/mod.rs`

- [x] Task 4: Create Rust item data service at `src-tauri/src/services/item_data_service.rs` (AC: #1, #3)
  - [x] Create `src-tauri/src/services/item_data_service.rs` following the `game_data_service.rs` pattern
  - [x] Add `pub mod item_data_service;` to `src-tauri/src/services/mod.rs`

- [x] Task 5: Create Rust `item_commands.rs` and register in `lib.rs` (AC: #1, #5)
  - [x] Create `src-tauri/src/commands/item_commands.rs`
  - [x] Add `pub mod item_commands;` to `src-tauri/src/commands/mod.rs`
  - [x] In `src-tauri/src/lib.rs`: add import and register `load_item_database` in `invoke_handler!`

- [x] Task 6: Extend `useGameDataStore` with `itemDatabase` slice (AC: #1, #3)
  - [x] Added `import type { ItemDatabase }`, `itemDatabase: ItemDatabase | null`, `setItemDatabase` to `gameDataStore.ts`

- [x] Task 7: Create `itemDatabaseLoader.ts` and wire to `App.tsx` startup (AC: #1, #3, #6)
  - [x] Created `src/features/item-database/itemDatabaseLoader.ts`
  - [x] Added import and `loadItemDatabase().catch(console.error)` to `App.tsx` startup useEffect (after `initializeIconPipeline`)

- [x] Task 8: Tests (AC: #1, #3, #4, #5)
  - [x] Created `src/features/item-database/itemDatabaseLoader.test.ts`: 2 tests (success + failure paths), all passing
  - [x] TypeScript types file is type-only; TS compiler (tsc --noEmit) validates it
  - [x] No Rust unit tests (matches game_data_service.rs precedent)

## Dev Notes

### Data Sourcing (Task 0 Guidance)

The three JSON files do NOT exist yet and must be sourced as part of this story. Community sources to investigate (in priority order):

1. **Musholic/PathOfBuildingForLastEpoch** (GitHub) — has Last Epoch data exports including item bases, uniques, and affixes. May be in Lua or JSON format; transformation to the defined schema may be needed.
2. **tunklab.com or lastepochtools.com** — may expose structured item data; check for public data endpoints or downloadable exports.
3. **Last Epoch game files** — community tools that dump Unity assets may expose item data directly. Not required since this is data-only, but may produce the most accurate data.

**Critical requirement:** The JSON files must use `camelCase` keys to match the `#[serde(rename_all = "camelCase")]` Rust models. For example, `{ "id": "...", "baseType": "Helmet", "itemSlots": [...] }`.

**If a source provides data in a different schema**, write a one-off Node.js or Python transformation script (not included in the app build) to produce the three canonical JSON files. Place the transformation script in `docs/data-transform/` for reproducibility but do not include it in the Tauri bundle.

**Slot key convention:** Use lowercase slug format consistent with the build gear slot keys already in `BuildState.contextData.gear[].slot` (check `src/shared/types/build.ts` to confirm the exact slot key strings used in Phase 1 — the item DB slot values must match these exactly so GearSlot filtering works in Story 5.4).

### TypeScript Type Schema — Design Rationale

| Field | Used By (Story) | Why This Shape |
|-------|-----------------|----------------|
| `AffixEntry.tiers` | 5.3 (AffixTierControl pip count + value display) | Array indexed by tier; `tiers.length` = max tier; `tiers[i].minValue/maxValue` drives monospace value label |
| `AffixEntry.itemSlots` | 5.5 (AffixPicker filters affixes by slot) | Enables slot-scoped affix search in the "+" custom affix picker |
| `BaseItem.implicitAffixIds` | 5.4 (GearSlot pre-populate on item select) | When item selected, these IDs are looked up in `affixes` array to pre-populate AffixTierControl rows at median tier |
| `UniqueItem.affixes[].fixedMinValue/fixedMaxValue` | 5.4 (GearSlot pre-populate at "median tier") | Uniques have fixed ranges, not tier-indexed ranges; median = (min + max) / 2 displayed in value label |
| `AffixEntry.type` | 5.5 (distinguish implicit vs prefix/suffix in UI) | Implicits shown separately from prefix/suffix in GearSlot; "+" adds prefix/suffix only |

### Architecture Decisions Applied

From `_bmad-output/planning-artifacts/architecture.md` — Decision 4: Item Database Architecture:
- **Storage location:** `{app_data}/lebo/items/` (runtime) ← copied from `resources/items/` (bundled) on first launch
- **Load strategy:** Rust reads + deserializes → returns via `AppResult<ItemDatabase>` → TypeScript calls `invokeCommand` → stores in `useGameDataStore.itemDatabase`
- **In-memory after load:** All item search (Story 5.2) happens in TypeScript after load; never IPC round-trip
- **Parallel startup:** `loadItemDatabase()` fires in parallel with `initGameData()`, `loadBuildsOnStartup()`, `initializeIconPipeline()` — no ordering dependency

### What Already Exists (Do NOT Recreate)

| Existing | Location | Notes |
|----------|----------|-------|
| `invokeCommand<T>()` wrapper | `src/shared/utils/invokeCommand.ts` | Always use this; never raw `invoke()` |
| `useGameDataStore` | `src/shared/stores/gameDataStore.ts` | Extend in-place; do NOT create new store |
| `normalizeAppError` | `src/shared/utils/errorNormalizer.ts` | Already handles substring prefix matching; just add entry |
| `game_data_service.rs` copy pattern | `src-tauri/src/services/game_data_service.rs` | Mirror this pattern exactly for item service |
| Error prefix convention | All Rust commands | `"ITEM_DATA_ERROR: ..."` prefix → `ErrorType` map lookup |

### What Does NOT Exist Yet (Must Be Created)

1. `src-tauri/resources/items/` directory + three JSON files (Task 0)
2. `src/shared/types/itemDatabase.ts` (Task 1)
3. `ITEM_DATA_ERROR` in `errors.ts` + `errorNormalizer.ts` (Task 2)
4. `src-tauri/src/models/item_data.rs` (Task 3)
5. `src-tauri/src/services/item_data_service.rs` (Task 4)
6. `src-tauri/src/commands/item_commands.rs` (Task 5)
7. `src/features/item-database/itemDatabaseLoader.ts` (Task 7)

### Brownfield Risk: No `BuildState` Changes Needed

This story does NOT touch `BuildState` or `buildPersistence.ts`. Item database is read-only reference data (separate from build state). No schema migration needed. Epic 6 handles `BuildState` schema v2 migration; story 5-1 has zero overlap.

### Brownfield Risk: `GameDataStore` Extension

Adding `itemDatabase: ItemDatabase | null` to `useGameDataStore` is safe:
- It does not break any existing selector — only new consumers (Stories 5.2+) will read it
- **However:** All existing test files that mock `useGameDataStore` will need to add `itemDatabase: null` to their mock objects to satisfy TypeScript strict mode. Before implementing Task 6, grep for mock usages:
  ```
  grep -r "useGameDataStore" src --include="*.test.*"
  ```
  Add `itemDatabase: null` to any partial mock objects in those test files to prevent `noUnusedLocals` / TypeScript compile errors.

### Startup Wiring: `App.tsx` Exact Placement

Current startup `useEffect` body (simplified):
```typescript
initGameData().catch(console.error)         // line ~44
loadBuildsOnStartup().catch(console.error)  // line ~45
initializeIconPipeline().catch(console.error) // line ~46

// Stub Weaver Tree loader ...               // line ~48-52
// Sequential vault reads (chained .then()) // line ~55-68
```

Add `loadItemDatabase().catch(console.error)` directly after line ~46 (after `initializeIconPipeline`). It MUST be BEFORE the Weaver Tree loader and BEFORE the sequential vault reads. No `await`, no `.then()` chaining — pure fire-and-forget parallel call.

### `commands/mod.rs` and `services/mod.rs` — Check Before Edit

Before editing `src-tauri/src/commands/mod.rs`, read it — the current content is:
```rust
pub mod app_commands;
pub mod build_commands;
pub mod claude_commands;
pub mod game_data_commands;
pub mod icon_commands;
```
Add: `pub mod item_commands;`

For `src-tauri/src/services/mod.rs`, read it first to confirm it exists and contains `pub mod game_data_service;` and `pub mod connectivity_service;` — then add `pub mod item_data_service;`.

### `lib.rs` Import and Handler Registration

Current `lib.rs` imports (from `commands::icon_commands`):
```rust
use commands::icon_commands::{get_icon_cache_path, initialize_icon_pipeline, IconMapCache};
```

Add after this line:
```rust
use commands::item_commands::load_item_database;
```

Add `load_item_database` to the `invoke_handler!` macro list alongside the other commands.

### `tauri.conf.json` Resources Entry

Current `bundle.resources` ends with:
```json
"resources/icons/skill-icon-map.json",
"resources/icons/skills/**/*"
```

Add:
```json
"resources/items/base-items.json",
"resources/items/uniques.json",
"resources/items/affixes.json"
```

### Project Context Rules (from `_bmad-output/project-context.md`)

- **No barrel files:** `itemDatabase.ts` in `src/shared/types/` — no `index.ts` re-export. `itemDatabaseLoader.ts` in `src/features/item-database/` — no `index.ts`.
- **No new top-level Zustand stores:** `itemDatabase` field is added to `useGameDataStore` only.
- **TypeScript strict mode:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Every import must be used.
- **Named exports only:** All TypeScript exports in this story are named (no `export default`).
- **All IPC calls use `invokeCommand<T>()`:** Never raw `invoke()`.
- **Error prefix convention:** Rust errors prefixed `"ITEM_DATA_ERROR: ..."` → `normalizeAppError` substring match → `ErrorType.ITEM_DATA_ERROR`.
- **Desktop-first Tauri:** Data loading is Rust → TypeScript via IPC, never Node.js.
- **API key never crosses IPC boundary:** Not applicable here (no AI calls in this story).

### Files to Create

| Path | What |
|------|------|
| `src-tauri/resources/items/base-items.json` | Sourced item data — base items array |
| `src-tauri/resources/items/uniques.json` | Sourced item data — unique items array |
| `src-tauri/resources/items/affixes.json` | Sourced item data — affixes array |
| `src/shared/types/itemDatabase.ts` | TypeScript type definitions |
| `src-tauri/src/models/item_data.rs` | Rust model structs |
| `src-tauri/src/services/item_data_service.rs` | Rust service layer |
| `src-tauri/src/commands/item_commands.rs` | Rust Tauri command |
| `src/features/item-database/itemDatabaseLoader.ts` | TypeScript startup loader |
| `src/features/item-database/itemDatabaseLoader.test.ts` | Unit tests for loader |

### Files to Modify

| File | What Changes |
|------|-------------|
| `tauri.conf.json` | Add 3 items resource entries to `bundle.resources` |
| `src-tauri/src/models/mod.rs` | Add `pub mod item_data;` |
| `src-tauri/src/services/mod.rs` | Add `pub mod item_data_service;` |
| `src-tauri/src/commands/mod.rs` | Add `pub mod item_commands;` |
| `src-tauri/src/lib.rs` | Add import + `load_item_database` to invoke_handler |
| `src/shared/types/errors.ts` | Add `'ITEM_DATA_ERROR'` to `ErrorType` union |
| `src/shared/utils/errorNormalizer.ts` | Add `ITEM_DATA_ERROR` to `ERROR_TYPE_MAP` + `USER_MESSAGES` |
| `src/shared/stores/gameDataStore.ts` | Add `itemDatabase` field + `setItemDatabase` action |
| `src/App.tsx` | Add `loadItemDatabase().catch(console.error)` to startup useEffect |
| Existing `*.test.*` mocking `useGameDataStore` | Add `itemDatabase: null` to partial mock objects (see Brownfield Risk section) |

### Do NOT Touch

- `BuildState` (`src/shared/types/build.ts`) — no gear schema changes in this story
- `buildPersistence.ts` — no migration needed for item database (it's reference data, not build state)
- `SkillTreeCanvas`, `pixiRenderer.ts` — no canvas changes
- `StalenessBar.tsx` — item data freshness check and staleness banner extension is Story 5.6, not this story
- Any existing Rust commands — only add new files; do not modify game_data_commands.rs or icon_commands.rs

### Previous Story Intelligence (from Story 4.3)

- Pattern for extending `useGameDataStore` with new fields: add to interface, add to `create()` initial state, add setter → identical to `weaverTreeData`/`weaverGameNodes` fields added in Story 4.2
- Pattern for new Rust command module: create `commands/xxx_commands.rs` → add to `commands/mod.rs` → import in `lib.rs` → register in `invoke_handler!` → identical to `icon_commands.rs` added in Story 2.2
- When adding fields to `GameDataStore`, existing test files that build partial mock objects will fail to compile — scan for these proactively (see Brownfield Risk section)
- Story 4.3 Completion Note: "Updated all 11 test fixtures missing the field" — adding `weaverAllocations` to BuildState required updating 11 test files. Adding `itemDatabase` to `useGameDataStore` mock will likely require similar sweeping. Run `pnpm vitest --run` after Task 6 to surface all affected test files at once.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.1 ACs]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 4: Item Database Architecture]
- [Source: `_bmad-output/project-context.md` — Technology Stack, Critical Implementation Rules]
- [Source: `lebo/src/shared/stores/gameDataStore.ts` — existing store shape; weaverTreeData/weaverGameNodes pattern to mirror]
- [Source: `lebo/src/shared/types/errors.ts` — current ErrorType union; ICON_ERROR already present as pattern]
- [Source: `lebo/src/shared/utils/errorNormalizer.ts` — current ERROR_TYPE_MAP + USER_MESSAGES shape]
- [Source: `lebo/src-tauri/src/commands/icon_commands.rs` — new Rust command module pattern]
- [Source: `lebo/src-tauri/src/services/game_data_service.rs` — copy_bundled_resources + load pattern]
- [Source: `lebo/src-tauri/src/models/game_data.rs` — serde struct + rename_all = "camelCase" pattern]
- [Source: `lebo/src-tauri/src/lib.rs` — current invoke_handler! registration]
- [Source: `lebo/src-tauri/tauri.conf.json` — current bundle.resources array]
- [Source: `lebo/src/App.tsx:43-46` — parallel startup calls pattern; loadItemDatabase inserts here]
- [Source: `_bmad-output/implementation-artifacts/4-3-weaver-tree-renderer-conditional-on-research-spike-go.md` — GameDataStore extension pattern + "updated 11 test fixtures" warning]

### Review Findings

- [x] [Review][Patch] Partial-copy guard checks only `base-items.json` — crash mid-copy leaves permanent broken state [`lebo/src-tauri/src/services/item_data_service.rs:18`]
- [x] [Review][Patch] AC3 violated: `loadItemDatabase()` propagates rejection without a catch; `itemDatabase` never explicitly set to null on failure [`lebo/src/features/item-database/itemDatabaseLoader.ts:5-7`]
- [x] [Review][Patch] Double `ensure_item_data_dir` call: `copy_bundled_item_resources` calls it internally, then `load_item_database` calls it again [`lebo/src-tauri/src/commands/item_commands.rs:6-7`]
- [x] [Review][Defer] Version staleness: copy-skip never refreshes data after app update [`lebo/src-tauri/src/services/item_data_service.rs:18`] — deferred, pre-existing; Story 5.6 handles data freshness
- [x] [Review][Defer] `AffixEntry.type` 'implicit' variant never emitted by current data; Rust accepts any string unvalidated [`lebo/src/shared/types/itemDatabase.ts:9`, `lebo/src-tauri/src/models/item_data.rs:17`] — deferred, spec-defined type; data coverage is a future concern
- [x] [Review][Defer] No `isLoadingItemDatabase` flag — consumers can't distinguish loading from failed [`lebo/src/shared/stores/gameDataStore.ts`] — deferred, Stories 5.3–5.5 define null-handling pattern
- [x] [Review][Defer] Concurrent race on `copy_bundled_item_resources` if called simultaneously — pre-existing pattern in game_data_service — deferred, pre-existing
- [x] [Review][Defer] Blocking sync I/O in async Tauri command without `spawn_blocking` — deferred, pre-existing project pattern
- [x] [Review][Defer] `UniqueItem` missing `implicitAffixIds` field — deferred, known gap documented in dev notes

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- Data sourced from Musholic/PathOfBuildingForLastEpoch (dev branch): bases.json (897 base items), uniques.json (471 unique items), ModItem.json (4171 affix entries) — all exceed AC2 minimums.
- Python transformation script at `docs/data-transform/generate_item_db.py` fetches and transforms raw data; re-run to regenerate JSON files.
- `implicitAffixIds` is empty for all base items — source data has implicits as text strings, not IDs. Will be cross-linked in a future story when text-to-ID matching is added.
- `itemSlots` is empty for all affixes — slot filtering not present in source data. Story 5.5 will add slot-scoped filtering another way.
- Pre-existing test failures in ProviderSelector.test.tsx and Settings.test.tsx (6 total) were present before this story; no new regressions introduced.
- TypeScript `tsc --noEmit` passes cleanly. All 2 new tests pass; full suite: 645 pass, 6 pre-existing failures.

### File List

**Created:**
- `docs/data-transform/generate_item_db.py`
- `lebo/src-tauri/resources/items/base-items.json`
- `lebo/src-tauri/resources/items/uniques.json`
- `lebo/src-tauri/resources/items/affixes.json`
- `lebo/src/shared/types/itemDatabase.ts`
- `lebo/src-tauri/src/models/item_data.rs`
- `lebo/src-tauri/src/services/item_data_service.rs`
- `lebo/src-tauri/src/commands/item_commands.rs`
- `lebo/src/features/item-database/itemDatabaseLoader.ts`
- `lebo/src/features/item-database/itemDatabaseLoader.test.ts`

**Modified:**
- `lebo/src-tauri/tauri.conf.json`
- `lebo/src-tauri/src/models/mod.rs`
- `lebo/src-tauri/src/services/mod.rs`
- `lebo/src-tauri/src/commands/mod.rs`
- `lebo/src-tauri/src/lib.rs`
- `lebo/src/shared/types/errors.ts`
- `lebo/src/shared/utils/errorNormalizer.ts`
- `lebo/src/shared/stores/gameDataStore.ts`
- `lebo/src/App.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
