# Story 2.3: New Build Creator — Class & Mastery Selector

Status: done

## Story

As an advanced Last Epoch player,
I want to create a blank build by selecting my class and mastery,
So that I can theory-craft a new character from scratch without needing an existing build code.

## Acceptance Criteria

1. **Given** the user clicks "Create New Build" from the empty state CTAs
   **When** the left panel is collapsed
   **Then** the left panel expands so the ClassMasterySelector is accessible

2. **Given** the app is in the empty state (no class/mastery selected)
   **When** the user views the left panel
   **Then** all 5 classes are displayed as selectable options: Sentinel, Mage, Primalist, Acolyte, Rogue

3. **Given** the user selects a class
   **When** the class is selected
   **Then** the 3 masteries for that class are displayed as selectable options

4. **Given** the user selects a mastery
   **When** the mastery is selected
   **Then** a blank passive tree for the selected mastery renders with all nodes in unallocated state
   **And** a new `BuildState` is created in `useBuildStore.activeBuild`: `{ schemaVersion: 1, id: crypto.randomUUID(), name: '[MasteryName]', classId, masteryId, nodeAllocations: {}, contextData: { gear: [], skills: [], idols: [] }, isPersisted: false, createdAt, updatedAt }`
   **And** the user can immediately begin clicking nodes to allocate skill points

5. **Given** the user is mid-selection and changes their mind
   **When** the user selects a different class
   **Then** masteryId is cleared, activeBuild is cleared, and the tree returns to empty state
   **And** the user can select a new class and mastery without any error state

## Tasks / Subtasks

- [x] Task 1: Add `createBuild` action to `buildStore` and clear `activeBuild` on class change (AC: 4, 5)
  - [x] Add `createBuild: (masteryName: string) => void` — creates `activeBuild` from `selectedClassId` + `selectedMasteryId`
  - [x] Modify `setSelectedClass` to also clear `activeBuild` when class changes

- [x] Task 2: Wire mastery selection → `createBuild` in `ClassMasterySelector.tsx` (AC: 4)
  - [x] In mastery `Listbox` `onChange`, after `setSelectedMastery(id)`, call `createBuild(mastery.masteryName)`
  - [x] Resolve mastery name from `selectedClass.masteries[id]?.masteryName`

- [x] Task 3: Wire "Create New Build" button in `EmptyTreeState.tsx` (AC: 1)
  - [x] Import `useAppStore` and call `setPanelState('left', 'expanded')` on click

- [x] Task 4: Write tests (AC: 1–5)
  - [x] `buildStore.test.ts`: 4 new tests (`createBuild` creates correct `BuildState`, `createBuild` no-op without mastery, `setSelectedClass` clears `activeBuild`, `setSelectedClass` clears `undoStack`)
  - [x] `ClassMasterySelector.test.tsx`: new file — 5 tests (null gameData, class listbox renders, class selection shows masteries, mastery selection creates activeBuild, class change clears activeBuild)
  - [x] `EmptyTreeState.test.tsx`: new file — 3 tests (renders CTAs, "Create New Build" expands panel, idempotent when already expanded)
  - [x] `test-setup.ts`: added `ResizeObserver` mock for Headless UI Listbox in jsdom

- [x] Task 5: Validate (AC: 1–5)
  - [x] `pnpm tsc --noEmit` → zero errors
  - [x] `pnpm vitest run` → 138/138 tests pass (18 files, 11 new tests across 3 files)

## Dev Notes

### What Already Exists

- `ClassMasterySelector.tsx` — Headless UI Listbox for class + mastery, already in `LeftPanel`
- `buildStore.ts` — `selectedClassId`, `selectedMasteryId`, `setSelectedClass`, `setSelectedMastery`, `setActiveBuild`
- `SkillTreeView.tsx` — tree renders when `selectedClassId` + `selectedMasteryId` are both set (treeData becomes non-null); `allocatedNodes` falls back to `EMPTY_ALLOCATED` when `activeBuild` is null — so blank tree already renders on mastery selection
- `EmptyTreeState.tsx` — "Create New Build" button exists with `onClick={() => {}}`
- `appStore.ts` — `setPanelState('left', 'expanded')` expands the left panel

### What's Missing

1. **`createBuild` action** — currently `activeBuild` is created lazily on first node click (inside `applyNodeChange`). Story 2.3 requires explicit creation on mastery selection.
2. **Class change → clear activeBuild** — `setSelectedClass` currently only clears `masteryId`. Story 2.3 requires clearing `activeBuild` too (class change = new build intent).
3. **"Create New Build" wiring** — `EmptyTreeState` button is inert. Needs to expand left panel.

### `createBuild` Implementation

```ts
createBuild: (masteryName) => {
  const { selectedClassId, selectedMasteryId } = get()
  if (!selectedClassId || !selectedMasteryId) return
  const now = new Date().toISOString()
  set({
    activeBuild: {
      schemaVersion: 1,
      id: crypto.randomUUID(),
      name: masteryName,
      classId: selectedClassId,
      masteryId: selectedMasteryId,
      nodeAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: false,
      createdAt: now,
      updatedAt: now,
    },
    undoStack: [],
  })
}
```

Note: `undoStack` is reset on new build creation to avoid stale undo history.

### `setSelectedClass` Modification

```ts
setSelectedClass: (classId) => set({ selectedClassId: classId, selectedMasteryId: null, activeBuild: null, undoStack: [] }),
```

Clear `activeBuild` and `undoStack` on class change.

### ClassMasterySelector Mastery onChange

```ts
onChange={(id: string) => {
  setSelectedMastery(id)
  const masteryName = selectedClass?.masteries[id]?.masteryName ?? id
  createBuild(masteryName)
}}
```

Note: `setSelectedMastery` runs first (synchronous Zustand set), then `createBuild` reads the updated `selectedMasteryId` via `get()`.

### Previous Story Learnings

- No `index.ts` barrel files — import directly
- Tailwind v4 CSS-first — use `var(--color-*)` tokens
- `EMPTY_*` constants at module level for stable references
- All Tauri calls go through `invokeCommand` — not relevant here (no Tauri calls in this story)
- `crypto.randomUUID()` is available in browser context (no import needed)

### References

- `lebo/src/shared/stores/buildStore.ts` — modify
- `lebo/src/features/skill-tree/ClassMasterySelector.tsx` — modify
- `lebo/src/features/skill-tree/EmptyTreeState.tsx` — modify
- `lebo/src/shared/stores/buildStore.test.ts` — modify
- `lebo/src/features/skill-tree/ClassMasterySelector.test.tsx` — new
- `lebo/src/features/skill-tree/EmptyTreeState.test.tsx` — new

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- All 5 tasks complete. `pnpm tsc --noEmit` → zero errors. `pnpm vitest run` → 138/138 tests pass (18 files, 11 new tests across 3 files).
- `buildStore.createBuild(masteryName)` creates a fresh `BuildState` from the current `selectedClassId`/`selectedMasteryId`, resets `undoStack`, and sets `activeBuild`. No-op when either is unset.
- `setSelectedClass` now clears `activeBuild` and `undoStack` on class change — class switch = new build intent.
- `ClassMasterySelector` mastery `onChange` calls `setSelectedMastery` then `createBuild(masteryName)`. Zustand `set()` is synchronous so `createBuild`'s `get()` sees the updated `selectedMasteryId`.
- `EmptyTreeState` "Create New Build" now calls `setPanelState('left', 'expanded')` via `useAppStore`. Idempotent when already expanded.
- `ResizeObserver` stub added to `test-setup.ts` — Headless UI Listbox requires it in jsdom after selection closes the dropdown. Previously caused 6 unhandled errors (tests still passed, but noisily).

### File List

**New files:**
- `lebo/src/features/skill-tree/ClassMasterySelector.test.tsx`
- `lebo/src/features/skill-tree/EmptyTreeState.test.tsx`

**Modified files:**
- `lebo/src/shared/stores/buildStore.ts`
- `lebo/src/shared/stores/buildStore.test.ts`
- `lebo/src/features/skill-tree/ClassMasterySelector.tsx`
- `lebo/src/features/skill-tree/EmptyTreeState.tsx`
- `lebo/src/test-setup.ts`

### Review Findings

- [x] [Review][Patch] Re-selecting the same mastery creates a new UUID and wipes existing allocations [`buildStore.ts:41-60`] — `createBuild` always calls `crypto.randomUUID()` with no guard. If the user opens the mastery dropdown and clicks the already-selected mastery, `ClassMasterySelector.tsx:88-91` fires onChange, calling `setSelectedMastery` + `createBuild`, which resets `activeBuild` with a new id and empty `nodeAllocations`, silently destroying any allocated points. Fix: add early return in `createBuild` when `activeBuild?.classId === selectedClassId && activeBuild?.masteryId === selectedMasteryId`.
- [x] [Review][Defer] Lazy `applyNodeChange` build-creation path uses raw `selectedMasteryId` string as name [`buildStore.ts:74`] — pre-existing fallback path; inconsistent with `createBuild` which uses the human-readable mastery name. The lazy path cannot fire in normal UI flow now that `createBuild` is called on every mastery selection, but the inconsistency remains. Remove or unify the lazy path in a future cleanup. — deferred, pre-existing
- [x] [Review][Defer] `ApplyNodeResult` return type: `success: false` with no `error` field is valid per type but callers must handle it [`build.ts`] — pre-existing loose typing; no change needed now. — deferred, pre-existing
- [x] [Review][Defer] No integration test for the full select-mastery → click-node user flow — unit tests cover `createBuild` and `applyNodeChange` independently but there is no test that selects a mastery then immediately allocates a node in a single sequence. Acceptable for now; better addressed in E2E tests. — deferred, pre-existing

## Change Log

| Date | Change |
|------|--------|
| 2026-04-23 | Story created. Pivoted from Story 2.1 (deferred) — 2.3 is the primary build creation path for MVP. Status → in-progress. |
| 2026-04-23 | All 5 tasks implemented. 138/138 tests pass (11 new tests across 3 files). Status → review. |
