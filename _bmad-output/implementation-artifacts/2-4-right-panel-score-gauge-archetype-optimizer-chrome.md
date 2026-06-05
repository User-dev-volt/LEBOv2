# Story 2.4: Right panel — score gauge, archetype, optimizer chrome

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the right panel rebuilt with the score gauge, archetype slider, and optimizer controls,
so that my build score and optimization intent are clear and on-brand.

This is the **fourth story of Epic 2 (UI/UX Revamp)**, continuing the same discipline as Stories 2.2 (header) and 2.3 (left panel): the right-panel **plumbing already exists and is wired correctly** — `RightPanel.tsx` already composes `ScoreGauge`, `OptimizationSlider`, `FineTunePanel`, `OptimizeButton`, `SuggestionsList`, and `StatSheetPanel`, and the optimization stores (`scores`, `sliderPosition`, `fineTuneWeights`, preview wiring) are all in place. This story is an **extension + visual reconciliation to the Claude Design handoff**, not a from-scratch rebuild or a behavior change. The concrete deltas are:

1. **Score Gauge → 3/4-arc SVG (UX-DR4):** replace the current horizontal-bar `ScoreGauge` with a **3/4-arc SVG gauge** — gradient-filled arc, tick marks, center **build score** (composite) and a **delta indicator** (▲/▼ vs the previewed suggestion). The existing baseline-vs-preview wiring (`previewSuggestionRank` → `previewScore`) is preserved; it now drives the **delta**, not a `→` string.
2. **DMG / SURV / SPD pill trio (FR-35):** add the three sub-score pills beneath the gauge (damage / survivability / speed, color-coded via the `--color-data-*` tokens).
3. **Optimization Intent zone label (UX-DR5):** extend `OptimizationSlider` with the **five-zone label** — Juggernaut / Bulwark / Balanced / Aggressive / Glass Cannon — rendered in the **zone color** with a sub-caption, derived from `sliderPosition`. Keep the existing **accessible native range input** (do not regress to a custom drag track).
4. **Fine Tune Weights — collapsible (FR-35):** keep `FineTunePanel`'s Headless UI `Disclosure`; reconcile its heading/affordance to the design ("Fine Tune Weights", chevron).
5. **Optimize Build button — gold, pulsing while running (FR-35):** the button is gold and **pulses** (`pulse-gold`) while `isOptimizing`, gated behind `prefers-reduced-motion`. Label reads **"Optimize Build"** (or "Re-Optimize" when suggestions exist; "Analyzing…" while running).
6. **AI Suggestions card area + Stat Sheet chrome (FR-35, UX-DR7):** restyle the surrounding section headers/dividers ("AI Suggestions" with a `{n} ranked` count; "Stat Sheet" header). The **suggestion card content** (`SuggestionsList`) and the **five-tab stat content** (`StatSheetPanel`) are owned elsewhere (Epic 3 / Epic 1) — this story restyles only the **surrounding chrome**.
7. **Tests:** update `RightPanel.test.tsx` to the new chrome and **clear `RightPanel` from the standing failing-test baseline** (it is currently in it on a stale assertion).

**Scope boundary (read this first — same discipline as Stories 2.2 / 2.3):**
- **Do NOT change any stat content.** The five-tab `StatSheetPanel` content + `StatSourceTooltip` are **Epic 1** (done). This story restyles the *surrounding* right-panel chrome only — never the stat rows, values, tooltip, or tab structure.
- **Do NOT change suggestion-card content or optimization behavior.** `SuggestionsList`, `startOptimization`, the `optimization:*` event stream, preview wiring, and offline/empty-context guards are pre-existing and correct — keep them. This is a re-skin.
- **Do NOT change any store schema, store action, or type.** `BuildScore`, `FineTuneWeights`, `sliderPosition`, `scores`, `previewSuggestionRank`, `setSliderPosition`, `setFineTuneWeights`, `setActiveBuildSliderPosition`, `setActiveBuildFineTuneWeights` all exist — consume them as-is.
- **Do NOT touch** `LeftPanel`, `CenterCanvas`, the center tab bar, `StatusBar`, or `AppHeader` (Stories 2.3/2.5/2.8 and prior).
- **No new Zustand store, no React Router, no new dependency.**

## Acceptance Criteria

**AC1 — Score Gauge is a 3/4-arc SVG with gradient fill, center build score, and delta indicator (FR-35, UX-DR4)**
- **Given** an active build with a computed `scores: BuildScore`,
- **When** the right panel (`lebo/src/features/layout/RightPanel.tsx`) renders expanded,
- **Then** the score region shows a **3/4-arc SVG gauge** (`ScoreGauge`): a background track arc + a **gradient-filled value arc** (gold gradient: `--color-accent-gold-dim` → `--color-accent-gold` → `--color-accent-gold-soft`) whose sweep is proportional to the composite build score (0–100, clamped), with tick marks, a **center composite build score** (`Math.round` of the average of the non-null `damage`/`survivability`/`speed`), and a **"Build Score"** label,
- **And** when there is **no** active build, the score region shows the existing "Select a build to see scores" message (current behavior preserved),
- **And** when a suggestion is being previewed (`previewSuggestionRank !== null` → `previewScore` resolved in `RightPanel` exactly as today), the gauge shows a **delta indicator**: `▲ +{Δ}` in positive color when preview composite > baseline composite, `▼ -{Δ}` in negative color when lower, computed as `previewComposite − baseComposite` (one-decimal). No delta is shown when not previewing or when Δ rounds to 0,
- **And** the gauge `<svg>` is decorative-only for a11y (`aria-hidden="true"`); the meaning is carried by the existing `role="region"` / `aria-label="Build scores"` wrapper and the text values, and the arc transition is gated behind `prefers-reduced-motion`.

**AC2 — DMG / SURV / SPD pill trio (FR-35)**
- **Given** an active build with `scores`,
- **When** the panel renders,
- **Then** a **three-pill row** appears beneath the gauge: **DMG** (`--color-data-damage`), **SURV** (`--color-data-surv`), **SPD** (`--color-data-speed`), each showing its rounded sub-score (`Math.round(scores.damage ?? 0)` etc., `—` when the sub-score is `null`/no build), label above value, monospace value (`var(--font-mono)`),
- **And** the pills consume `--color-*` tokens only (never a hardcoded hex — Pattern P4-8).

**AC3 — Optimization Intent slider shows the five-zone label in zone color (FR-35, UX-DR5)**
- **Given** the expanded panel with a build,
- **When** the Optimization Intent section renders,
- **Then** it shows the **"Optimization Intent"** heading, the **Juggernaut↔Glass Cannon** native range slider (`role="slider"`, keyboard-operable, the existing accessible input — *not* a custom mouse-drag track), and a **zone label** below it derived from `sliderPosition`: **Juggernaut** (0–19), **Bulwark** (20–39), **Balanced** (40–59), **Aggressive** (60–79), **Glass Cannon** (80–100), each rendered in its **zone color** with the design sub-caption (Juggernaut "Survivability first", Bulwark "Defense over offense", Balanced "Equal weight", Aggressive "Offense over defense", Glass Cannon "Damage at all costs"),
- **And** the five zone colors resolve through CSS tokens (reuse `--color-slider-juggernaut`, `--color-node-available` for Bulwark, `--color-accent-gold` for Balanced, `--color-slider-glass-cannon` for Glass Cannon; **add** the one missing token `--color-zone-aggressive: #C77840` to `global.css`'s `@theme` block) — **no inline hex**,
- **And** changing the slider continues to call `setSliderPosition(v)` + `setActiveBuildSliderPosition(v)` (unchanged), the zone label updates live, and the boundary mapping is defined in **one place** (a single `getArchetypeZone(position)` helper) so the slider and any future consumer cannot drift.

**AC4 — Fine Tune Weights is a collapsible section (FR-35)**
- **Given** the expanded panel,
- **When** the optimizer controls render,
- **Then** the **Fine Tune Weights** section is collapsible (the existing Headless UI `Disclosure` in `FineTunePanel`), labelled **"Fine Tune Weights"** with a chevron affordance, exposing the Damage/Survivability/Speed weight sub-sliders,
- **And** its existing behavior is unchanged: weights default from `sliderPosition` until customized, edits call `setFineTuneWeights` + `setActiveBuildFineTuneWeights`, the "(Custom)" affordance still reflects `fineTuneWeights !== null`, and the open/close transition is gated behind `prefers-reduced-motion`.

**AC5 — Optimize Build button is gold and pulses while running (FR-35)**
- **Given** the optimizer controls,
- **When** the **Optimize Build** button renders,
- **Then** it is a **full-width gold** button (`--color-accent-gold` bg, `--color-bg-base` text) labelled **"Optimize Build"** when idle with no suggestions, **"Re-Optimize"** when idle with suggestions present, and **"Analyzing…"** while `isOptimizing`,
- **And** while `isOptimizing` the button **pulses** via a new `@keyframes pulse-gold` animation (add to `global.css`), **gated behind `prefers-reduced-motion`** (no pulse when reduced motion is set; the existing static indeterminate-progress affordance remains acceptable as the reduced-motion fallback),
- **And** the existing disabled/guard behavior is preserved exactly: `disabled` when `!activeBuild || !isOnline`; `aria-disabled`/`aria-busy` set correctly; clicking calls `startOptimization` only when interactive; the offline note (`isOnlineChecked && !isOnline`) and empty-context note remain.

**AC6 — AI Suggestions and Stat Sheet chrome are restyled; underlying content untouched (FR-35, UX-DR7)**
- **Given** the expanded panel,
- **When** it renders below the optimizer controls,
- **Then** an **"AI Suggestions"** section header is shown (with a `{n} ranked` count in `--color-text-muted` mono when `suggestions.length > 0`) above the existing `SuggestionsList` (`data-testid="suggestions-list"`, unchanged), followed by a **"Stat Sheet"** section header above the existing `StatSheetPanel` (five-tab content unchanged, scroll container preserved),
- **And** dividers between sections use `--color-bg-elevated` hairlines (existing pattern), the whole panel stays within the 340px expanded width / 48px collapsed rail, and the collapsed rail keeps its score/zap/stats glyph strip (showing the rounded composite score).

**AC7 — Right-panel chrome is tested; accessibility holds; build green; RightPanel leaves the failing baseline (NFR-14, UX-DR12)**
- **Given** `RightPanel.test.tsx` currently exists **but sits in the standing failing-test baseline** (it asserts stale copy "AI optimization requires internet connectivity" that the component never renders),
- **When** the tests are updated to the rebuilt chrome,
- **Then** they cover: the 3/4-arc `ScoreGauge` renders the center composite score for a seeded `scores`; the delta indicator appears (▲/▼) when `previewSuggestionRank` is set and is absent otherwise; the DMG/SURV/SPD pills render the three rounded sub-scores; the slider's **zone label** matches `sliderPosition` at representative positions (e.g. 10→Juggernaut, 30→Bulwark, 50→Balanced, 70→Aggressive, 90→Glass Cannon); Fine Tune disclosure toggles; the Optimize button shows "Optimize Build"/"Re-Optimize"/"Analyzing…" and is disabled offline / with no build; the offline + empty-context notes still render; and `expect(await axe(container)).toHaveNoViolations()`,
- **And** the stale offline-copy assertion is corrected to the component's actual text, every interactive element keeps the **2px solid `--color-accent-gold` focus ring** (global `:focus-visible`), all animation (gauge arc, button pulse, disclosure) is gated behind `prefers-reduced-motion`, and **`RightPanel` is removed from the documented failing baseline** (new baseline = `ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`),
- **And** `pnpm exec tsc --noEmit` exits 0, `CI=true pnpm exec vitest run` shows **no new failures** versus the (now `RightPanel`-free) baseline, and `pnpm build` exits 0.

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It is right-panel optimizer/score **chrome** only: a redrawn `ScoreGauge`, sub-score pills, an archetype zone label, a collapsible weights panel, a pulsing button, and restyled section headers around already-existing content. It touches **no** game-data loader, **no** `scoring-core` / `compute/*` module, **no** new `StatKey`, **no** new `StatSheet` field, and **no** new displayed numeric **stat**.

Every value rendered is an **existing** computed value re-presented:
- The gauge **composite** and the **DMG/SURV/SPD pills** read `optimizationStore.scores` (`BuildScore { damage, survivability, speed }`) — produced by the Epic 1/3 scoring engine via `compute_stats` / `run_optimization`, already surfaced by the current bar-`ScoreGauge`. No new field; only the visual form changes.
- The **delta** is arithmetic over the **existing** baseline-vs-`previewScore` pair already wired through `previewSuggestionRank` (`SuggestionResult.previewScore`) — a presentational difference, not a new stat.
- The **zone label** is a pure function of `sliderPosition` (an existing UI-intent value), not a build stat.
- The **five-tab Stat Sheet** content is rendered by the unchanged `StatSheetPanel` (Epic 1) — this story does not add or alter a single stat row.

The SOURCE-AUDIT GUARDRAIL's "map each new stat to real shipped-data, or declare honest-`0.0` with no dead `StatKey`" requirement is satisfied by this explicit **no-new-stat / no-dead-key** declaration, and the guardrail's "value + element/type assertion test" requirement (which targets prose/tag stat parsing) **does not apply**. The relevant verification here is **component-behavior + accessibility assertion tests** in `RightPanel.test.tsx` (AC7).

## Tasks / Subtasks

- [ ] **Task 1 — Rebuild `ScoreGauge` as a 3/4-arc SVG with center score + delta (AC: 1)** — `lebo/src/features/optimization/ScoreGauge.tsx`
  - [ ] Keep the **props contract unchanged**: `{ baselineScore: BuildScore | null; previewScore?: BuildScore | null }`, the `role="region"` / `aria-label="Build scores"` wrapper, and `data-testid="score-gauge"`. RightPanel already passes `baselineScore={scores}` and `previewScore={previewScore}` — do not change the call site's props.
  - [ ] Reuse the existing `computeComposite()` helper (average of non-null axes, `Math.round`). Center text = `formatScore(baseComposite)` ("—" when null); "Build Score" label beneath.
  - [ ] Draw the **3/4-arc SVG** (180×160 viewBox): a background track `<circle>` (stroke `--color-bg-elevated`) and a gradient value `<circle>` using a `<linearGradient>` of `--color-accent-gold-dim` → `--color-accent-gold` → `--color-accent-gold-soft`; arc length = `Math.PI * r * 1.5` (270°), value sweep = `arc * clamp(composite,0,100)/100`, `transform="rotate(135 cx cy)"`, `strokeLinecap="round"`. Add the 11 tick marks (major/minor) as in the prototype reference. Give the `<svg>` `aria-hidden="true"`.
  - [ ] **Delta indicator:** when `previewScore != null`, compute `delta = previewComposite − baseComposite`; if `Math.abs(round1(delta)) !== 0`, render `▲ +{|delta|.toFixed(1)}` in `--color-data-positive` (delta>0) or `▼ -{…}` in `--color-data-negative` (delta<0). No delta element otherwise. **This replaces the old `→` comparison string** — update any test that asserted `→` (see Task 6).
  - [ ] Gate the arc `stroke-dasharray` transition behind `prefers-reduced-motion` via `useReducedMotion()` (no animated sweep when reduced motion).
  - [ ] Remove the now-unused horizontal-bar `ScoreBar` sub-component and the per-axis bar rows from `ScoreGauge` (the per-axis numbers now live in the pill trio — Task 2). Watch `noUnusedLocals`.

- [ ] **Task 2 — DMG / SURV / SPD pill trio (AC: 2)** — `lebo/src/features/layout/RightPanel.tsx` (or a small co-located `ScoreTrio` in `optimization/`)
  - [ ] Beneath `<ScoreGauge>`, render a three-pill row: DMG (`--color-data-damage`), SURV (`--color-data-surv`), SPD (`--color-data-speed`). Each pill: small uppercase label + monospace value (`var(--font-mono)`) = `Math.round(scores.<axis> ?? 0)`, or `—` when `scores` is null / the axis is null.
  - [ ] Tokens only (no inline hex). Keep it inside the existing `activeBuild ? … : "Select a build…"` guard so it hides with no build.
  - [ ] If you extract a `ScoreTrio` component, put it in `features/optimization/`, named export, no default, imports grouped external → shared → feature-local.

- [ ] **Task 3 — Optimization Intent zone label + single-source zone helper (AC: 3)** — `lebo/src/features/optimization/OptimizationSlider.tsx` (+ new `lebo/src/shared/utils/archetypeZone.ts`; + one token in `global.css`)
  - [ ] Add `export function getArchetypeZone(position: number): { name: string; sub: string; colorVar: string }` in `shared/utils/archetypeZone.ts` with the five bands: 0–19 Juggernaut (`--color-slider-juggernaut`, "Survivability first"); 20–39 Bulwark (`--color-node-available`, "Defense over offense"); 40–59 Balanced (`--color-accent-gold`, "Equal weight"); 60–79 Aggressive (`--color-zone-aggressive`, "Offense over defense"); 80–100 Glass Cannon (`--color-slider-glass-cannon`, "Damage at all costs"). Return `colorVar` as a `var(--…)` string so callers never inline hex. (Lives in `shared/utils` because it is presentational cross-cutting and must stay single-sourced.)
  - [ ] In `global.css` `@theme`, add the **one** missing token next to the existing slider tokens: `--color-zone-aggressive: #C77840;` (a warm orange between gold and crimson). Reuse the existing `--color-slider-juggernaut` / `--color-slider-glass-cannon` and `--color-node-available` / `--color-accent-gold` for the other four zones — do **not** add duplicates.
  - [ ] In `OptimizationSlider`, keep the **existing native range input** and its keyboard handler / aria attributes verbatim (do not port the prototype's custom mouse-drag `ArchetypeSlider` — it is not keyboard-accessible). Replace/extend the endpoint labels per the design (Juggernaut / Balanced / Glass Cannon endpoint tints are optional polish) and render the live **zone label**: `zone.name` in `zone.colorVar` + a muted `zone.sub` sub-caption, driven by `getArchetypeZone(sliderPosition)`.
  - [ ] Keep `onChange` → `setSliderPosition(val)` + `setActiveBuildSliderPosition(val)` and the keyboard ±5 behavior unchanged.

- [ ] **Task 4 — Optimize Build button: gold + pulse-while-running, correct labels (AC: 5)** — `lebo/src/features/optimization/OptimizeButton.tsx` (+ `global.css` keyframe) (+ pass `hasSuggestions` from `RightPanel.tsx`)
  - [ ] Add `@keyframes pulse-gold` to `global.css` (e.g. box-shadow/opacity pulse on the gold accent, ~1.4s ease-in-out infinite). Apply it to the button **only while `isOptimizing` AND not reduced-motion** (`useReducedMotion()`); when reduced motion is set, no pulse — keep the existing static indeterminate-progress bar as the fallback affordance.
  - [ ] Labels: idle + no suggestions → **"Optimize Build"**; idle + suggestions present → **"Re-Optimize"**; running → **"Analyzing…"**. Add a `hasSuggestions: boolean` prop (default `false`) and pass `suggestions.length > 0` from `RightPanel`. Keep `id`/`data-testid="optimize-button"`, the `disabled`/`aria-disabled`/`aria-busy`/`aria-label` logic, and the `onOptimize` interactivity guard exactly as today.
  - [ ] Do **not** remove the existing offline-note / empty-context-note / "Using: {model}" affordances from `RightPanel` — they stay.

- [ ] **Task 5 — FineTune + section-header chrome reconciliation (AC: 4, 6)** — `lebo/src/features/optimization/FineTunePanel.tsx`, `lebo/src/features/layout/RightPanel.tsx`
  - [ ] `FineTunePanel`: keep the `Disclosure`/`DisclosureButton`/`DisclosurePanel` and all weight wiring; reconcile the heading text to **"Fine Tune Weights"** and the chevron affordance to the design. Keep the `prefers-reduced-motion` gating on the open/close transition.
  - [ ] `RightPanel`: add the **"AI Suggestions"** section header (with `{suggestions.length} ranked` muted-mono count when `> 0`) above `<SuggestionsList>`, and a **"Stat Sheet"** header above `<StatSheetPanel>`. Keep the existing dividers (`--color-bg-elevated` hairlines), the 340px/48px widths, the collapsed-rail glyph strip (composite score), and the StatSheet scroll container. Do **not** alter `SuggestionsList` or `StatSheetPanel` internals.

- [ ] **Task 6 — Update tests + a11y; clear RightPanel from the baseline (AC: 7)** — `lebo/src/features/layout/RightPanel.test.tsx` (+ optional `ScoreGauge.test.tsx` / `OptimizationSlider.test.tsx` if you prefer unit-level coverage of the helper)
  - [ ] **Fix the stale assertion** that puts RightPanel in the baseline: the test expects `/AI optimization requires internet connectivity/` but the component renders "AI optimization requires internet. Connect and retry." — update the expectation to the actual copy.
  - [ ] **Replace the `→` comparison-mode assertions** (the bar gauge is gone): assert the **delta indicator** instead — seed `scores` + `previewSuggestionRank` + a `suggestions[0].previewScore` and assert a ▲/▼ delta appears; with `previewSuggestionRank: null` assert no delta.
  - [ ] Add: center composite score renders for a seeded `scores`; DMG/SURV/SPD pills render the three rounded values (and `—` with no build); zone label matches `sliderPosition` at 10/30/50/70/90 (Juggernaut/Bulwark/Balanced/Aggressive/Glass Cannon — best asserted as a `getArchetypeZone` unit test plus one rendered check); Optimize button label flips "Optimize Build" ↔ "Re-Optimize" with/without suggestions and shows "Analyzing…" while `isOptimizing`; Fine Tune disclosure toggles; existing offline + empty-context guards still pass; `expect(await axe(container)).toHaveNoViolations()`.
  - [ ] Keep the existing store-seed/restore `beforeEach` pattern and the `useOptimizationStream` / `@tauri-apps/api/event` mocks. Do **not** create a separate vitest config or re-stub the four `test-setup.ts` polyfills.

- [ ] **Task 7 — Verify build + suite (AC: 7)**
  - [ ] `pnpm exec tsc --noEmit` → exit 0 (watch `noUnusedLocals`/`noUnusedParameters` after removing `ScoreBar`).
  - [ ] `CI=true pnpm exec vitest run src/features/layout/RightPanel.test.tsx` → passes.
  - [ ] `CI=true pnpm exec vitest run` → no new failures vs. the **updated** baseline (`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls` — `RightPanel` removed). Update the baseline note in `sprint-status.yaml` accordingly when the story is marked done.
  - [ ] `pnpm build` → exit 0 (only the pre-existing >500 kB chunk-size advisory is acceptable).

## Dev Notes

### Current state of the right panel — this is a re-skin, not a rewrite
`RightPanel.tsx` already composes the correct children in the correct order: `ScoreGauge` (score region) → divider → `OptimizationSlider` + `FineTunePanel` + `OptimizeButton` (+ model/offline/empty-context notes) → divider → `SuggestionsList` → divider → `StatSheetPanel`. The collapsed 48px rail already shows a score/zap/stats glyph strip. **Do not restructure this composition or its store reads.** The five visual deltas are: (1) gauge bars → 3/4-arc SVG + delta, (2) add the DMG/SURV/SPD pills, (3) add the slider zone label, (4) reconcile Fine Tune heading, (5) gold-pulse the Optimize button + section-header chrome. Story 2.1 already put the panel on-palette — keep the existing `--color-*` token usage. [Source: lebo/src/features/layout/RightPanel.tsx; lebo/src/features/optimization/ScoreGauge.tsx; OptimizationSlider.tsx; FineTunePanel.tsx; OptimizeButton.tsx]

### Composite & delta — reuse what `ScoreGauge` already computes (don't invent a "score" field)
There is **no** single `score`/`scoreDelta` field in the store — the prototype's `state.score`/`state.scoreDelta` are mock-only. The real source of truth is `optimizationStore.scores: BuildScore { damage, survivability, speed }` (each `number | null`). The **composite** is the rounded average of the non-null axes — `ScoreGauge.computeComposite()` already does this; reuse it for the gauge center and (over `previewScore`) for the delta. The **delta** is `previewComposite − baseComposite`, surfaced only while a suggestion is previewed. Preview wiring is already done in `RightPanel`: `previewScore = previewSuggestionRank !== null ? suggestions.find(s => s.rank === previewSuggestionRank)?.previewScore ?? null : null`. **Do not** add a new store field or a second scoring path. [Source: lebo/src/shared/types/optimization.ts (BuildScore, SuggestionResult); lebo/src/features/optimization/ScoreGauge.tsx:25-32; lebo/src/features/layout/RightPanel.tsx:26-29]

### Archetype zones — single source of truth, tokens not hex (UX-DR5 / Pattern P4-8)
The prototype hardcodes five zone hexes (`#2A4D7A`, `#4A7A9E`, gold, `#C77840`, `#C73232`). Three already have tokens — `--color-slider-juggernaut` (#2A4D7A), `--color-slider-glass-cannon` (#C73232), `--color-accent-gold` — and Bulwark's #4A7A9E equals the existing `--color-node-available`. Only **Aggressive #C77840** has no token; add it as `--color-zone-aggressive` in `@theme`. Put the position→zone mapping in **one** helper (`getArchetypeZone`) so the slider label (and any future Epic 6 archetype readout) cannot drift — the same "don't compute two answers for one truth" discipline the source-audit guardrail enforces for stats. The 2.1 review specifically flagged inventing palette values that look authoritative: reuse existing tokens where the values already match rather than re-introducing raw hex. [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/RightPanel.jsx:22-30,58-68; lebo/src/assets/styles/global.css:73-76,40-44,28]

### Keep the accessible slider — do NOT port the prototype's drag track
The prototype `ArchetypeSlider` is a custom `onMouseDown`/`window.mousemove` track with **no keyboard support and no aria** (`RightPanel.jsx:194-222`). The current `OptimizationSlider` is a native `<input type="range" role="slider">` with full keyboard (±5 on arrows), `aria-valuemin/max/now/text`, and the gold focus ring via `.optimization-slider:focus-visible`. **Keep the native input** — only add the zone label around it. Regressing to the prototype's drag track would break NFR-14 / UX-DR12 and add an axe failure. [Source: lebo/src/features/optimization/OptimizationSlider.tsx:70-89; lebo/src/assets/styles/global.css:87-127]

### Pulse animation — add `pulse-gold`, gate on reduced motion
`global.css` currently has `analyzing-bar` / `analyzing-progress` (the OptimizeButton's loading bars) but **no `pulse-gold`** — add it. The button should pulse while `isOptimizing` only when motion is allowed; under `prefers-reduced-motion` the pulse is suppressed and the existing static indeterminate-progress bar + "This usually takes 20–30 seconds" copy remain the running affordance. Use the `useReducedMotion()` hook (already used by `FineTunePanel`). The global reduced-motion media block (`global.css:158+`) also blanket-disables animations, but gate explicitly in JSX too so the static fallback is intentional, not incidental. [Source: lebo/src/assets/styles/global.css:129-138,158-160; lebo/src/features/optimization/OptimizeButton.tsx; lebo/src/shared/hooks/useReducedMotion.ts]

### RightPanel is in the failing baseline on a stale string — clear it (like 2.2 cleared AppHeader)
`RightPanel.test.tsx:186` asserts `/AI optimization requires internet connectivity/`, but `RightPanel.tsx:135` renders "AI optimization requires internet. Connect and retry." — so the test fails today, which is why `RightPanel` sits in the standing baseline (`RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`). This story's goal mirrors Story 2.2 (which cleared `AppHeader`): fix the assertion, update tests to the new chrome, and **remove `RightPanel` from the baseline**. After this story the documented baseline is `ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`. Note `MOCK_BUILD` in the current test uses `schemaVersion: 1` — leave it (the test exercises chrome, not migration), but new builds in app code must be `schemaVersion: 2`. [Source: lebo/src/features/layout/RightPanel.test.tsx:35,186; lebo/src/features/layout/RightPanel.tsx:135]

### Accessibility (NFR-14 / UX-DR12)
- The gauge `<svg>` and the tick marks are decorative — `aria-hidden="true"`; the existing `role="region"`/`aria-label="Build scores"` wrapper + text values carry meaning. Same for the DMG/SURV/SPD pill decorations.
- Every interactive control (slider, Fine Tune disclosure button, Optimize button, weight sub-sliders, collapse toggle, context-note dismiss) keeps the **2px solid `--color-accent-gold` focus ring** (global `:focus-visible` / `.optimization-slider:focus-visible`) — never `outline: none` without a replacement.
- Gate **all** animation behind `prefers-reduced-motion`: gauge arc transition, `pulse-gold`, disclosure open/close. Use `useReducedMotion()`.
- Run `vitest-axe` on the rendered panel; **zero new violations**.

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or re-stub the four `test-setup.ts` polyfills (jest-dom, vitest-axe, ResizeObserver, matchMedia).
- Co-located tests only. Keep the existing `RightPanel.test.tsx` store-seed/restore `beforeEach` and the `vi.mock('../../shared/stores/useOptimizationStream', …)` + `vi.mock('@tauri-apps/api/event', …)` mocks (they prevent real Tauri listeners). Explicit `expect`, no snapshots.
- `SuggestionsList` and `StatSheetPanel` have their own coverage — the RightPanel test only needs to confirm they mount (`data-testid="suggestions-list"`, the stat-sheet container).
- Prefer a small unit test for `getArchetypeZone` (boundary values 0/19/20/39/40/59/60/79/80/100) — boundary correctness is the one piece of real logic this story adds.

### Project Structure Notes
- All source files are inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. The `_bmad-output/last-epoch-build-optimizer-UI-Handoff/RightPanel.jsx` prototype is **read-only reference** for layout/gauge geometry/zone copy only — never wire prototype JSX/CSS into the app (ADR-P4-007: faithful recreation, not a wrapper).
- Naming/structure: `archetypeZone.ts` is `camelCase.ts` in `shared/utils/`; any extracted `ScoreTrio.tsx` is `PascalCase.tsx` in `features/optimization/`; no barrel files; named exports only; group imports external → shared → feature-local.
- **Phase boundary:** never write to `_bmad-output/` (Phase 1/handoff artifacts) — read-only context. (The sprint-status.yaml + story files under `_bmad-output/implementation-artifacts/` are the exception this workflow itself writes; do not edit other `_bmad-output` content.)

### Out of scope (do NOT touch here)
- `StatSheetPanel` five-tab content, `StatSourceTooltip`, any stat row/value/tab (Epic 1 — done).
- `SuggestionsList` card content, `startOptimization`, the `optimization:*` stream, preview/efficiency wiring (Epic 3).
- Any store schema/action/type change; the scoring engine; data loader; Rust; new dependency.
- `LeftPanel`, `CenterCanvas`, the center tab bar, `StatusBar`, `AppHeader` (Stories 2.3/2.5/2.8 and prior).

### References
- [Source: epics.md#Story 2.4: Right panel — score gauge, archetype, optimizer chrome] — ACs (FR-35): 3/4-arc gauge + delta, DMG/SURV/SPD pills, Optimization Intent slider + zone label, collapsible Fine Tune Weights, pulsing Optimize button, AI Suggestions card area, restyled Stat Sheet (chrome only).
- [Source: epics.md#UX-DR4] — Score Gauge: 3/4-arc SVG, gradient fill, center build score + delta indicator.
- [Source: epics.md#UX-DR5] — Optimization Intent slider, five zone labels in zone colors (Juggernaut / Bulwark / Balanced / Aggressive / Glass Cannon).
- [Source: epics.md#UX-DR7] — five-tab Stat Sheet structure (owned by Epic 1; this story restyles surrounding chrome only).
- [Source: epics.md#Epic 2 — Owns] — UX-DR4, UX-DR5 (+ UX-DR1/2/3 prior), NFR-14; visual rebuilds, data wiring unchanged.
- [Source: architecture.md:486] — `RightPanel.tsx MODIFIED FR-35 score gauge, archetype slider, optimizer`.
- [Source: architecture.md:243] — `run_optimization (extended)` triggered by "Optimize Build" (right panel), output filtered to `passive_node`, `optimization:*` events — keep the existing trigger wiring.
- [Source: project-context.md#Optimization flow] — `scores`/`statSheet`/`previewStatSheet`/`previewSuggestionRank` semantics; suggestions stream incrementally; do not duplicate the `useStatSheet`/stream patterns.
- [Source: project-context.md#React / Zustand] — four stores only; no React Router; module-level empty constants; consume existing store actions, never `set()` directly.
- [Source: project-context.md#Accessibility] — 2px accent-gold focus ring; `prefers-reduced-motion`; axe-core CI fails on new violations.
- [Source: project-context.md#Code Quality / Tailwind v4] — no barrel files; named exports; tokens via `var(--color-*)`; never hardcode hex; CSS-first `@theme`, no `@apply`.
- [Source: lebo/src/features/layout/RightPanel.tsx] — current composition, collapsed rail, preview-score wiring, offline/empty-context notes.
- [Source: lebo/src/features/optimization/ScoreGauge.tsx; OptimizationSlider.tsx; FineTunePanel.tsx; OptimizeButton.tsx] — components to extend (props contracts, store reads, keyboard/aria, loading affordances).
- [Source: lebo/src/shared/types/optimization.ts] — `BuildScore`, `FineTuneWeights`, `SuggestionResult` (preview/delta source).
- [Source: lebo/src/assets/styles/global.css:19-85,87-138,158+] — `@theme` tokens (slider/data/accent), `.optimization-slider`, `analyzing-*` keyframes, reduced-motion block — add `--color-zone-aggressive` + `@keyframes pulse-gold` here.
- [Source: lebo/src/features/layout/RightPanel.test.tsx] — store-seed pattern, mocks, the stale offline-copy assertion to fix and the `→` assertions to replace.
- [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/RightPanel.jsx:22-191] — prototype gauge geometry (180×160, r=64, 270° arc, rotate 135), zone bands/colors/copy, pill trio, pulse button (read-only reference — recreate, do not import).

## Previous Story Intelligence (Story 2.3 — done)

- **Extension-not-rewrite is the Epic 2 pattern.** 2.2 (header) and 2.3 (left panel) both kept working markup/wiring and applied targeted visual deltas + a single-source helper (`buildSectionStatus.ts`). Mirror that here: keep the composition, add `getArchetypeZone` as the single-source helper, re-skin the five pieces.
- **Baseline-failure literacy.** The standing UI baseline is `RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`. 2.2 cleared `AppHeader`, 2.3 kept `LeftPanel` out — this story should **clear `RightPanel`** (it's only in the baseline on the stale offline-copy string). "No new failures" is the floor; clearing RightPanel is the target.
- **Don't-invent discipline (2.1/2.3 reviews).** Use existing tokens where values already match (Bulwark = `--color-node-available`, Juggernaut/Glass Cannon = existing slider tokens) rather than re-introducing raw hex; add only the one genuinely-missing `--color-zone-aggressive`. Use the prototype's exact zone **copy** ("Survivability first", "Equal weight", etc.) rather than improvising.
- **Single-source-of-truth discipline (2.3's `buildSectionStatus.ts`).** The zone mapping is the same shape of risk the source-audit guardrail guards for stats — keep one function, no second copy.
- **Test/seed process (2.3 + existing RightPanel test).** Store seed/restore in `beforeEach`, `invokeCommand`/stream/event mocked, `vitest-axe` on the container — reuse exactly.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots (no semantic signal); the last semantic work was Story 2.3 (left panel), 2.2 (header), 2.1 (tokens). No right-panel changes are in flight — `RightPanel.tsx` and its children are stable and safe to extend.
- No new dependency: React 19.1, Zustand 5, Tailwind v4, Headless UI (`Disclosure`), `@testing-library/react`, `vitest-axe`, `useReducedMotion` are all already present. This story adds **no** library and **no** Rust/IPC change — it is frontend chrome + one CSS token + one keyframe.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-05 — Story 2.4 drafted (ready-for-dev): right-panel score-gauge / archetype / optimizer chrome rebuild to the Claude Design handoff. Extension/reconciliation of the existing `RightPanel.tsx` + children — `ScoreGauge` horizontal bars → 3/4-arc SVG with gradient fill, center composite score, and ▲/▼ delta (preview wiring reused); new DMG/SURV/SPD pill trio; `OptimizationSlider` gains the UX-DR5 five-zone label via a single-source `getArchetypeZone` helper (one new `--color-zone-aggressive` token, reuse existing for the other four); `FineTunePanel` heading reconciled; Optimize Build button gold + `pulse-gold` while running (new keyframe, reduced-motion gated); "AI Suggestions" / "Stat Sheet" section-header chrome; native accessible slider kept (no prototype drag-track regression). No new stat (Source Audit: N/A — no-new-stat / no-dead-key). RightPanel.test.tsx updated (stale offline copy fixed, `→` → delta assertions, zone/pill/label coverage, axe) with the goal of **clearing RightPanel from the failing baseline**. Scope boundary: StatSheet content (Epic 1), suggestion-card content + optimization behavior (Epic 3), and all store schema/types are untouched.
