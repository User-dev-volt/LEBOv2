# Story 1.6: Five-tab Stat Sheet panel with live recompute

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a theory-crafting player,
I want all computed stats laid out across General / Offense / Defense / Minion / Other tabs that update instantly,
so that I always see the current build's full picture without a recalculate button.

This story completes the **functional five-tab StatSheet content** (addendum F) on top of the data engine finished in Stories 1.1–1.5. **All the data already exists** — Story 1.5 shipped the final `StatSheet` shape (offense incl. penetration + ailment chances, full defense layers incl. EHP-triple + Stable Ward + necrotic res, `attributes`, nullable `ailment`/`minion`, `warnings`). The live-recompute pipeline (`useStatSheet`) is **already wired and mounted** in `App.tsx`. **This story is pure display layout + tests** — it lays out every addendum-F field into the existing `StatSheetPanel.tsx`, fills the Minion tab with real values, and confirms there is no manual recalculate control. It is a **frontend-only story**: no Rust, no IPC-signature change, no store change, no new hook.

**This story's defining discipline is the same honesty rule the engine stories followed — surface only what the engine produces.** Many addendum-F rows map to real `StatSheet` fields (lay them out). A few addendum-F rows have **no backing field in `StatSheet`** (Move Speed, Cooldown Recovery, Mana, Health Regen, Life Leech, Ward/sec, Idol Cells Used). Those must render an honest `—` placeholder (never a fabricated number), exactly as the engine surfaced unsourced stats as honest `0.0`. Do **not** invent fields or call new IPC to fill them.

**Scope boundary (read twice):** This story owns the **functional stat content** inside `StatSheetPanel`. It does **NOT** own the surrounding right-panel chrome restyle (that's **Story 2.4**, Epic 2) nor the per-stat **source-breakdown hover tooltip** `StatSourceTooltip` (that's **Stories 1.7–1.8**). Do not build `StatSourceTooltip.tsx` here. Do not restyle `RightPanel.tsx`'s score gauge / optimizer chrome. Keep the existing Claude-design tokens already in use in the panel.

## Acceptance Criteria

**AC1 — Five tabs laid out exactly per addendum F (UX-DR7)**
- **Given** a computed `StatSheet`,
- **When** the panel renders,
- **Then** stats are organized across the five tabs **exactly per addendum F** — General / Offense / Defense / Minion / Other — with each tab containing the fields listed in the Dev Notes "Addendum F → field map" table.
- **And** every row whose value maps to a real `StatSheet` (or build-state) field shows that value; every addendum-F row with **no backing field** (Move Speed, Cooldown Recovery, Mana, Health Regen, Life Leech, Ward/sec, Idol Cells Used) renders an honest `—` placeholder — **never a fabricated number** (the display-layer equivalent of the engine's honest-`0.0` rule).
- **And** the **Necrotic Res** row is added to the Defense tab (it was previously missing from the resistance list even though `defense.necrotic_resistance` exists), with its own damage-type color (see Dev Notes — a `--color-dmg-necrotic` token must be added to `global.css`; no necrotic token ships today).

**AC2 — Minion tab conditionally hidden; populated with real values when shown (FR-10)**
- **Given** a `StatSheet` where `minion == null` (no minion skill assigned),
- **When** the panel renders,
- **Then** the Minion tab is **not present** (tab count = 4: General/Offense/Defense/Other) — driven purely off `statSheet.minion != null`, the existing `showMinionTab` signal.
- **Given** a `StatSheet` where `minion != null`,
- **When** the panel renders,
- **Then** the Minion tab **is** present (tab count = 5) and shows **Minion Count, Minion Damage Multi, Minion HP Multi, Minion Speed** from `statSheet.minion` (replacing the current placeholder text "Minion stats available once minion skill data is loaded."). Per Story 1.5, `minion_count`/`minion_hp_multi`/`minion_speed` are honest `0.0` today and `minion_damage_multi` is sourced — display whatever the engine returns; do not annotate or hide the zeros.

**AC3 — Live recompute with no manual recalculate control (FR-11, NFR-10)**
- **Given** any build-state change (node, gear, affix tier, idol, blessing, condition, level, skill, archetype slider),
- **When** the change is applied,
- **Then** all displayed stats recompute and re-render via the **existing** `useStatSheet` rAF-debounced path (already mounted in `App.tsx:44`) — this story adds **no** new recompute trigger and **no** manual "Recalculate" button/control anywhere.
- **And** the `compute_stats` display round-trip stays under **16ms** (NFR-10) — verified manually against a fully-loaded build (see Task 5); this is a verification gate, not new code (the rAF/generation-counter debounce in `useStatSheet` already governs it — do not duplicate or alter it).

**AC4 — Build stays green; additive display only; a11y preserved**
- **Given** the existing test baseline,
- **When** the new rows are added,
- **Then** `pnpm exec tsc --noEmit` stays at exit 0, and `CI=true pnpm exec vitest run` shows **no new failures** beyond the pre-existing 14-failure UI baseline (the 14 are `SkillTreeCanvas`/`TreeControls`, unrelated).
- **And** `StatSheetPanel.test.tsx` is extended with assertions for the newly-laid-out rows (attributes, penetration, ailment chances, EHP-triple, necrotic res, minion values) and the existing tests (tab counts, delta badges, resistance warning gaps, resistance colors) continue to pass.
- **And** every `axe` accessibility check in `StatSheetPanel.test.tsx` (including the "all tabs" sweep) passes with **zero violations** — new rows follow the existing `StatRow` pattern; resistance/damage-type label colors must retain sufficient contrast (reuse the existing `StatRow` `labelColor` mechanism; do not introduce `outline: none`).

## Tasks / Subtasks

- [ ] **Task 1 — Add the `--color-dmg-necrotic` token (AC: 1)** — `lebo/src/assets/styles/global.css`
  - [ ] Add `--color-dmg-necrotic` to the `--color-dmg-*` block (around `global.css:55-61`). No necrotic token ships today; pick a Last-Epoch-appropriate sickly-green/teal (e.g. `#7FB069` or `#6FBF8F`) — Story 2.1 owns final token *value* reconciliation and does **not** add this token, so adding it here is correct and non-conflicting.
  - [ ] Verify it resolves the same way the existing `--color-dmg-*` vars do (used inline as `var(--color-dmg-necrotic)`).

- [ ] **Task 2 — General tab: add Attributes (+ honest placeholders) (AC: 1)** — `StatSheetPanel.tsx`
  - [ ] Keep existing General rows (Class, Mastery, Level, Passive Points, per-skill rows).
  - [ ] Add an **Attributes** group from `statSheet.attributes`: Strength, Dexterity, Intelligence, Attunement (addendum F lists Str/Dex/Int/Att). Render via `StatRow` with `fmtInt`. (`vitality` is `0.0`/forward-compat per Story 1.5 and is **not** in addendum F — omit it.)
  - [ ] Add an honest **Idol Cells Used** row: derive from `activeBuild.idolGrid` occupancy if cleanly available, otherwise render `—` (no fabrication — idol cell-size accounting is an idol-grid concern, default to `—` when not derivable). Add a **Skill Slots** summary row (e.g. count of assigned skills) if not already implied by the per-skill rows.

- [ ] **Task 3 — Offense tab: add penetration, stun chance, ailment chances, per-type damage (AC: 1)** — `StatSheetPanel.tsx`
  - [ ] Keep existing rows (Build Score, Damage Score, Avg Hit, Avg Hit (Crit), Crit Chance, Crit Multi, Attack Speed, Cast Speed, AoE Modifier).
  - [ ] Add **Stun Chance** from `offense.stun_chance` (`%`).
  - [ ] Add **Penetration** rows: `offense.elemental_penetration`, `offense.physical_penetration`, `offense.void_penetration` (per addendum F "Penetration (per type)").
  - [ ] Add **Ailment Chances** group: `bleed_chance`, `ignite_chance`, `poison_chance`, `freeze_chance`, `shock_chance` (`%`; addendum F lists these five — `armor_shred_chance` exists in the type but is not in addendum F's Offense list, so omit it from the layout). Per Story 1.5 these are honest `0.0` today — display the engine value as-is.
  - [ ] Optionally lay out **Damage Score (per type)** from `offense.damage_types[]` (`DamageTypeBreakdown`) using `DAMAGE_TYPE_COLORS` from `rarityColors.ts`. If the array is empty (common today), render nothing extra — do not fabricate per-type rows.

- [ ] **Task 4 — Defense tab: EHP-triple, Stable Ward, Ward Retention, Necrotic Res, new layers, ailment avoidance (AC: 1)** — `StatSheetPanel.tsx`
  - [ ] Replace the single **Effective HP** row with the **EHP triple** per addendum F: EHP vs Hits (`ehp_vs_hits`), vs DoTs (`ehp_vs_dots`), vs 1-shots (`ehp_vs_one_shots`). (The legacy `defense.effective_hp` still exists and still drives the delta badge / preview — keep using it for the delta logic; the new rows are display-only additions.)
  - [ ] Keep HP (`raw_hp`), Ward (`ward`), Armor, Endurance %, Endurance Threshold.
  - [ ] Add **Stable Ward** (`stable_ward`) and **Ward Retention** (`ward_retention`).
  - [ ] Add **Necrotic Res** to the `RESISTANCES` array — `{ field: 'necrotic_resistance', warnType: 'necrotic_resistance_uncapped', label: 'Necrotic Res', damageTypeColor: 'var(--color-dmg-necrotic)' }`. Place it between Void and Physical to match addendum F order (Fire/Cold/Lightning/Void/**Necrotic**/Physical/Poison).
  - [ ] Add the remaining addendum-F Defense layers from `DefenseStats`: **Parry** (`parry_chance`), **Block** (`block_chance`), **Glancing Blow** (`glancing_blow_chance`), **Crit Avoidance** (`crit_avoidance`, already present), **Reduced Crit Bonus** (`reduced_bonus_damage_from_crits`), **Dodge** (`dodge_chance`, already present).
  - [ ] Add **Ailment Avoidance** group: `chill_avoidance`, `stun_avoidance`, `bleed_avoidance` (`%`). Honest `0.0` today (Story 1.5) — display as-is.

- [ ] **Task 5 — Minion tab + Other tab + recompute confirmation (AC: 2, 3)** — `StatSheetPanel.tsx`
  - [ ] Replace the Minion `TabPanel` placeholder text with real rows from `statSheet.minion`: **Minion Count** (`minion_count`), **Minion Damage Multi** (`minion_damage_multi`), **Minion HP Multi** (`minion_hp_multi`), **Minion Speed** (`minion_speed`). Keep the existing `showMinionTab` gating and the `key={showMinionTab ? ...}` remount that keeps the Tab/TabPanel counts in sync — **do not change** that pattern (it prevents Headless UI index drift).
  - [ ] Other tab: keep Survivability Score (`scores.survivability_score`) and Speed Score (`scores.speed_score`). Add **Increased Healing Effectiveness** from `defense.healing_effectiveness` (a real field). For Move Speed, Cooldown Recovery, Mana (pool+regen), Health Regen, Life Leech, Ward/sec — these have **no `StatSheet` field**; render honest `—` rows (or keep the existing "coming in a future update" note). Do **not** add new IPC or invent values.
  - [ ] Confirm **no manual recalculate control** exists anywhere in the panel (there is none today — do not add one). The recompute is driven entirely by `useStatSheet` in `App.tsx`.
  - [ ] **NFR-10 verification:** with a fully-loaded build, confirm the `compute_stats` display round-trip stays under 16ms (e.g. wrap the `invokeCommand('compute_stats')` in `useStatSheet` with a temporary `performance.now()` log during dev, or use the Tauri devtools). Record the observed time in the Dev Agent Record. Do **not** leave the timing log in committed code, and do **not** alter the rAF/generation-counter debounce.

- [ ] **Task 6 — Tests + keep the build green (AC: 4)** — `StatSheetPanel.test.tsx`
  - [ ] `makeStatSheet()` already includes every field (updated by Story 1.5) — extend test fixtures with non-zero values where needed to assert rendering (e.g. set `attributes.strength`, `offense.elemental_penetration`, `defense.ehp_vs_hits`, `defense.necrotic_resistance`, `minion.minion_damage_multi`).
  - [ ] Add assertions: Attributes rows render on General; penetration + stun + ailment-chance rows render on Offense; EHP-triple + Stable Ward + Necrotic Res + Parry/Block/Glancing + ailment-avoidance rows render on Defense; the four minion rows render when `minion != null`.
  - [ ] Keep the existing tests green: 4-vs-5 tab counts, delta badges (Offense/Defense), resistance warning-gap label, capped-resistance suppression, dash placeholders when `statSheet == null`, fire-res color, loading indicator.
  - [ ] Update/extend the **"all tabs" axe sweep** to include any newly-active tab content; ensure zero violations. Necrotic Res label color must keep contrast (reuse the `labelColor` mechanism the other resistances use).
  - [ ] Run `pnpm exec tsc --noEmit` (exit 0) and `CI=true pnpm exec vitest run` (no new failures beyond the 14-failure baseline; `StatSheetPanel.test.tsx` fully green).

## Dev Notes

### Scope boundary — what this story IS and is NOT
- **IS:** laying out every addendum-F field inside `StatSheetPanel.tsx`; adding the Attributes group, penetration/stun/ailment-chance rows (Offense), EHP-triple/Stable Ward/Ward Retention/Necrotic Res/Parry/Block/Glancing/Reduced-Crit-Bonus/ailment-avoidance rows (Defense), real Minion rows; honest `—` placeholders for unsourced addendum-F rows; the `--color-dmg-necrotic` token; extending `StatSheetPanel.test.tsx`.
- **IS NOT:** the right-panel **chrome** restyle (score gauge, optimizer controls, panel sizing) — that's **Story 2.4 / Epic 2**; the per-stat **source-breakdown hover tooltip** `StatSourceTooltip.tsx` — that's **Stories 1.7–1.8** (do not create it); any **Rust / engine / IPC** change (the data is all present — `StatSheet` is final after 1.5); any new **store / hook / view / router**; touching the `useStatSheet` rAF/generation-counter debounce. **Do not** add a "Recalculate" button.

### This is a frontend-only story — the data already exists
Stories 1.1–1.5 finished the engine. The `compute_stats` IPC returns the complete `StatSheet` (see `lebo/src/shared/types/statSheet.ts`). `useStatSheet` (`lebo/src/shared/stores/useStatSheet.ts`) already subscribes to build + game-data changes, rAF-debounces, uses a generation counter to discard stale results, writes `optimizationStore.statSheet`, and is **already mounted at `App.tsx:44`**. The panel already reads `statSheet` from `optimizationStore`. So FR-11 (live recompute) is **already satisfied at the data layer** — this story's AC3 is mostly a "confirm + don't regress + no recalc button" gate plus the NFR-10 timing check. **Your job is layout, not plumbing.**

### Addendum F → field map (the authoritative layout spec for this story)
Source: `_bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/addendum.md#F`. Map each addendum-F field to its `StatSheet`/build source. `✅` = real field, lay it out; `—` = no backing field, honest placeholder.

| Tab | Field | Source |
|---|---|---|
| **General** | Class / Mastery / Level / Passive Points | build state (already rendered) |
| | Idol Cells Used | `activeBuild.idolGrid` occupancy if derivable, else `—` |
| | Skill Slots | `activeBuild.contextData.skills` (already implied by per-skill rows) |
| | Attributes (Str/Dex/Int/Att) | ✅ `statSheet.attributes.{strength,dexterity,intelligence,attunement}` |
| **Offense** | Build Score | ✅ `scores.build_score` (already) |
| | Damage Score (per type) | ✅ `offense.damage_score` + `offense.damage_types[]` (per-type optional; empty today) |
| | Avg Hit / Avg Hit (crit) | ✅ `offense.avg_hit_damage` / `avg_hit_damage_crit_weighted` (already) |
| | Crit Chance / Crit Multi | ✅ `offense.critical_strike_chance` / `critical_strike_multiplier` (already) |
| | Attack Speed / Cast Speed | ✅ `offense.attack_speed` / `cast_speed` (already, nullable) |
| | AoE Modifier | ✅ `offense.aoe_modifier` (already) |
| | Penetration (per type) | ✅ `offense.elemental_penetration` / `physical_penetration` / `void_penetration` |
| | Stun Chance | ✅ `offense.stun_chance` |
| | Ailment Chances (Bleed/Ignite/Poison/Freeze/Shock) | ✅ `offense.{bleed,ignite,poison,freeze,shock}_chance` (honest 0.0 today) |
| **Defense** | Effective HP (vs Hits / vs DoTs / vs 1-shots) | ✅ `defense.ehp_vs_hits` / `ehp_vs_dots` / `ehp_vs_one_shots` |
| | HP | ✅ `defense.raw_hp` (already) |
| | Stable Ward | ✅ `defense.stable_ward` |
| | Ward Retention | ✅ `defense.ward_retention` |
| | Armor | ✅ `defense.armor` (already) |
| | Endurance (% + threshold) | ✅ `defense.endurance_percent` / `endurance_threshold` (already) |
| | Fire/Cold/Lightning/Void/**Necrotic**/Physical/Poison Res | ✅ `defense.*_resistance` (add **necrotic** to `RESISTANCES`) |
| | Dodge / Parry / Block / Glancing Blow | ✅ `defense.dodge_chance` / `parry_chance` / `block_chance` / `glancing_blow_chance` |
| | Crit Avoidance / Reduced Crit Bonus | ✅ `defense.crit_avoidance` (already) / `reduced_bonus_damage_from_crits` |
| | Ailment Avoidance | ✅ `defense.{chill,stun,bleed}_avoidance` (honest 0.0 today) |
| **Minion** (hidden if `minion==null`) | Minion Count / Damage Multi / HP Multi / Speed | ✅ `statSheet.minion.{minion_count,minion_damage_multi,minion_hp_multi,minion_speed}` |
| **Other** | Survivability Score / Speed Score | ✅ `scores.survivability_score` / `speed_score` (already) |
| | Increased Healing Effectiveness | ✅ `defense.healing_effectiveness` |
| | Move Speed / Cooldown Recovery / Mana / Health Regen / Life Leech / Ward/sec | — honest `—` (no `StatSheet` field; do not fabricate or add IPC) |

### What already exists (read before editing)
- **`lebo/src/features/stat-sheet/StatSheetPanel.tsx`** — the file you edit. Already has: the 5-tab `TabGroup` with `key={showMinionTab ? 'with-minion' : 'without-minion'}` remount, `showMinionTab = statSheet?.minion != null`, `StatRow` (label/value/unit/warningGap/delta/labelColor), `DeltaBadge`, `computeStatDeltas` (preview deltas), `fmt`/`fmtInt`, the `RESISTANCES` array (6 entries — **add necrotic**), `findWarning`, the loading dot, General/Offense/Defense/Minion(placeholder)/Other panels. **Extend it in place — do not rewrite from scratch.**
- **`lebo/src/shared/types/statSheet.ts`** — the final `StatSheet` shape (read it; every field you need is here, snake_case). Do not edit (it's a type-only mirror, complete after 1.5).
- **`lebo/src/shared/stores/useStatSheet.ts`** — the recompute hook. **Read-only** for this story — confirm it's the recompute path; do not modify.
- **`lebo/src/App.tsx:44`** — `useStatSheet()` is mounted here. Confirm; do not move.
- **`lebo/src/features/layout/RightPanel.tsx:177`** — renders `<StatSheetPanel />` in a `maxHeight: 320px` scroll container. **Do not restyle** the panel chrome (Story 2.4) — but be aware the panel scrolls, so adding many rows is fine.
- **`lebo/src/features/stat-sheet/StatSheetPanel.test.tsx`** — `makeStatSheet()` already has every field. Extend assertions + fixtures.
- **`lebo/src/shared/utils/rarityColors.ts`** — `DAMAGE_TYPE_COLORS` (keyed by `DamageType`). Use for per-type damage rows if you lay them out; never hardcode hex.
- **`lebo/src/assets/styles/global.css:55-61`** — the `--color-dmg-*` block. **No `--color-dmg-necrotic` exists** — add it (Task 1). `--color-data-positive`/`--color-data-negative` (lines 35-36) drive delta badge colors. `--font-mono` (line 82).

### Honest-display rule (the display-layer version of the engine's honest-0.0 discipline)
The engine stories (1.2–1.5) refused to ship inert math keyed to nonexistent sources. The display equivalent: **never render a number the engine didn't produce.** Rows backed by a real field show that field's value — *including* honest `0.0` (e.g. ailment chances, minion count/hp/speed, attribute vitality). Rows with **no** backing field (Move Speed, CDR, Mana, Health Regen, Life Leech, Ward/sec, Idol Cells Used when not derivable) render `—`. The existing `fmt`/`fmtInt` already return `—` for `null`/`undefined` — lean on that. Do **not** add `compute_stats` response fields or new IPC to fill the `—` rows (those stats are genuinely not computed yet; surfacing them honestly is correct).

### Project conventions (from project-context.md — must follow)
- **No barrel files**, **no default exports** — `StatSheetPanel` is a named export; keep it.
- **Rust output types are snake_case** — read `statSheet.ts` fields with their snake_case names (`ehp_vs_hits`, `stun_chance`, `minion_damage_multi`); never camelCase them.
- **Tailwind v4 CSS-first** — no `tailwind.config.js`, **never `@apply`**. Use `var(--color-*)` inline styles (the panel already does). Adding `--color-dmg-necrotic` to `global.css` is the correct token mechanism.
- **Always use `?? 0` / `?? {}` / `?? []`** when reading optional `BuildState` fields (idolGrid, skillRoles, etc.) — they may be undefined on legacy builds.
- **`statSheet.minion` / `statSheet.ailment` are nullable** — gate with `!= null` (the panel's `showMinionTab` already does). `statSheet.attributes` is **always present** (non-nullable) — no gating needed.
- **Accessibility:** every interactive element keeps a 2px accent-gold focus ring (the `TAB_CLASS` already does this). `aria-live="polite"` is on the loading region. New rows are non-interactive `StatRow`s — no new a11y wiring needed, but run the axe sweep.
- **Phase boundary:** only edit inside `LEBOv2/`. Never touch `../_bmad-output/` Phase-1 files or `../lebo/`.

### Testing standards (from project-context.md)
- Vitest config lives in `vite.config.ts` (no separate config). `test-setup.ts` provides `ResizeObserver` + `matchMedia` stubs (required by Headless UI `TabGroup`) — do not duplicate.
- Test files co-locate: extend `StatSheetPanel.test.tsx` (already present), do not create a new test file.
- **a11y via `vitest-axe`:** `expect(await axe(container)).toHaveNoViolations()`. The "all tabs" sweep clicks each tab and re-checks — extend it to cover any new active-tab content.
- **The 14-failure vitest baseline** (`SkillTreeCanvas`/`TreeControls`) is pre-existing and unrelated — add zero new failures. `StatSheetPanel.test.tsx` must be fully green.
- No snapshot tests — explicit `expect` assertions only.

### Previous story intelligence (Story 1.5 — the data you're displaying)
- Story 1.5 is **done** (code review passed; golden count stable at 203). It shipped: `attributes` sub-sheet (Str/Dex/Int/Att sourced; `vitality` 0.0 forward-compat — **not** in addendum F, omit); ailment chances on `OffenseStats` + avoidance on `DefenseStats` (honest `0.0`); `MinionStats` (`minion_damage_multi` sourced; count/hp/speed honest `0.0` — frozen-parity gate); `AilmentStats` populated with sourced durations; `Some`/`None` presence for `minion`/`ailment`.
- Story 1.5 explicitly noted the panel layout (this story) "owns" the conditional Minion-tab hiding — and the `showMinionTab` mechanism is already present from earlier work. You're filling content, not building the gating.
- The honest-`0.0` values you'll display are **intentional** — do not "fix" them by hiding zeros or annotating "not sourced." The values are correct; full minion correctness is a tracked post–Epic-5 story (Story 5.5).

### Git intelligence
Recent commits are auto-save snapshots (`[AutoSave] …`) with no story-specific signal. The authoritative state is the working tree + Story 1.5's Dev Agent Record (above). No migration or dependency change is in flight.

### Project Structure Notes
- Single-file frontend change centered on `lebo/src/features/stat-sheet/StatSheetPanel.tsx` + its co-located test, plus one token line in `lebo/src/assets/styles/global.css`. No store/view/router/hook/IPC change.
- No conflict with the four-store / no-router / props-only-canvas / no-barrel rules — this story touches none of them.
- `RightPanel.tsx` already mounts the panel; no wiring change needed.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6 (L418-434)] — user story + 2 AC blocks (addendum-F five-tab layout + conditional Minion hiding (UX-DR7); live recompute via existing `useStatSheet`, no recalc button (FR-11), <16ms round-trip (NFR-10)).
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 (L259-263, L304-306)] — Epic 1 owns the functional StatSheetPanel five-tab content (addendum F); StatSourceTooltip + chrome are split to 1.7/1.8 + Epic 2.
- [Source: _bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/addendum.md#F (L102-114)] — **the authoritative tab field lists** (General/Offense/Defense/Minion/Other).
- [Source: _bmad-output/planning-artifacts/architecture.md#L449-451] — `StatSheetPanel.tsx` MODIFIED for 5-tab General/Offense/Defense/Minion/Other (addendum F); `StatSourceTooltip.tsx` is NEW for FR-13/14 (NOT this story).
- [Source: _bmad-output/implementation-artifacts/1-5-ailment-attribute-and-minion-stats.md] — the data this story displays: `attributes`, ailment chances/avoidance, `MinionStats`, honest-`0.0` discipline, `Some`/`None` presence, golden-count 203.
- [Source: lebo/src/features/stat-sheet/StatSheetPanel.tsx] — the file to extend in place (existing 5-tab skeleton, `StatRow`, `RESISTANCES`, `showMinionTab`, delta logic).
- [Source: lebo/src/shared/types/statSheet.ts] — the final `StatSheet` shape; every field you lay out is here (snake_case).
- [Source: lebo/src/shared/stores/useStatSheet.ts + App.tsx:44] — the already-mounted live-recompute path satisfying FR-11 (read-only — do not modify).
- [Source: lebo/src/features/layout/RightPanel.tsx:177] — where `<StatSheetPanel />` renders (scroll container, maxHeight 320px; chrome restyle is Story 2.4).
- [Source: lebo/src/features/stat-sheet/StatSheetPanel.test.tsx] — `makeStatSheet()` (all fields present) + existing assertions to preserve and extend.
- [Source: lebo/src/assets/styles/global.css:55-61] — `--color-dmg-*` block; add `--color-dmg-necrotic`.
- [Source: lebo/src/shared/utils/rarityColors.ts] — `DAMAGE_TYPE_COLORS` for per-type damage rows.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-06-03 | Story 1.6 drafted by create-story context engine. Frontend-only: lay out all addendum-F fields across the five StatSheet tabs (Attributes on General; penetration/stun/ailment-chances on Offense; EHP-triple/Stable Ward/Ward Retention/Necrotic Res/Parry/Block/Glancing/Reduced-Crit-Bonus/ailment-avoidance on Defense; real Minion rows; honest `—` for unsourced Other/General rows), add `--color-dmg-necrotic` token, confirm live recompute via existing `useStatSheet` (no recalc button, <16ms NFR-10). Data complete after Story 1.5; no Rust/IPC/store/hook change. Status → ready-for-dev. |
