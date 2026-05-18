# Story 1.3: Skill Picker Grid Component

Status: done

## Story

As a theory-crafter,
I want to open a skill picker showing all skills available for my class and mastery, organized by base class and mastery sections with point-gate badge overlays,
So that I can quickly find and assign any skill to an active slot tab.

## Acceptance Criteria

1. **Given** the player clicks an active skill tab that has no skill assigned  
   **When** the SkillPickerGrid opens in the center panel  
   **Then** skills are organized into sections: "{BaseClassName} Skills" (no mastery gate) followed by "{MasteryName} Skills" (×3 masteries with gate badges)

2. **Given** a mastery-gated skill with a 15-point threshold  
   **When** the skill is displayed in the picker grid  
   **Then** a badge overlay shows "15" in `--color-badge-mastery-gate` styling positioned at the bottom edge of the hexagonal icon cell

3. **Given** the player's class and mastery are set  
   **When** the skill picker opens  
   **Then** only skills matching the selected class/mastery are shown; skills for other masteries are excluded — filtering responsibility belongs to the caller, `SkillPickerGrid` renders exactly the `skills` prop it receives

4. **Given** the SkillPickerGrid component  
   **When** rendered  
   **Then** the grid container has `role="grid"`, each skill cell has `role="gridcell"` with `aria-label="{skillName} ({masteryName} skill, requires {N} points)"` for mastery-gated skills or `aria-label="{skillName} (base class skill)"` for ungated skills

5. **Given** a skill in the picker in "selected" state (currently loaded in this tab)  
   **When** it is displayed  
   **Then** it has a `1px solid var(--color-accent-gold)` border distinguishing it from available skills

6. **Given** the player presses Escape while the skill picker is open  
   **When** focus is anywhere within the grid  
   **Then** the `onClose` callback is invoked and the picker closes

7. **And** the hexagonal clip-path CSS is defined as CSS custom property `--hex-clip-path` in `src/assets/styles/global.css` `@theme` block; cells apply it via `clip-path: var(--hex-clip-path)`

8. **And** `--color-badge-mastery-gate` token is added to the `@theme` block in `src/assets/styles/global.css` with its PixiJS hex equivalent as an inline comment

9. **And** the SkillPickerGrid component passes `axe()` from vitest-axe with zero violations (UX-DR15)

10. **And** each skill picker cell renders its game icon via `<img src={localCachePath} alt="" />` (using `invokeCommand<string | null>('get_icon_cache_path', { skillId })`) when the path is non-null; when the path is null or the icon fetch is still pending, the cell renders a placeholder `<div>` using `background-color: var(--color-node-available)` inside the hex clip region — per Architecture Decision 8

## Tasks / Subtasks

- [x] Task 1: Add `SkillEntry` type to shared game data types (AC: #1, #2, #4)
  - [x] `src/shared/types/gameData.ts`: Add exported interface `SkillEntry { skillId: string; skillName: string; masteryId: string | null; masteryName: string | null; masteryGatePoints: number | null }` — `masteryId: null` means a base class skill with no mastery gate

- [x] Task 2: Add CSS tokens to global stylesheet (AC: #7, #8)
  - [x] `src/assets/styles/global.css`: In the `@theme` block, add `--hex-clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)` — pointy-top hexagon, visually matches the LE hexagonal node aesthetic
  - [x] `src/assets/styles/global.css`: In the `@theme` block, add `--color-badge-mastery-gate: #1A1208` with inline comment `/* PixiJS: 0x1A1208 — dark warm overlay for mastery gate badge */`

- [x] Task 3: Create `SkillPickerGrid` component (AC: #1–#6, #10)
  - [x] Create directory `src/features/skill-picker/` (no `index.ts`)
  - [x] `src/features/skill-picker/SkillPickerGrid.tsx`: Define and export component with props interface:
    ```
    interface SkillPickerGridProps {
      baseClassName: string
      skills: SkillEntry[]
      selectedSkillId: string | null
      onSelect: (skillId: string) => void
      onClose: () => void
    }
    ```
  - [x] Group skills into ordered sections: section 0 = base class skills (`masteryId === null`), sections 1-3 = skills grouped by `masteryId` in insertion order; render section header `<h3>` with title `"{baseClassName} Skills"` for section 0 and `"{masteryName} Skills"` for mastery sections
  - [x] Render grid container `<div role="grid" aria-label="Skill picker">` wrapping all sections
  - [x] Each cell: `<button role="gridcell" aria-label={...}>` (see AC #4 for label format); apply `clip-path: var(--hex-clip-path)` to the inner icon container; selected cell adds `border: 1px solid var(--color-accent-gold)`; mastery-gated cells add a `<span>` badge absolutely positioned at bottom edge showing `masteryGatePoints` with `background-color: var(--color-badge-mastery-gate)` and `color: var(--color-accent-gold-dim)` and `border: 1px solid var(--color-accent-gold-dim)`
  - [x] Keyboard navigation: track `focusedSkillId` in state; on `keydown` within grid — `ArrowLeft`/`ArrowUp` focus previous cell in flat skill order, `ArrowRight`/`ArrowDown` focus next cell, `Enter` calls `onSelect(focusedSkillId)`, `Escape` calls `onClose()`; implement roving tabindex: only the focused cell has `tabIndex={0}`, all others `tabIndex={-1}`; on initial render, focused cell is `selectedSkillId ?? skills[0]?.skillId`
  - [x] Focus management: use a `Map<skillId, HTMLButtonElement>` ref to store cell refs; after `focusedSkillId` state updates, call `.focus()` on the corresponding ref element

- [x] Task 4: Implement icon loading (AC: #10)
  - [x] In `SkillPickerGrid.tsx`, add a `useState<Map<string, string>>(new Map())` named `iconPaths` to hold resolved paths
  - [x] Add a single `useEffect` (runs once on mount, deps: `skills`) that calls `invokeCommand<string | null>('get_icon_cache_path', { skillId })` for each skill entry, collects results as `[skillId, path]` pairs where path is non-null, then sets state with one `setIconPaths(new Map(pairs))` call — avoids per-cell re-renders
  - [x] Each cell renders `<img src={iconPaths.get(skill.skillId)} alt="" />` when the path is present in the map; otherwise renders `<div aria-hidden="true" style={{ backgroundColor: 'var(--color-node-available)', width: '100%', height: '100%' }} />`

- [x] Task 5: Write tests (AC: #4, #9)
  - [x] `src/features/skill-picker/SkillPickerGrid.test.tsx`: Create file co-located with component
  - [x] Mock `invokeCommand` via `vi.mock('../../shared/utils/invokeCommand', () => ({ invokeCommand: vi.fn().mockResolvedValue(null) }))` so icon loads resolve to null (placeholder path) synchronously-ish
  - [x] Test: renders section headers — base class section title matches `"{baseClassName} Skills"`, mastery section titles match `"{masteryName} Skills"` for each unique masteryId
  - [x] Test: mastery-gated cells show badge with correct point threshold text
  - [x] Test: selected skill cell has gold border style applied
  - [x] Test: `onSelect` called with correct skillId when Enter pressed on focused cell
  - [x] Test: `onClose` called when Escape pressed
  - [x] Test: `role="grid"` on container, `role="gridcell"` on each cell, `aria-label` correct format for base class and mastery-gated skills
  - [x] Test: `axe()` zero violations — import `{ axe }` from `'vitest-axe'` and `import 'vitest-axe/extend-expect'`; assert `expect(await axe(container)).toHaveNoViolations()`

## Dev Notes

### Icon Loading Pattern

The component calls `invokeCommand<string | null>('get_icon_cache_path', { skillId })` (Architecture Decision 1 / `src/shared/utils/invokeCommand.ts`). The Rust command `get_icon_cache_path` returns the local cache path if the icon has been cached, or `null` if not yet available. The component renders a colored placeholder `<div>` until the path resolves. This is a React DOM `<img>` load path, separate from the PixiJS `useIconTextures` hook used for canvas rendering.

Batch all icon fetches in a single `useEffect` on mount — one `Promise.allSettled` across all skills — then set state once to avoid O(N) re-renders. Use `Promise.allSettled` not `Promise.all` so one failed IPC call does not abort all icon loads.

### CSS Hex Clip-Path

The `--hex-clip-path` custom property holds a `polygon()` value. Apply it to cells as `clip-path: var(--hex-clip-path)`. The clip is applied to the inner icon container (not the outer cell `<button>`) so the focus ring and badge are unclipped. Cell layout:

```
<button role="gridcell" ...>           ← outer: border, focus ring, badge
  <div style="clip-path: var(--hex-clip-path)">  ← inner: hex-clipped icon area
    <img ... /> or <div placeholder />
  </div>
  <span badge ... />                   ← absolute, bottom edge, outside clip
</button>
```

### Section Grouping Logic

Derive sections from the `skills` prop in a single pass. Process skills in array order to preserve game-data ordering:
1. Collect all skills where `masteryId === null` → section 0 (base class)
2. As skills with `masteryId !== null` are encountered, group by `masteryId` in first-encounter order → sections 1–3

Do **not** sort sections alphabetically — preserve the order the caller passes, which reflects the game's canonical mastery ordering.

### Roving Tabindex

Only the focused cell receives `tabIndex={0}`; all other cells receive `tabIndex={-1}`. On keyboard navigation, update `focusedSkillId` state and use a `useEffect` to call `.focus()` on the new cell's ref. This avoids needing to imperatively manage focus within the keyboard handler (which fires before React re-renders).

### Mastery Gate Badge

Position the badge using `position: absolute; bottom: 0; left: 50%; transform: translate(-50%, 50%)` on the `<span>` inside the `<button>`. The `<button>` must have `position: relative; overflow: visible`. The badge uses `--color-badge-mastery-gate` background with `--color-accent-gold-dim` text and border, making it visually distinct as a point-gate indicator.

Badge text is the raw number (e.g., `"15"`), not `"15 pts"` — keep it minimal to fit inside the small badge.

### Accessibility

- `role="grid"` on the outer container; do NOT use `<table>` — a CSS-grid-layout div with ARIA roles is the right pattern here
- Each `<button>` has `role="gridcell"` (a button within a gridcell is valid in ARIA 1.2 under the "cell contains interactive widget" pattern; alternatively, put `role="gridcell"` directly on the button)
- The outer `<div role="grid">` should have `aria-label="Skill picker"` or `aria-labelledby` pointing to a visually-present heading
- Section `<h3>` headers are inside the grid but outside gridcells — acceptable since they are not interactive; alternatively wrap in `role="rowgroup"` if axe flags the structure
- Badge `<span>` is presentational — add `aria-hidden="true"` so the badge number is not read separately from the cell's `aria-label` (which already contains the gate points in the label text)
- Icon `<img>` uses `alt=""` (decorative) since the cell's `aria-label` is the accessible name

### Test Setup

`vitest-axe` is already integrated in `lebo/src/test-setup.ts`. Import `'vitest-axe/extend-expect'` at the top of the test file and call `axe(container)` from `@testing-library/react`'s `render` result. Wrap the axe assertion in `await act(async () => {})` if needed to flush async icon-load promises.

`invokeCommand` must be mocked in all tests — it hits Tauri IPC which is unavailable in jsdom. Mock at the module level: `vi.mock('../../shared/utils/invokeCommand', ...)`.

### Project Structure Notes

- New directory: `src/features/skill-picker/` — no `index.ts` (project rule: no barrel files)
- File placement: `SkillPickerGrid.tsx` and `SkillPickerGrid.test.tsx` co-located in `src/features/skill-picker/`
- `SkillEntry` goes in `src/shared/types/gameData.ts` (game data type, not a new file)
- CSS tokens go in the `@theme` block in `src/assets/styles/global.css` alongside existing node-state tokens
- No new Zustand store — this component is fully props-driven (Story 1.4 wires it to store state)
- No new Tauri commands in this story — `get_icon_cache_path` is defined in Architecture Decision 1 and implemented as part of Epic 2

### Project Context Rules

- **No barrel files**: `src/features/skill-picker/` must not contain `index.ts`; all imports must use direct paths
- **invokeCommand only**: All Tauri IPC must use `invokeCommand<T>()` from `src/shared/utils/invokeCommand.ts`, never raw `invoke()` from `@tauri-apps/api/core`
- **No new top-level Zustand stores**: This component is props-driven; do not create a `useSkillPickerStore`
- **TypeScript strict mode**: `noUnusedLocals` and `noUnusedParameters` are enforced at build time — no dead code
- **Tailwind v4 CSS-first**: Use CSS custom properties from `global.css @theme` block and Tailwind utility classes; no inline style objects except where dynamic values require them (e.g., the placeholder div background)
- **NFR12**: All interactive elements must have `2px solid var(--color-accent-gold)` focus ring; `outline: none` is never used without a replacement (the global `:focus-visible` rule in `global.css` handles this automatically)
- **NFR16**: `prefers-reduced-motion` is handled globally by the `@media` rule in `global.css`; no per-component motion guard needed for CSS transitions in this story
- **NRF17 / UX-DR15**: vitest-axe zero violations required

### References

- UX-DR1: SkillPickerGrid spec — hex clip-path cells, sections, mastery-gate badges, ARIA grid, keyboard nav, ESC to close [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]
- UX-DR15: vitest-axe CI requirement for all Phase 2 React components [Source: `_bmad-output/planning-artifacts/ux-design-specification.md`]
- Architecture Decision 1: Icon pipeline — `get_icon_cache_path` Rust command, Path C placeholder fallback [Source: `_bmad-output/planning-artifacts/architecture.md#Decision-1`]
- `SkillEntry` placement in `gameData.ts` [Source: `src/shared/types/gameData.ts`]
- `invokeCommand` signature [Source: `src/shared/utils/invokeCommand.ts`]
- Global CSS token location and `@theme` block structure [Source: `src/assets/styles/global.css`]
- `useReducedMotion` hook (NFR16) [Source: `src/shared/hooks/useReducedMotion.ts`] — not needed for this story since CSS transitions are gated globally, but available if explicit motion guard is added
- No barrel files rule [Source: `_bmad-output/project-context.md`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- `SkillEntry` added to `shared/types/gameData.ts` with `masteryId: null` discriminating base-class vs mastery skills.
- CSS tokens `--hex-clip-path` and `--color-badge-mastery-gate` added to `global.css @theme` block.
- `SkillPickerGrid` component created with props-driven section grouping, roving tabindex keyboard nav, `Promise.allSettled` batch icon loading, mastery gate badge, and gold border for selected cell.
- axe fix: section wrapper divs use `role="rowgroup"` with `aria-label` for AT; h3 inside each rowgroup is `aria-hidden="true"` (visual-only) to avoid `aria-required-children` violation while preserving visible section headers.
- All 9 tests pass. 6 pre-existing `ProviderSelector`/`Settings` failures confirmed unchanged (not regressions).

### File List

- `lebo/src/shared/types/gameData.ts` (modified — added `SkillEntry` interface)
- `lebo/src/assets/styles/global.css` (modified — added `--hex-clip-path` and `--color-badge-mastery-gate` to `@theme`)
- `lebo/src/features/skill-picker/SkillPickerGrid.tsx` (created)
- `lebo/src/features/skill-picker/SkillPickerGrid.test.tsx` (created)

## Change Log

- 2026-05-07: Story 1.3 implemented — `SkillEntry` type, CSS tokens, `SkillPickerGrid` component with keyboard nav + icon loading, 9 tests (including axe zero-violations). (claude-sonnet-4-6)
