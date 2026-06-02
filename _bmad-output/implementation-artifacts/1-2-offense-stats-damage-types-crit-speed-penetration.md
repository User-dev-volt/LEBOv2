# Story 1.2: Offense stats — damage types, crit, speed, penetration

Status: ready-for-dev

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

- [ ] **Task 1 — Extend `StatKey` for the missing damage types and stun (AC: 1, 2)** — `scoring-core/src/modifier.rs`
  - [ ] Add damage-type variants absent today: `IncreasedNecroticDamage`, `IncreasedBleedDamage` (physical DoT ailment), and a DoT-side key set only where the data warrants it (see Dev Notes "Damage types: what the data actually has"). **Do not** add a `Corruption` damage type — DECIDED: it is not a player damage type in Last Epoch and is dropped from the per-type model. Model the 7 real LE types; represent Bleed/Ignite/Poison as DoT variants under their parent type.
  - [ ] Add `StunChance` for FR-2.
  - [ ] Per-type **More** needs **no new keys** — a "More Fire Damage" node already loads as `NodeEffect { stat_key: IncreasedFireDamage, modifier_type: More }`. Split increased vs more by `modifier_type` at query time, exactly as the aggregate `compute_offense` already does for generic damage.
- [ ] **Task 2 — Update the loader tag→StatKey mapping for the new types (AC: 1)** — `src-tauri/src/services/game_data_loader.rs` `tags_to_stat_key`
  - [ ] Today `NECROTIC` is mapped to `IncreasedPoisonDamage` (line ~235) and `BLEED`/`CORRUPTION` have no mapping (fall through to generic `IncreasedDamage`). Remap `NECROTIC` → `IncreasedNecroticDamage` and add `BLEED` → `IncreasedBleedDamage`. This changes *which* StatKey an effect lands on, **not the effect count** — the `shipped_class_json_effect_count_is_stable` golden test (179) must still pass. Verify it does after the remap.
  - [ ] Add the new keys to the offense aggregate list (Task 3) so the generic `damage_score` total is unchanged by the remap (Necrotic currently feeds the aggregate via `IncreasedPoisonDamage`, which is in `DAMAGE_STAT_KEYS`; moving it to its own key requires adding that key to the aggregate list to preserve the sum).
  - [ ] If you add a `STUN`/`STUN_CHANCE` tag mapping, confirm against real tags before adding (grep the class JSONs); do not invent tags the data never emits.
- [ ] **Task 3 — Implement per-damage-type offense in `compute/offense.rs` (AC: 1, 5)**
  - [ ] Keep the existing aggregate `damage_score` / `avg_hit_damage` / `avg_hit_damage_crit_weighted` path exactly as-is (parity gate).
  - [ ] Add a per-type breakdown computed by querying each `IncreasedXDamage` StatKey and splitting `increased` (sum of `Increased`-typed `.value`) from `more` (product of `More`-typed `.value`), reusing the same math shape the aggregate uses (`product()` on empty = 1.0).
  - [ ] Populate the new `OffenseStats` fields (see "OffenseStats shape" in Dev Notes). Keep `DAMAGE_STAT_KEYS` as the single source for the aggregate; add the new keys to it.
- [ ] **Task 4 — Stun chance, AoE, speed pass-through (AC: 2, 3)** — `compute/offense.rs`
  - [ ] Compute `stun_chance` from `StatKey::StunChance` (sum of Flat `.value`, clamp `[0, 100]` — mirror the crit-chance pattern). Default 0 when no modifiers.
  - [ ] Leave attack/cast speed and AoE logic unchanged.
- [ ] **Task 5 — Implement `compute/penetration.rs` (AC: 4, 5)**
  - [ ] Add `pub(super) fn compute_penetration(registry, active) -> (...)` returning elemental + physical penetration. Elemental = the combined fire/cold/lightning penetration figure per FR-4 ("Elemental Penetration … separately" from physical); decide whether elemental is one summed value or surfaced per-element (see Q2) — default: one `elemental_penetration` (max or sum of the three; document the choice) + `physical_penetration`.
  - [ ] Wire penetration into the scored damage per the LE linear mechanic (Dev Notes "Penetration model"): `damage × (1 − (ENEMY_RES_BASELINE − pen)/100)`, baseline `0.0`. Apply elemental penetration to elemental-typed scored damage and physical penetration to physical-typed, selecting the type from `primary_offense_damage_elements`. Call it from `compute/mod.rs::compute_stats` after offense, before assembling `ScoreComponents`, OR return it from offense — pick the layout that keeps `mod.rs` orchestration readable. `mod penetration;` is already declared — just fill the file.
- [ ] **Task 6 — Extend the `OffenseStats` struct + TS mirror (AC: 1, 2, 4)**
  - [ ] `scoring-core/src/stat_sheet.rs`: add the new fields to `OffenseStats` (keep `#[derive(Default)]` valid — all new fields must be `Default`-able; use `Vec`/`f64`/`Option`).
  - [ ] `lebo/src/shared/types/statSheet.ts`: mirror the new fields **exactly** in snake_case (Pattern 2 / project-context rule — never camelCase Rust-output types). Add any new sub-interface (e.g. `DamageTypeBreakdown`).
  - [ ] Keep `lebo/src/features/stat-sheet/StatSheetPanel.tsx` and its `StatDeltas`/`computeStatDeltas` compiling — the new fields are optional to *display* here (Story 1.6 owns the layout), but the TS types must still satisfy strict mode. Do **not** delete or rename existing fields.
- [ ] **Task 7 — Tests (AC: 1, 2, 4)** — co-located in `compute/offense.rs` and `compute/penetration.rs` `#[cfg(test)]` blocks
  - [ ] Per-type isolation: a build with only `IncreasedFireDamage` shows fire increased > 0 and cold/lightning/etc. increased == 0 (proves no cross-type bleed).
  - [ ] Per-type more: a `More`-typed fire node yields fire `more` as a multiplier, not folded into `increased`.
  - [ ] Stun chance: sum + clamp to 100; 0 when absent.
  - [ ] Penetration: elemental vs physical separated; a no-penetration build's `damage_score` is byte-identical to Phase-3 (multiplier 1.0); a build with N% penetration on its primary element scales scored damage of that type by `(1 + N/100)` linearly.
  - [ ] Necrotic remap regression: a `["NECROTIC","DAMAGE"]` node lands on `IncreasedNecroticDamage` and still contributes to the aggregate `damage_score` (sum preserved).
- [ ] **Task 8 — Verify (AC: all)**
  - [ ] `cargo test -p scoring-core` (from `lebo/src-tauri/`) — all Phase-3 regression tests byte-identical + new tests green.
  - [ ] `cargo test -p lebo` — loader `shipped_class_json_effect_count_is_stable` still 179.
  - [ ] `pnpm build` + `pnpm vitest` (from `lebo/`) — TS strict compile passes with the extended `statSheet.ts`; confirm the 14 known-pre-existing UI failures (per Story 1.1) are unchanged and no *new* failures appear.

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

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-06-02 | Story 1.2 created (ready-for-dev): offense per-damage-type increased/more + stun + penetration, StatKey/OffenseStats extension, loader Necrotic/Bleed remap, TS type mirror. Decisions: model 7 real LE damage types with DoT split (Bleed/Ignite/Poison as DoT variants, drop "Corruption"); penetration via real LE linear mechanic against a 0%-resistance reference target (`damage × (1 + pen/100)`), which preserves Phase-3 parity for no-penetration builds. |
