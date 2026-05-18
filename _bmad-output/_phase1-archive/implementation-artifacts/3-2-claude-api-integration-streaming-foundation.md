# Story 3.2: Claude API Integration — Streaming Foundation

Status: done

## Story

As an advanced Last Epoch player,
I want AI-powered optimization suggestions to stream into the suggestions panel as they're generated,
So that I see results progressively and the wait feels shorter than a 30-second block.

## Acceptance Criteria

1. **Given** a build is loaded and a Claude API key is configured
   **When** the user triggers optimization
   **Then** the Rust backend calls the Claude API with the current build state, game data context, and selected goal
   **And** suggestions stream via Tauri events (`optimization:suggestion-received`) as the Claude API streams its response
   **And** `useOptimizationStore` accumulates complete suggestions in real time via `useOptimizationStream.ts`
   **And** the full optimization completes within ≤ 30 seconds under normal network conditions (NFR4)

2. **Given** the Claude API request is in flight
   **When** 45 seconds elapse without completion (NFR12)
   **Then** the request times out and is cancelled
   **And** `optimization:error` event fires with `{ type: "TIMEOUT", message: "..." }`
   **And** build state is intact — no corruption

3. **Given** the Claude API returns an error (rate limit, 5xx, network failure)
   **When** the error occurs
   **Then** `optimization:error` event fires with the appropriate `AppError`
   **And** no silent failure

4. **Given** optimization is running
   **When** the user interacts with other UI elements
   **Then** input latency remains ≤ 100ms — renderer thread is never blocked (NFR6)

5. **Given** `useOptimizationStream.ts` registers event listeners
   **When** the component that called it unmounts mid-stream
   **Then** all three event listeners (`optimization:suggestion-received`, `optimization:complete`, `optimization:error`) are unlistened AND `setIsOptimizing(false)` is called
   **And** the Optimize button never gets permanently stuck in "Analyzing..." state

6. **Given** `invoke_claude_api` is called
   **When** a complete NDJSON line exceeds 64KB without a `\n` boundary
   **Then** `claude_service.rs` emits `optimization:error` and aborts the stream

## Tasks / Subtasks

- [x] Task 1: Research — write `docs/claude-prompt-spec.md` BEFORE any Rust implementation
  - [x] Define system prompt: NDJSON output contract, schema, rules
  - [x] Define user message format: build context + game data node subset + goal
  - [x] Document expected response schema: `{ rank, from_node_id, to_node_id, points_change, explanation }`
  - [x] Test prompt manually in Claude.ai — verify NDJSON output (no markdown fences, no preamble)
  - [x] Document the API request structure (model, max_tokens, stream flag)
  - [x] Note: `docs/claude-prompt-spec.md` must exist before Task 2

- [x] Task 2: `claude_service.rs` (AC: 1, 2, 3, 6)
  - [x] Create `src-tauri/src/services/claude_service.rs`
  - [x] `ClaudeRequest` / `ClaudeMessage` structs for request serialization
  - [x] `SuggestionEvent` struct for parsed NDJSON lines
  - [x] `stream_optimization` async fn: POST to Claude API with streaming, parse SSE, emit Tauri events
  - [x] SSE parsing: read bytes stream, split on `\n`, extract `data:` payload, parse as Anthropic delta JSON
  - [x] NDJSON accumulation: collect assistant text deltas; on `\n`, parse accumulated line as JSON
  - [x] 45s timeout on the reqwest client
  - [x] MAX_NDJSON_LINE guard (64KB)
  - [x] Emit `optimization:suggestion-received`, `optimization:complete`, `optimization:error` events

- [x] Task 3: `claude_commands.rs` (AC: 1)
  - [x] Create `src-tauri/src/commands/claude_commands.rs`
  - [x] `invoke_claude_api(app_handle, build_state: serde_json::Value, goal: String) -> Result<(), String>`
  - [x] Read API key from `ANTHROPIC_API_KEY` env var (Story 5.1 migrates to Stronghold)
  - [x] If key missing: return `Err("AUTH_ERROR: no API key configured")`
  - [x] Load game data from disk for active class/mastery (use `game_data_service` helpers)
  - [x] Build context: node map (id → name, tags, maxPoints, currentPoints) for all class+mastery nodes
  - [x] Call `claude_service::stream_optimization(app_handle, api_key, build_context, goal).await`

- [x] Task 4: Wire into Rust module system and Tauri
  - [x] Add `pub mod claude_commands;` to `src-tauri/src/commands/mod.rs`
  - [x] Add `pub mod claude_service;` to `src-tauri/src/services/mod.rs`
  - [x] Add `futures-util = "0.3"` and `reqwest = { version = "0.12", features = ["json", "stream"] }` to `Cargo.toml`
  - [x] Import and register `invoke_claude_api` in `lib.rs` `invoke_handler!`
  - [x] Run `cargo build` — zero errors

- [x] Task 5: `useOptimizationStream.ts` (AC: 4, 5)
  - [x] Create `src/shared/stores/useOptimizationStream.ts`
  - [x] `useOptimizationStream()` React hook
  - [x] Registers listeners for `optimization:suggestion-received`, `optimization:complete`, `optimization:error` via `listen()` from `@tauri-apps/api/event`
  - [x] On `suggestion-received`: parse `SuggestionResult` (including delta computation via `calculateScore`), call `addSuggestion`
  - [x] On `complete`: call `setIsOptimizing(false)`
  - [x] On `error`: call `setIsOptimizing(false)`, store error in `optimizationStore.streamError`
  - [x] Cleanup: `useEffect` returns unlisten for all three listeners + `setIsOptimizing(false)`
  - [x] Export `startOptimization()` function: calls `clearSuggestions()`, `setIsOptimizing(true)`, then `invokeCommand('invoke_claude_api', { buildState, goal })`

- [x] Task 6: Add `streamError` to `optimizationStore.ts`
  - [x] Add `streamError: AppError | null` field, init to `null`
  - [x] Add `setStreamError(error: AppError | null)` action
  - [x] Clear `streamError` in `clearSuggestions()` (reset on new run)

- [x] Task 7: Tests (AC: 1–6)
  - [x] `useOptimizationStream.test.ts`: mock `listen` from `@tauri-apps/api/event`; verify listeners registered, suggestions added, cleanup fires, error stored
  - [x] `optimizationStore.test.ts`: add tests for `streamError` field
  - [x] Rust: add `#[cfg(test)]` module to `claude_service.rs` — unit tests for NDJSON parsing, SSE frame extraction, message_stop detection
  - [x] Run `pnpm tsc --noEmit` + `pnpm vitest run` — both pass (215 tests)

### Review Follow-ups (AI)

- [x] [Review][Patch][HIGH] Remove double `optimization:error` emission for PARSE_ERROR paths [`claude_service.rs` + `claude_commands.rs`]
- [x] [Review][Patch][MEDIUM] Fix listener cleanup race condition in `useOptimizationStream.ts` — add `isMounted` flag (AC5 partial failure) [`useOptimizationStream.ts`]
- [x] [Review][Defer] `is_message_stop` convoluted boolean chain — correct but non-idiomatic [`claude_service.rs:297-303`] — deferred, pre-existing style
- [x] [Review][Defer] Misleading `useEffect` dep array (Zustand actions are stable, `[]` is more honest) [`useOptimizationStream.ts:123`] — deferred, cosmetic

## Dev Notes

### ⚠️ Critical Prerequisite Order

**Task 1 (`docs/claude-prompt-spec.md`) MUST be complete before Task 2 (`claude_service.rs`).** The prompt spec defines the NDJSON contract that determines how the Rust parser works. Writing the parser before locking the spec will create mismatches.

**Story 3.1 (Scoring Engine) is a HARD PREREQUISITE for this story** — `calculateScore` is called in `useOptimizationStream.ts` to compute deltas for each streamed suggestion. It must already exist at `src/features/optimization/scoringEngine.ts`. ✅ Done.

---

### API Key for This Story (Story 5.1 Deferred)

`tauri-plugin-stronghold` is deferred to Story 5.1. For Story 3.2, read the API key from the `ANTHROPIC_API_KEY` environment variable in `claude_commands.rs`:

```rust
let api_key = std::env::var("ANTHROPIC_API_KEY")
    .map_err(|_| "AUTH_ERROR: no API key configured. Set ANTHROPIC_API_KEY env var.".to_string())?;
```

**Story 5.1 will replace this** with Stronghold vault read. Mark the line with `// TODO(story-5.1): replace env var with keychain_service::get_api_key(&app_handle)`.

The `AUTH_ERROR:` prefix causes `normalizeAppError` to produce `AppError { type: 'AUTH_ERROR', message: 'No API key configured. Add your Claude API key in Settings.' }`.

---

### HTTP Client Pattern

Follow `game_data_service.rs` exactly — use the reqwest re-export from tauri-plugin-http:

```rust
use tauri_plugin_http::reqwest;
```

This is the established HTTP pattern. Do NOT add a separate `reqwest` crate to `Cargo.toml` — it's already available via `tauri-plugin-http`.

For streaming, you need `futures_util::StreamExt` to iterate `response.bytes_stream()`. Add to `Cargo.toml`:
```toml
futures-util = "0.3"
```

---

### Rust Error String Format

Rust commands return `Result<T, String>` (not `Result<T, AppError>`). Follow the existing pattern from `game_data_service.rs`:

```rust
// Prefix strings must match ErrorType keys in errorNormalizer.ts
"API_ERROR: rate limit reached"
"NETWORK_ERROR: connection failed"
"TIMEOUT: request exceeded 45 seconds"
"AUTH_ERROR: no API key configured"
"PARSE_ERROR: malformed NDJSON line"
```

The frontend `normalizeAppError` scans the string for these prefixes (uppercase match) and maps to the correct `ErrorType`.

---

### Anthropic API Request Structure

```rust
// POST https://api.anthropic.com/v1/messages
// Headers:
//   x-api-key: {api_key}
//   anthropic-version: 2023-06-01
//   content-type: application/json
//
// Body:
// {
//   "model": "claude-sonnet-4-6",
//   "max_tokens": 4096,
//   "stream": true,
//   "system": "...",    // from docs/claude-prompt-spec.md
//   "messages": [{"role": "user", "content": "..."}]
// }
```

Use `claude-sonnet-4-6` — it's the current Sonnet model. This is hardcoded; do not add configuration complexity.

---

### Anthropic SSE Streaming Format

The Claude API uses Server-Sent Events (SSE). Each HTTP chunk may contain multiple SSE events. SSE format:

```
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"partial..."}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" more text"}}

event: message_stop
data: {"type":"message_stop"}
```

**Parsing strategy in `claude_service.rs`:**

```rust
// Two-layer buffer:
// 1. `sse_buffer: String` — accumulates raw bytes until `\n\n` (SSE frame boundary)
// 2. `ndjson_buffer: String` — accumulates assistant text deltas until `\n` (suggestion boundary)

// For each SSE frame:
// - Split on `\n`, find line starting with `data: `
// - Parse data as JSON: { type, delta: { type, text } }
// - If type == "content_block_delta" and delta.type == "text_delta":
//     append delta.text to ndjson_buffer
//     if ndjson_buffer contains '\n': split, parse complete lines as SuggestionEvent
// - If type == "message_stop": flush ndjson_buffer, emit optimization:complete
```

**Watch out for**: Claude sometimes wraps output in markdown fences (```json ... ```) even when told not to. The prompt spec must be explicit: "DO NOT wrap output in markdown code blocks. Output ONLY NDJSON lines." Verify during Task 1 prompt testing.

---

### NDJSON Suggestion Schema

Per architecture (Path B — deterministic deltas):

```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestionEvent {
    pub rank: u32,
    pub from_node_id: Option<String>,  // null when allocating to previously-zero node
    pub to_node_id: String,
    pub points_change: i32,            // positive = allocate, negative = deallocate
    pub explanation: String,
}
```

The Tauri event payload for `optimization:suggestion-received`:
```typescript
// Rust emits with serde camelCase → TS receives:
{
  rank: number,
  fromNodeId: string | null,
  toNodeId: string,
  pointsChange: number,
  explanation: string
}
```

---

### Delta Computation in `useOptimizationStream.ts`

On each `optimization:suggestion-received` event, the hook computes deltas before storing:

```typescript
import { calculateScore } from '../../features/optimization/scoringEngine'
import { useBuildStore } from '../stores/buildStore'
import { useGameDataStore } from '../stores/gameDataStore'

// Inside the suggestion-received handler:
const activeBuild = useBuildStore.getState().activeBuild
const gameData = useGameDataStore.getState().gameData
if (!activeBuild || !gameData) return

const baselineScore = calculateScore(activeBuild, gameData)

// Apply the suggested node change to a copy of nodeAllocations
const modifiedAllocations = { ...activeBuild.nodeAllocations }
modifiedAllocations[event.toNodeId] = (modifiedAllocations[event.toNodeId] ?? 0) + event.pointsChange
if (event.fromNodeId) {
  modifiedAllocations[event.fromNodeId] = Math.max(0, (modifiedAllocations[event.fromNodeId] ?? 0) - event.pointsChange)
}
const modifiedBuild = { ...activeBuild, nodeAllocations: modifiedAllocations }
const previewScore = calculateScore(modifiedBuild, gameData)

const suggestion: SuggestionResult = {
  rank: event.rank,
  nodeChange: { fromNodeId: event.fromNodeId, toNodeId: event.toNodeId, pointsChange: event.pointsChange },
  explanation: event.explanation,
  deltaDamage: previewScore.damage !== null && baselineScore.damage !== null
    ? previewScore.damage - baselineScore.damage : null,
  deltaSurvivability: previewScore.survivability !== null && baselineScore.survivability !== null
    ? previewScore.survivability - baselineScore.survivability : null,
  deltaSpeed: previewScore.speed !== null && baselineScore.speed !== null
    ? previewScore.speed - baselineScore.speed : null,
  baselineScore,
  previewScore,
}
addSuggestion(suggestion)
```

---

### `startOptimization()` Export

The hook exports `startOptimization()` which Story 3.3 will call when the user clicks "Optimize":

```typescript
export function useOptimizationStream() {
  // Register event listeners (useEffect with cleanup)
  // ...

  async function startOptimization() {
    const activeBuild = useBuildStore.getState().activeBuild
    const goal = useOptimizationStore.getState().goal
    if (!activeBuild) return

    clearSuggestions()         // also clears streamError
    setIsOptimizing(true)
    try {
      await invokeCommand('invoke_claude_api', {
        buildState: activeBuild,
        goal,
      })
    } catch (err) {
      // invokeCommand throws AppError — the synchronous error path
      // (async streaming errors arrive via optimization:error event)
      const appErr = err as AppError
      useOptimizationStore.getState().setStreamError(appErr)
      setIsOptimizing(false)
    }
  }

  return { startOptimization }
}
```

**Note**: `invoke_claude_api` returns `Ok(())` once streaming *starts*, not when it completes. The stream runs in a Tauri async task. Events fire as suggestions arrive. `optimization:complete` signals end. Do not await the invoke for completion — it resolves quickly.

Actually: `invoke_claude_api` should await the full stream internally before returning. This means the `invokeCommand` call will block for up to 45 seconds. Story 3.3's `OptimizeButton` uses `isOptimizing` flag to show loading state — which is set before the await. The hook should set `setIsOptimizing(false)` only on `optimization:complete` or `optimization:error` events, NOT when `invokeCommand` resolves (to handle the race-free case). See the cleanup note — if the command returns before the event, the event listener must still fire.

**Simplest correct design**: `invoke_claude_api` streams internally and also emits `optimization:complete` / `optimization:error` before returning. The frontend relies on the events for state management, not on the command return value.

---

### Rust Game Data Context Assembly

`claude_commands.rs` reads game data from disk to build the node context for the prompt. Use existing helpers from `game_data_service`:

```rust
use crate::services::game_data_service;

// In invoke_claude_api:
let class_id = build_state["classId"].as_str().ok_or("PARSE_ERROR: missing classId")?;
let mastery_id = build_state["masteryId"].as_str().ok_or("PARSE_ERROR: missing masteryId")?;
let data_dir = game_data_service::ensure_game_data_dir(&app_handle)?;
let class_data = game_data_service::load_class_data(&data_dir, class_id)?;

// Build simplified node map for prompt context:
// { nodeId: { name, tags, maxPoints } } — base tree + mastery tree
```

Only include nodes relevant to the active class/mastery. Do NOT load all 5 classes — it would exceed Claude's context window.

---

### Event Payload Tauri Emission (Tauri 2)

In Tauri 2, emit events to all windows via `app_handle`:

```rust
app_handle.emit("optimization:suggestion-received", &suggestion_payload)
    .map_err(|e| format!("APP_ERROR: emit failed: {}", e))?;
```

Import: `use tauri::Emitter;`

---

### File Locations

**New files:**
- `lebo/docs/claude-prompt-spec.md` (Task 1 — written before Task 2)
- `lebo/src-tauri/src/services/claude_service.rs`
- `lebo/src-tauri/src/commands/claude_commands.rs`
- `lebo/src/shared/stores/useOptimizationStream.ts`
- `lebo/src/shared/stores/useOptimizationStream.test.ts`

**Modified files:**
- `lebo/src-tauri/Cargo.toml` — add `futures-util = "0.3"`
- `lebo/src-tauri/src/commands/mod.rs` — add `pub mod claude_commands;`
- `lebo/src-tauri/src/services/mod.rs` — add `pub mod claude_service;`
- `lebo/src-tauri/src/lib.rs` — register `invoke_claude_api` in `invoke_handler!`
- `lebo/src/shared/stores/optimizationStore.ts` — add `streamError` field + `setStreamError` action
- `lebo/src/shared/stores/optimizationStore.test.ts` — add `streamError` tests

---

### Existing Infrastructure — DO NOT Reinvent

- **`SuggestionResult` type** — already in `src/shared/types/optimization.ts`. Do NOT redefine.
- **`OptimizationGoal` type** — already in `src/shared/types/optimization.ts`.
- **`BuildScore` type** — already in `src/shared/types/optimization.ts`.
- **`AppError` / `ErrorType`** — already in `src/shared/types/errors.ts`.
- **`invokeCommand()`** — already in `src/shared/utils/invokeCommand.ts`. ALL IPC goes through this.
- **`normalizeAppError()`** — already in `src/shared/utils/errorNormalizer.ts`.
- **`useOptimizationStore`** — already has `addSuggestion`, `clearSuggestions`, `setIsOptimizing`, `setScores`. Only ADD `streamError` + `setStreamError`.
- **`calculateScore()`** — already in `src/features/optimization/scoringEngine.ts`. Import directly.
- **`game_data_service::load_class_data()`** — already exists. Reuse for context assembly in `claude_commands.rs`.
- **`tauri_plugin_http::reqwest`** — already imported pattern from `game_data_service.rs`. Replicate exactly.

---

### Patterns From Previous Stories

- No barrel `index.ts` files — import directly from source file path
- Tailwind v4 CSS-first design tokens (not relevant for this story — no new UI components)
- All Rust module-level constants in `SCREAMING_SNAKE_CASE` (e.g., `MAX_NDJSON_LINE_BYTES`, `CLAUDE_API_URL`, `TIMEOUT_SECS`)
- Test files co-located with source
- `vi.mock('@tauri-apps/api/event')` for mocking `listen` in TypeScript tests
- Zustand store tests use `act()` for async state updates
- Run `pnpm tsc --noEmit` before marking complete — caught pre-existing errors in previous stories

---

### Performance Notes

- `calculateScore()` is synchronous O(n), <1ms — safe to call per streaming suggestion in the event handler (NFR6 compliant)
- Stream parsing is async in Rust — never blocks the main thread
- `useOptimizationStream.ts` event handlers are async-safe; Tauri events fire on the JS microtask queue

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Used direct `reqwest = { version = "0.12", features = ["json", "stream"] }` in Cargo.toml — `tauri_plugin_http::reqwest` re-export does not expose `.json()` builder or streaming features. `game_data_service.rs` continues to use the plugin re-export for plain GET requests.
- `tauri::Emitter` trait must be explicitly imported in any file calling `app_handle.emit()`.
- `claude_service.rs` uses two-layer buffering: `sse_buffer` for SSE frame boundaries (`\n\n`), `ndjson_buffer` for suggestion line boundaries (`\n`).
- `useOptimizationStream.ts` uses store `.getState()` inside event callbacks (not reactive selectors) to avoid stale closures — same pattern as `useAutoSave.ts`.
- `renderHook()` must be called outside `act()` in tests — `result.current` is null when accessed inside the `act` block in React 19.
- All 215 TypeScript tests pass. Zero `pnpm tsc --noEmit` errors. Rust `cargo build` clean.
- API key sourcing via `ANTHROPIC_API_KEY` env var with `// TODO(story-5.1)` marker for Stronghold migration.
- Code review (2026-04-24): Fixed double `optimization:error` emission — removed `emit_error` calls inside `stream_optimization`; `claude_commands.rs` is now sole emitter. Fixed listener cleanup race in `useOptimizationStream.ts` — added `isMounted` flag with per-registration early-unlisten guard (AC5 hardening).

### File List

- `lebo/docs/claude-prompt-spec.md` (new — Task 1 research output)
- `lebo/src-tauri/src/services/claude_service.rs` (new)
- `lebo/src-tauri/src/commands/claude_commands.rs` (new)
- `lebo/src-tauri/src/commands/mod.rs` (modified — added `pub mod claude_commands`)
- `lebo/src-tauri/src/services/mod.rs` (modified — added `pub mod claude_service`)
- `lebo/src-tauri/src/lib.rs` (modified — registered `invoke_claude_api`)
- `lebo/src-tauri/Cargo.toml` (modified — added `futures-util`, `reqwest`)
- `lebo/src/shared/stores/useOptimizationStream.ts` (new)
- `lebo/src/shared/stores/useOptimizationStream.test.ts` (new)
- `lebo/src/shared/stores/optimizationStore.ts` (modified — added `streamError` + `setStreamError`)
- `lebo/src/shared/stores/optimizationStore.test.ts` (modified — added `streamError` tests)

## Change Log

| Date | Change |
|------|--------|
| 2026-04-24 | Story created from epics.md. Story 3.1 done. Status → ready-for-dev. |
| 2026-04-24 | All tasks implemented. 215 tests pass, 0 tsc errors, cargo build clean. Status → review. |
| 2026-04-24 | Code review: 2 patches applied (double error emission, cleanup race). 2 items deferred. Status → done. |
