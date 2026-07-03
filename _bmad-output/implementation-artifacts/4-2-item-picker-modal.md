# Story 4.2: Item Picker Modal

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player building gear,
I want a searchable, filterable item-database modal,
so that I can find and equip any base item without leaving the app.

> **This is the FIRST UI story of Epic 4** (both data gates — Story 4.0 affix stat-semantics and Story 4.1 `position` discriminator — are **done**, so the gate at epics.md:788 is satisfied). It is **extend-not-greenfield**: a working DB-backed gear picker already ships (`item-database/GearSlot.tsx` inline `Combobox` + `itemSearch.searchItems` + `updateContextGear` equip path + median-tier default-affix seeding). ~80% of FR-27's machinery exists — the NEW surface is the **modal chrome** (Dialog shell, sidebar filters, card grid, hover tooltip, Equip button). **Do NOT rebuild the search/loader/equip layers — reuse them.** [Source: ground-truth verification 2026-07-02, 6 parallel HEAD verifiers]

> **⚠️ READ THE SCOPE DECISION BELOW BEFORE IMPLEMENTING.** FR-27 lists three sidebar filters (Rarity, Item Level, Required Tags) and a hover tooltip, but the shipped item data at HEAD **cannot feed two of the three filters, the card's affix-slot-count/flavor fields, or the tooltip** without work. This story is scoped to the **sourceable subset + one contained data-passthrough**, with the unsourceable filters explicitly deferred. This is the project's #1 defect class ("displayed-but-not-sourced") — the Source Audit section is mandatory and load-bearing here.

---

## Scope Decision (DECISION-NEEDED — recommended default applied below)

**The problem (verified at HEAD).** FR-27 asks for filters/fields the shipped item corpus does not carry:

| FR-27 element | Sourced at HEAD? | Evidence |
|---|---|---|
| **Rarity** filter | ⚠️ Partial — only 3 collections (base / unique / set), no per-item tier | No `rarity` field on any item; `SearchResult.type` is `'base'\|'unique'` only (itemDatabase.ts:78); `set-items.json` (23) excluded from search (itemSearch.ts:41-53). `RARITY_COLORS` has 7 tiers but only 3 map to real items. |
| **Item Level** range slider | ❌ **No source** | 0 of 1,391 items (897 base + 471 unique + 23 set) carry `itemLevel`/`levelRequirement`; absent from JSON, `RawBaseItem`/`RawUniqueItem` (item_data.rs:51-77), and TS types (itemDatabase.ts:27-48). |
| **Required Tags** filter | ❌ **No source** | No `tags`/`requiredTags` field anywhere. Only `slot` (14 values) and `baseType` (39 values) are real categoricals. |
| Card **affix slot count** | ⚠️ Rule-derived, not per-item | Bases carry `implicitAffixIds` (empty on all 897) — no craftable-slot-count field. LE rule = 4 for non-uniques; uniques = `affixes.length` (sourced). |
| Card **unique flavor text** | ❌ **No source** | 0 of 471 uniques carry a non-empty `description` (only 23 set-items do). |
| **Hover tooltip** "full stat description" | ❌ **Dropped serde-side today** — but the text ships in JSON | `RawBaseItem` (item_data.rs:51-57) omits `implicits`; `RawUniqueItemAffix` (:61-65) drops inline `statKey`/`text`. The JSON HAS the text (`base-items.json` implicits[].text 821/897; `uniques.json` affixes[].text). `resolveAffixes` (GearSlot.tsx:33-49) reads the empty `implicitAffixIds` and joins unique affix-ids to a corpus they don't exist in → base **and** unique affix rows render **empty from real data** (tests pass on rich mocks — the exact displayed-but-not-sourced trap). |

**DN-1 — Primary scope (recommend Option A):**

- **Option A (RECOMMENDED — applied in the ACs/Tasks below): Build the modal on the sourceable subset + fold in one contained text-passthrough; defer the unsourceable filters.**
  - Filters shipped: **Rarity-as-collection** (Base / Unique / Set — include set items, currently a search bug), **Base Type** (the sourceable stand-in for "Required Tags"), and implicit **slot-scoping** (the modal opens *for* a slot).
  - **Item Level range slider** and a **normal/magic/rare Rarity tier** filter → **DEFERRED** to a named follow-up data gate (see DN below). Do not render controls over 0%-populated fields.
  - **Tooltip + affix display** made real via a small Rust+TS passthrough (base `implicits` text; unique affix `text`) — the text already ships, only deserialization drops it. This is Source-Audit-gated (value-assertion tests).
  - Card: slot glyph (rarity-tinted), name, base type, **affix-slot-count** (unique = `affixes.length`; base/set = documented LE constant `4`), unique branch **falls back to a stat-line summary** in place of absent flavor.
  - *Rationale:* keeps 4.2 shippable and honest; the passthrough is ~a struct field each side, mirroring Story 4.0's approach; no big re-transform; no dead UI.

- **Option B: Insert a preceding item-metadata data gate (a new "Story 4.1.5") that sources `itemLevel` + `tags` + rarity tiers into `generate_item_db.py` → Rust → JSON, then build the full FR-27 modal.** Matches the 4.0/4.1 gate cadence but is **blocked on whether PoB4LE upstream even carries item level / tags** (unverified — the current transform discards them or they are absent). Larger, and delays the visible feature.

- **Option C (REJECTED): Ship the full FR-27 with the unsourced filters present but empty/no-op.** This is the project's documented #1 defect class (correct math / correct-looking UI over data the loader never feeds). Listed only to be explicitly rejected. [memory: source-audit-at-create-story]

**Sub-decisions (recommended defaults applied; ratify or override):**

- **DN-2 — text-passthrough placement:** fold the base-`implicits`/unique-`text` passthrough into **this** story as Task 1 (recommended — it is ~30 lines and the tooltip AC is meaningless without it) **vs.** split it into its own data-gate story. *Applied: fold in.*
- **DN-3 — affix slot count:** base/set = documented constant `CRAFTABLE_AFFIX_SLOTS = 4`; unique = `affixes.length` (recommended, honest rule-derived) **vs.** other. *Applied: constant + length.*
- **DN-4 — unique "flavor" card branch:** fall back to the unique's affix stat-line summary (recommended — sourced via the passthrough) **vs.** source flavor text upstream (no source; would need Option B). *Applied: stat-line fallback.*
- **DN-5 — canonical equip path:** the modal becomes the discovery+equip entry from `GearTab`, and the **existing `GearSlot` inline affix-tier editor is retained for post-equip editing**; both write through the single `updateContextGear` idiom (no third path). The free-text `context-panel/GearInput.tsx` (ContextPanel) is untouched. *Applied.*
- **DN-6 — new-file location:** put the modal in the **existing `item-database/` feature folder** (co-located with `itemSearch`/`GearSlot`) — **NOT** a new `gear/` folder as architecture.md:466-468 prescribes — because the no-cross-feature-import rule (project-context.md) forbids a `gear/` modal from importing `itemSearch` out of `item-database/`. *Applied: `item-database/`.*

These are surfaced to Alec for ratification (see the interactive question after this file is written). The ACs/Tasks below are written for the **recommended path**.

---

## Acceptance Criteria

Verbatim from epics.md (Story 4.2, :796-809 / FR-27 :79 / NFR-5 :133), each annotated with **HEAD reality** and the **in-scope / deferred** disposition per DN-1 Option A.

**AC1 — Open from empty slot or "Swap item"**
**Given** an empty gear slot or "Swap item" on an equipped slot
**When** I click it
**Then** the Item Picker Modal opens with sidebar filters (Rarity, Item Level range slider, Required Tags), a real-time search bar, and an item grid showing icon (slot glyph in rarity color), name, base type, and affix slot count or unique flavor text (FR-27).

> **HEAD reality / disposition:** Modal, sidebar, grid, icon, tooltip are all **missing-create**. Filters split by sourceability: **Rarity → ship as Base/Unique/Set collection filter** (in scope); **Item Level range slider → DEFER** (0/1,391 items sourced — DN-1); **Required Tags → ship as a Base Type filter** (39 real values; literal tags unsourced — DN-1). Card **affix slot count** = unique `affixes.length` / base+set constant `4` (DN-3); **unique flavor → stat-line fallback** (DN-4, 0/471 descriptions). The open trigger wires into `GearTab.tsx` (currently renders a 2-col grid of `GearSlot`); slot-scoping requires a GEAR_SLOTS-id ↔ DB-slot map (Task 5).

**AC2 — Real-time search < 100ms via a prebuilt index**
**Given** the full item database
**When** I type a search query
**Then** filtered results return in under 100ms via a prebuilt client search index (NFR-5).

> **HEAD reality / disposition:** `itemSearch.searchItems` (itemSearch.ts:32-67) exists but is a **per-keystroke linear + Levenshtein scan that omits set items** — it likely meets <100ms over ~1,391 items (its own benchmark asserts <50ms over 1,400, itemSearch.test.ts:127-149) but is **not the "prebuilt index" NFR-5 names**. **In scope:** add a prebuilt index (build once on item-DB load; token/prefix maps), **include set items**, keep `searchItems`'s ranking semantics. Do not re-label the linear scan as "the index."

**AC3 — Single-click select / double-click equip / hover tooltip**
**Given** an item in the grid
**When** I single-click it
**Then** it is selected and equippable via an "Equip Item" button; double-click equips immediately with a default affix configuration that can be modified
**And** hovering an item card shows a tooltip with its full stat description.

> **HEAD reality / disposition:** Single-click select + Equip button + double-click-equip are **missing-create** (today selection is inline `Combobox.onChange` → immediate equip, GearSlot.tsx:129-145). **"Default affix configuration" already has a concrete meaning to reuse:** `handleSelect` seeds each resolved affix at **median tier** (GearSlot.tsx:129-145, `medianTier` :29) then writes the build — for a **unique** it seeds the fixed affixes; for a **base** it is currently **empty** because `implicitAffixIds` is empty on all 897 bases (real implicits live in the un-deserialized `implicits[]` array — fixed by Task 1's passthrough). The **hover tooltip is unsourced today** and is made real by Task 1 (base `implicits[].text` + unique `affixes[].text`). Equipping recomputes stats **automatically** — do not add a manual `compute_stats` call (Dev Notes → Equip wiring).

---

## Tasks / Subtasks

- [ ] **Task 1 — Source the display text (the Source-Audit core; DN-2 folded in) (AC1 card, AC3 tooltip)**
  - [ ] **Rust passthrough:** add `implicits: Vec<RawImplicit>` (with a `text: String` field, `#[serde(default)]`) to `RawBaseItem` (`lebo/src-tauri/src/models/item_data.rs:51-57`); add `stat_key: Option<String>` + `text: Option<String>` (`#[serde(default)]`) to `RawUniqueItemAffix` (:61-65). The values already ship in `base-items.json` (implicits[].text, 821/897) and `uniques.json` (affixes[].text) — this is a **passthrough, not a re-transform**; do NOT edit `generate_item_db.py` or the JSON.
  - [ ] **TS mirror:** add the matching fields to `BaseItem.implicits` and `UniqueItemAffix.text`/`statKey` in `lebo/src/shared/types/itemDatabase.ts:27-48` (snake→camel per the loader's existing convention).
  - [ ] Repoint the affix-text read: the modal tooltip renders `base.implicits[].text` (base) and `unique.affixes[].text` (unique) directly — NOT via the empty `implicitAffixIds` corpus join. Leave `resolveAffixes` (GearSlot.tsx:33-49) as-is for the tier-editable *craftable* path; the tooltip is a display-only read.
  - [ ] **Value-assertion tests (mandatory, per VERIFICATION GUARDRAIL):** a sampled real base item (with a known implicit, e.g. one whose `implicits[].text` contains `"Armor"`) AND a sampled real unique render **non-empty, correct** stat text end-to-end (loader → type → tooltip). A count/"renders something" test is insufficient — assert the actual text value.
- [ ] **Task 2 — Prebuilt search index + set-item inclusion (AC2, NFR-5)**
  - [ ] Add a prebuilt index (build once from the loaded `ItemDatabase`; lowercased name/baseType token maps) that `searchItems` (or a thin wrapper) consumes — do not scan-from-scratch per keystroke. Keep the existing prefix/substring/fuzzy ranking behavior.
  - [ ] Include `setItems` in the searchable corpus (currently skipped, itemSearch.ts:41-53). Extend `SearchResult.type` to `'base' | 'unique' | 'set'` (itemDatabase.ts:73-79) and everything that switches on it.
  - [ ] Perf test: assert <100ms over the full real corpus (897 + 471 + 23) — extend the existing benchmark pattern (itemSearch.test.ts:127-149). Assert the index builds **once**, not per query.
- [ ] **Task 3 — ItemPickerModal shell + grid + sidebar (AC1)** — new file `lebo/src/features/item-database/ItemPickerModal.tsx` (DN-6)
  - [ ] **Copy** the Headless UI `Dialog` scaffold from `DeleteConfirmDialog.tsx` **locally** (do NOT import it — cross-feature import is forbidden, RemoveNodeConfirmDialog.tsx:10-11): `<Dialog open onClose>` + `fixed inset-0` overlay `rgba(0,0,0,0.5)` + flex-center + `<DialogPanel>` tokens (`--color-bg-surface`, border `--color-bg-elevated`). Widen well beyond `max-w-sm` for the sidebar + grid.
  - [ ] Sidebar filters (sourceable only): **Rarity** = Base/Unique/Set toggle; **Base Type** = select over the 39 real `baseType` values. Do **not** render Item Level or literal Tags controls (DN-1). Add a short "more filters coming with item metadata" affordance only if desired — never a disabled/empty control.
  - [ ] Search bar wired to Task 2. Result count in a `role="status" aria-live="polite"` region (BlessingsPanel/SuggestionsList idiom).
  - [ ] Item grid: reuse `SkillPickerGrid.tsx`'s roving-tabindex `role="grid"` + arrow/Enter/Escape pattern (copy locally). Each card = slot glyph (Task 4) + name (rarity-colored) + baseType + affix-slot-count (unique `affixes.length` / base+set `CRAFTABLE_AFFIX_SLOTS=4`, DN-3). Single-click selects (`<button aria-pressed>` gold-active, BlessingsPanel.tsx:37-60).
  - [ ] Handle the **item-DB-not-loaded** case via existing `gameDataStore` flags (`itemDatabase===null`, `isItemDataUpdating`, `isItemDataStale`) — mirror GearSlot's "Database unavailable" fallback (GearSlot.tsx:225-255). Do not invent new state.
- [ ] **Task 4 — Slot glyph in rarity color (AC1 card icon)**
  - [ ] There is **no item icon pipeline** (`useIconTextures` is PixiJS skill-only). Render the icon as an **inline SVG slot glyph** (ClassGlyph.tsx pattern), one per slot type, tinted by rarity color.
  - [ ] Color **only** via `rarityColors.ts` (AR-9): extend `getRarityColorForItemType` (rarityColors.ts:15-17) to accept `'set'` (currently `'base'|'unique'` only). Never hardcode hex; CSS side uses the mirrored `--color-rarity-*` tokens.
- [ ] **Task 5 — Slot-scoped opening + GEAR_SLOTS↔DB-slot map (AC1)**
  - [ ] Author a mapping table: `GEAR_SLOTS` ids (gearData.ts:1-13 — `helmet, body, gloves, belt, boots, ring1, ring2, amulet, relic, weapon, offhand`; **11 slots, not 12**) ↔ DB `slot` values (`helm, chest, gloves, belt, boots, ring_1, amulet, relic, weapon, off_hand, catalyst, ...`). Note **only `ring_1` exists** in base data — map both `ring1` and `ring2` to it, and handle the absence of dedicated ring bases gracefully.
  - [ ] Make the picker slot-aware: opening from a slot filters the grid to slot-valid items (`searchItems` has no slot filter today — add one). A helmet slot must not list weapons.
- [ ] **Task 6 — Equip wiring: Equip button + double-click (AC3)**
  - [ ] Equip writes through the **existing idiom** (reuse, do not fork): read `useBuildStore.getState().activeBuild?.contextData.gear ?? []`, filter out the target `slotId`, append `{ slotId, itemId, itemName, affixes }`, call `useBuildStore.getState().updateContextGear(next)` (mirror GearSlot.writeToStore, GearSlot.tsx:106-127). **Populate `itemId`** (the `SearchResult.id`) — the modal is a good place to set the currently-omitted optional `GearItemV2.itemId` (build.ts:23) for the scorer. Never call `set()` directly; never pass `BuildState` around.
  - [ ] Double-click = equip with default affix config = median-tier resolved affixes (reuse `handleSelect`'s seeding, GearSlot.tsx:129-145) — for bases this is now the real implicits (post-Task 1) or empty-then-editable; the user modifies via the retained `GearSlot` affix-tier editor / AffixPicker.
  - [ ] `showSuccessToast('Equipped …')` (Toast.tsx:9-11) + announce in the modal's `aria-live` region; close the modal on equip.
  - [ ] **Do NOT add a manual re-score.** Equipping mutates the build store; `useStatSheet` (whole-store subscription, useStatSheet.ts:51) and `useGearStream` (useGearStream.ts:24,32) recompute `compute_stats` + `run_gear_scoring` automatically via `toBuildSnapshot`. State this in code only if non-obvious.
- [ ] **Task 7 — Accessibility (NFR-14)**
  - [ ] Rely on the **global** `:focus-visible` 2px gold ring (global.css:180-184) for buttons — do not re-implement per element; add explicit `onFocus/onBlur` outline ONLY for any `<select>` (IdolAffixPicker precedent). Headless UI `Dialog` supplies focus-trap + Escape→onClose + restore-focus; do not hand-roll `role="dialog"`.
  - [ ] Keep the modal **un-animated** (no Headless UI `Transition` — matches every existing modal) or gate any animation behind `useReducedMotion()` (shared/hooks/useReducedMotion.ts).
  - [ ] `vitest-axe` test: `expect(await axe(container)).toHaveNoViolations()` in empty, loaded-grid, and item-selected states (mirror GearSlot.test.tsx).
- [ ] **Task 8 — Tests + regression green**
  - [ ] Component tests reuse the house patterns: seed a mock `ItemDatabase` inline as a prop / via a `makeDatabase()` factory (itemSearch.test.ts:5-13, GearSlot.test.tsx:30-93); mock IPC via `vi.mock('../../shared/utils/invokeCommand')` — **NOT** `@tauri-apps/api/core` (itemDatabaseLoader.test.ts:5-13); reset stores with `useBuildStore.setState(initial, true)` in `beforeEach`.
  - [ ] **Source-Audit tests (non-negotiable):** (a) Task 1's value-assertion tests; (b) a test that the modal renders **real** base/unique field values from a real-shaped seeded DB (name, baseType, affix count, tooltip text), not just "a modal opens"; (c) filters actually filter (Rarity=Unique hides bases; Base Type narrows; slot-scope excludes wrong-slot items); (d) equip writes exactly one `{slotId,itemId,itemName,affixes}` through `updateContextGear` and replaces (not duplicates) an already-equipped slot.
  - [ ] `pnpm build` (tsc + vite) clean. Full `pnpm vitest` (run from `lebo/`) shows **no NEW failures vs the standing 7-failure baseline** (ProviderSelector ×5 / Settings ×1 / TreeControls ×1) — gate on *no new failures*, not an absolute pass count.
  - [ ] `cargo test -p scoring-core` + `cargo test -p lebo` green; the **frozen** tests stay untouched and passing: `gear_affix_parity_inevitable_void_penetration`, `gear_affix_parity_hybrid_glacial`, `no_dead_gear_stat_keys` (game_data_loader.rs), `ehp_reference.rs` 4/4, and the `buildSnapshotSerializer.ts` prefix/suffix routing tests (Story 4.1). Task 1's `item_data.rs` additions are additive (`#[serde(default)]`) and must not perturb them.

---

## Dev Notes

### What already exists — REUSE map (do not reinvent)

| Concern | Reuse this | Status |
|---|---|---|
| Item search | `item-database/itemSearch.ts` `searchItems` (prefix/substring/fuzzy) | extend (prebuilt index + set items + slot filter) |
| Item DB load + staleness | `itemDatabaseLoader.ts` → `gameDataStore.itemDatabase` (+ `isItemDataStale`/`isItemDataUpdating`) | reuse as-is |
| Modal shell | `build-manager/DeleteConfirmDialog.tsx` (Headless UI `Dialog`) — **copy locally** | pattern |
| Keyboard grid | `skill-picker/SkillPickerGrid.tsx` roving-tabindex `role=grid` — copy locally | pattern |
| Selection card | `blessings/BlessingsPanel.tsx:37-60` `<button aria-pressed>` gold-active | pattern |
| Typeahead search | `item-database/AffixPicker.tsx:17-71` (Combobox + useMemo filter + Escape) | pattern |
| Equip write | `GearSlot.writeToStore` → `buildStore.updateContextGear` (GearSlot.tsx:106-127) | reuse idiom |
| Default affix config | `GearSlot.handleSelect` median-tier seeding (GearSlot.tsx:129-145) | reuse |
| Rarity color | `rarityColors.ts` `getRarityColorForItemType` (extend for `'set'`) | extend |
| Icon (no pipeline) | `layout/ClassGlyph.tsx` inline-SVG pattern | pattern |
| Toast | `shared/components/Toast.tsx` `showSuccessToast` | reuse |
| Reduced motion | `shared/hooks/useReducedMotion.ts` | reuse |

**Architecture plan is stale here:** architecture.md:466-468,527 prescribes greenfield `gear/ItemPickerModal.tsx` + `gear/itemSearchIndex.ts`. A large gear stack already ships under `item-database/` + `gear-optimization/`. Follow the code, not the plan — co-locate in `item-database/` (DN-6) and extend `itemSearch.ts` rather than authoring a parallel `gear/` folder that would need forbidden cross-feature imports.

### Equip wiring (exact, so the Equip button is unambiguous)

- Equipped gear = `BuildState.contextData.gear: GearItemV2[]` (build.ts:54-58) — a **flat array**, each item keyed by its own `slotId`, **not** a `Record<slot,item>`.
- `GearItemV2 = { slotId, itemId?, itemName, affixes: AffixEntryV2[] }` (build.ts:21-26). `AffixEntryV2 = { affixId?, name, tier?, position?, value? }` (build.ts:9-19; `position` from Story 4.1). The serializer (`toGearSlots`, buildSnapshotSerializer.ts:155-175) **only scores affixes that have BOTH `affixId` and `tier`** — free-text/name-only affixes are display-only and never reach the engine. Produce DB-backed affixes via `buildAffixEntries` (GearSlot.tsx:51-62) so they score.
- **The ONLY write path** is `updateContextGear(gear)` (buildStore.ts:577-589) — whole-array replace. There is no `equip`/`setGear` action and none should be added.
- **Re-score is automatic:** `useStatSheet` subscribes to the whole build store and recomputes `compute_stats` on any mutation (useStatSheet.ts:51, rAF-debounced + generation counter); `useGearStream` drives `run_gear_scoring` off the same `toBuildSnapshot`. No manual compute call after equip.
- **Undo:** `updateContextGear` does **NOT** push `undoStack` (contrast node allocation at buildStore.ts:572). Equipping is not undoable today. FR-27 does not require undo — **keep equip out of undo scope** (matches current behavior); do not silently add undo, and do not assume it exists.

### Slot vocabulary (integration gap — must map)

Three layers disagree. `GEAR_SLOTS` (gearData.ts:1-13, 11 ids): `helmet, body, gloves, belt, boots, ring1, ring2, amulet, relic, weapon, offhand`. DB `slot` values: `helm, chest, gloves, belt, boots, ring_1, amulet, relic, weapon, off_hand, catalyst, blessing, idol, lens` (14 distinct). Mismatches: `helmet≠helm`, `body≠chest`, `offhand≠off_hand`, and **only `ring_1` exists** (no `ring_2`). Author the map in Task 5; the current `GearSlot` does **not** slot-filter search (it lets a helmet slot pick a weapon) — the modal must.

### NFR-5 — prebuilt index, no new dependency (AR-8)

`AR-8` (epics.md:166) forbids a new frontend dependency. Build the index by hand (token/prefix maps built once on item-DB load), reuse Headless UI (already a dep, package.json:14) for the Dialog. The current `searchItems` recomputes per keystroke and skips sets — that is the scan NFR-5 says to replace with a *prebuilt* index. Corpus is small (~1,391), so correctness (include sets, slot filter) matters more than raw speed, but satisfy the "prebuilt" wording.

### Governing patterns / ADRs (do not violate)

- **FR-27** (epics.md:79, :796-809) — the modal spec (scoped per DN-1). **NFR-5** (epics.md:133) — <100ms via client-side prebuilt index.
- **AR-8 (ADR-P4-006)** (epics.md:166) — no new frontend dependency.
- **AR-9 (ADR-P4-007 / Pattern P4-8)** (epics.md:167) — route all rarity/damage colors through `rarityColors.ts`; values-only, no token renames.
- **NFR-14** (epics.md:148) — 2px gold focus ring on all interactive elements; `prefers-reduced-motion` gates animation; new components pass `vitest-axe` (any new violation fails CI).
- **project-context.md** — no barrel files; no cross-feature imports (route via `src/shared/`); `invokeCommand<T>()` wrapper never raw `invoke`; four stores only; snapshot exclusively via `toBuildSnapshot`; Rust output is snake_case; components co-locate tests.

### Testing requirements

Per the project's SOURCE-AUDIT + VERIFICATION guardrails, tests assert **real field values render and real filters filter**, not that "a modal opens":

- **Value-assertion (Task 1, mandatory):** a real base item's implicit text and a real unique's affix text render **non-empty and correct** end-to-end (loader → type → tooltip). A "renders something"/count test is explicitly insufficient — it passed on rich mocks while real data was empty, which is exactly the bug this story fixes. [SOURCE-AUDIT + VERIFICATION GUARDRAIL; memory source-audit-at-create-story]
- **Displayed-value coverage:** the grid card renders real name/baseType/affix-count from a real-shaped seeded DB; the unique branch shows the stat-line fallback (not an empty flavor block).
- **Filter behavior:** Rarity=Unique hides bases; Base Type narrows; slot-scoped open excludes wrong-slot items.
- **Equip:** exactly one `{slotId,itemId,itemName,affixes}` written via `updateContextGear`, replacing (not duplicating) an already-equipped slot; affixes carry `affixId+tier+position` so they score.
- **A11y:** `vitest-axe` no-violations in empty/loaded/selected states; Escape closes; focus trap (Headless UI).
- **Regression:** `pnpm build` clean; full `pnpm vitest` no NEW failures vs the 7-failure baseline (ProviderSelector ×5 / Settings ×1 / TreeControls ×1); `cargo test -p scoring-core` + `-p lebo` green with the frozen 4.0/4.1 tests untouched. `item_data.rs` additions are `#[serde(default)]` (additive) so they must not move any effect-count/parity pin.

## Source Audit

**Not a new compute `StatKey` — a set of newly-DISPLAYED and FILTERED item fields.** Story 4.2 adds no `StatKey`, `StatSheet` field, or modifier-registry value, so no compute value+element parity test applies. But it **surfaces new displayed values** (item cards, hover tooltips) and **new filter inputs**, and this project's #1 failure mode is exactly "displayed/filtered-but-not-sourced" — so every displayed/filtered field is audited here, with an honest fallback or explicit deferral for each that is not sourced. [guardrail; memory source-audit-at-create-story]

**Sourced (real shipped data — build these):**
- **Item name, base type** — populated on all 897 base + 471 unique + 23 set (base-items.json / uniques.json / set-items.json). No `unnamed-*` in picker-visible items.
- **Slot** — populated on every item (14 distinct DB values); the basis for slot-scoping.
- **Rarity-as-collection (Base / Unique / Set)** — real via array membership; colored through `rarityColors.ts` (extend for `'set'`).
- **Hover tooltip / affix rows** — sourced **after Task 1's passthrough**: base implicit text ships in `base-items.json` implicits[].text (821/897 populated), unique affix text ships inline in `uniques.json` affixes[].text. The text is **produced** by the committed transform and **consumed** by the tooltip (no dead field). Verified by value-assertion tests (a sampled base + unique render their real text). Today it is dropped serde-side (`RawBaseItem`/`RawUniqueItemAffix`) — the passthrough is the fix, not fabrication.
- **Affix slot count** — unique = `affixes.length` (sourced). Base/set = documented rule constant `CRAFTABLE_AFFIX_SLOTS = 4` (a single named constant declared as a rule-derived value, NOT a per-item field invented per card; DN-3).

**Honest fallbacks / deferrals (do NOT render dead controls):**
- **Item Level range slider** — **DEFERRED** (DN-1): `itemLevel`/`levelRequirement` is absent on all 1,391 items (JSON, Rust models item_data.rs:51-77, TS types itemDatabase.ts:27-48). Not rendered. Re-enable only when a follow-up data gate sources it.
- **Required Tags filter** — **DEFERRED as literal tags** (DN-1): no `tags` field anywhere. Shipped instead as a **Base Type** filter (39 real values) — an honest sourceable stand-in, clearly labeled Base Type, not "Tags."
- **Rarity tiers beyond Base/Unique/Set** — the `magic/rare/exalted/legendary` entries in `RARITY_COLORS` have **no items**; the filter offers only the 3 real collections, never empty buckets.
- **Unique flavor text** — 0/471 sourced → the card's unique branch shows the unique's **affix stat-line summary** (sourced via Task 1), never an empty flavor block (DN-4).

**No dead field:** every field the modal displays or filters on is either produced-and-consumed real data, or a declared rule-constant, or explicitly deferred/omitted (not rendered). No control is shown over a 0%-populated source. This is the audit gate that must hold before `ready-for-dev` → `done`.

## Previous Story Intelligence

**Story 4.1 (position discriminator, done 2026-07-02):** established that equipped-affix routing keys off `AffixEntryV2.position` (`'suffix'`→suffixes, else prefixes) in `toGearSlots`, and that `buildAffixEntries` (GearSlot.tsx:51-62) sources `position` from the item-DB affix `type`. The modal's equipped affixes must carry `position` (via `buildAffixEntries`) so they route + score correctly. The serializer prefix/suffix routing tests are **frozen** — 4.2 must not regress them. [Source: 4-1-affix-prefix-suffix-discriminator-data-gate.md]

**Story 4.0 (affix stat-semantics, done 2026-07-02):** rewrote `generate_item_db.py`; the affix **corpus** (`affixes.json`, 1,117 affixes) now carries `statKey`/`name`/per-tier ranges/`itemSlots`. This is why *craftable affixes a user adds to a base* have real names + tier ranges (via `AffixEntry` corpus, itemDatabase.ts:16-25). It did **not** touch base `implicits[].text` or unique inline affix `text` deserialization — that gap is Task 1 here. Frozen tests to keep green: `gear_affix_parity_*`, `no_dead_gear_stat_keys`, `ehp_reference.rs` (EHP ±2%). [Source: 4-0-affix-stat-semantics-data-gate.md]

**Displayed-but-not-sourced lineage:** Epic 1 hit "computed-but-not-sourced" three times (penetration, stun, minion). 4.0/4.1 fixed the affix corpus. 4.2 is the **first UI story to re-encounter the trap at the item/base layer** — the Source Audit above is the direct mitigation. [memory: source-audit-at-create-story, lebov2-audit-2026-07-01-data-gaps]

## Git intelligence (provenance caution — read before branching)

- **HEAD is `a180ac4`, a raw `[AutoSave]` snapshot** ("2026-07-02 22:55"); working tree clean. The last **named/reviewed** commits are `cad0e6b` + `d3d7090` (2026-07-01); everything after is `[AutoSave]`.
- **Stories 4.0 and 4.1 are `done` but exist ONLY in `[AutoSave]` commits** — the item/gear code (`item-database/*` newest `916aa51`, `gear-optimization/*`), and the item JSON corpus (`base-items.json`, `uniques.json`, `affixes.json` — mtime 2026-07-02) landed only in AutoSave snapshots (`9137ad6`/`7730e4b`). Per memory `autosave-watcher-unvalidated` ("never trust a raw `[AutoSave]` SHA; land a reviewed commit before building on it"), **recommend committing a reviewed "Story 4.0/4.1 complete" baseline before starting 4.2**, so 4.2's References cite a stable SHA. Non-blocking for authoring; a provenance flag for Alec. Also gitignore the AutoSaved `docs/data-transform/__pycache__/*.pyc` noted in 4.1.

### Project Structure Notes

- New files (DN-6): `lebo/src/features/item-database/ItemPickerModal.tsx` (+ co-located `.test.tsx`), an optional `itemSearchIndex.ts` in the same folder (or extend `itemSearch.ts`), and a slot-map constant (co-locate with `gearData.ts` or in `item-database/`). No new feature folder; no barrel files; no cross-feature imports (copy Dialog/Grid patterns locally).
- Rust: additive fields on `RawBaseItem`/`RawUniqueItemAffix` (item_data.rs) + TS mirror (itemDatabase.ts). No new Tauri command, no `scoring-core` change, no serializer change, no new store (four-store rule).
- Wire the open trigger in `GearTab.tsx`; keep `context-panel/GearInput.tsx` (free-text) untouched (DN-5). No React Router; no `appStore.currentView` change (the modal overlays the Gear tab).

### References

- [Source: epics.md:79 (FR-27), :133 (NFR-5), :796-809 (Story 4.2 AC), :788 (4.0/4.1 gate — satisfied), :166 (AR-8), :167 (AR-9), :148 (NFR-14)]
- [Source: architecture.md:466-468, :527 — prescribes greenfield `gear/ItemPickerModal.tsx` + `itemSearchIndex.ts`; STALE vs the shipped `item-database/` stack — reconcile, do not duplicate]
- [Source: item_data.rs:51-57 (RawBaseItem — no `implicits`, Task 1 adds it), :61-65 (RawUniqueItemAffix — no `text`/`statKey`, Task 1 adds), :69-77 (RawUniqueItem.description Option), :100-107 (ItemDatabase)]
- [Source: itemDatabase.ts:16-25 (AffixEntry corpus — name+tiers, no text), :27-33 (BaseItem), :35-48 (UniqueItem/UniqueItemAffix), :66-71 (ItemDatabase), :73-79 (SearchResult — extend to include `set`)]
- [Source: GearSlot.tsx:29 (medianTier), :33-49 (resolveAffixes — base reads empty implicitAffixIds; unique joins to corpus), :51-62 (buildAffixEntries — position from type), :88-91 (searchItems slice 6), :106-127 (writeToStore → updateContextGear idiom), :129-145 (handleSelect default-affix seeding), :225-255 (Database-unavailable fallback), :311-405 (selected render — name in rarity color, no tooltip/icon), :337-348 (unique read-only affix rows)]
- [Source: buildStore.ts:577-589 (updateContextGear — sole write path, no undo push)]
- [Source: build.ts:9-19 (AffixEntryV2 + position), :21-26 (GearItemV2 + itemId?), :54-58 (contextData.gear)]
- [Source: buildSnapshotSerializer.ts:112-136 (toBuildSnapshot), :155-175 (toGearSlots — affixId+tier filter :159-162, position routing :168-171)]
- [Source: useStatSheet.ts:51 (whole-store subscribe → auto recompute); useGearStream.ts:24,32 (run_gear_scoring off same serializer)]
- [Source: itemSearch.ts:3-17 (levenshtein), :32-67 (searchItems — linear, no slot filter, skips setItems); itemSearch.test.ts:127-149 (1400-item <50ms benchmark to extend for NFR-5)]
- [Source: DeleteConfirmDialog.tsx (Headless UI Dialog pattern to copy); RemoveNodeConfirmDialog.tsx:10-11 (copy-locally / no cross-feature-import rule); SkillPickerGrid.tsx:54-169 (roving-tabindex grid); BlessingsPanel.tsx:37-60 (aria-pressed card); AffixPicker.tsx:17-71 (Combobox typeahead)]
- [Source: rarityColors.ts:5-13 (RARITY_COLORS 7 tiers), :15-17 (getRarityColorForItemType — base|unique only, extend for set), :19-27 (DAMAGE_TYPE_COLORS); global.css:47-54 (--color-rarity-* mirror), :169-178 (reduced-motion), :180-184 (2px gold :focus-visible)]
- [Source: gearData.ts:1-13 (GEAR_SLOTS, 11 ids); gameDataStore.ts:28-32,86-93 (itemDatabase + staleness flags); Toast.tsx:9-11 (showSuccessToast); useReducedMotion.ts; ClassGlyph.tsx (inline-SVG glyph pattern)]
- [Source: itemDatabaseLoader.test.ts:5-13 (vi.mock invokeCommand IPC pattern); GearSlot.test.tsx:30-93 (inline mock DB + axe a11y pattern)]
- [Source: base-items.json (897; implicits[].text 821/897; no rarity/itemLevel/tags), uniques.json (471; 0 description; inline affixes[].text), set-items.json (23; has description)]
- [Source: 4-1-affix-prefix-suffix-discriminator-data-gate.md, 4-0-affix-stat-semantics-data-gate.md — predecessors, frozen tests]
- [Source: project-context.md — no barrel files, no cross-feature imports, invokeCommand wrapper, four stores, toBuildSnapshot sole conversion, snake_case Rust output, vitest-axe gate]

## Decisions & risks

**DN-1 (primary scope) — RECOMMENDED Option A: sourceable subset + fold-in text-passthrough; defer Item Level + literal Required Tags filters.** Awaiting Alec's ratification (surfaced interactively at story creation). Alternatives: Option B (preceding item-metadata data gate — blocked on whether PoB4LE upstream carries itemLevel/tags), Option C (full FR-27 with empty filters — REJECTED, #1 defect class).

**DN-2..DN-6 — recommended defaults applied** (ratify or override): fold the passthrough into 4.2 (DN-2); affix slot count = constant 4 / unique `affixes.length` (DN-3); unique flavor → stat-line fallback (DN-4); modal is canonical equip entry, GearSlot retained as affix editor, single `updateContextGear` write path (DN-5); new modal in `item-database/` not a new `gear/` folder (DN-6).

**Risks:**
- **Over-scoping to the stale plan** — architecture.md frames greenfield `gear/` files; the `item-database/` stack already exists. Reuse or risk a third parallel gear UI + forbidden cross-feature imports.
- **Displayed-but-not-sourced regression** — the exact trap: rich test mocks make the modal look done while real data renders blank. Task 1 + the Source-Audit tests are the mitigation; do not accept a "renders something" test in their place.
- **Silent invention** — the affix-slot-count constant and the Base-Type-as-Tags relabel are honest only if declared (Source Audit) and not dressed up as per-item data.
- **Provenance** — HEAD and the 4.0/4.1 stack are AutoSave-only; recommend a reviewed baseline before branching.

## Dev Agent Record

### Agent Model Used

_(dev-story fills this in)_

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Change |
|------|--------|
| 2026-07-02 | Story 4.2 created (create-story + ultracode). First UI story of Epic 4; both data gates (4.0/4.1) done. Ground-truth established by 6 parallel HEAD verifiers + inline re-verification of the highest-risk claim (Rust drops base `implicits`/unique affix `text` — CONFIRMED at item_data.rs:51-65; base+unique affix display renders empty from real data while tests pass on mocks). Scope decision DN-1 surfaced: FR-27's Item Level + Required Tags filters + unique flavor + tooltip are unsourced at HEAD; recommended Option A (sourceable subset — Rarity-as-collection, Base Type, slot-scope — + a contained base-`implicits`/unique-`text` passthrough for tooltips, deferring Item Level + literal Tags to a follow-up data gate). Extend-not-greenfield: reuse GearSlot/itemSearch/updateContextGear/Dialog/SkillPickerGrid/rarityColors. Source Audit written (every displayed/filtered field sourced, rule-constant, or explicitly deferred; no dead controls). Status → ready-for-dev (DN-1 pending ratification). |
