---
title: "LEBOv2 Phase 4 — Complete Build Tool"
status: final
created: 2026-05-29
updated: 2026-05-30
---

# PRD: LEBOv2 Phase 4 — Complete Build Tool

## 0. Document Purpose

This PRD defines Phase 4 of the Last Epoch Build Optimizer (LEBO), a Tauri 2 desktop application (React + TypeScript frontend, Rust backend). It is written for the downstream architecture and epics/stories workflow. Phase 3 shipped a deterministic scoring engine, gear system, idol/blessing context, optimization suggestions, and a UI aligned to the Claude Design language. Phase 4 transforms LEBO from a capable companion tool into the definitive Last Epoch build tool. It completes the stat engine to full game parity, adds Stat Source Attribution, replaces the partial optimizer with two purpose-built optimization flows, and ships the full UI/UX from the Claude Design handoff. The Claude Design prototype (`_bmad-output/last-epoch-build-optimizer-UI-Handoff/`) is the primary UX reference and must be integrated seamlessly with the existing Tauri/PixiJS architecture. The Phase 3 architecture document at `_bmad-output/planning-artifacts/architecture.md` and epics at `_bmad-output/planning-artifacts/epics.md` are authoritative technical context.

---

## 1. Vision

LEBO Phase 4 completes the build-planning loop that Last Epoch's in-game interface leaves open. The game's own UI tells you what your character has — it does not tell you what it's worth, why certain combinations outperform others, or precisely where to spend your next passive point. Phase 4 delivers that missing intelligence across every dimension of a build simultaneously: a fully-computed stat sheet covering every defensive layer and damage type in the game, a Stat Source Attribution system that answers "where is this number coming from" at a glance, and two distinct optimization flows — one surgical (passive tree only, works on any partial build) and one comprehensive (Complete Build Optimizer that reasons across tree, gear, skills, idols, and blessings together).

The UI has been designed from scratch to match the aesthetic seriousness of Last Epoch itself: dark stone panels, gold typography, class-specific glyphs, and interaction patterns that feel native to the game's world. Every screen — gear editor with a full item database browser, idol grid with live placement preview, blessing timeline cards, skill picker with popular-build suggestions — is built to the Claude Design specification.

Phase 4 is the version a player would pay for.

---

## 2. Target User

### 2.1 Primary Persona

**The Theory-Crafting Player** — A Last Epoch player (level 60–100, typically end-game monolith or arena content) who takes build optimization seriously. They use build guides from maxroll.gg and lastepochtools.com as starting points but want to tune for their specific item drops and playstyle. They are comfortable with game mechanics but find the mental overhead of cross-referencing passives, gear, idols, and skills across multiple browser tabs exhausting. They want one tool that gives them the full picture.

### 2.2 Jobs To Be Done

- **See the full picture at a glance** — know every computed stat for the current build without manually summing modifiers from five different sources.
- **Find the source of any stat** — know exactly which passives, gear pieces, or idols are contributing to a stat without opening each item individually.
- **Know where to spend next** — get ranked, actionable passive tree suggestions that respect available point budget.
- **Plan a complete build** — run a holistic optimization across tree, skills, gear, idols, and blessings and receive a prioritized upgrade roadmap.
- **Build from scratch efficiently** — use popular-build skill suggestions and the gear database browser to set up a new character without switching to a browser.
- **Trust the numbers** — the tool's stat calculations agree with the game and with community reference tools (tunklab EHP/Ward calculators).

### 2.3 Key User Journeys

- **UJ-1. Player checks a suspicious stat mid-session.**
  Alec is running a Rogue build and notices dodge feels low. He opens LEBO, glances at the Defense tab, and hovers over "Dodge Chance." A tooltip appears listing every source: 12% from Quickstep passive cluster, 8% from boots suffix, 6% from idol. He immediately knows where to look for improvement without opening any gear or passive screens. He closes the tooltip and sees the stat is actually fine — the game just doesn't display it visually.

- **UJ-2. Player optimizes passive point allocation after a level-up.**
  Alec levels to 87 and has 3 unspent points. He clicks "Optimize Build" in the right panel. Within two seconds, the passive tree highlights three candidate node paths in gold/silver/dim tiers. He hovers suggestion #1 — the tree highlights the specific path, and a card shows "+14% necrotic damage, +8% cast speed, costs 2 points via Shadow Cascade." He allocates the points, score updates live.

- **UJ-3. Player runs a Complete Build Optimization on a finished build.**
  Alec has filled all gear slots, assigned 5 skills, placed idols, and selected blessings. He navigates to "Complete Build Optimizer" in the header. He sees the scope selector: all six checkboxes are checked. The Weaver checkbox shows a "0 budget" warning, so he unchecks it. He clicks "Optimize." An animated orb graphic assembles — gear tokens, skill icons, and stat fragments orbit inward while analysis runs. Results arrive as a ranked suggestion list spanning passive nodes, gear swap recommendations, and idol additions, organized by domain.

- **UJ-4. Player sets up a new character using the gear browser.**
  Alec starts a new Void Knight. He opens the Gear tab, clicks an empty Helm slot, and the Item Picker Modal opens. He filters by Rarity: Unique, searches "occu," and selects Occu's Ladle. The modal shows the item's icon, base type, unique text, and affix slots. He double-clicks to equip, then clicks "Add Affix" and the Affix Picker shows grouped affixes (Offense / Defense / Utility) with full names, stat ranges, and tier pip selector. He adds Increased Void Damage T6 and closes.

---

## 3. Glossary

- **Build** — A saved character configuration comprising class, mastery, passive node allocations, skill assignments and specialization nodes, gear, idols, blessings, and conditions.
- **Modifier** — A single stat contribution with a value, type (flat / increased / more), and source.
- **ModifierSource** — The identified origin of a Modifier: passive node name, gear slot + affix name, idol placement + affix name, blessing name, or condition name.
- **Stable HP** — The Health value at equilibrium when a build uses Ward as a buffer: the HP floor the character stabilizes at once Ward generation and decay reach steady state.
- **Evade / Dodge** — In Last Epoch these are the same mechanic. "Evade" is used colloquially; the game stat is Dodge Chance (%) and Dodge Rating. LEBO uses "Dodge" throughout.
- **Stat Sheet** — The computed aggregate of all Modifiers for the active Build, displayed in the right panel across five tabs (General, Offense, Defense, Minion, Other).
- **Stat Source Breakdown** — A tooltip displayed on any Stat Sheet row listing every ModifierSource contributing to that stat, showing name and contribution amount.
- **Passive Tree Optimizer** — The single-domain optimization flow targeting passive node allocations only, constrained to the build's current unspent point budget.
- **Complete Build Optimizer** — The multi-domain optimization flow that reasons across all checked build sections simultaneously and produces a unified ranked suggestion list.
- **Scope Selector** — The checkbox panel in the Complete Build Optimizer that allows the user to choose which build sections are included in the optimization run.
- **Completeness Gate** — The per-section validation rule checked before the Complete Build Optimizer may run; a failed gate renders an inline red alert.
- **Optimization Orb** — The animated graphic displayed while the Complete Build Optimizer is running; tokens representing checked sections orbit inward toward a central orb.
- **Item Picker Modal** — The full-screen modal for browsing and selecting a base item for a gear slot, with rarity/slot/tag filters and a searchable icon grid.
- **Affix Picker Modal** — The modal for selecting an affix to add or replace on an equipped item, grouped by Offense / Defense / Utility with full name, stat range, and tier selector.
- **Idol Tray** — The right-hand panel in the Idol Editor showing all available idol definitions with shape visualizations; user selects from the tray then clicks a grid cell to place.
- **Popular Builds Database** — A bundled JSON database of curated skill combinations per class/mastery sourced from maxroll.gg and lastepochtools.com, updated with game data patches.
- **EHP (Effective HP)** — Computed health accounting for all damage-mitigation layers (armor, resistances, endurance, dodge, parry, block, glancing blow, ward). Reported as three values: vs Hits, vs DoTs, vs 1-shots.
- **Stable Ward** — The Ward value at equilibrium given the build's Ward generation rate, Ward Retention, and decay threshold.
- **Increased%** — Damage or defensive modifiers that add additively into a pool before multiplication.
- **More%** — Damage modifiers that apply as independent multipliers; significantly more valuable when Increased% is already large.
- **modifierType** — The field on every passive node effect and affix entry: `"flat"`, `"increased"`, or `"more"`. Required by the scoring engine.

---

## 4. Features

### 4.1 Complete Stats Engine

**Description:** The Rust `scoring-core` crate is extended to compute every stat present in Last Epoch's game systems, covering all damage types, all defensive layers, ailment statistics, attribute-derived stats, and minion stats. The computation follows the Last Epoch damage formula for offensive stats and the tunklab EHP/Ward methodology for defensive stats. Every defensive layer known to affect survivability — armor, resistances, endurance, dodge, parry, block, glancing blow, ward — is modelled. The stat sheet displays all results. This feature unblocks accurate Stat Source Attribution (§4.2) and the Complete Build Optimizer's full-picture analysis (§4.4).

**Functional Requirements:**

#### FR-1: Damage type coverage
The scoring engine computes Increased% and More% multipliers for each damage type independently: Physical, Fire, Cold, Lightning, Void, Necrotic, Poison, Bleed, Corruption. Each type has both hit-damage and DoT-damage variants where game mechanics support it.

**Consequences:**
- A build with +80% Increased Fire Damage and +30% More Fire Damage reports both values on the Offense tab.
- Modifiers tagged for one damage type do not affect other damage type scores.

#### FR-2: Critical strike stats
The engine computes Critical Strike Chance (capped at 100%), Critical Strike Multiplier (base 200% + additive bonuses), and Stun Chance. Crit-weighted average damage uses the Phase 3 formula: `Hit × [(CritMulti × CritChance) + (1 × (1 − CritChance))]`.

#### FR-3: Attack and cast speed
The engine computes Attack Speed and Cast Speed as separate stats, each sourced from passives, gear affixes, idol affixes, and blessings. AoE Modifier is computed and displayed.

#### FR-4: Penetration
The engine computes Elemental Penetration and Physical Penetration as separate stats. Penetration reduces effective enemy resistance for score calculations.

#### FR-5: Full defensive layer computation
The engine computes each of the following as an independent value:

| Stat | Notes |
|------|-------|
| Health (raw), Health Regen, Health Leech (Life Steal) | Sustain layer 1 |
| Increased Healing Effectiveness | Multiplies all healing received |
| Ward (current pool), Ward Retention (%), Ward Decay Threshold (displayed as flat HP value), Ward/sec | Sustain layer 2 |
| Armor, Armor Mitigation (%) | Physical hit reduction |
| Endurance (%), Endurance Threshold | Reduces all damage below threshold |
| Dodge Chance (%), Dodge Rating | Hit avoidance |
| Parry Chance (%), Parry Rating | Melee hit avoidance (separate from Dodge) |
| Block Chance (%), Block Effectiveness (%) | Shield/off-hand avoidance |
| Glancing Blow | 35% static DR on qualifying hits; boolean presence shown |
| Critical Avoidance (%) | Reduces crit bonus damage received |
| Reduced Bonus Damage from Crits (%) | Secondary crit defence layer |
| Resistances: Fire, Cold, Lightning, Void, Necrotic, Physical, Poison | All capped at 75% base (higher cap via nodes) |

**Consequences:**
- Each stat appears on the Defense tab of the stat sheet with its computed value.
- Resistance values at cap display a visual indicator (gold). Values below cap display the gap needed (e.g., "+7% to cap") in the warning color.

#### FR-6: EHP methodology — tunklab alignment
EHP is computed as three separate values: **EHP vs Hits**, **EHP vs DoTs**, and **EHP vs 1-shots**. The calculation combines Health + Ward + Armor + Resistances + Endurance threshold + Dodge/Parry/Block/Glancing Blow, consistent with the tunklab EHP calculator's methodology. The Defense tab displays all three EHP values.

**Consequences:**
- A build with Ward and full resistances shows meaningfully higher EHP vs Hits than a raw HP comparison would suggest.
- EHP vs DoTs reflects that Dodge/Block do not reduce DoT damage.

#### FR-7: Stable Ward computation
Stable Ward is computed from: Ward Retention (%), Ward Decay Threshold, Ward generation per second, Health Regen, % Current Health Lost/sec, and % Missing Health → Ward/sec conversion (where present in passives/gear). Both Stable Ward and Stable HP at equilibrium are shown on the Defense tab. [ASSUMPTION: % Current Health Lost/sec and % Missing Health → Ward/sec exist as parseable stats in the Season 4 game data]

#### FR-8: Ailment stats
The engine computes Bleed Chance, Ignite Chance, Poison Chance, Freeze Rate, Shock Chance, and Armor Shred Chance as separate offensive stats. Ailment avoidance (Chill immunity, Stun immunity, Bleed immunity) is computed as separate defensive stats. All appear in the Offense and Defense tabs respectively.

#### FR-9: Attribute-derived stats
Strength, Dexterity, Intelligence, and Attunement are tracked as primary stats and shown on the General tab. Phase 4 scope: attribute totals are computed from all sources (passives, gear, idols) and displayed. Direct attribute-to-secondary-stat conversion (e.g., every 8 Attunement → +1 Ward/sec) is implemented only where the conversion ratio exists in game data as a parseable rule. Complex per-class-subskill conversions are deferred to Phase 5. [ASSUMPTION: at least the well-known Attunement → Ward/sec and Strength → armor conversions are in game data in a parseable form]

#### FR-10: Minion stats
Minion Count, Minion Damage Multiplier, Minion HP Multiplier, and Minion Speed are computed from all sources. The Minion tab of the stat sheet is visible only for builds with at least one active minion skill assigned.

#### FR-11: All stats recompute on any build state change
Every stat recomputes immediately on: node allocation/deallocation, gear slot change, affix tier change, idol placement/removal, blessing assignment, condition toggle, character level change, skill level/node change, archetype slider change. No manual recalculate button exists.

---

### 4.2 Stat Source Attribution

**Description:** Any stat row in the Stat Sheet can be hovered to reveal a **Stat Source Breakdown** tooltip listing every Modifier contributing to that stat. Sources are grouped by category (Passive Nodes, Gear, Idols, Blessings, Skills, Conditions) and each line shows the source name and its contribution amount. This directly solves the pain of manually hunting which passive or gear piece provides a stat — particularly for resistance tuning where every percentage point matters. The feature requires the `scoring-core` crate to propagate `ModifierSource` metadata alongside aggregated totals.

**Functional Requirements:**

#### FR-12: ModifierSource tracking in scoring engine
The Rust `scoring-core` crate attaches a `ModifierSource` record to every Modifier as it is consumed during computation. Source records include: `source_type` (passive_node / gear_slot / idol / blessing / skill_node / condition), `source_label` (human-readable name: node name, slot name + affix name, idol placement label, etc.), `value` (the contribution amount), and `modifier_type` (flat / increased / more).

**Consequences:**
- The IPC response for `compute_stats` includes a `stat_sources: HashMap<StatKey, Vec<ModifierSource>>` field alongside the aggregated stat values.
- No performance regression: source tracking is additive metadata collection, not a separate computation pass.

#### FR-13: Stat Sheet hover → Source Breakdown tooltip
Hovering any row in the Stat Sheet triggers a tooltip positioned adjacent to the stat row showing the breakdown for that stat. The tooltip lists all ModifierSources grouped by category:

```
Fire Resistance  75%
────────────────────
Passive Nodes
  • Shadow Cascade cluster    +18%
  • Lich Ascendancy node      +12%
Gear
  • Helm — Fire Resistance T5 +25%
  • Boots — Fire Res suffix   +17%
Blessings
  • Gift of Winter            +18%
Idols
  • Grand Idol (row 1, col 3) +8%
────────────────────
Total before cap              98%  (capped at 75%)
```

**Consequences:**
- The tooltip shows the pre-cap total when the stat is capped, so the user understands how much headroom they have to remove sources.
- If a stat has no sources (value is base-only), the tooltip shows "Base value only."
- Tooltip dismisses on mouse-leave.

#### FR-14: Resistance gap annotation
For resistance stats specifically, the Stat Sheet row displays a delta annotation in the warning color when the value is below cap: e.g., `68% (+7 to cap)`. The Source Breakdown tooltip also shows the cap gap at the bottom.

---

### 4.3 Passive Tree Optimizer (Refined)

**Description:** The existing "Optimize Build" button in the right panel is refined to be strictly a **passive tree optimizer** — it suggests passive node allocations using the current unspent point budget and does not surface gear, resistance, or other out-of-tree recommendations. This resolves the Phase 3 problem where the optimizer returned defensive floor warnings (0% resistances, etc.) that blocked actionable tree suggestions. Suggestion node visualization on the passive tree canvas is overhauled to be unmistakable.

**Functional Requirements:**

#### FR-15: Optimizer scope restriction
The Passive Tree Optimizer produces suggestions of type `passive_node` only. It must not produce suggestions referencing gear slots, resistances, blessings, idols, or any stat not addressable by allocating passive nodes within the current build's unspent point budget.

**Consequences:**
- The defensive floor check result is excluded from the Passive Tree Optimizer output.
- Resistance suggestions only appear in the Complete Build Optimizer (§4.4) when Gear is in scope.

#### FR-16: Empty-budget fallback
If the build has zero unspent passive points, the optimizer returns a message: "No unspent passive points available. Allocate additional points or use the Complete Build Optimizer for a full reallocation analysis."

#### FR-17: Enhanced node highlight visualization
Suggested passive nodes are rendered on the PixiJS canvas with a visually distinct treatment that is immediately legible without hovering:

- **Gold tier** (top quartile efficiency): node ring scales to 1.4× its base size, gold pulsing glow animation (1.8s cycle).
- **Silver tier** (second quartile): node ring scales to 1.2× base, silver steady glow.
- **Dim tier** (third/fourth quartile): node ring scales to 1.05× base, muted blue outline, no animation.
- Suggested nodes on the path-to-target (prerequisite nodes not yet allocated) render with a dashed gold path line connecting them to the nearest allocated node.

**Consequences:**
- A suggested node is visually distinguishable from an available (allocatable) node at a glance without requiring the user to hover each suggestion card.

#### FR-18: Suggestion card → tree cross-highlight
When the user hovers or clicks a suggestion card in the right panel:
- The corresponding node(s) on the passive tree canvas pulse with an intensified highlight.
- A compact breakdown tooltip appears on the canvas near the node showing: node name, point cost, path cost (total points including prerequisites), and per-stat delta breakdown (e.g., "+22% Necrotic Damage, +8% Cast Speed").
- If the tree is currently panned/zoomed away from the suggestion node, the canvas smoothly animates to center it.

**Consequences:**
- The user never has to manually hunt for the suggested node on the tree.

#### FR-19: Suggestion card content
Each suggestion card in the right panel displays: rank number, node name, score delta (e.g., `+4.2`), point cost + path cost (e.g., `2 pts / 4 pts to reach`), and a one-sentence mechanical explanation from Claude referencing the specific delta values.

---

### 4.4 Complete Build Optimizer

**Description:** A new full-screen view accessible from the header navigation as "Complete Build Optimizer." It provides a checkbox-driven **Scope Selector** where the user chooses which build sections to include in the analysis. Each checked section validates its own completeness gate before the run begins; failed gates surface inline red alerts directing the user to what needs to be addressed. When all gates pass, the user launches the optimization run, which displays an **Optimization Orb** animation — tokens representing each checked section orbit inward toward a central orb while analysis runs. Results arrive as a unified ranked suggestion list spanning all checked domains.

**Functional Requirements:**

#### FR-20: Complete Build Optimizer navigation
The header navigation gains a "Complete Build Optimizer" item alongside "Builder," "Gear Optimization," and "Settings." Clicking it replaces the main builder view with the full-screen Complete Build Optimizer. A "Back to Builder" control returns to the builder.

#### FR-21: Scope Selector checkboxes
The Complete Build Optimizer displays a Scope Selector with one checkbox per build section:

| Section | Default | Completeness Gate (if checked) |
|---------|---------|-------------------------------|
| Passive Tree | ✓ checked | ≥ 1 passive point allocated |
| Active Skills | ✓ checked | ≥ 2 skill slots filled |
| Gear | ✓ checked | All 11 gear slots filled |
| Idols | ✓ checked | No minimum — AI may suggest additions even with empty grid |
| Blessings | ✓ checked | ≥ 1 blessing assigned |
| Weaver Tree | ☐ unchecked | Weaver budget > 0 |

**Consequences:**
- Unchecked sections are excluded from the optimization payload and suggestions.
- Each section checkbox shows its current fill status (e.g., "Gear 8/11") as a secondary label.

#### FR-22: Completeness gate validation and inline alerts
When the user clicks "Run Complete Build Optimization," each checked section's completeness gate is evaluated before the analysis begins. Any failed gate renders an inline red alert card below the relevant checkbox:

- Alert card includes the section icon, the failure reason in plain language (e.g., "Gear requires all 11 slots filled — 3 slots are empty"), and a "Go to [Section]" button that navigates the builder's center canvas to the relevant tab.
- The optimization run does not start until all checked gates pass.
- All alerts are shown simultaneously (not sequentially) so the user can see the full picture at once.

**Consequences:**
- The user experience mirrors a form validation pattern: all errors shown at once, each with a direct navigation action.

#### FR-23: Skill suggestion from Popular Builds Database
When the Active Skills section is checked and fewer than 2 skill slots are filled, the gate message includes a "Suggest skills for my build" action. Triggering it queries the **Popular Builds Database** (§4.8) for skill combinations matching the build's current class and mastery, and any skills already assigned. Results are shown as a ranked list of popular skill sets with the current partial match highlighted; the user selects a suggestion to auto-fill their remaining skill slots.

**Consequences:**
- The suggestion does not overwrite skills already assigned.
- If no matching popular build has the same currently-assigned skills, the closest mastery-level match is shown.

#### FR-24: Optimization Orb animation
While the Complete Build Optimization analysis runs (backend computation + Claude narrative), a full-screen animated graphic occupies the center pane:

- A central orb renders in gold/void crystalline aesthetics.
- Each checked section is represented by a token (icon + label) that orbits inward at a randomized rate, "absorbed" into the orb as that section's data is ingested.
- A status text beneath the orb cycles through contextual phrases (e.g., "Evaluating passive efficiency…", "Scoring gear upgrade paths…", "Assembling narrative…").
- Animation is CSS/SVG or PixiJS — implementation team's choice, but must run at 60fps without blocking the IPC responses.

**Consequences:**
- The animation does not block results rendering; as soon as the backend returns partial results, the orb completes and the results panel slides in.

#### FR-25: Unified suggestion output
Complete Build Optimizer results are displayed as a ranked suggestion list organized by domain section headers (Passive Tree / Gear / Idols / Blessings / Active Skills). Within each section, suggestions are ranked by `ΔBuildScore`. Suggestion cards follow the same format as the Passive Tree Optimizer (FR-19) with the addition of a domain badge.

- Passive tree suggestions include path cost and stat deltas.
- Gear suggestions show current item → recommended item, upgrade score delta, and Claude's mechanical reason.
- Idol suggestions show recommended idol type + placement position + affix selection + stat contribution.
- Blessing suggestions show recommended blessing per timeline + delta.

**Consequences:**
- The user can expand/collapse domain sections.
- A "Focus on Passive Tree" shortcut navigates the builder to the passive tree with all Complete Build Optimizer passive suggestions pre-highlighted (same visualization as FR-17).

#### FR-26: Idol AI recommendations
When Idols is in scope and the idol grid has empty cells, the optimization engine recommends specific idol placements: size, placement coordinates, affix selections, and the resulting stat contributions. These appear as idol suggestion cards with a preview of the grid placement.

**Consequences:**
- Idol suggestions reference specific affix IDs and tiers from the idol database.
- Suggested idol placements do not conflict with existing placed idols.

---

### 4.5 Gear System — Item Picker & Affix Picker

**Description:** The gear editor is upgraded with full modal-based item and affix selection. The Item Picker Modal provides a searchable, filterable database browser with item icons and tooltips. The Affix Picker Modal shows affixes organized by Offense/Defense/Utility with full names, stat ranges, and tier selectors. Both modals replace the current inline picker approach. The design follows the Claude Design handoff (`GearEditor.jsx`).

**Functional Requirements:**

#### FR-27: Item Picker Modal
Clicking an empty gear slot or "Swap item" on an equipped slot opens the Item Picker Modal:

- **Sidebar filters:** Rarity (Any / Normal / Magic / Rare / Set / Unique / Legendary), Item Level range slider, Required Tags (damage type tags: Fire, Cold, Void, etc.).
- **Search bar:** Filters by item name or base type in real time.
- **Item grid:** Icon (slot glyph in rarity color) + item name + base type + affix slot count (or unique flavor text for Uniques). Double-click to equip immediately.
- **Selection state:** Single-click selects; confirms via "Equip Item" button or double-click.
- **Hover tooltip:** Hovering an item card shows a tooltip with the item's full stat description (unique text for Uniques; affix slot count + implied affixes for rares).

**Consequences:**
- Item database covers all items for the slot type: normals, magics, rares, set items, uniques, legendaries.
- Selecting an item from the picker equips it with a default affix configuration that can be modified immediately.

#### FR-28: Affix Picker Modal
Clicking "Add Affix" or an existing affix row opens the Affix Picker Modal:

- **Search bar:** Filters affixes by stat name in real time.
- **Grouped list:** Affixes organized under Offense / Defense / Utility section headers. Each affix row shows: name, category tag (e.g., "Defense · max T7"), stat range across all tiers (min–max with unit), and a one-line description of what the affix does (e.g., "Reduces damage taken from critical strikes"). The description must be present for every affix entry in the database.
- **Tier selector:** When an affix is selected, a Tier Pip row appears showing T1–Tmax pips; clicking a pip sets the tier. The live value for the selected tier is displayed (e.g., "T5 → 48–64%").
- **Apply button:** Adds or replaces the affix at the selected tier.

**Consequences:**
- Affixes are filtered to only show valid entries for the slot type (weapon affixes do not appear for boots, etc.).
- The tier pip row uses the same TierPips component established in Phase 3.

#### FR-29: Gear slot — affix pip display
Each equipped gear slot in the paper-doll view shows four affix pips below the item name. Filled pips indicate affixes are present; empty pips indicate available slots. Clicking a pip directly opens the Affix Picker for that affix position.

---

### 4.6 Gear Optimization Screen

**Description:** A full-screen Gear Optimization view accessible from the header nav. Three-column layout: equipped paper-doll (drag-drop targets) | searchable gear database (draggable item cards) | active slot detail and affix editor. AI gear analysis runs from this screen and displays ranked gear swap recommendations in a slide-in panel. Design follows the Claude Design handoff (`GearOptScreen.jsx`).

**Functional Requirements:**

#### FR-30: Three-column gear workspace
The Gear Optimization screen renders:
- **Left column:** Paper-doll with all 11 gear slots as drop targets. Each slot shows equipped item (icon, name, rarity color border) or empty state ("drag to equip").
- **Center column:** Searchable gear database with slot filter pills, rarity filter pills, and a search input. Items render as draggable cards (icon + name + base + affix count/unique text).
- **Right column:** Detail panel for the active slot showing the equipped item's full affix list with tier pips and the Affix Picker integration.

#### FR-31: Drag-and-drop item equip
Items in the gear database are draggable onto paper-doll slots. Dragging an item over a valid slot highlights it in gold; over an invalid slot (wrong type) highlights in red. Dropping equips the item. Double-clicking an item in the database also equips it to its default slot type.

#### FR-32: AI gear analysis
An "Optimize Gear" button triggers the AI gear analysis:
- The payload includes current gear configuration, build score, skill role designations, and archetype weights.
- Results appear in a slide-in panel from the right edge showing ranked gear swap recommendations: current item → recommended item, `ΔBuildScore`, and Claude's mechanical reason per slot.
- Recommendations include only items that exist in the bundled gear database. The optimization payload must include the relevant item catalog subset, and Claude's output is constrained to recommend only item IDs present in that payload.

**Consequences:**
- A gear recommendation that references an item ID not in the payload is rejected by the frontend before display.
- If no database items represent a meaningful upgrade for a slot, that slot is omitted from the recommendation list rather than generating a placeholder suggestion.

---

### 4.7 UI/UX Revamp — Claude Design System

**Description:** All screens are updated to match the Claude Design handoff (`_bmad-output/last-epoch-build-optimizer-UI-Handoff/`). This is a systematic visual and interaction overhaul — not a component-by-component port, but a faithful recreation of the design's visual output in the existing React/Tauri architecture. Components should be rebuilt to match, not wrapping the prototype JSX.

**Functional Requirements:**

#### FR-33: Header navigation
The app header gains top-level navigation items: **Builder** | **Complete Build Optimizer** | **Gear Optimization** | **Settings**. The active item is underlined/highlighted. Keyboard shortcut `Esc` returns to Builder from any full-screen view.

#### FR-34: Left panel — Build identity and section navigator
The left panel is updated to:
- **Active Build card:** Class glyph icon (gold, class-specific), build name, class · mastery subtitle.
- **Class / Mastery selectors** (existing, restyled).
- **Build Sections navigator:** A list of clickable rows for each center-canvas tab (Passive Tree, Weaver, Active Skills, Gear, Idols, Blessings), each showing its current fill count (e.g., "Gear — 8/11", "Blessings — 3/5"). Active tab is highlighted. Completed sections show a gold checkmark. [ASSUMPTION: completion indicators are based on the same gates defined in FR-21]
- **Save Build button** (gold when unsaved changes).
- **Import Build Code** (collapsible).
- **Saved Builds list** (existing, restyled).

#### FR-35: Right panel — Score gauge, archetype, optimizer
The right panel follows the Claude Design:
- **Score Gauge:** 3/4-arc SVG with gradient fill, center shows build score + delta indicator.
- **DMG / SURV / SPD pill trio** below the gauge.
- **Optimization Intent** header with Juggernaut ↔ Glass Cannon slider, zone label (Juggernaut / Bulwark / Balanced / Aggressive / Glass Cannon) in zone color.
- **Fine Tune Weights** (collapsible, existing sliders restyled).
- **Optimize Build button** (gold, pulsing animation when running).
- **AI Suggestions** section with suggestion cards (FR-19 format).
- **Stat Sheet** (tabbed, existing, restyled per design).

#### FR-36: Center canvas tab bar
Tab bar items: Passive Tree | Weaver | Gear | Skills | Idols | Blessings, with badge counts. A visual divider separates the tree tabs (Passive, Weaver) from the context tabs (Gear, Skills, Idols, Blessings). Keyboard shortcuts 1–6 switch tabs.

#### FR-37: Blessing editor — card grid
The Blessing tab renders a two-column card grid. Each card represents one monolith timeline with the timeline name as the header. Active blessing is highlighted in gold with a gold border. Selecting a blessing option highlights it inline — no dropdown.

#### FR-38: Idol editor — tray + grid layout
The Idol tab renders a side-by-side layout:
- **Left: Idol Grid** — 5×4 cell grid with placement rules. Empty cells show "+" on hover when an idol is selected from the tray. Occupied cells show the idol name (abbreviated) in a colored tile scaled to its shape. Clicking an occupied idol removes it.
- **Right: Idol Tray** — Scrollable list of all available idol definitions from the idol database. Each entry shows a shape visualization (proportional rectangle with `W×H` label), idol name, and stat description. A filter input narrows the list. Clicking an idol in the tray selects it as the "placing" idol; subsequent grid cell hover shows a live placement preview overlay. A gold hint bar appears at the bottom of the tray while an idol is selected.
- **Active Idol Stats summary** below the grid.
- **Size-aware cell highlighting:** When an idol is selected from the tray, only cells where the idol physically fits (given its shape and the current grid occupancy) are highlighted as valid drop targets. Cells that would cause an overflow or collision are rendered in the invalid/greyed state and are not clickable while that idol is selected.

**Consequences:**
- The placement preview overlay shows which cells will be occupied before the user commits.
- Clicking anywhere outside the grid while an idol is selected deselects it.

#### FR-39: Status bar
The footer status bar shows: Data version (Season 4 / Shattered Omens + date), unsaved changes indicator (gold dot when dirty), LLM provider + model name.

---

### 4.8 Data Completeness — Skills, Icons, Popular Builds

**Description:** The skills database is extended to cover all 133 Last Epoch skills and their specialization tree nodes. All skill icons are resolved via the existing Rust icon pipeline. A Popular Builds Database (bundled JSON) is authored from maxroll.gg and lastepochtools.com, providing curated skill combinations per class/mastery for the skill suggestion feature (FR-23).

**Functional Requirements:**

#### FR-40: Complete skills database
All 133 Last Epoch skills (Season 4) are present in the skills database with: skill name, class/mastery affiliation, tags (damage type, delivery type), icon reference, and specialization tree node data. The skill picker grid in the Skills tab surfaces all class-appropriate skills for the active mastery.

#### FR-41: Complete skill icons
All skill icons are resolved via the Rust icon pipeline (`get_icon_cache_path`). Skills missing a cached icon fall back to the placeholder glyph. [ASSUMPTION: icon assets can be sourced from the same pipeline used for Phase 2/3]

#### FR-42: Popular Builds Database
A bundled `popular-builds.json` contains at minimum 3 curated popular build configurations per class/mastery combination (covering all 15 masteries), sourced from maxroll.gg and lastepochtools.com. Each entry contains: mastery, skill IDs (5 slots), a build name, and an approximate source URL for attribution.

**Consequences:**
- The database is updated with each game data patch alongside existing game data updates.
- The suggestion flow (FR-23) queries this database client-side with no network request.

#### FR-43: Skills tab — full skill picker
The Skills tab (center canvas) shows a full skill picker grid with icon, name, and tag for each class-appropriate skill. Skills can be assigned to the 5 skill slots. Assigned skills show their specialization point allocation. The existing SkillPickerGrid component is updated to draw from the complete skills database.

---

### 4.9 Multi-Allocate Fix

**Description:** Passive tree node multi-allocation is fixed to match lastepochtools.com behavior. Shift+click fills a node to its maximum points in one action. Right-click removes all points from a node in one action.

**Functional Requirements:**

#### FR-44: Shift+click — fill to max
`Shift+click` on a passive tree node that is partially allocated or available allocates all remaining points up to the node's `max_points` (or remaining budget, whichever is lower) in a single user action.

**Consequences:**
- If the build has 2 unspent points and the node has 3 points remaining, Shift+click allocates 2 points (budget-limited).
- Each batch allocation is recorded as a single undo step (not N individual steps).

#### FR-45: Right-click — remove all
`Right-click` on an allocated passive tree node removes all allocated points from that node in one action. The prerequisite check (child nodes must not require this node) is performed before removal; if removal would orphan allocated child nodes, those nodes are also deallocated in the same action with a confirmation prompt.

**Consequences:**
- The confirmation prompt names the orphaned nodes: "Removing this node will also deallocate: [Node A], [Node B]. Continue?"
- The batch deallocation is a single undo step.

---

## 5. Non-Goals (Explicit)

- **Passive/skill tree node artwork matching Last Epoch's asset style** — node shapes, textures, and visual fidelity to the game's art assets are Phase 5.
- **Background textures and environment art** — stone tile and weaver tile background polish is Phase 5.
- **Weaver Tree full PixiJS renderer** — Phase 4 retains the Weaver placeholder panel unless community Weaver node data becomes available mid-phase; Weaver is opt-in for the Complete Build Optimizer only.
- **Build sharing / export to community sites** — no publishing to maxroll.gg, lastepochtools.com, or any external URL from within the app.
- **Trading / market price integration** — no item pricing from trade sites.
- **Multiplayer / co-op build planning** — single-user only.
- **Mobile / web version** — desktop Tauri app only.
- **Automated test suite expansion** — deferred-work.md test gaps are carried as tech debt; new tests are written for new features only.

---

## 6. MVP Scope

### 6.1 In Scope

- Complete stats engine (FR-1 through FR-11) including all damage types, all defensive layers, EHP/Ward tunklab-aligned methodology
- Stat Source Attribution (FR-12 through FR-14)
- Passive Tree Optimizer refinement — scope restriction, enhanced node visualization, cross-highlight, suggestion card format (FR-15 through FR-19)
- Complete Build Optimizer — header nav, scope selector, completeness gates, orb animation, unified output, idol AI recommendations (FR-20 through FR-26)
- Gear Item Picker Modal and Affix Picker Modal (FR-27 through FR-29)
- Gear Optimization Screen — three-column, drag-drop, AI analysis (FR-30 through FR-32)
- Full UI/UX revamp per Claude Design (FR-33 through FR-39)
- Complete skills + icons database and Popular Builds Database (FR-40 through FR-43)
- Skill suggestion flow from Popular Builds Database when < 2 skills assigned (FR-23)
- Multi-allocate fix: Shift+click fill, right-click remove-all (FR-44, FR-45)

### 6.2 Out of Scope for MVP

- Weaver Tree full renderer — Phase 5 [NOTE FOR PM: revisit if community data lands mid-phase]
- Node shape/texture art matching LE style — Phase 5
- Background environment art (beyond Phase 3 stone tile) — Phase 5
- Build sharing to external sites — Phase 5+
- Trading/market integration — Phase 5+
- Attribute-to-secondary-stat full conversion tables — [ASSUMPTION: attribute totals are shown; full secondary-stat derivation from attributes is complex and deferred unless architecture team judges it straightforward]

---

## 7. Success Metrics

**Primary**

- **SM-1:** Stat Sheet displays all 40+ stats defined in FR-1 through FR-10 with values that agree within ±2% of the tunklab EHP/Ward calculators for identical inputs. Validates FR-1 through FR-7.
- **SM-2:** Stat Source Breakdown tooltip appears within 50ms of hover on any stat row and lists all contributing sources with correct values. Validates FR-12, FR-13.
- **SM-3:** Passive Tree Optimizer returns no suggestions involving gear slots, resistance values, or off-tree stats when at least one unspent passive point exists. Validates FR-15.
- **SM-4:** Complete Build Optimizer runs successfully for a fully-configured build (all 6 sections checked and gated) and returns suggestions spanning at least 3 domains. Validates FR-20 through FR-25.

**Secondary**

- **SM-5:** Item Picker Modal search returns filtered results in < 100ms for queries against the full item database. Validates FR-27.
- **SM-6:** Shift+click batch allocation completes as a single undo step. Validates FR-44.
- **SM-7:** Popular Builds Database covers all 15 masteries with ≥ 3 builds each. Validates FR-42.

**Counter-metrics (do not optimize)**

- **SM-C1:** Optimization Orb animation does not delay result rendering — results must appear within 500ms of the backend returning data regardless of animation state. Counterbalances SM-4.
- **SM-C2:** Stat Source Attribution must not increase `compute_stats` IPC round-trip time by more than 20ms. Counterbalances SM-1, SM-2.

---

## 8. Open Questions

1. **Parry mechanics** — Parry is present in the tunklab EHP calculator as a defensive layer. Does Parry exist as a player-accessible stat in Season 4, or is it enemy-only? If player-inaccessible, drop from FR-5. [Architecture team to verify against game data.]
2. **Affix prefix/suffix discriminator** — `GearItemV2.affixes` currently has no prefix/suffix field (deferred from Phase 3). FR-28 (Affix Picker) and the gear scoring engine both need this. Is adding a `position: 'prefix' | 'suffix'` field to `GearAffixV2` the right fix, or does the architecture team prefer a separate `prefixes[]` + `suffixes[]` structure?
3. **Optimization Orb implementation** — CSS/SVG vs PixiJS for the orb animation (FR-24). PixiJS is already loaded for the passive tree; using it for the orb avoids a second animation library but adds coupling. Architecture team to decide.
4. ~~**Complete Build Optimizer placement**~~ — **Resolved:** Header nav confirmed. The Complete Build Optimizer is a header nav item alongside Builder, Gear Optimization, and Settings (not a center-canvas tab).
5. **Popular Builds Database curation workflow** — FR-42 requires manual curation per patch. Is there a scraping/automation approach worth exploring, or is manual curation the correct Phase 4 approach?
6. **Idol AI suggestion scope** — FR-26 says the AI recommends idol placements including specific affix IDs and tiers. This requires the Claude payload to include the full idol database (or a filtered subset). Token budget implications for the optimization payload need architecture review.

---

## 9. Assumptions Index

- **§4.1 / FR-5** — Parry is a player-accessible stat in Season 4. [See OQ-1]
- **§4.1 / FR-7** — % Current Health Lost/sec and % Missing Health → Ward/sec exist as parseable stats in the Season 4 game data.
- **§4.7 / FR-34** — Build Sections navigator completion indicators use the same gate thresholds as the Complete Build Optimizer (FR-21).
- **§4.8 / FR-41** — Skill icons can be sourced from the same Rust icon pipeline established in Phase 2/3; no new icon pipeline work is required beyond expanding the source set.
- **§6.2** — Attribute-to-secondary-stat full conversion tables are architecturally complex; attribute totals are shown but downstream conversion is deferred unless the architecture team judges it low-effort.
