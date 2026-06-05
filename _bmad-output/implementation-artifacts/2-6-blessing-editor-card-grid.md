# Story 2.6: Blessing editor card grid

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want blessings shown as a two-column card grid with one card per monolith timeline and inline blessing selection,
so that I can pick blessings visually without dropdowns.

This is the **sixth story of Epic 2 (UI/UX Revamp — Claude Design System)**, continuing the exact discipline of Stories 2.2/2.3/2.4/2.5: the **data wiring already exists and is correct** — `BlessingsPanel.tsx` already reads `blessingsDatabase` from `gameDataStore`, groups entries by timeline, reads `activeBuild.blessings`, and writes via `setBlessing(timelineId, blessingId | null)`. This story is a **visual rebuild of the blessing editor only** (FR-37): replace the per-timeline `<select>` dropdown + search input with a **two-column card grid** (one card per timeline) whose blessing options are **inline-selectable rows** (no dropdown), with the active blessing highlighted gold. **Blessing data wiring is unchanged from Phase 3** (epics.md#Story 2.6, epics.md:269).

The concrete deltas are:

1. **Rebuild `BlessingsPanel` as a two-column card grid (FR-37):** a CSS grid `gridTemplateColumns: 1fr 1fr` (two columns) with **one card per timeline**. The card header is the **timeline name** (`group.timelineName`). Inside each card, the timeline's blessing entries render as **inline-selectable rows** — clickable `<button>`s, not `<option>`s in a `<select>`.
2. **Active blessing highlighted gold (FR-37):** the active option row (where `blessings[timelineId] === entry.id`) gets a **gold border** + gold text; the card containing an active blessing gets a **gold border** (gold-dim) and gold header text — matching the Claude Design prototype (`BlessingWeaver.jsx#BlessingEditor`).
3. **Preserve the "clear" capability with no dropdown:** the current `<select>` has a `— None —` option (clears via `setBlessing(timelineId, null)`). Keep that capability as an explicit inline **"None"** selectable row per card (selected/gold when no blessing is active for that timeline), so deselection survives the dropdown removal.
4. **Per-blessing stat-effect text preserved:** each option row shows the blessing `displayName` plus its formatted `statEffects` summary (the same text the current panel renders for the active blessing — now shown per row), using the existing format rule (`+30% increased cold damage`, etc.).
5. **Staleness banner preserved verbatim:** the `isBlessingsDataStale && !blessingsDataStaleAcknowledged` banner + Dismiss button (calling `acknowledgeBlessingsDataStaleness`) and the empty-state ("Blessings data not loaded.") are kept exactly — same store reads, same `role="status"`/`aria-live="polite"`.
6. **`BlessingTab` container widened for two columns:** `BlessingTab.tsx` hosts `BlessingsPanel` under a `max-w-2xl` column today (sized for a single-column dropdown list). Widen the Blessings section container so the two-column grid has room (the prototype uses `max-w-[880px]`); the **Conditions** section below it is **untouched** (FR-37 is blessings-only).
7. **Tests rewritten:** `BlessingsPanel.test.tsx` currently asserts `combobox`/`<option>` (dropdown) behavior — those assertions become invalid once the dropdown is gone. Rewrite to the card-grid contract: one card per timeline, timeline-name headers, inline option rows, click → `setBlessing(timelineId, id)`, None row → `setBlessing(timelineId, null)`, active row/card gold styling, stat-effect text, staleness banner + dismiss, and `axe` clean.

**Scope boundary (read this first — same discipline as Stories 2.2 / 2.3 / 2.4 / 2.5):**
- **Do NOT change blessing data wiring.** `setBlessing`, `gameDataStore.blessingsDatabase`, `activeBuild.blessings`, the staleness flags/actions, and `buildSnapshotSerializer`'s blessing extraction stay **exactly as today**. This is a visual rebuild (epics.md:269: *"Blessing/idol editors here are the visual rebuilds; their data wiring is unchanged from Phase 3."*).
- **Do NOT touch the Conditions editor** (`ConditionsPanel`) or the `BlessingTab` Conditions section beyond leaving it intact. FR-37 is the blessing card grid only.
- **Do NOT add a new store, store field, Zustand action, dependency, Rust/IPC change, or React Router.** Consume the existing `setBlessing` action only.
- **Do NOT add a new stat, `StatKey`, `StatSheet` field, or `compute_stats` input.** The stat-effect text shown per row is the **existing** `BlessingEntry.statEffects` data re-presented (it was already rendered for the active blessing) — see **Source Audit**.
- **Do NOT touch** `CenterCanvas` (Story 2.5 — the Blessings tab badge/routing), `RightPanel` (2.4), `LeftPanel` (2.3), `AppHeader` (2.2), `StatusBar` (2.8 — backlog), the stat sheet, the optimizer, gear, or idols.
- **Do NOT invent design tokens.** `--color-border` and `--accent-gold-tint`/`--accent-gold-soft`-as-background do **not** exist in `global.css`. Use only the real `--color-*` tokens (see Dev Notes → Design tokens). The current panel's `var(--color-border)` reference is a pre-existing undefined-variable bug — **fix it** by using a real token (`--color-bg-elevated`) in the rebuilt markup.

## Acceptance Criteria

**AC1 — Two-column card grid, one card per timeline, timeline-name header (FR-37)**
- **Given** the Blessing tab with `blessingsDatabase` loaded,
- **When** `BlessingsPanel` renders,
- **Then** it shows a **two-column** card grid (`display: grid; grid-template-columns: 1fr 1fr`) with **exactly one card per monolith timeline** (12 timelines in the shipped data — one per distinct `timelineId`, grouped via the existing `timelineGroups` `useMemo`),
- **And** each card's header is the **timeline name** (`group.timelineName`),
- **And** colors resolve through `--color-*` tokens only (Pattern P4-8 — no inline hex, no undefined `--color-border`); the card surface is `--color-bg-surface` and its hairline border is `--color-bg-elevated`.

**AC2 — Inline blessing selection, no dropdown (FR-37)**
- **Given** a timeline card,
- **When** it renders its blessing options,
- **Then** each of the timeline's `BlessingEntry`s renders as an **inline-selectable row** (a `<button>`), **not** an `<option>` inside a `<select>` — there is **no `<select>`/combobox anywhere in the panel**,
- **And** each option row shows the blessing `displayName` and its formatted `statEffects` summary using the existing format rule (`increased` → `+{value}%`, `more`/other non-flat → `{value}%`, `flat` → `{value}`, with `statKey` underscores replaced by spaces; e.g. `Twisted Memory — +30% increased cold damage`),
- **And** a leading **"None"** option row is present per card; clicking it clears that timeline's blessing,
- **And** clicking an option row calls `setBlessing(group.timelineId, entry.id)`; clicking the **None** row calls `setBlessing(group.timelineId, null)` (same data contract as the removed dropdown).

**AC3 — Active blessing highlighted gold with a gold border (FR-37)**
- **Given** a timeline where `blessings[timelineId]` is set,
- **When** the card renders,
- **Then** the active option row (`blessings[timelineId] === entry.id`) is highlighted with a **gold border** (`--color-accent-gold`) and gold text (`--color-accent-gold-soft`), and the **card** containing an active blessing shows a **gold border** (`--color-accent-gold-dim`) and gold header text (`--color-accent-gold`); non-active cards/rows use the neutral `--color-bg-elevated` hairline and `--color-text-secondary`/`--color-text-muted`,
- **And** when `blessings[timelineId]` is unset/null, the **"None"** row is the active (gold) row for that card and no option row is gold.

**AC4 — Blessing data wiring unchanged from Phase 3 (visual rebuild only) (FR-37, epics.md:269)**
- **Given** the rebuilt panel,
- **When** it reads and writes state,
- **Then** it uses the **same** store reads (`useGameDataStore` → `blessingsDatabase`, `isBlessingsDataStale`, `blessingsDataStaleAcknowledged`, `acknowledgeBlessingsDataStaleness`; `useBuildStore` → `activeBuild.blessings`, `setBlessing`) and the **same** `setBlessing(timelineId, blessingId | null)` contract — **no** new store field, action, prop, or snapshot change,
- **And** the staleness banner (`isBlessingsDataStale && !blessingsDataStaleAcknowledged`, `role="status"`, `aria-live="polite"`, Dismiss → `acknowledgeBlessingsDataStaleness`) and the empty state ("Blessings data not loaded." when `blessingsDatabase.length === 0`) behave exactly as today.

**AC5 — `BlessingTab` widened for two columns; Conditions untouched (FR-37)**
- **Given** the Blessing center tab,
- **When** it renders,
- **Then** the **Blessings** section container is widened enough to host the two-column grid (e.g. the prototype's ~880px max width, replacing the current `max-w-2xl` constraint on the Blessings block), keeping the existing section heading and card chrome tokens,
- **And** the **Conditions** section (`ConditionsPanel` and its heading) below it is **unchanged** — same markup, same position, same tokens,
- **And** the "Create or load a build to manage blessings." guard (when `!activeBuild`) is preserved.

**AC6 — Tested; accessibility holds; build green; no new baseline failures (NFR-14, UX-DR12)**
- **Given** the rebuilt blessing editor,
- **When** tests run,
- **Then** `BlessingsPanel.test.tsx` is **rewritten** to the card-grid contract and covers: empty state ("Blessings data not loaded."); one card per timeline with the timeline-name header (assert both `Blood, Frost, and Death` and `The Age of Winter` headers from the mock); **no combobox** is present (`screen.queryByRole('combobox')` is null); each card lists its blessings as inline rows including a **None** row; clicking a blessing row calls `setBlessing(timelineId, entry.id)`; clicking **None** calls `setBlessing(timelineId, null)`; the active blessing row/card carries the gold treatment (assert via accessible name/`aria-pressed`/`aria-current` or the rendered stat text, not a brittle inline-style hex); the per-row `statEffects` summary text renders (`/\+30% increased cold damage/i`); the staleness banner shows when stale + unacknowledged and is hidden when acknowledged; the Dismiss button calls `acknowledgeBlessingsDataStaleness`; and `expect(await axe(container)).toHaveNoViolations()`,
- **And** every interactive option/None row is a keyboard-operable `<button>` keeping the global **2px solid `--color-accent-gold` focus ring** (`:focus-visible`), carries an accessible name (visible text is sufficient; if icon-only chrome is added, add `aria-label`), and uses `aria-pressed` (or `aria-current`) to convey selection to assistive tech rather than color alone,
- **And** no animation is added that isn't `prefers-reduced-motion`-gated, `pnpm exec tsc --noEmit` exits 0 (watch `noUnusedLocals`/`noUnusedParameters` — drop the now-unused `useState`/search code), `CI=true pnpm exec vitest run` shows **no new failures** vs the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`), and `pnpm build` exits 0.

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It is a **visual rebuild of the blessing editor** (FR-37): a two-column card grid replacing per-timeline dropdowns, with inline selectable rows and gold active-state highlighting. It touches **no** game-data loader, **no** `scoring-core` / `compute/*` module, **no** new `StatKey`, **no** new `StatSheet` field, and **no** new `compute_stats` input.

Per-row stat text is the **existing `BlessingEntry.statEffects` data re-presented**, not a new stat. `statEffects` is already loaded from `src-tauri/resources/context-data/blessings.json` (a real shipped-data source: 48 entries across 12 timelines, each `{ statKey, value, modifierType }`), already typed (`StatEffect[]` in `shared/types/contextDatabase.ts`), and the current `BlessingsPanel` **already renders this exact summary string** for the active blessing (`BlessingsPanel.tsx:70-82`). This story moves that already-shipped, already-displayed text from "active-only" to "per option row" — a presentation change, nothing more.

**No dead key:** blessings are both **produced** (the user's selection is written by `setBlessing` into `activeBuild.blessings`) **and consumed** (the snapshot serializer extracts the non-null blessing IDs into the snapshot that feeds `compute_stats` — project-context.md#Blessings and conditions). This story changes neither end of that pipe.

The SOURCE-AUDIT GUARDRAIL's "map each new stat to real shipped-data, or declare honest-`0.0` with no dead `StatKey`" requirement is satisfied by this explicit **no-new-stat / no-dead-key** declaration. The guardrail's "value + element/type assertion test" requirement (which targets new prose/tag stat parsing in the loader) **does not apply** — there is no parsing change. The relevant verification here is **component-behavior + accessibility assertion tests** (AC6), including an assertion that the existing `statEffects` summary still renders correctly (e.g. `+30% increased cold damage`).

## Tasks / Subtasks

- [x] **Task 1 — Rebuild `BlessingsPanel` as a two-column card grid (AC: 1, 2, 3, 4)** — `lebo/src/features/blessings/BlessingsPanel.tsx`
  - [x] Keep the top-level store reads and the `timelineGroups` `useMemo` exactly as-is (`blessingsDatabase`, staleness flags/action, `activeBuild.blessings`, `setBlessing`). Keep the empty state ("Blessings data not loaded.") and the staleness banner block verbatim.
  - [x] Replace the `TimelineRow` component: render a **card** per `TimelineGroup`. Card container = `--color-bg-surface` background with a `1px solid` border that is `--color-accent-gold-dim` **when the timeline has an active blessing** else `--color-bg-elevated`. Header = `group.timelineName` (gold `--color-accent-gold` when active, else `--color-text-secondary`).
  - [x] Inside each card render selectable **`<button>`** rows: a leading **"None"** row, then one row per `group.entries` blessing. Active row (`selectedId === entry.id`, or the None row when `selectedId` is null/undefined) → gold border `--color-accent-gold` + text `--color-accent-gold-soft`; inactive → `--color-bg-elevated` hairline + `--color-text-secondary`. Each blessing row shows `displayName` + the formatted `statEffects` summary (extracted into a shared `formatStatEffects(entry)` helper).
  - [x] Wire `onClick`: blessing row → `onSelect(group.timelineId, entry.id)`; None row → `onSelect(group.timelineId, null)`. Added `aria-pressed={isActive}` on each row so selection is conveyed without relying on color.
  - [x] Wrap the cards in a grid container: `style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}`.
  - [x] **Removed the now-dead dropdown + per-timeline search code** (`<select>`, the `useState` search term, the `filtered` memo, the search `<input>`). Dropped the now-unused `useState` import — `noUnusedLocals`/`noUnusedParameters` clean.
  - [x] Replaced the existing `var(--color-border)` reference (undefined token) with `var(--color-bg-elevated)`.

- [x] **Task 2 — Widen the `BlessingTab` Blessings section; leave Conditions intact (AC: 5)** — `lebo/src/features/layout/tabs/BlessingTab.tsx`
  - [x] Widened the shared column container from `max-w-2xl` to `max-w-[880px]` so the two-column grid fits. Kept the existing "Blessings" heading and card chrome (`--color-bg-surface` + `--color-bg-elevated` border).
  - [x] Left the **Conditions** section (`ConditionsPanel` + its heading + card) and the `!activeBuild` guard ("Create or load a build to manage blessings.") **unchanged**.

- [x] **Task 3 — Rewrite `BlessingsPanel.test.tsx` to the card-grid contract (AC: 6)** — `lebo/src/features/blessings/BlessingsPanel.test.tsx`
  - [x] Kept the existing mock harness (`vi.mock` of `gameDataStore`/`buildStore`, `setupMocks`, `mockBlessings`, `mockSetBlessing`, `mockAcknowledge`).
  - [x] **Removed** the dropdown-era tests (dropdown-per-timeline, `combobox`/`option` assertions, both `search filters…` tests). Added an explicit `expect(screen.queryByRole('combobox')).toBeNull()`.
  - [x] Added card-grid tests: timeline-name headers + per-timeline `data-testid` cards; each blessing as an inline `<button>` row plus a **None** row per card (scoped via `within`); click → `setBlessing('blood-frost-death', 'bfd-twisted-memory')`; None → `setBlessing('blood-frost-death', null)`; active row `aria-pressed="true"` (and None active when unset); `statEffects` summary text (`/\+30% increased cold damage/i`).
  - [x] Kept the staleness tests, the empty-state test, and the `axe` no-violations test.

- [x] **Task 4 — Verify build + suite (AC: 6)**
  - [x] `pnpm exec tsc --noEmit` → exit 0.
  - [x] `CI=true pnpm exec vitest run src/features/blessings/BlessingsPanel.test.tsx` → green (13/13).
  - [x] `CI=true pnpm exec vitest run` → **no new failures** vs the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`); no baseline file cleared or added.
  - [x] `pnpm build` → exit 0 (pre-existing >500 kB chunk advisory only).

## Dev Notes

### This is a visual-rebuild story — keep the data wiring, swap the presentation
`BlessingsPanel.tsx` already does everything correctly at the data layer: it reads `blessingsDatabase`, groups by timeline (`timelineGroups` `useMemo`), reads `activeBuild.blessings`, and writes via `setBlessing(timelineId, blessingId | null)`. The **only** change is presentation: per-timeline `<select>` + search → a two-column **card grid** with inline `<button>` rows. Mirror the Epic 2 pattern (2.2 header, 2.3 left panel, 2.4 right panel, 2.5 center bar): keep the wiring, rebuild the chrome to the Claude Design layout. The prototype is the visual source of truth. [Source: lebo/src/features/blessings/BlessingsPanel.tsx; epics.md#Story 2.6; epics.md:269]

### The Claude Design prototype is explicit about the layout
`_bmad-output/last-epoch-build-optimizer-UI-Handoff/BlessingWeaver.jsx#BlessingEditor` shows the exact target: a `gridTemplateColumns: "1fr 1fr"` grid; one card per slot/timeline; card header = the timeline/slot title with a blessing icon, gold when active; inline option rows (`slot.options.map`) where the active option gets a gold-tint background, gold-dim border, and gold-soft text; a header row with a "Blessings" title, a one-line subtitle, and an active-count chip. **Adaptation for the real data model:** the prototype's `BLESSING_SLOTS` (5 slots, `options: string[]`) is prototype-only — the shipped data is `BlessingEntry[]` grouped into **12 timelines × 4 blessings**, selected by `id` via `setBlessing(timelineId, id)`. So: card = timeline, rows = that timeline's `BlessingEntry`s (+ a "None" row), active = `blessings[timelineId] === entry.id`. **Do not** copy the prototype's `"{N} / 5 active"` chip denominator — there are 12 timelines, not 5; if you keep an active-count chip, show a denominator-free `"{N} active"` (count = `Object.values(blessings).filter(Boolean).length`). [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/BlessingWeaver.jsx:8-65; src-tauri/resources/context-data/blessings.json]

### Design tokens — use only what exists (Pattern P4-8)
The global stylesheet (`src/assets/styles/global.css`, Tailwind v4 `@theme`) defines: backgrounds `--color-bg-base/-surface/-elevated/-hover/-sunken`; gold `--color-accent-gold (#C9A84C)`, `--color-accent-gold-soft (#D4B96A)`, `--color-accent-gold-dim (#8B7030)`; text `--color-text-primary/-secondary/-muted`. **There is NO `--color-border` and NO `--accent-gold-tint`/`-gold-bg` token.** The current panel's `var(--color-border)` is an undefined-variable bug carried from Phase 3 — replace it with `--color-bg-elevated` (the hairline token `BlessingTab.tsx` already uses for borders). For the active-row "tint" the prototype shows, use a token background — `--color-bg-hover` is the safe existing elevated tone — plus the gold border/text; do **not** invent a gold-tint token or hardcode a hex (Pattern P4-8 / project-context.md#Tailwind v4). [Source: lebo/src/assets/styles/global.css:19-83; lebo/src/features/layout/tabs/BlessingTab.tsx:30; project-context.md#Tailwind v4]

### Selection contract: preserve the "None" / clear path
The removed `<select>` had a `— None —` option that called `setBlessing(timelineId, null)`. Dropping the dropdown must **not** drop the ability to clear a timeline's blessing. Provide an explicit inline **"None"** `<button>` row per card (it is the active/gold row when `blessings[timelineId]` is null/undefined). This keeps the existing data contract intact and is more accessible than "click the active one again to toggle off" (which is ambiguous to screen-reader users). [Source: lebo/src/features/blessings/BlessingsPanel.tsx:56-69 (the `— None —` option)]

### Accessibility (NFR-14 / UX-DR12)
- Option rows and the None row are `<button>`s — keyboard-operable with the global **2px solid `--color-accent-gold` focus ring** (`:focus-visible` in `global.css`); never `outline: none` without a replacement.
- Convey selection with `aria-pressed` (toggle semantics) or `aria-current` — **not color alone** (axe + colorblind users). The visible gold treatment is reinforcement, not the only signal.
- Each row's accessible name comes from its visible text (`displayName` + summary, or "None"). If you add an icon-only affordance, give it an `aria-label`.
- The staleness banner keeps `role="status"` + `aria-live="polite"`; the Dismiss button keeps its `aria-label`.
- Add **no** new animation; if any hover/active transition is added, gate it behind `prefers-reduced-motion`.
- Run `vitest-axe` on the rendered panel — **zero new violations**.

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or re-stub the four `test-setup.ts` polyfills (jest-dom, vitest-axe, ResizeObserver, matchMedia).
- Reuse the existing `BlessingsPanel.test.tsx` mock harness (`vi.mock` of the two stores + the selector-implementation pattern). The component takes no props and reaches state only through mocked stores — no Tauri IPC to mock here.
- Co-located tests only; explicit `expect`, no snapshots. Assert selection via role/`aria-pressed`/accessible name and via the rendered `statEffects` text — **not** brittle inline-style hex matching (the active-state colors may be expressed via class or style; assert behavior/semantics, not literal CSS).
- Per the Source Audit this is a no-new-stat story, so the guardrail's loader value+element assertion tests do not apply; the relevant check is that the **existing** `statEffects` summary still renders (e.g. `+30% increased cold damage`) and that `setBlessing` is called with the right `(timelineId, id|null)` pair.

### Project Structure Notes
- All source is inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. Naming holds: `BlessingsPanel.tsx`/`BlessingTab.tsx` are `PascalCase.tsx`; no barrel files; named exports only; group imports external → shared → feature-local.
- **Phase boundary:** never write to `_bmad-output/` (Phase 1 / handoff artifacts) — read-only context (the prototype `BlessingWeaver.jsx` and `blessings.json` are read-only references). The `sprint-status.yaml` + story files under `_bmad-output/implementation-artifacts/` are the exception this workflow itself writes.
- **Dead consumer caveat:** `BlessingsPanel` is imported by `ContextPanel.tsx` (the legacy Phase 3 left-panel accordion) **but `ContextPanel` is never mounted** (project-context.md#Panel system: "The left panel is a navigator only (no ContextPanel accordion)"; grep confirms `ContextPanel` has no render site). Keep `BlessingsPanel`'s named export and props-less signature so `ContextPanel.tsx` keeps compiling — but you do **not** need to (and should not) re-style or re-mount `ContextPanel`. The only live render path is `BlessingTab`.

### Out of scope (do NOT touch here)
- Blessing **data wiring**: `setBlessing`, `gameDataStore` blessing fields/actions, `blessings.json`, `buildSnapshotSerializer`'s blessing extraction, and `compute_stats`.
- The **Conditions** editor (`ConditionsPanel`) and the Conditions section of `BlessingTab`.
- The Blessings **tab badge / routing** in `CenterCanvas` (Story 2.5 — done), `LeftPanel` (2.3), `RightPanel` (2.4), `AppHeader` (2.2), `StatusBar` (2.8 — backlog), the stat sheet (Epic 1), the optimizer (Epic 3/6), gear (Epic 4), and idols (Story 2.7).
- Any new store, store field, action, dependency, Rust/IPC change, or React Router.

### References
- [Source: epics.md#Story 2.6: Blessing editor card grid] — ACs (FR-37): two-column card grid, one card per monolith timeline, timeline name as card header, inline blessing selection (no dropdown); active blessing highlighted gold with a gold border; **blessing data wiring unchanged from Phase 3 (visual rebuild only)**.
- [Source: epics.md:95 (FR-37)] — Blessing editor: two-column card grid, one card per monolith timeline, active blessing highlighted gold with gold border, inline selection (no dropdown).
- [Source: epics.md:266-269 (Epic 2 overview + implementation notes)] — components faithfully rebuilt to the Claude Design, not wrappers of the prototype JSX; *"Blessing/idol editors here are the visual rebuilds; their data wiring is unchanged from Phase 3."*
- [Source: architecture.md:292-304 (token reconciliation)] — keep `--color-*` token names; values updated to the Claude Design palette; components rebuilt consuming these tokens (faithful recreation, not a wrapper of prototype JSX).
- [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/BlessingWeaver.jsx:8-65] — the visual target: `gridTemplateColumns: "1fr 1fr"`, one card per timeline, header gold when active, inline option rows with gold active treatment. (Adapt to the real `BlessingEntry`/`timelineId` data model — 12 timelines × 4, select by `id`.)
- [Source: lebo/src/features/blessings/BlessingsPanel.tsx] — current panel: store reads, `timelineGroups` memo, the `statEffects` format rule (lines 75-80), the staleness banner, the empty state, and the `var(--color-border)` bug to fix.
- [Source: lebo/src/features/layout/tabs/BlessingTab.tsx:18-52] — the center-tab host (`max-w-2xl` to widen for the Blessings block; the Conditions section to leave intact; the `!activeBuild` guard).
- [Source: lebo/src/shared/types/contextDatabase.ts:39-53] — `StatEffect` (`statKey`, `value`, `modifierType`) and `BlessingEntry` (`id`, `timelineId`, `timelineName`, `displayName`, `statEffects`) shapes.
- [Source: lebo/src/shared/stores/buildStore.ts:65,647-659] — `setBlessing(timelineId, blessingId | null)` action (the unchanged write path).
- [Source: src-tauri/resources/context-data/blessings.json] — real shipped data: 48 entries, 12 timelines × 4 blessings each (confirms one card per timeline; no per-card search needed).
- [Source: lebo/src/assets/styles/global.css:19-83] — the available `--color-*` tokens (no `--color-border`, no gold-tint); the global `:focus-visible` 2px gold ring.
- [Source: project-context.md#Blessings and conditions] — `BlessingState.blessings?: Record<string, string | null>`; snapshot serializer extracts non-null values as a flat `string[]` (confirms blessings are consumed → no dead key).
- [Source: project-context.md#Tailwind v4] — CSS-first tokens, never `@apply`, route colors through `--color-*` / `rarityColors.ts`, no inline hex.
- [Source: project-context.md#Panel system] — the left panel is a navigator only (no `ContextPanel` accordion) → `ContextPanel` is a dead consumer of `BlessingsPanel`.

## Previous Story Intelligence (Story 2.5 — done)

- **Extension/rebuild-not-rewrite is the Epic 2 pattern.** 2.2 (header), 2.3 (left panel), 2.4 (right panel), 2.5 (center bar) all kept the working composition/wiring and applied targeted visual deltas. Here: keep `BlessingsPanel`'s store reads + `timelineGroups` memo + staleness/empty states; swap only the per-timeline presentation (dropdown → card grid).
- **Baseline-failure literacy.** The standing UI baseline is `ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`. "No new failures vs that baseline" is the floor; this story neither clears nor adds a baseline file. `BlessingsPanel.test.tsx` must stay green after the rewrite.
- **Compile-ripple / `noUnusedLocals` awareness.** 2.4 watched `noUnusedLocals` after removing `ScoreBar`; 2.5 after the union change. Here the analogous gate is **removing the search `useState`/`filtered`/`<select>`** — drop the now-unused `useState` import and any dead locals or `tsc` will fail.
- **Token discipline (Pattern P4-8).** 2.1 reconciled tokens by value under `--color-*`; later stories consume them with **no inline hex**. The blessing rebuild must use only real tokens and fix the pre-existing undefined `--color-border` rather than introduce a new one.
- **Test/seed process.** Reuse the store-mock harness; `vitest-axe` on the container; assert behavior/semantics (roles, `aria-pressed`, accessible names, rendered text), not literal inline-style hex.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots (no semantic signal); the last semantic work was Stories 2.5 (center bar), 2.4 (right panel), 2.3 (left panel), 2.2 (header), 2.1 (tokens). No blessing-editor work is in flight — `BlessingsPanel.tsx`, `BlessingTab.tsx`, and `BlessingsPanel.test.tsx` are stable and safe to rebuild.
- No new dependency: React 19.1, Zustand 5, Tailwind v4, `@testing-library/react`, `vitest-axe` are all present. This story adds **no** library, **no** Rust/IPC change, **no** new store, and **no** new stat — it is a presentation rebuild of one feature component + its host container + its test.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story workflow)

### Debug Log References

- `CI=true pnpm exec vitest run src/features/blessings/BlessingsPanel.test.tsx` — RED (8 failed / 5 passed against old dropdown component) → GREEN (13/13) after rebuild.
- `pnpm exec tsc --noEmit` → exit 0.
- `CI=true pnpm exec vitest run` → 1120 passed, 8 failed across exactly the standing baseline (`ProviderSelector` / `Settings` / `SkillTreeCanvas` / `TreeControls`) — no new failures, no baseline file cleared or added.
- `pnpm build` → exit 0 (pre-existing >500 kB chunk advisory only).

### Completion Notes List

- **Visual rebuild only — data wiring untouched.** `BlessingsPanel` keeps the same store reads (`blessingsDatabase`, staleness flags/action, `activeBuild.blessings`, `setBlessing`), the same `timelineGroups` `useMemo`, and the same `setBlessing(timelineId, id | null)` contract. No new store, field, action, prop, dependency, Rust/IPC, or stat — Source Audit N/A (no-new-stat / no-dead-key) holds.
- **Presentation swap.** Replaced the per-timeline `TimelineRow` (`<select>` + search `<input>` + `useState`) with a two-column CSS grid (`gridTemplateColumns: '1fr 1fr'`) of `BlessingCard`s. Each card = one timeline; header = `group.timelineName` (gold when the timeline has an active blessing). Inside each card, a leading **None** row then one `<button>` per blessing via a shared `OptionRow`. Active row → gold border (`--color-accent-gold`) + gold-soft text + `--color-bg-hover` tint; inactive → `--color-bg-elevated` hairline + `--color-text-secondary`. Active card → `--color-accent-gold-dim` border.
- **Selection semantics.** Each row carries `aria-pressed={isActive}` so selection is conveyed without relying on color (axe + colorblind). None row is active when `selectedId == null`. Clear path preserved: None → `setBlessing(timelineId, null)`.
- **Stat text re-presented per row.** Extracted the existing format rule into `formatStatEffects(entry)` (same rule: `increased` → `+{value}%`, non-`flat` → `{value}%`, `flat` → `{value}`, underscores → spaces). The summary that previously rendered only for the active blessing now renders on every blessing row — existing shipped `BlessingEntry.statEffects` data, no parsing change.
- **Token-bug fix.** Removed the undefined `var(--color-border)` reference (was on the deleted search input) — rebuilt markup uses only real `--color-*` tokens. Dismiss button now relies on the global `:focus-visible` 2px gold ring (dropped the inline `onFocus`/`onBlur` outline hack).
- **`BlessingTab` widened** `max-w-2xl` → `max-w-[880px]` on the shared column so the two-column grid fits. Conditions section + `!activeBuild` guard untouched.
- **No new animation added** — nothing to gate behind `prefers-reduced-motion`.

### Change Log

| Date | Change |
|------|--------|
| 2026-06-05 | Story 2.6 implemented: rebuilt `BlessingsPanel` from per-timeline dropdown+search into a two-column card grid with inline `<button>` rows, gold active state via `aria-pressed` + `--color-*` tokens, per-row `statEffects` summary, and the undefined `--color-border` bug fixed. Widened `BlessingTab` Blessings column to `max-w-[880px]`. Rewrote `BlessingsPanel.test.tsx` to the card-grid contract (13 tests, no combobox, axe clean). tsc 0 / build 0 / full suite no new failures vs baseline. Status → review. |

### File List

- `lebo/src/features/blessings/BlessingsPanel.tsx` — modified (dropdown+search → two-column card grid; `OptionRow`/`BlessingCard`/`formatStatEffects`; removed `useState`/search/`<select>`; fixed `--color-border` bug)
- `lebo/src/features/blessings/BlessingsPanel.test.tsx` — rewritten to the card-grid contract (13 tests)
- `lebo/src/features/layout/tabs/BlessingTab.tsx` — modified (`max-w-2xl` → `max-w-[880px]` on the Blessings column)

## Review Findings

_Code review 2026-06-05 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor: AC1–AC6 all MET, no scope-boundary violations, token discipline satisfied, the pre-existing `--color-border` bug confirmed fixed. Independently verified: `tsc --noEmit` exit 0; `BlessingsPanel.test.tsx` 13/13 green._

- [x] [Review][Decision → RESOLVED: keep as-is, Alec 2026-06-05] Single-select group modeled as N independent `aria-pressed` toggle buttons, not a radiogroup — Each card's option set (None + blessings) is mutually exclusive, but rendered as a list of `<button aria-pressed>` toggles inside a plain `<div>` (no `role="radiogroup"`/`role="radio"`/`aria-checked`, no group label, no roving-tabindex arrow nav). To assistive tech this reads as independent toggles, not "choose exactly one." AC6 explicitly sanctions `aria-pressed` (and `vitest-axe` passes — multiple `aria-pressed="false"` + one `true` is valid ARIA, so axe is blind to the semantic mismatch), so this is **not an AC violation** — it's a deliberate a11y-pattern choice. Choosing the radiogroup pattern would also resolve the "None disambiguation" patch below. [BlessingsPanel.tsx:36-38]
- [x] [Review][Patch] Duplicate, context-free accessible names for the "None" rows [lebo/src/features/blessings/BlessingsPanel.tsx:88] — FIXED: added optional `ariaLabel` to `OptionRow`; None row now carries `aria-label={`None — ${group.timelineName}`}`. Test `gives each None row an accessible name scoped to its timeline` added. — Every card renders a button whose entire accessible name is "None"; with 12 timelines on screen a screen-reader user hears "None button" 12× with no programmatic tie to the owning timeline (the visible timeline-name `<p>` is not associated). Unambiguous additive a11y fix: give the None row (and/or each row) an `aria-label` that includes `group.timelineName`, or wrap each card's options in a labelled group. No data-wiring/token/dep change. (Superseded if the radiogroup decision above is adopted with a group `aria-label`.)
- [x] [Review][Patch] Test gap — no assertion that a card renders ALL of its timeline's entries [lebo/src/features/blessings/BlessingsPanel.test.tsx:96-106] — FIXED: added test `renders all of a timeline's entries (None + every blessing), not just the first` asserting per-card button counts (bfd=3, aow=2). — The mock supplies only 2 entries (blood-frost-death) / 1 (age-of-winter); real data is 4 per timeline. The rewritten tests assert the mocked names by name but never assert completeness/count, so a regression that dropped entries past index 1 would still pass (the old dropdown enumerated options). Add a count/enumeration assertion (e.g. each card has `entries.length + 1` buttons incl. None).
- [x] [Review][Defer] Stale/orphan `selectedId` becomes an invisible, unreachable selection [lebo/src/features/blessings/BlessingsPanel.tsx:69,88] — deferred, pre-existing + out of scope. If `blessings[timelineId]` holds an id absent from the reloaded `blessingsDatabase` (or its timeline was dropped), the None row is `isActive=false`, no entry row matches, and `hasActive=false` → the card shows nothing selected though the build carries a non-null id (scoring still reads the orphan). The old `<select>` was equally blind to a value matching no option, and `setBlessing` validation / orphan reconciliation is **blessing data wiring** — explicitly out of scope for this visual-rebuild story (AC4 / Scope Boundary).
- [x] [Review][Defer] `formatStatEffects` mis-renders non-`increased`/non-`flat` modifier types [lebo/src/features/blessings/BlessingsPanel.tsx:15-22] — deferred, pre-existing. `'+'` is added only for `increased` while `'%'` is added for any non-`flat`, so a `more` modifier renders `30% …` (no sign, no "more"), losing the distinction. This is the **verbatim** format rule lifted from the old active-blessing summary — pre-existing, latent (0 `more` rows in `blessings.json`), and a presentation rule not introduced by this story.
- [x] [Review][Defer] `formatStatEffects` produces `+-10%` / `+0%` for negative/zero values [lebo/src/features/blessings/BlessingsPanel.tsx:19] — deferred, pre-existing. Hardcoded `'+'` for `increased` ignores value sign. Same verbatim pre-existing rule; no negative/zero data exists today.
