# Story 4.1: Context Panel Shell & Gear Input

Status: done

## Story

As an advanced Last Epoch player,
I want to input my equipped gear items so the AI has full context about my character's item-based stats and affixes,
So that AI optimization suggestions reflect my actual character state — not just skill tree nodes in isolation.

## Acceptance Criteria

1. **Given** the user views the left panel with an active build loaded
   **When** they scroll down past the Save/Builds section
   **Then** a Context Panel section is visible with three labeled collapsible sections: "Gear", "Active Skills", "Idols"
   **And** "Active Skills" and "Idols" sections show a "Coming soon" placeholder (Story 4.2)
   **And** each section's header shows a filled/empty count indicator (e.g., "Gear — 0 / 11 slots filled")

2. **Given** the user expands the "Gear" section
   **When** the panel opens
   **Then** 11 gear slots are shown, each labeled by slot name: Helmet, Body, Gloves, Belt, Boots, Ring 1, Ring 2, Amulet, Relic, Weapon, Off-hand
   **And** each unfilled slot shows a placeholder prompt (e.g., "Add item…")

3. **Given** the user clicks a gear slot
   **When** they interact with the item name field
   **Then** they can type a free-text item name (e.g., "Solarum Helm of the Turtle")
   **And** the name is stored in `activeBuild.contextData.gear` at the matching `slotId`

4. **Given** the user has set an item name on a gear slot
   **When** they add affixes
   **Then** they can add one or more free-text affix strings (e.g., "+15% Void Damage", "+8% Crit Multiplier")
   **And** each affix is stored as a string entry in `GearItem.affixes[]`
   **And** the user can remove individual affixes via a dismiss button

5. **Given** gear inputs are filled and the user clicks "Optimize"
   **When** `invokeCommand('invoke_claude_api', ...)` is called
   **Then** the gear data from the Context Panel is included in the payload as `build.contextData.gear: GearItem[]` (FR18)
   **And** this requires no backend changes — the Rust `invoke_claude_api` command already receives the full `BuildState`

6. **Given** a build with gear context is saved
   **When** the build is reloaded
   **Then** all gear slot data is restored correctly — item names and affixes are preserved
   **And** this requires no persistence changes — `buildPersistence.ts` already serializes the full `BuildState`

7. **Given** no active build is loaded
   **When** the left panel renders
   **Then** the Context Panel section is hidden (same guard as the Save Build button)

## Tasks / Subtasks

- [x] Task 1: Add `updateContextGear` action to `buildStore.ts`
  - [x] Add action `updateContextGear: (gear: GearItem[]) => void` — calls `set((s) => ({ activeBuild: s.activeBuild ? { ...s.activeBuild, contextData: { ...s.activeBuild.contextData, gear } } : null }))`
  - [x] Import `GearItem` from `'../types/build'` in `buildStore.ts`

- [x] Task 2: Create `gearData.ts` — static gear slot definitions
  - [x] Create `lebo/src/features/context-panel/gearData.ts`
  - [x] Export `GEAR_SLOTS: readonly { slotId: string; label: string }[]` — 11 entries (see Dev Notes for list)
  - [x] No affix data required — affixes are free-text entry in this story

- [x] Task 3: Create `ContextPanel.tsx` shell
  - [x] Create `lebo/src/features/context-panel/ContextPanel.tsx`
  - [x] Three collapsible sections using Headless UI `Disclosure` (same pattern as `ClassMasterySelector` uses `Listbox`)
  - [x] Section headers show slot count indicator (Gear only; Active Skills + Idols show "—")
  - [x] "Active Skills" and "Idols" sections render a `<p>Coming soon</p>` placeholder body
  - [x] Only renders when `activeBuild !== null` (guard at call site in `LeftPanel.tsx`)
  - [x] `data-testid="context-panel"` on root div
  - [x] `data-testid="context-section-gear"`, `"context-section-skills"`, `"context-section-idols"` on each section

- [x] Task 4: Create `GearInput.tsx`
  - [x] Create `lebo/src/features/context-panel/GearInput.tsx`
  - [x] Renders all 11 slots from `GEAR_SLOTS`
  - [x] Each slot: item name text input + affix tag list
  - [x] Item name input: plain `<input type="text">` (no Listbox/Combobox — free-text for MVP)
  - [x] Affix entry: text input + "Add" button → appends to affix array; each affix displays with an "×" dismiss button
  - [x] On any change: calls `useBuildStore.getState().updateContextGear(updatedGear)` (use `getState()` pattern for event handlers, not hook)
  - [x] Each slot root: `data-testid={`gear-slot-${slotId}`}`
  - [x] Item name input: `data-testid={`gear-item-name-${slotId}`}`
  - [x] Affix add input: `data-testid={`gear-affix-input-${slotId}`}`
  - [x] Affix add button: `data-testid={`gear-affix-add-${slotId}`}`
  - [x] Each affix tag: `data-testid={`gear-affix-tag-${slotId}-${index}`}`

- [x] Task 5: Wire `ContextPanel` into `LeftPanel.tsx`
  - [x] Import `ContextPanel` from `'../context-panel/ContextPanel'`
  - [x] Render `<ContextPanel />` below `<SavedBuildsList />`, inside the `{activeBuild && ...}` guard — same render condition as the Save Build button check
  - [x] No structural changes to the outer `LeftPanel` layout

- [x] Task 6: Tests
  - [x] `buildStore.test.ts` — 2 new tests for `updateContextGear`
  - [x] `ContextPanel.test.tsx` — 5 new tests: renders 3 sections, root testid, gear count indicator (0/11 and filled), coming-soon placeholders
  - [x] `GearInput.test.tsx` — 5 new tests: renders all 11 slots, item name updates store, affix add updates store, affix dismiss removes entry, slot data preserved on re-render
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — all passing (335 tests)

## Dev Notes

### Gear Slot Definitions

```typescript
// gearData.ts
export const GEAR_SLOTS = [
  { slotId: 'helmet',   label: 'Helmet' },
  { slotId: 'body',     label: 'Body' },
  { slotId: 'gloves',   label: 'Gloves' },
  { slotId: 'belt',     label: 'Belt' },
  { slotId: 'boots',    label: 'Boots' },
  { slotId: 'ring1',    label: 'Ring 1' },
  { slotId: 'ring2',    label: 'Ring 2' },
  { slotId: 'amulet',   label: 'Amulet' },
  { slotId: 'relic',    label: 'Relic' },
  { slotId: 'weapon',   label: 'Weapon' },
  { slotId: 'offhand',  label: 'Off-hand' },
] as const
```

---

### Why Free-Text Affixes (not a searchable dropdown)

The epics spec says "searchable dropdown shows only affixes valid for that item type (sourced from game data)." **This is blocked:** the `GameData` type has no gear/affix data, and no gear data was included in the Story 1.3b pipeline. The deferred-work log (from Story 1.3a code review, 2026-04-18) explicitly flagged: "Idol and gear data schema for Epic 4 needs a dedicated research spike before Story 4.1 begins."

**MVP resolution:** Free-text affix input. The user types affix strings directly (e.g., "+15% Void Damage"). Claude can interpret natural-language affix names just as well as structured data for suggestion quality. A future story can add structured affix search once a gear data schema exists.

**Do NOT:** add a Combobox affix search in this story. That requires a gear data pipeline that doesn't exist.

---

### What's Already Implemented — DO NOT Reinvent

| What | Status | Where |
|------|--------|-------|
| `GearItem`, `ActiveSkill`, `IdolItem` types | ✅ Done | `shared/types/build.ts:1–16` |
| `BuildState.contextData: { gear, skills, idols }` | ✅ Done | `shared/types/build.ts:24–28` |
| `contextData` included in Claude API payload | ✅ Done | `claude-prompt-spec.md` — Rust receives full `BuildState` |
| `contextData` saved/loaded via `buildPersistence.ts` | ✅ Done | `build-manager/buildPersistence.ts:11–28` (migrateBuildState) |
| `@headlessui/react` v2.2.10 | ✅ Installed | `package.json` |
| Headless UI `Listbox` usage pattern | ✅ Done | `ClassMasterySelector.tsx:1,34–67` |
| `updateContextGear` action | ❌ Missing — Task 1 adds this | `buildStore.ts` |
| `ContextPanel.tsx` | ❌ Missing — Task 3 adds this | `src/features/context-panel/` |
| `GearInput.tsx` | ❌ Missing — Task 4 adds this | `src/features/context-panel/` |

---

### `buildStore.ts` — New Action

```typescript
// Add to BuildStore interface
updateContextGear: (gear: GearItem[]) => void

// Add to create() body
updateContextGear: (gear) =>
  set((s) =>
    s.activeBuild
      ? { activeBuild: { ...s.activeBuild, contextData: { ...s.activeBuild.contextData, gear } } }
      : {}
  ),
```

Import: add `GearItem` to the import from `'../types/build'`.

---

### `ContextPanel.tsx` — Structure Sketch

```tsx
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { GearInput } from './GearInput'

export function ContextPanel() {
  const gear = useBuildStore((s) => s.activeBuild?.contextData.gear ?? [])
  const filledGearCount = gear.filter((g) => g.itemName.trim() !== '').length

  return (
    <div data-testid="context-panel" className="flex flex-col gap-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        Context
      </p>

      <Disclosure data-testid="context-section-gear">
        <DisclosureButton className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
          <span>Gear</span>
          <span style={{ color: 'var(--color-text-muted)' }}>{filledGearCount} / 11</span>
        </DisclosureButton>
        <DisclosurePanel>
          <GearInput />
        </DisclosurePanel>
      </Disclosure>

      <Disclosure data-testid="context-section-skills">
        <DisclosureButton className="w-full text-left text-xs px-2 py-1.5 rounded"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
          Active Skills
        </DisclosureButton>
        <DisclosurePanel>
          <p className="text-xs px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>Coming soon</p>
        </DisclosurePanel>
      </Disclosure>

      <Disclosure data-testid="context-section-idols">
        <DisclosureButton className="w-full text-left text-xs px-2 py-1.5 rounded"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
          Idols
        </DisclosureButton>
        <DisclosurePanel>
          <p className="text-xs px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>Coming soon</p>
        </DisclosurePanel>
      </Disclosure>
    </div>
  )
}
```

**Note on Disclosure testids:** Headless UI `Disclosure` renders a `<div>` wrapper. Apply `data-testid` to a wrapper div around the whole `Disclosure` block, not to the `Disclosure` component itself, to ensure reliable test queries.

---

### `GearInput.tsx` — State Pattern

Gear state is kept in the store (not local React state). Each slot interaction reads from `useBuildStore` and writes back via `updateContextGear`. This ensures the data survives component unmounts (when the panel collapses).

```tsx
// Read gear from store
const gear = useBuildStore((s) => s.activeBuild?.contextData.gear ?? [])

// Helper to get a slot's current data (or empty default)
function getSlot(slotId: string): GearItem {
  return gear.find((g) => g.slotId === slotId) ?? { slotId, itemName: '', affixes: [] }
}

// On item name change:
function handleNameChange(slotId: string, itemName: string) {
  const updated = GEAR_SLOTS.map(({ slotId: id }) =>
    id === slotId ? { ...getSlot(id), itemName } : getSlot(id)
  )
  useBuildStore.getState().updateContextGear(updated)
}

// On affix add:
function handleAddAffix(slotId: string, affix: string) {
  const slot = getSlot(slotId)
  const updated = GEAR_SLOTS.map(({ slotId: id }) =>
    id === slotId ? { ...slot, affixes: [...slot.affixes, affix] } : getSlot(id)
  )
  useBuildStore.getState().updateContextGear(updated)
}

// On affix dismiss:
function handleRemoveAffix(slotId: string, index: number) {
  const slot = getSlot(slotId)
  const updated = GEAR_SLOTS.map(({ slotId: id }) =>
    id === slotId ? { ...slot, affixes: slot.affixes.filter((_, i) => i !== index) } : getSlot(id)
  )
  useBuildStore.getState().updateContextGear(updated)
}
```

The affix add input should be controlled local state (cleared after "Add" press). Use `useState<string>('')` per slot — but since all slots render simultaneously, use a `Record<string, string>` keyed by slotId to hold the pending affix input per slot.

---

### `LeftPanel.tsx` — Addition

```tsx
// Add import
import { ContextPanel } from '../context-panel/ContextPanel'

// In JSX, after <SavedBuildsList />, inside the non-collapsed block:
{activeBuild && <ContextPanel />}
```

The `activeBuild` guard is already in scope for the Save Build button — use the same check.

---

### Patterns from Previous Stories

- No barrel `index.ts` files — import directly from file paths
- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ color: 'var(--color-...)' }}` for design tokens
- Test files co-located with source
- Mock Zustand stores in tests: `useBuildStore.setState(overrides, true)` to reset between tests
- Mock `@tauri-apps/api/event` in any file that imports hooks calling `listen`
- `ResizeObserver` polyfill is in `test-setup.ts` — required for Headless UI components
- Run `pnpm tsc --noEmit` before marking complete

---

### No Backend Changes Required

Story 4.1 is frontend-only. The Rust `invoke_claude_api` command already receives the full `BuildState` JSON (including `contextData`), and the Claude prompt spec (`docs/claude-prompt-spec.md`) already documents that `contextData.gear` is part of the payload. The field was empty before this story; now it will be populated.

Verify this in tests by checking that `invokeCommand('invoke_claude_api', ...)` is called with a `buildState` argument where `buildState.contextData.gear` contains the current gear data.

---

### File Locations

**New files:**
- `lebo/src/features/context-panel/gearData.ts`
- `lebo/src/features/context-panel/ContextPanel.tsx`
- `lebo/src/features/context-panel/ContextPanel.test.tsx`
- `lebo/src/features/context-panel/GearInput.tsx`
- `lebo/src/features/context-panel/GearInput.test.tsx`

**Modified files:**
- `lebo/src/shared/stores/buildStore.ts` — add `updateContextGear` action
- `lebo/src/shared/stores/buildStore.test.ts` — 2 new tests
- `lebo/src/features/layout/LeftPanel.tsx` — add `<ContextPanel />` mount

---

### Regression Warnings

- `buildStore` gains `updateContextGear` — all existing buildStore tests still pass (additive change).
- `LeftPanel.tsx` gains a new child — existing `LeftPanel.test.tsx` tests that assert on the collapsed icon rail remain unaffected; the new component only renders in the expanded path when `activeBuild !== null`.
- `Disclosure` from `@headlessui/react` — `ResizeObserver` polyfill already in `test-setup.ts`, no additional mock needed.

---

### Story 4.2 Preview (do NOT implement here)

Story 4.2 wires `SkillInput.tsx` and `IdolInput.tsx` inside the "Active Skills" and "Idols" `DisclosurePanel` bodies, replacing the "Coming soon" placeholders. Do not add any active skill or idol logic in 4.1.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Implemented `updateContextGear` action in `buildStore.ts` — additive change, all prior store tests pass
- Created `gearData.ts` with 11 GEAR_SLOTS as `const` array
- Created `ContextPanel.tsx` with three Headless UI Disclosure sections; Gear shows filled/total count, Active Skills + Idols show "Coming soon" placeholders; testid wrappers placed on outer `<div>` around each Disclosure (not the Disclosure component itself) per Dev Notes guidance
- Created `GearInput.tsx` using store-based state (not local React state) for slot data; local `Record<string,string>` for pending affix inputs per slot; `getState()` pattern used in event handlers
- Wired `<ContextPanel />` in `LeftPanel.tsx` inside existing `{activeBuild && ...}` guard, below `<SavedBuildsList />`
- All 335 tests pass; `pnpm tsc --noEmit` clean
- Disclosure panel "Coming soon" test required clicking section buttons first since panels render hidden by default in Headless UI

### File List

- `lebo/src/features/context-panel/gearData.ts` (new)
- `lebo/src/features/context-panel/ContextPanel.tsx` (new)
- `lebo/src/features/context-panel/ContextPanel.test.tsx` (new)
- `lebo/src/features/context-panel/GearInput.tsx` (new)
- `lebo/src/features/context-panel/GearInput.test.tsx` (new)
- `lebo/src/shared/stores/buildStore.ts` (modified)
- `lebo/src/shared/stores/buildStore.test.ts` (modified)
- `lebo/src/features/layout/LeftPanel.tsx` (modified)

### Change Log

- 2026-04-25: Implemented Story 4.1 — Context Panel shell with gear input. Added `updateContextGear` action, created `ContextPanel` + `GearInput` components, wired into `LeftPanel`.

### Review Findings

- [x] [Review][Patch] Hardcoded `11` denominator — should be `GEAR_SLOTS.length` [ContextPanel.tsx:23]
- [x] [Review][Patch] `key={i}` on affix tags — use composite key to reduce DOM churn on removal [GearInput.tsx:65]
- [x] [Review][Patch] `pendingAffixes` not cleared on build switch — stale draft text persists when user loads a different build [GearInput.tsx:8]
- [x] [Review][Patch] `updatedAt` not refreshed in `updateContextGear` — save timestamp stays stale after gear edits [buildStore.ts:148]
- [x] [Review][Patch] `isPersisted` not reset in `updateContextGear` — Save Build button shows "Saved" after gear edits [buildStore.ts:148]
- [x] [Review][Defer] O(n²) gear.find per keystroke [GearInput.tsx:14] — deferred, micro-opt for 11 items, not perceptible
- [x] [Review][Defer] Stale slot reference concern in handleAddAffix [GearInput.tsx:21] — deferred, theoretical under concurrent React; Zustand is synchronous in practice
- [x] [Review][Defer] Double store subscriptions in ContextPanel + GearInput — deferred, inconsequential overhead for this component size
- [x] [Review][Defer] No Enter key handler on item-name input [GearInput.tsx:49] — deferred, UX improvement beyond spec scope
- [x] [Review][Defer] activeBuild cleared while editing — deferred, component unmounts via LeftPanel guard, no data loss path
- [x] [Review][Defer] Empty string affix add gives no visual feedback — deferred, beyond spec scope
- [x] [Review][Defer] Affix content has no validation (length, special chars) — deferred, free-text is intentional per Dev Notes
- [x] [Review][Defer] Count format diverges from spec example ("Gear — 0 / 11 slots filled") — deferred, `(e.g.,)` qualifier makes it cosmetic
- [x] [Review][Defer] Undo stack excludes contextData.gear changes — deferred, undo is scoped to skill tree nodes per design
- [x] [Review][Defer] `migrateBuildState` casts contextData without field validation [buildPersistence.ts] — deferred, pre-existing issue not introduced by this story
