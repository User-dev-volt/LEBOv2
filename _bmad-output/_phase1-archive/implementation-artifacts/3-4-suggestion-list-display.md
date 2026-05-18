# Story 3.4: Suggestion List Display

Status: done

## Story

As an advanced Last Epoch player,
I want to see AI optimization suggestions appear in the right panel as they stream in,
So that I can review what the AI recommends changing and why, progressively as results arrive.

## Acceptance Criteria

1. **Given** optimization completes and suggestions are in the store
   **When** the user views the right panel
   **Then** a count header shows "{N} suggestion{s} found" (e.g., "3 suggestions found", "1 suggestion found")
   **And** each `SuggestionResult` in `optimizationStore.suggestions` renders as a `SuggestionCard`

2. **Given** no suggestions exist and `isOptimizing === false`
   **When** the user views the right panel
   **Then** an empty-state message renders: "Select an optimization goal and click Optimize to get AI-powered suggestions."

3. **Given** `isOptimizing === true` and `suggestions.length === 0` (no suggestions have arrived yet)
   **When** the user views the right panel
   **Then** three pulsing skeleton cards appear below the OptimizeButton, indicating results are loading
   **And** no count header appears during this skeleton phase

4. **Given** suggestions are streaming in (new `SuggestionResult` objects added by `addSuggestion`)
   **When** each suggestion arrives
   **Then** a new `SuggestionCard` appears progressively without re-rendering existing cards
   **And** the count updates as each card appears ("1 suggestion found" → "2 suggestions found")

5. **Given** `optimizationStore.streamError` is non-null after optimization
   **When** the user views the right panel
   **Then** an error banner renders below the OptimizeButton with the error's user-facing message
   **And** the banner has a × dismiss button that calls `setStreamError(null)`
   **And** the empty-state message does NOT appear simultaneously with the error banner

6. **Given** a `SuggestionCard` is rendered for a suggestion
   **When** the user views the card
   **Then** the card shows:
   - Rank badge: `1`, `2`, `3`... (integer, monospace)
   - Type badge: `ADD`, `REMOVE`, or `SWAP` (derived from `nodeChange`)
   - Node name for `toNodeId` (looked up from `gameDataStore`) — fallback to `toNodeId` if not found
   - Change description: "Allocate N pt" / "Deallocate N pt" / "Swap" (singular "pt", not "points")
   - Three delta pills — one per score dimension — each showing `▲`/`▼`/`◈` indicator + label + value
   - Delta formatting: `+4`, `-2`, `±0`; positive in `var(--color-data-positive)`, negative in `var(--color-data-negative)`, zero/null in `var(--color-data-neutral)`

## Tasks / Subtasks

- [x] Task 1: `SuggestionCard.tsx` (AC: 6)
  - [x] Create `lebo/src/features/optimization/SuggestionCard.tsx`
  - [x] Props: `{ suggestion: SuggestionResult; toNodeName: string; fromNodeName?: string }`
  - [x] Internal helper `getChangeType(nodeChange: NodeChange): 'ADD' | 'REMOVE' | 'SWAP'`: `fromNodeId !== null` → `SWAP`; `pointsChange > 0` → `ADD`; else → `REMOVE`
  - [x] Internal `DeltaPill` sub-component: `{ label: string; value: number | null; colorVar: string }` — renders indicator + label + formatted value in one span
  - [x] Delta format helper: `formatDelta(v)`: `null → '?'`, `0 → '±0'`, positive → `'+N'`, negative → `'-N'`; indicator: `null|0 → '◈'`, positive → `▲`, negative → `▼`
  - [x] Change description: ADD → `"Allocate {pointsChange} pt"`, REMOVE → `"Deallocate {|pointsChange|} pt"`, SWAP → `"Swap"`
  - [x] Type badge colors: ADD → `var(--color-data-positive)`, REMOVE → `var(--color-data-negative)`, SWAP → `var(--color-accent-gold)`
  - [x] Three delta pills in a row: Damage (`var(--color-data-damage)`), Surv (`var(--color-data-surv)`), Speed (`var(--color-data-speed)`) — dimension color is the label color; delta value color uses positive/negative/neutral token
  - [x] Rank badge: `var(--color-accent-gold)`, monospace font, right-aligned in card header area
  - [x] `data-testid="suggestion-card-{rank}"` on card root; `data-testid="suggestion-type-badge"`, `data-testid="suggestion-node-name"`, `data-testid="delta-damage"`, `data-testid="delta-surv"`, `data-testid="delta-speed"` on respective elements
  - [x] Card background `var(--color-bg-elevated)`, rounded, padding `px-3 py-2`

- [x] Task 2: `SuggestionsList.tsx` (AC: 1–5)
  - [x] Create `lebo/src/features/optimization/SuggestionsList.tsx`
  - [x] Subscribe to `optimizationStore`: `suggestions`, `isOptimizing`, `streamError`, `setStreamError`
  - [x] Subscribe to `useBuildStore`: `activeBuild` (for `classId`, `masteryId`)
  - [x] Subscribe to `useGameDataStore`: `gameData`
  - [x] Internal `getNodeName(nodeId, gameData, classId, masteryId)` helper: look up `gameData.classes[classId].masteries[masteryId].nodes[nodeId]?.name ?? gameData.classes[classId].baseTree[nodeId]?.name ?? nodeId` — return `nodeId` as fallback
  - [x] Streaming skeleton: when `isOptimizing && suggestions.length === 0` → render three `<div>` skeleton cards with `animate-pulse` and `var(--color-bg-elevated)` fill
  - [x] Count header: `"{N} suggestion{N===1?'':'s'} found"` shown when `suggestions.length > 0`
  - [x] Error banner: when `streamError !== null` → show banner with `streamError.message`, dismiss button calls `setStreamError(null)` — same visual style as the context note in RightPanel
  - [x] Empty state: when `suggestions.length === 0 && !isOptimizing && !streamError` → show `<p>` with empty-state copy
  - [x] `data-testid="suggestions-list"` on root; `data-testid="suggestions-count"` on count header; `data-testid="suggestions-empty-state"` on empty state; `data-testid="stream-error-banner"` on error banner; `data-testid="suggestion-skeletons"` on skeleton wrapper
  - [x] No Apply button — that is Story 3.5

- [x] Task 3: Wire into `RightPanel.tsx` (AC: 1–5)
  - [x] Import `SuggestionsList` from `../optimization/SuggestionsList`
  - [x] Replace `<p className="text-xs" ...>Suggestion list — Story 3.4</p>` with `<SuggestionsList />`
  - [x] No other changes to RightPanel — SuggestionsList manages its own store subscriptions

- [x] Task 4: Tests (AC: 1–6)
  - [x] `SuggestionCard.test.tsx`: renders rank, type badge, node name, change description; all three delta pills; ADD/REMOVE/SWAP type derivation; delta colors correct for positive/negative/null; `data-testid` attributes present
  - [x] `SuggestionsList.test.tsx`: empty state when no suggestions + not optimizing; skeleton visible when `isOptimizing && suggestions.length === 0`; count header updates as suggestions added; error banner shown and dismissible; renders SuggestionCard per suggestion
  - [x] `RightPanel.test.tsx`: add test that `suggestions-list` testid is present when build is loaded; add test that placeholder text "Story 3.4" is gone
  - [x] Run `pnpm tsc --noEmit` + `pnpm vitest run` — both pass

## Dev Notes

### Critical: Existing Infrastructure — DO NOT Reinvent

| What | Where |
|------|-------|
| `SuggestionResult` type | `src/shared/types/optimization.ts` |
| `NodeChange` type | `src/shared/types/optimization.ts` |
| `BuildScore` type | `src/shared/types/optimization.ts` |
| `useOptimizationStore` — `suggestions`, `isOptimizing`, `streamError`, `setStreamError` | `src/shared/stores/optimizationStore.ts` |
| `useBuildStore` — `activeBuild` (has `classId`, `masteryId`) | `src/shared/stores/buildStore.ts` |
| `useGameDataStore` — `gameData` | `src/shared/stores/gameDataStore.ts` |
| `GameData` / `GameNode` types | `src/shared/types/gameData.ts` |
| `ScoreGauge` (already supports `previewScore` comparison mode for Story 3.5) | `src/features/optimization/ScoreGauge.tsx` |
| Design tokens for delta colors | `src/assets/styles/global.css` |

`SuggestionResult` already has `deltaDamage`, `deltaSurvivability`, `deltaSpeed` (computed by `useOptimizationStream.ts` via `calculateScore`). Do NOT recalculate deltas in this story.

---

### Change Type Derivation

`SuggestionResult` has no explicit `type` field — it was not in the NDJSON schema from Claude. Derive it from `nodeChange`:

```typescript
function getChangeType(nodeChange: NodeChange): 'ADD' | 'REMOVE' | 'SWAP' {
  if (nodeChange.fromNodeId !== null) return 'SWAP'
  return nodeChange.pointsChange > 0 ? 'ADD' : 'REMOVE'
}
```

`fromNodeId` is the node being **unallocated** in a swap; `toNodeId` is the node being **allocated**.

---

### Node Name Lookup Pattern

`SuggestionsList` does the lookup (store access), not `SuggestionCard` (keeps card purely presentational):

```typescript
function getNodeName(
  nodeId: string,
  gameData: GameData | null,
  classId: string,
  masteryId: string
): string {
  if (!gameData) return nodeId
  const classData = gameData.classes[classId]
  if (!classData) return nodeId
  return (
    classData.masteries[masteryId]?.nodes[nodeId]?.name ??
    classData.baseTree[nodeId]?.name ??
    nodeId  // fallback to raw ID if not found
  )
}
```

Pass `toNodeName` and (for SWAP) `fromNodeName` as props to `SuggestionCard`.

---

### Delta Pill Implementation

```tsx
function formatDelta(v: number | null): string {
  if (v === null) return '?'
  if (v === 0) return '±0'
  return v > 0 ? `+${v}` : String(v)
}

function getDeltaIndicator(v: number | null): string {
  if (v === null || v === 0) return '◈'
  return v > 0 ? '▲' : '▼'
}

function getDeltaColor(v: number | null): string {
  if (v === null || v === 0) return 'var(--color-data-neutral)'
  return v > 0 ? 'var(--color-data-positive)' : 'var(--color-data-negative)'
}
```

Render three pills in one row:

```tsx
<div className="flex items-center gap-3 mt-1">
  <DeltaPill label="DMG" value={suggestion.deltaDamage} axisColor="var(--color-data-damage)" />
  <DeltaPill label="SUR" value={suggestion.deltaSurvivability} axisColor="var(--color-data-surv)" />
  <DeltaPill label="SPD" value={suggestion.deltaSpeed} axisColor="var(--color-data-speed)" />
</div>
```

`DeltaPill` renders: `<span style={{ color: getDeltaColor(value) }}>{getDeltaIndicator(value)} <span style={{ color: axisColor }}>{label}</span> {formatDelta(value)}</span>`

---

### Streaming Skeleton

While `isOptimizing && suggestions.length === 0`, render 3 skeleton cards so the user sees instant visual feedback:

```tsx
{[0, 1, 2].map((i) => (
  <div
    key={i}
    className="rounded px-3 py-2 animate-pulse"
    style={{ backgroundColor: 'var(--color-bg-elevated)', height: '64px' }}
    aria-hidden="true"
  />
))}
```

Once the first suggestion arrives (`suggestions.length > 0`), the skeletons disappear and real cards render.

---

### Count Header Plural Logic

```typescript
const count = suggestions.length
const label = count === 1 ? '1 suggestion found' : `${count} suggestions found`
```

Only show count header when `suggestions.length > 0`. During skeleton phase, omit the header.

---

### Error Banner

Reuse the visual style of the context note in `RightPanel.tsx`:

```tsx
{streamError && (
  <div
    className="flex items-start gap-2 px-3 py-2 rounded text-xs"
    style={{
      backgroundColor: 'var(--color-bg-elevated)',
      color: 'var(--color-data-negative)',
      borderLeft: '2px solid var(--color-data-negative)',
    }}
    data-testid="stream-error-banner"
  >
    <span className="flex-1">{streamError.message}</span>
    <button
      onClick={() => setStreamError(null)}
      aria-label="Dismiss error"
      className="shrink-0 leading-none"
      style={{ color: 'var(--color-text-muted)' }}
    >
      ×
    </button>
  </div>
)}
```

`streamError.message` comes from `normalizeAppError` in the stream hook — it's already user-facing language (e.g., "Couldn't reach the AI engine. Check your API key and internet connection."). Do NOT re-format or re-wrap it.

---

### Design Tokens Reference

| Token | Use |
|-------|-----|
| `var(--color-bg-elevated)` | Card background, skeleton fill |
| `var(--color-bg-hover)` | Card hover background |
| `var(--color-text-primary)` | Node name |
| `var(--color-text-secondary)` | Change description |
| `var(--color-text-muted)` | Empty state copy |
| `var(--color-accent-gold)` | Rank badge, SWAP type badge |
| `var(--color-data-positive)` | ADD type badge, positive delta value |
| `var(--color-data-negative)` | REMOVE type badge, negative delta value, error banner |
| `var(--color-data-neutral)` | Zero/null delta value |
| `var(--color-data-damage)` | Damage dimension label in delta pills |
| `var(--color-data-surv)` | Survivability dimension label |
| `var(--color-data-speed)` | Speed dimension label |
| `var(--font-mono)` | Rank badge number, delta values |

---

### RightPanel Layout After This Story

```
PanelCollapseToggle
────────────────────
[if activeBuild]
  ScoreGauge           (existing, baseline only — previewScore wired in Story 3.5)
  GoalSelector
[else]
  "Select a build to see scores"
────────────────────
OptimizeButton         (always visible, disabled when !activeBuild)
[context note if applicable]
─────────────────���──
SuggestionsList        (NEW — replaces the placeholder paragraph)
  - error banner (if streamError)
  - skeletons (if isOptimizing && length === 0)
  - count header (if length > 0)
  - SuggestionCard × N
  - empty state (if length === 0 && !isOptimizing && !streamError)
```

---

### ScoreGauge — No Changes Needed

`ScoreGauge` already supports `previewScore?: BuildScore | null` for comparison mode (Story 3.1). Story 3.5 will wire `previewScore` from a hovered suggestion. Story 3.4 does NOT touch `ScoreGauge` — leave `previewScore` unset.

---

### No Apply Button in This Story

Story 3.5 adds Apply / Dismiss to each card and the "Apply All" footer. `SuggestionCard.tsx` in this story has NO interactive controls beyond display. Do not add onClick handlers or Apply buttons — this prevents accidental UI without backend support and keeps the story scope clean.

Story 3.5 will either add an `onApply` / `onDismiss` prop to `SuggestionCard`, or wrap it in an interaction layer. Do NOT pre-plumb those props.

---

### Patterns From Previous Stories

- No barrel `index.ts` files — import directly from file paths
- Tailwind v4 CSS-first: `className` for layout/spacing, `style={{ color: 'var(--color-...)' }}` for design tokens
- Test files co-located: `SuggestionCard.test.tsx` next to `SuggestionCard.tsx`
- Mock Zustand stores: `useOptimizationStore.setState(overrides, true)` to reset between tests
- Mock `@tauri-apps/api/event` in any test file that imports hooks that call `listen`
- `renderHook()` outside `act()` — React 19 requirement (see 3.2 completion notes)
- Run `pnpm tsc --noEmit` before marking complete

---

### File Locations

**New files:**
- `lebo/src/features/optimization/SuggestionCard.tsx`
- `lebo/src/features/optimization/SuggestionCard.test.tsx`
- `lebo/src/features/optimization/SuggestionsList.tsx`
- `lebo/src/features/optimization/SuggestionsList.test.tsx`

**Modified files:**
- `lebo/src/features/layout/RightPanel.tsx` — replace placeholder `<p>` with `<SuggestionsList />`
- `lebo/src/features/layout/RightPanel.test.tsx` — add SuggestionsList integration tests, remove placeholder assertion

---

### Regression Warning

`RightPanel.tsx` currently has exactly one line to replace:
```tsx
<p
  className="text-xs"
  style={{ color: 'var(--color-text-muted)' }}
>
  Suggestion list — Story 3.4
</p>
```
Replace it with `<SuggestionsList />`. Do NOT restructure any other part of RightPanel — the ScoreGauge, GoalSelector, OptimizeButton, and context note were all finalized in Story 3.3 and are tested. Any refactor risks breaking 245 passing tests.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Created `SuggestionCard.tsx`: purely presentational card with rank badge, ADD/REMOVE/SWAP type badge, node name, change description, and three delta pills (DMG/SUR/SPD) with positive/negative/neutral color tokens. `getChangeType` derives type from `nodeChange.fromNodeId` and `pointsChange`. `DeltaPill` sub-component uses `testId` prop to apply `data-testid` attributes.
- Created `SuggestionsList.tsx`: subscribes to `optimizationStore`, `buildStore`, and `gameDataStore`. Renders streaming skeletons (3 pulse cards) while `isOptimizing && suggestions.length === 0`, progressive cards + count header once suggestions arrive, error banner with dismiss, and empty state when idle.
- `getNodeName` helper looks up mastery nodes → base tree → nodeId fallback.
- Wired `<SuggestionsList />` into `RightPanel.tsx`, replacing the Story 3.4 placeholder `<p>`.
- Added 40 new tests (24 in SuggestionCard, 14 in SuggestionsList, 3 in RightPanel). All 285 tests pass. `pnpm tsc --noEmit` clean.

### File List

- `lebo/src/features/optimization/SuggestionCard.tsx` (new)
- `lebo/src/features/optimization/SuggestionCard.test.tsx` (new)
- `lebo/src/features/optimization/SuggestionsList.tsx` (new)
- `lebo/src/features/optimization/SuggestionsList.test.tsx` (new)
- `lebo/src/features/layout/RightPanel.tsx` (modified — import + placeholder replaced)
- `lebo/src/features/layout/RightPanel.test.tsx` (modified — 3 new tests added)

### Review Findings

- [x] [Review][Patch] Non-unique `key={suggestion.rank}` causes silent React DOM reuse if optimizer emits duplicate ranks [`SuggestionsList.tsx`, suggestions.map] — fixed: compound key `${rank}-${toNodeId}`
- [x] [Review][Patch] Skeleton wrapper div missing `flex flex-col gap-2` — three skeleton cards render flush with no spacing [`SuggestionsList.tsx`, skeleton wrapper div] — fixed: added layout classes
- [x] [Review][Patch] Skeleton renders alongside error banner when `isOptimizing && suggestions.length === 0 && streamError !== null` — error state should suppress skeletons [`SuggestionsList.tsx`, skeleton conditional] — fixed: added `!streamError` guard
- [x] [Review][Defer] `fromNodeName` declared in `SuggestionCardProps` and computed in `SuggestionsList` but never rendered — intentional scaffolding per story spec; Story 3.5 will wire SWAP source-node display [`SuggestionCard.tsx:59`, `SuggestionsList.tsx:88-92`] — deferred, intentional scaffolding
- [x] [Review][Defer] `formatDelta` has no float-rounding guard — raw floating-point noise possible if `calculateScore` returns floats [`SuggestionCard.tsx:10-14`] — deferred, calculateScore produces integers in current implementation; revisit if scoring model changes
- [x] [Review][Defer] `getChangeType` returns SWAP for any non-null `fromNodeId`, including empty string — upstream data contract issue [`SuggestionCard.tsx:39-42`] — deferred, TypeScript `string | null` type prevents empty-string in practice
- [x] [Review][Defer] `suggestions-count` visible alongside error banner when partial suggestions + streamError coexist — spec gap, mid-stream-error state not addressed [`SuggestionsList.tsx`] — deferred, reasonable UX default; address in 3.5/3.6 if feedback warrants suppression
- [x] [Review][Defer] Inline style objects created per render for DeltaPill and card divs — micro-perf concern in suggestion list [`SuggestionCard.tsx`] — deferred, premature optimization for ≤10 cards; revisit if profiling flags

## Change Log

| Date | Change |
|------|--------|
| 2026-04-24 | Story created from Epic 3 context. Stories 3.1–3.3 done. Status → ready-for-dev. |
| 2026-04-24 | Implementation complete. SuggestionCard, SuggestionsList created; RightPanel wired. 40 new tests. Status → review. |
| 2026-04-25 | Code review (Round 2 adversarial re-review). Story 3.4 scope clean — all ACs confirmed. 3 concerns identified in Story 3.5 code layered on top (noted in 3.5 file). Status remains done. |
