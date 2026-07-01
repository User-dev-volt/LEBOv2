# Story 3.5: Right-click remove all points with orphan cascade

Status: ready-for-dev

<!-- Epic 3: Passive Tree Optimizer & Allocation — final story. Partner to Story 3.4 (fillNodeToMax). FR-45, Pattern P4-7, NFR-6. -->
<!-- GESTURE (Alec-confirmed, supersedes FR-45's literal "right-click"): right-click = remove ONE (unchanged); SHIFT+right-click = remove ALL + orphan cascade. Mirrors 3.4's shift+left = fill-to-max. -->

## Story

As a player,
I want **shift+right-click** to remove all points from a passive node in one action (while plain right-click still removes a single point),
so that I can clear a node and its dependents instantly without losing fine-grained single-point control.

## Acceptance Criteria

1. **(AC1 — simple remove)** Given an allocated passive node with **no dependent allocated children**, When I **shift+right-click** it, Then all its points are removed in one action as a **single undo step** via `buildStore.removeAllPoints` (FR-45 spirit, Pattern P4-7). No confirmation prompt appears.
2. **(AC2 — orphan cascade, with MANDATORY confirmation)** Given an allocated passive node whose removal would **orphan allocated child nodes**, When I **shift+right-click** it, Then a confirmation prompt **names the orphaned nodes** (`"Removing this node will also deallocate: [Node A], [Node B]. Continue?"`) **And** on confirm, the node and its orphaned children are deallocated **together in one single undo step**; on cancel, nothing changes. The confirmation is **mandatory whenever the removal would cascade to ANY other allocated node** (`orphans.length > 0`) — it is the primary misclick safeguard so a user never silently loses downstream nodes; one `undoNodeChange()` is the secondary backstop, restoring the node and every orphan at once.
3. **(AC3 — single point preserved)** Given an allocated passive node, When I **right-click without shift**, Then exactly **one** point is removed (existing `applyNodeChange(-1)` behavior — including the existing "blocked, flash dependents" guard when removing the last point would orphan a direct child). This story does **not** change plain right-click.

**Derived / non-negotiable criteria (implied by the system; must also hold):**

4. The whole cascade is **exactly one** `undoStack` entry — one `undoNodeChange()` restores the node **and** every cascaded orphan in a single step. `redoStack` is cleared. Never a loop of `applyNodeChange` calls (Pattern P4-7, NFR-6).
5. Shift+right-click remove-all is **passive-tree only** (`slotId === undefined`), mirroring `fillNodeToMax`. On skill slots and the weaver tree, shift+right-click falls through to the normal single-decrement (no remove-all) — unchanged behavior.
6. Shift+right-clicking an **unallocated** node is a no-op — no removal, no snapshot, no spurious undo entry.
7. Removal/cascade is **value-exact**: the target key and every orphaned-child key are deleted (key absent, never stored as `0`); every untouched allocation keeps its exact prior value.
8. **A11y / keyboard parity:** the focused-node DOM context-menu path forwards `shiftKey`, so a keyboard user pressing Shift + the context-menu key gets remove-all, and the menu key alone gets remove-one.

---

## ⚠️ READ FIRST — Reconcile map (verified against the live working tree, not HEAD)

The core action is **absent** and must be authored. The good news from the chosen gesture model: remove-all rides the **existing `onNodeClick(nodeId, button, shiftKey)` plumbing** (button===2 + shiftKey), exactly like 3.4's shift+left fill — so plain right-click stays put and the inert `onNodeContextMenu` / `NodeContextMenu.tsx` scaffold is **not** touched.

| 3.5 element | State on disk | Action |
|---|---|---|
| `buildStore.removeAllPoints` | **ABSENT** (0 hits in `lebo/src`; only `_bmad-output/` docs match) | **AUTHOR IT** — mirror `fillNodeToMax` (`buildStore.ts:253-321`) |
| `fillNodeToMax` (structural twin) | **REAL** `buildStore.ts:34-37` (iface), `:253-321` (impl) | **Read & mirror — do NOT modify** (3.4) |
| Orphan-cascade reachability logic | **ABSENT** anywhere (`orphan`/`reachab`/`cascade` → 0 hits) | **AUTHOR** new pure helper `computeOrphanedNodes.ts` |
| Single-hop dependent **BLOCK** | **REAL** `buildStore.ts:221-233` (inside `applyNodeChange`, `delta<0 && newPoints===0`) — *blocks* single-point removal, returns `blockedByDependents` | **Leave it** — it serves plain right-click (remove-one, AC3); `removeAllPoints` deliberately bypasses it |
| `ApplyNodeResult` | `{ success; error?; blockedByDependents? }` `build.ts:81` | **EXTEND** with `removed?: string[]` |
| Right-click → `onNodeClick(id, 2)` plumbing | **REAL, working** — WebGL hit-area `pixiRenderer.ts:618-621` + DOM a11y button `SkillTreeCanvas.tsx:358-361`; hook `handleNodeClick` button===2 → `applyNodeChange(-1)` (`useSkillTree.ts:73`) | **KEEP (remove-one).** Only **forward `e.shiftKey`** so shift+right-click reaches the new branch |
| `handleNodeClick(nodeId, button, shiftKey)` | **REAL** `useSkillTree.ts:59-88` — already carries `shiftKey` (used by 3.4 shift+left at `:64`) | **ADD** a shift+right-click branch (mirror the shift+left branch) |
| `onNodeContextMenu` callback + `handleNodeContextMenu` + `contextMenu` state + `NodeContextMenu.tsx` | **REAL but INERT scaffold** (typed/threaded/bound but never fired; menu never mounted) | **NOT used — leave entirely untouched** (the gesture model makes it unnecessary; do not delete, do not wire) |
| Confirmation dialog for AC2 | **ABSENT** (no "will also deallocate" copy anywhere) | **AUTHOR** `RemoveNodeConfirmDialog.tsx` (centered modal, mirror `DeleteConfirmDialog` pattern) |
| `getNodeName` (id → display name) | **REAL** `shared/utils/getNodeName.ts` — signature `getNodeName(nodeId, gameData, classId, masteryId)` | **Reuse** to name orphans (resolve in SkillTreeView, not the dialog) |

**Live-tree caution (3.4's flagged env anomaly + memory `[[autosave-watcher-unvalidated]]`):** `[AutoSave]` commits on this surface are ungated snapshots — a racing process previously committed a state with the passive guard / budget cap stripped (`d948556`). **Verify `buildStore.ts` / `useSkillTree.ts` guards by Read+grep on the working tree before and after your edits; do not trust HEAD.**

---

## What this story IS (and is NOT)

**IS:** (1) a new `buildStore.removeAllPoints(nodeId, treeData)` action that snapshots undo **once** and deletes the node + all transitively-orphaned allocated children in **one** `set()`; (2) a new pure `computeOrphanedNodes` helper (the genuinely new logic); (3) a **new shift+right-click gesture** that triggers remove-all on the passive tree, added to the existing `handleNodeClick` (mirroring 3.4's shift+left fill); (4) an AC2 confirmation dialog naming the orphans.

**IS NOT:** any change to plain right-click (remove-one, AC3) or its dependent-block; any change to `fillNodeToMax`, `applyNodeChange`, skill/weaver behavior; any use of `onNodeContextMenu` / `NodeContextMenu.tsx` (left as inert scaffold); any scoring/Rust/`compute_stats`/`NodeEfficiency`/`optimization:*` change; any new stat. The cascade is the inverse of allocation, on the same `nodeAllocations` field.

---

## DECISIONS

**D1 — Trigger: direct gesture, NO context menu. ✅ DECIDED.** Remove-all is a direct shift+right-click via the existing `onNodeClick` plumbing — no intermediate menu. `NodeContextMenu.tsx` (the inert Allocate/Remove scaffold) is left unused.

**D2 — Gesture split. ✅ DECIDED (Alec):** **right-click = remove ONE** (preserved, AC3); **shift+right-click = remove ALL** (AC1/AC2). This is the deliberate mirror of 3.4 (shift+**left** = fill-to-max ↔ shift+**right** = remove-all) and keeps granular single-point control. **Note for code review:** this intentionally *refines* FR-45's literal "right-click removes all" wording (Alec-confirmed, like 3.2's dim-tier deviation) — FR-45's substance (one-action remove-all + orphan cascade + naming confirmation + single undo step) is fully delivered; only the trigger gesture moved to shift+right so plain right-click can keep remove-one. Do **not** flag the gesture as an AC miss.

**D3 — Orphan semantics on multi-prerequisite ("diamond") nodes: STRICT `.every()`. ✅ RESOLVED (Alec).**
If `C` requires `{A, B}` and `B` is removed, `C` is no longer validly allocated and **its points refund out (deallocated) as part of the cascade** — strict `.every()`. This matches how the codebase already gates allocation (`applyNodeChange`/`fillNodeToMax` use `.every()` at `buildStore.ts:206-208, 294-296`) and the existing dependent block. **Do NOT implement the looser OR rule** (survive-if-any-prereq-remains) — it would leave allocation-invalid builds. Note: this only diverges from OR on genuine diamonds; most LE passive nodes have ≤1 prerequisite, so chains cascade identically. Dev task 2.4 still records whether shipped class JSON contains any >1-prereq node (fixture realism only). Any such cascade is gated by AC2's mandatory confirmation.

---

## Tasks / Subtasks

- [ ] **Task 1 — `buildStore.removeAllPoints` store action (AC1, AC2, AC4, AC6, AC7)**
  - [ ] 1.1 Extend `ApplyNodeResult` in `shared/types/build.ts:81` → `{ success: boolean; error?: string; blockedByDependents?: string[]; removed?: string[] }` (additive, back-compatible).
  - [ ] 1.2 Add to the `BuildStore` interface (`buildStore.ts`, near `fillNodeToMax` decl `:34-37`): `removeAllPoints: (nodeId: string, treeData: TreeData) => ApplyNodeResult`.
  - [ ] 1.3 Implement mirroring `fillNodeToMax`'s shape (`:253-321`) but **inverted** (see Dev Notes §removeAllPoints). No build → `{ success: false }` (do NOT auto-create — you cannot remove from nothing). Unallocated node (`(nodeAllocations[nodeId] ?? 0) <= 0`) → `{ success: false }` **before** snapshotting (AC6).
  - [ ] 1.4 Compute `orphans = computeOrphanedNodes(nodeId, activeBuild.nodeAllocations, treeData)`; build ONE `newNodeAllocations` deleting `nodeId` + every orphan (zero-key-deletion idiom, never store `0`); push exactly ONE snapshot via the P4-7 tail (`:318-319`); clear `redoStack`; set `updatedAt: new Date().toISOString()`. Return `{ success: true, removed: [nodeId, ...orphans] }`.
  - [ ] 1.5 Do **not** add `isPersisted: false` (match `fillNodeToMax`/`applyNodeChange` passive convention — see Dev Notes §Traps).

- [ ] **Task 2 — `computeOrphanedNodes` pure helper (AC2, AC7)**
  - [ ] 2.1 New file `lebo/src/features/skill-tree/computeOrphanedNodes.ts`, named export `computeOrphanedNodes(nodeId, nodeAllocations, treeData): string[]` (orphan ids, **excluding** `nodeId`). Pure — no store/React import (mirrors `nearestAllocatedPath.ts`).
  - [ ] 2.2 Implement the **strict `.every()` root-reachability** algorithm (Dev Notes §Algorithm), O(V+E): build directed adjacency once; seed surviving roots (no prerequisites); a dependent becomes *valid* only when **all** its prerequisites are valid; orphans = surviving − valid. Cycle-safe via visited set + head-cursor (no `Array.shift`).
  - [ ] 2.3 Both `removeAllPoints` (Task 1) and the AC2 pre-check in the hook (Task 3) call it — keep it a standalone pure helper, not inline store logic.
  - [ ] 2.4 **Data check (D3):** grep shipped `resources/game-data/classes/*.json` for any node with `prerequisiteNodeIds.length > 1`. Record the finding in the Dev Agent Record. If none exist, note that AC2's diamond case is covered by synthetic fixtures only (the algorithm must still be correct).

- [ ] **Task 3 — Add the shift+right-click → remove-all gesture (AC1, AC2, AC3, AC5, AC8)**
  - [ ] 3.0 **Gesture model (Alec-confirmed, D2):** **right-click = remove ONE** (existing `applyNodeChange(-1)`, incl. its blocked-with-flash guard — UNCHANGED, AC3); **shift+right-click = remove ALL** + orphan cascade. Remove-all rides the **existing `onNodeClick(nodeId, button, shiftKey)` plumbing** (button===2 + shiftKey) exactly like 3.4's shift+left fill. The inert `onNodeContextMenu` / `NodeContextMenu.tsx` are NOT used.
  - [ ] 3.1 `pixiRenderer.ts:618-621` (WebGL hit-area `pointerdown`): change `callbacksRef.current.onNodeClick(node.id, 2)` → `callbacksRef.current.onNodeClick(node.id, 2, e.shiftKey)` — forward `shiftKey`, exactly as the `pointerup` left-click already does (`:627`). Native context menu is already suppressed (`pixiRenderer.ts:207-209`), so shift+right won't pop the OS menu.
  - [ ] 3.2 `SkillTreeCanvas.tsx:358-361` (focused-node DOM `onContextMenu`, a11y/keyboard parity): change `onNodeClick(id, 2)` → `onNodeClick(id, 2, e.shiftKey)` (keep `e.preventDefault()`). This is how a keyboard user reaches remove-all (Shift + context-menu key).
  - [ ] 3.3 `useSkillTree.ts` `handleNodeClick` (`:59-88`) — add a **shift+right-click passive branch**, placed beside the existing shift+left fill branch (`:64-71`):
    ```ts
    // shift+right-click on passive tree: remove all + orphan cascade (3.5)
    if (button === 2 && shiftKey && slotId === undefined) {
      const nodeAllocations = useBuildStore.getState().activeBuild?.nodeAllocations ?? {}
      if ((nodeAllocations[nodeId] ?? 0) <= 0) return                // nothing to remove (AC6)
      const orphans = computeOrphanedNodes(nodeId, nodeAllocations, treeData)
      if (orphans.length === 0) removeAllPoints(nodeId, treeData)     // AC1
      else setPendingRemoval({ nodeId, orphanIds: orphans })         // AC2
      return
    }
    ```
    Read `nodeAllocations` imperatively via `getState()` (the hook does NOT subscribe to allocations — do not add a reactive subscription that re-renders the tree on every allocation). Add `const removeAllPoints = useBuildStore((s) => s.removeAllPoints)` + `import { computeOrphanedNodes }`. The existing `button === 2 ? -1 : 1` decrement branch (`:73`) is **UNCHANGED** (plain right-click still removes one, AC3).
  - [ ] 3.4 Add hook state `pendingRemoval: { nodeId: string; orphanIds: string[] } | null` + `confirmRemoval()` (calls `removeAllPoints(pendingRemoval.nodeId, treeData)`, then clears) + `cancelRemoval()` (clears); return all three from the hook. No coords needed — the confirm is a centered modal.
  - [ ] 3.5 **No skill/weaver rewiring.** Because remove-all rides `onNodeClick` (not `onNodeContextMenu`) and is passive-guarded (`slotId === undefined`): on a skill slot, shift+right falls through to single `applySkillNodeChange(-1)`; the weaver uses its own local `handleWeaverNodeClick` (`SkillTreeView.tsx:525-537`) which ignores `shiftKey` → weaver shift+right = single `applyWeaverNodeChange(-1)`. Verify these still behave (test row h); change nothing in the weaver/skill wiring.

- [ ] **Task 4 — AC2 confirmation dialog (AC2)**
  - [ ] 4.1 New `lebo/src/features/skill-tree/RemoveNodeConfirmDialog.tsx`, a centered modal mirroring the **`DeleteConfirmDialog` pattern** (`build-manager/DeleteConfirmDialog.tsx` — Headless UI `Dialog`/`DialogPanel`/`DialogTitle` + dimmed backdrop + Cancel/Continue pair). **Do NOT import build-manager's component** (no cross-feature imports — project rule); replicate the pattern locally. Props: `{ orphanNames: string[]; onConfirm: () => void; onCancel: () => void }`.
  - [ ] 4.2 Body text names the orphans exactly: `Removing this node will also deallocate: ${orphanNames.join(', ')}. Continue?` (AC2 literal). The dialog receives **already-resolved** `orphanNames: string[]` (resolution happens in SkillTreeView, 4.3).
  - [ ] 4.3 Mount in `SkillTreeView.tsx`: destructure `pendingRemoval`/`confirmRemoval`/`cancelRemoval` from `passiveInteraction` (`:482` / `:486-501` selection); render `<RemoveNodeConfirmDialog>` when `pendingRemoval` is set. **Resolve orphan ids → names with the REAL `getNodeName` signature** `getNodeName(id, gameData, classId, masteryId)` — SkillTreeView has `gameData` (`:84`), `selectedClassId` (`:88`), `selectedMasteryId` (`:89`): `const orphanNames = pendingRemoval.orphanIds.map(id => getNodeName(id, gameData, selectedClassId, selectedMasteryId))`. ⚠️ `treeData`/`TreeNode` carry **no** `name` field — names come **only** from `gameData`; never `getNodeName(treeData, id)`. `onConfirm` → `confirmRemoval()`, `onCancel` → `cancelRemoval()`. Focus ring + reduced-motion + axe per a11y rules.

- [ ] **Task 5 — Tests (value + element)** — see Dev Notes §Testing for the full matrix.
  - [ ] 5.1 `computeOrphanedNodes.test.ts` (NEW): chain, diamond (strict, b1/b2), leaf, root, multi-hop, root-never-orphaned, unallocated-input — exact id-set assertions.
  - [ ] 5.2 `buildStore.test.ts` — new `describe('buildStore — removeAllPoints')` mirroring the `fillNodeToMax` block (`:502-585`): exact surviving map, `removed` set, `undoStack.length === 1`, `redoStack` cleared, `undoNodeChange()` one-step restore, no-op on unallocated, no `isPersisted` flip.
  - [ ] 5.3 `useSkillTree.test.ts` — **ADD** shift+right-click tests; **KEEP** the existing plain-right-click decrement tests (`:72-78` "removes one point", `:161-168` "blocked-decrement flashes") — AC3 keeps them valid. New cases (mirror 3.4's shift+left routing test `:178-211`): passive `handleNodeClick(id, 2, true)` no-orphans → exact-removed post-state + `undoStack 1`; with-orphans → sets `pendingRemoval`; **skill slot** `handleNodeClick(id, 2, true)` → single `applySkillNodeChange(-1)`, passive map untouched (passive guard falls through).
  - [ ] 5.4 `SkillTreeCanvas.test.tsx` — **update** the standing-RED `:120` test to the gesture contract: `onContextMenu` fires `onNodeClick(id, 2, e.shiftKey)` (shiftKey forwarded), NOT `onNodeContextMenu`. Assert both plain (shiftKey=false) and shift (shiftKey=true) forward correctly. (The old menu-path expectation is obsolete under the gesture model.)
  - [ ] 5.5 `RemoveNodeConfirmDialog.test.tsx` (NEW): renders exactly the orphan names (set-equal, no extras/omissions); Continue → `onConfirm` once; Cancel → `onCancel`, allocations untouched; axe clean.
  - [ ] 5.6 `SkillTreeView.test.tsx` — weaver shift+right-click does **not** remove-all: decrements via `applyWeaverNodeChange(-1)`, passive `nodeAllocations` untouched, no `removeAllPoints` call (row h guard).

- [ ] **Task 6 — Verify & baseline**
  - [ ] 6.1 `pnpm build` (tsc + vite) clean.
  - [ ] 6.2 Full `pnpm vitest`: **no new failures vs the standing 8-failure baseline** (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`; HEAD after 3.3+3.4 = **1237 passed / 8 failed**). Reworking `SkillTreeCanvas.test.tsx:120` to the gesture contract should make it pass — note whether that **clears SkillTreeCanvas from the baseline** or whether other failures in that file remain. Net test count should rise. Do not "fix" unrelated baseline failures.
  - [ ] 6.3 Re-Read+grep the passive guard (`useSkillTree.ts` `slotId === undefined`) and `removeAllPoints` body on the **working tree** post-edit (AutoSave-anomaly guard).

---

## Dev Notes

### Source tree — files this story touches

| File | Change |
|---|---|
| `lebo/src/shared/types/build.ts` | EXTEND `ApplyNodeResult` (+`removed?`) |
| `lebo/src/shared/stores/buildStore.ts` | NEW `removeAllPoints` action (+ interface decl) |
| `lebo/src/shared/stores/buildStore.test.ts` | NEW `removeAllPoints` describe block |
| `lebo/src/features/skill-tree/computeOrphanedNodes.ts` | **NEW** pure helper |
| `lebo/src/features/skill-tree/computeOrphanedNodes.test.ts` | **NEW** |
| `lebo/src/features/skill-tree/useSkillTree.ts` | ADD shift+right-click branch in `handleNodeClick` + `pendingRemoval`/`confirmRemoval`/`cancelRemoval` (plain right-click unchanged) |
| `lebo/src/features/skill-tree/useSkillTree.test.ts` | ADD shift+right tests; KEEP existing right-click decrement tests |
| `lebo/src/features/skill-tree/pixiRenderer.ts` | `:619` forward `e.shiftKey` on the button===2 `onNodeClick` |
| `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` | `:360` forward `e.shiftKey` on the `onContextMenu` → `onNodeClick` |
| `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` | Rework `:120` to the `onNodeClick(id,2,shiftKey)` contract |
| `lebo/src/features/skill-tree/RemoveNodeConfirmDialog.tsx` | **NEW** centered confirm modal |
| `lebo/src/features/skill-tree/RemoveNodeConfirmDialog.test.tsx` | **NEW** |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | Consume `pendingRemoval`, resolve orphan names via `getNodeName`, mount dialog (no weaver/skill rewiring) |
| `lebo/src/features/skill-tree/SkillTreeView.test.tsx` | Weaver shift+right-click guard (row h) |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | status bump (workflow) |

### The orphan-cascade algorithm (the genuinely new logic) — STRICT `.every()` reachability

**Definitions (all grounded in real fields):** allocated = `(nodeAllocations[id] ?? 0) > 0`; a node's prerequisites = `treeData.edges.filter(e => e.toId === id).map(e => e.fromId)` (edge `fromId`=prereq, `toId`=dependent — `treeData.ts:23-26`, `treeDataTransformer.ts:61-62`); a **root** has **no incoming edges** (empty prerequisites — there is no `isRoot`/`nodeType` flag, derive it).

**Orphaned** = a node still allocated after `nodeId` is cleared, that no longer has **all** its prerequisites satisfied by a still-valid, root-reachable allocated path.

```ts
// lebo/src/features/skill-tree/computeOrphanedNodes.ts
import type { TreeData } from '../../shared/types/treeData'

export function computeOrphanedNodes(
  nodeId: string,
  nodeAllocations: Record<string, number>,
  treeData: TreeData,
): string[] {
  const isAllocated = (id: string) => (nodeAllocations[id] ?? 0) > 0

  // surviving = allocated, minus the node being cleared
  const surviving = new Set<string>()
  for (const n of treeData.nodes) {
    if (n.id !== nodeId && isAllocated(n.id)) surviving.add(n.id)
  }

  // directed adjacency, built ONCE → O(V+E) (do NOT edges.filter inside the loop)
  const prereqCount = new Map<string, number>()      // id -> # prerequisites (full edge set)
  const dependentsOf = new Map<string, string[]>()   // prereqId -> dependent ids
  for (const e of treeData.edges) {
    prereqCount.set(e.toId, (prereqCount.get(e.toId) ?? 0) + 1)
    const arr = dependentsOf.get(e.fromId)
    if (arr) arr.push(e.toId)
    else dependentsOf.set(e.fromId, [e.toId])
  }

  // flood-fill from surviving roots; a dependent becomes valid only when ALL prereqs are valid
  const valid = new Set<string>()
  const remaining = new Map<string, number>()
  const queue: string[] = []
  for (const id of surviving) {
    const pc = prereqCount.get(id) ?? 0
    if (pc === 0) { valid.add(id); queue.push(id) }   // root
    else remaining.set(id, pc)
  }
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]                          // head-cursor, no Array.shift
    for (const dep of dependentsOf.get(cur) ?? []) {
      if (!surviving.has(dep) || valid.has(dep)) continue
      const left = (remaining.get(dep) ?? 0) - 1
      remaining.set(dep, left)
      if (left === 0) { valid.add(dep); queue.push(dep) }   // STRICT .every(): valid only when ALL prereqs valid (D3, confirmed)
    }
  }

  const orphans: string[] = []
  for (const id of surviving) if (!valid.has(id)) orphans.push(id)
  return orphans
}
```

**Why strict (not naive descendant-walk):** naive "delete everything downstream of `nodeId`" over-removes on diamonds. Root-reachability + the counter gate implement strict `.every()` (confirmed, D3): a dependent is valid only once **all** its prerequisites are valid. Worked cases: chain `root→A→B` remove `A` → `[B]`; diamond `root→{A,B}→C` remove `A` → `[C]` (C required both A and B, so C's points refund out); leaf → `[]`; root → all descendants. Acyclicity assumed (LE trees are DAGs); the visited set makes it cycle-safe regardless. (Assumes no duplicate edges — one edge per prerequisite, which `treeDataTransformer.ts:61-62` guarantees.)

### `removeAllPoints` store action — invert `fillNodeToMax`, keep the P4-7 tail byte-identical

```ts
// in the store object, next to fillNodeToMax (buildStore.ts:253)
removeAllPoints: (nodeId, treeData) => {
  const state = get()
  const activeBuild = state.activeBuild
  if (!activeBuild) return { success: false }                       // no auto-create (unlike fillNodeToMax)

  const current = activeBuild.nodeAllocations[nodeId] ?? 0
  if (current <= 0) return { success: false }                       // AC6 no-op, BEFORE any snapshot

  const orphans = computeOrphanedNodes(nodeId, activeBuild.nodeAllocations, treeData)

  const newNodeAllocations = { ...activeBuild.nodeAllocations }     // zero-key-deletion idiom (:235-240)
  delete newNodeAllocations[nodeId]
  for (const id of orphans) delete newNodeAllocations[id]

  const newActiveBuild: BuildState = {
    ...activeBuild,
    nodeAllocations: newNodeAllocations,
    updatedAt: new Date().toISOString(),
  }
  // EXACT P4-7 single-undo tail — copied from fillNodeToMax buildStore.ts:318-319
  const newUndoStack = [...state.undoStack, activeBuild].slice(-MAX_UNDO_STACK)
  set({ activeBuild: newActiveBuild, undoStack: newUndoStack, redoStack: [] })
  return { success: true, removed: [nodeId, ...orphans] }
},
```

One pre-mutation `activeBuild` is pushed once; the whole batch lands in one `newNodeAllocations`; `undoNodeChange()` (`:425-434`) restores the entire prior build in one step (AC4). **Never** loop `applyNodeChange(-1)` — that pushes N snapshots **and** re-trips the single-hop `blockedByDependents` block (`:221-233`).

### Gesture wiring — remove-all rides the existing `onNodeClick(button, shiftKey)` path

The symmetry with 3.4: **shift+LEFT = `fillNodeToMax`** (existing `handleNodeClick` branch `:64-71`), **shift+RIGHT = `removeAllPoints`** (new branch). Both are passive-only (`slotId === undefined`), both flow through `onNodeClick(nodeId, button, shiftKey)`. The only canvas change is **forwarding `e.shiftKey`** on the two right-click entry points (`pixiRenderer.ts:619`, `SkillTreeCanvas.tsx:360`) — plain right-click (shiftKey=false) still hits the `applyNodeChange(-1)` decrement (AC3). AR-6 holds: no store access added to the canvas; `onNodeClick` is an existing prop. The AC2 confirm is a centered modal (`pendingRemoval` → `<RemoveNodeConfirmDialog>` in SkillTreeView), so no cursor coords are needed. `onNodeContextMenu` and `NodeContextMenu.tsx` stay inert and untouched.

### Patterns, traps & invariants (from Epic 3 history)

- **Pattern P4-7 / NFR-6:** bulk op = exactly one undo snapshot; never a loop. (`architecture.md:394-398`, `:531`.)
- **`isPersisted` trap (3.4):** passive allocation — single *and* bulk — does NOT set `isPersisted: false` (`applyNodeChange`/`fillNodeToMax` both omit it). **Do not add it to `removeAllPoints` alone** — that would make removals dirty the build while allocations don't. Out of scope to "fix" globally.
- **Shared-file surface:** `pixiRenderer.ts`/`useSkillTree.ts`/`SkillTreeView.tsx` already carry 3.2/3.3 (`focusNode`, emphasis) + 3.4 (`fillNodeToMax`) additions — integrate, don't clobber.
- **AR-6:** no Zustand inside `SkillTreeCanvas`/`pixiRenderer`. **Project rules:** named exports only, no barrels, strict TS (`noUnusedLocals/Parameters`), tokens not hex, co-located tests, no snapshot tests, axe on new UI.

### Source Audit

**Verdict: N/A — no-new-stat / no-dead-key.** This is an allocation-**removal** interaction story; it introduces no new `StatKey`, `StatSheet` field, or displayed numeric value.

- **New stat / displayed value?** None. The confirmation prompt surfaces node **names**, not a stat — re-presenting already-shipped `GameNode.name` via the already-sourced `getNodeName` helper (`shared/utils/getNodeName.ts`, `?? id` fallback). The orphan id-set is derived purely from `treeData.edges` + the in-store `nodeAllocations` map. Nothing to source.
- **Field written — `nodeAllocations` — produced-AND-consumed (no dead key):** `removeAllPoints` **deletes keys** from the same `activeBuild.nodeAllocations: Record<string, number>` that `applyNodeChange`/`fillNodeToMax` already write (delete-key-at-0 convention; absent ⇔ unallocated). It is consumed unchanged downstream: `toBuildSnapshot(build, gameData)` → `invokeCommand('compute_stats', …)` → Rust scoring. A removal yields a smaller-but-valid map on the identical path. No new key is produced; nothing becomes produced-but-unconsumed or vice versa.
- **Verification guardrail:** a golden effect-**count** test is **N/A** (no stat, no prose/tag/element parsing). The obligation is met by **value + element** assertions: exact surviving allocation map, the explicit named-orphan set (`removed[]`), and `undoStack.length === 1` — not a test-count or snapshot. (Matches `[[source-audit-at-create-story]]` and `fillNodeToMax`'s 3.4 verdict.)

### Testing requirements (value + element — never count/snapshot)

Mirror the `fillNodeToMax` describe block (`buildStore.test.ts:502-585`) and the `blockedByDependents` pin (`:406-410`). Fixtures: extend the existing `mockTreeData` (`:339-345`, root→child) and add `mockChainTree` (root→A→B) + `mockDiamondTree` (root→{A,B}→C).

| # | Scenario | Assertions (exact) |
|---|---|---|
| a | chain `root→A→B`, allocate all, `removeAllPoints('A')` | helper → `['B']`; `nodeAllocations` has no `A`/`B`, `root` present; `removed === ['A','B']`; `undoStack.length === 1`; `redoStack.length === 0` |
| b1 | diamond `root→{A,B}→C` (fresh), `removeAllPoints('A')` | **(strict, D3)** helper → `['C']`; `removed === ['A','C']`; `A`,`C` deleted, `root`,`B` remain; `undoStack 1` |
| b2 | diamond `root→{A,B}→C` (fresh, separate fixture), `removeAllPoints('B')` | helper → `['C']`; `removed === ['B','C']`; `B`,`C` deleted, `root`,`A` remain — strict symmetry (do NOT chain after b1: C is already gone there) |
| c | leaf removal (`mockTreeData` child) | helper → `[]`; only `child` deleted; `root` remains; `undoStack 1` |
| d | remove root (`mockTreeData`) | helper → `['child']`; both deleted (map empty); one `undoNodeChange()` restores **both** |
| e | unallocated node | `removeAllPoints` → `{ success: false }`; `nodeAllocations` and `undoStack` unchanged (no spurious entry) |
| f | redo cleared by removal | seed redo via applyNodeChange→undo; `removeAllPoints` → `redoStack.length === 0` |
| g | confirm dialog naming | rendered orphan names set-equal `orphanIds.map(id => getNodeName(id, gameData, classId, masteryId))` (NOT bare `.map(getNodeName)` — that passes index/array as gameData/classId); Continue → `onConfirm` once; Cancel → allocations untouched; axe clean |
| h | gesture routing (all THREE trees) | **shift+**right passive → remove-all/cascade; **plain** right passive → single `applyNodeChange(-1)` (AC3, existing); shift+right skill slot → single `applySkillNodeChange(-1)` (passive map untouched); shift+right weaver → single `applyWeaverNodeChange(-1)`, passive `nodeAllocations` UNTOUCHED, no `removeAllPoints` call |
| i | canvas contract | `SkillTreeCanvas.test.tsx:120`: `fireEvent.contextMenu` (and shift+contextMenu) fires `onNodeClick(id, 2, shiftKey)` with `shiftKey` forwarded, not `onNodeContextMenu` |

### Out of Scope (do NOT touch)

scoring-core / Rust / `compute_stats` / `NodeEfficiency` / `optimization:*`; `fillNodeToMax` (3.4); `applyNodeChange` + its single-hop block (`:221-233`); plain right-click remove-one behavior (AC3 — keep it); skill/weaver allocation actions and wiring; the `isPersisted` omission (don't "fix"); `onNodeContextMenu` / `handleNodeContextMenu` / `contextMenu` state / `NodeContextMenu.tsx` (leave inert — don't delete, don't wire); unrelated baseline failures (`ProviderSelector`/`Settings`/`TreeControls`).

### Project Structure Notes

All new files are co-located in `features/skill-tree/` (helper + dialog + tests) per the self-contained-feature rule; the only shared edits are `build.ts` (type) and `buildStore.ts` (store action) — both in `shared/`, the correct home for cross-feature types/state. `RemoveNodeConfirmDialog` replicates the `DeleteConfirmDialog` *pattern* without importing across feature folders (project rule). No new store, no router, no IPC, no dependency.

### References

- Epic / story: `_bmad-output/planning-artifacts/epics.md:706-721` (Story 3.5), `:109` (FR-45), `:275` (impl notes), `:624-626` (Epic 3 goal). **Gesture refinement** (right=one, shift+right=all) is an Alec-confirmed deviation from FR-45's literal "right-click" — see D2.
- Architecture: `architecture.md:394-398` (Pattern P4-7), `:414` (enforcement #7), `:531` (file ownership)
- Twin action: `buildStore.ts:34-37, 253-321` (`fillNodeToMax`); undo tail `:318-319`; block `:221-233`; zero-key `:235-240`; undo/redo `:425-445`; `MAX_UNDO_STACK :8`
- Prereq graph: `shared/types/treeData.ts:13-26` (`TreeNode`/`TreeEdge`), `treeDataTransformer.ts:61-62`; `gameData.ts:1-12` (`GameNode.prerequisiteNodeIds`)
- Gesture seam: `pixiRenderer.ts:207-209` (native-menu suppress), `:618-621` (`button===2` pointerdown), `:627` (existing `shiftKey` forward on left-click); `SkillTreeCanvas.tsx:358-361` (a11y `onContextMenu`); `useSkillTree.ts:59-88` (`handleNodeClick`, shift+left branch `:64-71`); `types.ts` (`onNodeClick(nodeId, button, shiftKey?)`); `SkillTreeView.tsx:482-484` (3 hook instances), `:525-537` (local `handleWeaverNodeClick`)
- Reuse: `build-manager/DeleteConfirmDialog.tsx` (confirm pattern); `shared/utils/getNodeName.ts` (3.3, `getNodeName(id, gameData, classId, masteryId)`); `ApplyNodeResult` `build.ts:81`
- Test idioms: `buildStore.test.ts:339-345,406-410,502-585`; `useSkillTree.test.ts:64-84,161-168,178-211`; `SkillTreeCanvas.test.tsx:120-129`
- Memory: `[[source-audit-at-create-story]]`, `[[autosave-watcher-unvalidated]]`

## Dev Agent Record

### Agent Model Used

<!-- dev-story fills this -->

### Debug Log References

### Completion Notes List

### File List
