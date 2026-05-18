# Story 5.1: API Key Management & Settings View

Status: done

## Story

As an advanced Last Epoch player,
I want to configure my Claude API key in the application settings and have it stored securely,
so that the AI optimization engine can make authenticated requests without my key ever appearing in plain text on disk or in memory.

## Acceptance Criteria

1. **Given** the user opens Settings (via header button or any "Go to Settings" link)
   **When** the Settings view renders (`appStore.currentView = 'settings'`)
   **Then** an "AI API Key" section is visible with a masked text input labeled "Claude API Key"
   **And** a "Save Key" Primary button is visible

2. **Given** the user enters a Claude API key and clicks "Save Key"
   **When** the save command fires
   **Then** `invokeCommand('set_api_key', { key })` is called
   **And** the Rust handler stores the key via `tauri-plugin-stronghold`
   **And** the key NEVER appears in any log file, app state, IPC response, or Zustand store
   **And** a success toast confirms "API key saved securely"

3. **Given** an API key is already stored
   **When** the user opens Settings
   **Then** the key input shows a masked placeholder (e.g., "Claude API key saved ✓") — the full key is NOT retrieved or displayed in the UI

4. **Given** the application has never been launched before (no Stronghold vault exists)
   **When** the user opens Settings for the first time
   **Then** the API key input shows an empty masked field with no error message
   **And** no AUTH_ERROR is surfaced — the missing vault is silently initialized on first access by `keychain_service.rs`

5. **Given** no API key is configured and the user clicks "Optimize"
   **When** the optimization attempt fires
   **Then** an `AUTH_ERROR` surfaces with message: "No API key configured. Add your Claude API key in Settings."
   **And** a "Go to Settings" link is visible in the error banner that navigates to the settings view

## Tasks / Subtasks

- [x] Task 1: Add `tauri-plugin-stronghold` to the Rust project (AC: 1, 2, 3, 4)
  - [x] Check Rust toolchain version (`rustup show`); update if < 1.85 (`rustup update stable`) — required by argon2 0.5.x
  - [x] Add to `lebo/src-tauri/Cargo.toml`: `tauri-plugin-stronghold = "2"` and `argon2 = "0.5"`
  - [x] Register the stronghold plugin in `lib.rs` with an argon2 KDF function (see Dev Notes for exact code)
  - [x] Add stronghold permissions to `lebo/src-tauri/capabilities/default.json` — check plugin docs for exact permission identifiers (typically `stronghold:default` or individual `stronghold:allow-*` keys)
  - [x] Verify `cargo build` succeeds before proceeding

- [x] Task 2: Create `keychain_service.rs` (AC: 2, 3, 4, 5)
  - [x] Create `lebo/src-tauri/src/services/keychain_service.rs`
  - [x] Implement `pub async fn set_api_key(app: &AppHandle, key: &str) -> Result<(), String>` — stores key in Stronghold vault, initializes vault on first call
  - [x] Implement `pub async fn get_api_key(app: &AppHandle) -> Result<String, String>` — returns `Err("AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string())` when no key stored (error string MUST start with `AUTH_ERROR:` — see Dev Notes)
  - [x] Implement `pub async fn is_api_key_configured(app: &AppHandle) -> Result<bool, String>` — returns `Ok(false)` when vault does not exist (NOT `Err(AUTH_ERROR)`) — see Dev Notes for vault init guard
  - [x] Export from `services/mod.rs`: replace placeholder comment with `pub mod keychain_service;`

- [x] Task 3: Create `app_commands.rs` (AC: 2, 3, 4)
  - [x] Create `lebo/src-tauri/src/commands/app_commands.rs`
  - [x] Implement `#[tauri::command] pub async fn set_api_key(app_handle: tauri::AppHandle, key: String) -> Result<(), String>` — delegates to `keychain_service::set_api_key`
  - [x] Implement `#[tauri::command] pub async fn check_api_key_configured(app_handle: tauri::AppHandle) -> Result<bool, String>` — delegates to `keychain_service::is_api_key_configured`
  - [x] Export from `commands/mod.rs`: replace placeholder comment with `pub mod app_commands;`
  - [x] Add both commands to the `invoke_handler![]` list in `lib.rs`

- [x] Task 4: Update `invoke_claude_api` to use keychain (AC: 5)
  - [x] In `claude_commands.rs:19-20`, replace `std::env::var("ANTHROPIC_API_KEY")` with `keychain_service::get_api_key(&app_handle).await?`
  - [x] Add `use crate::services::keychain_service;` import to `claude_commands.rs`
  - [x] Remove the `TODO(story-5.1)` comment at line 11
  - [x] Optional dev ergonomics: add env var fallback in debug builds only — `#[cfg(debug_assertions)] let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or_else(|_| api_key);` — so local dev still works with `.env`

- [x] Task 5: Update `appStore.ts` — add API key state (AC: 3, 4)
  - [x] Add `isApiKeyConfigured: boolean | null` to `AppStore` interface (null = not yet checked)
  - [x] Add `setApiKeyConfigured: (v: boolean | null) => void` action
  - [x] Initialize `isApiKeyConfigured: null` in store

- [x] Task 6: Create `Settings.tsx` and `ApiKeyInput.tsx` (AC: 1, 2, 3, 4)
  - [x] Create `lebo/src/features/settings/Settings.tsx` (see Dev Notes for structure)
    - [x] Full-screen view container matching app height (`100dvh`)
    - [x] Header row with "← Back" button (left) and title "Settings" (center or left-of-back)
    - [x] "← Back" button calls `useAppStore.getState().setCurrentView('main')`
    - [x] Renders `<ApiKeyInput />` in the settings body
  - [x] Create `lebo/src/features/settings/ApiKeyInput.tsx` (see Dev Notes for structure)
    - [x] On mount: call `invokeCommand<boolean>('check_api_key_configured')` → call `setApiKeyConfigured(result)`
    - [x] Controlled `<input type="password">` for key entry — local state only, never store value in Zustand
    - [x] Placeholder: `isApiKeyConfigured ? "Claude API key saved ✓" : "sk-ant-..."`
    - [x] "Save Key" button: disabled when input is empty; Primary button style (gold bg)
    - [x] On save: `invokeCommand('set_api_key', { key: inputValue })` → on success: toast "API key saved securely" + `setApiKeyConfigured(true)` + clear local input
    - [x] On error: show inline `AppError.message` below the input (not a toast — inline per error display rules)
    - [x] `data-testid="api-key-input"` on the `<input>`, `data-testid="save-key-btn"` on the button

- [x] Task 7: Update `App.tsx` for view routing (AC: 1)
  - [x] Subscribe to `useAppStore((s) => s.currentView)`
  - [x] When `currentView === 'settings'`: return `<><Settings /><Toaster .../></>` — keep `<Toaster>` available for toast notifications in settings
  - [x] When `currentView === 'main'`: existing full layout (no change to existing JSX)
  - [x] Import `Settings` from `'./features/settings/Settings'`

- [x] Task 8: Update `AppHeader.tsx` to add Settings button (AC: 1)
  - [x] Subscribe to `useAppStore((s) => s.currentView)` and `useAppStore((s) => s.setCurrentView)`
  - [x] Add Settings button to the right side of the header (`ml-auto`), hidden when `currentView === 'settings'`
  - [x] Button text: "Settings"; `data-testid="settings-button"`; on click: `setCurrentView('settings')`
  - [x] Button style follows secondary/muted pattern (not gold) — this is a nav control, not a primary action

- [x] Task 9: Update `SuggestionsList.tsx` for AUTH_ERROR "Go to Settings" link (AC: 5)
  - [x] In the `streamError` banner (line 230), when `streamError.type === 'AUTH_ERROR'`, render a "Go to Settings" button inside the error div — between the message and the dismiss `×`
  - [x] "Go to Settings" button: `onClick={() => useAppStore.getState().setCurrentView('settings')}`, `data-testid="auth-error-settings-link"`
  - [x] Style: `color: 'var(--color-accent-gold)'`, small text, no border

- [x] Task 10: Tests (AC: 1–5)
  - [x] `Settings.test.tsx` — renders "Claude API Key" heading, renders "← Back" button, back button calls `setCurrentView('main')`
  - [x] `ApiKeyInput.test.tsx` — check_api_key_configured called on mount, Save Key disabled when input empty, save calls `set_api_key` invoke, success shows toast + clears input + updates isApiKeyConfigured, error shows inline (not toast)
  - [x] Update `AppHeader.test.tsx` — settings button appears when `currentView='main'`, hidden when `currentView='settings'`, click navigates to settings
  - [x] Update `SuggestionsList.test.tsx` — when `streamError.type === 'AUTH_ERROR'`, "Go to Settings" button renders; when non-AUTH_ERROR error, button absent
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — all tests pass (369 total)

## Dev Notes

### CRITICAL: tauri-plugin-stronghold is NOT yet in Cargo.toml

The `lib.rs` comment documents why it was deferred:
```
// tauri-plugin-stronghold registered in Story 5.1 (API key management)
// Requires argon2 KDF — deferred until Rust ≥1.95 or toolchain update
```

Run `rustup show` before starting. If the active toolchain is below 1.85, run `rustup update stable` first. The `argon2` crate requires Rust ≥1.85 for its AVX2 intrinsics.

**Cargo.toml additions:**
```toml
tauri-plugin-stronghold = "2"
argon2 = { version = "0.5", features = ["std"] }
```

**lib.rs plugin registration** (replace the deferred comment):
```rust
.plugin(
    tauri_plugin_stronghold::Builder::new(|password| {
        use argon2::{Argon2, Params};
        let params = Params::new(65536, 2, 1, Some(32)).expect("invalid argon2 params");
        let mut output = vec![0u8; 32];
        Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params)
            .hash_password_into(password, b"lebo-stronghold-salt", &mut output)
            .expect("argon2 hash failed");
        output
    })
    .build(),
)
```

Note: The salt above is a static app-level salt (not per-user). This is standard practice for desktop app credential vaults where the vault password IS the application identity.

---

### keychain_service.rs — Stronghold API pattern

`tauri-plugin-stronghold` v2 uses the `StrongholdExt` trait on `AppHandle`. Typical pattern:

```rust
use tauri::AppHandle;
use tauri_plugin_stronghold::StrongholdExt;

const VAULT_PASSWORD: &[u8] = b"lebo-vault-password";
const CLIENT_NAME: &[u8] = b"lebo";
const VAULT_KEY: &str = "anthropic_api_key";

fn get_vault_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir()
        .expect("failed to get app data dir")
        .join("lebo.stronghold")
}

pub async fn set_api_key(app: &AppHandle, key: &str) -> Result<(), String> {
    let vault_path = get_vault_path(app);
    let stronghold = app.stronghold();
    let client = stronghold.load_client_with_password(CLIENT_NAME, vault_path, VAULT_PASSWORD)
        .map_err(|e| format!("STORAGE_ERROR: failed to open vault: {e}"))?;
    client.store()
        .insert(VAULT_KEY.as_bytes().to_vec(), key.as_bytes().to_vec(), None)
        .map_err(|e| format!("STORAGE_ERROR: failed to store key: {e}"))?;
    stronghold.save()
        .map_err(|e| format!("STORAGE_ERROR: failed to save vault: {e}"))?;
    Ok(())
}

pub async fn get_api_key(app: &AppHandle) -> Result<String, String> {
    let vault_path = get_vault_path(app);
    if !vault_path.exists() {
        return Err("AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string());
    }
    let stronghold = app.stronghold();
    let client = stronghold.load_client_with_password(CLIENT_NAME, vault_path, VAULT_PASSWORD)
        .map_err(|_| "AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string())?;
    let data = client.store()
        .get(VAULT_KEY.as_bytes())
        .map_err(|_| "AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string())?
        .ok_or_else(|| "AUTH_ERROR: No API key configured. Add your Claude API key in Settings.".to_string())?;
    String::from_utf8(data)
        .map_err(|_| "AUTH_ERROR: API key corrupted in vault".to_string())
}

pub async fn is_api_key_configured(app: &AppHandle) -> Result<bool, String> {
    let vault_path = get_vault_path(app);
    if !vault_path.exists() {
        return Ok(false);  // First launch: vault doesn't exist yet — NOT an error (AC 4)
    }
    let stronghold = app.stronghold();
    let client = stronghold.load_client_with_password(CLIENT_NAME, vault_path, VAULT_PASSWORD)
        .map_err(|e| format!("STORAGE_ERROR: failed to read vault: {e}"))?;
    let exists = client.store()
        .get(VAULT_KEY.as_bytes())
        .map(|v| v.is_some())
        .unwrap_or(false);
    Ok(exists)
}
```

**CRITICAL:** `is_api_key_configured` MUST return `Ok(false)` — not `Err(...)` — when the vault file doesn't exist. An error here would surface as AUTH_ERROR in the UI before the user has ever had a chance to enter a key (AC 4). The vault path existence check (`if !vault_path.exists()`) handles this.

**CRITICAL:** All error strings from `get_api_key` MUST start with `AUTH_ERROR:` — the `extract_error_type()` function in `claude_commands.rs:110-116` matches on this prefix to set the correct `ErrorType`.

---

### invoke_claude_api update (claude_commands.rs:11-20)

```rust
// ADD import at top of file:
use crate::services::keychain_service;

// REPLACE lines 19-20 (env var lookup) with:
let api_key = keychain_service::get_api_key(&app_handle).await?;

// OPTIONAL — dev ergonomics only (remove before shipping):
#[cfg(debug_assertions)]
let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key);
```

The dev fallback lets you keep using `ANTHROPIC_API_KEY` in `.env` during local development without needing to configure Stronghold each time.

---

### API Key security invariants (NFR7, NFR9)

These MUST be true after this story:
- The API key value is NEVER stored in any Zustand store field
- The API key value is NEVER included in any Tauri IPC response payload
- The API key value is NEVER emitted as a Tauri event payload
- `check_api_key_configured` returns `bool` only — never the key or a fragment of it
- The only time the key crosses the IPC boundary is in the `set_api_key` command payload (inbound, write-once)

---

### Masked key display — no key retrieval (AC 3)

Since the key is never retrieved to the frontend, the input shows a static placeholder when `isApiKeyConfigured === true`:

```tsx
<input
  type="password"
  data-testid="api-key-input"
  value={localKeyValue}
  onChange={(e) => setLocalKeyValue(e.target.value)}
  placeholder={isApiKeyConfigured ? "Claude API key saved ✓" : "sk-ant-api03-..."}
  ...
/>
```

When `isApiKeyConfigured === true` and `localKeyValue === ''`, the placeholder shows "Claude API key saved ✓". The user can still type a new key to overwrite — saving again replaces the stored value.

---

### Settings.tsx structure

```tsx
import { useAppStore } from '../../shared/stores/appStore'
import { ApiKeyInput } from './ApiKeyInput'

export function Settings() {
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  return (
    <div className="flex flex-col" style={{ height: '100dvh', backgroundColor: 'var(--color-bg-base)' }}>
      <header
        className="h-10 flex items-center px-4 border-b shrink-0"
        style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-bg-elevated)' }}
      >
        <button
          onClick={() => setCurrentView('main')}
          data-testid="settings-back-btn"
          className="text-xs mr-4"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label="Back to main view"
        >
          ← Back
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </span>
      </header>
      <div className="flex-1 overflow-y-auto p-6 max-w-lg">
        <ApiKeyInput />
      </div>
    </div>
  )
}
```

---

### App.tsx — view routing

```tsx
// Add at the top of App() body:
const currentView = useAppStore((s) => s.currentView)

// Add before the existing return:
if (currentView === 'settings') {
  return (
    <>
      <Settings />
      <Toaster position="bottom-center" toastOptions={{ ... }} />
    </>
  )
}

// Existing return unchanged (main layout)
```

Import: `import { Settings } from './features/settings/Settings'`

---

### SuggestionsList.tsx — AUTH_ERROR "Go to Settings" link (line 230 area)

```tsx
{streamError && (
  <div
    className="flex items-start gap-2 px-3 py-2 rounded text-xs"
    style={{
      backgroundColor: 'var(--color-bg-elevated)',
      color: 'var(--color-data-negative)',
      borderLeft: '2px solid var(--color-data-negative)',
    }}
    data-testid="stream-error-banner"
  >
    <span className="flex-1">{streamError.message}</span>
    {streamError.type === 'AUTH_ERROR' && (
      <button
        onClick={() => useAppStore.getState().setCurrentView('settings')}
        data-testid="auth-error-settings-link"
        className="text-xs shrink-0 underline"
        style={{ color: 'var(--color-accent-gold)' }}
      >
        Go to Settings
      </button>
    )}
    <button
      onClick={() => setStreamError(null)}
      aria-label="Dismiss error"
      className="shrink-0 leading-none"
      style={{ color: 'var(--color-text-muted)' }}
    >
      ×
    </button>
  </div>
)}
```

Add `import { useAppStore } from '../../shared/stores/appStore'` to `SuggestionsList.tsx`.

---

### What's Already Done — DO NOT Reinvent

| What | Status | Where |
|------|--------|-------|
| `appStore.currentView: 'main' \| 'settings'` | ✅ Done | `shared/stores/appStore.ts:12` |
| `appStore.setCurrentView()` | ✅ Done | `shared/stores/appStore.ts:17` |
| `optimizationStore.streamError: AppError \| null` | ✅ Done | `shared/stores/optimizationStore.ts:20` |
| `streamError` display in SuggestionsList | ✅ Done | `features/optimization/SuggestionsList.tsx:230-250` |
| `invokeCommand` wrapper | ✅ Done | `shared/utils/invokeCommand.ts` |
| `AppError` + `AUTH_ERROR` error type | ✅ Done | `shared/types/errors.ts` |
| `tauri-plugin-store` (NOT for API key) | ✅ Done | `Cargo.toml + lib.rs` |
| `commands/mod.rs` placeholder | ✅ Placeholder | `commands/mod.rs:4` |
| `services/mod.rs` placeholder | ✅ Placeholder | `services/mod.rs:4` |
| `invoke_claude_api` TODO comment | ✅ Placeholder | `claude_commands.rs:11` |
| `<Toaster>` in App.tsx | ✅ Done | `App.tsx:104-115` |
| `tauri-plugin-stronghold` | ❌ Missing | Task 1 adds to Cargo.toml |
| `keychain_service.rs` | ❌ Missing | Task 2 creates |
| `app_commands.rs` | ❌ Missing | Task 3 creates |
| `Settings.tsx` + `ApiKeyInput.tsx` | ❌ Missing | Task 6 creates |

---

### Coding Patterns from Previous Stories

- No barrel `index.ts` files — import directly from file paths
- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ color: 'var(--color-...)' }}` for design tokens
- Test files co-located with source: `Settings.test.tsx` next to `Settings.tsx`
- Mock Zustand in tests: `useAppStore.setState(overrides, true)` to fully reset
- Mock `@tauri-apps/api/core` (`invoke`) and `@tauri-apps/api/event` (`listen`) in test files
- `getState()` pattern in event handlers, not component hooks
- Primary button: `backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)'`
- Disabled button: `backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', opacity: 0.5`
- Inline errors (non-retryable, non-toast): below the relevant input, styled `color: 'var(--color-data-negative)'`

---

### Regression Warnings

- `App.tsx` gains a `currentView` branch — default is `'main'` so all existing tests are unaffected; add `useAppStore.setState({ currentView: 'main' }, true)` in App-level tests to be explicit
- `AppHeader.tsx` gains a new button — update `AppHeader.test.tsx` to account for it (existing test that counts buttons/children may need adjustment)
- `SuggestionsList.tsx` imports `useAppStore` (new import) — no existing test impact; add AUTH_ERROR test case
- `claude_commands.rs` replaces env var with keychain call — local dev needs the `ANTHROPIC_API_KEY` env var fallback (Task 4 optional step) or manual Stronghold key setup

### File Locations

**New files:**
- `lebo/src/features/settings/Settings.tsx`
- `lebo/src/features/settings/Settings.test.tsx`
- `lebo/src/features/settings/ApiKeyInput.tsx`
- `lebo/src/features/settings/ApiKeyInput.test.tsx`
- `lebo/src-tauri/src/commands/app_commands.rs`
- `lebo/src-tauri/src/services/keychain_service.rs`

**Modified files:**
- `lebo/src-tauri/Cargo.toml` — add `tauri-plugin-stronghold` + `argon2`
- `lebo/src-tauri/capabilities/default.json` — add stronghold permissions
- `lebo/src-tauri/src/lib.rs` — register stronghold plugin + app_commands in invoke_handler
- `lebo/src-tauri/src/commands/mod.rs` — add `pub mod app_commands;`
- `lebo/src-tauri/src/services/mod.rs` — add `pub mod keychain_service;`
- `lebo/src-tauri/src/commands/claude_commands.rs` — replace env var lookup with keychain call
- `lebo/src/App.tsx` — settings view routing
- `lebo/src/features/layout/AppHeader.tsx` — settings button
- `lebo/src/features/layout/AppHeader.test.tsx` — update for new button
- `lebo/src/shared/stores/appStore.ts` — add `isApiKeyConfigured` field
- `lebo/src/features/optimization/SuggestionsList.tsx` — AUTH_ERROR "Go to Settings" link
- `lebo/src/features/optimization/SuggestionsList.test.tsx` — AUTH_ERROR test case

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tauri-plugin-stronghold v2.3.1` does NOT expose a `StrongholdExt` trait or `app.stronghold()` method. The plugin is frontend-facing only. Backend key storage was implemented using `tauri_plugin_stronghold::stronghold::Stronghold` (the plugin's public wrapper struct) directly, bypassing the plugin's command layer.
- `Builder::new` closure parameter is `&str` (not `&[u8]`), requiring `.as_bytes()` for the argon2 call.
- `App.tsx` settings branch placed after all `useEffect` hooks to avoid React hooks-ordering violation.

### Completion Notes List

- Implemented full API key lifecycle: secure storage (Stronghold), backend commands, Settings view, AUTH_ERROR flow.
- `keychain_service.rs` uses `tauri_plugin_stronghold::stronghold::Stronghold` wrapper directly; all three methods (`set_api_key`, `get_api_key`, `is_api_key_configured`) satisfy AC invariants — key never crosses IPC boundary outbound, `is_api_key_configured` returns `Ok(false)` (not `Err`) on first launch.
- Debug builds retain `ANTHROPIC_API_KEY` env var fallback for local dev ergonomics.
- TypeScript: clean (`pnpm tsc --noEmit`). Tests: 369 pass (17 new added across Settings, ApiKeyInput, AppHeader, SuggestionsList).

### File List

**New files:**
- `lebo/src-tauri/src/services/keychain_service.rs`
- `lebo/src-tauri/src/commands/app_commands.rs`
- `lebo/src/features/settings/Settings.tsx`
- `lebo/src/features/settings/Settings.test.tsx`
- `lebo/src/features/settings/ApiKeyInput.tsx`
- `lebo/src/features/settings/ApiKeyInput.test.tsx`

**Modified files:**
- `lebo/src-tauri/Cargo.toml`
- `lebo/src-tauri/capabilities/default.json`
- `lebo/src-tauri/src/lib.rs`
- `lebo/src-tauri/src/commands/mod.rs`
- `lebo/src-tauri/src/services/mod.rs`
- `lebo/src-tauri/src/commands/claude_commands.rs`
- `lebo/src/App.tsx`
- `lebo/src/features/layout/AppHeader.tsx`
- `lebo/src/features/layout/AppHeader.test.tsx`
- `lebo/src/shared/stores/appStore.ts`
- `lebo/src/features/optimization/SuggestionsList.tsx`
- `lebo/src/features/optimization/SuggestionsList.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Argon2 params duplicated in lib.rs and keychain_service.rs — plugin builder KDF is never called for direct vault ops (bypassed per debug log), making it dead code; but the duplication misleads future devs into thinking changing lib.rs params affects vault encryption [lib.rs:28-37, keychain_service.rs:hash_vault_password()] ✅ fixed: lib.rs now delegates to `keychain_service::hash_vault_password()`
- [x] [Review][Patch] Corrupted vault masquerades as AUTH_ERROR in get_api_key — when vault file exists but fails to open, .map_err(|_| "AUTH_ERROR:...") swallows the real error; user sees "No API key configured" when they actually have a vault corruption they cannot diagnose [keychain_service.rs:get_api_key()] ✅ fixed: open_vault and load_client failures now propagate STORAGE_ERROR; only missing key returns AUTH_ERROR
- [x] [Review][Patch] load_client().or_else(|_| create_client()) in set_api_key absorbs all load_client errors — a corruption or version mismatch silently triggers create_client, discarding any recoverable client; should only fall through on "not found" errors [keychain_service.rs:set_api_key()] ✅ fixed: replaced or_else with explicit match; create_client only runs when load_client returns Err
- [x] [Review][Patch] useEffect dependency [setApiKeyConfigured] should be [] — this is a mount-only call; Zustand actions are stable refs but the intent is clearer and safer with an empty dep array [ApiKeyInput.tsx:useEffect] ✅ fixed: dependency array changed to []
- [x] [Review][Patch] Whitespace-only key accepted and stored — handleSave only guards !localKeyValue (empty string), so "   " passes and stores a useless key; fix: trim before empty check or reject in Rust [ApiKeyInput.tsx:handleSave] ✅ fixed: handleSave, disabled prop, and button style all use .trim()
- [x] [Review][Defer] Hardcoded vault password (VAULT_PASSWORD = b"lebo-vault-password") — spec dev notes explicitly document this as "standard practice for desktop app credential vaults"; acceptable for MVP [keychain_service.rs:5] — deferred, documented design decision
- [x] [Review][Defer] Debug env var override (#[cfg(debug_assertions)]) bypasses Stronghold — documented in story spec Task 4 as intentional dev ergonomic; deferred for security hardening story [claude_commands.rs:18-19] — deferred, documented design decision
- [x] [Review][Defer] Double-emit in invoke_claude_api (event + IPC return both fire on error) causing two sequential setStreamError calls — pre-existing pattern, not introduced by this story [claude_commands.rs] — deferred, pre-existing
- [x] [Review][Defer] hash_vault_password() blocks async executor (64 MB Argon2 on every vault open, not spawn_blocking-wrapped) — pre-existing concern, out of scope for this story [keychain_service.rs] — deferred, pre-existing
- [x] [Review][Defer] API key String not zeroized after use in get_api_key — memory hardening out of scope for this story — deferred, future security hardening

## Change Log

- 2026-04-25: Story 5.1 created — API Key Management & Settings View
- 2026-04-26: Story 5.1 implemented — all 10 tasks complete, 369 tests passing, status → review
- 2026-04-26: Story 5.1 code review — 5 patches applied, 5 deferred, 6 dismissed; status → done
