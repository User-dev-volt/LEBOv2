# Story 6.3: Manifest v2 and Atomic Data Update Pipeline

Status: done

## Story

As a developer,
I want manifest.json to track itemDataVersion, iconCacheVersion, and iconSource, and all data updates to use atomic temp-file-then-rename writes,
so that the app can version multiple data types independently and data files are never corrupted by interrupted downloads.

## Acceptance Criteria

**AC1 — Manifest v2 includes `itemDataVersion`, `iconCacheVersion`, `iconSource`:**
Given the existing manifest.json structure,
when manifest v2 is implemented,
then the manifest includes `itemDataVersion: "1.0.0"`, `iconCacheVersion: "1.0.0"`, and `iconSource: "game-files" | "community-cdn" | "placeholder"` as top-level fields alongside existing fields.

**AC2 — All Rust data file writes use atomic temp-file-then-rename:**
Given any Rust command writes a data file (icon cache entry, item database file, game data file),
when the write operation runs,
then it writes to a `.tmp` file in the same directory first, then calls `fs::rename` to atomically replace the final path; direct writes to final paths are never used.

**AC3 — Download failure leaves `.tmp` cleaned up and original intact:**
Given a data update download fails at any point before `fs::rename`,
when the error is handled,
then the `.tmp` file is cleaned up (removed if it exists), the existing final-path file is untouched, and the app retains the last valid data state (NFR9).

**AC4 — Successful item data update dismisses staleness banner:**
Given a successful `update_item_data()` Rust command,
when the update completes,
then the manifest's `itemDataVersion` is updated to the new version, `useGameDataStore.isItemDataStale` is set to false, and the StalenessBar banner for item data dismisses automatically.

**And** — `check_data_freshness()` and `check_item_data_freshness()` run in parallel at startup via `Promise.all` inside `initGameData()`; both complete (or silently error) before `initGameData()` resolves.

## Tasks / Subtasks

- [x] Task 1: Add `iconCacheVersion` and `iconSource` fields to Rust `GameDataManifest` (AC1)
  - [x] 1.1: In `lebo/src-tauri/src/models/game_data.rs`, add to `GameDataManifest`:
    ```rust
    #[serde(default)]
    pub icon_cache_version: Option<String>,
    #[serde(default)]
    pub icon_source: Option<String>,
    ```
  - [x] 1.2: Update bundled manifest at `lebo/src-tauri/resources/game-data/manifest.json` to include `"iconCacheVersion": "1.0.0"` and `"iconSource": "placeholder"` (default before icon pipeline runs)

- [x] Task 2: Extract a shared atomic write helper into `game_data_service.rs` (AC2, AC3)
  - [x] 2.1: Add `pub async fn atomic_write_file(path: &Path, data: &[u8]) -> Result<(), String>` to `lebo/src-tauri/src/services/game_data_service.rs`:
    - Write to `path.with_extension("tmp")` via `tokio::fs::write`
    - On write failure: best-effort remove the `.tmp` file, return error
    - On rename failure: best-effort remove the `.tmp` file, return error
    - On success: return `Ok(())`
  - [x] 2.2: Error message prefix: `"STORAGE_ERROR: ..."` (consistent with existing patterns)

- [x] Task 3: Fix `download_class_files` to use atomic writes (AC2, AC3)
  - [x] 3.1: In `game_data_service.rs:download_class_files`, replace `std::fs::write(&dest, &text)` with `atomic_write_file(&dest, text.as_bytes()).await`
  - [x] 3.2: This is an `async fn` — use `.await` (already done in the helper)

- [x] Task 4: Fix `download_game_data_update` manifest write to use atomic writes (AC2, AC3)
  - [x] 4.1: In `lebo/src-tauri/src/commands/game_data_commands.rs:download_game_data_update`, replace the final `std::fs::write(data_dir.join("manifest.json"), manifest_json)` with `game_data_service::atomic_write_file(&data_dir.join("manifest.json"), manifest_json.as_bytes()).await`

- [x] Task 5: Update `update_item_data` to use the shared helper (AC2, AC3)
  - [x] 5.1: In `lebo/src-tauri/src/commands/item_commands.rs`, replace the per-item `tokio::fs::write` + `tokio::fs::rename` + manual cleanup calls with `game_data_service::atomic_write_file(&dest_path, &content).await`
  - [x] 5.2: Replace the manifest `tokio::fs::write` + `tokio::fs::rename` calls with `game_data_service::atomic_write_file(&manifest_path, manifest_json.as_bytes()).await`
  - [x] 5.3: Remove the now-redundant manual temp variable declarations for items and manifest in `update_item_data`

- [x] Task 6: Update `initialize_icon_pipeline` to record `iconSource` in manifest (AC1)
  - [x] 6.1: In `lebo/src-tauri/src/commands/icon_commands.rs`, at the point where `iconSource` is determined (before emitting the event), call a new private helper `update_manifest_icon_source(&app_handle, icon_source_str)`
  - [x] 6.2: The helper:
    - Calls `game_data_service::ensure_game_data_dir(&app_handle)` to get the manifest dir
    - Calls `game_data_service::load_manifest(&data_dir)` — **wrap in `if let Ok(mut manifest)` to silently skip if manifest doesn't exist yet** (startup race condition: `initialize_icon_pipeline` may fire before `initialize_game_data` creates the manifest)
    - Sets `manifest.icon_source = Some(icon_source_str.to_string())` and `manifest.icon_cache_version = Some("1.0.0".to_string())`
    - Serializes and writes via `game_data_service::atomic_write_file` — any error is silently ignored (best-effort; the manifest will be correct on next launch)
  - [x] 6.3: Import `crate::services::game_data_service` at the top of `icon_commands.rs` (it's not currently imported)

- [x] Task 7: Add optional fields to TypeScript `GameDataManifest` type (AC1)
  - [x] 7.1: In `lebo/src/shared/types/gameData.ts`, add to the `GameDataManifest` interface:
    ```typescript
    itemDataVersion?: string
    iconCacheVersion?: string
    iconSource?: string
    ```
  - [x] 7.2: These are optional (`?`) because older cached manifests won't have them; existing code that reads the manifest won't break

- [x] Task 8: Change `initGameData` staleness checks from fire-and-forget to `await Promise.all` (final AC)
  - [x] 8.1: In `lebo/src/features/game-data/gameDataLoader.ts:initGameData`, replace:
    ```typescript
    checkDataVersion().catch(() => {})
    checkItemDataFreshness().catch(() => {})
    ```
    with:
    ```typescript
    await Promise.all([
      checkDataVersion().catch(() => {}),
      checkItemDataFreshness().catch(() => {}),
    ])
    ```
  - [x] 8.2: Both still swallow network errors silently (the `.catch(() => {})` is preserved)

- [x] Task 9: Tests (AC1–AC4)
  - [x] 9.1: **Rust: Add unit tests for `atomic_write_file` in `game_data_service.rs`**:
    - `atomic_write_success_creates_final_file`: verifies final file exists with correct content and no `.tmp` sibling
    - `atomic_write_fails_when_parent_dir_missing`: verifies `Err` with `STORAGE_ERROR:` prefix when parent dir is missing
  - [x] 9.2: **TypeScript: Updated `gameDataLoader.test.ts`** — added test `awaits both staleness checks before resolving`:
    - Mocks both checks with async yields; verifies both completed when `initGameData` resolves

## Dev Notes

### CRITICAL: Atomic Write Helper — Single Source of Truth

Extract the atomic write pattern into **one** `pub async fn atomic_write_file(path: &Path, data: &[u8]) -> Result<(), String>` in `game_data_service.rs`. All three locations that need atomic writes (`download_class_files`, `download_game_data_update`, `update_item_data`) plus the icon manifest update must call this single helper.

**Do NOT** duplicate the temp-file-then-rename logic in `item_commands.rs` again — that was the pre-story pattern. Use the shared helper.

**Cleanup contract:** The helper must remove the `.tmp` file on both write failure and rename failure. Use `let _ = std::fs::remove_file(&temp)` (blocking/synchronous is fine for cleanup — no need for `tokio::fs::remove_file` since this is error-path-only). Silently discard the remove result (the temp file may not exist if write failed before creating it).

**Error prefix:** Use `"STORAGE_ERROR: ..."` to match all existing write error patterns. Do NOT introduce a new error prefix for this helper.

### CRITICAL: `initialize_icon_pipeline` — Startup Race Condition

`App.tsx` fires `initGameData()` and `initializeIconPipeline()` concurrently (both are `.catch(console.error)` non-blocking). This means the manifest may not exist yet when the icon pipeline runs.

**Required pattern in `update_manifest_icon_source`:**
```rust
fn update_manifest_icon_source(app_handle: &tauri::AppHandle, icon_source: &str) {
    // Best-effort — silently skip if anything fails
    let Ok(data_dir) = game_data_service::ensure_game_data_dir(app_handle) else { return };
    let Ok(mut manifest) = game_data_service::load_manifest(&data_dir) else { return };
    manifest.icon_source = Some(icon_source.to_string());
    manifest.icon_cache_version = Some("1.0.0".to_string());
    if let Ok(json) = serde_json::to_string_pretty(&manifest) {
        let _ = std::fs::write(data_dir.join("manifest.json"), json);
        // Note: use synchronous write here (not atomic_write_file) since this is
        // best-effort and the async runtime isn't available in this non-async context.
        // If manifest write races with initialize_game_data, worst case is the field
        // is absent; it will be correct on subsequent launch.
    }
}
```

Wait — actually `initialize_icon_pipeline` is an `async fn`, so you CAN use `tokio::fs` and `.await`. Use `game_data_service::atomic_write_file` even here. Call it with `.await` inside the async function. The helper function `update_manifest_icon_source` can be an `async fn` or inlined.

The key point: **wrap the entire manifest update in a check**: if `load_manifest` fails (manifest not yet created), return from the helper without error or panic.

### CRITICAL: `update_item_data` Cleanup

The current implementation in `item_commands.rs` already has `tokio::fs::write` + `tokio::fs::rename` for item files, but no explicit cleanup on failure. After switching to `atomic_write_file`, the cleanup is handled by the shared helper. The manual temp variable declarations become unnecessary.

Current structure to replace (for each of the 3 item files):
```rust
let temp_path = dest_path.with_extension("tmp");
tokio::fs::write(&temp_path, &content).await.map_err(...)?;
tokio::fs::rename(&temp_path, &dest_path).await.map_err(...)?;
```
Replace with: `game_data_service::atomic_write_file(&dest_path, &content).await?;`

Similarly for the manifest write in `update_item_data` — replace with `atomic_write_file`.

### `download_class_files` — Async Context Mismatch Fixed

`download_class_files` in `game_data_service.rs` is an `async fn` but currently uses `std::fs::write` (blocking I/O). Switching to `atomic_write_file` (which uses `tokio::fs`) fixes this pre-existing blocking-in-async issue as a side effect.

### TypeScript: `GameDataManifest` — Optional Fields Only

Add `itemDataVersion?`, `iconCacheVersion?`, `iconSource?` as **optional** fields. The mock fixture `mockManifest` in `gameDataLoader.test.ts` does NOT need updating (optional fields can be absent). No other TypeScript code constructs `GameDataManifest` literals directly.

### TypeScript: `initGameData` — Promise.all Pattern

```typescript
// Before:
checkDataVersion().catch(() => {})
checkItemDataFreshness().catch(() => {})

// After:
await Promise.all([
  checkDataVersion().catch(() => {}),
  checkItemDataFreshness().catch(() => {}),
])
```

Both checks already swallow errors. `Promise.all` ensures both resolve before `setIsLoading(false)` in `initGameData`. The staleness banners appear as soon as `initGameData()` resolves (before any user interaction), satisfying the AC.

### Bundled Manifest — Add New Fields

`lebo/src-tauri/resources/game-data/manifest.json` needs two new fields:
```json
{
  "schemaVersion": 2,
  "gameVersion": "1.4.4",
  "dataVersion": "1.1.0",
  "generatedAt": "2026-04-22T00:00:00Z",
  "classes": ["sentinel", "mage", "primalist", "acolyte", "rogue"],
  "itemDataVersion": "1.0.0",
  "iconCacheVersion": "1.0.0",
  "iconSource": "placeholder"
}
```
Default to `"placeholder"` since the icon pipeline hasn't run yet on first launch.

### AC4 — Already Implemented in Prior Stories

AC4 (item update dismisses banner) is **already functionally complete** from stories 5.6 and 6.2. `triggerItemDataUpdate` in `itemDatabaseLoader.ts` already calls `setIsItemDataStale(false)` after the command succeeds, and `DataStalenessBar.tsx` already hides the item banner when `isItemDataStale` is false. The story's Rust-side AC4 (manifest `itemDataVersion` updated) is satisfied by the existing `update_item_data` command (it already writes `local.item_data_version = Some(remote_version)`). **Verify this still works after the `atomic_write_file` refactor, but do NOT rewrite the TypeScript flow.**

### No New Tauri Commands → No `lib.rs` Changes

This story adds no new Rust commands. `lib.rs` does NOT need editing.

### Rust Unit Test Pattern

Follow the existing test pattern in `icon_commands.rs` (bottom of file):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_dir(label: &str) -> PathBuf { ... }
    
    #[tokio::test]
    async fn atomic_write_success_creates_final_file() {
        let dir = temp_dir("atomic_success");
        let path = dir.join("test.json");
        atomic_write_file(&path, b"{}").await.unwrap();
        assert!(path.exists());
        assert!(!path.with_extension("tmp").exists());
        fs::remove_dir_all(&dir).ok();
    }
}
```
Note: tests in `game_data_service.rs` use `#[tokio::test]` for async (the `icon_commands.rs` tests are sync because they test sync helpers). Add `#[tokio::test]` for `atomic_write_file`.

### Previous Story Learnings (from 6-2)

- **`build.ts` vs `buildState.ts`**: In this story, similarly, the architecture doc mentions `manifest.json` but the Rust struct is `GameDataManifest` in `models/game_data.rs`. The TypeScript type is in `shared/types/gameData.ts`. Both already exist — extend them in place.
- **Optional fields prevent cascading changes**: Make `iconCacheVersion` and `iconSource` optional in both Rust (`Option<String>` with `#[serde(default)]`) and TypeScript (`?: string`). The mock fixture `mockManifest` in `gameDataLoader.test.ts` does not need updating.
- **No barrel files**: Do NOT create `index.ts` in any feature folder. Direct imports only.
- **TypeScript strict mode**: Every unused import is a compile error. Only import what's used.
- **Test co-location**: Tests sit next to their source file. No new test directories.

### Project Structure Notes

Files to modify (all existing — no new files):

| File | Change |
|------|--------|
| `lebo/src-tauri/src/models/game_data.rs` | Add `icon_cache_version` and `icon_source` optional fields |
| `lebo/src-tauri/src/services/game_data_service.rs` | Add `pub async fn atomic_write_file`; fix `download_class_files` |
| `lebo/src-tauri/src/commands/game_data_commands.rs` | Fix manifest write in `download_game_data_update` |
| `lebo/src-tauri/src/commands/icon_commands.rs` | Add manifest update after icon pipeline init |
| `lebo/src-tauri/src/commands/item_commands.rs` | Replace manual atomic write with `atomic_write_file` |
| `lebo/src/shared/types/gameData.ts` | Add optional fields to `GameDataManifest` |
| `lebo/src/features/game-data/gameDataLoader.ts` | `Promise.all` for parallel staleness checks |
| `lebo/src-tauri/resources/game-data/manifest.json` | Add `iconCacheVersion` and `iconSource` defaults |

No new files. No `lib.rs` changes. No store changes. No UI changes.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.3] — ACs, user story, atomic write constraint
- [Source: _bmad-output/planning-artifacts/architecture.md#Decision 1] — Manifest v2 field list (`itemDataVersion`, `iconCacheVersion`, `iconSource`)
- [Source: lebo/src-tauri/src/models/game_data.rs:63-73] — `GameDataManifest` struct to extend
- [Source: lebo/src-tauri/src/services/game_data_service.rs:117-149] — `download_class_files` with non-atomic writes to fix
- [Source: lebo/src-tauri/src/commands/game_data_commands.rs:58-78] — `download_game_data_update` with non-atomic manifest write to fix
- [Source: lebo/src-tauri/src/commands/icon_commands.rs:89-120] — `initialize_icon_pipeline` to extend with manifest update
- [Source: lebo/src-tauri/src/commands/item_commands.rs:36-91] — `update_item_data` with manual atomic writes to consolidate
- [Source: lebo/src/shared/types/gameData.ts:28-34] — `GameDataManifest` TypeScript interface to extend
- [Source: lebo/src/features/game-data/gameDataLoader.ts:8-22] — `initGameData` to change fire-and-forget to `Promise.all`
- [Source: lebo/src-tauri/resources/game-data/manifest.json] — bundled manifest to update with new fields
- [Source: _bmad-output/project-context.md#Critical Implementation Rules] — no barrel files, strict TypeScript, atomic writes in Rust

### Review Findings

- [x] [Review][Patch] `download_game_data_update` erases local manifest fields on game data sync [`lebo/src-tauri/src/commands/game_data_commands.rs`] — `download_game_data_update` fetches the remote manifest and writes it verbatim. The remote CDN manifest has no `iconCacheVersion`, `iconSource`, or `itemDataVersion`. After deserialization these fields are `None` and get wiped from disk. A game data update now silently resets the icon source that `update_manifest_icon_source` had set. Fix: load the local manifest first and carry its local-only fields forward (same surgical-merge pattern as `update_item_data`) before writing the updated manifest.
- [x] [Review][Defer] Concurrent read-modify-write race on `manifest.json`, amplified by shared `.tmp` path [`icon_commands.rs: update_manifest_icon_source` + `item_commands.rs: update_item_data`] — deferred, pre-existing: spec accepts this as best-effort; both writers share `manifest.tmp` when running concurrently but the startup timing makes collision unlikely.
- [x] [Review][Defer] No JSON validation on item file downloads before atomic write [`item_commands.rs: update_item_data`, download loop] — deferred, pre-existing: `download_class_files` validates before writing but `update_item_data` writes raw bytes; a truncated CDN response would atomically replace a good file. Pre-dates this story.
- [x] [Review][Defer] `temp_dir` test helper uses `subsec_nanos` for uniqueness [`game_data_service.rs: tests::temp_dir`] — deferred, pre-existing: potential flakiness under high parallelism or low-resolution clocks; low risk in practice.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Extracted `atomic_write_file` as a single shared helper in `game_data_service.rs`; all three write sites (`download_class_files`, `download_game_data_update`, `update_item_data`) now use it — eliminates duplicated temp-file-rename logic and adds consistent cleanup on failure.
- `update_item_data` manual temp variable declarations removed; 3 item file writes + 1 manifest write now each a single `atomic_write_file` call.
- Added `update_manifest_icon_source` async helper in `icon_commands.rs` that best-effort updates `iconSource` and `iconCacheVersion` in the manifest; silently skips if manifest doesn't exist yet (startup race condition).
- `initGameData` changed from fire-and-forget staleness checks to `await Promise.all([...])` so both checks complete before `setIsLoading(false)`.
- Pre-existing test failures confirmed unrelated: `openrouter_service::models_list_has_four_entries` (count drift), `ProviderSelector` data-testid issues, `SkillTreeCanvas`/`TreeControls` canvas getContext() in jsdom.
- AC4 verified still working: `update_item_data` sets `local.item_data_version` before writing manifest via `atomic_write_file`.

### File List

- lebo/src-tauri/src/models/game_data.rs
- lebo/src-tauri/src/services/game_data_service.rs
- lebo/src-tauri/src/commands/game_data_commands.rs
- lebo/src-tauri/src/commands/icon_commands.rs
- lebo/src-tauri/src/commands/item_commands.rs
- lebo/src/shared/types/gameData.ts
- lebo/src/features/game-data/gameDataLoader.ts
- lebo/src/features/game-data/gameDataLoader.test.ts
- lebo/src-tauri/resources/game-data/manifest.json
