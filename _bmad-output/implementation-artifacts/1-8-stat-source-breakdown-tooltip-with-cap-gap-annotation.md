# Story 1.8: Stat Source Breakdown tooltip with cap-gap annotation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a theory-crafting player,
I want to hover (or focus) any stat row and see every source contributing to it grouped by category,
so that I can find exactly which passive, gear, idol, or blessing to change — especially for resistance tuning.

This is the **final story of Epic 1** and the **render half** of Stat Source Attribution. Story 1.7 already shipped all the data plumbing: the display `compute_stats` Tauri command returns `stat_sources: Some(Record<StatKey-string, ModifierSource[]>)`, the `SourceType` / `ModifierSource` TypeScript types already exist in `statSheet.ts`, and the field already rides on `optimizationStore.statSheet` untouched. **This story is frontend-only display + tests** — no Rust, no IPC-signature change, no store change, no new hook. It builds the `StatSourceTooltip.tsx` component (architecture file map line 451), wires a hover/focus trigger onto the existing `StatRow`s in `StatSheetPanel.tsx`, and reconciles the resistance row's cap-gap annotation to the FR-14 wording.

**This story's defining discipline is the same honesty rule every Epic 1 story followed — render only what the engine produced.** The tooltip is a *pure render of already-present data* (`statSheet.stat_sources[statKey]`) — **no second IPC call** (that is how SM-2's 50ms tooltip budget / NFR-2 is met by construction). A row whose `StatKey` has no entry in the map shows **"Base value only."** Source labels that cannot be resolved to a friendly name fall back to the raw ID Story 1.7 recorded — **never a fabricated name**. Derived/composite rows (scores, Avg Hit, the EHP triple, Damage Score) have **no single `StatKey`** and therefore get **no tooltip** — they are aggregates, not registry stats.

**Carried-forward requirement from the Story 1.7 code review (must implement here):** umbrella modifiers are keyed under their raw `StatKey`, not the derived stats they feed. A node/affix granting **`AllResistances`** is recorded only under `"AllResistances"`, but the engine folds that value into *each* of Fire/Cold/Lightning/Void/Necrotic/Physical/Poison resistance. So every element-specific resistance tooltip **must also fold in `AllResistances` sources** so the listed sources reconcile with the displayed resistance value. (See Dev Notes "Fan-in map".)

## Acceptance Criteria

**AC1 — Hover/focus a sourced row → grouped Source Breakdown tooltip (FR-13, UX-DR8, NFR-2)**
- **Given** a stat row whose `StatKey` has ≥1 entry in `statSheet.stat_sources`,
- **When** the player hovers **or keyboard-focuses** the row,
- **Then** an adjacent tooltip appears listing every `ModifierSource` **grouped by category** in this fixed order — **Passive Nodes / Gear / Idols / Blessings / Skills / Conditions** (mapping `source_type` `passive_node`/`gear_slot`/`idol`/`blessing`/`skill_node`/`condition`) — each source showing its **name and its contribution** (e.g. `+12%`, `+30% increased`) (FR-13, UX-DR8).
- **And** the tooltip is a **pure render of `statSheet.stat_sources`** — it makes **no** new IPC/`compute_stats` call (NFR-2: appears within 50ms; satisfied by construction since the data is already in memory).
- **And** it **dismisses on mouse-leave** (and on blur / `Esc` for the keyboard path), and is itself hoverable (does not vanish when the pointer moves from the row onto the tooltip — WCAG 1.4.13 persistent/dismissible).

**AC2 — "Base value only" when a row has no sources; honest labels**
- **Given** a row that maps to a `StatKey` but that key is **absent** from `stat_sources` (or `stat_sources` is `null`/`undefined` on the current payload),
- **When** the player hovers/focuses it,
- **Then** the tooltip shows **"Base value only."** (no fabricated rows).
- **And** each source's displayed name is a **best-effort resolution** of `source_label` (passive node → node display name; gear/idol/blessing → affix/blessing display name when cleanly resolvable), **falling back to the raw `source_label` ID** Story 1.7 recorded when no friendly name is available — never a fabricated or blank name.

**AC3 — Capped stat shows pre-cap total + cap gap; below-cap resistance row annotation (FR-14)**
- **Given** a capped resistance (cap = **75%**),
- **When** its tooltip renders,
- **Then** it shows the **pre-cap total** (the summed source contributions, which may exceed 75%) and the **cap gap** line; a capped resistance shows it is at/over cap (e.g. pre-cap total `92%`, capped at `75%`).
- **And** **Given** a resistance **below cap**, **when** the Defense-tab row renders, **then** it shows a delta annotation **in the warning color** in the FR-14 wording `68% (+7 to cap)` (reconciling the current `(+N% needed)` text), **and** the tooltip **repeats the cap gap** (`+7% to cap`) (FR-14).

**AC4 — Build stays green; additive display only; a11y preserved (zero new axe violations)**
- **Given** the existing test baseline,
- **When** the tooltip + wiring are added,
- **Then** `pnpm exec tsc --noEmit` stays at exit 0, and `CI=true pnpm exec vitest run` introduces **no new failures** beyond the documented pre-existing ~14-failure UI baseline (`SkillTreeCanvas`/`TreeControls`/`AppHeader`/`RightPanel`/`ProviderSelector`/`Settings` — jsdom/Headless-UI/canvas-environment, unrelated).
- **And** a new co-located `StatSourceTooltip.test.tsx` covers grouping, contribution formatting, "Base value only", cap-gap footer, and the `AllResistances` fan-in; `StatSheetPanel.test.tsx` is extended with the hover→tooltip interaction and the FR-14 row annotation; the existing `StatSheetPanel.test.tsx` assertions (tab counts, delta badges, resistance warning gaps, resistance colors) continue to pass.
- **And** every `axe` check (including the "all tabs" sweep) passes with **zero violations** — the trigger is keyboard-focusable with a `2px accent-gold` focus ring, the tooltip uses `role="tooltip"` + `aria-describedby` wiring, and content-on-hover is dismissible/persistent (WCAG 1.4.13). `prefers-reduced-motion` gates any fade/transition (instant show/hide when reduced).

## Tasks / Subtasks

- [x] **Task 1 — Define the row → `StatKey` mapping + fan-in map (AC: 1, 3)** — `lebo/src/features/stat-sheet/StatSheetPanel.tsx`
  - [x] Add a typed mapping of each *sourced* stat row to its primary `StatKey` **string** (the PascalCase serde name Story 1.7 documented — e.g. `"FireResistance"`, `"Strength"`, `"CriticalStrikeChance"`). Use the exact strings from the Rust `StatKey` enum (`modifier.rs:6-101`) — they are the live keys of `stat_sources`. (See Dev Notes "Row → StatKey map".)
  - [x] Define a **fan-in map** for resistances: each of the 7 resistance keys folds in **`AllResistances`** (carried Story 1.7 review requirement). So `FireResistance` tooltip queries `stat_sources["FireResistance"]` **plus** `stat_sources["AllResistances"]`, concatenated. Document that `AllElementalResistances` is **not** a `StatKey` in the current enum (do not query a key that does not exist).
  - [x] Wire only rows that map to a **real, sourced** `StatKey`. Leave **derived/composite** rows (Build/Damage/Surv/Speed Score, Avg Hit, Avg Hit Crit, the three EHP rows, Damage Score on Other) **without** a `statKey` → they get no tooltip (they are aggregates, not single registry stats — documented honest scope). Rows whose `StatKey` has **no shipped source** (Ward Retention/Reduced Crit Bonus/Parry/Glancing — no `StatKey` exists for them per `modifier.rs:57-59`) also get no `statKey`.

- [x] **Task 2 — Build `StatSourceTooltip.tsx` (AC: 1, 2, 3)** — NEW `lebo/src/features/stat-sheet/StatSourceTooltip.tsx`
  - [x] New named export `StatSourceTooltip` (no default export, no barrel). Render via `createPortal(..., document.body)` with `position: fixed` and viewport-edge flipping — **follow the existing `NodeTooltip.tsx` pattern** (same `OFFSET`/flip math, `var(--color-bg-elevated)` background, `var(--color-bg-base)` border, `zIndex: 1000`, `onWheel` stopPropagation, `onMouseEnter`/`onMouseLeave` passthrough so it is hoverable).
  - [x] Props: the resolved source list (already concatenated with fan-in), the stat label, the `position`, and optional cap info (`{ preCapTotal, cap, gap }` for resistances). Group sources by `source_type` into the six categories **in the fixed order** above; render a category sub-header only when that group is non-empty; under each, list `name — contribution`.
  - [x] **Contribution formatting helper:** `flat` → `+{value}` (with the row's unit, e.g. `+12%` for resistances); `increased` → `+{value}% increased`; `more` → `+{value}% more`; `conversion` → `{value}% conversion`. Round sensibly (reuse the panel's `fmt`/`fmtInt` discipline). Negative values keep their sign.
  - [x] **Empty state:** if the concatenated source list is empty → render **"Base value only."** only (no category headers).
  - [x] **Cap footer (resistances):** when cap info is provided, append a footer line showing the **pre-cap total** (sum of source `value`s) and the cap gap — below cap: `+{gap}% to cap` in `var(--color-data-negative)`; at/over cap: `capped at {cap}%` (e.g. pre-cap `92%`, capped at `75%`) in a neutral/at-cap color. (See Dev Notes "Cap math".)
  - [x] `role="tooltip"`, stable `id` for `aria-describedby` wiring (Task 4). Respect `useReducedMotion()` — no animated fade when reduced (instant show/hide).

- [x] **Task 3 — Best-effort `source_label` name resolution (AC: 1, 2)** — `lebo/src/features/stat-sheet/StatSheetPanel.tsx` (or a small co-located `statSourceLabels.ts` helper)
  - [x] Resolve `ModifierSource.source_label` to a friendly name **per `source_type`**, with a **raw-ID fallback** (never blank, never fabricated):
    - `passive_node` → label is the `node_id`; resolve to the node's display name via the loaded passive-tree `GameNode` (`gameData` passive tree node lookup — same `name` field `NodeTooltip` shows). Fall back to the raw `node_id`.
    - `gear_slot` → label is `"{slot_id}:{affix_id}"`; show a readable `slot · affix` form, resolving the affix display name from `contextDatabase` if cleanly available, else the raw string.
    - `idol` → label is the `affix_id`; resolve idol-affix display name if available, else raw.
    - `blessing` → label is the `blessing_id`; resolve blessing display name if available, else raw.
    - `skill_node` / `condition` → none produced today (Story 1.7); pass the raw label through (forward-compat).
  - [x] Keep resolution **synchronous and cheap** (in-memory lookups only — no IPC, no async) so NFR-2's 50ms holds. If a lookup source is not readily available, **prefer the raw ID over adding new plumbing** (display-name prettification was explicitly scoped as "best effort at render time" by Story 1.7 — do not expand scope into new stores/loaders).

- [x] **Task 4 — Wire the trigger onto `StatRow` (hover + focus + a11y) (AC: 1, 4)** — `lebo/src/features/stat-sheet/StatSheetPanel.tsx`
  - [x] Extend `StatRowProps` with optional `statKey?: string`, `fanInKeys?: string[]`, `capInfo?: {...}`, and the resolved `gameData`/sources accessor needed to build the list (or compute the source list in the panel and pass it down — keep `StatRow` mostly presentational).
  - [x] When `statKey` is present, make the row a **hoverable + focusable** trigger: `tabIndex={0}`, `onMouseEnter`/`onMouseLeave`, `onFocus`/`onBlur`, `onKeyDown` (Esc to dismiss), `aria-describedby` pointing at the tooltip `id`, and the existing `2px accent-gold` focus-ring treatment (match `TAB_CLASS`'s focus outline). Track open state + anchor rect in local row state.
  - [x] On open, compute the source list = `stat_sources[statKey] ?? []` concatenated with each `stat_sources[k] ?? []` for `k` in `fanInKeys`. Read sources from the **committed `statSheet.stat_sources`** (the panel already displays `statSheet` values; preview only drives delta badges — the tooltip reflects the committed build, document this).
  - [x] Keep the row **non-interactive in appearance** (no button chrome) but operable; ensure adding `tabIndex` does not break the axe sweep (content-on-hover must be dismissible + persistent + hoverable per WCAG 1.4.13 — satisfied by Esc-dismiss + hoverable tooltip).

- [x] **Task 5 — FR-14 resistance row cap annotation (AC: 3)** — `lebo/src/features/stat-sheet/StatSheetPanel.tsx`
  - [x] Reconcile the in-row resistance annotation from the current `(+{warningGap}% needed)` to the FR-14 wording `(+{gap} to cap)` shown **in the warning color** alongside the value (target render: `68% (+7 to cap)`). Keep it driven by the existing `findWarning(..., warnType)?.gap` (the warning is present only when below cap) — do **not** invent a new warning source.
  - [x] Define `RESISTANCE_CAP = 75` (module constant). Pass `capInfo` to the resistance rows' tooltip so the footer repeats the cap gap (below cap) or shows the over-cap pre-cap total (at cap). Pre-cap total = sum of the concatenated source `value`s; the displayed `defense.[res]` is the post-cap value. (See Dev Notes "Cap math" for the at-cap vs below-cap branch.)
  - [x] Do **not** change non-resistance rows' annotations; only resistances carry the cap concept (FR-14).

- [x] **Task 6 — Tests (AC: 1, 2, 3, 4)** — NEW `StatSourceTooltip.test.tsx` + extend `StatSheetPanel.test.tsx`
  - [x] `StatSourceTooltip.test.tsx` (new, co-located): grouping into the six categories in order; contribution formatting per `modifier_type`; **"Base value only."** on empty list; cap footer below-cap (`+7% to cap`) and at/over-cap (pre-cap total > cap); `role="tooltip"` present; zero axe violations on the rendered tooltip.
  - [x] Extend `StatSheetPanel.test.tsx`: hovering a sourced resistance row opens the tooltip and lists the source (use `@testing-library/user-event` `hover`); the **`AllResistances` fan-in** appears in an element-resistance tooltip; a row with no sources shows "Base value only."; the FR-14 in-row annotation renders `(+N to cap)` in warning color when below cap; keyboard focus opens and `Esc`/blur dismisses.
  - [x] Keep the existing `StatSheetPanel.test.tsx` assertions green (tab counts, delta badges, resistance warning gaps wording — **update the warning-gap assertion to the new FR-14 text**, resistance colors, dash placeholders). Extend the **"all tabs" axe sweep** to cover the open-tooltip state with zero violations.
  - [x] Mock/extend the test fixture `makeStatSheet()` to populate `stat_sources` (e.g. `{ "FireResistance": [<passive>, <gear>], "AllResistances": [<idol>], "Strength": [<passive>] }`) — it currently omits the optional field.

- [x] **Task 7 — Verify the gate (AC: 4)**
  - [x] `pnpm exec tsc --noEmit` → exit 0 (from `lebo/`).
  - [x] `CI=true pnpm exec vitest run src/features/stat-sheet/StatSourceTooltip.test.tsx` and `...StatSheetPanel.test.tsx` → fully green.
  - [x] `CI=true pnpm exec vitest run` (full suite) → no new failures beyond the documented pre-existing ~14-failure UI baseline (prove pre-existing by stashing this story's files if the count looks off, per the Story 1.6 method).

### Review Findings (code review 2026-06-04)

Scope: `d357b03..9cf21c5` — the 5 frontend files plus Story 1.7's supporting Rust/types (reviewed for contradictions with 1.8). Three adversarial layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Verified against source before triage.

- [x] [Review][Patch] Over-cap resistance row: keep raw value, color it as over-cap, and surface the cuttable amount — **Decision resolved (Alec 2026-06-04): keep the raw value, but color it to signal it exceeds the 75% cap and show how much resistance can be cut** (the "which gear can I drop" value). Engine returns resistances uncapped (`defense.rs:89` `fire_res = all_res + Σtype`, raw at `:222`). Fix: when `value > RESISTANCE_CAP`, render the in-row value in a distinct over-cap color (not the below-cap negative red) with an annotation of the overcap headroom (e.g. `(−17 over cap)` / cuttable amount = `value − 75`); extend the tooltip footer's at/over-cap branch to show the overcap amount alongside `capped at 75%`. Correct the false "displayed defense.[res] is post-cap" comment (`StatSheetPanel.tsx:25`). Below-cap behavior unchanged. [`StatSheetPanel.tsx:234-241,469`, `StatSourceTooltip.tsx:176-180`]
- [x] [Review][Patch] Aggregate per-point duplicate sources in the tooltip — **Decision resolved (Alec 2026-06-04): aggregate by source label.** Sources are recorded once per allocated point (`compute/mod.rs:110-133`), so an 8-point node lists 8 identical lines. Fix: in the tooltip grouping, collapse same-`(sourceType,name,modifierType)` entries into one line summing `value` and showing the point count, e.g. `Fervor — +40% (8 pts)`. [`StatSourceTooltip.tsx:89-95,147-159`]
- [x] [Review][Patch] Keyboard-focused tooltip can be dismissed by an unrelated mouse-leave (WCAG 1.4.13 persistence) — `open` is a single boolean; hover and focus are not tracked independently, so `onMouseLeave: scheduleClose` (`StatSheetPanel.tsx:206`) closes a tooltip that is still keyboard-focused once the pointer touches then leaves the row. Fix: track hover and focus separately, close only when both are false (Esc/blur still force-close). [`StatSheetPanel.tsx:192-214`]
- [x] [Review][Patch] `statSourceLabels.ts` name resolution (79-line new file) has zero test coverage — Tests mock `gameData = null` (`StatSheetPanel.test.tsx:113`), so `resolveSourceName` only ever returns the raw-ID fallback. The AC2/Task-3 "best-effort resolution" path (passive→node name, gear→`slot · affix`, idol, blessing) is unverified. Fix: add a `statSourceLabels` unit test (or a populated-`gameData` panel test) covering each `source_type` resolution + raw fallback. [`statSourceLabels.ts`, `StatSheetPanel.test.tsx:113`]
- [x] [Review][Patch] AC4/Task-6 literal miss: the "all tabs" axe sweep was not extended to the open-tooltip state — A separate single-tab open-tooltip axe test was added (`StatSheetPanel.test.tsx:461`) but the existing multi-tab sweep (`:368-376`) was left unchanged. Fix: open a tooltip within the all-tabs sweep, or accept the separate test as satisfying the intent. [`StatSheetPanel.test.tsx:368`]
- [x] [Review][Patch] Tooltip tests assert header order / fan-in presence only, not item placement or no-double-count — The grouping test checks header substring order via `indexOf`, and the fan-in test only asserts `idol_all` text appears; neither verifies each item lands under its correct category nor that `AllResistances` is counted once across the 7 element rows. Fix: strengthen assertions. [`StatSourceTooltip.test.tsx`, `StatSheetPanel.test.tsx:389`]
- [x] [Review][Defer] `stat_key_key` serde-failure returns `""` key, silently merging stats [`modifier.rs:619`] — deferred, pre-existing (Story 1.7 Rust, currently unreachable)
- [x] [Review][Defer] `collect_sources` duplicates `query`'s active-condition filter logic (maintenance hazard) [`modifier.rs`] — deferred, pre-existing (Story 1.7 Rust)
- [x] [Review][Defer] Tooltip viewport-flip math has no off-screen clamp on `left`/`top` [`StatSourceTooltip.tsx:79-87`] — deferred, pre-existing (mirrors the spec-directed NodeTooltip pattern; right-panel anchor geometry doesn't trigger negatives in practice)
- [x] [Review][Defer] Fixed-position tooltip anchor is captured once and not updated on scroll [`StatSheetPanel.tsx:185-190`] — deferred, pre-existing (same NodeTooltip portal tradeoff)
- [x] [Review][Defer] `tracking_does_not_perturb_frozen_aggregates` uses `serde_json` equality (NaN→null masks divergence) [`compute/mod.rs`] — deferred, pre-existing (Story 1.7 test)
- [x] [Review][Defer] Net-negative resistance renders an oversized `+105% to cap` annotation [`StatSourceTooltip.tsx:177`] — deferred, rare shred/curse edge case

Dismissed as noise (6): in-row `(+N to cap)` vs footer `+N% to cap` unit difference (matches AC3 wording exactly); `formatContribution` `conversion` no `+`/hardcoded `%` (matches spec `{value}% conversion`); `preCapTotal` summing modifier types as flat (the engine sums resistance values flat too — stays consistent); unitless-stat `increased` → `+30% increased` (`%` is inherent to "increased"); `makeStatSheet()` not extended but per-test overrides are functionally equivalent; axe `region` rule disabled on portal sweeps (documented, justified — portal legitimately sits outside page landmarks).

**Resolution (2026-06-04):** all 6 patches applied. Over-cap resistance now keeps the raw value, colored `accent-gold` with an in-row `(N over cap)` cuttable-headroom annotation + tooltip footer `· N% over cap` (Alec's call); per-point sources aggregate to `Name — +V (N pts)`; hover/focus tracked independently so a stray mouse-leave can't dismiss a focused tooltip; new `statSourceLabels.test.ts` (9) covers the name-resolution path; the all-tabs axe sweep now opens a tooltip; tooltip/fan-in assertions strengthened to verify category placement + single fold-in. Gate re-run: `tsc --noEmit` exit 0; stat-sheet suite 47/47 green; full suite 1058 passed / 14 pre-existing baseline failures (zero new). The 6 defers are logged in `deferred-work.md`.

## Dev Notes

### Scope boundary — what this story IS and is NOT
- **IS:** the `StatSourceTooltip.tsx` component (grouped categories, per-source name + contribution, "Base value only", cap footer); wiring a hover/focus trigger onto sourced `StatRow`s in `StatSheetPanel.tsx`; best-effort `source_label` name resolution with raw-ID fallback; the `AllResistances` fan-in (carried Story 1.7 review requirement); the FR-14 resistance cap-gap row annotation; new + extended tests with axe sweeps.
- **IS NOT:** any **Rust / engine / IPC** change — `stat_sources` is fully shipped after Story 1.7; the **right-panel chrome restyle** (score gauge, optimizer controls, panel sizing) — that is **Story 2.4 / Epic 2**; any **store / hook / view / router** change — `optimizationStore` already holds `statSheet.stat_sources` and the new field rides along (Story 1.7 explicitly left the store untouched); resolving derived/score rows to sources (they are aggregates with no `StatKey`); new game-data loaders/stores just to prettify labels (raw-ID fallback is the honest floor).

### This is frontend-only — the data already exists (read before coding)
Story 1.7 (done, code review passed) shipped the entire data path:
- The display `compute_stats` Tauri command (`scoring_commands.rs:15`) passes `track_sources: true` — it is the **only** site that enables tracking (Pattern P4-2). Every loop path returns `stat_sources: None`.
- `StatSheet.stat_sources?: Record<string, ModifierSource[]> | null` and the `SourceType` / `ModifierSource` types are **already in `lebo/src/shared/types/statSheet.ts:164-193`** — do **not** re-declare them.
- The field already rides on `optimizationStore.statSheet` (the panel already reads `statSheet` from there) — **no store change**.
- Keys are the **PascalCase serde variant names** of the Rust `StatKey` enum (e.g. `"FireResistance"`, `"AllResistances"`, `"Strength"`, `"CriticalStrikeChance"`) — derived once via `stat_key_key()` in `modifier.rs:107`. Query the map by these exact strings. [Source: 1-7-…md Completion Notes; modifier.rs:6-112]

### Row → StatKey map (authoritative wiring spec)
Use the live `StatKey` strings (`modifier.rs:6-101`). Only these rows are sourced; everything else is derived/aggregate → no tooltip.

| Tab | Row | StatKey string | Fan-in |
|---|---|---|---|
| General | Strength / Dexterity / Intelligence / Attunement | `Strength` / `Dexterity` / `Intelligence` / `Attunement` | — |
| Offense | Crit Chance | `CriticalStrikeChance` | — |
| | Crit Multi | `CriticalStrikeMultiplier` | — |
| | Attack Speed | `AttackSpeed` | — |
| | Cast Speed | `CastSpeed` | — |
| | AoE Modifier | `AreaOfEffect` | — |
| | Stun Chance | `StunChance` | — |
| | Elemental Pen | `ElementalPenetration` | — |
| | Physical Pen | `PhysicalPenetration` | — |
| | Void Pen | `VoidPenetration` | — |
| Defense | HP | `MaxHp` (+ `MaxHpPercent` if you choose to fold flat+percent — optional) | — |
| | Armor | `Armor` | — |
| | Endurance | `EndurancePercent` | — |
| | End. Threshold | `EnduranceThreshold` | — |
| | Fire/Cold/Lightning/Void/Necrotic/Physical/Poison Res | `FireResistance` … `PoisonResistance` | **`AllResistances`** |
| | Crit Avoidance | `CriticalStrikeAvoidance` | — |
| | Dodge | `DodgeRating` | — |
| | Block | `BlockChance` | — |
| Other | Healing Effectiveness | `HealingEffectiveness` | — |

- **No `StatKey` exists** for Ward Retention, Reduced Crit Bonus, Parry, Glancing Blow, the ailment-chance/avoidance rows, Stable Ward, or the EHP triple (`modifier.rs:57-59` documents these have no shipped source / are derived) → **no tooltip** on those rows. Honest: don't wire a key that can't appear in `stat_sources`.
- **Derived/aggregate rows** (Build Score, Damage Score, Avg Hit, Avg Hit Crit, Surv./Speed Score, the three EHP rows) are computed from many keys — **no single `StatKey`**, so **no tooltip** this story. The Story 1.7 review's "`IncreasedDamage`/`ElementalPenetration` fold-in" note applies *only if* a future story renders those umbrella stats as their own rows; we render neither as a direct row, so the only fan-in needed now is **`AllResistances` → each resistance**.

### Fan-in map (carried Story 1.7 review REQUIREMENT)
`AllResistances` is recorded under its own key but the engine adds its value into *every* resistance. So a resistance tooltip's source list = `stat_sources[<thisRes>] ?? []` **concat** `stat_sources["AllResistances"] ?? []`, and its pre-cap total sums **both**. Without this, a build whose 75% Fire Res comes entirely from an "All Resistances" affix would show an empty Fire Res tooltip — a correctness bug the 1.7 review explicitly deferred here. `AllElementalResistances` is **not** in the enum — do not query it. [Source: 1-7-…md Review Findings — Decision→Resolved; modifier.rs:54]

### Cap math (FR-14)
- `RESISTANCE_CAP = 75` (module constant). The displayed `defense.[res]` is the **post-cap** value the engine returns; the warning (`findWarning(warnings, "<res>_uncapped")`) is present **only when below cap** and carries `gap` (and `current_value`).
- **Pre-cap total** = sum of the concatenated source `value`s (this + `AllResistances`). It may exceed 75.
- **Below cap:** in-row annotation `value% (+gap to cap)` in `var(--color-data-negative)`; tooltip footer repeats `+gap% to cap`.
- **At/over cap:** no warning → show the row value (75%) with no negative annotation; tooltip footer shows `Pre-cap total: {preCapTotal}% (capped at 75%)` so the player sees their overcap headroom — the core "which gear can I drop" value of the feature.
- This reconciles the current `StatRow` text `(+{warningGap}% needed)` (line 165-172) to the FR-14 `(+N to cap)` wording. Update the matching `StatSheetPanel.test.tsx` assertion.

### Tooltip implementation pattern (mirror NodeTooltip)
`lebo/src/features/skill-tree/NodeTooltip.tsx` is the reference: `createPortal(node, document.body)`, `position: 'fixed'`, viewport-edge flip math (`OFFSET`, width/height guard), `var(--color-bg-elevated)` bg + `var(--color-bg-base)` border, `zIndex: 1000`, `onWheel` stopPropagation, and `onMouseEnter`/`onMouseLeave` passthrough so the tooltip is hoverable (WCAG 1.4.13 persistent). Capture the anchor rect from the row's `onMouseEnter`/`onFocus` event (`getBoundingClientRect()`) for the `position`. Use `useReducedMotion()` (`lebo/src/shared/hooks/useReducedMotion.ts`) to gate any fade.

### Project conventions (from project-context.md — must follow)
- **No barrel files, no default exports** — `StatSourceTooltip` is a named export; import it directly into `StatSheetPanel.tsx`.
- **Rust output types are snake_case** — read `source_type`, `source_label`, `value`, `modifier_type` with their snake_case names; never camelCase them. `modifier_type` is the lowercase union `'flat' | 'increased' | 'more' | 'conversion'`.
- **Tailwind v4 CSS-first** — no `tailwind.config.js`, never `@apply`. Use `var(--color-*)` inline (the panel + NodeTooltip already do). Warning color = `var(--color-data-negative)`; muted/category headers = `var(--color-text-muted)`.
- **Always `?? []` / `?? {}`** when reading optional fields — `stat_sources` is `Record<string, ModifierSource[]> | null | undefined`; `stat_sources?.[key] ?? []`. Optional `BuildState` fields (idolGrid, etc.) default likewise.
- **Accessibility:** keep the `2px accent-gold` focus ring on the new focusable trigger (never `outline: none` without a replacement); `role="tooltip"` + `aria-describedby`; content-on-hover dismissible (Esc) + persistent (hoverable) + focus-triggerable (WCAG 1.4.13); `prefers-reduced-motion` via `useReducedMotion()`. Run the axe sweep on the open-tooltip state.
- **Phase boundary:** only edit inside `LEBOv2/` (`lebo/…`). Never touch `../_bmad-output/` Phase-1 files or `../lebo/`. (This story's writes are all under `lebo/src/features/stat-sheet/`.)

### Testing standards (from project-context.md)
- Vitest config lives in `vite.config.ts` (no separate config). `test-setup.ts` provides `ResizeObserver`, `matchMedia` (required by Headless UI + `useReducedMotion`), jest-dom, and `vitest-axe` matchers — do not duplicate.
- Co-locate tests: new `StatSourceTooltip.test.tsx` next to the component; extend `StatSheetPanel.test.tsx` in place.
- a11y via `vitest-axe`: `expect(await axe(container)).toHaveNoViolations()`. Extend the "all tabs" sweep to include the open-tooltip state.
- The portal renders into `document.body` — in tests query via `screen`/`within(document.body)` (RTL queries the whole document by default), and clean up between tests (RTL auto-unmounts; the portal node unmounts with the component).
- **The ~14-failure vitest baseline** (`SkillTreeCanvas`/`TreeControls`/`AppHeader`/`RightPanel`/`ProviderSelector`/`Settings`) is pre-existing and unrelated — add **zero** new failures. `StatSheetPanel.test.tsx` + `StatSourceTooltip.test.tsx` must be fully green.
- No snapshot tests — explicit `expect` assertions only.

### Previous story intelligence (Story 1.7 — the data you render; Story 1.6 — the panel you extend)
- **Story 1.7 (done):** shipped `SourceType`/`ModifierSource`, the opt-in `track_sources` (true only on the display call), `StatSheet.stat_sources` keyed by PascalCase `StatKey` string, lib re-exports, and the TS type-sync — explicitly deferring the tooltip + store consumption + display-name resolution to **this story**. Its review **resolved the umbrella/fan-out decision by deferring it here** (the `AllResistances` fan-in above). `collect_sources` returns a `HashMap` with **non-deterministic cross-key order** (1.7 Defer) — do not rely on key/JSON order; **sort within a category** (e.g. by descending `value` or by name) for stable display.
- **Story 1.6 (done):** built the five-tab `StatSheetPanel.tsx` you extend — `StatRow` (label/value/unit/warningGap/delta/labelColor), `GroupLabel`, `RESISTANCES` (7 entries incl. necrotic in addendum-F order), `findWarning`, `fmt`/`fmtInt`, the `key={showMinionTab…}` remount. **Extend it in place — do not rewrite.** The panel renders inside `RightPanel.tsx:177` in a `maxHeight: 320px` scroll container; the tooltip portals to `document.body` so the scroll container does not clip it (another reason to mirror `NodeTooltip`'s portal approach, not an in-flow popover).
- The honest-`0.0` / honest-`—` discipline from 1.5/1.6 carries: a sourced row with an empty map entry is **"Base value only."**, not a fabricated source.

### Git intelligence
Recent commits are `[AutoSave]` snapshots with no story-specific signal; the authoritative state is the working tree + the Story 1.7/1.6 Dev Agent Records. No migration or dependency change is in flight. This story adds one new file + edits two (`StatSheetPanel.tsx`, `StatSheetPanel.test.tsx`) — no Rust, no `Cargo`/`package.json` change.

### Project Structure Notes
- New file: `lebo/src/features/stat-sheet/StatSourceTooltip.tsx` (+ `StatSourceTooltip.test.tsx`), exactly the architecture file-map location (`architecture.md:451`). Optional tiny helper `statSourceLabels.ts` may co-locate in the same folder.
- Edited: `lebo/src/features/stat-sheet/StatSheetPanel.tsx` (+ its test). No store/view/router/hook/IPC change — does not touch the four-store / no-router / props-only-canvas / no-barrel rules.
- Self-contained within the `stat-sheet/` feature folder; the only cross-feature read is `useReducedMotion` (shared hook) and `gameData`/`contextDatabase` (shared stores) for label resolution — all routed through `shared/`, no feature-to-feature import.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.8 (L456-477)] — user story + 3 AC blocks (grouped tooltip within 50ms, dismiss on mouse-leave (FR-13, UX-DR8, NFR-2); pre-cap total + cap gap + "Base value only" when no sources; below-cap resistance delta annotation `68% (+7 to cap)` repeated in tooltip (FR-14)).
- [Source: _bmad-output/planning-artifacts/epics.md#FR-13 (L56), #FR-14 (L57), #UX-DR8 (L193)] — grouped categories (Passives/Gear/Idols/Blessings/Skills/Conditions), pre-cap total, "Base value only", dismiss on mouse-leave; resistance cap-gap annotation + tooltip footer.
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 notes (L262-263)] — Epic 1 owns `StatSourceTooltip`; chrome restyle is Epic 2; `track_sources` on only for the display call (Pattern P4-2).
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-P4-D-P4-3 (L181-204)] — response shape; "the breakdown tooltip reads `statSheet.stat_sources[statKey]`, groups by `source_type`, renders the grouped list with pre-cap total + cap-gap annotation; pure render, no extra IPC (SM-2 50ms)."
- [Source: _bmad-output/planning-artifacts/architecture.md (L451, L522, L543)] — `StatSourceTooltip.tsx` NEW (FR-13/14); feature map; data-flow note (StatSheetPanel + StatSourceTooltip hover, no extra IPC).
- [Source: _bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/prd.md (L127, L188, L192)] — gold at-cap indicator vs below-cap gap in warning color; "Base value only" fallback; `68% (+7 to cap)` row annotation + tooltip cap-gap footer.
- [Source: _bmad-output/implementation-artifacts/1-7-modifiersource-tracking-and-opt-in-stat-sources.md] — the data path this story renders: `stat_sources` shape, PascalCase `StatKey` string keys, `track_sources` display-only, **the carried `AllResistances` fan-in requirement** (Review Findings — Decision→Resolved), non-deterministic HashMap order (Defer).
- [Source: _bmad-output/implementation-artifacts/1-6-five-tab-stat-sheet-panel-with-live-recompute.md] — the `StatSheetPanel.tsx` skeleton to extend (`StatRow`, `RESISTANCES`, `findWarning`, delta logic, the `(+N% needed)` annotation to reconcile).
- Current code: `lebo/src/features/stat-sheet/StatSheetPanel.tsx` (StatRow `:144-179`, RESISTANCES `:22-30`, resistance render `:329-342`, warning annotation `:165-172`), `lebo/src/shared/types/statSheet.ts:164-193` (`SourceType`/`ModifierSource`/`stat_sources`), `lebo/src/features/skill-tree/NodeTooltip.tsx` (portal/flip pattern), `lebo/src/shared/hooks/useReducedMotion.ts`, `lebo/src-tauri/scoring-core/src/modifier.rs:6-112` (`StatKey` variants + `stat_key_key`/`collect_sources`), `lebo/src/shared/stores/optimizationStore.ts:25,75` (`previewStatSheet`; `statSheet` already holds `stat_sources`).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (BMAD dev-story workflow)

### Debug Log References

- `pnpm exec tsc --noEmit` → exit 0 (twice: after wiring, after tests).
- `CI=true pnpm exec vitest run src/features/stat-sheet/StatSourceTooltip.test.tsx` → 10/10 green.
- `CI=true pnpm exec vitest run src/features/stat-sheet/StatSheetPanel.test.tsx` → 27/27 green.
- `CI=true pnpm exec vitest run` (full suite) → 1048 passed, 14 failed. All 14 failures are the documented pre-existing UI baseline (`AppHeader`, `RightPanel`, `ProviderSelector`, `Settings`, `SkillTreeCanvas`, `TreeControls`) — jsdom/Headless-UI/canvas-environment, unrelated. Zero new failures; no `stat-sheet` file appears in the failure set.

### Completion Notes List

- **Frontend-only, as scoped.** No Rust/IPC/store/hook/view/router change. `stat_sources` was already shipped on `optimizationStore.statSheet` by Story 1.7; this story is a pure render of that in-memory data — no second `compute_stats` call (NFR-2 satisfied by construction).
- **NEW `StatSourceTooltip.tsx`** — portal-based (mirrors `NodeTooltip`: `createPortal(document.body)`, `position: fixed`, viewport-edge flip, `var(--color-bg-elevated)`/`var(--color-bg-base)`, `zIndex: 1000`, hoverable). Groups sources into the fixed FR-13 order (Passive Nodes / Gear / Idols / Blessings / Skills / Conditions), per-source `name — contribution`, `formatContribution` helper (flat/increased/more/conversion + sign), "Base value only." empty state, and the cap footer (below-cap `+N% to cap` in `--color-data-negative`; at/over-cap `Pre-cap total: N% (capped at 75%)`). Sorts within a category (value desc, then name) to be stable against 1.7's non-deterministic HashMap order. `role="tooltip"` + reduced-motion gate.
- **NEW `statSourceLabels.ts`** — synchronous best-effort `source_label` resolution per `source_type` with raw-ID fallback (never blank/fabricated): passive_node→node display name (active class baseTree + masteries + skillTrees + weaver nodes), gear_slot→`Slot · affix` (itemDatabase affix name), idol→idol-affix displayName, blessing→blessing displayName, skill_node/condition→raw passthrough.
- **`StatSheetPanel.tsx`** — added `RESISTANCE_CAP = 75`, `ALL_RESISTANCES_KEY`, a row→`StatKey` map (live PascalCase serde strings), and the **`AllResistances` fan-in** into every resistance tooltip (carried Story 1.7 review requirement). `StatRow` extended into an optional hover/focus trigger (`tabIndex=0`, `onMouseEnter`/`onFocus` open, delayed `onMouseLeave` close so the gap to the hoverable tooltip is traversable, `Esc`/blur dismiss, `aria-describedby` only while open, `2px accent-gold` focus ring). Derived/aggregate rows (scores, Avg Hit, EHP triple) and no-`StatKey` rows (Ward Retention/Reduced Crit Bonus/Parry/Glancing/ailments) intentionally get **no** tooltip.
- **FR-14** — reconciled the in-row resistance annotation from `(+N% needed)` to `(+N to cap)` in the warning color; tooltip footer repeats the cap gap. Pre-cap total = sum of concatenated source values (incl. fan-in).
- **a11y** — `role="tooltip"` + `aria-describedby` wiring, focus-triggerable + Esc-dismissible + hoverable (WCAG 1.4.13), reduced-motion gated. The axe `region` (landmark) rule is disabled only on the two tooltip-inclusive `document.body` sweeps — a portaled overlay legitimately sits outside page landmarks (documented false positive); all other axe rules pass with zero violations.

### File List

- `lebo/src/features/stat-sheet/StatSourceTooltip.tsx` (new)
- `lebo/src/features/stat-sheet/StatSourceTooltip.test.tsx` (new)
- `lebo/src/features/stat-sheet/statSourceLabels.ts` (new)
- `lebo/src/features/stat-sheet/StatSheetPanel.tsx` (modified)
- `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` (modified)

## Change Log

| Date | Change |
|------|--------|
| 2026-06-04 | Story 1.8 implemented (dev-story). NEW `StatSourceTooltip.tsx` (grouped FR-13 categories, contribution formatting, "Base value only", cap footer, portal/flip mirror of `NodeTooltip`, `role=tooltip`, reduced-motion) + NEW `statSourceLabels.ts` (synchronous best-effort `source_label` resolution, raw-ID fallback). `StatSheetPanel.tsx`: row→`StatKey` map, `AllResistances` fan-in into every resistance tooltip, hover/focus trigger on sourced `StatRow`s, FR-14 `(+N to cap)` annotation reconciled, `RESISTANCE_CAP=75`. Pure render of `statSheet.stat_sources` — no Rust/IPC/store/hook/view/router change. Tests: new `StatSourceTooltip.test.tsx` (10) + extended `StatSheetPanel.test.tsx` (27) with hover/keyboard/fan-in/cap-footer/axe coverage; FR-14 wording assertions updated. Gate: `tsc --noEmit` exit 0; full vitest 1048 passed / 14 pre-existing baseline failures (zero new). Status → review. |
| 2026-06-04 | Story 1.8 drafted by create-story context engine. Frontend-only render half of Stat Source Attribution (final Epic 1 story): NEW `StatSourceTooltip.tsx` (grouped categories Passives/Gear/Idols/Blessings/Skills/Conditions, per-source name+contribution, "Base value only", cap footer) portaled like `NodeTooltip`; hover/focus trigger wired onto sourced `StatRow`s via a row→`StatKey` map; **`AllResistances` fan-in** into every resistance tooltip (carried Story 1.7 review requirement); FR-14 resistance row annotation reconciled to `68% (+7 to cap)`; best-effort `source_label` name resolution with honest raw-ID fallback; pure render of `statSheet.stat_sources` (no IPC, NFR-2). No Rust/IPC/store/hook/view/router change — data shipped in Story 1.7. a11y: focusable trigger + `role="tooltip"` + `aria-describedby` + WCAG 1.4.13 dismissible/persistent + reduced-motion. Tests: new `StatSourceTooltip.test.tsx` + extended `StatSheetPanel.test.tsx` with axe sweeps; gate = `tsc --noEmit` 0 + no new vitest failures beyond the ~14 pre-existing UI baseline. Status → ready-for-dev. |
