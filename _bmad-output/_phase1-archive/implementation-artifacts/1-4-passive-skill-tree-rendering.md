# Story 1.4: Passive Skill Tree Rendering

Status: done

## Story

As an advanced Last Epoch player,
I want to select a class and mastery and immediately see their full passive skill tree rendered in the canvas,
So that I can visually explore all available nodes and their connections before building.

## Acceptance Criteria

1. **Given** game data is loaded and the user selects a class and mastery via the left panel selector
   **When** the mastery selection is confirmed
   **Then** the full passive skill tree renders in the center canvas within ≤ 5 seconds
   **And** all nodes appear at their correct relative positions with connection edges drawn between them

2. **Given** a passive skill tree is rendered
   **When** the user inspects any node visually
   **Then** each node's state is communicated using shape + fill + color (NFR17 — never color alone):
   - Allocated: gold filled circle
   - Available (allocatable): blue-grey ring
   - Locked (prerequisite not met): dark background with X-pattern fill
   - AI-suggested: purple ring + glow (wired up in Epic 3)

3. **Given** the class/mastery selector in the left panel
   **When** the user opens the class selector
   **Then** all 5 classes are listed: Sentinel, Mage, Primalist, Acolyte, Rogue
   **And** selecting a class reveals that class's 3 mastery options
   **And** selecting a mastery triggers tree rendering for that mastery's passive tree

4. **Given** no build has been loaded or created yet
   **When** the app first opens
   **Then** the empty tree state appears in the center canvas: low-opacity class art background with centered CTA "Import a build or start fresh" and two buttons: "Paste Build Code" / "Create New Build"

## Tasks / Subtasks

- [x] Task 1: Extend `src/shared/stores/buildStore.ts` — add class/mastery selection state (AC: 3)
  - [x] Add `selectedClassId: string | null` and `selectedMasteryId: string | null` to store interface
  - [x] Add `setSelectedClass(classId: string | null): void` — sets classId, clears masteryId
  - [x] Add `setSelectedMastery(masteryId: string | null): void`
  - [x] Update `src/shared/stores/buildStore.test.ts` with 3 new tests for these actions

- [x] Task 2: Create `src/features/skill-tree/treeDataTransformer.ts` — GameData → TreeData converter (AC: 1, 2)
  - [x] Export `buildTreeData(classData: ClassData, masteryId: string | null, allocatedNodes: Record<string, number>): TreeData`
  - [x] Base tree nodes mapped to TreeNode with state='allocated' if in allocatedNodes, else 'available'
  - [x] Base tree edges reconstructed from `GameNode.prerequisiteNodeIds`
  - [x] Mastery tree nodes added with `MASTERY_Y_OFFSET = 1600` applied to y coordinates (separates mastery from base tree visually)
  - [x] Mastery tree edges reconstructed from mastery `GameNode.prerequisiteNodeIds`
  - [x] `connections: string[]` computed bidirectionally for each node (prereqs + dependents)
  - [x] If masteryId is null, return base tree only

- [x] Task 3: Create `src/features/skill-tree/treeDataTransformer.test.ts` — unit tests (AC: 1, 2)
  - [x] Test: base-only tree returned when masteryId is null
  - [x] Test: combined base+mastery nodes returned when masteryId provided
  - [x] Test: mastery nodes have y + 1600 applied
  - [x] Test: allocated node has state='allocated'
  - [x] Test: unallocated node has state='available'
  - [x] Test: edges correctly reconstructed from prerequisiteNodeIds
  - [x] Test: connections are bidirectional (both parent and child listed)

- [x] Task 4: Create `src/features/skill-tree/EmptyTreeState.tsx` — empty tree CTA (AC: 4)
  - [x] Full-height container with dark gradient background (replaces class art placeholder)
  - [x] Centered column: heading "Import a build or start fresh" in text-primary style
  - [x] Two buttons: "Paste Build Code" and "Create New Build" (no-op click handlers for now; these connect to build flows in Stories 2.1 and 2.3)
  - [x] Buttons use design token colors (accent-gold border, text-secondary background)

- [x] Task 5: Create `src/features/skill-tree/SkillTreeView.tsx` — store-connected wrapper (AC: 1, 2, 4)
  - [x] Reads `selectedClassId`, `selectedMasteryId` from `useBuildStore`
  - [x] Reads `gameData`, `isLoading` from `useGameDataStore`
  - [x] If `isLoading` → show loading indicator (centered spinner text "Loading game data…")
  - [x] If `!selectedClassId || !selectedMasteryId` → render `<EmptyTreeState />`
  - [x] If classId/masteryId set but `gameData.classes[classId]` missing → render `<EmptyTreeState />`
  - [x] Otherwise → call `buildTreeData`, render `<SkillTreeCanvas>` with result
  - [x] `allocatedNodes`: `{}` for now (no build active in 1.4)
  - [x] `highlightedNodes`: empty `Set<string>()`
  - [x] `onNodeClick` and `onNodeHover`: no-op handlers (wired in Story 1.5)
  - [x] Zero store imports inside `SkillTreeCanvas` (all reads happen in `SkillTreeView`)

- [x] Task 6: Create `src/features/skill-tree/ClassMasterySelector.tsx` — Headless UI selector (AC: 3)
  - [x] Import `Listbox, ListboxButton, ListboxOption, ListboxOptions` from `@headlessui/react`
  - [x] Read `gameData` from `useGameDataStore`; if null, render null
  - [x] Derive sorted class list: `Object.values(gameData.classes).sort((a, b) => a.className.localeCompare(b.className))`
  - [x] Read `selectedClassId`, `selectedMasteryId`, `setSelectedClass`, `setSelectedMastery` from `useBuildStore`
  - [x] Class Listbox: button shows selected class name or "Select Class"; on change → `setSelectedClass(classId)`
  - [x] Mastery Listbox (only rendered when `selectedClassId` is set): button shows selected mastery name or "Select Mastery"; on change → `setSelectedMastery(masteryId)`
  - [x] Both Listboxes use `z-10` positioning so options drop over content
  - [x] Style with design tokens: `bg-bg-elevated`, `border-bg-elevated`, `text-text-primary`, hover `bg-bg-elevated`

- [x] Task 7: Update `src/features/layout/LeftPanel.tsx` — add ClassMasterySelector (AC: 3)
  - [x] Replace the placeholder "Class selector — Story 1.4" paragraph with `<ClassMasterySelector />`
  - [x] Ensure it renders only in expanded state (already gated by existing collapsed/expanded branching)

- [x] Task 8: Update `src/features/layout/CenterCanvas.tsx` — use SkillTreeView (AC: 1, 4)
  - [x] Replace `SkillTreeCanvas` + `mockTreeData` with `<SkillTreeView />`
  - [x] Remove `import { SkillTreeCanvas }` and `import { mockTreeData }`

- [x] Task 9: Validate (AC: 1, 2, 3, 4)
  - [x] `pnpm tsc --noEmit` → zero errors
  - [x] `pnpm vitest run` → all 85 tests pass across 12 test files (10 new story 1.4 tests + 5 pixiRenderer tests re-enabled after pre-existing WebGL1 typeof guard bug fixed)

## Dev Notes

### Architecture Constraint: SkillTreeCanvas Has No Store Access

`SkillTreeCanvas.tsx` must never import from `src/shared/stores/`. All store reads happen in `SkillTreeView.tsx`, which passes computed props down to `SkillTreeCanvas`. This is a non-negotiable architecture rule established in Story 1.2.

### Combined Base + Mastery Tree Layout

When a mastery is selected, both the base class tree and mastery passive tree are combined into one `TreeData` and rendered by `SkillTreeCanvas`. The mastery nodes are offset by `MASTERY_Y_OFFSET = 1600` in the Y dimension to separate them from the base tree:

- Base tree: y ∈ [-840, 0] (nodes positioned in upper-left quadrant from origin)
- Mastery tree: y ∈ [-1040+1600, 1040+1600] = [560, 2640] (below base tree)
- Gap between trees: ~560 world units at y=0→560

The PixiJS renderer centers the initial view at worldContainer position (w/2, h/2) — world origin (0,0) maps to screen center. The base tree's root node (Gladiator/class entry) is near (0,0), visible near screen center on first render. User pans down to see mastery tree.

No cross-tree edges are added (the current JSON data does not define base-to-mastery gateway edges). This will be refined when EHG releases coordinate data or Story 1.7 adds data update tooling.

### treeDataTransformer: Reconstructing Edges

`ClassData.baseTree` and `MasteryData.nodes` are `Record<string, GameNode>`. The original edge direction (`fromId → toId`) is recovered from `GameNode.prerequisiteNodeIds`:

```ts
// prereqId is the "from" node (parent), nodeId is the "to" node (child/dependent)
for (const [nodeId, node] of Object.entries(classData.baseTree)) {
  for (const prereqId of node.prerequisiteNodeIds) {
    edges.push({ fromId: prereqId, toId: nodeId })
  }
}
```

This matches the original `fromId → toId` direction in the raw JSON edges and the `buildPrereqMap` logic in `gameDataLoader.ts`.

### ClassMasterySelector: Headless UI v2 API

The installed version is `@headlessui/react ^2.2.10`. The v2 API uses named sub-components:

```tsx
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'

<Listbox value={selectedClassId} onChange={(id) => setSelectedClass(id)}>
  <ListboxButton>{selectedClassName ?? 'Select Class'}</ListboxButton>
  <ListboxOptions>
    {classList.map(cls => (
      <ListboxOption key={cls.classId} value={cls.classId}>
        {cls.className}
      </ListboxOption>
    ))}
  </ListboxOptions>
</Listbox>
```

`ListboxOptions` renders as a floating `<div>` by default in v2 — add `className="absolute z-10 ..."` for positioning.

### State Priority: activeBuild vs. selector

In Story 1.4, `activeBuild` is always null (no build is created until Stories 2.x). `SkillTreeView` reads `selectedClassId`/`selectedMasteryId` from `buildStore` only. When Stories 2.x set `activeBuild`, those stories will also need to sync `selectedClassId`/`selectedMasteryId` with the build's class/mastery — Story 1.4 does not implement that sync.

### Previous Story Learnings

- **No `index.ts` barrel files**: import directly, e.g. `from '../skill-tree/SkillTreeView'`
- **Tailwind v4 CSS-first**: no `tailwind.config.js`; CSS custom properties from `@theme` block available via `var(--color-*)` tokens
- **Design token reference**: `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`, `--color-text-primary`, `--color-text-muted`, `--color-accent-gold`, `--color-node-available` (blue-grey), `--color-node-allocated` (gold)
- **Headless UI v2**: named sub-components (`ListboxButton`, `ListboxOptions`, `ListboxOption`), not render props pattern from v1
- **GameNode.size** added in Story 1.3b Task 1 — available in `src/shared/types/gameData.ts`; maps directly to `TreeNode.size` ('small' | 'medium' | 'large')
- **`useGameDataStore.gameData`** populated by `initGameData()` called in `App.tsx` on mount; may be null briefly at startup

### New Files This Story

```
src/features/skill-tree/
  treeDataTransformer.ts       ← GameData + selection → TreeData
  treeDataTransformer.test.ts  ← Vitest unit tests (7 tests)
  EmptyTreeState.tsx           ← Empty canvas CTA (no stores)
  SkillTreeView.tsx            ← Store-connected wrapper; reads stores, passes props to SkillTreeCanvas
  ClassMasterySelector.tsx     ← Headless UI Listbox selector; reads stores
```

### Modified Files This Story

```
src/features/layout/CenterCanvas.tsx      ← replace SkillTreeCanvas+mockData with SkillTreeView
src/features/layout/LeftPanel.tsx         ← add ClassMasterySelector
src/shared/stores/buildStore.ts           ← add selectedClassId, selectedMasteryId, setSelectedClass, setSelectedMastery
src/shared/stores/buildStore.test.ts      ← add 3 new store tests
```

### References

- Story 1.2 (done) — SkillTreeCanvas, pixiRenderer, types: `_bmad-output/implementation-artifacts/1-2-pixijs-webgl-renderer-spike-60fps-validation-gate.md`
- Story 1.3b (done) — gameDataLoader, GameData types, GameNode.size: `_bmad-output/implementation-artifacts/1-3b-game-data-pipeline-implementation.md`
- Epics Story 1.4 spec: `_bmad-output/planning-artifacts/epics.md` (line ~365)
- Architecture — frontend feature structure: `_bmad-output/planning-artifacts/architecture.md`
- game-data-source.md — combined tree layout guidance: `docs/game-data-source.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(none yet)

### Completion Notes List

- All 9 tasks complete. `pnpm tsc --noEmit` → zero errors. `pnpm vitest run` → 85/85 tests pass (12 files).
- Pre-existing bug fixed: `pixiRenderer.ts` module-level WebGL1 patch lacked a `typeof WebGLRenderingContext !== 'undefined'` guard (unlike the WebGL2 guard which had one). This caused jsdom test environment to throw `ReferenceError: WebGLRenderingContext is not defined`, silently zeroing the pixiRenderer.test.ts suite. Fixed by adding the same guard pattern as WebGL2. No runtime behavior change (browsers always define WebGLRenderingContext).
- `buildTreeData` uses `MASTERY_Y_OFFSET = 1600` to separate mastery tree nodes below the base tree visually. No cross-tree edges (not in JSON data from 1.3b). PixiJS renderer centers world origin at screen center; base tree root (Gladiator) is near (0,0); mastery tree starts at y=560.
- `ClassMasterySelector` uses Headless UI v2 named sub-components (`ListboxButton`, `ListboxOptions`, `ListboxOption`). `value` prop requires `string | undefined`, not `null` — converted with `?? undefined`.
- `SkillTreeView` reads class/mastery selection from `useBuildStore`, game data from `useGameDataStore`, builds `TreeData` via `buildTreeData`, passes computed props to `SkillTreeCanvas`. Zero store access inside `SkillTreeCanvas`.
- Empty state shows gradient background + "Import a build or start fresh" + two no-op buttons (Paste Build Code / Create New Build). These wire to Stories 2.1 and 2.3 respectively.

### File List

**New files:**
- `lebo/src/features/skill-tree/treeDataTransformer.ts`
- `lebo/src/features/skill-tree/treeDataTransformer.test.ts`
- `lebo/src/features/skill-tree/EmptyTreeState.tsx`
- `lebo/src/features/skill-tree/SkillTreeView.tsx`
- `lebo/src/features/skill-tree/ClassMasterySelector.tsx`

**Modified files:**
- `lebo/src/shared/stores/buildStore.ts` (added selectedClassId, selectedMasteryId, setSelectedClass, setSelectedMastery)
- `lebo/src/shared/stores/buildStore.test.ts` (added 3 new tests)
- `lebo/src/features/layout/LeftPanel.tsx` (replaced placeholder with ClassMasterySelector)
- `lebo/src/features/layout/CenterCanvas.tsx` (replaced SkillTreeCanvas+mockData with SkillTreeView)
- `lebo/src/features/skill-tree/pixiRenderer.ts` (pre-existing bug fix: added typeof guard for WebGLRenderingContext)

### Review Findings

- [x] [Review][Patch] Unstable `treeData`/`allocatedNodes`/`highlightedNodes` refs — `buildTreeData` called every render produces a new `TreeData` reference; `allocatedNodes={{}}` and `highlightedNodes={new Set()}` also produce new refs; all three trigger `SkillTreeCanvas` `useEffect([treeData, allocatedNodes, highlightedNodes])` on every parent re-render, causing a full clear+redraw unnecessarily. Fixed: `useMemo` for `treeData`, module-level constants for the two empty collections. [`SkillTreeView.tsx`]
- [x] [Review][Patch] `LeftPanel` `overflow-hidden` clips `ListboxOptions` dropdown — the `<aside overflow-hidden>` clips the absolutely-positioned dropdown when options extend beyond panel bounds. Fixed: `ListboxOptions` now uses `anchor="bottom start"` (Headless UI v2 Floating UI portal) and the redundant `div.relative` wrapper removed. [`LeftPanel.tsx`, `ClassMasterySelector.tsx`]
- [x] [Review][Defer] No locked-node state in `buildTreeData` — nodes only receive `'allocated'` or `'available'`; `'locked'` requires prerequisite validation logic from Story 1.5. [`treeDataTransformer.ts`] — deferred, pre-existing by spec

## Change Log

| Date | Change |
|------|--------|
| 2026-04-22 | Story file created. All 9 tasks implemented: buildStore selection state, treeDataTransformer (10 tests), EmptyTreeState, SkillTreeView, ClassMasterySelector, LeftPanel + CenterCanvas wired. 85/85 tests pass. Status → review. |
