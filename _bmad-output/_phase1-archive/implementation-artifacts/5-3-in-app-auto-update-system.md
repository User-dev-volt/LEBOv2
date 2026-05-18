# Story 5.3: In-App Auto-Update System

Status: done

## Story

As an advanced Last Epoch player,
I want the app to notify me when a new version is available and let me install it without leaving the app,
So that I always have the latest features and game data compatibility fixes without manually downloading updates.

## Acceptance Criteria

1. **Given** the app launches with internet connectivity
   **When** the launch-time update check runs
   **Then** if a new version is available: a non-blocking notification banner appears in the app header: "LEBOv2 [version] is available. [Install Update]" (FR41)
   **And** if no update is available: no notification appears and the check is completely silent

2. **Given** the update notification is visible
   **When** the user clicks "Install Update"
   **Then** a download progress indicator appears in the header (percentage or progress bar)
   **And** the "Install Update" button is replaced by the progress display during download

3. **Given** the update download completes
   **When** the download finishes
   **Then** the header shows: "Update ready. Restart LEBOv2 to apply? [Restart Now]"
   **And** clicking "Restart Now" installs the update and relaunches the app

4. **Given** the update notification is visible
   **When** the user clicks the dismiss (×) button
   **Then** the banner disappears and does not reappear in the same session (no forced install)
   **And** the user continues using the app normally

5. **Given** the app is offline at launch
   **When** the update check fires
   **Then** no error is surfaced to the user — the check fails silently (offline is already indicated via StatusBar)

## Tasks / Subtasks

- [x] Task 1: Install frontend dependency (AC: 2, 3)
  - [x] Run `pnpm add @tauri-apps/plugin-updater` in `lebo/` directory
  - [x] Verify `@tauri-apps/plugin-updater` appears in `package.json` dependencies

- [x] Task 2: Register updater plugin in Rust (AC: 1)
  - [x] In `lebo/src-tauri/src/lib.rs`, add `.plugin(tauri_plugin_updater::Builder::default().build())` after existing plugins
  - [x] Add `restart_app` Tauri command to `lebo/src-tauri/src/commands/app_commands.rs` (see Dev Notes for exact pattern)
  - [x] Register `restart_app` in `lib.rs` invoke_handler
  - [x] Update import line for app_commands to include `restart_app`

- [x] Task 3: Configure updater in `tauri.conf.json` (AC: 1, 5)
  - [x] Add `plugins.updater` section with `pubkey` and `endpoints` fields (see Dev Notes for config shape)
  - [x] Note: pubkey is a placeholder until code-signing story (5.5) — update check returns null in dev without a real release endpoint, which is correct silent behavior

- [x] Task 4: Add update state to `appStore.ts` (AC: 1, 2, 3, 4)
  - [x] Add `updateInfo: { version: string; body: string | null } | null` (default `null`)
  - [x] Add `updateStatus: 'idle' | 'downloading' | 'ready' | 'error'` (default `'idle'`)
  - [x] Add `updateProgress: number` (0–100, default `0`)
  - [x] Add `updateDismissed: boolean` (default `false`)
  - [x] Add actions: `setUpdateInfo`, `setUpdateStatus`, `setUpdateProgress`, `setUpdateDismissed`

- [x] Task 5: Create `useUpdateCheck.ts` hook (AC: 1, 5)
  - [x] Create `lebo/src/shared/hooks/useUpdateCheck.ts`
  - [x] Export module-level `getPendingUpdate()` — returns the raw `Update` object needed for download/install
  - [x] On mount: call `check()` from `@tauri-apps/plugin-updater`, on success set `updateInfo` in appStore; on error swallow silently (see Dev Notes)
  - [x] Call this hook from `App.tsx` alongside `useConnectivity()`

- [x] Task 6: Update `AppHeader.tsx` with update banner (AC: 1, 2, 3, 4)
  - [x] Subscribe to `updateInfo`, `updateStatus`, `updateProgress`, `updateDismissed` from appStore
  - [x] Render update banner when `updateInfo !== null && !updateDismissed` (see Dev Notes for exact JSX shape)
  - [x] "Install Update" button: triggers `startDownload()` — calls `update.download(onProgressEvent)`, updates `updateStatus` and `updateProgress` in store
  - [x] Progress state (`updateStatus === 'downloading'`): show `"Downloading... {pct}%"` in banner
  - [x] Ready state (`updateStatus === 'ready'`): show "Update ready. Restart LEBOv2 to apply?" + "[Restart Now]" button
  - [x] "Restart Now": calls `update.install()` then `invokeCommand('restart_app')`
  - [x] Dismiss (×) button: calls `setUpdateDismissed(true)` — banner disappears, no reappearance this session
  - [x] All interactive elements have `data-testid` attributes (see Dev Notes)

- [x] Task 7: Update `App.tsx` (AC: 1)
  - [x] Import and call `useUpdateCheck()` inside `App()`, placed alongside `useConnectivity()` at the top of the function body

- [x] Task 8: Tests (AC: 1–5)
  - [x] Create `lebo/src/shared/hooks/useUpdateCheck.test.ts`:
    - [x] When `check()` resolves with an update: `setUpdateInfo` is called with `{ version, body }`
    - [x] When `check()` resolves with null (no update): `setUpdateInfo` is NOT called
    - [x] When `check()` rejects: no error propagates (silent failure), `setUpdateInfo` is NOT called
  - [x] Update `lebo/src/features/layout/AppHeader.test.tsx`:
    - [x] When `updateInfo` is null: no update banner renders
    - [x] When `updateInfo` is set and `updateDismissed` is false: banner renders with version and "Install Update" button
    - [x] When `updateDismissed` is true: banner does not render
    - [x] Clicking dismiss (×) button: `setUpdateDismissed(true)` is called
    - [x] When `updateStatus === 'downloading'`: "Downloading..." text is visible
    - [x] When `updateStatus === 'ready'`: "Update ready" text and "Restart Now" button are visible
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — all tests pass

## Dev Notes

### Dependency setup

`tauri-plugin-updater` v2 is already in `Cargo.toml` at version `2.10.1`. The frontend npm package is NOT yet installed.

```bash
# Run from lebo/ directory
pnpm add @tauri-apps/plugin-updater
```

No `@tauri-apps/plugin-process` needed — use the custom `restart_app` command below instead.

---

### `restart_app` Tauri command — exact pattern

Add to `lebo/src-tauri/src/commands/app_commands.rs`:

```rust
#[tauri::command]
pub async fn restart_app(app_handle: tauri::AppHandle) {
    app_handle.restart();
}
```

Update the import in `lib.rs`:
```rust
use commands::app_commands::{check_api_key_configured, check_connectivity, restart_app, set_api_key};
```

Register in `invoke_handler`:
```rust
tauri::generate_handler![
    // ... existing commands ...
    check_connectivity,
    restart_app,  // ← add
]
```

---

### Plugin registration in `lib.rs` — exact position

Add after `tauri_plugin_store` and before `tauri_plugin_stronghold`:

```rust
.plugin(tauri_plugin_updater::Builder::default().build())
```

The full `.plugin()` chain order should be:
```rust
.plugin(tauri_plugin_opener::init())
.plugin(tauri_plugin_sql::Builder::default().build())
.plugin(tauri_plugin_http::init())
.plugin(tauri_plugin_store::Builder::default().build())
.plugin(tauri_plugin_updater::Builder::default().build())  // ← add here
.plugin(tauri_plugin_stronghold::Builder::new(...).build())
```

---

### `tauri.conf.json` updater config

Add a `plugins` key at the top level of `tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "lebo",
  "version": "0.1.0",
  "identifier": "com.lebo.dev",
  ...
  "plugins": {
    "updater": {
      "pubkey": "PLACEHOLDER_REPLACE_WITH_TAURI_SIGNER_PUBKEY",
      "endpoints": [
        "https://github.com/OWNER/REPO/releases/latest/download/latest.json"
      ]
    }
  }
}
```

**Dev behavior:** With a placeholder pubkey and no real GitHub release endpoint, `check()` will return `null` in development — correct silent behavior (no update available). The feature becomes fully active only when story 5.5 (Distribution Readiness) is complete and real releases are published. This is by design — do not block on 5.5 to write this story.

**Capabilities already configured:** `"updater:default"` is already in `lebo/src-tauri/capabilities/default.json` — no change needed there.

---

### `appStore.ts` — additions only (do not remove existing fields)

```typescript
interface AppStore {
  // ... existing fields unchanged ...
  isOnline: boolean
  isOnlineChecked: boolean
  currentView: 'main' | 'settings'
  activePanel: PanelState
  isApiKeyConfigured: boolean | null
  
  // ← New update fields:
  updateInfo: { version: string; body: string | null } | null
  updateStatus: 'idle' | 'downloading' | 'ready' | 'error'
  updateProgress: number
  updateDismissed: boolean
  
  // ← New update actions:
  setUpdateInfo: (info: { version: string; body: string | null } | null) => void
  setUpdateStatus: (status: 'idle' | 'downloading' | 'ready' | 'error') => void
  setUpdateProgress: (progress: number) => void
  setUpdateDismissed: (dismissed: boolean) => void
}

// In create():
updateInfo: null,
updateStatus: 'idle',
updateProgress: 0,
updateDismissed: false,
setUpdateInfo: (info) => set({ updateInfo: info }),
setUpdateStatus: (status) => set({ updateStatus: status }),
setUpdateProgress: (progress) => set({ updateProgress: progress }),
setUpdateDismissed: (dismissed) => set({ updateDismissed: dismissed }),
```

---

### `useUpdateCheck.ts` — full implementation pattern

```typescript
import { useEffect } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useAppStore } from '../stores/appStore'

// Module-level variable so AppHeader can access the Update object for download/install.
// Update is a class with async methods — not storable in Zustand.
let _pendingUpdate: Update | null = null

export function getPendingUpdate(): Update | null {
  return _pendingUpdate
}

export function useUpdateCheck() {
  useEffect(() => {
    check()
      .then((update) => {
        _pendingUpdate = update
        if (update) {
          useAppStore.getState().setUpdateInfo({
            version: update.version,
            body: update.body ?? null,
          })
        }
      })
      .catch(() => {
        // Silent — update check failure is not user-facing (network may be offline)
      })
  }, [])
}
```

**Why module-level variable?** The `Update` object returned by `check()` is a class instance with `download()` and `install()` methods. Zustand cannot serialize class instances. The module-level variable is safe here because: (a) there's only one app instance, (b) it's set once on launch and only read by AppHeader, (c) it's effectively a singleton reference.

---

### `AppHeader.tsx` — update banner pattern

```typescript
import { getPendingUpdate } from '../../shared/hooks/useUpdateCheck'
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useAppStore } from '../../shared/stores/appStore'

// Inside AppHeader():
const updateInfo = useAppStore((s) => s.updateInfo)
const updateStatus = useAppStore((s) => s.updateStatus)
const updateProgress = useAppStore((s) => s.updateProgress)
const updateDismissed = useAppStore((s) => s.updateDismissed)
const setUpdateStatus = useAppStore((s) => s.setUpdateStatus)
const setUpdateProgress = useAppStore((s) => s.setUpdateProgress)
const setUpdateDismissed = useAppStore((s) => s.setUpdateDismissed)

async function startDownload() {
  const update = getPendingUpdate()
  if (!update) return
  setUpdateStatus('downloading')
  let downloaded = 0
  let contentLength = 0
  await update.download((event) => {
    if (event.event === 'Started') {
      contentLength = event.data.contentLength ?? 0
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength
      const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0
      setUpdateProgress(pct)
    } else if (event.event === 'Finished') {
      setUpdateStatus('ready')
    }
  })
}

async function installAndRestart() {
  const update = getPendingUpdate()
  if (!update) return
  await update.install()
  await invokeCommand('restart_app')
}
```

**Update banner JSX — render inside `<header>` after the title/subtitle span and before the Settings button:**

```tsx
{updateInfo && !updateDismissed && (
  <div
    className="ml-4 flex items-center gap-2 text-xs"
    style={{ color: 'var(--color-text-secondary)' }}
    data-testid="update-banner"
  >
    {updateStatus === 'idle' && (
      <>
        <span data-testid="update-version-text">
          LEBOv2 {updateInfo.version} is available.
        </span>
        <button
          onClick={startDownload}
          data-testid="install-update-button"
          className="px-2 py-0.5 rounded text-xs"
          style={{
            backgroundColor: 'var(--color-accent-gold)',
            color: 'var(--color-bg-base)',
          }}
        >
          Install Update
        </button>
      </>
    )}
    {updateStatus === 'downloading' && (
      <span data-testid="download-progress-text">
        Downloading... {updateProgress}%
      </span>
    )}
    {updateStatus === 'ready' && (
      <>
        <span data-testid="update-ready-text">
          Update ready. Restart LEBOv2 to apply?
        </span>
        <button
          onClick={installAndRestart}
          data-testid="restart-now-button"
          className="px-2 py-0.5 rounded text-xs"
          style={{
            backgroundColor: 'var(--color-accent-gold)',
            color: 'var(--color-bg-base)',
          }}
        >
          Restart Now
        </button>
      </>
    )}
    {(updateStatus === 'idle' || updateStatus === 'ready') && (
      <button
        onClick={() => setUpdateDismissed(true)}
        data-testid="dismiss-update-button"
        className="ml-1 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Dismiss update notification"
      >
        ×
      </button>
    )}
  </div>
)}
```

**Placement:** The banner lives inside the `<header>` element, between the subtitle span and the `ml-auto` Settings button. The `ml-4` on the banner div keeps it visually separated from the title.

---

### Testing — mock pattern for `@tauri-apps/plugin-updater`

```typescript
// useUpdateCheck.test.ts
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

// Test: update available
vi.mocked(check).mockResolvedValue({
  version: '1.2.0',
  body: 'Bug fixes',
  download: vi.fn(),
  install: vi.fn(),
} as unknown as Update)

// Test: no update
vi.mocked(check).mockResolvedValue(null)

// Test: error (silent)
vi.mocked(check).mockRejectedValue(new Error('network error'))
```

**AppHeader.test.tsx** — mock both `@tauri-apps/plugin-updater` AND `useUpdateCheck` module:

```typescript
vi.mock('../../shared/hooks/useUpdateCheck', () => ({
  getPendingUpdate: vi.fn(),
}))
```

Set up update state via `useAppStore.setState({ updateInfo: { version: '1.2.0', body: null }, updateStatus: 'idle', updateProgress: 0, updateDismissed: false })` in the relevant test's `beforeEach`.

For `installAndRestart` test: mock `invokeCommand` to verify `'restart_app'` is called.

Existing AppHeader tests are NOT affected — they don't set `updateInfo`, which defaults to `null`, so the banner is hidden.

---

### What Already Exists — DO NOT Reinvent

| What | Status | Where |
|------|--------|-------|
| `tauri-plugin-updater = "2.10.1"` in Cargo.toml | ✅ | `lebo/src-tauri/Cargo.toml:23` |
| `"updater:default"` capability permission | ✅ | `lebo/src-tauri/capabilities/default.json:15` |
| `.setup()` closure in `lib.rs` (for connectivity watcher) | ✅ | `lebo/src-tauri/src/lib.rs:19` |
| `invokeCommand` wrapper | ✅ | `lebo/src/shared/utils/invokeCommand.ts` |
| `useConnectivity` hook pattern (mount-only `useEffect`) | ✅ | `lebo/src/shared/hooks/useConnectivity.ts` |
| `appStore.isOnline` / `setOnline` pattern | ✅ | `lebo/src/shared/stores/appStore.ts` |
| Tauri event listener pattern | ✅ | `lebo/src/shared/hooks/useConnectivity.ts` |
| `AppHeader` rendering in `App.tsx` | ✅ | `lebo/src/App.tsx:118` |

---

### File Locations

**New files:**
- `lebo/src/shared/hooks/useUpdateCheck.ts`
- `lebo/src/shared/hooks/useUpdateCheck.test.ts`

**Modified files:**
- `lebo/package.json` — add `@tauri-apps/plugin-updater` dependency (via pnpm add)
- `lebo/src-tauri/tauri.conf.json` — add `plugins.updater` section
- `lebo/src-tauri/src/lib.rs` — register updater plugin + `restart_app` command
- `lebo/src-tauri/src/commands/app_commands.rs` — add `restart_app` command
- `lebo/src/shared/stores/appStore.ts` — add update state fields + actions
- `lebo/src/App.tsx` — call `useUpdateCheck()` at top of `App()`
- `lebo/src/features/layout/AppHeader.tsx` — add update banner UI
- `lebo/src/features/layout/AppHeader.test.tsx` — add update banner tests

---

### Regression Warnings

- `App.tsx` gains a new hook call (`useUpdateCheck()`) — place alongside `useConnectivity()` at the top of `App()`, unconditionally (hooks ordering law)
- `AppHeader.tsx` gains new state subscriptions — existing AppHeader tests are safe because `updateInfo` defaults to `null` (banner hidden); they don't need `beforeEach` changes
- `lib.rs` gains a new `.plugin()` call — order matters; place BEFORE `tauri_plugin_stronghold` (see Dev Notes)
- The `restart_app` command calls `app_handle.restart()` which is non-reversible — ensure it's only reachable after successful `update.install()` completes

---

### Scope boundaries — do NOT do in this story

- No CI/CD workflow changes (that's story 5.5)
- No pubkey generation (that's story 5.5)
- No GitHub Release setup (that's story 5.5)
- No update check polling — launch-only (one `useEffect` with empty deps array)
- No "release notes" display from `update.body` in the banner (keep it minimal)
- No error state banner — update errors are swallowed silently (offline mode already visible via StatusBar)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Installed `@tauri-apps/plugin-updater 2.10.1` frontend package via pnpm
- Registered `tauri_plugin_updater::Builder::default().build()` in lib.rs between `tauri_plugin_store` and `tauri_plugin_stronghold`
- Added `restart_app` Tauri command using `app_handle.restart()` — avoids needing `@tauri-apps/plugin-process`
- Added `plugins.updater` section to `tauri.conf.json` with placeholder pubkey and GitHub Releases endpoint — returns null in dev (correct silent behavior until story 5.5)
- Extended `appStore` with four update state fields (`updateInfo`, `updateStatus`, `updateProgress`, `updateDismissed`) and corresponding setters
- Created `useUpdateCheck.ts` with module-level `_pendingUpdate` variable — `Update` class is not Zustand-serializable; module-level singleton is safe for a single-instance desktop app
- `AppHeader.tsx` renders update banner inline (never modal): idle → install button; downloading → progress %; ready → restart prompt. Dismiss hidden during download to prevent mid-download abandonment confusion
- `App.tsx` calls `useUpdateCheck()` unconditionally alongside `useConnectivity()`, no hook ordering issues
- `useUpdateCheck.test.ts`: 4 tests — update present, null, rejection, undefined body
- `AppHeader.test.tsx`: 10 tests total (6 existing + 4 new for update banner: no banner default, dismissed, idle state, dismiss click, downloading state, ready state, Restart Now)
- All 393 tests pass (37 files), `pnpm tsc --noEmit` clean

### File List

- `lebo/package.json` (modified — added `@tauri-apps/plugin-updater`)
- `lebo/pnpm-lock.yaml` (modified — lockfile updated)
- `lebo/src-tauri/tauri.conf.json` (modified — added `plugins.updater` section)
- `lebo/src-tauri/src/lib.rs` (modified — updater plugin registration + `restart_app` command)
- `lebo/src-tauri/src/commands/app_commands.rs` (modified — added `restart_app` command)
- `lebo/src/shared/stores/appStore.ts` (modified — added update state fields and actions)
- `lebo/src/shared/hooks/useUpdateCheck.ts` (new)
- `lebo/src/shared/hooks/useUpdateCheck.test.ts` (new)
- `lebo/src/App.tsx` (modified — added `useUpdateCheck()` call)
- `lebo/src/features/layout/AppHeader.tsx` (modified — added update banner UI)
- `lebo/src/features/layout/AppHeader.test.tsx` (modified — added update banner tests)

### Review Findings

- Download error handling: `startDownload()` had no try/catch — wrapped in try/catch with `setUpdateStatus('error')` fallback; added error banner state with dismiss button restored
- Repeated save notifications: `useAutoSave` was re-triggering on `setActiveBuildPersisted()` calls (reference change with only `isPersisted` differing); fixed by comparing build data excluding `isPersisted`
- `tokio` added as explicit Cargo.toml dependency (was implicit transitive via reqwest, required by `connectivity_service::start_watcher`)
- `restart_app` unguarded command and placeholder pubkey noted; both deferred to story 5.5

## Change Log

- 2026-04-28: Story 5.3 created — In-App Auto-Update System
- 2026-04-28: Story 5.3 implemented — updater plugin registration, restart_app command, update state in appStore, useUpdateCheck hook, AppHeader banner (idle/downloading/ready/dismiss); 393 tests pass, tsc clean
