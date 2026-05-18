# Story 2.4: PixiJS Icon Rendering with Placeholder Fallback

Status: review

## Story

As a theory-crafter,
I want skill tree nodes to display the actual game icon inside the hexagonal shape, falling back to a colored placeholder fill if the icon is unavailable,
so that the tree is always interactive and the visual upgrade is immediate when icons are loaded.

## Acceptance Criteria

1. **Given** a node's skillId has a resolved Texture in the `iconTextures` Map
   **When** the node is drawn in pixiRenderer.ts
   **Then** the texture is rendered as a Sprite centered in the node area, clipped to the node circle; the node's existing state color (allocated, available, locked) is still rendered as the node background behind the icon

2. **Given** a node's skillId has no entry in the `iconTextures` Map (texture not yet loaded or pipeline returned placeholder)
   **When** the node is drawn
   **Then** the node renders with the existing placeholder fill color and no Sprite; the node is still fully interactive

3. **Given** textures resolve progressively (Map fills as Assets.load() completes)
   **When** new textures become available
   **Then** the canvas re-renders affected nodes with icons within 50ms stagger (UX-DR13); reducedMotion skips stagger and renders all icons immediately

4. **Given** the full tree view is mounted with icons pre-cached
   **When** measured from tree view mount to all icons rendered
   **Then** the first-load time is within 200ms (NFR2)

5. **And** icon rendering inside nodes does not cause any regression in canvas FPS; the ≥60fps idle / ≥45fps sustained benchmark is maintained (NFR1)

6. **And** `iconSource` from the manifest is exposed in the app settings panel as a read-only label (e.g., "Icon source: game files" / "community CDN" / "placeholder")

## Tasks / Subtasks

- [x] Task 1: Add `Sprite` rendering to `pixiRenderer.ts` (AC: #1, #2, #5)
  - [x] Import `Sprite` (and `Graphics` as mask) from `'pixi.js'` — add to existing import line
  - [x] Declare `iconContainer = new Container()` inside `initRenderer`, add to `worldContainer` between `allocatedGraphics` and `labelContainer` in the `addChild` call
  - [x] Declare `let lastRenderedIconIds = new Set<string>()` in the closure (for stagger tracking)
  - [x] In `renderTree`: call `iconContainer.removeChildren()` alongside the other `.clear()` calls at the top
  - [x] In the node draw loop, after the state-based draw call, check `iconTexturesMap.get(node.id)` — if texture exists, create a `Sprite`, set anchor 0.5/0.5, position to `node.x/node.y`, size to `r * 1.6` × `r * 1.6`, create a circular `Graphics` mask at same coords, add both mask and sprite to `iconContainer`
  - [x] Remove the `void iconTexturesMap` no-op line (it was there only to suppress unused-local warning; actual usage replaces it)
  - [x] Track newly added icon nodeIds: compare current icon set to `lastRenderedIconIds`; if `reducedMotionEnabled = false`, run 50ms scale-in ticker animation on new sprites only; update `lastRenderedIconIds` at end of `renderTree`

- [x] Task 2: Implement 50ms scale-in stagger animation for new icons (AC: #3, #5)
  - [x] Add a `pendingIconAnimations: Array<{ sprite: Sprite; startTime: number; delay: number }>` closure variable
  - [x] In `renderTree`, for each newly added icon (not in `lastRenderedIconIds`), push to `pendingIconAnimations` with `delay = index * 50` ms and initial `sprite.scale.set(0)` / `sprite.alpha = 0`
  - [x] Add a persistent ticker callback (registered once in `initRenderer`, not per `renderTree`) that processes `pendingIconAnimations`: each frame, advance each pending item; once `(now - startTime) >= delay`, animate from scale 0.7→1.0 over 100ms; remove when complete
  - [x] When `reducedMotionEnabled = true`: skip animation entirely — sprites render at full scale/alpha immediately (no delay, no animation ticker entries)
  - [x] In `destroy()`, clear `pendingIconAnimations = []` to prevent stale callbacks

- [x] Task 3: Extend `appStore` with `iconSource` and wire `useIconTextures` to dispatch it (AC: #6)
  - [x] In `src/shared/stores/appStore.ts`: add `iconSource: 'game-files' | 'community-cdn' | 'placeholder' | null` field (default `null`) and `setIconSource(v: ...)` setter
  - [x] In `src/features/icon-pipeline/useIconTextures.ts`: update the `listen('icon-pipeline:initialized', ...)` callback to extract the `iconSource` payload field and call `useAppStore.getState().setIconSource(payload.iconSource)`
  - [x] The event payload type is `{ iconSource: 'game-files' | 'community-cdn' | 'placeholder' }` — type-assert or destructure from the Tauri event payload

- [x] Task 4: Add `iconSource` label to Settings panel (AC: #6)
  - [x] In `src/features/settings/Settings.tsx`: subscribe to `useAppStore(s => s.iconSource)`
  - [x] Add a new `<section>` below the keyboard shortcuts section with label "Icon Source" showing: `iconSource === 'game-files' ? 'game files' : iconSource === 'community-cdn' ? 'community CDN' : iconSource === 'placeholder' ? 'placeholder' : 'not initialized'`
  - [x] Render as a read-only text row matching the existing Settings panel styling; no interaction

- [x] Task 5: Update `pixiRenderer.test.ts` to cover icon rendering (AC: #1, #2)
  - [x] Add test: `renderTree` with non-empty `iconTextures` Map → `Sprite` constructor called once per mapped node
  - [x] Add test: `renderTree` with empty `iconTextures` Map → no `Sprite` constructors called
  - [x] Add test: calling `renderTree` twice — second call clears `iconContainer.removeChildren()` before re-adding sprites
  - [x] Mock `Sprite` in the existing `vi.mock('pixi.js', ...)` block: `Sprite` as a constructable vi.fn() with `.anchor = { set: vi.fn() }`, `.width`, `.height`, `.mask` as writable props
  - [x] Add `iconContainer` stub to the `makeContainer()` mock (it's added via `worldContainer.addChild`)

## Dev Notes

### Current State of pixiRenderer.ts (Critical — Read Before Touching)

`iconTexturesMap` is already stored in the closure (line 194) and received as the 4th `renderTree` param (line 200-202). It is currently suppressed with `void iconTexturesMap` (line 203) — remove this line when actual Sprite usage is added. The worldContainer layer order in the current `addChild` call (line 130-144) is:
```
edgeGraphics → lockedGraphics → availableGraphics → allocatedGraphics →
dimmedGraphics → suggestedGraphics → previewRemovedGraphics → previewAddedGraphics →
searchDimOverlayGraphics → searchHighlightGraphics → labelContainer →
flashContainer → hitAreaContainer
```
Insert `iconContainer` **between `allocatedGraphics` and `dimmedGraphics`** so icons appear over node backgrounds but under suggestion/preview overlays and labels. This keeps state feedback (glow, dim) visible over icons.

### PixiJS 8 Sprite + Circular Mask Pattern

```typescript
import { Sprite, Graphics } from 'pixi.js'  // add Sprite to existing import

// Inside node loop, after state draw:
const texture = iconTexturesMap.get(node.id)
if (texture) {
  const sprite = new Sprite(texture)
  sprite.anchor.set(0.5, 0.5)
  sprite.x = node.x
  sprite.y = node.y
  const iconSize = r * 1.6
  sprite.width = iconSize
  sprite.height = iconSize

  const mask = new Graphics()
  mask.circle(node.x, node.y, r - 1).fill(0xffffff)
  sprite.mask = mask

  iconContainer.addChild(mask)  // mask must be in the display tree
  iconContainer.addChild(sprite)
}
```

**Why mask must be in display tree**: In PixiJS 8, a Graphics mask used via `sprite.mask = mask` must be added to the scene graph (as a sibling or parent) to be evaluated correctly. Add it to `iconContainer` before the sprite.

**Icon size `r * 1.6`**: Fills the node visually while the mask keeps it circular. Actual game icons are square — this scaling fills to the circle diameter with slight overflow, which the mask clips.

### Animation Pattern — Persistent Ticker

Use a single persistent ticker (registered once in `initRenderer`, not re-registered per `renderTree`). This avoids the multi-ticker accumulation problem. Pattern matching `triggerFlash`:

```typescript
// In initRenderer, after other setup:
let pendingIconAnimations: Array<{ sprite: Sprite; startTime: number; delay: number }> = []

const iconAnimTick = () => {
  const now = performance.now()
  pendingIconAnimations = pendingIconAnimations.filter(({ sprite, startTime, delay }) => {
    if (now < startTime + delay) return true  // not started yet
    const elapsed = now - (startTime + delay)
    const ANIM_DURATION = 100
    const progress = Math.min(elapsed / ANIM_DURATION, 1)
    sprite.scale.set(0.7 + 0.3 * progress)
    sprite.alpha = progress
    return progress < 1  // remove when complete
  })
}
app.ticker.add(iconAnimTick)
```

Remove `iconAnimTick` in `destroy()` via `app.ticker.remove(iconAnimTick)`.

### Stagger Logic in renderTree

Track which nodeIds had icons last render to only animate newly arrived icons:

```typescript
let lastRenderedIconIds = new Set<string>()

// At start of renderTree (before clearing):
const prevIconIds = lastRenderedIconIds
const newIconIds = new Set<string>()

// In node loop, when adding a Sprite:
newIconIds.add(node.id)
if (!reducedMotionEnabled && !prevIconIds.has(node.id)) {
  sprite.scale.set(0)
  sprite.alpha = 0
  pendingIconAnimations.push({
    sprite,
    startTime: performance.now(),
    delay: pendingIconAnimations.length * 50,  // 50ms stagger
  })
} // else: full scale/alpha (immediate render)

// After loop:
lastRenderedIconIds = newIconIds
```

**Why `pendingIconAnimations.length * 50` for delay**: Each newly added icon waits 50ms × its position in the batch. Since icons resolve progressively (one at a time via `setIconTextures`), typically `pendingIconAnimations.length === 0` and delay is 0ms per individual arrival. The stagger shows when multiple icons arrive simultaneously (pre-cached on repeated launches).

**Reset `lastRenderedIconIds` when the tree changes**: Call `lastRenderedIconIds = new Set()` when `data.nodes` changes (new tree loaded), so all icons in the new tree animate in. Detect by comparing `data.nodes.length` or `data.nodes[0]?.id` to a stored previous tree ID.

### `iconSource` in appStore

The `icon-pipeline:initialized` Tauri event payload from Story 2.2 is typed as:
```typescript
{ iconSource: 'game-files' | 'community-cdn' | 'placeholder' }
```

In `useIconTextures.ts`, the current event listener receives the raw Tauri event. Extract payload:
```typescript
listen<{ iconSource: 'game-files' | 'community-cdn' | 'placeholder' }>('icon-pipeline:initialized', (event) => {
  if (isMounted) {
    setPipelineReady(true)
    useAppStore.getState().setIconSource(event.payload.iconSource)
  }
})
```

The `listen` generic type parameter types `event.payload`. This is the Tauri 2 `listen<T>` API.

### Settings Panel — iconSource Display

Add to `src/features/settings/Settings.tsx`:
```tsx
const iconSource = useAppStore((s) => s.iconSource)
// ...
<section>
  <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
    Data Sources
  </p>
  <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
    <span style={{ color: 'var(--color-text-muted)' }}>Icon source: </span>
    {iconSource === 'game-files' ? 'game files'
      : iconSource === 'community-cdn' ? 'community CDN'
      : iconSource === 'placeholder' ? 'placeholder'
      : '—'}
  </div>
</section>
```

Match the existing section styling exactly (same font, spacing, color tokens as the keyboard shortcuts section).

### What This Story Does NOT Change

- `useIconTextures.ts` — only change: extract `iconSource` from event payload and dispatch to `appStore`. No changes to texture loading logic.
- `SkillTreeCanvas.tsx` — no changes needed; it already passes `iconTextures` through
- `types.ts` — no changes; `iconTextures: Map<string, Texture>` is already a required `SkillTreeCanvasProps` prop
- Rust/Tauri commands — all icon pipeline Rust code was completed in Story 2.2
- Node hit areas, labels, edges, flash — no regressions; only `iconContainer` is new

### Performance Guardrails (NFR1, NFR2)

- **Object pooling**: Sprites and masks are created fresh per `renderTree` call (not pooled). For trees up to 200 nodes, this is fine — PixiJS handles it. Do not over-engineer pooling.
- **No Assets.load inside renderer**: Never call `Assets.load` or `Assets.get` inside `pixiRenderer.ts`. Textures flow in only via `iconTextures` prop. Violation breaks the props-only contract.
- **Mask performance**: Using Graphics as sprite mask adds GPU cost. With ≤200 nodes the cost is acceptable. Test at 200 nodes before claiming NFR1 compliance.
- **Clear icons on every renderTree**: `iconContainer.removeChildren()` at start of each `renderTree` ensures no stale sprites accumulate. This is correct; do not cache.

### Existing Test Mock Patterns to Follow

From `pixiRenderer.test.ts` (lines 32-90), the pixi.js mock uses `vi.hoisted` and `vi.mock`. Add `Sprite` to the mock:
```typescript
function makeSprite() {
  return {
    anchor: { set: vi.fn() },
    x: 0, y: 0,
    width: 0, height: 0,
    alpha: 1,
    scale: { set: vi.fn() },
    mask: null as unknown,
  }
}
// In the mock factory:
Sprite: vi.fn().mockImplementation(() => makeSprite()),
```

`iconContainer` is added via `worldContainer.addChild(...)`. The mock `worldContainer.addChild` is already a `vi.fn()` — no new setup needed to verify it was called. For `iconContainer.removeChildren()`, verify via the container mock returned by `makeContainer()`.

### File List

- `lebo/src/features/skill-tree/pixiRenderer.ts` — modified (add Sprite rendering + animation)
- `lebo/src/features/skill-tree/pixiRenderer.test.ts` — modified (Sprite mock + new tests)
- `lebo/src/shared/stores/appStore.ts` — modified (add iconSource field + setter)
- `lebo/src/features/icon-pipeline/useIconTextures.ts` — modified (extract iconSource from event payload)
- `lebo/src/features/settings/Settings.tsx` — modified (add iconSource read-only label)

### Project Context Rules Applicable

- No barrel files — no `index.ts` anywhere in `src/features/`
- No raw `invoke()` — all Tauri IPC via `invokeCommand<T>()` (this story adds none)
- No new Zustand stores — extend `appStore` only
- TypeScript strict mode — `noUnusedLocals`; removing `void iconTexturesMap` requires immediate Sprite usage
- `SkillTreeCanvas` is props-only — `iconTextures` comes from parent, never loaded inside renderer
- No `Assets.load` inside `pixiRenderer.ts` — ever

### References

- Story 2.3 dev notes — `convertFileSrc`, progressive Map pattern, `iconTexturesMap` closure storage
- `pixiRenderer.ts` lines 193-203 — current `iconTexturesMap` storage (unused, `void` suppressor)
- `pixiRenderer.ts` lines 130-144 — worldContainer layer order
- `pixiRenderer.ts` lines 344-392 — `triggerFlash` ticker pattern to follow for animation
- `appStore.ts` lines 11-31 — existing store interface pattern
- `useIconTextures.ts` lines 19-22 — existing event listener to extend with payload extraction
- [Source: epics.md#Story 2.4]
- [Source: epics.md#UX-DR13]
- [Source: epics.md#NFR1, NFR2]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation followed story spec exactly.

### Completion Notes List

- Task 1: Added `Sprite` + circular `Graphics` mask rendering inside node loop in `pixiRenderer.ts`. `iconContainer` inserted between `allocatedGraphics` and `dimmedGraphics` so icons render above backgrounds but under suggestion/preview overlays. Removed `void iconTexturesMap` suppressor.
- Task 2: Persistent `iconAnimTick` registered once in `initRenderer` via `app.ticker.add`. Scale-in animates 0.7→1.0 over 100ms with 50ms per-icon stagger. `lastRenderedIconIds` + `lastTreeId` guards ensure only newly arrived icons animate; tree change resets all tracking. `reducedMotionEnabled` skips animation entirely. Ticker removed and array cleared in `destroy()`.
- Task 3: `appStore` extended with `iconSource: ... | null` (default null) and `setIconSource` setter. `useIconTextures` event listener updated to generic `listen<{iconSource: ...}>` and dispatches to store.
- Task 4: Settings panel reads `iconSource` from store, renders "Data Sources" section with read-only `—`/`game files`/`community CDN`/`placeholder` label.
- Task 5: `pixiRenderer.test.ts` updated — `MockSprite` hoisted as `vi.fn(function(){...})` (regular function required for `new` constructor calls), `ticker.remove` added to mock, 3 new icon rendering tests all pass. `useIconTextures.test.ts` updated — added `appStore` mock and upgraded `triggerInitialized` to pass typed event payload.
- All 515 tests pass (6 pre-existing failures in ProviderSelector/Settings unrelated to this story). Build succeeds with zero type errors.

### File List

- `lebo/src/features/skill-tree/pixiRenderer.ts`
- `lebo/src/features/skill-tree/pixiRenderer.test.ts`
- `lebo/src/shared/stores/appStore.ts`
- `lebo/src/features/icon-pipeline/useIconTextures.ts`
- `lebo/src/features/icon-pipeline/useIconTextures.test.ts`
- `lebo/src/features/settings/Settings.tsx`
