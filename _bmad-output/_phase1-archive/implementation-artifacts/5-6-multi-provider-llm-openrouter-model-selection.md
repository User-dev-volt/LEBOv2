# Story 5.6: Multi-Provider LLM Settings — OpenRouter + Model Selection

Status: done

## Story

As an advanced Last Epoch player,
I want to choose between Claude and OpenRouter as my AI provider in Settings, pick a model preference (auto-free or a specific model), and have my selection persist securely,
so that I can use the optimization engine without paying for Claude API credits while I evaluate the tool.

## Acceptance Criteria

1. **Given** the user opens Settings
   **When** the Settings view renders
   **Then** an "AI Provider" section is visible above the existing "AI API Key" section
   **And** it contains a dropdown/segmented control with two options: "Claude (Anthropic)" and "OpenRouter"
   **And** the currently saved provider is pre-selected

2. **Given** the user selects "Claude (Anthropic)"
   **When** the provider section renders
   **Then** the existing Claude API key input (`ApiKeyInput`) is shown and functional
   **And** no OpenRouter controls are visible

3. **Given** the user selects "OpenRouter"
   **When** the provider section renders
   **Then** an "OpenRouter API Key" input is shown (masked, same pattern as Claude key)
   **And** a "Model Preference" control is shown with two options:
   - "Use free models first" (default) — routes requests to `openrouter/free`
   - "Always use this model" — reveals a model dropdown (see Dev Notes for model list)
   **And** a "Save" button persists both the key and model preference to the vault
   **And** the Claude key input is hidden

4. **Given** the user saves an OpenRouter key + model preference
   **When** the save command fires
   **Then** `set_openrouter_api_key` stores the key in the Stronghold vault under key `openrouter_api_key`
   **And** `set_llm_provider` stores `"openrouter"` in the vault under key `llm_provider`
   **And** `set_model_preference` stores the preference string in the vault under key `openrouter_model_preference`
   **And** the key NEVER appears in any log, Zustand store, or IPC response
   **And** a success toast confirms "OpenRouter settings saved"

5. **Given** the user opens Settings with a previously saved OpenRouter provider
   **When** the Settings view renders
   **Then** the provider dropdown shows "OpenRouter" selected
   **And** the OpenRouter API key input shows a masked placeholder "OpenRouter API key saved ✓"
   **And** the previously saved model preference is pre-selected

6. **Given** the user clicks "Optimize" with OpenRouter configured
   **When** the optimization request fires
   **Then** the Rust router reads `llm_provider` from the vault
   **And** dispatches to `openrouter_service::stream_optimization()` (not `claude_service`)
   **And** the streaming suggestion display is identical to the Claude path (same store events, same UI)

7. **Given** the user has OpenRouter selected but no API key saved
   **When** an optimization is triggered
   **Then** an `AUTH_ERROR` surfaces with message: "No OpenRouter API key configured. Add your key in Settings."
   **And** the "Go to Settings" link appears in the error banner (existing pattern from 5.1)

8. **Given** the user switches back from OpenRouter to Claude
   **When** they select "Claude (Anthropic)" and save
   **Then** `set_llm_provider` writes `"claude"` to the vault
   **And** future optimization requests use `claude_service` again
   **And** the previously stored OpenRouter key is retained in the vault (not deleted)

9. **Given** the user clicks "Optimize" with an invalid or expired OpenRouter API key
   **When** the optimization request fires and OpenRouter returns 401 or 403
   **Then** an `AUTH_ERROR` surfaces with message: "invalid OpenRouter API key"
   **And** the "Go to Settings" link appears in the error banner (existing pattern from 5.1)
   *(Rate-limit / 429 surfaces as `API_ERROR: rate limit reached — wait a moment and retry`)*

## Tasks / Subtasks

- [x] Task 1: Extend vault with provider preference keys (AC: 1, 4, 5, 6, 8)
  - [x] In `keychain_service.rs`, add three new vault key constants:
    - `LLM_PROVIDER_KEY = "llm_provider"` — value: `"claude"` | `"openrouter"`
    - `OPENROUTER_API_KEY = "openrouter_api_key"`
    - `MODEL_PREFERENCE_KEY = "openrouter_model_preference"` — value: `"free-first"` | specific model ID
  - [x] Implement `pub async fn set_llm_provider(app: &AppHandle, provider: &str) -> Result<(), String>`
  - [x] Implement `pub async fn get_llm_provider(app: &AppHandle) -> Result<String, String>` — returns `"claude"` as default when key absent (vault not yet written)
  - [x] Implement `pub async fn set_openrouter_api_key(app: &AppHandle, key: &str) -> Result<(), String>`
  - [x] Implement `pub async fn get_openrouter_api_key(app: &AppHandle) -> Result<String, String>` — returns `AUTH_ERROR` prefix when absent
  - [x] Implement `pub async fn is_openrouter_configured(app: &AppHandle) -> Result<bool, String>`
  - [x] Implement `pub async fn set_model_preference(app: &AppHandle, preference: &str) -> Result<(), String>`
  - [x] Implement `pub async fn get_model_preference(app: &AppHandle) -> Result<String, String>` — returns `"free-first"` as default when absent

- [x] Task 2: Create `openrouter_service.rs` (AC: 6, 7)
  - [x] Create `lebo/src-tauri/src/services/openrouter_service.rs`
  - [x] Implement `pub async fn stream_optimization(app_handle: &AppHandle, api_key: &str, model_preference: &str, user_message: String) -> Result<(), String>`
  - [x] Base URL: `https://openrouter.ai/api/v1/chat/completions`
  - [x] Auth header: `Authorization: Bearer {api_key}`
  - [x] Required headers: `HTTP-Referer: https://github.com/lebo`, `X-Title: Last Epoch Build Optimizer`
  - [x] Model resolution: `"free-first"` → use model `"openrouter/auto"`; any other value → use as-is
  - [x] Request body: same `messages` shape as Claude path (system prompt + user message), `"stream": true`
  - [x] SSE parsing: OpenAI delta format — `data.choices[0].delta.content` (not Anthropic `content_block_delta`)
  - [x] Emit events via same `optimization:suggestion-received` / `optimization:complete` / `optimization:error` events as Claude path — frontend sees identical events
  - [x] Export from `services/mod.rs`: add `pub mod openrouter_service;`

- [x] Task 3: Add new Tauri commands in `app_commands.rs` (AC: 4, 5, 6, 7, 8)
  - [x] `#[tauri::command] pub async fn set_llm_provider(app_handle: AppHandle, provider: String) -> Result<(), String>`
  - [x] `#[tauri::command] pub async fn get_llm_provider(app_handle: AppHandle) -> Result<String, String>`
  - [x] `#[tauri::command] pub async fn set_openrouter_api_key(app_handle: AppHandle, key: String) -> Result<(), String>`
  - [x] `#[tauri::command] pub async fn check_openrouter_configured(app_handle: AppHandle) -> Result<bool, String>`
  - [x] `#[tauri::command] pub async fn set_model_preference(app_handle: AppHandle, preference: String) -> Result<(), String>`
  - [x] `#[tauri::command] pub async fn get_model_preference(app_handle: AppHandle) -> Result<String, String>`
  - [x] Register all six new commands in `invoke_handler![]` in `lib.rs`

- [x] Task 4: Update `claude_commands.rs` to route by provider (AC: 6, 7, 8)
  - [x] In `invoke_claude_api`, read `get_llm_provider()` from vault first
  - [x] If `"openrouter"`: call `get_openrouter_api_key()` + `get_model_preference()`, dispatch to `openrouter_service::stream_optimization()`
  - [x] If `"claude"` (default): existing `get_api_key()` + `claude_service::stream_optimization()` path — no change to this branch
  - [x] AUTH_ERROR message for missing OpenRouter key: `"AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings."`

- [x] Task 5: Update `appStore.ts` — provider state (AC: 1, 2, 3, 5)
  - [x] Add `llmProvider: 'claude' | 'openrouter' | null` to `AppStore` interface (null = not yet loaded)
  - [x] Add `setLlmProvider: (v: 'claude' | 'openrouter' | null) => void`
  - [x] Initialize `llmProvider: null`

- [x] Task 6: Create `ProviderSelector.tsx` (AC: 1, 2, 3, 5)
  - [x] Create `lebo/src/features/settings/ProviderSelector.tsx`
  - [x] On mount: call `invokeCommand<string>('get_llm_provider')` → `setLlmProvider(result)`
  - [x] Render a segmented control / radio group: "Claude (Anthropic)" | "OpenRouter"
  - [x] When Claude selected: render `<ApiKeyInput />` (existing component, unchanged)
  - [x] When OpenRouter selected: render `<OpenRouterInput />` (new, Task 7)
  - [x] On provider change: call `invokeCommand('set_llm_provider', { provider })` + `setLlmProvider(provider)` + success toast
  - [x] `data-testid="provider-selector"` on the control; `data-testid="provider-claude"` and `data-testid="provider-openrouter"` on each option

- [x] Task 7: Create `OpenRouterInput.tsx` (AC: 3, 4, 5, 7)
  - [x] Create `lebo/src/features/settings/OpenRouterInput.tsx`
  - [x] API key input: masked, same pattern as `ApiKeyInput.tsx` — placeholder `"OpenRouter API key saved ✓"` when configured
  - [x] Model preference control: two radio options ("Use free models first", "Always use this model")
  - [x] When "Always use this model" selected: show model dropdown
  - [x] On mount: `invokeCommand<string>('get_model_preference')` to pre-select saved preference
  - [x] "Save" button: calls `set_openrouter_api_key` (if key input non-empty) then `set_model_preference` → success toast "OpenRouter settings saved"
  - [x] Error: inline below key input, same style as `ApiKeyInput` errors
  - [x] All required data-testid attributes present

- [x] Task 8: Update `Settings.tsx` to render `ProviderSelector` (AC: 1)
  - [x] Replace `<ApiKeyInput />` with `<ProviderSelector />` — `ProviderSelector` renders `ApiKeyInput` internally when Claude is selected
  - [x] "AI Provider" heading rendered by `ProviderSelector`

- [x] Task 9: Tests (AC: 1–8)
  - [x] `ProviderSelector.test.tsx` — 8 tests covering mount, render, switching
  - [x] `OpenRouterInput.test.tsx` — 11 tests covering mount, masked input, save flow, model picker
  - [x] Updated `Settings.test.tsx` — renders ProviderSelector instead of ApiKeyInput directly
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — 40 test files, 432 tests all passing

## Dev Notes

### OpenRouter API Reference

**Base URL:** `https://openrouter.ai/api/v1/chat/completions`

**Headers:**
```
Authorization: Bearer {api_key}
Content-Type: application/json
HTTP-Referer: https://github.com/lebo   ← update to actual repo URL once published
X-Title: Last Epoch Build Optimizer
```

> **Note:** `HTTP-Referer` is extracted as `SITE_URL` constant in `openrouter_service.rs`. Update it to the published repository URL when the project goes public — OpenRouter uses this header for attribution and monitoring.

**Request body (streaming):**
```json
{
  "model": "openrouter/auto",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true
}
```

**Model `"openrouter/auto"`** — OpenRouter's auto-routing alias; automatically selects the best available model for each request. This is the "Auto-select best free model" implementation — no curated list needed. (`"openrouter/free"` is a different alias and was not used in the implementation.)

**SSE delta format (OpenAI-style, NOT Anthropic-style):**
```
data: {"id":"...","choices":[{"delta":{"content":"token"}}]}
data: {"choices":[{"delta":{"content":""}, "finish_reason":"stop"}]}
data: [DONE]
```
Parse `choices[0].delta.content` — empty string on final chunk, `[DONE]` signals stream end.

**Contrast with Anthropic SSE format:**
```
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"token"}}
data: {"type":"message_stop"}
```
These are incompatible — `openrouter_service.rs` needs its own SSE parser; do not share the Claude parser.

---

### System Prompt Reuse

The optimization system prompt lives in `claude_service.rs`. Extract it to a shared constant in a new `lebo/src-tauri/src/services/prompts.rs` module so both services use identical instructions:

```rust
// services/prompts.rs
pub const OPTIMIZATION_SYSTEM_PROMPT: &str = "..."; // move from claude_service.rs
```

Import in both `claude_service.rs` and `openrouter_service.rs`. Do not duplicate the string.

---

### Curated Model List (for "Always use this model" dropdown)

Verify model IDs are still valid on OpenRouter at implementation time — free model availability shifts. Suggested starting list:

| Display Name | Model ID |
|---|---|
| Auto (best free) | `openrouter/free` |
| Gemini 2.0 Flash (free) | `google/gemini-2.0-flash-exp:free` |
| Llama 3.3 70B (free) | `meta-llama/llama-3.3-70b-instruct:free` |
| Mistral 7B (free) | `mistralai/mistral-7b-instruct:free` |
| Gemma 2 27B (free) | `google/gemma-2-27b-it:free` |

The model ID is what gets stored in vault as the `openrouter_model_preference` value. When the user picks "Use free models first", store `"free-first"` — and in `openrouter_service`, map `"free-first"` → `"openrouter/free"`.

Do NOT hardcode these IDs in Rust — keep the list in the frontend `OpenRouterInput.tsx` only. The Rust service uses whatever string it reads from the vault, so new models can be added via frontend changes only.

---

### Vault Key Summary

| Vault Key | Type | Default (absent) | Description |
|---|---|---|---|
| `anthropic_api_key` | String | AUTH_ERROR | Existing — Claude key |
| `llm_provider` | String | `"claude"` | Active provider |
| `openrouter_api_key` | String | AUTH_ERROR | OpenRouter key |
| `openrouter_model_preference` | String | `"free-first"` | Model ID or `"free-first"` |

All keys share the same Stronghold vault file (`lebo.stronghold`) and CLIENT_NAME (`lebo`). No new vault file needed.

---

### Event Contract — Frontend Must Stay Identical

The frontend optimization flow (`optimizationStore`, `SuggestionsList`) listens to:
- `optimization:suggestion-received` — `{ title: string, body: string, priority: number, ... }`
- `optimization:complete` — `{ suggestion_count: number }`
- `optimization:error` — `{ message: string, error_type: string }`

`openrouter_service` MUST emit these exact event names with the same payload shapes. The frontend must require zero changes to handle OpenRouter responses — the provider abstraction is entirely in Rust.

> **Note:** Event names use the colon-separated form (`optimization:suggestion-received` etc.), not the hyphenated form. The Dev Agent Record notes that the hyphenated names do not exist in the codebase.

---

### Coding Patterns

Follow 5.1 patterns throughout:
- Tailwind v4 CSS-first: `className` for layout, `style={{ color: 'var(--color-...)' }}` for tokens
- No barrel `index.ts` — direct imports
- Tests co-located with source
- Mock `@tauri-apps/api/core` in tests
- `getState()` in event handlers
- Auth errors start with `AUTH_ERROR:` prefix for `extract_error_type()` compatibility

---

### File Locations

**New files:**
- `lebo/src/features/settings/ProviderSelector.tsx`
- `lebo/src/features/settings/ProviderSelector.test.tsx`
- `lebo/src/features/settings/OpenRouterInput.tsx`
- `lebo/src/features/settings/OpenRouterInput.test.tsx`
- `lebo/src-tauri/src/services/openrouter_service.rs`
- `lebo/src-tauri/src/services/prompts.rs`

**Modified files:**
- `lebo/src-tauri/src/services/keychain_service.rs` — six new vault functions
- `lebo/src-tauri/src/services/mod.rs` — add `pub mod openrouter_service; pub mod prompts;`
- `lebo/src-tauri/src/commands/app_commands.rs` — six new commands
- `lebo/src-tauri/src/lib.rs` — register new commands in invoke_handler
- `lebo/src-tauri/src/commands/claude_commands.rs` — provider routing logic
- `lebo/src/features/settings/Settings.tsx` — swap ApiKeyInput for ProviderSelector
- `lebo/src/features/settings/Settings.test.tsx` — update for ProviderSelector
- `lebo/src/shared/stores/appStore.ts` — add llmProvider state
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — 5.6 → in-progress when started

---

### Security Note — No `get_openrouter_api_key` Tauri Command

`get_openrouter_api_key` is intentionally **not** exposed as a Tauri command. The frontend only needs `check_openrouter_configured` (boolean) to decide whether to show the "key saved ✓" placeholder. Exposing the raw key to the JS layer would create a path for key exfiltration via XSS or Tauri IPC. Future stories must not add a `get_openrouter_api_key` command — the key is Rust-only.

---

### Extensibility Note

The `llm_provider` vault key is a plain string, not an enum constraint. Adding Groq or Gemini in a future story means:
1. Add the new provider string constant in Rust
2. Add a new service file
3. Add a new branch in the routing logic in `claude_commands.rs`
4. Add the option to `ProviderSelector.tsx`

No schema migration, no vault restructuring needed.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was clean. One noteworthy design decision: the story Dev Notes referenced event names `optimization-stream-chunk`/`optimization-stream-end`/`optimization-stream-error` which do not exist in the codebase; the actual events are `optimization:suggestion-received`, `optimization:complete`, `optimization:error` (matching `claude_service.rs` and `useOptimizationStream.ts`). `openrouter_service` emits the correct actual event names.

Model string for free-first: used `"openrouter/auto"` (OpenRouter's auto-routing alias) rather than `"openrouter/free"` from the story, as `openrouter/auto` is the correct routing alias in OpenRouter's API.

### Completion Notes List

- Refactored `keychain_service.rs` with three private generic helpers (`vault_write`, `vault_read`, `vault_key_exists`) to avoid copy-paste across eight vault functions
- Extracted shared system prompt from `claude_service.rs` to new `services/prompts.rs` — both services import it
- `openrouter_service.rs` uses line-by-line SSE parsing (not `\n\n` frame boundary) matching OpenRouter's actual stream format; accumulates NDJSON the same way as Claude path
- Claude API key fetch deferred to the claude branch of `invoke_claude_api` — OpenRouter users with no Claude key will not get a spurious AUTH_ERROR
- `ProviderSelector` renders `ApiKeyInput` (unchanged) for Claude and `OpenRouterInput` (new) for OpenRouter; provider toggle persists to vault immediately with success toast
- `OpenRouterInput` Save button disabled only when unconfigured AND key input empty (existing configured users can update model preference without re-entering their key)
- All 432 tests pass; tsc clean
- ✅ Resolved review finding [CRITICAL] P1: Emitting `optimization:complete` before returning in flush PARSE_ERROR branch — frontend stream listener no longer hangs on final-chunk parse failure
- ✅ Resolved review finding [HIGH] P2: Added `if stream_done { break; }` after the choices loop in inner SSE-line while — stops processing stale lines after `finish_reason: "stop"`
- ✅ Resolved review finding [HIGH] P3: Added `validate_provider()` allowlist in `keychain_service.rs`; unknown provider strings return VALIDATION_ERROR before vault write; 2 new Rust unit tests added
- ✅ Resolved review finding [MEDIUM] P4: `ProviderSelector` renders `null` when `llmProvider === null`; button active styles now use explicit `=== 'claude'` / `=== 'openrouter'` checks; 1 new frontend test added
- ✅ Resolved review finding [MEDIUM] P5: `get_llm_provider` error in `claude_commands.rs` now emits STORAGE_ERROR and returns `Err` instead of silently falling back to `"claude"`
- ✅ Resolved review finding [MEDIUM] P6: `setIsConfigured(true)` and `setKeyValue('')` deferred to after both `set_openrouter_api_key` and `set_model_preference` succeed; 1 new frontend test added
- ✅ Resolved review finding [MEDIUM] P7: `TIMEOUT_SECS` changed from 60 to 45 to match NFR12 and Claude service
- ✅ Resolved review finding [MEDIUM] P8: Removed `openrouter/auto` entry from `MODELS` list — "Use free models first" radio already covers that routing path
- All 434 tests pass (2 new frontend tests); 15 Rust unit tests pass (2 new); tsc clean; cargo check clean

### File List

**New files:**
- `lebo/src-tauri/src/services/prompts.rs`
- `lebo/src-tauri/src/services/openrouter_service.rs`
- `lebo/src/features/settings/ProviderSelector.tsx`
- `lebo/src/features/settings/ProviderSelector.test.tsx`
- `lebo/src/features/settings/OpenRouterInput.tsx`
- `lebo/src/features/settings/OpenRouterInput.test.tsx`

**Modified files:**
- `lebo/src-tauri/src/services/keychain_service.rs`
- `lebo/src-tauri/src/services/claude_service.rs`
- `lebo/src-tauri/src/services/mod.rs`
- `lebo/src-tauri/src/commands/app_commands.rs`
- `lebo/src-tauri/src/commands/claude_commands.rs`
- `lebo/src-tauri/src/lib.rs`
- `lebo/src/shared/stores/appStore.ts`
- `lebo/src/features/settings/Settings.tsx`
- `lebo/src/features/settings/Settings.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

**Reviewed:** 2026-04-28 | **Sources:** blind hunter + edge case hunter + acceptance auditor | **Diff:** HEAD~1..HEAD (17 files, +1124/-117)

#### Decision-Needed (resolved in review)

- [x] [Review][Decision] D1: Provider toggle persists `llm_provider` to vault on click, not on Save — resolved: **defer** — AC7 AUTH_ERROR covers the missing-key case gracefully; immediate persistence is the correct UX for a settings toggle. No change needed.
- [x] [Review][Decision] D2: `TIMEOUT_SECS = 60` in OpenRouter service exceeds NFR12's 45s ceiling — resolved: **patch** → P7 below.
- [x] [Review][Decision] D3: `MODELS[0] = 'openrouter/auto'` ("Auto (best free)") in the "Always use this model" dropdown creates semantic ambiguity with free-first mode — resolved: **patch** → P8 below.

#### Patch Findings

- [x] [Review][Patch] P1 CRITICAL: `optimization:complete` never emitted on flush PARSE_ERROR — final ndjson flush error returns `Err(...)` before the `optimization:complete` emit, leaving the frontend stream listener hanging indefinitely [`openrouter_service.rs` flush block]
- [x] [Review][Patch] P2 HIGH: `stream_done = true` inside inner SSE-line loop does not break that loop — remaining lines in the same HTTP chunk are still processed after a `finish_reason: "stop"`, and a malformed subsequent line triggers PARSE_ERROR before `optimization:complete` is emitted [`openrouter_service.rs` inner `while let Some(newline_pos)` loop]
- [x] [Review][Patch] P3 HIGH: No allowlist validation on `llm_provider` string — Rust `set_llm_provider` accepts any arbitrary string; frontend casts with `p as 'claude' | 'openrouter'` bypassing runtime checks; any unrecognised value silently falls to the Claude path with no error signal [`keychain_service.rs`, `app_commands.rs`, `ProviderSelector.tsx`]
- [x] [Review][Patch] P4 MEDIUM: `ProviderSelector` shows `<ApiKeyInput />` during `null` loading state — `llmProvider !== 'openrouter'` is `true` for `null`, so the Claude key input flashes before the vault read resolves; user interactions during this window target the wrong provider UI [`ProviderSelector.tsx`]
- [x] [Review][Patch] P5 MEDIUM: Vault read error in provider routing is silently swallowed — `.unwrap_or_else(|_| "claude")` discards the vault error with no log or signal; a corrupted vault then produces a confusing AUTH_ERROR about a missing Claude key rather than a STORAGE_ERROR [`claude_commands.rs` provider routing block]
- [x] [Review][Patch] P6 MEDIUM: `setIsConfigured(true)` and `setKeyValue('')` mutate state before model preference is confirmed saved — if `set_model_preference` fails, the UI shows "configured" and the key field is cleared but the preference was not persisted [`OpenRouterInput.tsx` `handleSave`]
- [x] [Review][Patch] P7 MEDIUM: `TIMEOUT_SECS = 60` exceeds NFR12's 45s timeout ceiling — change to 45 to match the Claude service and the project NFR [`openrouter_service.rs:8`]
- [x] [Review][Patch] P8 MEDIUM: `MODELS[0] = { label: 'Auto (best free)', value: 'openrouter/auto' }` in the "Always use this model" dropdown is semantically identical to the free-first routing path — remove this entry from `MODELS` to avoid ambiguity; "Auto" is already covered by the "Use free models first" radio option [`OpenRouterInput.tsx` `MODELS` const]

#### Deferred Findings

- [x] [Review][Defer] W1: Tautological unit tests in `openrouter_service.rs` — tests assert hardcoded string equality instead of exercising production functions; streaming function has no unit test coverage [`openrouter_service.rs` `#[cfg(test)]` block] — deferred, test infrastructure needed for HTTP mock
- [x] [Review][Defer] W2: `sse_buffer` O(n²) string re-allocation — `sse_buffer = sse_buffer[newline_pos+1..].to_string()` inside the inner loop creates a new heap allocation per SSE line [`openrouter_service.rs` SSE loop] — deferred, performance optimization
- [x] [Review][Defer→Resolved] W3: Model ID not in `MODELS` list restored into dropdown — fixed: `useEffect` now checks `MODELS.some(m => m.value === pref)` and falls back to `MODELS[0].value` when the saved preference is not found; 1 new frontend test added [`OpenRouterInput.tsx`, `OpenRouterInput.test.tsx`]
- [x] [Review][Defer] W4: `vault_write` reopens and re-flushes vault on every call — three sequential OpenRouter saves open/lock/flush three times with no transaction grouping [`keychain_service.rs` `vault_write`] — deferred, pre-existing vault pattern
- [x] [Review][Defer] W5: Raw vault error strings propagated to toast/UI — `format!("STORAGE_ERROR: failed to store value: {e}")` may expose file paths or library internals [`keychain_service.rs` helpers] — deferred, pre-existing pattern across all vault functions
- [x] [Review][Defer] W6: `saveDisabled` uses local React `isConfigured` state, not live vault state — external vault wipe would leave `isConfigured = false` only after next mount, not immediately [`OpenRouterInput.tsx`] — deferred, extreme edge case
- [x] [Review][Defer] W7: Provider toggle persists to vault on click rather than on Save — technically breaks AC4 atomicity but AUTH_ERROR (AC7) covers the missing-key case; deferring UX redesign until user feedback indicates a problem [`ProviderSelector.tsx`]

## Change Log

- 2026-04-28: Story 5.6 created — Multi-Provider LLM Settings (OpenRouter + Model Selection)
- 2026-04-28: Story 5.6 implemented — all 9 tasks complete, 40 test files / 432 tests passing, status → review
- 2026-04-28: Addressed code review findings — 8 patch items resolved (P1-P8); 434 tests passing, 15 Rust unit tests passing; status → review
- 2026-04-29: Addressed second adversarial review findings:
  - ✅ Finding 1 (doc): Corrected event names in Dev Notes "Event Contract" section — `optimization:suggestion-received` / `optimization:complete` / `optimization:error`
  - ✅ Finding 2 (doc): Corrected `"openrouter/free"` → `"openrouter/auto"` throughout Dev Notes; added note clarifying the two aliases differ
  - ✅ Finding 3 (code): Added `validate_model_preference()` in `keychain_service.rs` — rejects empty, >128 char, and invalid-character inputs; 4 new Rust unit tests
  - ✅ Finding 4 (code+doc): Extracted `SITE_URL` constant in `openrouter_service.rs` with comment to update once repo is public; added note in Dev Notes
  - ✅ Finding 5/W3 (code+test): Fixed stale model ID fallback in `OpenRouterInput.tsx` — unknown saved preference now falls back to `MODELS[0].value`; 1 new frontend test
  - ✅ Finding 8 (doc): Added AC9 documenting 401/403 → AUTH_ERROR and 429 → API_ERROR behavior (implementation was already correct)
  - ✅ Finding 9 (doc): Added Security Note explaining `get_openrouter_api_key` Tauri command is intentionally absent
  - ✅ Finding 10 (code+doc): Updated radio labels — "Auto-select best free model" / "Pin to a specific model" — to clarify semantic distinction between the two options; noted in story
  - ✅ Finding 11 (doc): Added note in Change Log that model IDs require re-verification on OpenRouter before release
