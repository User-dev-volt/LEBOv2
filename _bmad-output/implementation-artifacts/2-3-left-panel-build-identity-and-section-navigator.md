# Story 2.3: Left panel — build identity and section navigator

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the left panel to show my build identity and a section navigator with fill counts,
so that I can see my build's progress and jump between sections.

This is the **third story of Epic 2 (UI/UX Revamp)**, building on the reconciled design tokens (Story 2.1) and the rebuilt header (Story 2.2). `LeftPanel.tsx` **already exists and is largely faithful** to the Claude Design prototype — it already renders the Active Build card, restyled Class/Mastery selectors, a Build Sections navigator with live fill counts, a Save button, and the Saved Builds list. This story is an **extension + reconciliation**, not a from-scratch rebuild (exactly like Story 2.2 was for the header). The concrete deltas are:

1. **Class glyph (UX-DR3, Alec's call):** replace the placeholder gold 2-letter initials mark in the Active Build card with a **full 5-class gold SVG glyph set** (one abstract glyph per Last Epoch base class), via a new `ClassGlyph` component.
2. **Gold checkmarks (FR-34):** add a gold checkmark to each Build Sections row that meets its **FR-21 gate threshold** (the navigator currently colors the count but shows no checkmark).
3. **Import Character (FR-34, AC3):** **remove** the legacy "Paste build code" textarea (`BuildImportInput`) and replace it with an enabled **Import Character** button wired to an open-intent handler (a "coming soon" toast today; **Epic 7 / Story 7.1 swaps the handler body to open the modal**).
4. **Save button (FR-34):** confirm/keep the **gold-when-unsaved** treatment (already correct via `!isPersisted`).
5. **Polish:** faithful restyle of the Class/Mastery selectors and Saved Builds list to the design; show the mastery **display name** (not the raw `masteryId`) in the card subtitle.
6. **Tests:** add `LeftPanel.test.tsx` (none exists today) covering identity, navigator fill counts + checkmarks, navigation, Import Character intent, and `vitest-axe`.

**Scope boundary (read this first — same discipline as Story 2.2):**
- **Do NOT touch the `CenterTab` union** (`'tree' | 'gear' | 'skill' | 'idol' | 'blessing'`). Adding `'weaver'` is **Story 2.5**. The navigator renders **exactly the 5 current center tabs** — no Weaver row here.
- **Do NOT build the Character Import modal** or any `character_import.rs` / `CHARACTER_IMPORT_ERROR` wiring — that is **Epic 7** (modal shell = Story 7.1). This story only delivers the button + its open-intent seam.
- **Do NOT touch** `RightPanel`, `CenterCanvas`, `StatusBar`, `AppHeader`, the center tab bar, or any store schema. Those are Stories 2.4/2.5/2.8 and prior work.
- **No new Zustand store, no React Router, no new dependency.**

## Acceptance Criteria

**AC1 — Active Build card shows the class glyph, build name, and class·mastery subtitle (FR-34, UX-DR3)**
- **Given** an active build with a selected class and mastery,
- **When** the left panel (`lebo/src/features/layout/LeftPanel.tsx`) renders in expanded state,
- **Then** the Active Build card shows a **class-specific gold glyph** (rendered via the new `ClassGlyph` component, one distinct abstract glyph for each of the 5 base classes — `acolyte`, `mage`, `primalist`, `rogue`, `sentinel` — gold via `var(--color-accent-gold)`, with a generic fallback glyph for an unknown `classId`), the **build name** (`activeBuild.name`, truncated), and a subtitle reading **`{className} · {masteryName}`** using the mastery **display name** (resolved from `selectedClass.masteries[activeBuild.masteryId]?.masteryName`), not the raw `masteryId`,
- **And** when there is no active build / no selected class, the card is not rendered (current behavior preserved).

**AC2 — Class & Mastery selectors and Saved Builds list are present and restyled to the design (FR-34)**
- **Given** the expanded left panel,
- **When** it renders,
- **Then** the restyled **Class/Mastery selectors** (`ClassMasterySelector`) and the restyled **Saved Builds list** (`SavedBuildsList`) are present and on-palette (consume `--color-*` tokens only; never hardcode a hex — Pattern P4-8),
- **And** their existing behavior is unchanged (selecting a class resets mastery + active build; selecting a mastery creates the build; saved-build rows load/rename/delete exactly as today).

**AC3 — Build Sections navigator lists each center tab with its fill count, the active tab highlighted (FR-34)**
- **Given** an active build,
- **When** the Build Sections navigator renders,
- **Then** it lists **exactly the 5 current center tabs** — Skill Trees, Gear, Active Skills, Idols, Blessings — each as a clickable row showing its label and a **fill count** in the established format (Skill Trees → `{passivePts} pts`; Gear → `{filled}/11`; Active Skills → `{filled}/5`; Idols → `{n} placed`; Blessings → `{filled}/5`),
- **And** clicking a row calls `setCenterTab(row.id)` and the row matching `appStore.centerTab` carries the active treatment (gold text/tint + `aria-current="true"` or the established active marker),
- **And** the `CenterTab` union is left at its current 5 values — **no Weaver row is added** (that is Story 2.5).

**AC4 — Sections meeting their FR-21 gate threshold show a gold checkmark (FR-34)**
- **Given** the Build Sections navigator,
- **When** a section meets its **FR-21 completeness gate threshold**, evaluated as: **Skill Trees** ≥ 1 passive point allocated; **Gear** = 11/11 slots filled; **Active Skills** ≥ 2 slots filled; **Idols** ≥ 1 idol placed; **Blessings** ≥ 1 blessing set,
- **Then** that row renders a **gold checkmark** (the `check` glyph in `var(--color-accent-gold)`) adjacent to its label,
- **And** a section below its threshold shows **no** checkmark,
- **And** the threshold predicates are defined in one place so Epic 6's completeness gate (`CompletenessGate.tsx`, FR-22) can reuse the same source of truth (see Dev Notes "Gate thresholds — single source of truth").

**AC5 — The "Paste build code" input is removed and replaced by an Import Character button with an open-intent seam (FR-34, AC-scope: Epic 7 owns the modal)**
- **Given** the left panel,
- **When** it renders,
- **Then** the legacy **"Paste build code" / "Import Build" textarea (`BuildImportInput`) is removed** (Last Epoch has no build-code system) and replaced by an **enabled** **Import Character** button (`data-testid="import-character-button"`, gold-outline or secondary styling per the prototype, full-width),
- **And** the button is wired to an open-intent handler `handleImportCharacter` that **today** fires `showInfoToast('Character import is coming soon.')` (or equivalent), with a one-line hand-off comment: `// Epic 7 / Story 7.1 wires this: replace the toast with the Character Import modal open.`,
- **And** clicking it does **not** mutate build state, change `currentView`, or open any modal in this story.

**AC6 — New left-panel behavior is tested; accessibility holds; build green (NFR-14, UX-DR12)**
- **Given** there is currently **no** `LeftPanel.test.tsx`,
- **When** tests are added (co-located `lebo/src/features/layout/LeftPanel.test.tsx`),
- **Then** they cover: the Active Build card renders the class glyph + name + `{className} · {masteryName}` subtitle for a seeded build; the navigator renders all 5 rows with correct fill counts; a section at/above its gate threshold shows the checkmark and one below it does not (assert at least Gear 11/11 → checkmark and Active Skills with 1 slot → no checkmark, ≥2 → checkmark); clicking a navigator row sets `centerTab`; the Save button shows gold/"Save Build" when `!isPersisted` and the saved state when `isPersisted`; the Import Character button is present, enabled, and clicking it does **not** change `centerTab`/`currentView`/active build; and `expect(await axe(container)).toHaveNoViolations()`,
- **And** every interactive element keeps a **2px solid `--color-accent-gold` focus ring** (the global `:focus-visible` rule), animation gates behind `prefers-reduced-motion`, and the panel introduces **zero new `vitest-axe` violations**,
- **And** `pnpm exec tsc --noEmit` exits 0, `CI=true pnpm exec vitest run` shows **no new failures** versus the documented baseline (`RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`; LeftPanel must not join it), and `pnpm build` exits 0.

## Source Audit

**Not applicable — this story introduces, computes, and surfaces NO new stat.** It is left-panel build-identity + navigation chrome only. It touches no game-data loader, no `scoring-core` / `compute/*` module, no `StatKey`, no `StatSheet` field, and no displayed numeric **stat**. The "fill counts" it renders (e.g. `8/11`, `3 pts`) are **counts of existing build-state collections** (`nodeAllocations`, `contextData.gear/skills`, `idolGrid`, `blessings`) already present in `BuildState` — not new computed stats. The SOURCE-AUDIT GUARDRAIL's "map each new stat to real shipped-data, or declare honest-`0.0` with no dead `StatKey`" requirement is satisfied by this explicit **no-new-stat / no-dead-key** declaration, and the guardrail's "value + element/type assertion test" requirement (which targets prose/tag stat parsing) **does not apply**. The relevant verification here is **component-behavior + accessibility assertion tests** in `LeftPanel.test.tsx` (AC6).

## Tasks / Subtasks

- [x] **Task 1 — `ClassGlyph` component: full 5-class gold SVG glyph set (AC: 1)** — NEW `lebo/src/features/layout/ClassGlyph.tsx`
  - [x] Create `export function ClassGlyph({ classId, size = 18 }: { classId: string; size?: number })` returning an inline `<svg>` (24×24 viewBox, `stroke="var(--color-accent-gold)"`, `fill="none"` baseline) selected by `classId`.
  - [x] Provide one **distinct, abstract, original** glyph per base class — keys: `acolyte`, `mage`, `primalist`, `rogue`, `sentinel` — plus a generic circle fallback for any unknown id. **No game-derived/ripped imagery** (the prototype `icons.jsx` header rule: "abstract, original shapes, no game-derived imagery"). Suggested motifs (dev may refine the exact paths): acolyte = skull/necro (reuse the prototype `glyph-skull` path as a starting point), mage = radiant orb/4-point star, primalist = claw/leaf, rogue = crossed daggers, sentinel = shield/cross.
  - [x] Named export only, no default; co-located in the `layout/` feature folder; group imports external → shared → feature-local.
  - [x] Reference paths: prototype glyphs `glyph-acolyte` and `glyph-skull` at `_bmad-output/last-epoch-build-optimizer-UI-Handoff/icons.jsx:139-151` (read-only reference — recreate, do not import prototype JSX).

- [x] **Task 2 — Wire `ClassGlyph` + mastery display name into the Active Build card (AC: 1)** — `lebo/src/features/layout/LeftPanel.tsx`
  - [x] Replace the current 2-letter initials mark (`selectedClass.className.slice(0, 2).toUpperCase()`) with `<ClassGlyph classId={activeBuild.classId} />` inside the existing gold-bordered mark container (keep the container's `--color-bg-base` background + `--color-accent-gold-dim` border styling).
  - [x] Change the subtitle from `{selectedClass.className} · {activeBuild.masteryId}` to use the mastery **display name**: resolve `const masteryName = selectedClass.masteries[activeBuild.masteryId]?.masteryName ?? activeBuild.masteryId` and render `{selectedClass.className} · {masteryName}`.

- [x] **Task 3 — Gate-threshold checkmarks + single-source thresholds (AC: 3, 4)** — `lebo/src/features/layout/LeftPanel.tsx` (+ optional NEW `lebo/src/shared/utils/buildSectionStatus.ts`)
  - [x] Define the per-section **gate-threshold (`done`) predicates**: Skill Trees → `passivePts >= 1`; Gear → `filledGear === 11`; Active Skills → `filledSkills >= 2`; Idols → `placedIdols >= 1`; Blessings → `filledBlessings >= 1`. Keep the existing `full`/count-color predicates as-is (they are a separate visual signal).
  - [x] **Recommended:** extract these threshold predicates (and the fill-count derivations) into `shared/utils/buildSectionStatus.ts` — e.g. `getSectionStatus(build): Record<CenterTab, { count: string; full: boolean; done: boolean }>` — so Epic 6's `CompletenessGate.tsx` (FR-22) reuses the exact same thresholds and the two can never drift. If you keep them inline instead, add a comment naming Epic 6 as the reuse consumer. (Lives in `shared/utils` because it is cross-feature: LeftPanel + future Epic 6.)
  - [x] In each navigator row, render the **`check` glyph** (path `M5 12l4 5L19 6`, `stroke="var(--color-accent-gold)"`, ~12px) adjacent to the label **iff** the row's `done` predicate is true. Below threshold → no checkmark.
  - [x] Keep `aria-current` (or the established active marker) on the row matching `centerTab`; keep `onClick={() => setCenterTab(row.id)}`.

- [x] **Task 4 — Replace "Paste build code" with the Import Character button (AC: 5)** — `lebo/src/features/layout/LeftPanel.tsx` (+ remove `BuildImportInput`)
  - [x] Remove the `<BuildImportInput />` usage and its import from `LeftPanel.tsx`.
  - [x] Add an **enabled** full-width **Import Character** button (`data-testid="import-character-button"`, gold-outline/secondary styling per the prototype's import affordance) wired to `handleImportCharacter`.
  - [x] Implement `handleImportCharacter` to call `showInfoToast('Character import is coming soon.')` (import from `../../shared/components/Toast`), and add the comment: `// Epic 7 / Story 7.1 wires this: replace the toast with the Character Import modal open.`
  - [x] Verify no other module references `BuildImportInput` (grep first). If `LeftPanel` is the only consumer, **delete** `lebo/src/features/build-manager/BuildImportInput.tsx` (and any co-located test); if there are other consumers, leave the file and only detach it from LeftPanel.

- [x] **Task 5 — Confirm Save button gold-when-unsaved; collapsed-rail parity (AC: 3)** — `lebo/src/features/layout/LeftPanel.tsx`
  - [x] Keep the Save button keyed on `activeBuild.isPersisted` (gold `--color-accent-gold` + "Save Build" when `!isPersisted`; muted + "Saved" when `isPersisted`). `!isPersisted` **is** the canonical "unsaved changes" signal (see Dev Notes "Dirty-state is `!isPersisted`"). Do not invent a separate dirty flag.
  - [x] `handleSave` stays `await saveBuild(activeBuild)` — `saveBuild` already calls `setActiveBuildPersisted()` (no extra call needed).
  - [x] Collapsed-rail (48px) section icons: keep the existing behavior; matching them to the new glyph aesthetic is optional polish, not required by an AC. Do not regress the collapsed toggle.

- [x] **Task 6 — Tests + a11y (AC: 6)** — NEW `lebo/src/features/layout/LeftPanel.test.tsx`
  - [x] Seed stores in `beforeEach` (snapshot + restore pattern, mirroring `AppHeader.test.tsx`): set `useGameDataStore` with a minimal `gameData.classes` containing one class (e.g. `acolyte` with a mastery), and `useBuildStore` with `selectedClassId`, `selectedMasteryId`, and an `activeBuild` (use `createBuild` or a hand-built `BuildState` with `schemaVersion: 2`). Mock Tauri IPC (`vi.mock('../../shared/utils/invokeCommand', ...)`) and the Toast module so `showInfoToast` is observable.
  - [x] Assertions: class glyph renders (an `<svg>` inside the card / by role or testid); name + `{className} · {masteryName}` subtitle present; all 5 navigator rows render with correct counts; Gear at 11/11 shows a checkmark and Active Skills with 1 slot does **not** while ≥2 does; clicking a row updates `useAppStore.getState().centerTab`; Save button reflects `isPersisted` (gold "Save Build" vs "Saved"); Import Character button present + enabled, click fires `showInfoToast` and leaves `centerTab`/`currentView`/`activeBuild` unchanged; `expect(await axe(container)).toHaveNoViolations()`.
  - [x] Do **not** create a separate vitest config or duplicate the four `test-setup.ts` stubs (jest-dom, vitest-axe, ResizeObserver, matchMedia).

- [x] **Task 7 — Verify build + suite (AC: 6)**
  - [x] `pnpm exec tsc --noEmit` → exit 0 (watch `noUnusedLocals`/`noUnusedParameters` — remove the `BuildImportInput` import).
  - [x] `CI=true pnpm exec vitest run` → `LeftPanel.test.tsx` passes; no new failures vs. the documented baseline (`RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`).
  - [x] `pnpm build` → exit 0 (only the pre-existing >500 kB chunk-size advisory is acceptable).

### Review Findings

_Code review 2026-06-04 (3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor). All 6 ACs verified satisfied. 2 patch / 1 defer / 13 dismissed._

- [ ] [Review][Patch] Harden fill-count counters against missing `itemName`/`skillName` [lebo/src/shared/utils/buildSectionStatus.ts:19,23] — `g.itemName.trim()` / `s.skillName.trim()` throw `TypeError` if a persisted **v2** build has an element missing the key (the v2 load path in `buildPersistence.ts` does not coerce per-element strings; only v1→v2 migration does). `getSectionStatus(activeBuild)` runs unconditionally at the top of `LeftPanel` render, so the throw blanks the **entire** left panel. Pre-existing hazard relocated by this diff — cheap to fix here: `(g.itemName ?? '').trim()` / `(s.skillName ?? '').trim()`. (High, blind+edge)
- [ ] [Review][Patch] Close `LeftPanel.test.tsx` coverage gaps [lebo/src/features/layout/LeftPanel.test.tsx] — (a) empty-slot filtering (`.trim() !== ''`) is never exercised (the `gear()`/`skill()` helpers always pass non-empty names), so a regression that counted placeholder slots would pass; (b) the `gear()` helper returns `affixes: []` typed as the V1 `string[]` shape, not `GearItemV2`/`AffixEntryV2[]`; (c) no `done`-checkmark tests for tree (`pts>=1`), idol (`>=1`), or blessing (`>=1`, incl. the `!== null` filter); (d) `ClassGlyph` is only asserted for `acolyte` — the other 4 motifs + default fallback are never rendered. (Medium, edge)
- [x] [Review][Defer] Hardcoded `rgba(201,168,76,…)` / `rgba(255,255,255,0.06)` literals instead of `var(--color-*)` tokens [lebo/src/features/layout/LeftPanel.tsx:129,177-178] — deferred, pre-existing. Active-row bg/border + active-build card hairline use raw gold/white alpha literals (Pattern P4-8 wants tokens). Consistent with `AppHeader.tsx:74` / `CenterCanvas.tsx:99`; no accent-gold **alpha** token exists in `global.css`, so there is no drop-in token. Belongs to a token-system coverage pass, not this story.

**Dismissed (13, for the record):** skill `done>=2` vs `full===5` (by design — Dev Notes table / FR-23); `idolGrid.length` overcount (verified: only `PlacedIdol` objects are pushed, no placeholders); `undefined` passing the blessings `!== null` filter (type-prevented — `Record<string, string | null>`); glyph (`activeBuild.classId`) vs subtitle (`selectedClassId`) source-of-truth split (latent — `loadBuild` syncs both, no live caller diverges); `masteries[masteryId]` keyed-access assumption (verified keyed record + safe `??` fallback); `aria-current="true"` vs `"page"` (valid per ARIA); `aria-hidden` boolean vs string style nit (identical render); `full: false` for tree/idol (by design — no maxed state); `getSectionStatus` reliance on `CenterTab` being exactly 5 keys (verified union is exactly the 5 literals — `Record` enforces at compile time); checkmark/label spacing (cosmetic — worth one visual glance); build-code paste removal (by design — AC5: LE has no build-code system); over-count silently dropping the checkmark (unreachable — assignments dedupe by `slotId`); empty `masteryId` dangling separator (unreachable — an active build always has a selected mastery).

## Dev Notes

### Current state of `LeftPanel.tsx` — this is an extension, not a rewrite
The component already implements the prototype structure: collapsed 48px rail, Active Build card, `ClassMasterySelector`, a `NAV_ROWS`-driven Build Sections navigator with live `getCount`/`full` predicates, the Save button (keyed on `isPersisted`), `BuildImportInput`, and `SavedBuildsList`. **Do not rewrite working markup.** The five deltas are: (1) glyph swap, (2) mastery display name, (3) gold checkmarks, (4) Import Character button replacing `BuildImportInput`, (5) test file. Keep the existing token usage (`--color-bg-surface`/`-elevated`/`-base`, `--color-accent-gold*`, `--color-text-*`) — Story 2.1 already put the panel on-palette.

### Dirty-state is `!isPersisted` (do not invent a new flag)
The whole store treats `isPersisted` as the unsaved-changes flag: **every** mutating action (`applyNodeChange`, `assignSkillToSlot`, `setBlessing`, `placeIdol`, `updateContextGear`, slider/weights, etc.) sets `isPersisted: false`; `saveBuild()` calls `setActiveBuildPersisted()` → `isPersisted: true`; `migrateBuildState` loads with `isPersisted: true`. So **gold-when-unsaved ⇔ `!activeBuild.isPersisted`** — the current Save button logic is already correct. `useAutoSave` only re-saves builds that are **already** persisted (`if (!build?.isPersisted) return`), so the manual Save button is primarily the **first** save; after that autosave keeps it synced. The gold cue's visible window is brief but intentional. [Source: lebo/src/shared/stores/buildStore.ts; lebo/src/features/build-manager/buildPersistence.ts:122-159; lebo/src/features/build-manager/useAutoSave.ts]

### Gate thresholds — single source of truth (AC4)
FR-21 example copy ("Gear 8/11") is a **fill-status display format**, not a gate threshold. The actual completeness-gate thresholds are codified in the Claude prototype's `done` predicates and are the design intent:
| Section | Fill count | Gate-`done` (checkmark) | Count-`full` (existing) |
|---|---|---|---|
| Skill Trees (`tree`) | `{passivePts} pts` | `passivePts >= 1` | n/a |
| Gear (`gear`) | `{filled}/11` | `filled === 11` | `filled === 11` |
| Active Skills (`skill`) | `{filled}/5` | `filled >= 2` | `filled === 5` |
| Idols (`idol`) | `{n} placed` | `n >= 1` | n/a |
| Blessings (`blessing`) | `{filled}/5` | `filled >= 1` | `filled === 5` |
The `Active Skills >= 2` threshold aligns with **FR-23** (the Complete Build Optimizer offers "suggest skills" when **< 2** slots are filled). Epic 6's `CompletenessGate.tsx` (architecture.md:460) is the FR-22 consumer of these same thresholds — put them in `shared/utils/buildSectionStatus.ts` so the gold-checkmark logic and Epic 6's gate cannot diverge (the same "don't compute two answers for one truth" discipline the source-audit guardrail enforces for stats). [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/LeftPanel.jsx:44-51; epics.md FR-21/FR-23]

### Class glyph (UX-DR3) — Alec chose the full 5-class set
The prototype only ships two abstract glyphs (`glyph-acolyte`, `glyph-skull`) and reuses `glyph-acolyte` for every class — there is **no** real per-class set in the handoff or game assets. Per Alec's decision, author a **distinct abstract glyph for all 5 base classes** now (keys `acolyte`/`mage`/`primalist`/`rogue`/`sentinel` — confirmed lowercase `classId`s; the loaded `className` is title-case e.g. "Acolyte"). Keep them **abstract and original** (the prototype's stated rule), gold via `--color-accent-gold`. This is the one place this story adds genuinely new visual design — do not over-reach into ripped/game art (the Story 2.1 review specifically flagged inventing values that look authoritative; abstract original glyphs are fine, fake "official" class crests are not). [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/icons.jsx:1-12,138-151; lebo/src-tauri/resources/game-data/classes/{acolyte,mage,primalist,rogue,sentinel}.json]

### Import Character ownership boundary (Epic 7 owns the modal)
Mirrors Story 2.2's "present-but-not-yet-wired control" pattern, but Alec chose the **enabled + open-intent** variant (not 2.2's `disabled`): the button is live and wired to `handleImportCharacter`, which currently shows a "coming soon" toast. **Epic 7 / Story 7.1 (`7-1-character-import-modal-shell-and-error-wiring`)** owns the two-tab Offline/Online modal, the `character_import.rs` Tauri module, and the `CHARACTER_IMPORT_ERROR` error type — **none of that is in scope here.** The hand-off contract for Story 7.1: replace the `handleImportCharacter` body (swap the toast for the modal open), keeping the same `data-testid="import-character-button"` and button placement. The prototype's full `ImportCharacter` lookup UI (`LeftPanel.jsx:159-277`) is **read-only reference** for Epic 7 — do not port it now. [Source: epics.md FR-46/FR-47 (Epic 7); architecture.md:485 "LeftPanel.tsx MODIFIED FR-34 ... + Import"]

### Toast usage
`showInfoToast` / `showErrorToast` live in `lebo/src/shared/components/Toast` (react-hot-toast 2.6, already in the stack and already used by `buildPersistence.ts`). Use `showInfoToast('Character import is coming soon.')` — consistent with existing toast calls; no new dependency.

### Accessibility (NFR-14 / UX-DR12)
- Active navigator row: set `aria-current` (the project uses `aria-current` for active items — see `AppHeader`) in addition to the gold visual.
- Every interactive `<button>` (navigator rows, Save, Import Character, collapse toggle) keeps the **2px solid `--color-accent-gold` focus ring** via the global `:focus-visible` rule (`global.css`) — never `outline: none` without a replacement.
- The gold checkmark is decorative reinforcement of the visible count — give the `<svg>` `aria-hidden="true"` (the count text carries the meaning) to avoid axe noise.
- Gate any added transition behind `prefers-reduced-motion` via `useReducedMotion()`; the existing `transition: background-color 120ms` is fine.
- Run `vitest-axe` on the rendered panel; **zero new violations**. (Note: `RightPanel` is in the standing jsdom/Headless-UI baseline; `LeftPanel` is **not** — keep it out of that list.)

### Testing standards
- Vitest config lives in `vite.config.ts` (`environment: jsdom`, `globals: true`, `setupFiles: ['./src/test-setup.ts']`). Do not create a separate config or re-stub the four `test-setup.ts` polyfills.
- Co-located test only: `LeftPanel.test.tsx` next to `LeftPanel.tsx`. Explicit `expect` assertions, no snapshots.
- Store-seeding pattern (from `AppHeader.test.tsx`): capture `const initial = useStore.getState()` and restore in `beforeEach(() => useStore.setState(initial, true))`; then set the specific fields. `ClassMasterySelector`/`SavedBuildsList` are child components — seed `useGameDataStore.gameData.classes` and `useBuildStore` so they render without throwing. Mock `invokeCommand` so `SavedBuildsList` actions don't hit real IPC.
- `SavedBuildsList` already has its own `SavedBuildsList.test.tsx` — do not duplicate its coverage; the LeftPanel test only needs to confirm it mounts.

### Project Structure Notes
- All source files are inside `LEBOv2/lebo/src` — Phase 2 active tree, write freely. The `_bmad-output/last-epoch-build-optimizer-UI-Handoff/` prototype (`LeftPanel.jsx`, `icons.jsx`, `styles.css`) is **read-only reference** for layout/glyph shapes only — never wire prototype JSX/CSS into the app (ADR-P4-007: faithful recreation, not a wrapper).
- Naming/structure: `ClassGlyph.tsx` is a `PascalCase.tsx` component in `layout/`; `buildSectionStatus.ts` is `camelCase.ts` in `shared/utils/`; no barrel files; named exports only; group imports external → shared → feature-local.
- **Phase boundary:** never write to `_bmad-output/` (Phase 1/handoff artifacts) — read-only context.

### Out of scope (do NOT touch here)
- `CenterTab` union (`'weaver'` is Story 2.5). No Weaver navigator row.
- The Character Import modal, `character_import.rs`, `CHARACTER_IMPORT_ERROR` (all Epic 7).
- `RightPanel`, `CenterCanvas`, `StatusBar`, `AppHeader`, the center tab bar (Stories 2.4/2.5/2.8 and prior).
- Any store schema change, Rust, data loader, or new dependency.

### References
- [Source: epics.md#Story 2.3: Left panel — build identity and section navigator] — ACs (FR-34, UX-DR3), gold checkmarks at FR-21 thresholds, "Paste build code" removed, Import Character opens the Epic 7 modal.
- [Source: epics.md#Epic 2 — Owns] — UX-DR3 (class glyph), UX-DR12, NFR-14; visual rebuilds, data wiring unchanged.
- [Source: epics.md#Story 2.1 / 2.2] — token reconciliation done (panel on-palette); inert-until-owning-epic precedent for not-yet-wired controls.
- [Source: epics.md#FR-21 / FR-23] — fill-status format ("Gear 8/11"); skill-suggestion gate at "< 2 slots filled" → Active Skills gate threshold ≥ 2.
- [Source: epics.md#Epic 7 (FR-46/FR-47) / sprint-status `7-1-character-import-modal-shell-and-error-wiring`] — Character Import modal ownership.
- [Source: architecture.md:485] — `LeftPanel.tsx MODIFIED FR-34 build identity + section navigator + Import`.
- [Source: architecture.md:460] — `CompletenessGate.tsx FR-22` — the Epic 6 reuse consumer of the gate thresholds.
- [Source: project-context.md#React / Zustand] — No React Router; four stores only; `centerTab`/`setCenterTab`; module-level empty constants.
- [Source: project-context.md#Accessibility] — 2px accent-gold focus ring; `prefers-reduced-motion`; axe-core CI fails on new violations.
- [Source: project-context.md#Code Quality] — no barrel files; named exports; rarity/damage colors via `rarityColors.ts`; tokens via `var(--color-*)`.
- [Source: lebo/src/features/layout/LeftPanel.tsx] — current panel markup, `NAV_ROWS`, Active Build card, Save button.
- [Source: lebo/src/shared/stores/buildStore.ts; lebo/src/features/build-manager/buildPersistence.ts:122-159; useAutoSave.ts] — `isPersisted` dirty flow; `saveBuild` → `setActiveBuildPersisted`.
- [Source: lebo/src/features/build-manager/BuildImportInput.tsx] — the legacy "Paste build code" textarea to remove.
- [Source: lebo/src/features/skill-tree/ClassMasterySelector.tsx; lebo/src/features/build-manager/SavedBuildsList.tsx] — child components rendered by the panel.
- [Source: lebo/src/features/layout/AppHeader.test.tsx] — store-seeding + axe test pattern to mirror.
- [Source: _bmad-output/last-epoch-build-optimizer-UI-Handoff/LeftPanel.jsx:44-51,59-67,105-120; icons.jsx:138-151] — prototype navigator `done` thresholds, class card, glyph shapes (read-only reference).

## Previous Story Intelligence (Story 2.2 — done)

- **2.2's inert-control pattern** is the template for AC5, but Alec explicitly chose **enabled + open-intent (toast)** over 2.2's `disabled` for the Import Character button — both are valid "owning epic wires it later" patterns; this story takes the enabled variant.
- **Baseline-failure literacy (carried from 2.1/2.2):** the standing UI test baseline is `RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`. 2.2 cleared `AppHeader` from it. `LeftPanel` has **no test today** — the goal is to add a **passing** `LeftPanel.test.tsx`, not to join the baseline. "No new failures" is the floor.
- **Don't-invent discipline (2.1 review):** the 2.1 reviewer caught palette values taken from the designer mockup rather than the game. Applies here to the **class glyphs** — keep them abstract/original (as the prototype intends), and use the prototype/test-spec exact **labels** (Builder/Gear Optimization/etc. wording, "Import Character", "Active Build", "Build Sections") rather than improvised copy.
- **2.2 process:** child components seeded via store state in tests (`useBuildStore`/`useAppStore`), `invokeCommand` mocked, `vitest-axe` on the container — reuse exactly.

## Git Intelligence Summary

- Recent commits are `[AutoSave]` snapshots (no semantic signal); the last semantic work was Story 2.2 (header nav) and Story 2.1 (tokens). No left-panel changes are in flight — `LeftPanel.tsx` is stable and safe to extend.
- No new dependency: React 19.1, Zustand 5, Tailwind v4, Headless UI, react-hot-toast, `@testing-library/react`, `vitest-axe` are all already present. This story adds **no** library.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story workflow)

### Debug Log References

- `pnpm exec tsc --noEmit` → exit 0
- `CI=true pnpm exec vitest run src/features/layout/LeftPanel.test.tsx` → 11 passed
- `CI=true pnpm exec vitest run` → 1084 passed, 9 failed across exactly the 5 documented-baseline files (`RightPanel`/`ProviderSelector`/`Settings`/`SkillTreeCanvas`/`TreeControls`); `LeftPanel.test.tsx` passes and did not join the baseline.
- `pnpm build` → exit 0 (only the pre-existing >500 kB chunk-size advisory)

### Completion Notes List

- **AC1** — Active Build card now renders `<ClassGlyph classId={activeBuild.classId} />` (full 5-class gold SVG set + generic fallback) in the gold-bordered mark container, and the subtitle resolves the mastery **display name** via `selectedClass.masteries[activeBuild.masteryId]?.masteryName ?? activeBuild.masteryId` → `{className} · {masteryName}`.
- **AC2** — `ClassMasterySelector` and `SavedBuildsList` retained, on-palette (tokens only); no behavior change.
- **AC3/AC4** — Navigator now drives counts/full/done from the new single-source `shared/utils/buildSectionStatus.ts` (`getSectionStatus(build)`), so Epic 6's `CompletenessGate` (FR-22) can reuse the identical thresholds. Gold `check` glyph (path `M5 12l4 5L19 6`, `aria-hidden`) renders iff a row's gate `done` predicate is true (Skill Trees ≥1 pt; Gear 11/11; Active Skills ≥2; Idols ≥1; Blessings ≥1). Active row carries `aria-current="true"` + gold tint; `onClick` calls `setCenterTab(row.id)`. CenterTab union untouched (no Weaver row).
- **AC5** — `BuildImportInput` ("Paste build code" textarea) removed from `LeftPanel` and the file deleted (LeftPanel was its only active consumer; no co-located test existed). Replaced by an enabled full-width **Import Character** button (`data-testid="import-character-button"`, gold-outline) wired to `handleImportCharacter`, which fires `showInfoToast('Character import is coming soon.')` with the Epic 7 / Story 7.1 hand-off comment. Click does not mutate build/view/tab (asserted in test).
- **AC6** — New `LeftPanel.test.tsx` (11 tests) covers identity + subtitle, all 5 navigator rows + counts, Gear 11/11 checkmark, Active Skills 1→no-check / 2→check, row click → `centerTab`, `aria-current`, Save gold/"Save Build" vs "Saved", Import Character enabled + toast + no mutation, and `vitest-axe` (zero violations). Save button kept on `!isPersisted` (canonical dirty signal); no new dirty flag, no new dependency, no store schema change.

### File List

- `lebo/src/features/layout/ClassGlyph.tsx` (new)
- `lebo/src/shared/utils/buildSectionStatus.ts` (new)
- `lebo/src/features/layout/LeftPanel.tsx` (modified)
- `lebo/src/features/layout/LeftPanel.test.tsx` (new)
- `lebo/src/features/build-manager/BuildImportInput.tsx` (deleted)

## Change Log

- 2026-06-04 — Story 2.3 implemented (review): `ClassGlyph` 5-class gold glyph set, mastery display-name subtitle, navigator gold gate-threshold checkmarks single-sourced via new `shared/utils/buildSectionStatus.ts`, `aria-current` on active row, "Paste build code" → enabled Import Character button (coming-soon toast, Epic 7/7.1 seam), `BuildImportInput.tsx` deleted, new `LeftPanel.test.tsx` (11 tests, axe clean). tsc 0 / build 0 / no new test failures vs baseline.
- 2026-06-04 — Story 2.3 drafted (ready-for-dev): left-panel build identity + section navigator. Extension/reconciliation of the existing `LeftPanel.tsx` — full 5-class `ClassGlyph` set (Alec's call), gold gate-threshold checkmarks (single-sourced for Epic 6 reuse), mastery display-name subtitle, "Paste build code" → enabled Import Character button with a "coming soon" toast open-intent seam (Epic 7/Story 7.1 wires the modal), confirmed gold-when-`!isPersisted` Save, and a new `LeftPanel.test.tsx` + axe. No new stat (Source Audit: N/A). Scope boundary: `CenterTab` unchanged (no Weaver row — Story 2.5); no Character Import modal (Epic 7).
