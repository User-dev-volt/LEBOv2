# Story 1.5: Ailment, attribute, and minion stats

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a theory-crafting player,
I want ailment chances/avoidance, attribute totals, and minion stats computed,
so that the stat sheet covers ailment and minion builds, not just direct-hit builds.

This story fills the three empty scaffolds `compute/ailment.rs`, `compute/attributes.rs`, and `compute/minion.rs` (created as 2-line doc stubs by Story 1.1) to deliver **FR-8** (ailment chances as offense stats + ailment avoidance as defense stats), **FR-9** (Str/Dex/Int/Att/Vit attribute totals + parseable conversions only), and **FR-10** (Minion Count / Damage Multi / HP Multi / Speed, with the Minion sub-sheet conditionally present). It is the **last functional-engine story of Epic 1** before the UI layout (Story 1.6) and source attribution (Stories 1.7–1.8). It is pure `scoring-core` + the loader (`game_data_loader.rs`) + the TS type mirror — **no UI layout work** (Story 1.6 owns the five-tab StatSheet panel and conditional Minion-tab hiding).

**This story's defining challenge is the same trap that bit Stories 1.2/1.3/1.4: most of FR-8/9/10's stats have NO shipped Season-4 data source.** The source audit (Task 1) is the most important task in this story. Read the **Dev Notes → "The audited data reality"** section before writing a single line — it tells you exactly which of these stats are sourced, which are conflated into the wrong stat today, and which must surface honest `0.0` with no dead `StatKey`. Getting this wrong means shipping inert features that "pass" only because they do nothing (Story 1.2's exact failure, which cost a second dev pass + two reviews).

**Hard scope boundary — the frozen `effective_hp` parity gate (read this twice):**
The legacy `defense.effective_hp` field, the `compute_defense` HP math, and `scores.survivability_score` / `scores.build_score` are a **whole-app parity gate** and MUST stay **byte-identical**. The `effective_hp_*` and `build_score_slider_*` regression tests in `compute/mod.rs` must pass unchanged. In particular, see **AC4 and the Open Question for Alec**: today the loader conflates **minion** Health/Armour/Attack-Speed nodes into the **player's** `MaxHp` / `AttackSpeed` (because `MINION` is not checked before `HEALTH`/`ATTACK_SPEED`). De-conflating those onto minion stats would silently change `effective_hp` and the speed score for every real build that uses them. **This story does NOT de-conflate player HP/speed** — minion HP/Speed surface honest `0.0` (with a documented limitation) exactly as Story 1.3 left parry/glancing at `0.0`. The conservative, parity-preserving choice is mandatory here unless Alec explicitly decides otherwise (see Open Question).

## Acceptance Criteria

**AC1 — Ailment chances (offense) and ailment avoidance (defense) computed (FR-8)**
- **Given** a build with ailment-related modifiers,
- **When** `compute_stats` runs,
- **Then** ailment **chance** figures — `bleed_chance`, `ignite_chance`, `poison_chance`, `freeze_chance`, `shock_chance`, `armor_shred_chance` — are surfaced as **offense** stats, and ailment **avoidance** figures — `chill_avoidance`, `stun_avoidance`, `bleed_avoidance` (immunity) — are surfaced as **defense** stats (FR-8).
- **And** each figure is read **only** via `ModifierRegistry` queries by `StatKey` (Pattern P4-1), never from raw `BuildSnapshot` fields.
- **And** the **[ASSUMPTION] honesty rule applies**: per the Task-1 source audit, the shipped Season-4 data has **no numeric ailment-chance or ailment-avoidance source** (no `*_CHANCE` / `AVOIDANCE` / `IMMUNITY` ailment tags carry a parseable %). These figures are therefore **additive struct fields that surface `0.0`** (the exact pattern Story 1.3 used for `parry_chance` / `glancing_blow_chance`) — **add NO dead `StatKey`** for an unsourced ailment chance/avoidance. The math is wired so a real source (most cleanly a gear/idol affix carrying an explicit `stat_key`, per the Story-1.2 dev note) flows in automatically with zero further loader changes once it lands.
- **And** the **already-sourced** ailment duration/stack/freeze keys (`IgniteDuration`, `FreezeRateMultiplier` — sourced via idols today; `PoisonDuration` / `BleedDuration` / `MaxPoisonStacks` exist but are currently unsourced) are surfaced on the `AilmentStats` sub-sheet (see AC-decision in Dev Notes). `StatSheet.ailment` is `Some(..)` only when at least one ailment figure is non-trivial, `None` otherwise (mirrors the Minion conditional-presence rule).

**AC2 — Attribute totals computed and sourced (FR-9)**
- **Given** passive/idol/blessing sources tagged with an attribute,
- **When** `compute_stats` runs,
- **Then** Strength, Dexterity, Intelligence, Attunement, and Vitality **totals** are computed from all registry sources and surfaced on a new `attributes` sub-sheet of `StatSheet` (FR-9).
- **And** because the shipped passive data **does** carry attribute tags (`["STRENGTH"]`, `["DEXTERITY"]`, `["INTELLIGENCE"]`, `["ATTUNEMENT"]`, `["VITALITY"]` — currently **dropped** by `tags_to_stat_key`), this story **adds the five attribute `StatKey` variants and their loader tag branches** — these are **legitimately sourced keys, not dead keys** (proven by the audit). Adding them **changes the golden effect count** (`GOLDEN_EFFECT_COUNT` in `game_data_loader.rs`) — the bump must be **deliberate and documented in-test** exactly as Story 1.2 (179→185) and Story 1.3 (185→198) did. Compute the new expected count from the parser and record the delta with its rationale.
- **And** attribute→secondary-stat **conversion** is applied **only where a parseable ratio exists in game data**; the Task-1 audit shows **no shipped conversion-ratio data**, so this phase ships **totals only** — no conversions — and that limitation is documented (complex per-class conversions are explicitly deferred to Phase 5 per FR-9).
- **And** the new attribute keys feed **only** the attribute totals — they must **not** leak into `damage_score`, `effective_hp`, or any existing aggregate (verified by a parity assertion).

**AC3 — Minion stats computed; Minion sub-sheet conditionally present (FR-10)**
- **Given** a build with at least one minion skill assigned,
- **When** `compute_stats` runs,
- **Then** `MinionStats` is populated with `minion_count`, `minion_damage_multi`, `minion_hp_multi`, and `minion_speed`, and `StatSheet.minion` is `Some(..)`; with **no** minion skill the sub-sheet is `None` (FR-10). The UI tab-hiding is Story 1.6's concern — this story drives it purely via `Some`/`None`.
- **And** `minion_damage_multi` is sourced from `StatKey::IncreasedMinionDamage`, which the loader **already** produces (passive `DAMAGE`+`MINION` tag, the `increased_minion_damage` idol affix, and a blessing) and which is currently **computed nowhere** — so reading it carries **zero** parity risk.
- **And** per the Task-1 audit and the **frozen-parity boundary**: `minion_count` has no shipped source (→ honest `0.0`, no dead key); `minion_hp_multi` and `minion_speed` are currently **conflated into player `MaxHp` / `AttackSpeed`** by the loader and are **left at honest `0.0`** in this story (de-conflation would perturb `effective_hp`/speed — out of scope, see AC4 + Open Question). Document each `0.0` with the reason, matching the Story 1.3/1.4 honesty notes.
- **And** the minion-skill-presence signal is resolved per the Dev Notes decision (no per-skill tag data exists in `GameData` today) and documented.

**AC4 — Frozen parity gate preserved; additive-only extension; TS mirror (NFR-11/NFR-12)**
- **Given** the no-dead-keys + additive-only project rules,
- **When** the new stats are added,
- **Then** `effective_hp`, `raw_hp`, `survivability_score`, `build_score`, `damage_score`, and the speed score stay **byte-identical**; every Phase-3 parity test in `compute/mod.rs` (`effective_hp_*`, `build_score_slider_*`) and the `ehp_reference.rs` integration gate pass unchanged; the loader's `MINION`-before-`HEALTH`/`ATTACK_SPEED` ordering is **NOT** changed (player HP/speed unperturbed).
- **And** `OffenseStats` (ailment chances), `DefenseStats` (ailment avoidance), the new `AttributeStats` and the filled `AilmentStats` / `MinionStats` structs are extended **additively** (every field defaults via `#[derive(Default)]`), the new `StatSheet.attributes` field is added, and all are mirrored **exactly** (snake_case, all `number` / nested object | null) in `lebo/src/shared/types/statSheet.ts`; the `compute_stats` IPC contract gains only additive fields and the Tauri command signature is unchanged.
- **And** the TS strict type-check (`pnpm exec tsc --noEmit`) stays at exit 0 and the existing 14-failure vitest UI baseline is unchanged (no new failures); any `StatSheet` / `OffenseStats` / `DefenseStats` object literal in the TS test suite (e.g. `StatSheetPanel.test.tsx`'s `makeStatSheet()`) is updated to include the new fields/sub-sheets.

## Tasks / Subtasks

- [ ] **Task 1 — Source audit FIRST (disaster-prevention; the Story 1.2/1.3 precedent) (AC: 1, 2, 3)**
  - [ ] Confirm the **frozen parity gate** before touching anything: read `compute/defense.rs` (the `effective_hp` math), `compute/mod.rs` `#[cfg(test)]` (`effective_hp_*`, `build_score_slider_*`), and note the loader's tag-precedence in `tags_to_stat_key` (`DAMAGE`/`MINION` branch at the top; `HEALTH`/`ATTACK_SPEED` below — minion HP/speed nodes fall into the player branches).
  - [ ] Audit shipped data for each FR-8/9/10 stat's real source: grep `resources/game-data/classes/*.json`, `resources/context-data/idol-data.json`, and `resources/context-data/blessings.json` for ailment-chance/avoidance tags, attribute tags, and minion tags. Record, per stat, **sourced / conflated / unsourced** (the audit results are pre-recorded in Dev Notes "The audited data reality" — verify them against the data, do not take them on faith).
  - [ ] Resolve the **minion-skill-presence signal** decision (Dev Notes) and the **`AilmentStats` content** decision (Dev Notes), and record both in the Dev Agent Record.

- [ ] **Task 2 — `compute/attributes.rs`: attribute totals + loader sourcing (AC: 2, 4)** — `attributes.rs`, `modifier.rs`, `game_data_loader.rs`, `stat_sheet.rs`, `lib.rs`
  - [ ] Add `Strength, Dexterity, Intelligence, Attunement, Vitality` to the `StatKey` enum (`modifier.rs`) — these are sourced (audit-proven), not dead keys.
  - [ ] Add the attribute tag branches to `tags_to_stat_key` in `game_data_loader.rs` (e.g. `has("STRENGTH") → StatKey::Strength`, …). Place them where they cannot be shadowed by the `DAMAGE`/`HEALTH` branches (attribute tags ship as standalone single-tag effects, e.g. `["STRENGTH"]`).
  - [ ] Add `AttributeStats { strength, dexterity, intelligence, attunement, vitality: f64 }` to `stat_sheet.rs` (`#[derive(Default, Serialize)]`), re-export from `lib.rs`, and add `attributes: AttributeStats` to `StatSheet` + its `Default`.
  - [ ] Implement `compute_attributes(registry, active) -> AttributeStats` summing each attribute key's modifiers (mirror the offense/defense summation pattern). No conversions this phase (document — no parseable ratio in data).
  - [ ] Update `GOLDEN_EFFECT_COUNT` in `game_data_loader.rs` to the new parser count; document the delta + which attribute nodes drove it (same style as the 179→185→198 history comment).

- [ ] **Task 3 — `compute/ailment.rs`: chances (offense) + avoidance (defense) + sourced durations (AC: 1, 4)** — `ailment.rs`, `stat_sheet.rs`, `offense.rs`, `defense.rs`
  - [ ] Add ailment-chance fields to `OffenseStats` (`bleed_chance`, `ignite_chance`, `poison_chance`, `freeze_chance`, `shock_chance`, `armor_shred_chance`) — additive `f64`, honest `0.0` (no dead `StatKey`), doc-comment each with the "no shipped source; flows in when a `stat_key`-bearing affix lands" note.
  - [ ] Add ailment-avoidance fields to `DefenseStats` (`chill_avoidance`, `stun_avoidance`, `bleed_avoidance`) — same honest-`0.0` treatment.
  - [ ] Implement `compute_ailment(registry, active) -> AilmentStats` populating the **sourced** duration/stack/freeze fields per the Task-1 `AilmentStats` decision (`IgniteDuration`, `FreezeRateMultiplier` are idol-sourced today; `PoisonDuration`/`BleedDuration`/`MaxPoisonStacks` exist but are unsourced → `0.0`). Guard against NaN; `#[derive(Default)]`.
  - [ ] The chance/avoidance fields ride the existing offense/defense compute functions (or a small helper `compute_ailment.rs` exposes) — keep the offense/defense parity untouched (these are net-new fields, default `0.0`).

- [ ] **Task 4 — `compute/minion.rs`: minion stats + conditional presence (AC: 3, 4)** — `minion.rs`, `stat_sheet.rs`
  - [ ] Fill `MinionStats { minion_count, minion_damage_multi, minion_hp_multi, minion_speed: f64 }` in `stat_sheet.rs` (`#[derive(Default, Serialize)]`; already re-exported).
  - [ ] Implement `compute_minion(registry, active) -> MinionStats`: `minion_damage_multi` from `StatKey::IncreasedMinionDamage` (sourced, currently unconsumed → zero parity risk); `minion_count` / `minion_hp_multi` / `minion_speed` = honest `0.0` (audit: unsourced or conflated into player stats — do NOT de-conflate, see Open Question). Doc-comment each `0.0`.
  - [ ] Add a `has_minion_skill(snapshot) -> bool` helper using the Task-1 signal decision; the orchestrator sets `minion: Some(..)` only when true.

- [ ] **Task 5 — Wire into the orchestrator (AC: 1, 2, 3, 4)** — `compute/mod.rs`
  - [ ] After the existing offense/defense/ehp/ward block, call `attributes::compute_attributes`, `ailment::compute_ailment`, `minion::compute_minion`; write `attributes` onto the sheet, set `ailment` to `Some(..)`/`None` and `minion` to `Some(..)`/`None` per the presence rules. Write the ailment chance/avoidance fields onto `offense`/`defense`.
  - [ ] **Do NOT touch** the `scores` block, the `compute_defense` call, or the `ehp`/`ward` wiring. Keep `attributes`/`ailment`/`minion` `mod`s private with `pub(super)` fns.

- [ ] **Task 6 — Unit tests for each module (AC: 1, 2, 3, 4)** — co-located `#[cfg(test)]`
  - [ ] `attributes.rs`: each attribute key sums independently and does not bleed into another attribute or into `damage_score`/`effective_hp`; loader test asserting the new tag branches map correctly (mirror `damage_tag_remap_lands_on_new_keys`).
  - [ ] `ailment.rs`: sourced duration/freeze fields populate from idol keys; chance/avoidance fields are `0.0` with no source; `AilmentStats` Some/None presence rule.
  - [ ] `minion.rs`: `minion_damage_multi` flows from `IncreasedMinionDamage`; count/hp/speed honest `0.0`; `has_minion_skill` true/false → `Some`/`None`.
  - [ ] Orchestrator parity tests: a build with attribute/minion/ailment nodes leaves `effective_hp`, `survivability_score`, `build_score`, `damage_score`, and speed **byte-identical** to the same build without them (pin the numbers).

- [ ] **Task 7 — TS mirror + keep the build green (AC: 4)** — `statSheet.ts`, test literals
  - [ ] Mirror in `statSheet.ts`: new `OffenseStats` ailment-chance fields, new `DefenseStats` ailment-avoidance fields, new `AttributeStats` interface + `StatSheet.attributes`, and the filled `AilmentStats` / `MinionStats` shapes (snake_case, `number`; sub-sheets `… | null` where `Option`). Add the "display-only / Story 1.6 owns layout" comment.
  - [ ] Update every `StatSheet`/`OffenseStats`/`DefenseStats` object literal in the TS suite (notably `StatSheetPanel.test.tsx` `makeStatSheet()`) to include the new fields/sub-sheets.

- [ ] **Task 8 — Verify (AC: all)**
  - [ ] `cargo test -p scoring-core` — all green incl. the unchanged `effective_hp_*` / `build_score_slider_*` parity tests and `ehp_reference.rs`.
  - [ ] `cargo test` (the Tauri crate, for the loader golden-count test) — `shipped_class_json_effect_count_is_stable` passes at the **new** documented count.
  - [ ] `pnpm exec tsc --noEmit` exit 0; `CI=true pnpm exec vitest run` — 14-failure baseline unchanged, no new failures.
  - [ ] Record the source-audit results, the two decisions (minion-presence signal, `AilmentStats` content), the golden-count delta, and every honest-`0.0` field in the Dev Agent Record.

## Dev Notes

### Scope boundary — what this story IS and is NOT
- **IS:** the attribute-total math (`compute/attributes.rs`) + its loader sourcing + 5 new `StatKey` variants; the ailment chance/avoidance honest-`0.0` fields + sourced duration/freeze figures (`compute/ailment.rs`); the minion stats (`compute/minion.rs`) with `minion_damage_multi` actually sourced; the new `AttributeStats` sub-sheet + filled `AilmentStats`/`MinionStats`; orchestrator wiring; the golden-effect-count bump; the TS mirror.
- **IS NOT:** the five-tab StatSheet **layout** and the conditional Minion-tab **hiding** (FR-11/UX-DR7 → **Story 1.6** — this story only drives presence via `Some`/`None`); `ModifierSource`/`track_sources` attribution (Stories 1.7–1.8); right-panel chrome (Story 2.4); **de-conflating minion HP/Speed off player stats** (out of scope — Open Question); **re-pointing any score** (frozen). **Do not touch** `defense.rs`'s `effective_hp` math, `offense.rs`'s aggregate `damage_score`, `penetration.rs`, `ehp.rs`, `ward.rs`, or the `scores` block in `mod.rs`.

### The audited data reality (verify in Task 1 — this is the heart of the story)
Grep of the shipped Season-4 data (`resources/game-data/classes/*.json`, `idol-data.json`, `blessings.json`) and the loader (`game_data_loader.rs::tags_to_stat_key` + `stat_key_from_str`) gives this exact picture:

| FR-8/9/10 stat | Shipped source? | This story's treatment |
|---|---|---|
| **Attributes** Str/Dex/Int/Att/Vit | ✅ **Sourced** — standalone tags `["STRENGTH"]`, `["DEXTERITY"]`, `["INTELLIGENCE"]`, `["ATTUNEMENT"]`, `["VITALITY"]` exist in passive data but `tags_to_stat_key` has **no branch** → currently **dropped**. | Add 5 `StatKey`s + loader branches → real totals. **Bumps `GOLDEN_EFFECT_COUNT`.** |
| Attribute → secondary conversion | ❌ no ratio data shipped | Totals only; no conversion (FR-9 defers complex conversions to Phase 5). |
| **Minion Damage Multi** | ✅ **Sourced** — `IncreasedMinionDamage` from passive `DAMAGE`+`MINION`, idol `increased_minion_damage`, a blessing. **Currently consumed nowhere.** | Read it into `minion_damage_multi` (zero parity risk). |
| **Minion HP Multi** | ⚠️ **Conflated** — `["HEALTH",…,"MINION"]` nodes hit the `HEALTH` branch → **player `MaxHp`** (the `DAMAGE`/`MINION` short-circuit only covers minion *damage*). | Honest `0.0` + documented. **Do NOT de-conflate** (perturbs `effective_hp`). Open Question. |
| **Minion Speed** | ⚠️ **Conflated** — `["MINION","DAMAGE","ATTACK_SPEED"]` / minion attack-speed prose → player `AttackSpeed`. | Honest `0.0` + documented. Do NOT de-conflate (perturbs speed score). Open Question. |
| **Minion Count** | ❌ no shipped `+N minion` source found | Honest `0.0`, no dead key. |
| **Ailment chances** Bleed/Ignite/Poison/Freeze/Shock/Armor-Shred | ❌ no numeric `*_CHANCE` ailment source (the word "ailment" appears only in node IDs / "Void ailments" prose) | Additive `OffenseStats` fields, honest `0.0`, **no dead `StatKey`** (exactly like `parry_chance` in 1.3). Flows in when a `stat_key`-bearing affix lands. |
| **Ailment avoidance** Chill/Stun/Bleed immunity | ❌ no source | Additive `DefenseStats` fields, honest `0.0`, no dead key. |
| Ailment **durations / stacks / freeze** (`IgniteDuration`, `FreezeRateMultiplier`, `PoisonDuration`, `BleedDuration`, `MaxPoisonStacks`) | ◐ partial — `ignite_duration` + `freeze_rate_multiplier` idol affixes are sourced; the other three exist but are unsourced today | Surface the sourced ones on `AilmentStats`; the rest `0.0`. |

**The rule (from Stories 1.2/1.3/1.4):** a new struct *field* defaulting to `0.0` is fine and honest; a new `StatKey` *variant* is allowed **only** when a loader path produces it. So: **add `StatKey`s for the 5 attributes** (sourced) but **add NO `StatKey`** for ailment chance/avoidance or minion count/hp/speed (unsourced/conflated) — those are struct fields only.

### Decision 1 — minion-skill-presence signal (resolve in Task 1)
`GameData` carries **no per-skill tag/metadata** (the loader ingests skill *tree nodes*, not skill definitions), so "≥1 minion skill assigned" cannot be read directly. Available signals in `BuildSnapshot`: `primary_offense_delivery_type: Option<String>` (can be `"minion"`, but only describes the **primary** skill), `skill_roles`, `active_skill_levels` (slot→level, no type). **Recommended:** set `minion: Some(..)` when `primary_offense_delivery_type == Some("minion")` **OR** any `IncreasedMinion*` modifier is present in the registry; document that non-primary minion skills without a minion modifier won't trigger the tab until skill metadata is loaded (a Story-1.6 / Epic-5 concern). This is honest and uses only what exists. Record the choice.

### Decision 2 — what goes in the `AilmentStats` sub-sheet (resolve in Task 1)
FR-8's **chances** go on `OffenseStats` and **avoidance** on `DefenseStats` (per the epic AC and addendum F: "Offense → Ailment Chances", "Defense → Ailment Avoidance"). That leaves the pre-existing `ailment: Option<AilmentStats>` placeholder. **Recommended:** populate `AilmentStats` with the **sourced** duration/stack/freeze figures (`ignite_duration`, `freeze_rate_multiplier`, and the `0.0` `poison_duration`/`bleed_duration`/`max_poison_stacks`) so the placeholder gets real use, and set `Some(..)` only when at least one is non-zero (else `None`). Alternative: keep `AilmentStats` empty and `ailment: None` this story. Pick one, document it; the addendum-F layout (Story 1.6) will consume whatever shape you land.

### What already exists (read before editing)
- `compute/ailment.rs`, `compute/attributes.rs`, `compute/minion.rs` — **2-line doc-comment scaffolds only**. You are filling them from empty. `compute/mod.rs:12-14` already declares `mod ailment; mod attributes; mod minion;`.
- `compute/mod.rs:16-70` — orchestrator. `ailment: None` and `minion: None` are hard-coded in the returned `StatSheet` (lines 66-67); replace with the computed presence. Insert the three new calls after the ehp/ward block (line 49), **before** the `scores` block (line 53) — and do not touch `scores`.
- `stat_sheet.rs:179-185` — `AilmentStats {}` and `MinionStats {}` empty placeholders (both `#[derive(Default, Serialize)]`, both re-exported in `lib.rs:25-28`). `StatSheet` (lines 189-199) + its manual `Default` (201-212) need the new `attributes` field.
- `modifier.rs:6-91` — `StatKey` enum. Ailment placeholders already present: `IgniteDuration, PoisonDuration, BleedDuration, FreezeRateMultiplier, MaxPoisonStacks`. Minion: `IncreasedMinionCount, IncreasedMinionHp` exist **but have no loader path** (dead today — do not rely on them being populated; `IncreasedMinionDamage` is the only sourced minion key). **No attribute keys exist** — you add them.
- `game_data_loader.rs:275-390` — `tags_to_stat_key` (add attribute branches). `:504-542` — `stat_key_from_str` (idol/blessing JSON keys; `ignite_duration`/`freeze_rate_multiplier` already mapped). `:590-613` — `shipped_class_json_effect_count_is_stable` with `GOLDEN_EFFECT_COUNT = 198` and the full bump-history comment (extend it).
- `compute/offense.rs` and `compute/defense.rs` — the summation pattern to mirror (`registry.query(&key, active).iter().filter(...).map(|m| m.value).sum()`). Note offense's `DAMAGE_STAT_KEYS` does **not** include `IncreasedMinionDamage`, so minion damage is genuinely unconsumed today — confirming it's safe to read.
- `lib.rs:13-29` — public re-exports; add `AttributeStats` to the `stat_sheet::{…}` re-export so the TS-facing contract and any tests can name it.

### The Story 1.2/1.3/1.4 lessons you MUST apply
- **Computed-but-unsourced trap (1.2):** never ship math keyed to a `StatKey` no loader produces — it silently does nothing and "passes" only because it's inert. Here that means: prove the attribute tags are real (they are) before adding their keys, and refuse to add keys for the unsourced ailment/minion stats.
- **Source audit honesty (1.3):** idol/affix/blessing data is largely empty; the passive-tag path is the main production source. Surface unsourced stats as `0.0` with **no dead key** and document the limitation (the PRD already flags FR-7/FR-8/FR-9 inputs as `[ASSUMPTION]`).
- **Frozen-aggregate discipline (1.4):** additive display fields only; never re-point or perturb `effective_hp`/`survivability_score`/`build_score`/`damage_score`. The minion HP/speed conflation is the trap — leaving it is the *correct* parity-preserving choice this story.
- **Golden-count discipline (1.2/1.3):** any change to the loader's stat-key mapping that changes how many effects parse **must** update `GOLDEN_EFFECT_COUNT` deliberately, with an in-test comment explaining the delta. Adding attribute sourcing **will** raise it.

### Project conventions (from project-context.md — must follow)
- `scoring-core` is a **pure crate**: no Tauri, no I/O; snake_case serde output mirrored to TS, never camelCased on the TS side.
- Stat math reads the **Modifier Registry only** (Pattern P4-1).
- **No dead keys:** a `StatKey` must be both produced by the loader AND consumed.
- Commands: `cargo` from `lebo/src-tauri/`, `pnpm` from `lebo/` (never npm/yarn). If `cargo test -p scoring-core` fails on an unrelated `tauri` build-script `OUT_DIR` path error, `cargo clean -p tauri` (scoring-core tests are independent of the Tauri crate). The loader golden-count test lives in the **Tauri crate** (`game_data_loader.rs`), so run `cargo test` from `lebo/src-tauri/` for that one.
- Phase boundary: only edit inside `LEBOv2/`. Never touch `../_bmad-output/` Phase-1 files or `../lebo/`.

### Testing standards (from project-context.md)
- Per-module pure-function unit tests co-locate in each `compute/*.rs` `#[cfg(test)]`. Orchestrator round-trip + parity assertions live in `compute/mod.rs` `#[cfg(test)]`. Loader-mapping + golden-count tests live in `game_data_loader.rs` `#[cfg(test)]`.
- The `effective_hp_*` / `build_score_slider_*` tests and `ehp_reference.rs` are the **parity gate** — expected numbers must not change. A green run after your change is the proof you didn't perturb scoring.
- `statSheet.ts` is a type-only mirror; the 14 known pre-existing UI failures are the baseline — add none.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5] — user story + 3 AC blocks (FR-8 ailment chances/avoidance, FR-9 attributes + parseable conversions, FR-10 minion stats + conditional tab) and the **Story-1.2 stun-chance dev note** (stun chance already on offense but unsourced; a `stat_key`-bearing affix is the cleanest source; FR-2 offense-chance vs FR-8 defense-immunity coexist).
- [Source: _bmad-output/planning-artifacts/epics.md#L48-50] — FR-8/9/10 text incl. the `[ASSUMPTION]` flags on attribute conversion.
- [Source: _bmad-output/planning-artifacts/prds/prd-LEBOv2-2026-05-29/addendum.md#L104-112] — addendum F tab field lists: General → Attributes (Str/Dex/Int/Att); Offense → Ailment Chances (Bleed/Ignite/Poison/Freeze/Shock); Defense → Ailment Avoidance; Minion → Count/Damage Multi/HP Multi/Speed.
- [Source: _bmad-output/planning-artifacts/architecture.md#L135-139, L503-508] — `ailment.rs`/`attributes.rs`/`minion.rs` submodule responsibilities; `stat_sheet.rs` EXTENDED (`AilmentStats`/`MinionStats` filled in); `statSheet.ts` EXTENDED.
- [Source: _bmad-output/planning-artifacts/architecture.md#L66, L355] — registry-is-load-bearing; the "adding an ailment = add a StatKey + ModifierType, registry absorbs it" design intent; the warning against reading `snapshot.gear[...]` directly (Pattern P4-1).
- [Source: _bmad-output/implementation-artifacts/1-4-ehp-triple-and-stable-ward-hp-equilibrium.md#Dev Agent Record] — the additive-display-field pattern, the frozen-`effective_hp` discipline, the honest-`0.0` no-dead-key precedent, and the pnpm/Tauri-OUT_DIR env notes.
- [Source: _bmad-output/implementation-artifacts/1-3-defensive-layer-computation.md] — the `parry_chance`/`glancing_blow_chance` honest-`0.0`-no-key precedent and the Necrotic-split (count-neutral remap) example for the attribute golden-count bump.
- [Source: lebo/src-tauri/scoring-core/src/compute/ailment.rs] — empty scaffold to implement (FR-8).
- [Source: lebo/src-tauri/scoring-core/src/compute/attributes.rs] — empty scaffold to implement (FR-9).
- [Source: lebo/src-tauri/scoring-core/src/compute/minion.rs] — empty scaffold to implement (FR-10).
- [Source: lebo/src-tauri/scoring-core/src/compute/mod.rs:16-70] — orchestrator; insert calls after the ehp/ward block (line 49), replace `ailment: None`/`minion: None`, **do not touch `scores` (53-60) or the defense/ehp/ward wiring**.
- [Source: lebo/src-tauri/scoring-core/src/compute/offense.rs] — summation pattern; `DAMAGE_STAT_KEYS` excludes `IncreasedMinionDamage` (proves minion damage is unconsumed today).
- [Source: lebo/src-tauri/scoring-core/src/stat_sheet.rs:179-212] — `AilmentStats`/`MinionStats` placeholders + `StatSheet`/`Default` to extend with `attributes`.
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs:6-91] — `StatKey` enum (add 5 attribute keys; ailment/minion placeholder keys noted).
- [Source: lebo/src-tauri/scoring-core/src/lib.rs:13-29] — re-exports; add `AttributeStats`.
- [Source: lebo/src-tauri/src/services/game_data_loader.rs:275-390] — `tags_to_stat_key` (add attribute branches; note `MINION`/`DAMAGE` precedence above `HEALTH`/`ATTACK_SPEED`).
- [Source: lebo/src-tauri/src/services/game_data_loader.rs:590-613] — `GOLDEN_EFFECT_COUNT = 198` + bump-history comment to extend.
- [Source: lebo/src/shared/types/statSheet.ts] — TS mirror to extend (`OffenseStats`, `DefenseStats`, new `AttributeStats`, `AilmentStats`, `MinionStats`, `StatSheet.attributes`).
- [Source: lebo/src/features/stat-sheet/StatSheetPanel.test.tsx] — `makeStatSheet()` literal to update.

### Project Structure Notes
- Rust changes: `scoring-core` (`modifier.rs` +5 keys, `stat_sheet.rs` new/extended structs, `compute/{ailment,attributes,minion}.rs` filled, `compute/mod.rs` wiring, `lib.rs` re-export) **and** the Tauri crate `game_data_loader.rs` (attribute tag branches + golden-count bump). The loader edit is the one cross-crate touch — it is the *only* way attribute totals get a real source, and it is in scope per FR-9 + architecture L135-139.
- TS change is type-only (`statSheet.ts`) plus updating test literals. No store/view/router/IPC-signature change — `compute_stats` gains only additive response fields.
- No conflict with the four-store / no-router / props-only-canvas rules — this story touches none of them.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-06-03 | Story 1.5 drafted by create-story context engine: FR-8 ailment chances (offense, honest-0.0) + avoidance (defense, honest-0.0) + sourced durations; FR-9 attribute totals with 5 new sourced `StatKey`s + loader branches + golden-count bump; FR-10 minion stats (`minion_damage_multi` sourced, count/hp/speed honest-0.0 to preserve player-HP/speed parity). Additive-only; frozen `effective_hp`/score gate preserved. Status → ready-for-dev. |

---

## Open Question for Alec (non-blocking — does not gate dev)

**De-conflating minion HP / Speed from player stats.** Today the loader routes minion Health/Armour/Attack-Speed nodes (e.g. `["HEALTH","ARMOUR","MINION"]`, `+5% Companion Damage … +3% Attack Speed`) into the **player's** `MaxHp` / `AttackSpeed`, because the `MINION` short-circuit only covers minion *damage*. This story therefore surfaces `minion_hp_multi` and `minion_speed` as honest `0.0` and leaves player HP/speed **byte-identical** (the safe, parity-preserving choice, matching how Story 1.4 refused to re-point `survivability_score`). Making minion HP/Speed *correct* means adding `MINION`+`HEALTH` / `MINION`+`ATTACK_SPEED` branches **above** the player branches in `tags_to_stat_key` — which would **remove those nodes from every real build's player `effective_hp` and speed score**, re-baselining scores across the app (optimizer, gear scoring, saved builds) and requiring a deliberate golden-count + parity-gate review. That belongs in its own re-baselining story, not here. Flagging so it's a conscious decision, not an oversight — no action needed before dev-story.
