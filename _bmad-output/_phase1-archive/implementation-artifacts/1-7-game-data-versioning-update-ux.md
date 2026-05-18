# Story 1.7: Game Data Versioning & Update UX

Status: done

## Story

As an advanced Last Epoch player,
I want to know when my skill tree data is outdated and be able to update it with one click,
So that I can be confident my builds reflect the current game version and my optimization suggestions are accurate.

## Acceptance Criteria

1. **Given** the app launches with internet connectivity
   **When** the launch-time `check_data_version` command runs
   **Then** the local manifest's `gameVersion` is compared against the remote manifest's latest version
   **And** if local data is behind: an amber staleness banner appears above the tree canvas: "Game data is [N version(s)] behind. Suggestions may be inaccurate. [Update Now]"
   **And** the status bar shows the current data version and last-updated date (e.g., "Data: v1.4.4 — 2026-04-15")

2. **Given** game data is up to date
   **When** the user views the status bar
   **Then** the data version and last-updated date are displayed without any staleness warning

3. **Given** a staleness warning is displayed
   **When** the user clicks "Update Now"
   **Then** the system fetches the latest game data files from the remote source
   **And** a progress indicator shows while downloading ("Downloading...")
   **And** on success: the staleness banner clears, the version display updates, and `useGameDataStore` is refreshed

4. **Given** the data update download fails
   **When** the update attempt completes with failure
   **Then** an error message identifies the failure type with a Retry option
   **And** the app continues operating with the existing local data — no crash or data loss

5. **Given** a staleness warning is shown
   **When** the user clicks "Continue with current data" or dismisses the banner
   **Then** the banner dismisses for this session and the user proceeds normally
   **And** the status bar continues showing the current data version so staleness remains visible (FR36)

## Tasks / Subtasks

- [x] Task 1: Extend `gameDataStore` — add `dataUpdatedAt` and `isUpdating` fields (AC: 1, 2, 3)
  - [x] Add `dataUpdatedAt: string | null` (default `null`) and `setDataUpdatedAt: (date: string) => void`
  - [x] Add `isUpdating: boolean` (default `false`) and `setIsUpdating: (updating: boolean) => void`

- [x] Task 2: Add `DataVersionCheckResult` to Rust models (AC: 1, 2)
  - [x] Add `DataVersionCheckResult` struct to `src-tauri/src/models/game_data.rs`
  - [x] Add to TypeScript types: `DataVersionCheckResult` interface in `src/shared/types/gameData.ts`

- [x] Task 3: Implement `check_data_version` and `download_game_data_update` Rust commands (AC: 1, 3, 4)
  - [x] Add `REMOTE_DATA_BASE_URL` constant to `game_data_service.rs`
  - [x] Add `fetch_remote_manifest` and `download_class_files` to `game_data_service.rs`
  - [x] Replace `check_data_freshness` stub with `check_data_version` in `game_data_commands.rs`
  - [x] Add `download_game_data_update` to `game_data_commands.rs`
  - [x] Update `lib.rs` handler registrations

- [x] Task 4: Update `gameDataLoader.ts` — populate version fields and fire staleness check (AC: 1, 2, 3)
  - [x] `loadAllClasses()` populates `dataVersion` and `dataUpdatedAt` from manifest
  - [x] `checkDataVersion()` exported, calls command, updates store
  - [x] `initGameData()` fires `checkDataVersion()` non-blocking after successful load
  - [x] `triggerDataUpdate()` exported — manages `isUpdating`, calls download command, refreshes
  - [x] `refreshGameData()` exported — reloads classes without re-init

- [x] Task 5: Create `src/features/game-data/DataStalenessBar.tsx` (AC: 1, 3, 4, 5)
  - [x] Only renders when `isStale && !stalenessAcknowledged`
  - [x] Amber banner with `role="alert"` and `aria-live="assertive"`
  - [x] "Update Now" (disabled when `isUpdating || isOptimizing`, shows "Downloading…" when updating)
  - [x] Error state with Retry button
  - [x] "Continue with current data" dismiss button

- [x] Task 6: Update `src/features/layout/CenterCanvas.tsx` (AC: 1, 3, 5)
  - [x] `DataStalenessBar` rendered above `SkillTreeView`

- [x] Task 7: Update `src/features/layout/StatusBar.tsx` (AC: 1, 2)
  - [x] `dataUpdatedAt` shown as "Data: {version} — {date}" when both set

- [x] Task 8: Write tests (AC: 1, 2, 3, 4, 5)
  - [x] `gameDataStore.test.ts`: 3 new tests (dataUpdatedAt, isUpdating, versionsBehind)
  - [x] `DataStalenessBar.test.tsx`: 7 tests (all 6 spec + optimization-lock test)
  - [x] `StatusBar.test.tsx`: 2 new tests
  - [x] `gameDataLoader.test.ts`: 4 new tests (dataVersion, dataUpdatedAt, checkDataVersion stale, checkDataVersion fresh)

- [x] Task 9: Validate (AC: 1–5)
  - [x] `pnpm tsc --noEmit` → zero errors
  - [x] `pnpm vitest run` → 127/127 tests pass (16 files, 16 new tests)

### Review Findings

- [x] [Review][Patch] `refreshGameData` calls `acknowledgeStaleness()` — wrong semantic; update path should not set the dismiss flag, only clear staleness [`lebo/src/features/game-data/gameDataLoader.ts:31`]
- [x] [Review][Patch] `fetch_remote_manifest` and `download_class_files` do not check HTTP status codes; 4xx/5xx responses fail with misleading parse errors [`lebo/src-tauri/src/services/game_data_service.rs:72-109`]
- [x] [Review][Defer] Sequential class downloads in `download_class_files` (5 requests, no concurrency) — deferred, pre-existing MVP perf tradeoff
- [x] [Review][Defer] No guard for `versionsBehind: 0` when `isStale: true` in banner text — deferred, currently impossible with Rust logic

## Dev Notes

### Remote URL and Hosting Strategy

The remote data endpoint is defined as a constant in `game_data_service.rs`:

```rust
const REMOTE_DATA_BASE_URL: &str = "https://raw.githubusercontent.com/alec-vautherot/lebo-data/main";
```

This repository must contain the same directory layout as the bundled resources:
- `manifest.json` (root)
- `classes/sentinel.json`, `classes/mage.json`, etc.

This URL is a placeholder — update to the actual repository URL before shipping. Until the repo exists, `check_data_version` will return a network error that is silently swallowed (stale banner never appears, which is correct: no false positives on connectivity failure).

### HTTP Pattern in Rust

`tauri-plugin-http` re-exports `reqwest`:

```rust
use tauri_plugin_http::reqwest;

pub async fn fetch_remote_manifest(base_url: &str) -> Result<GameDataManifest, String> {
    let url = format!("{}/manifest.json", base_url);
    let response = reqwest::get(&url).await
        .map_err(|e| format!("NETWORK_ERROR: fetch remote manifest: {}", e))?;
    let text = response.text().await
        .map_err(|e| format!("NETWORK_ERROR: read remote manifest: {}", e))?;
    serde_json::from_str::<GameDataManifest>(&text)
        .map_err(|e| format!("STORAGE_ERROR: parse remote manifest: {}", e))
}
```

### Store Fields Added

```ts
// gameDataStore.ts additions:
dataUpdatedAt: string | null       // ISO date string from manifest.generatedAt
isUpdating: boolean                 // true while download_game_data_update is running
versionsBehind: number              // 0 = up to date; ≥1 = stale banner N
setDataUpdatedAt: (date: string) => void
setIsUpdating: (updating: boolean) => void
setVersionsBehind: (n: number) => void
```

### `versionsBehind` Computation

Rust returns `versions_behind: u32`. For MVP, the computation is simple:

```rust
fn compute_versions_behind(local: &str, remote: &str) -> u32 {
    if local == remote { 0 } else { 1 }
}
```

Full semver distance deferred to a future story.

### DataStalenessBar Tests (6)

1. Does not render when `isStale` is false
2. Does not render when `isStale=true` but `stalenessAcknowledged=true`
3. Renders amber banner with version count when `isStale=true && !stalenessAcknowledged`
4. "Update Now" is disabled and shows "Downloading..." when `isUpdating=true`
5. "Continue with current data" calls `acknowledgeStaleness` when clicked
6. Shows error message with Retry button when `updateError` is set

### Update Flow

```
DataStalenessBar [Update Now] clicked
  → triggerDataUpdate() in gameDataLoader.ts
    → setIsUpdating(true)
    → invokeCommand('download_game_data_update')
    → on success: refreshGameData() → loadAllClasses() (re-reads disk, re-populates store)
                  setIsStale(false), setVersionsBehind(0), setIsUpdating(false)
    → on failure: setIsUpdating(false), set local updateError state in component
```

### Optimization Lock

The "Update Now" button is disabled when `useOptimizationStore(s => s.isOptimizing)` is true. The epics specify queueing the update after optimization completes — for this story, simply disabling the button is sufficient (no queue implemented).

### Non-blocking Version Check

```ts
// In initGameData():
// Fire-and-forget — never blocks UI startup
checkDataVersion().catch(() => {})
```

Network failure on `check_data_version` is silently ignored. The app operates normally with local data. This matches AC for graceful degradation.

### `refreshGameData()` vs `initGameData()`

- `initGameData()`: full init — `initialize_game_data` (copy bundled) + `load_game_data` + `get_manifest` + populate store + check version
- `refreshGameData()`: reload only — `load_game_data` + `get_manifest` + populate store (skips bundled copy, no recursive version check)

### Previous Story Learnings

- No `index.ts` barrel files — import directly
- Tailwind v4 CSS-first — use `var(--color-*)` tokens
- `EMPTY_*` constants at module level for stable references
- All Tauri calls go through `invokeCommand` (never raw invoke)
- Error normalization via `normalizeAppError`

### References

- `src/shared/stores/gameDataStore.ts` — modify
- `src/features/game-data/gameDataLoader.ts` — modify
- `src/features/layout/CenterCanvas.tsx` — modify
- `src/features/layout/StatusBar.tsx` — modify
- `src-tauri/src/commands/game_data_commands.rs` — modify
- `src-tauri/src/services/game_data_service.rs` — modify
- `src-tauri/src/models/game_data.rs` — modify
- `src-tauri/src/lib.rs` — modify

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- All 9 tasks complete. `pnpm tsc --noEmit` → zero errors. `pnpm vitest run` → 127/127 tests pass (16 files, 16 new tests across 5 files).
- `gameDataStore` extended with `dataUpdatedAt`, `isUpdating`, `versionsBehind` and their setters. All new fields have stable defaults (null / false / 0).
- `gameDataLoader.ts` now populates `dataVersion` (from `manifest.gameVersion`) and `dataUpdatedAt` (from `manifest.generatedAt`) in `loadAllClasses()`. The staleness check fires non-blocking (`checkDataVersion().catch(() => {})`) so network failure never delays UI startup.
- Rust `check_data_version` command replaces the 1.3b stub. It fetches remote manifest via `tauri_plugin_http::reqwest`, compares `game_version` fields, and returns `DataVersionCheckResult`. `REMOTE_DATA_BASE_URL` constant must be updated to the actual GitHub repo URL before shipping.
- `download_game_data_update` writes class files before overwriting `manifest.json` so a partial download failure leaves the old manifest intact (existing local data remains valid — AC4).
- `DataStalenessBar` is a standalone component that uses local `updateError` state for error display; all store fields are read-only from the component. Update is blocked when `isUpdating || isOptimizing`.
- `CenterCanvas` layout changed from `flex-1` to `flex flex-col flex-1` to accommodate the staleness bar above the skill tree.
- `StatusBar` now shows "Data: {version} — {date}" format using `dataUpdatedAt.split('T')[0]` for the date portion.
- `refreshGameData()` skips the bundled-copy step (`initialize_game_data`) intentionally — after a download the manifest is already fresh in the data dir.

### File List

**New files:**
- `lebo/src/features/game-data/DataStalenessBar.tsx`
- `lebo/src/features/game-data/DataStalenessBar.test.tsx`

**Modified files:**
- `lebo/src/shared/stores/gameDataStore.ts`
- `lebo/src/shared/stores/gameDataStore.test.ts`
- `lebo/src/shared/types/gameData.ts`
- `lebo/src/features/game-data/gameDataLoader.ts`
- `lebo/src/features/game-data/gameDataLoader.test.ts`
- `lebo/src/features/layout/CenterCanvas.tsx`
- `lebo/src/features/layout/StatusBar.tsx`
- `lebo/src/features/layout/StatusBar.test.tsx`
- `lebo/src-tauri/src/models/game_data.rs`
- `lebo/src-tauri/src/services/game_data_service.rs`
- `lebo/src-tauri/src/commands/game_data_commands.rs`
- `lebo/src-tauri/src/lib.rs`

## Change Log

| Date | Change |
|------|--------|
| 2026-04-23 | Story file created from epics spec. Status → in-progress. |
| 2026-04-23 | All 9 tasks implemented. 127/127 tests pass (16 new tests across 5 files). Status → review. |
| 2026-04-23 | Code review complete. 2 patches applied (refreshGameData semantic, HTTP status checks). Status → done. |
