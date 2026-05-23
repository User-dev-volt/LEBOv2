---
title: '`run_optimization` Tauri Command & Claude Narrative'
story_id: '4.3'
story_key: '4-3-run-optimization-tauri-command-and-claude-narrative'
epic: 4
status: review
created: '2026-05-22'
---

## Story

**As a player,**
I want clicking "Optimize" to trigger the full pipeline and receive Claude's natural-language explanations that reference specific delta values from the deterministic engine,
**So that** every suggestion I read is verifiably correct and explained in plain language referencing my specific build numbers.

---

## Context

This is Story 4.3 — the wiring story for Epic 4. Stories 4.1 and 4.2 built all the pure Rust engine components, now ready for use:

- `scoring-core/src/scan.rs` — `run_efficiency_scan()`: Dijkstra + knapsack solver. Returns `ScanResult { node_efficiencies, build_score_baseline, knapsack_solution }`. 41 tests passing from 4.1.
- `scoring-core/src/synergy.rs` — `run_synergy_detection()`: zero-value nodes, mismatched affixes, game-changers. Returns `Vec<SynergyFlag>` sorted by priority. 51 tests passing after 4.2.
- `scoring-core/src/compute.rs` — `compute_stats()`: includes defensive floor check; warnings land in `stat_sheet.warnings`.

All three are pure functions (no locks, no async) designed specifically for `spawn_blocking`.

**What this story adds:**
1. New `run_optimization` async Tauri command in `scoring_commands.rs` — runs all three engine stages via `spawn_blocking`, assembles the ranked suggestion payload, delegates to the existing Claude streaming infrastructure
2. Registration of `run_optimization` in `lib.rs invoke_handler!`
3. `startOptimization()` in `useOptimizationStream.ts` switches from calling `invoke_claude_api` (with raw `BuildState`) to calling `run_optimization` (with a `BuildSnapshot` via `toBuildSnapshot()`)
4. `useOptimizationStream.test.ts` updated to reflect the new command and simplified argument shape

**What this story does NOT do:**
- Implement the node efficiency overlay on the passive tree (Story 4.4)
- Implement suggestion hover deltas in the stat sheet (Story 4.5)
- Change `invoke_claude_api` — it remains registered and unchanged; `run_optimization` delegates to the same underlying `claude_service::stream_optimization` / `openrouter_service::stream_optimization` functions
- Change the `optimization:*` event namespace or `SuggestionEvent` format
- Change `buildSnapshotSerializer.ts` — it is already correct and complete
- Add Rust unit tests — all engine functions are already tested; `run_optimization` is a Tauri command, not unit-testable in `scoring-core`

**Key change in TypeScript:** `startOptimization()` is significantly simplified. It no longer computes `levelContext`, `structuredGear`, or reads `fineTuneWeights` — all that data is already inside the `BuildSnapshot`. The function goes from ~60 lines to ~20 lines.

---

## Acceptance Criteria

**Given** the `lib.rs` invoke handler
**When** an agent inspects it
**Then** `run_optimization` is registered in `invoke_handler!`
**And** the handler is `async` and uses `spawn_blocking` for the CPU-intensive scan and synergy stages

**Given** a `run_optimization` call completes
**When** the Claude payload is assembled
**Then** the payload includes for each suggestion: `ΔBuildScore`, `EffectivePointCost`, synergy flags, and the specific numerical context (current crit chance, exact resistance gap, node ID and path)
**And** `build_context` includes class, mastery, active skills, level, slider position, and active conditions

**Given** Claude processes the optimization payload
**When** suggestion explanations stream back via `optimization:suggestion-received`
**Then** each explanation references the specific delta values from the engine (e.g., "190% average damage gain")
**And** the suggestion stream order matches the engine's priority order exactly
**And** Claude does not add suggestions beyond what the engine produced

**Given** the existing `useOptimizationStream` hook
**When** an agent reviews it after this story
**Then** it calls `invokeCommand('run_optimization', { snapshot })` as the active optimization path
**And** all existing suggestion streaming behavior is preserved (`optimization:suggestion-received` events still fire per suggestion)

**Given** `run_optimization` completes Stages 1–3 (compute_stats, efficiency scan, synergy detection)
**When** it triggers the Claude narrative layer
**Then** it invokes the existing streaming function (`claude_service::stream_optimization` or `openrouter_service::stream_optimization`) with the assembled optimization payload
**And** the `optimization:suggestion-received` event pipeline is unchanged — no new IPC event namespace introduced
**And** `run_optimization` does not replace `invoke_claude_api` but delegates to the same streaming infrastructure internally

---

## Tasks / Subtasks

- [x] Task 1: Add `run_optimization` to `scoring_commands.rs`
  - [x] Add async `run_optimization` Tauri command: clone game_data (Pattern 3), `spawn_blocking` for compute_stats + run_efficiency_scan + run_synergy_detection, assemble payload, provider routing, delegate to streaming
  - [x] Implement `assemble_run_optimization_payload()` helper: priority-merge warnings + synergy + scan into a JSON string; assign ranks
  - [x] Replicate provider routing pattern from `invoke_claude_api` (get provider, get key, call streaming fn, emit error event on failure)
  - [x] `cargo build` (full Tauri crate) passes, zero new warnings

- [x] Task 2: Register in `lib.rs`
  - [x] Add `run_optimization` to `use commands::scoring_commands::` import
  - [x] Add `run_optimization,` to `invoke_handler!`
  - [x] `cargo build` passes

- [x] Task 3: Refactor `startOptimization()` in `useOptimizationStream.ts`
  - [x] Add import: `import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'`
  - [x] Add `gameData` null guard: if `useGameDataStore.getState().gameData` is null, return early
  - [x] Replace the `invoke_claude_api` call block with: `const snapshot = toBuildSnapshot(activeBuild, gameData)` then `invokeCommand('run_optimization', { snapshot })`
  - [x] Remove now-dead code: `levelContext` block, `structuredGear` block, `fineTuneWeights` read from store
  - [x] Remove now-unused imports if nothing else in the file uses them: `calculatePassivePoints`, `LevelContext`, `StructuredGearAffix`, `StructuredGearSlot`
  - [x] `pnpm build` passes with zero TypeScript errors

- [x] Task 4: Update `useOptimizationStream.test.ts`
  - [x] Add `vi.mock('../utils/buildSnapshotSerializer', ...)` with `toBuildSnapshot` returning a fixed snapshot shape
  - [x] Update `mockInvokeCommand` assertions from `'invoke_claude_api'` to `'run_optimization'` with snapshot arg shape
  - [x] Remove tests that verified `levelContext`, `structuredGear`, `sliderPosition`, `fineTuneWeights` as top-level `invoke_claude_api` args
  - [x] Add: `startOptimization calls run_optimization with a snapshot`, `startOptimization early-returns if gameData is null`
  - [x] `pnpm vitest src/shared/stores/useOptimizationStream.test.ts` — all tests pass

---

## Technical Requirements

### 1. `run_optimization` command in `scoring_commands.rs`

Add after the existing `compute_stats` function. The file already imports `scoring_core::{BuildSnapshot, ComputeOptions, StatSheet}` and `crate::ScoringState` — add the service imports needed for provider routing.

**Command signature (Tauri deserializes the `snapshot` field from TypeScript's `{ snapshot }` arg):**

```rust
#[tauri::command]
pub async fn run_optimization(
    app_handle: tauri::AppHandle,
    snapshot: scoring_core::BuildSnapshot,
    state: tauri::State<'_, ScoringState>,
) -> Result<(), String> {
    // Pattern 3: clone game_data BEFORE spawn_blocking; never hold a read lock across await.
    let game_data = state.game_data.read()
        .map_err(|e| format!("SCORING_ERROR: game_data lock poisoned: {}", e))?
        .clone();

    // Clone snapshot for payload assembly after spawn_blocking consumes the moved copies.
    let snapshot_for_engine = snapshot.clone();

    // All three pure engine stages run in one spawn_blocking call (ADR-003).
    let (stat_sheet, scan_result, synergy_flags) =
        tauri::async_runtime::spawn_blocking(move || {
            let sheet = scoring_core::compute_stats(
                &snapshot_for_engine,
                &game_data,
                scoring_core::ComputeOptions::default(),
            );
            let scan = scoring_core::run_efficiency_scan(&snapshot_for_engine, &game_data);
            let synergy = scoring_core::run_synergy_detection(&snapshot_for_engine, &game_data);
            (sheet, scan, synergy)
        })
        .await
        .map_err(|e| format!("SCORING_ERROR: optimization compute panicked: {}", e))?;

    // `snapshot` (original, not moved) is still available here.
    let user_message = assemble_run_optimization_payload(
        &snapshot, &stat_sheet, &scan_result, &synergy_flags,
    );

    // ── Provider routing — identical pattern to invoke_claude_api ─────────────
    let provider = match crate::services::keychain_service::get_llm_provider(&app_handle).await {
        Ok(p) => p,
        Err(e) => {
            let err = format!("STORAGE_ERROR: failed to read provider setting: {e}");
            let _ = app_handle.emit(
                "optimization:error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "STORAGE_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            return Err(err);
        }
    };

    let stream_result = if provider == "openrouter" {
        let or_key = match crate::services::keychain_service::get_openrouter_api_key(&app_handle).await {
            Ok(k) => k,
            Err(e) => {
                let err = format!("AUTH_ERROR: No OpenRouter API key configured. Add your key in Settings. ({})", e);
                let _ = app_handle.emit(
                    "optimization:error",
                    &crate::services::claude_service::OptimizationErrorPayload {
                        error_type: "AUTH_ERROR".to_string(),
                        message: "No OpenRouter API key configured. Add your key in Settings.".to_string(),
                    },
                );
                return Err(err);
            }
        };
        crate::services::openrouter_service::stream_optimization(&app_handle, &or_key, user_message).await
    } else {
        let api_key = crate::services::keychain_service::get_api_key(&app_handle).await?;
        #[cfg(debug_assertions)]
        let api_key = std::env::var("ANTHROPIC_API_KEY").unwrap_or(api_key);
        crate::services::claude_service::stream_optimization(&app_handle, &api_key, user_message).await
    };

    if let Err(err) = stream_result {
        let _ = app_handle.emit(
            "optimization:error",
            &crate::services::claude_service::OptimizationErrorPayload {
                error_type: extract_optimization_error_type(&err),
                message: err.clone(),
            },
        );
        return Err(err);
    }

    Ok(())
}

fn extract_optimization_error_type(err: &str) -> String {
    for prefix in &["AUTH_ERROR", "API_ERROR", "NETWORK_ERROR", "TIMEOUT", "PARSE_ERROR", "SCORING_ERROR"] {
        if err.starts_with(prefix) {
            return prefix.to_string();
        }
    }
    "UNKNOWN".to_string()
}
```

**`assemble_run_optimization_payload` — priority merge and JSON serialization:**

Priority order for the ranked suggestion list sent to Claude:
1. `stat_sheet.warnings` → each warning = rank N, type `"critical_warning"`
2. `synergy_flags` where `flag_type == "game_changer"` → sorted by `delta_build_score` descending
3. `synergy_flags` where `priority == "high"` and `flag_type != "game_changer"` → mismatched affixes
4. `scan_result.knapsack_solution` paths → each path in order; context includes `delta_build_score` + `effective_point_cost`
5. `synergy_flags` where `priority == "medium"` → zero-value reallocations

Each entry includes all numerical context Claude needs to write a concrete explanation. The `to_node_id` sentinel format for non-passive suggestions:
- Warning: `"warning:{warning_type}"` (e.g. `"warning:fire_resistance_uncapped"`)
- Game-changer: `"unique:{item_id}"` (e.g. `"unique:exsanguinous"`)
- Mismatched affix: `"synergy:affix:{slot_id}"` (e.g. `"synergy:affix:chest"`)
- Zero-value node: use the actual `node_id` from `SynergyFlag.node_id`

These sentinel `to_node_id` values do not match any real passive node — the TypeScript suggestion handler will compute a zero preview delta for them (acceptable; Story 4.5 stat-sheet hover deltas only apply to real passive node suggestions anyway).

```rust
fn assemble_run_optimization_payload(
    snapshot: &scoring_core::BuildSnapshot,
    stat_sheet: &scoring_core::StatSheet,
    scan_result: &scoring_core::ScanResult,
    synergy_flags: &[scoring_core::SynergyFlag],
) -> String {
    let mut suggestions: Vec<serde_json::Value> = Vec::new();
    let mut rank: u32 = 1;

    // 1. Critical defensive warnings (highest priority)
    for warning in &stat_sheet.warnings {
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "critical_warning",
            "toNodeId": format!("warning:{}", warning.warning_type),
            "fromNodeId": null,
            "pointCost": 0,
            "deltaBuildScore": null,
            "context": format!(
                "Defensive floor failure: {} (current: {:.0}, gap: {:.0}). Fix this before optimizing offensively.",
                warning.warning_type, warning.current_value, warning.gap
            )
        }));
        rank += 1;
    }

    // 2. Game-changer synergy flags
    let mut game_changers: Vec<&scoring_core::SynergyFlag> = synergy_flags
        .iter()
        .filter(|f| f.flag_type == "game_changer")
        .collect();
    game_changers.sort_by(|a, b| {
        b.delta_build_score.partial_cmp(&a.delta_build_score).unwrap_or(std::cmp::Ordering::Equal)
    });
    for flag in game_changers {
        let to_node_id = flag.node_id
            .as_deref()
            .map(|n| format!("unique:{}", n))
            .unwrap_or_else(|| "unique:unknown".to_string());
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "game_changer",
            "toNodeId": to_node_id,
            "fromNodeId": null,
            "pointCost": 0,
            "deltaBuildScore": flag.delta_build_score,
            "context": flag.description
        }));
        rank += 1;
    }

    // 3. High-priority synergy (mismatched affixes)
    for flag in synergy_flags.iter().filter(|f| f.priority == "high" && f.flag_type != "game_changer") {
        let to_node_id = flag.slot
            .as_deref()
            .map(|s| format!("synergy:affix:{}", s))
            .unwrap_or_else(|| "synergy:affix:unknown".to_string());
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "mismatched_affix",
            "toNodeId": to_node_id,
            "fromNodeId": null,
            "pointCost": 0,
            "deltaBuildScore": null,
            "context": flag.description
        }));
        rank += 1;
    }

    // 4. Knapsack solution paths (optimal passive allocations)
    for path in &scan_result.knapsack_solution {
        if path.is_empty() { continue; }
        let target_node = path.last().unwrap();
        // Find this node's efficiency entry for delta context
        let efficiency_entry = scan_result.node_efficiencies
            .iter()
            .find(|e| &e.node_id == target_node);
        let (delta_score, point_cost) = efficiency_entry
            .map(|e| (e.delta_build_score, e.effective_point_cost))
            .unwrap_or((0.0, path.len() as f64));
        let from_node = if path.len() > 1 { Some(path[0].as_str()) } else { None };
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "efficiency",
            "toNodeId": target_node,
            "fromNodeId": from_node,
            "pointCost": point_cost as u32,
            "deltaBuildScore": delta_score,
            "context": format!(
                "Allocating this path adds {:.2} BuildScore for {} passive point(s). Path: {}.",
                delta_score,
                point_cost as u32,
                path.join(" → ")
            )
        }));
        rank += 1;
    }

    // 5. Medium-priority synergy (zero-value reallocations)
    for flag in synergy_flags.iter().filter(|f| f.priority == "medium") {
        let to_node_id = flag.node_id
            .as_deref()
            .unwrap_or("synergy:unknown")
            .to_string();
        suggestions.push(serde_json::json!({
            "rank": rank,
            "type": "zero_value_allocation",
            "toNodeId": to_node_id,
            "fromNodeId": null,
            "pointCost": 0,
            "deltaBuildScore": null,
            "context": flag.description
        }));
        rank += 1;
    }

    let payload = serde_json::json!({
        "buildContext": {
            "classId": snapshot.class_id,
            "masteryId": snapshot.mastery_id,
            "characterLevel": snapshot.character_level,
            "sliderPosition": snapshot.slider_position,
            "activeConditions": snapshot.active_conditions,
            "buildScoreBaseline": scan_result.build_score_baseline
        },
        "instructions": "You are a Last Epoch build optimizer. For each suggestion below, output exactly one NDJSON line matching the schema: {\"rank\":N,\"from_node_id\":null|\"nodeId\",\"to_node_id\":\"nodeId\",\"points_change\":N,\"explanation\":\"...\"}. Output one line per suggestion in rank order. Reference the specific delta values and context in your explanation. Do not add suggestions beyond the list.",
        "suggestions": suggestions
    });

    serde_json::to_string(&payload).unwrap_or_default()
}
```

### 2. Registration in `lib.rs`

Change the import line from:
```rust
use commands::scoring_commands::compute_stats;
```
To:
```rust
use commands::scoring_commands::{compute_stats, run_optimization};
```

Add to `invoke_handler!`:
```rust
compute_stats,
run_optimization,   // NEW
```

### 3. `startOptimization()` refactor (`useOptimizationStream.ts`)

**Add imports at top:**
```typescript
import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'
```

**Remove imports (if no longer used anywhere in the file):**
```typescript
// REMOVE if unused:
import { calculatePassivePoints } from '../utils/budgetCalculator'
import type { LevelContext, StructuredGearAffix, StructuredGearSlot } from '../types/optimization'
```

**Replace the entire `startOptimization` function body with:**

```typescript
export async function startOptimization() {
  const activeBuild = useBuildStore.getState().activeBuild
  if (!activeBuild) return

  const gameData = useGameDataStore.getState().gameData
  if (!gameData) return  // game data not yet loaded — Optimize button should be disabled in this state

  const snapshot = toBuildSnapshot(activeBuild, gameData)

  useOptimizationStore.getState().clearSuggestions()
  useOptimizationStore.getState().setIsOptimizing(true)
  useOptimizationStore.getState().setOptimizationBuildId(activeBuild.id)

  try {
    await invokeCommand('run_optimization', { snapshot })
  } catch (err) {
    const appError = normalizeAppError(err)
    useOptimizationStore.getState().setStreamError(appError)
    useOptimizationStore.getState().setIsOptimizing(false)
  }
}
```

**No changes** to the `useOptimizationStream()` hook function or any event listeners — they're correct as-is.

### 4. Test updates (`useOptimizationStream.test.ts`)

**Add new mock before the import block:**
```typescript
vi.mock('../utils/buildSnapshotSerializer', () => ({
  toBuildSnapshot: vi.fn((_build: unknown, _gameData: unknown) => ({
    nodeAllocations: { 'node_a': 2 },
    skillNodeAllocations: {},
    characterLevel: 1,
    classId: 'sentinel',
    masteryId: 'void_knight',
    sliderPosition: 50,
    activeConditions: [],
    gearSlots: {},
    idolPlacements: [],
    blessings: [],
  })),
}))
```

**Update the `gameDataStore` mock** to ensure `gameData` is non-null (it already is in the existing mock — verify it returns `{ gameData: {...} }` with a truthy `gameData`).

**Remove these tests** (their args no longer exist as top-level command params):
- `startOptimization passes sliderPosition and fineTuneWeights to invokeCommand`
- `startOptimization passes levelContext when budgetEnforced is true`
- `startOptimization passes levelContext: null when budgetEnforced is false`
- `startOptimization passes structuredGear with resolved values for database-sourced gear`
- `startOptimization passes structuredGear with empty affixes for free-text gear`
- `startOptimization passes structuredGear: null when all gear slots are empty`

**Update these tests** (change `invoke_claude_api` → `run_optimization` in assertions):
```typescript
// OLD:
expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
  sliderPosition: 50,
  fineTuneWeights: null,
}))

// NEW:
expect(mockInvokeCommand).toHaveBeenCalledWith('run_optimization', expect.objectContaining({
  snapshot: expect.any(Object),
}))
```

**Add these new tests:**

```typescript
it('startOptimization calls run_optimization with a snapshot', async () => {
  await act(async () => { await startOptimization() })

  expect(mockInvokeCommand).toHaveBeenCalledWith('run_optimization', {
    snapshot: expect.objectContaining({ nodeAllocations: { 'node_a': 2 } }),
  })
})

it('startOptimization early-returns if gameData is null', async () => {
  vi.mocked(useGameDataStore.getState).mockReturnValueOnce({
    gameData: null,
    itemDatabase: null,
  } as unknown as ReturnType<typeof useGameDataStore.getState>)

  await act(async () => { await startOptimization() })

  expect(mockInvokeCommand).not.toHaveBeenCalled()
})
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/src/commands/scoring_commands.rs` | MODIFY | Add `run_optimization` async command + `assemble_run_optimization_payload()` + `extract_optimization_error_type()` helpers |
| `lebo/src-tauri/src/lib.rs` | MODIFY | Add `run_optimization` to import and `invoke_handler!` |
| `lebo/src/shared/stores/useOptimizationStream.ts` | MODIFY | Refactor `startOptimization()` to call `run_optimization` with snapshot; remove dead code |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | MODIFY | Add `buildSnapshotSerializer` mock; remove stale tests; add new tests; update command-name assertions |

**Do not touch:**
- `scoring-core/src/scan.rs`, `synergy.rs`, `compute.rs`, `lib.rs` — no changes needed; all engine work is done
- `src/shared/utils/buildSnapshotSerializer.ts` — already correct
- `src-tauri/src/commands/claude_commands.rs` — `invoke_claude_api` stays unchanged
- Any TypeScript UI components — no view changes in this story

---

## Architecture & Pattern Compliance

**Pattern 1 (single serialization point):** TypeScript calls `toBuildSnapshot(activeBuild, gameData)` — the only valid conversion from `BuildState` to `BuildSnapshot`. `activeBuild` (raw `BuildState`) is never passed to Rust directly. This is enforced — `run_optimization` receives a `BuildSnapshot`, not a `Value`.

**Pattern 2 (camelCase/snake_case):** `BuildSnapshot` input struct already has `#[serde(rename_all = "camelCase")]` (established in Story 2.4). TypeScript sends `{ snapshot }` — the snapshot object fields are camelCase. Rust output (`SuggestionEvent`) uses default snake_case; TypeScript side reads `from_node_id`, `to_node_id`, `points_change` as-is (already working in the existing event handler).

**Pattern 3 (async locking):** `game_data.read().unwrap().clone()` is called BEFORE `spawn_blocking`. The read lock guard is dropped before the await. The cloned `GameData` and a cloned `BuildSnapshot` move into the blocking closure. The original `snapshot` is retained for payload assembly after the blocking call.

**Pattern 5 (error prefixes):** All `Err(...)` returns use `"SCORING_ERROR: "` prefix. Provider/auth errors use `"AUTH_ERROR: "` and `"STORAGE_ERROR: "` (matching existing patterns). `extract_optimization_error_type()` strips the prefix for the event payload.

**ADR-001 (workspace structure):** No engine logic in the Tauri crate. `assemble_run_optimization_payload()` is data serialization (Tauri concern), not scoring logic (scoring-core concern). This split is correct.

**ADR-003 (parallelism boundary):** All three engine stages run in a single `spawn_blocking` call. The stages run sequentially within the closure (`compute_stats` → `run_efficiency_scan` → `run_synergy_detection`) — parallelism within the closure is not needed since each stage is already fast (<20ms for the scan). `rayon` parallelism within `run_efficiency_scan` is preserved (that's internal to `scan.rs`).

**Event namespace preserved:** `run_optimization` delegates to `claude_service::stream_optimization` / `openrouter_service::stream_optimization` — the same functions as `invoke_claude_api`. These emit `optimization:suggestion-received`, `optimization:complete`, `optimization:error`, `optimization:model-active` events unchanged. The TypeScript hook listens to these events and requires no changes.

**`invoke_claude_api` coexistence:** The existing `invoke_claude_api` command remains registered and working. `startOptimization()` no longer calls it, but it could be used by other callers. No deprecation annotation needed at this stage.

---

## Testing Requirements

### TypeScript tests

Run: `pnpm vitest src/shared/stores/useOptimizationStream.test.ts`

**Tests to add (2 new):**
1. `startOptimization calls run_optimization with a snapshot` — verify `invokeCommand` called with `('run_optimization', { snapshot: expect.objectContaining({...}) })`
2. `startOptimization early-returns if gameData is null` — mock `gameData: null`, verify `invokeCommand` NOT called

**Tests to update (assertion only — change command name):**
- `startOptimization clears suggestions and sets isOptimizing(true)` — update to `'run_optimization'`
- `startOptimization stores AUTH_ERROR when invokeCommand throws` — update to `'run_optimization'` (or remove the command name check since error handling is command-agnostic)
- `startOptimization clears skippedSuggestions` — update if it asserts on command name
- `startOptimization clears previewSuggestionRank` — update if it asserts on command name

**Tests to remove (6 tests whose args are now inside the snapshot):**
- `passes sliderPosition and fineTuneWeights to invokeCommand`
- `passes levelContext when budgetEnforced is true`
- `passes levelContext: null when budgetEnforced is false`
- `passes structuredGear with resolved values for database-sourced gear`
- `passes structuredGear with empty affixes for free-text gear`
- `passes structuredGear: null when all gear slots are empty`

**Tests unchanged (event listener tests — leave these alone):**
- `registers four event listeners on mount`
- `calls unlisten for all listeners on unmount`
- `sets isOptimizing(false) on unmount`
- `optimization:complete event sets isOptimizing(false)`
- `optimization:complete event sets hasOptimizationCompleted(true)`
- `optimization:error event sets streamError and clears isOptimizing`
- `optimization:suggestion-received adds suggestion to store`

### Rust tests

No new Rust unit tests. The engine functions were tested in Stories 4.1 and 4.2 (51/51 passing). `run_optimization` is a Tauri command and not unit-testable in `scoring-core`. Correctness is verified via `cargo build` and integration.

### Verification commands

From `lebo/src-tauri/`:
```bash
cargo build    # Full Tauri crate compiles cleanly, no new warnings
```

From `lebo/`:
```bash
pnpm build                                                       # TypeScript compiles, zero errors
pnpm vitest src/shared/stores/useOptimizationStream.test.ts     # Updated tests all pass
pnpm vitest                                                       # Full test suite still passes (no regressions)
```

---

## Dev Notes

**`assemble_run_optimization_payload` — field name casing:** The JSON payload is a freeform string sent as the Claude `user_message`. Use camelCase or whatever is readable — it is not parsed by Tauri IPC, only read by Claude. The NDJSON lines that Claude emits back ARE parsed by `claude_service.rs` into `SuggestionEvent` (snake_case). The `instructions` field in the payload tells Claude the exact schema to follow.

**`to_node_id` sentinels in TypeScript:** The `optimization:suggestion-received` handler in `useOptimizationStream.ts` already handles suggestions with arbitrary `to_node_id` values. It looks up `modifiedAllocations[toNode]` (returns `undefined` → 0 for unknown node IDs) and calls `calculateScore` on the modified build. For sentinel IDs like `"warning:fire_resistance_uncapped"`, this produces a zero preview delta — the `previewScore` equals the `baselineScore`. This is correct behavior; warning suggestions don't correspond to passive node changes.

**`StatWarning` fields:** Check `scoring-core/src/stat_sheet.rs` for the exact field names on `StatWarning`. The `assemble_run_optimization_payload` function references `warning.warning_type`, `warning.current_value`, `warning.gap` — verify these match the actual struct field names and adjust if needed.

**`NodeEfficiency` fields in `ScanResult`:** `run_efficiency_scan` returns `ScanResult { node_efficiencies: Vec<NodeEfficiency>, build_score_baseline: f64, knapsack_solution: Vec<Vec<String>> }`. `NodeEfficiency` has `node_id: String`, `delta_build_score: f64`, `effective_point_cost: f64`. The payload assembly references these — verify against `scoring-core/src/stat_sheet.rs`.

**`SynergyFlag` fields:** From Story 4.2: `flag_type: String`, `priority: String`, `description: String`, `node_id: Option<String>`, `slot: Option<String>`, `delta_build_score: Option<f64>`. These exact names are used in the payload assembly — they already match `stat_sheet.rs`.

**Provider routing duplication:** `run_optimization` replicates ~25 lines of provider routing from `invoke_claude_api`. This is intentional — no shared module exists, and the no-barrel-files rule prevents creating one just for this. The code is simple enough that duplication is acceptable. If a third command needs this pattern, refactor then.

**`extract_optimization_error_type`:** This is a local private function in `scoring_commands.rs` that mirrors the private `extract_error_type` in `claude_commands.rs`. Duplication is acceptable — both are 5-line helpers. Adding `"SCORING_ERROR"` to the prefix list is the only difference.

**TypeScript strict mode — unused imports:** TypeScript strict mode with `noUnusedLocals: true` will reject any import that's left but no longer used. After removing the `levelContext` and `structuredGear` computation blocks, verify that `calculatePassivePoints`, `LevelContext`, `StructuredGearAffix`, `StructuredGearSlot` are not referenced anywhere else in `useOptimizationStream.ts`. If they are still used, keep the imports.

**`sliderPosition` in snapshot:** `toBuildSnapshot()` already maps `build.sliderPosition` (clamped to 0–100) into the snapshot. The Rust `run_optimization` command reads it from `snapshot.slider_position`. The `optimizationStore.sliderPosition` value that was previously passed as a separate arg is now in the snapshot via `BuildState.sliderPosition`. These should be the same value — `buildStore` updates `sliderPosition` when the user moves the slider, and `optimizationStore.sliderPosition` mirrors it. Verify that `BuildState.sliderPosition` is always kept in sync with `optimizationStore.sliderPosition`.

**`fineTuneWeights` removal:** The existing `invoke_claude_api` used `fineTuneWeights` only to build the `optimizationIntent` prompt string (e.g., "70% damage, 20% survivability, 10% speed"). The new `run_optimization` uses `snapshot.slider_position` for the `buildContext.sliderPosition` field. Fine-tune weights were a UI-level override that isn't modeled in the deterministic engine (the engine uses archetype weights from the slider). Dropping them from the command arg is correct — the slider position is the canonical source.

---

## Previous Story Intelligence (from 4.2)

- **Pure Rust stories 4.1/4.2 confirmed the pattern:** Story 4.3 is the wiring story — the engine is already done. This story is primarily plumbing.
- **51/51 `cargo test -p scoring-core` passing** after Story 4.2. Adding `run_optimization` to the Tauri crate does not add new scoring-core tests.
- **`game_changer` priority string:** The `SynergyFlag.priority` for game-changer flags is the string `"game_changer"` (NOT `"high"`). This was corrected in 4.2 review. The payload assembly must filter `flag_type == "game_changer"` to separate game-changers from high-priority mismatched-affix flags.
- **Review finding from 4.2 deferred to 4.3:** `"critical" priority rank undefined in synergy sort — Story 4.3 owns the merged sort; any 'critical' flags from floor-check would land at position 0 alongside 'game_changer' (correct by coincidence)`. In the `assemble_run_optimization_payload` implementation, stat_sheet warnings (Critical priority) are merged FIRST — before game_changers. This resolves the deferred finding correctly.
- **`affix_scope` is empty HashMap at runtime:** `detect_mismatched_affixes` produces no flags in production (intentional, documented in 4.2). The `run_optimization` payload will have no mismatched-affix suggestions until a future story populates the affix DB. This is correct behavior — not a bug.
- **`cargo build` (full Tauri crate):** Story 4.2 confirmed this passes cleanly. After adding `run_optimization`, it must still pass. New unused imports will cause compiler errors under Rust's dead_code lints — import only what is used.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Fixed `NodeEfficiency.path_delta_score` field name (story spec incorrectly named it `delta_build_score`)
- Added `use tauri::Emitter;` to `scoring_commands.rs` — required for `app_handle.emit()` in Tauri 2
- Fixed `SynergyFlag.delta_build_score` sort: used `.unwrap_or(0.0)` since field is `Option<f64>`
- `effective_point_cost` is `u32` (not `f64`) — used directly in JSON without cast

### Completion Notes List
- All 4 tasks complete. `cargo build` passes clean. `pnpm build` passes. 13/13 tests pass.
- `startOptimization()` reduced from ~60 lines to ~20 lines as designed.
- Pre-existing `ProviderSelector.test.tsx` failures confirmed unrelated to this story (present before any changes).
- `invoke_claude_api` command remains registered and unchanged — `run_optimization` delegates to the same streaming infrastructure.

### File List
- `lebo/src-tauri/src/commands/scoring_commands.rs` — Added `run_optimization` async command, `assemble_run_optimization_payload()`, `extract_optimization_error_type()`; added `use tauri::Emitter`
- `lebo/src-tauri/src/lib.rs` — Added `run_optimization` to import and `invoke_handler!`
- `lebo/src/shared/stores/useOptimizationStream.ts` — Refactored `startOptimization()` to call `run_optimization` with snapshot; removed dead code and unused imports
- `lebo/src/shared/stores/useOptimizationStream.test.ts` — Added `buildSnapshotSerializer` mock; removed 6 stale tests; added 2 new tests; updated command-name assertions

### Review Findings

- [ ] [Review][Decision] Knapsack path re-sorted cheapest-first: `path.last()` may not be target node — `solve_knapsack` re-sorts each selected path by `node_max_points` cheapest-first (scan.rs:327). After that sort, `path.last()` is the most expensive node by max_points, not necessarily the high-efficiency target the knapsack selected. If the target node has low `node_max_points` (e.g. 1-point nodes), it ends up first after sorting, and `path.last()` is a bridge node. The `efficiency_entry` lookup then finds the wrong node's `path_delta_score` / `effective_point_cost`, sending incorrect delta values to the LLM. [scoring_commands.rs, assemble_run_optimization_payload section 4]
- [ ] [Review][Decision] Game-changer `toNodeId` always `"unique:unknown"` — `detect_game_changers` in synergy.rs sets `node_id: None` on every `SynergyFlag` it produces. The assembler therefore always emits `"unique:unknown"` as `toNodeId` for all game-changer suggestions. The TypeScript event handler will then apply any `points_change` to a nonexistent `"unique:unknown"` node in the preview score calculation. The spec requires `"unique:{item_id}"` but `SynergyFlag` has no `item_id` field — need to decide: add `item_id: Option<String>` to `SynergyFlag`, or change the sentinel to something already available (e.g. the `description` field). [scoring_commands.rs, assemble_run_optimization_payload section 2]
- [ ] [Review][Decision] AC4 — `active_skills` absent from `buildContext` — AC4 states "build_context includes class, mastery, active skills, level, slider position, and active conditions." The assembled `buildContext` includes `classId`, `masteryId`, `characterLevel`, `sliderPosition`, `activeConditions`, and `buildScoreBaseline`, but no `activeSkills` field. `BuildSnapshot` does carry `skill_node_allocations`. Contradiction: the spec's own code example (Technical Requirements §1) also omits active_skills — but the AC text explicitly lists it. Clarify: is the omission intentional (code wins) or does the field need to be added? [scoring_commands.rs, assemble_run_optimization_payload buildContext section]
- [ ] [Review][Patch] `assemble_run_optimization_payload` returns `""` on serialization failure — `serde_json::to_string(&payload).unwrap_or_default()` silently returns an empty string if serialization fails (e.g. NaN or Infinity in `path_delta_score` / `delta_build_score`). The empty string is then sent to the LLM with no error surfaced to the user or the frontend. Fix: change function to return `Result<String, String>`, propagate the error up through `run_optimization` with a `"SCORING_ERROR: "` prefix, and emit `optimization:error`. [scoring_commands.rs, assemble_run_optimization_payload]
- [ ] [Review][Patch] Claude branch `get_api_key` failure doesn't emit `optimization:error` event — when `get_api_key(&app_handle).await?` fails in the Claude branch, the error is propagated via `?` without emitting an `optimization:error` event. The OpenRouter branch explicitly emits the event before returning `Err`. This asymmetry means the frontend's `optimization:error` listener never fires for Anthropic key errors — the error only surfaces via `invokeCommand`'s rejection through the TypeScript `catch` block, producing different UX than the OpenRouter path. Fix: match the OpenRouter pattern — emit event, then `return Err(...)`. [scoring_commands.rs, run_optimization, Claude branch]
- [x] [Review][Defer] `startOptimization` no in-flight guard for concurrent invocations [useOptimizationStream.ts, startOptimization] — deferred, pre-existing: UI's "Optimize" button is disabled while `isOptimizing` is true (same gate existed before this story); concurrent double-submit requires a broken UI state.
- [x] [Review][Defer] NaN `delta_build_score` causes non-deterministic game-changer sort [scoring_commands.rs, assemble_run_optimization_payload section 2] — deferred, pre-existing: NaN in scoring engine output is a scoring-core bug, not introduced here; `partial_cmp` + `unwrap_or(Equal)` is the standard Rust float sort pattern.
- [x] [Review][Defer] OpenRouter errors use `claude_service::OptimizationErrorPayload` type (cross-module coupling) [scoring_commands.rs] — deferred, pre-existing: identical pattern used in `invoke_claude_api`; fix at the same time as that command if refactored.
- [x] [Review][Defer] Gear suffix affixes never serialized — `detect_mismatched_affixes` misses suffix-side mismatches [buildSnapshotSerializer.ts] — deferred, pre-existing: acknowledged in existing code comment; no suffix discriminator field on `GearItemV2`; address in Epic 5 affix scoring work.
- [x] [Review][Defer] Level-0/1 builds: `baseline_score == 0` triggers `detect_game_changers` early-return — no game-changer suggestions produced [synergy.rs] — deferred, pre-existing engine edge case; not introduced by this story.

### Change Log
- 2026-05-22: Story 4.3 created — `run_optimization` wiring spec.
- 2026-05-22: Implemented — all 4 tasks complete, ready for review.
