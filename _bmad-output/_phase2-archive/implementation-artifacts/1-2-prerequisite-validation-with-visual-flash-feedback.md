# Story 1.2: Prerequisite Validation with Visual Flash Feedback

Status: done

## Story

As a theory-crafter,
I want the app to prevent me from allocating a node whose prerequisites are unmet and from removing a node that other allocated nodes depend on, with clear visual feedback explaining the block,
So that I build only valid skill tree configurations without needing to memorize prerequisite rules.

## Acceptance Criteria

1. **Given** a node whose prerequisite node has 0 allocation  
   **When** the player left-clicks the locked node  
   **Then** `applyNodeChange` returns false, no allocation change occurs, the clicked node briefly flashes with `--color-node-locked` fill and CSS scale 1.05→1.0 over 150ms, and the flash is skipped entirely if `useReducedMotion()` returns true

2. **Given** a node with allocation > 0 that is a prerequisite for another allocated node  
   **When** the player right-clicks to decrement  
   **Then** `applyNodeChange` returns false, no decrement occurs, and the dependent nodes flash briefly (same animation) to show why the action was blocked

3. **Given** a node that IS allocatable (prerequisites met, allocation < maxPoints)  
   **When** the player left-clicks it  
   **Then** no flash occurs; allocation increments normally

4. **Given** `applyNodeChange(nodeId, +1, treeData)` is called  
   **When** a prerequisite node has 0 allocation  
   **Then** the function blocks and returns `{ success: false, error: 'Prerequisite not met' }`

5. **Given** `applyNodeChange(nodeId, -1, treeData)` is called  
   **When** decrementing would leave a dependent node with an unmet prerequisite  
   **Then** the function blocks and returns `{ success: false, error: '...', blockedByDependents: string[] }` where `blockedByDependents` lists the nodeIds of the nodes that depend on `nodeId`

6. **Given** hovering any node in `state: 'locked'`  
   **When** the tooltip appears  
   **Then** the prerequisite section shows "Requires: {prerequisiteName}" (human-readable name, not raw ID) for each prerequisite nodeId sourced from `gameNode.prerequisiteNodeIds`

7. **And** no toast notification is shown for any blocked allocation action — visual flash and tooltip are the sole feedback mechanisms (no changes to react-hot-toast usage)

## Tasks / Subtasks

- [x] Task 1: Extend `ApplyNodeResult` to include `blockedByDependents` (AC: #5)
  - [x] `src/shared/types/build.ts`: Change `ApplyNodeResult` from `{ success: boolean; error?: string }` to `{ success: boolean; error?: string; blockedByDependents?: string[] }`

- [x] Task 2: Return `blockedByDependents` from `applyNodeChange` (AC: #5)
  - [x] `src/shared/stores/buildStore.ts`: In the dependents-block branch, return `{ success: false, error: '...', blockedByDependents: dependents }` where `dependents` is the array of dependent nodeIds already computed
  - [x] `src/shared/stores/buildStore.test.ts`: Add test asserting `blockedByDependents` contains the correct nodeId(s) when decrement is blocked

- [x] Task 3: Add `triggerFlash` to `RendererInstance` interface and `SkillTreeCanvasProps` (AC: #1, #2)
  - [x] `src/features/skill-tree/types.ts`: Add `triggerFlash(nodeIds: string[]): void` to `RendererInstance` interface
  - [x] `src/features/skill-tree/types.ts`: Add `flashNodeIds?: string[]` to `SkillTreeCanvasProps`

- [x] Task 4: Implement `triggerFlash` in `pixiRenderer.ts` (AC: #1, #2, #3)
  - [x] Add `flashContainer = new Container()` added to `worldContainer` ABOVE `hitAreaContainer` (in the `addChild` call order)
  - [x] Store `let lastRenderedNodeMap: Map<string, TreeNode> = new Map()` — set at the start of each `renderTree` call
  - [x] Implement `triggerFlash(nodeIds: string[])`: if `reducedMotionEnabled` OR `nodeIds.length === 0`, return immediately; create one `Graphics` per nodeId (circle with locked fill `0x2a2a35`, stroke `0x5a5050`), set initial scale 1.05, add to `flashContainer`; add a ticker callback that lerps scale from 1.05 → 1.0 over 150ms, then removes children and removes itself from the ticker
  - [x] `renderTree` does NOT clear or touch `flashContainer` — flash is managed independently

- [x] Task 5: Wire flash trigger through `SkillTreeCanvas` (AC: #1, #2, #3)
  - [x] `src/features/skill-tree/SkillTreeCanvas.tsx`: Destructure `flashNodeIds` from props
  - [x] Add `useEffect(() => { if (!flashNodeIds || flashNodeIds.length === 0) return; rendererRef.current?.triggerFlash(flashNodeIds) }, [flashNodeIds])` — the ref-identity change of the `flashNodeIds` array (each failure creates a new array) drives re-triggering

- [x] Task 6: Track flash signal in `useSkillTree` (AC: #1, #2)
  - [x] `src/features/skill-tree/useSkillTree.ts`: Add `flashNodeIds: string[] | null` state (starts `null`)
  - [x] In `handleNodeClick`: on failed allocation (left-click, blocked), `setFlashNodeIds([nodeId])` (always a new array reference); on failed decrement (right-click, blocked with dependents), `setFlashNodeIds([...result.blockedByDependents])` using the new `ApplyNodeResult` field; on failed decrement (no dependents info), `setFlashNodeIds([nodeId])`
  - [x] Add `flashNodeIds` to the returned `SkillTreeInteraction` object
  - [x] `src/features/skill-tree/SkillTreeInteraction` interface: add `flashNodeIds: string[] | null`

- [x] Task 7: Pass `flashNodeIds` from `SkillTreeView` to `SkillTreeCanvas` (AC: #1, #2)
  - [x] `src/features/skill-tree/SkillTreeView.tsx`: Destructure `flashNodeIds` from `useSkillTree(...)`
  - [x] Pass `flashNodeIds={flashNodeIds ?? undefined}` to `<SkillTreeCanvas>`

- [x] Task 8: Improve prerequisite tooltip to show names (AC: #6)
  - [x] `src/features/skill-tree/NodeTooltip.tsx`: Add optional prop `prerequisiteNames?: string[]`; when provided, display `prerequisiteNames` instead of `gameNode.prerequisiteNodeIds` in the "Requires:" line
  - [x] `src/features/skill-tree/SkillTreeView.tsx`: For `hoveredGameNode`, `errorGameNode`, `keyboardGameNode` — compute `prerequisiteNames` by mapping `gameNode.prerequisiteNodeIds.map(id => allGameNodes[id]?.name ?? id)` and pass to each `NodeTooltip`

- [x] Task 9: Update tests (AC: all)
  - [x] `src/shared/stores/buildStore.test.ts`: Add test for `blockedByDependents` presence in blocked decrement result
  - [x] `src/features/skill-tree/useSkillTree.test.ts`: Add tests: (a) flashNodeIds is set to `[nodeId]` on blocked left-click, (b) flashNodeIds is set to dependent nodeIds on blocked right-click, (c) flashNodeIds is null on successful click
  - [x] `src/features/skill-tree/SkillTreeCanvas.test.tsx`: Add test that `triggerFlash` is called with correct nodeIds when `flashNodeIds` prop changes
  - [x] Run `pnpm test` — verify all new tests pass; confirm pre-existing 6 Settings/ProviderSelector failures remain the only failures
  - [x] Run `pnpm tsc --noEmit` — zero errors required

### Review Findings

- [x] [Review][Patch] Ticker leak: old `tick` runs after new `triggerFlash` call and calls `flashContainer.removeChildren()` at completion, canceling the newer animation [lebo/src/features/skill-tree/pixiRenderer.ts:triggerFlash]
- [x] [Review][Defer] `flashNodeIds` never reset to `null` on successful click — semantically stale prop after first failure, functionally safe because every failure always creates a new array reference [lebo/src/features/skill-tree/useSkillTree.ts] — deferred, no observable consequence
- [x] [Review][Defer] Preview mode allows real allocation commits while preview overlay is active — user clicking in preview context commits real points [lebo/src/features/skill-tree/SkillTreeView.tsx] — deferred, pre-existing design
- [x] [Review][Defer] `computePreviewAllocations` applies `pointsChange` without upper `maxPoints` clamp — preview can show illegal allocation counts [lebo/src/features/skill-tree/SkillTreeView.tsx] — deferred, pre-existing
- [x] [Review][Defer] Flash only shows depth-1 dependents — transitive dependency chain not communicated to user when blocking removal — deferred, UX limitation for future story
- [x] [Review][Defer] Test `"flashNodeIds is null on successful click"` only covers fresh-state — does not prove post-failure reset guarantee [lebo/src/features/skill-tree/useSkillTree.test.ts] — deferred, test coverage gap

## Dev Notes

### Critical Reality — What Story 1.1 Already Implemented

**Do NOT reimplement these — they already exist and work:**

- `applyNodeChange` already validates prerequisites (delta > 0) and dependents (delta < 0 and newPoints === 0) — `buildStore.ts:105-126`
- `applyNodeChange` already returns `{ success: false, error: 'Prerequisite not met' }` and `{ success: false, error: 'Cannot remove — N node(s) depend on this' }`
- `useSkillTree.handleNodeClick` already calls `setNodeError({ nodeId, message: error })` on failure
- `NodeTooltip` with `errorMessage` prop already shows the blocked-action error tooltip — `SkillTreeView.tsx` already shows it above the canvas
- The hover tooltip for any node already shows prerequisite node IDs at `NodeTooltip.tsx:116-119`

**Story 1.2 adds only:**
1. The PixiJS flash animation (NEW — `pixiRenderer.ts`)
2. `blockedByDependents` in `ApplyNodeResult` (NEW — `build.ts`, `buildStore.ts`)
3. Flash signal propagation (NEW — `useSkillTree.ts`, `SkillTreeCanvas.tsx`, `SkillTreeView.tsx`)
4. Prerequisite name lookup in tooltip (IMPROVEMENT — `NodeTooltip.tsx`, `SkillTreeView.tsx`)

### Flash Animation Architecture

Flash is managed **entirely by the renderer** — no React state changes during animation.

**`flashContainer` layer placement** (in `pixiRenderer.ts` worldContainer.addChild call):
```typescript
worldContainer.addChild(
  edgeGraphics,
  lockedGraphics,
  availableGraphics,
  allocatedGraphics,
  dimmedGraphics,
  suggestedGraphics,
  previewRemovedGraphics,
  previewAddedGraphics,
  labelContainer,
  flashContainer,  // ← NEW: above labels, below hit areas
  hitAreaContainer,
)
```

**`triggerFlash` implementation pattern:**
```typescript
let lastRenderedNodeMap: Map<string, TreeNode> = new Map()

function renderTree(data: TreeData, ...) {
  lastRenderedNodeMap = new Map(data.nodes.map((n) => [n.id, n]))
  // ... existing code unchanged
}

function triggerFlash(nodeIds: string[]) {
  if (reducedMotionEnabled || nodeIds.length === 0) return

  flashContainer.removeChildren()  // cancel any prior flash

  const DURATION = 150
  const START_SCALE = 1.05

  for (const nodeId of nodeIds) {
    const node = lastRenderedNodeMap.get(nodeId)
    if (!node) continue
    const r = NODE_RADIUS[node.size]

    const g = new Graphics()
    g.circle(0, 0, r).fill(0x2a2a35)
    g.circle(0, 0, r).stroke({ color: 0x5a5050, width: 2 })

    const c = new Container()
    c.x = node.x
    c.y = node.y
    c.scale.set(START_SCALE)
    c.addChild(g)
    flashContainer.addChild(c)
  }

  const startTime = performance.now()

  const tick = () => {
    const progress = Math.min((performance.now() - startTime) / DURATION, 1)
    const scale = START_SCALE - (START_SCALE - 1.0) * progress

    for (const child of flashContainer.children) {
      child.scale.set(scale)
    }

    if (progress >= 1) {
      flashContainer.removeChildren()
      app.ticker.remove(tick)
    }
  }

  app.ticker.add(tick)
}
```

`renderTree` must NOT touch `flashContainer`. The flash self-terminates via ticker.

### `flashNodeIds` Re-Trigger Pattern

`useSkillTree` must always create a **new array reference** for each flash, even if same nodeId fails twice in a row (otherwise React `useEffect` won't re-run):

```typescript
// On blocked left-click:
setFlashNodeIds([nodeId])  // always new array

// On blocked right-click with dependents:
setFlashNodeIds(result.blockedByDependents ?? [nodeId])  // always new array from result
```

`SkillTreeCanvas` effect:
```typescript
useEffect(() => {
  if (!flashNodeIds || flashNodeIds.length === 0) return
  rendererRef.current?.triggerFlash(flashNodeIds)
}, [flashNodeIds])  // triggers on every reference change
```

### `blockedByDependents` Return — Exact Code Location

In `buildStore.ts` around line 115-126, the existing code:
```typescript
if (delta < 0 && newPoints === 0) {
  const dependents = treeData.edges
    .filter((e) => e.fromId === nodeId)
    .map((e) => e.toId)
    .filter((depId) => (activeBuild!.nodeAllocations[depId] ?? 0) > 0)
  if (dependents.length > 0) {
    return {
      success: false,
      error: `Cannot remove — ${dependents.length} node(s) depend on this`,
    }
  }
}
```

Change the return to:
```typescript
    return {
      success: false,
      error: `Cannot remove — ${dependents.length} node(s) depend on this`,
      blockedByDependents: dependents,
    }
```

### Prerequisite Names in Tooltip

`allGameNodes: Record<string, GameNode>` is already computed in `SkillTreeView.tsx` (line 82-90). Use it to look up names:

```typescript
// In SkillTreeView.tsx, compute per tooltip instance:
function getPrerequisiteNames(gameNode: GameNode | null): string[] {
  if (!gameNode || gameNode.prerequisiteNodeIds.length === 0) return []
  return gameNode.prerequisiteNodeIds.map((id) => allGameNodes[id]?.name ?? id)
}
```

Pass to `NodeTooltip`:
```tsx
<NodeTooltip
  gameNode={hoveredGameNode}
  allocatedPoints={nodeAllocations[hoveredNodeId!] ?? 0}
  position={mousePosition}
  prerequisiteNames={getPrerequisiteNames(hoveredGameNode)}
/>
```

`NodeTooltip.tsx` change — replace the existing prerequisite block (lines 116-119):
```tsx
{(prerequisiteNames ?? gameNode.prerequisiteNodeIds).length > 0 && (
  <p style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
    Requires: {(prerequisiteNames ?? gameNode.prerequisiteNodeIds).join(', ')}
  </p>
)}
```

### `SkillTreeInteraction` Interface Update

Add to the existing interface in `useSkillTree.ts`:
```typescript
export interface SkillTreeInteraction {
  // ... existing fields
  flashNodeIds: string[] | null  // new
}
```

### TypeScript Strict Mode Gotchas

- `flashNodeIds` in `SkillTreeCanvasProps` is `string[] | undefined` (optional prop) but the state in `useSkillTree` is `string[] | null` — use `flashNodeIds ?? undefined` in JSX
- `triggerFlash` on `RendererInstance` is `triggerFlash(nodeIds: string[]): void` — not optional. Update the mock in tests accordingly
- `prerequisiteNames?: string[]` is optional on `NodeTooltip` — existing call sites that don't pass it still work without change, but `SkillTreeView` must pass it for the 3 NodeTooltip usages (hovered, error, keyboard)

### Test Patterns to Follow (from Story 1.1)

- `SkillTreeCanvas.test.tsx` mocks `pixiRenderer` via `vi.mock('./pixiRenderer', ...)` — the mock's `RendererInstance` object must be extended with `triggerFlash: vi.fn()`; add it to `mockRenderer`
- `buildStore.test.ts` uses `mockTreeData` with `root → child` edge — existing tests cover this; add a specific assertion for `blockedByDependents: ['child']` in the "blocks deallocation when dependent allocated" test (or add a new focused test)
- `useSkillTree.test.ts` uses `renderHook(() => useSkillTree(mockTreeData))` — add tests that check `result.current.flashNodeIds` after clicking a blocked node

### File Change Checklist

Files to **modify**:
- `lebo/src/shared/types/build.ts` — extend `ApplyNodeResult`
- `lebo/src/shared/stores/buildStore.ts` — return `blockedByDependents`
- `lebo/src/features/skill-tree/types.ts` — add `triggerFlash` to `RendererInstance`, add `flashNodeIds?` to `SkillTreeCanvasProps`
- `lebo/src/features/skill-tree/pixiRenderer.ts` — add `flashContainer`, `lastRenderedNodeMap`, `triggerFlash`; expose in return object
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` — destructure `flashNodeIds`, add `useEffect`
- `lebo/src/features/skill-tree/useSkillTree.ts` — add `flashNodeIds` state, set on failure, expose in return
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — destructure `flashNodeIds`, pass to `<SkillTreeCanvas>`, pass `prerequisiteNames` to each `NodeTooltip`
- `lebo/src/features/skill-tree/NodeTooltip.tsx` — add `prerequisiteNames?: string[]` prop, use in "Requires:" display
- `lebo/src/shared/stores/buildStore.test.ts` — add `blockedByDependents` assertion
- `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` — add `triggerFlash` to mock, add flash trigger test
- `lebo/src/features/skill-tree/useSkillTree.test.ts` — add `flashNodeIds` tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — update story status to `in-progress` at start, `review` when done

Files **not to touch** (regression risk):
- `treeDataTransformer.ts` — converts GameNode → TreeNode; no changes needed
- `buildPersistence.ts` — save/load logic; untouched
- `SuggestionsList.tsx` — `applyNodeChange` call signature unchanged; new `blockedByDependents` field is an additive extension, no changes needed
- Any optimization store files
- Any Rust backend files
- `pixiRenderer.test.ts` — only touch if needed to add triggerFlash mock expectations; otherwise leave

### References

- [Source: buildStore.ts:115-126] — existing dependents check; add `blockedByDependents` return here
- [Source: useSkillTree.ts:34-44] — existing handleNodeClick; add flash state update here
- [Source: SkillTreeCanvas.tsx] — add `flashNodeIds` prop + useEffect
- [Source: pixiRenderer.ts:99-126] — worldContainer.addChild; insert `flashContainer` before `hitAreaContainer`
- [Source: NodeTooltip.tsx:116-119] — existing prerequisite display; add `prerequisiteNames` prop
- [Source: SkillTreeView.tsx:190-239] — NodeTooltip usage sites; add prerequisiteNames to each
- [Source: epics.md#Story 1.2] — full acceptance criteria
- [Source: project-context.md#PixiJS] — reducedMotion must gate all animated transitions
- [Source: UX-DR12] — flash spec: --color-node-locked fill + scale 1.05→1.0, 150ms, skip if reducedMotion

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Extended `ApplyNodeResult` with optional `blockedByDependents?: string[]` field (additive — no call sites broken)
- `applyNodeChange` now returns dependent nodeIds in blocked decrement results; callers already using `result.error` are unaffected
- `triggerFlash` implemented entirely in the renderer — React state only tracks the signal (array reference), not animation state; flash self-terminates via Pixi ticker
- `flashContainer` sits between `labelContainer` and `hitAreaContainer` so flash circles render above labels but below interaction hit areas
- `lastRenderedNodeMap` captures the latest node positions each `renderTree` call; flash uses this to position circles correctly without re-reading React state
- `reducedMotionEnabled` gates the flash — if set, `triggerFlash` returns immediately (AC #1 requirement)
- Each failed click creates a **new array reference** for `flashNodeIds`, ensuring `useEffect` re-fires even when the same node fails twice consecutively
- `prerequisiteNames` prop on `NodeTooltip` is optional with graceful fallback to raw IDs — all three tooltip instances (hover, error, keyboard) now pass resolved names
- All 6 pre-existing Settings/ProviderSelector failures confirmed unchanged; 0 new failures; 0 TypeScript errors

### File List

- `lebo/src/shared/types/build.ts`
- `lebo/src/shared/stores/buildStore.ts`
- `lebo/src/features/skill-tree/types.ts`
- `lebo/src/features/skill-tree/pixiRenderer.ts`
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx`
- `lebo/src/features/skill-tree/useSkillTree.ts`
- `lebo/src/features/skill-tree/SkillTreeView.tsx`
- `lebo/src/features/skill-tree/NodeTooltip.tsx`
- `lebo/src/shared/stores/buildStore.test.ts`
- `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx`
- `lebo/src/features/skill-tree/useSkillTree.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Change |
|------|--------|
| 2026-05-06 | Story 1.2 created: prerequisite flash animation, blockedByDependents extension, tooltip name lookup |
| 2026-05-07 | Implemented all 9 tasks: ApplyNodeResult extended, triggerFlash in pixiRenderer, flash signal wired through useSkillTree→SkillTreeCanvas, prerequisiteNames in NodeTooltip, 8 new tests added |
