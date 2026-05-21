# Story 2.5: TypeScript Integration — Serializer, Hook & Store

Status: ready-for-dev

## Story

As a developer,
I want the `buildSnapshotSerializer.ts` utility, `useStatSheet.ts` hook, and `optimizationStore` extensions wired together so stat sheet updates flow automatically on every build state change,
so that the stat sheet display in Story 2.6 has live data without any "Recalculate" button.

## Acceptance Criteria

1. **Given** `shared/utils/buildSnapshotSerializer.ts`
   **When** `toBuildSnapshot(activeBuild, gameData)` is called with a full `BuildState`
   **Then** the returned `BuildSnapshot` contains only ID-based data (node IDs, affix IDs, tiers, idol placements, blessings, conditions, level, class, mastery, slider)
   **And** `BuildState` UI-specific fields (`schemaVersion`, undo metadata) are absent from the snapshot

2. **Given** `shared/stores/useStatSheet.ts`
   **When** the user rapidly allocates five nodes in < 16ms
   **Then** only one `invokeCommand('compute_stats', ...)` call fires per rAF frame
   **And** the stat sheet reflects the final allocation state, not an intermediate state

3. **Given** a pending `compute_stats` call and a newer state change arriving before it resolves
   **When** the newer call's result arrives and then the older call also resolves
   **Then** the stale (older) result is discarded via the `generationRef` counter
   **And** `optimizationStore.statSheet` reflects only the latest generation's result

4. **Given** `App.tsx`
   **When** an agent reviews it
   **Then** the inline `calculateScore` subscribe blocks are removed
   **And** `useStatSheet()` is called as a single hook call in `App.tsx`
   **And** `scoringEngine.ts` still exists in place with a deprecation comment (deletion is a follow-up story, not part of this story)

5. **Given** `optimizationStore`
   **When** an agent reviews its fields
   **Then** `statSheet: StatSheet | null`, `isComputingStats: boolean`, `setStatSheet()`, and `setIsComputingStats()` are all present
   **And** `nodeEfficiencies: NodeEfficiency[] | null` and its setter are present (will be wired in Epic 4 Story 4.4)

## Tasks / Subtasks

- [ ] Task 1: Create `buildSnapshotSerializer.ts` (AC: #1)
  - [ ] Create `lebo/src/shared/utils/buildSnapshotSerializer.ts`
  - [ ] Define `BuildSnapshot`, `GearSlotSnapshotTS`, `AffixEntryTS`, `IdolPlacementTS` interfaces (camelCase — Pattern 2 input direction)
  - [ ] Implement `toBuildSnapshot(build: BuildState, _gameData: GameData): BuildSnapshot` — see exact implementation in Dev Notes
  - [ ] Do NOT create an `index.ts` barrel file

- [ ] Task 2: Create `useStatSheet.ts` (AC: #2, #3)
  - [ ] Create `lebo/src/shared/stores/useStatSheet.ts`
  - [ ] Implement rAF-based debounce using `cancelAnimationFrame` + `requestAnimationFrame` ref
  - [ ] Implement generation-based cancellation via `useRef` counter (Pattern 4)
  - [ ] Subscribe to both `useBuildStore` and `useGameDataStore` — see exact implementation in Dev Notes
  - [ ] Call `invokeCommand<StatSheet>('compute_stats', { snapshot })` — never raw `invoke()`

- [ ] Task 3: Update `App.tsx` (AC: #4)
  - [ ] Remove the two `calculateScore` subscribe `useEffect` blocks (lines 77–92 and 104–115)
  - [ ] Remove the `import { calculateScore }` line from `scoringEngine` import
  - [ ] Add `import { useStatSheet } from './shared/stores/useStatSheet'` to imports
  - [ ] Add `useStatSheet()` call inside `App()` alongside the other hooks (after `useOptimizationStream()`)
  - [ ] Keep the build-switch `useEffect` (lines 94–102: sliderPosition, fineTuneWeights, clearSuggestions) — it does NOT call `calculateScore`

- [ ] Task 4: Deprecate `scoringEngine.ts` in place (AC: #4)
  - [ ] Add `// @deprecated — replaced by useStatSheet + compute_stats Tauri command. Deletion in follow-up story.` at the top of `lebo/src/features/optimization/scoringEngine.ts`
  - [ ] Do NOT delete the file — `useOptimizationStream.ts` still uses `calculateScore` for suggestion preview scoring

- [ ] Task 5: Verify stores (AC: #5)
  - [ ] Confirm `optimizationStore.ts` already has `statSheet`, `isComputingStats`, `nodeEfficiencies` + setters — no changes needed (already implemented in Story 2.1)

- [ ] Task 6: Write tests for `buildSnapshotSerializer.ts`
  - [ ] Create `lebo/src/shared/utils/buildSnapshotSerializer.test.ts`
  - [ ] Test: full build → snapshot contains nodeAllocations, classId, masteryId, sliderPosition
  - [ ] Test: sliderPosition defaults to 50 when absent from BuildState
  - [ ] Test: gear affixes with affixId + tier are included; affixes without affixId/tier are excluded
  - [ ] Test: UI-only fields (schemaVersion, isPersisted, createdAt, name) are NOT present in snapshot
  - [ ] Test: empty build (no nodes allocated) → nodeAllocations is `{}`
  - [ ] Mock `@tauri-apps/api/core` is NOT needed (serializer is pure TypeScript, no IPC)

- [ ] Task 7: Verify builds
  - [ ] Run `pnpm build` from `lebo/` — zero TypeScript errors
  - [ ] Run `pnpm vitest` from `lebo/` — 8 pre-existing failures unchanged, no new failures
  - [ ] Run `cargo build` from `lebo/src-tauri/` — zero errors (no Rust changes in this story)

---

## Dev Notes

### Architecture Overview

This story is pure TypeScript plumbing. No Rust changes. Three pieces:

1. **`buildSnapshotSerializer.ts`** — Pure function converting `BuildState` (UI state with metadata) into `BuildSnapshot` (ID-only engine input). Pattern 1: the ONLY place this conversion happens.
2. **`useStatSheet.ts`** — React hook that subscribes to `buildStore` + `gameDataStore`, debounces via rAF, and calls `compute_stats` IPC with generation-based cancellation (Pattern 4).
3. **`App.tsx` cleanup** — Remove the old TypeScript `calculateScore` subscription blocks; hook replaces them.

---

### Pre-existing State (DO NOT re-implement)

These were completed in earlier stories — verify they exist, do not touch:

| Item | Location | Status |
|------|----------|--------|
| `StatSheet`, `NodeEfficiency` types | `shared/types/statSheet.ts` | ✅ Done (Story 2.1) |
| `optimizationStore.statSheet` field + `setStatSheet()` | `shared/stores/optimizationStore.ts` | ✅ Done (Story 2.1) |
| `optimizationStore.isComputingStats` + `setIsComputingStats()` | `shared/stores/optimizationStore.ts` | ✅ Done (Story 2.1) |
| `optimizationStore.nodeEfficiencies` + `setNodeEfficiencies()` | `shared/stores/optimizationStore.ts` | ✅ Done (Story 2.1) |
| `SCORING_ERROR` in `errors.ts` + `errorNormalizer.ts` | `shared/utils/errorNormalizer.ts` | ✅ Done (Story 2.1) |
| `compute_stats` Tauri command (Rust) | `src-tauri/src/commands/scoring_commands.rs` | ✅ Done (Story 2.4) |

---

### Task 1 — `buildSnapshotSerializer.ts` (Exact Implementation)

Create `lebo/src/shared/utils/buildSnapshotSerializer.ts`:

```typescript
import type { BuildState, GearItemV2, AffixEntryV2 } from '../types/build'
import type { GameData } from '../types/gameData'

// Pattern 2: TypeScript mirrors Rust camelCase input fields exactly.
// BuildSnapshot is the engine contract — no UI-only fields allowed.
interface AffixEntryTS {
  affixId: string
  tier: number
}

interface GearSlotSnapshotTS {
  itemId?: string
  prefixes: AffixEntryTS[]
  suffixes: AffixEntryTS[]
}

interface IdolPlacementTS {
  row: number
  col: number
  idolSize: string
  prefix?: AffixEntryTS
  suffix?: AffixEntryTS
}

export interface BuildSnapshot {
  nodeAllocations: Record<string, number>
  skillNodeAllocations: Record<string, Record<string, number>>
  characterLevel: number
  classId: string
  masteryId: string
  sliderPosition: number
  activeConditions: string[]
  gearSlots: Record<string, GearSlotSnapshotTS>
  idolPlacements: IdolPlacementTS[]
  blessings: string[]
}

// Pattern 1: ONLY conversion point from BuildState → BuildSnapshot.
// Never pass BuildState directly to invokeCommand('compute_stats', ...).
export function toBuildSnapshot(build: BuildState, _gameData: GameData): BuildSnapshot {
  return {
    nodeAllocations: { ...build.nodeAllocations },
    skillNodeAllocations: Object.fromEntries(
      Object.entries(build.skillNodeAllocations ?? {}).map(([slotId, allocs]) => [
        slotId,
        { ...allocs },
      ]),
    ),
    characterLevel: build.characterLevel,
    classId: build.classId,
    masteryId: build.masteryId,
    sliderPosition: Math.max(0, Math.min(100, build.sliderPosition ?? 50)),
    activeConditions: [],      // Epic 3 adds BuildState.activeConditions
    gearSlots: toGearSlots(build.contextData?.gear ?? []),
    idolPlacements: [],        // Epic 3 adds structured idol grid state (IdolItem has no row/col)
    blessings: [],             // Epic 3 adds BuildState.blessings
  }
}

function toGearSlots(gear: GearItemV2[]): Record<string, GearSlotSnapshotTS> {
  const slots: Record<string, GearSlotSnapshotTS> = {}
  for (const item of gear) {
    if (!item.slotId) continue
    const validAffixes = item.affixes
      .filter((a): a is AffixEntryV2 & { affixId: string; tier: number } =>
        a.affixId !== undefined && a.tier !== undefined,
      )
      .map((a): AffixEntryTS => ({ affixId: a.affixId, tier: a.tier }))
    slots[item.slotId] = {
      itemId: item.itemId,
      prefixes: validAffixes,  // no prefix/suffix distinction yet — all to prefixes
      suffixes: [],
    }
  }
  return slots
}
```

**Why `_gameData` parameter?** The parameter is declared for future use (gear affix resolution against the item DB in Epic 5) and to match the signature that callers will expect. Prefixed with `_` to satisfy `noUnusedParameters`.

---

### Task 2 — `useStatSheet.ts` (Exact Implementation)

Create `lebo/src/shared/stores/useStatSheet.ts`:

```typescript
import { useEffect, useRef } from 'react'
import { useBuildStore } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import { invokeCommand } from '../utils/invokeCommand'
import { toBuildSnapshot } from '../utils/buildSnapshotSerializer'
import type { StatSheet } from '../types/statSheet'

// Pattern 4: generation counter discards stale IPC results.
// rAF cancel-and-reschedule means only one IPC call fires per frame.
export function useStatSheet(): void {
  const generationRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    function scheduleCompute(): void {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const build = useBuildStore.getState().activeBuild
        const gameData = useGameDataStore.getState().gameData

        if (!build || !gameData) {
          useOptimizationStore.getState().setStatSheet(null)
          useOptimizationStore.getState().setIsComputingStats(false)
          return
        }

        const generation = ++generationRef.current
        useOptimizationStore.getState().setIsComputingStats(true)

        const snapshot = toBuildSnapshot(build, gameData)
        invokeCommand<StatSheet>('compute_stats', { snapshot })
          .then((result) => {
            if (generationRef.current !== generation) return  // stale — discard
            useOptimizationStore.getState().setStatSheet(result)
            useOptimizationStore.getState().setIsComputingStats(false)
          })
          .catch(() => {
            if (generationRef.current !== generation) return  // stale — discard
            useOptimizationStore.getState().setIsComputingStats(false)
          })
      })
    }

    const unsubBuild = useBuildStore.subscribe(() => scheduleCompute())
    const unsubGameData = useGameDataStore.subscribe((state, prev) => {
      if (state.gameData !== prev.gameData) scheduleCompute()
    })

    return () => {
      unsubBuild()
      unsubGameData()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])
}
```

**Critical implementation details:**
- `cancelAnimationFrame` + `requestAnimationFrame` is the rAF debounce: each new state change cancels the pending rAF and schedules a fresh one. Only the last change before the frame fires sends an IPC call.
- Generation counter is incremented inside the rAF callback (after coalescing), not on subscribe trigger. This means `isComputingStats` is set to `true` only when IPC actually fires.
- Subscribe to `useBuildStore` unconditionally (any buildStore change = recompute). Only recompute on `gameDataStore` when `gameData` object reference changes (not on `isStale` flag flips).
- Empty `deps` array `[]` is intentional — subscriptions are set up once on mount.

---

### Task 3 — `App.tsx` Changes (Exact)

**Remove** the `calculateScore` import line (around line 16):
```typescript
// DELETE this line:
import { calculateScore } from './features/optimization/scoringEngine'
```

**Add** the `useStatSheet` import (grouped with other store hooks):
```typescript
import { useStatSheet } from './shared/stores/useStatSheet'
```

**Remove** these two `useEffect` blocks entirely (lines 77–92 and 104–115 in current file):

```typescript
// DELETE THIS BLOCK (lines 77-92):
useEffect(() => {
  return useBuildStore.subscribe((state, prev) => {
    if (state.activeBuild?.nodeAllocations === prev.activeBuild?.nodeAllocations) return
    if (!state.activeBuild) {
      useOptimizationStore.getState().setScores(null)
      return
    }
    const gameData = useGameDataStore.getState().gameData
    if (!gameData) {
      useOptimizationStore.getState().setScores(null)
      return
    }
    const scores = calculateScore(state.activeBuild, gameData)
    useOptimizationStore.getState().setScores(scores)
  })
}, [])

// DELETE THIS BLOCK (lines 104-115):
// Recalculate scores when game data loads after an active build is already present.
// Without this, a saved build loaded before initGameData() resolves would show null scores
// until the user manually modifies a node allocation.
useEffect(() => {
  return useGameDataStore.subscribe((state, prev) => {
    if (!state.gameData || state.gameData === prev.gameData) return
    const { activeBuild } = useBuildStore.getState()
    if (!activeBuild) return
    const scores = calculateScore(activeBuild, state.gameData)
    useOptimizationStore.getState().setScores(scores)
  })
}, [])
```

**KEEP** the build-switch `useEffect` (lines 94–102) — it does NOT call `calculateScore`:
```typescript
// KEEP THIS BLOCK — not related to scoring:
useEffect(() => {
  return useBuildStore.subscribe((state, prev) => {
    if (state.activeBuild?.id === prev.activeBuild?.id) return
    const build = state.activeBuild
    useOptimizationStore.getState().setSliderPosition(build?.sliderPosition ?? 50)
    useOptimizationStore.getState().setFineTuneWeights(build?.fineTuneWeights ?? null)
    useOptimizationStore.getState().clearSuggestions()
  })
}, [])
```

**Add** `useStatSheet()` hook call after `useOptimizationStream()`:
```typescript
export function App() {
  useAutoSave()
  useConnectivity()
  useUpdateCheck()
  useAccessibilityAnnouncer()
  useOptimizationStream()
  useStatSheet()   // ← ADD THIS LINE
  const currentView = useAppStore((s) => s.currentView)
  // ...rest unchanged
```

---

### Task 4 — `scoringEngine.ts` Deprecation Comment

Add ONE line at the very top of `lebo/src/features/optimization/scoringEngine.ts`:
```typescript
// @deprecated — replaced by useStatSheet + compute_stats Tauri command. Deletion in follow-up story.
import type { BuildScore } from '../../shared/types/optimization'
// ...rest of file unchanged
```

**CRITICAL:** Do NOT delete `scoringEngine.ts`. `useOptimizationStream.ts` still calls `calculateScore` for computing suggestion preview deltas (`deltaDamage`, `deltaSurvivability`, `deltaSpeed` on each `SuggestionResult`). These are the legacy score fields — not yet replaced by the Rust engine.

---

### Task 6 — `buildSnapshotSerializer.test.ts` (Key Test Cases)

Create `lebo/src/shared/utils/buildSnapshotSerializer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toBuildSnapshot } from './buildSnapshotSerializer'
import type { BuildState } from '../types/build'
import type { GameData } from '../types/gameData'

// Minimal stubs — serializer is pure TS, no mocking needed
const minimalGameData = {} as GameData

function makeBuild(overrides: Partial<BuildState> = {}): BuildState {
  return {
    schemaVersion: 2,
    id: 'test-id',
    name: 'Test Build',
    classId: 'sentinel',
    masteryId: 'void-knight',
    characterLevel: 50,
    budgetEnforced: true,
    nodeAllocations: { 'node-1': 2, 'node-2': 1 },
    skillNodeAllocations: { 'slot-0': { 'skill-node-a': 1 } },
    activeSkillLevels: { 'slot-0': 15 },
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    sliderPosition: 70,
    isPersisted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

describe('toBuildSnapshot', () => {
  it('maps core identity and allocation fields', () => {
    const snapshot = toBuildSnapshot(makeBuild(), minimalGameData)
    expect(snapshot.classId).toBe('sentinel')
    expect(snapshot.masteryId).toBe('void-knight')
    expect(snapshot.characterLevel).toBe(50)
    expect(snapshot.nodeAllocations).toEqual({ 'node-1': 2, 'node-2': 1 })
    expect(snapshot.skillNodeAllocations).toEqual({ 'slot-0': { 'skill-node-a': 1 } })
  })

  it('uses sliderPosition from build, defaulting to 50 when absent', () => {
    expect(toBuildSnapshot(makeBuild({ sliderPosition: 80 }), minimalGameData).sliderPosition).toBe(80)
    expect(toBuildSnapshot(makeBuild({ sliderPosition: undefined }), minimalGameData).sliderPosition).toBe(50)
  })

  it('clamps sliderPosition to 0-100', () => {
    expect(toBuildSnapshot(makeBuild({ sliderPosition: 150 }), minimalGameData).sliderPosition).toBe(100)
    expect(toBuildSnapshot(makeBuild({ sliderPosition: -10 }), minimalGameData).sliderPosition).toBe(0)
  })

  it('excludes UI-only BuildState fields', () => {
    const snapshot = toBuildSnapshot(makeBuild(), minimalGameData) as Record<string, unknown>
    expect(snapshot['schemaVersion']).toBeUndefined()
    expect(snapshot['name']).toBeUndefined()
    expect(snapshot['isPersisted']).toBeUndefined()
    expect(snapshot['createdAt']).toBeUndefined()
    expect(snapshot['id']).toBeUndefined()
  })

  it('includes gear affixes with both affixId and tier; excludes incomplete entries', () => {
    const build = makeBuild({
      contextData: {
        gear: [
          {
            slotId: 'helm',
            itemName: 'Test Helm',
            affixes: [
              { name: 'Fire Res', affixId: 'fire-res', tier: 3 },
              { name: 'No ID affix', tier: 2 },          // missing affixId — excluded
              { name: 'No tier affix', affixId: 'x' },   // missing tier — excluded
            ],
          },
        ],
        skills: [],
        idols: [],
      },
    })
    const snapshot = toBuildSnapshot(build, minimalGameData)
    expect(snapshot.gearSlots['helm']?.prefixes).toEqual([{ affixId: 'fire-res', tier: 3 }])
    expect(snapshot.gearSlots['helm']?.suffixes).toEqual([])
  })

  it('returns empty collections for epic-3 fields not yet in BuildState', () => {
    const snapshot = toBuildSnapshot(makeBuild(), minimalGameData)
    expect(snapshot.activeConditions).toEqual([])
    expect(snapshot.idolPlacements).toEqual([])
    expect(snapshot.blessings).toEqual([])
  })
})
```

---

### Critical Architecture Patterns — Must Not Violate

| Pattern | Rule |
|---------|------|
| Pattern 1 | `toBuildSnapshot()` is the ONLY conversion from `BuildState → BuildSnapshot`. No caller passes `BuildState` directly to `invokeCommand('compute_stats', ...)` |
| Pattern 2 | `BuildSnapshot` TS interface uses camelCase (mirrors Rust `#[serde(rename_all = "camelCase")]` input). `StatSheet` TS uses snake_case (mirrors Rust default output). |
| Pattern 4 | `generationRef` must be incremented before the `invokeCommand` call (inside rAF), not in the subscribe trigger. Ensures stale results from slow prior calls are discarded. |
| No raw invoke() | Always `invokeCommand<StatSheet>('compute_stats', { snapshot })` — never `invoke()` directly |
| Four stores only | `useStatSheet` writes to `optimizationStore` — never creates a new store |
| No barrel files | No `index.ts` anywhere in `src/` |

---

### What This Story Does NOT Do

- ❌ Do NOT render the stat sheet UI — that is Story 2.6
- ❌ Do NOT delete `scoringEngine.ts` — add deprecation comment only; it is still used by `useOptimizationStream.ts`
- ❌ Do NOT remove `scores: BuildScore | null` from `optimizationStore` — deprecated field stays until follow-up story
- ❌ Do NOT add `blessings`, `activeConditions`, or `idolPlacements` to `BuildState` — Epic 3 stories do that
- ❌ Do NOT wire `nodeEfficiencies` to the tree canvas — that is Story 4.4
- ❌ Do NOT add Rust changes — pure TypeScript story
- ❌ Do NOT remove the build-switch `useEffect` in App.tsx (lines 94–102) — it is NOT a `calculateScore` block

---

### Key File Interactions

**`calculateScore` (scoringEngine.ts) is still used in `useOptimizationStream.ts`:**
- Lines 113, 128: `calculateScore(activeBuild, gameData)` computes `baselineScore` and `previewScore` for each `SuggestionResult`
- These drive `deltaDamage`, `deltaSurvivability`, `deltaSpeed` on suggestion cards
- Do NOT touch `useOptimizationStream.ts` in this story

**`useGameDataStore` contains more than just `gameData`:**
- Has `isStale`, `isItemDataStale`, idol/blessings staleness flags, etc.
- Only subscribe to actual `gameData` object reference change, not all store changes

**App.tsx still imports `useGameDataStore` for the startup `subscribe`:**
- After removing the `calculateScore` blocks, `useGameDataStore` import stays (used in startup `useEffect`)
- But the `import { calculateScore }` line from `scoringEngine` is fully removed

---

### Known Pre-existing Test Failures

8 frontend test failures remain from stories 1.1/1.2: `SkillTreeCanvas` ×1, `ProviderSelector` ×5, `Settings` ×1, `TreeControls` ×1 — all pre-existing. Do not fix them. After this story, test count should remain 8 pre-existing failures + 0 new.

---

### Build Verification Sequence

Run in this exact order:
1. `pnpm build` from `lebo/` — validates zero TypeScript errors (strict mode catches unused imports/params)
2. `pnpm vitest` from `lebo/` — 8 pre-existing failures, no new failures, new serializer tests pass
3. `cargo build` from `lebo/src-tauri/` — confirms no accidental Rust changes (should be unchanged)

---

### New Files

- `lebo/src/shared/utils/buildSnapshotSerializer.ts` — NEW
- `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` — NEW
- `lebo/src/shared/stores/useStatSheet.ts` — NEW

### Modified Files

- `lebo/src/App.tsx` — remove 2 calculateScore subscribe blocks, add `useStatSheet()` call, remove `calculateScore` import
- `lebo/src/features/optimization/scoringEngine.ts` — add deprecation comment at top only

---

### References

- [Source: epics.md § Story 2.5 — TypeScript Integration Serializer Hook and Store]
- [Source: epics.md § Additional Requirements — IPC Strategy (D2)]
- [Source: epics.md § Additional Requirements — Critical Patterns (Pattern 1, 2, 4)]
- [Source: epics.md § Additional Requirements — Store Placement (D1)]
- [Source: epics.md § Additional Requirements — Deprecation]
- [Source: architecture.md § D2 — Debounce Hook Location]
- [Source: architecture.md § Pattern 1 — BuildSnapshot Serialization Boundary]
- [Source: architecture.md § Pattern 2 — Serde Field Naming Direction]
- [Source: architecture.md § Pattern 4 — useStatSheet Generation-Based Cancellation]
- [Source: architecture.md § D1 — StatSheet Store Placement]
- [Source: project-context.md § Critical Don't-Miss Rules — no raw invoke(), four stores only, no barrel files]
- [Source: project-context.md § Critical Don't-Miss Rules — noUnusedLocals/noUnusedParameters strict mode]
- [Source: story 2.1 Completion Notes — statSheet/isComputingStats/nodeEfficiencies already in optimizationStore]
- [Source: story 2.4 Completion Notes — compute_stats Tauri command done, pure Rust plumbing complete]
- [Source: lebo/src/App.tsx — exact lines to remove (77-92, 104-115); line to keep (94-102)]
- [Source: lebo/src/shared/stores/optimizationStore.ts — statSheet/isComputingStats/nodeEfficiencies already present]
- [Source: lebo/src/shared/types/statSheet.ts — StatSheet interface with snake_case fields (Pattern 2)]
- [Source: lebo/src/shared/types/build.ts — BuildState shape, contextData.gear as GearItemV2[]]
- [Source: lebo/src-tauri/scoring-core/src/build_snapshot.rs — Rust BuildSnapshot camelCase contract]
- [Source: lebo/src/shared/stores/useOptimizationStream.ts — still uses calculateScore for suggestion deltas — do not remove]
- [Source: deferred-work.md 2-3 — no_sustain_layer gap:0.0 deferred to Story 2.5 rendering; not a serializer concern]
