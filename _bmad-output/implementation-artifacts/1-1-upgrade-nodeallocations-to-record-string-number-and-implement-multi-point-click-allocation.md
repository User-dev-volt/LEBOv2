# Story 1.1: Upgrade nodeAllocations to Record<string, number> and Implement Multi-Point Click Allocation

Status: done

## Story

As a theory-crafter,
I want to left-click a skill node to add a point and right-click to remove a point, seeing a `current/max` counter in each node,
so that I can allocate skill tree points with familiar PoB-style interactions.

## Acceptance Criteria

1. **Given** SkillTreeCanvas currently receives `allocatedNodes: Record<string, number>`  
   **When** the prop is renamed to `nodeAllocations: Record<string, number>` throughout SkillTreeCanvas.tsx, pixiRenderer.ts (RendererInstance interface), and all call sites  
   **Then** all existing allocation rendering still works and no TypeScript errors remain

2. **Given** a skill tree is displayed and a node has maxPoints > 1  
   **When** the player left-clicks the node  
   **Then** the node's allocation increments by 1 (up to maxPoints), the `current/max` counter inside the node updates immediately, and `onNodeClick(nodeId, 0)` is emitted

3. **Given** a node with allocation > 0  
   **When** the player right-clicks the node  
   **Then** the allocation decrements by 1 (down to 0), the counter updates, and `onNodeClick(nodeId, 2)` is emitted

4. **Given** a node at its maxPoints  
   **When** the player left-clicks it  
   **Then** the allocation does not increase beyond maxPoints and no state change is emitted

5. **Given** a node at allocation 0  
   **When** the player right-clicks it  
   **Then** the allocation does not go below 0 and no state change is emitted

6. **Given** the SkillTreeCanvas `onNodeClick` handler receives `(nodeId: string, button: 0 | 2)`  
   **When** `applyNodeChange(nodeId, delta, treeData)` is called in useBuildStore with delta +1 or -1  
   **Then** the nodeAllocations Record updates correctly and the component re-renders with the new counter value

7. **And** the `current/max` counter is rendered **inside** the hexagonal node in PixiJS using monospace font at 10px/700 weight, visible only when allocation > 0

## Tasks / Subtasks

- [x] Task 1: Move shared tree types to `src/shared/types/treeData.ts` (AC: #1, #6)
  - [x] Create `src/shared/types/treeData.ts` exporting `NodeSize`, `NodeState`, `TreeNode`, `TreeEdge`, `TreeData`, `HighlightedNodes`
  - [x] Update `src/features/skill-tree/types.ts` to re-export from shared (or import directly — no barrel files)
  - [x] Update all existing imports of these types in skill-tree feature files

- [x] Task 2: Rename `allocatedNodes` → `nodeAllocations` throughout (AC: #1)
  - [x] `src/features/skill-tree/types.ts`: rename in `SkillTreeCanvasProps` and `RendererInstance.renderTree` signature
  - [x] `src/features/skill-tree/SkillTreeCanvas.tsx`: rename in destructuring and all internal usages
  - [x] `src/features/skill-tree/pixiRenderer.ts`: rename in `renderTree` function parameter
  - [x] `src/features/skill-tree/SkillTreeView.tsx`: rename in the `<SkillTreeCanvas>` JSX prop
  - [x] `src/features/skill-tree/SkillTreeCanvas.test.tsx`: rename in `DEFAULT_PROPS`

- [x] Task 3: Unify click handlers into `onNodeClick(nodeId, button: 0 | 2)` (AC: #2, #3)
  - [x] `src/features/skill-tree/types.ts`: change `SkillTreeCanvasProps` — remove `onNodeRightClick`, change `onNodeClick: (nodeId: string) => void` → `onNodeClick: (nodeId: string, button: 0 | 2) => void`; same change to `RendererCallbacks`
  - [x] `src/features/skill-tree/SkillTreeCanvas.tsx`: update destructuring (remove `onNodeRightClick`); update keyboard handler — `onNodeClick(id, 0)` on Enter/Space; update `onContextMenu` → `onNodeClick(id, 2)`
  - [x] `src/features/skill-tree/pixiRenderer.ts`: update `callbacksRef.current.onNodeClick(node.id)` → `callbacksRef.current.onNodeClick(node.id, 0)` on left click; `callbacksRef.current.onNodeClick(node.id, 2)` on right click; remove `onNodeRightClick` from `RendererCallbacks`
  - [x] `src/features/skill-tree/useSkillTree.ts`: replace separate `handleNodeClick`/`handleNodeRightClick` with single handler dispatching on button; update `SkillTreeInteraction` interface
  - [x] `src/features/skill-tree/SkillTreeView.tsx`: remove `onNodeRightClick` prop, update `onNodeClick` prop

- [x] Task 4: Update `applyNodeChange` signature to accept `treeData` (AC: #6)
  - [x] `src/shared/stores/buildStore.ts`: change signature from `(nodeId, delta, gameNode: GameNode, allGameNodes: Record<string, GameNode>)` → `(nodeId, delta, treeData: TreeData)` (import `TreeData` from `src/shared/types/treeData.ts`)
  - [x] Update prerequisite check: find nodes in `treeData` by nodeId, use `node.maxPoints`; for prerequisites use edges where `edge.toId === nodeId` → `edge.fromId` must be allocated
  - [x] Update dependent check: edges where `edge.fromId === nodeId` → those `edge.toId` nodes with allocation > 0 block decrement
  - [x] Remove import of `GameNode` from `buildStore.ts` (no longer needed)
  - [x] `src/features/skill-tree/useSkillTree.ts`: update calls — pass `treeData` instead of `gameNode + allGameNodes`; receive `treeData` as parameter from `SkillTreeView`
  - [x] `src/features/skill-tree/SkillTreeView.tsx`: pass `treeData` to `useSkillTree(treeData)` instead of `allGameNodes`
  - [x] `src/shared/stores/buildStore.test.ts`: update test calls to new signature

- [x] Task 5: Fix counter rendering inside node (AC: #7)
  - [x] `src/features/skill-tree/pixiRenderer.ts`: change counter position from `node.y + r + 3` (below) to `node.y + r * 0.35` (inside, lower-half of node)
  - [x] Set `fontWeight: '700'` (bold) in the Text style
  - [x] Wrap label creation in `if (currentPts > 0)` guard — hide label when allocation is 0

- [x] Task 6: Update tests (AC: all)
  - [x] `src/features/skill-tree/SkillTreeCanvas.test.tsx`: rename `allocatedNodes` → `nodeAllocations` in `DEFAULT_PROPS`; update `onNodeRightClick` mock → remove from DEFAULT_PROPS; update Enter key test to verify `onNodeClick` called with `(nodeId, 0)`
  - [x] `src/features/skill-tree/pixiRenderer.test.ts`: update any signature changes
  - [x] `src/shared/stores/buildStore.test.ts`: update `applyNodeChange` test calls to new signature
  - [x] Run `pnpm test` and verify all pass

- [x] Task 7: TypeScript strict-mode check
  - [x] Run `pnpm tsc --noEmit` from `lebo/` — zero errors required

## Dev Notes

### Critical Phase 1 Reality — Read Before Touching Anything

**The allocation type is ALREADY `Record<string, number>` in Phase 1.** `BuildState.nodeAllocations` and `buildStore.applyNodeChange` already support multi-point allocation with `maxPoints`, prerequisite checks, and dependent checks. The architecture doc describes the _target_ state; the Phase 1 code is already partially there.

What Story 1.1 actually changes:
1. **Prop rename only** — `allocatedNodes` → `nodeAllocations` in the canvas interface (value type `Record<string, number>` is unchanged)
2. **Click handler unification** — two separate callbacks merged into one with a `button` discriminant
3. **Store signature** — `applyNodeChange` params change from `(gameNode, allGameNodes)` to `(treeData)`; the validation logic itself is essentially the same, just deriving info from `treeData` instead of `GameNode`
4. **Counter tweak** — move from below node to inside node; add visibility guard

Do NOT rewrite `applyNodeChange` from scratch — extend the existing logic.

### Type Architecture — `TreeData` Must Move to Shared

`buildStore.ts` is in `src/shared/stores/` and cannot import from `src/features/skill-tree/`. Move the tree type interfaces to `src/shared/types/treeData.ts`:

```typescript
// src/shared/types/treeData.ts (NEW FILE)
export type NodeSize = 'small' | 'medium' | 'large'
export type NodeState = 'allocated' | 'available' | 'locked' | 'suggested'

export interface HighlightedNodes {
  glowing: Set<string>
  dimmed: Set<string>
  previewRemoved: Set<string>
  previewAdded: Set<string>
}

export interface TreeNode {
  id: string
  x: number
  y: number
  size: NodeSize
  maxPoints: number
  connections: string[]
  state: NodeState
}

export interface TreeEdge {
  fromId: string
  toId: string
}

export interface TreeData {
  nodes: TreeNode[]
  edges: TreeEdge[]
}
```

Then in `src/features/skill-tree/types.ts`, replace the existing definitions with imports from the shared types:
```typescript
export type { NodeSize, NodeState, HighlightedNodes, TreeNode, TreeEdge, TreeData } from '../../shared/types/treeData'
// Keep RendererCallbacks, RendererInstance, SkillTreeCanvasProps here — they are feature-local
```

No barrel file. Direct imports from source only. [Source: project-context.md#Critical Implementation Rules]

### `applyNodeChange` Signature Change Detail

Current Phase 1 signature:
```typescript
applyNodeChange: (nodeId: string, delta: number, gameNode: GameNode, allGameNodes: Record<string, GameNode>) => ApplyNodeResult
```

New target signature:
```typescript
applyNodeChange: (nodeId: string, delta: number, treeData: TreeData) => ApplyNodeResult
```

The validation logic translates as follows:
- `gameNode.maxPoints` → `treeData.nodes.find(n => n.id === nodeId)?.maxPoints ?? 1`
- Prerequisite check: `gameNode.prerequisiteNodeIds.every(id => allocations[id] > 0)` → use edges where `edge.toId === nodeId`; those `edge.fromId` nodes must have allocation > 0. **Important:** In `treeData.edges`, `fromId → toId` means "fromId is a prerequisite of toId". So to find prerequisites of a node: `treeData.edges.filter(e => e.toId === nodeId).map(e => e.fromId)`.
- Dependent check: nodes that depend ON `nodeId` = `treeData.edges.filter(e => e.fromId === nodeId).map(e => e.toId)` — if any of those have allocation > 0, decrement is blocked.

Early return if `treeData.nodes.find(n => n.id === nodeId)` is undefined (defensive, should not happen).

Build a `nodeMap: Map<string, TreeNode>` at the start of the function for O(1) lookups instead of repeated `.find()`.

[Source: architecture.md#Decision 2]

### Click Handler Unification Detail

`RendererCallbacks` and `SkillTreeCanvasProps` both currently have separate `onNodeClick` and `onNodeRightClick`. Both need to be unified.

In `pixiRenderer.ts` `renderTree` function, the pointerdown handler already reads `e.button`:
```typescript
hit.on('pointerdown', (e) => {
  e.stopPropagation()
  if (e.button === 2) {
    callbacksRef.current.onNodeRightClick(node.id)
  } else {
    callbacksRef.current.onNodeClick(node.id)
  }
})
```

Change to:
```typescript
hit.on('pointerdown', (e) => {
  e.stopPropagation()
  callbacksRef.current.onNodeClick(node.id, e.button === 2 ? 2 : 0)
})
```

In `SkillTreeCanvas.tsx`, the keyboard overlay's Enter/Space handler currently calls `onNodeClick(id)` — change to `onNodeClick(id, 0)`. The `onContextMenu` on the button element currently calls `onNodeRightClick(id)` — change to `onNodeClick(id, 2)`.

In `useSkillTree.ts`, the unified handler:
```typescript
const handleNodeClick = useCallback(
  (nodeId: string, button: 0 | 2) => {
    const delta = button === 2 ? -1 : 1
    const result = applyNodeChange(nodeId, delta, treeData)
    if (!result.success && result.error) {
      setNodeError({ nodeId, message: result.error })
    }
  },
  [treeData, applyNodeChange]
)
```

Remove `handleNodeRightClick` from `SkillTreeInteraction` interface and from `SkillTreeView.tsx` props.

`useSkillTree` must now accept `treeData: TreeData` as its parameter (currently accepts `allGameNodes: Record<string, GameNode>`). Update the call site in `SkillTreeView.tsx`:
```typescript
const { ..., handleNodeClick, ... } = useSkillTree(treeData)
```

Note: `SkillTreeView.tsx` already has `treeData` in scope (built via `buildTreeData`). When `treeData` is null (no class selected), `useSkillTree` is called with null — the handler should early-return if `treeData` is null. Handle this with `useSkillTree(treeData: TreeData | null)` and guard inside.

[Source: architecture.md#Decision 5]

### Counter Rendering Inside Node

Current (wrong — below node):
```typescript
label.y = node.y + r + 3
```

Target (inside node — lower half):
```typescript
// Show current/max only when allocated
if (currentPts > 0) {
  const label = new Text({
    text: `${currentPts}/${node.maxPoints}`,
    style: {
      fontSize: 10,
      fontWeight: '700',
      fill: labelColor,
      fontFamily: 'monospace',
      align: 'center',
    },
  })
  label.anchor.set(0.5, 0.5)  // center anchor
  label.x = node.x
  label.y = node.y + r * 0.35  // slightly below node center, still inside hex
  labelContainer.addChild(label)
}
```

The existing label code currently runs for ALL nodes (including 0-allocation). Wrap it in `if (currentPts > 0)` — this is the critical change preventing label noise.

The `labelColor` logic already exists and is correct — keep it as-is, just guard the outer block.

[Source: epics.md#Story 1.1, UX-DR12]

### Existing Test Patterns to Follow

`SkillTreeCanvas.test.tsx` mocks `pixiRenderer` via `vi.mock('./pixiRenderer', ...)` — do not change this approach. When adding tests for the unified click handler:
- Fire `onContextMenu` on a button to test right-click path → expects `onNodeClick(nodeId, 2)`
- Fire `keyDown` with `Enter` → expects `onNodeClick(nodeId, 0)`

`buildStore.test.ts` currently calls `applyNodeChange(nodeId, 1, mockGameNode, mockAllGameNodes)`. Update these calls to pass a mock `TreeData` with appropriate `nodes` and `edges`. Pattern from existing test: build a minimal `TreeData` with the nodes under test and their edges.

Mock pattern for Tauri IPC is `vi.mock('../../shared/utils/invokeCommand', ...)` — do not use raw `invoke()`. [Source: project-context.md#Testing Rules]

### File Change Checklist

Files to **create**:
- `lebo/src/shared/types/treeData.ts`

Files to **modify**:
- `lebo/src/features/skill-tree/types.ts` (re-export from shared, update SkillTreeCanvasProps + RendererCallbacks)
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` (prop rename, click handler unification)
- `lebo/src/features/skill-tree/pixiRenderer.ts` (prop rename, click unification, counter fix)
- `lebo/src/features/skill-tree/SkillTreeView.tsx` (prop rename, remove onNodeRightClick, pass treeData to useSkillTree)
- `lebo/src/features/skill-tree/useSkillTree.ts` (accept treeData, unified handler, remove handleNodeRightClick)
- `lebo/src/shared/stores/buildStore.ts` (applyNodeChange signature, import TreeData)
- `lebo/src/shared/stores/buildStore.test.ts` (update test calls)
- `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` (rename prop, update click handler expectations)
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` (update if needed)
- `lebo/src/features/optimization/SuggestionsList.tsx` (update applyNodeChange call sites)
- `lebo/src/features/skill-tree/useSkillTree.test.ts` (update to TreeData API)

Files **not to touch** (risk of regression):
- `treeDataTransformer.ts` — transforms `GameNode` → `TreeNode`; leave unchanged
- `buildPersistence.ts` — save/load logic; untouched in Story 1.1
- `NodeTooltip.tsx` — hover tooltip; untouched
- Any optimization store files
- Any Rust backend files

### Project Structure Notes

- All imports are direct — no barrel files (`index.ts`) anywhere in `src/`. [Source: project-context.md]
- `src/shared/types/treeData.ts` follows the `camelCase.ts` naming convention for utilities/types. [Source: project-context.md#Naming conventions]
- No new Zustand stores — extending `useBuildStore` only. [Source: architecture.md#Brownfield constraint]
- TypeScript strict mode: `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Every unused import is a compile error after removing `GameNode` import from `buildStore.ts`. [Source: project-context.md]

### References

- [Source: architecture.md#Decision 2] — `nodeAllocations` type upgrade, `applyNodeChange` behavior
- [Source: architecture.md#Decision 5] — `SkillTreeCanvasProps` new interface including `onNodeClick: (nodeId, button: 0|2)`
- [Source: epics.md#Story 1.1] — full acceptance criteria
- [Source: project-context.md#Framework-Specific Rules] — SkillTreeCanvas props-only, store patterns
- [Source: lebo/src/features/skill-tree/types.ts] — current interface definitions
- [Source: lebo/src/features/skill-tree/pixiRenderer.ts] — current rendering and click handling
- [Source: lebo/src/features/skill-tree/useSkillTree.ts] — current click dispatch to store
- [Source: lebo/src/shared/stores/buildStore.ts] — existing applyNodeChange implementation

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A — no blocking issues encountered. `SuggestionsList.tsx` and `useSkillTree.test.ts` required updates not listed in the original file change checklist due to the `applyNodeChange` signature change rippling to those files.

### Completion Notes List

- Created `lebo/src/shared/types/treeData.ts` with all shared tree types; `types.ts` now re-exports them.
- `delta` type kept as `number` (not `1 | -1`) to preserve `SuggestionsList.tsx`'s multi-point bulk apply logic — the UI layer only ever passes `±1`.
- `treeData` useMemo moved above `useSkillTree()` call in `SkillTreeView.tsx` to satisfy the new dependency.
- Counter now renders only when `currentPts > 0`, positioned at `node.y + r * 0.35` (inside node lower half), bold monospace.
- Pre-existing Settings/ProviderSelector test failures (6 tests) confirmed unrelated to this story.

### File List

- `lebo/src/shared/types/treeData.ts` — created
- `lebo/src/features/skill-tree/types.ts` — modified
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` — modified
- `lebo/src/features/skill-tree/pixiRenderer.ts` — modified
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — modified
- `lebo/src/features/skill-tree/useSkillTree.ts` — modified
- `lebo/src/shared/stores/buildStore.ts` — modified
- `lebo/src/shared/stores/buildStore.test.ts` — modified
- `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` — modified
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` — modified
- `lebo/src/features/skill-tree/useSkillTree.test.ts` — modified
- `lebo/src/features/optimization/SuggestionsList.tsx` — modified
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — modified

### Review Findings

- [x] [Review][Patch] Local var `allocatedNodes` uses deprecated name — rename to `nodeAllocations` [`lebo/src/features/skill-tree/SkillTreeView.tsx:107`]
- [x] [Review][Patch] Missing test for AC#4 maxPoints cap — add case that clicks root 6 times (maxPoints=5) and asserts no state change on 6th [`lebo/src/shared/stores/buildStore.test.ts`]
- [x] [Review][Defer] Silent failure on missing nodeId — `applyNodeChange` returns `{ success: false }` with no `error` field when node not found [`lebo/src/shared/stores/buildStore.ts:96`] — deferred, pre-existing defensive guard
- [x] [Review][Defer] `new Text()` GC pressure — Text objects created/destroyed every `renderTree` call, no object pooling [`lebo/src/features/skill-tree/pixiRenderer.ts:245`] — deferred, pre-existing render pattern

## Change Log

| Date | Change |
|------|--------|
| 2026-05-06 | Story 1.1 implemented: shared treeData types, nodeAllocations rename, unified click handler, applyNodeChange signature migration, counter inside node (82 tests pass, 0 TS errors) |
