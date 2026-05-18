# Story 3.3: Optimization Goal Selector & Trigger

Status: done

## Story

As an advanced Last Epoch player,
I want to choose what I want to optimize for before triggering analysis,
So that AI suggestions are tailored to my current character goals rather than a generic template.

## Acceptance Criteria

1. **Given** a build is loaded in the right panel
   **When** the user views the optimization section
   **Then** a goal selector displays four options as a RadioGroup: "Maximize Damage", "Maximize Survivability", "Maximize Speed", "Balanced"
   **And** "Balanced" is selected by default on first use (maps to `'balanced'` in `useOptimizationStore`)
   **And** the `ScoreGauge` shows the current build's baseline scores for all three axes so users can see which has the most headroom

2. **Given** the user selects a goal and clicks "Optimize"
   **When** optimization fires
   **Then** the "Optimize" button transitions to a loading state (text: "Analyzing...") with a pulsing waveform animation in the right panel — not a full-screen spinner
   **And** the message "This usually takes 20–30 seconds" appears below the button during analysis
   **And** `startOptimization()` from `useOptimizationStream` is called, which invokes `invoke_claude_api` with the active build and selected goal

3. **Given** no build is loaded
   **When** the user views the right panel
   **Then** the "Optimize" button is disabled (dimmed, non-interactive, `aria-disabled="true"`)

4. **Given** the user changes the goal selection after optimization has already run
   **When** a new goal is selected
   **Then** `useOptimizationStore.goal` updates immediately via `setGoal` but no automatic re-run occurs — the user must click "Optimize" again

5. **Given** optimization is running (`isOptimizing === true`)
   **When** the user views the Optimize button
   **Then** the button is in loading state ("Analyzing...") and is non-interactive (prevents double-submission)

6. **Given** a build is loaded with all empty context data (`gear.length === 0 && skills.length === 0 && idols.length === 0`)
   **When** the user views the right panel
   **Then** a non-blocking inline note appears below the Optimize button: "Add gear, skills, and idols in the context panel for more relevant suggestions."
   **And** the note auto-dismisses once any context panel field is populated
   **And** the note has a dismiss button (×) so users can manually hide it

## Tasks / Subtasks

- [x] Task 1: `GoalSelector.tsx` (AC: 1, 4)
  - [x] Create `src/features/optimization/GoalSelector.tsx`
  - [x] `import { RadioGroup } from '@headlessui/react'` — already in project deps
  - [x] GOALS constant: `[{ value: 'balanced', label: 'Balanced' }, { value: 'maximize_damage', label: 'Maximize Damage' }, { value: 'maximize_survivability', label: 'Maximize Survivability' }, { value: 'maximize_speed', label: 'Maximize Speed' }]`
  - [x] Read `goal` and `setGoal` from `useOptimizationStore`
  - [x] Render RadioGroup with all four options; selected option highlighted in `--color-accent-gold`; unselected in `--color-text-secondary`
  - [x] Disabled when `isOptimizing` is true (lock goal during analysis)
  - [x] `data-testid="goal-selector"` on root, `data-testid="goal-option-{value}"` on each option

- [x] Task 2: `OptimizeButton.tsx` (AC: 2, 3, 5)
  - [x] Create `src/features/optimization/OptimizeButton.tsx`
  - [x] Props: `{ onOptimize: () => void; disabled: boolean; isOptimizing: boolean }`
  - [x] Normal state: accent-gold filled button, text "Optimize", `--color-bg-base` text color
  - [x] Loading state (`isOptimizing`): text "Analyzing..." with three pulsing waveform bars; non-interactive (`aria-disabled="true"`, no onClick)
  - [x] Pulsing waveform: three bars (`h-3 w-0.5 rounded-full`) with `animate-pulse` and staggered animation delays (0ms, 150ms, 300ms) via inline `style={{ animationDelay: '...' }}`
  - [x] "This usually takes 20–30 seconds" sub-text renders below button only during loading state
  - [x] `disabled` prop (no build): button dimmed, `opacity-50 cursor-not-allowed`
  - [x] `data-testid="optimize-button"`, `data-testid="optimize-loading-indicator"` on waveform wrapper

- [x] Task 3: Wire into `RightPanel.tsx` (AC: 1, 2, 3, 6)
  - [x] Add `useOptimizationStream` hook call at the top of `RightPanel` — this registers the three event listeners for the lifetime of the panel
  - [x] Add `isOptimizing` from `useOptimizationStore`
  - [x] Render `<GoalSelector />` above the Optimize button
  - [x] Render `<OptimizeButton onOptimize={startOptimization} disabled={false} isOptimizing={isOptimizing} />`
  - [x] Implement empty context note (AC6): compute `isEmptyContext`, use `useState(false)` for `isBannerDismissed`; show note when `activeBuild && isEmptyContext && !isBannerDismissed`; auto-hide when `isEmptyContext` is false
  - [x] Kept "Suggestion list — Story 3.4" stub (Story 3.4 placeholder)
  - [x] Keep existing `<ScoreGauge baselineScore={scores} />` in place (already working from 3.1)

- [x] Task 4: Tests (AC: 1–6)
  - [x] `GoalSelector.test.tsx`: renders 4 options; "balanced" selected by default; clicking an option calls `setGoal`; all options disabled when `isOptimizing`
  - [x] `OptimizeButton.test.tsx`: renders "Optimize" in normal state; renders "Analyzing..." with waveform when `isOptimizing`; sub-text visible only during loading; disabled prop applies `aria-disabled` and prevents click
  - [x] `RightPanel.test.tsx`: renders GoalSelector and OptimizeButton when build is loaded; Optimize button not disabled; empty context note appears when all context arrays empty; note hides when dismissed; panel collapses correctly
  - [x] Run `pnpm tsc --noEmit` + `pnpm vitest run` — both pass (244 tests)

## Dev Notes

### Critical: Story 3.2 Prerequisites Already in Place

`useOptimizationStream` is already implemented at `src/shared/stores/useOptimizationStream.ts`. It:
- Registers all three Tauri event listeners (`optimization:suggestion-received`, `optimization:complete`, `optimization:error`)
- Exports `startOptimization()` which calls `clearSuggestions()`, `setIsOptimizing(true)`, then `invokeCommand('invoke_claude_api', { buildState, goal })`
- Handles cleanup (unlisten + `setIsOptimizing(false)`) on unmount

**Call `useOptimizationStream` in `RightPanel` (not in `OptimizeButton`).** The hook must live in a component that stays mounted for the full session. `RightPanel` is always mounted in `App.tsx`. Do NOT create a new hook instance in `GoalSelector` or `OptimizeButton`.

---

### Existing Infrastructure — DO NOT Reinvent

| What | Where |
|------|-------|
| `OptimizationGoal` type | `src/shared/types/optimization.ts` |
| `useOptimizationStore` — `goal`, `setGoal`, `isOptimizing`, `scores` | `src/shared/stores/optimizationStore.ts` |
| `useOptimizationStream` — `startOptimization()` | `src/shared/stores/useOptimizationStream.ts` |
| `useBuildStore` — `activeBuild` | `src/shared/stores/buildStore.ts` |
| `ScoreGauge` | `src/features/optimization/ScoreGauge.tsx` |
| `@headlessui/react` RadioGroup | already installed |

`optimizationStore` default `goal` is already `'balanced'` — AC1 default is satisfied without extra initialization.
`scores` in `optimizationStore` is already populated by `App.tsx` via `calculateScore` whenever `nodeAllocations` changes (Story 3.1). `ScoreGauge` in `RightPanel` already consumes it.

---

### Headless UI RadioGroup Pattern (v2 API)

This project uses `@headlessui/react` v2 (confirmed by named exports: `ListboxButton`, `ListboxOptions`, `TabGroup`). In v2, RadioGroup usage:

```tsx
import { RadioGroup } from '@headlessui/react'

<RadioGroup
  value={goal}
  onChange={setGoal}
  disabled={isOptimizing}
  aria-label="Optimization goal"
  className="flex flex-col gap-1"
  data-testid="goal-selector"
>
  {GOALS.map(({ value, label }) => (
    <RadioGroup.Option
      key={value}
      value={value}
      data-testid={`goal-option-${value}`}
      className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer"
      style={{ /* ... */ }}
    >
      {({ checked }: { checked: boolean }) => (
        /* render checked/unchecked state */
      )}
    </RadioGroup.Option>
  ))}
</RadioGroup>
```

Match the `Listbox` render-prop pattern from `ClassMasterySelector.tsx:63` — use `({ checked }: { checked: boolean })` as render prop.

---

### Pulsing Waveform Animation

UX spec (UX-DR13) calls for "pulsing waveform" during the 20–30s AI wait. Implementation:

```tsx
// Three bars pulsing with staggered delays
<div className="flex items-end gap-0.5 h-3" data-testid="optimize-loading-indicator">
  {[0, 150, 300].map((delay) => (
    <div
      key={delay}
      className="w-0.5 rounded-full animate-pulse"
      style={{
        height: delay === 150 ? '12px' : '8px',  // middle bar taller
        backgroundColor: 'var(--color-accent-gold)',
        animationDelay: `${delay}ms`,
      }}
    />
  ))}
</div>
```

`animate-pulse` from Tailwind v4 is already available in the project (used in other loading states). Do NOT add new CSS keyframe animations — use existing Tailwind utility.

---

### Design Tokens to Use

All from the established token system (do NOT use raw hex values):

| Token | Use |
|-------|-----|
| `var(--color-accent-gold)` | Selected goal highlight, Optimize button fill, waveform bars |
| `var(--color-bg-base)` | Button text color (contrast against gold fill) |
| `var(--color-bg-elevated)` | Unselected option background on hover |
| `var(--color-text-secondary)` | Unselected option label |
| `var(--color-text-muted)` | Sub-text ("This usually takes..."), empty context note |
| `var(--color-bg-surface)` | Panel background (inherited) |

---

### RightPanel Layout Order (Top to Bottom)

```
PanelCollapseToggle  (existing)
────────────────────
ScoreGauge           (existing, shows baseline scores — AC1)
GoalSelector         (NEW — Task 1)
OptimizeButton       (NEW — Task 2)
[empty context note] (NEW — Task 3, conditional)
────────────────────
[Suggestion list placeholder]  (Story 3.4 — keep as text stub)
```

Keep the `<ScoreGauge>` above the selector — users should see their current scores BEFORE selecting a goal, so they can see which axis has the most headroom.

---

### Empty Context Note — Dismiss Logic

The note is displayed using purely derived state + local `useState`:

```tsx
const [isBannerDismissed, setIsBannerDismissed] = useState(false)

const isEmptyContext =
  !!activeBuild &&
  activeBuild.contextData.gear.length === 0 &&
  activeBuild.contextData.skills.length === 0 &&
  activeBuild.contextData.idols.length === 0

const showContextNote = isEmptyContext && !isBannerDismissed
```

- When `isEmptyContext` becomes `false` (user adds gear/skill/idol in the Context Panel), note disappears automatically — satisfies "Dismiss permanently once user has populated any context panel field."
- `isBannerDismissed` set to `true` via the × button: permanent for the component lifetime (session).
- `isBannerDismissed` resets to `false` when a new build is loaded (component re-renders with new `activeBuild`). This is correct — a new build might have empty context again.
- Do NOT persist dismiss state to the store or disk. Local component state is correct here.

---

### Patterns From Previous Stories

- No barrel `index.ts` files — import directly from source file paths
- Tailwind v4 CSS-first: use `className` for layout/spacing utilities, `style={{ color: 'var(--color-...)' }}` for design tokens
- All Headless UI components use render-prop pattern `{({ checked }) => (...)}` — see `ClassMasterySelector.tsx:63` for exact shape
- Test files co-located: `GoalSelector.test.tsx` next to `GoalSelector.tsx`
- Mock Zustand stores in tests: `useOptimizationStore.setState(overrides, true)` to reset between tests
- `renderHook()` called outside `act()` (React 19 requirement — see 3.2 completion notes)
- Run `pnpm tsc --noEmit` before marking complete

---

### AC3 — Disabled Button When No Build

`disabled` is computed from `!activeBuild` in `RightPanel` and passed to `OptimizeButton`. In the button:
- Add `disabled` prop to the `<button>` element
- Add `aria-disabled="true"` attribute
- Apply `opacity-50 cursor-not-allowed` Tailwind classes
- Do NOT add `pointer-events-none` — that breaks aria-disabled for screen readers

---

### File Locations

**New files:**
- `lebo/src/features/optimization/GoalSelector.tsx`
- `lebo/src/features/optimization/GoalSelector.test.tsx`
- `lebo/src/features/optimization/OptimizeButton.tsx`
- `lebo/src/features/optimization/OptimizeButton.test.tsx`

**Modified files:**
- `lebo/src/features/layout/RightPanel.tsx` — add GoalSelector, OptimizeButton, useOptimizationStream, empty context note

---

### Regression Warning

`RightPanel.tsx` already renders `<ScoreGauge baselineScore={scores} />` conditionally on `activeBuild`. **Do not change the ScoreGauge wiring** — it works and is tested in Story 3.1. Only ADD components above it, do not restructure the existing score display.

The collapsed panel state (`isCollapsed`) must continue to hide all content. GoalSelector and OptimizeButton must be inside the `!isCollapsed` branch, not outside it.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Used `Radio` named export from `@headlessui/react` v2 (not `RadioGroup.Option` — v1 dot-notation was removed in v2). Render-prop pattern `({ checked, disabled }: { checked: boolean; disabled: boolean })` confirmed working.
- `useOptimizationStream` called in `RightPanel` (always-mounted component) — not in `GoalSelector` or `OptimizeButton`, as the story specified. This ensures the three Tauri event listeners are registered for the full session lifetime.
- Mocked `useOptimizationStream` in `RightPanel.test.tsx` to avoid `listen()` from `@tauri-apps/api/event` running in jsdom.
- Empty context banner uses local `useState(isBannerDismissed)` — no store pollution. Auto-dismisses when `isEmptyContext` becomes false (context panel populated). Manual dismiss via × button.
- Kept "Suggestion list — Story 3.4" placeholder stub — removal is Story 3.4's responsibility.
- `pnpm tsc --noEmit`: zero errors. `pnpm vitest run`: 244 tests pass (29 new).

### File List

- `lebo/src/features/optimization/GoalSelector.tsx` (new)
- `lebo/src/features/optimization/GoalSelector.test.tsx` (new)
- `lebo/src/features/optimization/OptimizeButton.tsx` (new)
- `lebo/src/features/optimization/OptimizeButton.test.tsx` (new)
- `lebo/src/features/layout/RightPanel.tsx` (modified — added GoalSelector, OptimizeButton, useOptimizationStream, empty context note)
- `lebo/src/features/layout/RightPanel.test.tsx` (new)

### Review Findings

- [x] [Review][Patch] AC3: OptimizeButton absent when no build — moved outside activeBuild branch with `disabled={!activeBuild}`; now visible/disabled per spec [RightPanel.tsx] — fixed
- [x] [Review][Patch] Double-submit possible — `disabled={disabled || isOptimizing}` missing; keyboard Enter could fire during optimization [OptimizeButton.tsx:12] — fixed
- [x] [Review][Patch] `isBannerDismissed` not reset on build switch — added `useEffect` reset on `activeBuild?.id` change [RightPanel.tsx] — fixed
- [x] [Review][Patch] `initialState` captured at module-eval time in GoalSelector test — moved capture to `beforeAll` [GoalSelector.test.tsx] — fixed
- [x] [Review][Patch] "disabled when isOptimizing" GoalSelector test was vacuous — now asserts `aria-disabled="true"` on each Radio option [GoalSelector.test.tsx] — fixed
- [x] [Review][Defer] contextData null guard — TS type contract enforces non-null at schema boundary — deferred, pre-existing
- [x] [Review][Defer] Optimization in-flight when build switches (no cancellation) — Story 3.2 cleanup concern — deferred, pre-existing
- [x] [Review][Defer] Story 3.4 placeholder `<p>` renders outside activeBuild branch — Story 3.4 will replace with real content — deferred, pre-existing
- [x] [Review][Defer] `scores` null guard belongs to ScoreGauge, not 3.3 scope — deferred, pre-existing
- [x] [Review][Defer] Collapsed panel shows no "Analyzing…" indicator during optimization — UX gap beyond 3.3 scope — deferred, pre-existing

## Change Log

| Date | Change |
|------|--------|
| 2026-04-24 | Story created from epics.md. Stories 3.1 + 3.2 done. Status → ready-for-dev. |
| 2026-04-24 | All tasks implemented. 244 tests pass, 0 tsc errors. Status → review. |
| 2026-04-24 | Code review complete. 5 patches applied (AC3 button always visible, keyboard double-submit guard, banner reset on build switch, test baseline capture fix, vacuous disabled test strengthened). 245 tests pass. Status → done. |
