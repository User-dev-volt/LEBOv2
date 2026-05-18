# Story 5.6: Item Data Freshness Check and StalenessBar Extension

Status: done

## Story

As a theory-crafter,
I want to be notified when a newer item database version is available and be able to update it in one click, without being blocked from using the app while the update is pending,
so that my item database stays current with Last Epoch patches.

## Acceptance Criteria

**AC1 — Item data staleness banner:**
Given the app launches and `check_item_data_freshness()` Rust command runs in the background,
when the local `itemDataVersion` in the manifest is older than the remote version,
then a staleness banner appears: "Item database updated. Refresh?" with an "Update" CTA and "Dismiss" link (FR33, FR48).

**AC2 — Stacked banners when both stale:**
Given both game data AND item data are stale simultaneously,
when the staleness banners render,
then two separate banners appear stacked (one per data type); each has its own Update/Dismiss controls (UX-DR6).

**AC3 — Update flow with "Updated ✓" feedback:**
Given the player clicks "Update" on the item data banner,
when `update_item_data()` Rust command runs,
then the button shows a spinner (aria-busy="true"), item files are downloaded and atomically replaced (temp-file-then-rename), the banner shows "Updated ✓" for 2 seconds then disappears, and `useGameDataStore.itemDatabase` reloads with the new data (FR50).

**AC4 — Update failure leaves existing data intact:**
Given the update download fails mid-transfer,
when the error is caught,
then existing item data files are intact (no corruption, atomic pattern guarantees this), the banner returns to its pre-update state, and no error toast appears — the banner itself remains as the retry signal (NFR9).

**AC5 — Rust commands in the right files:**
`check_item_data_freshness()` and `update_item_data()` are implemented in `src-tauri/src/commands/item_commands.rs` and registered in `lib.rs`.

**AC6 — Additive, non-breaking DataStalenessBar extension:**
`DataStalenessBar.tsx` is extended to render an item data banner when `isItemDataStale && !itemDataStaleAcknowledged`; the existing game data banner is unchanged.

## Tasks / Subtasks

- [x] Task 1: Extend `GameDataManifest` Rust struct and bundled manifest (AC1, AC5)
  - [x] 1.1: Add `item_data_version: Option<String>` with `#[serde(default)]` to `GameDataManifest` in `src-tauri/src/models/game_data.rs`
  - [x] 1.2: Add `"itemDataVersion": "1.0.0"` field to `src-tauri/resources/game-data/manifest.json` (bump `schemaVersion` to 2)

- [x] Task 2: Add `check_item_data_freshness()` and `update_item_data()` to `item_commands.rs` (AC1, AC3, AC4, AC5)
  - [x] 2.1: Implement `check_item_data_freshness()` — load local manifest, fetch remote manifest via `game_data_service::fetch_remote_manifest()`, compare `itemDataVersion`, return `DataVersionCheckResult`
  - [x] 2.2: Make `game_data_service::http_client()` pub (or duplicate it in `item_data_service.rs`) so item commands can make HTTP requests
  - [x] 2.3: Add `REMOTE_DATA_BASE_URL` re-export or import from `game_data_service` for use in item update downloads
  - [x] 2.4: Implement `update_item_data()` — download items atomically from remote (temp→rename per file), then surgically update only `itemDataVersion` in local manifest

- [x] Task 3: Register new commands in `lib.rs` (AC5)
  - [x] 3.1: Add `check_item_data_freshness` and `update_item_data` to `use commands::item_commands::` imports
  - [x] 3.2: Add both to `invoke_handler!` macro

- [x] Task 4: Extend `gameDataStore.ts` with item data staleness slice (AC1, AC2, AC3)
  - [x] 4.1: Add `isItemDataStale: boolean`, `itemDataStaleAcknowledged: boolean`, `isItemDataUpdating: boolean` fields and corresponding setters
  - [x] 4.2: Initialize all three to `false` in the store

- [x] Task 5: Add `checkItemDataFreshness()` and `triggerItemDataUpdate()` to `itemDatabaseLoader.ts` (AC1, AC3, AC4)
  - [x] 5.1: Implement `checkItemDataFreshness()` — `invokeCommand<DataVersionCheckResult>('check_item_data_freshness')`, update store `isItemDataStale`
  - [x] 5.2: Implement `triggerItemDataUpdate()` — `setIsItemDataUpdating(true)`, invoke `update_item_data`, call `loadItemDatabase()` to reload, clear `isItemDataStale` + `setIsItemDataUpdating(false)` in finally
  - [x] 5.3: Call `checkItemDataFreshness().catch(() => {})` (non-blocking, fire-and-forget) from `initGameData()` in `gameDataLoader.ts` — mirror the existing `checkDataVersion` pattern

- [x] Task 6: Extend `DataStalenessBar.tsx` with item data banner (AC2, AC3, AC4)
  - [x] 6.1: Add item data staleness state selectors from `useGameDataStore`
  - [x] 6.2: Add `showItemSuccess` local state (`boolean`, drives "Updated ✓" display)
  - [x] 6.3: Implement `handleItemUpdate()` — call `triggerItemDataUpdate()`, on resolve set `showItemSuccess(true)` + `setTimeout(() => { setShowItemSuccess(false); acknowledgeItemStaleness() }, 2000)`, on reject reset to error state inside banner
  - [x] 6.4: Render item data banner block **below** existing game data banner block when `isItemDataStale && !itemDataStaleAcknowledged`
  - [x] 6.5: Button must have `aria-busy="true"` during update; banner must have `role="status"` and `aria-live="polite"` (distinct from game data banner's `role="alert"` + `aria-live="assertive"`)

- [x] Task 7: Wire startup in `App.tsx` (AC1)
  - [x] 7.1: Verify `checkItemDataFreshness` is called inside `initGameData()` (Task 5.3); no additional change needed in `App.tsx` if so. If wired differently, add non-blocking call alongside existing `checkDataVersion` in startup effect.

- [x] Task 8: Tests
  - [x] 8.1: Add `checkItemDataFreshness` tests to `itemDatabaseLoader.test.ts` — stale result sets `isItemDataStale=true`, fresh result leaves it false
  - [x] 8.2: Add `triggerItemDataUpdate` tests to `itemDatabaseLoader.test.ts` — sets `isItemDataUpdating` true then false, calls `update_item_data` then `load_item_database`, clears `isItemDataStale` on success, clears `isItemDataUpdating` even on reject
  - [x] 8.3: Add item banner tests to `DataStalenessBar.test.tsx` — banner hidden when `isItemDataStale=false`, renders with correct text when stale, "Update" disabled during `isItemDataUpdating`, "Dismiss" calls `acknowledgeItemStaleness`, both banners render simultaneously when both data types are stale

## Dev Notes

### File Path Correction — CRITICAL

The epics file (AC6) incorrectly references `src/components/StalenessBar.tsx`. **The actual file is `src/features/game-data/DataStalenessBar.tsx`.** Do NOT create a new file at the epics path. Extend `DataStalenessBar.tsx` in place.

### Rust Side — Pattern to Follow

The entire Rust pattern is established by the existing game data freshness check. Mirror it exactly:

**Existing game data check** (`game_data_commands.rs`):
```rust
pub async fn check_data_version(app_handle) -> Result<DataVersionCheckResult, String> {
    let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
    let local = game_data_service::load_manifest(&data_dir)?;
    let remote = game_data_service::fetch_remote_manifest(REMOTE_DATA_BASE_URL).await?;
    let is_stale = local.game_version != remote.game_version;
    let versions_behind = if is_stale { 1 } else { 0 };
    Ok(DataVersionCheckResult { is_stale, local_version: local.game_version, remote_version: remote.game_version, versions_behind })
}
```

**New item check** (`item_commands.rs`) — follow the same shape but compare `item_data_version`:
- Local version: `local.item_data_version.unwrap_or_default()`
- Remote version: `remote.item_data_version.unwrap_or_default()`
- Stale if both are non-empty and they differ. If remote has no `itemDataVersion`, treat as not stale (graceful degradation).

**`update_item_data()` atomic write pattern** (already used in `game_data_commands.rs` and required by architecture):
```rust
let temp_path = dest_path.with_extension("tmp");
tokio::fs::write(&temp_path, &content).await?;
tokio::fs::rename(&temp_path, &dest_path).await?;
```
Apply this per-file for `base-items.json`, `uniques.json`, `affixes.json`.

**Remote item URL:** `{REMOTE_DATA_BASE_URL}/items/{filename}` — same base URL as game data (`https://raw.githubusercontent.com/alec-vautherot/lebo-data/main`). `REMOTE_DATA_BASE_URL` is `pub const` in `game_data_service.rs` — import it in `item_commands.rs` via `use crate::services::game_data_service::REMOTE_DATA_BASE_URL`.

**After downloading item files:** Surgically update only `itemDataVersion` in the local manifest — do NOT write the full remote manifest (that would overwrite game data's staleness state). Load local manifest, update its `item_data_version` field, serialize, write atomically.

**HTTP client:** `game_data_service::http_client()` is currently `fn` (private). Make it `pub fn` so `item_commands.rs` can import it. Alternatively, add an equivalent `pub fn` to `item_data_service.rs`. Changing `game_data_service::http_client` to `pub` is the DRY choice.

**Error prefix:** Use `ITEM_DATA_ERROR:` prefix for all errors in item commands (consistent with `item_data_service.rs` pattern). Network errors use `NETWORK_ERROR:` (consistent with `game_data_service.rs`).

**`GameDataManifest` struct change** — add with `#[serde(default)]` so existing v1 manifests (without `itemDataVersion`) deserialize without error:
```rust
#[serde(rename_all = "camelCase")]
pub struct GameDataManifest {
    pub schema_version: u32,
    pub game_version: String,
    pub data_version: String,
    pub generated_at: String,
    pub classes: Vec<String>,
    #[serde(default)]
    pub item_data_version: Option<String>,  // add this
}
```

### TypeScript Side — Store Extension

Extend `useGameDataStore` in `src/shared/stores/gameDataStore.ts`. Do NOT create a new store. The store currently has:
- `isStale`, `stalenessAcknowledged`, `isUpdating` (game data)
- `itemDatabase` (item data load)

Add three new fields mirroring the game data staleness shape:
```typescript
isItemDataStale: boolean
itemDataStaleAcknowledged: boolean
isItemDataUpdating: boolean
// setters:
setIsItemDataStale: (stale: boolean) => void
acknowledgeItemDataStaleness: () => void
setIsItemDataUpdating: (updating: boolean) => void
```

### TypeScript Side — `itemDatabaseLoader.ts`

Reuse the `DataVersionCheckResult` type — it's already in `src/shared/types/gameData.ts` and returned by the Rust command. Import it there.

`checkItemDataFreshness` structure mirrors `checkDataVersion` in `gameDataLoader.ts`:
```typescript
export async function checkItemDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_item_data_freshness')
  useGameDataStore.getState().setIsItemDataStale(result.isStale)
}
```

`triggerItemDataUpdate` mirrors `triggerDataUpdate` in `gameDataLoader.ts`, plus reloads item database:
```typescript
export async function triggerItemDataUpdate(): Promise<void> {
  const { setIsItemDataUpdating, setIsItemDataStale } = useGameDataStore.getState()
  setIsItemDataUpdating(true)
  try {
    await invokeCommand('update_item_data')
    await loadItemDatabase()          // reload into store
    setIsItemDataStale(false)
  } finally {
    setIsItemDataUpdating(false)
  }
}
```

Call `checkItemDataFreshness().catch(() => {})` inside `initGameData()` in `gameDataLoader.ts`, immediately after the existing `checkDataVersion().catch(() => {})` line. This keeps all data freshness checks co-located at startup.

### TypeScript Side — `DataStalenessBar.tsx` Extension

The existing game data banner uses `role="alert"` + `aria-live="assertive"` (high urgency). The item data banner should use `role="status"` + `aria-live="polite"` (lower urgency) per architecture spec.

"Updated ✓" is a local state in the component (not in the store). After `handleItemUpdate()` resolves:
1. Set `showItemSuccess(true)` — banner switches to "Updated ✓" text
2. `setTimeout(() => { setShowItemSuccess(false); acknowledgeItemDataStaleness() }, 2000)` — 2s later, banner disappears
3. No success state needed in the store — the component handles it locally

If `handleItemUpdate()` rejects: catch the error, store it in local state (like `updateItemError`), show error inline in the banner. Do NOT call `toast()`. Do NOT call `acknowledgeItemDataStaleness()`.

During update: button text changes to "Downloading…", `disabled={true}`, `aria-busy="true"`.

Structure of the component after extension — render order:
1. Game data banner (existing — unchanged) — renders when `isStale && !stalenessAcknowledged`
2. Item data banner (new) — renders when `isItemDataStale && !itemDataStaleAcknowledged`

Both can be visible simultaneously (AC2). Keep each banner as a separate JSX block; do not merge them into one component with conditional text.

Item banner text (AC1): "Item database updated. Refresh?" with "Update" CTA and "Dismiss" link. On success (showItemSuccess): "Item database updated ✓".

### TypeScript Side — Types

`DataVersionCheckResult` is already defined in `src/shared/types/gameData.ts` and is the return type of `check_item_data_freshness()`. No new type file is needed.

### App.tsx — No Changes Expected

If `checkItemDataFreshness()` is called inside `initGameData()` (Task 5.3), App.tsx needs no changes — `initGameData()` is already called in the startup `useEffect`. Confirm before finishing Task 7.

### Bundled Manifest Update

The bundled `manifest.json` at `src-tauri/resources/game-data/manifest.json` must gain `"itemDataVersion": "1.0.0"` so that freshly installed apps have a baseline version to compare against. Also bump `"schemaVersion"` to `2`. This file is copied to app data on first launch via `copy_bundled_resources()`.

### Testing Patterns

Tests for `checkItemDataFreshness` and `triggerItemDataUpdate` in `itemDatabaseLoader.test.ts`:
- Mock `invokeCommand` via `vi.mock('../../shared/utils/invokeCommand', ...)`
- Reset store state in `beforeEach` via `useGameDataStore.setState(initialState, true)`
- `triggerItemDataUpdate` test must verify: `isItemDataUpdating` goes `true` then `false`, `update_item_data` invoked before `load_item_database`, `isItemDataStale` becomes `false` on success

Tests for `DataStalenessBar` item banner in `DataStalenessBar.test.tsx`:
- Mock `./gameDataLoader` (game data) AND `../../features/item-database/itemDatabaseLoader` (item data) — wait, check imports in the component to know which module to mock
- Pattern: `vi.mock('./itemDatabaseLoader', () => ({ triggerItemDataUpdate: vi.fn() }))`
- Test that both banners render simultaneously: set both `isStale=true` and `isItemDataStale=true`, confirm two distinct role elements appear

### Project Context Rules (Critical)

- **No barrel files** — `itemDatabaseLoader.ts` exports are already named exports; keep it that way
- **Always use `invokeCommand<T>()`** — never raw `invoke()` from `@tauri-apps/api/core`
- **Four stores only** — extend `useGameDataStore`; do NOT create a new store
- **TypeScript strict mode** — every new field must be typed; no implicit `any`
- **Error normalization** — `ITEM_DATA_ERROR:` prefix in Rust maps to `ErrorType.ITEM_DATA_ERROR` in TypeScript via `normalizeAppError`; no new error types needed for this story
- **No atomic-write bypass** — item file writes MUST use temp-file-then-rename; never `fs::write` directly to final path

### Previous Story Learnings (from 5-5)

- **Functional state updater pattern** matters when state reads happen inside closures — use `setIsItemDataUpdating(false)` in `finally` block directly (no closure issue since it's a setter, not a state read)
- **Deferred 5-5 items** (not this story's concern): no removal of custom affixes, `+` button when `itemDatabase` is null, AffixPicker re-open edge case
- **AffixPicker** was created at `src/features/item-database/AffixPicker.tsx` — this story does not touch item-database feature files except `itemDatabaseLoader.ts`
- **Test mock strategy**: the existing `DataStalenessBar.test.tsx` mocks `./gameDataLoader` — when adding item data mocks, also mock the item loader module

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.6] — ACs, user story, story key
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 4] — Rust commands, StalenessBar extension, atomic write pattern, remote URL pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#StalenessBar Component Extension] — two-banner stacking, `isItemDataStale` field
- [Source: _bmad-output/planning-artifacts/prd.md#FR33, FR48, FR50] — functional requirements driving this story
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component 6, Journey 4] — banner text, states, aria attributes
- [Source: lebo/src-tauri/src/commands/game_data_commands.rs] — mirror pattern for `check_item_data_freshness` and `update_item_data`
- [Source: lebo/src-tauri/src/services/game_data_service.rs] — `fetch_remote_manifest`, `http_client`, `REMOTE_DATA_BASE_URL`
- [Source: lebo/src-tauri/src/models/game_data.rs] — `GameDataManifest` struct to extend; `DataVersionCheckResult` to reuse
- [Source: lebo/src/shared/stores/gameDataStore.ts] — store to extend
- [Source: lebo/src/features/game-data/gameDataLoader.ts] — `checkDataVersion` + `triggerDataUpdate` patterns to mirror
- [Source: lebo/src/features/game-data/DataStalenessBar.tsx] — component to extend (NOT src/components/StalenessBar.tsx)
- [Source: lebo/src/features/game-data/DataStalenessBar.test.tsx] — test mock patterns to follow
- [Source: lebo/src/features/item-database/itemDatabaseLoader.ts] — file to extend with freshness + update functions
- [Source: lebo/src-tauri/resources/game-data/manifest.json] — bundled manifest to update

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `vi.useFakeTimers()` conflicts with `userEvent.click()` in this project's Vitest/jsdom setup. Workaround: spy on `globalThis.setTimeout` and pass through non-2000ms timeouts to `realSetTimeout` so `userEvent` internals continue to function.

### Completion Notes List

- All 8 tasks and subtasks implemented and verified passing.
- Rust: `GameDataManifest` extended with `#[serde(default)] item_data_version: Option<String>`; bundled `manifest.json` bumped to `schemaVersion: 2` with `itemDataVersion: "1.0.0"`.
- Rust: `game_data_service::http_client()` made `pub`; `check_item_data_freshness()` and `update_item_data()` added to `item_commands.rs`; both registered in `lib.rs`.
- TypeScript: `useGameDataStore` extended with `isItemDataStale`, `itemDataStaleAcknowledged`, `isItemDataUpdating` + setters.
- TypeScript: `itemDatabaseLoader.ts` extended with `checkItemDataFreshness()` and `triggerItemDataUpdate()`. `initGameData()` in `gameDataLoader.ts` calls both version checks non-blocking at startup.
- TypeScript: `DataStalenessBar.tsx` restructured to render two independent banners (game data: `role="alert"` assertive; item data: `role="status"` polite). Both visible simultaneously when both stale (AC2).
- 22 new tests pass; 8 pre-existing failures (ProviderSelector, Settings, SkillTreeCanvas, TreeControls) unchanged.

### File List

- `lebo/src-tauri/src/models/game_data.rs` — added `item_data_version: Option<String>` to `GameDataManifest`
- `lebo/src-tauri/resources/game-data/manifest.json` — bumped `schemaVersion` to 2, added `itemDataVersion: "1.0.0"`
- `lebo/src-tauri/src/services/game_data_service.rs` — made `http_client()` pub
- `lebo/src-tauri/src/commands/item_commands.rs` — added `check_item_data_freshness` and `update_item_data` commands
- `lebo/src-tauri/src/lib.rs` — registered both new commands in `invoke_handler!`
- `lebo/src/shared/stores/gameDataStore.ts` — added item data staleness slice
- `lebo/src/features/item-database/itemDatabaseLoader.ts` — added `checkItemDataFreshness` and `triggerItemDataUpdate`
- `lebo/src/features/game-data/gameDataLoader.ts` — added `checkItemDataFreshness` call in `initGameData`
- `lebo/src/features/game-data/DataStalenessBar.tsx` — extended with item data banner
- `lebo/src/features/game-data/DataStalenessBar.test.tsx` — added 9 new item banner tests
- `lebo/src/features/item-database/itemDatabaseLoader.test.ts` — added `checkItemDataFreshness` and `triggerItemDataUpdate` tests

### Review Findings

- [x] [Review][Patch] `update_item_data` writes empty string to manifest when remote has no `itemDataVersion` [lebo/src-tauri/src/commands/item_commands.rs]
- [x] [Review][Patch] No `clearTimeout` on unmount — stale setState + acknowledgeItemDataStaleness fires after component teardown [lebo/src/features/game-data/DataStalenessBar.tsx]
- [x] [Review][Patch] Double-click can dispatch two concurrent `update_item_data` Tauri calls before `isItemDataUpdating` re-render disables button [lebo/src/features/game-data/DataStalenessBar.tsx]
- [x] [Review][Defer] Partial write leaves mixed-version item DB when network fails mid-loop — deferred, spec-prescribed sequential architecture; recoverable by retry
- [x] [Review][Defer] `itemDataStaleAcknowledged` never resets after successful update — deferred, matches existing game data banner pattern; only startup check fires
- [x] [Review][Defer] `schemaVersion` bumped to 2 with no migration guard — deferred, `#[serde(default)]` handles backward compat
- [x] [Review][Defer] TOCTOU: remote manifest fetched independently by check and update commands — deferred, inherent to command-per-operation architecture
- [x] [Review][Defer] `versions_behind` always 0 or 1 in item freshness check — deferred, matches game data check pattern
- [x] [Review][Defer] `http_client()` promoted to `pub` for reuse — deferred, DRY choice per dev notes; acceptable
- [x] [Review][Defer] `copy_bundled_item_resources` all-or-nothing check can preserve partial state from prior run — deferred, pre-existing behavior

## Change Log

- 2026-05-17: Implemented story 5-6 — item data freshness check and StalenessBar extension. Rust commands (`check_item_data_freshness`, `update_item_data`) added to `item_commands.rs`. `GameDataManifest` extended with `item_data_version`. TypeScript store, loader, and UI updated to mirror the existing game data staleness pattern. 22 new tests added, all passing.
