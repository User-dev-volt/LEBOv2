# Story 7.6: Optimization Backward Compatibility and Re-Run / Clear

Status: done

## Story

As a theory-crafter,
I want to clear all current suggestions and re-run optimization with my updated build state or slider position, and confirm that all Phase 1 optimization behaviors (streaming, before/after scoring) still work correctly,
So that I can iterate on my build without stale suggestions cluttering the panel.

## Acceptance Criteria

**AC1 — Clear suggestions and re-run:**
Given AI suggestions are displayed in the optimization section,
when the player clicks the "Clear suggestions" button in the suggestions list,
then all existing suggestions are cleared from the display (no re-run triggered); the player may then click Optimize to send a fresh request with the current build state, slider position, and gear context (FR42).

When the player clicks the Optimize button (with or without existing suggestions showing),
then `startOptimization()` clears existing suggestions first, then sends a fresh request — this behavior is already implemented and must not regress.

**AC2 — Streaming regression (FR39):**
Given the optimization stream is running,
when partial AI output arrives via `optimization:suggestion-received` events,
then each suggestion renders incrementally as it arrives; the text is readable as partial output (not a loading skeleton after the first suggestion lands).

**AC3 — Before/after scoring regression (FR40):**
Given the AI returns a complete suggestion,
when the suggestion is displayed in the panel,
then `deltaDamage`, `deltaSurvivability`, and `deltaSpeed` fields computed in `useOptimizationStream` are present on the `SuggestionResult` and rendered in the `SuggestionCard` before/after score comparison.

**AC4 — Migrated builds sync slider position (FR36):**
Given a Phase 1 build with `goalPreset` was migrated by `migrateBuildState()` to a `sliderPosition`/`fineTuneWeights` pair (stored in `BuildState`),
when the player loads that build via `loadBuild()` or creates/switches to any build,
then `optimizationStore.sliderPosition` updates to match `activeBuild.sliderPosition` and `optimizationStore.fineTuneWeights` updates to match `activeBuild.fineTuneWeights` — the slider UI reflects the loaded build's saved position.

When the player moves the master slider or adjusts fine-tune sub-sliders,
then `activeBuild.sliderPosition` / `activeBuild.fineTuneWeights` in `buildStore` are updated (marks build as `isPersisted: false`) so the next auto-save persists the current slider state.

When the active build changes (any build switch or clear),
then `optimizationStore.clearSuggestions()` is called so stale suggestions from the previous build do not show.

**AC5 — API key stays in Rust (NFR5):**
No TypeScript code at any layer reads, stores, or transmits the Anthropic API key or OpenRouter key. All optimization API calls are made exclusively from Rust via `invoke_claude_api`. This is a verified invariant — no code change required, but new code must not violate it.

**AC6 — Optimize button always visible (UX-DR9):**
The Optimize button in the right panel remains pinned in the lower optimization section and is visible without scrolling. No code change required — verified invariant in `RightPanel.tsx`.

## Tasks / Subtasks

- [x] Task 1: Add `setActiveBuildSliderPosition` and `setActiveBuildFineTuneWeights` to `buildStore` (AC4)
  - [x] 1.1: In `lebo/src/shared/stores/buildStore.ts`, add import for `FineTuneWeights` type at the top alongside the existing `BuildState` import:
    ```ts
    import type { BuildState, BuildMeta, ApplyNodeResult, GearItemV2, ActiveSkill, IdolItem } from '../types/build'
    import type { FineTuneWeights } from '../types/optimization'
    ```
  - [x] 1.2: Add two new actions to the `BuildStore` interface (after `updateContextIdols`):
    ```ts
    setActiveBuildSliderPosition: (pos: number) => void
    setActiveBuildFineTuneWeights: (weights: FineTuneWeights | null) => void
    ```
  - [x] 1.3: Implement the actions in the `create()` body (after `updateContextIdols` implementation):
    ```ts
    setActiveBuildSliderPosition: (pos) =>
      set((s) =>
        s.activeBuild
          ? {
              activeBuild: {
                ...s.activeBuild,
                sliderPosition: Math.max(0, Math.min(100, pos)),
                isPersisted: false,
                updatedAt: new Date().toISOString(),
              },
            }
          : {}
      ),
    setActiveBuildFineTuneWeights: (weights) =>
      set((s) =>
        s.activeBuild
          ? {
              activeBuild: {
                ...s.activeBuild,
                fineTuneWeights: weights,
                isPersisted: false,
                updatedAt: new Date().toISOString(),
              },
            }
          : {}
      ),
    ```

- [x] Task 2: Dual-write slider changes to `buildStore` from `OptimizationSlider` (AC4)
  - [x] 2.1: In `lebo/src/features/optimization/OptimizationSlider.tsx`, add `useBuildStore` import:
    ```ts
    import { useBuildStore } from '../../shared/stores/buildStore'
    ```
  - [x] 2.2: In the `OptimizationSlider` component body, destructure `setActiveBuildSliderPosition` from the store:
    ```ts
    const setActiveBuildSliderPosition = useBuildStore((s) => s.setActiveBuildSliderPosition)
    ```
  - [x] 2.3: In the keyboard handler (`handleKeyDown`), update both stores when the position changes:
    ```ts
    // Before (Left arrow):
    setSliderPosition(Math.max(0, sliderPosition - 5))
    setActiveBuildSliderPosition(Math.max(0, sliderPosition - 5))
    // Before (Right arrow):
    setSliderPosition(Math.min(100, sliderPosition + 5))
    setActiveBuildSliderPosition(Math.min(100, sliderPosition + 5))
    ```
  - [x] 2.4: In the range input's `onChange` handler, also call `setActiveBuildSliderPosition`:
    ```ts
    onChange={(e) => {
      const val = Number(e.target.value)
      setSliderPosition(val)
      setActiveBuildSliderPosition(val)
    }}
    ```
    (Locate the existing `onChange` on the `<input type="range">` in `OptimizationSlider.tsx` and update it.)

- [x] Task 3: Dual-write fine-tune changes to `buildStore` from `FineTunePanel` (AC4)
  - [x] 3.1: In `lebo/src/features/optimization/FineTunePanel.tsx`, add `useBuildStore` import:
    ```ts
    import { useBuildStore } from '../../shared/stores/buildStore'
    ```
  - [x] 3.2: In the `FineTunePanel` component body, destructure `setActiveBuildFineTuneWeights`:
    ```ts
    const setActiveBuildFineTuneWeights = useBuildStore((s) => s.setActiveBuildFineTuneWeights)
    ```
  - [x] 3.3: In `handleChange`, call both stores after computing the new weights:
    ```ts
    const handleChange = (field: keyof FineTuneWeights, value: number) => {
      const current: FineTuneWeights = fineTuneWeights ?? {
        damage: derivedDamage,
        survivability: derivedSurvivability,
        speed: derivedSpeed,
      }
      const next = { ...current, [field]: value }
      setFineTuneWeights(next)
      setActiveBuildFineTuneWeights(next)
    }
    ```

- [x] Task 4: Sync `optimizationStore` from `buildStore` on build switch in `App.tsx` (AC4)
  - [x] 4.1: In `lebo/src/App.tsx`, add a new `useEffect` alongside the existing `useBuildStore.subscribe` effects. Place it after the existing nodeAllocations subscription (after line 88):
    ```ts
    useEffect(() => {
      return useBuildStore.subscribe((state, prev) => {
        if (state.activeBuild?.id === prev.activeBuild?.id) return
        const build = state.activeBuild
        useOptimizationStore.getState().setSliderPosition(build?.sliderPosition ?? 50)
        useOptimizationStore.getState().setFineTuneWeights(build?.fineTuneWeights ?? null)
        useOptimizationStore.getState().clearSuggestions()
      })
    }, [])
    ```
    This handles: loading a saved build, creating a new build, clearing the active build, and importing a build — any time `activeBuild.id` changes.

- [x] Task 5: Add "Clear suggestions" button to `SuggestionsList` (AC1)
  - [x] 5.1: In `lebo/src/features/optimization/SuggestionsList.tsx`, destructure `clearSuggestions` from `useOptimizationStore` (add after the existing store subscriptions near the top of `SuggestionsList`):
    ```ts
    const clearSuggestions = useOptimizationStore((s) => s.clearSuggestions)
    ```
  - [x] 5.2: When `suggestions.length > 0` and `!isOptimizing`, render a "Clear suggestions" button below the count label and above the suggestion list. Insert it between the count `<p>` tag and the suggestions `role="list"` `<div>`:
    ```tsx
    {suggestions.length > 0 && !isOptimizing && (
      <button
        onClick={clearSuggestions}
        data-testid="clear-suggestions-button"
        className="text-xs self-start"
        style={{ color: 'var(--color-text-muted)', textDecoration: 'underline' }}
      >
        Clear suggestions
      </button>
    )}
    ```

- [x] Task 6: Tests (AC1, AC4)
  - [x] 6.1: In `lebo/src/features/optimization/SuggestionsList.test.tsx`, add two tests:
    ```ts
    it('renders "Clear suggestions" button when suggestions are present and not optimizing', () => {
      useOptimizationStore.setState({ suggestions: [makeSuggestion(1)], isOptimizing: false })
      useBuildStore.setState({ activeBuild: MOCK_BUILD })
      render(<SuggestionsList onRetry={vi.fn()} />)
      expect(screen.getByTestId('clear-suggestions-button')).toBeInTheDocument()
    })

    it('clicking Clear suggestions calls clearSuggestions on the store', async () => {
      useOptimizationStore.setState({ suggestions: [makeSuggestion(1)], isOptimizing: false })
      useBuildStore.setState({ activeBuild: MOCK_BUILD })
      render(<SuggestionsList onRetry={vi.fn()} />)
      await act(async () => {
        fireEvent.click(screen.getByTestId('clear-suggestions-button'))
      })
      expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
    })
    ```
  - [x] 6.2: In `lebo/src/shared/stores/buildStore.test.ts`, add tests for new actions:
    ```ts
    describe('setActiveBuildSliderPosition', () => {
      it('updates sliderPosition and marks build not persisted', () => {
        // Set up an active build first (use createBuild or setActiveBuild)
        // Then call setActiveBuildSliderPosition(75)
        // Expect activeBuild.sliderPosition === 75 and isPersisted === false
      })
      it('clamps to [0, 100]', () => {
        // Call setActiveBuildSliderPosition(150)
        // Expect activeBuild.sliderPosition === 100
      })
      it('no-ops when no active build', () => {
        // With activeBuild: null, call setActiveBuildSliderPosition(50)
        // Expect no state change (activeBuild remains null)
      })
    })

    describe('setActiveBuildFineTuneWeights', () => {
      it('updates fineTuneWeights and marks build not persisted', () => {
        // Call setActiveBuildFineTuneWeights({ damage: 40, survivability: 40, speed: 20 })
        // Expect activeBuild.fineTuneWeights to match
      })
      it('accepts null to clear fine-tune override', () => {
        // Call setActiveBuildFineTuneWeights(null)
        // Expect activeBuild.fineTuneWeights === null
      })
    })
    ```
    Note: look at existing `buildStore.test.ts` patterns for how to set up a build before testing — use `useBuildStore.setState(...)` directly or the existing test helpers in that file.
  - [x] 6.3: Run `pnpm vitest src/features/optimization/SuggestionsList.test.ts` — all existing tests must remain green.
  - [x] 6.4: Run `pnpm vitest src/shared/stores/buildStore.test.ts` — all existing tests must remain green.
  - [x] 6.5: Run `pnpm vitest` — full suite must pass (0 failures).

## Dev Notes

### The two gaps this story closes

**Gap 1 — Slider state not persisted when user changes it:**
`OptimizationSlider` calls `optimizationStore.setSliderPosition(val)` for UI reactivity, but `buildStore.activeBuild.sliderPosition` is never updated. Since `useAutoSave` calls `saveBuild(activeBuild)` where `activeBuild` is the `buildStore` object, any slider change made by the user is lost on save. Tasks 1–3 fix this via dual-write.

**Gap 2 — Loaded build's slider position not reflected in UI:**
`loadBuild()` calls `setActiveBuild(build)` which stores `build.sliderPosition` in `buildStore`, but `optimizationStore.sliderPosition` is not updated. The slider renders from `optimizationStore`, so it always shows the pre-load value. Task 4 fixes this with a `buildStore.subscribe()` that syncs on build-id change.

### Why subscribe in App.tsx rather than inside `loadBuild()`

Adding `useOptimizationStore.getState().setSliderPosition(...)` directly to `loadBuild()` would handle the explicit load path, but would miss:
- `createBuild()` in buildStore — creates a new build with `sliderPosition: 50`, doesn't call `loadBuild`
- Import flow — may call `setActiveBuild` directly
- Any future code path that changes `activeBuild`

The `activeBuild?.id` subscription in App.tsx is the single reliable gate that fires on ANY build switch, regardless of how it was triggered.

### Guard: don't sync on nodeAllocations changes

The existing `useBuildStore.subscribe` in `App.tsx` uses `state.activeBuild?.nodeAllocations === prev.activeBuild?.nodeAllocations` as an early exit. The new subscription uses `state.activeBuild?.id === prev.activeBuild?.id` as an early exit. These do NOT interfere — the id check prevents the slider sync from firing on every node allocation click.

### Clear button UX: clear-only, not re-run

AC1 separates "Clear" (dismiss stale suggestions without re-running) from "Optimize" (which calls `startOptimization()` → clears then re-runs). The "Clear suggestions" button calls only `clearSuggestions()`. The Optimize button is the re-run affordance. This matches FR42: "players can clear all suggestions and re-run optimization" — both affordances are present, the clear is optional, the re-run is via Optimize.

The Clear button is hidden while `isOptimizing` to avoid clearing mid-stream.

### `clearSuggestions()` in `optimizationStore` resets ALL suggestion-related state

`clearSuggestions()` (line 57 of `optimizationStore.ts`) resets: `suggestions`, `skippedSuggestions`, `appliedRanks`, `previewSuggestionRank`, `highlightedNodeIds`, `streamError`, `hasOptimizationCompleted`, `currentModel`. This is the correct reset for a build switch — no stale state leaks.

### OptimizationSlider keyboard handler location

In `OptimizationSlider.tsx` the keyboard handler is on the `<input type="range">` element's `onKeyDown`. Read the file to verify exact structure — but the key actions are:
- Arrow Right: `setSliderPosition(Math.min(100, sliderPosition + 5))`
- Arrow Left: `setSliderPosition(Math.max(0, sliderPosition - 5))`
Add the matching `setActiveBuildSliderPosition` call right after each `setSliderPosition` call.

### FineTunePanel's `setFineTuneWeights(null)` — no UI trigger currently

`setActiveBuildFineTuneWeights(null)` will not be called from the FineTunePanel because `handleChange` always produces a non-null weights object. The only time `fineTuneWeights` becomes null is on build switch (handled by Task 4 via `clearSuggestions`). No reset-to-null button exists in the UI — this is pre-existing design. Do not add one.

### Preserving AC2 (streaming) and AC3 (scoring) — no code change needed

Streaming behavior: `useOptimizationStream` subscribes to `optimization:suggestion-received`, `optimization:complete`, `optimization:error`, `optimization:model-active` at mount. Each `suggestion-received` event: computes `baselineScore` and `previewScore` using `calculateScore()`, produces a `SuggestionResult` with `deltaDamage`/`deltaSurvivability`/`deltaSpeed`, and calls `addSuggestion()`. This is working correctly and must not be touched by this story.

Before/after scoring: `SuggestionCard` renders `deltaDamage`, `deltaSurvivability`, `deltaSpeed` from the `SuggestionResult`. This is also working — no change needed. If a before/after rendering regression is found during testing, fix it, but do not refactor for the sake of it.

### NFR5 — API key stays in Rust

Confirm by inspection: `startOptimization()` in `useOptimizationStream.ts` calls `invokeCommand('invoke_claude_api', {...})` — the key is never passed as a parameter. Rust's `invoke_claude_api` reads the key from Stronghold internally. No change needed.

### `BuildState.sliderPosition` is optional

`build.ts` declares `sliderPosition?: number` (optional). The App.tsx subscription guard must use `build?.sliderPosition ?? 50` (not `build?.sliderPosition!`) when syncing, to handle any build that somehow has `undefined` for this field.

### Project Structure Notes

Files to **MODIFY**:

| File | Change |
|------|--------|
| `lebo/src/shared/stores/buildStore.ts` | Add `FineTuneWeights` import; add `setActiveBuildSliderPosition` and `setActiveBuildFineTuneWeights` to interface and implementation |
| `lebo/src/features/optimization/OptimizationSlider.tsx` | Import `useBuildStore`; dual-write slider changes to buildStore |
| `lebo/src/features/optimization/FineTunePanel.tsx` | Import `useBuildStore`; dual-write fine-tune changes to buildStore |
| `lebo/src/App.tsx` | Add `useBuildStore.subscribe` effect to sync slider pos on build switch |
| `lebo/src/features/optimization/SuggestionsList.tsx` | Add "Clear suggestions" button (AC1) |
| `lebo/src/features/optimization/SuggestionsList.test.tsx` | Add 2 tests for Clear button |
| `lebo/src/shared/stores/buildStore.test.ts` | Add tests for 2 new actions |

Files to **NOT touch**:
- `lebo/src/shared/stores/useOptimizationStream.ts` — streaming and scoring are correct; no regression to fix
- `lebo/src/shared/stores/optimizationStore.ts` — `clearSuggestions()` and `setSliderPosition()` already correct
- `lebo/src/features/build-manager/buildPersistence.ts` — `migrateBuildState()` and `loadBuild()` already correct; sync is handled by App.tsx subscription
- `lebo/src-tauri/` — no Rust changes; the optimization pipeline is complete
- `lebo/src/features/layout/RightPanel.tsx` — Optimize button pinning already correct
- Any optimization type files — `SuggestionResult`, `LevelContext`, `StructuredGearSlot` types are all complete

### Project Context Rules

Critical rules from `project-context.md` that apply to this story:

- **No barrel files**: Do not create `index.ts`. Import `useBuildStore` directly from `'../../shared/stores/buildStore'`.
- **Four stores only**: Do not create a fifth store. Extend `buildStore` in-place.
- **Zustand pattern**: `create<Interface>()((set, get) => ...)` with inline function bodies. No immer middleware.
- **TypeScript strict mode**: `noUnusedLocals: true` — any new import that is unused is a compile error. Every destructured store selector must be used.
- **Named exports only**: No default exports.
- **No `@apply`**: Tailwind v4 CSS-first. Use `style={{ color: 'var(--color-text-muted)' }}` inline, not class + `@apply`.
- **Design tokens**: Use `var(--color-text-muted)`, `var(--color-accent-gold)` etc. — never hardcode hex colors in React components.
- **Focus rings**: Any new interactive element (the Clear button) must have a visible focus ring: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` with `outlineColor: 'var(--color-accent-gold)'`.
- **No Tauri IPC change**: This story does not add any Tauri commands. Do not modify `lib.rs`.
- **Test co-location**: Test files sit next to their source files. `SuggestionsList.test.tsx` is already co-located correctly.
- **Vitest config in `vite.config.ts`**: Do not create a separate `vitest.config.ts`.

### References

- [Source: `lebo/src/shared/stores/buildStore.ts:9-49`] — `BuildStore` interface pattern; action shapes for `setCharacterLevel`, `setBudgetEnforced` to follow for new slider actions
- [Source: `lebo/src/shared/stores/buildStore.ts:78,138`] — `sliderPosition: 50, fineTuneWeights: null` in `createBuild` — confirms these fields live on `BuildState`
- [Source: `lebo/src/shared/types/build.ts:54`] — `sliderPosition?: number` declared as optional on `BuildState`
- [Source: `lebo/src/App.tsx:73-88`] — existing `useBuildStore.subscribe` effect watching `nodeAllocations` — new effect goes after this block
- [Source: `lebo/src/App.tsx:14`] — `useOptimizationStore` already imported; `useBuildStore` already imported at line 12
- [Source: `lebo/src/features/optimization/OptimizationSlider.tsx:4,13,16`] — existing `setSliderPosition` calls (lines 13, 16 keyboard handler) and onChange location — add dual-write here
- [Source: `lebo/src/features/optimization/FineTunePanel.tsx:22-29`] — `handleChange` body — add dual-write here
- [Source: `lebo/src/features/optimization/SuggestionsList.tsx:52-64`] — store subscriptions at top of component — add `clearSuggestions` here
- [Source: `lebo/src/features/optimization/SuggestionsList.tsx:381-399`] — existing suggestions count label and role="list" block — insert Clear button between them
- [Source: `lebo/src/shared/stores/optimizationStore.ts:57-67`] — `clearSuggestions()` resets all suggestion state fields
- [Source: `lebo/src/features/build-manager/buildPersistence.ts:8-18`] — `migrateGoalPreset()` mapping (e.g. `'Maximize Damage' → sliderPosition: 100`) — the values that AC4 migration guarantees
- [Source: `lebo/src/shared/stores/useOptimizationStream.ts:36-91`] — `startOptimization()` calls `clearSuggestions()` at line 75 before the API call — AC1 re-run behavior is already correct
- [Source: `lebo/src/features/optimization/SuggestionsList.test.tsx:1-58`] — test file structure and mock patterns to follow for new tests
- [Source: `_bmad-output/implementation-artifacts/7-5-structured-gear-context-in-optimization-payload.md#Dev Notes`] — confirms `useOptimizationStore.getState().clearSuggestions()` pattern

### Review Findings

- [x] [Review][Patch] Mid-stream build switch repopulates cleared suggestions with stale data — add `optimizationBuildId: string | null` to `optimizationStore`; stamp it with `activeBuild.id` when `startOptimization()` runs; in the `optimization:suggestion-received` handler, compare stamp against `useBuildStore.getState().activeBuild?.id` and discard if mismatched; `clearSuggestions()` resets `optimizationBuildId` to `null` [optimizationStore.ts, useOptimizationStream.ts]
- [x] [Review][Patch] Stale closure in `OptimizationSlider.handleKeyDown` reads `sliderPosition` from render scope, not current store value [OptimizationSlider.tsx:12-21]
- [x] [Review][Patch] `clearSuggestions()` does not reset `isOptimizing` — build switch mid-stream leaves `isOptimizing: true`, hiding the Clear button and blocking new optimization runs [optimizationStore.ts:57]
- [x] [Review][Patch] No integration test for AC4 App.tsx subscriber wiring — no test verifies `setActiveBuild()` with new id syncs `optimizationStore.sliderPosition` and fires `clearSuggestions()`
- [x] [Review][Defer] `MOCK_BUILD.schemaVersion: 1` in `SuggestionsList.test.tsx:46` missing `sliderPosition`/`fineTuneWeights` — deferred, pre-existing fixture
- [x] [Review][Defer] `derivedSpeed` hardcoded to `0` in `FineTunePanel` — deferred, pre-existing design from story 7-2
- [x] [Review][Defer] Same-id build reload does not resync slider position — deferred, pre-existing edge case not in primary workflow
- [x] [Review][Defer] `setActiveBuildFineTuneWeights` has no input validation (NaN/Infinity possible) — deferred, pre-existing pattern across all buildStore setters

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks complete. Added `setActiveBuildSliderPosition` and `setActiveBuildFineTuneWeights` to `BuildStore` interface and implementation (Task 1). Dual-write from `OptimizationSlider` (Task 2) and `FineTunePanel` (Task 3) keeps `buildStore.activeBuild` in sync with UI slider state so auto-save persists it. Added `useBuildStore.subscribe` in `App.tsx` keyed on `activeBuild.id` to sync `optimizationStore` slider position, fine-tune weights, and clear stale suggestions on any build switch (Task 4). Added "Clear suggestions" button to `SuggestionsList` — hidden during streaming, calls `clearSuggestions()` only (Task 5). AC2 (streaming) and AC3 (before/after scoring) verified by inspection — no regressions; AC5 (API key in Rust) unchanged; AC6 (Optimize button pinned) unchanged. Targeted tests: 130 passed (0 failures). Pre-existing failures in `ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls` tests confirmed pre-existing (same 8 fail on clean stash checkout).

### File List

- `lebo/src/shared/stores/buildStore.ts`
- `lebo/src/features/optimization/OptimizationSlider.tsx`
- `lebo/src/features/optimization/FineTunePanel.tsx`
- `lebo/src/App.tsx`
- `lebo/src/features/optimization/SuggestionsList.tsx`
- `lebo/src/features/optimization/SuggestionsList.test.tsx`
- `lebo/src/shared/stores/buildStore.test.ts`

## Change Log

- 2026-05-18: Implemented story 7-6 — slider/fine-tune dual-write, build-switch sync, Clear suggestions button, and tests (all ACs satisfied)
