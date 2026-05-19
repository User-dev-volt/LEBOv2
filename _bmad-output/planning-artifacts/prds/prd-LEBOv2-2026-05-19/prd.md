---
title: "LEBOv2 Phase 3 — Optimizer Intelligence & Full Visual Fidelity"
status: draft
created: 2026-05-19
updated: 2026-05-19
phase: "3 of 3"
supersedes: "Phase 2 PRD (archived at _bmad-output/_phase2-archive/planning-artifacts/prd.md)"
status: final
---

# Product Requirements Document — LEBOv2 Phase 3

**Author:** Alec  
**Date:** 2026-05-19  
**Phase:** 3 of 3  
**Supersedes:** Phase 2 PRD (archived in `_bmad-output/_phase2-archive/planning-artifacts/prd.md`)  
**Status:** Draft

---

## Executive Summary

LEBOv2 Phase 3 is the final evolutionary step that turns LEBO from a polished companion app into the definitive Last Epoch build tool. Phase 2 delivered the bones — full skill trees, item database, structured gear input, the optimization slider, and a working Claude API integration. Phase 3 makes that foundation feel like magic.

Three transformations define this phase:

**Transformation 1 — The Optimizer Gets a Brain.** The current optimization flow sends build context to Claude and hopes for good advice. Phase 3 replaces this with a deterministic scoring engine that encodes Last Epoch's actual damage formula, crit math, and survivability model. The engine runs a per-point efficiency scan on every passive node (Dijkstra-based path scoring), a budget knapsack solver for multi-point allocation, a gear affix scorer, and a cross-domain synergy detector. Claude's role shifts from "guess what's good" to "explain what the math found." The result: suggestions that are verifiably correct, not plausibly worded — and that feel like advice from a world-class theorycrafting partner.

**Transformation 2 — Gear Gets Its Own Intelligence.** A dedicated Gear Optimization screen gives players a full per-slot analysis of their current gear against what their build actually needs. The player designates their skill roles (primary offense, secondary, defensive) so the engine understands damage type context — a Poison build gets Poison-damage affix recommendations, not generic crit suggestions. Every slot is ranked by upgrade priority. Claude produces a plain-English gear wishlist per slot: what affixes to look for, why they matter for this specific build, and which item is the weakest link. This is the "Maxroll loot filter, but generated for your exact build in real time."

**Transformation 3 — The App Looks Like the Game.** Phase 3 completes the visual and data surface that an endgame player expects. Full idol grid builder. Blessings panel. Conditions/buffs simulation context. A live stat sheet (General / Offense / Defense / Minion / Other) that updates in real time on every node allocation, gear change, or idol placement. Tree backgrounds matching the LE aesthetic. Item rarity and damage-type color systems applied canonically throughout. Keyboard shortcuts that match lastepochtools.com conventions. When a player drops into Phase 3 LEBO while theorycrafting, it should feel continuous with the game itself.

**Target users:** Advanced Last Epoch players and theory-crafters who know the game deeply and will immediately notice if suggestions are wrong or visual conventions are off. Phase 3 earns trust from this audience.

---

## Strategic Context

### Where We Stand

LEBO is the only AI-powered build optimizer for Last Epoch. LastEpochTools and LastEpochPlanner are excellent manual planning tools. Maxroll provides expert guides and rule-based loot filters. Neither has suggestions, scoring, or an AI layer. Path of Building (for Path of Exile) is the gold standard for what's possible — per-point efficiency scoring, full stat derivation, a power heatmap on the tree — but it doesn't exist for Last Epoch. Solved Exile (also PoE-only) represents the ceiling: constraint-based AI optimization across tree + gear + skills simultaneously.

Phase 3 closes the gap between LEBO's current state and both of those benchmarks — inside the Last Epoch ecosystem where neither competitor operates.

### The Algorithm Insight

The research is unambiguous: **a better Claude prompt on a naive score produces better-sounding bad advice. A deterministic scoring engine with a simple prompt produces genuinely good advice.** The scoring engine is the asset. Claude is the interface. Phase 3 builds the asset.

### Season 4 Currency

Season 4 (Shattered Omens) launched 2026-03-26. Suggestions based on Season 3 data produce wrong advice about the current meta. Season 4 data update is a prerequisite for Phase 3 optimizer trust, not a feature.

### Expansion Readiness

The Orobyss expansion (targeting late 2026) introduces Paradox Classes — entirely new class mechanics requiring new scoring models. Phase 3's architecture must support pluggable class-specific scoring modules so Paradox Classes can be added without engine rewrites.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Scoring engine latency (full passive scan + gear scoring + synergy detection) | < 100ms local |
| Stat sheet update latency (every node/gear/idol change) | < 16ms (60fps target) |
| Defensive floor check precision | Zero false-positive "cap your resistances" suggestions when resistances are already capped |
| AI suggestion relevance (qualitative) | Expert LE players agree suggestions match what a top builder would recommend |
| Visual accuracy | All 7 item rarity colors and all 7 damage-type colors match LE canonical values exactly |
| Data currency | All optimization outputs reference Season 4 nodes, uniques, and affixes on launch |
| Idol/blessings coverage | All idol slots and all current-season monolith blessings are inputtable |

**Counter-metric:** Suggestions generated per session should not increase without a corresponding quality improvement — more suggestions that are wrong is worse than fewer that are right.

---

## User Journeys

### UJ-1 — The Expert Theorycrafter Gets Real Advice

Marcus is building a Shadow Rend Bladedancer. He has 8 passive points unspent and isn't sure whether to push deeper into the Bladedancer mastery tree or branch into the Rogue base tree for the speed cluster. He opens Phase 3 LEBO, sets his conditions (boss fight, power charges active), and clicks "Optimize." Within 3 seconds:

- The stat sheet updates in real time as he hovers over suggested nodes
- A color-coded heatmap overlay highlights the 5 highest-efficiency unallocated nodes on the passive tree in gold
- The AI suggestion reads: "The Crit Mastery keystone at depth 8 costs 4 total points to reach and would increase your average hit damage by 190% — your current crit chance is already at 82%, so the keystone's full multiplier applies. The Rogue speed cluster is 6 points for 15% movement speed — lower priority for boss content."
- Marcus applies the suggestion with one click. The stat sheet updates immediately.

### UJ-2 — The Gear Optimizer Spots a Mistake

Priya is running a Void Knight build. She notices LEBO's stat sheet shows 63% fire resistance. She checks the Defense tab — there's a Critical-priority suggestion before any offensive suggestions: "Your fire resistance is uncapped at 63% (cap is 75%). You are taking 29% more fire damage than a capped build. This is a non-negotiable fix before any damage investment."

She swaps a ring affix from flat health to fire resistance. The stat sheet updates live — fire res hits 76%, the Critical suggestion disappears, and three Medium-priority passive node suggestions appear below.

### UJ-3 — The Idol Optimizer

David has never used LEBO's idol grid before. In Phase 3 he finds the full idol grid in the context panel — matching the in-game layout exactly. He places his actual idols with the correct affixes and tiers. When he runs optimization, the AI says: "Your 1×3 idol in slot 3 has T2 Endurance Threshold — upgrading to T5 would push you from 28% to 42% endurance threshold, significantly extending your damage reduction window. At your current HP pool this is equivalent to +480 effective HP."

---

## Functional Requirements

### A — Deterministic Scoring Engine

> **Implementation language:** The scoring engine runs in the Rust backend as a Tauri command, consistent with the existing architecture constraint that all backend logic lives in Rust. TypeScript calls it via `invokeCommand<T>()`. The engine's output (ranked suggestion list with delta values) is returned to the frontend for display and passed to the Claude API call.

**A.1 — Build Score Function**

FR-A1: The app computes a `DamageScore` using the Last Epoch damage formula: `Base × (1 + Σ Increased%) × Π More%` where Increased modifiers are summed additively and More modifiers are applied multiplicatively in sequence.

FR-A2: The app computes crit-weighted average damage as: `Hit × [(CritMulti × CritChance) + (1 × (1 - CritChance))]` where `CritMulti = 200% + Σ AdditionalCritMulti%` and `CritChance` is capped at 100%.

FR-A3: The app computes a `SurvivabilityScore` as effective HP: `HP × (1 + WardRatio) × EnduranceReduction`, with a bonus multiplier for each active defensive layer beyond 2 (endurance, Ward, resistances capped, crit avoidance capped, sustain layer).

FR-A4: The app computes a `SpeedScore` from: movement speed %, attack/cast speed, and AoE coverage modifier.

FR-A5: The app combines scores into a composite `BuildScore = w_dmg × DamageScore + w_surv × SurvivabilityScore + w_speed × SpeedScore` using archetype weights derived from the player's Glass Cannon ↔ Juggernaut slider position and fine-tune overrides.

FR-A6: Every passive node effect and every affix entry in the game data includes a `modifierType` field: `"increased"`, `"more"`, or `"flat"`. This annotation drives the scoring engine — `"more"` modifiers apply multiplicatively, `"increased"` additively. Without this field the scoring engine falls back to treating the modifier as `"increased"`.

**A.2 — Defensive Floor Check**

FR-A7: Before generating any optimization suggestion, the app performs a defensive floor check on the current build:
  1. All elemental resistances ≥ 75% (cap)
  2. Crit avoidance ≥ 80%
  3. At least one active sustain mechanism (life leech, Ward generation, or life regeneration ≥ 100/s)

FR-A8: Any defensive floor failure produces a `Critical`-priority suggestion that ranks above all offensive suggestions, regardless of the player's archetype weight settings. The Critical suggestion names the specific gap and the specific fix (e.g., "Fire resistance is 52% — cap requires +23%. Helm slot has room for a Fire Resistance suffix at T5").

**A.3 — Passive Tree Efficiency Scan**

FR-A9: For every unallocated passive node, the app computes `Efficiency(node) = ΔBuildScore(path) / EffectivePointCost(path)` where `EffectivePointCost` = the node's own point cost plus the total cost of all unallocated prerequisite nodes on the shortest path from current allocation to that node.

FR-A10: The path ΔBuildScore is the sum of score contributions from all nodes on the path (not just the target node), rewarding paths where intermediate nodes also have value.

FR-A11: The efficiency scan is implemented as a modified shortest-path traversal on the tree graph, targeting O(N log N) for N unallocated nodes.

FR-A12: `"more"` damage modifier nodes receive a 3–5× scoring weight multiplier relative to an equivalent `"increased"` node when the build already stacks significant Increased% (threshold: Σ Increased% > 200%), reflecting their exponentially higher effective value.

FR-A13: Mastery depth bonus: nodes at depth 7–10 in the mastery sub-tree receive a 1.2× efficiency multiplier, reflecting that the highest-value LE nodes are concentrated in the mastery's deep tier.

**A.4 — Budget Knapsack Solver**

FR-A14: When the player has N unspent points (N > 1), the app uses a two-phase solver: (1) greedy shortlist of top 20 highest-efficiency candidate paths; (2) bounded knapsack DP over the shortlist to find the globally optimal set of path allocations within budget N.

FR-A15: The solver output is an ordered list of node allocations (cheapest-first path ordering) that maximizes BuildScore for the given budget.

**A.5 — Gear Affix Scorer**

FR-A16: The app computes a dynamic affix weight: `Weight(affix, build) = ΔBuildScore when this affix is present at T5` — injecting each affix into the current build and measuring the score delta. Weights are cached per build state and invalidated on class, mastery, skill assignment, or skill role designation change.

FR-A17: For each gear slot, the app ranks all possible affixes by `Weight × TierValue` and identifies the 2 best prefix + 2 best suffix combinations as the "ideal" configuration for that slot. Rankings are skill-context-aware: affix weights account for the build's active skill damage types (e.g., a Poison build's affix scorer weights Poison-damage affixes and ailment-scaling prefixes highly regardless of generic damage score contributions).

FR-A18: The gap between a slot's current affix configuration and its ideal configuration produces an `UpgradeScore` per slot. Slots are ranked by UpgradeScore to identify upgrade priority order.

FR-A19: The affix scorer recognizes skill damage delivery types (melee / ranged / spell / minion) and damage element types (fire / cold / lightning / void / physical / poison / bleed) from the active skill configuration. Affixes that do not apply to the build's delivery type or damage element receive a zero weight (e.g., "Melee Critical Strike Chance" on a spell-only build scores 0, not some fraction of generic crit value).

**A.6 — Cross-Domain Synergy Detector**

FR-A20: The app detects zero-value passive allocations: nodes that are allocated but whose bonuses never apply to the build's active skills (e.g., melee damage nodes on a caster build, mana nodes on a build with no mana costs). These are flagged as Medium-priority reallocation suggestions.

FR-A21: The app detects mismatched affix types: gear affixes whose scope doesn't match the active skill's damage delivery type (e.g., "Melee Critical Strike Chance" on a ranged attack build). These are flagged as High-priority replacement suggestions with the correct affix scope identified.

FR-A22: The app detects synergy enabler thresholds: cases where a build-enabling unique item (Exsanguinous, Bleeding Heart, Omnividence, etc.) would change the archetype score by >30% if certain stat thresholds were met. These are surfaced as a special "Game-Changer" suggestion tier explaining what threshold is needed and how close the build is.

**A.7 — Claude Narrative Layer**

FR-A23: The optimization payload sent to Claude includes: the full ranked suggestion list with `ΔBuildScore`, `EffectivePointCost`, synergy flags, and the specific numerical context for each suggestion (e.g., current crit chance, exact resistance gap, node ID and path).

FR-A24: Claude's output is a natural-language explanation for each suggestion that references the specific delta values and explains the mechanical reason behind the priority (e.g., "Your crit chance is already 82% — the Crit Mastery keystone's multiplier lands on nearly every hit, making those 4 path points worth 190% average damage gain").

FR-A25: Claude's role is narrative generation only — the suggestion list, priority order, and delta values are produced deterministically by the engine. Claude does not reorder or invent suggestions.

**A.8 — Node Efficiency Overlay**

FR-A26: After an optimization run, the passive tree canvas displays a color-coded overlay on every unallocated node indicating its per-point efficiency tier: gold = top quartile (highest value), silver = second quartile, dim = third/fourth quartile (low value or unreachable within budget).

FR-A27: Nodes already at the suggestion cap (no remaining unspent points) show no overlay.

FR-A28: The overlay is toggleable via a button in the tree controls area; it defaults to on when suggestions are present.

---

### B — Live Stat Sheet

FR-B1: The right panel adds a stat sheet section with five tabs: **General**, **Offense**, **Defense**, **Minion**, **Other**.

FR-B2: **General tab** displays: character level, total passive points spent vs. available (per mastery), per-skill levels and skill points spent vs. available, class and mastery name.

FR-B3: **Offense tab** displays: computed DamageScore, average hit damage (base), average hit damage (crit-weighted), critical strike chance %, critical strike multiplier %, attack speed or cast speed (per active skill), AoE modifier.

FR-B4: **Defense tab** displays: effective HP, raw HP pool, Ward (if applicable), endurance % and endurance threshold, armor value, all resistances (fire, cold, lightning, void, poison, physical), crit avoidance %, dodge chance %.

FR-B5: **Minion tab** displays minion-relevant stats (minion count, minion damage multiplier, minion HP multiplier) for builds with active minion skills; tab is hidden for builds with no minion skills.

FR-B6: **Other tab** displays: movement speed %, cooldown recovery speed, mana pool and mana regen, resource-specific stats relevant to the active build.

FR-B7: All stat sheet values recompute in real time on every state change: node allocation/deallocation, gear slot change, affix tier change, idol placement, blessing assignment, condition toggle, character level change, skill level change. No "Recalculate" button exists.

FR-B8: When an AI suggestion is previewed (hover on suggestion item), all affected stat sheet values show a before/after delta: gains in green `(+X%)`, losses in red `(-X%)`, unchanged values in neutral. Delta display disappears when hover ends.

---

### C — Idol Grid Builder

FR-C1: The context panel includes an idol grid that matches the Last Epoch in-game idol grid layout — the correct number of slots and valid slot positions for each idol size type.

FR-C2: Players can place an idol in any slot by selecting its size type (1×1, 1×2, 1×3, 2×2) and verifying it fits within the grid's valid placement rules.

FR-C3: Each placed idol supports up to one prefix and one suffix affix selected from the idol affix database. Both prefix and suffix are required for idol types that mandate both (matching in-game behavior).

FR-C4: Idol affix selection respects size and type restrictions — only affixes valid for that idol type and size are shown in the picker.

FR-C5: Idol affix tiers are selectable (T1 through the affix's maximum tier), consistent with the gear slot tier picker pattern.

FR-C6: Idol stats are included in all stat sheet calculations — HP, resistances, and damage affixes from idols contribute to the scoring engine's input.

FR-C7: Full idol context (slot position, idol size, affix IDs, tiers) is passed to the AI optimization engine as structured context, enabling idol-specific suggestions (e.g., "upgrade this idol affix from T2 to T5 for +14% effective HP").

FR-C8: Players can clear individual idol slots or reset the full grid. Clearing a slot removes its stat contributions immediately.

FR-C9: The idol database is bundled with the application and follows the same staleness-check pattern as the item and game data systems.

---

### D — Blessings Panel

FR-D1: The context panel includes a Blessings section where players can assign up to one blessing per monolith timeline (matching in-game rules).

FR-D2: The blessings database contains all current LE monolith timeline blessings with their stat effects (resistance values, damage multipliers, HP bonuses, etc.).

FR-D3: Blessing selection uses a searchable dropdown organized by timeline, drawing from the blessings database.

FR-D4: Active blessings contribute to the stat sheet as permanent additive bonuses — their effects are included in resistance totals, damage calculations, and EHP.

FR-D5: The blessings database is updatable via the existing staleness check system when new timelines or blessing values are patched.

---

### E — Conditions / Buffs Panel

FR-E1: A Conditions panel is accessible from the context panel or a dedicated tab. It allows players to set simulation context used by the scoring engine.

FR-E2: Universal conditions include: enemy type (standard mob / rare / unique boss / pinnacle boss), enemy elemental resistances (as % values for relevant damage types), active charge counts (frenzy, power, endurance) up to maximum.

FR-E3: Build-specific conditions are shown only when relevant passives or skills are active in the build: e.g., "Is enemy Hexed?" appears only for builds with hex application; "Is Sigil of Hope active?" appears only for Paladin builds.

FR-E4: Condition values are used by the scoring engine to produce context-accurate DamageScore and SurvivabilityScore. A Shadow Rend build set to "boss fight, power charges ×3" produces different expected outputs than the same build at default conditions.

FR-E5: Condition values are included in the Claude optimization payload so AI suggestions can reference the combat context (e.g., "This node is strongest in boss scenarios, which matches your current Conditions setup").

---

### F — Visual & UX Polish

**F.1 — Item Rarity Color System**

FR-F1: All item names, item tooltips, and affix listing headers use Last Epoch's canonical rarity color system:
  - Common: off-white (#E8E8E8)
  - Magic: blue (#5B9BD5)
  - Rare: yellow (#D4AF37)
  - Unique: orange (#E87722)
  - Set: green (#4CAF50)
  - Exalted: purple (#9C27B0)
  - Legendary: red (#C62828)

FR-F2: Unique and Set items in the gear slots display their item name in the correct rarity color. Affix entries on unique items are presented as read-only (matching in-game: unique item stats are fixed).

**F.2 — Damage Type Colors**

FR-F3: All stat sheet values and tooltips that reference damage or resistance values use LE's canonical damage-type color coding:
  - Physical: off-white (#D0D0D0)
  - Fire: orange-red (#E85D2A)
  - Cold: ice-blue (#5BC8E8)
  - Lightning: yellow (#F0D020)
  - Void: purple (#A050D0)
  - Poison / Necrotic: green (#50B840)
  - Bleed / Armor Shred: red-brown (#A03030)

**F.3 — Tree Backgrounds**

FR-F4: The passive tree canvas renders a dark stone/obsidian-textured background (deep charcoal gradient or tiled texture) that matches the LE in-game passive tree aesthetic. The background is a static asset — it does not rerender on every frame.

FR-F5: Each active skill tree canvas renders a background tinted by the skill's primary damage type tag from the game data. The tint palette is: FIRE → warm amber overlay (`rgba(180, 80, 20, 0.18)`), COLD → cool blue overlay (`rgba(40, 100, 180, 0.18)`), LIGHTNING → pale yellow overlay (`rgba(180, 160, 20, 0.18)`), VOID → deep purple overlay (`rgba(80, 20, 140, 0.18)`), POISON → green overlay (`rgba(30, 120, 40, 0.18)`), PHYSICAL / MELEE / UNKNOWN → neutral dark (no tint, same as passive tree background). The base layer in all cases is the same dark stone texture as the passive tree (FR-F4); the tint is a semi-transparent color layer on top.

FR-F6: The Weaver Tree canvas renders a distinctive background with a purple/void aesthetic, visually distinct from the passive and skill tree backgrounds.

**F.4 — Interaction Polish**

FR-F7: `Ctrl+Z` / `Ctrl+Y` (Windows) and `Cmd+Z` / `Cmd+Y` (macOS) are bound to undo/redo. Visible undo (↩) and redo (↪) icon buttons appear in the tree controls bar alongside the existing reset button.

FR-F8: Keyboard shortcut `C` focuses the context panel (gear / idols / blessings), `S` focuses the active skill tree, `P` focuses the passive tree. These are global shortcuts active when no text input is focused.

FR-F9: Node tooltips that overflow the visible viewport are scrollable in place (mouse wheel scrolls the tooltip content) rather than clipping or expanding the layout.

FR-F10: `Shift+click` on a passive tree node allocates multiple points in one action (up to the node's maximum or remaining budget, whichever is lower), matching lastepochtools.com behavior.

---

### G — Season 4 Game Data Update

FR-G1: The bundled game data is updated to Last Epoch Season 4 (Shattered Omens, released 2026-03-26). This includes: all new and updated passive tree nodes, new unique items and set items, updated affix tables (including Rune of Corruption affix entries), new and updated skill specialization tree nodes.

FR-G2: The Season 4 data ingestion pipeline ensures every passive node effect and affix entry includes the `modifierType` and `scope` fields required by the scoring engine (see FR-A6 for the full field spec). This is the same data augmentation task as FR-A6 — it must be complete before any scoring engine development begins. The source for these fields is the lastepochtools.com build planner and database.

FR-G3: The game data version string in `manifest.json` reflects Season 4. The existing staleness check system surfaces an update prompt to players running older data.

FR-G4: Season 4 idol data (if new idol types or affix entries were added in S4) is included in the idol database bundle.

FR-G5: Season 4 blessings (any new monolith timelines or blessing updates in S4) are included in the blessings database bundle.

---

### H — Gear Optimization Screen

The Gear Optimization screen is a dedicated view (accessible via the app header, alongside the main build view and settings) that surfaces the full gear analysis in a format built for decision-making — separate from the main build view so it doesn't interrupt the tree-allocation workflow.

**H.1 — Skill Role Designation**

FR-H1: Before the gear analysis can run, the player designates roles for their active skill slots: **Primary Offense** (the main damage skill), **Secondary Offense** (supporting damage skill, optional), **Defensive** (the survival skill, optional), and **Utility** (movement/buff/debuff, optional). At minimum, one skill must be designated Primary Offense.

FR-H2: Skill role designations are saved with the build and persist across sessions. They do not affect passive tree optimization or the main optimization flow — they are context only for the Gear Optimization screen.

FR-H3: The Gear Optimization screen prompts for skill role designations if none are set. Once set, roles are displayed and editable at the top of the screen.

**H.2 — Full Build Snapshot**

FR-H4: When the player opens the Gear Optimization screen (or clicks "Analyze Gear"), the app captures a full build snapshot: active skills with their role designations, passive tree allocations, current gear (all 12 slots including weapons and rings), idols, blessings, active conditions, character level, and slider position.

FR-H5: The snapshot is passed to the scoring engine to compute per-slot `UpgradeScore` (from FR-A18) and per-affix `Weight` (from FR-A16) using the skill-role-aware affix scorer.

**H.3 — Weakest Slot Detection**

FR-H6: The app ranks all equipped gear slots by `UpgradeScore` (highest gap between current configuration and ideal). The slot with the highest UpgradeScore is flagged as the **Priority Upgrade** slot with a visual indicator.

FR-H7: The upgrade priority ranking is displayed as an ordered list of all 12 gear slots, showing each slot's current score efficiency (e.g., "Weapon: 73% of ideal", "Boots: 41% of ideal") so players can see at a glance where to focus crafting or trading effort.

FR-H8: Unique and set items that are correct for the build (their special effects contribute positively to BuildScore) are flagged as "correct — keep" regardless of affix scores, since their unique effects are not replaceable by stat sticks.

**H.4 — Per-Slot Gear Wishlist**

FR-H9: For each gear slot, the app displays the ideal affix wishlist: the top 2 prefix and top 2 suffix recommendations ranked by weight, with each affix labeled by its tier target (e.g., "T5+ Added Critical Strike Multiplier", "T4+ Hybrid Health").

FR-H10: Each recommended affix includes a brief mechanical reason drawn from the scoring context — why this affix specifically matters for this build. This context is passed to Claude alongside the structured affix data.

FR-H11: When the current gear item already has a recommended affix, the slot shows that affix as satisfied (e.g., checked off) and highlights which recommended affixes are still missing or below target tier.

FR-H12: The wishlist distinguishes between prefix and suffix recommendations per slot, matching LE's crafting system (2 prefix + 2 suffix per item).

**H.5 — Claude Gear Narrative**

FR-H13: Claude generates a gear analysis narrative for the full build — not slot-by-slot boilerplate, but a prioritized story: "Your weakest item is your Amulet (42% of ideal). You're a Poison Bladedancer — the Amulet should be your primary Crit Chance source, but yours has zero crit. A T5 Critical Strike Chance prefix alone would increase your average damage by 22%. Your boots are correctly slotted with movement speed; the only upgrade there is Tier on the secondary affix."

FR-H14: Claude's narrative references the player's designated Primary Offense skill by name throughout — "your Poison Eruption build" or "with Shadow Rend as your primary" — so the output feels personalized to the actual build, not generic.

FR-H15: Claude identifies any build-enabling unique items that would be upgrades given the current build state (from FR-A21's synergy enabler detection), surfaced in the narrative as "Game-Changer" recommendations with a brief explanation of what they enable.

**H.6 — Slider-Aware Output**

FR-H16: All gear recommendations are weighted by the current Glass Cannon ↔ Juggernaut slider position. A player at full Glass Cannon sees offensive affix recommendations prioritized in the wishlist; a player at full Juggernaut sees defensive affixes (Hybrid Health, Endurance Threshold, Resistances) move to the top of every slot's ranking.

FR-H17: The gear narrative explicitly calls out the archetype context: "Since you're optimizing toward Glass Cannon, I've prioritized offensive affixes. If you shift toward Juggernaut, Hybrid Health and Endurance Threshold would move to the top of every slot."

---

## Non-Functional Requirements

**Performance**

NFR-1: The scoring engine (defensive floor check + passive tree efficiency scan + gear affix scoring + synergy detection) completes in < 100ms for a full build evaluation on target hardware. Claude API latency (2–5s) remains the only user-perceived bottleneck.

NFR-2: Stat sheet recalculation on any single state change (node click, affix tier change, condition toggle) completes in < 16ms to support smooth 60fps updates during node allocation.

NFR-3: Node efficiency overlay rendering adds no more than 2ms to the tree's frame render time — backgrounds and overlays are precomputed assets or display-list operations, not per-frame computation.

**Architecture & Resilience**

NFR-4: All stat values, scoring weights, modifier thresholds, and defensive floor thresholds are data-driven — sourced from game data files at runtime, never as numeric constants in source code. This is the primary mechanism for season-over-season accuracy without code changes.

NFR-5: The scoring engine is structured to support pluggable class-specific scoring modules. When Paradox Classes ship, adding a new class scoring module must not require modifying the base scoring engine. The interface for class modules is documented.

NFR-6: The idol grid layout and valid placement rules are encoded in the bundled idol data, not hardcoded in UI logic. New idol types added by EHG in future patches can be supported by updating the data file, not the component.

NFR-7: The blessings and conditions databases follow the same staleness-check and update pipeline as the existing game data and item database systems.

**Quality**

NFR-8: The damage scoring formula and crit math have dedicated unit tests verifying results against known-correct examples from Maxroll.gg. Any formula regression fails CI.

NFR-9: The defensive floor check has unit tests covering all failure conditions: each uncapped resistance type, crit avoidance below threshold, and no sustain layer present.

NFR-10: All new interactive UI components (idol grid, blessings picker, conditions panel, stat sheet tabs) pass axe-core accessibility checks. CI continues to fail on any new `axe` violation.

**Platform & Distribution**

NFR-11: Platform targets are maintained: Windows 10/11 (.msi) and macOS 12+ (.dmg). No new platform targets are added in Phase 3.

NFR-12: All Phase 3 features must function fully offline. No network calls are required for scoring, stat display, idol/blessings input, or conditions setup. The Claude API call remains the only network operation.

---

## Out of Scope (Phase 3)

The following are explicitly deferred to post-Phase 3:

- **Specific item replacement recommendations** — the Gear Optimization screen tells players what affixes and affix tiers to look for per slot, but does not traverse the item database to name a specific item ("equip Exsanguinous instead of your current chest"). Named item recommendations require a full item search that is a Phase 4 capability.
- **Idol combinatoric optimization by AI** — the idol grid (Epic C) gives the scoring engine idol context, but the AI does not run a knapsack solver over idol grid combinations to recommend ideal idol placement. Idol optimization is Phase 4.
- **Loot filter export** — Phase 3's affix scorer provides the groundwork, but generating downloadable Maxroll-style loot filter files is out of scope.
- **Build sharing / import from URL** — import from lastepochtools.com, pastebin, or live API is not in scope.
- **Compare Trees** — named tree variants and side-by-side comparison is not in scope.
- **Full Calcs tab (derivation chains)** — the stat sheet shows derived totals, not the full computation chain (PoB-style "red text for unsupported mods").
- **Paradox Classes** — architecture is prepared for them (pluggable modules, NFR-5), but no Paradox Class scoring module ships in Phase 3.
- **Mobile / web version** — desktop Tauri only.

---

## Open Questions

~~OQ-1: **Modifier type annotation source**~~ — **RESOLVED:** Modifier type data is available via lastepochtools.com and their build planner database. This is a data ingestion task (sourcing from the community DB), not a manual annotation task. FR-A6 / FR-G2 implementation should pull from this source.

~~OQ-2: **Skill-specific damage type detection**~~ — **RESOLVED (partial):** `SkillEntry.type: 'spell' | 'melee' | 'ranged' | 'unknown'` already exists in gameData.ts — delivery type is covered. Node damage element types (PHYSICAL, POISON, BLEED, etc.) are already present in node effect `tags[]` in all class JSON files. **Gap:** `modifierType` (increased/more/flat) is absent from both nodes and affixes; affix scope/delivery type is also absent from the affixes schema. Both gaps are resolved by the same data ingestion task as OQ-1 — sourcing from lastepochtools DB and augmenting the existing affix and node records. One data engineering task covers FR-A6, FR-A19, FR-G2.

OQ-3: **Idol grid layout data** — Does the current bundled data include the idol grid layout (valid positions per size type)? The community planner (lastepochtools.com) models this. Need to verify the data source before Epic C implementation. [Owner: Alec, resolve before Epic C implementation]

OQ-4: **Tree background assets** — Will tree backgrounds be CSS gradients/patterns or image assets? Image assets have higher fidelity but require a sourcing decision (original art vs. community assets vs. in-game texture extraction via the existing icon pipeline). [Owner: Alec, design decision before Epic F]

OQ-5: **Weaver Tree data status** — Phase 2's Story 4.3 (Weaver Tree renderer) was conditional on a research spike. Is the Weaver Tree fully rendered in the current codebase, or is FR-F6 (Weaver background) applied to a placeholder? [Owner: Alec, verify before Epic F]
