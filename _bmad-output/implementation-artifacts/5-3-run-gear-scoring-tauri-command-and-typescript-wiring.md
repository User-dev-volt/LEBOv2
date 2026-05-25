---
title: 'run_gear_scoring Tauri Command & TypeScript Wiring'
story_id: '5.3'
story_key: '5-3-run-gear-scoring-tauri-command-and-typescript-wiring'
epic: 5
status: done
created: '2026-05-24'
---

## Story

**As a developer,**
I want the `run_gear_scoring` Tauri command registered, with `useGearStream.ts` subscribing to `gear:analysis-complete` and `gear:error` events — completely isolated from the `optimization:*` namespace,
**so that** the Gear Optimization screen receives gear analysis results without interfering with the main optimization flow.

---

## Context

This is Story 5.3 — the third story in Epic 5 (Gear Optimization Screen). It bridges the pure-Rust gear scorer from Story 5.2 to the TypeScript UI. Story 5.4 builds the full display layer; Story 5.5 adds the Claude narrative.

**What exists today (after Stories 5.1 and 5.2):**

- `scoring_commands.rs` has `compute_stats` (sync) and `run_optimization` (async). Both are registered in `lib.rs invoke_handler!`. The `run_gear_scoring` command does NOT yet exist.
- `scoring-core/src/gear.rs` exports `pub fn run_gear_scoring(snapshot: &BuildSnapshot, game_data: &GameData) -> GearAnalysis`. It is exported via `pub use gear::run_gear_scoring` in `scoring-core/src/lib.rs`.
- `GearAnalysis`, `GearSlotRanking`, and `WishlistAffix` are defined in `scoring-core/src/stat_sheet.rs` — all have `#[derive(Debug, Clone, Serialize)]`. The Serialize derive means they can be emitted directly as Tauri events.
- `BuildSnapshot` in `build_snapshot.rs` already has `skill_roles`, `primary_offense_delivery_type`, and `primary_offense_damage_elements` fields with `#[serde(default)]` — they exist in Rust but TypeScript has never sent them. This story populates all three from TypeScript.
- `buildSnapshotSerializer.ts` has `toBuildSnapshot(build, gameData) → BuildSnapshot`. The exported `BuildSnapshot` interface does NOT yet include `skillRoles`, `primaryOffenseDeliveryType`, or `primaryOffenseDamageElements`.
- `statSheet.ts` already exports `GearAnalysis`, `GearSlotRanking`, and `WishlistAffix` (added in Story 2.1). Types are snake_case, matching Rust output.
- `optimizationStore.ts` has `statSheet`, `isComputingStats`, and `nodeEfficiencies` but NO gear analysis fields. Gear analysis result storage is this story's responsibility.
- `GearOptimizationView.tsx` shows the "Analyze Gear" button but `handleAnalyzeGear()` only validates Primary Offense is set; the `invokeCommand` call is marked as a Story 5.3 TODO.
- `BuildState.skillRoles` is `Record<string, SkillRole>` where `SkillRole = 'primary_offense' | 'secondary_offense' | 'defensive' | 'utility'`.
- `SkillEntry.type` in `gameData.ts` is `'spell' | 'melee' | 'ranged' | 'unknown'`. This is the source for `primaryOffenseDeliveryType`. No damage element data is available on `SkillEntry` for Phase 3.

**What this story adds:**

1. `run_gear_scoring` async Tauri command in `scoring_commands.rs` — emits `gear:analysis-complete` or `gear:error`
2. Registration of `run_gear_scoring` in `lib.rs invoke_handler!`
3. Three new fields on the `BuildSnapshot` TypeScript interface + their serialization in `toBuildSnapshot`
4. Two new fields on `optimizationStore` (`gearAnalysis`, `isAnalyzingGear`) with setters
5. New `useGearStream.ts` hook + `startGearAnalysis()` function
6. `GearOptimizationView.tsx` wired to call `startGearAnalysis()` with loading state
7. Tests: serializer extensions + gear stream hook

**What this story does NOT do:**
- Implement the slot ranking display — that's Story 5.4
- Add the Claude gear narrative — that's Story 5.5
- Populate `game_data.gear_affixes` from a real JSON — the DB pipeline is a future story. Gear analysis runs now and returns all slots with `upgrade_score: 0.0` / `efficiency_percent: 100.0` until gear_affixes is populated.
- Change the `optimization:*` event namespace — Pattern 6 is enforced here.

---

## Acceptance Criteria

**AC1 — `run_gear_scoring` registered in `invoke_handler!`:**
**Given** `lib.rs` invoke handler
**When** an agent inspects it
**Then** `run_gear_scoring` is registered in `invoke_handler!`
**And** the import in `lib.rs` includes `run_gear_scoring` from `scoring_commands`
**And** the handler is `async` and uses `spawn_blocking` for the gear scoring computation

**AC2 — `gear:analysis-complete` event emitted on success:**
**Given** `run_gear_scoring` completes on the Rust side
**When** the gear analysis result is ready
**Then** a `gear:analysis-complete` Tauri event is emitted with the full serialized `GearAnalysis` payload
**And** the `optimization:*` event namespace is NOT used for any gear analysis events

**AC3 — `gear:error` event emitted on failure:**
**Given** `run_gear_scoring` encounters an error (lock poison or spawn_blocking panic)
**When** the error occurs
**Then** a `gear:error` event is emitted with `{ error_type: "SCORING_ERROR", message: "..." }`
**And** the Tauri command also returns `Err(...)` so the TypeScript invokeCommand catch block fires

**AC4 — `BuildSnapshot` TypeScript interface extended:**
**Given** `shared/utils/buildSnapshotSerializer.ts`
**When** a developer imports `BuildSnapshot`
**Then** it includes `skillRoles: Record<string, string>`, `primaryOffenseDeliveryType: string | null`, `primaryOffenseDamageElements: string[]`

**AC5 — `toBuildSnapshot` populates the three new fields:**
**Given** a build with `skillRoles = { 'slot-0': 'primary_offense' }` and the slot-0 skill has type `'spell'`
**When** `toBuildSnapshot(build, gameData)` is called
**Then** the snapshot's `skillRoles` equals `{ 'slot-0': 'primary_offense' }`
**And** `primaryOffenseDeliveryType` equals `'spell'`
**And** `primaryOffenseDamageElements` equals `[]`

**Given** a build with no skill roles set
**When** `toBuildSnapshot` is called
**Then** `skillRoles` equals `{}`
**And** `primaryOffenseDeliveryType` is `null`
**And** `primaryOffenseDamageElements` is `[]`

**Given** the Primary Offense skill has type `'unknown'`
**When** `toBuildSnapshot` is called
**Then** `primaryOffenseDeliveryType` is `null` (not `'unknown'`)

**AC6 — `optimizationStore` extended:**
**Given** `optimizationStore`
**When** an agent reviews it
**Then** `gearAnalysis: GearAnalysis | null` and `isAnalyzingGear: boolean` are present with `setGearAnalysis()` and `setIsAnalyzingGear()` setters

**AC7 — `useGearStream` hook subscribes to events:**
**Given** `shared/stores/useGearStream.ts`
**When** the hook is mounted
**Then** it subscribes to `gear:analysis-complete` and `gear:error` events
**And** on `analysis-complete`, it calls `setGearAnalysis(payload)` and `setIsAnalyzingGear(false)`
**And** on `gear:error`, it normalizes the error, calls `setStreamError`, and `setIsAnalyzingGear(false)`

**AC8 — `startGearAnalysis` triggers the command:**
**Given** `startGearAnalysis()` is called with a valid build that has a Primary Offense designated
**When** the function executes
**Then** `setIsAnalyzingGear(true)` is called before the IPC command
**And** `invokeCommand('run_gear_scoring', { snapshot })` is called with a snapshot that includes `skillRoles`, `primaryOffenseDeliveryType`, and `primaryOffenseDamageElements`
**And** if the command itself throws, `setIsAnalyzingGear(false)` and `setStreamError` are called

**AC9 — `GearOptimizationView` shows loading state during analysis:**
**Given** a player clicks "Analyze Gear" with Primary Offense set
**When** the analysis is running (`isAnalyzingGear: true`)
**Then** the "Analyze Gear" button is disabled
**And** a visible loading indicator appears

**AC10 — TypeScript type safety:**
**Given** `pnpm build` from the `lebo/` directory
**When** it runs after all story changes
**Then** it succeeds with zero TypeScript errors

**AC11 — Tests:**
**Given** `pnpm vitest` runs
**Then** new tests pass for: skill role serialization, delivery type lookup, graceful null on unknown type, `useGearStream` event handling

---

## Tasks / Subtasks

- [x] Task 1: Add `run_gear_scoring` Tauri command in `scoring_commands.rs` (AC1, AC2, AC3)
  - [x] Add the async `run_gear_scoring` command function — see Technical Requirements §1
  - [x] Pattern 3: clone `game_data` before `spawn_blocking` to release the read lock before await
  - [x] Emit `gear:analysis-complete` with the `GearAnalysis` result on success
  - [x] Emit `gear:error` (with `OptimizationErrorPayload`) and return `Err` on lock poison or panic
  - [x] `cargo build` (full Tauri crate) passes

- [x] Task 2: Register `run_gear_scoring` in `lib.rs` (AC1)
  - [x] Add `run_gear_scoring` to the `use commands::scoring_commands::{...}` import
  - [x] Add `run_gear_scoring` to `invoke_handler!`
  - [x] `cargo build` passes

- [x] Task 3: Extend `buildSnapshotSerializer.ts` (AC4, AC5)
  - [x] Add `skillRoles`, `primaryOffenseDeliveryType`, `primaryOffenseDamageElements` to the `BuildSnapshot` interface
  - [x] Implement `extractPrimaryOffenseDeliveryType(build, gameData)` helper — see Technical Requirements §3
  - [x] Update `toBuildSnapshot` to populate the three new fields
  - [x] `pnpm build` passes

- [x] Task 4: Extend `optimizationStore.ts` (AC6)
  - [x] Add `gearAnalysis: GearAnalysis | null` field (initial: `null`)
  - [x] Add `isAnalyzingGear: boolean` field (initial: `false`)
  - [x] Add `setGearAnalysis(analysis: GearAnalysis | null): void` action
  - [x] Add `setIsAnalyzingGear(analyzing: boolean): void` action
  - [x] Import `GearAnalysis` from `'../types/statSheet'`
  - [x] `pnpm build` passes

- [x] Task 5: Create `useGearStream.ts` (AC7, AC8)
  - [x] Create `lebo/src/shared/stores/useGearStream.ts`
  - [x] Export `useGearStream()` hook — subscribes to `gear:analysis-complete` and `gear:error`
  - [x] Export `startGearAnalysis()` imperative function
  - [x] See Technical Requirements §4 for the complete implementation blueprint
  - [x] `pnpm build` passes

- [x] Task 6: Update `GearOptimizationView.tsx` (AC9)
  - [x] Import `useGearStream` and `startGearAnalysis` from `useGearStream`
  - [x] Mount `useGearStream()` hook in the component
  - [x] Update `handleAnalyzeGear` to call `startGearAnalysis()`
  - [x] Add `isAnalyzingGear` from `optimizationStore`; disable the button and show loading indicator during analysis
  - [x] `pnpm build` passes

- [x] Task 7: Tests (AC11)
  - [x] `buildSnapshotSerializer.test.ts`: add tests for `skillRoles`, `primaryOffenseDeliveryType`, `primaryOffenseDamageElements` serialization
  - [x] `useGearStream.test.ts`: create new test file — test event handling (mock Tauri IPC, verify store updates)
  - [x] `pnpm vitest` passes (new tests green, pre-existing tests unaffected)

---

## Technical Requirements

### 1. `scoring_commands.rs` — `run_gear_scoring` command

Add this function to `scoring_commands.rs`. It follows the exact same structural pattern as `run_optimization` (Pattern 3: clone before `spawn_blocking`):

```rust
/// Async Tauri command — gear slot affix analysis (~10–50ms depending on slot count).
/// Pattern 3: clone game_data BEFORE spawn_blocking; never hold a read lock across await.
/// Emits gear:analysis-complete with GearAnalysis on success.
/// Emits gear:error (Pattern 6 — NOT optimization:*) on any failure.
#[tauri::command]
pub async fn run_gear_scoring(
    app_handle: tauri::AppHandle,
    snapshot: scoring_core::BuildSnapshot,
    state: tauri::State<'_, ScoringState>,
) -> Result<(), String> {
    let game_data = state.game_data.read()
        .map_err(|e| {
            let err = format!("SCORING_ERROR: game_data lock poisoned: {}", e);
            let _ = app_handle.emit(
                "gear:error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "SCORING_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            err
        })?
        .clone();

    let gear_result =
        tauri::async_runtime::spawn_blocking(move || {
            scoring_core::run_gear_scoring(&snapshot, &game_data)
        })
        .await
        .map_err(|e| {
            let err = format!("SCORING_ERROR: gear scoring compute panicked: {}", e);
            let _ = app_handle.emit(
                "gear:error",
                &crate::services::claude_service::OptimizationErrorPayload {
                    error_type: "SCORING_ERROR".to_string(),
                    message: err.clone(),
                },
            );
            err
        })?;

    let _ = app_handle.emit("gear:analysis-complete", &gear_result);
    Ok(())
}
```

**Key notes:**
- `scoring_core::GearAnalysis` derives `Serialize` — emit it directly with `&gear_result`. Tauri will serialize it to JSON and the TypeScript listener receives a properly typed `GearAnalysis` object in `event.payload` (no `JSON.parse` needed, unlike `optimization:node-efficiencies` which emits a raw JSON string).
- Reuse `crate::services::claude_service::OptimizationErrorPayload` for `gear:error` — same shape `{ error_type, message }`.
- The command returns `Ok(())` — the analysis result is delivered via the `gear:analysis-complete` event, not as the return value.
- This command is pure computation (no Claude API call). It is significantly faster than `run_optimization` (~10–50ms vs ~50ms+ for the full pipeline).

### 2. `lib.rs` — registration

Two changes only:

1. Extend the import line:
```rust
// BEFORE:
use commands::scoring_commands::{compute_stats, run_optimization};

// AFTER:
use commands::scoring_commands::{compute_stats, run_gear_scoring, run_optimization};
```

2. Add to `invoke_handler!` (after `run_optimization`):
```rust
run_gear_scoring,
```

### 3. `buildSnapshotSerializer.ts` — three new fields

**Step 1: Extend the `BuildSnapshot` interface** (add after `activeSkillLevels`):

```ts
// Added in Story 5.3 — populates run_gear_scoring context fields in BuildSnapshot
skillRoles: Record<string, string>
primaryOffenseDeliveryType: string | null
primaryOffenseDamageElements: string[]
```

**Step 2: Add the delivery type helper** (add before `toBuildSnapshot`):

```ts
function extractPrimaryOffenseDeliveryType(
  build: BuildState,
  gameData: GameData,
): string | null {
  if (!build.skillRoles) return null

  // Find the slot designated as primary_offense
  const primarySlotId = Object.entries(build.skillRoles).find(
    ([, role]) => role === 'primary_offense',
  )?.[0]
  if (!primarySlotId) return null

  // Find the skill assigned to that slot
  const activeSkill = build.contextData.skills.find((s) => s.slotId === primarySlotId)
  if (!activeSkill) return null

  // Look up the skill's delivery type in game data
  const classData = gameData.classes?.[build.classId]
  if (!classData) return null

  const skillEntry = classData.skills.find((s) => s.skillId === activeSkill.skillId)
  if (!skillEntry) return null

  // 'unknown' → null (no delivery type filtering in gear scorer)
  return skillEntry.type === 'unknown' ? null : skillEntry.type
}
```

**Step 3: Update `toBuildSnapshot`** (add three fields to the return object):

```ts
// After activeSkillLevels:
skillRoles: { ...(build.skillRoles ?? {}) },
primaryOffenseDeliveryType: extractPrimaryOffenseDeliveryType(build, gameData),
primaryOffenseDamageElements: [],  // No element data in SkillEntry for Phase 3; scorer degrades gracefully
```

**Important notes:**
- `primaryOffenseDamageElements` is `[]` intentionally. `SkillEntry` has no damage element data. An empty array causes `passes_element_filter` in `gear.rs` to always return `true` (no element filtering). This is the correct degraded-mode behavior.
- `skillRoles` is `Record<string, string>` (not `Record<string, SkillRole>`) in the `BuildSnapshot` interface — it crosses the IPC boundary as plain strings, matching the Rust `HashMap<String, String>`.
- `gameData.classes` may be `undefined` if game data hasn't loaded yet. The `?.` chain returns `null` gracefully.

### 4. `optimizationStore.ts` — gear analysis fields

Add to the `OptimizationStore` interface (after `nodeEfficiencies`):

```ts
gearAnalysis: GearAnalysis | null
isAnalyzingGear: boolean
setGearAnalysis: (analysis: GearAnalysis | null) => void
setIsAnalyzingGear: (analyzing: boolean) => void
```

Add to the store implementation (after `nodeEfficiencies: null`):

```ts
gearAnalysis: null,
isAnalyzingGear: false,
setGearAnalysis: (analysis) => set({ gearAnalysis: analysis }),
setIsAnalyzingGear: (analyzing) => set({ isAnalyzingGear: analyzing }),
```

Update the `import` at the top to include `GearAnalysis`:

```ts
import type { StatSheet, NodeEfficiency, GearAnalysis } from '../types/statSheet'
```

**Do NOT add `gearAnalysis` to `clearSuggestions()`.** Gear analysis is independent of the optimization flow and should persist when suggestions are cleared.

### 5. `useGearStream.ts` — complete implementation

```ts
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { invokeCommand } from '../utils/invokeCommand'
import { normalizeAppError } from '../utils/errorNormalizer'
import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'
import { useBuildStore } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import type { GearAnalysis } from '../types/statSheet'

// Payload emitted by run_gear_scoring on error (same shape as OptimizationErrorPayload)
interface GearErrorPayload {
  error_type: string
  message: string
}

export async function startGearAnalysis(): Promise<void> {
  const activeBuild = useBuildStore.getState().activeBuild
  if (!activeBuild) return

  const gameData = useGameDataStore.getState().gameData
  if (!gameData) return

  const snapshot = toBuildSnapshot(activeBuild, gameData)

  useOptimizationStore.getState().setIsAnalyzingGear(true)
  useOptimizationStore.getState().setGearAnalysis(null)

  try {
    await invokeCommand('run_gear_scoring', { snapshot })
    // Result arrives via gear:analysis-complete event — no return value from this command
  } catch (err) {
    // IPC-level failure (lock poison etc.) — event may not fire, handle here too
    const appError = normalizeAppError(err)
    useOptimizationStore.getState().setStreamError(appError)
    useOptimizationStore.getState().setIsAnalyzingGear(false)
  }
}

export function useGearStream(): void {
  useEffect(() => {
    const unlisteners: UnlistenFn[] = []
    let isMounted = true

    async function registerListeners(): Promise<void> {
      const unlisten1 = await listen<GearAnalysis>(
        'gear:analysis-complete',
        (event) => {
          useOptimizationStore.getState().setGearAnalysis(event.payload)
          useOptimizationStore.getState().setIsAnalyzingGear(false)
        },
      )
      if (!isMounted) { unlisten1(); return }
      unlisteners.push(unlisten1)

      const unlisten2 = await listen<GearErrorPayload>(
        'gear:error',
        (event) => {
          const { error_type, message } = event.payload
          const appError = normalizeAppError(`${error_type}: ${message}`)
          useOptimizationStore.getState().setStreamError(appError)
          useOptimizationStore.getState().setIsAnalyzingGear(false)
        },
      )
      if (!isMounted) { unlisten2(); return }
      unlisteners.push(unlisten2)
    }

    registerListeners().catch(console.error)

    return () => {
      isMounted = false
      for (const unlisten of unlisteners) {
        unlisten()
      }
      useOptimizationStore.getState().setIsAnalyzingGear(false)
    }
  }, [])
}
```

**Key design choices:**
- `useGearStream()` has an empty `[]` dependency array — it registers listeners once on mount and cleans up on unmount. There are no function dependencies that would change (unlike `useOptimizationStream` which inadvertently created a stale closure issue with its deps array).
- `gear:analysis-complete` listener receives `event.payload` as a typed `GearAnalysis` object — no `JSON.parse` needed because Rust emits the struct directly with `app_handle.emit(...)`.
- `startGearAnalysis()` is a standalone async function (not a React hook) — it can be called from event handlers without violating hook rules. Same pattern as `startOptimization()` in `useOptimizationStream.ts`.
- On `gear:analysis-complete`, `setIsAnalyzingGear(false)` is called so the "Analyze Gear" button re-enables. The result is stored in `gearAnalysis` for Story 5.4 to display.
- Cleanup: `setIsAnalyzingGear(false)` on unmount prevents the button from being stuck in loading state if the component unmounts while a request is in flight.

### 6. `GearOptimizationView.tsx` — wire up analysis

```tsx
import { useGearStream, startGearAnalysis } from '../../shared/stores/useGearStream'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'

export function GearOptimizationView() {
  useGearStream()  // register gear event listeners for the lifetime of this view

  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const isAnalyzingGear = useOptimizationStore((s) => s.isAnalyzingGear)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const skillRoles = activeBuild?.skillRoles ?? {}
  const hasPrimaryOffense = Object.values(skillRoles).includes('primary_offense')
  const hasAnyRole = Object.keys(skillRoles).length > 0

  function handleAnalyzeGear() {
    if (!hasPrimaryOffense) {
      setAnalyzeError('Please designate at least one skill as Primary Offense before running gear analysis')
      return
    }
    setAnalyzeError(null)
    startGearAnalysis()
  }

  // ... rest of JSX unchanged, except the Analyze Gear button:
  // disabled={isAnalyzingGear || !hasPrimaryOffense}
  // and add a loading indicator when isAnalyzingGear is true
}
```

**For the loading indicator**, add below the Analyze button (inside the existing `flex flex-col gap-2` div):

```tsx
{isAnalyzingGear && (
  <p
    data-testid="gear-analysis-loading"
    className="text-xs"
    style={{ color: 'var(--color-text-secondary)' }}
    aria-live="polite"
  >
    Analyzing gear...
  </p>
)}
```

**Button disabled state:**
```tsx
disabled={isAnalyzingGear}
style={{
  backgroundColor: isAnalyzingGear
    ? 'var(--color-bg-hover)'
    : 'var(--color-accent-gold)',
  color: isAnalyzingGear
    ? 'var(--color-text-muted)'
    : 'var(--color-bg-base)',
  cursor: isAnalyzingGear ? 'not-allowed' : 'pointer',
}}
```

**Note:** Do NOT add `disabled={!hasPrimaryOffense}` — the existing code already blocks via `setAnalyzeError` when no Primary Offense is set. The error message is clearer UX than a disabled button for that case. Only disable during actual analysis.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/src/commands/scoring_commands.rs` | MODIFY | Add `run_gear_scoring` async command |
| `lebo/src-tauri/src/lib.rs` | MODIFY | Import + register `run_gear_scoring` |
| `lebo/src/shared/utils/buildSnapshotSerializer.ts` | MODIFY | Extend `BuildSnapshot` interface; add delivery type helper; populate 3 new fields in `toBuildSnapshot` |
| `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` | MODIFY | Add tests for `skillRoles`, `primaryOffenseDeliveryType`, `primaryOffenseDamageElements` |
| `lebo/src/shared/stores/optimizationStore.ts` | MODIFY | Add `gearAnalysis`, `isAnalyzingGear`, and setters |
| `lebo/src/shared/stores/useGearStream.ts` | CREATE | Hook + `startGearAnalysis()` function |
| `lebo/src/shared/stores/useGearStream.test.ts` | CREATE | Unit tests for event handling |
| `lebo/src/features/gear-optimization/GearOptimizationView.tsx` | MODIFY | Mount `useGearStream()`; wire `handleAnalyzeGear` to `startGearAnalysis()`; add loading state |

**Do NOT touch:**
- `scoring-core/src/gear.rs` — `run_gear_scoring` is already complete and tested (56 tests pass)
- `scoring-core/src/lib.rs` — already exports `run_gear_scoring`
- `scoring-core/src/stat_sheet.rs` — `GearAnalysis` already derives `Serialize`
- `shared/types/statSheet.ts` — `GearAnalysis`, `GearSlotRanking`, `WishlistAffix` are already correctly defined
- Any `optimization:*` event handling — Pattern 6 strictly prohibits gear events in the optimization namespace
- `GearOptimizationView.test.tsx` — may need updates if existing tests break; check at the end

---

## Architecture & Pattern Compliance

**Pattern 1 (`buildSnapshotSerializer.ts`):** `toBuildSnapshot` remains the only conversion point. The new fields are added to its return object, maintaining the single-converter invariant. Story 5.4's display component must NEVER call `invokeCommand` directly — it reads from `optimizationStore.gearAnalysis`.

**Pattern 2 (camelCase input, snake_case output):** TypeScript sends `skillRoles`, `primaryOffenseDeliveryType`, `primaryOffenseDamageElements` in camelCase. Rust's `#[serde(rename_all = "camelCase")]` on `BuildSnapshot` deserializes them to `skill_roles`, `primary_offense_delivery_type`, `primary_offense_damage_elements`. TypeScript reads back `slot_rankings`, `priority_slot` (snake_case from Rust output) via the existing `GearAnalysis` interface in `statSheet.ts`.

**Pattern 3 (lock ownership):** `run_gear_scoring` clones `game_data` BEFORE `spawn_blocking`. The read lock is dropped before the `await`. Never hold a `RwLock` read guard across an `await` boundary.

**Pattern 5 (SCORING_ERROR prefix):** All errors from `run_gear_scoring` are prefixed with `"SCORING_ERROR: "`. The existing `normalizeAppError` in TypeScript maps this correctly.

**Pattern 6 (gear namespace):** Events ONLY use `gear:analysis-complete` and `gear:error`. Never use `optimization:*` for gear events.

**Four stores only:** No new store is created. `gearAnalysis` and `isAnalyzingGear` extend the existing `optimizationStore` — they are conceptually part of the optimization/analysis domain. Consistent with how `statSheet` and `nodeEfficiencies` (also scoring engine outputs) live in `optimizationStore`.

**No barrel files:** `useGearStream.ts` is imported directly from its path. No `index.ts` re-export file.

**IPC never raw `invoke()`:** `startGearAnalysis` uses `invokeCommand<void>` (or just `invokeCommand` since the command returns `()` mapped to `void`). Note: `invokeCommand<void>` is fine; the actual data delivery is via event.

---

## Testing Requirements

### Rust verification

From `lebo/src-tauri/`:

```bash
cargo build              # Full Tauri crate builds with new command
cargo test -p scoring-core  # All existing gear tests still pass (no changes to scoring-core)
```

### TypeScript / Vitest tests

**`buildSnapshotSerializer.test.ts` additions:**

```ts
describe('toBuildSnapshot — skill role fields (Story 5.3)', () => {
  it('maps skillRoles to snapshot', () => {
    const build = makeBuild({ skillRoles: { 'slot-0': 'primary_offense', 'slot-1': 'defensive' } })
    const snap = toBuildSnapshot(build, minimalGameData)
    expect(snap.skillRoles).toEqual({ 'slot-0': 'primary_offense', 'slot-1': 'defensive' })
  })

  it('defaults skillRoles to {} when not set', () => {
    expect(toBuildSnapshot(makeBuild(), minimalGameData).skillRoles).toEqual({})
  })

  it('defaults primaryOffenseDamageElements to []', () => {
    expect(toBuildSnapshot(makeBuild(), minimalGameData).primaryOffenseDamageElements).toEqual([])
  })

  it('returns null primaryOffenseDeliveryType when no skillRoles set', () => {
    expect(toBuildSnapshot(makeBuild(), minimalGameData).primaryOffenseDeliveryType).toBeNull()
  })

  it('returns null primaryOffenseDeliveryType when no primary_offense role', () => {
    const build = makeBuild({ skillRoles: { 'slot-0': 'defensive' } })
    expect(toBuildSnapshot(build, minimalGameData).primaryOffenseDeliveryType).toBeNull()
  })

  it('looks up delivery type from game data for primary_offense slot', () => {
    const build = makeBuild({
      classId: 'rogue',
      skillRoles: { 'slot-0': 'primary_offense' },
      contextData: {
        gear: [],
        idols: [],
        skills: [{ slotId: 'slot-0', skillName: 'Poison Eruption', skillId: 'poison-eruption' }],
      },
    })
    const gameData = {
      classes: {
        rogue: {
          classId: 'rogue',
          className: 'Rogue',
          baseTree: {},
          masteries: {},
          skillTrees: {},
          skills: [
            { skillId: 'poison-eruption', skillName: 'Poison Eruption', masteryId: null, masteryName: null, masteryGatePoints: null, type: 'spell' as const },
          ],
        },
      },
    } as unknown as GameData  // partial GameData for test purposes
    expect(toBuildSnapshot(build, gameData).primaryOffenseDeliveryType).toBe('spell')
  })

  it('returns null for primaryOffenseDeliveryType when skill type is unknown', () => {
    const build = makeBuild({
      classId: 'rogue',
      skillRoles: { 'slot-0': 'primary_offense' },
      contextData: {
        gear: [],
        idols: [],
        skills: [{ slotId: 'slot-0', skillName: 'SomeSkill', skillId: 'some-skill' }],
      },
    })
    const gameData = {
      classes: {
        rogue: {
          classId: 'rogue',
          className: 'Rogue',
          baseTree: {},
          masteries: {},
          skillTrees: {},
          skills: [
            { skillId: 'some-skill', skillName: 'SomeSkill', masteryId: null, masteryName: null, masteryGatePoints: null, type: 'unknown' as const },
          ],
        },
      },
    } as unknown as GameData
    expect(toBuildSnapshot(build, gameData).primaryOffenseDeliveryType).toBeNull()
  })

  it('returns null for primaryOffenseDeliveryType when skill not found in game data', () => {
    const build = makeBuild({
      classId: 'rogue',
      skillRoles: { 'slot-0': 'primary_offense' },
      contextData: {
        gear: [],
        idols: [],
        skills: [{ slotId: 'slot-0', skillName: 'Unknown Skill', skillId: 'not-in-db' }],
      },
    })
    expect(toBuildSnapshot(build, minimalGameData).primaryOffenseDeliveryType).toBeNull()
  })
})
```

**`useGearStream.test.ts` — new file** (mock Tauri IPC following the pattern from `useOptimizationStream.test.ts`):

```ts
// Mock Tauri IPC
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock @tauri-apps/api/event before importing the hook
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))
vi.mock('../utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

import { listen } from '@tauri-apps/api/event'
import { invokeCommand } from '../utils/invokeCommand'
import { useGearStream } from './useGearStream'
import { useOptimizationStore } from './optimizationStore'

// Test: gear:analysis-complete sets gearAnalysis and clears isAnalyzingGear
// Test: gear:error sets streamError and clears isAnalyzingGear
// Test: cleanup calls setIsAnalyzingGear(false) on unmount
```

(See `useOptimizationStream.test.ts` for the exact pattern — mock `listen` to capture callbacks, then invoke them to simulate Tauri events.)

### Verification commands

From `lebo/` (Vite project root):

```bash
pnpm build                                                    # TypeScript strict-mode build passes
pnpm vitest src/shared/utils/buildSnapshotSerializer.test.ts  # New serializer tests pass
pnpm vitest src/shared/stores/useGearStream.test.ts           # New hook tests pass
pnpm vitest                                                   # Full suite: new tests green, pre-existing unaffected
```

From `lebo/src-tauri/`:

```bash
cargo build                                                   # Tauri crate builds with run_gear_scoring
```

---

## Previous Story Intelligence (from 5.2)

- **Story 5.2 had a critical blocker:** `compute.rs::build_registry()` did not process gear slot affixes, so injecting affixes into `snapshot.gear_slots` had zero effect on `compute_stats`. This was fixed in Story 5.2 by adding a gear slot loop to `build_registry`. **All 56 scoring-core tests pass** (51 pre-existing + 5 new gear tests).
- **`gear.rs` degrades gracefully when `game_data.gear_affixes` is empty** — this is the current state. All 12 slots return `upgrade_score: 0.0`, `efficiency_percent: 100.0`, empty wishlists. The UI in Story 5.4 will show "100% of ideal" for all slots in this degraded mode. Story 5.3 must NOT block on affix data being populated.
- **`primary_offense_delivery_type: None` causes all non-generic affixes to receive weight 0.0** in the gear scorer. When TypeScript sends `primaryOffenseDeliveryType: null`, Rust deserializes it as `None` (the `#[serde(default)]` on `Option<String>` makes `null` → `None`). This is correct behavior — without delivery type context, only generic affixes (resistances, HP) get non-zero weights.
- **`current_affix_total` was patched in Story 5.2 review:** it now uses an `ideal_tiers` map to gate credit on `a.tier >= required` (not just any-tier copy). The story 5.3 TypeScript code does not need to compensate for this — it just passes the build state.
- **Story 5.2 did NOT touch any TypeScript files.** The three new `BuildSnapshot` Rust fields (`skill_roles`, `primary_offense_delivery_type`, `primary_offense_damage_elements`) are present in Rust but TypeScript has never populated them. They default to empty/None via `#[serde(default)]`. Existing `compute_stats` and `run_optimization` callers are unaffected.
- **`GearAnalysis` is a separate return type from `run_gear_scoring` — it is NOT a sub-sheet of `StatSheet`.** Story 5.3 stores it in `optimizationStore.gearAnalysis`, separate from `statSheet`. Pattern 7 (null sub-sheets) does not apply.

---

## Dev Notes

**`gear:analysis-complete` payload is a typed object, not a string.** Rust emits `GearAnalysis` directly via `app_handle.emit("gear:analysis-complete", &gear_result)`. Tauri 2 serializes the struct and deserializes it on the TypeScript side. The `listen` callback receives `event.payload` as `GearAnalysis` — no `JSON.parse` needed. This is different from `optimization:node-efficiencies` which was emitted as a raw JSON string (`app_handle.emit("...", eff_json)`) and required `JSON.parse`.

**`startGearAnalysis` returns `Promise<void>` but the caller (`handleAnalyzeGear`) does not await it.** This is correct — the result arrives asynchronously via the `gear:analysis-complete` event. The `handleAnalyzeGear` function remains synchronous from the UI's perspective (no `async` keyword needed on the component handler).

**`isAnalyzingGear` reset on `useGearStream` unmount.** The `GearOptimizationView` mounts `useGearStream()` with a `useEffect`. When the player navigates back to the main view, the component unmounts and the cleanup runs `setIsAnalyzingGear(false)`. This prevents a stuck loading state if analysis completes after the user has navigated away.

**`setGearAnalysis(null)` is called at the START of `startGearAnalysis`.** This clears any stale analysis from a previous run immediately when a new analysis begins. Story 5.4's display must handle `gearAnalysis === null` gracefully (show loading state or prompt).

**`gameData.classes` may be `null` or `undefined`.** The game data is loaded async on startup. If `extractPrimaryOffenseDeliveryType` is called before game data loads, the `?.` chain returns `null`. This is correct — `null` delivery type means no delivery filtering, which is the safe fallback.

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6 (2026-05-24)

### Debug Log References
No blockers encountered. All implementations matched the Technical Requirements blueprints exactly on first attempt.

### Completion Notes List

- **Task 1 & 2:** `run_gear_scoring` Tauri command added to `scoring_commands.rs` following Pattern 3 (clone before spawn_blocking). Reused `OptimizationErrorPayload` from `claude_service` for `gear:error` events — same struct shape, no new type needed. `cargo build` passed in 1m 11s.
- **Task 3:** Added `extractPrimaryOffenseDeliveryType` helper before `toBuildSnapshot`. Maps `SkillEntry.type === 'unknown'` → `null`. `primaryOffenseDamageElements` intentionally always `[]` — no element data in `SkillEntry` for Phase 3; scorer degrades gracefully.
- **Task 4:** Extended `optimizationStore` with `gearAnalysis` and `isAnalyzingGear`. Did NOT add to `clearSuggestions()` per spec — gear analysis is independent of optimization flow.
- **Task 5:** `useGearStream.ts` created with empty `[]` deps array (no stale closure risk). `gear:analysis-complete` payload arrives as typed `GearAnalysis` object — no `JSON.parse` needed (contrast with `optimization:node-efficiencies`).
- **Task 6:** `GearOptimizationView.tsx` wired — `useGearStream()` mounted, `handleAnalyzeGear` calls `startGearAnalysis()`, button disabled + loading indicator shown during `isAnalyzingGear`.
- **Task 7:** 38/38 serializer tests pass (28 pre-existing + 10 new skill role tests). 8/8 `useGearStream` tests pass. 8 pre-existing failures in `ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls` are unrelated to this story (none of those files were modified).

### File List

- `lebo/src-tauri/src/commands/scoring_commands.rs` — MODIFIED (added `run_gear_scoring` async command)
- `lebo/src-tauri/src/lib.rs` — MODIFIED (import + register `run_gear_scoring`)
- `lebo/src/shared/utils/buildSnapshotSerializer.ts` — MODIFIED (extended `BuildSnapshot` interface; added `extractPrimaryOffenseDeliveryType` helper; populated 3 new fields in `toBuildSnapshot`)
- `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` — MODIFIED (added 10 skill role tests; 38/38 pass)
- `lebo/src/shared/stores/optimizationStore.ts` — MODIFIED (added `gearAnalysis`, `isAnalyzingGear`, setters)
- `lebo/src/shared/stores/useGearStream.ts` — CREATED (hook + `startGearAnalysis()`)
- `lebo/src/shared/stores/useGearStream.test.ts` — CREATED (8 tests; 8/8 pass)
- `lebo/src/features/gear-optimization/GearOptimizationView.tsx` — MODIFIED (wired `useGearStream`, `startGearAnalysis`, loading state)

### Review Findings

- [x] [Review][Defer] `priority_slot` may be empty string when `gear_affixes` is empty (degraded mode) [`scoring-core/src/gear.rs` — not modified in this diff] — deferred, pre-existing
