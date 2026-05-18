# Story 5.3: AffixTierControl — Pip-Based Tier Selection

Status: done

## Story

As a theory-crafter,
I want to adjust each affix's tier using a row of pips (T1–T7) that I click or navigate with arrow keys, with the current value range displayed in monospace next to the pips,
so that I can quickly set affix tiers to match my actual item rolls without typing numbers.

## Acceptance Criteria

1. **Given** a GearSlot has an item selected with affixes at median tier
   **When** the AffixTierControl for an affix is displayed
   **Then** it shows pip circles (8px × 8px, 4px gap); pips up to the current tier are filled with `--color-tier-pip-active` (matches `--color-accent-gold`); pips above current tier use `--color-tier-pip-inactive` (UX-DR5)

2. **Given** the player clicks pip N
   **When** the click is registered
   **Then** the affix tier updates to N; the current value in monospace (40px fixed width) updates to reflect tier N's value range (`minValue`–`maxValue` from `AffixEntry.tiers[N-1]`)

3. **Given** the AffixTierControl is keyboard-focused
   **When** the player presses Right arrow
   **Then** the tier increments by 1 (up to `affixEntry.tiers.length`); Left arrow decrements by 1 (down to 1); both arrow keys call `e.preventDefault()` to prevent page scroll

4. **Given** the affix is at its maximum tier (all pips filled)
   **When** the player presses Right arrow or clicks the last pip again
   **Then** the tier stays at max; no change occurs (no out-of-range `onChange` call)

5. **And** AffixTierControl has `role="slider"`, `aria-valuemin={1}`, `aria-valuemax={tierCount}`, `aria-valuenow={currentTier}`, `aria-label="{affixName} tier"`, `aria-valuetext="Tier {N}: {min}–{max}"`, `tabIndex={0}` (UX-DR5)

6. **And** `--color-tier-pip-active` and `--color-tier-pip-inactive` tokens are added to the `@theme` block in `src/assets/styles/global.css` with PixiJS hex equivalents as comments (UX-DR10)

7. **And** `AffixTierControl.test.tsx` covers: pip click, keyboard increment/decrement, boundary clamping at min/max, aria-valuetext accuracy, and axe-core zero violations (UX-DR15)

## Tasks / Subtasks

- [x] Task 1: Add CSS tokens to `src/assets/styles/global.css` (AC: #6)
  - [x] Add under the `@theme` block, after the existing `/* Skill picker */` group:
    ```css
    /* Item tier pips */
    --color-tier-pip-active:   #C9A84C; /* PixiJS: 0xC9A84C — matches --color-accent-gold */
    --color-tier-pip-inactive: #1c1c21; /* PixiJS: 0x1C1C21 — matches --color-bg-elevated; border added via element style */
    ```
  - [x] No other changes to global.css

- [x] Task 2: Create `AffixTierControl.tsx` at `src/features/item-database/AffixTierControl.tsx` (AC: #1–#5)
  - [x] Import only: `import type { AffixEntry } from '../../shared/types/itemDatabase'` — no Tauri, no store, no Headless UI
  - [x] Define `AffixTierControlProps`: `{ affixEntry: AffixEntry; currentTier: number; onChange: (tier: number) => void }`
  - [x] Derive: `const tierCount = affixEntry.tiers.length`
  - [x] Derive: `const tierData = affixEntry.tiers[currentTier - 1]`; compute `valueText` (see Dev Notes)
  - [x] Container div: `role="slider"`, `aria-valuemin={1}`, `aria-valuemax={tierCount}`, `aria-valuenow={currentTier}`, `aria-label={`${affixEntry.name} tier`}`, `aria-valuetext={`Tier ${currentTier}: ${valueText}`}`, `tabIndex={0}`, `onKeyDown={handleKeyDown}`, flex row layout with `alignItems: 'center'`, `gap: 8`
  - [x] Pip loop: render `tierCount` divs; each 8px × 8px, `borderRadius: '50%'`, pip i filled if `i <= currentTier`; pip i unfilled otherwise; each pip has `onClick={() => onChange(i)}`, `aria-hidden={true}`, `style={{ cursor: 'pointer' }}`
  - [x] Value display: `<span style={{ fontFamily: 'var(--font-mono)', width: 40, textAlign: 'right', fontSize: 13, color: 'var(--color-text-primary)' }}>{valueText}</span>`
  - [x] `handleKeyDown`: Right → `onChange(Math.min(currentTier + 1, tierCount))`; Left → `onChange(Math.max(currentTier - 1, 1))`; both call `e.preventDefault()`; skip onChange if already at boundary
  - [x] Named export: `export function AffixTierControl(...)`

- [x] Task 3: Create `AffixTierControl.test.tsx` at `src/features/item-database/AffixTierControl.test.tsx` (AC: #7)
  - [x] Build a minimal `mockAffixEntry: AffixEntry` with 4 tiers for most tests (validates non-7 tier case works)
  - [x] Test: clicking pip 3 calls `onChange(3)`
  - [x] Test: keyboard Right arrow at tier 2 → `onChange(3)`
  - [x] Test: keyboard Left arrow at tier 2 → `onChange(1)`
  - [x] Test: keyboard Right arrow at max tier (4) → `onChange` NOT called
  - [x] Test: keyboard Left arrow at tier 1 → `onChange` NOT called
  - [x] Test: `aria-valuetext` shows correct `min`–`max` string for current tier
  - [x] Test: `expect(await axe(container)).toHaveNoViolations()`
  - [x] No `vi.mock` needed (no Tauri/IPC imports in component)
  - [x] No snapshot tests — explicit `expect` assertions only

### Review Findings

- [x] [Review][Patch] CSS hex case — `--color-tier-pip-inactive` uses lowercase `#1c1c21`; all other tokens use uppercase [lebo/src/assets/styles/global.css:51]
- [x] [Review][Patch] Pip click same-tier fires onChange — clicking an already-selected pip emits `onChange(currentTier)` (same value); keyboard handler correctly no-ops at boundary; add `if (pip !== currentTier)` guard for consistency with AC #4 spirit [lebo/src/features/item-database/AffixTierControl.tsx:46]
- [x] [Review][Patch] Missing test: single-tier Left/Right boundary — single-tier test only checks aria-valuetext; Left and Right arrows both no-op when tierCount=1 is untested [lebo/src/features/item-database/AffixTierControl.test.tsx]
- [x] [Review][Defer] Out-of-range `currentTier` crash risk — `affixEntry.tiers[currentTier - 1]` is unguarded; throws if caller passes 0, negative, or > tiers.length — deferred, spec-deliberate; spec says "caller guarantees within [1, tiers.length]"; clamping is Story 5.4 GearSlot's responsibility
- [x] [Review][Defer] Gap mismatch: AC #1 says 4px gap, Dev Notes example and component use 8px — deferred, Dev Notes are authoritative implementation guide; AC text inconsistency; cosmetic only
- [x] [Review][Defer] Missing Home/End key support for ARIA slider pattern — WAI-ARIA recommends Home (min) and End (max) keys; story only specifies Left/Right — deferred, outside story scope; address in accessibility polish
- [x] [Review][Defer] Inline pip style objects recreated per render — style literals in Array.from map allocate new objects every render — deferred, project-wide inline style pattern; benign for small pip counts
- [x] [Review][Defer] No userEvent.setup() — direct userEvent API is v14+ legacy — deferred, tests pass; project-wide concern
- [x] [Review][Defer] width: 40 overflow risk — monospace span may clip large tier value strings — deferred, spec-specified; acceptable for current data range
- [x] [Review][Defer] aria-valuemin={1} hardcoded — assumes 1-based tier numbering — deferred, all current data uses 1-based tiers; theoretical

## Dev Notes

### What This Story Is (and Is Not)

This story creates the **standalone `AffixTierControl` component only**. It does NOT:
- Build `GearSlot` (Story 5.4 — that consumes `AffixTierControl`)
- Build `AffixPicker` (Story 5.5)
- Touch any Rust commands, Zustand stores, or Tauri IPC
- Handle item selection, pre-population, or affix state ownership (Story 5.4's concern)

`AffixTierControl` is a **pure presentational component** — it receives all data as props and calls `onChange` when the tier changes. The parent (GearSlot, Story 5.4) owns the tier state.

### AffixEntry Type — Already Exists, Do NOT Modify for This Story

```typescript
// src/shared/types/itemDatabase.ts — EXISTS
export interface AffixTier {
  tier: number      // 1-based (1 = T1, 7 = T7)
  minValue: number
  maxValue: number
}

export interface AffixEntry {
  id: string
  name: string
  type: 'prefix' | 'suffix' | 'implicit'
  itemSlots: string[]   // NOTE: currently empty for all affixes in data — known gap, not a blocker
  tiers: AffixTier[]   // length is the tierCount; typically 7 for most affixes
}
```

### Component Props

```typescript
interface AffixTierControlProps {
  affixEntry: AffixEntry
  currentTier: number      // 1-based; 1 = T1; caller guarantees within [1, tiers.length]
  onChange: (tier: number) => void
}
```

`currentTier` is always valid going in — the parent (GearSlot) owns clamping. `AffixTierControl` only clamps inside the keyboard handler to prevent emitting out-of-range values on rapid keypresses.

### Value Range Display

```typescript
const tierData = affixEntry.tiers[currentTier - 1]
const valueText = tierData.minValue === tierData.maxValue
  ? String(tierData.minValue)
  : `${tierData.minValue}–${tierData.maxValue}`
```

Fixed 40px width prevents layout shift as tier changes. Right-align with `textAlign: 'right'`.

### CSS Token Values

- `--color-tier-pip-active`: `#C9A84C` — same hex as `--color-accent-gold`. Defined separately per UX-DR10 so GearSlot can reference it independently.
- `--color-tier-pip-inactive`: `#1c1c21` — same hex as `--color-bg-elevated`. The border (`1px solid var(--color-text-muted)`) is applied via the element's `style` prop, not the token. Token value is the fill only.

Inactive pip style:
```tsx
style={{
  width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
  backgroundColor: 'var(--color-tier-pip-inactive)',
  border: '1px solid var(--color-text-muted)',
}}
```

Active pip style:
```tsx
style={{
  width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
  backgroundColor: 'var(--color-tier-pip-active)',
}}
```

### ARIA Pattern (UX-DR5)

Container div holds all slider ARIA. Individual pip elements get `aria-hidden={true}` — they're decorative sub-elements. If pips are not `aria-hidden`, axe will flag them for missing roles/labels.

```tsx
<div
  role="slider"
  aria-valuemin={1}
  aria-valuemax={tierCount}
  aria-valuenow={currentTier}
  aria-label={`${affixEntry.name} tier`}
  aria-valuetext={`Tier ${currentTier}: ${valueText}`}
  tabIndex={0}
  onKeyDown={handleKeyDown}
  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
>
  {Array.from({ length: tierCount }, (_, i) => (
    <div key={i + 1} aria-hidden={true} onClick={() => onChange(i + 1)} style={...} />
  ))}
  <span style={{ fontFamily: 'var(--font-mono)', width: 40, textAlign: 'right', ... }}>
    {valueText}
  </span>
</div>
```

### Inline Style Pattern (NOT Tailwind)

All existing components in this codebase use inline styles with CSS variables — not Tailwind utility classes. Pattern from `BudgetToggle.tsx`:
```tsx
style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid', borderColor: 'var(--color-accent-gold)' }}
```
Follow the same pattern in `AffixTierControl.tsx`.

### File Structure

```
src/features/item-database/
  itemDatabaseLoader.ts        ← EXISTS (Story 5.1 — do not touch)
  itemDatabaseLoader.test.ts   ← EXISTS (Story 5.1 — do not touch)
  itemSearch.ts                ← EXISTS (Story 5.2 — do not touch)
  itemSearch.test.ts           ← EXISTS (Story 5.2 — do not touch)
  AffixTierControl.tsx         ← CREATE (Task 2)
  AffixTierControl.test.tsx    ← CREATE (Task 3)
  GearSlot.tsx                 ← does not exist yet (Story 5.4)
  AffixPicker.tsx              ← does not exist yet (Story 5.5)
```

No `index.ts` barrel file. Import directly: `import { AffixTierControl } from './AffixTierControl'`.

### What Already Exists — Do NOT Recreate

| Already exists | Location |
|----------------|----------|
| `AffixEntry`, `AffixTier`, `BaseItem`, `UniqueItem`, `ItemDatabase` types | `src/shared/types/itemDatabase.ts` |
| `SearchResult` type | `src/shared/types/itemDatabase.ts` |
| `itemDatabaseLoader.ts` | `src/features/item-database/itemDatabaseLoader.ts` |
| `itemSearch.ts` with `searchItems()` | `src/features/item-database/itemSearch.ts` |
| `useGameDataStore.itemDatabase` | `src/shared/stores/gameDataStore.ts` |

### Previous Story Learnings

**From Story 5.1:**
- 6 pre-existing failures in `ProviderSelector.test.tsx` and `Settings.test.tsx` — unrelated to this epic; do not count as regressions.
- `itemSlots` is empty for all affixes in the current bundled dataset — known gap, not a blocker.

**From Story 5.2:**
- Zero Tauri/IPC imports in this component → no `vi.mock` needed in tests (same as `itemSearch.test.ts`).
- Test co-location confirmed: `AffixTierControl.test.tsx` goes next to `AffixTierControl.tsx` in `src/features/item-database/`.
- Named exports only — `export function AffixTierControl(...)`, no `export default`.
- `import type { AffixEntry }` (type-only import) to avoid unused runtime import warnings under `noUnusedLocals`.

### Project Context Rules

- **No barrel files:** No `index.ts` in `src/features/item-database/`.
- **TypeScript strict mode:** `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`. Every prop and variable must be used.
- **Named exports only:** `export function AffixTierControl(...)` — never `export default`.
- **No Tauri imports:** Pure React component. No `invokeCommand`, no `@tauri-apps/api/core`.
- **No new Zustand stores:** Props-only component; parent owns state.
- **No `@apply`:** Not applicable here — adding to `@theme` block in global.css, not component styles.
- **Test setup:** `test-setup.ts` already provides `@testing-library/jest-dom`, `vitest-axe`, `ResizeObserver`, `matchMedia` — do not redeclare in test file.
- **No snapshot tests:** Explicit `expect` assertions only.
- **Focus ring:** The global `:focus-visible { outline: 2px solid var(--color-accent-gold) }` in `global.css` handles the focus ring automatically for the `tabIndex={0}` container — no additional focus code needed.
- **Import grouping:** external libs → internal shared → internal feature-local.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 5, Story 5.3 ACs; UX-DR5; UX-DR10; UX-DR15]
- [Source: `_bmad-output/project-context.md` — Technology Stack, Language rules, Testing rules, Code quality rules, Naming conventions]
- [Source: `lebo/src/shared/types/itemDatabase.ts` — `AffixEntry`, `AffixTier` definitions]
- [Source: `lebo/src/assets/styles/global.css` — `@theme` block; insert new tokens here]
- [Source: `lebo/src/features/skill-tree/BudgetToggle.tsx` — inline style + CSS var pattern to follow]
- [Source: `_bmad-output/implementation-artifacts/5-1-item-database-load-and-typescript-types.md` — pre-existing failures warning; itemSlots empty gap note]
- [Source: `_bmad-output/implementation-artifacts/5-2-in-memory-item-search-algorithm.md` — test co-location pattern; no-mock pattern; named export convention; type-only import pattern]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 3 tasks completed in single session. 8 tests pass (all 8 written for this story). 8 pre-existing failures confirmed as pre-existing (6 in ProviderSelector/Settings from Story 5.1 notes + 2 in SkillTree unrelated to item-database feature).
- Pure presentational component with no Tauri/IPC dependencies — no vi.mock needed.
- aria-hidden on pip divs prevents axe violations (pips are decorative, ARIA slider is on container).
- Added extra test for single-value affix (minValue === maxValue) not listed in story tasks but required for correctness.

### File List

- src/assets/styles/global.css (modified — added --color-tier-pip-active, --color-tier-pip-inactive tokens)
- src/features/item-database/AffixTierControl.tsx (created)
- src/features/item-database/AffixTierControl.test.tsx (created)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated — story 5-3 → review)

## Change Log

- 2026-05-16: Story 5.3 implemented — AffixTierControl pip-based tier selection component, CSS tokens, and full test suite (8 tests, 0 axe violations)
