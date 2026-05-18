# Story 7.3: Optimization Weight Computation in Rust and Prompt Construction

Status: done

## Story

As a developer,
I want the Rust optimization command to compute effective weights from `sliderPosition` or `fineTuneWeights` and include them in the AI optimization prompt as named context,
So that the AI receives precise intent signals and can reason about them explicitly in its suggestions.

## Acceptance Criteria

**AC1 — Slider-only weight derivation:**
Given the optimization payload includes `sliderPosition: 70` and `fineTuneWeights: null`,
when the Rust optimization command computes weights,
then effective percentages are: `damage = 70`, `survivability = 30` (= 100 - 70), `speed = 0`; these are included in the prompt as: `"Optimization intent: 70% damage, 30% survivability, 0% speed"`.

**AC2 — Fine Tune override takes precedence:**
Given the payload includes `fineTuneWeights: { damage: 40, survivability: 40, speed: 20 }`,
when the Rust command computes weights,
then the fine-tune values are used directly as percentages; the prompt includes `"Optimization intent: 40% damage, 40% survivability, 20% speed"` — `sliderPosition` is ignored when `fineTuneWeights` is `Some`.

**AC3 — No goalPreset references:**
Given Phase 1 `goalPreset` was migrated in Epic 6,
when optimization runs,
then no code references `goalPreset`; all weight derivation uses `sliderPosition`/`fineTuneWeights` exclusively.

**AC4 — Rust command receives slider/fine-tune params:**
`invoke_claude_api` in Rust receives `slider_position: f32` and `fine_tune_weights: Option<FineTuneWeights>` as Tauri command parameters; `goal: String` is removed from the command signature.

**AC5 — TypeScript call site updated:**
`startOptimization()` in `useOptimizationStream.ts` reads `sliderPosition` and `fineTuneWeights` from `useOptimizationStore` and passes them to `invoke_claude_api`; the `goal` argument is no longer sent.

**AC6 — Latency unchanged:**
The AI stream begins within the same latency as before (NFR4); the weight computation is pure in-memory arithmetic with no I/O.

**AC7 — Tests updated:**
The two `useOptimizationStream.test.ts` tests that assert `goal:` in the `invokeCommand` call are updated to assert `sliderPosition` and `fineTuneWeights` are passed instead.

## Tasks / Subtasks

- [x] Task 1: Add `FineTuneWeights` Rust struct and update command signature (AC3, AC4)
  - [x] 1.1: In `lebo/src-tauri/src/commands/claude_commands.rs`, add above `invoke_claude_api`:
    ```rust
    #[derive(serde::Deserialize)]
    struct FineTuneWeights {
        damage: f32,
        survivability: f32,
        speed: f32,
    }
    ```
  - [x] 1.2: Change `invoke_claude_api` signature — remove `goal: String`, add `slider_position: f32` and `fine_tune_weights: Option<FineTuneWeights>` as additional Tauri command parameters (alongside existing `build_state: Value`)

- [x] Task 2: Compute optimization intent string in Rust (AC1, AC2, AC6)
  - [x] 2.1: Add a private helper `fn compute_optimization_intent(slider_position: f32, fine_tune_weights: Option<FineTuneWeights>) -> String`:
    - If `fine_tune_weights` is `Some(w)`: use `w.damage`, `w.survivability`, `w.speed` directly as integer percentages
    - If `fine_tune_weights` is `None`: derive `damage = slider_position`, `survivability = 100.0 - slider_position`, `speed = 0.0`
    - Round each to nearest integer: `damage.round() as i32` etc.
    - Return `format!("Optimization intent: {}% damage, {}% survivability, {}% speed", damage_pct, surv_pct, speed_pct)`
  - [x] 2.2: Call `compute_optimization_intent` in `invoke_claude_api` after the `// ── Assemble user message` comment
  - [x] 2.3: Replace `"goal": goal` in the `json!({...})` user_message with `"optimizationIntent": optimization_intent`

- [x] Task 3: Update TypeScript call site (AC5)
  - [x] 3.1: In `lebo/src/shared/stores/useOptimizationStream.ts`, update `startOptimization()`:
    - Read `sliderPosition` and `fineTuneWeights` from `useOptimizationStore.getState()`
    - Replace `{ buildState: activeBuild, goal }` with `{ buildState: activeBuild, sliderPosition, fineTuneWeights }`
    - Remove the `const goal = ...` line (no longer needed in this function)
  - [x] 3.2: Remove unused `OptimizationGoal` type import from `useOptimizationStream.ts` only if it is no longer referenced in that file (it's still imported in `optimizationStore.ts` — do NOT touch that import)

- [x] Task 4: Update tests (AC7)
  - [x] 4.1: In `lebo/src/shared/stores/useOptimizationStream.test.ts`:
    - Find test `'startOptimization clears suggestions and sets isOptimizing(true)'` (line ~116): replace the `expect.objectContaining({ goal: 'balanced' })` assertion with `expect.objectContaining({ sliderPosition: 50, fineTuneWeights: null })`
    - Find test `'startOptimization passes updated goal to invokeCommand'` (line ~244): replace the body — set `useOptimizationStore.getState().setSliderPosition(80)` and `useOptimizationStore.getState().setFineTuneWeights({ damage: 40, survivability: 40, speed: 20 })`, call `startOptimization()`, assert `expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({ sliderPosition: 80, fineTuneWeights: { damage: 40, survivability: 40, speed: 20 } }))`. Rename this test to `'startOptimization passes sliderPosition and fineTuneWeights to invokeCommand'`.

## Dev Notes

### Weight Computation Design Decisions (resolves 7-2 deferred items)

**Proportional vs delta scaling (7-2 AC4 defer):** Story 7-3 does NOT change `setSliderPosition` scaling in the TypeScript store. The delta approach implemented in 7-2 stays. This story only touches the Rust prompt assembly.

**Weight sum invariant (7-2 defer):** Fine-tune values are used as raw percentages in the prompt (no cross-normalization to force sum=100). The AI is prompted with the raw numbers (e.g., "60% damage, 60% survivability, 20% speed" is valid even though it sums to 140%). The AI interprets them as relative priorities, not a probability distribution. This matches the AC2 example where sum=100 but is not enforced.

**No normalization to 0–1 floats for the prompt:** The AC says "normalized to 0–1 ratios" in the context of the internal computation, but the prompt string always shows integer percentages derived directly from the store values. The internal `f32` representation is for computation only; the prompt shows the rounded integers.

### Rust Cargo check

After Rust changes, run `cd lebo && cargo check --manifest-path src-tauri/Cargo.toml` to verify no compile errors before testing the full app.

### FineTuneWeights struct placement

The `FineTuneWeights` struct is defined in `claude_commands.rs` (private to that file). Do NOT add it to `models/` — it is only used by this one command. Do NOT create an `optimization_commands.rs` file; keep the command in `claude_commands.rs` where it already lives.

### No `lib.rs` changes needed

`invoke_claude_api` is already registered in `lib.rs` invoke_handler. Adding/removing parameters does not require changes to `lib.rs` or `mod.rs`.

### The `goal` field in `optimizationStore` stays

`optimizationStore.goal`, `setGoal`, and `OptimizationGoal` type are NOT removed — `SuggestionsList.tsx:58` still reads `goal` from the store to display the "well-optimized" message. Only the call from `startOptimization()` changes. The `goal` field stays at default `'balanced'` in production (it is never set by any current UI component — the GoalSelector is a Phase 1 artifact that no longer exists), which is acceptable; updating SuggestionsList copy is deferred.

### No system prompt changes needed in `prompts.rs`

The system prompt references "their stated goal" — the user_message JSON now has `"optimizationIntent"` instead of `"goal"`, but the AI will see the field name and interpret it correctly. Leave `OPTIMIZATION_SYSTEM_PROMPT` untouched in this story.

### Camel-case vs snake-case in Tauri command params

Tauri 2 serializes Rust command parameters using `serde`. TypeScript passes `sliderPosition` (camelCase) but Rust receives `slider_position` (snake_case) — this is handled automatically by the `#[tauri::command]` attribute macro which renames parameters from camelCase to snake_case. The TypeScript call `{ buildState, sliderPosition, fineTuneWeights }` maps to Rust `(build_state: Value, slider_position: f32, fine_tune_weights: Option<FineTuneWeights>)`.

`FineTuneWeights` fields in TypeScript are camelCase (`damage`, `survivability`, `speed`) — same names as the Rust struct fields, so no rename needed.

### TypeScript strict mode: unused imports

`useOptimizationStream.ts` currently imports nothing from `'../types/optimization'` directly — the `goal` variable comes from `optimizationStore.getState().goal`. After removing `goal` from the invocation, verify there are no orphaned imports (TypeScript strict mode enforces `noUnusedLocals`). The `OptimizationGoal` type is not imported in `useOptimizationStream.ts` (it's only in `optimizationStore.ts`), so no import cleanup is needed there.

### Project Structure Notes

Files to MODIFY:
| File | Change |
|------|--------|
| `lebo/src-tauri/src/commands/claude_commands.rs` | Add `FineTuneWeights` struct + `compute_optimization_intent` fn; update `invoke_claude_api` params; swap `"goal"` → `"optimizationIntent"` in user_message |
| `lebo/src/shared/stores/useOptimizationStream.ts` | Remove `goal` from `startOptimization()` invocation; add `sliderPosition`/`fineTuneWeights` |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | Update 2 tests that assert `goal:` in the invocation |

Files to NOT touch:
- `lebo/src-tauri/src/lib.rs` — no changes needed
- `lebo/src-tauri/src/services/prompts.rs` — no changes needed
- `lebo/src/shared/stores/optimizationStore.ts` — `goal`/`setGoal` still needed by SuggestionsList
- `lebo/src/shared/types/optimization.ts` — no changes needed
- `lebo/src/features/optimization/SuggestionsList.tsx` — stale "Select an optimization goal" copy deferred
- Any Rust `models/` files

### Project Context Rules

- **Never raw `invoke()`** — always `invokeCommand<T>()` wrapper (`src/shared/utils/invokeCommand.ts`)
- **Tauri command naming** — snake_case in Rust, matching the invoke string `'invoke_claude_api'`
- **No barrel files** — do not create `src/features/optimization/index.ts`
- **`noUnusedLocals`** — every import must be used; remove any orphaned imports after edits
- **No `@apply`** — not applicable to this story (no CSS changes)
- **Vault reads sequential** — not applicable to this story

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.3] — ACs, user story, weight computation spec
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:11-16] — current `invoke_claude_api` signature (`build_state: Value, goal: String`)
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:101-107] — `json!({...})` user_message assembly where `"goal": goal` must be replaced
- [Source: lebo/src-tauri/src/services/prompts.rs:1-22] — system prompt (do not modify)
- [Source: lebo/src/shared/stores/useOptimizationStream.ts:36-53] — `startOptimization()` function to update
- [Source: lebo/src/shared/stores/useOptimizationStream.test.ts:116-136] — first test to update (line ~133 `goal: 'balanced'` assertion)
- [Source: lebo/src/shared/stores/useOptimizationStream.test.ts:244-252] — second test to replace (goal → sliderPosition + fineTuneWeights)
- [Source: lebo/src/shared/stores/optimizationStore.ts:86-104] — `sliderPosition`/`fineTuneWeights` state already in store
- [Source: lebo/src/features/optimization/SuggestionsList.tsx:58] — reads `goal` from store (must NOT break)
- [Source: _bmad-output/implementation-artifacts/7-2-finetunepanel-component.md#Review Findings] — deferred items this story resolves: proportional scaling decision and weight sum invariant

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `FineTuneWeights` struct initially declared `struct` (private) — cargo check caught `private_interfaces` error because `pub async fn invoke_claude_api` is reachable at pub visibility. Fixed by declaring `pub struct FineTuneWeights`.

### Completion Notes List

- Task 1: Added `pub struct FineTuneWeights { damage, survivability, speed: f32 }` in `claude_commands.rs`. Updated `invoke_claude_api` to remove `goal: String` and add `slider_position: f32`, `fine_tune_weights: Option<FineTuneWeights>`. No `lib.rs` changes required — parameter additions/removals don't affect command registration.
- Task 2: Added private `fn compute_optimization_intent(slider_position, fine_tune_weights) -> String` below the command. Slider-only path: damage=slider_pos, survivability=100-slider_pos, speed=0. Fine-tune path: use raw weights directly. Called in `invoke_claude_api` before JSON assembly; replaced `"goal": goal` with `"optimizationIntent": optimization_intent` in user_message.
- Task 3: Updated `startOptimization()` to destructure `{ sliderPosition, fineTuneWeights }` from `useOptimizationStore.getState()` and pass both to `invokeCommand`. Removed `const goal = ...` line. No orphaned imports — `OptimizationGoal` was never imported in `useOptimizationStream.ts`.
- Task 4: Updated two tests in `useOptimizationStream.test.ts`: (1) `startOptimization clears suggestions` test assertion changed from `{ goal: 'balanced' }` to `{ sliderPosition: 50, fineTuneWeights: null }`; (2) `startOptimization passes updated goal` test replaced with new body using `setSliderPosition(80)` + `setFineTuneWeights(...)` and renamed. All 12 optimization stream tests pass; 275/275 store+optimization tests green.
- Pre-existing failures (8 tests): `ProviderSelector.test.tsx`, `Settings.test.tsx`, `SkillTreeCanvas.test.tsx`, `TreeControls.test.tsx` — none caused by this story, all in unrelated feature areas.

### File List

- `lebo/src-tauri/src/commands/claude_commands.rs` — added `pub struct FineTuneWeights`, `fn compute_optimization_intent`, updated `invoke_claude_api` signature and user_message assembly
- `lebo/src/shared/stores/useOptimizationStream.ts` — updated `startOptimization()` to pass `sliderPosition`/`fineTuneWeights` instead of `goal`
- `lebo/src/shared/stores/useOptimizationStream.test.ts` — updated 2 tests to assert new invocation shape

### Review Findings

- [x] [Review][Defer] No Rust unit test for `compute_optimization_intent` [lebo/src-tauri/src/commands/claude_commands.rs:171] — deferred, pre-existing pattern (no Rust unit tests exist in codebase); pure function logic verifiable via integration test
- [x] [Review][Defer] `setFineTuneWeights` has no input clamping — values can be negative or >100 [lebo/src/shared/stores/optimizationStore.ts:104] — deferred, pre-existing gap from story 7-2; FineTunePanel is responsible for UI bounds; `isFineTuneWeights` validator in buildPersistence.ts also lacks range checks (both pre-existing)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-18 | Implemented story 7-3: added `FineTuneWeights` Rust struct + `compute_optimization_intent` helper; updated `invoke_claude_api` to remove `goal` param and add `slider_position`/`fine_tune_weights`; updated TypeScript `startOptimization()` call site; updated 2 tests. All 275 optimization/store tests green. |
| 2026-05-18 | Code review complete: 0 patches, 2 deferred, 10 dismissed. Story → done. |
