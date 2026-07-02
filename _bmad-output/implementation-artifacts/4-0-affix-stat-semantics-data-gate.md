# Story 4.0: Affix stat-semantics data gate (upstream re-transform)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player equipping gear,
I want every equipped affix to contribute its real stat — correct `StatKey`, correct modifier type, and correct per-tier value — to my stat sheet and to gear suggestions,
so that the gear numbers I see are true instead of silent zeros.

> This is the **Epic 4 data gate**. It is not a feature — it is the correctness foundation the rest of Epic 4 stands on. Today the affix corpus has no stat semantics and the scoring engine's affix map is empty, so **equipped gear contributes exactly 0 to `compute_stats` and every gear slot returns an empty wishlist**. The item-picker/affix-picker/DnD/AI stories (4.2–4.6) are gated on this and on 4.1; building them first would produce UI that looks finished while scoring silent zeros. [Source: epics.md#Epic 4 implementation note; correct-course-2026-07-01-audit.md §1b]

## Acceptance Criteria

Verbatim from epics.md (Story 4.0), lightly reformatted:

**AC1 — The upstream transform retains stat semantics (the re-runnable gate)**
**Given** the item-data pipeline (`docs/data-transform/generate_item_db.py`)
**When** it is extended and re-run against its PoB4LE source
**Then** it retains the per-affix stat text it currently discards and emits, for every affix: a `statKey` resolvable to an engine `StatKey`, a correct `modifierType` (not blanket `"increased"`), per-tier value ranges, a human-readable name, and an `itemSlots` validity list — and the transform is a committed, re-runnable script (the per-patch refresh path), not a one-off edit.

**AC2 — Automated coverage gate with real counts**
**Given** the regenerated dataset
**When** an automated coverage check runs (a committed script or test, not eyeballing)
**Then** it enforces these exit gates, each reported with actual counts:
- ≥95% of affixes have a resolved `statKey` (the unmapped remainder explicitly listed in the data manifest);
- no `unnamed-*` machine names remain in picker-visible data;
- 100% of affix references from shipped uniques resolve;
- base-item implicits are populated or their deferral recorded per item class;
- `itemSlots` is non-empty for every picker-visible affix.

**AC3 — The loader ingests it and gear scoring uses slot validity**
**Given** the corrected dataset
**When** `game_data_loader.rs` ingests it
**Then** `GameData.gear_affixes` is populated from it (today an empty `HashMap`, so gear contributes nothing to any score) **and** `gear.rs` gains a slot-validity model so per-slot wishlists differ by slot (today all 12 slots produce identical wishlists).

**AC4 — End-to-end value-level scoring parity (the proof)**
**Given** a build with a known item and known affix tiers equipped
**When** `compute_stats` runs
**Then** element+value tests assert the exact expected stat contributions end-to-end. (Source-Audit discipline: this story exists to make the gear stat source REAL — the parity test is the proof, per project memory `source-audit-at-create-story`.)

---

## Tasks / Subtasks

- [ ] **Task 1 — Extend the upstream transform to retain affix stat semantics (AC1)**
  - [ ] In `docs/data-transform/generate_item_db.py::transform_affixes` (`:184-233`), stop discarding the stat identity. The ModItem source rows carry stat text in fields `"1"`/`"2"` (read at `:203-204` as `stat1`/`stat2`); today only `stat1`'s numeric range feeds `tiers` (`:214-215`) and the emitted object (`:225-231`) drops everything else.
  - [ ] Add a committed **stat-text → `statKey` + `modifierType`** derivation table (regex/keyword rules over the LE mod phrasing) mapping to the canonical scoring `StatKey` vocabulary (70 variants, `modifier.rs:5-101`) and the correct `ModifierType`: `"X% increased …"` → `increased`, `"+X …"` / `"X added …"` → `flat`, `"X% more …"` → `more`, conversions → `conversion`. Emit `statKey` as the **snake_case** string the loader's resolver consumes (see Task 3, Decision **D1**); emit `null` when unmapped.
  - [ ] Emit, for every affix: `statKey` (or `null`), real `modifierType`, existing numeric `tiers` (kept), a human-readable `name` sourced from ModItem (no `unnamed-*` in picker-visible data), and `itemSlots` (applicable-slot list — see Decision **D2** for its source).
  - [ ] Replace the placeholder annotation pass. `lebo/scripts/annotate_s4_affixes.py` sets `modifierType` to the constant `"increased"` (`:140-141`) and derives `scope`/`damageType` from **name keywords** (`SCOPE_RULES`/`DAMAGE_TYPE_RULES`, `:17-32`); its own summary admits this (`:162`). Fold this into `generate_item_db.py` (or make it derive from stat text, not the name) so `modifierType`/`scope`/`damageType` are authoritative, not heuristic. **Keep the 5 hand-authored "Rune of Corruption" affixes** (the only entries with real `itemSlots` today).
  - [ ] Keep the whole thing a **single committed, re-runnable script** (the per-patch refresh path). Re-running against a fresh PoB4LE pull (`generate_item_db.py:24` — `Musholic/PathOfBuildingForLastEpoch` `src/Data/ModItem.json`) must reproduce the dataset deterministically — no manual post-edits.
- [ ] **Task 2 — Automated coverage gate with counts + a committed manifest (AC2)**
  - [ ] Add a committed coverage-check (script under `docs/data-transform/` or a test — **not** eyeballing) that runs over the regenerated dataset and **fails** if any exit gate is unmet, printing **actual counts** for each: statKey-resolved %, `unnamed-*` count in picker-visible data, unique-ref resolution %, implicit population/deferral per item class, and `itemSlots`-non-empty count for picker-visible affixes.
  - [ ] Define **"picker-visible"** explicitly and use it as the escape hatch that reconciles the gates: an affix is picker-visible iff it has a resolved `statKey`, a real name (no `unnamed-*`), and non-empty `itemSlots`. The unmapped/tail affixes are **excluded from picker visibility** and listed in the manifest — this is how the ≥95% statKey gate coexists with the "100% for picker-visible" gates.
  - [ ] Resolve unique-item affix references: every affix id referenced by shipped uniques (`uniques.json`) must resolve to a real corpus affix (audit found all 2,338 unresolvable). Populate base-item implicits (`bases.json`) or record their per-item-class deferral in the manifest (audit found 897/897 empty). See Decision **D3**.
  - [ ] Commit the **data manifest** (unmapped-affix list + per-item-class implicit deferrals + the run's counts) alongside the dataset so the coverage state is inspectable and diffable.
- [ ] **Task 3 — Populate `GameData.gear_affixes` in the loader (AC3)**
  - [ ] In `lebo/src-tauri/src/services/game_data_loader.rs`, replace `gear_affixes: std::collections::HashMap::new()` (`:184`) with a real ingestion that reads `affixes.json` (same `data_dir` path `item_data_service.rs:41-55` uses) and builds `HashMap<String, GearAffixData>` keyed by affix `id`.
  - [ ] **Mirror the idol precedent** (`:123-139`): resolve the affix's `statKey` string → `StatKey` via `stat_key_from_str` (`:519-557`) — **extend that resolver** to cover the `StatKey` variants gear needs (it maps 34 idol keys today; gear draws from the full 70). Average each tier's `minValue`/`maxValue` into `values_by_tier` (the idol averaging idiom at `:128-132`). Parse `modifierType`/`scope`/`type` via the tolerant `ModifierType`/`Scope`/`AffixPosition::from_data_str` boundary constructors (`modifier.rs:114-122, 141-150, 188-194`). Set `affix_class` from the corpus `type` (prefix/suffix — already present). Set `damage_elements` from `damageType`. Set the new slot-validity field from `itemSlots` (Task 4).
  - [ ] Add `#[serde(default)] pub stat_key: Option<String>` (and any other new fields) to `RawAffix` (`lebo/src-tauri/src/models/item_data.rs:11-26`) so **both** the item-DB path and the loader read the enriched corpus. This is additive and back-compatible — the item-search path (`item_data_service.rs`) simply ignores `stat_key`.
  - [ ] Affixes whose `statKey` is `null`/unresolvable are **skipped** (not inserted). Never insert a `GearAffixData` whose `stat_key` no `compute/*` module consumes — the ≥95% gate + manifest own the tail (see `## Source Audit` — no dead `StatKey`).
  - [ ] **Purity boundary:** this file I/O + string→enum resolution lives in the **Tauri crate** (`game_data_loader.rs`), never in `scoring-core` (`architecture.md:570` — scoring-core is data-in/data-out, no I/O). Constructing the scoring-core `GearAffixData`/`GameData` from the Tauri crate is the established pattern (idols/blessings already do it).
- [ ] **Task 4 — `gear.rs` slot-validity model (AC3)**
  - [ ] Add a slot-validity field to `GearAffixData` (`lebo/src-tauri/scoring-core/src/game_data.rs:8-23`), e.g. `pub item_slots: Vec<String>`, populated by Task 3 from the corpus `itemSlots`.
  - [ ] In `gear.rs::score_slot` (`:132-189`), filter candidate affixes to those whose `item_slots` includes the slot being scored, so per-slot wishlists **differ by slot** (today all 12 canonical slots at `gear.rs:11-14` produce identical wishlists because there is no filter). An affix with empty/absent `item_slots` is treated as valid on all slots (back-compat), but AC2 requires picker-visible affixes to be slotted, so this fallback should be rare.
  - [ ] This is engine logic → it belongs in `scoring-core`. Keep the documented graceful-degradation contract intact (empty `gear_affixes` → empty wishlists, `efficiency_percent: 100.0`) so an unbuilt/partial dataset never panics.
- [ ] **Task 5 — End-to-end value+element scoring-parity test (AC4)**
  - [ ] Add a `scoring-core` test that constructs a `BuildSnapshot` with a **known item and a known affix** (`affixId` + `tier`, using a real corpus id, e.g. `affix-inevitable-prefix`) equipped, runs `compute_stats` against a `gear_affixes` map populated the same way the loader populates it, and asserts the **exact** expected `StatSheet` contribution — value + element (e.g. tier-N `IncreasedFireDamage` value V → the offense fire increased delta equals V). Not a count.
  - [ ] Assert **source attribution**: with `ComputeOptions { track_sources: true }`, the contribution is attributed to `"{slot_id}:{affix_id}"` in `stat_sources` (proves the source is real, ADR-P4-D-P4-3).
  - [ ] **No-dead-`StatKey` guard:** assert that each distinct `StatKey` the loader emits, when equipped, actually moves a `StatSheet` field (no silently-inert produced key). Any `StatKey` no `compute/*` module consumes (e.g. `StunChance` — see memory `stun-chance-inert-unowned`) must be **excluded from emission** and recorded in the manifest, not shipped as a dead key.
  - [ ] A golden `shipped_affix_count`-style test alone is **insufficient** (VERIFICATION guardrail): it proves how many parsed, not whether any parsed correctly. Value+element assertions over real corpus entries are mandatory.
- [ ] **Task 6 — Regression + build/test green**
  - [ ] `cargo test -p scoring-core` (engine regression: idol/blessing/node contributions and the EHP ±2% tunklab parity gate `tests/ehp_reference.rs` must stay green — Task 4 is additive, do not perturb them) and `cargo test -p lebo` (loader) green. The transform + coverage scripts run clean.
  - [ ] `pnpm build` (tsc + vite) clean; full `pnpm vitest` shows **no new failures** vs the standing baseline (ProviderSelector / Settings / TreeControls — `SkillTreeCanvas` was cleared from the baseline in Story 3.5).
  - [ ] Populating `gear_affixes` (empty → real) will change gear-scoring output and any test that asserted empty wishlists / `upgrade_score 0.0` / `efficiency 100%`. **Update those to value+element assertions** — do not re-pin them to a new count.

---

## Dev Notes

### What this story is (and is not)

This is a **data + ingestion** story. The scoring engine is already built and correct — **do not rebuild it.** The single reason gear scores zero is that the affix corpus has no stat identity and the engine's affix map is never populated. Fix the data and the wiring; the math already works.

- **IN scope:** the Python transform (retain stat text → emit statKey/real modifierType/tiers/name/itemSlots), the coverage gate + manifest, the loader ingestion into `gear_affixes`, a slot-validity field + `gear.rs` per-slot filter, and the end-to-end parity test.
- **OUT of scope (Story 4.1):** the `position: 'prefix' | 'suffix'` field on `AffixEntryV2` + the serializer emitting it (AR-2/AR-15), and the `lib.rs` re-exports of `GearSlotRanking`/`WishlistAffix` (AR-16). 4.0 sets `GearAffixData.affix_class` from the corpus `type` (already present) for scoring; 4.1 is what threads prefix/suffix through the **frontend snapshot**. The stale `MODELS.len() == 4` test is **already fixed** (correct-course §3 → 7). [Source: epics.md#Story 4.1; correct-course-2026-07-01-audit.md §3]
- **OUT of scope:** any React/UI change, Item/Affix Picker modals, gear pips, the DnD workspace, AI gear analysis (4.2–4.6), and the `BuildScore`→tunklab-EHP re-baseline (a separate deferred story — see the risk flag below).

### The two disjoint pipelines (ground truth — verified at HEAD)

There are **two affix paths that never join**, which is why enriching only one fixes nothing:

1. **Item-search path (loaded, but no stat identity):** `item_data_service.rs:41-55` reads `affixes.json` → `Vec<RawAffix>` → `ItemDatabase`, feeding the gear typeahead/search UI only. `RawAffix` (`models/item_data.rs:11-26`) has **no `stat_key`**. Never reaches the scoring engine.
2. **Scoring path (what the engine reads — hardcoded empty):** `game_data_loader.rs:184` sets `gear_affixes: HashMap::new()`. No code populates it. `GameData.gear_affixes: HashMap<String, GearAffixData>` is what `compute_stats` and `gear.rs` actually consume.

Story 4.0 makes path #2 real: enrich the corpus with `statKey` and populate `gear_affixes` from it in the loader.

### The engine is already built — DO NOT reinvent it

- **`GearAffixData`** (`scoring-core/src/game_data.rs:8-23`): `{ display_name, stat_key: StatKey, modifier_type: ModifierType, values_by_tier: HashMap<u32,f64>, affix_class: AffixPosition, scope: Scope, damage_elements: Vec<String> }`. Its doc comment already says it is "initially empty; populated from affix DB when the full affix pipeline is integrated" (`:139-142`) — that integration is this story.
- **The stat-sheet contribution loop already exists** — `compute/mod.rs:197-207` (`build_registry`): for each equipped affix it does `game_data.gear_affixes.get(&entry.affix_id)` then `effect.values_by_tier.get(&entry.tier)`, and on a hit calls `registry.add(Modifier { stat_key, modifier_type, value, … })`. Today the map is empty so the `else { continue }` **silently drops every affix**. Populate the map and this loop lights up with zero engine changes.
- **`gear.rs` scoring already uses real per-tier values** routed through `stat_key`: `run_gear_scoring` injects each affix at its best tier into a cloned snapshot and diffs `compute_stats` for a ΔBuildScore weight (`compute_weight`, `:79-99`; `best_tier_value`, `:118-128`). It degrades gracefully when the map is empty. Its unit tests (`gear.rs:295-361`) hand-build `GearAffixData` with explicit `stat_key`s — proving the engine works, but only on synthetic data.
- **Precedent to mirror (idols):** idols already do exactly what gear needs — `game_data_loader.rs:123-139` populates `idol_affixes` from `idol-data.json`, resolving stat keys via `stat_key_from_str` (`:519-557`) and averaging tiers into `values_by_tier` (`:128-132`). Copy this shape for gear.

### The crux — where `statKey` comes from

The corpus has **no `statKey`** (0/4,176). The source stat text exists upstream: ModItem rows carry the stat phrasing in fields `"1"`/`"2"`, which `generate_item_db.py` reads as `stat1`/`stat2` (`:203-204`) but uses only for numeric tier ranges (`:214-215`), discarding the identity. The work is a **stat-text → `StatKey` + `ModifierType`** derivation:

- Build a committed mapping table (keyword/regex over LE phrasing) in the Python transform → emit the canonical **snake_case** `statKey` string that the loader's `stat_key_from_str` resolves. Reuse one vocabulary end-to-end: Python emits the string, Rust resolves it. (Decision **D1**.)
- The ≥95% gate acknowledges a long tail won't map cleanly; those emit `statKey: null`, are excluded from picker visibility, and are listed in the manifest.
- `ModifierType` is derived from phrasing shape, not assumed: `%-increased` → `increased`, `+X`/`added` → `flat`, `more` → `more`, conversions → `conversion`. This directly fixes the "all `increased`" defect that would mis-model every flat affix (`+Max HP`, `+Armor`, flat added damage).

### Source tree — files to touch

| File | Change | AC |
|---|---|---|
| `docs/data-transform/generate_item_db.py` | Retain stat text; emit `statKey`/real `modifierType`/`tiers`/`name`/`itemSlots`; resolve unique refs + implicits; single re-runnable script | AC1, AC2 |
| `lebo/scripts/annotate_s4_affixes.py` | Fold into the transform or make derivations authoritative (replace constant `modifierType` + name-heuristic scope); keep the 5 ROC affixes | AC1 |
| `docs/data-transform/` (new coverage script) + committed **manifest** | Automated exit-gate check with actual counts; unmapped list + implicit deferrals | AC2 |
| `lebo/src-tauri/resources/items/affixes.json` (+ `uniques.json`, `bases.json`) | Regenerated dataset (artifact of the transform) | AC1, AC2 |
| `lebo/src-tauri/src/models/item_data.rs` | Add `#[serde(default)] stat_key: Option<String>` (+ any new fields) to `RawAffix` (additive/back-compat) | AC3 |
| `lebo/src-tauri/src/services/game_data_loader.rs` | Populate `gear_affixes` from `affixes.json` (mirror idol path); extend `stat_key_from_str` to cover gear `StatKey`s | AC3 |
| `lebo/src-tauri/scoring-core/src/game_data.rs` | Add slot-validity field (`item_slots: Vec<String>`) to `GearAffixData` | AC3, AC4 |
| `lebo/src-tauri/scoring-core/src/gear.rs` | `score_slot` filters candidates by slot validity → per-slot wishlists differ | AC3 |
| `scoring-core` test (e.g. new `tests/gear_affix_parity.rs` or in `gear.rs`) | End-to-end value+element parity + source attribution + no-dead-key guard | AC4 |

**Do not touch:** `scoring-core/src/compute/*` math modules (the registry already consumes gear modifiers — Pattern P4-1), `compute/mod.rs` `build_registry` gear loop (`:197-207` — it already works), `buildSnapshotSerializer.ts` (Story 4.1 owns the `position` emit), `AffixEntryV2`/`GearItemV2` (`build.ts` — 4.1), `lib.rs` `invoke_handler!`/re-exports (4.1/AR-16), any React component, and any store. No new Tauri command (both `compute_stats` and `run_gear_scoring` already exist and are registered).

### Governing patterns / ADRs (do not violate)

- **Pattern P4-1 — stat math reads the registry, never the snapshot.** New stats = new `StatKey` variants + new modifier **registrations**, never a new direct-read path. This story adds *registrations* (via the populated `gear_affixes` feeding `build_registry`), not new read paths. [Source: architecture.md#Pattern P4-1 (:355-366)]
- **ADR-P4-001 — scoring-core module split; `compute/mod.rs` is the sole orchestrator and `build_registry` the sole attribution point.** Do not attribute gear modifiers anywhere else. [architecture.md:122-146]
- **Purity boundary — `scoring-core` does no I/O.** All file reads + string→enum resolution for the corpus live in the Tauri crate (`game_data_loader.rs`). [architecture.md:570]
- **ADR-P4-D-P4-1 — `ModifierType` is a real serde enum; unknown/absent → `Increased`.** Emit real modifier types; rely on the fallback only for genuinely-unknown entries. [architecture.md:150-167]
- **Rust output is snake_case via serde; `StatKey` serializes PascalCase via `stat_key_key()` (`modifier.rs:107-112`).** The `affixes.json` `statKey` string is an *input* to the loader's resolver, not a serde round-trip of the enum — keep it snake_case to match `stat_key_from_str` (Decision D1). [project-context.md]

### Known risk — gear weights ride the legacy EHP metric (flag, not in-scope)

`gear.rs` weights affixes by ΔBuildScore, and `compute/mod.rs:41-79` still ranks by the legacy `effective_hp` rather than the tunklab-observable EHP triple. The `BuildScore`→tunklab-EHP re-baseline is a **separate deferred story** flagged in the Epic 1 and Epic 3 retros and in correct-course §4.3. It is **not** in 4.0's scope, but be aware gear weights will stack on the legacy metric until it lands; do not silently "fix" the ranking metric here. [Source: correct-course-2026-07-01-audit.md §4.3]

### Testing requirements

Per the project's SOURCE-AUDIT + VERIFICATION guardrails, this story's tests must assert **value + element**, not counts:

- **Rust parity (AC4, mandatory):** a real corpus affix at a known tier, equipped, produces the **exact** expected `StatSheet` delta (correct field/element and correct numeric value), attributed to `slot_id:affix_id` under `track_sources: true`. A `shipped_affix_count`-style golden test is explicitly **insufficient** — it proves parse count, not parse correctness (a mis-valued or mis-element parse leaves the count stable and undetected).
- **No-dead-`StatKey`:** every distinct `StatKey` the loader emits moves a `StatSheet` field when equipped; any inert key (e.g. `StunChance`) is excluded from emission and manifest-recorded, never shipped.
- **Coverage gate (AC2):** the committed check fails on any unmet exit gate and prints actual counts — it is itself a test artifact, not manual inspection.
- **Regression:** `cargo test -p scoring-core` (idol/blessing/node + EHP parity gate unchanged), `cargo test -p lebo`, `pnpm build`, full `pnpm vitest` no new failures vs the standing baseline (ProviderSelector / Settings / TreeControls). Update any empty-wishlist gear test to value+element rather than a count. [project-context.md#Testing Rules]

## Source Audit

**Not N/A — this story's entire purpose is to make a currently-inert stat source REAL.** This is the corpus-scale case the SOURCE-AUDIT guardrail was written for (Epic 1's penetration/stun/minion "computed-but-not-sourced" defect, now the whole gear affix corpus). [memory: `source-audit-at-create-story`, `lebov2-audit-2026-07-01-data-gaps`]

**New/affected stat surface:** every `StatKey` that a gear affix will now feed into the registry (the full damage/crit/speed/defense/penetration/ailment/attribute set drawn from the 70-variant `StatKey` enum, `modifier.rs:5-101`).

**Real shipped-data source (produced):** `lebo/src-tauri/resources/items/affixes.json`, enriched by the committed transform so each affix carries a real `statKey`, `modifierType`, and per-tier `values`. The loader (`game_data_loader.rs`) parses this into `GameData.gear_affixes` — replacing today's `HashMap::new()` (`:184`) — via `stat_key_from_str` (`:519-557`). This is a concrete, re-runnable, per-patch-refreshable source, not a mock. The former "proceed against mock-annotated affixes" authorization is **rescinded** (correct-course §1b). No `#[cfg(test)]`-only or hand-annotated data ships.

**Produced AND consumed (no dead `StatKey`):** a `StatKey` must be both produced by the loader and consumed by a `compute/*` module. The loader **skips** any affix whose `statKey` is `null`/unresolvable (the ≥95% gate + manifest own the tail), and Task 5's no-dead-key guard asserts every emitted `StatKey` moves a `StatSheet` field. Any affix whose natural stat is inert in the current engine (e.g. `StunChance` — `stun_chance` is always 0, no module consumes it; memory `stun-chance-inert-unowned`) is emitted as `statKey: null` and manifest-recorded, **never** inserted as a dead key that would render a wrong/empty number.

**Honest `0.0` / `—` declaration:** affixes that cannot be mapped to a consumed `StatKey` are excluded from picker visibility and listed in the data manifest with the reason — an explicit, inspectable "not yet sourced" state, not a fabricated value.

**Verification is value+element, not a count:** AC4 + Task 5 require exact stat-contribution assertions over real corpus entries and source-attribution checks. A stable golden effect-count is explicitly rejected as sufficient proof (VERIFICATION guardrail).

### Project Structure Notes

- The data transform lives in `docs/data-transform/` (Python, PoB4LE-sourced) and `lebo/scripts/`; the regenerated JSON is a committed artifact under `lebo/src-tauri/resources/items/`. This matches the existing generator layout — no new pipeline location.
- Rust changes span the **Tauri crate** (`services/game_data_loader.rs`, `models/item_data.rs` — I/O + resolution) and one additive field + one filter in **scoring-core** (`game_data.rs`, `gear.rs`). The purity boundary is respected: no I/O added to scoring-core.
- Naming: `stat_key_from_str` is extended in place (single canonical resolver for idol + gear). The new `GearAffixData.item_slots` field mirrors the corpus `itemSlots` and the idol `values_by_tier` idiom. No new store, view, router, or Tauri command.
- No new dependencies (Python stdlib + `requests` already used by the transform; Rust serde/rusqlite already present). No web research required for library versions.

### References

- [Source: epics.md#Epic 4 / Story 4.0 (:751-767)] — AC1–AC4 verbatim, the "data gate" framing, re-runnable-script requirement.
- [Source: epics.md#Epic 4 / Story 4.1 (:775-788)] — the scope fence: `position` discriminator, serializer emit, `GearSlotRanking`/`WishlistAffix` re-exports, stale-test fix all belong to 4.1; 4.2–4.6 gated on 4.0+4.1; mock-affix clause rescinded.
- [Source: epics.md#Epic 4 audit callouts (:734-743)] — two parallel affix paths; "displayed-but-not-sourced trap at corpus scale"; `GearAffixV2` does not exist (use `AffixEntryV2`/`GearItemV2`).
- [Source: correct-course-2026-07-01-audit.md §1b] — the verified defect (0/4,176 statKey, all `increased`, ~86% `unnamed-*`, itemSlots empty on 4,171, 2,338 unique refs unresolvable, 897/897 implicits empty; `generate_item_db.py` discards source stat text; `gear_affixes` empty → gear contributes 0); §3 (stale `MODELS.len()` already fixed); §4.3 (EHP re-baseline risk).
- [Source: architecture.md] — Pattern P4-1 (:355-366, registry-only stat math); ADR-P4-001 (:122-146, module split); purity boundary (:570); ADR-P4-D-P4-1 (:150-167, `ModifierType` enum); ADR-P4-D-P4-2 (:171-177, `position` = 4.1); stat-flow (:536-546).
- [Source: scoring-core/src/game_data.rs:8-23, 139-142] — `GearAffixData` shape + "initially empty" doc comment.
- [Source: scoring-core/src/modifier.rs:5-101, 107-122, 141-150, 188-194] — `StatKey` (70), `ModifierType`, `Scope`, `AffixPosition`, `stat_key_key()`.
- [Source: scoring-core/src/compute/mod.rs:197-207] — the gear affix `build_registry` loop that silently drops on empty map.
- [Source: scoring-core/src/gear.rs:11-14, 79-99, 118-128, 132-189, 295-361] — 12 slots, `compute_weight`, `best_tier_value`, `score_slot` (add slot filter), synthetic unit tests.
- [Source: src-tauri/src/services/game_data_loader.rs:123-139, 128-132, 167, 184, 519-557] — idol ingestion precedent, tier averaging, empty `affix_scope`, the empty `gear_affixes`, `stat_key_from_str`.
- [Source: src-tauri/src/services/item_data_service.rs:41-55] — the other affixes.json read (item-DB path); [src-tauri/src/models/item_data.rs:11-26] — `RawAffix`/`AffixTier` (add `stat_key`).
- [Source: scoring-core/src/build_snapshot.rs:7-21] — `AffixEntry { affix_id, tier }` / `GearSlotSnapshot` (what the snapshot carries).
- [Source: docs/data-transform/generate_item_db.py:24, 184-233, 203-204, 214-215, 225-231] — PoB4LE source, `transform_affixes`, the discard.
- [Source: lebo/scripts/annotate_s4_affixes.py:17-32, 139-148, 162] — heuristic annotation pass to supersede.
- [Source: project-context.md] — IPC/store/testing/naming/purity guardrails; snake_case Rust output; no barrel files.

---

## Open decisions & risks (surface to Alec before/at dev-story)

These have recommended defaults baked into the tasks; confirm the high-risk ones (D2 especially) before deep implementation.

- **D1 — `statKey` representation (recommended):** emit **snake_case** `statKey` strings in `affixes.json` and resolve via a single extended `stat_key_from_str` (the idol resolver, `:519-557`), covering all 70 `StatKey` variants. Rationale: one canonical vocabulary shared by idols + gear; no reliance on `StatKey`'s serde derive. Alternative (emit PascalCase + `serde` deserialize into `StatKey`) is viable only if `StatKey` derives `Deserialize` — the resolver approach is safer and already the house pattern.
- **D2 — `itemSlots` source (BIGGEST RISK — recommend a short spike first):** the transform's own comment says slot filtering is "not in source data," and 4,171/4,176 affixes have empty `itemSlots`. AC2 requires **non-empty `itemSlots` for every picker-visible affix**, so this cannot be skipped. Before committing to the picker-visible target, spike the PoB4LE source to confirm where affix→slot validity lives (likely a mod-pool-per-base-type structure joined via `bases.json`), then build that join. If the slot source turns out to be per-base-type only, "picker-visible" is defined against that join.
- **D3 — uniques refs + base implicits (recommend in-scope, with deferral hatch):** AC2 names both (100% unique-ref resolution; implicits populated or deferred). Treat as in-scope for 4.0 since the gate enforces them, but allow per-item-class implicit **deferral recorded in the manifest** where the source data is genuinely absent. Confirm Alec is fine with implicit deferrals vs. blocking 4.0 on full implicit coverage.
- **D4 — ≥95% statKey feasibility:** the achievable mapping ceiling depends on ModItem stat-text cleanliness. If the realistic ceiling is below 95%, surface the **actual count** from the coverage script and adjust the gate with Alec rather than silently under-reporting — the count is the product signal.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-07-02 | Story 4.0 created (create-story). Epic 4 data gate: re-transform `affixes.json` to carry real `statKey`/`modifierType`/per-tier values/name/`itemSlots`; committed coverage gate + manifest; populate `GameData.gear_affixes` in `game_data_loader.rs` (mirror idol path); add slot-validity to `GearAffixData` + `gear.rs` per-slot filter; end-to-end value+element parity test. Scope-fenced from 4.1 (`position`/re-exports) and the deferred EHP re-baseline. Full `## Source Audit` (non-N/A). Status → ready-for-dev. |
