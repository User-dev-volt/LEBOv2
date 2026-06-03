# Story 1.4: EHP triple and Stable Ward/HP equilibrium

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a theory-crafting player,
I want EHP reported as vs Hits / vs DoTs / vs 1-shots plus Stable Ward and Stable HP,
so that my survivability numbers match the community tunklab calculators I trust.

This story fills the two empty scaffolds `compute/ehp.rs` and `compute/ward.rs` (created by Story 1.1, currently 2-line doc stubs) to deliver **FR-6** (EHP as three independent values) and **FR-7** (Stable Ward + Stable HP at equilibrium), and stands up the **`scoring-core/tests/ehp_reference.rs`** integration-test harness that is the **NFR-1 / SM-1 ±2%-tunklab CI parity gate**. It is pure `scoring-core` + the `DefenseStats` type mirror — **no UI layout work** (Story 1.6 owns the five-tab StatSheet display; Story 2.4 owns right-panel chrome).

**Hard scope boundary — the frozen `effective_hp` parity gate (read this twice):**
The legacy `defense.effective_hp` field, the `1.05^(n-2)` multi-layer bonus in `compute_defense`, and `scores.survivability_score`/`scores.build_score` are a **whole-app parity gate** and MUST stay **byte-identical**. `effective_hp` is the *scoring aggregate* that feeds `survivability_score → build_score`, which in turn drives the optimizer (Epic 3), gear scoring (Epic 4), and every saved build's displayed score. The new tunklab-aligned EHP values delivered here are **additive, display-only `DefenseStats` fields** (`ehp_vs_hits`, `ehp_vs_dots`, `ehp_vs_one_shots`, `stable_ward`, `stable_hp`). **Do NOT re-point `survivability_score` at the new EHP** — that is an explicit out-of-scope decision (would re-baseline build scores across the whole app and break the `build_score_slider_*` + `effective_hp_*` regression gate). This mirrors exactly how Story 1.3 treated `effective_hp`. See the **Open Question for Alec** at the end.

## Acceptance Criteria

**AC1 — EHP triple computed as three independent values (FR-6)**
- **Given** a build with mitigation layers,
- **When** EHP is computed in the new `compute/ehp.rs`,
- **Then** three independent values are produced and surfaced on `DefenseStats` — `ehp_vs_hits`, `ehp_vs_dots`, `ehp_vs_one_shots` — with the mitigation layers applied **multiplicatively** (armor DR × resistance DR × endurance DR × avoidance), per the tunklab-aligned methodology in `architecture.md` ADR-P4-001:
  - **vs Hits:** all layers — armor mitigation, the relevant resistance, endurance%, and the hit-only avoidance layers (dodge / parry / block / glancing) applied as average damage-reduction.
  - **vs DoTs:** **excludes** dodge / parry / block / glancing **and armor** (in LE, armor and the avoidance layers reduce hits only, never DoTs); resistance and endurance still apply.
  - **vs 1-shots:** a single un-averaged maximum hit — the **endurance threshold is a hard floor** (endurance% only mitigates the portion of the hit above the threshold), and the dodge/avoidance layers are **not** averaged in (you cannot rely on a dodge roll to survive a one-shot).
- **And** every input value is read **only** via the already-computed `DefenseStats` (themselves registry-sourced) or via `ModifierRegistry` queries by `StatKey` — never from raw `BuildSnapshot` fields (Pattern P4-1).
- **And** `effective_hp`, `raw_hp`, and the `1.05^(n-2)` layer bonus in `compute_defense` stay **byte-identical**; `scores.survivability_score` and `scores.build_score` are unchanged; every Phase-3 parity test in `compute/mod.rs` (`effective_hp_with_ward_and_endurance`, `effective_hp_no_ward_no_endurance`, all `build_score_slider_*`) passes unchanged.

**AC2 — Stable Ward and Stable HP at equilibrium computed (FR-7)**
- **Given** a build using Ward as a buffer,
- **When** Stable Ward is computed in the new `compute/ward.rs`,
- **Then** it derives the **equilibrium ward** where ward generation equals ward decay, using Ward/sec generation, Ward Retention, Ward Decay Threshold, Health Regen, %Current Health Lost/sec, and %Missing Health→Ward/sec, and both `stable_ward` and `stable_hp` (HP at equilibrium) are surfaced on `DefenseStats` (FR-7).
- **And** the LE ward-decay model is implemented as documented (tunklab/Maxroll observable behavior, cited in-comment); the equilibrium solve handles the degenerate input case (zero generation → `stable_ward == 0`, no NaN/Inf) gracefully.
- **And** the **[ASSUMPTION] honesty rule** is honored: `ward_retention`, `ward_decay_threshold`, and the `%Current-Health-Lost/sec` / `%Missing-Health→Ward/sec` inputs have **no shipped Season-4 source** per the Story 1.3 audit. Compute correctly from whatever the registry/`DefenseStats` provides, but **add NO dead `StatKey`** for an unsourced input — reuse the existing zero-no-key `ward_retention`/`ward_decay_threshold` fields (currently always `0.0`) and document that production Stable Ward is generation-driven until a real source lands (see Dev Notes "Story-1.2 lesson").

**AC3 — `tests/ehp_reference.rs` tunklab parity gate stands up and gates CI (NFR-1 / SM-1)**
- **Given** the new integration test file `scoring-core/tests/ehp_reference.rs`,
- **When** `cargo test -p scoring-core` runs,
- **Then** it constructs **≥3 reference builds** via the public crate API (`scoring_core::{compute_stats, GameData, BuildSnapshot, ComputeOptions, …}`), each with **recorded tunklab EHP/Ward outputs as literal expected values**, and asserts every computed `ehp_vs_*` / `stable_ward` / `stable_hp` agrees within **±2%** of the recorded tunklab figure; a drift beyond ±2% **fails CI** (NFR-1).
- **And** each reference fixture documents, in-file, the exact tunklab input build and the source/date of the recorded output, so the gate is auditable and reproducible.
- **And** the file lives at `scoring-core/tests/ehp_reference.rs` (Cargo auto-discovers `tests/*.rs` as an integration crate — no `Cargo.toml [[test]]` entry required; verify it is picked up).

**AC4 — Additive type extension; no parity perturbation; TS mirror**
- **Given** the no-dead-keys + additive-only project rules,
- **When** `DefenseStats` gains the five new fields,
- **Then** they are appended to `DefenseStats` (Rust) with `#[derive(Default)]` preserved (every field defaults to `0.0`), and mirrored **exactly** (snake_case, all `number`) in `lebo/src/shared/types/statSheet.ts`; no field is renamed; the `compute_stats` IPC contract and Tauri command signature are unchanged.
- **And** the TS strict type-check (`tsc`) stays at exit 0 and the existing 14-failure vitest UI baseline is unchanged (no new failures); any `DefenseStats` object literal in the TS test suite is updated to include the new fields.

## Tasks / Subtasks

- [x] **Task 1 — Confirm the parity gate before touching anything (AC: 1)** — *disaster-prevention step; the Story-1.2/1.3 precedent.*
  - [x] Read `compute/defense.rs:79-213` (the `effective_hp` / ward-ratio / endurance / `1.05^(n-2)` block) and `compute/mod.rs:491-569` (the `effective_hp_*` + `build_score_slider_*` parity tests). Note the exact expected numbers.
  - [x] Confirm the plan: **leave `compute_defense`'s `effective_hp` math and `compute_stats`'s `scores` block untouched.** EHP/Ward additions are new functions in `ehp.rs`/`ward.rs` that the orchestrator calls *after* `compute_defense`, writing only the five new fields.

- [x] **Task 2 — Extend `DefenseStats` (additive only) (AC: 1, 2, 4)** — `stat_sheet.rs`
  - [x] Append `ehp_vs_hits`, `ehp_vs_dots`, `ehp_vs_one_shots`, `stable_ward`, `stable_hp` (all `f64`) to `DefenseStats` after the Story-1.3 layer fields. Keep all 26 existing fields; `#[derive(Default)]` preserved; doc-comment each new field with its FR + the "display-only, does not feed `effective_hp`" note.

- [x] **Task 3 — Implement `compute/ehp.rs` (AC: 1)**
  - [x] Added `compute_ehp(defense: &DefenseStats) -> EhpTriple` (signature simplified — all mitigation inputs already live on the registry-sourced `DefenseStats`, so no `registry`/`active` params are needed, which also avoids unused-param warnings; AC1's "read only via DefenseStats or registry" is satisfied). Reads `armor_mitigation_percent`, the 7 resistances, `endurance_percent`, `endurance_threshold`, `dodge_chance`, `parry_chance`, `block_chance`, `block_effectiveness`, `glancing_blow_chance`, `raw_hp`, `ward`.
  - [x] Layers applied **multiplicatively** per AC1. Methodology + per-layer hit/DoT/1-shot applicability documented in-comment (cites Maxroll *Defenses Explained*). Generic-resistance choice = **average of the 7 capped resistances**, recorded as the assumption.
  - [x] All divisions guarded: each DR layer clamped to its cap; `MIN_DAMAGE_TAKEN = 0.01` floors the damage-taken fraction (caps EHP at 100× pool) so 100% dodge etc. never returns Inf/NaN; final `finite_or_zero` guard.

- [x] **Task 4 — Implement `compute/ward.rs` (AC: 2)**
  - [x] Added `compute_ward(defense: &DefenseStats) -> WardEquilibrium { stable_ward, stable_hp }` (same signature simplification as ehp.rs).
  - [x] LE ward decay → equilibrium solve (`stable_ward = decay_threshold + generation / effective_decay_rate`, `effective_decay_rate = 0.40 / (1 + retention)`), documented in-comment with Maxroll/lastepochtools source. Uses `ward` (gen proxy), `ward_retention`, `ward_decay_threshold`, `raw_hp`. Degenerate inputs (zero gen, negative retention) → `0.0`, never NaN/Inf.
  - [x] **No new `StatKey`** — retention/decay-threshold/health-conversion inputs reuse the existing zero-no-key fields; in-comment "no shipped source yet — generation-driven in production" note added (AC2 honesty rule).

- [x] **Task 5 — Wire into the orchestrator (AC: 1, 2, 4)** — `compute/mod.rs`
  - [x] After `let mut defense = defense::compute_defense(...)`, calls `ehp::compute_ehp(&defense)` and `ward::compute_ward(&defense)`, then writes the five results onto `defense`. The `scores` block (`survivability_score = defense.effective_hp`) is unchanged.
  - [x] `ehp`/`ward` stay private `mod`s; functions are `pub(super)` — orchestrator is the only caller. (Note: `compute_defense`'s explicit struct literal also initializes the 5 new fields to `0.0` so the lib compiles — its own math is unchanged.)

- [x] **Task 6 — Stand up `tests/ehp_reference.rs` parity gate (AC: 3)**
  - [x] Created `scoring-core/tests/ehp_reference.rs`. 3 reference builds + 1 legacy-parity guard, all via the public API; inputs + hand-computed arithmetic recorded as in-file literals with source/date; ±2% asserted on each `ehp_vs_*` / `stable_ward` / `stable_hp`.
  - [x] Three EHP variants covered distinctly: A (armor+resistance hit-tank, hits≠dots), B (ward + endurance threshold one-shot + ward equilibrium), C (dodge — hits-only avoidance, hits>one-shots).
  - [x] Cargo auto-discovers the integration test (`cargo test -p scoring-core --test ehp_reference` → 4 passed). **Reference-figure note:** live tunklab is JS-gated/unreachable from this headless env (Story-1.3 lastepochtools 403 precedent), so per the story's documented fallback the literals come from the **closed-form LE reference** (Maxroll *Defenses Explained*); source/date recorded in-file. Swap to live tunklab numbers when capturable.

- [x] **Task 7 — TS mirror + keep the build green (AC: 4)** — `statSheet.ts`, test literals
  - [x] Mirrored the five new fields in `statSheet.ts` `DefenseStats` (snake_case, `number`) with the "display-only" comment.
  - [x] Updated the `DefenseStats` literal in `StatSheetPanel.test.tsx`'s `makeStatSheet()` with the five fields. No `RESISTANCES`/UI-layout change (Story 1.6).

- [x] **Task 8 — Verify (AC: all)**
  - [x] `cargo test -p scoring-core` — all green: 109 lib (12 new ehp/ward unit tests) + 4 `ehp_reference` integration; Phase-3 `effective_hp_*` + `build_score_slider_*` parity byte-identical.
  - [x] TS strict compile (`pnpm exec tsc --noEmit`) exit 0; `vitest run` — 14 failed / 1026 passed = the documented 14-failure baseline (all pre-existing AppHeader/RightPanel/ProviderSelector/Settings/SkillTree UI; StatSheetPanel 15/15 pass). No new failures.
  - [x] Tunklab reference inputs/outputs, the average-resistance assumption, and the ward-equilibrium formula source recorded in the Dev Agent Record + `ehp_reference.rs`.

### Review Findings

_Code review 2026-06-03 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 4 ACs satisfied; frozen `effective_hp`/`survivability_score`/`build_score` parity gate verified byte-identical and green under test. No Critical/High findings._

- [ ] [Review][Patch] Scope the `MIN_DAMAGE_TAKEN` doc-comment so it no longer claims a universal 100× pool cap [`ehp.rs`] — _resolved from decision (Alec, 2026-06-03, option b): `vs_one_shots` is intentionally left uncapped (genuinely accurate for high-endurance-threshold builds); only the comment's 100×-cap claim needs correcting, since hits/dots cap at 100× pool but one-shots can reach ~1000× pool at clamp extremes._
- [ ] [Review][Patch] Ward module doc describes amount-dependent decay then models a flat constant rate [`ward.rs:1-21`] — opening lines say ward "is lost at a rate that rises with the current ward amount," then `BASE_WARD_DECAY_RATE` is a flat 0.40; the closed form is disclosed on lines 6-8 but the lead sentence reads as a contradiction. Tighten wording to flag the constant-rate form explicitly as the modelled approximation.
- [x] [Review][Defer] AC3 reference figures are closed-form (Maxroll), not live tunklab captures [`ehp_reference.rs`] — deferred, story-sanctioned fallback; ±2% gate currently proves internal regression-drift, not independent tunklab parity. Swap to live tunklab captures when capturable.
- [x] [Review][Defer] `ehp_reference.rs` fixtures depend on the unseen `compute_defense` armor formula (Armor 1104→50%) [`ehp_reference.rs`] — deferred, test-coupling note; a change to armor K would break EHP-layer tests for an unrelated reason.
- [x] [Review][Defer] Cap constants (`ARMOR_DR_CAP`/`RESISTANCE_CAP`/`ENDURANCE_DR_CAP`) re-declared in `ehp.rs` rather than shared with `defense.rs` [`ehp.rs`] — deferred, story scoped the modules standalone; silent desync risk if `defense.rs` caps ever change.
- [x] [Review][Defer] `stable_ward` has no upper sanity bound below Inf [`ward.rs:45-52`] — deferred, latent/unreachable today (production retention = 0.0); large finite retention from a future source would yield unrealistic values.

## Dev Notes

### Scope boundary — what this story IS and is NOT
- **IS:** the EHP-triple math (`compute/ehp.rs`), the Stable Ward / Stable HP equilibrium math (`compute/ward.rs`), the five additive `DefenseStats` fields + TS mirror, the orchestrator wiring, and the new `tests/ehp_reference.rs` ±2% CI parity gate.
- **IS NOT:** changing `effective_hp` / `survivability_score` / `build_score` (frozen parity gate); ailment/attribute/minion stats (FR-8/9/10 → **Story 1.5**, `ailment.rs`/`attributes.rs`/`minion.rs`); the five-tab StatSheet *layout* and the EHP/Ward display rows (FR-11/UX-DR7 → **Story 1.6**); right-panel chrome (Story 2.4); source attribution `track_sources` (Story 1.7). **Do not touch `defense.rs`'s `effective_hp`/layer-bonus math, `offense.rs`, `penetration.rs`, `ailment.rs`, `attributes.rs`, or `minion.rs`.**

### The frozen `effective_hp` parity gate — why it must not move
`compute_stats` (`compute/mod.rs:41-48`) sets `survivability_score = defense.effective_hp` and `build_score = w_dmg·D + w_surv·effective_hp + w_speed·Sp`. That `effective_hp` is the crude Phase-3 heuristic (ward ratio + endurance + `1.05^(n-2)` multi-layer bonus) in `compute_defense` (`defense.rs:79-213`). Changing it would silently re-score **every saved build, every optimizer suggestion (Epic 3), and every gear ranking (Epic 4)** and break the `build_score_slider_*` + `effective_hp_*` regression tests (NFR-12: "formula regression tests fail CI on drift"). So the three new tunklab EHP values are **display-only additive fields**; `survivability_score` keeps using the legacy aggregate. This is the identical treatment Story 1.3 applied (it added `armor_mitigation_percent` as a display value that "does NOT feed `effective_hp`"). Re-pointing the score is a deliberate future decision, not this story's call (see Open Question).

### The Story-1.2/1.3 lesson you MUST apply (computed-but-unsourced trap)
Story 1.2 shipped penetration math keyed to a `StatKey` **no loader path produced** — it silently did nothing, parity tests passed *because the feature was inert*, and it cost a second dev pass + two reviews. Story 1.3's audit then proved that **idol/affix/blessing data is not shipped** (built empty) — the **only** real production source is the passive-tag path — and found **no shipped source** for `ward_retention`, `ward_decay_threshold`, parry, glancing, etc. (they surface `0.0`). For FR-7 this means: implement the Stable Ward equilibrium **correctly and test it with explicit fixture inputs**, but understand that in production several FR-7 inputs (retention, decay threshold, %current-health-lost/sec, %missing-health→ward/sec) are **currently zero** — so production Stable Ward is generation-driven. **Do not add a dead `StatKey`** to "fix" this; reuse the existing zero-no-key fields and document the limitation (the PRD already flags FR-7's last two inputs as `[ASSUMPTION: parseable in Season 4 data]`).

### What already exists (read before editing)
- `compute/ehp.rs` and `compute/ward.rs` — **2-line doc-comment scaffolds only** (`//! … Scaffold — implemented in Story 1.4.`). You are filling them from empty.
- `compute/mod.rs:7-14` already declares `mod ehp;` and `mod ward;`. The orchestrator (`compute_stats`, lines 16-58) computes `offense → penetration → defense → speed → scores → warnings`. Insert the EHP/Ward calls right after `compute_defense` (line 38).
- `compute/defense.rs` (Story 1.3, 316 lines) computes every input you need on `DefenseStats`: `raw_hp`, `ward`, `endurance_percent`, `endurance_threshold`, `armor`, `armor_mitigation_percent` (derived, capped 85%), all 7 resistances, `dodge_chance`, plus the zero-valued `parry_chance`/`block_chance`/`block_effectiveness`/`glancing_blow_chance`/`ward_retention`/`ward_decay_threshold`. Consume these — do not re-query what `compute_defense` already summed.
- `stat_sheet.rs:48-90` — `DefenseStats` (26 fields, `#[derive(Default)]`). Append the 5 new fields here.
- `lib.rs:15,25-28` — `compute_stats`, `GameData`, `BuildSnapshot`, `ComputeOptions`, `DefenseStats`, `StatSheet`, `StatWarning` are all `pub use`-re-exported → directly usable from `tests/ehp_reference.rs`. `NodeEffect`, `BaseClassStats`, `ArchetypeWeights{,Entry}` are re-exported too; `game_data::IdolAffixEffect` is reachable via the `pub mod game_data` path.

### LE survivability formulas (cite in code comments; same sources Story 1.3 used)
- **Multiplicative layering:** total mitigation = `armor_DR × resistance_DR × endurance_DR × avoidance_factor`; EHP = `pool / (1 − total_mitigation)` expressed via the product of `1/(1−layer)` terms. Apply each layer as `1/(1 − dr)`.
- **Armor:** mitigation% = `armor/(armor+K)` capped 85% (already computed as `armor_mitigation_percent` in `defense.rs` — reuse it; K is the documented level-100 reference constant `ARMOR_MITIGATION_DENOM_REF_L100 = 1104`). Armor reduces **hits only** (and is 70% as effective vs non-physical — note if you split physical vs elemental EHP, else document the simplification).
- **Endurance:** mitigates a flat % (cap 90%, already clamped in `defense.rs`) of damage taken **while below the Endurance Threshold**; for **vs 1-shots** the threshold is a hard floor (only the over-threshold portion is endurance-mitigated).
- **Dodge / Parry / Block / Glancing:** **hits only** — excluded from vs-DoTs and from vs-1-shots. Parry caps 75% (negates fully, checked first); Glancing reduces a hit by 35%, caps 100%; Block reduces by Block Effectiveness (base 50%). All currently `0.0` in production (Story 1.3 audit) — wire the math, expect zeros until sourced.
- **Ward decay / Stable Ward:** LE ward decays at a rate rising with current ward, reduced by Ward Retention; equilibrium ward = generation ÷ effective-decay-rate. Source the exact decay coefficient from tunklab/Maxroll and **cite it in-comment**; pick the documented reference and note it as the assumption (parity is the `ehp_reference.rs` gate's job).
- Sources: [Maxroll — Defenses Explained](https://maxroll.gg/last-epoch/resources/defenses-explained), [lastepochtools — Ward](https://www.lastepochtools.com/), [tunklab EHP/Ward calculators] (the SM-1 reference — capture concrete build outputs from here for AC3).

### ⚠️ Primary risk — the tunklab reference numbers are a research deliverable
AC3's ±2% gate is only meaningful with **real recorded tunklab outputs**. The dev must open the live tunklab EHP/Ward calculator, enter ≥3 concrete builds, and record the exact inputs + EHP/Ward outputs as fixture literals (with source + date in-file). If tunklab is JS-gated/unreachable (Story 1.3 hit HTTP 403 on lastepochtools), fall back to Maxroll's published worked examples or the documented closed-form, and **record which reference was used and why** in the Dev Agent Record. Treat the EHP/Ward math as "reproduce the calculator's observable output," not "derive your own formula" (ADR-P4-001 EHP/Ward note).

### Project conventions (from project-context.md — must follow)
- `scoring-core` is a **pure crate**: no Tauri, no I/O; snake_case serde output mirrored to TS. Never camelCase `DefenseStats` field accesses in TS.
- **No dead keys** (AC2): a `StatKey` must be both produced by the loader AND consumed. Unsourced FR-7 inputs stay zero-no-key.
- Stat math reads the **Modifier Registry only** (Pattern P4-1); reading `defense.raw_hp` etc. (already registry-derived) is the intended input path here.
- Commands: `cargo` from `lebo/src-tauri/`, `pnpm` from `lebo/`. Package manager **pnpm**, never npm/yarn. (Story 1.3 hit a no-TTY pnpm wrapper abort + a stale Tauri `OUT_DIR` — if `cargo test -p scoring-core` fails on a `tauri` build-script path error unrelated to scoring-core, `cargo clean -p tauri`; scoring-core tests are independent of the Tauri crate.)
- Phase boundary: only edit inside `LEBOv2/`. Never touch `../_bmad-output/` Phase-1 files or `../lebo/`.

### Testing standards (from project-context.md)
- Rust unit tests for EHP/Ward math co-locate in `compute/ehp.rs` / `compute/ward.rs` `#[cfg(test)]` mods (pure-function level). The **round-trip ±2% parity fixtures** are the new **integration** crate `tests/ehp_reference.rs` (per architecture.md:513) — keep these two layers separate.
- The Phase-3 `effective_hp_*` and `build_score_slider_*` tests in `compute/mod.rs` are the **parity gate** — expected numbers must not change. A green run of these after your change is the proof you did not perturb scoring.
- TS: `statSheet.ts` is a type-only mirror; the 14 known pre-existing UI failures are the baseline — add none.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — user story + 3 AC blocks (FR-6 EHP triple, FR-7 Stable Ward/HP, NFR-1 ±2% gate).
- [Source: _bmad-output/planning-artifacts/epics.md#L46-47] — FR-6 (EHP ×3, DoTs exclude Dodge/Parry/Block) + FR-7 (Stable Ward/HP inputs, `[ASSUMPTION]` on last two).
- [Source: _bmad-output/planning-artifacts/epics.md#L122] — NFR-1/SM-1: ±2% of tunklab, enforced by `tests/ehp_reference.rs` CI gate.
- [Source: _bmad-output/planning-artifacts/architecture.md#L122-146] — ADR-P4-001 module split; the **EHP/Ward special note** (multiplicative layers; vs-DoTs excludes dodge/parry/block; vs-1-shots endurance threshold hard floor; observable behavior not re-derived formula; `tests/ehp_reference.rs` ±2% gate).
- [Source: _bmad-output/planning-artifacts/architecture.md#L51] — SM-1: reproduce tunklab observable outputs, not an independent formula.
- [Source: _bmad-output/planning-artifacts/architecture.md#L500-514] — file map: `ehp.rs`/`ward.rs` NEW submodules; `tests/ehp_reference.rs` NEW (tunklab parity fixtures, CI gate).
- [Source: _bmad-output/planning-artifacts/architecture.md#L616] — AR-14 gap floor "in `defense.rs`/`ward.rs`" — the resistance side was done in Story 1.3; keep `ward.rs` equilibrium free of false `gap==0`-style warnings (this story emits no new warnings).
- [Source: _bmad-output/implementation-artifacts/1-3-defensive-layer-computation.md#Dev Agent Record] — the Task-1 source audit (idol/affix/blessing data NOT shipped; ward_retention/decay/parry/glancing unsourced → 0.0); the armor `K=1104` reference constant; the "computed-but-unsourced" disaster class; the pnpm no-TTY / stale-Tauri-OUT_DIR env notes.
- [Source: _bmad-output/implementation-artifacts/1-2-offense-stats-damage-types-crit-speed-penetration.md] — origin of the computed-but-unsourced trap AC2's honesty rule guards against.
- [Source: lebo/src-tauri/scoring-core/src/compute/ehp.rs] — empty scaffold to implement (FR-6).
- [Source: lebo/src-tauri/scoring-core/src/compute/ward.rs] — empty scaffold to implement (FR-7).
- [Source: lebo/src-tauri/scoring-core/src/compute/defense.rs:79-244] — the **frozen** `effective_hp`/`1.05^(n-2)` math (do not change) + the `DefenseStats` inputs to consume (`armor_mitigation_percent`, resistances, endurance, dodge/parry/block, ward).
- [Source: lebo/src-tauri/scoring-core/src/compute/mod.rs:16-58] — orchestrator; insert `ehp`/`ward` calls after `compute_defense` (line 38); **do not touch the `scores` block** (lines 41-48). Parity tests live in this file's `#[cfg(test)]` (lines 491-652).
- [Source: lebo/src-tauri/scoring-core/src/stat_sheet.rs:48-90] — `DefenseStats` to extend (keep `Default`, append the 5 fields).
- [Source: lebo/src-tauri/scoring-core/src/lib.rs:13-28] — public re-exports usable from the new integration test.
- [Source: lebo/src-tauri/scoring-core/Cargo.toml] — no `[[test]]` needed; Cargo auto-discovers `tests/*.rs`.
- [Source: lebo/src/shared/types/statSheet.ts:29-56] — TS `DefenseStats` mirror to extend.
- [Source: https://maxroll.gg/last-epoch/resources/defenses-explained] — multiplicative layering, armor 85%/non-phys 70%, endurance, ward decay.

### Project Structure Notes
- Rust changes confined to `scoring-core`: `stat_sheet.rs` (5 additive fields), `compute/ehp.rs` + `compute/ward.rs` (fill scaffolds), `compute/mod.rs` (orchestrator wiring only — not the `scores` block), and the new `tests/ehp_reference.rs`. No new public struct export needed (new fields ride the already-exported `DefenseStats`); `ehp`/`ward` stay private `mod`s.
- TS change is type-only (`statSheet.ts`) plus updating test literals. No store/view/router/IPC change — `compute_stats` signature unchanged.
- No conflict with the four-store / no-router / props-only-canvas rules — this story touches none of them.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code dev-story workflow)

### Debug Log References

- `cargo test -p scoring-core` — baseline 97 passed (pre-change) → 109 lib passed (post-change, +12 ehp/ward unit tests) + 4 `ehp_reference` integration tests. Parity tests (`effective_hp_with_ward_and_endurance`, `effective_hp_no_ward_no_endurance`, all `build_score_slider_*`) unchanged.
- First compile error E0063: `compute_defense`'s explicit `DefenseStats { … }` literal needed the 5 new fields — added them as `0.0` (the orchestrator overwrites; `compute_defense` computes none of them). Resolved.
- `pnpm exec tsc --noEmit` → exit 0.
- `CI=true pnpm exec vitest run` → 14 failed / 1026 passed (1040 total) = documented baseline. Failing files all pre-existing & unrelated: AppHeader, RightPanel, ProviderSelector, Settings, SkillTreeCanvas, TreeControls. `StatSheetPanel.test.tsx` → 15/15 pass.
- scoring-core built independently — no Tauri `OUT_DIR`/pnpm-no-TTY issue hit this session.

### Completion Notes List

- **Frozen parity gate preserved.** `compute_defense`'s `effective_hp` / `1.05^(n-2)` math and `compute_stats`'s `scores` block are untouched; `survivability_score` still equals the legacy `effective_hp`. A dedicated integration test (`legacy_effective_hp_unchanged_by_ehp_additions`) pins `effective_hp = 2000 × 1.1 × 1/(1-0.30) = 3142.857` and asserts `survivability_score == effective_hp`.
- **EHP triple (FR-6), multiplicative layering** (`ehp.rs`): `EHP = pool / Π(1 − layer_dr)`, `pool = raw_hp + ward`.
  - vs Hits: armour (cap 85%) × resistance × endurance% (cap 90%) × hit-only avoidance (dodge/parry/block/glancing).
  - vs DoTs: resistance × endurance% only (armour + avoidance excluded — LE rule).
  - vs one-shots: single max hit, endurance threshold as a **hard floor** (`above + threshold/(1−end_dr)` post-armour/res capacity), avoidance excluded.
- **Generic-resistance assumption (documented choice):** the three EHP scalars collapse the 7 per-type resistances to the **average of the 7 capped (≤75%) resistances** — EHP in a mixed-damage environment. This is the modelling analogue of Story 1.3's armour `K=1104` constant; a per-type EHP breakdown is a future Story-1.6 display concern if ever needed.
- **Inf/NaN guards:** every DR layer is clamped to its cap; `MIN_DAMAGE_TAKEN = 0.01` floors the damage-taken fraction (so e.g. 100% dodge yields a finite 100×-pool EHP, not Inf); a final `finite_or_zero` sweep on every returned value.
- **Stable Ward / Stable HP (FR-7)** (`ward.rs`): equilibrium where generation == decay. `effective_decay_rate = BASE_WARD_DECAY_RATE(0.40) / (1 + ward_retention/100)`; `stable_ward = ward_decay_threshold + generation / effective_decay_rate`; `stable_hp = raw_hp + stable_ward`. Zero generation → `stable_ward = 0`, `stable_hp = raw_hp`. Negative-retention divisor guarded with `.max(0.01)`.
- **AC2 honesty / no dead keys upheld.** `ward_retention`, `ward_decay_threshold`, parry/glancing/block-effectiveness all remain zero-no-key fields (Story 1.3 audit: unshipped in Season-4 data). So in production Stable Ward is purely **generation-driven** (`ward/0.40`) and the hit-avoidance EHP terms are inert until a real source lands — the math is wired so they flow automatically when one does. **No `StatKey` variant was added.**
- **Tunklab reference figures.** The live tunklab calculator is a client-side JS app and is unreachable from this headless build environment (mirrors the Story-1.3 lastepochtools HTTP-403 precedent). Per the story's documented "primary risk" fallback, the `ehp_reference.rs` expected literals are taken from the **closed-form LE reference** (Maxroll *Defenses Explained*) with each fixture's inputs + arithmetic recorded in-file (date 2026-06-03). The ±2% gate still catches any implementation drift; substitute live tunklab captures when available.
- **Ward in EHP pool vs Stable Ward are intentionally independent** display values: the EHP pool uses raw ward as a flat buffer (matching the legacy treatment), while `stable_ward` is the separate FR-7 equilibrium figure. Both surfaced; neither feeds scoring.
- **Open Question for Alec** (re-pointing `survivability_score` at the accurate EHP) is intentionally NOT actioned — left to a future re-baselining story, exactly as the story flags.

### File List

- `lebo/src-tauri/scoring-core/src/stat_sheet.rs` — appended 5 additive `DefenseStats` fields (`ehp_vs_hits`, `ehp_vs_dots`, `ehp_vs_one_shots`, `stable_ward`, `stable_hp`).
- `lebo/src-tauri/scoring-core/src/compute/ehp.rs` — implemented FR-6 EHP triple (filled scaffold) + 7 unit tests.
- `lebo/src-tauri/scoring-core/src/compute/ward.rs` — implemented FR-7 Stable Ward/HP equilibrium (filled scaffold) + 5 unit tests.
- `lebo/src-tauri/scoring-core/src/compute/defense.rs` — initialized the 5 new fields to `0.0` in the `DefenseStats` literal (no math change).
- `lebo/src-tauri/scoring-core/src/compute/mod.rs` — orchestrator: `mut defense`, call `compute_ehp`/`compute_ward`, write the 5 fields (scores block untouched).
- `lebo/src-tauri/scoring-core/tests/ehp_reference.rs` — NEW ±2% tunklab parity gate (3 EHP fixtures + 1 legacy-parity guard).
- `lebo/src/shared/types/statSheet.ts` — mirrored the 5 new fields on TS `DefenseStats`.
- `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` — added the 5 fields to `makeStatSheet()`'s `defense` literal.

## Change Log

| Date | Change |
|------|--------|
| 2026-06-03 | Story 1.4 implemented: FR-6 EHP triple (`ehp.rs`), FR-7 Stable Ward/HP (`ward.rs`), 5 additive display-only `DefenseStats` fields + TS mirror, orchestrator wiring, and the `tests/ehp_reference.rs` ±2% parity gate. Frozen `effective_hp`/`survivability_score`/`build_score` gate preserved byte-identical. Status → review. |

---

## Open Question for Alec (non-blocking — does not gate dev)

This story deliberately keeps `survivability_score` / `build_score` on the **legacy `effective_hp` heuristic** (the whole-app scoring aggregate) and ships the tunklab-accurate EHP triple as **display-only** fields — the safe, parity-preserving choice (and how Story 1.3 handled it). At some point the build score *should* arguably be driven by the accurate tunklab EHP rather than the Phase-3 heuristic. That swap re-baselines every saved build's score and the optimizer/gear-scoring outputs, so it needs its own story (with deliberate re-baselining of the `build_score_slider_*` / `effective_hp_*` gate and optimizer revalidation). Flagging so it's a conscious decision, not an oversight — no action needed before dev-story.
