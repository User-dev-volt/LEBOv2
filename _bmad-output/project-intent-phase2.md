# Project Intent — Last Epoch Build Optimizer, Phase 2

**Captured:** 2026-05-06
**Supersedes:** project-intent.md (Phase 1 / MVP — all 6 epics complete as of 2026-05-05)
**Track:** BMad Method (full pipeline)
**Modules:** BMM (backbone) + GDS (game project)

---

## Context: Where We Left Off

The MVP (Phase 1) is fully shipped — all 6 epics done. The application can:
- Display passive and active skill trees for all classes/masteries using community game data
- Create builds from scratch via class/mastery selector
- Save, load, rename, and delete builds (SQLite persistence)
- Accept gear, active skill, and idol context as free-text input
- Stream AI optimization suggestions via Claude/OpenRouter with before/after scoring
- Run on Windows and macOS as a signed Tauri desktop app

Phase 2 is not a patch — it is a full-fidelity rebuild of the skill tree experience, a structured item database, and a smarter optimization UX. It is designed as a cohesive system even though implementation will be sequential.

---

## Product Vision (Phase 2)

Transform the MVP prototype into a production-quality Last Epoch companion app that rivals lastepochtools.com in visual fidelity and surpasses it in AI-driven optimization depth. Every skill for every class must be fully interactive and icon-accurate. Every item in the game must be searchable. The optimizer must speak the player's language — from "I want to face-tank everything" to "I want to delete the screen."

---

## Phase 2 Pillars (Implemented Sequentially, Designed Together)

### Pillar 1: Full Skill Tree Fidelity

### Pillar 2: Item Database + Structured Gear Input

### Pillar 3: Advanced Optimization UX (Glass Cannon ↔ Juggernaut Slider)

---

## Target Audience

Same as Phase 1 — advanced Last Epoch players and theory-crafters. Phase 2 raises the bar: this is now the tool a hardcore player uses *instead* of lastepochtools.com, not alongside it.

---

## Platform & Delivery

- Desktop application (Tauri 2.x) — Windows 10/11 + macOS 12+
- No web version in Phase 2
- All features ship as updates to the existing installed app via the auto-update system built in Epic 5

---

## Pillar 1 Deep Dive: Full Skill Tree Fidelity

### Visual Reference
Match lastepochtools.com planner exactly. All four views:
1. **Skill Picker** (Image 1 reference): Grid organized by base class + mastery sections. Each skill shown as an icon in a hexagonal frame with name and unlock level. Mastery-gated skills show point requirements as badge overlays (5, 10, 15, 20, 25, 35). Skills not yet unlocked are visually locked.
2. **Active Skill Tree** (Image 2 reference): Radial/web layout. Hexagonal nodes with actual skill icons. Each node shows current/max points (e.g., `0/3`). Selected skill shown at top-left with name, level, and unlock condition. Other active skill slots shown as empty hexagons in the header. RESET button. Search bar that highlights matching nodes.
3. **Passive Skill Tree** (Image 3 reference): Structured horizontal-row layout. Left panel shows base class identity (class icon, name, mastery options as diamond icons, lore description). Main area renders passive nodes on a grid. Mastery-locked skills shown at bottom at their point thresholds (5, 10, 15, 20 points). RESET button. Search bar.
4. **Weaver Tree** (Image 4 reference): Spider-web radial layout with a central node. Web-texture background. Class-agnostic. Lock icons on unreachable nodes. RESET button. Search bar. Treated as its own dedicated epic with a data research spike first.

### Skill Icons
- **Primary source:** Last Epoch game files, auto-detected via Steam install path (`C:\Program Files (x86)\Steam\steamapps\common\Last Epoch`). App silently detects the path on first launch, extracts and caches icons, no user interaction required.
- **Fallback:** Community CDN (lastepochtools.com / tunklab.com asset sources) when game files are not present. User is never blocked — they get icons either way.
- Icons used everywhere the skill appears: tree nodes, skill picker grid, active skill tab headers, node tooltips.

### Active Skill Slot Management
- Each active skill slot (tab) has a **class/mastery-filtered skill picker dropdown**. Only skills available to the selected class and mastery are shown. Skills are organized identically to Image 1 (base class skills unlocked by level, mastery skills grouped by mastery with point gate badges).
- Selecting a skill loads that skill's full tree under its tab.
- The skill's own skill tree (Image 2 layout) replaces the current stub tab content.

### Multi-Point Node Allocation
- **Left-click** increments the node by 1 point (up to node maximum).
- **Right-click** decrements the node by 1 point (down to 0).
- Node displays `current/max` counter (e.g., `3/5`).
- Prerequisite validation is enforced: a node cannot be incremented if its prerequisites are unmet; a node cannot be decremented below the minimum required to keep dependents allocated.

### Character Level & Point Budget
- User inputs their **character level** (1–100). App calculates total available passive points and tracks unspent points for passive trees.
- User inputs **active skill level** (1–20) per skill slot. App enforces the max allocatable points for that skill's tree.
- A **"Enforce level budget" toggle** (default OFF) controls whether the budget is enforced. OFF = free theory-craft mode. ON = realistic build mode that prevents over-allocation.
- Unspent points counter displayed prominently above each tree (matching the reference screenshots).

### Weaver Tree
- Scoped as its own epic with a **research spike first** to confirm data availability and layout coordinate format.
- If data is available, rendered using the same PixiJS canvas infrastructure with a web/radial layout matching Image 4.
- Included in Phase 2 but gated behind research spike completion.

### Search Within Trees
- Search bar (top-right of each tree view) filters/highlights nodes by name. Non-matching nodes are dimmed; matching nodes are highlighted in gold. Clears on empty input.

---

## Pillar 2 Deep Dive: Item Database + Structured Gear Input

### The Database
- Full Last Epoch item database: base items (~674), uniques (~445), and affixes (~1,112+) sourced from tunklab.com / community data.
- Stored locally in the app's data directory alongside game data files, using the same versioned manifest system already in place.
- **Update strategy:** Local database with a background freshness check on launch (same staleness-bar pattern as game data). If the game patches and the community database has a newer version, the app prompts the user to update. Separate manifest entry for item data version.
- **Game file extraction path (future):** If the user has Last Epoch installed, the app can auto-extract item data from game files via the same Steam path detection used for icons. This is a research spike before commitment — if feasible, it becomes the primary source.

### Item Search & Selection (Gear Input)
- The current free-text gear input is replaced with a **typeahead search field** per gear slot.
- As the user types, the app queries the local item database and suggests matching items by name (fuzzy search).
- Selecting an item from the dropdown populates the slot with:
  - Item name and base type
  - Known affixes pre-loaded (with default/median tier values)
- **Affix customization:** Each affix shows a **tier slider** (T1–T7 or the item's available tiers) so the user can dial in their actual rolled values. Suffix and prefix are both adjustable.
- **Custom affix addition:** A "+" button lets the user add affixes not pre-loaded. A **dropdown of all possible affixes** (searchable from the full affix database) lets them pick the exact one and set its value. This covers crafted/fractured items and edge cases.
- **Free-text fallback:** If the user can't find an item or prefers typing, the old free-text path remains available as an escape hatch.

### What Item Data Feeds Into
- Item data is passed to the AI as structured context (slot, name, affixes + tiers) — richer than the current free-text.
- In Phase 2, items are **context for skill tree optimization only** — the AI uses gear knowledge to inform skill suggestions ("your gear already provides max fire resistance, so defensively you can afford to invest in damage nodes").
- **Item optimization is separate** and scoped to Phase 3 (see below).

---

## Pillar 3 Deep Dive: Advanced Optimization UX

### The Optimization Spectrum Slider
- A single **master slider** on the optimization panel labeled with two poles:
  - Left: **"Juggernaut"** (maximum survivability — tank everything)
  - Right: **"Glass Cannon"** (maximum damage output — delete everything)
- The slider drives a weighted scoring system: fully left = survivability weight 100%, damage weight 0%; fully right = the inverse; center = balanced (matches current "Balanced" goal behavior).
- **"Fine Tune" toggle** below the slider expands three independent sub-sliders: **Damage Weight**, **Survivability Weight**, **Speed Weight** — each 0–100. Fine Tune values override the master slider when expanded.
- The master slider and Fine Tune system *replace* the current 4-button goal selector (Maximize Damage / Maximize Survivability / Maximize Speed / Balanced). The old presets map to slider positions for backwards compatibility.

### Optimization Modes (Separate)
- **Skill Tree Optimizer** (Phase 1 foundation, enhanced in Phase 2 with better data + level budget awareness): Suggests passive and active skill node changes within the user's available point budget.
- **Item Optimizer** (Phase 3): Separate mode. Analyzes gear slots and suggests improvements. Toggle: "Suggest specific items" (named item from database) vs. "Suggest stat priorities" (what stats to chase).
- **Full Build Optimizer** (Phase 3, after both above are solid): Holistic analysis combining skills + gear. Produces a direction report (e.g., "Your current path leans into bleed damage but your gear has no bleed scaling — align one or the other"). Uses the same Glass Cannon ↔ Juggernaut slider as the weighting system.

### Level Budget as an Optimization Constraint
- When "Enforce level budget" is ON, the AI is explicitly told the character's level, available passive points, and skill levels. Suggestions are constrained to what is actually achievable — no suggestions that require more points than the user has.
- When OFF, the AI treats the build as a theory-craft target and may suggest an "ideal allocation" regardless of current level.

---

## Data Architecture Evolution

### Current State
- Game data: versioned JSON files (passive trees, active skill trees) in Tauri app data dir
- Gear/skills/idols: free-text fields stored in `BuildState.contextData`
- Manifest: tracks game version and class data file versions

### Phase 2 Additions
- **Item database files:** `items/base-items.json`, `items/uniques.json`, `items/affixes.json` added to app data dir
- **Icon cache:** `icons/skills/`, `icons/items/` directories populated by extraction pipeline
- **Manifest v2:** adds `itemDataVersion`, `iconCacheVersion`, `iconSource` (`game-files` | `community-cdn`)
- **BuildState schema v2:** `contextData.gear` changes from `{ slot, itemName, affixes: string[] }` to `{ slot, itemId?: string, itemName: string, affixes: { affixId?: string, name: string, tier?: number, value?: number }[] }`
- **Schema migration:** `migrateBuildState` handles v1 → v2 gear upgrade (free-text affixes become `{ name: affix, tier: undefined }`)

---

## Differentiation (Updated)

| Feature | lastepochtools.com | Phase 1 (MVP) | Phase 2 |
|---------|-------------------|--------------|---------|
| Full skill tree visual fidelity | ✓ | Partial | ✓ |
| Actual skill icons in nodes | ✓ | ✗ | ✓ |
| Multi-point node allocation | ✓ | ✗ (toggle only) | ✓ |
| Level budget enforcement | ✓ | ✗ | ✓ |
| Weaver Tree | ✓ | ✗ | ✓ (researched) |
| AI-driven skill suggestions | ✗ | ✓ | ✓ (level-aware) |
| Item database with affix sliders | Partial | ✗ | ✓ |
| Glass Cannon ↔ Juggernaut slider | ✗ | ✗ | ✓ |
| Optimization explanations | ✗ | ✓ | ✓ (richer context) |

---

## Explicit Exclusions (Phase 2)

- Build sharing / export URLs — deferred to Phase 3+
- Item optimization (suggesting item swaps) — Phase 3
- Full build optimizer (skills + gear combined) — Phase 3
- Multiplayer / social features — permanently out of scope
- Mobile version — permanently out of scope
- Monetization — not in Phase 2

---

## Technical Constraints (Carried Forward)

All rules in `project-context.md` remain in force. Key constraints that shape Phase 2:

- **Four domain stores only** — Phase 2 may extend `useGameDataStore` for item data and `useBuildStore` for schema v2 gear; no new top-level stores.
- **SkillTreeCanvas is props-only** — icon rendering inside PixiJS nodes must stay within the existing props-only contract.
- **No barrel files** — all new feature folders follow existing direct-import convention.
- **Tauri commands stay in Rust** — icon extraction, item database parsing, and Steam path detection are all Rust commands registered in `lib.rs`.
- **API key never crosses to frontend** — optimization API calls stay fully in Rust.
- **Schema migration** — BuildState v2 must handle existing v1 saves gracefully via `migrateBuildState`.

---

## Phase 3 Preview (Out of Phase 2 Scope — Captured for Continuity)

- **Item Optimizer:** AI suggests gear improvements with toggle for specific-item vs. stat-priority mode.
- **Full Build Optimizer:** Holistic skills + gear analysis with the same Glass Cannon ↔ Juggernaut weighting system. Produces a unified "build direction" report.
- **Build sharing:** Export builds as shareable files or links.
- **Meta context:** "This build aligns with current S-tier Void Knight meta" — requires community meta data source.

---

## Phase 2 Workflow Progress

Track completion of each required planning and implementation step. Update the status column as each step finishes.

| Step | Skill | Type | Status | Notes |
|------|-------|------|--------|-------|
| 1 | `bmad-create-prd` | Required | `[x] Complete` | PRD written to `_bmad-output/planning-artifacts/prd.md` — 2026-05-06 |
| 2 | `bmad-create-ux-design` | Strongly Recommended | `[x] Complete` | Skill picker grid, icon nodes, Weaver Tree layout, item search, affix sliders, optimization slider — 2026-05-06 |
| 3 | `bmad-create-architecture` | Required | `[x] Complete` | Written to `_bmad-output/planning-artifacts/architecture.md` — 2026-05-06 |
| 4 | `bmad-create-epics-and-stories` | Required | `[x] Complete` | 7 epics, 32 stories written to `_bmad-output/planning-artifacts/epics.md` — 2026-05-06 |
| 5 | `bmad-check-implementation-readiness` | Required | `[ ] Not Started` | Gate: PRD + UX + Architecture + Epics must all align before any code |
| 6 | `gds-sprint-planning` | Required | `[ ] Not Started` | Generates Phase 2 sprint-status.yaml |
| 7 | Dev Loop | Required | `[ ] Not Started` | `gds-create-story` → `gds-dev-story` → `gds-code-review` → repeat until all epics done |

---

## Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-06 | Match lastepochtools.com visual language exactly | User reference; proven UX that Last Epoch players already understand |
| 2026-05-06 | Auto-detect Steam install path for game file icons | Fully automated = zero friction; C:\Program Files (x86)\Steam\steamapps\common\Last Epoch |
| 2026-05-06 | Community CDN fallback for icons | User may not have game installed at build time |
| 2026-05-06 | Click = increment, right-click = decrement for multi-point nodes | PoB-style; familiar to theory-crafter audience |
| 2026-05-06 | Level budget toggle ON/OFF (default OFF) | Free planning mode is primary; realistic mode is opt-in |
| 2026-05-06 | Weaver Tree = research spike first | Unique layout + data requirements need validation before commitment |
| 2026-05-06 | Item optimization deferred to Phase 3 | Skills must be fully fidelity-complete before adding gear optimization complexity |
| 2026-05-06 | Glass Cannon ↔ Juggernaut master slider + Fine Tune expansion | Single slider is approachable; Fine Tune gives power users full control |
| 2026-05-06 | BuildState schema v2 for structured gear | Richer affix data required for meaningful AI context; v1 migration must be lossless |
| 2026-05-06 | Separate optimization modes (skills / gear / full build) | Each must work perfectly independently before combining |
| 2026-05-06 | Build sharing remains out of scope | Focus on core optimizer quality before social layer |
