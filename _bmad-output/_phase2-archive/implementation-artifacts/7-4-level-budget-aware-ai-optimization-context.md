# Story 7.4: Level-Budget-Aware AI Optimization Context

Status: done

## Story

As a theory-crafter,
I want the AI to receive my character level and point budgets as hard constraints when "Enforce Level Budget" is ON, so it can suggest only allocations I can actually make at my level,
So that optimization suggestions are immediately actionable without exceeding my available points.

## Acceptance Criteria

**AC1 — levelContext included when budgetEnforced = true:**
Given `activeBuild.budgetEnforced = true` in useBuildStore,
when `startOptimization()` constructs the optimization payload,
then the payload includes a `levelContext` object:
`{ characterLevel, availablePassivePoints, allocatedPassivePoints, unspentPassivePoints, activeSkillLevels: { slotId: level } }`
computed from the current `activeBuild` state (FR37).

**AC2 — Rust prompt includes budget constraints section:**
Given the Rust `invoke_claude_api` command receives a non-null `level_context`,
when the user_message JSON is assembled,
then a `"levelConstraints"` string field is included:
`"Build constraints: Level {N}, {M} passive points available ({U} unspent), skill levels: {slot1: L1, slot2: L2, ...}"`
— presented as hard constraints the AI must respect in its suggestions.
If `activeSkillLevels` is empty, the skill levels portion reads `"none"`.

**AC3 — levelContext omitted when budgetEnforced = false:**
Given `activeBuild.budgetEnforced = false` (or the field is absent),
when `startOptimization()` constructs the payload,
then `levelContext: null` is passed; the Rust command receives `Option::None`; the `"levelConstraints"` field in the user_message JSON is `null`; the AI does not receive budget constraints (FR38).

**AC4 — LevelContext TypeScript type defined:**
`LevelContext` interface is defined in `src/shared/types/optimization.ts`:
```ts
export interface LevelContext {
  characterLevel: number
  availablePassivePoints: number
  allocatedPassivePoints: number
  unspentPassivePoints: number
  activeSkillLevels: Record<string, number>
}
```

**AC5 — Rust command accepts Option<LevelContext>:**
`invoke_claude_api` in Rust accepts `level_context: Option<LevelContext>` as a new Tauri command parameter; `LevelContext` Rust struct has `#[serde(rename_all = "camelCase")]` so camelCase JSON fields from TypeScript map to snake_case Rust fields.

**AC6 — Tests updated:**
Two new tests added to `useOptimizationStream.test.ts`:
1. When `budgetEnforced = true`, `startOptimization()` passes a correctly-computed `levelContext` object to `invokeCommand`.
2. When `budgetEnforced = false`, `startOptimization()` passes `levelContext: null` to `invokeCommand`.
The existing global buildStore mock is updated to include `budgetEnforced: false`, `characterLevel: 1`, `activeSkillLevels: {}` so the existing 12 tests remain green.

## Tasks / Subtasks

- [x] Task 1: Add `LevelContext` TypeScript type (AC4)
  - [x] 1.1: In `lebo/src/shared/types/optimization.ts`, append after the `FineTuneWeights` interface:
    ```ts
    export interface LevelContext {
      characterLevel: number
      availablePassivePoints: number
      allocatedPassivePoints: number
      unspentPassivePoints: number
      activeSkillLevels: Record<string, number>
    }
    ```

- [x] Task 2: Compute and pass `levelContext` in `startOptimization()` (AC1, AC3)
  - [x] 2.1: In `lebo/src/shared/stores/useOptimizationStream.ts`, add import at the top:
    ```ts
    import { calculatePassivePoints } from '../utils/budgetCalculator'
    import type { LevelContext } from '../types/optimization'
    ```
  - [x] 2.2: In `startOptimization()`, after reading `activeBuild` and before `clearSuggestions()`, compute `levelContext`:
    ```ts
    let levelContext: LevelContext | null = null
    if (activeBuild.budgetEnforced) {
      const availablePassivePoints = calculatePassivePoints(activeBuild.characterLevel)
      const allocatedPassivePoints = Object.values(activeBuild.nodeAllocations).reduce((sum, v) => sum + v, 0)
      levelContext = {
        characterLevel: activeBuild.characterLevel,
        availablePassivePoints,
        allocatedPassivePoints,
        unspentPassivePoints: availablePassivePoints - allocatedPassivePoints,
        activeSkillLevels: { ...activeBuild.activeSkillLevels },
      }
    }
    ```
  - [x] 2.3: Add `levelContext` to the `invokeCommand` call:
    ```ts
    await invokeCommand('invoke_claude_api', {
      buildState: activeBuild,
      sliderPosition,
      fineTuneWeights,
      levelContext,
    })
    ```

- [x] Task 3: Add `LevelContext` Rust struct and update command signature (AC5)
  - [x] 3.1: In `lebo/src-tauri/src/commands/claude_commands.rs`, add below `FineTuneWeights`:
    ```rust
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct LevelContext {
        character_level: u32,
        available_passive_points: u32,
        allocated_passive_points: u32,
        unspent_passive_points: i32,
        active_skill_levels: std::collections::HashMap<String, u32>,
    }
    ```
    Note: `unspent_passive_points` is `i32` (not `u32`) because it can be negative when the player was over-budget in free theory-craft mode and then toggled enforcement on.
  - [x] 3.2: Add `level_context: Option<LevelContext>` to the `invoke_claude_api` function signature (after `fine_tune_weights`):
    ```rust
    pub async fn invoke_claude_api(
        app_handle: tauri::AppHandle,
        build_state: Value,
        slider_position: f32,
        fine_tune_weights: Option<FineTuneWeights>,
        level_context: Option<LevelContext>,
    ) -> Result<(), String> {
    ```

- [x] Task 4: Add `build_level_constraints` helper and wire into user_message (AC2, AC3)
  - [x] 4.1: In `claude_commands.rs`, add a private helper after `compute_optimization_intent`:
    ```rust
    fn build_level_constraints(ctx: &LevelContext) -> String {
        let skills_str = if ctx.active_skill_levels.is_empty() {
            "none".to_string()
        } else {
            let mut skills: Vec<String> = ctx
                .active_skill_levels
                .iter()
                .map(|(slot, level)| format!("{}: {}", slot, level))
                .collect();
            skills.sort();
            skills.join(", ")
        };
        format!(
            "Build constraints: Level {}, {} passive points available ({} unspent), skill levels: {}",
            ctx.character_level,
            ctx.available_passive_points,
            ctx.unspent_passive_points,
            skills_str
        )
    }
    ```
    Skills are sorted before joining for deterministic output (avoids HashMap ordering nondeterminism in the prompt).
  - [x] 4.2: In `invoke_claude_api`, before the `// ── Assemble user message` section, add:
    ```rust
    let level_constraints = level_context.as_ref().map(build_level_constraints);
    ```
  - [x] 4.3: Update the `json!({...})` user_message to include `"levelConstraints"`:
    ```rust
    let user_message = serde_json::to_string(&json!({
        "optimizationIntent": optimization_intent,
        "levelConstraints": level_constraints,
        "build": build_state,
        "availableNodes": available_nodes
    }))
    ```
    When `level_constraints` is `None`, serde serializes it as `null` — the AI receives the field as `null` and ignores it.

- [x] Task 5: Run `cargo check` to verify Rust compiles (prerequisite for Task 6)
  - [x] 5.1: Run `cd lebo && cargo check --manifest-path src-tauri/Cargo.toml` — fix any compile errors before proceeding.

- [x] Task 6: Update tests (AC6)
  - [x] 6.1: In `lebo/src/shared/stores/useOptimizationStream.test.ts`, update the global buildStore mock to add missing budget fields (so existing tests remain green):
    ```ts
    activeBuild: {
      // existing fields...
      budgetEnforced: false,
      characterLevel: 1,
      activeSkillLevels: {},
      // keep all existing fields unchanged
    }
    ```
  - [x] 6.2: Add new test — budget enforced passes levelContext:
    ```ts
    it('startOptimization passes levelContext when budgetEnforced is true', async () => {
      vi.mocked(useBuildStore.getState).mockReturnValueOnce({
        activeBuild: {
          id: 'test',
          name: 'Test',
          classId: 'sentinel',
          masteryId: 'void_knight',
          schemaVersion: 2,
          budgetEnforced: true,
          characterLevel: 40,
          nodeAllocations: { 'node_a': 2 },
          activeSkillLevels: { slot1: 10 },
          skillNodeAllocations: {},
          weaverAllocations: {},
          contextData: { gear: [], skills: [], idols: [] },
          isPersisted: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      } as ReturnType<typeof useBuildStore.getState>)

      await act(async () => { await startOptimization() })

      expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
        levelContext: {
          characterLevel: 40,
          availablePassivePoints: 38,  // calculatePassivePoints(40) = 40 - 2 = 38
          allocatedPassivePoints: 2,
          unspentPassivePoints: 36,
          activeSkillLevels: { slot1: 10 },
        },
      }))
    })
    ```
  - [x] 6.3: Add new test — budget not enforced passes null levelContext:
    ```ts
    it('startOptimization passes levelContext: null when budgetEnforced is false', async () => {
      // Uses default mock where budgetEnforced: false
      await act(async () => { await startOptimization() })

      expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
        levelContext: null,
      }))
    })
    ```
  - [x] 6.4: Run `pnpm vitest src/shared/stores/useOptimizationStream.test.ts` — all tests must pass including the 12 existing ones.

## Dev Notes

### Data flow summary

TypeScript computes `levelContext` entirely client-side from `activeBuild` before sending. Rust receives it as `Option<LevelContext>` and formats it into a prompt string. No new Tauri commands, no new stores, no IPC round-trips added.

The `availablePassivePoints` / `allocatedPassivePoints` split is intentional: the AI gets both the budget ceiling and how much has been spent, giving it the information to know whether suggested allocations fit within unspent points.

### `calculatePassivePoints` formula

`calculatePassivePoints(level) = Math.max(0, level - 2)` — i.e., players earn 1 passive point per level starting at level 3. A level 40 character has 38 passive points. This is the same formula already used by budget enforcement in `applyNodeChange` (buildStore.ts:177).

### Why `i32` for `unspent_passive_points`

A player could allocate 50 nodes in free theory-craft mode (budgetEnforced = false), then switch budgetEnforced to true with a level-40 character (38 points available). The unspentPassivePoints would be -12. `i32` handles this without overflow; `u32` would panic on deserialization.

### Rust serde + Tauri camelCase handling

`#[tauri::command]` renames top-level parameters: `level_context` (Rust) ↔ `levelContext` (TypeScript). For fields *inside* the `LevelContext` struct, serde deserialization controls the rename — hence `#[serde(rename_all = "camelCase")]` on the struct itself. Without this attribute, `characterLevel` from TypeScript would fail to deserialize into `character_level` in Rust.

`FineTuneWeights` didn't need `rename_all` because all its fields are single-word (`damage`, `survivability`, `speed`), which are the same in both languages.

### No lib.rs changes needed

`invoke_claude_api` is already registered. Adding a new parameter doesn't require touching `lib.rs` or `mod.rs` — Tauri's `invoke_handler!` registration doesn't change when command parameters are added.

### No system prompt changes needed

The existing `OPTIMIZATION_SYSTEM_PROMPT` in `prompts.rs` refers to the user's "stated goal". The user_message JSON now has a `"levelConstraints"` field when budget is enforced — the AI will see this structured data and interpret it as constraints. Leave `prompts.rs` untouched; the existing instruction set is sufficient.

### Skill levels: `HashMap` ordering in Rust

`std::collections::HashMap` does not guarantee iteration order, which means skill level entries in the formatted constraint string could appear in arbitrary order across runs. The `build_level_constraints` helper sorts the skills vector before `join()` to produce deterministic prompt output — important for prompt caching and snapshot-style testing.

### What `levelContext: null` looks like in the AI prompt

When `budgetEnforced = false`, `serde_json::json!({ "levelConstraints": null_option })` serializes as `"levelConstraints": null`. The AI receives this field as `null` and will not infer any budget constraints from it. This is clean and preferable to omitting the field entirely, which would require building the JSON object conditionally in Rust.

### TypeScript strict mode: new imports

`useOptimizationStream.ts` will import `calculatePassivePoints` from `'../utils/budgetCalculator'` and `LevelContext` from `'../types/optimization'`. Both are type-safe named exports. `noUnusedLocals` is enforced — verify the imports are actually used after the edit (they will be, by the new `levelContext` computation block).

### Project Structure Notes

Files to **MODIFY**:

| File | Change |
|------|--------|
| `lebo/src/shared/types/optimization.ts` | Add `LevelContext` interface |
| `lebo/src/shared/stores/useOptimizationStream.ts` | Import `calculatePassivePoints` + `LevelContext`; compute `levelContext`; add to `invokeCommand` call |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | Update global mock to add `budgetEnforced: false` + `characterLevel: 1` + `activeSkillLevels: {}`; add 2 new tests |
| `lebo/src-tauri/src/commands/claude_commands.rs` | Add `LevelContext` struct; add `level_context` param; add `build_level_constraints` fn; include `levelConstraints` in user_message JSON |

Files to **NOT touch**:
- `lebo/src-tauri/src/lib.rs` — no changes needed
- `lebo/src-tauri/src/services/prompts.rs` — no changes needed
- `lebo/src/shared/stores/optimizationStore.ts` — no changes needed
- `lebo/src/shared/types/build.ts` — `BuildState` already has `budgetEnforced`, `characterLevel`, `activeSkillLevels`; no changes needed
- `lebo/src/shared/utils/budgetCalculator.ts` — already exports `calculatePassivePoints`; no changes needed
- Any component files — this story is purely data-pipeline; no UI changes

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4] — ACs, user story, `levelContext` payload structure
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:5-10] — `FineTuneWeights` struct pattern to follow for `LevelContext`
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:17-23] — current `invoke_claude_api` signature; `level_context` goes after `fine_tune_weights`
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:109-116] — user_message JSON assembly; `"levelConstraints"` slot goes after `"optimizationIntent"`
- [Source: lebo/src-tauri/src/commands/claude_commands.rs:171-178] — `compute_optimization_intent` fn pattern; `build_level_constraints` follows same placement (below it)
- [Source: lebo/src/shared/stores/useOptimizationStream.ts:35-53] — `startOptimization()` function; `levelContext` computation goes between line 37 and line 40 (before `clearSuggestions`)
- [Source: lebo/src/shared/stores/buildStore.ts:176-183] — existing `applyNodeChange` uses `calculatePassivePoints` for budget enforcement — same formula used here
- [Source: lebo/src/shared/types/optimization.ts:1-5] — `FineTuneWeights` interface; `LevelContext` appended after it
- [Source: lebo/src/shared/utils/budgetCalculator.ts:6-8] — `calculatePassivePoints(level) = Math.max(0, level - 2)`
- [Source: lebo/src/shared/stores/useOptimizationStream.test.ts:22-38] — global buildStore mock to update with budget fields
- [Source: lebo/src/shared/stores/useOptimizationStream.test.ts:245-255] — most recent test added in 7-3; new tests follow same pattern
- [Source: _bmad-output/implementation-artifacts/7-3-optimization-weight-computation-in-rust-and-prompt-construction.md#Dev Notes] — confirms `level_context` param does not require `lib.rs` changes; camelCase↔snake_case Tauri param renaming behaviour

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Initial `cargo check` failed: `LevelContext` was `struct` (private) but used in a `pub` function registered with Tauri. Fixed by making it `pub struct`. Also added `#[allow(dead_code)]` on `allocated_passive_points` since it is deserialized from TypeScript but not read in the Rust formatting helper.

### Completion Notes List

- Added `LevelContext` TypeScript interface to `optimization.ts` (AC4).
- Updated `useOptimizationStream.ts`: imports `calculatePassivePoints` + `LevelContext`; computes `levelContext` conditionally on `activeBuild.budgetEnforced`; passes it to `invokeCommand` (AC1, AC3).
- Added `pub struct LevelContext` to `claude_commands.rs` with `#[serde(rename_all = "camelCase")]`; added `level_context: Option<LevelContext>` param to `invoke_claude_api`; added `build_level_constraints()` helper with deterministic skill sorting; wired `"levelConstraints"` field into user_message JSON (AC2, AC3, AC5).
- Updated `useOptimizationStream.test.ts`: added `budgetEnforced: false`, `characterLevel: 1`, `activeSkillLevels: {}` to global mock; added `useBuildStore` import; added 2 new tests. All 14 tests pass (AC6).

### File List

- `lebo/src/shared/types/optimization.ts`
- `lebo/src/shared/stores/useOptimizationStream.ts`
- `lebo/src/shared/stores/useOptimizationStream.test.ts`
- `lebo/src-tauri/src/commands/claude_commands.rs`

### Review Findings

- [x] [Review][Patch] Guard `nodeAllocations` against null/undefined before `Object.values()` [`lebo/src/shared/stores/useOptimizationStream.ts:23`] — `Object.values(activeBuild.nodeAllocations)` throws if `nodeAllocations` is null/undefined (e.g., older persisted build). Change to `Object.values(activeBuild.nodeAllocations ?? {})`. Same location: if this throws before `clearSuggestions()`, the store stays dirty with stale suggestions visible.
- [x] [Review][Patch] Guard `activeSkillLevels` against undefined in spread [`lebo/src/shared/stores/useOptimizationStream.ts:27`] — `{ ...activeBuild.activeSkillLevels }` silently produces `{}` if the field is undefined (old schema build loaded from vault without migration), causing the AI to receive `"skill levels: none"` when skills are actually allocated. Change to `{ ...(activeBuild.activeSkillLevels ?? {}) }`.
- [x] [Review][Patch] Test hardcodes `availablePassivePoints: 38` — derive from `calculatePassivePoints` instead [`lebo/src/shared/stores/useOptimizationStream.test.ts:308`] — import `calculatePassivePoints` in the test file and compute `const expected = calculatePassivePoints(40)` rather than inlining `38`. Prevents a silent stale-contract failure if the formula ever changes.
- [x] [Review][Defer] `#[allow(dead_code)]` on `allocated_passive_points` in Rust struct [`lebo/src-tauri/src/commands/claude_commands.rs:13-14`] — deferred, pre-existing; field is intentionally accepted over the wire (per AC1 payload spec) but not emitted in the prompt string (AC2 format doesn't include it). Documented in dev notes.
- [x] [Review][Defer] No test coverage for negative `unspentPassivePoints` (over-budget edge case) [`lebo/src/shared/stores/useOptimizationStream.ts:26`] — deferred, by design; dev notes explicitly call out `i32` to support negative values when over-budget in theory-craft mode. A test for this path would be valuable but is not required by AC6.
