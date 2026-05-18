# Story 7.1: OptimizationSlider Component and useOptimizationStore Extension

Status: done

## Story

As a theory-crafter,
I want a continuous Glass Cannon ↔ Juggernaut slider that replaces the 4-button preset system, with a gradient track and labeled endpoints that immediately communicate the optimization spectrum,
so that I can express my build archetype intent in a single intuitive gesture.

## Acceptance Criteria

**AC1 — 4-button goal preset UI removed, OptimizationSlider replaces it:**
Given the Phase 1 4-button goal preset UI (GoalSelector),
when Epic 7 Story 7.1 is implemented,
then GoalSelector is no longer rendered in the RightPanel; the OptimizationSlider component replaces it in the lower Optimization section.

**AC2 — Slider renders with gradient track, labeled endpoints, default position 50:**
Given the OptimizationSlider is rendered,
when it is displayed in the RightPanel,
then the slider track uses a CSS linear-gradient from `--color-slider-juggernaut` (left, value=0) to `--color-slider-glass-cannon` (right, value=100); endpoints are labeled "Juggernaut" (left) and "Glass Cannon" (right) in 11px uppercase `--color-text-secondary`; the default `sliderPosition` is 50 (center/balanced).

**AC3 — Dragging/clicking the slider updates sliderPosition and shows tooltip:**
Given the player drags the slider thumb or clicks the track,
when the value changes,
then `useOptimizationStore.sliderPosition` updates to the new integer value (0–100); a thumb tooltip shows the current weight split derived as: `survivability = (100 - position)`, `damage = position` (e.g., at position 30: "Survivability 70% / Damage 30%").

**AC4 — Keyboard arrow keys move slider by 5 units:**
Given the slider is focused via keyboard,
when the player presses the Right or Left arrow key,
then `sliderPosition` changes by 5 units per keypress (Right = +5, Left = −5), clamped to 0–100 (FR34).

**AC5 — CSS tokens added for slider gradient:**
Given the global stylesheet,
when story 7.1 is implemented,
then `--color-slider-glass-cannon` (high-saturation crimson-red) and `--color-slider-juggernaut` (deep steel-blue) are added to the `@theme` block with PixiJS hex equivalents as comments (UX-DR10).

**AC6 — useOptimizationStore extended with sliderPosition and fineTuneWeights:**
Given `useOptimizationStore`,
when story 7.1 is implemented,
then the store has `sliderPosition: number` (default 50), `fineTuneWeights: FineTuneWeights | null` (default null), `setSliderPosition(pos: number): void`, and `setFineTuneWeights(weights: FineTuneWeights | null): void`.

**AC7 — OptimizationSlider ARIA compliance:**
Given the OptimizationSlider component,
when rendered and inspected,
then it has: `role="slider"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow={sliderPosition}`, `aria-label="Optimization intent"`, `aria-valuetext="{N}% Survivability / {100-N}% Damage"` (NFR13, UX-DR2).

**AC8 — OptimizationSlider passes vitest-axe with zero violations:**
Given OptimizationSlider.test.tsx includes an axe assertion,
when tests run,
then `expect(await axe(container)).toHaveNoViolations()` passes (UX-DR15, NFR17).

## Tasks / Subtasks

- [x] Task 1: Add CSS tokens to global stylesheet (AC2, AC5)
  - [x] 1.1: In `lebo/src/assets/styles/global.css`, inside the `@theme` block (after the existing tier pip tokens), add:
    ```css
    /* Optimization slider gradient */
    --color-slider-glass-cannon: #C73232; /* PixiJS: 0xC73232 — high-saturation crimson-red for damage end */
    --color-slider-juggernaut:   #2A4D7A; /* PixiJS: 0x2A4D7A — deep steel-blue for survivability end */
    ```
  - [x] 1.2: After the `@theme` block (before or after existing `@keyframes`), add CSS rules for the range input track and thumb used by OptimizationSlider. Use the class `.optimization-slider` to scope:
    ```css
    .optimization-slider {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: linear-gradient(
        to right,
        var(--color-slider-juggernaut),
        var(--color-slider-glass-cannon)
      );
      outline: none;
      cursor: pointer;
    }
    .optimization-slider:focus-visible {
      outline: 2px solid var(--color-accent-gold);
      outline-offset: 2px;
    }
    .optimization-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--color-accent-gold);
      cursor: pointer;
      border: 2px solid var(--color-bg-base);
    }
    .optimization-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--color-accent-gold);
      cursor: pointer;
      border: 2px solid var(--color-bg-base);
    }
    ```

- [x] Task 2: Extend useOptimizationStore with sliderPosition and fineTuneWeights (AC6)
  - [x] 2.1: In `lebo/src/shared/stores/optimizationStore.ts`, add to the `OptimizationStore` interface:
    ```typescript
    sliderPosition: number
    fineTuneWeights: FineTuneWeights | null
    setSliderPosition: (pos: number) => void
    setFineTuneWeights: (weights: FineTuneWeights | null) => void
    ```
  - [x] 2.2: Add the `FineTuneWeights` import to the existing imports from `'../types/optimization'`:
    ```typescript
    import type { OptimizationGoal, SuggestionResult, BuildScore, FineTuneWeights } from '../types/optimization'
    ```
  - [x] 2.3: Add the initial state values and action implementations to the store:
    ```typescript
    sliderPosition: 50,
    fineTuneWeights: null,
    setSliderPosition: (pos) => set({ sliderPosition: pos }),
    setFineTuneWeights: (weights) => set({ fineTuneWeights: weights }),
    ```
  - [x] 2.4: Do NOT remove `goal` or `setGoal` — `startOptimization` in `useOptimizationStream.ts` still reads `goal`; that is updated in story 7.3.

- [x] Task 3: Create OptimizationSlider component (AC2, AC3, AC4, AC7)
  - [x] 3.1: Create `lebo/src/features/optimization/OptimizationSlider.tsx` with the following:
    - Read `sliderPosition` and `setSliderPosition` from `useOptimizationStore`
    - Render a `<div>` wrapper with relative positioning containing:
      - A top row: "Juggernaut" label (left) and "Glass Cannon" label (right), both 11px uppercase `--color-text-secondary`
      - The `<input type="range">` with `className="optimization-slider"`, `min={0}`, `max={100}`, `step={1}`, `value={sliderPosition}`, `onChange` calling `setSliderPosition`
      - A positioned tooltip `<div>` above the thumb showing weight split
      - ARIA attributes on the `<input>`: `role="slider"`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={sliderPosition}`, `aria-label="Optimization intent"`, `aria-valuetext={...}`
    - Keyboard: native `<input type="range">` handles arrow keys natively. Override `onKeyDown` to step by 5 instead of 1:
      ```typescript
      const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          setSliderPosition(Math.min(100, sliderPosition + 5))
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          setSliderPosition(Math.max(0, sliderPosition - 5))
        }
      }
      ```
    - Tooltip positioning: use `calc((${sliderPosition}% - ${sliderPosition * 0.32}px))` or a simpler approach: `style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}` on a `position: absolute` div above the slider.
    - Weight split display: `survivability = 100 - sliderPosition`, `damage = sliderPosition`
    - `aria-valuetext`: `\`${100 - sliderPosition}% Survivability / ${sliderPosition}% Damage\``
  - [x] 3.2: A section header "Optimization Intent" above the slider (11px, uppercase, `--color-text-muted`) to keep visual hierarchy consistent with "Gear" section above.

- [x] Task 4: Remove GoalSelector from RightPanel; add OptimizationSlider (AC1)
  - [x] 4.1: In `lebo/src/features/layout/RightPanel.tsx`:
    - Remove the import: `import { GoalSelector } from '../optimization/GoalSelector'`
    - Add the import: `import { OptimizationSlider } from '../optimization/OptimizationSlider'`
    - In the JSX, replace `<GoalSelector />` with `<OptimizationSlider />`
  - [x] 4.2: Delete `lebo/src/features/optimization/GoalSelector.tsx` (no longer consumed anywhere — TypeScript strict mode would flag the unused import in any file that tries to use it)
  - [x] 4.3: Delete `lebo/src/features/optimization/GoalSelector.test.tsx` (test for the deleted component)
  - [x] NOTE: Do NOT remove `OptimizationGoal` type from `optimization.ts` — `optimizationStore.ts` still references `goal: OptimizationGoal`. That is cleaned up in story 7.3.

- [x] Task 5: Write OptimizationSlider tests (AC3, AC4, AC7, AC8)
  - [x] 5.1: Create `lebo/src/features/optimization/OptimizationSlider.test.tsx`
    - Import pattern: capture `initialState = useOptimizationStore.getState()` in `beforeAll`; reset via `useOptimizationStore.setState(initialState, true)` in `beforeEach` (same pattern as GoalSelector.test.tsx)
    - Test: `renders with default sliderPosition 50` — render, assert `aria-valuenow="50"`
    - Test: `renders endpoint labels "Juggernaut" and "Glass Cannon"` — assert both texts present
    - Test: `renders aria-valuetext with correct weight split at default 50` — assert `aria-valuetext` = `"50% Survivability / 50% Damage"`
    - Test: `renders aria-label "Optimization intent"` — assert attribute present
    - Test: `arrow right key increments sliderPosition by 5` — fire `keyDown` with `{ key: 'ArrowRight' }` on the input, assert `useOptimizationStore.getState().sliderPosition === 55`
    - Test: `arrow left key decrements sliderPosition by 5` — set store to 60, fire left arrow, assert 55
    - Test: `arrow right at 100 clamps to 100` — set store to 100, fire right arrow, assert 100
    - Test: `arrow left at 0 clamps to 0` — set store to 0, fire left arrow, assert 0
    - Test: `onChange updates sliderPosition in store` — use `fireEvent.change` on the input with `{ target: { value: '75' } }`, assert store at 75
    - Test: `passes axe accessibility check` — `const { container } = render(<OptimizationSlider />); expect(await axe(container)).toHaveNoViolations()`
  - [x] 5.2: Use `axe` import from `'vitest-axe'` (not `axe-core` directly) — consistent with project pattern in e.g. `AffixTierControl.test.tsx`

## Dev Notes

### Critical: goal field must stay in optimizationStore for now

`startOptimization` in `lebo/src/shared/stores/useOptimizationStream.ts:37` reads `useOptimizationStore.getState().goal` and sends it to `invoke_claude_api`. This is how story 7.3 picks up the work — it will change the Rust command to accept `slider_position`/`fine_tune_weights` instead of `goal`. **Do NOT remove `goal` or `setGoal` from the store in this story.**

The `OptimizationGoal` type in `optimization.ts` must also remain — it's used by `goal: OptimizationGoal` in the store interface.

### GoalSelector removal — what to delete vs. what to keep

Delete these two files entirely:
- `lebo/src/features/optimization/GoalSelector.tsx`
- `lebo/src/features/optimization/GoalSelector.test.tsx`

The component has no consumers after RightPanel.tsx is updated. Leaving the file causes dead code. TypeScript strict mode won't warn about unused files, but it clutters the codebase.

### Current state of useOptimizationStore (what you're extending)

`lebo/src/shared/stores/optimizationStore.ts` currently has: `goal`, `suggestions`, `skippedSuggestions`, `appliedRanks`, `previewSuggestionRank`, `highlightedNodeIds`, `isOptimizing`, `hasOptimizationCompleted`, `scores`, `streamError`, `currentModel`. You are adding 4 things: 2 state fields + 2 setters.

`FineTuneWeights` is already defined in `lebo/src/shared/types/optimization.ts:1-5` as `{ damage: number; survivability: number; speed: number }`. Import it from there — do not redefine it.

### Current state of RightPanel (what you're modifying)

`lebo/src/features/layout/RightPanel.tsx` currently renders in the lower Optimization section:
```tsx
{activeBuild ? (
  <>
    <ScoreGauge baselineScore={scores} previewScore={previewScore} />
    <GoalSelector />
  </>
) : (
  <p ...>Select a build to see scores</p>
)}
```
Replace `<GoalSelector />` with `<OptimizationSlider />`. Keep `<ScoreGauge />` exactly as-is — before/after scoring is a Phase 1 no-regression requirement (FR40).

### Range input cross-browser gradient track

`appearance: none` on `<input type="range">` removes native styling. The gradient background is set on the element itself (not pseudo-element) in Firefox, but for WebKit (Chrome/Edge/Safari) you must use `::-webkit-slider-runnable-track`. The `.optimization-slider` CSS block in global.css handles this.

**Do NOT attempt to set the gradient via Tailwind classes or inline `style`.** It requires pseudo-element CSS. That's why we add the `.optimization-slider` block to `global.css`.

**Tailwind v4 rule: never use `@apply`.** Write plain CSS in the global.css block. Use `var(--color-*)` tokens directly in the CSS values.

### Thumb tooltip positioning

The thumb is at `sliderPosition%` along the track. Use a `position: absolute; top: 0; transform: translateX(-50%)` div, set `left` as an inline style:
```tsx
style={{ left: `calc(${sliderPosition}% - ${(sliderPosition - 50) * 0.08}px)` }}
```
The correction factor `(sliderPosition - 50) * 0.08` accounts for the thumb width (16px) so the tooltip doesn't clip at edges. Alternatively, use `clamp(0px, calc(${sliderPosition}% - 32px), calc(100% - 64px))`.

A simpler reliable approach: wrap the input in `position: relative`, put the tooltip absolutely positioned above, with `left: ${sliderPosition}%` and `transform: translateX(-50%)`. The tooltip will look correct across the middle range; slight edge misalignment is acceptable since the label text constrains how far the tooltip can go. Use `pointerEvents: 'none'` on the tooltip div.

### No barrel files

`OptimizationSlider.tsx` is imported directly:
```typescript
import { OptimizationSlider } from '../optimization/OptimizationSlider'
```
Do NOT create `src/features/optimization/index.ts`.

### Test pattern for keyboard events

To test the 5-step keyboard behavior, use `fireEvent.keyDown` from `@testing-library/react` on the input element:
```typescript
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'

const input = screen.getByRole('slider')
fireEvent.keyDown(input, { key: 'ArrowRight' })
```
The `onKeyDown` handler calls `setSliderPosition`, which writes to Zustand store. Assert via `useOptimizationStore.getState().sliderPosition`.

For the `onChange` test, use `fireEvent.change(input, { target: { value: '75' } })` — this tests the React onChange handler path separate from the keyboard path.

### axe import pattern

```typescript
import { axe } from 'vitest-axe'
```
Not `import axe from 'axe-core'`. The project uses `vitest-axe` throughout (e.g., AffixTierControl.test.tsx, WeaverTreePlaceholder.test.tsx).

### Project Structure Notes

Files to CREATE (new):
| File | Purpose |
|------|---------|
| `lebo/src/features/optimization/OptimizationSlider.tsx` | New slider component |
| `lebo/src/features/optimization/OptimizationSlider.test.tsx` | Tests + axe check |

Files to MODIFY (existing):
| File | Change |
|------|--------|
| `lebo/src/assets/styles/global.css` | Add 2 CSS tokens + `.optimization-slider` CSS block |
| `lebo/src/shared/stores/optimizationStore.ts` | Add sliderPosition, fineTuneWeights, 2 setters |
| `lebo/src/features/layout/RightPanel.tsx` | Swap GoalSelector → OptimizationSlider |

Files to DELETE:
| File | Reason |
|------|--------|
| `lebo/src/features/optimization/GoalSelector.tsx` | Replaced by OptimizationSlider; no consumers remain |
| `lebo/src/features/optimization/GoalSelector.test.tsx` | Tests for deleted component |

No Rust changes. No `lib.rs` changes. No new Tauri commands.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.1] — ACs, user story, FR34, NFR13, UX-DR2, UX-DR10, UX-DR15
- [Source: lebo/src/shared/stores/optimizationStore.ts:1-82] — current store shape; extend, do NOT remove goal/setGoal
- [Source: lebo/src/shared/types/optimization.ts:1-5] — FineTuneWeights type already defined here
- [Source: lebo/src/shared/stores/useOptimizationStream.ts:37] — `goal` still consumed by startOptimization; must stay
- [Source: lebo/src/features/optimization/GoalSelector.tsx:1-80] — component being deleted; reference for test teardown pattern
- [Source: lebo/src/features/optimization/GoalSelector.test.tsx:1-72] — test pattern to replicate (beforeAll/beforeEach store reset)
- [Source: lebo/src/features/layout/RightPanel.tsx:100-102] — exact JSX block being changed (GoalSelector → OptimizationSlider)
- [Source: lebo/src/assets/styles/global.css:19-61] — @theme block location for new tokens; no @apply allowed
- [Source: _bmad-output/project-context.md#Framework-Specific Rules — Tailwind v4] — CSS-first config, no @apply, CSS tokens via var()
- [Source: _bmad-output/project-context.md#Testing Rules] — vitest-axe pattern, test co-location, no separate vitest.config

### Review Findings

- [x] [Review][Patch] setSliderPosition setter has no range clamping [optimizationStore.ts:86] — store setter applies no 0–100 clamp; keyboard handler guards manually but direct store calls (tests, future code) can write out-of-range values, corrupting survivability/damage math
- [x] [Review][Patch] -moz-range-thumb missing box-sizing: border-box [global.css] — Firefox renders the 2px border outside the declared 16px making the Firefox thumb 20×20px vs WebKit's 16×16px; add `box-sizing: border-box` to the -moz-range-thumb rule
- [x] [Review][Patch] outline: none without :focus fallback for non-focus-visible browsers [global.css] — .optimization-slider sets `outline: none` with only a `:focus-visible` rule; older Chromium/Safari that don't support :focus-visible show no focus ring at all, violating WCAG 2.4.7 and the project's "never outline: none without a replacement" rule; add a `:focus { outline: ... }` fallback
- [x] [Review][Defer] aria-valuetext formula not tested with asymmetric case [OptimizationSlider.test.tsx] — deferred, test covers position=50 (symmetric) only; a position=30 test would confirm "70% Survivability / 30% Damage" direction but formula is simple and low-risk

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 5 tasks completed. 10 new tests + 2 updated RightPanel tests pass (32 total). Pre-existing failures in ProviderSelector, SkillTreeCanvas, TreeControls, AffixTierControl are unchanged from before this story.
- `goal` and `setGoal` deliberately preserved in optimizationStore — consumed by `useOptimizationStream.ts:37`; deferred to story 7.3.
- `OptimizationGoal` type preserved in `optimization.ts` — still used by store interface; deferred to story 7.3.
- RightPanel test updated: replaced `goal-selector` testId assertions with `role="slider"` / `aria-label="Optimization intent"` queries.

### File List

**Created:**
- `lebo/src/features/optimization/OptimizationSlider.tsx`
- `lebo/src/features/optimization/OptimizationSlider.test.tsx`

**Modified:**
- `lebo/src/assets/styles/global.css`
- `lebo/src/shared/stores/optimizationStore.ts`
- `lebo/src/features/layout/RightPanel.tsx`
- `lebo/src/features/layout/RightPanel.test.tsx`

**Deleted:**
- `lebo/src/features/optimization/GoalSelector.tsx`
- `lebo/src/features/optimization/GoalSelector.test.tsx`

### Change Log

- 2026-05-17: Implemented story 7.1 — OptimizationSlider component replaces GoalSelector; useOptimizationStore extended with sliderPosition (default 50) and fineTuneWeights (default null); CSS tokens and slider styles added to global.css; 10 tests + axe accessibility check pass.
