---
title: 'Stat Sheet UI — Five-Tab Display'
type: 'feature'
created: '2026-05-21'
status: 'done'
baseline_commit: '9e3caf02d6698e1c934856ccfc16b306806b3a6d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The scoring engine (Stories 2.1–2.5) computes and stores a live `StatSheet` in `optimizationStore`, but there is no UI to display it — players cannot see their build's computed stats.

**Approach:** Create a `StatSheetPanel` component with five tabs (General, Offense, Defense, Minion, Other) in the right panel, reading from `optimizationStore.statSheet` and `buildStore.activeBuild`. No new stores, no Rust changes.

## Boundaries & Constraints

**Always:**
- Read `statSheet` from `useOptimizationStore()`, `isComputingStats` for loading state
- General tab reads from `useBuildStore()` and `useGameDataStore()` — not from `StatSheet`
- Minion tab hidden (not greyed) when `statSheet.minion == null`; Phase 4 populates it
- Resistances below 75% in the Defense tab get a distinct warning visual (color + gap label)
- Loading state: show a loading indicator while `isComputingStats`, preserve previous values (no blank flash)
- `StatSheetPanel` is a plain React component — no PixiJS, no Tauri IPC
- No barrel files, no default exports, named exports only
- Tab component uses `@headlessui/react` TabGroup/TabList/Tab (same as SkillTreeTabBar)
- Focus rings: 2px solid `var(--color-accent-gold)` on all interactive elements
- All tests use `vi.mock('../../shared/utils/invokeCommand', ...)` for IPC isolation

**Ask First:**
- If `StatSheet.defense` is missing expected fields (different from what investigation found), ask before inventing fallbacks.

**Never:**
- No "Recalculate" button — values update reactively via the existing `useStatSheet` hook
- Do not add a new Zustand store
- Do not touch `useStatSheet.ts`, `buildSnapshotSerializer.ts`, or Rust files
- Do not implement suggestion hover deltas (Story 4.5)
- Do not add movement speed / CDR / mana to `StatSheet` — Other tab shows `scores` breakdown and stubs for future stats with "—" values
- Do not render Minion tab content with real data (MinionStats is an empty Phase 4 placeholder interface)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No active build | `activeBuild = null`, `statSheet = null` | All tabs show "—" placeholder values | — |
| Computing in progress | `isComputingStats = true` | Spinner/indicator visible; prior values remain | — |
| Defense tab with uncapped resistance | `statSheet.defense.fire_resistance = 52` | Resistance value shown in warning color with "+23% needed" label | — |
| Minion tab visibility | `statSheet.minion = null` | Minion tab NOT rendered in TabList | — |
| Minion tab visible (future) | `statSheet.minion` is non-null | Minion tab appears without page refresh | — |

</frozen-after-approval>

## Code Map

- `lebo/src/features/stat-sheet/StatSheetPanel.tsx` — new component; five-tab stat display (CREATE)
- `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` — axe + rendering tests (CREATE)
- `lebo/src/features/layout/RightPanel.tsx` — insert `<StatSheetPanel />` between Gear and Optimization sections (MODIFY)
- `lebo/src/shared/types/statSheet.ts` — read-only reference: OffenseStats, DefenseStats, StatSheet, StatWarning
- `lebo/src/shared/stores/optimizationStore.ts` — read-only: `statSheet`, `isComputingStats`
- `lebo/src/shared/stores/buildStore.ts` — read-only: `activeBuild` (characterLevel, classId, masteryId, nodeAllocations, skillNodeAllocations, activeSkillLevels); `selectAvailablePassivePoints` selector
- `lebo/src/shared/stores/gameDataStore.ts` — read-only: `gameData.classes[classId].className`, `gameData.classes[classId].masteries[masteryId].masteryName`

## Tasks & Acceptance

**Execution:**
- [x] `lebo/src/features/stat-sheet/StatSheetPanel.tsx` — CREATE five-tab panel component
  - TabGroup with TabList containing: General, Offense, Defense, [Minion if visible], Other
  - Minion tab: only rendered when `statSheet?.minion != null`
  - Loading: when `isComputingStats`, show an inline spinner alongside the tab bar (values remain visible)
  - When `statSheet` is null (no build or no data yet), all stat values render as `—`
  - **General tab:** character level, passive points (spent `/ available`), per-skill level + points (spent `/ available` per slot), class name, mastery name — sourced from `buildStore` + `gameData`, not StatSheet
  - **Offense tab:** damage_score, avg_hit_damage, avg_hit_damage_crit_weighted, critical_strike_chance, critical_strike_multiplier, attack_speed + cast_speed, aoe_modifier — from `statSheet.offense`
  - **Defense tab:** effective_hp, raw_hp, ward, endurance_percent, endurance_threshold, armor, all 6 resistances, crit_avoidance, dodge_chance — from `statSheet.defense`; each resistance below 75 shows a warning style + `(+{gap}% needed)` label using `statSheet.warnings` to detect/derive the gap
  - **Minion tab:** conditionally rendered; shows placeholder content (empty Phase 4 — display "Minion stats available once minion skill data is loaded")
  - **Other tab:** damage_score, survivability_score, speed_score, build_score from `statSheet.scores`; movement speed / CDR / mana shown as `—` with a "(coming soon)" note
  - Use `var(--color-data-positive)` for positive values, `var(--color-data-negative)` for warnings/uncapped resistances, `var(--color-text-muted)` for `—` stubs
  - Tab focus ring: `outline: 2px solid var(--color-accent-gold)` on keyboard focus (use `data-[focus]:` Tailwind pattern matching SkillTreeTabBar)

- [x] `lebo/src/features/layout/RightPanel.tsx` — INSERT `<StatSheetPanel />` as a new independently-scrollable section between the Gear Context section and the Optimization section
  - Import `StatSheetPanel` from `'../stat-sheet/StatSheetPanel'`
  - Section should be conditionally visible in expanded panel only (same as Gear section pattern)

- [x] `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` — CREATE tests
  - Mock `useOptimizationStore`, `useBuildStore`, `useGameDataStore`
  - Test: renders five tabs when `statSheet.minion != null`; renders four tabs when `statSheet.minion = null`
  - Test: shows loading indicator when `isComputingStats = true`
  - Test: uncapped resistance (< 75) has warning class/style applied
  - Test: `expect(await axe(container)).toHaveNoViolations()` passes with all tabs
  - Test: keyboard navigation — all tabs have correct `aria-selected` states

**Acceptance Criteria:**
- Given the Defense tab with a resistance below 75%, when rendered, then that resistance is visually distinct and a gap label is shown
- Given `statSheet.minion = null`, when the tab bar renders, then no Minion tab is present in the DOM
- Given `isComputingStats = true`, when the panel renders, then a loading indicator is visible and prior stat values remain (no blank flash)
- Given `axe(container)` runs on the full panel with all tabs, then `expect(await axe(container)).toHaveNoViolations()` passes
- Given all tabs, when navigated by keyboard, then correct `aria-selected` states are set and focus rings are visible

## Spec Change Log

## Design Notes

**Resistance warning logic:** `StatSheet.warnings` contains `StatWarning[]` with a `warning_type` (e.g., `"fire_resistance_uncapped"`), `current_value`, and `gap`. For each resistance displayed in the Defense tab, check if any warning in `statSheet.warnings` has a matching type. If so, apply the warning color and render `(+{gap}% needed)` inline. Don't re-derive the gap from the resistance value — use the engine's pre-computed `gap`.

**Stat row pattern:** Each stat row: `<div>label <span>{value}{unit}</span></div>`. When `statSheet` is null, value is `"—"`. Keep it a simple flat list per tab — no nested accordions.

**General tab skill info:** `Object.entries(activeBuild.activeSkillLevels ?? {})` gives slotId → level. Skill name lookup: `gameData.classes[classId].skills` or similar. If skill name lookup is complex, show `slot-{i}: level {n}` as a fallback.

## Verification

**Commands:**
- `pnpm build` (from `lebo/`) -- expected: zero TypeScript errors
- `pnpm vitest` (from `lebo/`) -- expected: 8 pre-existing failures unchanged, new StatSheetPanel tests pass, no new failures

## Suggested Review Order

**Tab structure and conditional Minion tab**

- Entry point: stores consumed, `showMinionTab` derived from `statSheet?.minion != null`
  [`StatSheetPanel.tsx:81`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L81)

- `key` on `TabGroup` resets selected index when Minion tab appears/disappears — prevents index shift to wrong panel
  [`StatSheetPanel.tsx:119`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L119)

- Conditional `Tab` in `TabList` — must stay symmetric with the `TabPanel` below
  [`StatSheetPanel.tsx:127`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L127)

- Matching conditional `TabPanel` — symmetry with L127 is what makes tab/panel indices align
  [`StatSheetPanel.tsx:203`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L203)

**Resistance warning display**

- `RESISTANCES` config: field → warning-type mapping drives the Defense tab loop
  [`StatSheetPanel.tsx:18`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L18)

- Defense tab map: looks up each resistance warning from `statSheet.warnings`; passes `gap` to `StatRow`
  [`StatSheetPanel.tsx:186`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L186)

- `StatRow`: renders `(+{warningGap}% needed)` in `var(--color-data-negative)` when gap is present
  [`StatSheetPanel.tsx:56`](../../lebo/src/features/stat-sheet/StatSheetPanel.tsx#L56)

**RightPanel integration**

- Stat sheet section inserted between Gear and Optimization; `maxHeight: 280px` + independent scroll
  [`RightPanel.tsx:95`](../../lebo/src/features/layout/RightPanel.tsx#L95)

**Tests**

- Axe test clicks through all 5 tabs (with Minion visible) before asserting `toHaveNoViolations`
  [`StatSheetPanel.test.tsx:163`](../../lebo/src/features/stat-sheet/StatSheetPanel.test.tsx#L163)

- Defense warning test: must click the Defense tab first since inactive panels are unmounted
  [`StatSheetPanel.test.tsx:132`](../../lebo/src/features/stat-sheet/StatSheetPanel.test.tsx#L132)

- Tab count assertion: 4 tabs without Minion, 5 tabs with Minion
  [`StatSheetPanel.test.tsx:92`](../../lebo/src/features/stat-sheet/StatSheetPanel.test.tsx#L92)
