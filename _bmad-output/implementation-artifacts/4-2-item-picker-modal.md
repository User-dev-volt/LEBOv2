# Story 4.2: Item Picker Modal

Status: review

**Depends on: Story 4.1.5 (Item metadata + display-text data gate) — MUST be `done` before this story starts.** 4.2 consumes the `levelRequirement`, base `implicits[].text`, and unique `affixes[].text` that 4.1.5 sources; without it the Item Level filter and hover tooltip render blank (the displayed-but-not-sourced trap this pair was split to prevent).

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player building gear,
I want a searchable, filterable item-database modal,
so that I can find and equip any base item without leaving the app.

> **This is the FIRST UI story of Epic 4.** It is **extend-not-greenfield**: a working DB-backed gear picker already ships (`item-database/GearSlot.tsx` inline `Combobox` + `itemSearch.searchItems` + `updateContextGear` equip + median-tier default-affix seeding). ~80% of FR-27's machinery exists — the NEW surface is the **modal chrome** (Dialog shell, sidebar filters, card grid, hover tooltip, Equip button). **Do NOT rebuild the search/loader/equip layers — reuse them.** **4.2 is frontend-only** — the data/Rust work (item level + display text) is owned by the 4.1.5 gate; do not touch `item_data.rs`/the transform here. [Source: ground-truth verification 2026-07-02, 6 parallel HEAD verifiers + 4-agent adversarial re-verify; source spike 2026-07-03]

## Scope (RESOLVED — Alec, 2026-07-03: Option B "source what's real")

A create-story source-audit spike found FR-27 over-specifies what the shipped item data can feed. Alec ratified **Option B**: a preceding data gate (Story 4.1.5) sources the fields that are genuinely in the PoB4LE upstream, and 4.2 ships every FR-27 element the data can **honestly** support. Result per field:

| FR-27 element | Disposition in 4.2 | Source |
|---|---|---|
| **Real-time search** | ✅ Ship (prebuilt index, incl. set items) | `itemSearch.searchItems` (extend) |
| **Rarity** filter | ✅ Ship as **Base / Unique / Set** collections | array membership (only real "tiers"; magic/rare/exalted are runtime roll states, absent from a static DB) |
| **Item Level** range slider | ✅ Ship — **REAL** | `levelRequirement` (from `req.level`, 100% of items) — sourced by **4.1.5** |
| **Required Tags** filter | ✅ Ship as an **Item Type** filter | real `type` (39 values); PoB4LE has NO tags field, so Item Type is the honest sourceable categorical (NOT invented tags) |
| Card **icon** (slot glyph in rarity color) | ✅ Ship — inline SVG, rarity-tinted | `rarityColors.ts` (extend for `'set'`); no item icon assets exist |
| Card **name / base type** | ✅ Ship | always populated |
| Card **affix slot count** | ✅ Ship — unique = `affixes.length`; base/set = constant `CRAFTABLE_AFFIX_SLOTS = 4` | uniques real; bases = documented LE rule constant (declared, not per-item invented) |
| Card **unique flavor text** | ✅ Ship as a **stat-line fallback** | 0/471 uniques carry flavor → show the unique's affix stat lines (`affixes[].text`, sourced by 4.1.5) instead of an empty flavor block |
| **Hover tooltip** "full stat description" | ✅ Ship — **REAL** | base `implicits[].text` (821/897) + unique `affixes[].text` (100%) — sourced by **4.1.5** |
| Single-click select / **Equip Item** button | ✅ Ship | new |
| **Double-click equip** w/ default affix config | ✅ Ship | reuse `GearSlot.handleSelect` median-tier seeding |

**No FR-27 element is dropped, and none is faked.** The only reframes are honest, source-backed substitutions (Required Tags → Item Type; rarity → collections; unique flavor → stat lines) because PoB4LE has no tags/rarity-tier/flavor data (spike-verified: 0 occurrences across 897 bases + 471 uniques). [Source: source spike 2026-07-03; memory source-audit-at-create-story]

## Acceptance Criteria

Verbatim from epics.md (Story 4.2, :796-809 / FR-27 :79 / NFR-5 :133), annotated with **HEAD reality** and the Option B disposition.

**AC1 — Open from empty slot or "Swap item"**
**Given** an empty gear slot or "Swap item" on an equipped slot
**When** I click it
**Then** the Item Picker Modal opens with sidebar filters (Rarity, Item Level range slider, Required Tags), a real-time search bar, and an item grid showing icon (slot glyph in rarity color), name, base type, and affix slot count or unique flavor text (FR-27).

> **HEAD reality / disposition:** Modal, sidebar, grid, icon, tooltip are **missing-create**. Filters (Option B): **Rarity → Base/Unique/Set** collection filter; **Item Level → REAL range slider** over `levelRequirement` (from 4.1.5); **Required Tags → Item Type filter** (real `type`, 39 values). Card **affix slot count** = unique `affixes.length` / base+set constant `4`; **unique flavor → stat-line fallback**. Open trigger wires into `GearTab.tsx` (renders a 2-col grid of `GearSlot`); slot-scoping requires a GEAR_SLOTS-id ↔ DB-slot map (Task 4).

**AC2 — Real-time search < 100ms via a prebuilt index**
**Given** the full item database
**When** I type a search query
**Then** filtered results return in under 100ms via a prebuilt client search index (NFR-5).

> **HEAD reality / disposition:** `itemSearch.searchItems` (itemSearch.ts:32-67) is a **per-keystroke linear + Levenshtein scan that omits set items** — likely <100ms over ~1,391 items (its benchmark asserts <50ms over 1,400, itemSearch.test.ts:127-149) but **not the "prebuilt index" NFR-5 names**. **In scope:** add a prebuilt index (built once on item-DB load), **include set items** (extend `SearchResult.type` to `'base'|'unique'|'set'`), keep the ranking semantics.

**AC3 — Single-click select / double-click equip / hover tooltip**
**Given** an item in the grid
**When** I single-click it
**Then** it is selected and equippable via an "Equip Item" button; double-click equips immediately with a default affix configuration that can be modified
**And** hovering an item card shows a tooltip with its full stat description.

> **HEAD reality / disposition:** Select + Equip button + double-click-equip are **missing-create** (today selection is inline `Combobox.onChange` → immediate equip, GearSlot.tsx:129-145). **"Default affix configuration" reuses** `handleSelect` median-tier seeding (GearSlot.tsx:129-145, `medianTier` :29). **Hover tooltip = REAL** after 4.1.5: base `implicits[].text` + unique `affixes[].text` (rendered directly, NOT via the empty `implicitAffixIds` corpus join). Equipping recomputes stats **automatically** — no manual `compute_stats` call.

## Tasks / Subtasks

- [x] **Task 0 — Confirm the 4.1.5 gate landed (dependency guard)**
  - [x] Verify the item DB reaching the frontend carries `levelRequirement` on bases + uniques, `implicits[].text` on bases, and `affixes[].text` on uniques (the fields 4.1.5 sources). If they are absent, STOP — 4.1.5 is not done; this story renders blank filters/tooltips without it.
- [x] **Task 1 — Prebuilt search index + set-item inclusion (AC2, NFR-5)**
  - [x] Add a prebuilt index (built once from the loaded `ItemDatabase`; lowercased name/baseType token maps) that `searchItems` (or a thin wrapper) consumes — no scan-from-scratch per keystroke. Keep the existing prefix/substring/fuzzy ranking.
  - [x] Include `setItems` in the searchable corpus (currently skipped, itemSearch.ts:41-53). Extend `SearchResult.type` to `'base' | 'unique' | 'set'` (itemDatabase.ts:73-79) and everything that switches on it (incl. `getRarityColorForItemType`, Task 3).
  - [x] Perf test: <100ms over the full real corpus (897 + 471 + 23 = 1,391) — extend itemSearch.test.ts:127-149. Assert the index builds **once**, not per query. No new dependency (AR-8) — hand-built index.
- [x] **Task 2 — ItemPickerModal shell + grid + sidebar (AC1)** — new file `lebo/src/features/item-database/ItemPickerModal.tsx` (DN-2)
  - [x] **Copy** the Headless UI `Dialog` scaffold from `DeleteConfirmDialog.tsx` **locally** (do NOT import it — cross-feature import forbidden, RemoveNodeConfirmDialog.tsx:10-11): `<Dialog open onClose>` + `fixed inset-0` overlay `rgba(0,0,0,0.5)` + flex-center + `<DialogPanel>` tokens (`--color-bg-surface`, border `--color-bg-elevated`). Widen well beyond `max-w-sm` for sidebar + grid.
  - [x] Sidebar filters (all sourced): **Rarity** = Base/Unique/Set toggle; **Item Type** = select over the 39 real `baseType` values (the honest Required-Tags analog); **Item Level** = range slider over `levelRequirement` (min/max from the corpus). Result count in a `role="status" aria-live="polite"` region (BlessingsPanel/SuggestionsList idiom).
  - [x] Item grid: reuse `SkillPickerGrid.tsx`'s roving-tabindex `role="grid"` + arrow/Enter/Escape (copy locally, :54-170). Each card = slot glyph (Task 3) + name (rarity-colored) + baseType + affix-slot-count (unique `affixes.length` / base+set `CRAFTABLE_AFFIX_SLOTS=4`). Single-click selects (`<button aria-pressed>` gold-active, BlessingsPanel.tsx:38-60 inner OptionRow, NOT the outer BlessingCard).
  - [x] Handle **item-DB-not-loaded** via existing `gameDataStore` flags (`itemDatabase===null`, `isItemDataUpdating`, `isItemDataStale`) — mirror GearSlot's "Database unavailable" fallback (GearSlot.tsx:225-255). Do not invent new state.
- [x] **Task 3 — Slot glyph in rarity color (AC1 card icon)**
  - [x] No item icon pipeline exists (`useIconTextures` is PixiJS skill-only). Render an **inline SVG slot glyph** (ClassGlyph.tsx pattern), one per slot type, tinted by rarity color.
  - [x] Color **only** via `rarityColors.ts` (AR-9): extend `getRarityColorForItemType` (rarityColors.ts:15-17) to accept `'set'` (currently `'base'|'unique'`). Never hardcode hex; CSS side uses the mirrored `--color-rarity-*` tokens.
- [x] **Task 4 — Slot-scoped opening + GEAR_SLOTS↔DB-slot map (AC1)**
  - [x] Author a mapping table: `GEAR_SLOTS` ids (gearData.ts:1-13 — 11 ids: `helmet, body, gloves, belt, boots, ring1, ring2, amulet, relic, weapon, offhand`) ↔ DB `slot` values (`helm, chest, gloves, belt, boots, ring_1, amulet, relic, weapon, off_hand, catalyst, ...`). Mismatches: `helmet≠helm`, `body≠chest`, `offhand≠off_hand`; **only `ring_1` exists** — map both `ring1`/`ring2` to it; handle absent ring bases gracefully.
  - [x] Make the picker slot-aware: opening from a slot filters the grid to slot-valid items (`searchItems` has no slot filter today — add one). A helmet slot must not list weapons.
- [x] **Task 5 — Hover tooltip = real stat description (AC3)**
  - [x] Tooltip renders the item's real text: base → `implicits[].text` (from 4.1.5); unique → `affixes[].text` (from 4.1.5). Render directly as display strings — do NOT go through `resolveAffixes`'s `implicitAffixIds`/corpus join (empty/non-joining on real data). The unique-flavor card branch shows the same stat lines (DN-4 fallback).
- [x] **Task 6 — Equip wiring: Equip button + double-click (AC3)**
  - [x] Equip writes through the **existing idiom** (reuse, do not fork): read `useBuildStore.getState().activeBuild?.contextData.gear ?? []`, filter out the target `slotId`, append `{ slotId, itemId, itemName, affixes }`, call `updateContextGear(next)` (mirror GearSlot.writeToStore, GearSlot.tsx:106-127). **Populate `itemId`** (the `SearchResult.id`) — currently omitted (build.ts:23); the serializer already forwards it (toGearSlots:169), so it flows end-to-end with no serializer change. Never call `set()` directly; never pass `BuildState` around.
  - [x] Double-click = equip with default affix config = median-tier resolved affixes (reuse `handleSelect`, GearSlot.tsx:129-145). User modifies via the retained `GearSlot` affix-tier editor / AffixPicker.
  - [x] `showSuccessToast('Equipped …')` (Toast.tsx:9-11) + announce in the modal's `aria-live` region; close on equip.
  - [x] **Do NOT add a manual re-score.** Equipping mutates the build store; `useStatSheet` (whole-store subscribe, useStatSheet.ts:51) + `useGearStream` (useGearStream.ts:24,32 via `startGearAnalysis`) recompute `compute_stats` + `run_gear_scoring` automatically through `toBuildSnapshot`.
- [x] **Task 7 — Accessibility (NFR-14)**
  - [x] Rely on the **global** `:focus-visible` 2px gold ring (global.css:181-184, which also sets `outline-offset:2px` at :183) for buttons — do not re-implement per element; add explicit `onFocus/onBlur` outline ONLY for the `<select>` (IdolAffixPicker precedent). Headless UI `Dialog` supplies focus-trap + Escape→onClose + restore-focus; do not hand-roll `role="dialog"`.
  - [x] Keep the modal **un-animated** (no Headless UI `Transition` — matches every existing modal) or gate any animation behind `useReducedMotion()`.
  - [x] `vitest-axe`: `expect(await axe(container)).toHaveNoViolations()` in empty, loaded-grid, and item-selected states (mirror GearSlot.test.tsx).
- [x] **Task 8 — Tests + regression green**
  - [x] Component tests reuse the house patterns: seed a mock `ItemDatabase` inline as a prop / via `makeDatabase()` (itemSearch.test.ts:5-13, GearSlot.test.tsx:30-93) — the mock DB MUST carry `levelRequirement` + implicit/affix `text` (mirror 4.1.5's real shape); mock IPC via `vi.mock('../../shared/utils/invokeCommand')` (NOT `@tauri-apps/api/core`, itemDatabaseLoader.test.ts:5-13); reset stores with `useBuildStore.setState(initial, true)` in `beforeEach`.
  - [x] **Source-Audit tests (non-negotiable):** (a) the grid renders **real** name/baseType/affix-count/tooltip-text from a real-shaped seeded DB (not "a modal opens"); (b) filters actually filter — Rarity=Unique hides bases; Item Type narrows; **Item Level slider narrows by `levelRequirement`** (assert a low-level item shows and a high-level one hides at a given range); slot-scope excludes wrong-slot items; (c) equip writes exactly one `{slotId,itemId,itemName,affixes}` via `updateContextGear`, replacing (not duplicating) an equipped slot; (d) tooltip shows the real implicit/affix text value.
  - [x] `pnpm build` clean. Full `pnpm vitest` (from `lebo/`) **no NEW failures vs the standing 7-failure baseline** (ProviderSelector ×5 / Settings ×1 / TreeControls ×1). No Rust change in this story (4.1.5 owns it), so `cargo` suites are unaffected — but do not regress them; the frozen 4.0/4.1 tests stay green.

## Dev Notes

### What already exists — REUSE map (do not reinvent)

| Concern | Reuse this | Status |
|---|---|---|
| Item search | `item-database/itemSearch.ts` `searchItems` (prefix/substring/fuzzy) | extend (prebuilt index + set items + slot filter) |
| Item DB load + staleness | `itemDatabaseLoader.ts` → `gameDataStore.itemDatabase` (+ staleness flags) | reuse as-is |
| Item level + display text | `BaseItem.levelRequirement` / `.implicits[].text`, `UniqueItemAffix.text` | reuse (sourced by **4.1.5**) |
| Modal shell | `build-manager/DeleteConfirmDialog.tsx` (Headless UI `Dialog`) — **copy locally** | pattern |
| Keyboard grid | `skill-picker/SkillPickerGrid.tsx:54-170` roving-tabindex `role=grid` — copy locally | pattern |
| Selection card | `blessings/BlessingsPanel.tsx:38-60` (inner OptionRow) `<button aria-pressed>` gold-active | pattern |
| Typeahead search | `item-database/AffixPicker.tsx:17-72` (Combobox + useMemo filter + Escape) | pattern |
| Equip write | `GearSlot.writeToStore` → `buildStore.updateContextGear` (GearSlot.tsx:106-127) | reuse idiom |
| Default affix config | `GearSlot.handleSelect` median-tier seeding (GearSlot.tsx:129-145) | reuse |
| Rarity color | `rarityColors.ts` `getRarityColorForItemType` (extend for `'set'`) | extend |
| Icon (no pipeline) | `layout/ClassGlyph.tsx` inline-SVG pattern | pattern |
| Toast | `shared/components/Toast.tsx` `showSuccessToast` | reuse |
| Reduced motion | `shared/hooks/useReducedMotion.ts` | reuse |

**Architecture plan is stale here:** architecture.md:466-468,527 prescribes greenfield `gear/ItemPickerModal.tsx` + `gear/itemSearchIndex.ts`. A large gear stack already ships under `item-database/`. Follow the code — co-locate in `item-database/` (DN-2) and extend `itemSearch.ts`.

### Equip wiring (exact)

- Equipped gear = `BuildState.contextData.gear: GearItemV2[]` (build.ts:54-58) — a **flat array**, each item keyed by its own `slotId`.
- `GearItemV2 = { slotId, itemId?, itemName, affixes: AffixEntryV2[] }` (build.ts:21-26). `toGearSlots` (buildSnapshotSerializer.ts:155-175) **only scores affixes with BOTH `affixId` and `tier`** (:159-162) and routes by `position` (:168-171, from 4.1). Produce DB-backed affixes via `buildAffixEntries` (GearSlot.tsx:51-62) so they score; it forwards `itemId` at :169.
- **The ONLY write path** is `updateContextGear` (buildStore.ts:577-589) — whole-array replace; **does NOT push `undoStack`** (equip is not undoable today — FR-27 doesn't require it; keep it out of undo scope, do not assume it exists).
- **Re-score is automatic** (useStatSheet.ts:51 whole-store subscribe; useGearStream startGearAnalysis). No manual compute call.

### Slot vocabulary (integration gap — Task 4)

`GEAR_SLOTS` (gearData.ts:1-13, 11 ids) vs DB `slot` (14 distinct: `helm, chest, gloves, belt, boots, ring_1, amulet, relic, weapon, off_hand, catalyst, blessing, idol, lens`). `helmet≠helm`, `body≠chest`, `offhand≠off_hand`, only `ring_1`. The current `GearSlot` does not slot-filter search; the modal must.

### NFR-5 + AR-8

Hand-built prebuilt index (no new dependency, AR-8 :166). Corpus is ~1,391 — correctness (include sets, slot filter) matters more than raw speed, but satisfy "prebuilt."

### Governing patterns / ADRs

- **FR-27** (epics.md:79, :796-809); **NFR-5** (epics.md:133) — <100ms client-side prebuilt index.
- **AR-8** (epics.md:166) no new frontend dependency. **AR-9** (epics.md:167) rarity/damage colors via `rarityColors.ts`, values-only. **NFR-14** (epics.md:148) 2px gold focus ring, `prefers-reduced-motion`, `vitest-axe` gate.
- **project-context.md** — no barrel files; no cross-feature imports (copy patterns locally); `invokeCommand<T>()` wrapper; four stores; snapshot via `toBuildSnapshot`; snake_case Rust output; co-located tests.

### Testing requirements

Tests assert **real field values render and real filters filter**, not "a modal opens": the Item Level slider narrows by real `levelRequirement`; the tooltip shows the real implicit/affix text; Rarity/Item-Type filters narrow; equip writes one item via `updateContextGear`. A11y: `vitest-axe` no-violations in empty/loaded/selected; Escape closes; focus trap. Regression: `pnpm build` clean; `pnpm vitest` no new failures vs the 7-failure baseline. [SOURCE-AUDIT + VERIFICATION GUARDRAIL; project-context.md#Testing Rules]

## Source Audit

**Not a new compute `StatKey` — newly-DISPLAYED and FILTERED item fields, each backed by a real source or an honest declared fallback.** Story 4.2 adds no `StatKey`/`StatSheet` field, so no compute value+element parity applies. But it surfaces new displayed values + filters, and this project's #1 failure mode is "displayed/filtered-but-not-sourced" — audited here.

**Sourced (real shipped data — via the 4.1.5 gate + existing data):**
- **Name, base type, slot** — populated on all 1,391 items.
- **Rarity-as-collection (Base/Unique/Set)** — real via array membership; colored through `rarityColors.ts`.
- **Item Level** — `levelRequirement` from `req.level`, 100% of items (sourced by **4.1.5**). The Item Level slider filters on a real per-item value. Verified by 4.1.5's value test (Jewelled Circlet → 7) + 4.2's filter test.
- **Hover tooltip / affix rows / unique stat-line fallback** — base `implicits[].text` (821/897) + unique `affixes[].text` (100% — 2,338/2,338), sourced by **4.1.5**. Produced (4.1.5 transform+structs) and consumed (4.2 tooltip). Verified by a value test (real text renders).
- **Item Type filter** — real `type` (39 values); the honest sourceable analog of "Required Tags."
- **Affix slot count** — unique = `affixes.length` (sourced); base/set = documented rule constant `CRAFTABLE_AFFIX_SLOTS = 4` (a single named rule-derived constant, NOT a per-item invented field).

**Honest fallbacks (declared, not fabricated — PoB4LE has no source; spike-verified 0 occurrences):**
- **Literal Required Tags** → **Item Type filter** (no `tags` field exists). Labeled Item Type, not "Tags."
- **Rarity tiers beyond Base/Unique/Set** → not offered (magic/rare/exalted/legendary have no items; they are runtime roll states).
- **Unique flavor text** → **stat-line fallback** (0/471 descriptions) — the card shows the unique's affix stat lines, never an empty flavor block.

**No dead field / no dead control:** every field the modal displays or filters on is real data (via 4.1.5 or existing), a declared rule-constant, or an honest source-backed reframe. No control is rendered over a 0%-populated source. This gate must hold before `done`.

## Previous Story Intelligence

- **Story 4.1.5 (item metadata gate — this story's prerequisite):** sources `levelRequirement` + carries base `implicits[].text` and unique `affixes[].text` to the frontend (the Rust structs previously dropped them). 4.2 consumes these; Task 0 guards the dependency. [Source: 4-1-5-item-metadata-data-gate.md]
- **Story 4.1 (position discriminator, done):** equipped-affix routing keys off `AffixEntryV2.position` in `toGearSlots` (`buildAffixEntries` sources it from the item-DB affix `type`). The modal's equipped affixes carry `position` via `buildAffixEntries` so they route/score. Serializer routing tests are frozen. [Source: 4-1-affix-prefix-suffix-discriminator-data-gate.md]
- **Story 4.0 (affix stat-semantics, done):** the affix **corpus** (`affixes.json`) carries `statKey`/`name`/tier ranges — why craftable affixes a user adds have real names + ranges. Frozen tests: `gear_affix_parity_*`, `no_dead_gear_stat_keys`, `ehp_reference.rs`. [Source: 4-0-affix-stat-semantics-data-gate.md]
- **Displayed-but-not-sourced lineage:** Epic 1 shipped computed-but-unsourced stats 3×; 4.0/4.1/4.1.5 fixed the data layer; 4.2 is the UI built on top — the Source Audit is the direct mitigation. [memory: source-audit-at-create-story, lebov2-audit-2026-07-01-data-gaps]

## Git intelligence (provenance caution)

- **HEAD is `a180ac4`, a raw `[AutoSave]`** ("2026-07-02 22:55"); working tree otherwise clean (only these new story files). Last **named** commits: `cad0e6b` (2026-07-02 05:02) + `d3d7090` (2026-07-01 23:15). The 4.0/4.1 Epic-4 corpus + item-database changes landed only in AutoSaves (`7730e4b`/`9137ad6`/`916aa51`); the `item-database` feature itself predates in the named initial commit `0b40376`. Per memory `autosave-watcher-unvalidated`, **recommend a reviewed "4.0/4.1(+4.1.5) complete" baseline** before 4.2 so its References cite a stable SHA. Gitignore the AutoSaved `docs/data-transform/__pycache__/*.pyc`.

### Project Structure Notes

- New files (DN-2): `lebo/src/features/item-database/ItemPickerModal.tsx` (+ co-located `.test.tsx`), an optional `itemSearchIndex.ts` in the same folder (or extend `itemSearch.ts`), and a slot-map constant (co-locate with `gearData.ts` or in `item-database/`). No new feature folder; no barrel files; no cross-feature imports (copy Dialog/Grid patterns locally).
- **4.2 is frontend-only** — no Rust/transform change (4.1.5 owns item level + text), no new Tauri command, no `scoring-core`/serializer change, no new store (four-store rule), no new dependency (AR-8). Wire the open trigger in `GearTab.tsx`; keep `context-panel/GearInput.tsx` (free-text) untouched (DN-3). No React Router; no `appStore.currentView` change (modal overlays the Gear tab).

### References

- [Source: epics.md:79 (FR-27), :133 (NFR-5), :796-809 (Story 4.2 AC), :788 (4.0/4.1 gate — satisfied), :166 (AR-8), :167 (AR-9), :148 (NFR-14)]
- [Source: 4-1-5-item-metadata-data-gate.md — prerequisite gate sourcing levelRequirement + implicit/affix display text]
- [Source: architecture.md:466-468, :527 — prescribes greenfield `gear/` files; STALE vs the shipped `item-database/` stack — reconcile, do not duplicate]
- [Source: itemDatabase.ts:16-25 (AffixEntry corpus — name+tiers), :27-33 (BaseItem — +levelRequirement/implicits from 4.1.5), :35-48 (UniqueItem/UniqueItemAffix — +text from 4.1.5), :73-79 (SearchResult — extend to include `set`)]
- [Source: GearSlot.tsx:29 (medianTier), :33-49 (resolveAffixes — base reads empty implicitAffixIds; unique joins non-existent corpus ids → tooltip must read text directly), :51-62 (buildAffixEntries — position from type, forwards itemId), :88-91 (searchItems slice 6), :106-127 (writeToStore → updateContextGear idiom), :129-145 (handleSelect default-affix seeding), :225-255 (Database-unavailable fallback), :311-405 (selected render — name in rarity color, no tooltip/icon)]
- [Source: buildStore.ts:577-589 (updateContextGear — sole write path, no undo push)]
- [Source: build.ts:9-19 (AffixEntryV2 + position), :21-26 (GearItemV2 + itemId?), :54-58 (contextData.gear)]
- [Source: buildSnapshotSerializer.ts:112-136 (toBuildSnapshot), :155-175 (toGearSlots — affixId+tier filter :159-162, itemId forward :169, position routing :170-171)]
- [Source: useStatSheet.ts:51 (whole-store subscribe → auto recompute); useGearStream.ts:24,32 (run_gear_scoring off same serializer, inside startGearAnalysis)]
- [Source: itemSearch.ts:3-17 (levenshtein), :32-67 (searchItems — linear, no slot filter, skips setItems); itemSearch.test.ts:127-149 (1400-item <50ms benchmark to extend for NFR-5)]
- [Source: DeleteConfirmDialog.tsx (Headless UI Dialog pattern to copy); RemoveNodeConfirmDialog.tsx:10-11 (copy-locally / no cross-feature-import rule); SkillPickerGrid.tsx:54-170 (roving-tabindex grid); BlessingsPanel.tsx:38-60 (inner OptionRow aria-pressed card — not the outer BlessingCard :75-82); AffixPicker.tsx:17-72 (Combobox typeahead)]
- [Source: rarityColors.ts:5-13 (RARITY_COLORS 7 tiers), :15-17 (getRarityColorForItemType — base|unique only, extend for set), :19-27 (DAMAGE_TYPE_COLORS); global.css:47-54 (--color-rarity-* mirror), :170-178 (reduced-motion), :181-184 (2px gold :focus-visible + outline-offset:2px)]
- [Source: gearData.ts:1-13 (GEAR_SLOTS, 11 ids); gameDataStore.ts:28-32,86-93 (itemDatabase + staleness flags); Toast.tsx:9-11 (showSuccessToast); useReducedMotion.ts; ClassGlyph.tsx (inline-SVG glyph pattern)]
- [Source: itemDatabaseLoader.test.ts:5-13 (vi.mock invokeCommand IPC pattern); GearSlot.test.tsx:30-93 (inline mock DB + axe a11y pattern)]
- [Source: base-items.json (897; implicits[].text 821/897; +levelRequirement via 4.1.5), uniques.json (471; affixes[].text 100%; +levelRequirement via 4.1.5), set-items.json (23; has description)]
- [Source: project-context.md — no barrel files, no cross-feature imports, invokeCommand wrapper, four stores, toBuildSnapshot sole conversion, snake_case Rust output, vitest-axe gate]

## Decisions & risks

**DN-1 (primary scope) — RESOLVED (Alec, 2026-07-03): Option B "source what's real."** A preceding gate (Story 4.1.5) sources item level + display text; 4.2 ships full FR-27 with honest reframes for the fields PoB4LE lacks (Required Tags → Item Type; rarity → Base/Unique/Set; unique flavor → stat-line fallback). No invented data.

**DN-2..DN-5 — recommended defaults applied:** new modal in `item-database/` not a new `gear/` folder (DN-2, avoids forbidden cross-feature imports); affix slot count = constant 4 / unique `affixes.length` (DN-3); unique flavor → stat-line fallback (DN-4); modal is canonical equip entry, `GearSlot` retained as the affix-tier editor, single `updateContextGear` write path, `GearInput` untouched (DN-5).

**Risks:**
- **Dependency inversion** — 4.2 built before 4.1.5 lands renders blank Item Level filter + tooltips (the trap the split prevents). Task 0 guards it; 4.1.5 must be `done` first.
- **Over-scoping to the stale plan** — architecture.md frames greenfield `gear/` files; reuse the `item-database/` stack or risk a third parallel gear UI + forbidden imports.
- **Displayed-but-not-sourced regression** — rich test mocks make the modal look done while real data renders blank. The Source-Audit tests (real values, real filter behavior) are the mitigation; do not accept a "renders something" test.
- **Silent invention** — the affix-slot-count constant and Item-Type-as-Tags reframe are honest only if declared (done, Source Audit) and not dressed up as per-item tag data.
- **Provenance** — HEAD and the 4.0/4.1 stack are AutoSave-only; recommend a reviewed baseline before branching.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code — dev-story workflow, ultracode multi-agent orchestration)

### Debug Log References

- Recon workflow (6 parallel ground-truth agents, 0 errors) — Task-0 dependency guard **PASS**: shipped `resources/items/*.json` carry the 4.1.5 fields end-to-end via a pass-through loader (base `levelRequirement` 897/897 = 100%, `implicits[].text` 821/897 = 91.5%; unique `levelRequirement` 471/471 = 100%, `affixes[].text` 446/471 = 94.7% — the <100% are genuinely affix-less records; set `description` 23/23). Rust IPC model is camelCase; names match the TS types exactly.
- Adversarial review workflow (14 agents: 4 review lenses → per-finding verification) — 10 findings raised, **8 CONFIRMED / 2 refuted**, all one root cause (set-rarity handling); all fixed and locked with tests (see Completion Notes).

### Completion Notes List

Implemented the Item Picker Modal **frontend-only**, extending the existing `item-database/` stack (no greenfield `gear/` folder, no Rust/transform change — 4.1.5 owns item data). **Design decision (documented):** the modal is a self-contained search/filter/grid/tooltip surface that reports the chosen item up via `onEquip`; the equip flows through GearSlot's proven `handleSelect → writeToStore` path (extended to populate `itemId`) — reusing the equip idiom literally, keeping GearSlot's display correct with **no store-sync**, and leaving GearTab untouched. The open trigger therefore lives in GearSlot ("Browse all items…" empty-state / "Swap item" equipped-state), which GearTab renders — a deliberate reconciliation of the story's "wire in GearTab" note that avoids a fragile two-source-of-truth write path.

- **Task 0 (dependency guard):** verified PASS via recon (evidence above) — the 4.1.5 fields reach the frontend intact.
- **Task 1 (prebuilt index, NFR-5):** new `itemSearchIndex.ts` — built once, set-inclusive, slot/collection/level filters, reuses the exported `scoreLowered` ranking; perf test <100ms over the full 1,423-item corpus; no new dependency (AR-8). `SearchResult.type` widened to `'base'|'unique'|'set'`.
- **Task 2 (modal):** `ItemPickerModal.tsx` — Headless UI `Dialog` scaffold copied locally, sidebar filters (Rarity collection / Item Type / Item Level range slider), roving-tabindex `role=grid` (SkillPickerGrid pattern copied locally), result count in a `role=status` aria-live region, DB-unavailable + no-results states.
- **Task 3 (icon):** `SlotGlyph.tsx` — inline-SVG slot glyph tinted by rarity color; `getRarityColorForItemType` extended for `'set'`.
- **Task 4 (slot scope):** `slotMap.ts` — data-verified GEAR_SLOTS↔DB-slot map; handles the set-items **3rd naming convention** (base/unique `helm`/`chest`/`off_hand` vs set `helmet`/`body`/`off-hand`), `catalyst`→offhand, and `ring_1`-only (both ring slots).
- **Task 5 (tooltip):** real stat text — base `implicits[].text`, unique `affixes[].text`, set `setBonuses[].description` — rendered directly, never via the empty corpus join.
- **Task 6 (equip):** Equip button + double-click via `onEquip → handleSelect → updateContextGear`, populating `itemId` (the serializer already forwards it); success toast; auto-recompute (no manual re-score).
- **Task 7 (a11y):** global `:focus-visible` gold ring; un-animated modal; `vitest-axe` clean in loaded / selected / empty states — caught and fixed an empty-grid `aria-required-children` violation (the grid renders only when non-empty).
- **Task 8 (tests + regression):** source-audit tests assert real values render and real filters filter (Item Level narrows by real `levelRequirement`, tooltip shows real text, slot-scope excludes wrong-slot items, equip writes exactly one `{slotId,itemId,itemName,affixes}` replacing not duplicating). ~45 new tests.

**Adversarial-review fixes (set-rarity defect class — sets became equippable in this story):** sets were rendering as *editable craftable bases* (fabricated "4 affix slots" footer, "+ Add affix" / tier steppers, dead tooltips, and a `resolveAffixes` id-collision — 4 set ids also exist in `uniques.json`). Fixed: sets now (a) show real `affixes.length` not the craft constant, (b) surface real `setBonuses[].description` in tooltips, (c) render **read-only** like uniques (no craft affordance), (d) resolve via `setItems` (correct item, no collision). All locked with regression tests.

**Verification:** `tsc --noEmit` clean; `pnpm build` clean; full `pnpm vitest` = **1323 passed / 7 failed**, where the 7 are the exact standing baseline (ProviderSelector ×5 / Settings ×1 / TreeControls ×1) — **no new failures**. No Rust change, so `cargo` suites are unaffected. Recommended final human step: in-app visual check via `pnpm tauri dev` (the data-populated modal needs the Tauri backend to load the item DB; the component tests verify behavior against real-shaped data).

### File List

**New (source):**
- `lebo/src/features/item-database/itemSearchIndex.ts`
- `lebo/src/features/item-database/slotMap.ts`
- `lebo/src/features/item-database/SlotGlyph.tsx`
- `lebo/src/features/item-database/ItemPickerModal.tsx`

**New (tests):**
- `lebo/src/features/item-database/itemSearchIndex.test.ts`
- `lebo/src/features/item-database/slotMap.test.ts`
- `lebo/src/features/item-database/SlotGlyph.test.tsx`
- `lebo/src/features/item-database/ItemPickerModal.test.tsx`

**Modified (source):**
- `lebo/src/shared/types/itemDatabase.ts` — `SearchResult.type` += `'set'`
- `lebo/src/shared/utils/rarityColors.ts` — `getRarityColorForItemType` accepts `'set'`
- `lebo/src/features/item-database/itemSearch.ts` — extracted + exported `scoreLowered` (index reuse)
- `lebo/src/features/item-database/GearSlot.tsx` — picker trigger, `itemId` on equip, success toast, set read-only handling + `resolveAffixes` set branch

**Modified (tests):**
- `lebo/src/features/item-database/GearSlot.test.tsx` — picker-integration + set read-only tests

**Modified (BMAD tracking):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `4-2-item-picker-modal`: ready-for-dev → in-progress → review

## Change Log

| Date | Change |
|------|--------|
| 2026-07-02 | Story 4.2 created (create-story + ultracode). Ground truth by 6 parallel HEAD verifiers + 4-agent adversarial re-verify (33 claims, 0 refuted). Extend-not-greenfield established; original draft recommended Option A (descope Item Level + Tags) pending Alec's decision. |
| 2026-07-03 | **Scope RESOLVED with Alec: Option B "source what's real."** A source-audit spike proved PoB4LE sources item level (`req.level`, 100%) but has NO tags/rarity-tiers/flavor. Split off Story 4.1.5 (item-metadata + display-text data gate) as a prerequisite. 4.2 rewritten: now **frontend-only**, ships full FR-27 with real Item Level slider + real hover tooltips (from 4.1.5), and honest source-backed reframes (Required Tags → Item Type filter; rarity → Base/Unique/Set collections; unique flavor → stat-line fallback). Depends-on 4.1.5 added with a Task-0 dependency guard. Source Audit updated (every field real / rule-constant / honest fallback; nothing fabricated). Line-number citations corrected per the adversarial verify pass. Status remains ready-for-dev (gated behind 4.1.5). |
| 2026-07-03 | **Implemented via dev-story (ultracode).** New: `ItemPickerModal.tsx`, `itemSearchIndex.ts` (prebuilt, set-inclusive, <100ms/1,423), `slotMap.ts` (data-verified, handles the set-items 3rd slot-naming convention), `SlotGlyph.tsx`. `GearSlot` wires the picker (reusing `handleSelect`; now populates `itemId`; success toast). `SearchResult.type` += `'set'`; `getRarityColorForItemType('set')`; `scoreLowered` exported. Task-0 dependency re-verified by a 6-agent recon (4.1.5 fields carried end-to-end). A 14-agent adversarial review caught a **set-rarity defect class** (sets became equippable but rendered as craftable bases: fabricated "4 affix slots", "+ Add affix"/tier steppers, dead tooltips, `resolveAffixes` id-collision) — all fixed: sets are read-only like uniques, show real affix count + `setBonuses`, resolve via `setItems`; locked with tests. `tsc`/`pnpm build` clean; `pnpm vitest` 1323 pass / 7 fail = exact standing baseline (no new failures); ~45 new tests. Frontend-only, no Rust change. **Status → review.** |
