# Story 1.2: Offense stats — damage types, crit, speed, penetration

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a theory-crafting player,
I want the Offense tab to show per-damage-type Increased%/More%, crit stats (incl. stun chance), attack/cast speed, AoE, and elemental/physical penetration,
so that I can read my offensive profile without summing modifiers by hand.

This story fills the `compute/offense.rs` and `compute/penetration.rs` modules that Story 1.1 created (offense was *moved* into a submodule with the existing Phase-3 aggregate math; penetration is an empty scaffold). It covers **FR-1, FR-2, FR-3, FR-4**. It is pure `scoring-core` + the `StatSheet` type mirror — **no UI rebuild.** The five-tab StatSheetPanel layout that surfaces these new fields is Story 1.6; the right-panel chrome restyle is Story 2.4. This story must keep the *existing* `StatSheetPanel.tsx` compiling and the build green.

## Acceptance Criteria

**AC1 — Per-damage-type Increased%/More%, independent and non-bleeding (FR-1)**
- **Given** a build with modifiers across multiple damage types,
- **When** `compute_stats` runs,
- **Then** Increased% and More% are computed **independently per damage type** for the Last Epoch damage types present in game data — Physical, Fire, Cold, Lightning, Void, Necrotic, Poison — with a hit/DoT split where the mechanic supports a DoT variant (Poison, Ignite-as-fire-DoT, Bleed-as-physical-DoT),
- **And** a modifier tagged for one damage type (e.g. `IncreasedFireDamage`) contributes **only** to that type's increased/more figures and never to another type's.
- **And** the existing aggregate `damage_score` formula and every value asserted by the Phase-3 offense regression tests in `compute/mod.rs` remain **byte-identical** (the new per-type breakdown is added *alongside* the aggregate, not in place of it).

**AC2 — Crit chance/multi, stun chance, crit-weighted hit (FR-2)**
- **Given** crit and stun modifiers,
- **When** `compute_stats` runs,
- **Then** Crit Chance is capped at 100%, Crit Multi is `200% + Σ additive`, **Stun Chance is computed** (new), and crit-weighted average damage uses `Hit × [(CritMulti × CritChance) + (1 × (1 − CritChance))]`.
- **And** the three crit values already produced (`critical_strike_chance`, `critical_strike_multiplier`, `avg_hit_damage_crit_weighted`) keep their current behavior and pass the existing `crit_weighted_at_82_percent` and `crit_chance_above_100_is_clamped` tests unchanged.

**AC3 — Attack/cast speed and AoE (FR-3)**
- **Given** speed and AoE modifiers,
- **When** `compute_stats` runs,
- **Then** Attack Speed and Cast Speed are computed as separate stats (each `None` when no modifier of that kind exists, matching today's behavior) and AoE Modifier is computed — all preserving the current `compute/offense.rs` semantics.

**AC4 — Elemental & Physical penetration, applied to the score (FR-4)**
- **Given** penetration modifiers,
- **When** `compute_stats` runs,
- **Then** Elemental Penetration (fire/cold/lightning) and Physical Penetration are computed **separately** in `compute/penetration.rs` and surfaced on `OffenseStats`,
- **And** penetration reduces effective enemy resistance against a **0%-resistance reference target** using Last Epoch's real linear penetration mechanic: `effective_enemy_res = ENEMY_RES_BASELINE − penetration` (may go negative), and damage is scaled by `(1 − effective_enemy_res/100)` — i.e. with the 0% baseline, the scored damage of a penetrating type is multiplied by `(1 + penetration/100)` (penetration → negative resistance → linear bonus damage),
- **And** a build with **no** penetration modifiers yields multiplier `1.0`, so `damage_score` stays **byte-identical** to the Phase-3 aggregate and every existing offense/crit/build-score regression test passes unchanged.

**AC5 — Registry-only data access (Pattern P4-1)**
- **Given** the offense and penetration computations,
- **When** any value is computed,
- **Then** it is read **only** via `ModifierRegistry::query(&StatKey, active)` — never from raw `BuildSnapshot` fields. (Reading `snapshot.primary_offense_damage_elements` / `primary_offense_delivery_type` for *which type to roll into the aggregate* is allowed context selection, not stat math; document any such use.)

## Tasks / Subtasks

- [x] **Task 1 — Extend `StatKey` for the missing damage types and stun (AC: 1, 2)** — `scoring-core/src/modifier.rs`
  - [x] Added `IncreasedNecroticDamage`, `IncreasedBleedDamage` (physical DoT) and `IncreasedIgniteDamage` (fire DoT). No `Corruption` type added. 7 real LE types modeled; Bleed/Ignite as DoT variants under parent type.
  - [x] Added `StunChance` for FR-2.
  - [x] Per-type **More** uses no new keys — split increased vs more by `modifier_type` at query time via the shared `increased_and_more` helper.
- [x] **Task 2 — Update the loader tag→StatKey mapping for the new types (AC: 1)** — `src-tauri/src/services/game_data_loader.rs` `tags_to_stat_key`
  - [x] Split `POISON`/`NECROTIC`: `NECROTIC` → `IncreasedNecroticDamage`, `POISON` → `IncreasedPoisonDamage`. Added `BLEED` → `IncreasedBleedDamage` and `IGNITE` → `IncreasedIgniteDamage`, all inside the `has("DAMAGE")` branch. Golden test (179) re-run and still passes.
  - [x] Added all four new keys to `DAMAGE_STAT_KEYS` so the aggregate `damage_score` total is preserved.
  - [x] Did **not** add a STUN tag mapping: the only `STUN` tag in shipped data (`["MELEE","STUN"]`) has no `DAMAGE` tag and is currently dropped — wiring it would bump the golden count off 179. `StunChance` is modeled in compute and tested programmatically; loader wiring is deferred. (Documented in `offense.rs`.)
- [x] **Task 3 — Implement per-damage-type offense in `compute/offense.rs` (AC: 1, 5)**
  - [x] Aggregate `damage_score` / `avg_hit_damage` / `avg_hit_damage_crit_weighted` path unchanged (parity gate; all Phase-3 tests pass).
  - [x] Added per-type breakdown via `DAMAGE_TYPES` table + `increased_and_more` (sum of Increased, product of More; empty product = 1.0). Registry-only access (AC5).
  - [x] Populated new `OffenseStats` fields. `DAMAGE_STAT_KEYS` remains the single aggregate source with the new keys added.
- [x] **Task 4 — Stun chance, AoE, speed pass-through (AC: 2, 3)** — `compute/offense.rs`
  - [x] `stun_chance` = sum of Flat `StunChance`, clamped `[0,100]`, default 0.
  - [x] Attack/cast speed and AoE logic untouched.
- [x] **Task 5 — Implement `compute/penetration.rs` (AC: 4, 5)**
  - [x] `compute_penetration(registry, active) -> (elemental, physical)`. Elemental = **sum** of fire/cold/lightning penetration (documented). `physical_penetration` separate.
  - [x] LE linear mechanic against a 0%-resistance reference target: `1 − (0 − pen)/100 = 1 + pen/100`. Applied in `compute/mod.rs::compute_stats` after offense via `penetration_multiplier`, selecting elemental vs physical from `primary_offense_damage_elements`. No-pen builds → ×1.0 → byte-identical parity.
- [x] **Task 6 — Extend the `OffenseStats` struct + TS mirror (AC: 1, 2, 4)**
  - [x] `stat_sheet.rs`: added `stun_chance`, `elemental_penetration`, `physical_penetration`, `damage_types: Vec<DamageTypeBreakdown>`; new `DamageTypeBreakdown` struct. All `Default`-able; `#[derive(Default)]` preserved. Exported from `lib.rs`.
  - [x] `statSheet.ts`: mirrored exactly in snake_case + new `DamageTypeBreakdown` interface.
  - [x] `StatSheetPanel.tsx` + `StatDeltas`/`computeStatDeltas` still compile (TS strict build passes). No existing fields renamed/deleted; `makeStatSheet()` test helper extended with the new fields.
- [x] **Task 7 — Tests (AC: 1, 2, 4)** — co-located in `compute/offense.rs` and `compute/penetration.rs` `#[cfg(test)]` blocks
  - [x] Per-type isolation (`per_type_increased_does_not_bleed_across_types`).
  - [x] Per-type more is a multiplier, not folded into increased (`per_type_more_is_a_multiplier_not_folded_into_increased`).
  - [x] Stun chance sum+clamp and zero-default.
  - [x] Penetration: elemental vs physical separated; no-pen parity (`no_penetration_keeps_damage_score_byte_identical`); linear N% scaling (`elemental_penetration_scales_primary_element_damage_linearly`).
  - [x] Necrotic remap regression (loader `damage_tag_remap_lands_on_new_keys` + compute `necrotic_key_contributes_to_aggregate_damage_score`).
- [x] **Task 8 — Verify (AC: all)**
  - [x] `cargo test -p scoring-core` — 81 passed, 0 failed (all Phase-3 parity tests + new tests green).
  - [x] `cargo test -p lebo game_data_loader` — `shipped_class_json_effect_count_is_stable` still 179; remap test green.
  - [x] `pnpm build` — TS strict compile passes with extended `statSheet.ts`. `pnpm vitest run` — 1026 passed, 14 failed = the documented Story-1.1 baseline (AppHeader/ProviderSelector/Settings/RightPanel/SkillTreeCanvas/TreeControls); no new failures.

## Dev Notes

### Scope boundary — what this story is and is NOT
- **IS:** the offense + penetration math in `scoring-core` (`compute/offense.rs`, `compute/penetration.rs`), the `StatKey`/`OffenseStats` extensions, the loader tag remap for Necrotic/Bleed, and the TS type mirror. 
- **IS NOT:** any StatSheet UI layout (Story 1.6), right-panel chrome (Story 2.4), defense/EHP/ward/ailment/attribute/minion math (Stories 1.3–1.5), or source attribution (`track_sources`, Story 1.7). Do not touch `compute/defense.rs`, `ehp.rs`, `ward.rs`, etc.

### What already exists (Story 1.1 left this in place)
`compute/offense.rs` already computes the **aggregate** `damage_score` (base 100 × (1+Σincreased/100) × Πmore), crit chance/multi, crit-weighted hit, attack/cast speed, and AoE — see the file. **These are a parity gate.** Story 1.1's `compute/mod.rs` holds the orchestrator and the offense/crit/build-score regression tests; they must stay byte-identical. Your job is to *add* the per-type breakdown, stun, and penetration without disturbing them.

### Damage types: what the data actually has (verify before coding — do not assume FR-1 verbatim)
The shipped class JSONs store node effects as `{ description, tags }` (e.g. `tags: ["NECROTIC","DAMAGE"]`), not structured stat keys. `game_data_loader.rs::tags_to_stat_key` maps tags → `StatKey`. **Current reality:**
- Element-specific keys exist: Fire, Cold, Lightning, Void, Poison, Physical (+ Spell/Melee/Ranged/Area/Minion delivery keys).
- `NECROTIC` is currently **conflated into `IncreasedPoisonDamage`** (line ~235). `BLEED` and `CORRUPTION` have **no mapping** → they fall through to generic `IncreasedDamage`.
- Last Epoch's actual seven damage types are **Physical, Fire, Cold, Lightning, Necrotic, Void, Poison**. **Bleed** is a *physical-tagged ailment* (a DoT), **Ignite** a fire DoT, **Poison** a poison DoT. **"Corruption" is not a player damage type** (it's a Monolith mechanic) — FR-1's list is imprecise here. Treat the per-type breakdown as the 7 real types; represent Bleed/Ignite/Poison as DoT variants under their parent type rather than as separate "damage types." Full ailment *chance/duration* stats are Story 1.5 (FR-8) — this story only needs the increased/more DoT split where a DoT key exists.
- **Action:** grep the class JSONs for the damage tags actually present before adding keys, so you add exactly the variants the data emits and nothing dead (strict Rust/TS hygiene = unused = error). The five shipped classes are the ground truth.

### OffenseStats shape (recommended — additive only)
Keep all 8 existing fields. Add:
```rust
pub struct OffenseStats {
    // ... existing 8 fields unchanged ...
    pub stun_chance: f64,
    pub elemental_penetration: f64,
    pub physical_penetration: f64,
    pub damage_types: Vec<DamageTypeBreakdown>, // order-stable; one entry per type with non-default data
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct DamageTypeBreakdown {
    pub damage_type: String,        // "fire" | "cold" | ... (lowercase, matches DAMAGE_TYPE_COLORS keys in rarityColors.ts)
    pub increased: f64,             // Σ Increased%
    pub more: f64,                  // Π More multipliers, expressed as a multiplier (1.0 = none)
    pub increased_dot: Option<f64>, // None when the type has no DoT variant
    pub more_dot: Option<f64>,
}
```
A `Vec` keeps deterministic ordering for the Story-1.6 tab and serializes cleanly. `damage_type` strings should match the `DAMAGE_TYPE_COLORS` keys in `lebo/src/shared/utils/rarityColors.ts` so the UI can color rows without a translation layer (confirm those keys). Mirror both structs in `statSheet.ts`.

### Per-type math (mirror the aggregate)
The aggregate already does this for generic + the `DAMAGE_STAT_KEYS` list:
```rust
let increased: f64 = registry.query(&key, active).iter()
    .filter(|m| m.modifier_type == ModifierType::Increased).map(|m| m.value).sum();
let more: f64 = registry.query(&key, active).iter()
    .filter(|m| m.modifier_type == ModifierType::More).map(|m| m.value).product(); // empty → 1.0
```
Do the same per `IncreasedXDamage` key for the breakdown. **More multipliers are stored as the multiplier itself** (the existing test uses `value: 1.40` meaning ×1.40) — keep that convention; do not divide by 100 for More.

### Penetration model (DECIDED — implement exactly this)
FR-4 says penetration "reduces effective enemy resistance in the score calc," but the Phase-3 `damage_score` has no enemy-resistance term. Per the product decision, model it now using Last Epoch's **real linear penetration mechanic** against a **0%-resistance reference target** (the standard theorycrafting dummy / build-planner default):

- `const ENEMY_RES_BASELINE: f64 = 0.0;` (0% reference target — documented as the scoring assumption).
- `effective_enemy_res = ENEMY_RES_BASELINE − penetration` — **may go negative** (LE allows resistance below 0; no downward floor).
- Scored damage of the penetrating type is multiplied by `(1 − effective_enemy_res / 100)`. With the 0% baseline this is `(1 + penetration / 100)`.
- LE is **linear**: each 1% of negative enemy resistance = +1% damage of that type. Do **not** use the `1/(1−r)` defensive-mitigation form — that's for the player's own DR, not damage dealt.
- Apply **elemental** penetration to elemental-typed scored damage (fire/cold/lightning) and **physical** penetration to physical-typed scored damage; pick which applies from the build's `primary_offense_damage_elements`. A build whose primary element isn't elemental/physical simply sees no penetration effect.

**Parity is preserved for free:** every Phase-3 regression build has *zero* penetration → multiplier `1.0` → `damage_score` byte-identical. You should **not** need to change any existing expected value. If a Phase-3 test value changes, your formula is wrong (most likely you applied a non-linear form or a non-zero baseline). Add a code comment stating the 0% reference-target assumption and the linearity (the *why*, per the comment rule). Surface `elemental_penetration` / `physical_penetration` on `OffenseStats` regardless.

### Which type rolls into the aggregate score?
`damage_score` stays the generic aggregate (parity). The build's `primary_offense_damage_elements` / `primary_offense_delivery_type` on `BuildSnapshot` identify the build's real damage type(s) — you may *read* these to decide which per-type figure (and which penetration) to apply to the scored damage, but that is context selection, not stat math (AC5 carve-out). Keep raw-field reads out of the per-type increased/more computation itself.

### Project conventions (from project-context.md — must follow)
- `scoring-core` is a **pure crate**: no Tauri, no I/O. Outputs are snake_case serde defaults; the new `OffenseStats` fields and `DamageTypeBreakdown` inherit that.
- **Rust output types mirror to TS in snake_case** — never camelCase `OffenseStats` field accesses in TS (`damage_score`, `stun_chance`, `elemental_penetration`).
- TypeScript strict (`noUnusedLocals`/`noUnusedParameters`) and Rust strict hygiene — no unused keys, imports, or dead scaffolds. If you add a `StatKey` variant, it must be produced by the loader **and** consumed, or it's dead.
- Commands: `cargo` from `lebo/src-tauri/`, `pnpm` from `lebo/`. Package manager **pnpm**, never npm/yarn.
- Phase boundary: only edit inside `LEBOv2/`. Never touch `../_bmad-output/` Phase-1 files or `../lebo/`.

### Testing standards (from project-context.md)
- Rust: co-locate tests in the module's `#[cfg(test)]` block. The Phase-3 offense/crit/build-score tests in `compute/mod.rs` are the **parity gate** — their expected numbers must not change. New per-type/stun/penetration tests go in `offense.rs`/`penetration.rs`.
- Loader regression: `shipped_class_json_effect_count_is_stable` (golden 179) must still pass after the Necrotic/Bleed remap — the remap changes stat-key assignment, not effect count.
- TS: `statSheet.ts` is a type-only mirror; the existing `errorNormalizer`/component test suites must not regress (14 known-pre-existing UI failures from Story 1.1 are the baseline — no new ones).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — user story + 3 AC blocks (FR-1/2/3/4).
- [Source: _bmad-output/planning-artifacts/epics.md#L41-44] — FR-1 (per-type increased/more, no cross-bleed), FR-2 (crit/stun, crit-weighted hit), FR-3 (attack/cast speed, AoE), FR-4 (elemental/physical penetration reduces enemy res).
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-P4-001 L130-131,142] — `offense.rs` owns FR-1/2/3/4, `penetration.rs` owns FR-4; registry-only access; `flat → increased → more` order.
- [Source: _bmad-output/implementation-artifacts/1-1-modifiertype-enum-migration-and-compute-module-split.md] — module split layout; offense moved with aggregate math intact; parity-gate discipline.
- [Source: lebo/src-tauri/scoring-core/src/compute/offense.rs] — existing aggregate damage/crit/speed/AoE math to preserve and extend.
- [Source: lebo/src-tauri/scoring-core/src/compute/penetration.rs] — scaffold to fill.
- [Source: lebo/src-tauri/scoring-core/src/compute/mod.rs:16-44] — `compute_stats` orchestrator + `mod penetration;` already declared; offense/build-score regression tests.
- [Source: lebo/src-tauri/scoring-core/src/modifier.rs:6-75] — `StatKey` enum to extend; `ModifierRegistry::query` API.
- [Source: lebo/src-tauri/scoring-core/src/stat_sheet.rs:3-16] — `OffenseStats` struct to extend (keep `Default`).
- [Source: lebo/src-tauri/src/services/game_data_loader.rs:213-307] — `tags_to_stat_key`; NECROTIC→Poison conflation (L235), no BLEED/CORRUPTION mapping; golden-count regression test L507-518.
- [Source: lebo/src/shared/types/statSheet.ts:3-12,90-97] — TS `OffenseStats`/`StatSheet` mirror to extend.
- [Source: lebo/src/features/stat-sheet/StatSheetPanel.tsx:49-111,246-265] — existing Offense tab + `StatDeltas` to keep compiling (Story 1.6 owns new-field display).
- [Source: lebo/src-tauri/scoring-core/src/build_snapshot.rs:68-79] — `primary_offense_delivery_type` / `primary_offense_damage_elements` for aggregate-roll-up context selection.
- [Source: https://lastepoch.fandom.com/wiki/Penetration + https://www.lastepochtools.com/guide/section/penetrations] — LE penetration is subtracted from enemy resistance, can go negative; each 1% negative resistance = +1% damage of that type (linear). Confirms the 0%-reference-target + linear model used above.

### Project Structure Notes
- All Rust changes are confined to `scoring-core` (`modifier.rs`, `stat_sheet.rs`, `compute/offense.rs`, `compute/penetration.rs`) plus the Tauri-side loader (`game_data_loader.rs`). No new modules, no `lib.rs` re-export changes beyond exporting any new public struct (`DamageTypeBreakdown`) the way `OffenseStats` is exported.
- TS change is type-only (`statSheet.ts`) plus keeping `StatSheetPanel.tsx` green. No store, view, router, or IPC contract change — `compute_stats` signature is unchanged.
- No conflict with the four-store / no-router / props-only-canvas rules — this story touches none of them.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia, BMAD dev-story workflow)

### Debug Log References

- `cargo test -p scoring-core` → 81 passed, 0 failed.
- `cargo test -p lebo game_data_loader` → 2 passed (golden count 179 + remap), 0 failed.
- `pnpm build` → tsc strict + vite build succeeded (chunk-size warnings only).
- `pnpm vitest run` → 1026 passed, 14 failed (pre-existing Story-1.1 baseline; no new failures).

### Completion Notes List

- **Per-type breakdown (FR-1):** `OffenseStats.damage_types` is a fixed-order `Vec` of all 7 real LE damage types (physical, fire, cold, lightning, void, necrotic, poison), each with independent `increased`/`more`. Fire and physical carry a DoT split (`increased_dot`/`more_dot`) sourced from Ignite and Bleed respectively; the other types report `None` for the DoT fields. Verified no cross-type bleed.
- **Aggregate parity (AC1/AC4):** the aggregate `damage_score` path is untouched; the four new damage keys were added to `DAMAGE_STAT_KEYS` so the remap of Necrotic/Bleed/Ignite off their old keys preserves the aggregate sum. All Phase-3 parity tests are byte-identical.
- **Penetration (FR-4):** modeled with LE's real **linear** mechanic against a documented **0%-resistance reference target** (`1 + pen/100`). Wired in `compute/mod.rs` after offense; selects elemental vs physical from `primary_offense_damage_elements`. No-penetration builds get ×1.0, so parity holds for free. `elemental_penetration` is the **sum** of fire/cold/lightning penetration (documented choice).
- **Stun (FR-2):** `StunChance` is summed (Flat) and clamped `[0,100]`. **Not wired in the loader** — the only shipped `STUN` tag lacks a `DAMAGE` tag and is currently dropped; adding a mapping would break the golden effect-count (179). Modeled + tested programmatically; loader wiring deferred to a future ailment story.
- **Loader remap (AC1):** `tags_to_stat_key` now splits `POISON`/`NECROTIC` and routes `BLEED`→bleed, `IGNITE`→ignite, all inside the `has("DAMAGE")` branch (every branch returns `Some`), so the golden count is preserved by construction. Confirmed: 179 unchanged.
- **TS mirror note for Story 1.6:** `DamageTypeBreakdown.damage_type` is a plain `string`. The existing `DAMAGE_TYPE_COLORS` map (in `rarityColors.ts`) keys on the Phase-1 `DamageType` union, which has `bleed` but **not** `necrotic`. The 1.6 UI will need a color token / mapping for `necrotic` (and to decide how to surface the Bleed/Ignite DoT split). No color/type-union changes made in this story (out of scope).

### File List

- `lebo/src-tauri/scoring-core/src/modifier.rs` — `StatKey`: added `IncreasedNecroticDamage`, `IncreasedBleedDamage`, `IncreasedIgniteDamage`, `StunChance`.
- `lebo/src-tauri/scoring-core/src/stat_sheet.rs` — extended `OffenseStats`; added `DamageTypeBreakdown`.
- `lebo/src-tauri/scoring-core/src/lib.rs` — exported `DamageTypeBreakdown`.
- `lebo/src-tauri/scoring-core/src/compute/offense.rs` — per-type breakdown, stun chance, new keys in `DAMAGE_STAT_KEYS`, `increased_and_more` helper, co-located tests.
- `lebo/src-tauri/scoring-core/src/compute/penetration.rs` — `compute_penetration` + `penetration_multiplier`, co-located tests.
- `lebo/src-tauri/scoring-core/src/compute/mod.rs` — wired penetration into `compute_stats`; added penetration parity/linearity tests.
- `lebo/src-tauri/src/services/game_data_loader.rs` — `tags_to_stat_key` remap (Necrotic/Poison split, Bleed, Ignite); added `damage_tag_remap_lands_on_new_keys` test.
- `lebo/src/shared/types/statSheet.ts` — mirrored new `OffenseStats` fields + `DamageTypeBreakdown` interface.
- `lebo/src/features/stat-sheet/StatSheetPanel.test.tsx` — extended `makeStatSheet()` offense literal with new fields.

## Change Log

| Date | Change |
|------|--------|
| 2026-06-02 | Story 1.2 created (ready-for-dev): offense per-damage-type increased/more + stun + penetration, StatKey/OffenseStats extension, loader Necrotic/Bleed remap, TS type mirror. Decisions: model 7 real LE damage types with DoT split (Bleed/Ignite/Poison as DoT variants, drop "Corruption"); penetration via real LE linear mechanic against a 0%-resistance reference target (`damage × (1 + pen/100)`), which preserves Phase-3 parity for no-penetration builds. |
| 2026-06-02 | Story 1.2 implemented (review): added `IncreasedNecroticDamage`/`IncreasedBleedDamage`/`IncreasedIgniteDamage`/`StunChance` keys; per-type `damage_types` breakdown with Ignite/Bleed DoT split; stun chance; `compute/penetration.rs` (linear, 0% reference target); loader tag remap (golden count 179 preserved); TS mirror. StunChance modeled but not loader-wired (would break golden count). Verified: scoring-core 81/81, loader golden+remap green, TS strict build green, vitest 1026 pass / 14 pre-existing baseline failures (no new). |

## Review Findings

_Adversarial code review 2026-06-02 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). 1 decision-needed, 1 patch, 6 deferred, 5 dismissed as noise._

- [x] [Review][Decision → DEFERRED] Penetration is structurally implemented but never sourced — AC4 "applied to score" deferred to a dedicated story — `compute_penetration`/`penetration_multiplier` are correct in isolation, but `game_data_loader.rs::tags_to_stat_key` has **no `PENETRATION` branch**, so `FirePenetration`/`ColdPenetration`/`LightningPenetration`/`PhysicalPenetration` (modifier.rs:67-70) are never produced for any real build. `pen_mult` is therefore always `1.0` and `elemental_penetration`/`physical_penetration` always `0.0` in production — the "byte-identical to Phase 3" parity passes precisely *because* penetration does nothing. **Resolution (Alec, 2026-06-02):** correct sourcing cannot be a review patch — two hard constraints surfaced from the shipped data: (1) the dominant penetration tags are Void/Holy/Chaos/Elemental, which have **no StatKeys** (and Holy/Chaos aren't even modeled LE types); (2) the loader is **one-stat + one-value per effect** (`parse_node_effects` → single `tags_to_stat_key` + first-number `extract_value`), so the common `"+X% Y Damage. +Z% Y Penetration"` nodes cannot emit penetration without dropping their damage contribution (breaking aggregate parity) or misreading the damage % as the pen %. Proper sourcing therefore needs a **parser-split** (1 effect → N modifiers) + new pen StatKeys + an Elemental-pen model + a re-derived golden baseline + Phase-3 parity re-verify. Deferred to a dedicated story (logged in `deferred-work.md`). The correct, tested penetration math stays in `scoring-core` for that story to wire. Sub-issues (modifier_type filter, hybrid multiplicative compounding, `.trim()`) ride along with that work.
- [x] [Review][Patch] Penetration multiplier bypasses the `.max(0.01)` damage floor — APPLIED [compute/penetration.rs `penetration_multiplier`] — `compute_offense` floors `damage_score` at `.max(0.01)` (offense.rs:74), but the orchestrator's `offense.damage_score *= pen_mult` runs *after* `compute_offense` returns, bypassing that floor; a net-negative penetration could flip the score negative. **Fix applied:** clamped each penetration channel multiplier with `.max(0.0)` in `pen_to_mult` (net pen below −100 = enemy immunity = ×0, never negative). Added regression test `negative_penetration_floors_multiplier_at_zero`. Verified: `cargo test -p scoring-core` → **82 passed, 0 failed**.
- [x] [Review][Defer] `DAMAGE`+`PENETRATION` class-node tags are mis-scored as increased damage [game_data_loader.rs tags_to_stat_key] — deferred, pre-existing — nodes like `["VOID","DAMAGE","PENETRATION"]` hit the `has("DAMAGE")` branch and route to `IncreasedVoidDamage`; pure `["FIRE","PENETRATION"]` nodes fall through to `None`. The loader had no `PENETRATION` branch before 1.2, so this is not a regression; resolved by the penetration-sourcing decision if it routes that way.
- [x] [Review][Defer] `StunChance` never produced by the loader; `Flat`-only filter will drop the default `Increased` type when wired [offense.rs:132 / game_data_loader.rs] — deferred, documented in Task 2 — knowingly deferred (a `STUN` mapping would break the golden count of 179). Tracked in MEMORY `project_stun_chance_unsourced`. Note for the future wiring story: the consumer filters `ModifierType::Flat` only, but the loader's missing-field fallback is `Increased`, so naive wiring would silently yield 0.
- [x] [Review][Defer] "Byte-identical" parity is theoretically fragile under float non-commutativity [compute/mod.rs build_registry] — deferred, pre-existing — modifiers are added while iterating `HashMap`s, and `sum`/`product` are not associative in IEEE-754; run-to-run `damage_score` bytes could differ. Pre-existing (registry build predates 1.2); Phase-3 parity tests currently pass.
- [x] [Review][Defer] `damage_type: "necrotic"` has no `DAMAGE_TYPE_COLORS` token [rarityColors.ts] — deferred, Story 1.6 scope — already documented in Completion Notes; the 1.6 UI must add a `necrotic` color token and decide how to surface the Bleed/Ignite DoT split.
- [x] [Review][Defer] `More`-typed per-type/DoT mods appear in the breakdown but never reach the aggregate `damage_score` [offense.rs:66-71] — deferred, not a regression — the aggregate `more_factor` only multiplies `StatKey::MoreDamage`; a `More`-typed `IncreasedFireDamage`/`IncreasedIgniteDamage` shows in `fire.more`/`more_dot` but does not move the score. Aggregate behavior is unchanged from Phase 3; no current data path produces such a mod. Informational for the 1.6 UI.
- [x] [Review][Defer] `IGNITE` checked before `FIRE` in the remap — verify no generic fire-hit node is co-tagged `IGNITE` [game_data_loader.rs] — deferred, dev-tested intent — aggregate parity is preserved (both keys are in `DAMAGE_STAT_KEYS`) and the DoT-before-parent ordering is intentional, but a generic "increased fire damage" node that happens to carry an `IGNITE` tag would shift from the fire-hit bucket to the fire-DoT bucket. Spot-check the shipped JSONs to confirm none exist.
