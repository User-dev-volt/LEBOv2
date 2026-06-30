# Story 3.5: Right-click remove all points with orphan cascade

Status: ready-for-dev

<!-- Epic 3: Passive Tree Optimizer & Allocation — final story. Partner to Story 3.4 (fillNodeToMax). FR-45, Pattern P4-7, NFR-6. -->

## Story

As a player,
I want right-click to remove all points from a passive node in one action,
so that I can quickly undo an allocation without clicking down each point.

## Acceptance Criteria

1. **(AC1 — simple remove)** Given an allocated passive node with **no dependent allocated children**, When I right-click it, Then all its points are removed in one action as a **single undo step** via `buildStore.removeAllPoints` (FR-45, Pattern P4-7). No confirmation prompt appears.
2. **(AC2 — orphan cascade)** Given an allocated passive node whose removal would **orphan allocated child nodes**, When I right-click it, Then a confirmation prompt **names the orphaned nodes** (`"Removing this node will also deallocate: [Node A], [Node B]. Continue?"`) **And** on confirm, the node and its orphaned children are deallocated **together in one single undo step**; on cancel, nothing changes.

**Derived / non-negotiable criteria (implied by the system; must also hold):**

3. The whole cascade is **exactly one** `undoStack` entry — one `undoNodeChange()` restores the node **and** every cascaded orphan in a single step. `redoStack` is cleared. Never a loop of `applyNodeChange` calls (Pattern P4-7, NFR-6).
4. Right-click remove-all is **passive-tree only** (`slotId === undefined`), mirroring `fillNodeToMax`. Skill-slot and weaver right-click behavior is unchanged by this story (see Out of Scope).
5. Right-clicking an **unallocated** node is a no-op — no removal, no snapshot, no spurious undo entry.
6. Removal/cascade is **value-exact**: the target key and every orphaned-child key are deleted (key absent, never stored as `0`); every untouched allocation keeps its exact prior value.
7. **A11y / keyboard parity:** the focused-node keyboard context-menu path produces the same behavior as a mouse right-click (this also turns the standing RED test `SkillTreeCanvas.test.tsx:120` green — see Dev Notes §Baseline).

---

## ⚠️ READ FIRST — Reconcile map (verified against the live working tree, not HEAD)

This story is **NOT** a from-scratch greenfield, but it is **NOT** a pure reconcile like 3.4 either. The store action is **absent** and must be authored; the right-click→menu *infrastructure* exists but is **inert** and currently does the wrong thing (single-point decrement). Build the core, then wire the seam.

| 3.5 element | State on disk | Action |
|---|---|---|
| `buildStore.removeAllPoints` | **ABSENT** (0 hits in `lebo/src`; only `_bmad-output/` docs match) | **AUTHOR IT** — mirror `fillNodeToMax` (`buildStore.ts:253-321`) |
| `fillNodeToMax` (structural twin) | **REAL** `buildStore.ts:34-37` (iface), `:253-321` (impl) | **Read & mirror — do NOT modify** (3.4) |
| Orphan-cascade reachability logic | **ABSENT** anywhere (`orphan`/`reachab`/`cascade` → 0 hits) | **AUTHOR** new pure helper `computeOrphanedNodes.ts` |
| Single-hop dependent **BLOCK** | **REAL** `buildStore.ts:221-233` (inside `applyNodeChange`, `delta<0 && newPoints===0`) — *blocks* removal, returns `blockedByDependents` | **Leave it** — `removeAllPoints` deliberately bypasses it; it still serves the single-decrement path (skill/weaver + direct callers/tests) |
| `ApplyNodeResult` | `{ success; error?; blockedByDependents? }` `build.ts:81` | **EXTEND** with `removed?: string[]` |
| Right-click WebGL hit-area | **REAL but wrong** `pixiRenderer.ts:618-621`: `if (e.button === 2) { onNodeClick(node.id, 2) }` → `applyNodeChange(-1)` (single decrement) | **REWIRE** → `onNodeContextMenu(id, e.client.x, e.client.y)` |
| Right-click DOM a11y `<button>` | **REAL but wrong** `SkillTreeCanvas.tsx:358-361`: `onContextMenu` → `onNodeClick(id, 2)` | **REWIRE** → `onNodeContextMenu(id, e.clientX, e.clientY)` — fixes the RED test |
| `onNodeContextMenu(id, screenX, screenY)` callback | **REAL, fully typed & threaded** `types.ts:11,60`; `SkillTreeCanvas.tsx:24,34,89`; bound `SkillTreeView.tsx:854,929` — **but NEVER fired** | **Reuse** — make both entry points fire it |
| `useSkillTree.handleNodeContextMenu` + `contextMenu` state | **REAL, tested** `useSkillTree.ts:130-137` — sets `{nodeId,x,y}`, but **nothing consumes it** (SkillTreeView never destructures `contextMenu`) | **Repurpose** to drive the remove-all/confirm flow |
| `NodeContextMenu.tsx` (Allocate/Remove menu) | **REAL component, ORPHANED** (never imported/mounted); its "Remove" is generic single-action, no remove-all/cascade | **NOT used under the recommended design (Option A)** — leave as-is; see DECISION D1 |
| Confirmation dialog for AC2 | **ABSENT** (no "will also deallocate" copy anywhere) | **AUTHOR** `RemoveNodeConfirmDialog.tsx` (mirror `DeleteConfirmDialog` pattern) |
| `getNodeName` (id → display name) | **REAL** `shared/utils/getNodeName.ts` (3.3, `?? id` fallback) | **Reuse** to name orphans in the prompt |

**Live-tree caution (from 3.4's flagged env anomaly + memory `[[autosave-watcher-unvalidated]]`):** `[AutoSave]` commits on this surface are ungated snapshots — a racing process previously committed a state with the passive guard / budget cap stripped (`d948556`). **Verify `buildStore.ts` / `useSkillTree.ts` guards by Read+grep on the working tree before and after your edits; do not trust HEAD.**

---

## What this story IS (and is NOT)

**IS:** (1) a new `buildStore.removeAllPoints(nodeId, treeData)` action that snapshots undo **once** and deletes the node + all transitively-orphaned allocated children in **one** `set()`; (2) a new pure `computeOrphanedNodes` helper (the genuinely new logic); (3) rewiring passive right-click from *single-decrement* to *remove-all*; (4) an AC2 confirmation dialog naming the orphans.

**IS NOT:** any scoring/Rust/`compute_stats`/`NodeEfficiency`/`optimization:*` change; any change to `fillNodeToMax`, `applyNodeChange`'s block, skill/weaver allocation; any new stat. The cascade is the inverse of allocation, on the same `nodeAllocations` field.

---

## DECISIONS — flag for Alec (resolve before/at dev; story is written to the recommended defaults)

> Mirror 3.4's practice: recommended path chosen, alternative documented, the core work (store action + helper + tests) is **identical regardless** — only the trigger UX (D1) and one test expectation (D3) differ.

**D1 — Right-click trigger: DIRECT (recommended) vs context-MENU.**
The ACs read as *direct* ("right-click it → all points removed in one action"; "right-click it → a confirmation prompt"). **Recommended (Option A, this story's default):** right-click invokes `removeAllPoints` directly — immediately when there are no orphans (AC1), or after the confirmation dialog when there are (AC2). The pre-existing `NodeContextMenu.tsx` (an Allocate/Remove menu) is **not** used and stays unmounted scaffold.
**Alternative (Option B):** right-click opens `NodeContextMenu` with a new "Remove all points" item; clicking it runs the same flow. Reuses the scaffold and leaves room to host granular ops, but adds a click the AC doesn't ask for. *If Alec wants B, only Task 3/4 wiring changes — Tasks 1, 2, 5 are unchanged.*

**D2 — Fate of single-point decrement on the passive tree.**
Today passive right-click = remove **one** point (`applyNodeChange(-1)`). Under Option A it becomes remove **all** — so there is **no passive single-point-decrement gesture left** (left-click = +1, shift+left = fill-to-max, right-click = remove-all). The epic frames this as a *speed-up* ("right-click remove-all"), so the loss is intended. **Recommended:** accept it. *If Alec wants to keep granular decrement, the natural home is Option B's menu ("Remove one" + "Remove all").* (Skill-slot/weaver single-decrement is preserved either way.)

**D3 — Orphan semantics on multi-prerequisite ("diamond") nodes: STRICT `.every()` (recommended) vs OR.**
A node with prerequisites `{A, B}` is allocatable in this codebase only when **both** are allocated — `applyNodeChange`/`fillNodeToMax` gate on `.every()` (`buildStore.ts:206-208, 294-296`), and the existing block treats any dependent as essential. **Recommended:** the cascade uses the **same strict `.every()`** rule — after removing `A`, a child needing `{A,B}` **is orphaned** (a state where it survived would be one the allocation rules could never have produced). The looser **OR** rule (survive if *any* prereq remains) would leave allocation-invalid builds. *Note:* this only diverges from OR on genuine diamonds; **most LE passive nodes have ≤1 prerequisite, so chains cascade identically under either rule.** Dev task 2.4 checks whether shipped class JSON even contains a >1-prereq node; if none, the distinction is academic and strict is trivially correct. **Flag:** if Alec confirms LE multi-connections are semantically OR, flip the propagation gate (one line, §Algorithm) and update test (b).

---

## Tasks / Subtasks

- [ ] **Task 1 — `buildStore.removeAllPoints` store action (AC1, AC2, AC3, AC5, AC6)**
  - [ ] 1.1 Extend `ApplyNodeResult` in `shared/types/build.ts:81` → `{ success: boolean; error?: string; blockedByDependents?: string[]; removed?: string[] }` (additive, back-compatible).
  - [ ] 1.2 Add to the `BuildStore` interface (`buildStore.ts`, near `fillNodeToMax` decl `:34-37`): `removeAllPoints: (nodeId: string, treeData: TreeData) => ApplyNodeResult`.
  - [ ] 1.3 Implement the action mirroring `fillNodeToMax`'s shape (`:253-321`) but **inverted** (see Dev Notes §removeAllPoints). No build → `{ success: false }` (do NOT auto-create — you cannot remove from nothing). Unallocated node (`(nodeAllocations[nodeId] ?? 0) <= 0`) → `{ success: false }` **before** snapshotting (AC5).
  - [ ] 1.4 Compute `orphans = computeOrphanedNodes(nodeId, activeBuild.nodeAllocations, treeData)`; build ONE `newNodeAllocations` deleting `nodeId` + every orphan (zero-key-deletion idiom, never store `0`); push exactly ONE snapshot via the P4-7 tail (`:318-319`); clear `redoStack`; set `updatedAt: new Date().toISOString()`. Return `{ success: true, removed: [nodeId, ...orphans] }`.
  - [ ] 1.5 Do **not** add `isPersisted: false` (match `fillNodeToMax`/`applyNodeChange` passive convention — see Dev Notes §Traps).

- [ ] **Task 2 — `computeOrphanedNodes` pure helper (AC2, AC6)**
  - [ ] 2.1 New file `lebo/src/features/skill-tree/computeOrphanedNodes.ts`, named export `computeOrphanedNodes(nodeId, nodeAllocations, treeData): string[]` (orphan ids, **excluding** `nodeId`). Pure — no store/React import (mirrors `nearestAllocatedPath.ts`).
  - [ ] 2.2 Implement the **strict `.every()` root-reachability** algorithm (Dev Notes §Algorithm), O(V+E): build directed adjacency once; seed surviving roots (no prerequisites); propagate a dependent to *valid* only when **all** its prerequisites are valid; orphans = surviving − valid. Cycle-safe via visited set + head-cursor (no `Array.shift`).
  - [ ] 2.3 `removeAllPoints` (Task 1) and the AC2 confirmation flow (Task 4) both call it — that is why it must be a standalone pure helper, not inline store logic.
  - [ ] 2.4 **Data check (D3):** grep shipped `resources/game-data/classes/*.json` for any node with `prerequisiteNodeIds.length > 1`. Record the finding in the Dev Agent Record. If none exist, note that AC2's diamond case is covered by synthetic fixtures only (the algorithm must still be correct).

- [ ] **Task 3 — Rewire right-click → remove-all, PASSIVE INSTANCE ONLY (AC1, AC2, AC4, AC7)** *(Option A — see D1)*
  - [ ] 3.0 **CRITICAL multi-instance context — do not skip.** `useSkillTree` is instantiated **three times** in `SkillTreeView.tsx`: `passiveInteraction = useSkillTree(treeData)` (`:482`), `skillInteraction = useSkillTree(skillTreeData, slotId)` (`:483`), `weaverInteraction = useSkillTree(isWeaverTab ? weaverTreeData : null)` (`:484`). **Passive AND weaver BOTH have `slotId === undefined`** — `slotId` alone cannot tell them apart. `pixiRenderer` is the **shared** renderer for all three canvases, so the rewire below fires `onNodeContextMenu` on passive, skill, AND weaver. Remove-all must reach the **passive** instance only (3.3); skill keeps single-decrement via `slotId` (3.3); weaver keeps single-decrement via a **local** handler (3.5). The passive/skill canvases get `handleNodeContextMenu` from the `isPassiveTab ? passiveInteraction : skillInteraction` selection (`:486-501`, bound `:854`/`:929`); the weaver canvas binds it separately (`:645`).
  - [ ] 3.1 `pixiRenderer.ts:618-621`: replace `callbacksRef.current.onNodeClick(node.id, 2)` with `callbacksRef.current.onNodeContextMenu?.(node.id, e.client.x, e.client.y)`. **Use DOM client coords (`e.client`), not `e.global`** (stage coords) — the dialog is `position: fixed`.
  - [ ] 3.2 `SkillTreeCanvas.tsx:358-361` (focused-node `onContextMenu`): replace `onNodeClick(id, 2)` with `onNodeContextMenu?.(id, e.clientX, e.clientY)` (keep `e.preventDefault()`). This turns the RED `SkillTreeCanvas.test.tsx:120` green.
  - [ ] 3.3 `useSkillTree.ts` — **move all right-click handling into `handleNodeContextMenu(nodeId, x, y)`**, branching on `slotId`:
    - **passive** (`slotId === undefined`): read allocations at event time via `useBuildStore.getState().activeBuild?.nodeAllocations ?? {}` (the hook does NOT subscribe to allocations today — read imperatively in the handler, do **not** add a reactive subscription that re-renders the tree on every allocation); `orphans = computeOrphanedNodes(nodeId, nodeAllocations, treeData)`; empty → `removeAllPoints(nodeId, treeData)` immediately (AC1); non-empty → set `pendingRemoval` state `{ nodeId, orphanIds, x, y }` (AC2).
    - **skill slot** (`slotId !== undefined`): preserve single-decrement — `applySkillNodeChange(slotId, nodeId, -1, treeData)` + existing flash-on-block.
    - Add `const removeAllPoints = useBuildStore((s) => s.removeAllPoints)`; expose `pendingRemoval` + `confirmRemoval()` + `cancelRemoval()` (replace the now-unused `contextMenu`/`handleContextMenuClose`).
  - [ ] 3.4 `handleNodeContextMenu` is now THE right-click path → **remove the `button === 2 ? -1 : 1` decrement branch from `handleNodeClick`** (`:73`), leaving it left-click-allocate + shift-fill only (keep `tsc` clean under `noUnusedParameters` — drop or `_`-prefix the now-unused `button` discrimination). This is exactly why the old `handleNodeClick(_, 2)` tests are replaced (Task 5.3). Do not break left-click (+1) or shift+left (fill, 3.4).
  - [ ] 3.5 **WEAVER regression guard (AC4) — the load-bearing fix.** The weaver canvas binds `onNodeContextMenu={handleWeaverNodeContextMenu}` (`SkillTreeView.tsx:645`), today **aliased** from `weaverInteraction.handleNodeContextMenu` (`:582`). After 3.1 fires `onNodeContextMenu` globally, that alias would route weaver right-click into the hook's passive `removeAllPoints` on `nodeAllocations` (WRONG field) and kill weaver decrement. **Replace the alias with a LOCAL `handleWeaverNodeContextMenu`** (mirror the existing local `handleWeaverNodeClick` `:525-537`) that calls `applyWeaverNodeChange(nodeId, -1, weaverTreeData)` + flash-on-block — so weaver right-click keeps single-decrement and NEVER touches `removeAllPoints`/passive allocations. Remove `handleNodeContextMenu` from the `weaverInteraction` destructure (`:582`).

- [ ] **Task 4 — AC2 confirmation dialog (AC2)**
  - [ ] 4.1 New `lebo/src/features/skill-tree/RemoveNodeConfirmDialog.tsx` mirroring the **`DeleteConfirmDialog` pattern** (`build-manager/DeleteConfirmDialog.tsx` — Headless UI `Dialog`/`DialogPanel`/`DialogTitle` + backdrop + Cancel/Continue pair). **Do NOT import build-manager's component** (no cross-feature imports — project rule); replicate the pattern locally. Props: `{ nodeName: string; orphanNames: string[]; onConfirm: () => void; onCancel: () => void }`.
  - [ ] 4.2 Body text names the orphans exactly: `Removing this node will also deallocate: ${orphanNames.join(', ')}. Continue?` (AC2 literal; naming the removed node is optional polish). The dialog receives **already-resolved** `orphanNames: string[]` — id→name resolution happens in SkillTreeView (4.3), not in the dialog.
  - [ ] 4.3 Mount in `SkillTreeView.tsx`: destructure `pendingRemoval`/`confirmRemoval`/`cancelRemoval` from the **passive** interaction (`:486-501` selection); render `<RemoveNodeConfirmDialog>` when `pendingRemoval` is set. **Resolve orphan ids → names with the REAL `getNodeName` signature** `getNodeName(id, gameData, classId, masteryId)` — SkillTreeView already has `gameData` (`:84`), `selectedClassId` (`:88`), `selectedMasteryId` (`:89`): `const orphanNames = pendingRemoval.orphanIds.map(id => getNodeName(id, gameData, selectedClassId, selectedMasteryId))`. ⚠️ `treeData`/`TreeNode` carry **no** `name` field — names come **only** from `gameData`; never `getNodeName(treeData, id)`. `onConfirm` → `confirmRemoval()` (calls `removeAllPoints`), `onCancel` → `cancelRemoval()`. Focus ring + reduced-motion + axe per a11y rules.

- [ ] **Task 5 — Tests (value + element, AC1–AC7)** — see Dev Notes §Testing for the full matrix.
  - [ ] 5.1 `computeOrphanedNodes.test.ts` (NEW): chain, diamond (strict), leaf, root, multi-hop, root-never-orphaned, unallocated-input — exact id-set assertions.
  - [ ] 5.2 `buildStore.test.ts` — new `describe('buildStore — removeAllPoints')` mirroring the `fillNodeToMax` block (`:502-585`): exact surviving map, `removed` set, `undoStack.length === 1`, `redoStack` cleared, `undoNodeChange()` one-step restore, no-op on unallocated, no `isPersisted` flip.
  - [ ] 5.3 `useSkillTree.test.ts` — **replace** the old `handleNodeClick(_, 2)` tests (`:72-78` "removes one point", `:161-168` "blocked-decrement flashes") with `handleNodeContextMenu` tests, since right-click now routes there: passive `handleNodeContextMenu` → remove-all (no orphans) / sets `pendingRemoval` (orphans); skill-slot `handleNodeContextMenu` (slotId defined) → single `applySkillNodeChange(-1)`. Add the **weaver** regression test (matrix row h) for the local `handleWeaverNodeContextMenu` → `applyWeaverNodeChange(-1)` — likely in `SkillTreeView.test.tsx` (the weaver handler is local to SkillTreeView, not the hook).
  - [ ] 5.4 `SkillTreeCanvas.test.tsx` — confirm `:120` (right-click fires `onNodeContextMenu`, not `onNodeClick`) now passes; do not regress other tests in this file.
  - [ ] 5.5 `RemoveNodeConfirmDialog.test.tsx` (NEW): renders exactly the orphan names (set-equal, no extras/omissions); Continue calls `onConfirm` once; Cancel calls `onCancel` and leaves allocations untouched; axe clean.

- [ ] **Task 6 — Verify & baseline (AC7)**
  - [ ] 6.1 `pnpm build` (tsc + vite) clean.
  - [ ] 6.2 Full `pnpm vitest`: **no new failures vs the standing 8-failure baseline** (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`; HEAD after 3.3+3.4 = **1237 passed / 8 failed**). Note whether fixing `SkillTreeCanvas.test.tsx:120` **clears SkillTreeCanvas from the baseline** (like 2.4 cleared RightPanel) or whether other SkillTreeCanvas failures remain. Net test count should rise. Do not "fix" unrelated baseline failures.
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
| `lebo/src/features/skill-tree/useSkillTree.ts` | Repurpose right-click handler → remove-all/confirm flow |
| `lebo/src/features/skill-tree/useSkillTree.test.ts` | Update right-click tests (passive remove-all; replace single-decrement) |
| `lebo/src/features/skill-tree/pixiRenderer.ts` | `:619` fire `onNodeContextMenu` (client coords) |
| `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` | `:360` fire `onNodeContextMenu` |
| `lebo/src/features/skill-tree/SkillTreeCanvas.test.tsx` | `:120` now green (verify, don't regress) |
| `lebo/src/features/skill-tree/RemoveNodeConfirmDialog.tsx` | **NEW** confirm dialog |
| `lebo/src/features/skill-tree/RemoveNodeConfirmDialog.test.tsx` | **NEW** |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | Consume `pendingRemoval`, resolve orphan names via `getNodeName`, mount dialog; **add local `handleWeaverNodeContextMenu` (weaver regression guard, Task 3.5)** |
| `lebo/src/features/skill-tree/SkillTreeView.test.tsx` | Weaver right-click regression test (matrix row h) |
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
      if (left === 0) { valid.add(dep); queue.push(dep) }   // STRICT .every(): all prereqs valid
      // OR-variant (D3): replace the counter gate with `valid.add(dep); queue.push(dep)` on first valid prereq
    }
  }

  const orphans: string[] = []
  for (const id of surviving) if (!valid.has(id)) orphans.push(id)
  return orphans
}
```

**Why strict (not naive descendant-walk):** naive "delete everything downstream of `nodeId`" over-removes on diamonds (`root→{A,B}→C`: removing `A` would wrongly delete `C` even when treated as OR). Root-reachability is correct under both semantics; the counter gate selects strict `.every()` (recommended, D3). Worked cases: chain `root→A→B` remove `A` → `[B]`; diamond `root→{A,B}→C` remove `A` → `[C]` (strict, C needed A) / `[]` (OR); leaf → `[]`; root → all descendants. Acyclicity assumed (LE trees are DAGs); the visited set makes it cycle-safe regardless.

### `removeAllPoints` store action — invert `fillNodeToMax`, keep the P4-7 tail byte-identical

```ts
// in the store object, next to fillNodeToMax (buildStore.ts:253)
removeAllPoints: (nodeId, treeData) => {
  const state = get()
  const activeBuild = state.activeBuild
  if (!activeBuild) return { success: false }                       // no auto-create (unlike fillNodeToMax)

  const current = activeBuild.nodeAllocations[nodeId] ?? 0
  if (current <= 0) return { success: false }                       // AC5 no-op, BEFORE any snapshot

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

One pre-mutation `activeBuild` is pushed once; the whole batch lands in one `newNodeAllocations`; `undoNodeChange()` (`:425-434`) restores the entire prior build in one step (AC3). **Never** loop `applyNodeChange(-1)` — that pushes N snapshots **and** re-trips the single-hop `blockedByDependents` block (`:221-233`).

### Right-click wiring (Option A) — two entry points, unified on `onNodeContextMenu`

Both the WebGL hit-area (`pixiRenderer.ts:619`) and the focused-node DOM button (`SkillTreeCanvas.tsx:360`) currently call `onNodeClick(id, 2)` → `applyNodeChange(-1)`. Point **both** at the already-typed `onNodeContextMenu(nodeId, screenX, screenY)` (`types.ts:11,60`, threaded `SkillTreeCanvas.tsx:24,34,89`, bound `SkillTreeView.tsx:854,929`). The browser native menu is already suppressed (`pixiRenderer.ts:207-209`), so no fight. AR-6 holds: the canvas stays props/ref-only — `onNodeContextMenu` is a prop, no store access added.

Flow lives in `useSkillTree.handleNodeContextMenu` → **passive** (`slotId === undefined`) computes orphans → direct `removeAllPoints` (AC1) or `pendingRemoval` state → `<RemoveNodeConfirmDialog>` in `SkillTreeView` → `removeAllPoints` on confirm (AC2). **Skill slots** (`slotId !== undefined`) keep single-decrement in the same handler. **Weaver is the trap:** it is a third `useSkillTree` instance with `slotId === undefined` (`SkillTreeView.tsx:484`), so it would be mis-routed into passive `removeAllPoints` by the shared-renderer rewire — it must instead get a **local** `handleWeaverNodeContextMenu` → `applyWeaverNodeChange(-1)` (Task 3.5). The three `onNodeContextMenu` bindings: passive `:854`, skill `:929` (both from the hook, slotId-discriminated), weaver `:645` (local handler).

### Patterns, traps & invariants (from Epic 3 history)

- **Pattern P4-7 / NFR-6:** bulk op = exactly one undo snapshot; never a loop. (`architecture.md:394-398`, `:531`.)
- **`isPersisted` trap (3.4):** passive allocation — single *and* bulk — does NOT set `isPersisted: false` (`applyNodeChange`/`fillNodeToMax` both omit it). **Do not add it to `removeAllPoints` alone** — that would make removals dirty the build while allocations don't. Out of scope to "fix" globally.
- **Shared-file surface:** `pixiRenderer.ts`/`useSkillTree.ts`/`SkillTreeView.ts` already carry 3.2/3.3 (`focusNode`, emphasis) + 3.4 (`fillNodeToMax`) additions — integrate, don't clobber.
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
| b2 | diamond `root→{A,B}→C` (fresh, separate fixture), `removeAllPoints('B')` | helper → `['C']`; `removed === ['B','C']`; `B`,`C` deleted, `root`,`A` remain — proves strict symmetry (do NOT chain after b1: C is already gone there) |
| c | leaf removal (`mockTreeData` child) | helper → `[]`; only `child` deleted; `root` remains; `undoStack 1` |
| d | remove root (`mockTreeData`) | helper → `['child']`; both deleted (map empty); one `undoNodeChange()` restores **both** |
| e | unallocated node | `removeAllPoints` → `{ success: false }`; `nodeAllocations` and `undoStack` unchanged (no spurious entry) |
| f | redo cleared by removal | seed redo via applyNodeChange→undo; `removeAllPoints` → `redoStack.length === 0` |
| g | confirm dialog naming | rendered orphan names set-equal `orphanIds.map(id => getNodeName(id, gameData, classId, masteryId))` (NOT bare `.map(getNodeName)` — that passes index/array as gameData/classId); Continue → `onConfirm` once; Cancel → allocations untouched; axe clean |
| h | routing (all THREE trees) | passive right-click → remove-all/cascade; skill-slot right-click → single `applySkillNodeChange(-1)` (passive map untouched); **weaver right-click → single `applyWeaverNodeChange(-1)`, passive `nodeAllocations` UNTOUCHED, no `removeAllPoints` call** (regression guard for the shared-renderer rewire — Task 3.5) |
| i | canvas contract | `SkillTreeCanvas.test.tsx:120` green: `fireEvent.contextMenu` fires `onNodeContextMenu(id, number, number)`, not `onNodeClick` |

### Out of Scope (do NOT touch)

scoring-core / Rust / `compute_stats` / `NodeEfficiency` / `optimization:*`; `fillNodeToMax` (3.4); `applyNodeChange`'s single-hop block (`:221-233`) and skill/weaver allocation actions; the `isPersisted` omission (don't "fix"); `NodeContextMenu.tsx` (left as scaffold under Option A — don't delete, don't wire unless Alec picks D1-Option B); unrelated baseline failures (`ProviderSelector`/`Settings`/`TreeControls`).

### Project Structure Notes

All new files are co-located in `features/skill-tree/` (helper + dialog + tests) per the self-contained-feature rule; the only shared edits are `build.ts` (type) and `buildStore.ts` (store action) — both in `shared/`, the correct home for cross-feature types/state. `RemoveNodeConfirmDialog` replicates the `DeleteConfirmDialog` *pattern* without importing across feature folders (project rule). No new store, no router, no IPC, no dependency.

### References

- Epic / story: `_bmad-output/planning-artifacts/epics.md:706-721` (Story 3.5), `:109` (FR-45), `:275` (impl notes), `:624-626` (Epic 3 goal)
- Architecture: `architecture.md:394-398` (Pattern P4-7), `:414` (enforcement #7), `:531` (file ownership)
- Twin action: `buildStore.ts:34-37, 253-321` (`fillNodeToMax`); undo tail `:318-319`; block `:221-233`; zero-key `:235-240`; undo/redo `:425-445`; `MAX_UNDO_STACK :8`
- Prereq graph: `shared/types/treeData.ts:13-26` (`TreeNode`/`TreeEdge`), `treeDataTransformer.ts:61-62`; `gameData.ts:1-12` (`GameNode.prerequisiteNodeIds`)
- Seam: `pixiRenderer.ts:207-209, 618-621`; `SkillTreeCanvas.tsx:24,34,89,358-361`; `useSkillTree.ts:59-88,130-137`; `types.ts:7-12,49-67`; `SkillTreeView.tsx:854,929`
- Reuse: `build-manager/DeleteConfirmDialog.tsx` (confirm pattern); `shared/utils/getNodeName.ts` (3.3); `ApplyNodeResult` `build.ts:81`
- Test idioms: `buildStore.test.ts:339-345,406-410,502-585`; `useSkillTree.test.ts:120-130,178-211`; `SkillTreeCanvas.test.tsx:120-129`
- Memory: `[[source-audit-at-create-story]]`, `[[autosave-watcher-unvalidated]]`

## Dev Agent Record

### Agent Model Used

<!-- dev-story fills this -->

### Debug Log References

### Completion Notes List

### File List
