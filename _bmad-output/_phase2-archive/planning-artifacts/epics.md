---
stepsCompleted: ['step-01', 'step-02', 'step-03', 'step-04']
inputDocuments:
  [
    '_bmad-output/project-intent-phase2.md',
    '_bmad-output/planning-artifacts/prd.md',
    '_bmad-output/planning-artifacts/ux-design-specification.md',
    '_bmad-output/planning-artifacts/architecture.md',
  ]
workflowType: 'epics-and-stories'
---

# LEBOv2 Phase 2 — Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for LEBOv2 Phase 2, decomposing all 55 functional requirements, 19 non-functional requirements, 15 UX design requirements, and architecture constraints into 7 implementable epics with 32 stories.

---

## Requirements Inventory

### Functional Requirements

**Skill Tree Visual Rendering**
FR1: Players can view each active skill's full tree with actual game icons in hexagonal PixiJS nodes, for all 133 skills across all 5 classes.
FR2: Players can view each class's base passive tree and each mastery's passive tree with icon-accurate hexagonal nodes in a structured horizontal-row layout.
FR3: Players can view the Weaver Tree in a web/radial PixiJS layout with a central node (contingent on research spike confirming data availability).
FR4: Players can see node connectivity rendered as edges between hexagonal nodes in all tree views.
FR5: Players can see each node's mastery point unlock threshold displayed as a badge overlay (5, 10, 15, 20, 25, 35 points) in the skill picker and passive tree.
FR6: Players can see which nodes are locked / available / allocated / suggested through distinct visual states.
FR7: Players can search within any tree by node name; matching nodes highlight in gold, non-matching nodes dim; clearing restores normal state.
FR8: Players can RESET all allocations in any tree to zero with a single button action.
FR9: Players can see an unspent points counter above each tree reflecting their current remaining point budget.
FR10: Players can see the selected active skill's name, level, and unlock condition in the tree header area alongside other active skill slot indicators.

**Active Skill Management**
FR11: Players can open a skill picker for each active skill slot showing all skills for the selected class/mastery, organized by base class skills and mastery-gated groups.
FR12: Players can select any available skill from the picker to load that skill's full interactive tree under the active slot tab.
FR13: Players can left-click a node to increment its allocation by 1 point (up to node maximum).
FR14: Players can right-click a node to decrement its allocation by 1 point (down to 0).
FR15: Players can see each node's `current/max` point counter (e.g., `3/5`) rendered in the node.
FR16: The app prevents left-click increment on a node whose prerequisite nodes have insufficient allocation.
FR17: The app prevents right-click decrement on a node whose points are required as prerequisites by currently-allocated dependent nodes.

**Character Level & Budget System**
FR18: Players can input their character level (1–100); the app calculates and displays total available passive points.
FR19: Players can input their active skill level (1–20) per skill slot; the app tracks the maximum allocatable points for that skill's tree.
FR20: Players can toggle "Enforce level budget" ON or OFF (default OFF); when ON, the app prevents allocation exceeding the calculated budget.
FR21: When "Enforce level budget" is OFF, the app allows free theory-craft allocation with no budget ceiling.
FR22: The unspent points counter updates immediately and accurately after every node allocation or deallocation.

**Item Database & Gear Input**
FR23: The app loads a local item database containing ≥674 base items, ≥445 unique items, and ≥1,112 affixes sourced from community data and bundled with the application.
FR24: Players can search any gear slot by item name using typeahead fuzzy search querying the local item database.
FR25: Selecting an item populates the gear slot with item name, base type, and known affixes at default/median tier.
FR26: Players can adjust each affix's tier using a per-affix tier slider (T1 through item's maximum tier) to match actual rolled values.
FR27: Players can add affixes not pre-loaded via a "+" action opening a searchable dropdown of all affixes in the affix database.
FR28: Players can set value/tier for any custom-added affix.
FR29: Players can clear a gear slot's item selection to reset to empty or free-text fallback.
FR30: Players can use free-text input as a fallback for any gear slot.
FR31: The app passes structured gear context (slot, item name/ID, affix name/ID, tier, value) to the AI optimization engine when items are set via the database path.
FR32: The app passes free-text gear context (unchanged from Phase 1) to the AI optimization engine when items are set via the free-text path.
FR33: The app checks item database freshness on launch and displays a staleness indicator when a newer itemDataVersion is available; users can trigger an update.

**Optimization UX & AI Integration**
FR34: Players can set optimization intent using a continuous Glass Cannon ↔ Juggernaut master slider; fully left = maximum survivability; fully right = maximum damage; center = balanced.
FR35: Players can expand a "Fine Tune" panel revealing independent Damage Weight, Survivability Weight, and Speed Weight sub-sliders (0–100 each); Fine Tune values override the master slider when expanded.
FR36: The app maps the slider position to weighted scoring such that Phase 1 preset positions remain accessible as positions on the spectrum.
FR37: When "Enforce level budget" is ON, the app includes character level, available passive points, and per-skill levels in the AI request as hard constraints.
FR38: When "Enforce level budget" is OFF, the app sends optimization requests without point-budget constraints.
FR39: The app streams AI optimization suggestions incrementally as they arrive (no regression from Phase 1).
FR40: Players can see before/after scoring comparison for each AI suggestion (no regression from Phase 1).
FR41: The optimization engine uses structured gear context to provide affix-level reasoning in suggestions.
FR42: Players can clear all suggestions and re-run optimization with updated build state or slider position.

**Data Pipeline & Asset Management**
FR43: The app auto-detects the Last Epoch Steam install path on first launch without user interaction.
FR44: The app silently extracts skill icons from game files on first launch when Steam install is detected; extracted icons cached locally.
FR45: The app falls back to community CDN icon sources when game files are not detected or extraction fails; players never shown an error.
FR46: The app caches CDN-fetched icons locally; subsequent launches serve from cache without network requests.
FR47: The app checks game data freshness on launch using manifest gameVersion and displays a staleness indicator; users can trigger an update.
FR48: The app checks item data freshness on launch using manifest itemDataVersion and displays a staleness indicator; users can trigger an update.
FR49: The app records iconSource in the manifest (game-files | community-cdn | placeholder).
FR50: The app's data update flow downloads updated files, replaces them atomically, and reloads in the running session without requiring restart.

**Build Persistence & Migration**
FR51: The app migrates all Phase 1 (schema v1) saves to BuildState schema v2 via migrateBuildState on load, losslessly converting free-text affixes to `{ name, tier: undefined, value: undefined }`.
FR52: The app saves all Phase 2 builds in BuildState schema v2 format.
FR53: The app preserves all Phase 1 build management capabilities: save, load, rename, delete (no regression).
FR54: The schema migration is idempotent: loading a v2 build through migrateBuildState produces an identical v2 build.
FR55: The app exposes the current manifest gameVersion and itemDataVersion in the settings panel.

---

### Non-Functional Requirements

NFR1: PixiJS canvas renders at ≥60fps idle and ≥45fps sustained under continuous interaction for any tree view containing up to 200 nodes on benchmark hardware (Intel i5, integrated graphics, 8 GB RAM, 1080p).
NFR2: Icon textures loaded into PixiJS Assets cache complete within 200ms of tree view mount for first load; subsequent loads serve from cache with no measurable delay.
NFR3: Item typeahead search returns ranked results within 50ms of each keystroke for the full 674+ base item + 445+ unique item corpus using local in-memory querying.
NFR4: AI optimization stream begins emitting within the same latency budget as Phase 1 (no regression from structured gear context marshaling).
NFR5: The Anthropic/OpenRouter API key never crosses the Tauri IPC boundary into TypeScript; all API calls remain in Rust commands.
NFR6: Steam directory access is read-only; no write operations are performed to any Steam or game installation directory.
NFR7: Icon files extracted from game directories are cached in the app's sandboxed data directory; no extracted assets transmitted externally.
NFR8: BuildState v1→v2 migration is lossless under all Phase 1 save variants (free-text gear, null gear, partial gear, empty builds).
NFR9: Data update operations are atomic: if a download fails mid-transfer, existing local data files are not corrupted; app retains last valid state.
NFR10: Icon extraction failure degrades silently to CDN fallback; CDN failure degrades to placeholder fill; user never sees an error or is blocked.
NFR11: Item database load failure at startup is recoverable: app displays free-text gear input fallback and continues to function for all other features.
NFR12: All new interactive UI elements have a `2px solid var(--color-accent-gold)` focus ring; `outline: none` is never used without a replacement.
NFR13: Glass Cannon ↔ Juggernaut slider is keyboard-navigable (arrow keys) and has an aria-label describing the current position.
NFR14: Item typeahead dropdown follows ARIA combobox pattern (role="combobox", aria-expanded, aria-activedescendant).
NFR15: Staleness indicator and data update progress regions use aria-live="polite".
NFR16: prefers-reduced-motion gates all animated transitions in new Phase 2 components via the useReducedMotion() hook.
NFR17: All new Phase 2 React components pass vitest-axe checks in CI with zero violations.
NFR18: Schema migration is idempotent: running migrateBuildState on a v2 build returns it unchanged.
NFR19: CDN-fetched icons are cached locally; subsequent app launches serve icons from local cache without network requests.

---

### Additional Requirements (Architecture)

- Brownfield extension: no new top-level Zustand stores permitted; extend useGameDataStore (add itemDatabase, weaverTreeData), useBuildStore (add characterLevel, budgetEnforced, activeSkillLevels, weaverAllocations), useOptimizationStore (add sliderPosition, fineTuneWeights)
- SkillTreeCanvas is props-only: iconTextures passed as `Map<string, Texture>` prop; never load PixiJS.Assets inside SkillTreeCanvas or pixiRenderer.ts
- No barrel files (index.ts) in any src/features/* folder; all imports are direct
- All new Tauri commands: snake_case naming, AppResult<T> return type, registered in lib.rs via invoke_handler!
- All TypeScript IPC calls use invokeCommand<T>(), never raw invoke()
- BuildState migration runs entirely in TypeScript (buildPersistence.ts); Rust stores and retrieves raw JSON without schema awareness
- Atomic data writes in Rust: write to temp file then fs::rename (never direct write to final path)
- Item search is TypeScript-only after initial load; never IPC round-trip (50ms requirement cannot tolerate IPC latency)
- Icon loading: useIconTextures hook called by parent component; Map<skillId, Texture> passed as prop to SkillTreeCanvas
- Weaver Tree tab always present in tab bar; renders WeaverTreePlaceholder when weaverTreeData is null in gameDataStore
- New ErrorType enum values: add ICON_ERROR and ITEM_DATA_ERROR to errorNormalizer.ts
- New feature folders: skill-picker/, icon-pipeline/, item-database/, weaver-tree/, optimization-panel/ (all in src/features/)
- Rust command module files: icon_commands.rs, item_commands.rs (in src-tauri/src/commands/)
- New shared types: itemDatabase.ts, iconPipeline.ts (in src/shared/types/)
- New utility: budgetCalculator.ts (in src/shared/utils/)
- New CSS tokens: 5 tokens added to global stylesheet (see UX-DR10)
- Icon pipeline initialization sequence: initialize_icon_pipeline Rust command called at startup alongside game data load; emits icon-pipeline:initialized Tauri event; useIconTextures subscribes before loading any textures

---

### UX Design Requirements

UX-DR1: SkillPickerGrid component — hexagonal CSS clip-path cells matching PixiJS node shape; sections organized as "{BaseClass} Skills" then "{Mastery} Skills" (×3 masteries); mastery-gate badge overlays showing required points (5/10/15/20/25/35) on bottom edge of icon; skill states: available, locked-mastery, locked-level, selected (gold border); role="grid" with gridcell cells; aria-label per cell; keyboard arrow navigation within grid; Enter to select; ESC to close.
UX-DR2: OptimizationSlider component — gradient track from --color-slider-juggernaut (left) to --color-slider-glass-cannon (right) using CSS linear-gradient on `appearance: none` range input; labeled endpoints ("Juggernaut" left, "Glass Cannon" right) in 11px uppercase; thumb tooltip showing current weight split (e.g., "Survivability 70% / Damage 30%"); keyboard arrows move in 5% steps; role="slider" with aria-valuemin="0", aria-valuemax="100", aria-valuenow, aria-valuetext; master slider remains visible but visually secondary when Fine Tune is expanded.
UX-DR3: FineTunePanel component — Headless UI Disclosure wrapping three `range` inputs (Damage Weight, Survivability Weight, Speed Weight, each 0–100); chevron rotates on open; "(Custom)" text appears in Disclosure trigger label when sub-sliders have been manually adjusted to differ from master slider derivation; ARIA: aria-expanded on trigger, aria-controls pointing to sub-slider container; each sub-slider has role="slider" + aria-label.
UX-DR4: GearSlot component — four states: empty (typeahead Combobox visible), populated-database (item card + affix list), populated-freetext (textarea), expanded (one affix's tier sliders shown inline); Headless UI Combobox for typeahead with role="combobox", aria-expanded, aria-activedescendant; slot icon (16px) at left; × button to clear item; "Free text mode" ghost link when slot is empty; role="group" with aria-label="{slotName} slot".
UX-DR5: AffixTierControl component — 7 tier pips (8px × 8px circles, 4px gap); click pip to set tier; keyboard Left/Right arrow to decrement/increment when focused; filled pips use --color-tier-pip-active; unfilled pips use --color-tier-pip-inactive; current value displayed in monospace 40px fixed-width at right; container has role="slider", aria-valuemin="1", aria-valuemax="{tierCount}", aria-valuenow, aria-label="{affixName} tier", aria-valuetext="Tier {N}: {value range}".
UX-DR6: StalenessBar component extended — supports two simultaneous staleness banners stacked (game data + item data separate entries); each banner: role="status", aria-live="polite"; Update button shows spinner + aria-busy="true" during update; transitions to "Updated ✓" for 2s on success then disappears; "Dismiss" ghost link hides banner for session.
UX-DR7: UnspentCounter component — aria-live="polite", aria-label="Unspent {treeType} points: {count}"; color --color-accent-gold when count > 0; color --color-text-secondary when count = 0; shows "Budget off" label in muted text when budgetEnforced is false (number shows theoretical allocation).
UX-DR8: BudgetToggle component — Headless UI Switch for "Enforce Level Budget" label; adjacent character level numeric input (1–100) on same row; Switch provides full ARIA switch pattern; gold active state; muted inactive state.
UX-DR9: Right panel layout — split into two independently scrollable regions: Gear Context (upper, ~55% of panel height) and Optimization (lower, ~45%, pinned to bottom with `position: sticky` or flex layout — never scrolls off screen); Optimize button always visible without scrolling.
UX-DR10: Five new CSS tokens added to global stylesheet with co-located PixiJS hex equivalents as comments: --color-slider-glass-cannon (high-saturation crimson-red), --color-slider-juggernaut (deep steel-blue), --color-tier-pip-active (matches --color-accent-gold), --color-tier-pip-inactive (matches --color-bg-elevated with border), --color-badge-mastery-gate (dark overlay with muted gold border).
UX-DR11: Search bar per tree — positioned at top-right of canvas area; 200px wide, 28px height; synchronous gold outline on matching nodes; 40% opacity on non-matching nodes; no debounce (filter is synchronous on loaded treeData prop); × clear button appears when input is non-empty; ESC also clears.
UX-DR12: Node prerequisite validation visual feedback — target node briefly flashes (--color-node-locked fill + CSS scale 1.05→1.0, 150ms transition); skip animation if useReducedMotion() returns true; no toast or error dialog; tooltip on hover explains the requirement.
UX-DR13: Icon loading visual progression — nodes render immediately with --color-node-available placeholder fill; transition to actual icon texture within 200ms; 50ms stagger per node (skip stagger if reducedMotion); no loading skeleton or spinner over the canvas.
UX-DR14: Weaver Tree tab — always present as the rightmost tab in the center panel tab bar regardless of research spike outcome; renders WeaverTreePlaceholder component ("Weaver Tree planning is in research. Data sourcing is in progress.") when weaverTreeData is null in gameDataStore; no crash, no error toast.
UX-DR15: vitest-axe accessibility CI — all Phase 2 React components (SkillPickerGrid, OptimizationSlider, FineTunePanel, GearSlot, AffixTierControl, StalenessBar, UnspentCounter, BudgetToggle, WeaverTreePlaceholder) have accompanying test files that call axe() and assert zero violations; integrated into existing CI pipeline.

---

### FR Coverage Map

FR1: Epic 1 — Icon-accurate PixiJS nodes for all 133 active skills (requires Epic 2 for icons, stub with placeholder fill in Epic 1)
FR2: Epic 1 — Passive tree with hexagonal nodes in horizontal-row layout
FR3: Epic 4 — Weaver Tree rendering (research-gated)
FR4: Epic 1 — Node connectivity edges in all tree views
FR5: Epic 1 — Mastery point threshold badge overlays in skill picker and passive tree
FR6: Epic 1 — Node visual states (locked/available/allocated/suggested)
FR7: Epic 1 — Search bar with gold highlight and dim for non-matching nodes
FR8: Epic 1 — RESET button clears all allocations in active tree
FR9: Epic 3 — Unspent points counter above each tree
FR10: Epic 1 — Active skill header shows name, level, unlock condition
FR11: Epic 1 — Skill picker per active slot filtered by class/mastery
FR12: Epic 1 — Select skill from picker to load tree under tab
FR13: Epic 1 — Left-click increments node allocation by 1
FR14: Epic 1 — Right-click decrements node allocation by 1
FR15: Epic 1 — current/max counter rendered in each node
FR16: Epic 1 — Prerequisite validation prevents invalid increment
FR17: Epic 1 — Prerequisite validation prevents invalid decrement
FR18: Epic 3 — Character level input drives passive point budget calculation
FR19: Epic 3 — Active skill level input drives per-skill tree budget
FR20: Epic 3 — Enforce Level Budget toggle (default OFF)
FR21: Epic 3 — Free theory-craft mode when toggle is OFF
FR22: Epic 3 — Unspent counter updates immediately after every action
FR23: Epic 5 — Local item database loaded from bundled JSON files
FR24: Epic 5 — Typeahead fuzzy search per gear slot
FR25: Epic 5 — Item selection pre-populates affixes at median tier
FR26: Epic 5 — Per-affix tier slider (T1 through max tier)
FR27: Epic 5 — Custom affix addition via "+" and searchable affix picker
FR28: Epic 5 — Set value/tier for custom affixes
FR29: Epic 5 — Clear gear slot to empty or free-text
FR30: Epic 5 — Free-text fallback for gear input
FR31: Epic 7 — Structured gear context (slot/item/affix/tier/value) sent to AI
FR32: Epic 7 — Free-text gear context sent to AI (no regression)
FR33: Epic 5 — Item database freshness check on launch; staleness indicator; update trigger
FR34: Epic 7 — Glass Cannon ↔ Juggernaut master slider (0–100)
FR35: Epic 7 — Fine Tune panel with Damage/Survivability/Speed sub-sliders
FR36: Epic 7 — Phase 1 preset positions mapped to slider spectrum
FR37: Epic 7 — Level-budget-aware AI context when enforcement is ON
FR38: Epic 7 — No budget constraints in AI request when enforcement is OFF
FR39: Epic 7 — Streaming AI output no regression from Phase 1
FR40: Epic 7 — Before/after scoring no regression from Phase 1
FR41: Epic 7 — Structured gear context enables affix-level AI reasoning
FR42: Epic 7 — Clear suggestions and re-run optimization
FR43: Epic 2 — Steam install path auto-detection on first launch
FR44: Epic 2 — Skill icon extraction from game files to icon cache
FR45: Epic 2 — CDN icon fallback when game files unavailable
FR46: Epic 2 — CDN icons cached locally for subsequent launches
FR47: Epic 6 — Game data freshness check on launch using manifest gameVersion
FR48: Epic 6 — Item data freshness check on launch using manifest itemDataVersion
FR49: Epic 2 — iconSource recorded in manifest (game-files | community-cdn | placeholder)
FR50: Epic 6 — Atomic data update (download → atomic replace → session reload, no restart)
FR51: Epic 6 — migrateBuildState losslessly converts Phase 1 v1 saves to v2 schema
FR52: Epic 6 — Phase 2 builds saved in BuildState schema v2 format
FR53: Epic 6 — Phase 1 build management (save/load/rename/delete) no regression
FR54: Epic 6 — Migration is idempotent: v2 builds pass through migrateBuildState unchanged
FR55: Epic 6 — Settings panel shows current gameVersion and itemDataVersion

---

## Epic List

### Epic 1: Skill Picker & Multi-Point Node Allocation
Players can interactively allocate multiple points to skill tree nodes using left-click (increment) and right-click (decrement), with prerequisite validation and `current/max` counters. A class/mastery-filtered skill picker grid lets players assign skills to active slot tabs, loading that skill's full tree. Search and RESET are available on all trees.
**FRs covered:** FR1, FR2, FR4, FR5, FR6, FR7, FR8, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17
**UX-DRs covered:** UX-DR1, UX-DR11, UX-DR12

### Epic 2: Icon-Accurate Skill Tree Rendering
Players see actual Last Epoch game icons inside all hexagonal skill tree nodes. The app silently auto-detects the Steam installation and extracts icons; CDN fallback ensures icons always appear even without the game installed. All icons are cached locally for offline use.
**FRs covered:** FR43, FR44, FR45, FR46, FR49
**UX-DRs covered:** UX-DR13

### Epic 3: Character Level & Point Budget System
Players can input their character level and per-skill active levels to track passive and skill-tree point budgets. An "Enforce Level Budget" toggle (default OFF) prevents over-allocation. The unspent points counter updates in real time after every node change.
**FRs covered:** FR9, FR18, FR19, FR20, FR21, FR22
**UX-DRs covered:** UX-DR7, UX-DR8

### Epic 4: Weaver Tree (Research-Gated)
The Weaver Tree tab is always present in the UI. A research spike validates data availability and layout format. If the spike succeeds, the Weaver Tree renders in a web/radial PixiJS layout with its own point pool. If the spike fails, a clear placeholder is shown and no other features are blocked.
**FRs covered:** FR3
**UX-DRs covered:** UX-DR14

### Epic 5: Item Database & Structured Gear Input
Players can search the full Last Epoch item database (≥674 base items, ≥445 uniques, ≥1,112 affixes) via typeahead per gear slot. Selecting an item pre-populates known affixes at median tier; per-affix tier sliders let players dial in their actual rolls. Custom affixes can be added from the full affix database. Free-text fallback is always available. Database freshness is checked on launch.
**FRs covered:** FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30, FR33
**UX-DRs covered:** UX-DR4, UX-DR5, UX-DR6 (partial — item data banner), UX-DR9, UX-DR10 (tier pip tokens)

### Epic 6: BuildState Schema v2, Migration & Data Pipeline
All Phase 1 saves migrate losslessly to BuildState schema v2 on load. Phase 2 builds save in v2 format with structured gear. The optimization preset field migrates to slider position. Manifest v2 tracks itemDataVersion and iconCacheVersion; data updates are atomic. The settings panel exposes version information.
**FRs covered:** FR47, FR48, FR50, FR51, FR52, FR53, FR54, FR55
**UX-DRs covered:** UX-DR6 (complete — both staleness banners)

### Epic 7: Advanced Optimization UX — Archetype Slider
The 4-button optimization preset is replaced by a continuous Glass Cannon ↔ Juggernaut master slider. A Fine Tune panel expands three independent sub-sliders. When "Enforce Level Budget" is ON, the AI receives character level and point budgets as hard constraints. Structured gear context from the item database flows into the AI prompt for affix-level reasoning. Phase 1 streaming and before/after scoring are preserved.
**FRs covered:** FR31, FR32, FR34, FR35, FR36, FR37, FR38, FR39, FR40, FR41, FR42
**UX-DRs covered:** UX-DR2, UX-DR3, UX-DR10 (slider gradient tokens)

---

## Epic 1: Skill Picker & Multi-Point Node Allocation

Players gain full interactive control over skill tree node allocation. Using PoB-style left-click/right-click, they can increment or decrement multi-point nodes with prerequisite validation enforced at every step. A class/mastery-filtered skill picker grid lets them assign any available skill to an active slot tab, loading that skill's full interactive tree. Search highlights matching nodes; RESET clears all allocations.

---

### Story 1.1: Upgrade nodeAllocations to Record<string, number> and Implement Multi-Point Click Allocation

As a theory-crafter,
I want to left-click a skill node to add a point and right-click to remove a point, seeing a `current/max` counter in each node,
So that I can allocate skill tree points with familiar PoB-style interactions.

**Acceptance Criteria:**

**Given** SkillTreeCanvas currently receives `allocatedNodes: Set<string>`
**When** the prop type is changed to `nodeAllocations: Record<string, number>` throughout SkillTreeCanvas.tsx, pixiRenderer.ts, and useBuildStore
**Then** all existing allocation rendering still works and no TypeScript errors remain

**Given** a skill tree is displayed and a node has maxPoints > 1
**When** the player left-clicks the node
**Then** the node's allocation increments by 1 (up to maxPoints), the `current/max` counter inside the node updates immediately, and `onNodeClick(nodeId, 0)` is emitted

**Given** a node with allocation > 0
**When** the player right-clicks the node
**Then** the allocation decrements by 1 (down to 0), the counter updates, and `onNodeClick(nodeId, 2)` is emitted

**Given** a node at its maxPoints
**When** the player left-clicks it
**Then** the allocation does not increase beyond maxPoints and no state change is emitted

**Given** a node at allocation 0
**When** the player right-clicks it
**Then** the allocation does not go below 0 and no state change is emitted

**Given** the SkillTreeCanvas `onNodeClick` handler receives `(nodeId: string, button: 0 | 2)`
**When** `applyNodeChange(nodeId, delta, treeData)` is called in useBuildStore with delta +1 or -1
**Then** the nodeAllocations Record updates correctly and the component re-renders with the new counter value

**And** the `current/max` counter is rendered inside the hexagonal node in PixiJS using monospace font at 10px/700 weight, visible only when allocation > 0

---

### Story 1.2: Prerequisite Validation with Visual Flash Feedback

As a theory-crafter,
I want the app to prevent me from allocating a node whose prerequisites are unmet and from removing a node that other allocated nodes depend on, with clear visual feedback explaining the block,
So that I build only valid skill tree configurations without needing to memorize prerequisite rules.

**Acceptance Criteria:**

**Given** a node whose prerequisite node has 0 allocation
**When** the player left-clicks the locked node
**Then** `applyNodeChange` returns false, no allocation change occurs, the node briefly flashes with `--color-node-locked` fill and CSS scale 1.05→1.0 over 150ms, and the flash animation is skipped if `reducedMotion` is true

**Given** a node with allocation > 0 that is a prerequisite for another allocated node
**When** the player right-clicks to decrement
**Then** `applyNodeChange` returns false, no decrement occurs, and the dependent nodes flash briefly to show why the action was blocked

**Given** a node that IS allocatable (prerequisites met, allocation < maxPoints)
**When** the player left-clicks it
**Then** no flash occurs; allocation increments normally

**Given** `treeData` contains edge definitions (fromId → toId representing prerequisite → dependent)
**When** `applyNodeChange(nodeId, +1, treeData)` is called
**Then** the function checks that all prerequisite nodes have sufficient allocation before allowing increment

**Given** `applyNodeChange(nodeId, -1, treeData)` is called
**When** decrementing would cause a dependent's prerequisites to be unmet
**Then** the function blocks the decrement and returns false

**And** a tooltip on hover of any locked node shows the prerequisite requirement text sourced from node data (e.g., "Requires: Void Shield at 2+")

**And** no toast notification is shown for blocked allocation actions — the visual flash and tooltip are the sole feedback mechanisms

---

### Story 1.3: Skill Picker Grid Component

As a theory-crafter,
I want to open a skill picker showing all skills available for my class and mastery, organized by base class and mastery sections with point-gate badge overlays,
So that I can quickly find and assign any skill to an active slot tab.

**Acceptance Criteria:**

**Given** the player clicks an active skill tab that has no skill assigned
**When** the SkillPickerGrid opens in the center panel
**Then** skills are organized into sections: "{BaseClassName} Skills" (no mastery gate) followed by "{MasteryName} Skills" (×3 masteries with gate badges)

**Given** a mastery-gated skill with a 15-point threshold
**When** the skill is displayed in the picker grid
**Then** a badge overlay shows "15" in `--color-badge-mastery-gate` styling positioned at the bottom edge of the hexagonal icon

**Given** the player's class and mastery are set
**When** the skill picker opens
**Then** only skills matching the selected class/mastery are shown; skills for other masteries are excluded

**Given** the SkillPickerGrid component
**When** rendered
**Then** it has role="grid" on the container; each skill cell has role="gridcell" with `aria-label="{skillName} ({masteryName} skill, requires {N} points)"` or just `aria-label="{skillName} (base class skill)"`

**Given** a skill in the picker in "selected" state (currently loaded in this tab)
**When** it is displayed
**Then** it has a subtle 1px gold border distinguishing it from available skills

**Given** the player presses Escape while the skill picker is open
**When** no skill is selected
**Then** the picker closes and the previous tree view is restored

**And** the hexagonal clip-path CSS (`clip-path: polygon(...)`) used on picker cells visually matches the PixiJS canvas node shape, defined as the CSS custom property `--hex-clip-path`

**And** the --color-badge-mastery-gate token is added to the global stylesheet with its PixiJS hex equivalent as a comment (UX-DR10 partial)

**And** the SkillPickerGrid component passes vitest-axe with zero violations (UX-DR15)

**And** each skill picker cell renders its game icon via `<img src={localCachePath}>` (using `invokeCommand('get_icon_cache_path', { skillId })`) when the icon pipeline has initialized and the returned path is non-null; when the path is null or the pipeline has not yet completed, the cell renders a placeholder hex div using `--color-node-available` fill — per Architecture Decision 8

---

### Story 1.4: Active Skill Tab → Skill Picker Integration

As a theory-crafter,
I want to select a skill from the picker and have it load that skill's full interactive tree under the active tab,
So that I can plan all 5 active skill slots with their complete trees visible.

**Acceptance Criteria:**

**Given** the skill picker is open for an active skill tab
**When** the player clicks a skill (or presses Enter on a focused skill cell)
**Then** the picker closes, the tab shows the selected skill's icon + name, and the skill's full treeData loads into the center canvas

**Given** the active skill tab now has a skill assigned
**When** the player clicks the tab again
**Then** the skill picker re-opens as a popover/flyout anchored to the tab (not a full center-panel replacement)

**Given** five active skill slot tabs are present
**When** each tab has a different skill assigned
**Then** switching between tabs renders each skill's tree independently without losing any tab's allocation state

**Given** the treeData for a skill is loaded into SkillTreeCanvas
**When** the player allocates nodes in that tree
**Then** the allocations are stored keyed to `{tabId}:{nodeId}` so tab switching preserves all node states

**And** FR10 is satisfied: the active skill's name, level, and unlock condition appear in the tree header area above the canvas; other active skill slot indicators (icons or empty hexagons) are visible in the header row

---

### Story 1.5: Tree Search Bar and RESET Button

As a theory-crafter,
I want a search bar that highlights matching nodes and a RESET button that clears all allocations in the active tree,
So that I can quickly navigate large trees and undo all allocation choices at once.

**Acceptance Criteria:**

**Given** a skill or passive tree is displayed in the canvas
**When** the player types text in the search bar (positioned top-right, 200px wide, 28px height)
**Then** matching nodes are immediately highlighted with a gold outline; non-matching nodes render at 40% opacity; the filtering is synchronous with no debounce

**Given** the search bar has text and the player clicks the × button or presses Escape
**When** the input is cleared
**Then** all nodes return to their normal visual state immediately

**Given** the player clicks the RESET button (top-left of canvas area, same row as search and unspent counter)
**When** the active tree has any node allocations
**Then** all nodeAllocations for the active tree are cleared to 0, the change is pushed to the undo stack (MAX_UNDO_STACK = 10), and the unspent counter reflects the full budget

**Given** the player presses Ctrl+Z after a RESET
**When** the undo stack has the pre-RESET state
**Then** all allocations are restored to their prior state

**And** the RESET button is styled as a secondary outlined button (1px --color-accent-gold-soft border) at 28px height; no confirmation dialog is shown

**And** the search bar and RESET button apply to all tree views: passive trees, active skill trees, and the Weaver Tree tab

---

## Epic 2: Icon-Accurate Skill Tree Rendering

Players see actual Last Epoch game icons in all PixiJS skill tree nodes. A three-path icon pipeline runs at startup: Steam installation auto-detection → icon extraction from game files; if that fails, CDN fallback fetches and caches icons; if that fails, placeholder fill colors are used. Players are never blocked or shown an error regardless of which path is taken.

---

### Story 2.1: Icon Pipeline Research Spike

As a developer,
I want to confirm the exact file path and format of skill icons within the Last Epoch Unity installation, and validate whether a Rust crate can extract them, before committing to any implementation,
So that the icon pipeline implementation is built on confirmed facts rather than assumptions.

**Acceptance Criteria:**

**Given** a Windows machine with Last Epoch installed via Steam
**When** the spike researcher inspects the Steam installation directory
**Then** the spike report documents: (1) the exact folder path and file names where skill icons reside, (2) the Unity asset bundle format used, (3) whether a Rust crate (unity-pak or similar) can extract PNGs without a C# interop layer, (4) the confirmed CDN URL pattern for lastepochtools.com / tunklab.com skill icons (e.g., `https://assets.lastepochtools.com/skills/{skill_id}.png`)

**Given** the spike findings
**When** the spike report is written to `docs/icon-pipeline-spike.md`
**Then** the report states a clear GO/NO-GO recommendation for game file extraction and documents the confirmed CDN URL pattern that will be used regardless of GO/NO-GO

**And** the spike does NOT produce any production code — only the findings document

**And** if the spike result is NO-GO for game file extraction, Story 2.2 implements CDN-only path; if GO, Story 2.2 implements both paths

---

### Story 2.2: Rust Icon Pipeline Commands

As a theory-crafter,
I want the app to silently detect my Steam installation and extract skill icons on first launch (or fetch them from CDN), caching them locally so they're available instantly on future launches,
So that game-accurate icons appear without any setup on my part.

**Acceptance Criteria:**

**Given** the spike confirmed CDN URL pattern (from Story 2.1)
**When** `initialize_icon_pipeline()` Rust command is called at app startup
**Then** it executes the three-path fallback: (A) detect_steam_path → extract_skill_icons, (B) fetch_cdn_icon for each skill, (C) placeholder — and records `iconSource: "game-files" | "community-cdn" | "placeholder"` in the manifest

**Given** `detect_steam_path()` is called
**When** the Steam installation is at the default path (Windows: `C:\Program Files (x86)\Steam\steamapps\common\Last Epoch`)
**Then** the command returns `Ok(Some(path))` and logs the detection silently; if not found, returns `Ok(None)` without error

**Given** Steam path detection fails (path not found, game not installed)
**When** `initialize_icon_pipeline` proceeds
**Then** it moves immediately to CDN fetch; no error is surfaced to the user

**Given** icon extraction from game files fails for any reason
**When** `initialize_icon_pipeline` handles the error
**Then** it logs the error internally (debug mode only), falls back to CDN fetch, and continues without surfacing any notification

**Given** CDN fetch completes successfully
**When** icons are written to `{app_data}/lebo/icons/skills/{skill_id}.png`
**Then** all writes use the atomic temp-file-then-rename pattern; a partially downloaded icon never corrupts an existing cached icon

**Given** CDN fetch also fails
**When** `initialize_icon_pipeline` reaches path C
**Then** it emits `icon-pipeline:initialized` with `iconSource: "placeholder"` and no user notification is shown

**And** `get_icon_cache_path(skillId)` returns the local file path if cached, or None if not cached
**And** all new commands follow `AppResult<T>` return type and are registered in `lib.rs`
**And** error strings are prefixed with `"ICON_ERROR: "` and `ICON_ERROR` is added to the ErrorType enum in errorNormalizer.ts

---

### Story 2.3: TypeScript Icon Texture Loading (useIconTextures Hook)

As a developer,
I want a `useIconTextures` hook that loads skill icons from the local cache into PixiJS Assets and returns a `Map<skillId, Texture>`, passed as a prop to SkillTreeCanvas,
So that the props-only canvas contract is maintained while icons render in nodes.

**Acceptance Criteria:**

**Given** the `icon-pipeline:initialized` Tauri event has been emitted
**When** `useIconTextures(skillIds: string[])` is called by the parent component of SkillTreeCanvas
**Then** it calls `invokeCommand<string | null>('get_icon_cache_path', { skillId })` for each skill ID, batches the non-null paths into `PixiJS.Assets.load()` calls, and returns a `Map<skillId, Texture>` that fills progressively as textures resolve

**Given** some icon cache paths return null (no cached icon)
**When** `useIconTextures` processes those IDs
**Then** those IDs are omitted from the returned Map; missing entries in the Map trigger placeholder fill in the renderer (no crash)

**Given** the parent component has the resolved `iconTextures: Map<string, Texture>`
**When** it renders `<SkillTreeCanvas iconTextures={iconTextures} ... />`
**Then** SkillTreeCanvas accepts `iconTextures` as a prop and passes individual textures to each node draw function in pixiRenderer.ts — `PixiJS.Assets.load()` is never called inside SkillTreeCanvas or pixiRenderer.ts

**And** the hook lives in `src/features/icon-pipeline/useIconTextures.ts` with no barrel file export

**And** icon texture loading begins only after `icon-pipeline:initialized` is received, preventing premature load attempts before the pipeline has run

---

### Story 2.4: PixiJS Icon Rendering with Placeholder Fallback

As a theory-crafter,
I want skill tree nodes to display the actual game icon inside the hexagonal shape, falling back to a colored placeholder fill if the icon is unavailable,
So that the tree is always interactive and the visual upgrade is immediate when icons are loaded.

**Acceptance Criteria:**

**Given** a node's skillId has a resolved Texture in the `iconTextures` Map
**When** the node is drawn in pixiRenderer.ts
**Then** the texture is rendered as a Sprite centered in the hexagonal node area, clipped to hex bounds; the node's existing state color (allocated, available, locked) is still rendered as the node background behind the icon

**Given** a node's skillId has no entry in the `iconTextures` Map (texture not yet loaded or pipeline returned placeholder)
**When** the node is drawn
**Then** the node renders with the existing placeholder fill color (`--color-node-available` hex equivalent) and no icon; the node is still fully interactive

**Given** textures resolve progressively (Map fills as Assets.load() completes)
**When** new textures become available
**Then** the canvas re-renders affected nodes with icons within 50ms stagger (UX-DR13); reducedMotion skips stagger and renders all icons immediately

**Given** the full tree view is mounted with icons pre-cached
**When** measured from tree view mount to all icons rendered
**Then** the first-load time is within 200ms (NFR2)

**And** icon rendering inside nodes does not cause any regression in canvas FPS; the ≥60fps idle / ≥45fps sustained benchmark is maintained (NFR1)

**And** `iconSource` from the manifest is exposed in the app settings panel as a read-only label (e.g., "Icon source: game files" / "community CDN" / "placeholder")

---

## Epic 3: Character Level & Point Budget System

Players can input their character level and per-skill active levels to drive automatic passive and skill tree point budget calculations. An "Enforce Level Budget" toggle (default OFF) constrains node allocation to the calculated budget. The unspent points counter updates in real time after every allocation action.

---

### Story 3.1: Character Level Input and Passive Point Budget Calculation

As a theory-crafter,
I want to enter my character level and see the total available passive points calculated automatically, with an unspent points counter that reflects how many points I have left to allocate,
So that I can plan builds within my actual character's limitations.

**Acceptance Criteria:**

**Given** a new character level field (1–100 numeric input) in the build panel
**When** the player enters their character level
**Then** `calculatePassivePoints(level)` in budgetCalculator.ts computes the available passive points using the Last Epoch formula (confirmed during implementation against community data; approximation: `level + 20`) and stores the result in useBuildStore as a derived value

**Given** the character level is set and some passive nodes are allocated
**When** the UnspentCounter component is rendered above the passive tree
**Then** it shows `availablePassivePoints - allocatedPassivePoints` in gold (--color-accent-gold) if > 0, or in --color-text-secondary if = 0; the aria-live="polite" attribute ensures screen reader announcement on change

**Given** the character level input field
**When** rendered
**Then** it appears on the same row as the BudgetToggle switch; the character level label reads "Level" and the field accepts integers 1–100

**And** characterLevel is stored in useBuildStore; it persists with build saves in BuildState v2

**And** the budgetCalculator.ts utility is at `src/shared/utils/budgetCalculator.ts` with no barrel file; it exports `calculatePassivePoints(level: number): number`

---

### Story 3.2: Active Skill Level Input and Per-Skill Tree Budget

As a theory-crafter,
I want to enter my active skill's level per slot and see the skill tree's point budget update accordingly, with an accurate unspent counter for each skill tab,
So that my skill tree planning reflects the actual number of points I have in that skill.

**Acceptance Criteria:**

**Given** each active skill tab has an adjacent skill level input (1–20 numeric field)
**When** the player changes a skill's level
**Then** `calculateSkillPoints(level)` in budgetCalculator.ts computes the max allocatable points for that skill tree (formula confirmed at implementation; approximation: 1 point per level); the result is stored in `activeSkillLevels[slotId]` in useBuildStore

**Given** a skill tab is active and has a skill assigned
**When** the UnspentCounter is rendered above that skill's tree
**Then** it shows `calculateSkillPoints(activeSkillLevels[slotId]) - allocatedSkillPoints[slotId]` with the same gold/muted color behavior as the passive counter

**Given** the skill level input is 20 (maximum)
**When** the counter is shown
**Then** the maximum skill tree budget is reflected correctly

**And** `calculateSkillPoints` is exported from budgetCalculator.ts alongside `calculatePassivePoints`

**And** activeSkillLevels is stored in useBuildStore and persists with build saves

---

### Story 3.3: Enforce Level Budget Toggle and Allocation Enforcement

As a theory-crafter,
I want to toggle "Enforce Level Budget" ON to prevent me from allocating more points than my character actually has, and OFF to freely theory-craft without constraints,
So that I can switch between realistic build planning and unconstrained exploration.

**Acceptance Criteria:**

**Given** the BudgetToggle (Headless UI Switch) is set to OFF (default)
**When** the player allocates passive or skill tree nodes
**Then** there is no budget ceiling; `applyNodeChange` allows allocation regardless of the unspent counter value; FR21 is satisfied

**Given** the BudgetToggle is switched ON
**When** the player attempts to left-click a node when `unspentPassivePoints <= 0`
**Then** `applyNodeChange` blocks the allocation and returns false; no error toast; the counter shows "0 points remaining" as the signal

**Given** the BudgetToggle is ON and the player has 0 unspent skill points for an active skill slot
**When** they try to allocate another node in that skill's tree
**Then** the allocation is blocked; the unspent counter shows "0 points remaining"

**Given** the budget enforcement is ON
**When** the UnspentCounter is in "zero" state
**Then** it displays in --color-text-secondary (not gold) to signal that budget is exhausted; no other UI changes occur (no lock overlay on the canvas)

**Given** the BudgetToggle is OFF
**When** the UnspentCounter is shown
**Then** it displays the number alongside "(Budget off)" label in --color-text-muted so players know enforcement is inactive

**And** the BudgetToggle component is at `src/features/skill-tree/BudgetToggle.tsx` and passes vitest-axe with zero violations (UX-DR15)

**And** the UnspentCounter component is at `src/features/skill-tree/UnspentCounter.tsx` and passes vitest-axe (UX-DR15)

---

## Epic 4: Weaver Tree (Research-Gated)

The Weaver Tree tab is always present in the UI. A research spike determines whether machine-readable Weaver Tree node data is available from community sources. The Weaver Tree is then rendered using the existing SkillTreeCanvas infrastructure with a new radial layout algorithm — or a clear placeholder is shown if the spike fails. No other epic is blocked by the spike outcome.

---

### Story 4.1: Weaver Tree Research Spike

As a developer,
I want to investigate community data sources for Weaver Tree node layout and point pool mechanics before committing to implementation,
So that the Weaver Tree epic has confirmed data before any rendering code is written.

**Acceptance Criteria:**

**Given** the research targets: tunklab.com, lastepochtools.com, and any known community Last Epoch data repositories
**When** the spike researcher investigates
**Then** the spike report (`docs/weaver-tree-spike.md`) documents: (1) whether machine-readable Weaver Tree node data (node IDs, positions/coordinates, edges, point costs) exists, (2) the format of node coordinates and whether they are compatible with the existing PixiJS layout system, (3) the Weaver Tree's point pool mechanics (how many points per level, separate pool from passive points?), (4) a GO/NO-GO recommendation

**Given** the spike report is complete
**When** the team reviews it
**Then** Story 4.3 is either implemented (GO) or permanently deferred to a future patch (NO-GO) with no impact on Epics 1–3 or 5–7

**And** the spike produces no production code — only the findings document

---

### Story 4.2: Weaver Tree Tab and Placeholder Component

As a theory-crafter,
I want the Weaver Tree tab to always be visible in the skill tree tab bar, showing a clear placeholder message if the tree data is not yet available,
So that the UI layout is consistent and I understand the feature's status.

**Acceptance Criteria:**

**Given** the center panel tab bar renders tabs
**When** the tab bar is displayed
**Then** a "Weaver Tree" tab appears as the rightmost tab regardless of whether Weaver Tree data is available; its presence does not depend on the research spike outcome

**Given** `useGameDataStore.weaverTreeData` is null (spike failed or not yet implemented)
**When** the player clicks the Weaver Tree tab
**Then** the center panel renders `WeaverTreePlaceholder` with the text "Weaver Tree planning is in research. Data sourcing is in progress." in --color-text-secondary; no error, no crash, no loading spinner

**Given** `useGameDataStore.weaverTreeData` is non-null (spike succeeded and data is loaded)
**When** the player clicks the Weaver Tree tab
**Then** the placeholder is replaced by the SkillTreeCanvas rendering the Weaver Tree (Story 4.3)

**And** WeaverTreePlaceholder is at `src/features/weaver-tree/WeaverTreePlaceholder.tsx` with no barrel file

**And** WeaverTreePlaceholder passes vitest-axe with zero violations (UX-DR15)

---

### Story 4.3: Weaver Tree Renderer (Conditional on Research Spike GO)

As a theory-crafter,
I want to view the Weaver Tree in a web/radial PixiJS layout, allocate points from the Weaver point pool, use search to highlight nodes, and RESET my Weaver allocations,
So that I can plan my Weaver Tree investments alongside my class skill trees.

**Acceptance Criteria:**

**Given** the research spike confirmed GO and Weaver Tree data is available
**When** Weaver Tree data is loaded into `useGameDataStore.weaverTreeData: TreeData`
**Then** `weaverTreeData` is non-null and the WeaverTreePlaceholder is no longer rendered in its place

**Given** the player opens the Weaver Tree tab
**When** the Weaver Tree renders
**Then** it uses `<SkillTreeCanvas treeLayout="weaver" ... />` with the existing component; a new `weaverLayout()` function in pixiRenderer.ts implements the web/radial layout algorithm matching Image 4 in the project-intent document

**Given** the Weaver Tree has its own point pool (separate from passive points)
**When** the player allocates Weaver nodes
**Then** allocations are stored in `useBuildStore.weaverAllocations: Record<string, number>`; the UnspentCounter above the Weaver Tree shows Weaver-specific unspent points

**Given** nodes that are unreachable (prerequisites not met)
**When** they are displayed
**Then** they show a lock icon; hovering the node shows a tooltip explaining the requirement

**Given** the Budget toggle is ON
**When** the Weaver Tree unspent counter reaches 0
**Then** further Weaver node allocation is blocked (same enforcement logic as passive/skill trees)

**And** the existing search bar (Story 1.5) and RESET button work on the Weaver Tree the same way as on passive and active skill trees

**And** weaverLayout.ts is at `src/features/weaver-tree/weaverLayout.ts` with no barrel file

---

## Epic 5: Item Database & Structured Gear Input

Players can search the full Last Epoch item database via typeahead per gear slot. Selecting an item pre-populates known affixes at median tier; per-affix tier sliders let players match their actual rolls. Custom affixes can be added from the complete affix database. Free-text fallback is always accessible. The right panel splits into a scrollable Gear Context section and a pinned Optimization section. Item database freshness is checked on launch.

---

### Story 5.1: Item Database Load and TypeScript Types

As a developer,
I want the item database (base items, uniques, affixes) to load from bundled JSON files at app startup and be accessible in the TypeScript layer via gameDataStore,
So that all gear input features in this epic have a populated item database to query against.

**Acceptance Criteria:**

**Given** `base-items.json`, `uniques.json`, and `affixes.json` are bundled in `src-tauri/resources/items/`
**When** the app starts
**Then** the Rust command `load_item_database()` reads all three files, deserializes them via serde, and returns an `ItemDatabase` struct; the TypeScript side calls `invokeCommand<ItemDatabase>('load_item_database')` and stores the result in `useGameDataStore.itemDatabase`

**Given** `load_item_database()` succeeds
**When** the corpus sizes are checked
**Then** itemDatabase contains ≥674 base items, ≥445 unique items, and ≥1,112 affixes

**Given** `load_item_database()` fails (file missing or corrupt)
**When** the error is caught in TypeScript
**Then** `useGameDataStore.itemDatabase` is set to null; no error toast is shown; all GearSlot components detect null and render in free-text mode with a "Database unavailable" muted label (NFR11)

**And** TypeScript types `ItemDatabase`, `BaseItem`, `UniqueItem`, `AffixEntry` are defined in `src/shared/types/itemDatabase.ts` with no barrel file

**And** `load_item_database` is registered in `lib.rs` with `AppResult<ItemDatabase>` return; error strings prefixed `"ITEM_DATA_ERROR: "`; `ITEM_DATA_ERROR` added to ErrorType enum in errorNormalizer.ts

**And** the item database load runs in parallel with game data load at startup (non-blocking)

---

### Story 5.2: In-Memory Item Search Algorithm

As a theory-crafter,
I want typeahead search to return relevant item results instantly as I type, without any perceptible delay,
So that finding items feels like filtering a known list, not waiting for a database query.

**Acceptance Criteria:**

**Given** `useGameDataStore.itemDatabase` is loaded with the full corpus
**When** `searchItems(query: string, database: ItemDatabase): SearchResult[]` is called with a 3-character query
**Then** results are returned within 50ms for the full corpus (NFR3); measured via `performance.now()` in unit tests

**Given** a query that exactly matches the start of an item name (e.g., "Jugg")
**When** `searchItems` runs
**Then** prefix-matched items appear before substring-matched items in the results; items whose names start with the query are ranked highest

**Given** a query with a minor typo (e.g., "Jugernaut")
**When** `searchItems` runs
**Then** items with close Levenshtein proximity to the query appear in results; the algorithm does not need to be perfect but should surface the correct item within the top 5 results

**Given** a query that matches no item names
**When** `searchItems` runs
**Then** an empty array is returned; this triggers an inline "No items found" display in the GearSlot dropdown (not a toast)

**And** `searchItems` is in `src/features/item-database/itemSearch.ts`; it never calls any Tauri command — all computation is in-memory TypeScript

**And** `itemSearch.test.ts` covers: prefix match ranking, substring match, empty results, and the ≤50ms performance benchmark on a simulated full corpus

---

### Story 5.3: AffixTierControl — Pip-Based Tier Selection

As a theory-crafter,
I want to adjust each affix's tier using a row of pips (T1–T7) that I click or navigate with arrow keys, with the current value displayed in monospace next to the pips,
So that I can quickly set affix tiers to match my actual item rolls without typing numbers.

**Acceptance Criteria:**

**Given** a GearSlot has an item selected with affixes at median tier
**When** the AffixTierControl for an affix is displayed
**Then** it shows 7 tier pips (8px × 8px circles, 4px gap); pips up to the current tier are filled with --color-tier-pip-active (matches --color-accent-gold); pips above current tier use --color-tier-pip-inactive (UX-DR5)

**Given** the player clicks pip N
**When** the click is registered
**Then** the affix tier updates to N; the current value in monospace (40px fixed width) updates to reflect tier N's value range for this affix

**Given** the AffixTierControl is keyboard-focused
**When** the player presses Right arrow
**Then** the tier increments by 1 (up to the item's maximum available tier for this affix); Left arrow decrements by 1 (down to 1)

**Given** the affix is at its maximum tier (all pips filled)
**When** the player presses Right arrow or clicks the last pip again
**Then** the tier stays at max; no change occurs

**And** AffixTierControl has role="slider", aria-valuemin="1", aria-valuemax="{tierCount}", aria-valuenow, aria-label="{affixName} tier", aria-valuetext="Tier {N}: {value range}" (UX-DR5)

**And** --color-tier-pip-active and --color-tier-pip-inactive tokens are added to the global stylesheet with PixiJS hex equivalents as comments (UX-DR10 partial)

**And** AffixTierControl.test.tsx covers tier click, keyboard navigation, and axe-core passes (UX-DR15)

---

### Story 5.4: GearSlot Component with Typeahead Item Search

As a theory-crafter,
I want to type an item name in a gear slot and select from instant search results, with the item card pre-populating all known affixes at median tier,
So that I can quickly represent my actual equipped gear without manual data entry.

**Acceptance Criteria:**

**Given** a gear slot is in "empty" state
**When** the player clicks the slot or its "Search items…" placeholder
**Then** a Headless UI Combobox opens with role="combobox", aria-expanded="true", aria-autocomplete="list" (UX-DR4, NFR14)

**Given** the player types ≥1 character in the Combobox input
**When** `searchItems` returns results
**Then** up to 6 results appear in the dropdown within 50ms; each result shows item name and base type; the dropdown is scrollable if more than 6 results

**Given** the player selects an item from the dropdown (click or Enter)
**When** the item is selected
**Then** the GearSlot transitions to "populated-database" state: a card shows item name (14px/600) and base type; the item's known affixes are listed below at their median tier values using the AffixTierControl component (Story 5.3)

**Given** a slot is in "populated-database" state
**When** the player clicks the × button
**Then** the slot returns to "empty" state; the selection is cleared from useBuildStore

**And** GearSlot is at `src/features/item-database/GearSlot.tsx`; the component has role="group" aria-label="{slotName} slot" (UX-DR4)

**And** GearSlot.test.tsx passes vitest-axe with zero violations (UX-DR15)

**And** the right panel layout is updated to split into Gear Context (upper, independently scrollable) and Optimization (lower, pinned to bottom) sections as defined by UX-DR9

---

### Story 5.5: Custom Affix Addition and Free-Text Fallback

As a theory-crafter,
I want to add affixes not pre-loaded on my item (for crafted or fractured gear) by searching the full affix database, and fall back to free-text input if I prefer or can't find my item,
So that I can represent any item in the game regardless of its affix configuration.

**Acceptance Criteria:**

**Given** a GearSlot in "populated-database" state
**When** the player clicks the "+" button
**Then** a Headless UI Combobox opens anchored to the gear card; the player can type to search the full affix database (1,112+ affixes); selecting an affix adds it to the affix list at median tier with an AffixTierControl

**Given** the player selects a custom affix
**When** it is added to the slot
**Then** it appears in the affix list with a tier control; the player can set its tier/value using the same AffixTierControl from Story 5.3; the affix is stored with `affixId?` = the selected affix's ID

**Given** a gear slot is in "empty" state
**When** the player clicks the "Free text mode" ghost link
**Then** the slot transitions to "populated-freetext" state: a 3-row textarea appears; the player can type any gear description; a "Switch to database search" link returns to typeahead mode

**Given** a slot is in "populated-freetext" state with text entered
**When** the build is saved
**Then** the text is stored as the gear context (Phase 1 behavior); no structured gear data is stored for this slot

**And** the AffixPicker Combobox is at `src/features/item-database/AffixPicker.tsx`

**And** the free-text fallback textarea is always reachable and never hidden (FR30)

---

### Story 5.6: Item Data Freshness Check and StalenessBar Extension

As a theory-crafter,
I want to be notified when a newer item database version is available and be able to update it in one click, without being blocked from using the app while the update is pending,
So that my item database stays current with Last Epoch patches.

**Acceptance Criteria:**

**Given** the app launches and `check_item_data_freshness()` Rust command runs in the background
**When** the local `itemDataVersion` in the manifest is older than the remote version
**Then** a staleness banner appears for item data: "Item database updated. Refresh?" with an "Update" CTA and "Dismiss" link (FR33, FR48)

**Given** both game data AND item data are stale simultaneously
**When** the staleness banners render
**Then** two separate banners appear stacked (one per data type); each has its own Update/Dismiss controls (UX-DR6)

**Given** the player clicks "Update" on the item data banner
**When** `update_item_data()` Rust command runs
**Then** the button shows a spinner (aria-busy="true"), new item files are downloaded and atomically replaced (temp-file-then-rename), the banner shows "Updated ✓" for 2s then disappears, and `useGameDataStore.itemDatabase` reloads with the new data (FR50)

**Given** the update download fails mid-transfer
**When** the error is caught
**Then** the existing item data files are intact (no corruption), the banner returns to its original state, and no error toast appears (the staleness indicator remains as the retry signal — NFR9)

**And** `check_item_data_freshness()` and `update_item_data()` Rust commands are in `src-tauri/src/commands/item_commands.rs` and registered in `lib.rs`

**And** StalenessBar at `src/components/StalenessBar.tsx` is extended with an `isItemDataStale: boolean` prop; the two-banner layout is additive and does not break the existing game data banner

---

## Epic 6: BuildState Schema v2, Migration & Data Pipeline

All Phase 1 saves migrate losslessly to BuildState schema v2 on load. Phase 2 builds save with structured gear data. The optimization preset field is removed and mapped to slider position during migration. Manifest v2 adds itemDataVersion and iconCacheVersion. Data update operations use atomic writes. The settings panel displays version information.

---

### Story 6.1: BuildState v2 TypeScript Types and Core Migration Function

As a developer,
I want the TypeScript types for GearItemV2 and AffixEntryV2, and a `migrateBuildState` function that converts Phase 1 v1 saves to v2 schema without data loss,
So that the entire Phase 2 feature set can rely on a consistent BuildState structure.

**Acceptance Criteria:**

**Given** the Phase 1 BuildState gear type: `{ slot: string, itemName: string, affixes: string[] }`
**When** the v2 TypeScript interfaces are defined
**Then** `GearItemV2 = { slot: string; itemId?: string; itemName: string; affixes: AffixEntryV2[] }` and `AffixEntryV2 = { affixId?: string; name: string; tier?: number; value?: number }` are in `src/shared/types/buildState.ts`

**Given** a v1 build with free-text affixes `["Health", "Armor"]`
**When** `migrateBuildState(rawJson)` runs
**Then** the gear slot is converted to `{ slot, itemName, affixes: [{ name: "Health", tier: undefined, value: undefined }, { name: "Armor", tier: undefined, value: undefined }] }` and `schemaVersion` is set to 2

**Given** a v1 build with `gear: null` or `gear: undefined`
**When** `migrateBuildState` runs
**Then** it coerces gear to `[]` and sets schemaVersion: 2; no error is thrown

**Given** a v1 build with `gear: [{ slot, itemName, affixes: [] }]` (empty affixes array)
**When** `migrateBuildState` runs
**Then** it returns `{ slot, itemName, affixes: [] }` with schemaVersion: 2; empty array is preserved

**Given** a v2 build (schemaVersion: 2) passed to `migrateBuildState`
**When** the function runs
**Then** the build is returned unchanged; the function is idempotent (NFR18, FR54)

**And** `migrateBuildState` is in `src/features/build-manager/buildPersistence.ts`; it handles ALL migration logic in TypeScript; Rust stores and retrieves raw JSON without any schema awareness

---

### Story 6.2: Optimization Preset Migration and Build Persistence Integration

As a theory-crafter,
I want my Phase 1 builds to load cleanly in Phase 2 with their optimization goal migrated to the equivalent slider position, and all Phase 1 build management features to continue working,
So that I don't lose any saved builds or data when upgrading to Phase 2.

**Acceptance Criteria:**

**Given** a Phase 1 build with `goalPreset: "Maximize Damage"`
**When** `migrateBuildState` runs
**Then** `sliderPosition = 100` is set and `goalPreset` is removed from BuildState

**Given** a Phase 1 build with `goalPreset: "Maximize Survivability"`
**When** migration runs
**Then** `sliderPosition = 0` is set

**Given** `goalPreset: "Balanced"`
**When** migration runs
**Then** `sliderPosition = 50` is set

**Given** `goalPreset: "Maximize Speed"`
**When** migration runs
**Then** `fineTuneWeights = { damage: 25, survivability: 0, speed: 75 }` is set with `sliderPosition = 50` as base

**Given** `migrateBuildState` is called every time a build is loaded from SQLite in `buildPersistence.ts`
**When** `invokeCommand('load_build', { id })` returns raw JSON
**Then** `migrateBuildState(rawJson)` runs immediately before the result populates `useBuildStore`; no v1 build ever reaches the store without migration

**Given** Phase 1 build management operations (save, load, rename, delete)
**When** tested in Phase 2
**Then** all operations work correctly with no regression (FR53); existing SQLite records load without error

**And** `migrateBuildState` unit tests cover all four goalPreset values plus null/missing goalPreset

---

### Story 6.3: Manifest v2 and Atomic Data Update Pipeline

As a developer,
I want manifest.json to track itemDataVersion, iconCacheVersion, and iconSource, and all data updates to use atomic temp-file-then-rename writes,
So that the app can version multiple data types independently and data files are never corrupted by interrupted downloads.

**Acceptance Criteria:**

**Given** the existing manifest.json structure
**When** manifest v2 is implemented
**Then** the manifest includes: `itemDataVersion: "1.0.0"`, `iconCacheVersion: "1.0.0"`, `iconSource: "game-files" | "community-cdn" | "placeholder"` as new top-level fields alongside existing fields

**Given** any Rust command writes a data file (icon cache entry, item database file, game data file)
**When** the write operation runs
**Then** it writes to a `.tmp` file in the same directory first, then calls `fs::rename` to atomically replace the final path; direct writes to final paths are never used (architecture constraint)

**Given** a data update download fails at any point before `fs::rename`
**When** the error is handled
**Then** the `.tmp` file is cleaned up; the existing final-path file is untouched; the app retains the last valid data state (NFR9)

**Given** a successful item data update via `update_item_data()` Rust command
**When** the update completes
**Then** the manifest's `itemDataVersion` is updated to the new version; `useGameDataStore.isItemDataStale` is set to false; the StalenessBar banner for item data dismisses automatically

**And** the `check_data_freshness()` and `check_item_data_freshness()` commands run in parallel at startup; both complete before the main UI loads

---

### Story 6.4: Phase 2 Save Format and Settings Version Display

As a theory-crafter,
I want all new builds I create and save in Phase 2 to use the v2 schema, and I want to see my current game data and item database versions in the settings panel,
So that I know my data is current and my builds are saved in the latest format.

**Acceptance Criteria:**

**Given** a player creates a new build in Phase 2 or modifies an existing one
**When** `useBuildStore.saveBuild()` is called
**Then** the build serializes with `schemaVersion: 2` and gear stored as `GearItemV2[]`; the Rust command writes the JSON to SQLite (FR52)

**Given** a Phase 2 build is loaded (schemaVersion: 2)
**When** `migrateBuildState` runs
**Then** the build passes through unchanged (idempotency check; FR54)

**Given** the player opens the settings panel
**When** the panel renders
**Then** it shows: "Game Data: {gameVersion} (last updated {generatedAt date})" and "Item Database: {itemDataVersion}" as read-only text labels (FR55)

**And** the settings panel uses the manifest's `gameVersion` and `itemDataVersion` fields; these are already loaded into `useAppStore` or `useGameDataStore` at startup

---

## Epic 7: Advanced Optimization UX — Archetype Slider

The 4-button optimization preset system is replaced by a continuous Glass Cannon ↔ Juggernaut master slider (0–100). A "Fine Tune" expansion panel provides independent Damage, Survivability, and Speed sub-sliders. When "Enforce Level Budget" is ON, the AI receives character level and point budgets as hard constraints. Structured gear context flows from the item database into the optimization prompt. All Phase 1 streaming and scoring behaviors are preserved.

---

### Story 7.1: OptimizationSlider Component and useOptimizationStore Extension

As a theory-crafter,
I want a continuous Glass Cannon ↔ Juggernaut slider that replaces the 4-button preset system, with a gradient track and labeled endpoints that immediately communicate the optimization spectrum,
So that I can express my build archetype intent in a single intuitive gesture.

**Acceptance Criteria:**

**Given** the Phase 1 4-button goal preset UI
**When** Epic 7 is implemented
**Then** the 4-button UI is removed; the OptimizationSlider component replaces it in the right panel Optimization section

**Given** the OptimizationSlider is rendered
**When** it is displayed
**Then** the slider track uses a CSS linear-gradient from --color-slider-juggernaut (left, 0) to --color-slider-glass-cannon (right, 100); endpoints are labeled "Juggernaut" (left) and "Glass Cannon" (right) in 11px uppercase --color-text-secondary; the default position is 50 (center/balanced)

**Given** the player drags the slider thumb or clicks the track
**When** the value changes
**Then** `useOptimizationStore.sliderPosition` updates to the new value (0–100); the thumb tooltip shows the current weight split (e.g., "Survivability 70% / Damage 30%") derived as `survivability = (100 - position) / 100, damage = position / 100`

**Given** the slider is focused via keyboard
**When** the player presses the Right or Left arrow key
**Then** `sliderPosition` changes by 5 units per keypress (FR34)

**And** --color-slider-glass-cannon and --color-slider-juggernaut CSS tokens are added to the global stylesheet with PixiJS hex equivalents as comments (UX-DR10)

**And** `useOptimizationStore` is extended with `sliderPosition: number` (default 50) and `fineTuneWeights: { damage: number; survivability: number; speed: number } | null` (default null)

**And** OptimizationSlider has role="slider", aria-valuemin="0", aria-valuemax="100", aria-valuenow, aria-label="Optimization intent", aria-valuetext="{N}% Survivability / {100-N}% Damage" (NFR13, UX-DR2)

**And** OptimizationSlider passes vitest-axe with zero violations (UX-DR15)

---

### Story 7.2: FineTunePanel Component

As a theory-crafter,
I want to expand a "Fine Tune" panel below the master slider to independently control Damage, Survivability, and Speed weights (0–100 each), overriding the master slider when I use them,
So that I can precisely specify optimization priorities as a power user without the master slider being sufficient.

**Acceptance Criteria:**

**Given** the OptimizationSlider is displayed
**When** the "▼ Fine Tune" Disclosure trigger is clicked
**Then** the FineTunePanel expands (smooth ease-out transition; instant if reducedMotion) to reveal three range inputs: Damage Weight (0–100), Survivability Weight (0–100), Speed Weight (0–100)

**Given** the Fine Tune panel opens
**When** the master slider is at position 70 (70% damage, 30% survivability)
**Then** the sub-sliders initialize at their master-slider-derived values: Damage=70, Survivability=30, Speed=0

**Given** the player manually adjusts any sub-slider
**When** a sub-slider value differs from its master-slider-derived equivalent
**Then** `fineTuneWeights` in useOptimizationStore becomes non-null (override active); the Disclosure trigger label shows "(Custom)" to signal that Fine Tune values override the master slider (UX-DR3)

**Given** Fine Tune is in override mode and the master slider is moved
**When** the master slider changes
**Then** the sub-sliders proportionally scale to maintain their relative ratios (not reset to derived values); the Fine Tune remains in override mode

**Given** the Fine Tune panel is collapsed
**When** `fineTuneWeights` is null
**Then** the master slider drives the optimization weights exclusively; no sub-slider values are sent in the optimization payload

**And** FineTunePanel uses Headless UI Disclosure; each sub-slider has role="slider" with appropriate aria-label (UX-DR3)

**And** FineTunePanel passes vitest-axe with zero violations (UX-DR15)

---

### Story 7.3: Optimization Weight Computation in Rust and Prompt Construction

As a developer,
I want the Rust optimization command to compute effective weights from `sliderPosition` or `fineTuneWeights` and include them in the AI optimization prompt as named context,
So that the AI receives precise intent signals and can reason about them explicitly in its suggestions.

**Acceptance Criteria:**

**Given** the optimization payload includes `sliderPosition: 70` and `fineTuneWeights: null`
**When** the Rust optimization command computes weights
**Then** effective weights are: `survivability = (100 - 70) / 100.0 = 0.30`, `damage = 70 / 100.0 = 0.70`, `speed = 0.0`; these are included in the prompt as: "Optimization intent: 70% damage, 30% survivability, 0% speed"

**Given** the payload includes `fineTuneWeights: { damage: 40, survivability: 40, speed: 20 }`
**When** the Rust command computes weights
**Then** Fine Tune values are used directly (normalized to 0–1 ratios); the prompt includes "Optimization intent: 40% damage, 40% survivability, 20% speed" — the sliderPosition is ignored when fineTuneWeights is Some

**Given** the Phase 1 `goalPreset` field no longer exists in BuildState (migrated in Epic 6)
**When** optimization runs
**Then** no code references `goalPreset`; all weight derivation uses sliderPosition/fineTuneWeights exclusively (FR36 backward compat handled via Epic 6 migration)

**And** `optimization_commands.rs` in Rust receives `OptimizationPayload` including `slider_position: f32` and `fine_tune_weights: Option<FineTuneWeights>` via the Tauri command interface

**And** the AI stream begins within the same latency as Phase 1 (NFR4); no new synchronous operations are added to the Rust critical path

---

### Story 7.4: Level-Budget-Aware AI Optimization Context

As a theory-crafter,
I want the AI to receive my character level and point budgets as hard constraints when "Enforce Level Budget" is ON, so it can suggest only allocations I can actually make at my level,
So that optimization suggestions are immediately actionable without exceeding my available points.

**Acceptance Criteria:**

**Given** `budgetEnforced = true` in useBuildStore
**When** the optimization command payload is constructed
**Then** it includes a `levelContext` object: `{ characterLevel, availablePassivePoints, allocatedPassivePoints, unspentPassivePoints, activeSkillLevels: { slotId: level } }` (FR37)

**Given** the AI receives `levelContext` in the prompt
**When** the Rust prompt builder runs
**Then** the prompt includes a section: "Build constraints: Level {N}, {M} passive points available ({U} unspent), skill levels: {skill1: L1, skill2: L2...}" — presented as hard constraints the AI must respect in its suggestions

**Given** `budgetEnforced = false`
**When** the optimization payload is constructed
**Then** `levelContext` is omitted (undefined/None); the prompt does not include budget constraints; the AI can suggest ideal allocations as theory-craft targets (FR38)

**And** the `levelContext` payload structure matches the architecture spec: `LevelContext` type is defined in TypeScript and the Rust command accepts an `Option<LevelContext>` equivalent

---

### Story 7.5: Structured Gear Context in Optimization Payload

As a theory-crafter,
I want gear I've set using the item database (with specific affix tiers) to flow into the AI optimization request as structured data, so the AI can reference specific affix values in its suggestions,
So that suggestions like "your T4 Health roll already covers the defensive floor" become possible.

**Acceptance Criteria:**

**Given** one or more gear slots are in "populated-database" state with items and tier-set affixes
**When** the optimization payload is assembled
**Then** each populated-database slot appears as a `StructuredGearSlot: { slot, itemName, affixes: [{ name, tier?, value? }] }` in the `structuredGear` array (FR31)

**Given** a gear slot is in "populated-freetext" state
**When** the optimization payload is assembled
**Then** that slot's free-text content is included in the `buildContext` string (Phase 1 behavior); the `structuredGear` array entry for that slot has affixes with `tier: undefined` (FR32)

**Given** the Rust prompt builder receives `structuredGear`
**When** the AI prompt is constructed
**Then** structured gear slots are serialized in a format that conveys slot name, item name, and affix tiers explicitly (e.g., "Chest: Juggernaut Plate — Health T4 (+280 HP), Armor T2 (+120 AR)") so the AI can reference affix-level detail (FR41)

**Given** the optimization runs with structured gear context
**When** the AI stream begins
**Then** streaming behavior is identical to Phase 1 (no regression — FR39); before/after scoring is preserved (FR40)

---

### Story 7.6: Optimization Backward Compatibility and Re-Run / Clear

As a theory-crafter,
I want to clear all current suggestions and re-run optimization with my updated build state or slider position, and confirm that all Phase 1 optimization behaviors (streaming, before/after scoring) still work correctly,
So that I can iterate on my build without stale suggestions cluttering the panel.

**Acceptance Criteria:**

**Given** AI suggestions are displayed in the optimization section
**When** the player clicks the "Clear" or re-run action (or changes the slider position and clicks Optimize)
**Then** all existing suggestions are cleared from the display; a fresh optimization request is sent with the current build state, slider position, and gear context (FR42)

**Given** the optimization stream is running
**When** partial AI output arrives
**Then** it renders incrementally in the optimization section; the text is readable as partial output (not a loading skeleton) — identical to Phase 1 streaming behavior (FR39)

**Given** the AI returns a complete suggestion
**When** the suggestion is displayed
**Then** a before/after score comparison is visible alongside the suggestion text — identical to Phase 1 scoring behavior (FR40)

**Given** Phase 1 builds with `goalPreset` were migrated (Epic 6) and Phase 2 slider positions match the preset equivalents
**When** the player opens a migrated build and runs optimization
**Then** the slider is at the correct migrated position and the optimization weights match the Phase 1 preset behavior for that preset (FR36)

**And** the API key is never exposed in TypeScript — all optimization API calls remain exclusively in Rust (NFR5)

**And** the optimization panel Optimize button is always visible without scrolling in the right panel (UX-DR9 pinned Optimization section)

---

## Validation Summary

### FR Coverage: All 55 FRs Covered ✅
- FR1–FR17: Epic 1 (14 skill tree visual + active skill management FRs)
- FR18–FR22: Epic 3 (5 character budget FRs)
- FR3: Epic 4 (1 Weaver Tree FR)
- FR23–FR30, FR33: Epic 5 (9 item database FRs)
- FR31–FR32, FR34–FR42: Epic 7 (11 optimization FRs)
- FR43–FR46, FR49: Epic 2 (5 icon pipeline FRs)
- FR47–FR48, FR50–FR55: Epic 6 (8 data pipeline + migration FRs)

### UX-DR Coverage: All 15 UX-DRs Covered ✅
- UX-DR1: Story 1.3 (SkillPickerGrid)
- UX-DR2: Story 7.1 (OptimizationSlider)
- UX-DR3: Story 7.2 (FineTunePanel)
- UX-DR4: Story 5.4 (GearSlot)
- UX-DR5: Story 5.3 (AffixTierControl)
- UX-DR6: Stories 5.6 + 6.4 (StalenessBar full two-banner)
- UX-DR7: Story 3.1 (UnspentCounter)
- UX-DR8: Story 3.1 (BudgetToggle)
- UX-DR9: Story 5.3 (right panel layout split)
- UX-DR10: Stories 1.3, 5.4, 7.1 (CSS tokens distributed across epics)
- UX-DR11: Story 1.5 (search bar)
- UX-DR12: Story 1.2 (prerequisite validation visual flash)
- UX-DR13: Story 2.4 (icon loading placeholder → icon transition)
- UX-DR14: Story 4.2 (Weaver Tree tab always present)
- UX-DR15: Stories 1.3, 2.x, 3.3, 4.2, 5.3, 5.4, 7.1, 7.2 (axe-core CI checks)

### NFR Coverage ✅
- NFR1 (≥60fps): Epic 2 Story 2.4 (icon rendering performance AC)
- NFR2 (≤200ms icon load): Epic 2 Story 2.4
- NFR3 (≤50ms typeahead): Epic 5 Story 5.2 (itemSearch benchmark test)
- NFR4 (AI stream latency): Epic 7 Story 7.3
- NFR5 (API key security): Epic 7 Story 7.6
- NFR6 (Steam read-only): Epic 2 Story 2.2
- NFR7 (icon cache sandboxed): Epic 2 Story 2.2
- NFR8 (lossless migration): Epic 6 Stories 6.1, 6.2
- NFR9 (atomic updates): Epic 5 Story 5.6; Epic 6 Story 6.3
- NFR10 (graceful icon degradation): Epic 2 Story 2.2
- NFR11 (item DB load failure): Epic 5 Story 5.1
- NFR12 (focus rings): Distributed — each epic's component stories include focus ring AC
- NFR13 (slider keyboard): Epic 7 Story 7.1
- NFR14 (combobox ARIA): Epic 5 Story 5.4
- NFR15 (aria-live): Stories 3.1, 5.6
- NFR16 (reduced motion): Stories 1.2, 2.4, 7.2
- NFR17 (vitest-axe zero violations): Stories 1.3, 3.3, 4.2, 5.3, 5.4, 7.1, 7.2
- NFR18 (idempotent migration): Epic 6 Story 6.1
- NFR19 (CDN icon cache): Epic 2 Story 2.2

### Architecture Constraints: All Enforced ✅
- No new top-level Zustand stores: All stories extend existing stores only
- SkillTreeCanvas props-only: Stories 2.3, 2.4 explicitly enforce this
- No barrel files: All story file locations specified as direct paths
- Rust commands + invokeCommand<T>: All IPC stories follow this pattern
- Atomic writes: Epic 6 Story 6.3 enforces temp-file-then-rename
- TypeScript-only item search: Epic 5 Story 5.2 explicitly excludes IPC
- Weaver tab always present: Epic 4 Story 4.2

### Brownfield Starter Template: N/A ✅
LEBOv2 Phase 2 is a brownfield extension of a fully operational Phase 1 codebase. No project initialization story is needed — Epic 1 Story 1.1 begins directly with the first Phase 2 code change (nodeAllocations type upgrade).
