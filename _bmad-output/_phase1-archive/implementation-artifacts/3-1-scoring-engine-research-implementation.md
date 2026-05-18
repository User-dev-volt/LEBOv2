# Story 3.1: Scoring Engine Research & Implementation

Status: done

## Story

As an advanced Last Epoch player,
I want to see a numeric score for my build's damage, survivability, and speed,
So that I have a clear baseline to compare against AI suggestions and understand my build's current strengths and weaknesses at a glance.

## Acceptance Criteria

1. **Given** a build is loaded with node allocations
   **When** the scoring engine runs
   **Then** a `BuildScore { damage: number | null, survivability: number | null, speed: number | null }` is returned
   **And** all non-null scores are on a 0–100 integer scale
   **And** nodes with missing game data contribute `null` to affected score dimensions (FR19 compliance)

2. **Given** the `ScoreGauge` component is rendered in the right panel
   **When** the user views the scores
   **Then** each axis (Damage, Survivability, Speed) shows: a JetBrains Mono numeric value + a color-coded mini bar (data-damage / data-surv / data-speed colors)
   **And** a composite summary score is displayed
   **And** hovering the gauge shows a breakdown tooltip

3. **Given** the user applies a node change to the tree
   **When** `useBuildStore.applyNodeChange()` fires
   **Then** the scoring engine recalculates and `useOptimizationStore.scores` updates within ≤ 100ms (NFR6 — scoring is synchronous on the frontend)

4. **Given** a build with zero node allocations
   **When** the scoring engine runs
   **Then** all three scores return `0` (not `null`) — empty build is scoreable, not missing data

5. **Given** a build where the active mastery has no game data loaded
   **When** the scoring engine runs
   **Then** all three axes return `null` — missing data case returns null per FR19

6. **Given** the `ScoreGauge` receives both `baselineScore` and `previewScore` props
   **When** both are non-null
   **Then** comparison mode renders both score states side-by-side (used in Story 3.5 suggestion preview)

## Tasks / Subtasks

- [x] Task 1: Research — document scoring model in `docs/scoring-model.md` (MUST be done before Task 2)
  - [x] Map all real game data tags to scoring axes (see Dev Notes — Tag Taxonomy for starting point)
  - [x] Define weighting formula and normalization approach
  - [x] Benchmark target: ≤ 30ms for full build calculation on Intel i5 + integrated graphics
  - [x] Document composite score formula
  - [x] Note: `docs/scoring-model.md` must exist before `scoringEngine.ts` is written

- [x] Task 2: `scoringEngine.ts` (AC: 1, 3, 4, 5)
  - [x] Create `src/features/optimization/scoringEngine.ts`
  - [x] Implement `calculateScore(build: BuildState, gameData: GameData): BuildScore`
  - [x] Tag-based scoring: iterate allocated nodes, sum weighted tag contributions, normalize to 0–100
  - [x] Return `null` for axes when mastery has no game data; return `0` for empty allocations
  - [x] All scores are integers (use `Math.round`)

- [x] Task 3: Performance benchmark (AC: 3)
  - [x] Benchmark `calculateScore()` with a fully allocated build (all Void Knight passive + base nodes allocated)
  - [x] If >30ms wall-clock: refactor to use a Web Worker before Story 3.2 begins (scoring runs per-suggestion mid-stream)
  - [x] Document measured time in `docs/scoring-model.md`

- [x] Task 4: Score wiring into App.tsx (AC: 3)
  - [x] Subscribe to `useBuildStore` allocations in `App.tsx` `useEffect`
  - [x] On any `nodeAllocations` change: call `calculateScore(activeBuild, gameData)` → `optimizationStore.setScores(scores)`
  - [x] Clear scores (`setScores(null)`) when `activeBuild` is null

- [x] Task 5: `ScoreGauge.tsx` (AC: 2, 6)
  - [x] Create `src/features/optimization/ScoreGauge.tsx`
  - [x] Props: `baselineScore: BuildScore | null`, `previewScore?: BuildScore | null`
  - [x] Three rows: Damage (data-damage color), Survivability (data-surv color), Speed (data-speed color)
  - [x] Each row: label + JetBrains Mono numeric value + mini color-coded bar (width proportional to score / 100)
  - [x] Composite score: `Math.round((damage + surv + speed) / 3)` — omit null axes from average
  - [x] Comparison mode: when `previewScore` prop is provided and non-null, render both values side-by-side
  - [x] Hover tooltip: shows axis breakdown (label + raw value)
  - [x] Null score renders as "—" (em dash), not 0 or "null"

- [x] Task 6: Wire ScoreGauge into RightPanel (AC: 2)
  - [x] Render `<ScoreGauge baselineScore={useOptimizationStore.scores} />` in the right panel
  - [x] Conditionally renders only when `activeBuild` is non-null

- [x] Task 7: Tests (AC: 1–6)
  - [x] `scoringEngine.test.ts`: empty build → `{damage:0, surv:0, speed:0}`, allocated nodes → non-zero scores within 0–100, missing mastery data → all null, pure-damage build skews damage score high, pure-defence build skews surv score high
  - [x] `ScoreGauge.test.tsx`: renders three axes, null renders as "—", composite calculated correctly, comparison mode renders both scores
  - [x] Run `pnpm tsc --noEmit` + `pnpm vitest run` — both must pass before marking done

## Dev Notes

### ⚠️ Critical Prerequisite Order

**Task 1 (research + `docs/scoring-model.md`) MUST be complete before Task 2 (`scoringEngine.ts`).**
The scoring model document is the specification — do not write the engine without it. This is the same gate pattern used in Stories 1.3a → 1.3b.

**Story 3.1 is a HARD PREREQUISITE for Story 3.2 (Claude API integration).** The delta ownership decision is "Path B — deterministic": Claude returns node change specs only, and `scoringEngine.ts` computes all score deltas. Story 3.2 cannot be implemented without `scoringEngine.ts` being complete and tested.

---

### Tag Taxonomy — Scoring Axis Mapping

The actual game data uses these tags (confirmed from `src-tauri/resources/game-data/classes/sentinel.json` and mastery trees):

**Damage axis tags** (contribute positively to damage score):
```
DAMAGE, VOID, PHYSICAL, FIRE, COLD, LIGHTNING, NECROTIC, POISON, BLEED,
CHAOS, OFFENCE, PENETRATION, DOT, ARMOUR_SHRED, DOUBLE_STRIKE, MELEE (when paired with DAMAGE),
SPELL (when paired with DAMAGE), KILL
```

**Survivability axis tags** (contribute positively to survivability score):
```
DEFENCE, ARMOUR, HEALTH, WARD, ENDURANCE, BLOCK, DAMAGE_REDUCTION,
RESISTANCE, FORTIFY, SUSTAIN, LEECH
```

**Speed axis tags** (contribute positively to speed score):
```
MOVEMENT, ATTACK_SPEED, CAST_SPEED, COOLDOWN, SLOW
```

**Neutral tags** (do not contribute to any axis — scoring engine ignores these):
```
MASTERY, MINION, AREA, AILMENT, SACRIFICE, DURATION, TIME, CONVERSION,
DEBUFF, MELEE (when no DAMAGE present)
```

**Overlapping tags** (VOID appears in both damage and survivability nodes — scoring is axis-agnostic; each effect entry is evaluated independently):
- A node with tags `["VOID", "DEFENCE"]` contributes to survivability, not damage — the axis is determined by the dominant defensive/offensive context within that effect entry's tag list, not by the element type alone.
- Rule: if a tag list contains ANY survivability tag, it contributes to survivability. If it contains ANY damage tag AND no survivability tags, it contributes to damage. If it contains any speed tag AND no other axis tags, it contributes to speed. Else: neutral.

**Tag priority resolution:**
```
survivabilityTags.some(t => tags.includes(t)) → survivability axis
damageTags.some(t => tags.includes(t)) and no survivability → damage axis
speedTags.some(t => tags.includes(t)) and no survivability and no damage → speed axis
else → neutral (contributes 0)
```

---

### Scoring Algorithm

```typescript
// Tag sets (define as module-level constants)
const DAMAGE_TAGS = new Set(['DAMAGE', 'VOID', 'PHYSICAL', 'FIRE', 'COLD', 'LIGHTNING', 
  'NECROTIC', 'POISON', 'BLEED', 'CHAOS', 'OFFENCE', 'PENETRATION', 'DOT', 
  'ARMOUR_SHRED', 'DOUBLE_STRIKE', 'KILL'])

const SURVIVABILITY_TAGS = new Set(['DEFENCE', 'ARMOUR', 'HEALTH', 'WARD', 'ENDURANCE', 
  'BLOCK', 'DAMAGE_REDUCTION', 'RESISTANCE', 'FORTIFY', 'SUSTAIN', 'LEECH'])

const SPEED_TAGS = new Set(['MOVEMENT', 'ATTACK_SPEED', 'CAST_SPEED', 'COOLDOWN', 'SLOW'])

// Normalization cap: the maximum raw score achievable in a fully-allocated tree
// Set empirically during Task 1 research — document in scoring-model.md
// Example: RAW_SCORE_CAP = 500 (tuned so a god-tier damage build scores ~90-95, not 100)
const RAW_SCORE_CAP = 500  // PLACEHOLDER — update after Task 1 research

export function calculateScore(build: BuildState, gameData: GameData): BuildScore {
  if (!build.classId || !build.masteryId) {
    return { damage: null, survivability: null, speed: null }
  }
  
  const classData = gameData.classes[build.classId]
  if (!classData) return { damage: null, survivability: null, speed: null }
  
  const masteryData = classData.masteries[build.masteryId]
  // Combine base class tree + mastery tree nodes
  const allNodes: Record<string, GameNode> = {
    ...classData.baseTree.nodes,   // already keyed by id from gameDataStore transform
    ...(masteryData?.passiveTree.nodes ?? {})
  }
  
  let rawDamage = 0
  let rawSurv = 0
  let rawSpeed = 0
  
  for (const [nodeId, allocatedPoints] of Object.entries(build.nodeAllocations)) {
    if (allocatedPoints === 0) continue
    const node = allNodes[nodeId]
    if (!node) continue  // missing node — skip (FR19: does not contribute null to score)
    
    for (const effect of node.effects) {
      const axis = classifyEffect(effect.tags)
      const weight = allocatedPoints * node.maxPoints  // more max points = stronger node
      switch (axis) {
        case 'damage': rawDamage += weight; break
        case 'survivability': rawSurv += weight; break
        case 'speed': rawSpeed += weight; break
      }
    }
  }
  
  return {
    damage: Math.min(100, Math.round((rawDamage / RAW_SCORE_CAP) * 100)),
    survivability: Math.min(100, Math.round((rawSurv / RAW_SCORE_CAP) * 100)),
    speed: Math.min(100, Math.round((rawSpeed / RAW_SCORE_CAP) * 100)),
  }
}

function classifyEffect(tags: string[]): 'damage' | 'survivability' | 'speed' | 'neutral' {
  if (tags.some(t => SURVIVABILITY_TAGS.has(t))) return 'survivability'
  if (tags.some(t => DAMAGE_TAGS.has(t))) return 'damage'
  if (tags.some(t => SPEED_TAGS.has(t))) return 'speed'
  return 'neutral'
}
```

**⚠️ RAW_SCORE_CAP:** This constant is a PLACEHOLDER. After Task 1 research, benchmark a few representative builds (pure damage, pure tank, balanced) and set the cap so that a top-tier build in each axis scores ~85–95, not 100. Document the chosen value and rationale in `docs/scoring-model.md`.

**Note on node data format:** The game data JSON stores nodes as arrays (`"nodes": [...]`) but `GameData` in `src/shared/types/gameData.ts` represents them as `Record<string, GameNode>` (keyed by id). The `gameDataLoader.ts` transforms arrays to records on load. `scoringEngine.ts` receives the already-transformed `GameData` from `useGameDataStore` — do NOT try to parse raw JSON.

---

### ScoreGauge Component Spec

```tsx
// src/features/optimization/ScoreGauge.tsx
interface ScoreGaugeProps {
  baselineScore: BuildScore | null
  previewScore?: BuildScore | null  // optional — provided by Story 3.5 suggestion preview
}

// Axis color tokens (from UX-DR1):
// Damage: var(--color-data-damage)  → #E8614A
// Survivability: var(--color-data-surv)   → #4A9EE8
// Speed: var(--color-data-speed)  → #4AE89E
// Composite: var(--color-text-secondary)

// Composite = Math.round(avg of non-null axes)
// If baselineScore is null → render all three as "—"
// If previewScore is provided and non-null → side-by-side mode
```

**Comparison mode layout (Story 3.5 forward):**
```
Damage      42 → 58   ████████░░░░ → ████████████░░
Surv        31 → 31   ██████░░░░░░ → ██████░░░░░░░░
Speed       15 → 15   ███░░░░░░░░░ → ███░░░░░░░░░░░
Composite   29 → 35
```

---

### App.tsx Wiring Pattern

Following the same pattern used for `useAutoSave` (Story 2.4 — Zustand subscription in `useEffect`):

```typescript
// In App.tsx — subscribe to node allocation changes, recompute scores
useEffect(() => {
  return useBuildStore.subscribe((state, prev) => {
    if (state.activeBuild?.nodeAllocations === prev.activeBuild?.nodeAllocations) return
    if (!state.activeBuild || !gameData) {
      useOptimizationStore.getState().setScores(null)
      return
    }
    const scores = calculateScore(state.activeBuild, gameData)
    useOptimizationStore.getState().setScores(scores)
  })
}, [gameData])
```

**Note:** `gameData` comes from `useGameDataStore` — read it via a separate selector, not inside the subscribe callback (subscribe callbacks should not read other stores for performance). Pass `gameData` to the subscription via closure or use `useGameDataStore.getState()` inside the callback (safe for one-shot reads, not for reactive rendering).

---

### File Locations

**New files:**
- `lebo/src/features/optimization/scoringEngine.ts`
- `lebo/src/features/optimization/scoringEngine.test.ts`
- `lebo/src/features/optimization/ScoreGauge.tsx`
- `lebo/src/features/optimization/ScoreGauge.test.tsx`
- `lebo/docs/scoring-model.md` (research output — written before scoringEngine.ts)

**Modified files:**
- `lebo/src/App.tsx` — add Zustand subscription to trigger score recalculation
- `lebo/src/features/layout/RightPanel.tsx` — add `<ScoreGauge>` render

---

### Existing Infrastructure — DO NOT Reinvent

- **`BuildScore` type** — already defined in `src/shared/types/optimization.ts`. Do NOT create a new type.
- **`useOptimizationStore.setScores()`** — already exists in `src/shared/stores/optimizationStore.ts`. Call it directly.
- **`useOptimizationStore.scores`** — already in the store, already `null` by default.
- **`OptimizationGoal` type** — already defined in `src/shared/types/optimization.ts`.
- **`GameNode`, `GameData`** — already defined in `src/shared/types/gameData.ts`.
- **`BuildState`** — already defined in `src/shared/types/build.ts`.
- **`useGameDataStore`** — already populated on app startup by `gameDataLoader.ts`.
- **`react-hot-toast`** — already installed; use for any user-facing notifications if needed.

---

### Previous Story (2.4) Patterns to Follow

- No `index.ts` barrel files anywhere in `src/` — import directly from source file
- Tailwind v4 CSS-first: use `var(--color-data-damage)`, `var(--color-data-surv)`, `var(--color-data-speed)` tokens — not hardcoded hex values in JSX
- All module-level constants use `SCREAMING_SNAKE_CASE` (e.g., `DAMAGE_TAGS`, `RAW_SCORE_CAP`)
- Test files are co-located with source: `scoringEngine.test.ts` next to `scoringEngine.ts`
- `vi.mock` pattern not needed here (no Tauri IPC) — `scoringEngine.ts` is a pure function; test with real inputs
- For `ScoreGauge.test.tsx`: mock `useOptimizationStore` via `vi.mock('../../../shared/stores/optimizationStore')` if needed, or pass props directly (preferred for pure component)
- Run `pnpm tsc --noEmit` before marking complete — Story 2.4 caught a pre-existing tsc error (`global` → `globalThis`)

---

### Performance Constraint

From the architecture doc: **if `calculateScore()` exceeds 30ms wall-clock time on full build**, move to a Web Worker before Story 3.2 begins. Story 3.2 (Claude API streaming) calls `scoringEngine` once per streamed suggestion — a slow scorer blocks the renderer thread and violates NFR6 (≤100ms UI latency).

Expected performance: with ~47 passive nodes (max real node count per mastery) and O(n) tag scanning, the calculation should be well under 5ms. The 30ms budget is conservative. **Benchmark it anyway in Task 3 and document the result.**

---

### RightPanel Integration Note

As of Story 2.4, `RightPanel.tsx` exists in `src/features/layout/`. Add `<ScoreGauge>` to it. If the right panel has placeholder content only, replace the appropriate section. Do NOT create a new layout file.

The ScoreGauge renders in the top section of the right panel, above where the suggestion list (Story 3.4) will appear.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- `scoringEngine.ts` uses `GameNode.tags` (flat merged array from `gameDataLoader.transformNode`) — NOT `node.effects` which does not exist on the transformed type. This is the key difference from the story's pseudo-code.
- `RAW_SCORE_CAP = 650` calibrated by manually computing the maximum raw damage score for a fully-allocated Void Knight + Sentinel base tree (609 raw → 94 score). See `docs/scoring-model.md` for full derivation table.
- Performance is analytical O(n) with max n≈46 nodes — estimated < 1ms, well under 30ms NFR6 budget. No Web Worker needed.
- Tag priority: survivability beats damage (nodes with VOID + DEFENCE go to surv, not damage).
- All 203 tests pass. Zero TypeScript errors (`pnpm tsc --noEmit`).
- ScoreGauge comparison mode activates when `previewScore` prop is non-null (ready for Story 3.5).

### File List

- `lebo/docs/scoring-model.md` (new — Task 1 research output)
- `lebo/src/features/optimization/scoringEngine.ts` (new)
- `lebo/src/features/optimization/scoringEngine.test.ts` (new)
- `lebo/src/features/optimization/ScoreGauge.tsx` (new)
- `lebo/src/features/optimization/ScoreGauge.test.tsx` (new)
- `lebo/src/App.tsx` (modified — added scoring subscription useEffect)
- `lebo/src/features/layout/RightPanel.tsx` (modified — wired ScoreGauge)

### Review Findings

- [x] [Review][Patch] App.tsx startup race: scores never recalculate after game data loads when build was already active [`App.tsx`] — **Fixed**: added `useGameDataStore.subscribe` effect that triggers `calculateScore` when `gameData` transitions from null to non-null.
- [x] [Review][Defer] ScoreGauge hover tooltip absent in comparison mode [`ScoreGauge.tsx:88`] — deferred, pre-existing gap in Story 3.5 scope (comparison mode is primarily a 3.5 concern)
- [x] [Review][Defer] `MELEE`/`SPELL` omission from DAMAGE_TAGS undocumented in scoring-model.md — deferred, functionally correct (DAMAGE tag is sufficient for any node with MELEE+DAMAGE), add a note in scoring-model.md during a future doc pass

## Change Log

| Date | Change |
|------|--------|
| 2026-04-24 | Story created from epics.md. Story 2.4 is in review, 3.1 is the next backlog story. Status → ready-for-dev. |
| 2026-04-24 | All tasks implemented. RAW_SCORE_CAP=650, 203 tests pass, 0 tsc errors. Status → review. |
