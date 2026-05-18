---
stepsCompleted:
  [
    'step-01-init',
    'step-02-discovery',
    'step-02b-vision',
    'step-02c-executive-summary',
    'step-03-success',
    'step-04-journeys',
    'step-05-domain',
    'step-06-innovation',
    'step-07-project-type',
    'step-08-scoping',
    'step-09-functional',
    'step-10-nonfunctional',
    'step-11-polish',
    'step-12-complete',
  ]
inputDocuments:
  [
    '_bmad-output/project-intent-phase2.md',
    '_bmad-output/project-context.md',
    'docs/game-data-source.md',
    'docs/pixi-spike-report.md',
  ]
workflowType: 'prd'
classification:
  projectType: 'desktop_app'
  domain: 'gaming_companion'
  complexity: 'medium'
  projectContext: 'brownfield'
documentCounts:
  briefCount: 0
  researchCount: 2
  brainstormingCount: 0
  projectDocsCount: 2
---

# Product Requirements Document — LEBOv2 Phase 2

**Author:** Alec
**Date:** 2026-05-06
**Phase:** 2 of 3
**Supersedes:** Phase 1 PRD (archived in `_bmad-output/_phase1-archive/planning-artifacts/prd.md`)
**Status:** Complete — ready for UX Design, Architecture, and Epic Breakdown

---

## Executive Summary

LEBOv2 Phase 2 transforms the fully-shipped Phase 1 MVP into a production-quality Last Epoch companion app that matches lastepochtools.com in visual fidelity and surpasses it in AI-driven optimization depth. Phase 1 delivered: class/mastery skill tree display, build persistence (SQLite), free-text gear/skill/idol context, and streamed AI optimization suggestions. Phase 2 delivers three cohesive pillars designed together and implemented sequentially.

**Pillar 1 — Full Skill Tree Fidelity:** Every active skill for every class rendered with actual game icons in hexagonal nodes, multi-point allocation (left-click increment / right-click decrement), character-level budget enforcement toggle, and the Weaver Tree (pending data research spike). Skill picker grids organized by class/mastery with point-gate badges match lastepochtools.com exactly.

**Pillar 2 — Item Database + Structured Gear Input:** Full item database (674 base items, 445 uniques, 1,112+ affixes) sourced from community data, stored locally with background freshness checks. Typeahead search per gear slot replaces free-text. Each item populates with known affixes at selectable tiers (T1–T7). Custom affix addition via searchable dropdown covers crafted/fractured items. Free-text fallback preserved.

**Pillar 3 — Advanced Optimization UX:** A single Glass Cannon ↔ Juggernaut master slider replaces the current 4-button goal preset system. A "Fine Tune" expansion panel adds independent Damage / Survivability / Speed sub-sliders. Optimization is now level-budget-aware when enforcement is ON. Skill-tree optimization is the sole focus of Phase 2; item and full-build optimization are Phase 3.

**Target users:** Advanced Last Epoch players and theory-crafters who currently use lastepochtools.com as their primary reference. Phase 2 makes LEBOv2 the replacement, not a supplement.

**Delivery:** Auto-update to existing installed base (Tauri updater, built in Phase 1 Epic 5). No web version. Windows 10/11 + macOS 12+.

### What Makes This Special

No existing tool combines icon-accurate, interactive skill tree planning with AI-driven optimization. lastepochtools.com has the visual fidelity but no AI layer. Path of Building for Last Epoch has calculation depth but no AI explanations. LEBOv2 Phase 2 is the first tool where a player can see their exact build visually, adjust it interactively, and immediately receive AI suggestions constrained by their actual character level — all in one workflow.

The Glass Cannon ↔ Juggernaut slider is the UX innovation: a single continuous spectrum replaces the cognitive overhead of picking from four abstract presets. Players speak in archetypes ("I want to face-tank everything"), not optimization categories ("Maximize Survivability"). The slider maps natural intent to weighted optimization scoring directly.

Asset auto-extraction from the Steam install removes the last friction point: icons appear automatically without any user action. Players who don't have the game installed still get icons via community CDN fallback — they are never blocked.

## Project Classification

- **Type:** Tauri 2.x desktop application (Windows 10/11, macOS 12+)
- **Domain:** Gaming / ARPG theory-crafting companion
- **Complexity:** Medium — no regulatory compliance; complexity driven by PixiJS rendering, game data integration, Rust/TypeScript IPC, and AI streaming
- **Context:** Brownfield — Phase 1 (6 epics) fully complete; Phase 2 extends the existing codebase under all Phase 1 architectural constraints

---

## Success Criteria

### User Success

- A player can open any active skill's full tree, see icon-accurate hexagonal nodes, click to allocate points up to node maximum, right-click to deallocate, and see the `current/max` counter update in real time — for all 133 skills across all 5 classes.
- A player can search their equipped items by name, select from the database, and dial in actual affix tiers without typing free-form text.
- A player can drag the Glass Cannon ↔ Juggernaut slider to either extreme and immediately receive AI optimization suggestions weighted to that archetype.
- A player with "Enforce level budget" ON cannot over-allocate passive points beyond what their character level allows. The unspent counter is always accurate.
- A player whose save was created in Phase 1 loads Phase 2 without data loss; their free-text gear context migrates cleanly to the v2 schema.

### Business Success

- All three pillars ship as updates to the existing installed base via the Phase 1 auto-update system — no new installer required.
- Phase 2 reduces the primary user reason to visit lastepochtools.com to zero (visual fidelity gap closed).
- Icon auto-extraction works silently on Windows Steam installs for ≥90% of users who have the game installed; CDN fallback serves the remaining users without user-visible failure.

### Technical Success

- PixiJS canvas maintains ≥60fps at actual game node counts (~47 passive + up to 5×29 skill nodes = ~192 nodes max per view) on the Phase 1 benchmark hardware (Intel i5, integrated graphics, 8 GB RAM).
- BuildState v1 → v2 migration in `migrateBuildState` is lossless: all existing saves load without errors, free-text affixes preserved as `{ name: affix, tier: undefined }`.
- Item database manifest v2 with `itemDataVersion` and `iconCacheVersion` fields correctly drives background freshness checks on launch.
- All new Tauri commands follow the existing pattern: implemented in Rust → registered in `lib.rs` → called via `invokeCommand<T>()` in TypeScript. Zero raw `invoke()` calls.

### Measurable Outcomes

| Outcome | Measure |
|---------|---------|
| Icon rendering latency | Icons load into PixiJS nodes within 200ms of tree view opening |
| Build migration | 0 errors on loading any Phase 1 save in Phase 2 build |
| Skill tree coverage | All 133 skills × 5 classes interactive with correct node data |
| Item database completeness | ≥674 base items, ≥445 uniques, ≥1,112 affixes searchable at launch |
| Canvas FPS | ≥60fps idle; ≥45fps sustained under any interaction on benchmark hardware |
| Slider → optimization latency | AI stream begins within same latency budget as Phase 1 (no regression) |

---

## Product Scope

### MVP — Phase 2

All three pillars fully delivered:

**Pillar 1:**
- Skill picker grid for all classes/masteries with icon, name, unlock level, and mastery-gate badges
- Active skill trees with icon-accurate hexagonal nodes, multi-point left/right-click allocation, `current/max` counter, prerequisite validation
- Passive skill trees with structured horizontal-row layout, mastery-locked nodes at thresholds
- Character level input → passive point budget calculation; active skill level input → skill tree budget
- "Enforce level budget" toggle (default OFF); unspent points counter always visible
- Search bar per tree: highlights matching nodes, dims non-matching
- RESET button per tree
- Icon pipeline: auto-detect Steam install path, extract and cache icons; community CDN fallback when game not installed
- Weaver Tree: research spike first; if data is available, rendered in web/radial PixiJS layout — gated behind spike completion

**Pillar 2:**
- Local item database (base items, uniques, affixes) with background freshness check on launch
- Typeahead item search per gear slot with fuzzy matching
- Selected item pre-populates known affixes at default/median tier
- Tier slider (T1–T7) per affix for customization
- "+" button to add custom affixes via searchable dropdown of full affix database
- Free-text gear input preserved as fallback escape hatch
- BuildState schema v2 with `itemId?`, `affixId?`, `tier?`, `value?` per affix; `migrateBuildState` handles v1 upgrade

**Pillar 3:**
- Glass Cannon ↔ Juggernaut master slider replacing 4-button goal preset system
- Fine Tune expansion panel with independent Damage / Survivability / Speed sub-sliders (0–100 each); Fine Tune overrides master slider when expanded
- Level-budget-aware AI context: when "Enforce level budget" is ON, AI receives character level, available passive points, and skill levels as hard constraints

### Growth Features — Phase 3

- **Item Optimizer:** AI suggests gear improvements; toggle for specific-item vs. stat-priority mode
- **Full Build Optimizer:** Holistic skills + gear analysis using the same Glass Cannon ↔ Juggernaut weighting; produces unified build direction report
- **Build sharing:** Export builds as shareable files or links

### Vision — Phase 3+

- Meta context: "This build aligns with current S-tier Void Knight meta" — requires community meta data integration
- EHG official API integration if/when publicly available (replaces static bundle as primary source)
- Partner request to EHG post-Phase 2 launch

### Explicit Exclusions (Phase 2)

- Item optimization (suggesting item swaps) — Phase 3
- Full build optimizer (skills + gear combined) — Phase 3
- Build sharing / export URLs — Phase 3+
- Multiplayer, social features, or leaderboards — permanently out of scope
- Mobile version — permanently out of scope
- Monetization — not in Phase 2

---

## User Journeys

### Journey 1 — The Theory-Crafter: Optimizing a Void Knight Build

**Opening scene:** Marcus has been playing his Void Knight for 80 hours. He's hit a wall — his damage feels solid but he's dying too often in monoliths. He opens LEBOv2 Phase 2.

**Rising action:** Marcus selects his Sentinel → Void Knight build. The passive tree loads instantly with icon-accurate hexagonal nodes. He can see his current allocation and the unspent points counter shows 3 remaining. He switches to his Rive skill tab — the full radial skill tree appears, icons he recognizes from the game rendering in each node. He clicks a defensive node to increment it from 2/4 to 3/4. He opens the gear panel and types "Juggernaut" in the Chest slot — the typeahead suggests "Juggernaut Plate" instantly. He selects it, the pre-loaded affixes appear. His actual chest has T4 health and T2 armor — he sets the sliders to match.

**Climax:** Marcus drags the master slider toward Juggernaut. The slider sits at ~70% survivability. He clicks Optimize. The AI streams back a specific suggestion: "Allocate the remaining 3 passive points to Void Shield (your gear already provides max fire res, so the additional fire scaling in Righteous Cleave is redundant). This increases your effective HP pool by approximately 12% with no damage loss given your current gear." Marcus sees exactly which node to change, and why, in the context of his actual gear.

**Resolution:** Marcus loads the game, makes the change. He clears the monolith wave without dying for the first time. LEBOv2 Phase 2 is now his primary planning tool — he has no reason to open a browser tab.

**Journey requirements revealed:** Icon rendering in skill nodes; typeahead gear search; tier sliders; level-budget-aware AI context; Glass Cannon ↔ Juggernaut slider; streaming optimization display.

---

### Journey 2 — The Returning Player: Post-Patch Build Update

**Opening scene:** Priya played Acolyte extensively in patch 1.3, saved her Bone Curse build in LEBOv2. After the 1.4 patch, Bone Curse received significant changes. She updates LEBOv2 and launches it.

**Rising action:** Her old build loads cleanly — the v1 → v2 migration ran silently, her free-text gear context migrated to structured format. The staleness indicator shows: "Game data updated to 1.4.4. Would you like to refresh?" She refreshes. The Bone Curse skill tree reloads with updated node values. She notices two nodes she'd allocated are now nerfed. She uses the search bar to find "Bone" nodes — matching nodes highlight in gold while others dim.

**Climax:** She sees the patch shifted the meta toward a minion synergy node she'd ignored. She right-clicks her old nodes to deallocate (decrement to 0) and left-clicks the new node. The prerequisite chain enforces correctly — she can't skip nodes. The unspent counter tracks her reallocation in real time.

**Resolution:** In under 5 minutes, her build is updated for the new patch. The structured gear context from v2 means the AI suggestions in Phase 2 are richer than Phase 1's free-text interpretation.

**Journey requirements revealed:** BuildState v1 → v2 migration; game data freshness check and update prompt; per-node right-click decrement with prerequisite validation; search highlight within trees.

---

### Journey 3 — The New Theory-Crafter: Exploring the Weaver Tree

**Opening scene:** Jordan is new to Last Epoch, level 40 Mage. He's heard about the Weaver Tree and wants to understand it before committing points. He opens LEBOv2 and clicks the Weaver Tree tab.

**Rising action:** The Weaver Tree opens in a web/radial layout with a central node. Nodes he can't reach yet show lock icons. He inputs his character level (40) and turns on "Enforce level budget." The unspent Weaver points counter shows his current allocation. He clicks a reachable node to see its tooltip, then allocates a point. He tries to click a locked node — the tooltip explains the requirement.

**Climax:** Jordan uses the search bar to find "Mana" — nodes with mana effects highlight. He reallocates points to the mana synergy cluster. He clicks Optimize with Fine Tune expanded and Damage Weight maxed — the AI responds with skill tree suggestions that account for his Weaver mana investments.

**Resolution:** Jordan understands the Weaver Tree well enough to make an informed commitment in-game.

**Journey requirements revealed:** Weaver Tree rendering (research spike first); lock icon with requirement tooltip; level budget enforcement for Weaver; search within Weaver Tree; optimization AI aware of Weaver allocations.

---

### Journey 4 — The Data Update Scenario: Post-Game-Patch Manual Refresh

**Opening scene:** EHG ships patch 1.5 with changes to the Primalist passive tree. Alec (the developer) updates the bundled JSON files and ships a new LEBOv2 data update.

**Rising action:** User opens LEBOv2 the morning after the LEBOv2 data update. The app checks `manifest.json gameVersion` against the remote version file on launch. The staleness banner appears: "Updated data available (1.5.0). Update now?" The user clicks Update. The Rust command downloads the new manifest and class JSON, replaces local files, and reloads.

**Resolution:** The Primalist tree displays the correct 1.5 nodes. No app reinstall required. Item database freshness follows the same pattern via `itemDataVersion`.

**Journey requirements revealed:** Background freshness check on launch; staleness banner UI; Rust data update command; separate versioning for game data vs. item data; no user interaction required for icon cache refresh.

### Journey Requirements Summary

| Capability Area | Journeys Covered |
|-----------------|-----------------|
| Icon-accurate PixiJS skill tree rendering | 1, 2, 3 |
| Multi-point node allocation with prerequisite validation | 1, 2, 3 |
| Typeahead item search with tier sliders | 1 |
| BuildState v1 → v2 migration | 2 |
| Game data + item data freshness/update pipeline | 2, 4 |
| Weaver Tree rendering | 3 |
| Glass Cannon ↔ Juggernaut slider + Fine Tune | 1, 3 |
| Level-budget enforcement toggle + unspent counter | 3 |
| Search highlight within trees | 2, 3 |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Glass Cannon ↔ Juggernaut continuous spectrum slider**
No existing Last Epoch build tool presents optimization intent as a continuous archetype spectrum. lastepochtools.com has no optimization at all. Prior LEBOv2 (Phase 1) used four discrete preset buttons. The slider maps natural player language ("I want to tank everything") directly to weighted optimization scoring. The Fine Tune expansion panel preserves power-user control without polluting the primary UX.

**2. Zero-friction icon pipeline**
Steam install auto-detection and silent icon extraction requires no user action. The community CDN fallback ensures users without the game installed are never blocked. This is a meaningful UX differentiation from tools requiring manual asset management or those that render placeholder icons.

**3. Structured gear context replacing free-text AI input**
Phase 1 sent gear context as unstructured strings. Phase 2 sends slot → item → affix → tier as structured data, enabling the AI to reason at the affix level ("your gear already provides max fire res, so...") rather than pattern-matching from prose. This is a qualitative improvement in AI suggestion quality, not just a UI change.

### Market Context & Competitive Landscape

| Tool | Skill Tree Visual Fidelity | AI Optimization | Item Database |
|------|---------------------------|-----------------|---------------|
| lastepochtools.com | Full (icon-accurate) | None | Partial |
| Path of Building for LE | Functional, not icon-accurate | None | Partial |
| LEBOv2 Phase 1 | Partial (no icons) | Streamed AI suggestions | Free-text only |
| **LEBOv2 Phase 2** | **Full (icon-accurate)** | **AI + archetype slider** | **Full (structured)** |

Phase 2 closes the only remaining gap with lastepochtools.com (visual fidelity) while adding a capability no competing tool has (AI optimization).

### Validation Approach

- **Slider UX:** User acceptance validated by whether Phase 2 users use the slider over re-enabling a preset-style selection. If players consistently ask for presets back, evaluate whether named positions on the slider (e.g., labeled endpoints + midpoint) provide sufficient wayfinding.
- **Icon pipeline:** Validated by silent successful extraction on ≥90% of Windows Steam installs during internal testing. CDN fallback validated by testing with game files moved/removed.
- **Structured gear AI quality:** Validated qualitatively — do AI suggestions reference specific affix values? If yes, structured context is working.

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Steam path detection fails on non-standard installs | Log detection failure silently; fall through to CDN. Never show an error for this. |
| Community CDN icons become unavailable | Cache icons locally on first successful fetch; serve from cache on subsequent loads |
| Weaver Tree data unavailable from community sources | Research spike first; if no machine-readable data, defer Weaver Tree to a subsequent patch |
| Item database significantly out of date at Phase 2 launch | Ship with manifest `itemDataVersion` freshness check on day one; prompt user to update |

---

## Desktop Application Requirements

### Project-Type Overview

LEBOv2 is a signed Tauri 2.x desktop application. All backend logic — API calls, file I/O, data parsing, Steam path detection, icon extraction — runs in Rust. The TypeScript/React frontend is a rendering layer only. No Node.js sidecars, no server components.

Phase 2 adds three new Rust system integrations: Steam path detection + icon extraction, item database loading, and manifest v2 versioning. All follow the existing Tauri command pattern.

### Technical Architecture Considerations

**Four domain stores maximum (enforced):** Phase 2 extends `useGameDataStore` for item data (base items, uniques, affixes) and extends `useBuildStore` for BuildState v2 gear schema. No new top-level Zustand stores.

**SkillTreeCanvas props-only contract (enforced):** Icon rendering inside PixiJS nodes passes icon data via props. `SkillTreeCanvas` never accesses Zustand directly. Icon textures are loaded as PixiJS `Assets` and passed as resolved `Texture` references in `treeData`.

**No barrel files (enforced):** All new feature folders (`item-database/`, `icon-pipeline/`, `weaver-tree/`) follow direct-import convention. No `index.ts` re-exports.

**API key security (enforced):** Optimization API calls remain fully in Rust. API key never crosses the IPC boundary to TypeScript.

### Platform & Distribution Requirements

- **Platforms:** Windows 10/11 (`.msi`, code-signed), macOS 12+ (`.dmg`, notarized). No Linux in Phase 2.
- **Auto-update:** All Phase 2 features ship via the Tauri updater built in Phase 1 Epic 5. No new installer required for existing users.
- **Offline-first:** All game data, item data, and icon cache stored in `{app_data}/lebo/`. App functions fully offline after initial data load.
- **Steam integration:** Read-only. App reads the Steam install directory to extract icon assets. No write operations to Steam directories.

### Data Architecture — Phase 2 Additions

**New app data directory structure:**
```
{app_data}/lebo/
  game-data/          ← existing (Phase 1)
    manifest.json     ← extends with itemDataVersion, iconCacheVersion, iconSource
    classes/
    skills/
  items/              ← new (Phase 2, Pillar 2)
    base-items.json
    uniques.json
    affixes.json
  icons/              ← new (Phase 2, Pillar 1)
    skills/           ← extracted or CDN-fetched skill icons
    items/            ← item icons (future / best-effort)
```

**manifest.json v2 additions:**
```json
{
  "itemDataVersion": "1.0.0",
  "iconCacheVersion": "1.0.0",
  "iconSource": "game-files" | "community-cdn"
}
```

**BuildState schema v2 gear field:**
```json
{
  "slot": "chest",
  "itemId": "juggernaut-plate",
  "itemName": "Juggernaut Plate",
  "affixes": [
    { "affixId": "health-flat", "name": "Health", "tier": 4, "value": 280 },
    { "affixId": "armor-flat", "name": "Armor", "tier": 2, "value": 120 }
  ]
}
```
v1 gear (free-text affixes) migrates to: `{ name: affix, tier: undefined, value: undefined }`.

### Implementation Considerations

- **New Tauri commands required:** `detect_steam_path`, `extract_skill_icons`, `load_item_database`, `load_affix_database`, `get_icon_texture(skill_id)`, `check_item_data_freshness`, `update_item_data`.
- **Icon loading pattern:** Icons preloaded into PixiJS `Assets` cache at tree view mount. `SkillTreeCanvas` receives `iconTextures: Map<string, Texture>` as a prop; renderer uses it to draw skill icons inside hexagonal nodes.
- **Weaver Tree:** Research spike required before any implementation. Spike validates: (1) community data source for Weaver Tree node layout, (2) coordinate format compatibility with existing PixiJS renderer. If spike fails, Weaver Tree deferred.

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Feature-complete Phase 2 (all three pillars) as a coherent product update. Phase 2 is not a partial release — all three pillars ship together because they form a single user experience: see the skill tree accurately (Pillar 1), know your gear context accurately (Pillar 2), optimize with archetype intent (Pillar 3).

**Resource requirements:** Solo developer (Alec) + AI dev agents (BMAD). Sequential epic implementation.

### MVP Feature Set — Phase 2

**Core user journeys supported:** All four journeys above.

**Must-have capabilities (all of Phase 2 scope):**
- Skill picker grid with icons and mastery-gate badges
- Icon-accurate hexagonal PixiJS skill nodes (Steam extraction + CDN fallback)
- Multi-point left/right-click node allocation with prerequisite validation
- Character level input → passive point budget; skill level input → skill tree budget
- "Enforce level budget" toggle; unspent points counter
- Search highlight within all trees; RESET button
- Item database (base items, uniques, affixes) loaded locally
- Typeahead item search per slot + tier sliders + custom affix addition
- Free-text gear fallback
- BuildState schema v2 + lossless v1 migration
- Glass Cannon ↔ Juggernaut master slider
- Fine Tune sub-slider expansion panel
- Level-budget-aware AI optimization context
- Game data + item data background freshness check on launch

**Gated behind research spike:**
- Weaver Tree rendering (proceeds only if community data confirmed available)

### Risk Mitigation Strategy

**Technical risks:**
- Icon extraction from game files: mitigated by CDN fallback; game files path is well-established in Steam convention
- Weaver Tree data availability: mitigated by spike-first gating — no commitment before validation
- PixiJS performance with icon textures: mitigated by Phase 1 benchmark (800-node proof) + texture atlas batching

**Market risks:**
- EHG patches significantly change skill trees before Phase 2 ships: mitigated by versioned JSON + staleness detection
- lastepochtools.com improves their tool during Phase 2 development: Phase 2's AI layer is not replicable without significant investment; visual fidelity parity is the floor, not the ceiling

**Resource risks:**
- Three pillars scope creep: Weaver Tree is explicitly gated; item optimization is explicitly Phase 3; build sharing is explicitly Phase 3+

---

## Functional Requirements

### Skill Tree Visual Rendering

- FR1: Players can view each active skill's full tree with actual game icons in hexagonal PixiJS nodes, for all 133 skills across all 5 classes.
- FR2: Players can view each class's base passive tree and each mastery's passive tree with icon-accurate hexagonal nodes in a structured horizontal-row layout.
- FR3: Players can view the Weaver Tree in a web/radial PixiJS layout with a central node (contingent on research spike confirming data availability).
- FR4: Players can see node connectivity rendered as edges between hexagonal nodes in all tree views.
- FR5: Players can see each node's mastery point unlock threshold displayed as a badge overlay (5, 10, 15, 20, 25, 35 points) in the skill picker and passive tree.
- FR6: Players can see which nodes are locked (prerequisites unmet) vs. available (prerequisites met, points remaining) vs. allocated (points invested) vs. suggested (AI-recommended) through distinct visual states.
- FR7: Players can search within any tree by node name; matching nodes highlight in gold, non-matching nodes dim; clearing the search field restores all nodes to normal state.
- FR8: Players can RESET all allocations in any tree to zero with a single button action.
- FR9: Players can see an unspent points counter above each tree reflecting their current remaining point budget.
- FR10: Players can see the selected active skill's name, level, and unlock condition in the tree header area alongside other active skill slot indicators.

### Active Skill Management

- FR11: Players can open a skill picker for each active skill slot that shows all skills available to the selected class and mastery, organized by base class skills and mastery-gated groups.
- FR12: Players can select any available skill from the picker to load that skill's full interactive tree under the active slot tab.
- FR13: Players can left-click a node to increment its allocation by 1 point (up to node maximum).
- FR14: Players can right-click a node to decrement its allocation by 1 point (down to 0).
- FR15: Players can see each node's `current/max` point counter (e.g., `3/5`) rendered in the node.
- FR16: The app prevents left-click increment on a node whose prerequisite nodes have insufficient allocation.
- FR17: The app prevents right-click decrement on a node whose allocated points are required as prerequisites by currently-allocated dependent nodes.

### Character Level & Budget System

- FR18: Players can input their character level (1–100); the app calculates and displays total available passive points based on level.
- FR19: Players can input their active skill level (1–20) per skill slot; the app tracks the maximum allocatable points for that skill's tree.
- FR20: Players can toggle "Enforce level budget" ON or OFF (default OFF); when ON, the app prevents allocation that would exceed the calculated point budget.
- FR21: When "Enforce level budget" is OFF, the app allows free theory-craft allocation with no budget ceiling.
- FR22: The unspent points counter updates immediately and accurately after every node allocation or deallocation action.

### Item Database & Gear Input

- FR23: The app loads a local item database containing ≥674 base items, ≥445 unique items, and ≥1,112 affixes, sourced from community data and bundled with the application.
- FR24: Players can search any gear slot by item name using typeahead fuzzy search that queries the local item database and displays matching suggestions.
- FR25: Selecting an item from the typeahead search populates the gear slot with the item's name, base type, and known affixes at default/median tier values.
- FR26: Players can adjust each pre-loaded affix's tier using a per-affix tier slider (T1 through the item's maximum available tier) to match their actual rolled values.
- FR27: Players can add affixes not pre-loaded to an item via a "+" action that opens a searchable dropdown of all affixes in the affix database.
- FR28: Players can set value/tier for any custom-added affix from the full affix database.
- FR29: Players can clear a gear slot's item selection to reset it to empty or free-text fallback.
- FR30: Players can use free-text input as a fallback for any gear slot if they cannot find their item or prefer prose input.
- FR31: The app passes structured gear context (slot, item name/ID, affix name/ID, tier, value) to the AI optimization engine when items are set via the database path.
- FR32: The app passes free-text gear context (unchanged from Phase 1 behavior) to the AI optimization engine when items are set via the free-text path.
- FR33: The app checks item database freshness on launch and displays a staleness indicator when a newer `itemDataVersion` is available; users can trigger an update.

### Optimization UX & AI Integration

- FR34: Players can set optimization intent using a continuous Glass Cannon ↔ Juggernaut master slider; fully left = maximum survivability weighting; fully right = maximum damage weighting; center = balanced.
- FR35: Players can expand a "Fine Tune" panel revealing independent Damage Weight, Survivability Weight, and Speed Weight sub-sliders (each 0–100); Fine Tune values override the master slider when the panel is expanded.
- FR36: The app maps the Glass Cannon ↔ Juggernaut slider position to the weighted scoring system such that Phase 1 preset positions (Maximize Damage, Balanced, Maximize Survivability, Maximize Speed) remain accessible as positions on the spectrum for backwards compatibility.
- FR37: When "Enforce level budget" is ON, the app includes character level, available passive points, and per-skill skill levels in the AI optimization request as hard constraints.
- FR38: When "Enforce level budget" is OFF, the app sends optimization requests without point-budget constraints, allowing the AI to suggest ideal allocations as theory-craft targets.
- FR39: The app streams AI optimization suggestions incrementally as they arrive, rendering partial results while the stream continues (no regression from Phase 1 behavior).
- FR40: Players can see before/after scoring comparison for each AI suggestion (no regression from Phase 1 behavior).
- FR41: The optimization engine uses structured gear context (when available from Phase 2 item database input) to provide affix-level reasoning in suggestions.
- FR42: Players can clear all suggestions and re-run optimization with updated build state or slider position.

### Data Pipeline & Asset Management

- FR43: The app auto-detects the Last Epoch Steam install path on first launch (`C:\Program Files (x86)\Steam\steamapps\common\Last Epoch` convention; reads registry or filesystem) without user interaction.
- FR44: The app silently extracts skill icons from game files on first launch when the Steam install is detected; extracted icons are cached locally in `{app_data}/lebo/icons/skills/`.
- FR45: The app falls back to community CDN icon sources when game files are not detected or extraction fails; players are never shown an error or blocked by missing icons.
- FR46: The app caches CDN-fetched icons locally; subsequent launches serve icons from local cache without network requests.
- FR47: The app checks game data freshness on launch using manifest `gameVersion` and displays a staleness indicator when community data has a newer version; users can trigger an update.
- FR48: The app checks item data freshness on launch using manifest `itemDataVersion` and displays a staleness indicator when a newer version is available; users can trigger an update.
- FR49: The app records `iconSource` in the manifest (`game-files` or `community-cdn`) so the icon pipeline is deterministic and auditable.
- FR50: The app's data update flow downloads updated manifest and data files, replaces local files atomically, and reloads affected data in the running session without requiring app restart.

### Build Persistence & Migration

- FR51: The app migrates all existing Phase 1 (schema v1) saves to BuildState schema v2 via `migrateBuildState` on load, losslessly converting free-text affixes to `{ name: affix, tier: undefined, value: undefined }` objects.
- FR52: The app saves all Phase 2 builds in BuildState schema v2 format with structured gear data.
- FR53: The app preserves all existing Phase 1 build management capabilities: save, load, rename, delete (no regression).
- FR54: The schema migration is idempotent: loading a v2 build through `migrateBuildState` produces an identical v2 build with no data modification.
- FR55: The app exposes the current manifest `gameVersion` and `itemDataVersion` in the settings panel so players can verify their data currency.

---

## Non-Functional Requirements

### Performance

- The PixiJS canvas renders at ≥60fps idle and ≥45fps sustained under continuous pan/zoom/hover interaction for any single tree view containing up to 200 nodes, as measured on the benchmark hardware (Intel i5, integrated graphics, 8 GB RAM, 1080p display).
- Icon textures loaded into PixiJS `Assets` cache complete within 200ms of tree view mount for the first load; subsequent loads within the same session serve from cache with no measurable delay.
- Item typeahead search returns ranked results within 50ms of each keystroke for the full 674+ base item + 445+ unique item corpus, using local in-memory querying.
- AI optimization stream begins emitting within the same latency budget as Phase 1 (no regression introduced by structured gear context marshaling).

### Security

- The Anthropic/OpenRouter API key never crosses the Tauri IPC boundary into TypeScript; all API calls remain in Rust commands following Phase 1 architecture.
- Steam directory access is read-only; no write operations are performed to any Steam or game installation directory.
- Icon files extracted from game directories are cached in the app's sandboxed data directory; no extracted assets are transmitted externally.
- The `VAULT_PASSWORD` static constant in `keychain_service.rs` remains as the known Phase 1 deferred item; no change in Phase 2.

### Accessibility

- All new interactive UI elements (slider, Fine Tune expansion panel, tier sliders, typeahead dropdown, custom affix picker) have a `2px solid accent-gold` focus ring; `outline: none` is never used without a replacement.
- The Glass Cannon ↔ Juggernaut slider is keyboard-navigable (arrow keys increment/decrement position) and has an `aria-label` describing the current position as a percentage.
- The item typeahead dropdown follows ARIA combobox pattern with `role="combobox"`, `aria-expanded`, and `aria-activedescendant` for screen reader compatibility.
- The staleness indicator and data update progress region use `aria-live="polite"`.
- `prefers-reduced-motion` gates all animated transitions in new components; `useReducedMotion()` hook is used consistently.
- All new views and components pass `vitest-axe` checks in CI with zero violations.

### Reliability

- BuildState v1 → v2 migration is lossless under all Phase 1 save variants: free-text gear, null gear, partial gear, empty builds.
- Data update operations are atomic: if a download fails mid-transfer, the existing local data files are not corrupted; the app retains the last valid state.
- Icon extraction failure (game files inaccessible, format change) degrades gracefully to CDN fallback without user-visible error; the app logs the failure internally.
- Item database load failure at startup is recoverable: the app displays the free-text gear input fallback for all slots and continues to function for skill tree and optimization features.

---

## Technical Constraints Carried Forward

All rules in `project-context.md` remain in force. The following Phase 1 constraints directly shape Phase 2 implementation:

| Constraint | Phase 2 Impact |
|------------|---------------|
| Four domain stores only | Extend `useGameDataStore` for item data; extend `useBuildStore` for v2 gear schema — no new stores |
| SkillTreeCanvas is props-only | Icon textures passed via `iconTextures: Map<string, Texture>` prop; canvas never reads stores |
| No barrel files | `item-database/`, `icon-pipeline/`, `weaver-tree/` use direct imports |
| Tauri commands in Rust | Steam detection, icon extraction, item DB loading, freshness checks all in Rust |
| API key never crosses to frontend | Unchanged; optimization calls stay fully in Rust |
| Schema migration | `migrateBuildState` handles v1 → v2; existing saves must load cleanly |
| No React Router | Weaver Tree tab is a view within the existing tab system; no new routing |
| WebGL patch at module load | Already applied in `pixiRenderer.ts`; do not re-inject |

---

## Phase 2 Workflow Progress

| Step | Skill | Status |
|------|-------|--------|
| 1 | `bmad-create-prd` | `[x] Complete` |
| 2 | `bmad-create-ux-design` | `[x] Complete` |
| 3 | `bmad-create-architecture` | `[ ] Not Started` |
| 4 | `bmad-create-epics-and-stories` | `[ ] Not Started` |
| 5 | `bmad-check-implementation-readiness` | `[ ] Not Started` |
| 6 | `gds-sprint-planning` | `[ ] Not Started` |
| 7 | Dev Loop | `[ ] Not Started` |
