# Story 2.3: TypeScript Icon Texture Loading (useIconTextures Hook)

Status: done

## Story

As a developer,
I want a `useIconTextures` hook that loads skill icons from the local cache into PixiJS Assets and returns a `Map<skillId, Texture>`, passed as a prop to SkillTreeCanvas,
So that the props-only canvas contract is maintained while icons render in nodes.

## Acceptance Criteria

1. **Given** the `icon-pipeline:initialized` Tauri event has been emitted
   **When** `useIconTextures(skillIds: string[])` is called by the parent component of SkillTreeCanvas
   **Then** it calls `getIconCachePath(skillId)` for each skill ID, batches the non-null paths into `PixiJS.Assets.load()` calls after converting them via `convertFileSrc`, and returns a `Map<skillId, Texture>` that fills progressively as textures resolve

2. **Given** some icon cache paths return null (no cached icon)
   **When** `useIconTextures` processes those IDs
   **Then** those IDs are omitted from the returned Map; missing entries in the Map trigger placeholder fill in the renderer (no crash)

3. **Given** the parent component has the resolved `iconTextures: Map<string, Texture>`
   **When** it renders `<SkillTreeCanvas iconTextures={iconTextures} ... />`
   **Then** SkillTreeCanvas accepts `iconTextures` as a required prop and forwards it to `pixiRenderer.renderTree()` — `PixiJS.Assets.load()` is never called inside SkillTreeCanvas or pixiRenderer.ts

4. **And** the hook lives in `src/features/icon-pipeline/useIconTextures.ts` with no barrel file export

5. **And** icon texture loading begins only after `icon-pipeline:initialized` is received, preventing premature load attempts before the pipeline has run

6. **And** `App.tsx` calls `initializeIconPipeline()` at startup (alongside `initGameData()`), without awaiting it (fire-and-forget — the hook listens for the event)

7. **And** `RendererInstance.renderTree` and `pixiRenderer.ts` `renderTree` both accept `iconTextures: Map<string, Texture>` as a new required parameter; the renderer stores the map for Story 2.4 to use in draw functions

## Tasks / Subtasks

- [x] Task 1: Create `src/features/icon-pipeline/useIconTextures.ts` (AC: #1, #2, #5)
  - [x] Subscribe to `icon-pipeline:initialized` event using `listen` from `@tauri-apps/api/event` inside a `useEffect`; set a `pipelineReady` state to true when event fires
  - [x] When `pipelineReady` becomes true, call `getIconCachePath(skillId)` (from `src/shared/commands/iconCommands.ts`) for each entry in `skillIds`; collect non-null results as `Array<{ skillId, url: string }>`
  - [x] Convert each local path to a WebView-accessible URL via `convertFileSrc(path)` (from `@tauri-apps/api/core`) before passing to `Assets.load`
  - [x] Load textures: call `Assets.load<Texture>(convertedUrl)` per entry (or batch if PixiJS supports it); update `Map<string, Texture>` state as each Promise resolves (progressive — do NOT await all before returning)
  - [x] Return the partial/growing `Map<string, Texture>` from the hook
  - [x] On `skillIds` change: only load icons for newly added IDs; do not reload IDs already in the map (PixiJS Assets cache handles dedup by URL)
  - [x] Cleanup: unlisten the Tauri event on unmount

- [x] Task 2: Extend `SkillTreeCanvasProps` and `RendererInstance` in `types.ts` (AC: #3, #7)
  - [x] Add `iconTextures: Map<string, Texture>` as a required prop to `SkillTreeCanvasProps`
  - [x] Update `RendererInstance.renderTree` signature: `renderTree(data: TreeData, nodeAllocations: Record<string, number>, highlightedNodes: HighlightedNodes, iconTextures: Map<string, Texture>): void`
  - [x] Import `Texture` from `'pixi.js'` in `types.ts`

- [x] Task 3: Update `SkillTreeCanvas.tsx` to accept and forward `iconTextures` (AC: #3)
  - [x] Destructure `iconTextures` from props
  - [x] Update `dataRef.current` to include `iconTextures`
  - [x] In the mount effect's initial `r.renderTree(...)` call, pass `iconTextures`
  - [x] In the data-change `useEffect` that calls `rendererRef.current?.renderTree(...)`, pass `iconTextures`
  - [x] In the reduced-motion `useEffect` re-render, pass `iconTextures`

- [x] Task 4: Update `pixiRenderer.ts` `renderTree` to accept `iconTextures` (AC: #7)
  - [x] Add `iconTextures: Map<string, Texture>` as the 4th parameter to the internal `renderTree` function
  - [x] Store `iconTextures` in a `let iconTexturesMap = new Map<string, Texture>()` closure variable accessible to draw functions for Story 2.4
  - [x] No other changes to draw functions — Story 2.4 adds Sprite rendering

- [x] Task 5: Update `SkillTreeView.tsx` to call `useIconTextures` and pass prop (AC: #1, #3)
  - [x] Collect skill IDs: `const skillIds = useMemo(() => classData?.skills.map(s => s.skillId) ?? [], [classData])`
  - [x] Call `const iconTextures = useIconTextures(skillIds)` at the top of the component (unconditionally — hook rules)
  - [x] Pass `iconTextures={iconTextures}` to both `<SkillTreeCanvas>` render sites (passive tab and skill tab)

- [x] Task 6: Update `App.tsx` startup to call `initializeIconPipeline()` (AC: #6)
  - [x] Import `initializeIconPipeline` from `src/shared/commands/iconCommands.ts`
  - [x] In the startup `useEffect` (alongside `initGameData()`), add `initializeIconPipeline().catch(console.error)` — fire-and-forget, same pattern as `initGameData()`

- [x] Task 7: Write `src/features/icon-pipeline/useIconTextures.test.ts` (AC: #1, #2, #5)
  - [x] Mock `@tauri-apps/api/event` → `listen` as `vi.fn().mockResolvedValue(vi.fn())`
  - [x] Mock `@tauri-apps/api/core` → `convertFileSrc` as `(p: string) => p`
  - [x] Mock `src/shared/commands/iconCommands` → `getIconCachePath` returning null or a path
  - [x] Mock `pixi.js` → `Assets.load` returning a fake Texture object
  - [x] Test: hook does not call `getIconCachePath` before `icon-pipeline:initialized` fires
  - [x] Test: hook calls `getIconCachePath` for each skillId after event fires
  - [x] Test: null paths are excluded from the returned Map
  - [x] Test: non-null paths are passed through `convertFileSrc` then to `Assets.load`
  - [x] Test: returned Map contains resolved textures for non-null paths

## Dev Notes

### Critical: `convertFileSrc` Is Required for Local Paths

`getIconCachePath` returns an absolute OS path (e.g., `C:\Users\Alec\AppData\Roaming\com.lebo.dev\lebo\icons\skills\skillIcon-fireball.png`). **PixiJS `Assets.load()` cannot access raw OS paths directly from the WebView.** You MUST convert using:

```typescript
import { convertFileSrc } from '@tauri-apps/api/core'

const webviewUrl = convertFileSrc(absolutePath)
// → 'asset://localhost/C%3A%5CUsers%5CAlec%5C...'
const texture = await Assets.load<Texture>(webviewUrl)
```

Without `convertFileSrc`, `Assets.load` silently fails or throws a CORS/network error. This is the #1 disaster risk for this story.

### Tauri Event Subscription Pattern

Follow the exact pattern from `useOptimizationStream.ts`:

```typescript
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'

useEffect(() => {
  let isMounted = true
  let unlisten: UnlistenFn | null = null

  listen('icon-pipeline:initialized', () => {
    if (isMounted) setPipelineReady(true)
  }).then((fn) => { unlisten = fn }).catch(console.error)

  return () => {
    isMounted = false
    unlisten?.()
  }
}, [])
```

### PixiJS 8 Assets API

```typescript
import { Assets, Texture } from 'pixi.js'

// Single load:
const texture = await Assets.load<Texture>(url)

// PixiJS Assets caches by URL — loading the same URL twice returns the cached result immediately.
// This means if `skillIds` changes to include a previously loaded ID, no network request is made.
```

PixiJS Assets are a global cache. Do NOT call `Assets.unload()` on cleanup — textures are shared app-wide and Story 2.4 relies on them remaining cached.

### Progressive Map Updates

The hook must return a progressively filling `Map`, not wait for all textures:

```typescript
const [iconTextures, setIconTextures] = useState<Map<string, Texture>>(new Map())

// For each skillId with a non-null path:
Assets.load<Texture>(convertFileSrc(path)).then((texture) => {
  setIconTextures((prev) => new Map(prev).set(skillId, texture))
})
```

Each `setIconTextures` call triggers a re-render with the latest partial map. `SkillTreeCanvas` re-renders as textures arrive, which triggers `renderTree` calls — this is intentional (Story 2.4 will progressively show icons as they load).

### What `App.tsx` Calls

`initializeIconPipeline()` is a fire-and-forget call. It:
1. Triggers the Rust command which copies pre-bundled icons to cache (if not already done)
2. Emits `icon-pipeline:initialized` Tauri event when complete

The hook's `listen('icon-pipeline:initialized', ...)` subscription fires immediately if the event was already emitted. Tauri 2's `listen` is not retroactive — it only fires for events emitted AFTER the subscription is established. Since `initializeIconPipeline()` is called in `App.tsx`'s `useEffect` and `useIconTextures` is mounted inside `SkillTreeView` (which renders after `App.tsx`), there is a possible race: `initializeIconPipeline()` might emit before the listener is registered.

**Resolution:** In `App.tsx`, do NOT await `initializeIconPipeline()`. In `useIconTextures`, register the listener immediately (first render). The timing should be fine because `initializeIconPipeline()` performs file I/O (even if trivially fast on repeated launches, the event is emitted asynchronously). If timing issues occur in practice, the fallback is to also check `get_icon_cache_path` for a "warm" cache directly on mount — but this is NOT needed for Story 2.3; note it for Story 2.4 if icons don't appear.

### Hook Location and No Barrel File

```
src/features/icon-pipeline/useIconTextures.ts   ← NEW (no index.ts beside it)
src/features/icon-pipeline/useIconTextures.test.ts ← NEW
```

The `icon-pipeline/` feature folder is new. Do NOT create an `index.ts` barrel.

### `iconTextures` Prop Design: Required, Not Optional

`iconTextures: Map<string, Texture>` is required on `SkillTreeCanvasProps` (not `?:`). The parent `SkillTreeView` always provides it — initially an empty `Map()`, filling as textures load. This makes the type contract explicit and avoids null-checks inside the renderer.

In `SkillTreeView.tsx`, call `useIconTextures` at the component top level (not inside conditional branches — hooks rules). The empty map correctly renders all nodes as placeholder fill until textures resolve.

### `pixiRenderer.ts` — Store for Story 2.4

Update `renderTree` to accept and store the map:

```typescript
// Inside the initRenderer closure:
let iconTexturesMap = new Map<string, Texture>()

function renderTree(
  data: TreeData,
  nodeAllocations: Record<string, number>,
  highlightedNodes: HighlightedNodes,
  iconTextures: Map<string, Texture>,
) {
  iconTexturesMap = iconTextures  // stored for draw functions; Story 2.4 reads this
  // ... existing renderTree logic unchanged ...
}
```

No changes to draw functions in Story 2.3. Story 2.4 adds `iconTexturesMap.get(node.id)` calls inside the draw functions.

### What This Story Does NOT Implement

- PixiJS Sprite drawing of icons inside nodes — that is Story 2.4
- `iconSource` label in Settings panel — that is Story 2.4
- Skill picker icon rendering (`<img>` elements) — that is Story 1.3, which uses `getIconCachePath` directly (not PixiJS textures)
- Stagger animation on icon load — that is Story 2.4 (UX-DR13)
- Any Rust changes — this story is TypeScript-only

### Existing Patterns to Follow

- `useOptimizationStream.ts` — exact pattern for `listen` + cleanup in `useEffect`
- `iconCommands.ts` (`src/shared/commands/iconCommands.ts`) — already has `getIconCachePath(skillId)` typed wrapper; use it, do not call raw `invokeCommand` directly
- `useConnectivity.ts` — another hook that uses `listen` for a single event
- `SkillTreeCanvas.tsx` — existing `dataRef` pattern; add `iconTextures` to it like the other props

### Tests — Mock Setup

Tests that render `SkillTreeView` or import `useIconTextures` need these mocks (add to top of test file, not to `test-setup.ts`):

```typescript
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (p: string) => p,
  invoke: vi.fn(),
}))
vi.mock('../../shared/commands/iconCommands', () => ({
  getIconCachePath: vi.fn().mockResolvedValue(null),
}))
vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn().mockResolvedValue({}) },
  Texture: {},
}))
```

Any test file that renders `SkillTreeView` (including `SkillTreeCanvas` indirectly) will need these mocks to avoid real Tauri IPC and PixiJS init. Check existing `SkillTreeView` tests and add the mocks if missing — they currently don't mock `iconCommands` or `@tauri-apps/api/core`.

### Project Context Rules Applicable

- No barrel files — no `src/features/icon-pipeline/index.ts`
- No raw `invoke()` — use `getIconCachePath` from `iconCommands.ts`
- No new Zustand stores — hook state is local `useState` inside `useIconTextures`
- TypeScript strict mode — no unused params, every import used
- `SkillTreeCanvas` is props-only — no store access inside; `iconTextures` comes from parent

### File List

- `lebo/src/features/icon-pipeline/useIconTextures.ts` (created)
- `lebo/src/features/icon-pipeline/useIconTextures.test.ts` (created)
- `lebo/src/features/skill-tree/types.ts` (modified — add `iconTextures` to `SkillTreeCanvasProps` and `RendererInstance.renderTree`)
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` (modified — accept and forward `iconTextures`)
- `lebo/src/features/skill-tree/pixiRenderer.ts` (modified — accept `iconTextures` in `renderTree`, store in closure)
- `lebo/src/features/skill-tree/SkillTreeView.tsx` (modified — call `useIconTextures`, pass to canvas)
- `lebo/src/App.tsx` (modified — call `initializeIconPipeline()` at startup)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Created `useIconTextures` hook in new `icon-pipeline` feature folder. Listens for `icon-pipeline:initialized` Tauri event, then progressively loads textures via PixiJS Assets after converting OS paths with `convertFileSrc`. Tracks loaded IDs in a ref to avoid re-loading on skillIds changes.
- Extended `types.ts` with `Texture` import from pixi.js; added `iconTextures: Map<string, Texture>` as required prop to `SkillTreeCanvasProps` and 4th parameter to `RendererInstance.renderTree`.
- Updated `SkillTreeCanvas.tsx`: added `iconTextures` to destructured props, `dataRef`, and all three `renderTree` call sites (mount, data-change effect, reduced-motion effect).
- Updated `pixiRenderer.ts`: added `iconTextures` 4th param and closure variable `iconTexturesMap` (stored for Story 2.4 draw functions; `void` expression prevents `noUnusedLocals` error).
- Updated `SkillTreeView.tsx`: added `skillIds` useMemo, `useIconTextures` hook call, and `iconTextures` prop on both passive and skill tab `<SkillTreeCanvas>` render sites.
- Updated `App.tsx`: added `initializeIconPipeline().catch(console.error)` fire-and-forget call alongside `initGameData()` in startup useEffect.
- Fixed two existing test files to pass the new `iconTextures` argument: `pixiRenderer.test.ts` (2 `renderTree` calls) and `SkillTreeCanvas.test.tsx` (`DEFAULT_PROPS`).
- All 6 new hook tests pass. Full suite: 509/515 pass (6 pre-existing failures in Settings/ProviderSelector unrelated to this story). Build passes with zero type errors.

### Change Log

- 2026-05-12: Implemented story 2.3 — TypeScript icon texture loading via useIconTextures hook. All ACs satisfied, 6 new tests, no regressions.

### Review Findings

- [x] [Review][Patch] `unlisten` race — Tauri listener leaks if component unmounts before `listen()` Promise resolves [`useIconTextures.ts:19-22`]
- [x] [Review][Patch] No `isMounted` guard in texture loading effect — `setIconTextures` may be called after unmount [`useIconTextures.ts:32-44`]
- [x] [Review][Patch] `loadedIdsRef.current.add(skillId)` called before `getIconCachePath` resolves — failed IDs permanently blocked from retry [`useIconTextures.ts:36`]
- [x] [Review][Patch] No `.catch()` on `Assets.load` — unhandled rejection silently drops texture with no retry path [`useIconTextures.ts:40`]
- [x] [Review][Defer] `loadedIdsRef` accumulates across class switches — memory grows per session, spec-intended (PixiJS URL-cache dedup) [`useIconTextures.ts:11`] — deferred, pre-existing
- [x] [Review][Defer] `classData` not memoized in `SkillTreeView` — `skillIds` gets new array reference on unrelated store updates; guarded by `loadedIdsRef`, perf only [`SkillTreeView.tsx:89`] — deferred, pre-existing
