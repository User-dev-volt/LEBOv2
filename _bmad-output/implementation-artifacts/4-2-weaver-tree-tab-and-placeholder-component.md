# Story 4.2: Weaver Tree Tab and Placeholder Component

Status: done

## Story

As a theory-crafter,
I want the Weaver Tree tab to always be visible in the skill tree tab bar, showing a clear placeholder message if the tree data is not yet available,
so that the UI layout is consistent and I understand the feature's status.

## Acceptance Criteria

1. **Given** the center panel tab bar renders tabs
   **When** the tab bar is displayed
   **Then** a "Weaver Tree" tab appears as the rightmost tab regardless of whether Weaver Tree data is available; its presence does not depend on the research spike outcome

2. **Given** `useGameDataStore.weaverTreeData` is null (spike result was NO-GO — always null for now)
   **When** the player clicks the Weaver Tree tab
   **Then** the center panel renders `WeaverTreePlaceholder` with the text "Weaver Tree planning is in research. Node data is not available from community sources." in `--color-text-secondary`; no error, no crash, no loading spinner

3. **Given** `useGameDataStore.weaverTreeData` is non-null (future Story 4.3 path — wire the gate now)
   **When** the player clicks the Weaver Tree tab
   **Then** the placeholder is replaced by the SkillTreeCanvas rendering the Weaver Tree (Story 4.3 branch — the conditional check must exist in code even though Story 4.3 is deferred)

4. **And** `WeaverTreePlaceholder` is at `src/features/weaver-tree/WeaverTreePlaceholder.tsx` with no barrel file

5. **And** `WeaverTreePlaceholder` passes vitest-axe with zero violations (UX-DR15)

6. **And** the Weaver Tree tab does NOT trigger `onSkillTabClick` — it is a standalone tab, not a skill slot tab

7. **And** clicking the Weaver Tree tab resets the search query and selected node (same behavior as switching any tab)

## Tasks / Subtasks

- [x] Task 1: Add `weaverTreeData` to `gameDataStore.ts` (AC: #2, #3)
  - [x] In `src/shared/stores/gameDataStore.ts`, add import at top (line 2 after current imports):
    ```typescript
    import type { TreeData } from '../types/treeData'
    ```
  - [x] Add to `GameDataStore` interface (after `setIsUpdating: ...`):
    ```typescript
    weaverTreeData: TreeData | null
    setWeaverTreeData: (data: TreeData | null) => void
    ```
  - [x] Add to initial state in `create<GameDataStore>()((set) => ({` (after `isUpdating: false`):
    ```typescript
    weaverTreeData: null,
    ```
  - [x] Add to the implementation (after `setIsUpdating: (updating) => set({ isUpdating: updating })`):
    ```typescript
    setWeaverTreeData: (data) => set({ weaverTreeData: data }),
    ```

- [x] Task 2: Create `WeaverTreePlaceholder.tsx` (AC: #2, #4, #5)
  - [x] Create `src/features/weaver-tree/WeaverTreePlaceholder.tsx`
  - [x] Do NOT create an `index.ts` barrel file in `src/features/weaver-tree/`

- [x] Task 3: Create `WeaverTreePlaceholder.test.tsx` (AC: #5)
  - [x] Create `src/features/weaver-tree/WeaverTreePlaceholder.test.tsx` with render, role/aria, and axe tests

- [x] Task 4: Add Weaver Tree tab to `SkillTreeTabBar.tsx` (AC: #1, #6)
  - [x] Append `{ id: '__weaver__', label: 'Weaver Tree' }` to `tabs` array
  - [x] Change `const isSkillTab = i >= 1` to `const isSkillTab = i >= 1 && i <= 5`

- [x] Task 5: Update `SkillTreeTabBar.test.tsx` for 7 tabs (AC: #1, #6)
  - [x] Updated first test name and length to 7; added Weaver Tree assertion
  - [x] Updated second test length to 7
  - [x] Added Weaver Tree rightmost tab test
  - [x] Added onSkillTabClick not called for Weaver tab test

- [x] Task 6: Wire the Weaver tab into `SkillTreeView.tsx` (AC: #1, #2, #3, #6, #7)
  - [x] Add `weaverTreeData` selector near the top of `SkillTreeView` (line ~64, after the `isLoading` selector):
    ```typescript
    const weaverTreeData = useGameDataStore((s) => s.weaverTreeData)
    ```
  - [x] Add `WeaverTreePlaceholder` import at the top (near other feature imports):
    ```typescript
    import { WeaverTreePlaceholder } from '../weaver-tree/WeaverTreePlaceholder'
    ```
  - [x] Fix the `safeTabIndex` guard (currently line ~159): change `activeTabIndex > 5` to `activeTabIndex > 6`:
    ```typescript
    const safeTabIndex = activeTabIndex > 6 ? 0 : activeTabIndex
    ```
  - [x] Fix the `useEffect` guard (currently line ~99): change `if (activeTabIndex > 5)` to `if (activeTabIndex > 6)`:
    ```typescript
    useEffect(() => {
      if (activeTabIndex > 6) {
        setActiveTabIndex(0)
      }
    }, [activeTabIndex])
    ```
  - [x] Add `isWeaverTab` derived value immediately after `isPassiveTab` (line ~160):
    ```typescript
    const isWeaverTab = safeTabIndex === 6
    ```
  - [x] Fix `slotId` to handle Weaver tab (line ~162): change from:
    ```typescript
    const slotId = isPassiveTab ? null : `slot-${safeTabIndex - 1}`
    ```
    to:
    ```typescript
    const slotId = isPassiveTab || isWeaverTab ? null : `slot-${safeTabIndex - 1}`
    ```
  - [x] Fix `isPickerFullPanel` to exclude Weaver tab (line ~375):
    ```typescript
    const isPickerFullPanel =
      !isPassiveTab &&
      !isWeaverTab &&
      pickerState !== null &&
      !pickerState.isPopover &&
      pickerState.slotIndex === safeTabIndex - 1
    ```
  - [x] Add Weaver tab early return **after the `isLoading` return** and **before** the passive tab early return:
    ```typescript
    if (isWeaverTab) {
      return (
        <div id="skill-tree-canvas" className="flex flex-col h-full">
          <SkillTreeTabBar
            activeSkills={activeSkills}
            selectedIndex={safeTabIndex}
            onChange={handleTabChange}
            onSkillTabClick={handleSkillTabClick}
          />
          <div className="flex-1 min-h-0">
            {weaverTreeData !== null ? (
              // Story 4.3 will replace this branch with SkillTreeCanvas when spike is GO
              <WeaverTreePlaceholder />
            ) : (
              <WeaverTreePlaceholder />
            )}
          </div>
        </div>
      )
    }
    ```
  - [x] Fix the second early return to exclude Weaver tab (currently `if (!isPassiveTab && ...)`):
    ```typescript
    if (!isPassiveTab && !isWeaverTab && (!selectedClassId || !selectedMasteryId || !gameData || !classData)) {
    ```

## Dev Notes

### Story 4.1 Spike Outcome — CRITICAL CONTEXT

Story 4.1 verdict: **NO-GO for Story 4.3.** The `weaverTreeData` field will be `null` indefinitely in production. `WeaverTreePlaceholder` will always render for this tab.

**Why the `weaverTreeData !== null` branch must still exist in the code:** Architecture Decision 7 in `_bmad-output/planning-artifacts/architecture.md` specifies the tab rendering switches on `useGameDataStore.weaverTreeData !== null`. The conditional must be present so Story 4.3 can be wired in without structural refactoring if the data situation changes. This is NOT dead code — it is a declared gate for future work.

**Placeholder text:** The original ACs say "Weaver Tree planning is in research. Data sourcing is in progress." — updated to "Weaver Tree planning is in research. Node data is not available from community sources." to accurately reflect the spike finding (community sources don't expose the node graph). The spike report at `docs/weaver-tree-spike.md` Section 6 confirms this text guidance.

### Integration Architecture — DO NOT REINVENT

`SkillTreeTabBar` uses Headless UI `TabGroup`/`TabList`/`Tab`. Indices are:
- 0 = Passive Tree
- 1–5 = Skill slots 0–4 (`slot-0` through `slot-4`)
- 6 = Weaver Tree (NEW)

`SkillTreeView` maps `activeTabIndex` → behavior. All 7 paths after this change:
- `safeTabIndex = 0` → `isPassiveTab = true`
- `safeTabIndex = 1-5` → `isPassiveTab = false, isWeaverTab = false` → skill slot tabs
- `safeTabIndex = 6` → `isWeaverTab = true` → early return with placeholder

### Files to Create (New)

- `src/features/weaver-tree/WeaverTreePlaceholder.tsx`
- `src/features/weaver-tree/WeaverTreePlaceholder.test.tsx`

### Files to Modify (Existing)

| File | What Changes |
|------|-------------|
| `src/shared/stores/gameDataStore.ts` | Add `weaverTreeData: TreeData \| null` + setter |
| `src/features/skill-tree/SkillTreeTabBar.tsx` | Append Weaver tab to `tabs` array; fix `isSkillTab` to `i >= 1 && i <= 5` |
| `src/features/skill-tree/SkillTreeTabBar.test.tsx` | Update tab count 6→7; add Weaver tab tests |
| `src/features/skill-tree/SkillTreeView.tsx` | Add `weaverTreeData` selector; add `isWeaverTab`; fix guards; add early return |

### Critical Lines in `SkillTreeView.tsx` to Touch

These are the exact locations — do NOT make unrelated changes to this file:

1. **Line ~64** — store selectors block: add `weaverTreeData` after `isLoading`
2. **Line ~99** — `useEffect` with `activeTabIndex > 5`: change to `> 6`
3. **Line ~159** — `safeTabIndex` computation: change `> 5` to `> 6`
4. **Line ~160** — add `const isWeaverTab = safeTabIndex === 6` immediately after `isPassiveTab`
5. **Line ~162** — `slotId` computation: add `|| isWeaverTab` to the null guard
6. **Line ~310** — passive tab early return: untouched
7. **Line ~325** — ADD the Weaver tab early return here (between the two existing early returns)
8. **Line ~339** — skill tab early return: add `&& !isWeaverTab` to the condition
9. **Line ~375** — `isPickerFullPanel`: add `&& !isWeaverTab`

### Do NOT Touch

- `SkillTreeView.tsx` rendering logic inside the final JSX `return` for passive/skill tab content — no changes there
- `pixiRenderer.ts` — Weaver rendering is Story 4.3 (deferred)
- `buildStore.ts` — `weaverAllocations` is Story 4.3 (deferred)
- `treeDataTransformer.ts` — no Weaver layout needed for placeholder

### Hooks Order — Why Early Return Is Safe

All `useMemo` and `useCallback` hooks in `SkillTreeView` are defined BEFORE the early returns. The Weaver early return fires after all hooks complete, so React's rules of hooks are not violated. When `isWeaverTab = true`:
- `treeData` will be `null` (no class data dependencies matter)
- `slotId` will be `null`
- `skillTreeData` will be `null`
- `passiveInteraction` / `skillInteraction` both handle `null` treeData gracefully
- The early return prevents all this null state from reaching JSX that expects non-null data

### Accessibility Requirements

`WeaverTreePlaceholder` is a static informational component. vitest-axe compliance requirements:
- `role="region"` with `aria-label="Weaver Tree"` (landmark region)
- Text content rendered as `<p>` (not `<div>` — screen readers handle `<p>` better for prose)
- No interactive elements → no focus management needed
- `--color-text-secondary` contrast against `--color-bg-base` already meets WCAG AA per existing token system

### Project Structure Notes

- Feature folder: `src/features/weaver-tree/` (new, no barrel file)
- Component naming: `WeaverTreePlaceholder.tsx` — PascalCase component in kebab-case folder
- Test co-location: `WeaverTreePlaceholder.test.tsx` beside `WeaverTreePlaceholder.tsx`
- No `index.ts` in `weaver-tree/` — all imports must be direct (e.g., `import { WeaverTreePlaceholder } from '../weaver-tree/WeaverTreePlaceholder'`)

### Project Context Rules

From `_bmad-output/project-context.md` (critical rules for this story):

- **No barrel files** — never create `index.ts` in any `src/features/*` folder
- **TypeScript strict mode** — `noUnusedLocals: true`; if you add `weaverTreeData` to the selector but don't use it in the early return, TypeScript will reject it. Use it.
- **Four stores only** — `weaverTreeData` extends `useGameDataStore`, NOT a new store
- **Named exports only** — `WeaverTreePlaceholder` is a named export, not default
- **No barrel files** — mentioned twice because it's the most common mistake
- **Tailwind v4 / no @apply** — use inline `style={{ color: 'var(--color-text-secondary)' }}` for color tokens or Tailwind class names that map to them; do not use `@apply`
- **vitest-axe** — `import { axe } from 'vitest-axe'` then `expect(await axe(container)).toHaveNoViolations()`; `toHaveNoViolations` matcher is set up in `test-setup.ts` — do not re-declare it

### Previous Story Intelligence (Story 4.1)

Story 4.1 produced only `docs/weaver-tree-spike.md`. No TypeScript was written. Therefore:
- No existing pattern to follow for `weaver-tree/` folder
- No previous Weaver-related imports exist to be aware of
- The `weaverTreeData` field in `gameDataStore` does not yet exist — add it fresh

**Spike report key finding for placeholder text:** "No machine-readable Weaver Tree node data (IDs, positions, edge graph) found in any community source." — the placeholder text reflects this precisely.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4: Story 4.2 ACs, UX-DR14, UX-DR15]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Decision 7: Weaver Tree Renderer (Spike-Gated), Architecture boundary: `weaverTreeData: TreeData | null` in `GameDataStore`]
- [Source: `_bmad-output/implementation-artifacts/4-1-weaver-tree-research-spike.md` — Completion Notes: NO-GO verdict, placeholder text guidance]
- [Source: `_bmad-output/project-context.md` — No barrel files, four-store constraint, named exports, vitest-axe setup]
- [Source: `lebo/src/features/skill-tree/SkillTreeTabBar.tsx` — Current tab structure: 6 tabs (passive + 5 slots)]
- [Source: `lebo/src/features/skill-tree/SkillTreeView.tsx` — `activeTabIndex > 5` guards (lines ~99, ~159), `slotId` computation (~162), `isPickerFullPanel` (~375), early return positions]
- [Source: `lebo/src/shared/stores/gameDataStore.ts` — Existing store interface to extend]
- [Source: `lebo/src/shared/types/treeData.ts` — `TreeData` interface: `{ nodes: TreeNode[], edges: TreeEdge[] }`]

### Review Findings

- [x] [Review][Patch] `isLoading` early return fires before `isWeaverTab` — AC2 violation: loading spinner displays on Weaver tab while game data loads [`lebo/src/features/skill-tree/SkillTreeView.tsx:313`]
- [x] [Review][Patch] Fragile test uses raw index `tabs[6].textContent` instead of accessible role query [`lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx:65`]
- [x] [Review][Defer] Magic hardcoded indices (6, 7) across `SkillTreeView.tsx` and tests — pre-existing pattern, not causing bugs [`lebo/src/features/skill-tree/SkillTreeView.tsx:101,161,163`] — deferred, pre-existing
- [x] [Review][Defer] `openPickerForCurrentSlot` latent bug: `safeTabIndex - 1` yields slot 5 (out-of-range) if Weaver early return is removed — currently unreachable [`lebo/src/features/skill-tree/SkillTreeView.tsx:~289`] — deferred, pre-existing
- [x] [Review][Defer] Redundant double-guard: `useEffect` at line 99 resets `activeTabIndex > 6` redundantly with inline clamp at line 161 — pre-existing defensive pattern [`lebo/src/features/skill-tree/SkillTreeView.tsx:99-103,161`] — deferred, pre-existing
- [x] [Review][Defer] `handleReset` has no explicit Weaver guard but is implicitly safe because `TreeControls` never renders on Weaver tab — fragile implicit dependency [`lebo/src/features/skill-tree/SkillTreeView.tsx:~254`] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded without blockers.

### Completion Notes List

- Added `weaverTreeData: TreeData | null` and `setWeaverTreeData` to `gameDataStore.ts`; the field is always `null` per the 4.1 spike NO-GO verdict
- Created `WeaverTreePlaceholder.tsx` as a named export in `src/features/weaver-tree/` (no barrel file); renders `role="region"` landmark with inline color token per Tailwind v4 rules
- All 3 `WeaverTreePlaceholder` tests pass including vitest-axe accessibility check (AC #5 / UX-DR15)
- `SkillTreeTabBar`: appended `__weaver__` tab as index 6; tightened `isSkillTab` to `i >= 1 && i <= 5` so the Weaver tab never fires `onSkillTabClick` (AC #6)
- `SkillTreeView`: added `weaverTreeData` selector, `isWeaverTab` derived value, fixed `> 5` guards to `> 6`, added Weaver early return with `weaverTreeData !== null` gate (AC #3 — conditional exists for Story 4.3), updated `slotId` null guard, `isPickerFullPanel`, and skill tab early return condition
- Pre-existing `ProviderSelector.test.tsx` failures (6 tests) confirmed unrelated to this story — present before any changes

### File List

- `lebo/src/shared/stores/gameDataStore.ts` (modified)
- `lebo/src/features/weaver-tree/WeaverTreePlaceholder.tsx` (created)
- `lebo/src/features/weaver-tree/WeaverTreePlaceholder.test.tsx` (created)
- `lebo/src/features/skill-tree/SkillTreeTabBar.tsx` (modified)
- `lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx` (modified)
- `lebo/src/features/skill-tree/SkillTreeView.tsx` (modified)
