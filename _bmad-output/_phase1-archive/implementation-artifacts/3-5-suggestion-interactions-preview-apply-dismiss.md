# Story 3.5: Suggestion Interactions — Preview, Apply, Dismiss

Status: done

## Story

As an advanced Last Epoch player,
I want to preview how a suggestion would change my tree, apply suggestions I agree with, and skip ones I don't — all with a single click each,
So that I maintain full control over my build while still benefiting from AI-guided analysis.

## Acceptance Criteria

1. **Given** a suggestion is visible in the list
   **When** the user hovers or focuses a `SuggestionCard`
   **Then** the tree canvas highlights the target node: glowing in node-suggested purple (#7B68EE)
   **And** if it's a SWAP, the source (`fromNodeId`) node dims slightly on the canvas
   **And** `SkillTreeCanvas` receives `highlightedNodes: { glowing: Set<string>; dimmed: Set<string> }` — no store access inside PixiJS

2. **Given** the user clicks the "Preview" button on a card
   **When** preview mode activates
   **Then** the tree canvas shows the full after-state: the suggestion's node allocation changes are reflected in `allocatedNodes`
   **And** `ScoreGauge` enters comparison mode showing `baselineScore → previewScore` side-by-side
   **And** a preview banner appears inside `SuggestionsList` above the cards: "Previewing suggestion #N — [Apply] [Cancel]"

3. **Given** the user clicks "Apply" (from the card button or from the preview banner)
   **When** the apply action fires
   **Then** `buildStore.applyNodeChange` is called for each node in the `NodeChange` (fromNodeId removal first for SWAPs, then toNodeId allocation)
   **And** the tree re-renders with the new allocation
   **And** the suggestion card shows a "✓ Applied" badge and its buttons are removed
   **And** the build auto-saves via the existing `useAutoSave` debounced hook (no new code needed)
   **And** the applied change is pushed to the undo stack by `applyNodeChange` (existing behaviour)

4. **Given** the user clicks "Apply" and the apply fails (prerequisite unmet, or node not found in game data)
   **When** the apply fires
   **Then** an inline error appears on the card: "Cannot apply: prerequisite node not allocated" or a generic fallback
   **And** no node state changes occur — `activeBuild.nodeAllocations` remains unchanged

5. **Given** the user clicks "Skip" on a suggestion
   **When** the dismiss fires
   **Then** the suggestion is removed from the active list and moves to a "Skipped" collapsed section at the bottom of the panel
   **And** the skipped section is collapsed by default and shows a "Skipped (N)" toggle
   **And** skipped suggestions are not permanently deleted — they're still visible when the section is expanded

6. **Given** the user presses `Ctrl+Z` after applying a suggestion
   **When** the undo fires
   **Then** the last applied node change is reverted via the existing `buildStore.undoNodeChange` (already wired in `SkillTreeView`)
   **And** the "✓ Applied" badge on the suggestion card is NOT cleared (the badge reflects the apply action, not the current tree state; clearing it requires re-running optimization)

## Tasks / Subtasks

- [x] Task 1: Extend `optimizationStore.ts` (AC: 1, 2, 3, 5)
  - [x] Add state: `skippedSuggestions: SuggestionResult[]`, `appliedRanks: number[]`, `previewSuggestionRank: number | null`, `highlightedNodeIds: { glowing: Set<string>; dimmed: Set<string> } | null`
  - [x] Add actions: `skipSuggestion(rank: number)` — moves suggestion from `suggestions` to `skippedSuggestions`; `setAppliedRank(rank: number)` — appends rank to `appliedRanks`; `setPreviewSuggestionRank(rank: number | null)`; `setHighlightedNodeIds(nodes: { glowing: Set<string>; dimmed: Set<string> } | null)`
  - [x] Extend `clearSuggestions()` to also reset `skippedSuggestions: []`, `appliedRanks: []`, `previewSuggestionRank: null`, `highlightedNodeIds: null`
  - [x] Use `number[]` not `Set<number>` for `appliedRanks` — Zustand `setState` with Sets can have reference-equality issues in selectors

- [x] Task 2: Update skill-tree types + pixiRenderer for split highlight (AC: 1)
  - [x] Add `HighlightedNodes` interface to `src/features/skill-tree/types.ts`: `{ glowing: Set<string>; dimmed: Set<string> }`
  - [x] Update `SkillTreeCanvasProps.highlightedNodes` from `Set<string>` to `HighlightedNodes`
  - [x] Update `RendererInstance.renderTree` signature: third arg `highlightedNodes: HighlightedNodes`
  - [x] Add `dimmedGraphics: Graphics` layer to `pixiRenderer.ts` (add to worldContainer after suggestedGraphics)
  - [x] Add `drawDimmed(g, x, y, r)`: `g.circle(x, y, r).fill({ color: 0x2a2a35, alpha: 0.6 }).stroke({ color: 0x5a5070, width: 1 })`
  - [x] Update `renderTree` in pixiRenderer: `const isGlowing = highlightedNodes.glowing.has(node.id)`, `const isDimmed = highlightedNodes.dimmed.has(node.id)` — draw glowing as suggested (existing `drawSuggested`), draw dimmed as new dim state, dimmed only fires if not glowing and not allocated
  - [x] Update `SkillTreeView.tsx`: change `EMPTY_HIGHLIGHTED` to `{ glowing: new Set<string>(), dimmed: new Set<string>() }` and update its type annotation

- [x] Task 3: Wire `SkillTreeView.tsx` to optimization store (AC: 1, 2)
  - [x] Import `useOptimizationStore` in `SkillTreeView.tsx`
  - [x] Subscribe: `const highlightedNodeIds = useOptimizationStore((s) => s.highlightedNodeIds)` and `const previewSuggestionRank = useOptimizationStore((s) => s.previewSuggestionRank)` and `const suggestions = useOptimizationStore((s) => s.suggestions)`
  - [x] Compute `previewSuggestion = suggestions.find((s) => s.rank === previewSuggestionRank) ?? null` (memoize with `useMemo` on `[suggestions, previewSuggestionRank]`)
  - [x] Compute `previewAllocatedNodes` with `useMemo`
  - [x] Pass `allocatedNodes={previewAllocatedNodes ?? allocatedNodes}` to `SkillTreeCanvas`
  - [x] Pass `highlightedNodes={highlightedNodeIds ?? EMPTY_HIGHLIGHTED}` to `SkillTreeCanvas`

- [x] Task 4: Update `SuggestionCard.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] Add props: `isApplied?`, `applyError?`, `isPreviewActive?`, `onApply`, `onSkip`, `onPreview`, `onHoverEnter`, `onHoverLeave`
  - [x] Add `onMouseEnter`/`onMouseLeave` to card root
  - [x] Applied state: badge + opacity + hidden buttons
  - [x] Button row: Preview, Apply, Skip with correct testids and styles
  - [x] `isPreviewActive` gold left border
  - [x] Error display below delta pills

- [x] Task 5: Update `SuggestionsList.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] All store slice subscriptions
  - [x] `applyErrors` local state
  - [x] `getAllGameNodes` helper
  - [x] `handleHoverEnter`/`handleHoverLeave`
  - [x] `handlePreview` toggle
  - [x] `handleApply` with SWAP support and error handling
  - [x] `applyPreview` from banner
  - [x] Preview banner with Apply/Cancel
  - [x] Skipped section with `<details>`

- [x] Task 6: Update `RightPanel.tsx` to wire `ScoreGauge` preview (AC: 2)
  - [x] Subscribe to `previewSuggestionRank` + `suggestions`
  - [x] Compute `previewScore`
  - [x] Pass `previewScore` to `ScoreGauge`

- [x] Task 7: Tests (AC: 1–6)
  - [x] `optimizationStore.test.ts` — 8 new tests for all new store actions
  - [x] `SuggestionCard.test.tsx` — 9 new interaction tests; existing 23 tests updated with default handlers
  - [x] `SuggestionsList.test.tsx` — 11 new interaction tests
  - [x] `RightPanel.test.tsx` — 2 new ScoreGauge preview tests
  - [x] `pnpm tsc --noEmit` + `pnpm vitest run` — 313/313 passing

## Dev Notes

### Critical: Existing Infrastructure — DO NOT Reinvent

| What | Where |
|------|-------|
| `buildStore.applyNodeChange(nodeId, delta, gameNode, allGameNodes)` | `src/shared/stores/buildStore.ts` — already validates prerequisites + dependents, pushes to undoStack |
| `buildStore.undoNodeChange()` | `src/shared/stores/buildStore.ts` — Ctrl+Z already wired in `SkillTreeView` |
| `ScoreGauge` comparison mode | `src/features/optimization/ScoreGauge.tsx` — `previewScore` prop already exists |
| `SuggestionResult.previewScore` | Already computed during streaming by `useOptimizationStream`; pass directly to `ScoreGauge` |
| `useAutoSave` | `src/features/build-manager/useAutoSave.ts` — subscribes to `buildStore`, auto-saves on `activeBuild` change when `isPersisted` |
| `SkillTreeCanvas.highlightedNodes` | Currently `Set<string>` — will be changed to `HighlightedNodes` by Task 2 |
| `drawSuggested` in pixiRenderer | Already draws purple glow — reuse for `glowing` set |
| `EMPTY_HIGHLIGHTED` constant | `SkillTreeView.tsx:14` — will be updated to `{ glowing: new Set(), dimmed: new Set() }` |

---

### Undo Semantics for Applied Suggestions

`applyNodeChange` pushes `activeBuild` to `undoStack` before every successful change. `Ctrl+Z` calls `undoNodeChange()` which pops it. This is already wired in `SkillTreeView` — no changes needed.

The "✓ Applied" badge does NOT reverse on undo. It's an audit trail of what was applied this session, not a live reflection of the current tree state. If the user undoes an applied suggestion, the badge stays — they need to re-run optimization to get a fresh list.

---

### Apply Logic for Each Change Type

```typescript
// ADD (fromNodeId === null, pointsChange > 0)
applyNodeChange(toNodeId, pointsChange, toGameNode, allGameNodes)

// REMOVE (fromNodeId === null, pointsChange < 0)
applyNodeChange(toNodeId, pointsChange, toGameNode, allGameNodes)
// pointsChange is already negative — applyNodeChange handles negative delta as deallocation

// SWAP (fromNodeId !== null)
const currentFromPoints = activeBuild.nodeAllocations[fromNodeId] ?? 0
if (currentFromPoints > 0) {
  const removeResult = applyNodeChange(fromNodeId, -currentFromPoints, fromGameNode, allGameNodes)
  if (!removeResult.success) { /* show error, abort */ }
}
applyNodeChange(toNodeId, pointsChange, toGameNode, allGameNodes)
```

For SWAP removes: `applyNodeChange` validates that no other allocated node depends on `fromNodeId` before allowing the removal. If a dependent exists, it returns `{ success: false, error: 'Cannot remove — N node(s) depend on this' }`. Surface this as an inline error on the card.

---

### Preview Allocation Computation (SkillTreeView)

```typescript
function computePreviewAllocations(
  base: Record<string, number>,
  nodeChange: NodeChange
): Record<string, number> {
  const result = { ...base }
  if (nodeChange.fromNodeId) {
    delete result[nodeChange.fromNodeId]
  }
  const currentTo = result[nodeChange.toNodeId] ?? 0
  const newTo = Math.max(0, currentTo + nodeChange.pointsChange)
  if (newTo === 0) delete result[nodeChange.toNodeId]
  else result[nodeChange.toNodeId] = newTo
  return result
}
```

This is a pure function — put it as a module-level helper in `SkillTreeView.tsx`. Wrap the call in `useMemo([suggestions, previewSuggestionRank, allocatedNodes])` to avoid recomputation on unrelated renders.

---

### HighlightedNodes Type Change

`types.ts` after this story:
```typescript
export interface HighlightedNodes {
  glowing: Set<string>   // drawn as suggested (purple #7B68EE)
  dimmed: Set<string>    // drawn as dimmed (grey, semi-transparent)
}
```

`EMPTY_HIGHLIGHTED` becomes:
```typescript
const EMPTY_HIGHLIGHTED: HighlightedNodes = {
  glowing: new Set<string>(),
  dimmed: new Set<string>(),
}
```

In `pixiRenderer.ts`, the render loop becomes:
```typescript
const isGlowing = highlightedNodes.glowing.has(node.id)
const isDimmed = highlightedNodes.dimmed.has(node.id) && !isGlowing

if (isAllocated || node.state === 'allocated') {
  drawAllocated(allocatedGraphics, node.x, node.y, r)
} else if (isGlowing || node.state === 'suggested') {
  drawSuggested(suggestedGraphics, node.x, node.y, r)
} else if (isDimmed) {
  drawDimmed(dimmedGraphics, node.x, node.y, r)
} else if (node.state === 'locked') {
  drawLocked(lockedGraphics, node.x, node.y, r)
} else {
  drawAvailable(availableGraphics, node.x, node.y, r)
}
```

`drawDimmed` function:
```typescript
function drawDimmed(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill({ color: 0x2a2a35, alpha: 0.6 })
  g.circle(x, y, r).stroke({ color: 0x5a5070, width: 1 })
}
```

`dimmedGraphics` must be cleared in `renderTree` alongside the other layers.

---

### appliedRanks as `number[]` not `Set<number>`

Zustand's `setState` compares old and new state by reference. `Set` mutations (`.add()`, `.delete()`) return the same reference, causing selectors to miss updates. Use `number[]` and spread: `set((s) => ({ appliedRanks: [...s.appliedRanks, rank] }))`.

---

### Skipped Section — `<details>` Element

Use a native HTML `<details>/<summary>` element for the collapsible skipped section — no new dependencies, no state:

```tsx
{skippedSuggestions.length > 0 && (
  <details data-testid="skipped-section">
    <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
      Skipped ({skippedSuggestions.length})
    </summary>
    <div className="flex flex-col gap-2 mt-2">
      {skippedSuggestions.map((s) => (
        <SuggestionCard
          key={`${s.rank}-${s.nodeChange.toNodeId}-skipped`}
          suggestion={s}
          toNodeName={getNodeName(s.nodeChange.toNodeId, gameData, classId, masteryId)}
          fromNodeName={...}
          isApplied={false}
          applyError={null}
          isPreviewActive={false}
          onApply={() => handleApply(s)}
          onSkip={() => {}}       // no re-skip in skipped section
          onPreview={() => {}}    // no preview of skipped suggestions
          onHoverEnter={() => handleHoverEnter(s)}
          onHoverLeave={handleHoverLeave}
        />
      ))}
    </div>
  </details>
)}
```

---

### Preview Banner Placement

The preview banner appears at the TOP of `SuggestionsList`, ABOVE the error banner and skeleton (it supersedes those states). It is shown when `previewSuggestionRank !== null`:

```tsx
{previewSuggestionRank !== null && (
  <div
    className="flex items-center justify-between gap-2 px-3 py-2 rounded text-xs"
    style={{ backgroundColor: 'var(--color-bg-elevated)', borderLeft: '2px solid var(--color-accent-gold)' }}
    data-testid="preview-banner"
  >
    <span style={{ color: 'var(--color-text-primary)' }}>
      Previewing suggestion #{previewSuggestionRank}
    </span>
    <div className="flex items-center gap-2">
      <button
        onClick={applyPreview}
        data-testid="preview-apply-btn"
        className="text-xs px-2 py-0.5 rounded"
        style={{ color: 'var(--color-data-positive)', border: '1px solid var(--color-data-positive)' }}
      >
        Apply
      </button>
      <button
        onClick={() => setPreviewSuggestionRank(null)}
        data-testid="preview-cancel-btn"
        className="text-xs px-2 py-0.5 rounded"
        style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-bg-hover)' }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

---

### pixiRenderer Test — Minimal Change

`pixiRenderer.test.ts` currently exists. Check what it tests and update the `renderTree` call signature if it passes a `Set<string>` — change to `{ glowing: new Set(), dimmed: new Set() }`.

---

### Patterns From Previous Stories

- No barrel `index.ts` files — import directly from file paths
- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ ... }}` for design tokens
- Test files co-located with source
- Mock Zustand stores: `useOptimizationStore.setState(overrides, true)` to reset between tests
- Mock `@tauri-apps/api/event` in any file that imports hooks calling `listen`
- Run `pnpm tsc --noEmit` before marking complete

---

### File Locations

**Modified files:**
- `lebo/src/shared/stores/optimizationStore.ts` — add new state + actions
- `lebo/src/features/skill-tree/types.ts` — add `HighlightedNodes`, update `SkillTreeCanvasProps` and `RendererInstance`
- `lebo/src/features/skill-tree/pixiRenderer.ts` — add `dimmedGraphics`, `drawDimmed`, update `renderTree`
- `lebo/src/features/skill-tree/SkillTreeView.tsx` — subscribe to optimization store, compute preview allocations
- `lebo/src/features/optimization/SuggestionCard.tsx` — add interaction props + buttons + applied/error states
- `lebo/src/features/optimization/SuggestionsList.tsx` — add apply/skip/preview/hover handlers + skipped section + preview banner
- `lebo/src/features/layout/RightPanel.tsx` — pass `previewScore` to `ScoreGauge`

**Modified test files:**
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` — update `renderTree` call signature
- `lebo/src/features/optimization/SuggestionCard.test.tsx` — add interaction tests
- `lebo/src/features/optimization/SuggestionsList.test.tsx` — add interaction tests
- `lebo/src/features/layout/RightPanel.test.tsx` — add preview/ScoreGauge tests

**New test files:**
- `lebo/src/shared/stores/optimizationStore.test.ts` (new — if doesn't exist)

---

### Regression Warning

`SkillTreeView.tsx` subscribes to `useOptimizationStore` for the first time in this story. The existing `SkillTreeView` tests render the component without an optimization store setup — they will continue to work because the initial store values (`highlightedNodeIds: null`, `previewSuggestionRank: null`) produce the same `EMPTY_HIGHLIGHTED` and `allocatedNodes` the existing tests expect.

`SuggestionCard.tsx` gains required props `onApply`, `onSkip`, `onPreview`, `onHoverEnter`, `onHoverLeave`. All existing `SuggestionCard.test.tsx` tests pass these as `vi.fn()`. Update the test factory function to include them.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- All 7 tasks completed. 313/313 tests passing (285 before this story).
- ✅ Resolved review finding [Patch]: SWAP rollback — `handleApply` now captures `fromRemovedPoints` and re-applies `fromNodeId` allocation if `toNodeId` fails (node not found or `applyNodeChange` returns `success: false`).
- ✅ Resolved review finding [Patch]: `onSkip`/`onPreview` changed from `() => allowInteraction && fn()` to `() => { if (allowInteraction) fn() }` — explicit void return.
- ✅ Resolved review finding [Patch]: Removed trailing duplicate `{...DEFAULT_HANDLERS}` spread from `SuggestionCard.test.tsx:33`.
- 352/352 tests pass after review fixes. `pnpm tsc --noEmit` clean.
- `HighlightedNodes` type changed from `Set<string>` to `{ glowing: Set<string>; dimmed: Set<string> }` in `types.ts`; propagated through `SkillTreeCanvasProps`, `RendererInstance.renderTree`, and `SkillTreeView.tsx`.
- `appliedRanks` stored as `number[]` (not `Set<number>`) to avoid Zustand reference-equality issues with Set mutations.
- `handleApply` in `SuggestionsList.tsx` reads `useBuildStore.getState().activeBuild` (not the React-subscribed value) to avoid stale closure issues during rapid state changes.
- SWAP apply sequence: remove `fromNodeId` first (`-currentFromPoints`), then add `toNodeId`. If the from-removal fails (dependent node exists), abort and surface inline error — `toNodeId` is never touched.
- `computePreviewAllocations` is a pure module-level function in `SkillTreeView.tsx` — no side effects, wrapped in `useMemo`.
- Skipped section uses native `<details>/<summary>` — no new dependencies, no local state.
- Preview banner placed above all other content in `SuggestionsList`; `previewSuggestionRank` toggle: clicking Preview again on the active card clears it.
- `pixiRenderer.test.ts` updated: `new Set()` → `{ glowing: new Set(), dimmed: new Set() }` (2 occurrences).
- Existing `SuggestionCard.test.tsx` tests (23) updated with `DEFAULT_HANDLERS` spread pattern to satisfy the new required props.

### File List

**Modified source files:**
- `lebo/src/shared/stores/optimizationStore.ts`
- `lebo/src/features/skill-tree/types.ts`
- `lebo/src/features/skill-tree/pixiRenderer.ts`
- `lebo/src/features/skill-tree/SkillTreeView.tsx`
- `lebo/src/features/optimization/SuggestionCard.tsx`
- `lebo/src/features/optimization/SuggestionsList.tsx`
- `lebo/src/features/layout/RightPanel.tsx`

**Modified test files:**
- `lebo/src/features/skill-tree/pixiRenderer.test.ts`
- `lebo/src/features/optimization/SuggestionCard.test.tsx`
- `lebo/src/features/optimization/SuggestionsList.test.tsx`
- `lebo/src/features/layout/RightPanel.test.tsx`

**New test files:**
- `lebo/src/shared/stores/optimizationStore.test.ts`

## Review Findings

- [x] [Review][Patch] SWAP apply has no rollback on toNodeId failure — if `fromNodeId` removal succeeds but `toNodeId` allocation fails (node not found in game data, or `applyNodeChange` returns `success: false`), the from-node is permanently deallocated without the to-node being allocated, leaving the build in a corrupt partial state [`SuggestionsList.tsx`, `handleApply`, SWAP branch] — fix: if toNodeId add fails, attempt to re-add `fromNodeId` or surface a combined error and abort both operations
- [x] [Review][Patch] `onSkip` and `onPreview` handlers return boolean expression instead of void — `onSkip={() => allowInteraction && skipSuggestion(suggestion.rank)}` returns `boolean | void`; typed as `() => void` so TypeScript allows it, but misleading and may cause issues if callers check return value [`SuggestionsList.tsx:161,163`] — fix: use explicit conditionals `() => { if (allowInteraction) skipSuggestion(suggestion.rank) }`
- [x] [Review][Patch] Test line 33 has duplicate `{...DEFAULT_HANDLERS}` spread — `<SuggestionCard {...DEFAULT_HANDLERS} suggestion={...} toNodeName="..." {...DEFAULT_HANDLERS} />` spreads the same const twice; same references so functionally harmless, but misleading [`SuggestionCard.test.tsx:33`] — fix: remove the trailing duplicate spread

## Change Log

| Date | Change |
|------|--------|
| 2026-04-25 | Story created from Epic 3 context. Stories 3.1–3.4 done. Status → ready-for-dev. |
| 2026-04-25 | Implementation complete. 7 tasks done, 313/313 tests pass. Status → review. |
| 2026-04-25 | 3 review findings written (1 patch-SWAP rollback, 1 patch-handler return type, 1 patch-duplicate spread) during 3.4 adversarial re-review. |
| 2026-04-25 | Addressed all 3 review findings. 352/352 tests pass. Status → done. |
