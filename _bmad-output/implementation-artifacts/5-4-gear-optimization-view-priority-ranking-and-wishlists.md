---
title: 'Gear Optimization View — Priority Ranking & Wishlists'
story_id: '5.4'
story_key: '5-4-gear-optimization-view-priority-ranking-and-wishlists'
epic: 5
status: ready-for-dev
created: '2026-05-26'
---

## Story

**As a player,**
I want the Gear Optimization screen to show all 12 gear slots ranked by upgrade priority with a per-slot affix wishlist including tier targets, mechanical reasons, and satisfied-affix checkmarks, weighted by my slider position,
**so that** I know exactly what to craft or trade for, in order of impact.

---

## Context

This is Story 5.4 — the display layer for Epic 5's gear analysis pipeline. Stories 5.1–5.3 built the full Rust scoring engine and TypeScript wiring. **This story is pure React UI — no Tauri commands, no Rust changes.** It reads from `optimizationStore.gearAnalysis` which Story 5.3 populates via the `gear:analysis-complete` event.

**What exists today (after Stories 5.1–5.3):**

- `optimizationStore.gearAnalysis: GearAnalysis | null` — already populated when `gear:analysis-complete` fires
- `optimizationStore.isAnalyzingGear: boolean` — loading state already wired
- `GearOptimizationView.tsx` — already has: header, back button, `SkillRoleDesignator`, "Analyze Gear" button with loading state, error display
- `useGearStream()` already mounted in `GearOptimizationView` — no duplicate needed
- `GearAnalysis`, `GearSlotRanking`, `WishlistAffix` types in `shared/types/statSheet.ts`
- `GEAR_SLOTS` in `features/context-panel/gearData.ts` — 11 slots with `{ slotId, label }` pairs

**Degraded mode (current state):** `game_data.gear_affixes` is empty in the Rust backend, so all slots currently return `upgrade_score: 0.0`, `efficiency_percent: 100.0`, and empty `ideal_prefix`/`ideal_suffix` arrays. The UI must handle this gracefully — "100% of ideal" is a valid display state, not an error.

**What this story adds:**

1. `GearSlotRankingList.tsx` — new component in `features/gear-optimization/` that renders the ranked slot list and per-slot wishlists
2. `GearSlotRankingList.test.tsx` — unit tests for the new component
3. `GearOptimizationView.tsx` — integrate `GearSlotRankingList` below the Analyze button when `gearAnalysis` is non-null

**What this story does NOT do:**
- Add Claude gear narrative — that's Story 5.5
- Modify any Rust code
- Add new Tauri commands
- Change the event system (Pattern 6 is Story 5.3's responsibility, not ours)

---

## Acceptance Criteria

**AC1 — Slot ranking list appears after analysis completes:**
**Given** the Gear Optimization screen after "Analyze Gear" completes
**When** `optimizationStore.gearAnalysis` becomes non-null
**Then** a ranked list of gear slots is displayed below the Analyze button
**And** slots appear in descending `upgrade_score` order (highest UpgradeScore at top)
**And** each slot row shows the slot's display name and "XX% of ideal" efficiency value

**AC2 — Priority Upgrade badge on the highest-gap slot:**
**Given** `gearAnalysis.priority_slot` is a non-empty string
**When** the slot ranking list renders
**Then** the matching slot is visually marked "Priority Upgrade" (distinct badge or color, visible at a glance)
**And** if `priority_slot` is an empty string (degraded mode — all scores 0.0), no Priority badge is shown on any slot

**AC3 — Per-slot wishlist: prefix and suffix recommendations:**
**Given** a gear slot's wishlist section
**When** the player views it
**Then** up to 2 prefix recommendations and up to 2 suffix recommendations are shown
**And** each recommendation displays: affix display name, target tier label (e.g., "T5"), and the `mechanical_reason` string
**And** prefix and suffix sections are visually distinct (labeled "Prefixes" and "Suffixes")

**AC4 — Satisfied affixes shown with checkmark:**
**Given** a `WishlistAffix` where `satisfied: true`
**When** that wishlist row renders
**Then** the row shows a checkmark indicator (✓ or checkmark icon)
**And** the row has a visually distinct "satisfied" appearance (e.g., muted/dimmed color, not highlighted)

**AC5 — Missing/below-tier affixes highlighted:**
**Given** a `WishlistAffix` where `satisfied: false`
**When** that wishlist row renders
**Then** the row is visually highlighted as missing (distinct from satisfied rows)
**And** the affix name and tier target are clearly legible

**AC6 — Empty wishlist graceful state (degraded mode):**
**Given** `ideal_prefix` and `ideal_suffix` are both empty arrays (degraded mode)
**When** the slot section renders
**Then** a brief message indicates no affix recommendations are available (e.g., "No affix data available yet")
**And** the slot's efficiency percent ("100% of ideal") still displays correctly

**AC7 — Correct unique/set item "correct — keep" handling:**
**Given** a gear slot contains a Unique or Set item that is flagged as correct for the build
**When** that slot's row renders
**Then** a "correct — keep" indicator is shown on the slot row
**And** a tooltip or accessible description explains: "This unique's effect contributes positively to your build"
**Note:** Implementation path: check if `GearSlotRanking` has `is_correct_unique: boolean` from Rust (see Technical Requirements §4). If the field exists, use it directly. If absent, derive from build gear: look up `activeBuild.contextData.gear` → find item for that slotId → if `itemId` exists, use the item database to check rarity. Only show "correct — keep" if definitively determinable; omit silently if uncertain.

**AC8 — Slider position acknowledged:**
**Given** the slider at position 20 (Juggernaut) after analysis runs
**When** the ranking list is shown
**Then** the displayed rankings reflect defensive affix weighting (this comes from the Rust `GearAnalysis` payload — the UI simply displays what Rust computed; no client-side re-weighting is done)
**Note:** The slider position is baked into the `GearAnalysis` result at the time `run_gear_scoring` was called. The UI does NOT re-sort or re-weight client-side. If the player changes the slider, they must click "Analyze Gear" again to get updated rankings.

**AC9 — No results state (pre-analysis):**
**Given** `gearAnalysis` is null (before any analysis runs, or during analysis)
**When** the Gear Optimization screen renders
**Then** the ranking list is NOT shown — only the Analyze button and role designator are visible
**And** no empty list or placeholder slots are shown

**AC10 — Accessibility:**
**Given** the Gear Optimization screen rendered with analysis results
**When** `axe(container)` runs
**Then** `expect(await axe(container)).toHaveNoViolations()` passes
**And** all slot rows and wishlist items have accessible labels and are keyboard-navigable
**And** the "Priority Upgrade" badge is communicated to screen readers via `aria-label` or `aria-describedby`

**AC11 — TypeScript build passes:**
**Given** `pnpm build` from the `lebo/` directory
**When** it runs after all story changes
**Then** it succeeds with zero TypeScript errors

**AC12 — Tests pass:**
**Given** `pnpm vitest` runs
**Then** new tests pass for: slot ranking display, priority badge visibility, wishlist rendering, satisfied/missing differentiation, empty wishlist graceful state, null gearAnalysis shows no ranking list

---

## Tasks / Subtasks

- [ ] Task 1: Create `GearSlotRankingList.tsx` component (AC1–AC8)
  - [ ] Create `lebo/src/features/gear-optimization/GearSlotRankingList.tsx`
  - [ ] Accept props: `rankings: GearSlotRanking[]`, `prioritySlot: string` (see Technical Requirements §1)
  - [ ] Build slot ID → display name lookup using `GEAR_SLOTS` from `gearData.ts` (see Technical Requirements §2)
  - [ ] Render each slot row with: display name, "XX% of ideal" label, Priority badge, wishlist section
  - [ ] Implement prefix/suffix wishlist rows with satisfied/missing visual states
  - [ ] Add graceful empty wishlist state (AC6)
  - [ ] Handle "correct — keep" via Technical Requirements §4 approach
  - [ ] `pnpm build` passes

- [ ] Task 2: Update `GearOptimizationView.tsx` to integrate the ranking list (AC1, AC9)
  - [ ] Import `GearSlotRankingList` and `useOptimizationStore` gearAnalysis selector
  - [ ] Render `<GearSlotRankingList>` below the analyze button section when `gearAnalysis` is non-null
  - [ ] Do NOT re-mount `useGearStream()` — it is already mounted (avoid duplicate subscription)
  - [ ] `pnpm build` passes

- [ ] Task 3: Create `GearSlotRankingList.test.tsx` (AC10, AC12)
  - [ ] Test: renders slot rows when rankings are provided
  - [ ] Test: priority slot gets Priority badge; non-priority slots do not
  - [ ] Test: empty priority_slot string shows no badge
  - [ ] Test: wishlist items with `satisfied: true` show checkmark
  - [ ] Test: wishlist items with `satisfied: false` show highlight (not checkmark)
  - [ ] Test: empty ideal_prefix/ideal_suffix shows "no affix data" message
  - [ ] Test: axe accessibility check passes
  - [ ] `pnpm vitest` passes (new tests green, pre-existing unaffected)

- [ ] Task 4: Update `GearOptimizationView.test.tsx` (if needed)
  - [ ] Check existing tests still pass — the new `GearSlotRankingList` only renders when `gearAnalysis` is non-null, so existing tests that mock `gearAnalysis: null` are unaffected
  - [ ] If any test breaks, fix — do NOT change the test IDs that existing tests assert on

---

## Technical Requirements

### 1. `GearSlotRankingList.tsx` — Props Interface and Component Outline

```tsx
import type { GearSlotRanking } from '../../shared/types/statSheet'
import { SLOT_DISPLAY_NAMES } from './gearSlotDisplayNames'  // see §2 for how to define this

interface Props {
  rankings: GearSlotRanking[]
  prioritySlot: string  // empty string = no priority slot (degraded mode)
}

export function GearSlotRankingList({ rankings, prioritySlot }: Props) {
  // rankings are pre-sorted by Rust (descending upgrade_score)
  // Render each slot as a section with slot header + wishlist
}
```

**Key design decisions:**
- `rankings` comes pre-sorted from Rust — do NOT client-side sort
- `prioritySlot` is the raw Rust slot ID (may differ from GEAR_SLOTS `slotId` values — see §2)
- No `onClick` on slot rows for this story — Story 5.5 may add expand/collapse; keep flat for now

### 2. Slot ID → Display Name Mapping — CRITICAL

**⚠️ Slot ID mismatch risk:** `GEAR_SLOTS` in `gearData.ts` uses IDs: `helmet, body, gloves, belt, boots, ring1, ring2, amulet, relic, weapon, offhand` (11 slots). The Rust `GearSlotRanking.slot` uses the canonical IDs established in Story 1.3, which may differ (e.g., `helm`, `chest`, `ring_1`, `off_hand`).

**Required action:** Before building the mapping, log the actual `slot` values from a real `GearAnalysis` response to verify what IDs Rust emits. Do this by adding a temporary `console.log(gearAnalysis)` after `setGearAnalysis(payload)` in `useGearStream.ts`.

**Define the mapping inline in `GearSlotRankingList.tsx`** (do NOT create a separate file for 12 string pairs):

```tsx
// Maps Rust canonical slot IDs to display labels.
// Covers both naming conventions (GEAR_SLOTS IDs and possible Rust variants)
// to handle the ID mismatch risk.
const SLOT_DISPLAY: Record<string, string> = {
  // Current GEAR_SLOTS IDs
  helmet: 'Helmet',
  body: 'Body',
  gloves: 'Gloves',
  belt: 'Belt',
  boots: 'Boots',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  amulet: 'Amulet',
  relic: 'Relic',
  weapon: 'Weapon',
  offhand: 'Off-hand',
  // Possible Rust canonical variants (from Story 1.3 AC wording)
  helm: 'Helmet',
  chest: 'Body',
  ring_1: 'Ring 1',
  ring_2: 'Ring 2',
  off_hand: 'Off-hand',
  // Add any additional 12th slot ID found during verification
}

function slotDisplayName(slotId: string): string {
  return SLOT_DISPLAY[slotId] ?? slotId  // fallback: show raw ID
}
```

### 3. Slot Row Rendering

Each slot row renders:
1. **Header row:** slot display name (left) + efficiency label (right)
2. **Priority badge:** only if `slot === prioritySlot` and `prioritySlot !== ''`
3. **Wishlist section:** prefix and suffix subsections (see §3a)

```tsx
// Efficiency display
const efficiencyLabel = `${Math.round(ranking.efficiency_percent)}% of ideal`

// Priority badge — only when priority_slot is non-empty and matches
const isPriority = prioritySlot !== '' && ranking.slot === prioritySlot
```

**Efficiency percent display:**
- 80–100%: neutral text color (`--color-text-secondary`)
- 50–79%: amber/warning color (use `--color-accent-gold` dimmed or a warning-appropriate color)
- Below 50%: attention color (use `--color-data-damage` or similar warning; avoid pure red which is inaccessible without additional indicator)
- Always show the number even at 100% (degraded mode shows all 100%, that's fine)

**Priority badge styling:**
```tsx
{isPriority && (
  <span
    className="text-xs px-1.5 py-0.5 rounded font-semibold"
    style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
    aria-label="Priority Upgrade slot"
  >
    Priority
  </span>
)}
```

#### 3a. Wishlist Row Rendering

For each `WishlistAffix` in `ideal_prefix` and `ideal_suffix`:
```tsx
// satisfied row
<div
  className="flex items-start gap-2"
  style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}
  aria-label={`${affix.display_name} — satisfied`}
>
  <span aria-hidden="true">✓</span>
  <span>{affix.display_name}</span>
  <span className="ml-auto text-xs">T{affix.target_tier}</span>
</div>

// missing row
<div
  className="flex items-start gap-2"
  style={{ color: 'var(--color-text-primary)' }}
  aria-label={`${affix.display_name} — missing or below tier T${affix.target_tier}`}
>
  <span aria-hidden="true">○</span>
  <span>{affix.display_name}</span>
  <span className="ml-auto text-xs">T{affix.target_tier}+</span>
</div>
// Show mechanical_reason below in a smaller muted line
<p className="text-xs mt-0.5 ml-4" style={{ color: 'var(--color-text-muted)' }}>
  {affix.mechanical_reason}
</p>
```

**Empty wishlist (AC6):**
```tsx
{ranking.ideal_prefix.length === 0 && ranking.ideal_suffix.length === 0 && (
  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
    No affix recommendations available
  </p>
)}
```

### 4. Unique/Set "Correct — Keep" Handling (AC7)

**Step 1:** Check if `GearSlotRanking` in the Rust output has an `is_correct_unique` field by reading `lebo/src-tauri/scoring-core/src/stat_sheet.rs`. If the Rust struct has this field:
- Add `is_correct_unique?: boolean` to `GearSlotRanking` in `shared/types/statSheet.ts`
- Render "correct — keep" badge when `is_correct_unique === true`

**Step 2 (fallback, if Rust does not emit this field):**
Derive client-side from build gear data. In the parent component (`GearOptimizationView`), pass the currently equipped item info as an additional prop or compute it in the list component:

```tsx
// In GearOptimizationView, pass gear context:
const activeBuild = useBuildStore((s) => s.activeBuild)
const equippedBySlot = useMemo(() => {
  const map: Record<string, GearItemV2> = {}
  for (const item of (activeBuild?.contextData.gear ?? [])) {
    map[item.slotId] = item
  }
  return map
}, [activeBuild?.contextData.gear])
```

Then in `GearSlotRankingList`, pass `equippedBySlot?: Record<string, GearItemV2>` as an optional prop. A slot shows "correct — keep" if `equippedBySlot[slot]?.itemId` exists AND the item's name is recognizable as a unique (look up in `itemDatabase` if available). This is best-effort — omit the badge if uncertain rather than showing it incorrectly.

**Note:** If neither path is clean, defer "correct — keep" to Story 5.5 (Claude narrative story) and add a TODO comment. The AC is "should implement if determinable" — don't over-engineer for degraded-mode data that doesn't yet carry this signal.

### 5. `GearOptimizationView.tsx` Integration

The integration is additive only — existing code is preserved. Add below the analyze button section:

```tsx
import { GearSlotRankingList } from './GearSlotRankingList'

// In the component, add selector:
const gearAnalysis = useOptimizationStore((s) => s.gearAnalysis)

// In JSX, after the button div:
{gearAnalysis !== null && (
  <GearSlotRankingList
    rankings={gearAnalysis.slot_rankings}
    prioritySlot={gearAnalysis.priority_slot}
  />
)}
```

**Do NOT:**
- Call `useGearStream()` again — it is already mounted in this component
- Add any IPC calls — this component only reads from the store
- Re-sort `slot_rankings` — Rust emits them in descending `upgrade_score` order

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src/features/gear-optimization/GearSlotRankingList.tsx` | CREATE | New component — slot ranking + wishlist display |
| `lebo/src/features/gear-optimization/GearSlotRankingList.test.tsx` | CREATE | Unit tests |
| `lebo/src/features/gear-optimization/GearOptimizationView.tsx` | MODIFY | Integrate `GearSlotRankingList`; add `gearAnalysis` selector |
| `lebo/src/shared/types/statSheet.ts` | MODIFY (conditional) | Add `is_correct_unique?: boolean` to `GearSlotRanking` IF Rust emits this field |

**Do NOT touch:**
- `lebo/src-tauri/` — no Rust changes in this story
- `shared/stores/useGearStream.ts` — event wiring is done
- `shared/stores/optimizationStore.ts` — gear fields added in 5.3
- `shared/types/statSheet.ts` — only modify if `is_correct_unique` field confirmed on Rust side

---

## Architecture & Pattern Compliance

**Four stores only:** No new store. Read `optimizationStore.gearAnalysis` via selector in `GearOptimizationView`.

**No barrel files:** Import `GearSlotRankingList` directly from its path. No `index.ts`.

**No raw `invoke()`:** This story makes zero IPC calls. All data comes from the store.

**No direct store access in `GearSlotRankingList`:** This component receives `rankings` and `prioritySlot` as props. It does NOT access `useOptimizationStore` internally. The parent (`GearOptimizationView`) is the store boundary. This keeps the component testable without store mocking.

**Pattern 7 (null sub-sheets hidden):** `gearAnalysis === null` → component not rendered at all. Never render an empty container or error state for null.

**Pattern 6 (gear namespace):** Not relevant for this UI story — no events emitted.

**Tailwind v4:** No `@apply`. Use `className` + inline `style={{ color: 'var(--color-*)' }}` for design tokens. Use Tailwind utility classes for layout/spacing only.

**SkillTreeCanvas props-only rule:** Not applicable here (no canvas). But follow the same spirit: `GearSlotRankingList` is props-only (no store access).

---

## Testing Requirements

### Vitest tests for `GearSlotRankingList.test.tsx`

Use the same `render()` + `screen` pattern as `GearOptimizationView.test.tsx`. Mock nothing — component is pure React with no store/IPC dependencies.

```ts
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { GearSlotRankingList } from './GearSlotRankingList'
import type { GearSlotRanking, WishlistAffix } from '../../shared/types/statSheet'

function makeAffix(satisfied: boolean): WishlistAffix {
  return {
    affix_id: 'test-affix',
    display_name: 'Hybrid Health',
    target_tier: 5,
    weight: 0.8,
    mechanical_reason: 'Increases effective HP by 15%',
    satisfied,
  }
}

function makeRanking(slot: string, efficiencyPercent: number, wishlistFilled = false): GearSlotRanking {
  return {
    slot,
    upgrade_score: 100 - efficiencyPercent,
    efficiency_percent: efficiencyPercent,
    ideal_prefix: wishlistFilled ? [makeAffix(false)] : [],
    ideal_suffix: wishlistFilled ? [makeAffix(true)] : [],
  }
}

describe('GearSlotRankingList', () => {
  it('renders slot display names from ranking data', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 73)]} prioritySlot="" />)
    expect(screen.getByText('Helmet')).toBeInTheDocument()
    expect(screen.getByText('73% of ideal')).toBeInTheDocument()
  })

  it('falls back to raw slot ID if unrecognized', () => {
    render(<GearSlotRankingList rankings={[makeRanking('unknownslot', 90)]} prioritySlot="" />)
    expect(screen.getByText('unknownslot')).toBeInTheDocument()
  })

  it('shows Priority badge on the priority slot', () => {
    const rankings = [makeRanking('helmet', 40), makeRanking('boots', 80)]
    render(<GearSlotRankingList rankings={rankings} prioritySlot="helmet" />)
    expect(screen.getByLabelText('Priority Upgrade slot')).toBeInTheDocument()
  })

  it('shows no Priority badge when prioritySlot is empty string', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 100)]} prioritySlot="" />)
    expect(screen.queryByLabelText('Priority Upgrade slot')).toBeNull()
  })

  it('shows checkmark for satisfied wishlist affixes', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 80, true)]} prioritySlot="" />)
    // The satisfied affix row has aria-label containing "satisfied"
    const satisfiedRow = screen.getByLabelText(/satisfied/i)
    expect(satisfiedRow).toBeInTheDocument()
  })

  it('shows missing indicator for unsatisfied wishlist affixes', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 80, true)]} prioritySlot="" />)
    const missingRow = screen.getByLabelText(/missing or below tier/i)
    expect(missingRow).toBeInTheDocument()
  })

  it('shows no affix data message when wishlist is empty', () => {
    render(<GearSlotRankingList rankings={[makeRanking('helmet', 100, false)]} prioritySlot="" />)
    expect(screen.getByText(/no affix recommendations available/i)).toBeInTheDocument()
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(
      <GearSlotRankingList
        rankings={[makeRanking('helmet', 40, true), makeRanking('boots', 80)]}
        prioritySlot="helmet"
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

### `GearOptimizationView.test.tsx` additions (if needed)

Add one test to verify `GearSlotRankingList` renders when `gearAnalysis` is set:

```ts
it('shows slot ranking list when gearAnalysis is available', () => {
  useOptimizationStore.setState({
    gearAnalysis: {
      slot_rankings: [{ slot: 'helmet', upgrade_score: 0, efficiency_percent: 100, ideal_prefix: [], ideal_suffix: [] }],
      priority_slot: '',
    },
    isAnalyzingGear: false,
  })
  useBuildStore.setState({ activeBuild: makeBuild({ 'slot-0': 'primary_offense' }) })
  render(<GearOptimizationView />)
  expect(screen.getByText('Helmet')).toBeInTheDocument()
  expect(screen.getByText('100% of ideal')).toBeInTheDocument()
})
```

Remember to reset `useOptimizationStore` in `beforeEach` (capture initial state at the top of the test file, same pattern as `initialBuildState`).

### Verification commands

```bash
# From lebo/:
pnpm build                                             # Zero TS errors
pnpm vitest src/features/gear-optimization/GearSlotRankingList.test.tsx  # New tests
pnpm vitest src/features/gear-optimization/GearOptimizationView.test.tsx  # Pre-existing + new
pnpm vitest                                            # Full suite: pre-existing unaffected
```

---

## Previous Story Intelligence (from 5.3)

- **`priority_slot` is empty string when `gear_affixes` is empty (degraded mode).** This is a known pre-existing issue deferred from 5.3 review. The UI must handle `priority_slot === ''` by showing NO Priority badge. Never show Priority on a random slot as a fallback.
- **`gear:analysis-complete` delivers `event.payload` as a typed `GearAnalysis` object** — no `JSON.parse`. The TypeScript interface in `statSheet.ts` is already correct.
- **`setGearAnalysis(null)` is called at the START of each `startGearAnalysis()` call** — so `gearAnalysis` briefly goes null before new results arrive. The `{gearAnalysis !== null && <GearSlotRankingList>}` guard handles this correctly — the list disappears during re-analysis and reappears when the new result arrives.
- **`isAnalyzingGear` controls the "Analyze Gear" button state** — the `GearSlotRankingList` display is independent of loading state. The list stays visible while `isAnalyzingGear` is true if `gearAnalysis` is non-null from a previous run.
- **Story 5.2 note:** `gear.rs` degrades gracefully when `game_data.gear_affixes` is empty. All 12 slots return `upgrade_score: 0.0`, `efficiency_percent: 100.0`, empty wishlists. The UI showing "100% of ideal" for all slots is correct and expected behavior in Phase 3.
- **`GEAR_SLOTS` has 11 entries** — but the epic specifies 12 canonical slots. Verify actual Rust slot IDs by logging a real `GearAnalysis` response. The `SLOT_DISPLAY` map in the component should cover both naming variants as a safety net.

---

## Dev Notes

**No Tauri IPC in this component.** All data arrives via the store. If you find yourself writing `invokeCommand`, stop — that's wrong.

**`GearSlotRankingList` is props-only.** Do not import any Zustand store inside it. The parent `GearOptimizationView` is the store boundary. This makes the component independently testable with no mocking.

**Efficiency percent display color thresholds** are approximate guidelines, not hard requirements. Use accessible color choices — never rely solely on color to communicate status. The `○` vs `✓` indicator pattern for missing/satisfied affixes provides a color-independent signal.

**Mechanical reason text** (`WishlistAffix.mechanical_reason`) comes from the Rust gear scorer. In degraded mode these strings may be empty. Always guard: `{affix.mechanical_reason && <p>...</p>}`.

**Do not alphabetically sort slot_rankings.** Rust emits them sorted by `upgrade_score` descending. Preserve this ordering.

**`target_tier` is a number** (e.g., `5`). Display as "T5" or "T5+" (T5 for satisfied, T5+ for missing to imply "at least T5"). Do not add a "+" to satisfied rows.

**Slider position is NOT re-applied client-side.** The rankings reflect the slider position at the time of the last `run_gear_scoring` call. If the player changes the slider and wants updated rankings, they click "Analyze Gear" again. No live re-sort based on current `sliderPosition`. This simplifies the component and avoids confusion.

### Project Structure Notes

- New component `GearSlotRankingList.tsx` co-located in `features/gear-optimization/` — same folder as `GearOptimizationView.tsx` and `SkillRoleDesignator.tsx`. Correct per project conventions.
- Tests co-located: `GearSlotRankingList.test.tsx` next to the component.
- No new feature folder is created.
- Import `GEAR_SLOTS` from `../../context-panel/gearData` only if needed for the slot display mapping (alternative: inline the display map as shown in §2 — this avoids cross-feature imports and the mapping is simple enough).
- `GearItemV2` type is in `shared/types/build.ts` — import directly if needed for the "correct — keep" fallback in §4.

### References

- `GearAnalysis`, `GearSlotRanking`, `WishlistAffix` types: `lebo/src/shared/types/statSheet.ts`
- `optimizationStore` gear fields: `lebo/src/shared/stores/optimizationStore.ts` (lines 26–27)
- `useGearStream` hook: `lebo/src/shared/stores/useGearStream.ts`
- `GEAR_SLOTS` display names: `lebo/src/features/context-panel/gearData.ts`
- Existing component to modify: `lebo/src/features/gear-optimization/GearOptimizationView.tsx`
- Existing tests to preserve: `lebo/src/features/gear-optimization/GearOptimizationView.test.tsx`
- Design tokens reference: `lebo/src/shared/types/` + project-context.md §Tailwind v4
- Previous story 5.3 file: `_bmad-output/implementation-artifacts/5-3-run-gear-scoring-tauri-command-and-typescript-wiring.md`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (2026-05-26)

### Debug Log References

### Completion Notes List

### File List
