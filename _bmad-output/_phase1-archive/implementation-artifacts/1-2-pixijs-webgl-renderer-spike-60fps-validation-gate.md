# Story 1.2: PixiJS WebGL Renderer Spike — 60fps Validation Gate

Status: done

## Story

As an advanced Last Epoch player,
I want the skill tree canvas to render at 60fps even on mid-range hardware,
so that interacting with nodes during pan, zoom, and hover feels completely fluid — not laggy or stuttering.

## Acceptance Criteria

1. **Given** the PixiJS v8 WebGL renderer is implemented with mock skill tree data (minimum 500 circular nodes with connection edges) **When** the user performs pan (drag), zoom (scroll wheel), and rapid cursor movement over nodes **Then** frame rate measures at ≥60fps throughout on the target hardware profile (Intel Core i5, integrated Intel Iris/UHD graphics, 8GB RAM) **And** no sustained frame drops below 45fps occur during any interaction lasting >5 seconds

2. **Given** the PixiJS Application is mounted inside `src/features/skill-tree/SkillTreeCanvas.tsx` **When** the component renders **Then** `SkillTreeCanvas` receives all data exclusively via props (`treeData`, `highlightedNodes`, `allocatedNodes`) with zero Zustand store imports inside `SkillTreeCanvas.tsx` or `pixiRenderer.ts` **And** the PixiJS Application instance is created on mount and destroyed on unmount without memory leaks **And** all PixiJS rendering logic lives in `src/features/skill-tree/pixiRenderer.ts` (pure PixiJS, no React)

3. **Given** the renderer handles 800 nodes (full-size tree scenario) **When** the user zooms from 30% to 150% and back **Then** all nodes remain correctly positioned relative to each other throughout the gesture **And** frame rate does not drop below 45fps during the zoom

## Tasks / Subtasks

- [x] Task 1: Create `src/features/skill-tree/types.ts` — all shared renderer types (AC: 2)
  - [x] Define `TreeNode`: `{ id: string, x: number, y: number, size: 'small' | 'medium' | 'large', connections: string[], state: 'allocated' | 'available' | 'locked' | 'suggested' }`
  - [x] Define `TreeEdge`: `{ fromId: string, toId: string }`
  - [x] Define `TreeData`: `{ nodes: TreeNode[], edges: TreeEdge[] }`
  - [x] Define `RendererCallbacks`: `{ onNodeClick: (nodeId: string) => void, onNodeHover: (nodeId: string | null) => void }`
  - [x] Define `RendererInstance`: `{ renderTree(data: TreeData, allocatedNodes: Record<string, number>, highlightedNodes: Set<string>): void, resize(w: number, h: number): void, destroy(): void }`
  - [x] Define `SkillTreeCanvasProps`: `{ treeData: TreeData, allocatedNodes: Record<string, number>, highlightedNodes: Set<string>, onNodeClick: (nodeId: string) => void, onNodeHover: (nodeId: string | null) => void }`

- [x] Task 2: Create `src/features/skill-tree/pixiRenderer.ts` — pure PixiJS rendering module (AC: 1, 2, 3)
  - [x] Export `async function initRenderer(canvas: HTMLCanvasElement, callbacks: RendererCallbacks): Promise<RendererInstance>`
  - [x] Inside `initRenderer`: create `const app = new Application()`, then `await app.init({ canvas, backgroundColor: 0x0a0a0b, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 })`
  - [x] Create a `worldContainer = new Container()` added to `app.stage` — this is the single pan/zoom target
  - [x] Create 5 batch `Graphics` objects added to `worldContainer` in z-order: `edgeGraphics`, `lockedGraphics`, `availableGraphics`, `allocatedGraphics`, `suggestedGraphics`
  - [x] Implement `renderTree`: clears and redraws all batch Graphics objects (see Dev Notes for exact draw calls)
  - [x] Implement pan via `pointerdown`/`pointermove`/`pointerup` events on `app.stage` (see Dev Notes)
  - [x] Implement zoom via `wheel` event on `app.canvas`, clamped 0.3–1.5, zoom-toward-cursor (see Dev Notes)
  - [x] Create invisible per-node hit areas (`Graphics` with `alpha: 0`) in `worldContainer` for hover/click events
  - [x] Implement `resize(w, h)`: calls `app.renderer.resize(w, h)`
  - [x] Implement `destroy()`: calls `app.destroy(true, { children: true })`
  - [x] Add FPS counter `Text` overlay in screen space (`app.stage`, not `worldContainer`) reading `app.ticker.FPS` — leave in for benchmarking, note in completion notes to remove before 1.3
  - [x] Zero imports from `src/shared/stores/` or any React module

- [x] Task 3: Create `src/features/skill-tree/SkillTreeCanvas.tsx` — React wrapper (AC: 2)
  - [x] Accept `SkillTreeCanvasProps` (from `./types`)
  - [x] Render `<div ref={containerRef}><canvas ref={canvasRef} /></div>` — full width/height of parent
  - [x] `useEffect` (mount/unmount only): call `initRenderer`, attach `ResizeObserver` on container, store renderer in `rendererRef`; cleanup calls `renderer.destroy()` and `resizeObserver.disconnect()`
  - [x] Second `useEffect` (data deps: `treeData, allocatedNodes, highlightedNodes`): call `rendererRef.current?.renderTree(...)`
  - [x] Store `onNodeClick`/`onNodeHover` in a `callbacksRef` updated each render — pass `callbacksRef` into `initRenderer` so events always read current callbacks without recreating the app
  - [x] Zero imports from `src/shared/stores/`

- [x] Task 4: Update `src/features/layout/CenterCanvas.tsx` — replace placeholder with SkillTreeCanvas (AC: 1)
  - [x] Remove the `useRef`, `useEffect`, `ResizeObserver` stub, and `console.debug` from Story 1.1
  - [x] Import `SkillTreeCanvas` from `'../skill-tree/SkillTreeCanvas'`
  - [x] Import `mockTreeData` from `'../skill-tree/mockTreeData'`
  - [x] Render `<SkillTreeCanvas treeData={mockTreeData} allocatedNodes={{}} highlightedNodes={new Set()} onNodeClick={() => {}} onNodeHover={() => {}} />` filling the container

- [x] Task 5: Create `src/features/skill-tree/mockTreeData.ts` — benchmark-valid mock data (AC: 1, 3)
  - [x] Generate 800 `TreeNode` objects in a radial tree layout spanning world-space ~3000×3000 units (center at 0,0)
  - [x] 5+ tiers of depth — tier sizes: 1 → 6 → 18 → 54 → 162 → remaining
  - [x] Node size distribution: ~30% large (outer tiers: medium), ~50% medium, ~20% small
  - [x] State distribution: 100 `allocated`, 50 `suggested`, 200 `locked`, ~450 `available` — ensures all 4 visual states are visible simultaneously
  - [x] Connection density: inner nodes connect to 3–5 outer nodes; edges array reflects all connections
  - [x] Export as `export const mockTreeData: TreeData` (named const, not function — data is static)

- [x] Task 6: Write `src/features/skill-tree/pixiRenderer.test.ts` — Vitest unit tests (AC: 2)
  - [x] Mock `pixi.js` module: `vi.mock('pixi.js', ...)` with stub `Application`, `Graphics`, `Container`, `Text`
  - [x] Test: `initRenderer` returns object with `renderTree`, `resize`, `destroy` methods
  - [x] Test: `renderTree` does not throw with empty `TreeData` (0 nodes, 0 edges)
  - [x] Test: `renderTree` does not throw with 800 nodes
  - [x] Test: `resize(800, 600)` calls `app.renderer.resize` with correct args
  - [x] Test: `destroy()` calls `app.destroy`
  - [x] Run in `jsdom` environment (already configured in `vite.config.ts`)

- [x] Task 7: Create `docs/pixi-spike-report.md` — benchmark record (AC: 1)
  - [x] Hardware profile: CPU, GPU, RAM, OS
  - [x] PixiJS version tested
  - [x] Object counts: node count, edge count, overlay objects, total rendered objects
  - [x] FPS measurements: idle, pan (10s), zoom (30%→150%→30%), rapid hover
  - [x] Go/no-go statement: PixiJS v8 ≥60fps confirmed OR fallback required
  - [x] Note: actual Last Epoch passive tree node count is TBD pending Story 1.3a — spike will be re-run if real counts exceed 800

- [x] Task 8: Benchmark and verify (AC: 1, 3)
  - [x] `pnpm tauri dev` → app opens with 800-node tree visible
  - [x] Manually test: pan 10s continuous, zoom 30%→150%→30%, rapid hover; record FPS in `docs/pixi-spike-report.md`
  - [x] Confirm ≥60fps sustained; no drop below 45fps in any >5s interaction
  - [x] `pnpm tsc --noEmit` → zero errors
  - [x] `pnpm vitest run` → all tests pass

## Dev Notes

### CRITICAL: This Story Is a Hard Gate

No other Epic 1 story (1.3a, 1.3b, 1.4, 1.5, 1.6, 1.7) may begin until this story is `done`. The 60fps target is a non-negotiable architectural prerequisite — the entire tree interaction UX depends on it passing on mid-range hardware.

### DO NOT Use @pixi/react Components

`@pixi/react` is installed as a dependency but must NOT be used here. The architecture requires all rendering logic in `pixiRenderer.ts` as pure imperative PixiJS (no `<Application>`, `<Stage>`, `<Container>` JSX components). `SkillTreeCanvas.tsx` provides the DOM mount point only.

### PixiJS v8 — Breaking API Changes From v7

```typescript
// v8: Application.init() is ASYNC — was synchronous in v7
const app = new Application()
await app.init({
  canvas: canvasElement,        // attach to existing <canvas>; do NOT let Pixi create its own
  width: containerWidth,
  height: containerHeight,
  backgroundColor: 0x0a0a0b,   // bg-base color token
  antialias: true,
  autoDensity: true,            // handles devicePixelRatio automatically
  resolution: window.devicePixelRatio || 1,
})

// v8: app.canvas — the DOM element (was app.view in v7 — using app.view will be undefined)
// v8: Graphics uses fluent builder pattern (was .beginFill()/.endFill() in v7)
const g = new Graphics()
g.circle(x, y, r).fill({ color: 0xC9A84C })
g.circle(x, y, r).stroke({ color: 0xD4B96A, width: 2 })

// v8: app.renderer.resize(w, h) — unchanged
// v8: app.ticker.FPS — current FPS, read in ticker callback
// v8: app.destroy(removeView, stageOptions) — unchanged signature
// v8: Container, Graphics, Text — same import path: import { Application, Container, Graphics, Text } from 'pixi.js'
```

### Node Visual Encoding (NFR17 — Shape + Fill + Color, Never Color Alone)

```typescript
const NODE_RADIUS = { small: 12, medium: 18, large: 26 }  // world-space pixels

// ALLOCATED: gold filled circle
function drawAllocated(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill({ color: 0xC9A84C })               // node-allocated gold
  g.circle(x, y, r).stroke({ color: 0xD4B96A, width: 2 })
}

// AVAILABLE: hollow blue-grey ring
function drawAvailable(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill({ color: 0x141417 })               // bg-surface (dark fill)
  g.circle(x, y, r).stroke({ color: 0x4A7A9E, width: 3 })   // node-available
}

// LOCKED: dark fill + X pattern (shape differentiator for NFR17)
function drawLocked(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill({ color: 0x2A2A35 })               // node-locked
  const o = r * 0.5
  g.moveTo(x - o, y - o).lineTo(x + o, y + o).stroke({ color: 0x5A5050, width: 2 })
  g.moveTo(x + o, y - o).lineTo(x - o, y + o).stroke({ color: 0x5A5050, width: 2 })
}

// SUGGESTED: purple ring + outer glow (larger dim circle behind)
function drawSuggested(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 6).fill({ color: 0x7B68EE, alpha: 0.25 })  // glow
  g.circle(x, y, r).fill({ color: 0x141417 })
  g.circle(x, y, r).stroke({ color: 0x7B68EE, width: 3 })        // node-suggested

}

// EDGES: thin grey lines drawn first (renders under nodes)
function drawEdge(g: Graphics, x1: number, y1: number, x2: number, y2: number) {
  g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color: 0x3A3A45, width: 1.5 })
}
```

### Performance Architecture — How to Hit 60fps

**Do NOT create one `Graphics` object per node.** 800 individual `Graphics` objects = 800 separate batched draw calls = performance death. Instead, batch by state:

```typescript
// 5 shared Graphics objects — one per visual state + edges
const edgeGraphics = new Graphics()      // all edges in one draw call
const lockedGraphics = new Graphics()    // all locked nodes batched
const availableGraphics = new Graphics()
const allocatedGraphics = new Graphics()
const suggestedGraphics = new Graphics()

// Z-order: edges first, then locked (bottom), available, allocated, suggested (top)
worldContainer.addChild(edgeGraphics, lockedGraphics, availableGraphics, allocatedGraphics, suggestedGraphics)

function renderBatch(data: TreeData, allocatedNodes: Record<string, number>, highlighted: Set<string>) {
  edgeGraphics.clear(); lockedGraphics.clear(); availableGraphics.clear()
  allocatedGraphics.clear(); suggestedGraphics.clear()
  // destroy and recreate hit areas for updated node list
  // ... batch-draw each node into its state Graphics
}
```

This reduces 800+ draw calls to 5 — the difference between 15fps and 60fps.

### Pan Implementation

```typescript
// app.stage.eventMode must be 'static' with a hitArea covering the full screen
app.stage.eventMode = 'static'
app.stage.hitArea = app.screen

let dragging = false
let dragOrigin = { x: 0, y: 0 }
let panOrigin = { x: 0, y: 0 }

app.stage.on('pointerdown', (e) => {
  dragging = true
  dragOrigin = { x: e.global.x, y: e.global.y }
  panOrigin = { x: worldContainer.x, y: worldContainer.y }
})
app.stage.on('pointermove', (e) => {
  if (!dragging) return
  worldContainer.x = panOrigin.x + (e.global.x - dragOrigin.x)
  worldContainer.y = panOrigin.y + (e.global.y - dragOrigin.y)
})
app.stage.on('pointerup', () => { dragging = false })
app.stage.on('pointerupoutside', () => { dragging = false })
```

### Zoom Implementation (zoom-toward-cursor)

```typescript
const MIN_ZOOM = 0.3
const MAX_ZOOM = 1.5

app.canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, worldContainer.scale.x * factor))

  // Zoom toward cursor position in world space
  const cursorWorldX = (e.offsetX - worldContainer.x) / worldContainer.scale.x
  const cursorWorldY = (e.offsetY - worldContainer.y) / worldContainer.scale.y
  worldContainer.scale.set(newScale)
  worldContainer.x = e.offsetX - cursorWorldX * newScale
  worldContainer.y = e.offsetY - cursorWorldY * newScale
}, { passive: false })
```

### Hover/Click Hit Areas

Per-node invisible hit areas — do NOT put `eventMode = 'static'` on the batch `Graphics` objects (that would make the entire batch one hit target). Create lightweight invisible hit areas per node:

```typescript
// After rendering all batch Graphics, create hit areas
function createHitAreas(nodes: TreeNode[], callbacks: RendererCallbacks) {
  // Remove previous hit area container first
  hitAreaContainer.removeChildren()

  nodes.forEach((node) => {
    const r = NODE_RADIUS[node.size]
    const hit = new Graphics()
    hit.circle(node.x, node.y, r + 4).fill({ color: 0x000000, alpha: 0 })  // invisible
    hit.eventMode = 'static'
    hit.cursor = 'pointer'
    hit.on('pointerover', () => callbacksRef.current.onNodeHover(node.id))
    hit.on('pointerout', () => callbacksRef.current.onNodeHover(null))
    hit.on('pointerdown', (e) => { e.stopPropagation(); callbacksRef.current.onNodeClick(node.id) })
    hitAreaContainer.addChild(hit)
  })
}
```

Add `hitAreaContainer` as a sixth child of `worldContainer` (above suggestedGraphics). The `e.stopPropagation()` on node click prevents the pan handler from firing simultaneously.

### Callback Ref Pattern (Prevents Stale Closures)

Since `onNodeClick`/`onNodeHover` are passed as props and may be recreated each React render, pass a mutable ref into `initRenderer`:

```typescript
// In SkillTreeCanvas.tsx
const callbacksRef = useRef<RendererCallbacks>({ onNodeClick, onNodeHover })
useEffect(() => {
  callbacksRef.current = { onNodeClick, onNodeHover }
})  // runs after every render, no deps array — keeps ref current

// Pass callbacksRef into initRenderer; pixiRenderer.ts reads callbacksRef.current on each event
```

This avoids re-initializing the PixiJS app when callbacks change.

### FPS Counter for Benchmarking

```typescript
// Add to initRenderer after app.init() — remove from pixiRenderer.ts before story done
// (note removal in Completion Notes List)
import { Text } from 'pixi.js'

const fpsDisplay = new Text({ text: 'FPS: --', style: { fill: 0x00ff00, fontSize: 14, fontFamily: 'monospace' } })
fpsDisplay.position.set(8, 8)
app.stage.addChild(fpsDisplay)  // screen space — NOT in worldContainer (stays fixed on screen)

app.ticker.add(() => {
  fpsDisplay.text = `FPS: ${Math.round(app.ticker.FPS)} | Nodes: ${lastNodeCount}`
})
```

Record FPS at:
1. Idle — expect ~60fps
2. Continuous pan drag 10s — expect ≥60fps sustained
3. Rapid scroll zoom 30%→150%→30% in 5s — expect no drop below 45fps
4. Rapid mouse movement over 100+ nodes — expect ≥60fps

### CenterCanvas.tsx — What to Replace

Story 1.1 left a ResizeObserver stub in `CenterCanvas.tsx` (around line 13). Remove it entirely — `SkillTreeCanvas.tsx` owns its own ResizeObserver internally. The updated `CenterCanvas.tsx` becomes:

```tsx
// src/features/layout/CenterCanvas.tsx
import { SkillTreeCanvas } from '../skill-tree/SkillTreeCanvas'
import { mockTreeData } from '../skill-tree/mockTreeData'

export function CenterCanvas() {
  return (
    <div className="flex-1 min-w-0 bg-bg-base overflow-hidden">
      <SkillTreeCanvas
        treeData={mockTreeData}
        allocatedNodes={{}}
        highlightedNodes={new Set()}
        onNodeClick={() => {}}
        onNodeHover={() => {}}
      />
    </div>
  )
}
```

Remove: `useRef`, `useEffect`, `ResizeObserver`, `console.debug` from the old stub. No other imports needed.

### Mock Data Structural Requirements

The spike mock MUST NOT be bare circles on a blank canvas. It must represent real rendering load:

- **800 nodes total** arranged in a radial tree (5+ tiers from center)
- **3 size variants visible**: large (center/major nodes), medium (secondary), small (leaf nodes)
- **All 4 states simultaneously active**: 100 allocated + 50 suggested + 200 locked + 450 available
- **Dense edge connections**: inner nodes each connect to 3–5 outer nodes → ~1,200+ edges
- **World space layout**: nodes distributed across ~3000×3000 units centered at (0, 0) so users must pan/zoom to see all

Initial viewport: center at worldContainer position (canvasWidth/2, canvasHeight/2), scale 0.6 so tree is partially visible.

**Spike re-run requirement**: Story 1.3a will reveal actual Last Epoch passive tree node counts. If actual counts exceed 800, re-run the benchmark with the real count before Story 1.4 begins (note this in `docs/pixi-spike-report.md`).

### Fallback Plan: Konva.js

If PixiJS v8 cannot sustain 60fps on target hardware:
1. Document failure in `docs/pixi-spike-report.md` with exact FPS and node count where degradation started
2. Install fallback: `pnpm add konva react-konva`
3. Re-spike with identical mock data and identical interactions
4. Document Konva.js results in the same report with a clear comparison table
5. Go/no-go decision required before Story 1.3a begins — do not skip this gate

### Scope Boundary for This Story

**In scope:** pan, zoom, hover event detection, click event detection, all 4 node visual states, connection edges, FPS benchmarking. The `onNodeClick`/`onNodeHover` callbacks are wired but their consumers (tooltips, allocation logic) are built in later stories.

**Out of scope (later stories):** keyboard navigation within tree, NodeTooltip component, actual node allocation logic, tab navigation between Passive/Skill trees, integration with real game data, accessibility ARIA on canvas.

### Previous Story Learnings (Story 1.1)

- **ResizeObserver stub in `CenterCanvas.tsx`** (around line 13): had `console.debug` log — replaced entirely in Task 4. Do not leave any `console.debug` in CenterCanvas after this story.
- **`tauri-plugin-stronghold` not installed**: no impact on this story.
- **Font files not on disk**: app falls back to system fonts in dev — no impact on rendering.
- **No `index.ts` barrel files**: import directly from `'../skill-tree/SkillTreeCanvas'`, not from `'../skill-tree'`.
- **Tailwind v4 CSS-first**: if any new utility classes are needed for SkillTreeCanvas container, add to `global.css @theme` only — no `tailwind.config.js`.
- **Zustand v5 `create<T>()((set) => ...)` pattern**: not needed in this story (no new stores), but do not add `useSkillTreeStore` — tree state goes through props only per architecture.

### Project Structure Notes

**New files this story:**
```
src/features/skill-tree/
  SkillTreeCanvas.tsx        ← React wrapper; props-only, no store access
  pixiRenderer.ts            ← Pure PixiJS; no React, no Zustand
  pixiRenderer.test.ts       ← Vitest unit tests (mock pixi.js)
  mockTreeData.ts            ← Static spike mock data (800 nodes)
  types.ts                   ← TreeNode, TreeData, TreeEdge, RendererInstance, props
docs/
  pixi-spike-report.md       ← Benchmark results + go/no-go decision
```

**Modified files this story:**
```
src/features/layout/CenterCanvas.tsx  ← Remove stub; render SkillTreeCanvas with mock data
```

No Rust files modified. No new Tauri commands. No new stores. No new shared types (types live in `src/features/skill-tree/types.ts` since only the skill-tree feature uses them at this stage).

### Architecture Compliance Checklist

- [ ] `pnpm tsc --noEmit` → zero errors
- [ ] `pnpm vitest run` → all tests pass
- [ ] `pnpm tauri dev` → app opens with 800-node tree visible in center canvas
- [ ] FPS ≥60fps during pan/zoom/hover confirmed and documented in `docs/pixi-spike-report.md`
- [ ] `SkillTreeCanvas.tsx` — zero imports from `src/shared/stores/`
- [ ] `pixiRenderer.ts` — zero React imports, zero Zustand imports
- [ ] `app.canvas` used for DOM attachment (not `app.view` — v7 API)
- [ ] `await app.init(...)` used (not `new Application({...})` — v7 constructor API)
- [ ] All 5 batch Graphics approach used — no per-node `Graphics` objects
- [ ] `worldContainer` pattern used for pan/zoom (not moving `app.stage` directly)
- [ ] No `index.ts` barrel files added anywhere in `src/`

### References

- Story 1.1 (done) — File list, completion notes, CenterCanvas stub location: `_bmad-output/implementation-artifacts/1-1-app-foundation-tauri-react-design-system-scaffold.md`
- Epics file Story 1.2 Dev Notes + ACs: `_bmad-output/planning-artifacts/epics.md`
- Architecture — Frontend Architecture (PixiJS Integration section): `_bmad-output/planning-artifacts/architecture.md`
- Architecture — Project Structure (complete directory): `_bmad-output/planning-artifacts/architecture.md`
- Architecture — NFR1 (60fps on Intel i5 integrated graphics): `_bmad-output/planning-artifacts/architecture.md`
- UX Design Spec — SkillTreeCanvas component spec: `_bmad-output/planning-artifacts/ux-design-specification.md`
- UX Design Spec — UX-DR4 (node states, pan/zoom, interaction): `_bmad-output/planning-artifacts/epics.md` (Requirements section)
- UX Design Spec — UX-DR16 (ResizeObserver viewport refitting): `_bmad-output/planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Vitest mock issue: `vi.fn().mockImplementation(() => ({...}))` with arrow functions cannot be used as constructors. Fixed using `vi.hoisted()` + regular `function` constructors that return explicit objects (JavaScript allows `new Foo()` to use the returned object when the constructor explicitly returns one).

### Completion Notes List

- Tasks 1–8 fully complete. Manual benchmark (Task 8) confirmed ≥60fps on target hardware — go/no-go: **GO**.
- `initRenderer` signature uses `callbacksRef: { current: RendererCallbacks }` (ref object, not raw callbacks) to prevent stale closures in PixiJS event handlers — matches story Dev Notes callback-ref pattern.
- 5-batch `Graphics` architecture implemented: edgeGraphics, lockedGraphics, availableGraphics, allocatedGraphics, suggestedGraphics + hitAreaContainer. ~1,200+ edges generated in mockTreeData.
- FPS counter `Text` overlay **removed** from `pixiRenderer.ts` (`Text` import also removed) — clean for Story 1.3.
- `pnpm tsc --noEmit` → zero errors; `pnpm vitest run` → all tests pass (65/65).

### File List

- `lebo/src/features/skill-tree/types.ts` (new)
- `lebo/src/features/skill-tree/pixiRenderer.ts` (new)
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` (new)
- `lebo/src/features/skill-tree/mockTreeData.ts` (new)
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` (new)
- `lebo/src/features/layout/CenterCanvas.tsx` (modified — replaced ResizeObserver stub with SkillTreeCanvas)
- `docs/pixi-spike-report.md` (new)

## Change Log

| Date | Change |
|------|--------|
| 2026-04-19 | Tasks 1–7 implemented: types, pixiRenderer, SkillTreeCanvas, CenterCanvas update, mockTreeData (800 nodes), Vitest tests (5 tests, 65 total pass), pixi-spike-report template. Task 8 pending manual benchmark. |
| 2026-04-21 | Task 8 manual benchmark passed (≥60fps confirmed). FPS counter removed from pixiRenderer.ts. Story status → done. Gate cleared — Story 1.3a can begin. |
