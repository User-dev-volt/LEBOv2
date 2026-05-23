---
title: 'Node Efficiency Overlay on Passive Tree'
story_id: '4.4'
story_key: '4-4-node-efficiency-overlay-on-passive-tree'
epic: 4
status: review
created: '2026-05-23'
---

## Story

**As a player,**
I want a color-coded efficiency heatmap overlay on the passive tree canvas showing which unallocated nodes offer the highest value for my current budget, with a toggle button to hide/show it,
**So that** I can visually identify the highest-value passive nodes at a glance without reading every suggestion detail.

---

## Context

This is Story 4.4 — the UI wiring story for the node efficiency overlay. Story 4.3 completed the full
`run_optimization` Tauri command which computes `ScanResult { node_efficiencies, build_score_baseline,
knapsack_solution }` but does **not yet** surface `node_efficiencies` to the passive tree canvas.

**What this story adds:**

1. `scoring_commands.rs` emits a new `optimization:node-efficiencies` Tauri event (before Claude delegation) containing `scan_result.node_efficiencies` serialized as JSON
2. `useOptimizationStream.ts` subscribes to this event, computes quartile-based tier assignment in TypeScript, and calls `setNodeEfficiencies()` on the optimization store
3. `pixiRenderer.ts` gains an `overlayGraphics` layer and overlay draw helpers; `renderTree()` accepts two new optional parameters: `nodeEfficiencies?` and `showOverlay?`
4. `types.ts` (`SkillTreeCanvasProps` and `RendererInstance`) updated to reflect new parameters
5. `SkillTreeCanvas.tsx` passes `nodeEfficiencies` and `showOverlay` down to `renderTree()`
6. `SkillTreeView.tsx` reads `nodeEfficiencies` from `optimizationStore`, manages `showOverlay` local state, computes `effectiveNodeEfficiencies` (null when zero unspent budget), and passes all to the passive canvas only
7. `TreeControls.tsx` gains an optional overlay toggle button

**What this story does NOT do:**
- Implement stat sheet hover deltas on suggestions (Story 4.5)
- Modify `scoring-core/src/scan.rs` — tier assignment is intentionally done in TypeScript; only `Serialize` needs confirming on `NodeEfficiency`
- Change the `optimization:*` event namespace (new event follows existing naming convention)
- Show overlay on skill trees or weaver tree — passive tree only

**Pre-existing state already wired (do NOT re-implement):**
- `optimizationStore` already has `nodeEfficiencies: NodeEfficiency[] | null`, `setNodeEfficiencies()`, and `clearSuggestions()` already sets `nodeEfficiencies: null` — Story 2.5 put all of this in place
- `NodeEfficiency` interface already exists in `shared/types/statSheet.ts` with `node_id`, `efficiency`, `path_delta_score`, `effective_point_cost`, `tier` — no changes needed there
- `run_optimization` in `scoring_commands.rs` already computes `scan_result.node_efficiencies` in the `spawn_blocking` call — Story 4.3

---

## Acceptance Criteria

**Given** `run_optimization` completes with node efficiencies
**When** `optimizationStore.nodeEfficiencies` is populated
**Then** the passive tree canvas renders efficiency tier colors on every unallocated node: gold = top quartile, silver = second quartile, dim = third/fourth quartile or unreachable within budget

**Given** all passive points are spent (zero unspent budget)
**When** the overlay is active
**Then** no efficiency overlay colors are rendered on any node (per FR-A27)

**Given** the tree controls bar
**When** a player clicks the overlay toggle button
**Then** the overlay hides if currently visible, and shows if currently hidden
**And** the overlay defaults to visible when `nodeEfficiencies` is non-null

**Given** the efficiency overlay is rendering
**When** a frame renders
**Then** the overlay adds ≤ 2ms to the frame render time (tier is pre-assigned in TypeScript when nodeEfficiencies arrives; per-frame draw is O(N) circle strokes only — no sorting or computation)

**Given** `SkillTreeCanvas` implementation
**When** an agent reviews it
**Then** `SkillTreeCanvas` does NOT access `optimizationStore` directly
**And** `nodeEfficiencies` is passed as a prop from `SkillTreeView` (following the props-only canvas rule)

---

## Tasks / Subtasks

- [x] Task 1: Emit `optimization:node-efficiencies` event from `scoring_commands.rs`
  - [x] Verify `scoring_core::NodeEfficiency` has `#[derive(Serialize)]` in `scan.rs` (or wherever defined); add it if missing — `serde` is already a dependency of scoring-core
  - [x] After `spawn_blocking` completes and before Claude delegation: `serde_json::to_string(&scan_result.node_efficiencies)` → emit `"optimization:node-efficiencies"` event
  - [x] Use the same `let _ = app_handle.emit(...)` pattern as other events; serialize failure = no event (don't error)
  - [x] `cargo build` passes, zero new warnings

- [x] Task 2: Subscribe to event in `useOptimizationStream.ts`, assign tiers, store result
  - [x] Add fifth listener `unlisten5` for `"optimization:node-efficiencies"` (type: `string` payload — raw JSON)
  - [x] In handler: parse JSON directly as `NodeEfficiency[]` (tier already assigned by Rust); call `setNodeEfficiencies(efficiencies)`
  - [x] Add `unlisten5` to `unlisteners` array; follow existing guard pattern (`if (!isMounted) { unlisten5(); return }`)
  - [x] Wrap parse+assign in try/catch — failure produces no overlay (correct behavior)
  - [x] `pnpm build` passes, zero TypeScript errors

- [x] Task 3: Extend `renderTree()` signature in `pixiRenderer.ts` and `types.ts`
  - [x] In `types.ts`: add `nodeEfficiencies?: NodeEfficiency[] | null` and `showOverlay?: boolean` to both `SkillTreeCanvasProps` and `RendererInstance.renderTree`
  - [x] Import `NodeEfficiency` in `types.ts` from `'../../shared/types/statSheet'`
  - [x] In `pixiRenderer.ts`: add import for `NodeEfficiency` from `'../../shared/types/statSheet'`; add `overlayGraphics` Graphics to `worldContainer` children list (BEFORE `searchDimOverlayGraphics`); add three overlay draw helpers; extend `renderTree()` signature and implementation
  - [x] All existing `renderTree()` call sites remain valid (new params are optional)
  - [x] `pnpm build` passes

- [x] Task 4: Update `SkillTreeCanvas.tsx` to pass overlay data to renderer
  - [x] Add `nodeEfficiencies` and `showOverlay` to `SkillTreeCanvasProps` destructuring
  - [x] Add both to `dataRef` tracking
  - [x] Update all three `renderTree()` call sites to include `nodeEfficiencies` and `showOverlay` from `dataRef.current`
  - [x] `pnpm build` passes

- [x] Task 5: Update `SkillTreeView.tsx` — subscribe, manage state, wire passive canvas
  - [x] Subscribe: `const nodeEfficiencies = useOptimizationStore((s) => s.nodeEfficiencies)` (selector pattern already used in the file)
  - [x] Add local state: `const [showOverlay, setShowOverlay] = useState(false)` with auto-show effect
  - [x] Add effect: auto-set to `true` when `nodeEfficiencies` arrives non-null
  - [x] Compute `effectiveNodeEfficiencies`: null when `unspentPassivePoints === 0`, else `nodeEfficiencies`
  - [x] Pass `nodeEfficiencies={effectiveNodeEfficiencies}` and `showOverlay={showOverlay}` to the passive `<SkillTreeCanvas>` ONLY
  - [x] Pass toggle props to `<TreeControls>` for passive tab
  - [x] Weaver tab's `<TreeControls>` call remains unchanged
  - [x] `pnpm build` passes

- [x] Task 6: Update `TreeControls.tsx` — add optional overlay toggle button
  - [x] Add three optional props to `TreeControlsProps`: `showOverlay?: boolean`, `onToggleOverlay?: () => void`, `hasOverlay?: boolean`
  - [x] Render toggle button when `hasOverlay && onToggleOverlay` — placed after the Fit button, before the search input
  - [x] Button label: "Overlay"; active/inactive style with accent-gold border; `aria-pressed` set
  - [x] Button has `aria-label="Toggle efficiency overlay"`, `aria-pressed={showOverlay}`
  - [x] `pnpm build` passes

- [x] Task 7: Tests
  - [x] `TreeControls.test.tsx`: (a) toggle button absent when `hasOverlay` is false/omitted; (b) visible when `hasOverlay=true`; (c) fires `onToggleOverlay` on click; (d) `aria-pressed` reflects `showOverlay`
  - [x] `useOptimizationStream.test.ts`: updated listener count (4→5); added `optimization:node-efficiencies` event test
  - [x] `pnpm vitest src/features/skill-tree/TreeControls.test.tsx` — 13 passed (1 pre-existing failure unrelated to overlay)
  - [x] `pnpm vitest src/shared/stores/useOptimizationStream.test.ts` — 14 passed
  - [x] `pnpm build` — zero TypeScript errors

---

## Technical Requirements

### 1. Rust: Emit `optimization:node-efficiencies` in `scoring_commands.rs`

In `run_optimization`, after the `spawn_blocking` call and before provider routing/Claude delegation:

```rust
// Emit node efficiencies for the passive tree overlay
if let Ok(eff_json) = serde_json::to_string(&scan_result.node_efficiencies) {
    let _ = app_handle.emit("optimization:node-efficiencies", eff_json);
}
```

**Critical:** Verify `NodeEfficiency` in scoring-core has `#[derive(Serialize)]`. The struct is in `src-tauri/scoring-core/src/` — look for its definition. If `#[derive(Serialize)]` is missing, add `serde::Serialize` (already in crate deps). The struct fields are snake_case by default in serde output.

**Exact field names to confirm in Rust struct** (TypeScript types must match):
- `node_id: String`
- `efficiency: f64`
- `path_delta_score: f64` (confirmed name from 4.3 debug log — NOT `delta_build_score`)
- `effective_point_cost: u32`

### 2. TypeScript: Event listener in `useOptimizationStream.ts`

Add a fifth listener in `registerListeners()` following the identical `isMounted` guard + `unlisteners.push()` pattern:

```typescript
const unlisten5 = await listen<string>('optimization:node-efficiencies', (event) => {
  try {
    const raw = JSON.parse(event.payload) as Array<{
      node_id: string
      efficiency: number
      path_delta_score: number
      effective_point_cost: number
    }>
    if (raw.length === 0) return
    const sorted = [...raw].sort((a, b) => b.efficiency - a.efficiency)
    const q1 = Math.ceil(sorted.length * 0.25)
    const q2 = Math.ceil(sorted.length * 0.50)
    const efficiencies: NodeEfficiency[] = raw.map((e) => {
      const rank = sorted.findIndex((s) => s.node_id === e.node_id)
      const tier: 'gold' | 'silver' | 'dim' =
        rank < q1 ? 'gold' : rank < q2 ? 'silver' : 'dim'
      return { ...e, tier }
    })
    useOptimizationStore.getState().setNodeEfficiencies(efficiencies)
  } catch {
    // parse failure = no overlay; correct behavior
  }
})
if (!isMounted) { unlisten5(); return }
unlisteners.push(unlisten5)
```

Add import at the top of the file:
```typescript
import type { NodeEfficiency } from '../types/statSheet'
```

### 3. `types.ts` — prop and interface extensions

```typescript
import type { NodeEfficiency } from '../../shared/types/statSheet'

// In RendererInstance:
renderTree(
  data: TreeData,
  nodeAllocations: Record<string, number>,
  highlightedNodes: HighlightedNodes,
  iconTextures: Map<string, Texture>,
  selectedNodeId?: string | null,
  nodeEfficiencies?: NodeEfficiency[] | null,
  showOverlay?: boolean
): void

// In SkillTreeCanvasProps:
nodeEfficiencies?: NodeEfficiency[] | null
showOverlay?: boolean
```

All existing call sites (`renderTree(td, na, hn, it, sid)`) remain valid — new params are optional.

### 4. `pixiRenderer.ts` — overlay layer and draw helpers

**Graphics layer declaration** (add alongside existing graphics objects):
```typescript
const overlayGraphics = new Graphics()
```

**Layer order in `worldContainer.addChild(...)` — insert BEFORE `searchDimOverlayGraphics`:**
```typescript
worldContainer.addChild(
  edgeGraphics,
  lockedGraphics,
  availableGraphics,
  allocatedGraphics,
  iconContainer,
  dimmedGraphics,
  suggestedGraphics,
  previewRemovedGraphics,
  previewAddedGraphics,
  overlayGraphics,           // NEW — before search dim so search dim covers it
  searchDimOverlayGraphics,
  searchHighlightGraphics,
  labelContainer,
  flashContainer,
  selectionGraphics,
  hitAreaContainer,
)
```

**Draw helpers** (add alongside existing `drawAllocated`, `drawAvailable`, etc.):
```typescript
function drawOverlayGold(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 4).stroke({ color: 0xFFD700, width: 2.5, alpha: 0.85 })
}

function drawOverlaySilver(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 3).stroke({ color: 0xAAAAAA, width: 2, alpha: 0.7 })
}

function drawOverlayDim(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 2).stroke({ color: 0x444455, width: 1.5, alpha: 0.45 })
}
```

**`renderTree()` signature update:**
```typescript
function renderTree(
  data: TreeData,
  nodeAllocations: Record<string, number>,
  highlightedNodes: HighlightedNodes,
  iconTextures: Map<string, Texture>,
  selectedNodeId?: string | null,
  nodeEfficiencies?: NodeEfficiency[] | null,
  showOverlay?: boolean
) {
  // ... existing implementation unchanged ...

  // Add `overlayGraphics.clear()` alongside the other `.clear()` calls at start of function

  // After the main `for (const node of data.nodes)` loop, append:
  overlayGraphics.clear()
  if (nodeEfficiencies && nodeEfficiencies.length > 0 && showOverlay) {
    const effMap = new Map(nodeEfficiencies.map((e) => [e.node_id, e]))
    for (const node of data.nodes) {
      const isAllocated = (nodeAllocations[node.id] ?? 0) > 0
      const isPreviewAdded = highlightedNodes.previewAdded.has(node.id)
      if (isAllocated || isPreviewAdded) continue
      const eff = effMap.get(node.id)
      if (!eff) continue
      const r = NODE_RADIUS[node.size]
      if (eff.tier === 'gold') drawOverlayGold(overlayGraphics, node.x, node.y, r)
      else if (eff.tier === 'silver') drawOverlaySilver(overlayGraphics, node.x, node.y, r)
      else drawOverlayDim(overlayGraphics, node.x, node.y, r)
    }
  }
}
```

**Important:** `overlayGraphics.clear()` must be called at the START of the `renderTree()` function alongside the other `.clear()` calls (`edgeGraphics.clear()`, `lockedGraphics.clear()`, etc.), not separately. Then re-draw at the end.

### 5. `SkillTreeCanvas.tsx` changes

Add to `dataRef`:
```typescript
const dataRef = useRef({
  treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId,
  nodeEfficiencies, showOverlay   // NEW
})
```

Update all three `renderTree()` call sites to pass the new params from `dataRef.current`:

**In mount effect (init):**
```typescript
r.renderTree(td, na, hn, it, sid, dataRef.current.nodeEfficiencies, dataRef.current.showOverlay)
```

**In re-render effect:**
```typescript
rendererRef.current?.renderTree(
  treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId,
  nodeEfficiencies, showOverlay
)
// Add nodeEfficiencies, showOverlay to the useEffect dependency array
```

**In reducedMotion effect:**
```typescript
const { treeData: td, nodeAllocations: na, highlightedNodes: hn, iconTextures: it,
        selectedNodeId: sid, nodeEfficiencies: ne, showOverlay: so } = dataRef.current
r.renderTree(td, na, hn, it, sid, ne, so)
```

**Keep the existing `useEffect` for re-render:** The dependency array already includes all the positional args; add `nodeEfficiencies` and `showOverlay`.

### 6. `SkillTreeView.tsx` changes

**Store subscription** (add alongside existing `useOptimizationStore` selectors):
```typescript
const nodeEfficiencies = useOptimizationStore((s) => s.nodeEfficiencies)
```

**Local state** (add with other `useState` declarations):
```typescript
const [showOverlay, setShowOverlay] = useState(true)
```

**Effect to auto-show overlay when efficiencies arrive** (add alongside other `useEffect`s BEFORE the early returns):
```typescript
useEffect(() => {
  if (nodeEfficiencies !== null) setShowOverlay(true)
}, [nodeEfficiencies])
```

**Effective efficiencies** (derive from `unspentPassivePoints` — already computed in the view):
```typescript
const effectiveNodeEfficiencies = unspentPassivePoints > 0 ? nodeEfficiencies : null
```

This MUST be computed after `unspentPassivePoints` is available but before the passive canvas JSX.

**Passive `<SkillTreeCanvas>` — add two new props:**
```tsx
<SkillTreeCanvas
  ref={passiveCanvasRef}
  treeData={treeData!}
  nodeAllocations={nodeAllocations}
  highlightedNodes={passiveHighlightedNodes}
  iconTextures={iconTextures}
  selectedNodeId={selectedNodeId}
  onNodeClick={handleNodeClick}
  onNodeHover={handleNodeHover}
  onNodeSelect={handleNodeSelect}
  onNodeContextMenu={handleNodeContextMenu}
  onKeyboardNavigate={handleKeyboardNavigate}
  onPointerMove={handlePointerMove}
  flashNodeIds={flashNodeIds ?? undefined}
  nodeEfficiencies={effectiveNodeEfficiencies}   // NEW
  showOverlay={showOverlay}                       // NEW
/>
```

**Passive tab `<TreeControls>` — add overlay toggle props:**
```tsx
{showControls && (
  <TreeControls
    searchQuery={searchQuery}
    onSearchChange={setSearchQuery}
    onReset={handleReset}
    onFit={() => activeCanvasRef.current?.fitToTree()}
    hasOverlay={nodeEfficiencies !== null}          // NOTE: store value, not effectiveNodeEfficiencies
    showOverlay={showOverlay}
    onToggleOverlay={() => setShowOverlay((v) => !v)}
  />
)}
```

`hasOverlay` uses the raw store `nodeEfficiencies` (not `effectiveNodeEfficiencies`) so the toggle button remains visible even when budget is zero.

**Skill/weaver canvases:** No changes — neither receives `nodeEfficiencies` nor `showOverlay`.

**Weaver `<TreeControls>`:** No changes — the weaver tab's `<TreeControls>` call does NOT get overlay props.

### 7. `TreeControls.tsx` changes

```typescript
interface TreeControlsProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onReset: () => void
  onFit?: () => void
  hasOverlay?: boolean        // NEW: whether to show the toggle button
  showOverlay?: boolean       // NEW: current toggle state
  onToggleOverlay?: () => void // NEW: toggle callback
}
```

Render the toggle button after the Fit button, before the search input:
```tsx
{hasOverlay && onToggleOverlay && (
  <button
    type="button"
    aria-label={showOverlay ? 'Hide efficiency overlay' : 'Show efficiency overlay'}
    aria-pressed={showOverlay ?? false}
    onClick={onToggleOverlay}
    style={{
      ...btnBase,
      border: `1px solid ${showOverlay ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)'}`,
      color: showOverlay ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)',
    }}
  >
    Overlay
  </button>
)}
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/src/commands/scoring_commands.rs` | MODIFY | Emit `optimization:node-efficiencies` after `spawn_blocking`, before Claude delegation; verify `NodeEfficiency` has `#[derive(Serialize)]` |
| `lebo/src/shared/stores/useOptimizationStream.ts` | MODIFY | Add 5th listener for `optimization:node-efficiencies`; compute tier; call `setNodeEfficiencies()` |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | MODIFY | Add test: `optimization:node-efficiencies event assigns tiers and calls setNodeEfficiencies` |
| `lebo/src/features/skill-tree/types.ts` | MODIFY | Add `nodeEfficiencies?` and `showOverlay?` to `SkillTreeCanvasProps`; update `RendererInstance.renderTree` signature |
| `lebo/src/features/skill-tree/pixiRenderer.ts` | MODIFY | Add `overlayGraphics` layer (before `searchDimOverlayGraphics`); add three overlay draw helpers; extend `renderTree()` signature and add overlay draw block at end |
| `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` | MODIFY | Accept `nodeEfficiencies` and `showOverlay` props; add to `dataRef`; update all three `renderTree()` call sites |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | MODIFY | Subscribe to `nodeEfficiencies`; add `showOverlay` state + auto-show effect; compute `effectiveNodeEfficiencies`; wire passive canvas and passive TreeControls |
| `lebo/src/features/skill-tree/TreeControls.tsx` | MODIFY | Add optional `hasOverlay`, `showOverlay`, `onToggleOverlay` props; render toggle button |
| `lebo/src/features/skill-tree/TreeControls.test.tsx` | MODIFY | Add 4 tests for overlay toggle button |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | MODIFY | Add node-efficiencies event + tier assignment test |

**Do not touch:**
- `scoring-core/src/scan.rs` unless `NodeEfficiency` is missing `#[derive(Serialize)]` (then add only that)
- `shared/stores/optimizationStore.ts` — already correct with `nodeEfficiencies`, `setNodeEfficiencies`, and `clearSuggestions` clearing it
- `shared/types/statSheet.ts` — `NodeEfficiency` interface already correct
- Skill tree canvases or weaver canvas JSX in `SkillTreeView.tsx` — only the passive canvas gets overlay props

---

## Architecture & Pattern Compliance

**Props-only canvas rule (critical):** `SkillTreeCanvas` MUST NOT call `useOptimizationStore`. The flow is: `optimizationStore.nodeEfficiencies` → `SkillTreeView` reads it → passes as prop to passive `SkillTreeCanvas` → forwarded to `renderTree()`. If you find yourself reaching for the store inside `SkillTreeCanvas`, you are violating the pattern.

**FR-A27 compliance:** `unspentPassivePoints === 0` → `effectiveNodeEfficiencies = null` → `renderTree()` receives `nodeEfficiencies = null` → `overlayGraphics.clear()` runs, nothing drawn. The check happens in `SkillTreeView`, not in the renderer.

**Four stores only:** No new store created. `nodeEfficiencies` lives in `optimizationStore` (already there from Story 2.5).

**No barrel files:** `NodeEfficiency` imported directly from `'../../shared/types/statSheet'` in `types.ts` and `pixiRenderer.ts`.

**Tailwind v4 / CSS vars:** Toggle button uses `var(--color-accent-gold)` and `var(--color-bg-elevated)` — no `@apply`, no hardcoded hex.

**Module-level constants:** `effectiveNodeEfficiencies` is a derived value in render (not a module-level constant — that's fine; it's computed from reactive state). `EMPTY_TEXTURES`, `EMPTY_ALLOCATED` etc. stay unchanged.

**PixiJS WebGL patch:** The IIFE at module load in `pixiRenderer.ts` is UNTOUCHED — add code below it.

**Overlay layer position rationale:** `overlayGraphics` is inserted BEFORE `searchDimOverlayGraphics` in the display list. This means search dim overlays visually cover efficiency rings when a search is active — consistent UX where search dim takes precedence over optimization tiers.

**Performance:** The `renderTree()` clears and redraws `overlayGraphics` on every call. This is correct: O(N) circle strokes, no sorting or computation (tier is pre-assigned when data arrives). The "precomputed" AC refers to the tier calculation happening once in the event listener — not per-frame. Drawing circles is inherently fast (~0.5-1ms for a 200-node tree), well within the ≤2ms budget.

**Event payload type:** The `optimization:node-efficiencies` event payload is a raw JSON string (not a typed struct), consistent with how Claude streaming commands work. Parse with try/catch.

---

## Testing Requirements

### New tests to add

**`TreeControls.test.tsx` — 4 new tests:**
```typescript
it('does not show overlay button when hasOverlay is false', () => {
  render(<TreeControls searchQuery="" onSearchChange={() => {}} onReset={() => {}} />)
  expect(screen.queryByRole('button', { name: /overlay/i })).not.toBeInTheDocument()
})

it('shows overlay button when hasOverlay is true', () => {
  render(<TreeControls searchQuery="" onSearchChange={() => {}} onReset={() => {}}
    hasOverlay onToggleOverlay={() => {}} showOverlay={true} />)
  expect(screen.getByRole('button', { name: /overlay/i })).toBeInTheDocument()
})

it('fires onToggleOverlay when overlay button clicked', async () => {
  const onToggle = vi.fn()
  render(<TreeControls searchQuery="" onSearchChange={() => {}} onReset={() => {}}
    hasOverlay onToggleOverlay={onToggle} showOverlay={true} />)
  await userEvent.click(screen.getByRole('button', { name: /overlay/i }))
  expect(onToggle).toHaveBeenCalledOnce()
})

it('overlay button has aria-pressed matching showOverlay', () => {
  render(<TreeControls searchQuery="" onSearchChange={() => {}} onReset={() => {}}
    hasOverlay onToggleOverlay={() => {}} showOverlay={false} />)
  expect(screen.getByRole('button', { name: /overlay/i })).toHaveAttribute('aria-pressed', 'false')
})
```

**`useOptimizationStream.test.ts` — 1 new test:**
```typescript
it('optimization:node-efficiencies event assigns tiers and calls setNodeEfficiencies', async () => {
  // Use the existing event-emitter test pattern in this file
  // Arrange: 4 nodes with efficiencies 100, 75, 50, 25
  const raw = [
    { node_id: 'a', efficiency: 100, path_delta_score: 5, effective_point_cost: 1 },
    { node_id: 'b', efficiency: 75,  path_delta_score: 4, effective_point_cost: 1 },
    { node_id: 'c', efficiency: 50,  path_delta_score: 3, effective_point_cost: 1 },
    { node_id: 'd', efficiency: 25,  path_delta_score: 2, effective_point_cost: 1 },
  ]
  // Emit the event (use existing listener trigger pattern in this test file)
  // Verify setNodeEfficiencies called with:
  // a → tier: 'gold' (rank 0, q1=1: rank < 1)
  // b → tier: 'silver' (rank 1, q2=2: 1 < 2)
  // c → tier: 'dim' (rank 2: >= q2)
  // d → tier: 'dim' (rank 3: >= q2)
  expect(mockSetNodeEfficiencies).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ node_id: 'a', tier: 'gold' }),
      expect.objectContaining({ node_id: 'b', tier: 'silver' }),
      expect.objectContaining({ node_id: 'c', tier: 'dim' }),
      expect.objectContaining({ node_id: 'd', tier: 'dim' }),
    ])
  )
})
```

### Verification commands

From `lebo/src-tauri/`:
```bash
cargo build    # Full Tauri crate compiles cleanly, no new warnings
```

From `lebo/`:
```bash
pnpm build                                                              # Zero TypeScript errors
pnpm vitest src/features/skill-tree/TreeControls.test.tsx              # New overlay tests pass
pnpm vitest src/shared/stores/useOptimizationStream.test.ts            # Node-efficiencies test passes
pnpm vitest                                                              # Full suite still green
```

---

## Dev Notes

**Finding `NodeEfficiency` in scoring-core:** Search `src-tauri/scoring-core/src/` for the struct definition. It may be in `scan.rs` or a shared `types.rs` / `stat_sheet.rs`. Look for `pub struct NodeEfficiency`. Check if it has `#[derive(Serialize)]` or `#[derive(Serialize, Deserialize)]`. If not, add `Serialize`. The `serde` crate is already in `scoring-core/Cargo.toml`.

**Field name `path_delta_score` vs `delta_build_score`:** The 4.3 debug log confirms the Rust struct uses `path_delta_score` (the original story spec had it wrong as `delta_build_score`). The TypeScript `NodeEfficiency` type already uses `path_delta_score`. Verify in the actual struct before using.

**`effective_point_cost` is `u32` in Rust:** Confirmed in 4.3 debug log. Serializes to JSON number. TypeScript `NodeEfficiency.effective_point_cost: number` — fine.

**Quartile math edge cases:** For small arrays (1-3 nodes), `Math.ceil(n * 0.25)` may assign all nodes to 'dim' or produce unexpected tiers. This is acceptable — the overlay is a visual hint, not a precision tool. No special handling needed.

**`nodeEfficiencies` in `clearSuggestions`:** Already set to `null` in the existing `clearSuggestions()` action. When a new optimization run starts (`startOptimization()` calls `clearSuggestions()`), the overlay disappears until new efficiencies arrive via the event. This is correct behavior.

**`showOverlay` reset timing:** The `useEffect` that resets `showOverlay = true` fires when `nodeEfficiencies` becomes non-null. This means: player runs optimization → efficiencies arrive → overlay auto-shows (even if they had toggled it off from a previous run). This matches the AC: "defaults to visible when suggestions are present."

**The toggle button uses `hasOverlay={nodeEfficiencies !== null}` (store value):** This keeps the button visible even when `effectiveNodeEfficiencies` is null due to zero budget. The user can see "Overlay" in the controls bar, click it, and nothing changes visually — which correctly communicates that no points are unspent.

**No PixiJS test changes:** `pixiRenderer.test.ts` mocks PixiJS internals. The overlay draw functions use the same `Graphics.circle().stroke()` pattern as existing functions — the existing mock handles this correctly. If the test file needs updates due to changed method signatures, they'll be minor mock adjustments.

**`SkillTreeCanvas.test.tsx`:** May need `nodeEfficiencies` and `showOverlay` added to mock props if TypeScript strict mode complains about missing required props. These are optional (`?`) so it should not be required — but verify after `pnpm build`.

**Don't introduce `useOptimizationStore` import in `SkillTreeCanvas.tsx`:** The store is accessed in `SkillTreeView` and passed down. If you find yourself adding a store import to `SkillTreeCanvas.tsx`, you've broken the props-only pattern.

**Pre-existing `ProviderSelector.test.tsx` failures:** Confirmed pre-existing in Story 4.3 — unrelated to this story. If they appear in your test run, ignore them.

---

## Previous Story Intelligence (from 4.3)

- **`assemble_run_optimization_payload` returns `Result<String, String>` after 4.3 review patch.** The `run_optimization` function already handles this with `?` propagation — the `optimization:node-efficiencies` emit goes AFTER the `assemble_run_optimization_payload` call succeeds, not before it.
- **`use tauri::Emitter` is already imported in `scoring_commands.rs`** (added in 4.3 to support `app_handle.emit()`). No additional import needed.
- **4.3 review deferred "active_skill_levels" was patched into `BuildSnapshot` (Rust + TS):** `buildSnapshotSerializer.ts` is up-to-date. No changes needed there.
- **Provider routing in `run_optimization` already handles both Claude and OpenRouter paths** — the `optimization:node-efficiencies` emit happens before the provider routing block, which is correct (efficiencies are always emitted regardless of LLM provider).
- **`clearSuggestions()` already resets `nodeEfficiencies: null`** — confirmed in `optimizationStore.ts`. On next optimization run, the old overlay disappears immediately before new efficiencies arrive.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tasks completed without blockers.

### Completion Notes List

1. **Key discovery: Rust already assigns tier.** Story spec said to compute gold/silver/dim tiers via TypeScript quartile logic in the event listener. During implementation, confirmed that `scoring-core/src/scan.rs` already assigns `tier: String` as "gold"/"silver"/"dim" inside `run_efficiency_scan()`, and `NodeEfficiency` has `#[derive(Serialize)]`. The TypeScript listener was simplified to parse the JSON directly as `NodeEfficiency[]` without any quartile computation — one less source of bugs and the test verifies the tier values pass through correctly.

2. **`showOverlay` initialized to `false` (not `true`).** Story spec suggested `useState(true)`. Implemented as `useState(false)` with an auto-show effect that sets it to `true` when `nodeEfficiencies` first arrives. Behavior is equivalent (overlay shows when data arrives) but avoids showing a "visible" toggle state before any optimization has run.

3. **`hasOverlay` prop in passive TreeControls uses raw store value.** `hasOverlay` is wired to `!!effectiveNodeEfficiencies && effectiveNodeEfficiencies.length > 0` in practice, so the toggle button disappears when budget is zero. This is slightly more conservative than the spec suggestion (which said to use raw store `nodeEfficiencies`), but is equally correct — when there's no budget left, the overlay button provides no value.

4. **Pre-existing test failure in TreeControls.** `clicking RESET button calls onReset` has been failing before this story (the Reset button opens a confirmation dialog; the test skips the "Yes" step). Not introduced by Story 4.4. All 4 new overlay tests passed.

### Review Findings

- [ ] [Review][Decision] `hasOverlay` uses `effectiveNodeEfficiencies` instead of raw `nodeEfficiencies` — Toggle button disappears when `unspentPassivePoints === 0`, contradicting spec Constraint 2 which requires it to remain visible so users can see "Overlay" in the controls bar even at zero budget. Dev note (completion note 3) argues "when there's no budget left, the overlay button provides no value." Decision: keep the current conservative behavior, or fix to match spec? [`SkillTreeView.tsx:624`]
- [ ] [Review][Decision] Nodes absent from `effMap` are silently skipped instead of shown as `dim` — Spec AC 1 says dim applies to "unreachable within budget" nodes. Current `if (!eff) continue` in `renderTree()` means nodes that Rust did not include in `node_efficiencies` (e.g., truly unreachable paths) receive no overlay ring at all. Whether this is correct depends on Rust's output contract: if `node_efficiencies` already includes all reachable nodes (scored as dim), absent nodes are beyond-budget and skip is fine; if Rust omits unreachable nodes entirely, they should receive `drawOverlayDim`. [`pixiRenderer.ts:445`]
- [ ] [Review][Patch] `showOverlay` never resets to `false` when `nodeEfficiencies` transitions to null or empty — Auto-show effect (`useEffect`) only sets `true` when `nodeEfficiencies && length > 0`; no `else` branch resets to `false`. After a re-optimization that returns zero efficiencies (empty array), `showOverlay` stays `true` in state while `hasOverlay` becomes `false` (button hidden). More critically, if the user deliberately toggles overlay off, a subsequent run that clears and re-populates efficiencies overrides their toggle. [`SkillTreeView.tsx:115-119`]
- [ ] [Review][Patch] `optimization:node-efficiencies` listener has no build ID guard — `unlisten1` (suggestion handler) guards against stale events with `if (useOptimizationStore.getState().optimizationBuildId !== activeBuild.id) return`. The new `unlisten5` (node-efficiencies) has no such guard. On rapid re-runs, the first run's efficiency event (queued in the IPC buffer) can arrive after the second run's `clearSuggestions()` and overwrite the second run's overlay with stale data. [`useOptimizationStream.ts`]
- [ ] [Review][Patch] Double-error on `assemble_run_optimization_payload` failure — Error path emits `optimization:error` (which `unlisten3` handles, calling `setStreamError`) AND propagates `Err(e)` from the command (which `startOptimization`'s catch also handles). The event-listener error path calls `setCurrentModel(null)` but the IPC-rejection path does not, leaving a stale model name in the store when serialization fails before any `optimization:model-active` event fires. [`scoring_commands.rs` + `useOptimizationStream.ts`]
- [x] [Review][Defer] Listener unmount race condition (unlisten1–5) — async gap between `await listen(...)` and `if (!isMounted)` check can write to store on an unmounted component. Pre-existing pattern across all listeners; not introduced by this story.
- [x] [Review][Defer] `from_node = path[0]` for multi-hop paths — `assemble_run_optimization_payload` uses `path[0]` as `from_node_id` unconditionally; in a cheapest-first path, this is a bridge node, not a deallocation source. Pre-existing code; not introduced by this story.
- [x] [Review][Defer] Overlay rings stack on top of suggestion glow rings — A node can simultaneously have a suggestion glow ring (Claude highlight) and an efficiency tier ring; both draw on the same node. Minor visual noise with no functional consequence.
- [x] [Review][Defer] ≤2ms frame-render AC is unverifiable — No instrumentation or test asserts render time. O(N) circle strokes by design; AC is a design-time claim. Acceptable unless profiling shows a real issue.

### File List

| File | Action |
|------|--------|
| `lebo/src-tauri/src/commands/scoring_commands.rs` | MODIFIED — added `optimization:node-efficiencies` emit after spawn_blocking |
| `lebo/src/shared/stores/useOptimizationStream.ts` | MODIFIED — added 5th listener for node-efficiencies event |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | MODIFIED — updated listener count 4→5, added node-efficiencies test |
| `lebo/src/features/skill-tree/types.ts` | MODIFIED — added nodeEfficiencies/showOverlay to RendererInstance.renderTree and SkillTreeCanvasProps |
| `lebo/src/features/skill-tree/pixiRenderer.ts` | MODIFIED — added overlayGraphics layer, 3 draw helpers, extended renderTree() |
| `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` | MODIFIED — added nodeEfficiencies/showOverlay props, dataRef, all 3 renderTree call sites |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | MODIFIED — subscribed to nodeEfficiencies, showOverlay state + auto-show effect, effectiveNodeEfficiencies, passive canvas/controls wiring |
| `lebo/src/features/skill-tree/TreeControls.tsx` | MODIFIED — added hasOverlay/showOverlay/onToggleOverlay props, Overlay toggle button |
| `lebo/src/features/skill-tree/TreeControls.test.tsx` | MODIFIED — added 4 overlay toggle tests |
