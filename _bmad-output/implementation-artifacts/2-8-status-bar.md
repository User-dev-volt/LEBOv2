# Story 2.8: Status bar

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a footer status bar showing data version, unsaved state, and LLM provider,
so that I always know my data freshness and which model is active.

## Acceptance Criteria

1. **Given** the footer
   **When** it renders
   **Then** it shows the data version (Season 4 / Shattered Omens + date), an unsaved-changes gold dot when the build is dirty, and the LLM provider + model name (FR-39).

2. **Given** all components rebuilt in this epic
   **When** they render
   **Then** each keeps a 2px solid accent-gold focus ring on interactive elements, gates animation behind `prefers-reduced-motion`, applies the appropriate aria-live regions, and introduces zero new `vitest-axe` violations (UX-DR12, NFR-14).

[Source: epics.md:606-620 (Story 2.8); epics.md:97 (FR-39); epics.md:197 (UX-DR12)]

## Source Audit

**N/A — no-new-stat / no-dead-key.** Every value the status bar displays is existing state re-presented:
- Data version + date = `gameDataStore.dataVersion` / `dataUpdatedAt`, set at startup by `gameDataLoader.ts:53-55` from `manifest.gameVersion` ("Season 4 (Shattered Omens)") and `manifest.generatedAt` ("2026-03-26T00:00:00Z") — the shipped `lebo/src-tauri/resources/game-data/manifest.json` already contains exactly the FR-39 strings. No loader or parsing change.
- Unsaved state = `buildStore.activeBuild.isPersisted` — the same signal Story 2.3's gold Save button and `SavedBuildsList`'s "Unsaved build" notice already consume.
- LLM provider = `appStore.llmProvider`, set at startup by the sequential vault-read chain in `App.tsx:62-76`.

No new `StatKey`, no `StatSheet` field, no compute change → the guardrail's value+element loader assertion tests do not apply; component-behavior + a11y assertions are the relevant verification.

**Honest-display note (same spirit as the guardrail):** for the OpenRouter provider there is NO single active model — `openrouter_service.rs` rotates through 7 free models per request and the `get_model_preference` vault key is not exposed to the frontend (not in `lib.rs` `invoke_handler!`). Displaying a fixed model name (as the prototype mocks with "gemini-2.0-flash") would be a lie. Display `OpenRouter · free rotation` instead. For Claude the model IS fixed: `CLAUDE_MODEL = "claude-sonnet-4-6"` (`claude_service.rs:8`).

## Tasks / Subtasks

- [x] **Task 1 — Rebuild `StatusBar.tsx` to the three-segment prototype layout (AC: 1)**
  - [x] Keep the `<footer>` landmark. Layout per prototype `app.jsx:375-381` + `styles.css:412-422`: flex row, left-aligned data segment, center flex-1 unsaved segment (`text-align: center`), right LLM segment. Map prototype tokens → real ones: `--bg-base` → `--color-bg-base` (background), `--hairline` → `--color-bg-elevated` (border-top), `--text-muted` → `--color-text-muted` (base text), `--text-secondary` → `--color-text-secondary` (value text). 11px ≈ keep existing `text-xs`; dates/model ids in `font-mono` (prototype `.mono`).
  - [x] Left segment: `Data: {dataVersion} — {date}` — keep the existing render logic verbatim (hide when `dataVersion` null; date = `dataUpdatedAt.split('T')[0]`, omitted when null). It already produces "Data: Season 4 (Shattered Omens) — 2026-03-26" from the shipped manifest.
  - [x] Remove the visible Online/Offline dot+text from the footer — it duplicates the AppHeader indicator (Story 2.2, `AppHeader.tsx:188-200`) and the prototype's status bar has no online segment. **Preserve the announcement**: see Task 4.
- [x] **Task 2 — Unsaved-state middle segment (AC: 1)**
  - [x] Read `useBuildStore((s) => s.activeBuild)`. Dirty = `activeBuild && !activeBuild.isPersisted`.
  - [x] Dirty → `● Unsaved changes` in `var(--color-accent-gold)` (the FR-39 gold dot; prototype app.jsx:378). Persisted build → `● All changes saved` in muted text. No active build → render the segment empty (keep the flex-1 spacer so left/right stay pinned; "All changes saved" with no build would be noise).
  - [x] The dot is text-accompanied ("Unsaved changes") so state is not conveyed by color alone — no extra ARIA needed; do NOT make this segment aria-live (it flips on every build mutation → screen-reader spam; UX-DR12 reserves polite regions for suggestion/loading/import-progress).
- [x] **Task 3 — LLM provider + model segment (AC: 1)**
  - [x] Read `useAppStore((s) => s.llmProvider)`. Render `LLM: {Provider} · {model}`:
    - `'claude'` → `LLM: Claude · claude-sonnet-4-6` — define `const CLAUDE_MODEL_LABEL = 'claude-sonnet-4-6'` in `StatusBar.tsx` with a comment that it mirrors `CLAUDE_MODEL` in `lebo/src-tauri/src/services/claude_service.rs:8` and must be updated together (no IPC exists to read it; adding a command is out of scope).
    - `'openrouter'` → `LLM: OpenRouter · free rotation` (honest label — see Source Audit; do NOT copy the prototype's mocked "gemini-2.0-flash").
    - `null` (startup, pre-vault-read) → render nothing for this segment; `App.tsx` resolves the provider (or falls back to `'claude'`) shortly after mount.
  - [x] Model id in `font-mono`, provider name in `--color-text-secondary` (prototype app.jsx:380).
- [x] **Task 4 — Preserve the connectivity announcement (AC: 2)**
  - [x] Keep an `sr-only` span inside the footer with `aria-live="polite"` `aria-atomic="true"` whose text is `Online`/`Offline` from `useAppStore((s) => s.isOnline)`. The current StatusBar is the app's only aria-live connectivity announcer (AppHeader's indicator is visual-only) — removing the visible segment must not silently drop the screen-reader announcement.
- [x] **Task 5 — Rewrite `StatusBar.test.tsx` to the new contract (AC: 1, 2)**
  - [x] Keep the existing reset harness (capture initial store state, `setState(initial, true)` in `beforeEach`) and extend it to `useBuildStore`. No Tauri IPC to mock — the component reads only store state.
  - [x] Assert: data segment with version+date / version-only / hidden-when-null (keep the three existing cases, using the real-shaped value `'Season 4 (Shattered Omens)'` in at least one); dirty build → "Unsaved changes" rendered and gold (assert text presence + `var(--color-accent-gold)` on the segment is acceptable here since text conveys the state); persisted build → "All changes saved"; no build → neither string; `llmProvider 'claude'` → `Claude` + `claude-sonnet-4-6`; `'openrouter'` → `OpenRouter` + `free rotation`; `null` → no "LLM:" text; visible Online/Offline text gone but the sr-only live region still announces (query `[aria-live="polite"]` inside `contentinfo`, assert textContent flips with `setOnline`).
  - [x] `vitest-axe`: `expect(await axe(container)).toHaveNoViolations()` (AC2 — zero new violations).
  - [x] Build state stub: a minimal `BuildState`-shaped object is enough; set via `useBuildStore.setState({ activeBuild: {...} })` — remember new-build shape uses `schemaVersion: 2` and `isPersisted: boolean`.
- [x] **Task 6 — Epic 2 a11y closeout + verification (AC: 2)**
  - [x] StatusBar itself has zero interactive elements (no focus-ring surface) and zero animation (no reduced-motion surface) — AC2 for this component is the axe test + correct aria-live usage. The epic-wide AC2 sweep is verified by the full suite: every 2.x component test already carries its own axe assertion; "no new failures vs baseline" is the closeout evidence.
  - [x] `pnpm exec tsc --noEmit` → exit 0 (watch `noUnusedLocals` after removing the online segment's imports if any become unused).
  - [x] `CI=true pnpm exec vitest run src/features/layout/StatusBar.test.tsx` → green.
  - [x] `CI=true pnpm exec vitest run` → **no new failures** vs the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`, 8 failures / ~1125 passing); no baseline file cleared or added.
  - [x] `pnpm build` → exit 0 (pre-existing >500 kB chunk advisory only).

## Dev Notes

### This is the smallest Epic 2 story — a single-component visual rebuild, zero wiring changes
`StatusBar.tsx` (37 lines) already renders the data segment correctly; this story re-arranges it to the prototype's three-segment layout, adds the unsaved + LLM segments from **existing** store state, and drops the duplicated online segment. No store field, no action, no IPC, no Rust, no dependency. Mirror the Epic 2 pattern (2.2–2.7): keep the wiring, rebuild the chrome. [Source: lebo/src/features/layout/StatusBar.tsx; epics.md:266-269]

### The prototype is the visual source of truth
`_bmad-output/last-epoch-build-optimizer-UI-Handoff/app.jsx:375-381`:
```jsx
<footer className="statusbar">
  <span>Data: <span style={{color:"var(--text-secondary)"}}>Season 4 (Shattered Omens)</span> — <span className="mono">2026-03-26</span></span>
  <span className="statusbar-mid">
    {state.unsaved ? <span style={{color:"var(--accent-gold)"}}>● Unsaved changes</span> : <span>● All changes saved</span>}
  </span>
  <span>LLM: <span style={{color:"var(--text-secondary)"}}>OpenRouter</span> · <span className="mono">gemini-2.0-flash</span></span>
</footer>
```
`.statusbar` (styles.css:412-422): flex, `padding: 0 14px`, `background: var(--bg-base)`, `border-top: 1px solid var(--hairline)`, `font-size: 11px`, `color: var(--text-muted)`, `gap: 16px`; `.statusbar-mid { flex: 1; text-align: center; }`. Adapt, don't wrap: real tokens only (`--color-bg-base`, `--color-bg-elevated` for the hairline, `--color-text-muted/-secondary`, `--color-accent-gold`); the model name is real, not the prototype's mock (see Source Audit). The prototype's online dot lives in the **header** (`app.jsx:353-355`), which `AppHeader.tsx:188-200` already implements — the footer one is the Phase-3 leftover to remove.

### Data sources — all already in stores, read-only consumption
| Segment | Source | Set by | Real value |
|---|---|---|---|
| Data version | `gameDataStore.dataVersion` | `gameDataLoader.ts:54` ← `manifest.gameVersion` | `"Season 4 (Shattered Omens)"` |
| Data date | `gameDataStore.dataUpdatedAt` | `gameDataLoader.ts:55` ← `manifest.generatedAt` | `"2026-03-26T00:00:00Z"` → split('T')[0] |
| Unsaved | `buildStore.activeBuild?.isPersisted` | every build mutation sets `false`; save sets `true` | dirty = `activeBuild && !isPersisted` |
| Provider | `appStore.llmProvider` | `App.tsx:62-76` vault chain (`'claude'`/`'openrouter'`, fallback `'claude'`, starts `null`) | — |
| Model | none for OpenRouter (rotates); Rust const for Claude | `claude_service.rs:8` | `claude-sonnet-4-6` |

Do not confuse the store's `dataVersion` (= manifest **gameVersion**, the display string) with manifest's own `dataVersion` field (`"s4.1"`, internal) — the existing component already reads the right one. [Source: lebo/src/features/game-data/gameDataLoader.ts:53-55; lebo/src-tauri/resources/game-data/manifest.json]

### `isPersisted` is the established dirty signal — reuse it, don't invent one
Every mutating `buildStore` action (`setCharacterLevel`, `applyNodeChange`, `placeIdol`, `setBlessing`, …) sets `isPersisted: false`; `saveBuild` → `setActiveBuildPersisted()` sets it `true`. Story 2.3's Save button goes gold on the same predicate, and `SavedBuildsList.tsx:24` shows its "Unsaved build" notice on it. The status-bar dot is a third consumer of the same signal — consistency is the point. Do not subscribe to `useAutoSave` internals or add any debounce; render the raw flag. [Source: lebo/src/shared/stores/buildStore.ts:90,130; lebo/src/features/build-manager/SavedBuildsList.tsx:24]

### Why the online segment moves out (and what must survive)
`AppHeader.tsx:188-200` (Story 2.2, done) renders the Online/Offline dot in the header exactly where the prototype puts it. The footer copy is redundant **visually** — but the footer's `aria-live="polite"` wrapper is currently the app's only spoken connectivity announcement (the header indicator has no live region; the three global live regions in `App.tsx:224-226` are for import/AI/error, and `useAccessibilityAnnouncer` only handles optimization events). Keep an `sr-only` polite live region in the footer announcing Online/Offline so screen-reader behavior is unchanged. Do NOT add a live region to AppHeader (out of scope, and duplicate announcers double-speak). [Source: lebo/src/features/layout/AppHeader.tsx:188-200; lebo/src/App.tsx:224-226; lebo/src/shared/hooks/useAccessibilityAnnouncer.ts]

### LLM model display — the honest-label decision (pre-made, don't relitigate)
- Claude: model is the compile-time const `CLAUDE_MODEL: "claude-sonnet-4-6"` (`claude_service.rs:8,121,277`). There is no command exposing it; mirror it as a commented TS constant. The test asserting the literal `claude-sonnet-4-6` doubles as the drift tripwire when the Rust const changes.
- OpenRouter: `openrouter_service.rs:15-23` defines a 7-entry `MODELS` rotation tried in order **per request** — the "active model" doesn't exist at idle. `get_model_preference` exists in `keychain_service.rs:246` but has no command wrapper and is not in `lib.rs:77-112` `invoke_handler!` (the `Settings.test.tsx:12` mock for it is dead defensive code — no frontend caller). Exposing it would add a Rust command + a sequential vault read; not justified for a footer label. → `free rotation`.
- Do NOT add a Tauri command, do NOT read the vault from the frontend, do NOT `Promise.all` anything against the existing startup vault chain (Stronghold reads must stay sequential — project-context.md#IPC).

### Design tokens — use only what exists (Pattern P4-8)
Available: `--color-bg-base/-surface/-elevated/-hover/-sunken`, `--color-accent-gold/-gold-soft/-gold-dim`, `--color-text-primary/-secondary/-muted`, `--color-data-*`. **No `--hairline`, no `--color-border`, no `--accent-gold-tint`** (prototype names). The current footer uses `--color-bg-elevated` as background and `--color-bg-hover` as border — the prototype wants `--color-bg-base` background + `--color-bg-elevated` hairline; switch to that mapping. No inline hex. [Source: lebo/src/assets/styles/global.css:19-83; project-context.md#Tailwind v4]

### Accessibility (NFR-14 / UX-DR12)
- The footer has **no interactive elements** — no focus-ring work. Keep it that way; FR-39 asks for display only.
- **No animation** — nothing to gate behind `prefers-reduced-motion`. Do not add a pulse to the gold dot.
- aria-live: connectivity announcement only (sr-only, polite, atomic). Unsaved state and LLM label are NOT live regions (mutation-frequency spam / static config respectively).
- `vitest-axe` on the rendered footer — zero violations. The `<footer>` element provides the `contentinfo` landmark; keep it.

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or re-stub the four polyfills (jest-dom, vitest-axe, ResizeObserver, matchMedia).
- Follow the existing `StatusBar.test.tsx` harness: real Zustand stores, initial-state capture + `setState(initial, true)` reset, no `vi.mock` needed (no IPC in this component). Add `useBuildStore` to the reset set.
- Co-located tests, explicit `expect`, no snapshots. Assert by visible text and roles, not brittle DOM structure; the one style assertion that earns its keep is gold on the unsaved segment (the AC names the color).
- Test files stay green — `StatusBar.test.tsx` is NOT in the failing baseline and must not enter it.

### Project Structure Notes
- All changes inside `LEBOv2/lebo/src/features/layout/` — Phase 2 active tree. `StatusBar.tsx` + `StatusBar.test.tsx` only; `App.tsx` already mounts `<StatusBar />` (App.tsx:236), no host change.
- Naming holds: `PascalCase.tsx`, named exports only, no barrel files, imports grouped external → shared → feature-local. No comments except the CLAUDE_MODEL mirror note (a genuine hidden constraint).
- **Phase boundary:** `_bmad-output/` (prototype, handoff, planning docs) is read-only reference; the story file + `sprint-status.yaml` under `implementation-artifacts/` are the workflow-owned exceptions.

### Out of scope (do NOT touch here)
- `AppHeader.tsx` (2.2 — done; its online indicator stays as-is), `LeftPanel` (2.3), `RightPanel` (2.4), `CenterCanvas` (2.5), Blessing/Idol editors (2.6/2.7).
- All stores: no new field, action, or store. `appStore.llmProvider`/`isOnline`, `gameDataStore.dataVersion`/`dataUpdatedAt`, `buildStore.activeBuild` are read-only consumption.
- Rust / IPC: no `get_model_preference` command registration, no new command, no `lib.rs` change. (Aside spotted during analysis, do NOT fix here: `openrouter_service.rs:484` test asserts `MODELS.len() == 4` but the list has 7 entries — pre-existing Rust-side inconsistency, out of scope.)
- The game-data loader, manifest, staleness system, `compute_stats`, optimizer, gear, and anything PixiJS.

### References
- [Source: epics.md:606-620 (Story 2.8)] — both ACs verbatim.
- [Source: epics.md:97 (FR-39)] — "Status bar — data version (Season 4 / Shattered Omens + date), unsaved-changes gold dot, LLM provider + model name."
- [Source: epics.md:197 (UX-DR12); epics.md:266-269 (Epic 2 notes)] — a11y baseline; faithful rebuild, not prototype wrappers.
- [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/app.jsx:375-381; styles.css:412-422] — the three-segment visual target; [app.jsx:353-359] — online dot belongs to the header.
- [Source: architecture.md:488] — `StatusBar.tsx ← MODIFIED FR-39 data version, unsaved dot, LLM provider` (only file flagged for this story).
- [Source: lebo/src/features/layout/StatusBar.tsx + StatusBar.test.tsx] — current component + test to rebuild.
- [Source: lebo/src/features/layout/AppHeader.tsx:188-200] — the surviving online indicator.
- [Source: lebo/src/features/game-data/gameDataLoader.ts:53-55; lebo/src-tauri/resources/game-data/manifest.json] — data segment sources and real shipped strings.
- [Source: lebo/src/shared/stores/buildStore.ts:90,130; lebo/src/features/build-manager/SavedBuildsList.tsx:24] — `isPersisted` dirty-signal precedent.
- [Source: lebo/src/App.tsx:62-76] — `llmProvider` startup detection (sequential vault chain, `'claude'` fallback).
- [Source: lebo/src-tauri/src/services/claude_service.rs:8; openrouter_service.rs:15-23; keychain_service.rs:246; lib.rs:77-112] — model-name reality: fixed Claude const, OpenRouter rotation, no model-preference command.
- [Source: project-context.md#IPC (sequential vault reads); #Tailwind v4 (tokens); #Accessibility (focus ring / aria-live / reduced-motion rules)]

## Previous Story Intelligence (Story 2.7 — done)

- **Visual-rebuild-not-rewrite is the locked Epic 2 pattern** (2.2–2.7 all shipped this way): keep store reads/wiring, rebuild presentation. 2.8 is the purest case — presentation only.
- **Prototype-vs-real-data adaptation precedent**: 2.6 refused the prototype's `"{N}/5"` chip; 2.7 refused hardcoded 5×4. Here the analogous refusal is the prototype's mocked `gemini-2.0-flash` model name — display what's real (fixed Claude const / honest rotation label).
- **Token discipline**: prototype names `--hairline`/`--accent-gold-tint` don't exist; map to `--color-bg-elevated` / gold + `--color-bg-hover`. 2.6 fixed an undefined `--color-border` that slipped through — don't introduce another.
- **`noUnusedLocals` compile-ripple**: 2.6/2.7 both hit unused-import errors after deleting old UI. Removing the online segment may orphan nothing (both stores stay imported for other segments) — but verify with `tsc` before declaring done.
- **Assert semantics, not hex**: 2.6/2.7 review pattern — tests assert text/roles/aria, with at most one sanctioned color assertion where the AC names the color (the gold unsaved dot, like 2.6's gold active row via `aria-pressed` + text).
- **Baseline literacy**: standing failures = `ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls` (8 tests, ~1125 passing). "No new failures" is the floor; StatusBar tests must stay out of the baseline.
- **2.7 review false-positive lesson**: two Blind-Hunter findings dissolved against real source. When review flags something, re-read the actual code path before patching.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots; last semantic work is Stories 2.1–2.7 (tokens → header → left → right → center bar → blessings → idols). `StatusBar.tsx`/`StatusBar.test.tsx` are untouched since Phase 3 — stable and safe to rebuild; no in-flight work collides.
- No new dependency, no Rust change, no store change anywhere in this story. React 19.1, Zustand 5, Tailwind v4, `@testing-library/react`, `vitest-axe` all present.
- Latest-tech research: skipped — no new library or version-sensitive API surface (flexbox footer + store reads).

## Project Context Reference

`_bmad-output/project-context.md` (85 rules) applies in full. Most load-bearing here: no barrel files / named exports only; no raw `invoke()` (moot — no IPC); sequential vault reads (don't add frontend vault access); Tailwind v4 CSS-first tokens, never `@apply`, never inline hex; `BuildState` optional-field defaults; test-setup.ts polyfills not re-stubbed; Phase boundary (never write outside `LEBOv2/` except workflow-owned implementation-artifacts).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8)

### Debug Log References

None — implementation was clean; no debugging cycles required. All four verification gates passed on the first run.

### Completion Notes List

- Rebuilt `StatusBar.tsx` into the prototype's three-segment footer: left `Data: {version} — {date}` (value in `--color-text-secondary`, date in `font-mono`), center `flex-1` unsaved-state segment, right LLM provider+model. Footer tokens remapped — background `--color-bg-base`, hairline (border-top) `--color-bg-elevated`, base text `--color-text-muted`.
- Center segment: dirty (`activeBuild && !isPersisted`) → gold `● Unsaved changes`; persisted → muted `● All changes saved`; no active build → empty (flex-1 spacer retained so left/right stay pinned). Not aria-live (mutation spam).
- LLM segment honest labels: `Claude · claude-sonnet-4-6` via `CLAUDE_MODEL_LABEL` const mirroring `claude_service.rs:8` (commented drift note — no IPC exposes it); `OpenRouter · free rotation` (7-model per-request rotation, `get_model_preference` unregistered — no single honest model); `null` → segment hidden.
- Removed the visible Online/Offline segment (duplicate of AppHeader 2.2) but preserved it as an `sr-only` `aria-live="polite"` region — verified during implementation to be the app's ONLY spoken connectivity announcer (AppHeader indicator has no live region; the three `App.tsx` global live regions cover import/AI/error only).
- No store / IPC / Rust / dependency change. Source Audit N/A — no-new-stat / no-dead-key (every value re-presents existing store state).
- Rewrote `StatusBar.test.tsx` to the three-segment contract: 11 tests (data version+date / version-only / hidden, dirty→gold, persisted, no-build, claude/openrouter/null LLM, sr-only connectivity flip, axe). Extended the reset harness to `useBuildStore`; typed `makeBuild` factory mirrors the store's own build shape.
- Out-of-scope items left untouched as documented: `openrouter_service.rs:484` asserts `MODELS.len() == 4` vs the actual 7 (pre-existing Rust-side inconsistency; not in the vitest gate); no `get_model_preference` command registration.
- Verification: `tsc --noEmit` → 0; `StatusBar.test.tsx` → 11/11; full `vitest run` → 1129 passed, 8 failed across exactly the standing baseline (ProviderSelector / Settings / SkillTreeCanvas / TreeControls) — no new failures, no baseline file cleared or added; `pnpm build` → 0 (pre-existing >500 kB chunk + font advisories only).

### File List

- `lebo/src/features/layout/StatusBar.tsx` (modified)
- `lebo/src/features/layout/StatusBar.test.tsx` (modified)

## Change Log

| Date | Change |
|------|--------|
| 2026-06-10 | Story created (create-story workflow) — ultimate context engine analysis completed; comprehensive developer guide created. Status: ready-for-dev. |
| 2026-06-28 | Implemented via dev-story — three-segment footer rebuild (data / unsaved / LLM), Online/Offline moved to sr-only aria-live, honest LLM labels, token remap; StatusBar.test.tsx rewritten (11 tests + axe). tsc 0 / StatusBar 11/11 / full suite 1129 pass, 8 standing-baseline fail / build 0. Status: ready-for-dev → review. |
| 2026-06-28 | Code review (BMAD adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). Auditor PASS (AC1 + AC2 MET). Triage: 1 decision-needed (footer muted-text WCAG-AA contrast 2.54:1), 1 patch (decorative glyphs not aria-hidden), 5 deferred, 9 dismissed. See Review Findings. |

## Review Findings

_Code review — 2026-06-28. Three adversarial layers (Blind Hunter / Edge Case Hunter / Acceptance Auditor). **Acceptance Auditor verdict: PASS** — AC1 (data version + gold unsaved dot + LLM provider/model) and AC2 (focus ring / reduced-motion / aria-live / zero axe violations) both MET; OpenRouter "free rotation" and the no-focus-ring/no-animation choices confirmed as sanctioned. No crashes, no undefined tokens, `isPersisted` always defined, `contentinfo` role holds in production. Triage below: 1 decision-needed, 1 patch, 5 deferred, 9 dismissed._

### Decision Needed

- [ ] [Review][Decision] Footer muted-text contrast fails WCAG AA (2.54:1) [StatusBar.tsx:25] — The token remap set the footer base text to `--color-text-muted` (#5A5050) on `--color-bg-base` (#0a0a0b) = **2.54:1**, below AA's 4.5:1 (and below the 3:1 large-text floor). Affects the "Data:"/"LLM:" labels, the mono date, the mono model id, and the muted "● All changes saved" line. The data *values* (`--color-text-secondary` #9E9494 = 6.71:1) and the gold unsaved dot (8.66:1) pass. Regression from the prior footer, which used secondary (6.71:1) throughout. AC2's `vitest-axe` check cannot catch this — axe's color-contrast rule is inert under jsdom — so "zero axe violations" is false assurance on this axis. The remap was spec-mandated (Dev Notes line 107), so the resolution needs a human call: keep spec-faithful muted (accept sub-AA on the labels/date/model) vs. raise those sub-elements to secondary for AA.

### Patches

- [ ] [Review][Patch] Decorative glyphs (●, ·, —) not hidden from assistive tech [StatusBar.tsx:31,38,41,49,54] — wrap purely-decorative glyphs in `aria-hidden="true"` so screen readers don't read "black circle Unsaved changes" / "middle dot" / "em dash" as noise. Zero visual change; axe cannot catch this.

### Deferred

- [x] [Review][Defer] Offline-at-startup is never announced [StatusBar.tsx:61-63] — deferred, pre-existing. ARIA live regions don't announce content present at first render; if the app starts offline (`isOnline` defaults false → `setOnline(false)` is a no-op), no connectivity status is spoken. The old footer carried the same polite region + mount behavior — not introduced by this story.
- [x] [Review][Defer] Unsaved/saved state is silent to assistive tech [StatusBar.tsx:35-42] — deferred, sanctioned. The center segment is intentionally NOT aria-live per Task 2 (flips on every build mutation → SR spam; UX-DR12 reserves polite regions for suggestion/loading/import). Logged as a possible future UX consideration.
- [x] [Review][Defer] CLAUDE_MODEL_LABEL hand-mirror can drift from the Rust const [StatusBar.tsx:7] — deferred, documented trade-off. No IPC exposes the model name; currently matches `claude_service.rs:8` and is guarded by the drift-tripwire test. A live read would need an out-of-scope Tauri command.
- [x] [Review][Defer] LLM else-branch assumes any non-'claude' provider is OpenRouter [StatusBar.tsx:44-57] — deferred, latent. Safe today (closed union `'claude' | 'openrouter' | null`, null filtered by `&&`); would mislabel only if a 3rd provider is ever added to the union.
- [x] [Review][Defer] Center "unsaved" segment isn't truly centered [StatusBar.tsx:35] — deferred, cosmetic. `flex-1 text-center` centers within leftover space, so the text drifts with unequal side widths. Faithful to the prototype's `.statusbar-mid { flex:1; text-align:center }`.

### Dismissed (9)

- **Visible connectivity indicator "lost"** (Blind Hunter) — false positive: it survives visibly in `AppHeader` (Story 2.2); this story deliberately moved it there and kept only the sr-only announcer in the footer.
- **"free rotation" hides the OpenRouter model** — sanctioned honest-label (Source Audit; Auditor confirmed). There is no single active model to show.
- **`dirty.style.color` asserts a `var()` inline style** — spec-sanctioned single color assertion (the AC names the color); currently green.
- **`not.toHaveTextContent('—')` is footer-wide** — works today; the em-dash only appears as the date separator.
- **Redundant `isDirty` ternary** — harmless; arguably clearer as-is.
- **Tests depend on footer→`contentinfo` landmark** — verified to hold in production (no `main`/`section`/`article`/`aside` ancestor).
- **`dataUpdatedAt` garbage passthrough / silent date drop** — pre-existing verbatim logic; manifest-controlled data is never malformed.
- **No overflow guard for a very long `dataVersion`** — won't occur at the app's 1280px min-width with real data.
- **Empty-string `dataVersion` suppresses the date** — `dataVersion` is null or a real string, never `''`.
