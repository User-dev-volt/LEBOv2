# Story 3.4: Shift+click fill node to max

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## ⚠️ READ FIRST — This feature is already implemented; 3.4 is a RECONCILE + VERIFY + HARDEN story

The shift+click fill-to-max behavior (FR-44) **already exists end-to-end in the codebase**, shipped in commit `96d809a` (2026-05-27, Phase-3-era — **before** Epic 3 was even planned: `epics.md` was generated 2026-06-02). Do **NOT** build it from scratch and do **NOT** create a second/duplicate bulk-allocate action — that is the #1 disaster this story exists to prevent.

What already works today:

| Layer | Where | Status |
|---|---|---|
| Store batch action | `buildStore.applyNodeChangeBulk(nodeId, treeData)` (`buildStore.ts:253-321`) | ✅ budget-limited, **single** undo snapshot (`:318`), prereq-checked |
| Hook routing | `useSkillTree.handleNodeClick` (`useSkillTree.ts:64-71`) — `button===0 && shiftKey && slotId===undefined` → calls bulk | ✅ passive-tree-only guard present |
| Event plumbing | `pixiRenderer.ts:627` `onNodeClick(node.id, 0, e.shiftKey)`; `types.ts:8,55` carry `shiftKey?` | ✅ shift state reaches the hook |
| Store tests | `buildStore.test.ts:502-571` (7 tests) | ✅ fill-to-max, budget-cap, single-undo, prereq |

**The actual gap between the shipped code and this story's spec is narrow.** The single most important fix is a **naming reconciliation**: the spec (epics AC2 + architecture **Pattern P4-7**) mandates the action be called **`fillNodeToMax`**, but the code calls it `applyNodeChangeBulk`. The rest is closing three test-coverage gaps. Full detail in Dev Notes.

## Story

As a player,
I want shift+click to fill a node to its max in one action,
so that I can allocate multi-point nodes without repeated clicking.

## Acceptance Criteria

**AC1 — Shift+click fills to max (FR-44)**
**Given** a partially-allocated or available passive node
**When** I shift+click it
**Then** all remaining points up to the node's `maxPoints` **or** the remaining budget (whichever is lower) are allocated in a **single action** (FR-44).

> **Confirmed scope/decisions (see Dev Notes "DECISIONS"):**
> - The budget cap ("or the remaining budget, whichever is lower") is applied **only when `budgetEnforced === true`** — identical to single-click `applyNodeChange` (`buildStore.ts:212-218`). When `budgetEnforced === false` (the default for a new build, `createBuild` → `budgetEnforced: false`), shift+click fills to `maxPoints` ignoring budget, mirroring how single-click behaves on an unenforced build. This is the **already-shipped** behavior and is internally consistent; **do not change it** under this story. Flagged for Alec.
> - Shift+click is **passive-tree only** (`slotId === undefined`). On a skill slot or the weaver tree it must remain an ordinary single +1 click. This guard already exists (`useSkillTree.ts:64`) — preserve it.

**AC2 — Budget-limited, single undo step via `fillNodeToMax` (FR-44, NFR-6, Pattern P4-7)**
**Given** 2 unspent points (`budgetEnforced`) and a node with 3 points remaining
**When** I shift+click
**Then** exactly **2** points are allocated (budget-limited)
**And** the batch is recorded as a **single undo step** via **`buildStore.fillNodeToMax`**, never a loop of `applyNodeChange` calls (Pattern P4-7, NFR-6).

> **Confirmed scope/decisions:**
> - AC2 names the action **`buildStore.fillNodeToMax`** — the codebase currently calls it `applyNodeChangeBulk`. **Reconcile by renaming** `applyNodeChangeBulk` → `fillNodeToMax` (Task 1; rationale + the alternative in DECISIONS). Architecture **Pattern P4-7** and the §4.9 ownership map (`architecture.md:531`) both spell it `fillNodeToMax`, and Story **3.5** will add its sibling `removeAllPoints` alongside it — so the spec name must win for the pair to be consistent.
> - "Single undo step" is **already satisfied** by the existing `[...state.undoStack, activeBuild].slice(-MAX_UNDO_STACK)` snapshot-once pattern (`buildStore.ts:318`). The verification gap is a **test asserting the exact AC2 numbers** (2 unspent / 3 remaining → exactly 2; one undo entry), which the current tests do not cover (Task 2).
> - The architecture writes `fillNodeToMax(nodeId)` as shorthand. The real signature **must keep `treeData`**: `fillNodeToMax(nodeId, treeData)` — it needs `treeData` for `maxPoints` and prerequisite-edge lookups, exactly like every sibling action (`applyNodeChange(nodeId, delta, treeData)`). Do not drop the param.

## Tasks / Subtasks

- [x] **Task 1 — Reconcile the action name to the spec: `applyNodeChangeBulk` → `fillNodeToMax` (AC2; Pattern P4-7)**
  - [x] Rename the action in the `BuildStore` interface (`buildStore.ts:34-37`) and its implementation (`buildStore.ts:253`). Keep the signature `fillNodeToMax: (nodeId: string, treeData: TreeData) => ApplyNodeResult`. **Do not alter the body's logic** — it already implements FR-44 (budget-limited fill, prereq check, single undo snapshot). This is a rename, not a rewrite.
  - [x] Update the **sole production caller**: `useSkillTree.ts:32` (`const applyNodeChangeBulk = useBuildStore((s) => s.applyNodeChangeBulk)`), `:65` (the call), and the `useCallback` dep array `:87`. Rename the local binding too (e.g. `fillNodeToMax`) for clarity. (Grep-verified: `useSkillTree.ts` is the **only** non-test consumer.)
  - [x] Update the test describe + 7 call sites: `buildStore.test.ts:502` (`describe('buildStore — applyNodeChangeBulk')`) and `:511,523,530,533,540,548,558,568`.
  - [x] **Grep the whole repo for `applyNodeChangeBulk` after the rename — expect zero remaining hits.** (Today: interface, impl, hook ×3, tests ×8. Nothing else.)

- [x] **Task 2 — Verify + harden the budget-limited fill with the exact AC2 value test (AC1/AC2 — value+element)**
  - [x] In `buildStore.test.ts` (the renamed `describe`), add the **literal AC2 scenario**: set `activeBuild` to `{ ...mockBuild, characterLevel: 6, budgetEnforced: true, nodeAllocations: { root: 2 } }` so `root` (maxPoints 5, `mockTreeData:341`) has **3 remaining** and budget = `calculatePassivePoints(6)=4` − `2` allocated = **2 unspent**; call `fillNodeToMax('root', mockTreeData)`; assert `nodeAllocations.root === 4` (**exactly 2 added**, not 3) **and** `undoStack.length === 1` (single step). This is the AC2 fixture the current suite is missing — `:515-526` tests a budget cap but from an empty node (4 of 5), never the partial-pre-alloc + budget-cap combination the AC specifies.
  - [x] Confirm the existing coverage survives the rename and still asserts **values** (not counts): fill-to-max unbudgeted → `root === 5` (`:509-513`); already-at-max → `success:false` + unchanged (`:528-536`); partial→fill-remaining → `2`→`5` (`:562-570`); prereq-not-met → `success:false`, `error:'Prerequisite not met'`, build stays `null` (`:538-544`); single-undo (`:546-550`); redo cleared (`:552-560`).

- [x] **Task 3 — Verify the passive-only shift routing at the hook level (AC1 guard — currently untested)**
  - [x] Extend `useSkillTree.test.ts` (exists; `mockTreeData` at `:11-17`, `root` maxPoints 5 / `child` maxPoints 1). Add: `renderHook(() => useSkillTree(mockTreeData))` then `act(() => result.current.handleNodeClick('root', 0, true))` → assert `nodeAllocations.root === 5` (shift fills to max in one action) **and** `undoStack.length === 1`. Contrast with the existing non-shift test (`:64-70`, three clicks → 3) to prove shift ≠ repeated single-click.
  - [x] Add the **passive-only guard** test: `renderHook(() => useSkillTree(mockTreeData, 'slot-0'))` (a skill slot → `slotId` defined) then `handleNodeClick('root', 0, true)`; assert it did **NOT** bulk-fill — the skill path (`applySkillNodeChange`) runs instead, so `skillNodeAllocations['slot-0'].root === 1` (single point; `root` is allocatable with no prereq) and the passive `nodeAllocations` is untouched. This proves `slotId === undefined` is what gates bulk (`useSkillTree.ts:64`), matching `SkillTreeView`'s wiring (`SkillTreeView.tsx:447` passive `useSkillTree(treeData)` vs `:448` skill `useSkillTree(skillTreeData, slotId)`).
  - [x] (Optional, if a clean fixture is available) assert a **budget-limited** shift via the hook: enforced build + partial pre-alloc → exactly the remainder, mirroring AC2 at the interaction layer.

- [x] **Task 4 — Confirm event plumbing is intact; do NOT touch the 3.5 seam (AC1)**
  - [x] **No code change expected here** — verify and document only: `pixiRenderer.ts:623-630` `pointerup` passes `e.shiftKey` to `onNodeClick(node.id, 0, e.shiftKey)` (`:627`); the `onNodeClick` signatures in `types.ts:8` (`RendererCallbacks`) and `types.ts:55` (`SkillTreeCanvasProps`) already carry `shiftKey?: boolean`. If the rename or a stricter lint surfaces any unused-param/type drift, fix it minimally; otherwise leave the plumbing as-is.
  - [x] **Scope fence:** the `pointerdown` `e.button === 2` branch (`pixiRenderer.ts:618-619`) and `handleNodeContextMenu`/`NodeContextMenu.tsx` are **Story 3.5** (right-click remove-all + orphan cascade, FR-45). Do not wire, render, or modify them. `removeAllPoints` is **not** part of 3.4.

- [x] **Task 5 — Source Audit + build/baseline gate**
  - [x] Keep the `## Source Audit` section accurate (verdict: **N/A — no-new-stat / no-dead-key**; see below). No new `StatKey`/`StatSheet` field/displayed value is introduced; `fillNodeToMax` writes the **same** `nodeAllocations` field `applyNodeChange` already produces and `toBuildSnapshot()`→`compute_stats` already consumes. Tests assert **exact point values** (AC2 = exactly 2), satisfying the value+element verification guardrail — there is no prose/tag parse here, so no golden-count test applies.
  - [x] `pnpm build` (tsc + vite) clean. Full `pnpm vitest` shows **no new failures vs the standing baseline** — `ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls` (8 failed; 3.3 left the suite at **1230 passed / 8 failed**). Do not "fix" unrelated baseline failures here. Net test count should rise (added AC2 + hook routing tests), none removed except the pure rename of the `describe` label.

## Dev Notes

### What this story is (and is not)

This is a **reconcile-existing-implementation** story, not a feature build. FR-44's shift+click fill-to-max shipped in Phase 3 (`96d809a`, 2026-05-27) under the name `applyNodeChangeBulk`, fully wired through the hook and the PixiJS pointer event, with passing store tests. Epic 3's BMAD planning (Pattern P4-7, written 2026-06 against the *planned* architecture) prescribed the name `fillNodeToMax` without knowing the bulk action already existed — a planning-vs-code drift. **The work is: (1) rename to the spec name so the public API matches Pattern P4-7 and pairs cleanly with 3.5's `removeAllPoints`; (2) add the exact AC2 value test the suite is missing; (3) add the passive-only shift-routing test the hook suite is missing; (4) confirm the event plumbing untouched.** No new behavior, no scoring/Rust change, no new displayed value.

**Out of scope — do not implement here:**
- **Right-click remove-all + orphan cascade** = Story **3.5** (FR-45). `removeAllPoints`, the `button===2` pointer branch (`pixiRenderer.ts:618-619`), `handleNodeContextMenu`, and `NodeContextMenu.tsx` (unrendered scaffolding) are all 3.5. Pattern P4-7 pairs `fillNodeToMax` + `removeAllPoints`, but **only `fillNodeToMax` is 3.4.**
- **The passive `isPersisted` dirty-flag quirk** — `applyNodeChange` (`:242-246`) **and** `applyNodeChangeBulk` (`:313-317`) both omit `isPersisted: false` when committing the new build (unlike `applySkillNodeChange`/`applyWeaverNodeChange`/idol/blessing actions, which set it). So passive allocation — single **and** bulk — does not mark the build unsaved. This is **pre-existing and consistent**, and it affects the StatusBar unsaved indicator (Story 2.8) for *all* passive edits, not just shift+click. **Do NOT add `isPersisted: false` to `fillNodeToMax` alone** — that would make bulk passive-clicks dirty the build while single passive-clicks don't, an inconsistency worse than the status quo. If this is a real bug it's a separate cross-cutting fix for both passive actions. Flagged for Alec.
- Any change to `selectUnspentPassivePoints` / the inline budget math. The bulk action computes budget inline (`available - allocated`, `:304-306`) exactly like `applyNodeChange:213-214`; keep that — do not refactor it to the 3.1 selector.
- Scoring-core, Rust, `compute_stats`, `NodeEfficiency`, `optimization:*` emits — all untouched.

### DECISIONS (FR text + architecture govern; flag for Alec)

1. **Rename `applyNodeChangeBulk` → `fillNodeToMax` (recommended).** AC2 literally says "via `buildStore.fillNodeToMax`"; Pattern P4-7 (`architecture.md:394-398`) and the §4.9 ownership row (`architecture.md:531`, "`buildStore.ts` (`fillNodeToMax`, `removeAllPoints`)") both name it `fillNodeToMax`; Story 3.5 adds `removeAllPoints` as its pair. The name is internal (one production caller, `useSkillTree.ts`), so the rename is low-risk and makes code match the architecture the next story also reads.
   - *Alternative considered & rejected:* keep `applyNodeChangeBulk` and treat AC2 as "satisfied by an equivalently-behaving action." Rejected — it leaves the codebase permanently diverged from the architecture doc that 3.5 will cite, and a reviewer auditing AC2 against the literal `fillNodeToMax` reference would flag it. If Alec prefers zero churn on working code, a thin `fillNodeToMax` that delegates to the existing body is a middle path, but a straight rename is cleaner (no dead alias).
2. **Budget cap is `budgetEnforced`-gated** (AC1 callout). The shipped action applies the "whichever is lower" budget cap only when `budgetEnforced === true`, matching `applyNodeChange`. Unenforced builds (the default) fill to `maxPoints`. Confirmed as the intended, consistent behavior — `buildStore.test.ts:515` already sets `budgetEnforced: true` for its cap test, so the team already encoded this assumption. Not changing it.
3. **Keep `treeData` in the signature** — architecture's `fillNodeToMax(nodeId)` is shorthand; the implementation needs `treeData` for `maxPoints`/prereq lookups like every sibling allocation action.

### Current state of the files being modified

- **`buildStore.ts`** — `applyNodeChangeBulk(nodeId, treeData)` declared in the interface (`:34-37`) and implemented (`:253-321`): auto-creates the build on first allocation (`:258-282`, same as `applyNodeChange`); `nodeSpace = node.maxPoints - current` (`:289`); returns `success:false` if `nodeSpace<=0` (`:290`) or prereqs unmet (`:293-299`); budget cap only under `budgetEnforced` (`:303-309`, `toAllocate = Math.min(nodeSpace, budget)`); commits with a **single** undo snapshot + cleared redo (`:312-320`). Note it omits `isPersisted:false` (`:313-317`) — consistent with `applyNodeChange:242-246`, see Out-of-scope. `selectUnspentPassivePoints`/`selectAvailablePassivePoints` exist at `:73-82`.
- **`useSkillTree.ts`** — `handleNodeClick(nodeId, button, shiftKey?)` (`:59-88`): the shift branch `button===0 && shiftKey && slotId===undefined` calls `applyNodeChangeBulk(nodeId, treeData)` and flashes/sets error on failure (`:64-71`); otherwise routes to `applySkillNodeChange` (slot) or `applyNodeChange` (passive) with `delta = button===2 ? -1 : 1` (`:73-85`). `applyNodeChangeBulk` selector at `:32`; dep array at `:87`. Renaming touches exactly these.
- **`pixiRenderer.ts`** — `pointerup` (`:623-630`): on a clean (non-drag) left-click fires `onNodeClick(node.id, 0, e.shiftKey)` then `onNodeSelect`. `pointerdown` `e.button===2` (`:618-619`) is the right-click/3.5 seam. **No change expected.**
- **`types.ts`** (`skill-tree/types.ts`) — `onNodeClick: (nodeId, button: 0|2, shiftKey?: boolean) => void` on both `RendererCallbacks` (`:8`) and `SkillTreeCanvasProps` (`:55`). Already correct.
- **`SkillTreeView.tsx`** — passive canvas uses `useSkillTree(treeData)` (`:447`, `slotId` undefined → bulk enabled); skill canvas uses `useSkillTree(skillTreeData, slotId ?? undefined)` (`:448`, `slotId` defined → bulk skipped); weaver `useSkillTree(... )` (`:449`). Confirms the passive-only guard is correctly fed. No change needed.
- **`buildStore.test.ts`** — `mockBuild` (`:8-24`, `budgetEnforced:false`), `mockTreeData` (`:338-345`: `root` maxPoints 5 no-prereq, `child` maxPoints 3 requires root, edge root→child), the `applyNodeChangeBulk` describe (`:502-571`). `calculatePassivePoints(level) = max(0, level-2)` (`budgetCalculator.ts:6-8`).
- **`useSkillTree.test.ts`** — `renderHook` harness, local `mockTreeData` (`:11-17`, `root` maxPoints 5 / `child` maxPoints 1), fake timers; covers left/right-click, prereq block, flash, select, context-menu — **no shift+click test anywhere** (no call passes the 3rd arg). This is the routing gap Task 3 closes.

### Anti-patterns / guardrails (do not violate)

- **Do not reinvent / duplicate** — the bulk action exists; rename it, don't add a second one. Creating a parallel `fillNodeToMax` next to `applyNodeChangeBulk` would leave two batch-allocate paths and split the tests.
- **Never a loop of `applyNodeChange`** (Pattern P4-7 / NFR-6) — the batch must push exactly **one** `undoStack` entry. The existing body already does this; preserve it.
- **Passive-tree only** — keep the `slotId === undefined` guard; skill/weaver shift+click stays single +1.
- **Canvas stays props/ref-only** (AR-6) — the shift state arrives as the `onNodeClick` argument from the PixiJS event; no Zustand inside `SkillTreeCanvas`/`pixiRenderer`. Don't add store reads to the canvas.
- **Don't touch the 3.5 seam** — `button===2`, `removeAllPoints`, `NodeContextMenu`, `handleNodeContextMenu`. `pixiRenderer.ts`/`useSkillTree.ts` are shared across Epic 3 (3.2/3.4/3.5); keep this change a localized rename + tests.
- **Strict TS** (`noUnusedLocals/noUnusedParameters`), named exports only, no barrel files, tokens-not-hex (no hex touched here). The WebGL null-info-log patch is already at module load in `pixiRenderer.ts` — never re-inject.
- **Tests are value+element** — assert exact allocated point values (AC2 = exactly 2; fill = exactly maxPoints), not "an allocation happened" or a count of tests.

## Source Audit

Per the LEBOv2 guardrail (the Epic-1 computed/displayed-but-not-sourced defect class: penetration / stun / minion — correct math for a stat the loader never feeds). **This story introduces no new stat.**

- **New `StatKey` / `StatSheet` field / displayed value?** **None.** `fillNodeToMax` (renamed from `applyNodeChangeBulk`) writes to `activeBuild.nodeAllocations` — the **same** field `applyNodeChange` already produces. That field is consumed downstream by `toBuildSnapshot(build, gameData)` → `invokeCommand('compute_stats', …)` exactly as today. Shift+click only changes *how many points are written per click*, not *what is computed or displayed*.
- **Dead-key check:** the produced key (`nodeAllocations`) is consumed end-to-end (snapshot serializer → Rust scoring). No new key is produced; nothing becomes produced-but-unconsumed or consumed-but-unproduced. The rename keeps the producer (the store action) and consumer (`useSkillTree`) in lockstep — grep-verified single caller.
- **Verification:** because there is **no prose/tag/element parsing** in this story, the "value + element assertion over real source nodes (not a golden count)" clause is satisfied by the AC2 **exact-value** allocation test (2 unspent / 3 remaining → exactly 2) and the fill-to-`maxPoints` test — not a test-count or snapshot.

### Verdict: **N/A — no-new-stat / no-dead-key.** Allocation-interaction story; the obligation is met by exact-value allocation tests and by keeping the renamed action's producer/consumer in lockstep.

### Project Structure Notes

- All changes are confined to `lebo/src/shared/stores/buildStore.ts` (+ `buildStore.test.ts`) and `lebo/src/features/skill-tree/useSkillTree.ts` (+ `useSkillTree.test.ts`); `pixiRenderer.ts`/`types.ts` are verify-only. No new files, no new view, no router, no store-schema change, no new dependency. PixiJS 8.18.1 unchanged. No web research required (no external lib/API; behavior is internal state + an existing pointer event).
- `pixiRenderer.ts` / `useSkillTree.ts` are shared across Epic 3 (3.2 done, 3.3 in review, 3.5 backlog) — keep this a tight, localized rename so it doesn't conflict with 3.5's right-click work on the same files.

### References

- [Source: epics.md:689-704 / Epic 3, Story 3.4] — story statement + AC1 (fill to maxPoints or budget) + AC2 (2 unspent / 3 remaining → exactly 2; single undo step via `buildStore.fillNodeToMax`, never a loop).
- [Source: epics.md:108 / FR-44] + [epics.md:130 / NFR-6 (SM-6)] — shift+click fills to `max_points` or remaining budget, one action, single undo step.
- [Source: architecture.md:394-398 / Pattern P4-7] — **Batch allocate/remove is a single undo step**; "New `buildStore` actions `fillNodeToMax(nodeId)` and `removeAllPoints(nodeId)` snapshot once, then apply the full batch. Never implement these as a loop of single `applyNodeChange` calls."
- [Source: architecture.md:414 / P4-7 cheat-line] + [architecture.md:531 / §4.9 ownership] — `Multi-allocate fix → buildStore.ts (fillNodeToMax, removeAllPoints), useSkillTree.ts, pixiRenderer.ts`.
- [Source: buildStore.ts:253-321] — the **already-implemented** bulk action (rename target): nodeSpace, prereq check, `budgetEnforced`-gated `Math.min(nodeSpace, budget)`, single undo snapshot `:318`.
- [Source: buildStore.ts:34-37,73-82,163-251] — interface decl to rename; `selectUnspentPassivePoints`; `applyNodeChange` (the single-click sibling whose budget-gating + `isPersisted` omission the bulk action mirrors).
- [Source: useSkillTree.ts:32,59-88] — `handleNodeClick` shift branch (`button===0 && shiftKey && slotId===undefined` → bulk), selector + dep array to rename; passive-only guard.
- [Source: pixiRenderer.ts:623-630] — `pointerup` passes `e.shiftKey` to `onNodeClick(node.id, 0, e.shiftKey)`; `:618-619` `button===2` is the 3.5 seam (do not touch).
- [Source: skill-tree/types.ts:8,55] — `onNodeClick(nodeId, button, shiftKey?)` already carries shift on both interfaces.
- [Source: SkillTreeView.tsx:447-449] — passive `useSkillTree(treeData)` (bulk on) vs skill `useSkillTree(skillTreeData, slotId)` (bulk off) — confirms the `slotId===undefined` guard is correctly fed.
- [Source: buildStore.test.ts:8-24,338-345,502-571] — `mockBuild`, `mockTreeData` (root maxPoints 5 / child maxPoints 3), existing 7 bulk tests to keep + the missing AC2 fixture to add.
- [Source: useSkillTree.test.ts:1-17,64-70] — `renderHook` harness + `mockTreeData`; existing non-shift multi-click test; no shift+click coverage (Task 3 gap).
- [Source: budgetCalculator.ts:6-8] — `calculatePassivePoints(level) = max(0, level-2)` (level 6 → 4 budget, the AC2 fixture math).
- [Source: build.ts:81] — `ApplyNodeResult = { success: boolean; error?: string; blockedByDependents?: string[] }` (return type, unchanged).
- [Source: treeData.ts:13-31] — `TreeNode.maxPoints`, `TreeEdge{fromId,toId}`, `TreeData{nodes,edges}` (the `treeData` the action needs — why the param stays).
- [Source: git 96d809a, 2026-05-27] — commit that introduced both `applyNodeChangeBulk` and the `shiftKey` plumbing, predating epics.md (2026-06-02) → confirms pre-existing Phase-3 implementation, not in-flight Epic-3 work.
- [Source: project-context.md] — props-only canvas (AR-6), allocation records omit zero-value keys (`?? 0` reads), never bypass `apply*NodeChange` with direct `set()`, value+element tests (no snapshots), strict TS / named exports / no barrels.
- [Source: 3-3-…md "Out of scope"] — 3.3 explicitly deferred "Shift+click fill-to-max = Story 3.4 (FR-44). Do not touch `buildStore` allocation actions or `useSkillTree` click handling for multi-allocate" → 3.4 is exactly that surface.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code `create-story`: exhaustive artifact analysis — epics/architecture/PRD + full read of the three target source files and both test files + git history of the implementing commit).

### Debug Log References

- `grep applyNodeChangeBulk lebo/src` → **0 hits** after the rename (Task 1 gate).
- `vitest run buildStore.test.ts useSkillTree.test.ts` → **135 passed** (re-run twice across the session, both green on live disk).
- `pnpm build` (tsc + vite) clean; full `pnpm vitest run` → **1234 passed / 8 failed**, the 8 being the exact standing baseline (ProviderSelector / Settings / SkillTreeCanvas / TreeControls) — **+4 tests, no new failures**.
- ⚠️ **Environment anomaly (for Alec):** during the run an external process made transient phantom edits to the two shared files — one stripped `&& slotId === undefined` from `useSkillTree.ts:64` (passive-only guard), another reduced `toAllocate = Math.min(nodeSpace, budget)` to `toAllocate = nodeSpace` at `buildStore.ts:308` (budget cap). The AutoSave hook committed one such state as **d948556** (HEAD), so that commit's `buildStore.ts` has the **budget cap stripped**; the **working tree is correct** (re-verified by Read + grep + a green test re-run). Recommend committing the verified working tree and checking whatever process (formatter / second agent) is racing on these files.

### Completion Notes List

- **Task 1 — Renamed `applyNodeChangeBulk` → `fillNodeToMax`** (AC2 / Pattern P4-7): interface + impl in `buildStore.ts`, the sole production caller `useSkillTree.ts` (selector/call/dep-array/local binding), and the test describe + 8 call sites. **Body unchanged** — a rename, not a second bulk action. Grep → 0 hits.
- **Task 2 — AC2 value test** added: level 6 (`calculatePassivePoints(6)=4`), `budgetEnforced`, `nodeAllocations:{root:2}` → `fillNodeToMax('root')` → `root === 4` (exactly +2, budget-limited, not the 3 of node space) **and** `undoStack` length **1** (single step). The 7 pre-existing bulk tests survive the rename and still assert exact values.
- **Task 3 — passive-only shift routing** added to `useSkillTree.test.ts` (had zero shift+click coverage): passive shift → fill to `maxPoints` (5) in one action + undoStack 1; skill-slot guard → single +1 via `applySkillNodeChange` (`skillNodeAllocations['slot-0'].root === 1`, passive `nodeAllocations` untouched; seeds a build first since `applySkillNodeChange` does not auto-create); budget-limited shift through the hook → 4.
- **Task 4 — plumbing verify-only:** `pixiRenderer.ts` shiftKey pass + `types.ts` signature intact; **3.5 seam untouched** (`button===2`, `NodeContextMenu`, `handleNodeContextMenu`, `removeAllPoints`). No code change.
- **Task 5 — Source Audit** verdict **N/A — no-new-stat / no-dead-key** holds; value+element satisfied by the exact-allocation tests. Build + baseline gate green.
- **DECISIONS confirmed:** budget cap stays `budgetEnforced`-gated (unenforced fills to `maxPoints`); `treeData` kept in the signature; the `isPersisted:false` omission left consistent with `applyNodeChange` (not "fixed" on the bulk path alone).
- **Ultracode verification:** ground-truth scout (baseline + live-code claims + AC2 math) and a 3-lens adversarial panel (Acceptance / Scope-fence / Test-quality) — **all PASS**, 0 refutations, 0 scope violations.

### File List

- `lebo/src/shared/stores/buildStore.ts` — rename `applyNodeChangeBulk` → `fillNodeToMax` (interface + impl); body unchanged.
- `lebo/src/features/skill-tree/useSkillTree.ts` — rename to `fillNodeToMax` (selector/call/dep/local binding); routing + passive-only guard unchanged.
- `lebo/src/shared/stores/buildStore.test.ts` — rename describe + 8 call sites; **+1** AC2 test.
- `lebo/src/features/skill-tree/useSkillTree.test.ts` — **+3** shift+click routing tests (fill-to-max, passive-only guard, budget-limited via hook).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `3-4` status → `review`.

## Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story 3.4 **implemented → review** (dev-story + ultracode). Renamed `applyNodeChangeBulk` → `fillNodeToMax` (interface+impl + sole hook caller + test describe/8 calls; body unchanged; grep→0). Added the missing **AC2** value test (lvl6 / `budgetEnforced` / `root:2` pre-alloc → root **4** = exactly +2, `undoStack` length **1**) + 3 **passive-only shift-routing** hook tests (fill→5 in one action; skill-slot guard→single +1; budget-limited via hook→4). Plumbing + 3.5 seam verify-only. Source Audit N/A holds. tsc+vite clean; full vitest **1234 passed / 8 failed** = exact standing baseline (ProviderSelector/Settings/SkillTreeCanvas/TreeControls), **+4 tests, no new failures**. Ultracode scout + 3-lens adversarial panel (acceptance/scope-fence/test-quality) **all PASS**, 0 refutations. ⚠️ Env anomaly: a racing process made transient phantom edits stripping the passive-only guard (`useSkillTree.ts:64`) and budget cap (`buildStore.ts:308`); AutoSave **d948556** captured a buildStore.ts with the cap stripped — **working tree re-verified correct** (Read+grep+green re-run); recommend committing the verified tree + checking the racing process. |
| 2026-06-29 | Story 3.4 created (create-story). **Key finding: FR-44 shift+click fill-to-max is already implemented end-to-end** (`applyNodeChangeBulk` + hook routing + `pixiRenderer` shiftKey plumbing + 7 store tests) since commit `96d809a` / 2026-05-27 (Phase-3-era, pre-dates epics.md 2026-06-02). The story is therefore a **reconcile + verify + harden**, not a build: (1) **rename `applyNodeChangeBulk` → `fillNodeToMax`** to match AC2's literal reference + architecture Pattern P4-7 (and pair with 3.5's `removeAllPoints`) — internal name, one production caller (`useSkillTree.ts`), low-risk; (2) add the **exact AC2 value test** the suite lacks (2 unspent / 3 remaining → exactly 2, single undo step); (3) add the **passive-only shift-routing test** the hook suite lacks (`slotId===undefined` → bulk; defined slot → single skill click). Budget cap stays `budgetEnforced`-gated (consistent with `applyNodeChange`); `treeData` param kept; the passive `isPersisted` dirty-flag omission (shared by single + bulk passive clicks) is flagged out-of-scope (don't fix on the bulk path alone). **Source Audit verdict: N/A — no-new-stat / no-dead-key** (writes the existing `nodeAllocations` field, consumed by `toBuildSnapshot`→`compute_stats`; value+element satisfied by the exact-allocation tests, no parse/golden-count). Scope fence: right-click remove-all + orphan cascade + `NodeContextMenu` + `button===2` branch = Story 3.5; scoring-core/Rust untouched. Baseline: full `pnpm vitest` no new failures vs ProviderSelector/Settings/SkillTreeCanvas/TreeControls (3.3 left it at 1230 passed / 8 failed). Status → ready-for-dev. |
| 2026-06-30 | Code review (bmad-code-review, ultracode 6-lens adversarial + per-finding refutation) — reviewed jointly with Story 3.3, diff `9fd6030..c34761c`. **Clean: 0 findings against 3.4.** Acceptance Auditor (3.4) and Blind Hunter both empty: rename `applyNodeChangeBulk → fillNodeToMax` complete (interface + impl + sole hook caller + tests; grep → 0), AC2 value test asserts the literal numbers (lvl 6 → budget 4; root pre-alloc 2 / maxPoints 5 → exactly +2 = 4; undoStack length 1), 3.5 seam untouched. **Env anomaly RESOLVED at HEAD (verified):** `buildStore.ts` retains the budget cap `toAllocate = Math.min(nodeSpace, budget)` and `useSkillTree.ts` retains the passive-only guard `slotId === undefined`; bad AutoSave `d948556` (cap stripped) was superseded by `c34761c` == clean working tree, so no remediation needed. Status → done. |

---

### Review Findings

_Code review 2026-06-30 — reviewed jointly with Story 3.3 (`bmad-code-review`, ultracode: 6 parallel adversarial lenses + per-finding refutation, diff `9fd6030..c34761c`). **Clean — zero findings against Story 3.4.**_

- Both the Acceptance Auditor (3.4 lens) and the Blind Hunter returned **no findings**: the `applyNodeChangeBulk → fillNodeToMax` rename is complete (BuildStore interface + impl + the sole production caller `useSkillTree.ts` + the test describe and call sites; repo grep for the old name → 0 hits), the AC2 value test asserts the literal numbers (level 6 → budget 4; `root` pre-alloc 2 with maxPoints 5 → exactly +2 = 4; `undoStack` length 1), and the 3.5 seam (`button===2` / `NodeContextMenu` / `handleNodeContextMenu` / `removeAllPoints`) is untouched.
- **Environment anomaly RESOLVED at HEAD (verified during this review):** `buildStore.ts` retains the budget cap `toAllocate = Math.min(nodeSpace, budget)` and `useSkillTree.ts` retains the passive-only guard `button === 0 && shiftKey && slotId === undefined`. The bad AutoSave commit `d948556` (which had the budget cap stripped to `= nodeSpace`) was superseded by `c34761c`, which matches the clean working tree. No remediation needed — but worth investigating the racing process the dev flagged so it can't recur.
