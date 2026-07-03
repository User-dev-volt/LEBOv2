# Story 4.1.5: Item metadata + display-text data gate

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer enabling a trustworthy Item Picker,
I want every shipped item to carry its real level requirement, and every base implicit / unique affix to carry its real stat-description text end-to-end,
so that Story 4.2's Item Picker Modal can filter by Item Level and show real per-item stat descriptions — not blank controls over data the loader silently drops.

> **This is the THIRD Epic 4 data gate** (after 4.0 affix stat-semantics and 4.1 `position` discriminator), inserted between 4.1 and 4.2 per **Alec's ratified decision (2026-07-03): Option B — "source what's real."** It exists because a create-story source-audit spike found FR-27's Item Picker over-specifies what the shipped data reaches the frontend. **Scope is deliberately narrow and fully sourced — no invented data.** [Source: source spike 2026-07-03; ground-truth verification 2026-07-02 + 4-agent adversarial re-verify]

> **⚠️ Why this gate exists (the displayed-but-not-sourced trap, verified at HEAD):** The PoB4LE transform `generate_item_db.py` **already emits** per-item level (`req.level`) is available but discarded, and it already writes base implicit text and unique affix text into the JSON — but the **Rust deserialization structs drop them**: `RawBaseItem` (item_data.rs:51-57) has no `implicits` field and no level field; `RawUniqueItemAffix` (:61-65) keeps only `affix_id`/min/max, dropping the inline `text`/`statKey`. So `base-items.json` implicits[].text (821/897 populated) and `uniques.json` affixes[].text (100% — 2,338/2,338) **never reach the frontend**, and there is no item-level field at all. Story 4.2's modal would render blank tooltips + a dead Item Level slider while component tests pass on rich mocks — the project's #1 defect class. This gate closes the source→frontend gap for the fields that are genuinely in the upstream.

> **⚠️ What is NOT sourceable (do NOT invent — source-audit discipline):** the spike proved PoB4LE `bases.json`/`uniques.json` carry **no** `tags`, **no** `rarity` tier, and **no** unique `description`/lore field (0 occurrences across all 897 bases + 471 uniques). Those FR-27 elements are handled in Story 4.2 by honest reframes (Required Tags → Item Type filter; rarity → Base/Unique/Set collections; unique flavor → stat-line fallback), NOT by fabricating data here. This gate sources only the three things that are real: **item level, base implicit text, unique affix text.** [memory: source-audit-at-create-story, pob4le-no-affix-slot-source]

## Acceptance Criteria

**AC1 — Item level sourced end-to-end (`req.level` → frontend)**
**Given** the item-data pipeline (`docs/data-transform/generate_item_db.py`) and its PoB4LE source (`bases.json`/`uniques.json`, each item carrying `req: { level: N }`)
**When** the transform is extended and re-run against the cached source
**Then** every base item and every unique emits a `levelRequirement` (from `req.level`), the Rust `RawBaseItem`/`RawUniqueItem` + TS `BaseItem`/`UniqueItem` carry it, and `load_item_database` returns it to the frontend
**And** an element+value test asserts a known item's exact level (e.g. base **Jewelled Circlet → 7**, **Refuge Helmet → 0**, **Iron Casque → 10**) survives loader→type end-to-end (Source Audit discipline: the parity test is the proof).

**AC2 — Base implicit + unique affix display text reaches the frontend (stop the serde drop)**
**Given** the regenerated dataset (the transform already writes `implicits[].text` on bases and `affixes[].text`/`statKey` on uniques — verify, do not re-author)
**When** the Rust structs are widened
**Then** `RawBaseItem` gains an `implicits` field (carrying at least `text`) and `RawUniqueItemAffix` gains `text` + `statKey` (both `#[serde(default)]`, additive), the matching TS types carry them, and they cross to the frontend via `load_item_database`
**And** an element+value test asserts a sampled base implicit renders its real text (e.g. Jewelled Circlet implicit text contains `"Mana"` / `"Spell Damage"`) AND a sampled unique affix renders its real text (e.g. Calamity → `"increased Fire Damage"`) — non-empty, correct value, not a count.

**AC3 — Coverage gate stays green and is extended; frozen tests untouched**
**Given** the committed coverage gate (`docs/data-transform/check_coverage.py`) and the frozen 4.0/4.1 tests
**When** this story completes
**Then** `check_coverage.py` still passes all Story-4.0 gates (affix statKey floor, picker-visible floor, regression pins, implicit population) AND gains a new gate asserting `levelRequirement` is populated on ~100% of bases + uniques (regression floor)
**And** the frozen affix tests are unperturbed (`affixes.json` is byte-identical after re-run — this story does not touch the affix transform), `cargo test -p scoring-core`/`-p lebo` and the standing vitest baseline stay green.

## Tasks / Subtasks

- [ ] **Task 1 — Source `levelRequirement` in the transform (AC1)**
  - [ ] In `docs/data-transform/generate_item_db.py`, `transform_bases` (:578-609) and `transform_uniques` (:622-653): add `"levelRequirement": entry.get("req", {}).get("level", 0)` to each emitted item dict. `req.level` is present on 100% of source items (897 base + 471 unique — spike-verified).
  - [ ] Re-run **offline** against the committed cache: `python generate_item_db.py --source .source-cache` (from `docs/data-transform/`). This regenerates `base-items.json` + `uniques.json` with the new field; **`affixes.json` must be byte-identical** (the affix transform is untouched — confirm via git diff that only base-items/uniques/affix-manifest changed).
  - [ ] Confirm the transform still emits `implicits[].text` on bases (:592-600) and `affixes[].text`/`statKey` on uniques (:636-645) — it already does; **no re-authoring**. This gate is a passthrough, not a re-transform.
- [ ] **Task 2 — Widen the Rust structs to stop dropping fields (AC1, AC2)** — `lebo/src-tauri/src/models/item_data.rs`
  - [ ] Add `#[serde(default)] level_requirement: u32` to `RawBaseItem` (:51-57) and `RawUniqueItem` (:69-77). (`#[serde(rename_all = "camelCase")]` is already on the structs → maps `levelRequirement`.)
  - [ ] Add a `RawImplicit` struct mirroring the emitted implicit shape — minimally `text: String` + `#[serde(default)] stat_key: Option<String>` (optionally `modifier_type`/`scope`/`damage_type`/`min_value`/`max_value` for completeness) — and add `#[serde(default)] implicits: Vec<RawImplicit>` to `RawBaseItem`.
  - [ ] Add `#[serde(default)] stat_key: Option<String>` + `#[serde(default)] text: Option<String>` to `RawUniqueItemAffix` (:61-65). (`text` is 100%-populated in the JSON; `statKey` is nullable ~41% — carry both, but 4.2 displays `text`.)
  - [ ] All additions are `#[serde(default)]` (additive/back-compat) so pre-regen data and every existing consumer keep deserializing.
- [ ] **Task 3 — Mirror the TS types (AC1, AC2)** — `lebo/src/shared/types/itemDatabase.ts`
  - [ ] Add `levelRequirement?: number` to `BaseItem` (:27-33) and `UniqueItem` (:41-48) (optional → default `?? 0` at read, per project-context optional-field rule).
  - [ ] Add a `BaseImplicit` interface (`{ text: string; statKey?: string; ... }`) and `implicits?: BaseImplicit[]` to `BaseItem`.
  - [ ] Add `text?: string` + `statKey?: string` to `UniqueItemAffix` (:35-39).
- [ ] **Task 4 — Verify the loader is a passthrough (AC1, AC2)**
  - [ ] Confirm `load_item_database` (item_commands.rs:7-10) returns `ItemDatabase` directly (it does) and `item_data_service::load_item_database_from_dir` deserializes JSON straight into the structs with no intermediate hand-mapped DTO that would need the new fields added. If a DTO exists, extend it; if it's a plain `serde_json::from_str::<ItemDatabase>`, no change. **Do not** add a Tauri command or change the command signature.
- [ ] **Task 5 — Extend the coverage gate (AC3)** — `docs/data-transform/check_coverage.py`
  - [ ] Add a gate: `levelRequirement` present (non-null) on ≥95% of base + unique items (expected ~100%, since `req.level` is universal) — a regression floor mirroring the 4.0 gate style. Keep all existing gates.
  - [ ] Run `python check_coverage.py` → GATE PASSED (all 4.0 gates + the new levelRequirement gate).
- [ ] **Task 6 — Tests: value+element assertions (mandatory, VERIFICATION GUARDRAIL) (AC1, AC2, AC3)**
  - [ ] **Rust** (loader/deserialization test, crate `lebo`): deserialize the shipped `base-items.json`/`uniques.json` (or a representative fixture) and assert **values**: `jewelled-circlet` has `level_requirement == 7` and a non-empty `implicits[].text` containing a known token (`"Mana"`/`"Spell Damage"`); a known unique (e.g. `calamity`) has an affix whose `text` contains `"increased Fire Damage"`. Assert the VALUE, not a count.
  - [ ] **TS**: extend `itemDatabaseLoader.test.ts` (mock via `vi.mock('../../shared/utils/invokeCommand')`) with a mock DB carrying `levelRequirement` + implicit/affix `text`, asserting the store round-trips them; and/or a small type-level test that the fields are readable.
  - [ ] A golden count of items is explicitly insufficient (it would not catch a mis-parsed level or an empty text) — assert real values over real sampled items. [SOURCE-AUDIT + VERIFICATION GUARDRAIL]
- [ ] **Task 7 — Regression green**
  - [ ] `git diff` shows only `base-items.json`, `uniques.json`, `affix-manifest.json` changed under `resources/items/` (NOT `affixes.json`) + the Rust/TS/py source. `pnpm build` clean; full `pnpm vitest` **no new failures vs the standing 7-failure baseline** (ProviderSelector ×5 / Settings ×1 / TreeControls ×1). `cargo test -p scoring-core` + `-p lebo` green — the **frozen** `gear_affix_parity_*`, `no_dead_gear_stat_keys`, `ehp_reference.rs` (4/4), and `buildSnapshotSerializer` routing tests **untouched and passing** (this gate touches item-DB display data, not the scoring engine or the affix corpus).

## Dev Notes

### What is (and is not) in scope

- **IN scope:** `levelRequirement` sourcing (transform + Rust + TS); the base-implicit / unique-affix **text passthrough** (Rust structs + TS types — the transform already emits the text); a `check_coverage.py` level gate; value-assertion tests.
- **OUT of scope — do NOT do:** any change to the affix corpus (`affixes.json`) or the affix transform logic; any invented `tags`/`rarity`/`flavor` data (not in PoB4LE — Story 4.2 reframes those honestly); any scoring-engine change (`compute/*`, `gear.rs`, serializer); the modal UI itself (Story 4.2); a new Tauri command. This gate makes the fields REACH the frontend; 4.2 renders them.

### The exact drop this fixes (verified at HEAD)

The pipeline is `req.level` + emitted text → **dropped by Rust structs** → absent on frontend:
- `transform_bases` (generate_item_db.py:601-608) emits `{id,name,baseType,slot,implicitAffixIds,implicits}` where `implicits[]` already carries `text` (:599) — but **not** `levelRequirement`. `RawBaseItem` (item_data.rs:51-57) declares only `{id,name,base_type,slot,implicit_affix_ids}` → both `implicits` and any level are discarded by serde.
- `transform_uniques` (:646-652) emits `{id,name,baseType,slot,affixes}` where each affix carries `text`+`statKey` (:636-645) — but **not** `levelRequirement`. `RawUniqueItemAffix` (:61-65) declares only `{affix_id,fixed_min_value,fixed_max_value}` → `text`/`statKey` discarded.
- Frontend `resolveAffixes` (GearSlot.tsx:33-49) reads `baseItem.implicitAffixIds` (empty on all 897) and joins unique affix-ids to the corpus (0/2,314 join) → base + unique affix rows render blank from real data. **The fix is to carry `implicits[].text` and unique `affixes[].text` as display strings** (Task 2/3), which 4.2 renders directly (not via the corpus join).

### Serde / loader mechanics (why this is small)

- Structs use `#[serde(rename_all = "camelCase")]`, so `level_requirement` ↔ `levelRequirement`, `stat_key` ↔ `statKey`, `implicits` ↔ `implicits` map automatically — no manual rename.
- `load_item_database` (item_commands.rs:7-10) returns `ItemDatabase` and Tauri serializes it to the frontend; `ItemDatabase` (item_data.rs:100-107) is the same struct family, so **added fields flow through with zero loader-logic change** (Task 4 just verifies there's no hand-mapped DTO).
- `update_item_data` (item_commands.rs:35-78) fetches `base-items.json`/`uniques.json`/`affixes.json`/`set-items.json` from remote — the regenerated files are bundled resources; the per-patch remote refresh is out of scope (the transform is the committed refresh path).

### Testing requirements

Per SOURCE-AUDIT + VERIFICATION guardrails: assert **real values** over real sampled items (level == 7 for Jewelled Circlet; implicit/affix text contains a known token), never a golden count — a count would not catch a mis-parsed level or an empty text string, which is exactly the failure mode. Keep the frozen 4.0/4.1 affix tests byte-stable (this story does not touch `affixes.json`).

## Source Audit

**New displayed/filtered fields, each mapped to a REAL shipped source (no invented data):**

- **`levelRequirement`** — REAL source: `bases.json`/`uniques.json` `req.level`, present on **100%** of 897 bases + 471 uniques (spike-verified; 0 missing). **Produced** by the transform (Task 1) and **consumed** by Story 4.2's Item Level range slider — not a dead field. Honest default `0` for any absent value (back-compat). Verified by value test (Jewelled Circlet → 7).
- **Base implicit text** — REAL source: `bases.json` implicit strings, parsed by the transform to `implicits[].text` (**821/897 bases populated**; already emitted). Passed through by Task 2/3; consumed by 4.2's hover tooltip / affix rows. Value-tested.
- **Unique affix text** — REAL source: `uniques.json` inline `mods`, parsed to `affixes[].text` (**100% — 2,338/2,338**; already emitted). Sibling `statKey` is nullable (~41%) so display uses `text`. Passed through; consumed by 4.2's unique tooltip / stat-line fallback. Value-tested.

**Explicitly NOT sourced (declared, not fabricated):** `tags`, `rarity` tiers, and unique `description`/flavor are **absent from PoB4LE** (0 occurrences, spike-verified) — this gate does not invent them. Story 4.2 handles those honestly (Required Tags → Item Type filter over the real `type`; rarity → Base/Unique/Set collection membership; unique flavor → stat-line fallback). No dead field, no fabricated metadata, no control shipped over a 0%-populated source.

## Previous Story Intelligence

- **Story 4.0** rewrote `generate_item_db.py` (index-grouped affixes, stat-text→statKey, authored `STAT_SLOT_GROUPS`, `check_coverage.py` + `affix-manifest.json`). It **already emits** base `implicits[].text` and unique `affixes[].text`+`statKey` into the JSON — this gate carries those the last mile (Rust structs → frontend) and adds `levelRequirement`. Frozen tests to keep green: `gear_affix_parity_*`, `no_dead_gear_stat_keys`, `ehp_reference.rs`, effect-count pins. [Source: 4-0-affix-stat-semantics-data-gate.md]
- **Story 4.1** added `AffixEntryV2.position` + serializer routing (unrelated to display data). Its `buildSnapshotSerializer` routing tests are frozen. [Source: 4-1-affix-prefix-suffix-discriminator-data-gate.md]
- **Displayed-but-not-sourced lineage:** Epic 1 shipped computed-but-unsourced stats 3×; 4.0/4.1 fixed the affix corpus; this gate fixes the item/base display layer before 4.2's UI is built on it. [memory: source-audit-at-create-story]

## Git intelligence (provenance caution)

- HEAD is a raw `[AutoSave]` (`a180ac4`); the 4.0/4.1 Epic-4 data corpus (`affixes.json`/`base-items.json`/`uniques.json`/`affix-manifest.json`) landed only in AutoSave commits (`7730e4b`/`9137ad6`); last named commits `cad0e6b` (2026-07-02 05:02) + `d3d7090` (2026-07-01 23:15). Per memory `autosave-watcher-unvalidated`, **recommend a reviewed "4.0/4.1 complete" baseline before this gate**, so the regenerated `base-items.json`/`uniques.json` diff is reviewable against a stable parent (not an AutoSave tip). Gitignore the AutoSaved `docs/data-transform/__pycache__/*.pyc`.

### Project Structure Notes

- Touches: `docs/data-transform/generate_item_db.py` + `check_coverage.py` (transform/gate); `lebo/src-tauri/src/models/item_data.rs` (structs); `lebo/src/shared/types/itemDatabase.ts` (types); the regenerated `lebo/src-tauri/resources/items/{base-items,uniques,affix-manifest}.json`; tests. No new Tauri command, no scoring-core change, no store/view/router change, no new dependency.

### References

- [Source: source spike 2026-07-03 — `bases.json`/`uniques.json` schema: `req.level` on 100% (897 base + 471 unique); 0 `tags`/`rarity`/`description`]
- [Source: generate_item_db.py:578-609 (transform_bases — add levelRequirement; implicits[].text already at :599), :622-653 (transform_uniques — add levelRequirement; affix text at :636-645), :784-786 (source fetch/cache), main --source flag :776-780]
- [Source: item_data.rs:51-57 (RawBaseItem — add implicits + level), :61-65 (RawUniqueItemAffix — add text+statKey), :69-77 (RawUniqueItem — add level), :100-107 (ItemDatabase)]
- [Source: itemDatabase.ts:27-33 (BaseItem), :35-39 (UniqueItemAffix), :41-48 (UniqueItem) — add the mirrored fields]
- [Source: item_commands.rs:7-10 (load_item_database returns ItemDatabase — passthrough), :35-78 (update_item_data — bundled resource list)]
- [Source: check_coverage.py:98-195 (gate main — add levelRequirement gate), :170-179 (implicit gate style to mirror)]
- [Source: GearSlot.tsx:33-49 (resolveAffixes reads empty implicitAffixIds / non-joining unique ids — the reason the text must be a direct display string)]
- [Source: base-items.json (897; implicits[].text 821/897), uniques.json (471; affixes[].text 100%=2,338/2,338, 0 description), .source-cache/bases.json + uniques.json (req.level 100%)]
- [Source: epics.md:79 (FR-27 — the consumer), :133 (NFR-5); 4-2-item-picker-modal.md (the UI story this gate unblocks)]
- [Source: project-context.md — snake_case Rust output / camelCase serde, optional-field `?? 0` default, invokeCommand wrapper, no new stores/commands]

## Decisions & risks

- **Ratified (Alec, 2026-07-03): Option B "source what's real."** This gate sources only the fields genuinely in PoB4LE (item level + display text). Tags/rarity-tiers/flavor are declared unsourceable and handled by 4.2's honest reframes — NOT authored here.
- **Numbering:** inserted as `4-1-5` (a data gate between 4.1 and 4.2) to keep `4-2 = Item Picker Modal` stable and avoid renumbering 4.3–4.6. If Alec prefers a clean integer (gate → 4.2, modal → 4.3, cascade), that is a one-time sprint renumber — flagged, not assumed.
- **Risk — affix corpus drift on re-run:** re-running the transform must leave `affixes.json` byte-identical (only base/unique/manifest change). If it differs, the affix transform was inadvertently touched — revert and isolate the base/unique edits. Task 7 gates this via `git diff`.
- **Risk — nullable statKey:** unique-affix `statKey` is only ~41% populated; do not gate on it or display it. `text` is the universal display source.

## Dev Agent Record

### Agent Model Used

_(dev-story fills this in)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-07-03 | Story 4.1.5 created (create-story + ultracode). Inserted data gate per Alec's ratified Option B ("source what's real"), after a source-audit spike found FR-27 over-specifies vs the shipped data: PoB4LE sources item level (`req.level`, 100% of 897 base + 471 unique) but has NO tags/rarity/flavor. Gate sources `levelRequirement` + carries the base-implicit / unique-affix display text that the transform already emits but the Rust structs (`RawBaseItem`/`RawUniqueItemAffix`) drop serde-side. Additive `#[serde(default)]` struct fields + TS mirror + extended `check_coverage.py` + value-assertion tests (level==7 Jewelled Circlet; real implicit/affix text). Affix corpus untouched (affixes.json byte-stable). Source Audit: every field mapped to a real source; tags/rarity/flavor explicitly NOT fabricated. Status → ready-for-dev. Unblocks Story 4.2. |
