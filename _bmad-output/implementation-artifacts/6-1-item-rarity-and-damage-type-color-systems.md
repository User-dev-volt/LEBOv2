---
title: 'Item Rarity & Damage-Type Color Systems'
story_id: '6.1'
story_key: '6-1-item-rarity-and-damage-type-color-systems'
epic: 6
status: ready-for-dev
created: '2026-05-26'
---

## Story

**As a player,**
I want all item names, tooltips, and affix headers to use Last Epoch's canonical rarity colors, and all damage/resistance values in the stat sheet to use LE's canonical damage-type colors,
**so that** the app's visual language feels continuous with the game itself.

---

## Context

This is Story 6.1 — the first story in Epic 6 (Visual Fidelity & UX Polish). All Epics 1–5 are done. The codebase is stable and fully tested.

**Current state of the files this story modifies:**
- `global.css` — has background, gold accent, text, node-state, and slider tokens. **No rarity or damage-type color tokens exist yet.**
- `GearSlot.tsx` — item names render in `var(--color-text-primary)` for ALL items (base and unique). Unique item affixes have editable `AffixTierControl` — the game doesn't allow editing unique stats, so these must become read-only.
- `StatSheetPanel.tsx` — resistance rows in `RESISTANCES` array use plain text colors. No damage-type color applied to labels or values.
- `itemDatabase.ts` — `SearchResult.type` is `'base' | 'unique'`. No rarity field on `SearchResult`. `DamageType` union is already defined (`'fire' | 'cold' | 'lightning' | 'void' | 'poison' | 'physical' | 'bleed'`).

**What this story adds:**
1. 14 new CSS design tokens in `global.css` (7 rarity + 7 damage-type)
2. `src/shared/utils/rarityColors.ts` — lookup maps for rarity colors and damage-type colors
3. `GearSlot.tsx` — rarity color on item name based on `SearchResult.type`; unique affixes rendered read-only (no `AffixTierControl`, no "Add affix" button)
4. `StatSheetPanel.tsx` — each resistance row's label and value colored with its damage-type CSS token
5. Tests: utility unit tests + GearSlot unique-read-only test + StatSheetPanel damage-type color test

**What this story does NOT do:**
- Add Set items to `SearchResult` / item search (requires extending `itemSearch.ts` and `SearchResult.type` — deferred to a future story)
- Add rarity coloring to node tooltips (`NodeTooltip.tsx` shows passive tree node data, not item names — no change needed)
- Change any Rust code (pure frontend story)
- Add Magic, Rare, Exalted, or Legendary coloring to search results (base items in `SearchResult` have no rarity field — they display as Common for now; full rarity detection deferred)

---

## Acceptance Criteria

**AC1 — Rarity colors defined and applied to item names:**
**Given** an item name displayed in the GearSlot panel
**When** the item's `SearchResult.type` is `'unique'`
**Then** the item name text renders in `#E87722` (Unique orange)

**Given** a base item selected in the GearSlot
**When** the item's `SearchResult.type` is `'base'`
**Then** the item name text renders in `#E8E8E8` (Common light gray)

**Given** the 7 LE rarity color tokens
**When** an agent reviews `global.css`
**Then** all 7 CSS custom properties are defined: `--color-rarity-common`, `--color-rarity-magic`, `--color-rarity-rare`, `--color-rarity-unique`, `--color-rarity-set`, `--color-rarity-exalted`, `--color-rarity-legendary`

**AC2 — Unique affix entries read-only:**
**Given** a Unique item selected in a GearSlot
**When** the gear panel renders
**Then** affix names appear as text rows (no `AffixTierControl` slider for resolved unique affixes)
**And** the "Add affix" button is NOT shown (unique items have fixed stats — custom affixes cannot be added)

**AC3 — Damage-type colors in stat sheet resistance rows:**
**Given** the Defense tab in `StatSheetPanel` showing Fire resistance
**When** the tab renders
**Then** the "Fire Res" label uses `var(--color-dmg-fire)` (#E85D2A)
**And** each resistance row's label uses its canonical damage-type color: Cold (#5BC8E8), Lightning (#F0D020), Void (#A050D0), Poison (#50B840), Physical (#D0D0D0)

**Given** the 7 LE damage-type color tokens
**When** an agent reviews `global.css`
**Then** all 7 CSS custom properties are defined: `--color-dmg-physical`, `--color-dmg-fire`, `--color-dmg-cold`, `--color-dmg-lightning`, `--color-dmg-void`, `--color-dmg-poison`, `--color-dmg-bleed`

**AC4 — Accessibility — color is not the only differentiator:**
**Given** any panel using the rarity or damage-type color system
**When** `axe(container)` runs
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** item rarity is also indicated by the item type label ("Body Armour", "Ring", etc.) — text label, not just color
**And** damage type is also indicated by the text label ("Fire Res", "Cold Res", etc.) — text label, not just color

---

## Tasks / Subtasks

- [ ] **Task 1:** Add CSS design tokens to `global.css` (AC1, AC3)
  - Add 7 rarity CSS tokens and 7 damage-type CSS tokens under `@theme` in `src/assets/styles/global.css`

- [ ] **Task 2:** Create `src/shared/utils/rarityColors.ts` (AC1, AC3)
  - Export `RARITY_COLORS` record mapping `'common' | 'magic' | 'rare' | 'unique' | 'set' | 'exalted' | 'legendary'` → hex string
  - Export `getRarityColorForItemType(type: 'base' | 'unique'): string` — maps `'unique'` → Unique orange, `'base'` → Common light gray
  - Export `DAMAGE_TYPE_COLORS` record mapping `DamageType` → CSS var name string
  - Export `getDamageTypeColor(type: string): string` — returns CSS var string (e.g. `'var(--color-dmg-fire)'`)
  - Create `rarityColors.test.ts` co-located in `src/shared/utils/`

- [ ] **Task 3:** Update `GearSlot.tsx` — rarity color + unique read-only (AC1, AC2)
  - Item name span: apply `getRarityColorForItemType(selectedItem.type)` as inline `style={{ color }}`
  - When `selectedItem.type === 'unique'`: render `resolvedAffixes` as plain text rows (name only, no `AffixTierControl`)
  - When `selectedItem.type === 'unique'`: hide the "Add affix" button (no `affixPickerOpen` path)
  - `customResolvedAffixes` and `customAffixIds` state still exists — just not surfaced for unique items
  - `pnpm build` passes (no unused vars — verify `customResolvedAffixes` reference is cleaned up)

- [ ] **Task 4:** Update `StatSheetPanel.tsx` — damage-type colors on resistance labels (AC3)
  - Add `damageTypeColor` field to the `RESISTANCES` array entries
  - Update `StatRow` in the Defense tab resistance render loop: pass `labelColor={r.damageTypeColor}` to `StatRow`
  - Update `StatRow` interface and rendering to accept optional `labelColor?: string` that overrides the default `var(--color-text-secondary)` on the label span
  - Resistance *values* stay `var(--color-text-primary)` (or warning red) — only the *label* gets the damage-type color

- [ ] **Task 5:** Update tests (AC2, AC4)
  - `GearSlot.test.tsx`: update the existing "unique item affixes resolve and show AffixTierControl rows" test — it must now assert that **no slider** is present for unique items (read-only assertion replaces the old AffixTierControl assertion)
  - `GearSlot.test.tsx`: add test "unique item hides Add affix button"
  - `StatSheetPanel.test.tsx`: add test "defense resistance labels have damage-type color" (check `data-testid` or element color style on Fire Res label)
  - All existing tests must remain green

---

## Technical Requirements

### 1. CSS Tokens — `src/assets/styles/global.css`

Add these two blocks inside `@theme {}`, after the existing `--color-node-suggested` line:

```css
/* Item rarity colors (Last Epoch canonical) */
--color-rarity-common:    #E8E8E8;
--color-rarity-magic:     #5B9BD5;
--color-rarity-rare:      #D4AF37;
--color-rarity-unique:    #E87722;
--color-rarity-set:       #4CAF50;
--color-rarity-exalted:   #9C27B0;
--color-rarity-legendary: #C62828;

/* Damage-type colors (Last Epoch canonical) */
--color-dmg-physical:  #D0D0D0;
--color-dmg-fire:      #E85D2A;
--color-dmg-cold:      #5BC8E8;
--color-dmg-lightning: #F0D020;
--color-dmg-void:      #A050D0;
--color-dmg-poison:    #50B840;
--color-dmg-bleed:     #A03030;
```

**Insertion point:** after line 43 (`--color-node-suggested: #7B68EE;`), before the skill picker section.

### 2. `src/shared/utils/rarityColors.ts` — NEW FILE

```typescript
import type { DamageType } from '../types/itemDatabase'

export const RARITY_COLORS: Record<string, string> = {
  common:    '#E8E8E8',
  magic:     '#5B9BD5',
  rare:      '#D4AF37',
  unique:    '#E87722',
  set:       '#4CAF50',
  exalted:   '#9C27B0',
  legendary: '#C62828',
}

export function getRarityColorForItemType(type: 'base' | 'unique'): string {
  return type === 'unique' ? RARITY_COLORS.unique : RARITY_COLORS.common
}

export const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  physical: 'var(--color-dmg-physical)',
  fire:     'var(--color-dmg-fire)',
  cold:     'var(--color-dmg-cold)',
  lightning:'var(--color-dmg-lightning)',
  void:     'var(--color-dmg-void)',
  poison:   'var(--color-dmg-poison)',
  bleed:    'var(--color-dmg-bleed)',
}

export function getDamageTypeColor(type: DamageType): string {
  return DAMAGE_TYPE_COLORS[type]
}
```

**No barrel file** — import directly: `import { getRarityColorForItemType } from '../../shared/utils/rarityColors'`

### 3. `GearSlot.tsx` changes

**Import addition:**
```typescript
import { getRarityColorForItemType } from '../../shared/utils/rarityColors'
```

**Item name span** (currently line ~312, `style={{ color: 'var(--color-text-primary)' }}`):
```tsx
<span
  className="text-[14px] font-semibold truncate"
  style={{ color: getRarityColorForItemType(selectedItem.type) }}
>
  {selectedItem.name}
</span>
```

**Unique-item affixes — read-only rendering:**

Replace the `{resolvedAffixes.map(...)}` block with a conditional:

```tsx
{selectedItem.type === 'unique' ? (
  /* Unique item: affixes are fixed — display read-only, no tier controls */
  resolvedAffixes.map((r) => (
    <div key={r.affixId} className="flex items-center px-1 py-0.5">
      <span
        className="text-[13px] truncate"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {r.name}
      </span>
    </div>
  ))
) : (
  /* Base item: affixes are editable */
  resolvedAffixes.map((r) => (
    <div key={r.affixId} className="flex items-center gap-2 px-1">
      <span
        className="flex-1 text-[13px] truncate"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {r.name}
      </span>
      <AffixTierControl
        affixEntry={r.affixEntry}
        currentTier={affixTiers[r.affixId] ?? medianTier(r.affixEntry)}
        onChange={(tier) => handleTierChange(r.affixId, tier)}
      />
    </div>
  ))
)}
```

**"Add affix" button and `customResolvedAffixes`** — hide when `selectedItem.type === 'unique'`:

```tsx
{selectedItem.type !== 'unique' && (
  <>
    {customResolvedAffixes.map((r) => (
      <div key={r.affixId} className="flex items-center gap-2 px-1">
        <span
          className="flex-1 text-[13px] truncate"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {r.name}
        </span>
        <AffixTierControl
          affixEntry={r.affixEntry}
          currentTier={affixTiers[r.affixId] ?? medianTier(r.affixEntry)}
          onChange={(tier) => handleTierChange(r.affixId, tier)}
        />
      </div>
    ))}
    <button
      onClick={() => setAffixPickerOpen(true)}
      aria-label={`Add custom affix to ${slotName}`}
      className="text-[11px] self-start mt-1"
      style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      + Add affix
    </button>
    {affixPickerOpen && itemDatabase && (
      <div className="relative mt-1">
        <AffixPicker
          allAffixes={itemDatabase.affixes}
          excludeIds={[
            ...resolvedAffixes.map((r) => r.affixId),
            ...customAffixIds,
          ]}
          onSelect={handleAddCustomAffix}
          onClose={() => setAffixPickerOpen(false)}
        />
      </div>
    )}
  </>
)}
```

**TypeScript strict check:** `customResolvedAffixes` is still computed via `useMemo` — it computes but is never rendered for unique items. Verify `pnpm build` passes with `noUnusedLocals: true`. If TypeScript flags it as unused, use it in a no-op or restructure the memo. Alternatively, gate the memo: `const customResolvedAffixes = useMemo(..., [customAffixIds, itemDatabase, selectedItem])` — this memo is fine to keep as it only executes when `selectedItem !== null` and `customAffixIds.length > 0`.

### 4. `StatSheetPanel.tsx` changes

**Add `damageTypeColor` to `RESISTANCES`:**

```typescript
const RESISTANCES: Array<{ field: ResistanceFieldKey; warnType: string; label: string; damageTypeColor: string }> = [
  { field: 'fire_resistance',      warnType: 'fire_resistance_uncapped',      label: 'Fire Res',       damageTypeColor: 'var(--color-dmg-fire)'      },
  { field: 'cold_resistance',      warnType: 'cold_resistance_uncapped',      label: 'Cold Res',       damageTypeColor: 'var(--color-dmg-cold)'      },
  { field: 'lightning_resistance', warnType: 'lightning_resistance_uncapped', label: 'Lightning Res',  damageTypeColor: 'var(--color-dmg-lightning)'  },
  { field: 'void_resistance',      warnType: 'void_resistance_uncapped',      label: 'Void Res',       damageTypeColor: 'var(--color-dmg-void)'      },
  { field: 'poison_resistance',    warnType: 'poison_resistance_uncapped',    label: 'Poison Res',     damageTypeColor: 'var(--color-dmg-poison)'    },
  { field: 'physical_resistance',  warnType: 'physical_resistance_uncapped',  label: 'Physical Res',   damageTypeColor: 'var(--color-dmg-physical)'  },
]
```

**Update `StatRow` interface** to accept optional `labelColor`:

```typescript
interface StatRowProps {
  label: string
  value: string
  unit?: string
  warningGap?: number
  delta?: number
  labelColor?: string  // NEW — for damage-type colored labels
}
```

**Update `StatRow` label span** to use `labelColor` when provided:

```tsx
function StatRow({ label, value, unit = '', warningGap, delta, labelColor }: StatRowProps) {
  const isWarning = warningGap !== undefined
  return (
    <div className="flex justify-between items-baseline py-0.5 min-w-0">
      <span
        className="text-xs shrink-0 mr-2"
        style={{ color: labelColor ?? 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      {/* value span unchanged */}
      ...
    </div>
  )
}
```

**Update the resistance render loop** in the Defense tab:

```tsx
{RESISTANCES.map(({ field, warnType, label, damageTypeColor }) => {
  const warn = statSheet ? findWarning(statSheet.warnings, warnType) : undefined
  return (
    <StatRow
      key={field}
      label={label}
      value={statSheet ? fmt(statSheet.defense[field]) : '—'}
      unit="%"
      warningGap={warn?.gap}
      delta={deltas?.[field as keyof StatDeltas] as number | undefined}
      labelColor={damageTypeColor}
    />
  )
})}
```

### 5. Test updates

#### `src/shared/utils/rarityColors.test.ts` — NEW FILE

```typescript
import { describe, it, expect } from 'vitest'
import {
  RARITY_COLORS,
  getRarityColorForItemType,
  DAMAGE_TYPE_COLORS,
  getDamageTypeColor,
} from './rarityColors'

describe('RARITY_COLORS', () => {
  it('defines all 7 rarity entries', () => {
    expect(Object.keys(RARITY_COLORS)).toHaveLength(7)
  })

  it('common color is #E8E8E8', () => {
    expect(RARITY_COLORS.common).toBe('#E8E8E8')
  })

  it('unique color is #E87722', () => {
    expect(RARITY_COLORS.unique).toBe('#E87722')
  })
})

describe('getRarityColorForItemType', () => {
  it('returns unique color for type "unique"', () => {
    expect(getRarityColorForItemType('unique')).toBe('#E87722')
  })

  it('returns common color for type "base"', () => {
    expect(getRarityColorForItemType('base')).toBe('#E8E8E8')
  })
})

describe('DAMAGE_TYPE_COLORS', () => {
  it('defines all 7 damage types', () => {
    expect(Object.keys(DAMAGE_TYPE_COLORS)).toHaveLength(7)
  })

  it('fire maps to var(--color-dmg-fire)', () => {
    expect(DAMAGE_TYPE_COLORS.fire).toBe('var(--color-dmg-fire)')
  })

  it('void maps to var(--color-dmg-void)', () => {
    expect(DAMAGE_TYPE_COLORS.void).toBe('var(--color-dmg-void)')
  })
})

describe('getDamageTypeColor', () => {
  it('returns the correct CSS var for fire', () => {
    expect(getDamageTypeColor('fire')).toBe('var(--color-dmg-fire)')
  })

  it('returns the correct CSS var for physical', () => {
    expect(getDamageTypeColor('physical')).toBe('var(--color-dmg-physical)')
  })
})
```

#### `GearSlot.test.tsx` — UPDATE EXISTING TEST

The existing test "unique item affixes resolve and show AffixTierControl rows" (line 239) now expects the **opposite** — no slider for unique items. Update it:

```typescript
it('unique item affixes are read-only — no tier slider rendered', async () => {
  render(
    <GearSlot slotId="body" slotName="Body" itemDatabase={mockItemDatabase} />
  )
  const input = screen.getByPlaceholderText('Search items…')
  await userEvent.type(input, 'Solar')

  await waitFor(() => expect(screen.getByText('Solarum Plate')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Solarum Plate'))

  await waitFor(() => {
    // Affix name shown as text
    expect(screen.getByText('Increased Health')).toBeInTheDocument()
    // No slider — unique affixes are read-only
    expect(screen.queryByRole('slider', { name: 'Increased Health tier' })).toBeNull()
  })
})
```

**Add new test** after the updated one:

```typescript
it('unique item hides the "Add affix" button', async () => {
  render(
    <GearSlot slotId="body" slotName="Body" itemDatabase={mockItemDatabase} />
  )
  const input = screen.getByPlaceholderText('Search items…')
  await userEvent.type(input, 'Solar')

  await waitFor(() => expect(screen.getByText('Solarum Plate')).toBeInTheDocument())
  await userEvent.click(screen.getByText('Solarum Plate'))

  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Add custom affix to Body' })).toBeNull()
  })
})
```

#### `StatSheetPanel.test.tsx` — ADD NEW TEST

```typescript
it('fire resistance label uses fire damage-type color', () => {
  setupMocks({ statSheet: makeStatSheet() })
  render(<StatSheetPanel />)
  fireEvent.click(screen.getByRole('tab', { name: 'Defense' }))

  const fireLabel = screen.getByText('Fire Res')
  expect(fireLabel).toHaveStyle({ color: 'var(--color-dmg-fire)' })
})
```

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/assets/styles/global.css` | MODIFY | Add 14 CSS tokens (7 rarity + 7 damage-type) |
| `lebo/src/shared/utils/rarityColors.ts` | CREATE | Color lookup utilities |
| `lebo/src/shared/utils/rarityColors.test.ts` | CREATE | Unit tests for utilities |
| `lebo/src/features/item-database/GearSlot.tsx` | MODIFY | Rarity color on item name; unique affixes read-only |
| `lebo/src/features/item-database/GearSlot.test.tsx` | MODIFY | Update unique-affix test; add "no Add affix" test |
| `lebo/src/features/stat-sheet/StatSheetPanel.tsx` | MODIFY | Add `damageTypeColor` to `RESISTANCES`; update `StatRow` |
| `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` | MODIFY | Add fire-label-color test |

**Do NOT touch:**
- `NodeTooltip.tsx` — passive tree node tooltips, not item tooltips
- `itemDatabase.ts` — `SearchResult.type` and `DamageType` are correct as-is; no schema changes
- `itemSearch.ts` — set item search is deferred
- Any Rust file — pure TypeScript/CSS story

---

## Architecture & Pattern Compliance

**No barrel files:** Import `rarityColors.ts` directly. No `index.ts`.

**CSS-first (Tailwind v4):** Color tokens are CSS variables, not hardcoded hex in components. Components reference `var(--color-*)` via inline `style` props (consistent with all other components in this codebase). Exception: `rarityColors.ts` uses hex strings because it returns runtime values used in inline styles — the hex must match the CSS token values exactly.

**No `@apply`:** Tailwind v4 — all custom token usage is via inline `style` props. Never `@apply`.

**Inline `style` for color tokens:** The project consistently uses `style={{ color: 'var(--color-*)' }}` for design tokens. Follow this pattern for damage-type and rarity colors.

**Props-only components:** `StatRow` already accepts props; adding `labelColor` continues this pattern. No store access inside `StatRow`.

**Unique item behavior:** LE game rule — unique items have fixed, pre-determined affixes. Players cannot modify them. `AffixTierControl` (and "Add affix") must be completely absent for unique items. The store write (`writeToStore`) still fires on select with the resolved unique affixes at their median tier, enabling the scoring engine to include unique item stats.

**`noUnusedLocals`:** `customResolvedAffixes` and `customAffixIds` are still used by the state machine (they reset on `handleClear` and `handleSelect`). They're just not rendered for unique items. TypeScript won't flag them as unused because they're read in `useMemo` dependencies and in `handleAddCustomAffix`. No change needed to state management.

---

## Previous Story Intelligence (from 5.5)

- **Props-only leaf component rule:** Verified — `StatRow` and `GearSlot` already follow this. `rarityColors.ts` is a utility, not a component, so this rule doesn't apply.
- **Pre-existing test failures:** `SkillTreeCanvas`, `TreeControls`, `ProviderSelector`, `Settings` tests have pre-existing failures as of Story 5.5. Do not diagnose or fix them — run only the relevant test files for this story.
- **`pnpm build` is the TypeScript truth:** Always run `pnpm build` from `lebo/` to verify zero TypeScript errors. The test suite doesn't catch type errors.
- **`AffixTierControl` is a slider-based component** (it renders `role="slider"`). The existing test checks for slider presence; the updated test checks for slider absence.
- **Tailwind v4 `className` for layout, `style` for tokens:** All components use this pattern. Rarity/damage-type colors follow the same pattern — applied as inline `style={{ color: ... }}` props.

---

## Verification Commands

```bash
# From lebo/:
pnpm build                                                          # Zero TS errors
pnpm vitest src/shared/utils/rarityColors.test.ts                  # New utility tests
pnpm vitest src/features/item-database/GearSlot.test.tsx           # Updated GearSlot tests
pnpm vitest src/features/stat-sheet/StatSheetPanel.test.tsx        # Updated StatSheetPanel tests
pnpm vitest                                                         # Full suite — all story-relevant tests green
```

---

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent_

### Debug Log References

_To be filled by dev agent_

### Completion Notes List

_To be filled by dev agent_

### Review Findings

_To be filled after code review_

### File List

_To be filled by dev agent_
