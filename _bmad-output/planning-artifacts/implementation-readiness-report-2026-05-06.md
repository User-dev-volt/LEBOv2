---
stepsCompleted:
  - step-01-document-discovery
  - step-02-prd-analysis
  - step-03-epic-coverage-validation
  - step-04-ux-alignment
  - step-05-epic-quality-review
  - step-06-final-assessment
documentsUsed:
  prd: _bmad-output/planning-artifacts/prd.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  epics: _bmad-output/planning-artifacts/epics.md
  ux: _bmad-output/planning-artifacts/ux-design-specification.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-05-06
**Project:** LEBOv2

---

## Document Inventory

| Type | File | Format | Status |
|------|------|--------|--------|
| PRD | `planning-artifacts/prd.md` | Whole document | ✅ Found |
| Architecture | `planning-artifacts/architecture.md` | Whole document | ✅ Found |
| Epics & Stories | `planning-artifacts/epics.md` | Whole document | ✅ Found |
| UX Design | `planning-artifacts/ux-design-specification.md` | Whole document | ✅ Found |

**Duplicates:** None detected  
**Missing Documents:** None

---

## PRD Analysis

### Functional Requirements

**Skill Tree Visual Rendering (FR1–FR10)**
- FR1: Players can view each active skill's full tree with actual game icons in hexagonal PixiJS nodes, for all 133 skills across all 5 classes.
- FR2: Players can view each class's base passive tree and each mastery's passive tree with icon-accurate hexagonal nodes in a structured horizontal-row layout.
- FR3: Players can view the Weaver Tree in a web/radial PixiJS layout with a central node (contingent on research spike confirming data availability).
- FR4: Players can see node connectivity rendered as edges between hexagonal nodes in all tree views.
- FR5: Players can see each node's mastery point unlock threshold displayed as a badge overlay (5, 10, 15, 20, 25, 35 points) in the skill picker and passive tree.
- FR6: Players can see which nodes are locked / available / allocated / suggested through distinct visual states.
- FR7: Players can search within any tree by node name; matching nodes highlight in gold, non-matching nodes dim; clearing search restores normal state.
- FR8: Players can RESET all allocations in any tree to zero with a single button action.
- FR9: Players can see an unspent points counter above each tree reflecting their current remaining point budget.
- FR10: Players can see the selected active skill's name, level, and unlock condition in the tree header area alongside other active skill slot indicators.

**Active Skill Management (FR11–FR17)**
- FR11: Players can open a skill picker for each active skill slot showing all skills for the selected class/mastery, organized by base class skills and mastery-gated groups.
- FR12: Players can select any available skill from the picker to load that skill's full interactive tree under the active slot tab.
- FR13: Players can left-click a node to increment its allocation by 1 point (up to node maximum).
- FR14: Players can right-click a node to decrement its allocation by 1 point (down to 0).
- FR15: Players can see each node's `current/max` point counter (e.g., `3/5`) rendered in the node.
- FR16: The app prevents left-click increment on a node whose prerequisite nodes have insufficient allocation.
- FR17: The app prevents right-click decrement on a node whose allocated points are required as prerequisites by currently-allocated dependent nodes.

**Character Level & Budget System (FR18–FR22)**
- FR18: Players can input their character level (1–100); the app calculates and displays total available passive points based on level.
- FR19: Players can input their active skill level (1–20) per skill slot; the app tracks the maximum allocatable points for that skill's tree.
- FR20: Players can toggle "Enforce level budget" ON or OFF (default OFF); when ON, the app prevents allocation that would exceed the calculated point budget.
- FR21: When "Enforce level budget" is OFF, the app allows free theory-craft allocation with no budget ceiling.
- FR22: The unspent points counter updates immediately and accurately after every node allocation or deallocation action.

**Item Database & Gear Input (FR23–FR33)**
- FR23: The app loads a local item database containing ≥674 base items, ≥445 unique items, and ≥1,112 affixes, sourced from community data and bundled with the application.
- FR24: Players can search any gear slot by item name using typeahead fuzzy search against the local item database.
- FR25: Selecting an item from typeahead populates the gear slot with the item's name, base type, and known affixes at default/median tier values.
- FR26: Players can adjust each pre-loaded affix's tier using a per-affix tier slider (T1 through the item's maximum available tier).
- FR27: Players can add affixes not pre-loaded to an item via a "+" action opening a searchable dropdown of the full affix database.
- FR28: Players can set value/tier for any custom-added affix from the full affix database.
- FR29: Players can clear a gear slot's item selection to reset it to empty or free-text fallback.
- FR30: Players can use free-text input as a fallback for any gear slot.
- FR31: The app passes structured gear context (slot, item name/ID, affix name/ID, tier, value) to the AI optimization engine when items are set via the database path.
- FR32: The app passes free-text gear context (unchanged from Phase 1 behavior) to the AI optimization engine when items are set via the free-text path.
- FR33: The app checks item database freshness on launch and displays a staleness indicator when a newer `itemDataVersion` is available; users can trigger an update.

**Optimization UX & AI Integration (FR34–FR42)**
- FR34: Players can set optimization intent using a continuous Glass Cannon ↔ Juggernaut master slider (fully left = max survivability; fully right = max damage; center = balanced).
- FR35: Players can expand a "Fine Tune" panel revealing independent Damage Weight, Survivability Weight, and Speed Weight sub-sliders (each 0–100); Fine Tune values override the master slider when expanded.
- FR36: The app maps the master slider position such that Phase 1 preset positions remain accessible as positions on the spectrum for backwards compatibility.
- FR37: When "Enforce level budget" is ON, the app includes character level, available passive points, and per-skill levels in the AI optimization request as hard constraints.
- FR38: When "Enforce level budget" is OFF, the app sends optimization requests without point-budget constraints.
- FR39: The app streams AI optimization suggestions incrementally as they arrive (no regression from Phase 1 behavior).
- FR40: Players can see before/after scoring comparison for each AI suggestion (no regression from Phase 1 behavior).
- FR41: The optimization engine uses structured gear context (when available) to provide affix-level reasoning in suggestions.
- FR42: Players can clear all suggestions and re-run optimization with updated build state or slider position.

**Data Pipeline & Asset Management (FR43–FR50)**
- FR43: The app auto-detects the Last Epoch Steam install path on first launch without user interaction.
- FR44: The app silently extracts skill icons from game files on first launch when Steam install is detected; icons cached locally in `{app_data}/lebo/icons/skills/`.
- FR45: The app falls back to community CDN icon sources when game files are not detected or extraction fails; players are never shown an error or blocked by missing icons.
- FR46: The app caches CDN-fetched icons locally; subsequent launches serve icons from local cache without network requests.
- FR47: The app checks game data freshness on launch using manifest `gameVersion` and displays a staleness indicator when community data has a newer version.
- FR48: The app checks item data freshness on launch using manifest `itemDataVersion` and displays a staleness indicator when a newer version is available.
- FR49: The app records `iconSource` in the manifest (`game-files` or `community-cdn`) so the icon pipeline is deterministic and auditable.
- FR50: The app's data update flow downloads updated manifest and data files, replaces local files atomically, and reloads affected data without requiring app restart.

**Build Persistence & Migration (FR51–FR55)**
- FR51: The app migrates all existing Phase 1 (schema v1) saves to BuildState schema v2 via `migrateBuildState` on load, losslessly converting free-text affixes to `{ name: affix, tier: undefined, value: undefined }` objects.
- FR52: The app saves all Phase 2 builds in BuildState schema v2 format with structured gear data.
- FR53: The app preserves all existing Phase 1 build management capabilities: save, load, rename, delete (no regression).
- FR54: The schema migration is idempotent: loading a v2 build through `migrateBuildState` produces an identical v2 build with no data modification.
- FR55: The app exposes the current manifest `gameVersion` and `itemDataVersion` in the settings panel so players can verify their data currency.

**Total FRs: 55**

---

### Non-Functional Requirements

**Performance**
- NFR-PERF1: PixiJS canvas renders at ≥60fps idle and ≥45fps sustained under continuous pan/zoom/hover interaction for any single tree view containing up to 200 nodes, on benchmark hardware (Intel i5, integrated graphics, 8 GB RAM, 1080p display).
- NFR-PERF2: Icon textures loaded into PixiJS Assets cache complete within 200ms of tree view mount for the first load; subsequent loads within the same session serve from cache with no measurable delay.
- NFR-PERF3: Item typeahead search returns ranked results within 50ms of each keystroke for the full 674+ base item + 445+ unique item corpus, using local in-memory querying.
- NFR-PERF4: AI optimization stream begins emitting within the same latency budget as Phase 1 (no regression introduced by structured gear context marshaling).

**Security**
- NFR-SEC1: The Anthropic/OpenRouter API key never crosses the Tauri IPC boundary into TypeScript; all API calls remain in Rust commands.
- NFR-SEC2: Steam directory access is read-only; no write operations are performed to any Steam or game installation directory.
- NFR-SEC3: Icon files extracted from game directories are cached in the app's sandboxed data directory; no extracted assets are transmitted externally.
- NFR-SEC4: The `VAULT_PASSWORD` static constant in `keychain_service.rs` remains as the known Phase 1 deferred item; no change in Phase 2.

**Accessibility**
- NFR-ACC1: All new interactive UI elements (slider, Fine Tune expansion panel, tier sliders, typeahead dropdown, custom affix picker) have a `2px solid accent-gold` focus ring; `outline: none` is never used without a replacement.
- NFR-ACC2: The Glass Cannon ↔ Juggernaut slider is keyboard-navigable (arrow keys) and has an `aria-label` describing the current position as a percentage.
- NFR-ACC3: The item typeahead dropdown follows ARIA combobox pattern with `role="combobox"`, `aria-expanded`, and `aria-activedescendant`.
- NFR-ACC4: The staleness indicator and data update progress region use `aria-live="polite"`.
- NFR-ACC5: `prefers-reduced-motion` gates all animated transitions in new components; `useReducedMotion()` hook used consistently.
- NFR-ACC6: All new views and components pass `vitest-axe` checks in CI with zero violations.

**Reliability**
- NFR-REL1: BuildState v1 → v2 migration is lossless under all Phase 1 save variants: free-text gear, null gear, partial gear, empty builds.
- NFR-REL2: Data update operations are atomic: if a download fails mid-transfer, the existing local data files are not corrupted; the app retains the last valid state.
- NFR-REL3: Icon extraction failure degrades gracefully to CDN fallback without user-visible error; the app logs the failure internally.
- NFR-REL4: Item database load failure at startup is recoverable: the app displays the free-text gear input fallback for all slots and continues to function for skill tree and optimization features.

**Total NFRs: 16 (4 Performance, 4 Security, 6 Accessibility, 4 Reliability)**

---

### Additional Requirements & Constraints

**Technical Architecture Constraints (all carry forward from Phase 1):**
- Four domain stores maximum (enforced): Extend `useGameDataStore` for item data; extend `useBuildStore` for v2 gear schema — no new top-level Zustand stores.
- SkillTreeCanvas props-only contract (enforced): `SkillTreeCanvas` never accesses Zustand directly; icon textures passed via `iconTextures: Map<string, Texture>` prop.
- No barrel files (enforced): All new feature folders (`item-database/`, `icon-pipeline/`, `weaver-tree/`) use direct imports; no `index.ts` re-exports.
- All new Tauri commands in Rust (enforced): Steam detection, icon extraction, item DB loading, freshness checks all in Rust; called via `invokeCommand<T>()` in TypeScript; zero raw `invoke()` calls.
- API key never crosses IPC boundary (enforced): Optimization calls stay fully in Rust.

**Platform & Distribution:**
- Platforms: Windows 10/11 (`.msi`, code-signed), macOS 12+ (`.dmg`, notarized). No Linux in Phase 2.
- Auto-update via Phase 1 Tauri updater; no new installer required for existing users.
- Offline-first: all game data, item data, and icon cache stored in `{app_data}/lebo/`.
- Steam integration is read-only.

**Research Spike Gate:**
- Weaver Tree implementation is gated behind a research spike confirming community data availability; if spike fails, Weaver Tree deferred.

**New Tauri Commands Required:**
`detect_steam_path`, `extract_skill_icons`, `load_item_database`, `load_affix_database`, `get_icon_texture(skill_id)`, `check_item_data_freshness`, `update_item_data`.

---

### PRD Completeness Assessment

The PRD is exceptionally detailed and complete. Requirements are numbered (FR1–FR55), grouped by capability area, and cross-referenced to user journeys. NFRs are quantified with specific metrics (fps, ms, item counts). Technical constraints from Phase 1 are explicitly restated, reducing ambiguity. The research spike gate for the Weaver Tree is appropriately flagged as conditional. No ambiguous or orphaned requirements detected at this stage.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement (Summary) | Epic Coverage | Status |
|----|--------------------------|---------------|--------|
| FR1 | Active skill trees with game icons for 133 skills | Epic 1 (Story 1.1, 1.4) | ✅ Covered |
| FR2 | Passive trees with icon-accurate hexagonal nodes | Epic 1 (Story 1.1) | ✅ Covered |
| FR3 | Weaver Tree web/radial layout (research-gated) | Epic 4 (Story 4.3) | ✅ Covered |
| FR4 | Node connectivity edges in all tree views | Epic 1 (Story 1.1) | ✅ Covered |
| FR5 | Mastery threshold badge overlays | Epic 1 (Story 1.3) | ✅ Covered |
| FR6 | Node visual states (locked/available/allocated/suggested) | Epic 1 (Story 1.2) | ✅ Covered |
| FR7 | Search: gold highlight matching, dim non-matching | Epic 1 (Story 1.5) | ✅ Covered |
| FR8 | RESET button clears all allocations | Epic 1 (Story 1.5) | ✅ Covered |
| FR9 | Unspent points counter above each tree | Epic 3 (Story 3.1, 3.2) | ✅ Covered |
| FR10 | Active skill header: name, level, unlock condition | Epic 1 (Story 1.4) | ✅ Covered |
| FR11 | Skill picker per active slot, filtered by class/mastery | Epic 1 (Story 1.3) | ✅ Covered |
| FR12 | Select skill from picker loads full tree under tab | Epic 1 (Story 1.4) | ✅ Covered |
| FR13 | Left-click increments node allocation by 1 | Epic 1 (Story 1.1) | ✅ Covered |
| FR14 | Right-click decrements node allocation by 1 | Epic 1 (Story 1.1) | ✅ Covered |
| FR15 | current/max counter rendered in each node | Epic 1 (Story 1.1) | ✅ Covered |
| FR16 | Prerequisite validation prevents invalid increment | Epic 1 (Story 1.2) | ✅ Covered |
| FR17 | Prerequisite validation prevents invalid decrement | Epic 1 (Story 1.2) | ✅ Covered |
| FR18 | Character level input → passive point budget | Epic 3 (Story 3.1) | ✅ Covered |
| FR19 | Active skill level input → per-skill tree budget | Epic 3 (Story 3.2) | ✅ Covered |
| FR20 | Enforce Level Budget toggle (default OFF) | Epic 3 (Story 3.3) | ✅ Covered |
| FR21 | Free theory-craft when toggle is OFF | Epic 3 (Story 3.3) | ✅ Covered |
| FR22 | Unspent counter updates immediately after every action | Epic 3 (Story 3.1, 3.2, 3.3) | ✅ Covered |
| FR23 | Local item database ≥674 base + ≥445 uniques + ≥1,112 affixes | Epic 5 (Story 5.1) | ✅ Covered |
| FR24 | Typeahead fuzzy search per gear slot | Epic 5 (Story 5.3) | ✅ Covered |
| FR25 | Item selection pre-populates affixes at median tier | Epic 5 (Story 5.3) | ✅ Covered |
| FR26 | Per-affix tier slider (T1–max) | Epic 5 (Story 5.4) | ✅ Covered |
| FR27 | Custom affix addition via "+" + searchable dropdown | Epic 5 (Story 5.5) | ✅ Covered |
| FR28 | Set value/tier for custom affixes | Epic 5 (Story 5.5) | ✅ Covered |
| FR29 | Clear gear slot to empty or free-text | Epic 5 (Story 5.3, 5.5) | ✅ Covered |
| FR30 | Free-text fallback for any gear slot | Epic 5 (Story 5.5) | ✅ Covered |
| FR31 | Structured gear context → AI when using database path | Epic 7 (Story 7.5) | ✅ Covered |
| FR32 | Free-text gear context → AI (no regression) | Epic 7 (Story 7.5) | ✅ Covered |
| FR33 | Item database freshness check + staleness indicator | Epic 5 (Story 5.6) | ✅ Covered |
| FR34 | Glass Cannon ↔ Juggernaut master slider | Epic 7 (Story 7.1) | ✅ Covered |
| FR35 | Fine Tune panel with D/S/S sub-sliders | Epic 7 (Story 7.2) | ✅ Covered |
| FR36 | Phase 1 preset positions mapped to slider spectrum | Epic 7 (Story 7.3, 7.6) via Epic 6 migration | ✅ Covered |
| FR37 | Level-budget-aware AI context when enforcement is ON | Epic 7 (Story 7.4) | ✅ Covered |
| FR38 | No budget constraints in AI request when enforcement OFF | Epic 7 (Story 7.4) | ✅ Covered |
| FR39 | AI streaming no regression from Phase 1 | Epic 7 (Story 7.6) | ✅ Covered |
| FR40 | Before/after scoring no regression from Phase 1 | Epic 7 (Story 7.6) | ✅ Covered |
| FR41 | Structured gear context → affix-level AI reasoning | Epic 7 (Story 7.5) | ✅ Covered |
| FR42 | Clear suggestions and re-run optimization | Epic 7 (Story 7.6) | ✅ Covered |
| FR43 | Steam install path auto-detection on first launch | Epic 2 (Story 2.2) | ✅ Covered |
| FR44 | Silent skill icon extraction to icon cache | Epic 2 (Story 2.2) | ✅ Covered |
| FR45 | CDN icon fallback; players never blocked | Epic 2 (Story 2.2) | ✅ Covered |
| FR46 | CDN icons cached locally for subsequent launches | Epic 2 (Story 2.2) | ✅ Covered |
| FR47 | Game data freshness check; staleness indicator | Epic 6 (Story 6.3) | ✅ Covered |
| FR48 | Item data freshness check; staleness indicator | Epic 5 (Story 5.6) + Epic 6 (Story 6.3) | ✅ Covered |
| FR49 | iconSource recorded in manifest | Epic 2 (Story 2.2) | ✅ Covered |
| FR50 | Atomic data update; session reload; no restart | Epic 6 (Story 6.3) | ✅ Covered |
| FR51 | migrateBuildState lossless v1→v2 | Epic 6 (Story 6.1, 6.2) | ✅ Covered |
| FR52 | Phase 2 builds save in schema v2 | Epic 6 (Story 6.4) | ✅ Covered |
| FR53 | Phase 1 build management no regression | Epic 6 (Story 6.2) | ✅ Covered |
| FR54 | Migration is idempotent | Epic 6 (Story 6.1, 6.4) | ✅ Covered |
| FR55 | Settings panel shows gameVersion + itemDataVersion | Epic 6 (Story 6.4) | ✅ Covered |

### Missing Requirements

**None.** All 55 FRs have traceable coverage in the epics.

**Note on PRD NFR-SEC4 (VAULT_PASSWORD):** The PRD flags this as a known deferred item from Phase 1 with "no change in Phase 2." The epics NFR5 covers API key security broadly (story 7.6 explicitly reinforces it), but VAULT_PASSWORD is not independently called out in any story AC. This is acceptable given the PRD's explicit "no change" designation — it is a carry-forward constraint, not a new implementation requirement.

### Coverage Statistics

- **Total PRD FRs:** 55
- **FRs covered in epics:** 55
- **Coverage percentage:** 100%
- **NFR Coverage:** All 18 PRD NFRs mapped; epics enumerate 19 (NFR18 = FR54 as NFR framing, NFR19 = FR46 as NFR framing — both valid)
- **UX-DR Coverage:** All 15 UX-DRs mapped to specific stories

---

## UX Alignment Assessment

### UX Document Status

**Found:** `planning-artifacts/ux-design-specification.md` — Complete (14 of 14 workflow steps marked done, status: complete).

The UX specification was authored with `prd.md` as an explicit input document and produced a complete 1,100-line specification covering all PRD requirements. Architecture was subsequently created with `ux-design-specification.md` as an explicit input.

---

### UX ↔ PRD Alignment

**Overall: ALIGNED ✅**

| UX Area | PRD Alignment | Notes |
|---------|--------------|-------|
| 8 custom components specified (SkillPickerGrid, OptimizationSlider, FineTunePanel, GearSlot, AffixTierControl, StalenessBar, UnspentCounter, BudgetToggle) | Maps directly to FR1–FR55 functional groups | Full bidirectional traceability |
| 5 new CSS tokens (`--color-slider-glass-cannon`, `--color-slider-juggernaut`, `--color-tier-pip-active`, `--color-tier-pip-inactive`, `--color-badge-mastery-gate`) | PRD UX-DR10 specifies exactly these 5 tokens | Exact match |
| ARIA requirements specified per component | PRD NFR-ACC1–ACC6 | UX spec adds `aria-autocomplete="list"` for typeahead — minor detail not in PRD but correct |
| 4 user journey flows with Mermaid diagrams | PRD's 4 user journeys | All 4 journeys reproduced; flows add implementation detail without contradiction |
| Glass Cannon ↔ Juggernaut slider labeled endpoints and gradient track | FR34–FR36 | UX adds specific keyboard step size (5%), tooltip wording, and Fine Tune interaction behavior — all additive |
| Right panel split into independently scrollable Gear Context (~55%) + pinned Optimization (~45%) | PRD UX-DR9, FR30, FR42 | Explicit layout strategy; no conflict |
| Free-text fallback always accessible ("Free text mode" ghost link) | FR30, PRD scope note "free-text fallback preserved" | UX adds discoverability detail (ghost link below empty slot typeahead) |
| Reduced motion gated by `useReducedMotion()` | NFR-ACC5 | Consistent |

**Minor Note:** The UX spec's Component Implementation Roadmap uses placeholder epic numbering ("Epic 7/8", "Epic 9/10", "Epic 11") that doesn't match the final epic numbering (1–7). This is a naming artifact from pre-epics authoring and has no impact on alignment — the content maps correctly.

---

### UX ↔ Architecture Alignment

**Overall: ALIGNED ✅**

| UX Requirement | Architecture Support | Status |
|---------------|---------------------|--------|
| SkillPickerGrid in React DOM with hex CSS clip-path (not PixiJS) | Architecture Decision 8 explicitly specifies React DOM implementation with `--hex-clip-path` custom property | ✅ Aligned |
| Icon textures loaded outside canvas, passed via `iconTextures` prop | Architecture Decision 5 specifies `SkillTreeCanvas` props extension with `iconTextures: Map<string, Texture>` and `useIconTextures` hook | ✅ Aligned |
| OptimizationSlider state in `useOptimizationStore` with `sliderPosition` and `fineTuneWeights` | Architecture Decision 6 specifies exact TypeScript interface extensions | ✅ Aligned |
| GearSlot + AffixTierControl components in `item-database/` folder | Architecture structure spec shows `src/features/item-database/GearSlot.tsx`, `AffixTierControl.tsx` | ✅ Aligned |
| Weaver Tree tab always present; `WeaverTreePlaceholder` when data null | Architecture Decision 7 specifies `weaverTreeData: TreeData | null` gate in `useGameDataStore` | ✅ Aligned |
| UnspentCounter + BudgetToggle in `skill-tree/` | Architecture Decision 9 specifies `useBuildStore` extensions; components referenced in structure spec | ✅ Aligned |
| `StalenessBar` extended to support two simultaneous staleness banners | Architecture structure spec: `StalenessBar.tsx` (MODIFIED: +`isItemDataStale` prop) | ✅ Aligned |
| `prefers-reduced-motion` via `useReducedMotion()` hook | Architecture references this as Phase 1 pattern carried forward | ✅ Aligned |
| `appearance: none` + CSS track for all range inputs | Architecture implementation patterns specify custom-styled range inputs | ✅ Aligned |
| All new components in feature-named folders, no barrel files | Architecture explicitly lists all new folders (`skill-picker/`, `icon-pipeline/`, `item-database/`, `weaver-tree/`, `optimization-panel/`) with no `index.ts` | ✅ Aligned |

---

### Warnings

**⚠️ Minor: SkillPickerGrid icon loading for HTML `<img>` not explicitly storified**

The UX spec and Architecture (Decision 8) specify that SkillPickerGrid uses `<img src={localPath}>` (not PixiJS Textures) to render skill icons in the picker, with the local cache path fetched via a Rust command. Architecture Decision 8 explicitly documents this ("Rust returns the local cache path; `<img src={localPath}>` renders it. If icon path is null: placeholder hex div").

However, no story in the epics explicitly implements the `<img>` icon loading path for SkillPickerGrid. Story 1.3 (SkillPickerGrid) mentions "Skill icon (game asset or CDN fallback)" but does not specify how to load the icon into an HTML `<img>`. Story 2.2/2.3 cover the `useIconTextures` hook (PixiJS Textures) but not the HTML `<img>` variant.

**Impact:** Low. The icon cache path is already available from `get_icon_cache_path()` (Story 2.2). The developer implementing Story 1.3 will need to reference Architecture Decision 8 to implement the `<img>` loading correctly. No functionality is blocked — it's a story specification gap, not an architecture gap.

**Recommendation:** Story 1.3 acceptance criteria should be updated to include: "Skill picker cells render actual game icons via `<img src={localCachePath}>` when the icon cache path is available (using `get_icon_cache_path()` Rust command); fall back to placeholder hex div when path is null."

---

## Epic Quality Review

### Epic Validation Summary

| Epic | User Value? | Independent? | Stories | Quality |
|------|------------|-------------|---------|---------|
| Epic 1: Skill Picker & Multi-Point Node Allocation | ✅ Direct user capability | ✅ Extends Phase 1 standalone | 5 | ✅ Pass |
| Epic 2: Icon-Accurate Skill Tree Rendering | ✅ Direct visual upgrade | ✅ Additive to Epic 1 | 4 | ✅ Pass |
| Epic 3: Character Level & Point Budget System | ✅ Direct user capability | ✅ Additive to Epics 1–2 | 3 | ✅ Pass |
| Epic 4: Weaver Tree (Research-Gated) | ✅ Conditional user capability; always-present tab is user value | ✅ Completely independent | 3 | ✅ Pass |
| Epic 5: Item Database & Structured Gear Input | ✅ Direct user capability | ✅ Additive (not blocked) | 6 | ⚠️ 1 issue |
| Epic 6: BuildState Schema v2, Migration & Pipeline | ⚠️ Borderline technical; Story 6.4 + migration protection = user value | ✅ Can ship standalone | 4 | ✅ Pass |
| Epic 7: Advanced Optimization UX | ✅ Core Phase 2 innovation | ✅ Additive to Epics 3, 5, 6 | 6 | ✅ Pass |

---

### Epic-by-Epic Validation

**Epic 1 — Skill Picker & Multi-Point Node Allocation** ✅

- User value: Concrete — players can use PoB-style left/right-click allocation and the skill picker
- Independence: Extends Phase 1 SkillTreeCanvas; no dependency on later epics
- Story dependencies: All sequential and backward-only (1.2 → 1.1; 1.4 → 1.3; 1.5 → 1.1)
- AC quality: BDD format throughout; specific PixiJS rendering details, functional prerequisite logic, and visual feedback ACs are concrete and verifiable
- Implementation sequence within epic: 1.1 → 1.2 (shares `applyNodeChange`) → 1.3 → 1.4 (shares picker) → 1.5 (standalone)

**Epic 2 — Icon-Accurate Skill Tree Rendering** ✅

- User value: Players see real game icons — the primary "trust signal" moment from UX spec
- Independence: Additive layer on top of any working skill tree; Epic 1 provides canvas infrastructure
- Story sequence: 2.1 (spike) → 2.2 (Rust pipeline) → 2.3 (useIconTextures hook) → 2.4 (PixiJS rendering)
- Research spike (2.1): Acceptable — it is explicitly output-only (findings document, no code); gated correctly
- Spike dependency: Stories 2.2–2.4 correctly reference "Given the spike confirmed CDN URL pattern (from Story 2.1)" — this is a backward dependency since 2.1 precedes 2.2 ✅
- AC quality: Story 2.4 FPS benchmark AC is measurable; CDN fallback path conditions are explicit

**Epic 3 — Character Level & Point Budget System** ✅

- User value: Enables level-enforced theory-crafting — directly answers "did I over-allocate?"
- Independence: Extends `useBuildStore`; `applyNodeChange` from Epic 1 is already the change handler
- Story sequence: 3.1 → 3.2 (both contribute to `budgetCalculator.ts`) → 3.3 (toggle integration)
- ACs: `calculatePassivePoints(level)` formula is marked as "confirmed during implementation" — acceptable; spike not needed since approximate formula is known
- UnspentCounter `aria-live` AC is explicit ✅

**Epic 4 — Weaver Tree (Research-Gated)** ✅

- User value: Story 4.2 (always-present tab + placeholder) delivers user value independent of spike; Story 4.3 is fully conditional
- Independence: Fully independent — no other epic depends on Weaver Tree being done
- Story 4.3 conditional gate is properly documented: "Conditional on Research Spike GO" in the story title and acceptance criteria
- The "no crash, no error toast" for the placeholder case is a testable AC ✅

**Epic 5 — Item Database & Structured Gear Input** ⚠️

- User value: Direct — typeahead gear input and tier sliders are tangible player capability
- Independence: Item database is independent; can be delivered without Epics 1–4 except for the final gear context flowing to AI (which requires Epic 7)

**Story 5.3 (GearSlot) → Story 5.4 (AffixTierControl) Forward Dependency:**
Story 5.3's ACs explicitly reference "AffixTierControl components, implemented in Story 5.4" — a developer cannot complete Story 5.3 fully without Story 5.4's component. The AC states: "the item's known affixes are listed below at their median tier values (AffixTierControl components, implemented in Story 5.4)."

This is a forward dependency. The stories need reordering: Story 5.4 (AffixTierControl) should be implemented first, then Story 5.3 (GearSlot) can use it. The simplest fix is to swap 5.3 and 5.4 in the implementation sequence.

**Epic 6 — BuildState Schema v2, Migration & Data Pipeline** ✅

- User value: Story 6.4 (settings version display, v2 saves) is directly user-visible. Stories 6.1–6.3 protect user data (Phase 1 saves) and prevent data corruption — both are user value, even if technical in implementation.
- "Technical milestone" assessment: Epic 6 is the closest to a pure technical epic. However: migration protecting Phase 1 user data is a user success criterion explicitly in the PRD. Acceptable as a cohesive epic.
- Story sequence: 6.1 (types + migration) → 6.2 (preset migration + persistence integration) → 6.3 (manifest v2 + atomic writes) → 6.4 (save format + settings display)
- ACs: All concrete; idempotency test case is specific and verifiable; the four `goalPreset` mapping cases cover all Phase 1 values ✅

**Epic 7 — Advanced Optimization UX — Archetype Slider** ✅

- User value: The core Phase 2 innovation — the Glass Cannon ↔ Juggernaut slider
- Independence: Can deliver slider UX (7.1–7.3) before Epic 3 (budget) or Epic 5 (gear) are complete; Stories 7.4 and 7.5 explicitly reference those epics as backward dependencies (Epic 3 must precede 7.4; Epic 5 must precede 7.5)
- Story dependencies: All backward — 7.4 → Epic 3; 7.5 → Epic 5; 7.6 → 7.1–7.5 ✅
- ACs: "Fine Tune sub-sliders proportionally scale when master slider moves while Fine Tune is overridden" is a non-obvious interaction rule that has an explicit AC ✅

---

### Violations by Severity

#### 🔴 Critical Violations
**None.**

#### 🟠 Major Issues

**Issue 1 — Story 5.3 forward dependency on Story 5.4 (GearSlot cannot be completed without AffixTierControl)**

- **Location:** Epic 5, Stories 5.3 and 5.4
- **Problem:** Story 5.3's ACs require `AffixTierControl` (Story 5.4) to be already built — "the item's known affixes are listed below at their median tier values (AffixTierControl components, implemented in Story 5.4)." A developer implementing 5.3 will be blocked.
- **Remediation:** Swap story numbers — implement Story 5.4 (AffixTierControl component) first, then Story 5.3 (GearSlot using it). This is a sequencing fix only; no content change to either story is needed.
- **Effort:** Zero — reorder implementation, no rewrite required.

#### 🟡 Minor Concerns

**Concern 1 — Story 1.3 icon loading for HTML `<img>` not in ACs**
- Already flagged in UX Alignment section
- Recommendation: Add one AC to Story 1.3 for `<img src={localCachePath}>` with null fallback to placeholder hex div

**Concern 2 — Epic 6 is borderline technical but acceptable**
- Stories 6.1–6.3 are technically focused but justified by user data protection
- No remediation needed — the user value is present (Phase 1 save migration, data update safety)

**Concern 3 — Research spike stories (2.1, 4.1) do not deliver user value**
- This is expected for spike stories; both are correctly scoped to findings-only
- No remediation needed — spike stories are standard pattern for gated conditional features

---

### Best Practices Compliance Checklist

| Epic | User Value | Independent | Story Sizing | No Forward Deps | Clear ACs | FR Traceability |
|------|-----------|-------------|-------------|-----------------|-----------|----------------|
| Epic 1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 4 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 5 | ✅ | ✅ | ✅ | ⚠️ 5.3→5.4 | ✅ | ✅ |
| Epic 6 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 7 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Brownfield check:** Epic 1 Story 1.1 correctly begins with the Phase 1 breaking change (`allocatedNodes: Set<string>` → `nodeAllocations: Record<string, number>`) — no project initialization story needed. Correct brownfield handling. ✅

---

## Summary and Recommendations

### Overall Readiness Status

# ✅ READY FOR IMPLEMENTATION

**With two minor pre-implementation fixes recommended** (neither blocks the first epic from starting).

---

### Issues Found: 3 total across 2 categories

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | 🟠 Major | Epic 5, Stories 5.3→5.4 | Forward dependency: Story 5.3 (GearSlot) cannot be completed without Story 5.4 (AffixTierControl) — implementation order must be swapped |
| 2 | 🟡 Minor | Epic 1, Story 1.3 | Missing AC: SkillPickerGrid icon loading via HTML `<img src={localCachePath}>` is specified in Architecture Decision 8 but absent from Story 1.3 ACs |
| 3 | 🟡 Minor | Architecture | Steam Library custom path detection (non-default drive) acknowledged as a known gap; CDN fallback means icons still load but game file path detection fails on non-standard installs |

---

### Critical Issues Requiring Immediate Action

**None.** There are no blocking critical issues. All 55 FRs have traceable coverage, all 4 planning documents are complete and aligned, and no epic has a circular or forward dependency that would block starting implementation.

---

### Recommended Next Steps

**Before starting Epic 5 (item database):**

1. **Swap Stories 5.3 and 5.4 implementation order** — implement `AffixTierControl` (currently numbered 5.4) first, then `GearSlot` (currently numbered 5.3). This requires no rewrite of either story's content; only the implementation sequence changes. Update `epics.md` story numbering if desired to reflect the corrected order.

**Before starting Epic 1 (or any epic that implements the skill picker):**

2. **Add one AC to Story 1.3 (SkillPickerGrid)** — add: "Each skill picker cell renders its game icon via `<img src={localCachePath}>` when `get_icon_cache_path(skillId)` returns a non-null path (after the icon pipeline has initialized); if path is null or pipeline not yet initialized, the cell renders a placeholder hex div using `--color-node-available` fill." This closes the gap between Architecture Decision 8 and the story spec.

**At any time (low-urgency documentation note):**

3. **Note the non-standard Steam path limitation** — the architecture explicitly acknowledges that `detect_steam_path` only handles the default `C:\Program Files (x86)\Steam\steamapps\common\Last Epoch` path. Log a follow-up note or future story: "Extend `detect_steam_path` to read the Steam `libraryfolders.vdf` file to locate games on non-default library drives." This doesn't block Phase 2 — CDN fallback covers the gap.

---

### Assessment Confidence

The planning artifacts for LEBOv2 Phase 2 are of exceptionally high quality:

- **PRD:** 55 numbered FRs, 18 NFRs with quantified benchmarks, explicit technical constraints, and 4 mapped user journeys. One of the most complete PRDs assessed.
- **UX Design:** 15 UX-DRs derived directly from PRD, 8 fully-specified custom components, ARIA requirements per component, and 4 journey flows with Mermaid diagrams.
- **Architecture:** 9 explicit architectural decisions with TypeScript interface definitions, Rust command signatures, and three-level failure degradation patterns. All 55 FRs mapped to specific files.
- **Epics:** Self-validates with 100% FR/NFR/UX-DR/architecture constraint coverage summaries already included. 7 epics × 32 stories.

The only substantive finding — the Story 5.3/5.4 ordering issue — is a 2-minute fix (swap the implementation order). No epics require rewriting.

---

### Final Note

This assessment identified **3 issues** across **2 categories** (1 major sequencing issue, 2 minor spec gaps). The major issue is a trivial ordering fix with zero content changes. The planning documents are comprehensive, internally consistent, and aligned across all four artifacts. The implementation team can begin with Epic 1 immediately.

**Report generated:** 2026-05-06  
**Assessor:** BMAD Check Implementation Readiness workflow  
**Documents assessed:** PRD (55 FRs), UX Design (15 UX-DRs, 8 components), Architecture (9 decisions), Epics (7 epics, 32 stories)

---
