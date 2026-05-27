---
title: 'Real Game Art Assets'
story_id: '6.5'
story_key: '6-5-real-game-art-assets'
epic: 6
status: review
created: '2026-05-27'
---

## Story

**As a player,**
I want real Last Epoch skill icons to appear on skill tab buttons and on the root node of each skill's specialization tree,
**so that** I can immediately identify my equipped skills at a glance and the app feels visually authentic.

---

## Acceptance Criteria

**AC1 — `skill-icon-map.json` is complete:**
**Given** the bundled `skill-icon-map.json`
**When** any of the 12 game skill IDs is queried against the map
**Then** all 12 return a non-null icon path
**And** `sentinel-smite`, `mage-lightning-blast`, and `primalist-storm-totem` (previously missing) now resolve to icon files

**AC2 — SkillTreeTabBar shows skill icons:**
**Given** a skill tab that has a skill assigned
**When** the player views the tab bar
**Then** a 20x20px icon image appears to the left of the skill name text in that tab
**And** a tab with no assigned skill shows no icon (unchanged appearance)
**And** the icon has `alt=""` (decorative only; the tab text provides the accessible label)

**AC3 — Skill icon renders on the skill tree root node:**
**Given** a skill tree canvas (tabs 1-5) for an assigned skill
**When** the player switches to that tab
**Then** the large center node (the root node at position x=0, y=0) renders the skill's icon texture inside the circle
**And** all other nodes in the skill tree render without icons (no change)
**And** the existing icon pop-in animation (scale 0->1 over 100ms) fires on the root node when the skill tree first renders

**AC4 — SkillPickerGrid uses safe asset URLs:**
**Given** the SkillPickerGrid loads icon paths via `get_icon_cache_path`
**When** it stores the paths for `<img src>`
**Then** each path is converted via `convertFileSrc()` before being used as an img src URL
**And** skill icons display correctly in the picker grid for all 12 skills

**AC5 — Settings icon source reflects "game-files":**
**Given** the app has run `initialize_icon_pipeline` on startup (already wired in `App.tsx`)
**When** the player opens Settings
**Then** the Icon Source field shows "Game files" (not "Placeholder")
*(This is already handled by the Rust pipeline; AC5 confirms it works with the completed icon map.)*

---

## Scope

- **`skill-icon-map.json`** — add 3 missing skill -> icon file entries
- **`SkillPickerGrid.tsx`** — fix `convertFileSrc` omission so img src URLs are valid in Tauri WebView
- **`SkillTreeView.tsx`** — derive `skillRootNodeIds` map and `skillCanvasIconTextures` map; fetch `skillIconUrls` for tab bar; pass both to dependent components
- **`SkillTreeTabBar.tsx`** — add optional `iconUrls?: Map<string, string>` prop; render icon img for assigned skill tabs
- **`SkillTreeTabBar.test.tsx`** — add icon rendering tests
- **`SkillPickerGrid.test.tsx`** — add `convertFileSrc` call verification

**Do NOT implement or touch:**
- Passive tree node icons — the passive tree has no icon pipeline; defer
- Weaver tree — passes `EMPTY_TEXTURES` already; keep unchanged
- Any Rust files — pure TypeScript/React story
- `useIconTextures.ts` — unchanged; it still loads textures by skill ID correctly
- `pixiRenderer.ts` — unchanged; the renderer's `iconTexturesMap.get(node.id)` lookup is correct and will work once root node IDs are in the map

---

## Architecture Notes — READ FIRST

### The icon ID mismatch gap

`useIconTextures(skillIds)` returns `Map<skillId, Texture>` (e.g., `"sentinel-smite" -> Texture`).

`pixiRenderer.ts` line 384 does `iconTexturesMap.get(node.id)` — looking up by **node ID** (e.g., `"sentinel-smite-core"`).

These never match, so icons currently never render on any tree node. The fix: build a transformed map for skill tree canvases where the key is the **root node ID** (`"sentinel-smite-core"` -> same Texture). This is done in `SkillTreeView` via `useMemo`; the renderer is NOT touched.

### Root node identification

The skill tree's root node is the node with `position.x === 0 && position.y === 0` — it's the large center node that represents the skill itself. All skill trees in the current game data have exactly one such node.

Fallback: if no node is at `(0, 0)`, use `Object.entries(treeNodes)[0]` (first entry). This handles edge cases without crashing.

### `convertFileSrc` is required for img src in Tauri WebView

`get_icon_cache_path` returns an absolute OS path (e.g., `C:\Users\...\icons\skills\skillIcon-fireball.png`). The Tauri WebView cannot load a raw OS path as `<img src>`. Use:
```typescript
import { convertFileSrc } from '@tauri-apps/api/core'
const url = convertFileSrc(path)  // -> "asset://localhost/C:/Users/.../skillIcon-fireball.png"
```
This was correctly done in `useIconTextures` (for PixiJS `Assets.load`) but was missing in `SkillPickerGrid`. Story 6.5 fixes the omission.

### SkillTreeTabBar stays props-only

`SkillTreeTabBar` must NOT call IPC directly. `SkillTreeView` owns all data fetching and passes icon URLs down as a prop. This keeps SkillTreeTabBar a pure presentation component consistent with the codebase pattern.

### Stable map references

All new maps (`skillRootNodeIds`, `skillCanvasIconTextures`) are derived via `useMemo` with explicit dependency arrays. They must NOT be created inline inside JSX — that causes PixiJS to re-render the entire tree on every React render due to referential inequality.

The `skillIconUrls` state (for the tab bar) is populated via a single `useEffect` keyed on `classData`; it does NOT re-fetch on every render.

---

## Tasks / Subtasks

- [x] **Task 1: `skill-icon-map.json` — Add 3 missing entries**
- [x] **Task 2: `SkillPickerGrid.tsx` — Fix `convertFileSrc` omission**
- [x] **Task 3: `SkillTreeView.tsx` — Derive root node ID map + transformed icon texture maps**
- [x] **Task 4: `SkillTreeView.tsx` — Fetch and pass icon URLs to SkillTreeTabBar**
- [x] **Task 5: `SkillTreeTabBar.tsx` — Add `iconUrls` prop and icon rendering**
- [x] **Task 6: `SkillTreeTabBar.test.tsx` — Add icon display tests**
- [x] **Task 7: `SkillPickerGrid.test.tsx` — Add `convertFileSrc` test**

---

## Technical Requirements

### Task 1: `skill-icon-map.json` — Add missing entries

**File:** `lebo/src-tauri/resources/icons/skill-icon-map.json`

**Current content (9 entries):**
```json
{
  "acolyte-harvest": "skillIcon-harvest.png",
  "acolyte-rip-blood": "skillIcon-rip blood.png",
  "mage-fireball": "skillIcon-fireball.png",
  "primalist-fury-leap": "skillIcon-fury leap.png",
  "rogue-dancing-strikes": "skillIcon-dancing-strikes.png",
  "rogue-puncture": "skillIcon-puncture.png",
  "sentinel-anomaly": "skillIcon-anomaly.png",
  "sentinel-forge-strike": "skillIcon-forge-strike.png",
  "sentinel-judgement": "skillIcon-judgement.png"
}
```

**Updated content (12 entries — add 3 new keys):**
```json
{
  "acolyte-harvest": "skillIcon-harvest.png",
  "acolyte-rip-blood": "skillIcon-rip blood.png",
  "mage-fireball": "skillIcon-fireball.png",
  "mage-lightning-blast": "skillIcon-Lightning Bolt.png",
  "primalist-fury-leap": "skillIcon-fury leap.png",
  "primalist-storm-totem": "skillIcon-storm_totem.png",
  "rogue-dancing-strikes": "skillIcon-dancing-strikes.png",
  "rogue-puncture": "skillIcon-puncture.png",
  "sentinel-anomaly": "skillIcon-anomaly.png",
  "sentinel-forge-strike": "skillIcon-forge-strike.png",
  "sentinel-judgement": "skillIcon-judgement.png",
  "sentinel-smite": "skillIcon-Divine bolt.png"
}
```

> **Icon file choices (verified present in `resources/icons/skills/`):**
> - `sentinel-smite` -> `skillIcon-Divine bolt.png` — Smite fires a divine lightning bolt from the sky (skill tags: LIGHTNING, HOLY); "Divine bolt" is the closest semantic match among the 1027 available files
> - `mage-lightning-blast` -> `skillIcon-Lightning Bolt.png` — canonical lightning bolt icon; exact match for the skill name
> - `primalist-storm-totem` -> `skillIcon-storm_totem.png` — exact name match for the skill

> **Note:** `lebo/src-tauri/target/debug/resources/icons/` is auto-synced by Cargo during `tauri dev`. Do NOT edit files there — they are overwritten on rebuild. Edit only the source: `lebo/src-tauri/resources/icons/skill-icon-map.json`.

---

### Task 2: `SkillPickerGrid.tsx` — Fix `convertFileSrc`

**File:** `lebo/src/features/skill-picker/SkillPickerGrid.tsx`

**Add import** at the top (external lib imports group):
```typescript
import { convertFileSrc } from '@tauri-apps/api/core'
```

**Update the `useEffect`** that fetches icon paths — wrap path with `convertFileSrc` before storing:

```typescript
useEffect(() => {
  if (skills.length === 0) return
  void Promise.allSettled(
    skills.map(skill =>
      invokeCommand<string | null>('get_icon_cache_path', { skillId: skill.skillId }).then(
        path => [skill.skillId, path] as [string, string | null]
      )
    )
  ).then(results => {
    const pairs: [string, string][] = []
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value[1] !== null) {
        pairs.push([result.value[0], convertFileSrc(result.value[1])])  // <- convertFileSrc added
      }
    }
    setIconPaths(new Map(pairs))
  })
}, [skills])
```

> **Why `convertFileSrc` is needed:** `get_icon_cache_path` returns an OS native path (e.g., `C:\Users\...\skillIcon-fireball.png`). Tauri WebView cannot load OS paths directly as `<img src>`. `convertFileSrc` converts them to `asset://localhost/...` URLs which the WebView can serve.

> **No other changes** — the `<img src={iconPath} .../>` in the JSX already uses `iconPath` which is now the converted URL.

---

### Task 3: `SkillTreeView.tsx` — Root node ID map + icon texture maps

**File:** `lebo/src/features/skill-tree/SkillTreeView.tsx`

**Add imports** (in the external + shared imports section):
```typescript
import { convertFileSrc } from '@tauri-apps/api/core'
import { getIconCachePath } from '../../shared/commands/iconCommands'
```

**Add `skillRootNodeIds` memo** — place after the `iconTextures` line (around line 146), before `allGameNodes`:

```typescript
// Maps each skillId to the ID of its root node (position 0,0) for icon texture lookup.
// pixiRenderer looks up icons by node.id, but iconTextures is keyed by skillId.
// This bridge resolves the ID mismatch so the root node gets its skill icon.
const skillRootNodeIds = useMemo(() => {
  const map = new Map<string, string>()  // skillId -> rootNodeId
  if (!classData) return map
  for (const skill of classData.skills) {
    const treeNodes = classData.skillTrees[skill.skillId]
    if (!treeNodes) continue
    const entry =
      Object.entries(treeNodes).find(([_, n]) => n.position.x === 0 && n.position.y === 0) ??
      Object.entries(treeNodes)[0]
    if (entry) map.set(skill.skillId, entry[0])
  }
  return map
}, [classData])
```

**Add `skillCanvasIconTextures` memo** — place after `skillRootNodeIds`:

```typescript
// For each skill, a single-entry map { rootNodeId -> texture } for the skill tree canvas.
// SkillTreeCanvas receives this instead of the full skill-keyed iconTextures.
const skillCanvasIconTextures = useMemo(() => {
  const result = new Map<string, Map<string, Texture>>()
  for (const [skillId, rootNodeId] of skillRootNodeIds) {
    const texture = iconTextures.get(skillId)
    result.set(skillId, texture ? new Map([[rootNodeId, texture]]) : EMPTY_TEXTURES)
  }
  return result
}, [skillRootNodeIds, iconTextures])
```

**Update the skill tree `SkillTreeCanvas`** (around line 726-732). Change `iconTextures={iconTextures}` to:
```tsx
iconTextures={skillCanvasIconTextures.get(activeSkill.skillId) ?? EMPTY_TEXTURES}
```

> **The passive tree canvas** (~line 668) keeps `iconTextures={iconTextures}` — no change. Passive node IDs do not overlap with skill IDs.

> **`EMPTY_TEXTURES`** is already a module-level constant in `SkillTreeView.tsx` (`const EMPTY_TEXTURES = new Map<string, Texture>()`). Do NOT create a new one — use the existing constant.

> **`Texture` type** is already imported from `pixi.js` in `SkillTreeView.tsx`.

> **`noUnusedLocals`:** `skillRootNodeIds` is consumed by `skillCanvasIconTextures`. `skillCanvasIconTextures` is consumed in JSX. Verify both are used after the change.

---

### Task 4: `SkillTreeView.tsx` — Fetch icon URLs for tab bar

**File:** `lebo/src/features/skill-tree/SkillTreeView.tsx`

**Add state** (near the top of the component body, after existing `useState` calls):
```typescript
const [skillIconUrls, setSkillIconUrls] = useState<Map<string, string>>(new Map())
```

**Add `useEffect`** (after the existing effects, before early returns — note: all hooks must be called unconditionally before the weaver early-return):
```typescript
// Fetch icon URLs for all class skills. Used by SkillTreeTabBar for <img src>.
// getIconCachePath returns OS paths; convertFileSrc makes them WebView-loadable.
useEffect(() => {
  if (!classData) {
    setSkillIconUrls(new Map())
    return
  }
  void Promise.allSettled(
    classData.skills.map(skill =>
      getIconCachePath(skill.skillId).then(path => [skill.skillId, path] as [string, string | null])
    )
  ).then(results => {
    const pairs: [string, string][] = []
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value[1] !== null) {
        pairs.push([r.value[0], convertFileSrc(r.value[1])])
      }
    }
    setSkillIconUrls(new Map(pairs))
  })
}, [classData])
```

**Pass `iconUrls` to all 4 `SkillTreeTabBar` instances.** Search for `<SkillTreeTabBar` in `SkillTreeView.tsx` — there are 4 occurrences (inside the weaver early-return path, and in 3 places in the main render tree). Add `iconUrls={skillIconUrls}` to each:

```tsx
<SkillTreeTabBar
  activeSkills={activeSkills}
  selectedIndex={safeTabIndex}
  onChange={setActiveTabIndex}
  onSkillTabClick={handleSkillTabClick}
  iconUrls={skillIconUrls}    {/* <- ADD to all 4 instances */}
/>
```

> **`void` prefix:** Required by TypeScript strict mode to explicitly acknowledge the unhandled floating promise.

> **Dependency `[classData]`:** The effect re-runs only when the selected class changes. This is correct — icon paths don't change within a class session.

---

### Task 5: `SkillTreeTabBar.tsx` — Add `iconUrls` prop and icon rendering

**File:** `lebo/src/features/skill-tree/SkillTreeTabBar.tsx`

**Update `SkillTreeTabBarProps`:**
```typescript
interface SkillTreeTabBarProps {
  activeSkills: ActiveSkill[]
  selectedIndex: number
  onChange: (index: number) => void
  onSkillTabClick?: (slotIndex: number, element: HTMLButtonElement) => void
  iconUrls?: Map<string, string>   // NEW: skillId -> asset:// URL; absent means no icons shown
}
```

**Update component signature:**
```typescript
export function SkillTreeTabBar({ activeSkills, selectedIndex, onChange, onSkillTabClick, iconUrls }: SkillTreeTabBarProps) {
```

**Update the `Tab` rendering** inside `tabs.map(...)` — add `display: 'flex'`, `alignItems: 'center'`, `gap: 4` to the inline style, and add icon rendering before `{tab.label}`:

```tsx
<Tab
  key={tab.id}
  className="px-4 py-2 text-sm transition-colors data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-[var(--color-accent-gold)] data-[focus]:outline-offset-[-2px]"
  style={{
    color: selected
      ? 'var(--color-text-primary)'
      : isEmpty
        ? 'var(--color-text-disabled, var(--color-text-muted))'
        : 'var(--color-text-muted)',
    fontWeight: selected ? 600 : 400,
    borderBottom: selected
      ? '2px solid var(--color-accent-gold)'
      : '2px solid transparent',
    marginBottom: '-1px',
    display: 'flex',        // NEW
    alignItems: 'center',   // NEW
    gap: 4,                 // NEW
  }}
  onClick={isSkillTab ? (e) => onSkillTabClick?.(i - 1, e.currentTarget as HTMLButtonElement) : undefined}
>
  {isSkillTab && (() => {
    const assignedSkill = activeSkills.find((s) => s.slotId === `slot-${i - 1}`)
    const iconUrl = assignedSkill ? iconUrls?.get(assignedSkill.skillId) : undefined
    return iconUrl ? (
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
      />
    ) : null
  })()}
  {tab.label}
</Tab>
```

> **IIFE pattern:** The inline IIFE `(() => { ... })()` avoids needing a new named sub-component while keeping the conditional icon logic readable. TypeScript infers the return type correctly.

> **`alt=""` + `aria-hidden="true"`:** The icon is purely decorative. The tab text `{tab.label}` provides the accessible name. Setting both ensures screen readers ignore the image.

> **Fallback:** When `iconUrls` is undefined, `iconUrls?.get(...)` returns `undefined` — no img rendered. When a skill is assigned but has no URL in the map, same result. Tab appearance is identical to the pre-icon state.

> **`display: 'flex'` in inline style:** Consistent with the rest of the tab bar's inline style pattern. No Tailwind classes, no `@apply`.

---

### Task 6: `SkillTreeTabBar.test.tsx` — Icon display tests

**File:** `lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx`

Look at the existing tests to understand:
- How `ActiveSkill` is constructed (check `shared/types/build.ts` for the `ActiveSkill` interface including the `role` field added in Epic 5)
- How `SkillTreeTabBar` is rendered in tests

Add a new `describe` block for icon rendering:

```typescript
describe('SkillTreeTabBar icon rendering', () => {
  const mockActiveSkill: ActiveSkill = {
    slotId: 'slot-0',
    skillId: 'mage-fireball',
    skillName: 'Fireball',
    level: 5,
    role: null,
  }

  it('renders img with aria-hidden when iconUrls has a URL for the assigned skill', () => {
    const iconUrls = new Map([['mage-fireball', 'asset://localhost/icons/skillIcon-fireball.png']])
    render(
      <SkillTreeTabBar
        activeSkills={[mockActiveSkill]}
        selectedIndex={0}
        onChange={vi.fn()}
        iconUrls={iconUrls}
      />
    )
    const img = document.querySelector('img[aria-hidden="true"]') as HTMLImageElement | null
    expect(img).not.toBeNull()
    expect(img?.src).toContain('skillIcon-fireball.png')
    expect(img?.alt).toBe('')
  })

  it('renders no img when iconUrls prop is omitted', () => {
    render(
      <SkillTreeTabBar
        activeSkills={[mockActiveSkill]}
        selectedIndex={0}
        onChange={vi.fn()}
      />
    )
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
  })

  it('renders no img for skill tabs with no assigned skill', () => {
    const iconUrls = new Map([['mage-fireball', 'asset://localhost/icons/skillIcon-fireball.png']])
    render(
      <SkillTreeTabBar
        activeSkills={[]}
        selectedIndex={0}
        onChange={vi.fn()}
        iconUrls={iconUrls}
      />
    )
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
  })

  it('renders no img when iconUrls does not contain the assigned skill', () => {
    const iconUrls = new Map<string, string>()
    render(
      <SkillTreeTabBar
        activeSkills={[mockActiveSkill]}
        selectedIndex={0}
        onChange={vi.fn()}
        iconUrls={iconUrls}
      />
    )
    expect(document.querySelector('img[aria-hidden="true"]')).toBeNull()
  })
})
```

> **`document.querySelector` vs `screen.getByRole`:** Because `alt=""` makes the image have an empty accessible name, RTL's `getByRole('img')` may not reliably find it. Use `document.querySelector('img[aria-hidden="true"]')` instead.

> **`ActiveSkill.role`:** The `role` field was added in Epic 5 Story 5.1 (skill role designation). Verify the actual `ActiveSkill` interface in `shared/types/build.ts` and adjust the mock if the field name or type differs.

---

### Task 7: `SkillPickerGrid.test.tsx` — `convertFileSrc` test

**File:** `lebo/src/features/skill-picker/SkillPickerGrid.test.tsx`

Look at the existing test file structure first. The existing tests likely mock `@tauri-apps/api/core` for `invoke`. Extend that mock to include `convertFileSrc`:

```typescript
// At the top of the test file or inside a describe block:
vi.mock('@tauri-apps/api/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tauri-apps/api/core')>()
  return {
    ...actual,
    convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  }
})
```

> **If `@tauri-apps/api/core` is already mocked** in the file (for `invoke` or other functions), add `convertFileSrc: vi.fn(...)` to the existing mock object rather than creating a duplicate `vi.mock` call.

Add a test that verifies the stored icon path is the `convertFileSrc`-converted URL:

```typescript
it('converts icon path with convertFileSrc before storing', async () => {
  const mockPath = '/cache/icons/skills/skillIcon-fireball.png'
  // ... set up invokeCommand mock to return mockPath for get_icon_cache_path ...
  // ... render SkillPickerGrid with a skill ...
  // ... wait for the effect ...
  
  const { convertFileSrc } = await import('@tauri-apps/api/core')
  expect(convertFileSrc).toHaveBeenCalledWith(mockPath)
})
```

> **Adapt to existing test patterns:** Check how `invokeCommand` is mocked in the existing tests and follow the same approach for this test. The key assertion is `expect(convertFileSrc).toHaveBeenCalledWith(mockPath)`.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/resources/icons/skill-icon-map.json` | MODIFY | Add 3 entries: sentinel-smite, mage-lightning-blast, primalist-storm-totem |
| `lebo/src/features/skill-picker/SkillPickerGrid.tsx` | MODIFY | Add `convertFileSrc` import; wrap path in `convertFileSrc()` in useEffect |
| `lebo/src/features/skill-tree/SkillTreeView.tsx` | MODIFY | Add `convertFileSrc` + `getIconCachePath` imports; add `skillRootNodeIds` + `skillCanvasIconTextures` memos; add `skillIconUrls` state + useEffect; pass `iconUrls` to 4x SkillTreeTabBar; pass root-keyed textures to skill canvas |
| `lebo/src/features/skill-tree/SkillTreeTabBar.tsx` | MODIFY | Add `iconUrls?` prop to interface + destructuring; add icon img rendering inside Tab |
| `lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx` | MODIFY | Add 4-test `describe` block for icon rendering |
| `lebo/src/features/skill-picker/SkillPickerGrid.test.tsx` | MODIFY | Add `convertFileSrc` mock + call verification test |

**Do NOT touch:**
- `lebo/src/features/skill-tree/pixiRenderer.ts` — unchanged; `iconTexturesMap.get(node.id)` lookup is correct
- `lebo/src/features/icon-pipeline/useIconTextures.ts` — already correct; not changed
- `lebo/src/shared/commands/iconCommands.ts` — unchanged
- `lebo/src-tauri/src/commands/icon_commands.rs` — no Rust changes needed
- Any `lebo/src-tauri/target/` files — auto-generated; never edit manually
- `lebo/src/features/skill-tree/SkillTreeCanvas.tsx` — `iconTextures` prop is already typed correctly

---

## Architecture & Pattern Compliance

**Four stores rule:** No new stores. All new state is local component state in `SkillTreeView` (`skillIconUrls`) or derived (`skillRootNodeIds`, `skillCanvasIconTextures`). Props passed down to `SkillTreeTabBar`.

**No barrel files:** All imports are direct file paths. `getIconCachePath` imported from `'../../shared/commands/iconCommands'`.

**TypeScript strict mode:**
- `iconUrls?: Map<string, string>` is optional — callers without it compile fine
- `iconUrls?.get(...)` returns `string | undefined` — the ternary handles `undefined` correctly
- `skillRootNodeIds` is typed as `Map<string, string>` (inferred by TypeScript)
- `skillCanvasIconTextures` is typed as `Map<string, Map<string, Texture>>` (inferred)
- Add `iconUrls` to BOTH the `SkillTreeTabBarProps` interface AND the destructuring

**`noUnusedLocals` compliance:**
- `skillRootNodeIds` consumed in `skillCanvasIconTextures` dependencies
- `skillCanvasIconTextures` consumed in skill tree JSX
- `skillIconUrls` consumed in all 4 `SkillTreeTabBar` instances
- `convertFileSrc` consumed in `skillIconUrls` effect
- `getIconCachePath` consumed in `skillIconUrls` effect

**Tailwind v4 / inline styles:** Icon in `SkillTreeTabBar` uses inline `style` prop (width, height, objectFit, borderRadius, flexShrink) — consistent with the tab bar's existing inline style pattern.

**Stable module-level constants:** `EMPTY_TEXTURES` is already module-level in `SkillTreeView.tsx`. Used as the fallback in `skillCanvasIconTextures`. Never create `new Map()` inline in JSX or render.

**No raw `invoke()`:** The new `useEffect` in `SkillTreeView` uses `getIconCachePath` from `iconCommands.ts` which wraps `invokeCommand`.

---

## Previous Story Intelligence (from 6.4)

- **14 pre-existing test failures** — unchanged since Story 6.1. Do not diagnose or fix. Run only the relevant test files for this story.
- **`pnpm build` is the TypeScript truth:** Run from `lebo/` after all changes. Zero TypeScript errors required.
- **Tailwind v4 pattern:** Inline `style` props for custom CSS values. Never `@apply`.
- **`SkillTreeInteraction` interface:** Lives in `useSkillTree.ts` — not modified in this story.
- **PNG tiles in `pixiRenderer`:** Background files are `.png` (not `.webp`) — not relevant here.
- **`applyNodeChangeBulk`:** Added in 6.4 to `buildStore.ts`. Not impacted by this story.
- **Grace timer in `useSkillTree`:** The 50ms `clearHoverTimerRef` pattern. Not relevant to icons.

---

## Potential Pitfalls / Guardrails

1. **All 4 SkillTreeTabBar instances must get `iconUrls`:** `SkillTreeView.tsx` renders `SkillTreeTabBar` in 4 locations — search for `<SkillTreeTabBar` to find all of them. The weaver early-return path (before the main render tree) also has one. All 4 must receive `iconUrls={skillIconUrls}`. Missing even one will cause TypeScript to compile fine (prop is optional) but that instance won't show icons.

2. **Hooks must be called before the weaver early-return:** All `useState` and `useEffect` calls (including the new `skillIconUrls` ones) must be placed BEFORE the `if (isWeaverTab)` check in `SkillTreeView`. This is a pre-existing rule of the codebase — see the project-context.md note: "Any logic before `if (isWeaverTab)` runs for all tabs including weaver — all hooks must be called unconditionally before any early return."

3. **`skillCanvasIconTextures.get()` fallback:** `skillCanvasIconTextures.get(activeSkill.skillId)` returns `undefined` if the skill is not yet in the map (e.g., icon not loaded yet). Always use `?? EMPTY_TEXTURES` as the fallback: `skillCanvasIconTextures.get(activeSkill.skillId) ?? EMPTY_TEXTURES`. This prevents passing `undefined` to the canvas.

4. **`Object.entries` and `find` on `classData.skillTrees[skillId]`:** `classData.skillTrees` maps skill IDs to `Record<string, GameNode>`. If a skill ID from `classData.skills` has no entry in `classData.skillTrees`, `treeNodes` is `undefined`. The `if (!treeNodes) continue` guard handles this.

5. **`convertFileSrc` in tests:** `convertFileSrc` is a Tauri API that won't work in jsdom. Any test file that renders components using `convertFileSrc` (indirectly via the new effects) must mock it. The new `useEffect` in `SkillTreeView` fires asynchronously — existing `SkillTreeView` tests that don't `await` async effects should be unaffected. Only `SkillPickerGrid.test.tsx` needs explicit mock verification (Task 7).

6. **`Promise.allSettled` + `void`:** TypeScript strict mode (with `no-floating-promises` lint or `@typescript-eslint/no-floating-promises`) requires either `await` or `void` on unhandled promises. Use `void Promise.allSettled(...)` — same pattern as `SkillPickerGrid.tsx` line 76.

7. **Root node at (0,0) is stable:** All current skill trees have exactly one node at position `(0, 0)` (the large center node). The `find` will always succeed for current game data. The `?? Object.entries(treeNodes)[0]` fallback is purely defensive for future data.

---

## Verification Commands

```bash
# From lebo/:
pnpm build                                                         # Zero TS errors (critical)
pnpm vitest src/features/skill-tree/SkillTreeTabBar.test.tsx       # New icon tests pass
pnpm vitest src/features/skill-picker/SkillPickerGrid.test.tsx     # convertFileSrc test passes
pnpm vitest                                                        # Full suite — 14 pre-existing failures unchanged
```

---

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List

- **Task 1:** Added 3 missing entries to `skill-icon-map.json`: `sentinel-smite` → `skillIcon-Divine bolt.png`, `mage-lightning-blast` → `skillIcon-Lightning Bolt.png`, `primalist-storm-totem` → `skillIcon-storm_totem.png`. All 3 icon files verified present in `resources/icons/skills/`.
- **Task 2:** Added `convertFileSrc` import from `@tauri-apps/api/core` to `SkillPickerGrid.tsx`. Wrapped `path` in `convertFileSrc()` inside the `useEffect` that fetches icon paths, converting raw OS paths to Tauri `asset://localhost/...` URLs.
- **Task 3:** Added `skillRootNodeIds` useMemo (finds root node at position 0,0 per skill) and `skillCanvasIconTextures` useMemo (maps rootNodeId→Texture per skill) to `SkillTreeView.tsx`. Skill tree canvas now passes `skillCanvasIconTextures.get(activeSkill.skillId) ?? EMPTY_TEXTURES` instead of the skill-keyed `iconTextures`, resolving the ID mismatch that prevented icons from rendering on root nodes.
- **Task 4:** Added `skillIconUrls` state and a `useEffect` (keyed on `classData`) that fetches all class skill icon paths via `getIconCachePath` and converts them with `convertFileSrc`. Passed `iconUrls={skillIconUrls}` to all 4 `SkillTreeTabBar` instances in `SkillTreeView.tsx`.
- **Task 5:** Updated `SkillTreeTabBar.tsx` with optional `iconUrls?: Map<string, string>` prop. Tab buttons now use `display: flex`, `alignItems: center`, `gap: 4` inline styles, and render a 20×20px icon `<img>` with `alt=""` + `aria-hidden="true"` for assigned skill tabs when a URL is available.
- **Task 6:** Added 4-test `describe('SkillTreeTabBar icon rendering')` block covering: icon renders with aria-hidden, no icon when prop omitted, no icon for empty slots, no icon when skill not in map. All 11 tests pass.
- **Task 7:** Added `vi.mock('@tauri-apps/api/core')` with `convertFileSrc` mock and a test verifying `convertFileSrc` is called with the raw path. All 10 tests pass.
- **Regression:** Full suite: 14 failed (pre-existing, unchanged) | 1025 passed. Zero new failures.
- **Build:** `pnpm build` passes with zero TypeScript errors.

### Review Findings
_To be filled by code review_

### File List

- `lebo/src-tauri/resources/icons/skill-icon-map.json`
- `lebo/src/features/skill-picker/SkillPickerGrid.tsx`
- `lebo/src/features/skill-picker/SkillPickerGrid.test.tsx`
- `lebo/src/features/skill-tree/SkillTreeView.tsx`
- `lebo/src/features/skill-tree/SkillTreeTabBar.tsx`
- `lebo/src/features/skill-tree/SkillTreeTabBar.test.tsx`

### Change Log

- Added 3 missing skill icon map entries (sentinel-smite, mage-lightning-blast, primalist-storm-totem) (Date: 2026-05-27)
- Fixed convertFileSrc omission in SkillPickerGrid so icons display in Tauri WebView (Date: 2026-05-27)
- Resolved icon ID mismatch in SkillTreeView — root node now receives correct skill icon texture (Date: 2026-05-27)
- Added skillIconUrls pipeline in SkillTreeView — tab bar icons fetched and passed down (Date: 2026-05-27)
- SkillTreeTabBar renders 20×20px skill icon to the left of the tab label (Date: 2026-05-27)
- Added icon rendering tests (4 cases) and convertFileSrc call verification test (Date: 2026-05-27)
