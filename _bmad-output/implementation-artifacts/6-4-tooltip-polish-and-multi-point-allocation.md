---
title: 'Tooltip Polish & Multi-Point Allocation'
story_id: '6.4'
story_key: '6-4-tooltip-polish-and-multi-point-allocation'
epic: 6
status: ready-for-dev
created: '2026-05-27'
---

## Story

**As a player,**
I want node tooltips that overflow the viewport to be scrollable in place via mouse wheel, and Shift+click to allocate multiple points at once up to my remaining budget — matching lastepochtools.com behavior,
**so that** long tooltips don't get clipped and multi-point node allocation is fast.

---

## Acceptance Criteria

**AC1 — Tooltip max-height & scroll:**
**Given** a passive node whose tooltip content is taller than 60% of the viewport height
**When** the player hovers over that node
**Then** the tooltip renders with a maximum height (60vh) and an internal scrollbar
**And** mouse wheel scrolling inside the tooltip scrolls the tooltip content (not the page or tree canvas)

**AC2 — Shift+click bulk allocation (budget-limited):**
**Given** a passive node that allows up to 5 allocations and the player has 4 unspent points
**When** the player Shift+clicks that node
**Then** 4 points are allocated in one action (limited by budget, not node max of 5)
**And** the stat sheet updates after all 4 points are applied as a single batch (one rAF compute cycle)

**AC3 — Shift+click at max node allocation:**
**Given** a passive node already at its maximum allocation (5/5)
**When** the player Shift+clicks it
**Then** no additional allocation occurs
**And** the node shows its "at max" visual state unchanged

**AC4 — Shift+click with insufficient path budget:**
**Given** a node that requires 3 path points to reach and the player has 1 unspent point
**When** the player Shift+clicks that node
**Then** the allocation is rejected with no partial allocation
**And** no points are spent — the engine validates the full path cost before applying any changes

---

## Scope

- **Tooltip scroll** — `NodeTooltip.tsx` + `useSkillTree.ts` (hover grace timer) + `SkillTreeView.tsx` (prop threading)
- **Shift+click** — `pixiRenderer.ts` (event detection) + `types.ts` (signature) + `useSkillTree.ts` (bulk dispatch) + `buildStore.ts` (new bulk action)
- **Applies to passive tree only** — ACs specify "passive node"; skill/weaver trees fall back to single-point on Shift+click

**Do NOT implement or touch:**
- Weaver Shift+click bulk allocation (not in ACs)
- Skill tree Shift+click bulk allocation (not in ACs)
- Any Rust files (pure TypeScript/React/PixiJS story)
- `SkillTreeCanvas.tsx` keyboard overlay buttons (only the PixiJS pointer path needs shiftKey)

---

## Architecture Notes — READ FIRST

### Tooltip scroll: why `pointerEvents: 'none'` breaks wheel scroll

`NodeTooltip` renders via `createPortal` to `document.body` with `pointerEvents: 'none'`. This makes the canvas's wheel listener receive all scroll events even when the mouse is visually over the tooltip. Removing `pointerEvents: 'none'` (making it `'auto'`) allows the tooltip to capture wheel events — but it also causes PixiJS `pointerout` to fire on the hit area when the mouse moves from a node to the tooltip, clearing `hoveredNodeId` and hiding the tooltip.

**Fix:** Two-part change:
1. `NodeTooltip`: `pointerEvents: 'auto'` + `onWheel={stopPropagation}` + optional `onMouseEnter`/`onMouseLeave` props
2. `useSkillTree`: 50ms grace timer — delay clearing `hoveredNodeId` when `pointerout` fires, cancel if tooltip is entered

### Shift+click: PixiJS → store path

PixiJS `FederatedPointerEvent` exposes `shiftKey` (inherited from native pointer events). The existing call chain is:

```
pixiRenderer.ts  →  callbacksRef.current.onNodeClick(nodeId, button)
                 ↓
SkillTreeCanvas.tsx  →  callbacksRef synced on every render
                    ↓
useSkillTree.ts  →  handleNodeClick  →  applyNodeChange (or applySkillNodeChange)
```

For Shift+click: add `shiftKey?: boolean` to `onNodeClick` (optional, backward-compatible). In `useSkillTree.handleNodeClick`, route to `applyNodeChangeBulk` when `shiftKey && slotId === undefined`.

### `applyNodeChangeBulk` — single undo snapshot, max allocation

The "single batch" requirement (AC2) means ONE undo entry for the entire Shift+click. Unlike calling `applyNodeChange` N times (which would push N undo entries), `applyNodeChangeBulk`:
- Calculates max allocatable points = `min(nodeSpace, budgetRemaining)` in one call
- Applies all points in a single `set()` call
- Pushes ONE snapshot to `undoStack`, clears `redoStack`

The bulk action is for **passive tree only** — it modifies `nodeAllocations` only. No `applySkillNodeChangeBulk` or `applyWeaverNodeChangeBulk` needed.

---

## Tasks / Subtasks

- [ ] **Task 1: `NodeTooltip.tsx` — Scrollable tooltip with pointer event capture**
- [ ] **Task 2: `useSkillTree.ts` — Grace timer + tooltip enter/leave callbacks**
- [ ] **Task 3: `SkillTreeView.tsx` — Thread `onMouseEnter`/`onMouseLeave` to hover tooltips**
- [ ] **Task 4: `types.ts` — Add `shiftKey?` to `onNodeClick` signatures**
- [ ] **Task 5: `pixiRenderer.ts` — Pass `e.shiftKey` in `pointerup` handler**
- [ ] **Task 6: `buildStore.ts` — Add `applyNodeChangeBulk` action**
- [ ] **Task 7: `useSkillTree.ts` — Route Shift+click to `applyNodeChangeBulk`**
- [ ] **Task 8: `buildStore.test.ts` — `applyNodeChangeBulk` tests**
- [ ] **Task 9: `NodeTooltip.test.tsx` — Scrollable container CSS tests**

---

## Technical Requirements

### Task 1: `NodeTooltip.tsx` — Scrollable tooltip

**File:** `lebo/src/features/skill-tree/NodeTooltip.tsx`

**Interface additions** (add to `NodeTooltipProps`):
```typescript
interface NodeTooltipProps {
  gameNode: GameNode
  allocatedPoints: number
  position: { x: number; y: number }
  errorMessage?: string
  prerequisiteNames?: string[]
  onMouseEnter?: () => void   // NEW — called when mouse enters tooltip
  onMouseLeave?: () => void   // NEW — called when mouse leaves tooltip
}
```

**Destructure new props:**
```typescript
export function NodeTooltip({ gameNode, allocatedPoints, position, errorMessage, prerequisiteNames, onMouseEnter, onMouseLeave }: NodeTooltipProps) {
```

**Change `baseStyle`** — remove `pointerEvents: 'none'`, add scroll:
```typescript
const baseStyle: React.CSSProperties = {
  position: 'fixed',
  left,
  top,
  zIndex: 1000,
  borderRadius: '4px',
  maxWidth: `${TOOLTIP_WIDTH}px`,
  maxHeight: '60vh',         // NEW
  overflowY: 'auto',         // NEW
  // pointerEvents: 'none'  ← REMOVED
}
```

**Add wheel + hover handlers to both portal return divs** (error variant AND normal variant):
```tsx
<div
  style={{ ...baseStyle, ... }}
  onWheel={(e) => e.stopPropagation()}   // prevents canvas zoom
  onMouseEnter={onMouseEnter}
  onMouseLeave={onMouseLeave}
>
```

> **Why `stopPropagation` works:** The canvas wheel listener is on `app.canvas` (a separate DOM element). Once the tooltip has `pointerEvents: 'auto'`, wheel events are dispatched to the tooltip DOM element — they don't automatically reach the canvas. `stopPropagation` prevents them from bubbling to any shared ancestor that might re-deliver them. This is defense in depth; the DOM separation alone already isolates the events.

> **Both variants:** Apply to the error message div too — error tooltips can also overflow.

---

### Task 2: `useSkillTree.ts` — Grace timer + tooltip callbacks

**File:** `lebo/src/features/skill-tree/useSkillTree.ts`

**Add to `SkillTreeInteraction` interface** (after `handleKeyboardNavigate`):
```typescript
handleTooltipEnter: () => void   // NEW
handleTooltipLeave: () => void   // NEW
```

**Add ref inside `useSkillTree` function** (after `contextMenu` state):
```typescript
const clearHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

**Replace `handleNodeHover`** with timer-based version:
```typescript
const handleNodeHover = useCallback((nodeId: string | null) => {
  if (nodeId !== null) {
    // Node entered: cancel any pending clear, show tooltip immediately
    if (clearHoverTimerRef.current !== null) {
      clearTimeout(clearHoverTimerRef.current)
      clearHoverTimerRef.current = null
    }
    setHoveredNodeId(nodeId)
  } else {
    // Node left: delay clear so mouse can travel to tooltip without it disappearing
    clearHoverTimerRef.current = setTimeout(() => {
      setHoveredNodeId(null)
      setNodeError(null)
      clearHoverTimerRef.current = null
    }, 50)
  }
}, [])
```

**Add `handleTooltipEnter` and `handleTooltipLeave`**:
```typescript
const handleTooltipEnter = useCallback(() => {
  // Mouse entered the tooltip — cancel the pending clear
  if (clearHoverTimerRef.current !== null) {
    clearTimeout(clearHoverTimerRef.current)
    clearHoverTimerRef.current = null
  }
}, [])

const handleTooltipLeave = useCallback(() => {
  // Mouse left the tooltip — clear hover immediately
  setHoveredNodeId(null)
  setNodeError(null)
}, [])
```

**Add cleanup** — clear timer on unmount. Add a `useEffect` after all callbacks:
```typescript
useEffect(() => {
  return () => {
    if (clearHoverTimerRef.current !== null) clearTimeout(clearHoverTimerRef.current)
  }
}, [])
```

**Return both new handlers** from the hook (add to the return object):
```typescript
return {
  // ... existing ...
  handleTooltipEnter,
  handleTooltipLeave,
}
```

> **`noUnusedLocals`:** `clearHoverTimerRef` is used in all three callbacks plus cleanup. No orphan variables.

> **Timer value (50ms):** Enough for the mouse to physically move from a node to the adjacent tooltip. `pointerout` + `mouseenter` fire in the same event loop tick, but setting `hoveredNodeId` is async (React state). The 50ms window safely spans React batching.

> **Prior `handleNodeHover` pattern:** The old implementation called `setNodeError(null)` synchronously on `null`. The new version defers it inside the timer — same effect when the timer fires.

---

### Task 3: `SkillTreeView.tsx` — Thread tooltip callbacks

**File:** `lebo/src/features/skill-tree/SkillTreeView.tsx`

**Destructure new callbacks from interactions:**

For passive/skill (after `handleNodeContextMenu`, etc.):
```typescript
const {
  hoveredNodeId,
  // ... all existing ...
  handleTooltipEnter,   // NEW
  handleTooltipLeave,   // NEW
} = isPassiveTab ? passiveInteraction : skillInteraction
```

For weaver (after `setWeaverNodeError`):
```typescript
const {
  hoveredNodeId: weaverHoveredNodeId,
  // ... all existing weaverInteraction destructuring ...
  handleTooltipEnter: handleWeaverTooltipEnter,   // NEW
  handleTooltipLeave: handleWeaverTooltipLeave,   // NEW
} = weaverInteraction
```

**Update HOVER-only `NodeTooltip` instances** — 3 locations (hover state only, NOT error/keyboard tooltips):

Passive/skill hover tooltip (~line 681):
```tsx
{hoveredGameNode && !nodeError && (
  <NodeTooltip
    gameNode={hoveredGameNode}
    allocatedPoints={nodeAllocations[hoveredNodeId!] ?? 0}
    position={mousePosition}
    prerequisiteNames={getPrerequisiteNames(hoveredGameNode)}
    onMouseEnter={handleTooltipEnter}     // NEW
    onMouseLeave={handleTooltipLeave}     // NEW
  />
)}
```

Skill tree hover tooltip (~line 736):
```tsx
{hoveredGameNode && !nodeError && (
  <NodeTooltip
    gameNode={hoveredGameNode}
    allocatedPoints={activeAllocations[hoveredNodeId!] ?? 0}
    position={mousePosition}
    prerequisiteNames={getPrerequisiteNames(hoveredGameNode)}
    onMouseEnter={handleTooltipEnter}     // NEW
    onMouseLeave={handleTooltipLeave}     // NEW
  />
)}
```

Weaver hover tooltip (~line 484):
```tsx
{weaverHoveredGameNode && !weaverNodeError && (
  <NodeTooltip
    gameNode={weaverHoveredGameNode}
    allocatedPoints={weaverAllocations[weaverHoveredNodeId!] ?? 0}
    position={weaverMousePosition}
    prerequisiteNames={getWeaverPrereqNames(weaverHoveredGameNode)}
    onMouseEnter={handleWeaverTooltipEnter}     // NEW
    onMouseLeave={handleWeaverTooltipLeave}     // NEW
  />
)}
```

**Do NOT add tooltip callbacks to:**
- Error `NodeTooltip` instances (error tooltips clear when the timer runs, which is correct)
- Keyboard `NodeTooltip` instances (keyboard navigation doesn't create hover state to preserve)

> **`noUnusedLocals`:** `handleTooltipEnter`, `handleTooltipLeave`, `handleWeaverTooltipEnter`, `handleWeaverTooltipLeave` must all be used in JSX. Verify the destructuring names match exactly.

---

### Task 4: `types.ts` — Update `onNodeClick` signatures

**File:** `lebo/src/features/skill-tree/types.ts`

Update both interfaces — `shiftKey` is optional for backward compatibility:

```typescript
export interface RendererCallbacks {
  onNodeClick: (nodeId: string, button: 0 | 2, shiftKey?: boolean) => void  // shiftKey added
  onNodeHover: (nodeId: string | null) => void
  onNodeSelect?: (nodeId: string) => void
  onNodeContextMenu?: (nodeId: string, screenX: number, screenY: number) => void
}

export interface SkillTreeCanvasProps {
  // ...
  onNodeClick: (nodeId: string, button: 0 | 2, shiftKey?: boolean) => void  // shiftKey added
  // ... rest unchanged
}
```

> **Backward compatibility:** All existing call sites that pass only `(nodeId, button)` continue to work. Callers that newly pass `(nodeId, 0, true)` work with the updated `handleNodeClick` signature in `useSkillTree`.

---

### Task 5: `pixiRenderer.ts` — Pass `e.shiftKey` in `pointerup`

**File:** `lebo/src/features/skill-tree/pixiRenderer.ts`

**Update the `pointerup` handler on node hit areas** (~line 463):

```typescript
hit.on('pointerup', (e) => {
  if (e.button !== 0) return
  if (!dragging) {
    callbacksRef.current.onNodeClick(node.id, 0, e.shiftKey)  // pass shiftKey
    callbacksRef.current.onNodeSelect?.(node.id)
  }
})
```

> **`FederatedPointerEvent.shiftKey`:** PixiJS `FederatedPointerEvent` inherits `shiftKey: boolean` from the native pointer event. It is always present; no undefined guard needed.

> **`pointerdown` handler:** The existing right-click handler at line 458 calls `onNodeClick(node.id, 2)`. Right-click is never a Shift+click for bulk allocation — leave it unchanged.

---

### Task 6: `buildStore.ts` — Add `applyNodeChangeBulk`

**File:** `lebo/src/shared/stores/buildStore.ts`

**Add to `BuildStore` interface** (after `applyNodeChange`):
```typescript
applyNodeChangeBulk: (
  nodeId: string,
  treeData: TreeData
) => ApplyNodeResult
```

**Add implementation** (directly after `applyNodeChange` implementation, before `applyWeaverNodeChange`):

```typescript
applyNodeChangeBulk: (nodeId, treeData) => {
  const state = get()
  let activeBuild = state.activeBuild

  // Auto-create build on first allocation (same as applyNodeChange)
  if (!activeBuild) {
    if (!state.selectedClassId || !state.selectedMasteryId) {
      return { success: false, error: 'No class/mastery selected' }
    }
    const now = new Date().toISOString()
    activeBuild = {
      schemaVersion: 2,
      sliderPosition: 50,
      fineTuneWeights: null,
      id: crypto.randomUUID(),
      name: state.selectedMasteryId,
      classId: state.selectedClassId,
      masteryId: state.selectedMasteryId,
      characterLevel: 1,
      budgetEnforced: false,
      nodeAllocations: {},
      skillNodeAllocations: {},
      activeSkillLevels: {},
      weaverAllocations: {},
      contextData: { gear: [], skills: [], idols: [] },
      isPersisted: false,
      createdAt: now,
      updatedAt: now,
    }
  }

  const nodeMap = new Map(treeData.nodes.map((n) => [n.id, n]))
  const node = nodeMap.get(nodeId)
  if (!node) return { success: false }

  const current = activeBuild.nodeAllocations[nodeId] ?? 0
  const nodeSpace = node.maxPoints - current
  if (nodeSpace <= 0) return { success: false }  // already at max

  // Validate prerequisites (same check as applyNodeChange for delta > 0)
  const prerequisites = treeData.edges.filter((e) => e.toId === nodeId).map((e) => e.fromId)
  const prereqsMet = prerequisites.every(
    (prereqId) => (activeBuild!.nodeAllocations[prereqId] ?? 0) > 0
  )
  if (!prereqsMet) {
    return { success: false, error: 'Prerequisite not met' }
  }

  // Calculate allocatable points — bounded by budget if enforced
  let toAllocate = nodeSpace
  if (activeBuild.budgetEnforced) {
    const available = calculatePassivePoints(activeBuild.characterLevel)
    const allocated = Object.values(activeBuild.nodeAllocations).reduce((sum, v) => sum + v, 0)
    const budget = available - allocated
    if (budget <= 0) return { success: false }
    toAllocate = Math.min(nodeSpace, budget)
  }

  const newPoints = current + toAllocate
  const newNodeAllocations = { ...activeBuild.nodeAllocations, [nodeId]: newPoints }
  const newActiveBuild: BuildState = {
    ...activeBuild,
    nodeAllocations: newNodeAllocations,
    updatedAt: new Date().toISOString(),
  }
  const newUndoStack = [...state.undoStack, activeBuild].slice(-MAX_UNDO_STACK)
  set({ activeBuild: newActiveBuild, undoStack: newUndoStack, redoStack: [] })
  return { success: true }
},
```

> **Auto-create body:** Must be a VERBATIM copy of the auto-create block in `applyNodeChange` (lines 155–178). Any drift between the two will cause inconsistent behavior. If the auto-create block ever changes, update both locations.

> **Single `set()` call:** ALL points allocated in one `set()` — one undo entry, one React render, one rAF scoring cycle. This satisfies AC2's "single batch" requirement.

> **No `applySkillNodeChangeBulk` / `applyWeaverNodeChangeBulk`:** Out of story scope. Do not add them.

---

### Task 7: `useSkillTree.ts` — Route Shift+click to `applyNodeChangeBulk`

**File:** `lebo/src/features/skill-tree/useSkillTree.ts`

**Add store subscription** (after `applySkillNodeChange`):
```typescript
const applyNodeChangeBulk = useBuildStore((s) => s.applyNodeChangeBulk)
```

**Update `SkillTreeInteraction.handleNodeClick` signature:**
```typescript
handleNodeClick: (nodeId: string, button: 0 | 2, shiftKey?: boolean) => void
```

**Update `handleNodeClick` implementation:**
```typescript
const handleNodeClick = useCallback(
  (nodeId: string, button: 0 | 2, shiftKey?: boolean) => {
    if (!treeData) return

    // Shift+left-click on passive tree: allocate as many points as budget allows
    if (button === 0 && shiftKey && slotId === undefined) {
      const result = applyNodeChangeBulk(nodeId, treeData)
      if (!result.success && result.error) {
        setNodeError({ nodeId, message: result.error })
        setFlashNodeIds([nodeId])
      }
      return
    }

    const delta: 1 | -1 = button === 2 ? -1 : 1
    const result =
      slotId !== undefined
        ? applySkillNodeChange(slotId, nodeId, delta, treeData)
        : applyNodeChange(nodeId, delta, treeData)
    if (!result.success && result.error) {
      setNodeError({ nodeId, message: result.error })
      if (button === 2 && result.blockedByDependents && result.blockedByDependents.length > 0) {
        setFlashNodeIds([...result.blockedByDependents])
      } else {
        setFlashNodeIds([nodeId])
      }
    }
  },
  [treeData, slotId, applyNodeChange, applySkillNodeChange, applyNodeChangeBulk]
)
```

> **`slotId === undefined` guard:** Shift+click bulk only for passive tree. Skill trees (`slotId !== undefined`) fall through to regular single-point allocation. Weaver tree uses a separate `handleWeaverNodeClick` in `SkillTreeView.tsx` — it calls `applyWeaverNodeChange` which doesn't support bulk; Shift+click on weaver = same as regular click.

> **Error + flash:** On failed bulk allocation (prereq not met, budget 0), show error tooltip and flash the node — same pattern as single-point failures.

> **Dependency array:** Add `applyNodeChangeBulk` to the `useCallback` dependencies. TypeScript strict mode will catch it if missing.

---

### Task 8: `buildStore.test.ts` — `applyNodeChangeBulk` tests

**File:** `lebo/src/shared/stores/buildStore.test.ts`

Add a new `describe` block after the existing `applyNodeChange` tests. Look at how `makeMockTreeData()` or the existing tree data fixture is constructed in the existing tests — reuse the same helper.

```typescript
describe('applyNodeChangeBulk', () => {
  beforeEach(() => {
    useBuildStore.setState({
      selectedClassId: 'void-knight',
      selectedMasteryId: 'void-knight',
      activeBuild: null,
      undoStack: [],
      redoStack: [],
    })
  })

  it('allocates all node points when budget is unlimited (budgetEnforced: false)', () => {
    const mockTreeData = makeMockTreeData()  // node-1 has maxPoints: 5
    useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['node-1']).toBe(5)
  })

  it('allocates up to budget when budgetEnforced: true and budget < node max', () => {
    const mockTreeData = makeMockTreeData()
    // Set up a build with budgetEnforced:true, level 6 (4 passive points), 0 allocated
    useBuildStore.getState().createBuild('Void Knight')
    useBuildStore.setState((s) => ({
      activeBuild: s.activeBuild ? { ...s.activeBuild, characterLevel: 6, budgetEnforced: true } : null
    }))
    // calculatePassivePoints(6) = 4
    useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['node-1']).toBe(4)
  })

  it('returns success: false when node is already at max', () => {
    const mockTreeData = makeMockTreeData()
    // First allocation: fill the node completely
    useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['node-1']).toBe(5)
    // Second Shift+click: already at max
    const result = useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    expect(result.success).toBe(false)
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['node-1']).toBe(5)
  })

  it('returns Prerequisite not met when prereq is unallocated', () => {
    const mockTreeData = makeMockTreeData()  // node-2 requires node-1
    const result = useBuildStore.getState().applyNodeChangeBulk('node-2', mockTreeData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Prerequisite not met')
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('pushes exactly ONE snapshot to undoStack regardless of points allocated', () => {
    const mockTreeData = makeMockTreeData()
    useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    // Should be exactly 1 undo entry even though 5 points were allocated
    expect(useBuildStore.getState().undoStack).toHaveLength(1)
  })

  it('clears redoStack', () => {
    const mockTreeData = makeMockTreeData()
    // Manufacture a redo entry
    useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    useBuildStore.getState().undoNodeChange()
    expect(useBuildStore.getState().redoStack).toHaveLength(1)
    useBuildStore.getState().applyNodeChangeBulk('node-1', mockTreeData)
    expect(useBuildStore.getState().redoStack).toHaveLength(0)
  })
})
```

> **`makeMockTreeData` helper:** Look at how the existing `applyNodeChange` tests set up tree data — the helper or inline tree data is already established in the test file. Reuse it. Do NOT create a duplicate helper.

> **`calculatePassivePoints(6) = 4`:** Level 6 → `6 - 2 = 4` passive points. Verify this matches `budgetCalculator.ts` before writing the test.

---

### Task 9: `NodeTooltip.test.tsx` — Scrollable container tests

**File:** `lebo/src/features/skill-tree/NodeTooltip.test.tsx`

Add after the existing `describe('NodeTooltip')` tests:

```typescript
it('renders with maxHeight 60vh and overflowY auto', () => {
  const { container } = render(
    <NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />
  )
  // The tooltip div is portaled to body — query document.body
  const tooltip = document.body.querySelector('[style*="60vh"]')
  expect(tooltip).not.toBeNull()
})

it('renders with pointerEvents auto (not none)', () => {
  render(<NodeTooltip gameNode={mockNode} allocatedPoints={3} position={position} />)
  // If pointerEvents were 'none', mouse events would be blocked
  // We verify the style does NOT contain pointer-events: none
  const tooltip = document.body.querySelector('div[style*="position: fixed"]')
  expect(tooltip).not.toBeNull()
  const style = (tooltip as HTMLElement).style
  expect(style.pointerEvents).not.toBe('none')
})

it('calls onMouseEnter when provided', () => {
  const onMouseEnter = vi.fn()
  render(
    <NodeTooltip
      gameNode={mockNode}
      allocatedPoints={3}
      position={position}
      onMouseEnter={onMouseEnter}
    />
  )
  const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
  fireEvent.mouseEnter(tooltip)
  expect(onMouseEnter).toHaveBeenCalledTimes(1)
})

it('calls onMouseLeave when provided', () => {
  const onMouseLeave = vi.fn()
  render(
    <NodeTooltip
      gameNode={mockNode}
      allocatedPoints={3}
      position={position}
      onMouseLeave={onMouseLeave}
    />
  )
  const tooltip = document.body.querySelector('div[style*="position: fixed"]') as HTMLElement
  fireEvent.mouseLeave(tooltip)
  expect(onMouseLeave).toHaveBeenCalledTimes(1)
})
```

> **Import:** Add `fireEvent` to the existing `@testing-library/react` import. `vi` is already available as a global via `vitest/globals`.

> **Portal query:** `NodeTooltip` portals to `document.body`. Tests must query `document.body`, not `container`. This matches the existing test pattern in this file (see how `getByText` already works on portaled content — RTL queries the full document by default).

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/features/skill-tree/NodeTooltip.tsx` | MODIFY | Add `maxHeight`, `overflowY`, `pointerEvents: 'auto'`, `onWheel`, `onMouseEnter?`, `onMouseLeave?` props |
| `lebo/src/features/skill-tree/useSkillTree.ts` | MODIFY | Grace timer for `hoveredNodeId` clear; `handleTooltipEnter`/`handleTooltipLeave`; `applyNodeChangeBulk` subscription; updated `handleNodeClick` signature |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | MODIFY | Destructure new callbacks from interactions; pass to 3 hover `NodeTooltip` instances |
| `lebo/src/features/skill-tree/types.ts` | MODIFY | Add `shiftKey?` to `RendererCallbacks.onNodeClick` and `SkillTreeCanvasProps.onNodeClick` |
| `lebo/src/features/skill-tree/pixiRenderer.ts` | MODIFY | Pass `e.shiftKey` in `pointerup` handler |
| `lebo/src/shared/stores/buildStore.ts` | MODIFY | Add `applyNodeChangeBulk` to interface + implementation |
| `lebo/src/shared/stores/buildStore.test.ts` | MODIFY | Add `applyNodeChangeBulk` test block |
| `lebo/src/features/skill-tree/NodeTooltip.test.tsx` | MODIFY | Add scroll/pointer/callback tests |

**Do NOT touch:**
- `SkillTreeCanvas.tsx` — optional `shiftKey?` is backward-compatible; no changes required
- Any Rust files — pure frontend story
- `pixiRenderer.ts` `pointerdown` right-click handler — unchanged
- `SkillTreeCanvas.tsx` keyboard overlay `onClick` — keyboard activation never needs shiftKey for bulk

---

## Architecture & Pattern Compliance

**Four stores rule:** No new stores. `buildStore.ts` only.

**No barrel files:** Import `useBuildStore` directly from `'../../shared/stores/buildStore'`.

**TypeScript strict mode:**
- `applyNodeChangeBulk` must be added to BOTH the `BuildStore` interface AND the implementation body
- `handleTooltipEnter`/`handleTooltipLeave` must be added to BOTH `SkillTreeInteraction` interface AND `useSkillTree` return object
- Run `pnpm build` from `lebo/` after all changes — zero errors required

**Tailwind v4 / inline styles:** All new `NodeTooltip` styles use inline `style` props (consistent with existing `baseStyle` pattern).

**Stable module-level constants:** No new empty constants needed for this story.

**`useRef` timer pattern:** Using `useRef<ReturnType<typeof setTimeout> | null>` (not `useRef<NodeJS.Timeout | null>`) — the app runs in browser context; `setTimeout` returns `number`. Either works but `ReturnType<typeof setTimeout>` is technically correct for browser.

---

## Previous Story Intelligence (from 6.3)

- **14 pre-existing test failures** — unchanged since Story 6.1. Do not diagnose or fix them. Run only the relevant test files for this story.
- **`pnpm build` is the TypeScript truth:** Run after all changes to catch unused vars and type errors.
- **Tailwind v4 pattern:** Inline `style` props for non-standard CSS values. Never `@apply`.
- **`onFocus`/`onBlur` focus ring pattern:** Other buttons in this codebase use onFocus/onBlur for 2px solid accent-gold. Not needed here (NodeTooltip is not focusable).
- **PNG tiles:** Background files are `.png` (not `.webp`) — established in 6.2. Not relevant to this story but don't accidentally rename them if touching `pixiRenderer.ts`.
- **`SkillTreeInteraction` interface:** Lives in `useSkillTree.ts` (not a shared types file). Adding members requires updating both the interface AND the return object.

---

## Potential Pitfalls / Guardrails

1. **Grace timer and the `setNodeError(null)` call:** The old `handleNodeHover(null)` called `setNodeError(null)` immediately. The new version defers it inside the 50ms timer. Error tooltips (`nodeError` state) will persist for 50ms after the mouse leaves a node. This is acceptable — the error display timeout (`ERROR_DISPLAY_MS = 2000`) means errors disappear on their own schedule anyway.

2. **Three separate tooltip hover pairs (passive, skill, weaver):** Each canvas has its OWN `useSkillTree` instance. The callbacks returned by `passiveInteraction`, `skillInteraction`, and `weaverInteraction` are SEPARATE — the passive hover grace timer doesn't interfere with the weaver hover grace timer.

3. **`weaverInteraction` destructuring:** Currently in `SkillTreeView.tsx`, weaver interaction members are individually extracted (`const { setNodeError: setWeaverNodeError } = weaverInteraction`). Make sure the new `handleTooltipEnter`/`handleTooltipLeave` destructuring for weaver uses unique aliases (e.g., `handleWeaverTooltipEnter`) to avoid shadowing the passive/skill ones.

4. **`applyNodeChangeBulk` auto-create block:** The auto-create logic (lines 155–178 in buildStore.ts) must be replicated verbatim. If you deviate, newly started builds won't auto-create on Shift+click. Verify the full auto-create block structure matches `applyNodeChange`.

5. **`types.ts` is the shared contract:** Both `RendererCallbacks` and `SkillTreeCanvasProps` must be updated. TypeScript will error if `SkillTreeCanvas.tsx`'s `callbacksRef` type doesn't match after the update. Since `shiftKey?` is optional, existing call sites that don't pass it compile fine.

6. **`SkillTreeInteraction.handleNodeClick` type update:** The interface member type must change to `(nodeId: string, button: 0 | 2, shiftKey?: boolean) => void`. Since `SkillTreeCanvas.tsx` accesses `onNodeClick` via `callbacksRef.current`, which is typed as `RendererCallbacks`, TypeScript propagates this change. Verify no callers are broken.

7. **Test portal queries:** `NodeTooltip` renders to `document.body` via `createPortal`. In tests, `container` returned by `render()` is an empty wrapper. All assertions must use `document.body.querySelector(...)` or rely on RTL's global `screen` queries (which search the full document). The existing test file uses `screen.getByText(...)` which already works correctly for portals.

8. **`fireEvent.mouseEnter` vs `userEvent.hover`:** `@testing-library/user-event` `hover` fires synthetic events. For the mouse enter/leave callbacks, `fireEvent.mouseEnter`/`fireEvent.mouseLeave` is simpler and sufficient since we're just testing that the prop callback fires.

---

## Verification Commands

```bash
# From lebo/:
pnpm build                                                   # Zero TS errors (critical)
pnpm vitest src/shared/stores/buildStore.test.ts             # applyNodeChangeBulk tests pass
pnpm vitest src/features/skill-tree/NodeTooltip.test.tsx     # Scroll/pointer/callback tests pass
pnpm vitest src/features/skill-tree/useSkillTree.test.ts     # Existing tests still pass (if file exists)
pnpm vitest                                                  # Full suite — 14 pre-existing failures unchanged
```

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6 (2026-05-27)

### Completion Notes List

### Review Findings

### File List
