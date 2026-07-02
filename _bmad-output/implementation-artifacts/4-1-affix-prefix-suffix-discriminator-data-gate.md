# Story 4.1: Affix prefix/suffix discriminator (data gate)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer enabling the gear features,
I want a `position: 'prefix' | 'suffix'` discriminator on affixes end-to-end,
so that the Affix Picker can group correctly and gear scoring sees suffixes.

> **This is the SECOND Epic 4 data gate**, immediately after Story 4.0 (affix stat-semantics). It is small and surgical — **not** the multi-file wiring job the pre-4.0 plan implies. Story 4.0's rewrite (done 2026-07-02) already built the prefix/suffix discriminator on the **corpus + Rust engine** side: the data ships it, the loader ingests it into a real `AffixPosition` enum, and every Rust consumer already reads both prefix and suffix buckets. **The one place the "all affixes are prefixes" bug (AR-15) is still live is the TypeScript build-snapshot serializer**, which forces every equipped affix into `prefixes[]` and hard-codes `suffixes: []`. This story closes that TS gap, adds the matching `position` field to `AffixEntryV2`, and does the AC3 `lib.rs` housekeeping. **Do not re-implement 4.0's engine/loader/data — verify it and build the thin TS layer on top.** [Source: epics.md#Story 4.1 (:769-788); ground-truth verification 2026-07-02]

## Acceptance Criteria

Verbatim from epics.md (Story 4.1, :775-788), each annotated with **HEAD reality** so the dev knows exactly what is already satisfied vs. pending.

**AC1 — The discriminator field (schema)**
**Given** the affix schema
**When** the discriminator is added
**Then** `AffixEntryV2` (TypeScript; the earlier-draft `GearAffixV2` type does not exist — use `AffixEntryV2`/`GearItemV2`) and the Rust affix type gain a `position` field populated by the data-ingestion pipeline, with an absent value treated as `prefix` (back-compatible) (AR-2).

> **HEAD reality:** **TS side PENDING** — `AffixEntryV2` (build.ts:9-16) has no `position`. **Rust side ALREADY SATISFIED** — the corpus affix type `GearAffixData.affix_class: AffixPosition` (game_data.rs:22-23) is a real enum populated by the loader (game_data_loader.rs:225-229,257), and the `AffixPosition` enum already implements absent→`Prefix` (modifier.rs:191 `#[default] Prefix`, :199-204 `from_data_str`). The equipped-affix snapshot type `build_snapshot::AffixEntry` encodes position **structurally** (which of the two `GearSlotSnapshot` vecs it lives in), not as a field — see Decision **D1**: do **not** add a redundant `position` field to the Rust `AffixEntry`.

**AC2 — The serializer emits it (the real AR-15 fix)**
**Given** `buildSnapshotSerializer.ts`
**When** it serializes gear
**Then** it emits each affix's `position`, so `detect_mismatched_affixes` and `gear.rs` see suffixes (resolving the "all affixes classified as prefixes" deferred-work item, AR-15).

> **HEAD reality:** **TS side PENDING (this is the story's core)** — `toGearSlots` (buildSnapshotSerializer.ts:155-171) forces `prefixes: validAffixes` and hard-codes `suffixes: []` (:166-167, comment "no prefix/suffix distinction yet — all to prefixes"). **Rust consumers ALREADY see suffixes** — `compute/mod.rs:198`, `gear.rs:232-235/253-255`, and `synergy.rs:221` (where `detect_mismatched_affixes` actually lives — **not** gear.rs) already iterate `prefixes.iter().chain(suffixes.iter())`. So AC2 = populate the **existing** `suffixes[]` array; no Rust consumer change. (Nuance: `detect_mismatched_affixes` branches on delivery-**scope**, not prefix/suffix, and is inert today because `affix_scope` is empty — a Story 4.2 concern, out of scope here.)

**AC3 — Rust lib surface + gate on downstream**
**Given** the Rust lib surface
**When** this story completes
**Then** `GearSlotRanking` and `WishlistAffix` are re-exported from `lib.rs` and the stale `MODELS.len() == 4` test is corrected (AR-16)
**And** downstream gear engine and UI work (4.2–4.6) does NOT begin until Stories 4.0 and 4.1 are both done — the former "proceed against mock-annotated affixes" clause is rescinded.

> **HEAD reality:** **Re-exports PENDING** — `lib.rs:26-29` re-exports 12 `stat_sheet` types but omits `GearSlotRanking` (stat_sheet.rs:161) and `WishlistAffix` (stat_sheet.rs:170); both are already `pub`, so the re-export compiles. **Stale test ALREADY FIXED (verify-only)** — the `MODELS.len()` assertion lives in `openrouter_service.rs:482-485` and already reads `assert_eq!(MODELS.len(), 7)` (corrected 2026-07-01 per correct-course §3); it is the OpenRouter model list, **unrelated to affixes** — do not search `game_data_loader.rs` for it.

---

## Tasks / Subtasks

- [ ] **Task 1 — Add the `position` field to `AffixEntryV2` (AC1, TS side)**
  - [ ] In `lebo/src/shared/types/build.ts` (AffixEntryV2, :9-16) add `position?: 'prefix' | 'suffix'`. **Optional** — an absent value means "unknown → treat as prefix" (AR-2 back-compat) and keeps every existing construction site compiling with no change.
  - [ ] Do **not** touch `GearItemV2` (:18-23) — affixes stay a single flat `AffixEntryV2[]`; the discriminator is per-affix, matching AR-2/ADR-P4-D-P4-2.
- [ ] **Task 2 — Source `position` from real item data at the DB-backed construction site (AC1, TS side)**
  - [ ] In `lebo/src/features/item-database/GearSlot.tsx`, `buildAffixEntries` (:51-60) currently returns `{ affixId, name, tier }` and **drops** the in-scope `r.affixEntry.type`. Populate `position` from it: `r.affixEntry.type === 'suffix' ? 'suffix' : 'prefix'` (map the third value `'implicit'` → `'prefix'` — Decision **D3**). `r` is a `ResolvedAffix` holding `affixEntry: AffixEntry`, whose `type: 'prefix' | 'suffix' | 'implicit'` (itemDatabase.ts:16-19) already crosses from Rust via `load_item_database`. **This is the only place real prefix/suffix data enters `AffixEntryV2` today** — pickers 4.2–4.6 are NOT a prerequisite.
  - [ ] Leave the two typeless construction sites unchanged: free-text `GearInput.tsx:32` (`{ name: affix }`, no affixId/type) and the v1→v2 migration `buildPersistence.ts:116-121` — both correctly leave `position` undefined → prefix. Verify only that they still type-check with the new optional field.
- [ ] **Task 3 — Route prefix vs suffix in the serializer (AC2 — the real AR-15 fix)**
  - [ ] In `lebo/src/shared/utils/buildSnapshotSerializer.ts`, `toGearSlots` (:155-171): partition the already-filtered `validAffixes` by position — `a.position === 'suffix'` → `suffixes[]`, everything else (`'prefix'`, `undefined`, migrated strings) → `prefixes[]`. Remove the hard-coded `suffixes: []` and the stale "all to prefixes" comment (:166-167).
  - [ ] The wire contract already supports this: `GearSlotSnapshotTS` (:31-35) already declares `prefixes: AffixEntryTS[]` and `suffixes: AffixEntryTS[]`. `AffixEntryTS` (:26-29) stays `{ affixId, tier }` — the array an affix lands in **is** its position (matches the Rust `GearSlotSnapshot` vec split); you do **not** need to add a `position` field to the wire type.
- [ ] **Task 4 — Re-export `GearSlotRanking` + `WishlistAffix` (AC3)**
  - [ ] In `lebo/src-tauri/scoring-core/src/lib.rs`, add `GearSlotRanking, WishlistAffix` to the `pub use stat_sheet::{ … };` block (:26-29). Both are already `pub` (stat_sheet.rs:161/170) so this compiles cleanly. `AffixPosition` is already re-exported (:21) — do not duplicate.
- [ ] **Task 5 — Verify the "already done" AC items; do NOT re-implement (AC1 Rust, AC3 stale test)**
  - [ ] Confirm (read, don't change) `GearAffixData.affix_class` is the `AffixPosition` enum (game_data.rs:22-23) and the loader populates it from the corpus `type` field (game_data_loader.rs:225-229,257). **deferred-work.md:127 ("affix_class is an unvalidated String") is STALE** — do not act on it.
  - [ ] Confirm the stale-test half of AC3 is already green: `openrouter_service.rs:484` reads `assert_eq!(MODELS.len(), 7)`. No change. (If you were about to edit `game_data_loader.rs` for a `MODELS` test, stop — it is not there.)
  - [ ] Confirm the corpus already ships `type: 'prefix'|'suffix'` on all affixes (no data/`generate_item_db.py` change) — see Source Audit. Do **not** rename the corpus field to `position` (Decision **D2**).
  - [ ] (Optional, closes deferred #203's live remnant) Confirm the loader boundary actually converts the corpus `type` to `AffixPosition` — it does, via the inline match at game_data_loader.rs:225-229. No `AffixPosition::from_data_str` refactor is required.
- [ ] **Task 6 — Tests: routing over REAL corpus affixes + back-compat (verification guardrail)**
  - [ ] Extend `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` (the gear-affix test at :62-83 currently asserts `suffixes === []` — this encodes the bug and must change). Feed a build whose gear carries a **real suffix affix** and a **real prefix affix** and assert routing: a `position: 'suffix'` affix lands in `snapshot.gearSlots[slot].suffixes`; a `position: 'prefix'` (and a `position`-absent) affix stays in `prefixes`. This is the discriminator analog of the value+element rule — assert **where the affix routes**, not a count.
  - [ ] Use real corpus ids so the test is source-grounded, e.g. suffix `affix-of-defense-suffix` (`type: "suffix"`, statKey `armor`) / `affix-of-hope-suffix`; prefix `affix-inevitable-prefix` (`type: "prefix"`). (These are the exact ids in `affixes.json`.)
  - [ ] Add/confirm a GearSlot test (or extend the item-database tests) that `buildAffixEntries` copies `r.affixEntry.type` into `position` and maps `'implicit'` → `'prefix'`.
  - [ ] Back-compat assertion: an `AffixEntryV2` with no `position` serializes into `prefixes` (never `suffixes`).
- [ ] **Task 7 — Regression + build/test green**
  - [ ] `pnpm build` (tsc + vite) clean; full `pnpm vitest` shows **no new failures** vs the standing baseline (ProviderSelector ×5 / Settings ×1 / TreeControls ×1 — `SkillTreeCanvas` was cleared in Story 3.5). The only pre-existing serializer test that must change is the AR-15 `suffixes === []` assertion (Task 6) — update it to the routing assertions, do not just re-pin it.
  - [ ] `cargo test -p scoring-core` and `cargo test -p lebo` green (the `lib.rs` re-export is additive; the frozen 4.0 tests — `gear_affix_parity_*`, `no_dead_gear_stat_keys`, effect-count pins in game_data_loader.rs — must stay green and untouched).

---

## Dev Notes

### What this story is (and is not)

A **thin TypeScript wiring story** with one-line Rust housekeeping. Story 4.0 already made the prefix/suffix discriminator real everywhere except the TS build-snapshot serializer. The engine, loader, corpus data, and `AffixPosition` enum are done and correct — **do not rebuild them.**

- **IN scope:** `position?` on `AffixEntryV2` (Task 1); sourcing it from `r.affixEntry.type` in `GearSlot.buildAffixEntries` (Task 2); routing prefix/suffix into the existing `suffixes[]` array in `buildSnapshotSerializer.ts` (Task 3 — the real AR-15 fix); the `lib.rs` re-export (Task 4); tests + regression (Tasks 6–7).
- **OUT of scope — already done by Story 4.0 (verify, don't redo):** `GameData.gear_affixes` population, `GearAffixData.affix_class: AffixPosition`, the loader's `type`→enum mapping, the corpus `type` field, and all Rust consumers reading both vecs. Also the `MODELS.len()==4→7` fix (done 2026-07-01).
- **OUT of scope — do NOT do (traps):** adding a `position` field to the Rust `build_snapshot::AffixEntry` (Decision D1 — redundant with the vec split, creates a second source of truth); renaming the corpus/loader field from `type` to `position` (Decision D2); refactoring `detect_mismatched_affixes`; populating `affix_scope` (Story 4.2); the `BuildScore`→tunklab-EHP re-baseline (separate deferred story); any React UI beyond the `GearSlot.buildAffixEntries` one-liner; the Item/Affix Picker modals, pips, DnD, AI (4.2–4.6, gated on this).

### Ground truth — the two mechanisms that already carry position on the Rust side

Position is represented **two different ways** in the codebase, and neither needs new fields:

1. **Corpus affix (the affix *definition*):** `GearAffixData.affix_class: AffixPosition` (game_data.rs:22-23), an enum (`Prefix` default / `Suffix`, lowercase serde, modifier.rs:188-194). Populated by `parse_gear_affixes` from the corpus `type` field (game_data_loader.rs:225-229 `match a.affix_type.as_str() { "prefix" => Prefix, "suffix" => Suffix, _ => continue }`; assigned :257). `gear.rs` already buckets candidate affixes by it (:91/153/166) and filters per-slot via `affix_valid_for_slot` (:121/154/167).
2. **Equipped affix (a *reference* on the user's build):** `build_snapshot::AffixEntry { affix_id, tier }` (build_snapshot.rs:5-10) carries **no** position — instead `GearSlotSnapshot` splits into `prefixes: Vec<AffixEntry>` and `suffixes: Vec<AffixEntry>` (build_snapshot.rs:13-21). **Position = which vec the affix sits in.** Every consumer already iterates both: `compute/mod.rs:197-203`, `gear.rs:232-235`/`:253-262`, `synergy.rs:220-221`.

**Therefore the "all affixes are prefixes" bug (AR-15) is upstream in TypeScript**, at the one place that decides which vec each equipped affix goes into: `buildSnapshotSerializer.ts::toGearSlots` (:155-171), which puts everything in `prefixes` and leaves `suffixes` empty. Fix that one function and the whole end-to-end chain lights up, because the Rust side already consumes `suffixes`.

### The engine/loader/data are already built — DO NOT reinvent (verified at HEAD)

| Already done (Story 4.0) | Evidence |
|---|---|
| Corpus ships `type: 'prefix'\|'suffix'` on all 1,117 affixes (840/277, 0 missing) | affixes.json; generate_item_db.py:518-519,562 |
| `RawAffix.affix_type` (`#[serde(rename = "type")]`) + serialized to FE via `load_item_database` | item_data.rs:32-33; item_commands.rs:7-10; ItemDatabase item_data.rs:100-107 |
| FE `AffixEntry.type: 'prefix'\|'suffix'\|'implicit'` reaches TS today | itemDatabase.ts:16-19 |
| `GearAffixData.affix_class` is the `AffixPosition` **enum** (not String — #127 stale) | game_data.rs:22-23; loader :225-229,257 |
| `AffixPosition` enum + `from_data_str` + `#[default] Prefix` (AR-2) + serde round-trip tests | modifier.rs:188-205,381-410 |
| `GearSlotSnapshot` splits `prefixes`/`suffixes`; all consumers chain both | build_snapshot.rs:13-21; compute/mod.rs:198; gear.rs:232-235,253-255; synergy.rs:221 |
| `MODELS.len()` test corrected to 7 | openrouter_service.rs:482-485 |

### The crux — where `position` comes from on the frontend

`AffixEntryV2` is constructed in exactly three places (grep-confirmed; **no build-code import path exists** at HEAD):

1. **`GearSlot.buildAffixEntries` (GearSlot.tsx:51-60)** — the DB-backed path. `r.affixEntry.type` is already in scope (via `ResolvedAffix`, :17-21/:33-49) but discarded. **This is where you source `position`.**
2. **`GearInput.tsx:32`** — free-text (`{ name: affix }`), no affixId/type → `position` undefined → prefix (correct; no change).
3. **`buildPersistence.ts:116-121`** — v1→v2 migration of stored builds, no type available → prefix (correct; no change).

So real prefix/suffix data flows: corpus `type` → `RawAffix.affix_type` → `load_item_database` → FE `AffixEntry.type` → (Task 2) `AffixEntryV2.position` → (Task 3) serializer → `GearSlotSnapshot.prefixes/suffixes` → Rust consumers.

### Field naming — `type` (data/item-DB) vs `position` (build-side) — and the silent-all-prefix trap (Decision D2)

The corpus and the item-DB affix use the field name **`type`**; the AC/ADR name the new build-side field **`position`**. Keep it that way and **map at the boundary** (`r.affixEntry.type` → `AffixEntryV2.position` in Task 2). **Do not** try to deserialize a field literally named `position` off the `type`-named corpus — a loader keyed on `position` would read `undefined`/serde-default on every affix and silently classify all 1,117 as prefix, re-introducing AR-15. (No Rust `position` field exists on the snapshot path — the vec split avoids the mismatch entirely — so this trap only bites if someone renames things needlessly.)

### Source tree — files to touch

| File | Change | AC |
|---|---|---|
| `lebo/src/shared/types/build.ts` | Add `position?: 'prefix' \| 'suffix'` to `AffixEntryV2` (:9-16) | AC1 |
| `lebo/src/features/item-database/GearSlot.tsx` | In `buildAffixEntries` (:51-60) copy `r.affixEntry.type` → `position` (`'implicit'`→`'prefix'`) | AC1 |
| `lebo/src/shared/utils/buildSnapshotSerializer.ts` | In `toGearSlots` (:155-171) partition `validAffixes` by `position` into the existing `prefixes[]`/`suffixes[]`; delete `suffixes: []` + stale comment (:166-167) | AC2 |
| `lebo/src/shared/utils/buildSnapshotSerializer.test.ts` | Replace the `suffixes === []` assertion (:62-83) with prefix/suffix **routing** assertions over real corpus ids | AC2 |
| `lebo/src-tauri/scoring-core/src/lib.rs` | Add `GearSlotRanking, WishlistAffix` to `pub use stat_sheet::{…}` (:26-29) | AC3 |

**Do not touch:** `build_snapshot.rs` (`AffixEntry`/vec split — D1), `game_data.rs`/`game_data_loader.rs` (`affix_class` already an enum), `modifier.rs` (`AffixPosition` done), `gear.rs`/`compute/mod.rs`/`synergy.rs` (consumers already read both vecs), `openrouter_service.rs` (MODELS test already 7), `affixes.json`/`generate_item_db.py` (corpus `type` already emitted — D2), `GearItemV2`, `GearInput.tsx`, `buildPersistence.ts` (typeless sites default to prefix), and every 4.0 frozen test. No new Tauri command; no store/view/router change.

### Governing patterns / ADRs (do not violate)

- **ADR-P4-D-P4-2 — Affix Prefix/Suffix Discriminator (Phase 4 Data Gate)** [architecture.md:171-177]: adds `position: 'prefix' | 'suffix'` to `AffixEntryV2`, populated by ingestion, absent→prefix; "must be the first story of the gear epic." (Its OQ-2 note prefers "a single discriminator field, not parallel `prefixes[]`/`suffixes[]` arrays" — on the **TS `AffixEntryV2`** side we follow that with the `position` field; on the **Rust snapshot** side the vec split already exists from 4.0 and is the load-bearing mechanism. These are consistent: one field on the flat TS list, decoded into the two Rust vecs by the serializer.)
- **AR-2 (Gate 1)** [epics.md:157]: the discriminator + absent→prefix back-compat.
- **AR-15** [epics.md:183]: the exact bug this story kills — "all gear affixes classified as prefixes" + `detect_mismatched_affixes` never sees suffixes. Resolves deferred-work #64 + #115.
- **AR-16** [epics.md:184]: `GearSlotRanking`/`WishlistAffix` re-exports + the (already-fixed) stale `MODELS.len()` test.
- **Pattern P4-1 — stat math reads the registry, never the snapshot** [architecture.md:355-359]: `position` is a prefix/suffix **classification** consumed by the serializer + `detect_mismatched_affixes`/`gear.rs` bucketing, **not** a stat-value read — so threading it through the snapshot does not violate P4-1.
- **Purity boundary** [architecture.md:642, AR-10 :168]: all corpus I/O + string→enum resolution stays in the Tauri crate loader; `scoring-core` stays pure. This story adds no I/O.

### Testing requirements

Per the project's SOURCE-AUDIT + VERIFICATION guardrails, tests assert **the actual discriminator routing over real corpus affixes**, not a count or a golden snapshot:

- **Serializer routing (AC2, mandatory):** a real suffix affix (`affix-of-defense-suffix`) equipped → serializes into `gearSlots[slot].suffixes`; a real prefix affix (`affix-inevitable-prefix`) → `prefixes`. This is the discriminator analog of value+element (assert *where* it goes, correct bucket).
- **Back-compat (AR-2):** an `AffixEntryV2` with `position` absent → `prefixes` (never `suffixes`).
- **Source mapping (AC1):** `GearSlot.buildAffixEntries` copies `r.affixEntry.type` into `position` and maps `'implicit'` → `'prefix'`.
- **Regression:** `pnpm build`, full `pnpm vitest` no new failures vs the standing baseline; `cargo test -p scoring-core` + `-p lebo` green (4.0's frozen parity/dead-key/effect-count tests unperturbed — the `lib.rs` re-export is additive). The pre-existing `suffixes === []` serializer assertion is a **bug encoding** — replace it with the routing assertions, do not re-pin it. [project-context.md#Testing Rules]

## Source Audit

**Not a new *stat* — a new data-sourced *discriminator*.** `position` is not a `StatKey`, not a `StatSheet` field, and not a computed value; it never enters the modifier registry, so no compute value+element parity test applies. But it *is* a new data-driven field that routes behavior, and this project's failure mode is exactly "displayed/routed-but-not-sourced," so the source chain is audited here per the guardrail's spirit.

**Real shipped-data source (produced):** the prefix/suffix identity originates in the PoB4LE `ModItem.json` `type` field and is emitted by the committed transform (generate_item_db.py:518-519,562) onto every affix in `affixes.json` as `type: 'prefix' | 'suffix'` (840 prefix / 277 suffix / 1,117 total, **0 missing** — verified). It crosses to the frontend as `RawAffix.affix_type` (`#[serde(rename = "type")]`, item_data.rs:32-33) → `load_item_database` → `AffixEntry.type` (itemDatabase.ts:16-19). This story copies that real value into `AffixEntryV2.position` (Task 2) — it does **not** fabricate or heuristically derive it.

**Produced AND consumed (no dead field):** `position` is produced by the serializer (routing each affix into `prefixes[]`/`suffixes[]`, Task 3) and consumed on the Rust side by the vec-iterating consumers and `gear.rs` bucketing (build_snapshot.rs:13-21; compute/mod.rs:198; gear.rs:91/153/166/232-235; synergy.rs:221). It is not a produced-but-unconsumed field. (Corpus-side, `GearAffixData.affix_class` is likewise produced by the loader and consumed by `gear.rs` — 4.0 proved this.)

**Honest default for unsourced affixes:** free-text (`GearInput.tsx:32`) and migrated (`buildPersistence.ts:116-121`) affixes have no `type` in the source, so `position` is deliberately left absent → routed to `prefix`. This is an explicit, correct fallback (LE treats implicits/unknowns as non-suffix; AR-2 mandates absent→prefix), not a fabricated value — and it is asserted by the back-compat test.

**Verification is routing, not a count:** the tests assert a real suffix affix lands in `suffixes` and a real prefix affix in `prefixes` (Task 6). A golden count of serialized affixes is explicitly insufficient — it would not catch every affix silently routing to `prefixes` (the exact AR-15 regression), which is why the assertions check the destination bucket per real corpus id.

## Previous Story Intelligence — Story 4.0 (affix stat-semantics data gate, done 2026-07-02)

4.0 is the direct predecessor and did most of what the pre-4.0 plan attributed to 4.1. Key carry-forward facts (from `4-0-affix-stat-semantics-data-gate.md`):

- **`generate_item_db.py` was fully rewritten** (index-grouped 1,117 affixes; stat-text→`statKey`; hybrids via `extraStats[]`; authored slot table; uniques/implicits parsed; committed `check_coverage.py` + `affix-manifest.json`). It already emits `type: 'prefix'|'suffix'` authoritatively.
- **`GearAffixData` became multi-stat** (`stats: Vec<GearAffixStat>` + `item_slots`) and the `compute/mod.rs` gear loop iterates stat clauses (hybrids contribute both) — an Alec-authorized engine change. **`affix_class: AffixPosition` is set from the corpus `type`.**
- **`gear.rs` gained per-slot validity** (`affix_valid_for_slot`, :121) so wishlists differ by slot.
- **Frozen tests you must not break:** `gear_affix_parity_inevitable_void_penetration` (4.0 VoidPenetration), `gear_affix_parity_hybrid_glacial` (30 FreezeRate + 5 ColdRes), `no_dead_gear_stat_keys`, `ehp_reference.rs` (EHP ±2% parity), plus effect-count pins in `game_data_loader.rs`. The `lib.rs` re-export and TS serializer change here are additive and must leave all of these green.
- **4.0's scope fence explicitly reserved for 4.1:** "position/serializer emit/lib.rs re-exports (AR-2/AR-15/AR-16)" — exactly this story.
- **Engine gaps 4.0 flagged (NOT 4.1):** flat added base damage unmodeled, increased-crit not consumed, minion count/hp + mana hardcoded — each a separate future engine story.

## Git intelligence (provenance caution — read before branching)

- **HEAD is `9137ad6`, a raw `[AutoSave]` snapshot** ("2026-07-02 16:16"). Working tree is **clean** (`git status --porcelain`, `git diff` both empty) and all eight 4.1-relevant files match HEAD. 4.0's work is verified present on disk (multi-stat `GearAffixData` game_data.rs:19-33; `affix_valid_for_slot` gear.rs:121; ~1,217 `statKey`s in affixes.json) with **no phantom/AutoSave regression** in the 4.1 targets.
- **But 4.0's affix DATA half (affixes.json corpus, manifest, generate_item_db.py) landed only in `[AutoSave]` commits `7730e4b` + `9137ad6`** — there is no named/reviewed `dev`/`code-review` commit for it. Per memory `autosave-watcher-unvalidated` ("never trust a raw `[AutoSave]` SHA; land a reviewed commit before pushing"), **recommend committing a reviewed "Story 4.0 complete" baseline before starting 4.1**, so 4.1's References cite a stable SHA rather than an AutoSave tip. The `statKey` count moved `1651→1217` between the two AutoSaves (consistent with the documented index-grouping to ~1,117 + hybrids; manifest net −943 lines) — reads intentional, but confirm the corpus reduction was intended. AutoSave also committed `docs/data-transform/__pycache__/*.pyc` — gitignore them. **These are provenance flags for Alec, non-blocking for authoring/implementing this story.**

### Project Structure Notes

- Changes span the **frontend** only for behavior (`build.ts` type, `GearSlot.tsx` source, `buildSnapshotSerializer.ts` routing, one test) plus a **one-line scoring-core `lib.rs`** API completeness edit. No new files, no new feature folder, no store/view/router/Tauri-command change — consistent with `project-context.md` (four stores only; no barrel files; snapshot via `toBuildSnapshot`; snake_case Rust output).
- The serializer remains the single `BuildState → BuildSnapshot` conversion point; this story only enriches what `toGearSlots` emits. No new dependency (AR-8 not implicated).

### References

- [Source: epics.md#Story 4.1 (:769-788)] — story statement + AC1 (:779), AC2 (:783), AC3 (:787-788); gate on 4.2–4.6.
- [Source: epics.md#Requirements Inventory] — AR-2 (:157), AR-15 (:183), AR-16 (:184); Epic 4 audit callouts (:734-743, note the "4,176 / 3,616 prefix / 560 suffix" figure predates 4.0 and is stale — current corpus is 1,117 / 840 / 277).
- [Source: architecture.md] — ADR-P4-D-P4-2 (:171-177, the discriminator ADR); ADR-P4-D-P4-1 (:150, ModifierType enum sibling); Pattern P4-1 (:355-359, registry-not-snapshot); stat-flow "serializer now emits affix position" (:540); FR map `position` (:592); Gate-1 (:607); purity boundary (:642) + AR-10 (:168); AR-1 closes the `affix_class`/`scope` string→enum items (:163).
- [Source: build.ts:9-16, 18-23] — `AffixEntryV2` (add `position?`), `GearItemV2` (unchanged).
- [Source: buildSnapshotSerializer.ts:26-29, 31-35, 53, 155-171] — `AffixEntryTS`, `GearSlotSnapshotTS` (already split), `BuildSnapshot.gearSlots`, `toGearSlots` (the AR-15 block at :166-167).
- [Source: buildSnapshotSerializer.test.ts:62-83] — the `suffixes === []` assertion to replace with routing assertions.
- [Source: itemDatabase.ts:16-19] — FE `AffixEntry { type: 'prefix'|'suffix'|'implicit' }` (the position source).
- [Source: GearSlot.tsx:17-21, 33-49, 51-60] — `ResolvedAffix.affixEntry`, `buildAffixEntries` (source `position` here); [GearInput.tsx:32], [buildPersistence.ts:97, 116-121] — typeless sites default to prefix.
- [Source: build_snapshot.rs:5-10, 13-21] — `AffixEntry { affix_id, tier }` (no position — D1); `GearSlotSnapshot { prefixes, suffixes }` (structural position).
- [Source: modifier.rs:188-194, 199-204, 381-410] — `AffixPosition` enum, `from_data_str`, round-trip/default tests.
- [Source: game_data.rs:19-33] — `GearAffixData { …, affix_class: AffixPosition, item_slots, stats }`.
- [Source: game_data_loader.rs:171, 196, 225-229, 257, 519-557] — empty `affix_scope` (4.2), `gear_affixes` populated (4.0), `type`→`AffixPosition` match + assign, `stat_key_from_str`.
- [Source: gear.rs:91, 121, 153-154, 166-167, 232-235, 253-262] — `affix_class` bucketing, `affix_valid_for_slot`, both-vec reads; [compute/mod.rs:197-203] — gear loop chains both vecs; [synergy.rs:206-254] — `detect_mismatched_affixes` (scope-based, chains both vecs, inert until `affix_scope` populated in 4.2).
- [Source: lib.rs:17-30] — re-exports; `AffixPosition` already at :21; add `GearSlotRanking`/`WishlistAffix` to :26-29; [stat_sheet.rs:160-161, 169-170] — both already `pub`.
- [Source: openrouter_service.rs:15-23, 482-485] — `MODELS` (7 entries) + `models_list_has_seven_entries` (already `== 7`).
- [Source: item_data.rs:27-47, 100-107] — `RawAffix.affix_type` (`#[serde(rename="type")]`), `ItemDatabase`; [item_commands.rs:7-10] — `load_item_database`.
- [Source: affixes.json] — `type: 'prefix'|'suffix'` on all 1,117 (real ids: `affix-inevitable-prefix`, `affix-of-defense-suffix`, `affix-of-hope-suffix`); [generate_item_db.py:518-519, 562] — emits `type` from source (absent→prefix); [affix-manifest.json:21-38] — counts (no prefix/suffix split — optional to add).
- [Source: deferred-work.md:64, 115] — the two AR-15 items this story resolves; [:127] — "affix_class String" (**STALE** — it is an enum; do not act); [:203] — loader-boundary conversion check (names "story 4-1"; satisfied by the inline match); [:313] — 4.0 built `gear_affixes`.
- [Source: correct-course-2026-07-01-audit.md:41 (§3)] — `MODELS.len()==4` corrected to 7 ahead of 4.1.
- [Source: 4-0-affix-stat-semantics-data-gate.md] — predecessor: rewritten transform, multi-stat engine, frozen parity/dead-key tests, scope fence reserving position/serializer/lib.rs for 4.1.
- [Source: project-context.md] — IPC/store/testing/naming/purity guardrails; snapshot serializer is the sole conversion point; snake_case Rust output; no barrel files.

---

## Open decisions & risks (surface to Alec before/at dev-story)

Recommended defaults are baked into the tasks; confirm the scope-shaping ones (D1, D2).

- **D1 — Do NOT add a `position` field to the Rust `build_snapshot::AffixEntry` (recommended).** Equipped-affix position is already encoded structurally by which `GearSlotSnapshot` vec the affix lives in (`prefixes`/`suffixes`), and all consumers read it that way. AC1's "the Rust affix type gains a position field" is satisfied by the existing `GearAffixData.affix_class` enum (corpus) + the vec split (equipped). Adding a redundant field creates two sources of truth that can desync. **Recommendation: TS `AffixEntryV2.position` only; Rust unchanged on the snapshot path.** (Flag for code-review as an intentional deviation from the ADR's literal "Rust affix type" wording — the vec split predates and supersedes it, from 4.0.)
- **D2 — Keep the corpus/item-DB field name `type`; name the new build field `position`; map at the boundary (recommended).** Avoids a corpus rename + regen and avoids the silent-all-prefix trap (a deserializer keyed on `position` over `type`-named data). No data or `generate_item_db.py` change.
- **D3 — `'implicit'` → `'prefix'` (recommended).** The item-DB `AffixEntry.type` has a third value `'implicit'`; LE treats implicits as non-suffix and the prefix/suffix count rules govern explicit affixes. Map implicit to prefix. Confirm.
- **D4 — Provenance (from git intel):** commit a reviewed "Story 4.0 complete" baseline before starting 4.1 (4.0's data half is AutoSave-only), confirm the intended `1651→1217` statKey corpus reduction, and gitignore the AutoSaved `__pycache__/*.pyc`. Non-blocking for this story; recommended hygiene so 4.1 branches from and cites a reviewed SHA.
- **Risk — over-scoping to the stale plan.** epics.md (:736) still frames 4.1 as "populate `GameData.gear_affixes` + wiring"; 4.0 already did the population. Driving the dev to "re-implement" AC1's Rust half, re-fix the MODELS test, or migrate `affix_class` (per stale deferred #127) risks churn/regressions on working, frozen-tested code. Tasks 5 marks these verify-only for exactly this reason.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-07-02 | Story 4.1 created (create-story, ultracode). Second Epic 4 data gate: `position` discriminator. Ground-truth verification (6 parallel agents at HEAD 9137ad6) established that Story 4.0 already built the corpus + Rust discriminator (`GearAffixData.affix_class: AffixPosition`, loader ingestion, `GearSlotSnapshot` prefix/suffix vec split, all consumers chain both, MODELS test already 7), so the story narrowed to: add `position?` to `AffixEntryV2` (build.ts), source it from `r.affixEntry.type` in `GearSlot.buildAffixEntries`, route prefix/suffix into the existing `suffixes[]` in `buildSnapshotSerializer.ts` (the real AR-15 fix), re-export `GearSlotRanking`/`WishlistAffix` from `lib.rs`, and routing tests over real corpus ids. Four traps flagged (no Rust `AffixEntry.position` field — D1; no corpus `type`→`position` rename — D2; MODELS test already fixed; `affix_class`-String deferred #127 stale). Source Audit (data-sourced discriminator, real source chain, produced-and-consumed, honest prefix default). Status → ready-for-dev. |
