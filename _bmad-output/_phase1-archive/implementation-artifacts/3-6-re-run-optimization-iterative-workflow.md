# Story 3.6: Re-run Optimization & Iterative Workflow

Status: done

## Story

As an advanced Last Epoch player,
I want to re-run AI optimization after applying suggestion changes to my build,
So that I can iterate through multiple rounds of improvement — getting fresh, relevant suggestions each time — until I'm satisfied with my build.

## Acceptance Criteria

1. **Given** the user has applied one or more suggestions and the build state has changed
   **When** the user clicks "Optimize" again
   **Then** a fresh AI optimization request is sent with the updated `BuildState` (all applied changes included)
   **And** the previous suggestion list clears before the new list populates
   **And** the `ScoreGauge` updates to show new baseline scores reflecting the updated build

2. **Given** the user re-runs optimization with a different goal
   **When** the new goal is selected and "Optimize" is clicked
   **Then** the AI request includes the new goal parameter
   **And** the suggestion ranking order reflects the new goal's priority weighting

3. **Given** suggestions were skipped in a prior run
   **When** optimization is re-run
   **Then** the skipped suggestions section from the prior run is cleared — the new run starts fresh
   **And** previously-skipped nodes are not excluded from new suggestions

4. **Given** a suggestion preview is currently active (tree canvas is showing the after-state of a suggestion, `ScoreGauge` is in comparison mode)
   **When** the user clicks "Optimize"
   **Then** preview mode exits first: `allocatedNodes` returns to baseline, `ScoreGauge` clears `previewScore`, and the preview header bar ("Previewing suggestion #N") dismisses
   **And** the optimization run then begins with the correct baseline build state — not the previewed after-state

5. **Given** optimization completes and the AI returned zero suggestions
   **When** the user views the right panel
   **Then** the `SuggestionsList` empty state reads: `"Your build is well-optimized for [goal label]. Try a different goal or keep building!"`
   **And** [goal label] maps to the human-readable goal string: `'maximize_damage'` → `"Maximize Damage"`, `'maximize_survivability'` → `"Maximize Survivability"`, `'maximize_speed'` → `"Maximize Speed"`, `'balanced'` → `"Balanced"`
   **And** this message is distinct from the initial empty state ("Select an optimization goal and click Optimize…") which appears when optimization has never been run

6. **Given** the user views the right panel before ever running optimization (initial app state)
   **When** there are no suggestions and `isOptimizing === false`
   **Then** the initial empty state reads: `"Select an optimization goal and click Optimize to get AI-powered suggestions."`

## Tasks / Subtasks

- [x] Task 1: Extend `optimizationStore.ts` (AC: 5, 6)
  - [x] Add state: `hasOptimizationCompleted: boolean` — initially `false`
  - [x] Add action: `setHasOptimizationCompleted: (value: boolean) => void` — `set({ hasOptimizationCompleted: value })`
  - [x] Extend `clearSuggestions()` to also reset `hasOptimizationCompleted: false` (already resets previewSuggestionRank, skippedSuggestions, appliedRanks, highlightedNodeIds, streamError — add this alongside them)

- [x] Task 2: Update `useOptimizationStream.ts` (AC: 5)
  - [x] In the `optimization:complete` event handler: after calling `setIsOptimizing(false)`, call `useOptimizationStore.getState().setHasOptimizationCompleted(true)`

- [x] Task 3: Update `SuggestionsList.tsx` (AC: 5, 6)
  - [x] Subscribe to `hasOptimizationCompleted` and `goal` from `useOptimizationStore`
  - [x] Add module-level `GOAL_LABELS` map
  - [x] Update the empty state conditional to branch on `hasOptimizationCompleted`
  - [x] `data-testid="suggestions-empty-state"` for never-ran variant; `data-testid="suggestions-well-optimized"` for post-run zero-results variant

- [x] Task 4: Tests (AC: 1–6)
  - [x] `optimizationStore.test.ts` — 3 new tests passing
  - [x] `useOptimizationStream.test.ts` — 4 new tests passing
  - [x] `SuggestionsList.test.tsx` — 3 new tests passing
  - [x] `pnpm tsc --noEmit` — clean
  - [x] `pnpm vitest run` — 323/323 passing

## Dev Notes

### Critical: What's Already Implemented — DO NOT Reinvent

| What | Status | Where |
|------|--------|-------|
| `clearSuggestions()` already resets `skippedSuggestions`, `appliedRanks`, `previewSuggestionRank`, `highlightedNodeIds`, `streamError` | ✅ Done in Story 3.5 | `optimizationStore.ts:48–55` |
| `startOptimization` calls `clearSuggestions()` before every run | ✅ Done in Story 3.2 | `useOptimizationStream.ts:135` |
| `startOptimization` reads `activeBuild` from `useBuildStore.getState()` at call time | ✅ Done in Story 3.2 | `useOptimizationStream.ts:131` |
| `startOptimization` reads `goal` from `useOptimizationStore.getState()` at call time | ✅ Done in Story 3.2 | `useOptimizationStream.ts:132` |
| `App.tsx` auto-recalculates `scores` whenever `activeBuild.nodeAllocations` changes | ✅ Done in Story 3.1 | `App.tsx:24–38` |
| `ScoreGauge` re-renders from live `scores` in RightPanel | ✅ Done in Story 3.3 | `RightPanel.tsx:16,72` |
| Preview cleanup (previewSuggestionRank → null) already part of `clearSuggestions` | ✅ Done in Story 3.5 | `optimizationStore.ts:53` |
| `hasOptimizationCompleted` | ❌ Missing — Story 3.6 adds this | `optimizationStore.ts` |

**Summary:** ACs 1–4 are structurally satisfied by existing code. Story 3.6's only NEW implementation is the `hasOptimizationCompleted` flag + the differentiated empty state copy (AC5/6). The tests in Task 4 formally verify the ACs for the first time.

---

### Why `hasOptimizationCompleted` instead of checking other state

The UX must distinguish:
- "Never ran" → `"Select an optimization goal..."` (encourages first use)
- "Ran, 0 results" → `"Your build is well-optimized for [goal]..."` (celebrates the build, offers pivot)

The current empty state condition `suggestions.length === 0 && !isOptimizing && !streamError` covers both cases. Without `hasOptimizationCompleted`, there's no way to tell them apart.

`isOptimizing` alone won't work — it's `false` in both states after a completed run.

`streamError` won't work — it's also `null` in the zero-suggestions case.

`clearSuggestions` DOES reset `hasOptimizationCompleted: false` intentionally. During the batched `clearSuggestions()` + `setIsOptimizing(true)` calls at the top of `startOptimization`, React batches the updates (React 18 automatic batching). The component will see `isOptimizing = true` AND `hasOptimizationCompleted = false` together — which means skeletons show, not the "Select..." state.

---

### `clearSuggestions` Full Reset After This Story

```typescript
clearSuggestions: () =>
  set({
    suggestions: [],
    skippedSuggestions: [],
    appliedRanks: [],
    previewSuggestionRank: null,
    highlightedNodeIds: null,
    streamError: null,
    hasOptimizationCompleted: false,   // ← Story 3.6 addition
  }),
```

---

### `useOptimizationStream.ts` — `optimization:complete` Handler After This Story

```typescript
const unlisten2 = await listen<OptimizationCompletePayload>(
  'optimization:complete',
  () => {
    useOptimizationStore.getState().setIsOptimizing(false)
    useOptimizationStore.getState().setHasOptimizationCompleted(true)  // ← Story 3.6 addition
  },
)
```

---

### `SuggestionsList.tsx` — Updated Empty State Logic

```tsx
// Subscriptions (add to existing)
const hasOptimizationCompleted = useOptimizationStore((s) => s.hasOptimizationCompleted)
const goal = useOptimizationStore((s) => s.goal)

// Module-level constant
const GOAL_LABELS: Record<string, string> = {
  maximize_damage: 'Maximize Damage',
  maximize_survivability: 'Maximize Survivability',
  maximize_speed: 'Maximize Speed',
  balanced: 'Balanced',
}

// Replace the existing empty-state block:
{suggestions.length === 0 && !isOptimizing && !streamError && (
  hasOptimizationCompleted ? (
    <p
      className="text-xs"
      style={{ color: 'var(--color-text-muted)' }}
      data-testid="suggestions-empty-state"
      data-testid-variant="suggestions-well-optimized"
    >
      {`Your build is well-optimized for ${GOAL_LABELS[goal] ?? goal}. Try a different goal or keep building!`}
    </p>
  ) : (
    <p
      className="text-xs"
      style={{ color: 'var(--color-text-muted)' }}
      data-testid="suggestions-empty-state"
    >
      Select an optimization goal and click Optimize to get AI-powered suggestions.
    </p>
  )
)}
```

**Note on testid strategy:** The well-optimized state uses `data-testid="suggestions-empty-state"` for backward compatibility with existing tests + adds `data-testid="suggestions-well-optimized"` as a second attribute so new tests can distinguish. Do NOT use `data-testid-variant` — that's a custom attribute and `getByTestId` won't find it. Use the standard `data-testid` attribute twice in the JSX? No — HTML doesn't support duplicate attributes. 

**Correct approach**: Use `data-testid="suggestions-well-optimized"` only (not adding a second `data-testid`). Update the existing tests that check `suggestions-empty-state` to also cover the well-optimized variant by changing their test setup: existing tests run with `hasOptimizationCompleted: false` (the default initial state), which shows the "Select..." message. New tests set `hasOptimizationCompleted: true` and check `suggestions-well-optimized`.

```tsx
// Updated empty state render:
{suggestions.length === 0 && !isOptimizing && !streamError && (
  hasOptimizationCompleted ? (
    <p
      className="text-xs"
      style={{ color: 'var(--color-text-muted)' }}
      data-testid="suggestions-well-optimized"
    >
      {`Your build is well-optimized for ${GOAL_LABELS[goal] ?? goal}. Try a different goal or keep building!`}
    </p>
  ) : (
    <p
      className="text-xs"
      style={{ color: 'var(--color-text-muted)' }}
      data-testid="suggestions-empty-state"
    >
      Select an optimization goal and click Optimize to get AI-powered suggestions.
    </p>
  )
)}
```

The existing test `'shows empty state when no suggestions and not optimizing'` will still pass because:
- Default store state: `hasOptimizationCompleted: false`
- Which renders the `data-testid="suggestions-empty-state"` variant

The new tests check `data-testid="suggestions-well-optimized"`.

---

### New `useOptimizationStream.test.ts` Tests Pattern

The existing test infrastructure (mock `listen`, mock `invokeCommand`) is already in place. Follow the same pattern as the existing `startOptimization clears suggestions` test:

```typescript
it('startOptimization clears skippedSuggestions', async () => {
  // seed store
  useOptimizationStore.getState().setSuggestions([/* ... */])
  useOptimizationStore.getState().skipSuggestion(1)
  expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(1)

  const { result } = renderHook(() => useOptimizationStream())
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })

  await act(async () => { await result.current.startOptimization() })

  expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(0)
})
```

For `optimization:complete` → `hasOptimizationCompleted`:
```typescript
it('optimization:complete event sets hasOptimizationCompleted(true)', async () => {
  let completeHandler: ((event: { payload: unknown }) => void) | undefined
  mockListen.mockImplementation((eventName: string, handler: ...) => {
    if (eventName === 'optimization:complete') completeHandler = handler
    return Promise.resolve(vi.fn())
  })

  await act(async () => {
    renderHook(() => useOptimizationStream())
    await new Promise((r) => setTimeout(r, 0))
  })

  await act(async () => {
    completeHandler?.({ payload: { suggestion_count: 0 } })
  })

  expect(useOptimizationStore.getState().hasOptimizationCompleted).toBe(true)
})
```

---

### Patterns From Previous Stories

- No barrel `index.ts` files — import directly from file paths
- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ color: 'var(--color-...)' }}` for design tokens
- Test files co-located with source
- Mock Zustand stores: `useOptimizationStore.setState(overrides, true)` to reset between tests
- Mock `@tauri-apps/api/event` in any file that imports hooks calling `listen`
- Run `pnpm tsc --noEmit` before marking complete

---

### File Locations

**Modified source files:**
- `lebo/src/shared/stores/optimizationStore.ts` — add `hasOptimizationCompleted` state + action + reset in `clearSuggestions`
- `lebo/src/shared/stores/useOptimizationStream.ts` — add `setHasOptimizationCompleted(true)` in `optimization:complete` handler
- `lebo/src/features/optimization/SuggestionsList.tsx` — subscribe to new state, branch empty state, add GOAL_LABELS map

**Modified test files:**
- `lebo/src/shared/stores/optimizationStore.test.ts` — 3 new tests for new state
- `lebo/src/shared/stores/useOptimizationStream.test.ts` — 4 new tests for ACs 2–5
- `lebo/src/features/optimization/SuggestionsList.test.tsx` — 3 new tests for AC 5/6

**No new files** — all changes extend existing modules.

---

### Regression Warning

- `clearSuggestions` gains `hasOptimizationCompleted: false` — all 8 existing `clearSuggestions` tests in `optimizationStore.test.ts` still pass because they don't assert on this new key; the extended reset is additive.
- `SuggestionsList` empty state testid changes: the "never ran" case KEEPS `data-testid="suggestions-empty-state"`, so the 2 existing tests for it pass unchanged. The "well-optimized" variant uses a NEW testid. No existing tests break.
- `useOptimizationStream` gains one extra store call in `optimization:complete` handler — existing `optimization:complete event sets isOptimizing(false)` test still passes (it doesn't assert store state beyond `isOptimizing`).

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- All 4 tasks implemented. Only new state was `hasOptimizationCompleted` — ACs 1–4 were already satisfied by existing `clearSuggestions` + `startOptimization` code from 3.2/3.5.
- 10 new tests added (3 store, 4 stream, 3 UI). 323/323 total passing. TypeScript clean.
- Empty state uses distinct testids: `suggestions-empty-state` (never ran, backward-compatible) and `suggestions-well-optimized` (ran, 0 results).

### Review Findings

- [x] [Review][Defer] `GOAL_LABELS` not type-anchored to `OptimizationGoal` [`SuggestionsList.tsx:39-44`] — deferred, pre-existing pattern; out of story scope
- [x] [Review][Defer] Re-run race during active stream — deferred, pre-existing guard expected from Story 3.3 (`isOptimizing` disables Optimize button)

### File List

- `lebo/src/shared/stores/optimizationStore.ts`
- `lebo/src/shared/stores/useOptimizationStream.ts`
- `lebo/src/features/optimization/SuggestionsList.tsx`
- `lebo/src/shared/stores/optimizationStore.test.ts`
- `lebo/src/shared/stores/useOptimizationStream.test.ts`
- `lebo/src/features/optimization/SuggestionsList.test.tsx`
