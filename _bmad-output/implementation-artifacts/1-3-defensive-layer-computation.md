# Story 1.3: Defensive layer computation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a theory-crafting player,
I want every defensive layer computed as an independent value on the Defense tab,
so that I can see my full mitigation picture at a glance.

This story fills out `compute/defense.rs` (created by Story 1.1, partially populated with legacy Phase-3 defense math) to cover **FR-5** — every defensive layer as an independent value — plus two carried items: the **AR-14 `warningGap === 0` false-warning fix** (in the engine gap floor, not the renderer) and the **OQ-1 Parry spike** (verify Parry is a player-accessible Season-4 stat). It is pure `scoring-core` + the loader tag map + the `DefenseStats` type mirror — **no UI layout work** (Story 1.6 owns the five-tab StatSheet display; Story 2.4 owns right-panel chrome). This story must keep the existing `StatSheetPanel.tsx` compiling and the build green.

**Hard scope boundary with Story 1.4:** EHP-as-three-values (vs Hits / vs DoTs / vs 1-shots) and Stable Ward / Stable HP **equilibrium** are **FR-6/FR-7 → Story 1.4**, NOT this story. The legacy `effective_hp` and the multi-layer bonus currently in `compute_defense` are a **parity gate** — leave them byte-identical; Story 1.4 reworks EHP. This story adds the *independent raw layer values* FR-5 enumerates, and nothing about EHP/equilibrium aggregation.

## Acceptance Criteria

**AC1 — Every FR-5 defensive layer computed as an independent value**
- **Given** a build with defensive modifiers,
- **When** `compute_stats` runs,
- **Then** each layer in the FR-5 table is computed independently and surfaced on `DefenseStats`: Health, Health Regen, Life Leech; Healing Effectiveness; Ward, Ward Retention, Ward Decay Threshold, Ward/sec; Armor **and** Armor Mitigation%; Endurance% **and** Endurance Threshold; Dodge; Parry; Block (chance + effectiveness); Glancing Blow; Crit Avoidance; Reduced Bonus Damage from Crits; and **all seven** resistances (Fire, Cold, Lightning, **Necrotic**, Void, Poison, Physical).
- **And** every value is read **only** via `ModifierRegistry::query(&StatKey, active)` — never from raw `BuildSnapshot` fields (Pattern P4-1).
- **And** the legacy `effective_hp`, `raw_hp`, and the `layer_count`/`1.05^(n-2)` multi-layer bonus stay **byte-identical** — every Phase-3 EHP/build-score regression test in `compute/mod.rs` (`effective_hp_with_ward_and_endurance`, `effective_hp_no_ward_no_endurance`, all `build_score_slider_*`) passes unchanged. (EHP rework is Story 1.4.)

**AC2 — Necrotic is the 7th resistance, split off Poison**
- **Given** a passive node / affix / blessing / idol whose resistance is tagged `NECROTIC`,
- **When** game data is loaded,
- **Then** it maps to `StatKey::NecroticResistance` (no longer conflated into `PoisonResistance` at `game_data_loader.rs:369`), and `compute_defense` computes `necrotic_resistance` independently (mirroring the other six: `AllResistances` + the type-specific key),
- **And** the loader golden effect-count test (`shipped_class_json_effect_count_is_stable`, currently **185**) still passes — a resistance node moving from the Poison bucket to the Necrotic bucket does not change the effect *count* (same construction as the Story-1.2 damage remap).

**AC3 — Resistance cap-gap annotation with the AR-14 gap floor (no false `(+0% needed)`)**
- **Given** a resistance below the 75% cap,
- **When** the Defense tab renders,
- **Then** the engine emits a `StatWarning` carrying the cap gap (e.g. fire at 68% → gap 7), which the renderer shows in the warning color.
- **Given** a resistance **at or numerically indistinguishable from** the cap (gap rounds to 0),
- **When** `run_floor_check` runs,
- **Then** **no warning is emitted for it** — `run_floor_check` applies an epsilon gap floor so a value at cap (including float-drift values like `74.99999`) never produces a `gap == 0` / negative-gap warning. The fix lives in the engine, not in `StatSheetPanel.tsx` (AR-14). The existing `floor_check_*_resistance_uncapped` and `floor_check_happy_path_no_warnings` tests still pass, plus a new at-cap test proves no false warning.

**AC4 — OQ-1 Parry spike resolved and recorded**
- **Given** the OQ-1 question (is Parry a player-accessible Season-4 stat?),
- **When** this story is implemented,
- **Then** the dev verifies Parry against the shipped Season-4 game data and the public mechanic, records the finding in this file's Dev Agent Record, and acts on it:
  - If Parry is player-accessible **and** a real data source exists → compute `parry_chance` (capped 75% per LE mechanic) from a loader-sourced `StatKey`.
  - If Parry is player-accessible **but no shipped node/affix sources it** → surface `parry_chance: 0.0` with **no new dead `StatKey`** (add the key only when a source exists), documented as such.
  - If Parry is enemy-only in Season 4 → drop Parry from FR-5 and `DefenseStats`, with the decision recorded.

**AC5 — No dead StatKeys; new fields are sourced or derived**
- **Given** the no-dead-keys project rule (a `StatKey` variant must be both **produced** by the loader **and** consumed, or it is a compile-relevant hygiene violation),
- **When** any new defensive layer is added,
- **Then** for every layer either (a) a real shipped data source is wired in `tags_to_stat_key`/`stat_key_from_str` for its `StatKey`, or (b) the value is **derived** from an already-sourced key (e.g. Armor Mitigation% is a pure function of `Armor`; no new key), or (c) the field is surfaced as `0.0`/`None` with an explicit "no shipped source yet" comment and **no new key is introduced**. No `StatKey` is added that no shipped class JSON or affix/idol/blessing entry can produce.

## Tasks / Subtasks

- [x] **Task 1 — Audit the shipped data for defensive sources FIRST (AC: 1, 4, 5)** — *do this before adding any StatKey or field; this is the disaster-prevention step that the Story-1.2 penetration rework proved necessary.*
  - [x] Grep the five shipped class JSONs (the loader's ground truth) and the idol/affix/blessing data for defensive tags/keys. Recorded which tags appear — see the **Task 1 source-audit table** in the Dev Agent Record. (Idol/affix/blessing data is **not shipped**, so the passive-tag path is the only real source.)
  - [x] For each FR-5 layer, decided its category per AC5 (sourced / derived / zero-no-key) — full table in Dev Agent Record.
  - [x] Confirmed `BLOCK` + `HEALING` were previously dropped (`None`); wiring them changes the golden count → rebaselined 185 → **198** (AC2/Task 6).

- [x] **Task 2 — Necrotic resistance split (AC: 2)** — `game_data_loader.rs` `tags_to_stat_key` + `compute/defense.rs`
  - [x] Split the resistance branch: `NECROTIC` → `StatKey::NecroticResistance` (before `POISON` → `StatKey::PoisonResistance`), after the element-specific guards.
  - [x] Added `necrotic_resistance` to `DefenseStats` and computed it in `compute_defense` (`AllResistances` sum + `NecroticResistance` sum), mirroring the other six.
  - [x] Added the 7th resistance to the floor-check list (`necrotic_resistance_uncapped`).

- [x] **Task 3 — Extend `DefenseStats` + add only-sourced/derived StatKeys (AC: 1, 5)** — `stat_sheet.rs`, `modifier.rs`
  - [x] Added the FR-5 layer fields to `DefenseStats` (all existing fields kept; `#[derive(Default)]` preserved; order-stable snake_case serde).
  - [x] Added **only** the two sourced `StatKey` variants the audit proved: `HealingEffectiveness`, `BlockChance`. No key added for Parry/Glancing/WardRetention/WardDecay/ReducedBonusDamageFromCrits/BlockEffectiveness (no shipped source → surfaced `0.0`, AC5).
  - [x] Wired `HEALING` → `HealingEffectiveness` and `BLOCK` → `BlockChance` in `tags_to_stat_key`; `NecroticResistance` wired on the passive-tag path.

- [x] **Task 4 — Compute the layers in `compute/defense.rs` (AC: 1, 5)**
  - [x] **Sourced layers:** summed via the registry. `block_chance` clamped to 100%. (Parry/Glancing have no source → 0.0.)
  - [x] **Armor Mitigation% (derived, no new key):** `armor / (armor + K)` capped at 85%, `K` a named level-100 reference constant cited in-comment; does **not** feed `effective_hp` (parity).
  - [x] Kept `effective_hp`, `raw_hp`, and the `layer_count`/`1.05^(n-2)` block byte-identical (necrotic deliberately NOT added to `layer_count`).
  - [x] Registry-only access (Pattern P4-1); base-HP context reads unchanged.

- [x] **Task 5 — AR-14 gap floor in `run_floor_check` (AC: 3)** — `compute/defense.rs`
  - [x] Added `RESISTANCE_GAP_EPSILON = 0.05`; warn only when `RESISTANCE_CAP - current_value > epsilon`. At-cap + float-drift (74.999999) emit no warning, never `gap <= 0`.
  - [x] Left `no_sustain_layer`'s boolean `gap: 0.0` untouched (keyed by `warning_type`; only cap-gap warnings get the floor).
  - [x] `StatSheetPanel.tsx` untouched — fix is engine-side.

- [x] **Task 6 — TS mirror + keep the build green (AC: 1, 2)** — `statSheet.ts`, test helpers
  - [x] Mirrored `necrotic_resistance` + all nine new `DefenseStats` fields in `statSheet.ts` (snake_case, exact, all `number`).
  - [x] Updated the only real `DefenseStats` literal in the TS suite — `StatSheetPanel.test.tsx`'s `makeStatSheet()`. (The `buildSnapshotSerializer.test.ts` `fire_resistance` match was `enemy_fire_resistance`, a condition string — not a literal.) `RESISTANCES` array + UI left unchanged (Story 1.6).
  - [x] `StatSheetPanel.tsx`/`computeStatDeltas` still compile (additive only; `tsc` exit 0).

- [x] **Task 7 — Tests (AC: 1, 2, 3, 4)** — orchestrator tests in `compute/mod.rs`, loader tests in `game_data_loader.rs`
  - [x] Necrotic independence: `necrotic_resistance_is_independent_of_poison` (compute) + `necrotic_resistance_splits_off_poison` (loader).
  - [x] Sourced layers flow + caps: `healing_effectiveness_flows_from_stat_key`, `block_chance_flows_and_caps_at_100`, `block_and_healing_tags_are_sourced`.
  - [x] Armor Mitigation% derived + 85% cap: `armor_mitigation_is_derived_and_caps_at_85`. Zero-no-key surfacing: `zero_no_key_layers_surface_zero`.
  - [x] **AR-14:** `floor_check_resistance_at_cap_emits_no_warning` (75, 74.999999 → no warning; 68 → gap ≈ 7; necrotic warns below cap).
  - [x] Parity gate: `effective_hp_*` and `build_score_slider_*` all green, unchanged.
  - [x] Golden loader count rebaselined 185 → 198 with a comment explaining the +13 (BLOCK +10, HEALING +3; Necrotic split count-neutral).

- [x] **Task 8 — Verify (AC: all)**
  - [x] `cargo test -p scoring-core` — **97 passed, 0 failed**; Phase-3 parity tests byte-identical.
  - [x] `cargo test -p lebo game_data_loader` — golden count (198) + Necrotic remap + BLOCK/HEALING sourcing **green**.
  - [x] TS strict compile (`tsc`, the `pnpm build` type-check) — **exit 0** with extended `statSheet.ts`. (Full `pnpm build`/`vitest` invoked the local binaries directly because pnpm's no-TTY auto-purge blocked the wrapper.)
  - [x] `vitest run` — **1026 pass / 14 pre-existing UI failures**, exactly the documented baseline; **no new failures** (none in stat-sheet or any touched file).
  - [x] Recorded the OQ-1 Parry decision (AC4) and the Task-1 source-audit table in the Dev Agent Record.

## Dev Notes

### Scope boundary — what this story IS and is NOT
- **IS:** the defensive-layer math in `scoring-core` (`compute/defense.rs`), the `DefenseStats` extension, the loader Necrotic-resistance split + any newly-sourced defensive keys, the AR-14 engine gap floor, the OQ-1 Parry spike, and the TS type mirror.
- **IS NOT:** EHP-as-three-values, Stable Ward / Stable HP equilibrium (FR-6/FR-7 → **Story 1.4**, `ehp.rs`/`ward.rs`); ailment/attribute/minion stats (FR-8/9/10 → **Story 1.5**); the five-tab StatSheet *layout* and the Necrotic-row/Bleed-Ignite display (FR-11/UX-DR7 → **Story 1.6**); right-panel chrome (Story 2.4); source attribution `track_sources` (Story 1.7). **Do not touch `ehp.rs`, `ward.rs`, `ailment.rs`, `attributes.rs`, `minion.rs`, or `offense.rs`/`penetration.rs`.**

### What already exists in `compute/defense.rs` (read it fully before editing — `compute/defense.rs:1-262`)
Story 1.1 moved legacy Phase-3 defense math here. It **already computes**: `raw_hp` (class base + flat + %), `ward` (`WardPerSecond` + `WardOnHit` sum), `endurance_percent` (clamped 0–0.9), `effective_hp` (with the `layer_count` / `1.05^(n-2)` multi-layer bonus), six resistances (`AllResistances` + type-specific, **Necrotic missing**), `crit_avoidance`, `life_leech_percent`, `hp_regen_per_sec`, `armor`, `dodge_chance`, `endurance_threshold`. `run_floor_check` already emits six `*_resistance_uncapped` warnings (strict `<`), `crit_avoidance_low`, and `no_sustain_layer`. **`effective_hp` and the layer bonus are a parity gate — do not change their math.** Your job is to *add* the missing FR-5 layers, split Necrotic, derive Armor Mitigation%, and apply the gap floor.

### The Story-1.2 lesson you must apply (read `1-2-offense-stats-damage-types-crit-speed-penetration.md` Review Findings)
Story 1.2 implemented correct penetration *math* but shipped a key that **no loader path produced** — `pen_mult` was silently always `1.0` in production, the parity tests passed *because penetration did nothing*, and it took a full second dev pass + two code reviews to source it. **Do not repeat this.** Every defensive `StatKey` you add must be provably produced by the shipped data (Task 1 audit) before you add it. A computed-but-unsourced layer is a latent defect that the parity tests will *not* catch. If a FR-5 layer has no shipped source, surface it as `0.0`/`None` with a comment — **do not add a dead key** (`noUnusedLocals` won't catch it, but the project rule and reviewers will).

### Loader specifics (verified)
- **Resistance branch** `game_data_loader.rs:362-371`: element guards (FIRE/COLD/ICE/LIGHTNING/SHOCK/VOID/PHYSICAL) then the conflated `if has("POISON") || has("NECROTIC") { PoisonResistance }`, then `RESISTANCE = AllResistances` fallback. Split Necrotic out here.
- `NecroticResistance` (`modifier.rs:53`) and the damage `IncreasedNecroticDamage` (`modifier.rs:17`) already exist; `stat_key_from_str:520` already maps `"necrotic_resistance"` for the idol/affix string-key path. So `NecroticResistance` is reachable via idol/affix data but is currently **never computed in `compute_defense`** and **never produced by the passive-tag path** — wiring both closes the gap.
- `tags_to_stat_key` returns `Some(...)` for mapped tags; unmapped defensive tags (e.g. `BLOCK`, `PARRY`, `GLANCING`) currently fall through to `None` and the effect is **dropped** — so wiring one *adds* to the golden count (rebaseline like 1.2's 179→185).
- The architecture's loader test fixtures reference a `["...,"BLOCK",...]` node (`architecture.md`-adjacent test data) — confirm against the *actual five shipped class JSONs*, not fixtures, since fixtures aren't the production data path.

### Suggested `DefenseStats` shape (additive only — keep all 16 existing fields)
```rust
pub struct DefenseStats {
    // ... existing 16 fields unchanged (effective_hp, raw_hp, ward, endurance_percent,
    //     endurance_threshold, armor, fire/cold/lightning/void/poison/physical_resistance,
    //     crit_avoidance, dodge_chance, life_leech_percent, hp_regen_per_sec) ...
    pub necrotic_resistance: f64,          // 7th resistance (AC2)
    pub armor_mitigation_percent: f64,     // DERIVED from `armor`, capped 85% — no new StatKey
    pub healing_effectiveness: f64,        // only if sourced (Task 1)
    pub ward_retention: f64,               // only if sourced
    pub ward_decay_threshold: f64,         // only if sourced
    pub block_chance: f64,                 // only if sourced; cap per LE
    pub block_effectiveness: f64,          // only if sourced (base 50% per LE)
    pub glancing_blow_chance: f64,         // only if sourced; cap 100%
    pub parry_chance: f64,                 // per OQ-1 outcome; cap 75%
    pub reduced_bonus_damage_from_crits: f64, // only if sourced
}
```
Adjust the exact set to what Task 1 proves is sourced/derivable. Every field defaults cleanly (`#[derive(Default)]` preserved). Mirror in `statSheet.ts`.

### Per-resistance math (mirror the existing six)
```rust
let necrotic_res = all_res
    + registry.query(&StatKey::NecroticResistance, active).iter().map(|m| m.value).sum::<f64>();
```
`all_res` is the already-computed `AllResistances` sum. Resistances are stored as raw % and may exceed 75; the 75% cap is a display/floor-check concern, not clamped in the raw value (matches existing behavior).

### AR-14 gap floor (the exact fix)
The renderer (`StatSheetPanel.tsx:135-152`) treats **any** defined `warningGap` as a warning and prints `(+{warningGap}% needed)` — so a `gap: 0` emitted by the engine renders a false `(+0% needed)` in warning color (deferred items track this from the 2-6 and 6-1 reviews). The directive (`architecture.md:616`, AR-14) is: **fix the engine gap floor, not the renderer.** In `run_floor_check`, change the resistance guard from `current_value < RESISTANCE_CAP` to a floored gap:
```rust
const GAP_EPSILON: f64 = 0.05; // resistance within ~0 of cap = capped; never emit a (+0% needed) warning
// ...
let gap = RESISTANCE_CAP - current_value;
if gap > GAP_EPSILON {
    // push warning with this gap
}
```
Leave `StatSheetPanel.tsx` untouched. The strict `<` today already blocks an *exactly* equal value, but float drift (`74.99999`) slips through with a `~1e-5` gap → the floor closes that.

### OQ-1 Parry — public mechanic (resolve the spike with this + the shipped data)
Per the Last Epoch defensive mechanics (Maxroll / lastepochtools): **Parry IS a player-accessible defensive layer.** A successful Parry negates the incoming attack completely and is checked **first**, before other layers; **Parry chance caps at 75%.** So the likely resolution is "keep Parry, cap 75%." **But** you must still confirm a real **source** exists in the shipped Season-4 data (a passive node or affix granting Parry chance) before adding a `ParryChance` StatKey — if player-accessible but unsourced in the bundle, surface `parry_chance: 0.0` with no key (AC4 branch 2). Record which branch you took.

### Latest tech — Last Epoch defensive formulas (cite in code comments)
- **Armor mitigation:** mitigation% = `armor / (armor + K)`, scaling with area/enemy level, **capped at 85%**; armor is **70% as effective vs non-physical** damage. The exact denominator constant `K` is level-dependent — source the precise formula from lastepochtools/Maxroll and **cite it in a comment**; pick the documented scoring reference level (the tunklab-aligned planner default) and note it as the assumption. The ±2% tunklab parity gate is enforced in **Story 1.4** (`tests/ehp_reference.rs`), so for 1.3 the Armor Mitigation% is a standalone display value — get the formula right and documented, but EHP integration is 1.4's.
- **Glancing Blow:** reduces hit damage by 35%; chance caps at 100%.
- **Block:** Block Effectiveness reduces the blocked hit (base 50%); block has its own chance.
- **Parry:** caps at 75%; fully negates; checked first (see OQ-1 above).
Sources: [Maxroll — Defenses Explained](https://maxroll.gg/last-epoch/resources/defenses-explained), [lastepochtools — Parry](https://www.lastepochtools.com/guide/section/parry), [lastepochtools — Block](https://www.lastepochtools.com/guide/section/block), [TheGamer — Defensive Layers](https://www.thegamer.com/last-epoch-all-defensive-layers-explained/).

### Project conventions (from project-context.md — must follow)
- `scoring-core` is a **pure crate**: no Tauri, no I/O; snake_case serde output mirrored to TS.
- **Rust output types mirror to TS in snake_case** — never camelCase `DefenseStats` field accesses in TS (`fire_resistance`, `necrotic_resistance`, `armor_mitigation_percent`).
- **No dead keys:** a `StatKey` must be produced by the loader AND consumed (AC5). TS strict (`noUnusedLocals`/`noUnusedParameters`) + Rust strict hygiene.
- Stat math reads the **Modifier Registry only** (Pattern P4-1); reading `snapshot.character_level`/`class_id` for base HP is allowed context, not stat math.
- Commands: `cargo` from `lebo/src-tauri/`, `pnpm` from `lebo/`. Package manager **pnpm**, never npm/yarn.
- Phase boundary: only edit inside `LEBOv2/`. Never touch `../_bmad-output/` Phase-1 files or `../lebo/`.

### Testing standards (from project-context.md)
- Rust: co-locate new layer tests in `compute/defense.rs` `#[cfg(test)]`; round-trip/orchestrator-level assertions live in `compute/mod.rs` (the floor-check and EHP tests are already there — extend, don't relocate).
- The Phase-3 `effective_hp_*` and `build_score_slider_*` tests in `compute/mod.rs` are the **parity gate** — their expected numbers must not change.
- Loader regression: `shipped_class_json_effect_count_is_stable` (golden **185**) must still pass after the Necrotic split; rebaseline only if Task 1 wires a previously-dropped tag, with a comment.
- Heed the deferred-work note on `blessing_fire_resistance_contributes` fragility — base class stats provide only HP, not resistances, so resistances start at 0 (assertions like `== 18.0` are safe). Confirm before relying on it for a Necrotic test.
- TS: `statSheet.ts` is a type-only mirror; the 14 known pre-existing UI failures from Story 1.1 are the baseline — add no new ones.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — user story + 3 AC blocks (FR-5, resistance cap-gap incl. AR-14, OQ-1 Parry spike).
- [Source: _bmad-output/planning-artifacts/epics.md#L45] — FR-5 full defensive-layer list (the AC1 table).
- [Source: _bmad-output/planning-artifacts/epics.md#L173, L373-374] — AR-12/OQ-1 Parry spike "resolve during the defense.rs story"; AR-14 `warningGap===0` fix in the engine gap floor.
- [Source: _bmad-output/planning-artifacts/architecture.md#L132] — ADR-P4-001: `defense.rs` owns "armor, endurance, dodge, parry, block, glancing, crit-avoidance, resistances".
- [Source: _bmad-output/planning-artifacts/architecture.md#L355] — Pattern P4-1: adding a Phase-4 stat must read the registry, never `snapshot.gear[...]` directly.
- [Source: _bmad-output/planning-artifacts/architecture.md#L610, L616, L677] — OQ-1 Parry spike before `defense.rs`; AR-14 gap floor in `defense.rs`/`ward.rs` not the renderer.
- [Source: _bmad-output/implementation-artifacts/1-2-offense-stats-damage-types-crit-speed-penetration.md#Review Findings] — the "computed-but-not-sourced" disaster class (penetration) — the AC5 / Task-1 discipline exists to prevent a repeat.
- [Source: lebo/src-tauri/scoring-core/src/compute/defense.rs:1-262] — existing legacy defense math to preserve (`effective_hp`, layer bonus) and extend; `run_floor_check` to add the gap floor + 7th resistance.
- [Source: lebo/src-tauri/scoring-core/src/stat_sheet.rs:48-66] — `DefenseStats` struct to extend (keep `Default`).
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs:38-56] — `StatKey` Defense variants; `NecroticResistance` already present, `AllResistances`, etc.
- [Source: lebo/src-tauri/scoring-core/src/compute/mod.rs:38, 49] — `compute_defense` + `run_floor_check` call sites; the Phase-3 parity tests live in this file's `#[cfg(test)]` mod.
- [Source: lebo/src-tauri/src/services/game_data_loader.rs:362-371] — resistance branch with the NECROTIC→Poison conflation to split; `stat_key_from_str:493-520` for the idol/affix string-key path; golden-count test `shipped_class_json_effect_count_is_stable`.
- [Source: lebo/src/shared/types/statSheet.ts:29-44] — TS `DefenseStats` mirror to extend.
- [Source: lebo/src/features/stat-sheet/StatSheetPanel.tsx:18-44, 130-152, 275-289] — `RESISTANCES` array (6 entries; Necrotic-row is Story 1.6), `StatRow` `warningGap` rendering (the AR-14 renderer behavior to leave untouched), `makeStatSheet`/`computeStatDeltas` to keep compiling.
- [Source: https://maxroll.gg/last-epoch/resources/defenses-explained] + [https://www.lastepochtools.com/guide/section/parry] — armor 85% cap + 70%-vs-non-physical, Glancing 35%/cap 100%, Block 50% effectiveness, Parry cap 75% checked first.

### Project Structure Notes
- Rust changes confined to `scoring-core` (`modifier.rs`, `stat_sheet.rs`, `compute/defense.rs`, and `compute/mod.rs` only for any new orchestrator test) plus the Tauri-side loader (`game_data_loader.rs`). No new modules. Export no new public struct (the new fields ride on the already-exported `DefenseStats`).
- TS change is type-only (`statSheet.ts`) plus updating test literals. No store/view/router/IPC change — `compute_stats` signature is unchanged.
- No conflict with the four-store / no-router / props-only-canvas rules — this story touches none of them.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code dev-story workflow)

### Task 1 — Shipped-data source audit (disaster-prevention gate)

Audited the five shipped class JSONs (`resources/game-data/classes/*.json`) — the loader's ground truth — for every defensive tag. Tags are uppercase entries in `effects[].tags`; the loader's `tags_to_stat_key` reads them, `extract_value` takes the first number in the description. Idol/affix/blessing data is **not shipped** (`gear_affixes` is built empty; no idol/blessing JSON exists), so the `stat_key_from_str` idol-path keys (incl. the pre-existing `necrotic_resistance`) are **unsourced in production** — the only real source is the passive-tag path. This is exactly the Story-1.2 trap, so every layer below is sourced through the **passive tag path** or surfaced 0.0 with no key.

**Defensive tags actually present (with raw occurrence counts):** `ARMOUR`(20), `ARMOUR_SHRED`(6), `BLOCK`(14), `HEALTH`(19), `HEALING`(4), `NECROTIC`(11; one is `NECROTIC`+`RESISTANCE`), `RESISTANCE`(8), `WARD`(8), `ENDURANCE`(5), `DODGE`(4), `LEECH`(4), `REGEN`(1), `DAMAGE_REDUCTION`(4), `DEFENCE`(34), `CRIT`(16, all offensive — none `CRIT`+`AVOIDANCE`), `FORTIFY`(2), `DEFLECT`/`PARRY`/`GLANCING`/`RETENTION`/`DECAY` → **absent**.

| FR-5 layer | Category | Decision / source |
|---|---|---|
| Health, Health Regen, Life Leech | exists | `raw_hp`, `hp_regen_per_sec`, `life_leech_percent` (unchanged) |
| Healing Effectiveness | **sourced** | `HEALING` tag → new `StatKey::HealingEffectiveness`; wired in `tags_to_stat_key` |
| Ward, Ward/sec | exists | `ward` (`WardPerSecond`+`WardOnHit`) — "Ward/sec" *is* this field |
| Ward Retention | **zero-no-key** | only appears as prose on `WARD`-tagged nodes (already → `WardPerSecond`); no distinct tag → surface `0.0`, comment |
| Ward Decay Threshold | **zero-no-key** | no tag/source in shipped data → surface `0.0`, comment |
| Armor | exists | `armor` (unchanged) |
| Armor Mitigation% | **derived** | pure fn of `armor` (LE `armor/(armor+K)`, cap 85%) — **no new key** |
| Endurance%, Endurance Threshold | exists | `endurance_percent`, `endurance_threshold` (unchanged) |
| Dodge | exists | `dodge_chance` (unchanged) |
| Parry | **zero-no-key (OQ-1 branch 2)** | see OQ-1 below — player-accessible but **no shipped source** → `parry_chance: 0.0`, no key |
| Block chance | **sourced** | `BLOCK` tag → new `StatKey::BlockChance`; wired in `tags_to_stat_key` (cap 100%) |
| Block effectiveness | **zero-no-key** | `BLOCK` tag conflates chance/effectiveness in prose; no distinct source → surface `0.0`, comment (base-50% is a Story-1.6 display concern) |
| Glancing Blow | **zero-no-key** | no `GLANCING` tag in shipped data → surface `0.0`, comment (cap 100% when later sourced) |
| Crit Avoidance | exists | `crit_avoidance` (unchanged) |
| Reduced Bonus Damage from Crits | **zero-no-key** | no tag (all `CRIT` nodes are offensive) → surface `0.0`, comment |
| Fire/Cold/Lightning/Void/Poison/Physical resistance | exists | unchanged |
| **Necrotic resistance** | **sourced (split)** | `NECROTIC`+`RESISTANCE` (acolyte "+4% Necrotic Resistance") → `StatKey::NecroticResistance` (key already exists); split out of the Poison bucket + compute independently |

**New `StatKey` variants added (both provably sourced):** `HealingEffectiveness`, `BlockChance`. `NecroticResistance` already existed — only its passive-tag source + `compute_defense` consumption were missing.

**Golden-count impact (AC2/Task 6):** the Necrotic split is **count-neutral** (the one `NECROTIC`+`RESISTANCE` node was already `Some(PoisonResistance)`, now `Some(NecroticResistance)` — still one effect). Wiring `BLOCK` and `HEALING` captures previously-dropped (`None`) nodes, so the golden `shipped_class_json_effect_count_is_stable` count **increases** — rebaselined to the actual loader output with a comment (same precedent as Story-1.2's 179→185).

**Block/Healing conflation note (honest limitation):** `BLOCK` and `HEALING` are single tags shared across chance/effectiveness/incidental clauses; `extract_value` takes the first number. This matches the existing loader's single-stat/first-number fidelity model (the same imprecision present project-wide) and is **sourced** (not a dead key). Block *effectiveness* and *healing power* nuance is not separately tagged → block_effectiveness stays zero-no-key.

### OQ-1 — Parry spike resolution (AC4)

**Branch taken: (2) — player-accessible but unsourced.** Per the LE public mechanic (Maxroll/lastepochtools): Parry **is** a player-accessible defensive layer — it fully negates the incoming hit, is checked first, and **caps at 75%**. However, a grep of all five shipped Season-4 class JSONs found **no `PARRY` tag and no "Parry" prose on any node**, and no idol/affix/blessing data is shipped. Per AC4 branch 2 + AC5: `parry_chance` is surfaced as `0.0` with **no new `StatKey`** (a `ParryChance` key would be dead). When a shipped Parry source appears, add the key + 75% cap then.

### Armor-mitigation formula decision (Task 4)

LE caps confirmed via Maxroll *Defenses Explained*: **85% physical**, **59.5% non-physical** (= 85% × 0.7, the "armour 70% as effective vs non-physical" rule). The level-scaled denominator `K` could not be pulled from lastepochtools/tunklab (JS-gated, HTTP 403/empty). Per the story, the ±2% tunklab parity gate is **Story 1.4**'s (`tests/ehp_reference.rs`); for 1.3 `armor_mitigation_percent` is a **standalone display value**. Implemented the structural LE form `mitigation = armor / (armor + K)` capped at 85%, with `K` a named constant documenting the **level-100 scoring reference** assumption, explicitly flagged in-comment for Story-1.4 parity tuning. It does **not** feed `effective_hp` (parity gate preserved).

### Debug Log References

- **Env (not a code issue):** the `lebo` crate's Tauri build script had a stale cached `OUT_DIR` pointing at the project's prior location (`D:\Obsidian Brain\Brain\10_Active_Projects\LEBOv2\…`), failing with `failed to read plugin permissions … app_hide.toml (os error 3)`. Resolved with `cargo clean -p tauri` (forces the `tauri` dependency's build script to re-record the current path) — no source change. `scoring-core` tests were unaffected.
- **Tooling:** `pnpm build`/`pnpm vitest` wrappers aborted under no-TTY (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`); ran `CI=true pnpm install` then the local `./node_modules/.bin/{tsc,vitest}` binaries directly.

### Completion Notes List

- **FR-5 defensive layers (AC1):** all FR-5 layers are now computed independently and surfaced on `DefenseStats`. Sourced from shipped passive tags: `healing_effectiveness` (`HEALING`), `block_chance` (`BLOCK`, cap 100%), `necrotic_resistance` (`NECROTIC`+`RESISTANCE`). Derived: `armor_mitigation_percent` (`armor/(armor+K)`, cap 85%, no key). Zero-no-key per AC5 (no shipped source, no dead key): `parry_chance`, `block_effectiveness`, `glancing_blow_chance`, `ward_retention`, `ward_decay_threshold`, `reduced_bonus_damage_from_crits`. All reads via `ModifierRegistry::query` (Pattern P4-1).
- **Parity gate held (AC1):** `effective_hp`, `raw_hp`, and the `layer_count`/`1.05^(n-2)` bonus are byte-identical — necrotic was intentionally **not** added to the `layer_count` resistance check. `effective_hp_with_ward_and_endurance`, `effective_hp_no_ward_no_endurance`, and all `build_score_slider_*` pass unchanged.
- **Necrotic = 7th resistance (AC2):** loader split `NECROTIC` off the Poison bucket onto `StatKey::NecroticResistance` (count-neutral); `compute_defense` computes it like the other six; `run_floor_check` emits `necrotic_resistance_uncapped`.
- **AR-14 (AC3):** engine-side gap floor (`RESISTANCE_GAP_EPSILON = 0.05`) — no `(+0% needed)` false warning at/near cap (incl. float drift). `StatSheetPanel.tsx` untouched.
- **OQ-1 (AC4):** Parry is player-accessible (cap 75%, checked first) but **no shipped Season-4 source exists** → `parry_chance: 0.0` with no `StatKey` (branch 2). Full rationale in the OQ-1 section above.
- **No dead keys (AC5):** only `HealingEffectiveness` + `BlockChance` added — both provably produced by shipped class JSONs and consumed in `compute_defense`.
- **Golden count:** rebaselined 185 → **198** (+13: BLOCK +10, HEALING +3) with an in-test comment; Necrotic split count-neutral.
- **Pre-existing unrelated failures (not introduced here):** Rust `openrouter_service::tests::models_list_has_four_entries` (asserts 4, list now has 7 — stale assertion, untouched module); TS 14 baseline UI failures (AppHeader/RightPanel/ProviderSelector/Settings/SkillTreeCanvas/TreeControls).

### File List

- `lebo/src-tauri/scoring-core/src/modifier.rs` — added `StatKey::HealingEffectiveness`, `StatKey::BlockChance` (sourced).
- `lebo/src-tauri/scoring-core/src/stat_sheet.rs` — extended `DefenseStats` with `necrotic_resistance` + 9 FR-5 fields (additive, `Default` preserved).
- `lebo/src-tauri/scoring-core/src/compute/defense.rs` — necrotic resistance, healing/block layers, derived armor mitigation, zero-no-key fields, new constants, AR-14 gap floor + 7th resistance in `run_floor_check`.
- `lebo/src-tauri/scoring-core/src/compute/mod.rs` — new FR-5 orchestrator tests (necrotic independence, healing/block flow + caps, armor mitigation + cap, zero-no-key, AR-14 at-cap/drift/below).
- `lebo/src-tauri/src/services/game_data_loader.rs` — `tags_to_stat_key`: Necrotic split + `HEALING`/`BLOCK` sourcing; golden count rebaselined to 198; new loader tests.
- `lebo/src/shared/types/statSheet.ts` — mirrored `necrotic_resistance` + 9 new `DefenseStats` fields (snake_case).
- `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` — updated `makeStatSheet()` `DefenseStats` literal with the new fields.

### Change Log

| Date | Change |
|------|--------|
| 2026-06-03 | Story 1.3 implemented: FR-5 defensive layers (sourced Healing/Block + 7th Necrotic resistance, derived Armor Mitigation%, AR-14 gap floor, OQ-1 Parry spike resolved as zero-no-key). New StatKeys `HealingEffectiveness`/`BlockChance`; golden effect count rebaselined 185→198. TS mirror extended. Status → review. |
