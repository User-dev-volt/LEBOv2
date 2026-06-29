# Story 3.1: Scope-restricted optimizer with empty-budget fallback

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player optimizing my tree,
I want the Optimize Build button to return only passive-node suggestions,
So that I get actionable tree advice instead of off-tree resistance/gear warnings.

## Acceptance Criteria

**AC1 — Output is passive-node-only (FR-15, NFR-3)**
**Given** a build with at least one unspent passive point
**When** I run the Passive Tree Optimizer ("Optimize Build")
**Then** every returned suggestion is of kind `passive_node` and **none** references gear, resistances, blessings, idols, or any off-tree stat.

**AC2 — Floor check still computes; suggestions are scope-filtered (Pattern P4-3, ADR-P4-003)**
**Given** the defensive floor check
**When** the optimizer runs
**Then** the floor check still computes and populates `StatSheet.warnings` (via `compute_stats`/`useStatSheet`, unchanged), **but** its results are excluded from `run_optimization` output. The command filters its emitted suggestions to passive-node allocations only.

**AC3 — Empty-budget fallback message (FR-16)**
**Given** a build with **zero** unspent passive points
**When** I run the optimizer
**Then** it returns this message verbatim (no AI call made):
> `No unspent passive points available. Allocate additional points or use the Complete Build Optimizer for a full reallocation analysis.`

---

## Tasks / Subtasks

- [x] **Task 1 — Scope-restrict `assemble_run_optimization_payload` to passive-node suggestions (AC1, AC2)**
  - [x] In `lebo/src-tauri/src/commands/scoring_commands.rs`, edit `assemble_run_optimization_payload` so the `suggestions` vec is built **only** from the knapsack passive-node allocations (current category 4, `"efficiency"`).
  - [x] Remove the three off-tree suggestion categories from the emitted list: category 1 `critical_warning` (sourced from `stat_sheet.warnings`), category 2 `game_changer` + category 3 `mismatched_affix` + category 5 `zero_value_allocation` (all sourced from `synergy_flags`).
  - [x] Tag each emitted suggestion with an explicit discriminator `"kind": "passive_node"` (self-documents the contract and makes the guard test assert on `kind`, per the architecture's `suggestion.kind == PassiveNode` vocabulary).
  - [x] Keep `rank` sequential starting at 1 over the surviving (passive-node) suggestions only — do not leave gaps from the removed categories.
  - [x] **Do NOT touch** the `optimization:node-efficiencies` emit (lines ~56–58) — that is the canvas overlay feed (Story 3.2), not a suggestion.
  - [x] Simplify now-unused inputs: after removal, `assemble_run_optimization_payload` no longer reads `stat_sheet` or `synergy_flags`. Either drop those params (preferred — Rust `unused_variables`/clippy will flag them) **or**, if you keep computing them in `run_optimization`, prefix with `_`. See Dev Notes "AC2 nuance" before deciding whether to also drop the now-dead top-level `compute_stats`/`run_synergy_detection` calls.
  - [x] The Claude NDJSON instruction line and `buildContext` block stay as-is (buildContext already uses `snapshot` + `scan_result.build_score_baseline`, not `stat_sheet`).
- [x] **Task 2 — Rust guard test for the filter (AC1, AC2)**
  - [x] Add a `#[cfg(test)] mod tests` to `scoring_commands.rs` (none exists today — this command is currently untested).
  - [x] Construct fixtures that exercise every removed category: a `ScanResult` with a non-empty `knapsack_solution` + `node_efficiencies`, a list of `StatWarning`, and `SynergyFlag`s of `flag_type` `game_changer` / `mismatched_affix` / `zero_value_allocation`.
  - [x] Call `assemble_run_optimization_payload`, parse the returned JSON, and assert **element-level** (not count-only): every entry in `suggestions[]` has `kind == "passive_node"`, and **no** entry has a `toNodeId` beginning `warning:`, `unique:`, or `synergy:`, and no `type`/`kind` of `critical_warning`/`game_changer`/`mismatched_affix`/`zero_value_allocation`.
  - [x] Add the inverse assertion: when `knapsack_solution` is empty, `suggestions[]` is empty (no off-tree leakage to fill the gap).
- [x] **Task 3 — Frontend empty-budget guard (AC3)**
  - [x] Add `selectUnspentPassivePoints` selector to `buildStore.ts` (parallel to `selectAvailablePassivePoints`): `calculatePassivePoints(level) - Σ nodeAllocations.values()`. Reuse the exact idiom already at `buildStore.ts:205–206` / `296–298`.
  - [x] Add `optimizationNotice: string | null` + `setOptimizationNotice(notice)` to `optimizationStore.ts`; clear it inside `clearSuggestions()` (alongside the other reset fields).
  - [x] In `startOptimization()` (`useOptimizationStream.ts`): after resolving `activeBuild`/`gameData`, compute unspent points. If `<= 0`, call `setOptimizationNotice(EMPTY_BUDGET_MESSAGE)` and **return early** — do **not** call `invokeCommand('run_optimization')`, do **not** set `isOptimizing`. Define `EMPTY_BUDGET_MESSAGE` as the exact AC3 string.
  - [x] `clearSuggestions()` runs at the top of `startOptimization` today — ensure the notice is cleared on every fresh run before the guard sets it (so a prior notice doesn't linger after points are added).
- [x] **Task 4 — Render the notice (AC3)**
  - [x] In `SuggestionsList.tsx`, add a render branch for `optimizationNotice` (informational styling — NOT the red `streamError` banner, NOT `isRetryable`). Give it a `data-testid` (e.g. `empty-budget-notice`).
  - [x] Precedence: show the notice when present and `!isOptimizing`; it should take priority over the generic `suggestions-empty-state` / `suggestions-well-optimized` text so the user sees the specific reason.
  - [x] Do **not** add unspent-points to `OptimizeButton`'s `disabled` prop in `RightPanel.tsx` — the button must stay clickable so the run can produce the message (disabled stays `!activeBuild || !isOnline`).
- [x] **Task 5 — Frontend tests (AC3)**
  - [x] In `useOptimizationStream.test.ts`: with `activeBuild.characterLevel` and `nodeAllocations` set so unspent `== 0` (e.g. level 3 → budget 1, allocations sum 1), call `startOptimization()`; assert `invokeCommand` was **not** called with `'run_optimization'` and `optimizationStore.optimizationNotice` equals the exact AC3 string.
  - [x] Inverse: unspent `> 0` → `invokeCommand('run_optimization', …)` **is** called and notice stays `null`.
  - [x] In `SuggestionsList.test.tsx`: when `optimizationNotice` is set, the notice text renders; add/keep an axe check.
- [x] **Task 6 — Verify no regression to off-tree UI scaffolding**
  - [x] Confirm the `isSyntheticNodeId` / informational-card paths in `SuggestionsList.tsx` and `SuggestionCard.tsx` are left intact (see Dev Notes "Dead-but-keep"). Run the full suite; `SuggestionCard.test.tsx` / `SuggestionsList.test.tsx` synthetic-variant tests must stay green.
  - [x] `pnpm build` (tsc + vite) clean; `cargo test -p scoring-core` and the new `scoring_commands` test green; full `pnpm vitest` shows no new failures vs the standing baseline (ProviderSelector / Settings / SkillTreeCanvas / TreeControls).

---

## Dev Notes

### What this story is (and is not)

This is a **scope-restriction + a small UI guard**, not new scoring math. The passive-tree optimizer already works end-to-end; Epic 3's job is to stop it surfacing off-tree noise (the Phase 3 pain) and to disambiguate the zero-budget case. There is **no new stat** — see `## Source Audit`.

### The governing pattern — Pattern P4-3 / ADR-P4-003

> The floor check runs inside `compute_stats` and always populates `StatSheet.warnings`. **Emitting suggestions** is a separate, command-level concern: `run_optimization` filters its output to `suggestion.kind == PassiveNode` only. Floor-derived gear/resistance suggestions appear **only** in `run_complete_optimization` when `scope.gear == true`. Never emit a non-`passive_node` suggestion from `run_optimization`.
> — [Source: architecture.md#Pattern P4-3], [architecture.md#Cross-Cutting Concerns item 4 / ADR-P4-003]

`run_optimization` owns **AR-5 partial** (`run_optimization` filtered to `passive_node`). [Source: epics.md#Epic 3 Owns]

### Source tree — files to touch

| File | Change | AC |
|---|---|---|
| `lebo/src-tauri/src/commands/scoring_commands.rs` | Filter `assemble_run_optimization_payload` to passive-node only; add `#[cfg(test)] mod tests` | AC1, AC2 |
| `lebo/src/shared/stores/buildStore.ts` | Add `selectUnspentPassivePoints` selector | AC3 |
| `lebo/src/shared/stores/optimizationStore.ts` | Add `optimizationNotice` + setter; clear in `clearSuggestions` | AC3 |
| `lebo/src/shared/stores/useOptimizationStream.ts` | Empty-budget guard in `startOptimization`; define `EMPTY_BUDGET_MESSAGE` | AC3 |
| `lebo/src/features/optimization/SuggestionsList.tsx` | Render the notice branch | AC3 |
| `lebo/src/shared/stores/useOptimizationStream.test.ts` | Guard tests | AC3 |
| `lebo/src/features/optimization/SuggestionsList.test.tsx` | Notice render + axe | AC3 |

**Do not touch:** `RightPanel.tsx` button `disabled` logic, `pixiRenderer.ts`, `useSkillTree.ts`, `compute_stats`, the `scoring-core` engine, or any store schema beyond the two additive fields above.

### Current state of `assemble_run_optimization_payload` (the file being modified)

`scoring_commands.rs:352–491`. It builds a `suggestions: Vec<serde_json::Value>` from **five** sources, in priority order. Today **all five** are sent to Claude and streamed back as `optimization:suggestion-received` events:

1. **`critical_warning`** — from `stat_sheet.warnings` (the defensive floor check). `toNodeId = "warning:{warning_type}"`. → **REMOVE from output** (this is the explicit P4-3 exclusion).
2. **`game_changer`** — from `synergy_flags` where `flag_type == "game_changer"`. `toNodeId = "unique:{node_id}"`. → **REMOVE** (uniques/synergies, off-tree).
3. **`mismatched_affix`** — from `synergy_flags`, `priority == "high"`. `toNodeId = "synergy:affix:{slot}"`. → **REMOVE** (gear, off-tree).
4. **`efficiency`** — from `scan_result.knapsack_solution` + `node_efficiencies`. `toNodeId = <real passive node id>`. → **KEEP — this is the only passive-node kind.**
5. **`zero_value_allocation`** — from `synergy_flags`, `priority == "medium"`. `toNodeId = flag.node_id | "synergy:unknown"`. → **REMOVE** (synergy detection, not a knapsack allocation).

After the change, `suggestions[]` is built **only** from loop #4. That is the literal meaning of "filtered to `suggestion.kind == PassiveNode`."

**Rust types being filtered (for fixtures + accuracy):**
- `StatWarning` { `warning_type: String`, `current_value: f64`, `gap: f64`, + fix string } — [scoring-core/src/stat_sheet.rs:139].
- `SynergyFlag` { `flag_type: String` = `"zero_value_allocation" | "mismatched_affix" | "game_changer"`, `priority: String` = `"critical" | "high" | "medium"`, `node_id`, `slot`, `description`, `delta_build_score` } — [scoring-core/src/stat_sheet.rs:188].
- `ScanResult` { `node_efficiencies: Vec<NodeEfficiency>`, `build_score_baseline: f64`, `knapsack_solution: Vec<Vec<String>>` } — [scoring-core/src/scan.rs:22]. Doc comment: `knapsack_solution` is "Empty when `unspent_points == 0` or no positive-delta paths exist."

### AC2 nuance — "the floor check still computes" means the ENGINE, not `run_optimization`

The warnings the **user sees** come from the continuous `compute_stats` call driven by `useStatSheet` (the one site with `track_sources: true`), which always runs the floor check and populates `StatSheet.warnings` → `optimizationStore.statSheet.warnings` (frontend type `StatWarning[]`, statSheet.ts:189). **That path is untouched by this story.** AC2 is satisfied the moment you stop pushing `stat_sheet.warnings` into the suggestions vec — you do **not** need to keep computing a throwaway `stat_sheet` inside `run_optimization`.

Consequence: inside `run_optimization` (lines 40–52) the top-level `compute_stats` result and `run_synergy_detection` result existed **only** to feed the removed suggestion categories. `run_efficiency_scan` computes its **own** baseline internally (scan.rs:38), and the `node_efficiencies` overlay emit comes from `scan_result`, not from `stat_sheet`. So you may also drop the now-dead `compute_stats` + `run_synergy_detection` calls from the `spawn_blocking` block.
- **Recommended:** drop them (removes wasted computation; tighter command). Keep only `run_efficiency_scan`.
- **Minimal-diff alternative:** leave the `spawn_blocking` block as-is and only gut the suggestion loops; let `stat_sheet`/`synergy_flags` go unused (prefix `_`). Acceptable but wasteful.
Either way, **do not** remove the floor check from `scoring-core` and **do not** touch `compute_stats`.

### AC3 — empty-budget guard: recommended approach (frontend) + the open decision

Today, zero unspent points → `knapsack_solution` is empty (scan.rs:171, already covered by the `zero_budget_produces_empty_knapsack_solution` test) → after filtering, **zero** suggestions → the UI falls through to the generic *"Your build is well-optimized…"* / empty-state copy. That is misleading: the user has nothing to spend, not a perfect build. AC3 exists to say so explicitly.

**Recommended: a frontend pre-flight guard in `startOptimization`.** Rationale:
- Avoids a wasted (paid, ~20–30s) Claude round-trip for a condition the client already knows — consistent with the app's offline-first, cost-conscious design.
- Unspent-point budget math already lives on the frontend (`budgetCalculator.ts` + the idiom at buildStore.ts:205/296). No new Tauri event or backend payload shape needed.
- Trivially unit-testable via the existing `invokeCommand` mock in `useOptimizationStream.test.ts`.

Unspent formula (reuse verbatim — do not inline a new one):
```ts
const available = calculatePassivePoints(activeBuild.characterLevel) // level - 2, floored at 0
const allocated = Object.values(activeBuild.nodeAllocations).reduce((sum, v) => sum + v, 0)
const unspent = available - allocated
```
(Allocation records omit zero-value keys — project-context rule — so a plain sum is correct.)

`OptimizeButton` stays clickable (disabled only on `!activeBuild || !isOnline`); the run itself produces the message. The notice is informational, **not** a `streamError` (don't reuse the red banner / retry / AUTH-link machinery).

> **DECISION (Alec-confirmed): frontend guard.** The empty-budget guard lives in `startOptimization`, not in `run_optimization`. The backend approach (compute unspent in Rust and emit via an event) was considered and **rejected** — the condition is client-known and a frontend guard avoids a wasted paid Claude call. Implement the frontend guard as specified in Task 3; do not add backend/event handling for AC3.

### Dead-but-keep — off-tree UI scaffolding becomes unreachable from this command

`SuggestionsList.tsx:31–49` (`isSyntheticNodeId` / `getSyntheticVariant` / `formatSyntheticLabel`) and the `isInformational` / `informationalVariant` props on `SuggestionCard` exist to render the `warning:` / `unique:` / `synergy:` suggestions as informational cards and to block "Apply" on them. After this filter, `run_optimization` will **never** emit those ids, so these branches become unreachable **from the passive optimizer**.

**Leave them in place.** Removing them is out of scope, is unrelated churn, and would break `SuggestionCard.test.tsx` / `SuggestionsList.test.tsx` informational-variant tests. The synthetic/informational pathway is the natural home for the future **Complete Build Optimizer** (Epic 6), which uses a separate `complete-opt:*` namespace + `useCompleteOptStream` (not built yet). Flag in your completion notes that these branches are intentionally retained as defensive/forward-looking, so a reviewer does not read the now-empty cards as a regression.

### Anti-patterns / guardrails (do not violate)

- **IPC discipline:** never call raw `invoke()` — use `invokeCommand<T>()`. No change to the command name `run_optimization` or its `optimization:*` event namespace. [project-context.md]
- **No `mode` flag on `run_optimization`** — explicitly re-rejected by the architecture (couples distinct triggers, defeats independent testability). Four discrete commands map to four discrete triggers. [architecture.md:251]
- **Rust output is snake_case** via serde; the NDJSON suggestion schema the frontend parses is `{rank, from_node_id, to_node_id, points_change, explanation}` (useOptimizationStream.ts:15–21) — the new `kind` tag lives in the **Claude user_message payload** (the assemble function), it does not need to round-trip through the NDJSON unless you choose to thread it; AC1 is verified on the assembled payload.
- **Four-store rule:** extend `optimizationStore` (additive `optimizationNotice`); do not create a new store. [architecture.md:69]
- **No barrel files, named exports only, strict TS** (`noUnusedLocals/Parameters`). [project-context.md]
- **Keep `optimization:node-efficiencies` emit** — the passive-tree efficiency overlay depends on it; it is not a suggestion.

### Testing requirements

Per the project's verification guardrail, a count-only test is insufficient — assert the **content/kind** of the emitted suggestions:
- **Rust (new `scoring_commands` test):** feed warnings + `game_changer`/`mismatched_affix`/`zero_value_allocation` synergy flags + a non-empty knapsack, then assert **every** emitted suggestion is `kind == "passive_node"` and **none** carries a `warning:` / `unique:` / `synergy:` `toNodeId` or a removed `type` — an element-level assertion over the output array, not `len() == N`. Plus: empty knapsack → empty `suggestions[]`.
- **Frontend:** assert the **exact** AC3 string and the presence/absence of the `invokeCommand('run_optimization')` call (value assertion, not a snapshot). No snapshot tests. Co-locate; mock Tauri IPC; axe on the SuggestionsList change. [project-context.md#Testing Rules]
- Run `cargo test -p scoring-core` (engine regression must stay green — the floor check and `zero_budget_produces_empty_knapsack_solution` are unchanged) and full `pnpm vitest` (no new failures vs the standing baseline: ProviderSelector / Settings / SkillTreeCanvas / TreeControls).

## Source Audit

**N/A — no-new-stat / no-dead-key.**

This story introduces **no** new `StatKey`, no new `StatSheet` field, and no new displayed stat value. It (a) **removes** off-tree entries from an existing suggestion payload and (b) adds a static, client-known UI string (`optimizationNotice`) gated on the already-shipped passive-point budget (`calculatePassivePoints`, sourced & verified in `budgetCalculator.ts`). The one passive-node suggestion kind that survives the filter (`efficiency`/knapsack) is already produced by `run_efficiency_scan` **and** consumed by the suggestion stream / `applyNodeChange` — no dead key. The defensive-floor `StatSheet.warnings` continue to be produced by `compute_stats` **and** consumed by the stat-sheet display — this story only stops them being *re-presented as suggestions*. The value+element loader-assertion requirement (which targets new prose/tag parsing) is therefore N/A; the equivalent rigor is applied as the value+element **filter** assertion in Task 2 (assert each emitted suggestion's kind, not a count).

### Project Structure Notes

- Backend change is confined to one command file (`commands/scoring_commands.rs`); no `scoring-core` engine change, no `lib.rs` `invoke_handler!` change (command already registered).
- Frontend changes are additive to two stores + one stream hook + one component, all within established patterns (`features/optimization/`, `shared/stores/`). No new feature folder, no router, no new view.
- Naming: `selectUnspentPassivePoints` mirrors the existing `selectAvailablePassivePoints` export; `optimizationNotice` follows the store's `xxx: T | null` + `setXxx` convention.
- No new dependencies (frontend or Rust) — versions locked per project-context.md / architecture.md "Starter Template Evaluation"; no web research required.

### References

- [Source: epics.md#Epic 3 / Story 3.1] — story statement, ACs, FR-15/FR-16, NFR-3, the verbatim empty-budget message.
- [Source: epics.md#Epic 3 Owns] — AR-5 partial (`run_optimization` filtered to `passive_node`, Pattern P4-3).
- [Source: architecture.md#Pattern P4-3 — Warnings always compute; suggestions are scope-filtered] — the governing rule.
- [Source: architecture.md#Cross-Cutting Concerns (item 4) / ADR-P4-003] — warning-vs-suggestion separation at the command boundary.
- [Source: architecture.md#Command table (line 243)] — `run_optimization` (extended), passive-tree only, output filtered to `passive_node`, `optimization:*` events.
- [Source: architecture.md#line 251] — rejected `mode` flag rationale.
- [Source: scoring_commands.rs:352–491] — `assemble_run_optimization_payload`, the five current suggestion categories.
- [Source: scoring_commands.rs:40–58] — `run_optimization` compute block + `optimization:node-efficiencies` emit to preserve.
- [Source: scan.rs:22–31, 50–57, 171–175, 790] — `ScanResult`, unspent-budget math, empty-knapsack-on-zero-budget + existing test.
- [Source: stat_sheet.rs:139, 188] — `StatWarning` / `SynergyFlag` shapes.
- [Source: useOptimizationStream.ts:37–58] — `startOptimization` (guard site) + NDJSON payload shape.
- [Source: optimizationStore.ts:97–113] — `clearSuggestions` reset list (add `optimizationNotice` here).
- [Source: SuggestionsList.tsx:31–49, 485–503] — synthetic-id handling to retain; empty-state render branches to sequence the notice ahead of.
- [Source: buildStore.ts:73–74, 205–206, 296–298] — `selectAvailablePassivePoints` + the unspent idiom to reuse.
- [Source: project-context.md] — IPC/store/testing/naming guardrails.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 — Claude Code dev-story workflow with ultracode multi-agent adversarial verification (5 parallel review lenses: AC1, AC2, AC3, scope/regression, task-fidelity).

### Debug Log References

- `cargo test -p scoring-core`: 138 passed / 0 failed — engine regression intact (floor check + `zero_budget_produces_empty_knapsack_solution` green).
- `cargo test -p lebo`: 3 new `scoring_commands` guard tests pass. The lone failure `openrouter_service::models_list_has_four_entries` (7 vs 4) is the pre-existing, documented out-of-scope baseline — `openrouter_service.rs` untouched.
- `pnpm build` (tsc + vite): clean (pre-existing >500 kB chunk + variable-font runtime-resolution advisories only).
- `pnpm vitest` (full): 1140 passed / 8 failed — the 8 are exactly the standing baseline (ProviderSelector / Settings / SkillTreeCanvas / TreeControls). No new failures; +11 new tests (6 notice/guard + 5 selector).

### Completion Notes List

- **AC1 (passive-node-only):** `assemble_run_optimization_payload` rebuilt to emit suggestions ONLY from the knapsack passive-node category, each tagged `"kind":"passive_node"`. The four off-tree categories (`critical_warning`, `game_changer`, `mismatched_affix`, `zero_value_allocation`) removed.
- **AC2 (floor check still computes; suggestions scope-filtered):** Took the story's *Recommended* path — dropped the now-dead top-level `compute_stats` + `run_synergy_detection` calls inside `run_optimization` (the scan computes its own baseline) and dropped the `stat_sheet`/`synergy_flags` params from the assemble fn. The user-facing floor-check path (`useStatSheet` → `compute_stats` → `StatSheet.warnings`) and the scoring-core engine are byte-unchanged. The `optimization:node-efficiencies` overlay emit (Story 3.2) is preserved.
- **Task 1 / Task 2 reconciliation (documented decision):** Dropping the off-tree params makes leakage *structurally impossible* (the removed categories' inputs are no longer parameters) — a stronger guarantee than the runtime fixture-feed Task 2 literally described, which is incompatible with the (preferred) dropped-params signature. The Rust guard test asserts element-level `kind=="passive_node"`, sequential rank-from-1, and no `warning:`/`unique:`/`synergy:` leakage on the knapsack output, plus the empty-knapsack→empty inverse and an empty-path-no-gap case; the bridge→target fixture exercises `find_map` target-resolution (not the `path.last()` fallback). The off-tree assertions are commented as forward-regression guards against a future off-tree branch being reintroduced in this function.
- **AC3 (empty-budget fallback):** Frontend pre-flight guard (Alec-confirmed) in `startOptimization` — when `selectUnspentPassivePoints(state) <= 0` it sets the verbatim `EMPTY_BUDGET_MESSAGE` and returns BEFORE any `run_optimization` IPC (no paid Claude call) and without setting `isOptimizing`. `clearSuggestions` runs first (now also resets `optimizationNotice`) so the notice never lingers after points are added. `SuggestionsList` renders an informational `role="status"` card (gold border, `data-testid="empty-budget-notice"`) taking precedence over the generic empty-state / well-optimized copy. `OptimizeButton` disabled logic in `RightPanel` left untouched (stays clickable).
- **Dead-but-keep:** `isSyntheticNodeId` / `getSyntheticVariant` / `formatSyntheticLabel` in `SuggestionsList` and `SuggestionCard`'s informational props intentionally retained (unreachable from `run_optimization` now, but the home for Epic 6's Complete Build Optimizer). Not a regression.
- **Adversarial verification (ultracode):** 5 parallel skeptic agents — AC1, AC2, AC3, scope/regression all PASS; task-fidelity CONCERN on 2 LOW non-blocking nuances. 3 LOW findings actioned (direct `selectUnspentPassivePoints` unit tests; clarifying comment on the now-vacuous off-tree assertions; hardened the bridge→target fixture).
- **Deferred (out of scope):** `invoke_claude_api` is a second, currently frontend-orphaned command that can emit off-tree-contextualized suggestions into the `optimization:*` namespace (still registered in `lib.rs` invoke_handler). Removing it would touch `lib.rs` invoke_handler — explicitly on this story's "Do not touch" list. Flagged for future cleanup / Epic 6.

### File List

- `lebo/src-tauri/src/commands/scoring_commands.rs` — filter `assemble_run_optimization_payload` to passive-node only (+`kind`), drop dead engine calls + unused params; new `#[cfg(test)] mod tests` (3 guard tests)
- `lebo/src/shared/stores/buildStore.ts` — add `selectUnspentPassivePoints` selector
- `lebo/src/shared/stores/optimizationStore.ts` — add `optimizationNotice` + `setOptimizationNotice`; reset in `clearSuggestions`
- `lebo/src/shared/stores/useOptimizationStream.ts` — `EMPTY_BUDGET_MESSAGE` + empty-budget guard in `startOptimization`
- `lebo/src/features/optimization/SuggestionsList.tsx` — render the empty-budget notice with precedence
- `lebo/src/shared/stores/useOptimizationStream.test.ts` — empty-budget guard tests; bump mock build level + export selector in mock
- `lebo/src/features/optimization/SuggestionsList.test.tsx` — notice render / precedence / axe tests
- `lebo/src/shared/stores/buildStore.test.ts` — direct `selectUnspentPassivePoints` unit tests

## Change Log

| Date | Change |
|------|--------|
| 2026-06-29 | Story 3.1 implemented (dev-story + ultracode). Backend: `run_optimization` payload scope-restricted to passive-node (knapsack) suggestions per Pattern P4-3 — off-tree categories removed, `kind:passive_node` tag added, dead `compute_stats`/`run_synergy_detection` calls + unused params dropped, `node-efficiencies` emit preserved; new Rust guard tests. Frontend: empty-budget pre-flight guard (verbatim AC3 message, no paid Claude call), `selectUnspentPassivePoints` selector, `optimizationNotice` store field, informational notice in `SuggestionsList`. Adversarially verified across 5 lenses (all ACs PASS); 3 LOW test-hardening findings actioned, 1 (`invoke_claude_api`/`lib.rs`) deferred as out-of-scope. Status → review. |
