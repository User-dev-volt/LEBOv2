---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'domain'
research_topic: 'Last Epoch Build Optimization - Min-Maxing Algorithms & Game Mechanics'
research_goals: 'Understand how top builders min-max skills, affixes, items, and skill trees in Last Epoch; develop a smart AI algorithm that maximizes budgeted skill points based on player goals (Glass Cannon vs Juggernaut); identify best-bang-for-buck affixes, items, and skill tree paths'
user_name: 'Alec'
date: '2026-05-19'
web_research_enabled: true
source_verification: true
---

# Research Report: domain

**Date:** 2026-05-19
**Author:** Alec
**Research Type:** domain

---

## Research Overview

[Research overview and methodology will be appended here]

---

<!-- Content will be appended sequentially through research workflow steps -->

## Domain Research Scope Confirmation

**Research Topic:** Last Epoch Build Optimization - Min-Maxing Algorithms & Game Mechanics
**Research Goals:** Understand how top builders min-max skills, affixes, items, and skill trees in Last Epoch; develop a smart AI algorithm that maximizes budgeted skill points based on player goals (Glass Cannon vs Juggernaut); identify best-bang-for-buck affixes, items, and skill tree paths

**Domain Research Scope:**

- Top Build Meta Analysis — Study Maxroll.gg & LastEpochTools top builds
- Affix & Suffix Value Tiers — Best bang-for-buck stats and tier scaling
- Skill Tree ROI Analysis — High-value multiplier nodes, keystones, breakpoints
- Archetype Mechanics — Glass Cannon vs Juggernaut stat priorities
- Smart Optimization Algorithm Patterns — Constraint-based point allocation techniques
- Budget-Constrained Skill Point Algorithms — DP, greedy weighted scoring approaches

**Research Methodology:**

- All claims verified against current public sources
- Multi-source validation for critical domain claims
- Confidence level framework for uncertain information
- Comprehensive domain coverage with industry-specific insights

**Scope Confirmed:** 2026-05-19

---

## Part 1 — Domain Analysis: How Last Epoch Builds Actually Work

### 1.1 The Damage Formula — The Foundation of Everything

Last Epoch uses a two-tier damage scaling system. Understanding this is prerequisite to any smart optimizer:

**Base Formula:**
```
Final Damage = Base Damage × (1 + Σ Increased%) × Π More%
```

- **"Increased" modifiers** are **additive** with each other — they sum before being applied.
- **"More" modifiers** are **multiplicative** — each one stacks as a separate multiplier on top of everything else.

**Why this matters for optimization:** Adding a 100% "Increased" bonus to a build already stacking 500% Increased gives only ~17% effective damage increase. Adding a 50% "More" modifier on the same build gives a full 50% increase. **"More" modifiers are exponentially more valuable the more "Increased" the build already has.** Any optimizer must evaluate modifiers in the context of the build's existing modifier stack.

_Source: [Damage Calculations Explained — Maxroll.gg](https://maxroll.gg/last-epoch/resources/damage-explained), [Understanding Bonus Damage — ZLeague](https://www.zleague.gg/theportal/understanding-bonus-damage-in-last-epoch-additive-vs-multiplicative-explained/)_

---

### 1.2 Critical Strike — The Premier Damage Multiplier

**Crit Chance Formula:**
```
Crit Chance = (5% + Flat Crit) × (100% + Σ Increased Crit%)
```
Cap: **100%** — overcapping provides zero benefit.

**Crit Multiplier Formula:**
```
Crit Multiplier = 200% + Σ Additional Crit Multi%
```
Default: every crit deals **2× damage**.

**Average Hit Formula:**
```
Avg Damage = Hit × [(Crit Multi × Crit Chance) + (1 × (1 - Crit Chance))]
```

**Key insight for the optimizer:** A crit-based build hitting 50% crit with 200% multi does 50% more average damage than a non-crit build. A build at 100% crit with 400% multi does 4× more damage — this is the endgame ceiling for pure glass cannon. The breakpoint where investing in crit multi outpaces investing in crit chance is calculable: once crit chance is capped at 100%, every additional crit multi point is pure multiplicative DPS gain.

_Source: [Critical Strike — Last Epoch Wiki](https://lastepoch.fandom.com/wiki/Critical_Strike), [Definitive Crit Formula — LE Forums](https://forum.lastepoch.com/t/definitive-critical-strike-chance-formulae/74691)_

---

### 1.3 The Defense Layer System — How Juggernaut Builds Are Built

Last Epoch has **layered defense** — no single defensive stat is sufficient. Top survivability builds stack multiple layers simultaneously:

| Layer | Mechanic | Notes |
|-------|----------|-------|
| **Health** | Raw HP pool | Baseline; all other layers key off it |
| **Ward** | Absorbs damage before HP; decays over time | Enabled by Exsanguinous unique; can exceed HP |
| **Endurance** | Damage reduction when below Endurance Threshold | 20% baseline DR up to **60% max** when below threshold |
| **Endurance Threshold** | % of max HP below which Endurance activates | Default = 20% of max HP; scales with gear |
| **Resistances** | % damage reduction per element | Standard cap behavior (typically 75%) |
| **Armour** | Physical damage reduction | Scales non-linearly; soft DR cap behavior |
| **Dodge** | Chance to avoid hits entirely | Diminishing returns at high values |
| **Block** | Chance to block (Sentinel only) | Converts to 0 damage on block |
| **Crit Avoidance** | % chance to convert enemy crits to normal hits | Caps at 100%; **strongly recommended** for HC/deep corruption |
| **Glancing Blow** | Reduces damage from hits that would have been crits | Stackable from passive tree + Dusk Shroud |

**Meta defense rule:** Top builds always cover **at minimum 3 defensive layers**. Even glass cannons typically cap resistances + crit avoidance + endurance before pushing damage further.

**Juggernaut profile:** Health stacking + max Endurance (60%) + capped Crit Avoidance (100%) + capped Resistances. Gear prioritizes hybrid health, endurance, and resistance affixes.

**Glass Cannon profile:** Crit chance to cap + Crit Multi stacking + resistance capping. Often runs Ward generation as the "health" layer (Exsanguinous + Last Steps of the Living) so the ward pool is enormous but defensive investment is minimal.

_Source: [Defenses Explained — Maxroll.gg](https://maxroll.gg/last-epoch/resources/defenses-explained), [Defense Guide — Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3172283743), [Defense for Beginners — Maxroll.gg](https://maxroll.gg/last-epoch/getting-started/defenses-for-beginners)_

---

### 1.4 S-Tier Affixes — Best Bang-for-Buck by Category

**Offensive Affixes (S-Tier):**

| Affix | Type | Why It's S-Tier |
|-------|------|-----------------|
| **Added Critical Strike Multiplier** | Prefix | T7 is BiS weapon stat for any crit build; pure multiplicative damage |
| **Increased Critical Strike Chance** | Prefix | Required to reach 100% crit cap; unlocks full multiplier value |
| **Adaptive Spell Damage** | Prefix | Scales with your highest damage stat; universally strong on casters |
| **Increased [Skill-Specific] Damage** | Prefix | When it matches your main skill, often a "more" category |
| **Melee/Spell Crit Chance** (slot-specific) | Prefix | Cheaper to craft, same effect as general crit within scope |

**Defensive Affixes (S-Tier):**

| Affix | Type | Why It's S-Tier |
|-------|------|-----------------|
| **Hybrid Health** (`% of Max Health as Flat Bonus`) | Suffix | Multiplicatively better than flat health at high HP |
| **Endurance Threshold** | Suffix | Extends your damage reduction window |
| **Resistances** (All or elemental) | Suffix | Required for all non-trivial content |
| **Critical Strike Avoidance** | Suffix | Near-mandatory; 100% cap makes it binary value |
| **Movement Speed** | Suffix (Boots only) | Unique to slot; always S-tier on boots |

**Affix Tier System:**
- Tiers 1–5: Craftable via Rune of Refinement on Magic/Rare items
- Tiers 6–7: **Exalted items only** (drop-only, cannot be crafted to)
- T7 crit multiplier on a weapon = the single most coveted affix slot in endgame

**Slot-Specific Priority Matrix:**
- **Weapon:** T7 Crit Multi + Crit Chance (offensive builds)
- **Helm:** Hybrid Health + Resistance
- **Chest:** Hybrid Health + Resistance + Endurance Threshold
- **Gloves:** Crit Multi + Attack/Cast Speed
- **Belt:** Hybrid Health + Resistance
- **Boots:** Movement Speed (mandatory) + Health + Cooldown Recovery
- **Amulet:** Crit Chance + Adaptive Spell Damage (or build-specific offensive)
- **Rings:** Resistances + Health or offensive stats

_Source: [Last Epoch 1.0 Affix Tier List — AOEAH](https://www.aoeah.com/news/3172--last-epoch-10-affix-tier-list--ranking-best-endgame-affixes-in-le-10), [Critical Strike Multiplier DB — LastEpochTools](https://www.lastepochtools.com/db/prefixes/AAzBsQ)_

---

### 1.5 Build-Enabling Unique Items — The Build Definers

Certain unique items don't just provide stats — they **transform build architecture**:

| Unique | Effect | Build Archetype Enabled |
|--------|--------|------------------------|
| **Exsanguinous** (Body Armour) | Converts low health into Ward; scales Ward from missing HP | Ward-based glass cannon; enables near-immortality via infinite Ward |
| **Last Steps of the Living** (Boots) | Generates Ward from movement | Pairs with Exsanguinous; mobile Ward sustain |
| **Bleeding Heart** (Amulet) | Powerful leech; BiS in many endgame builds | Leech-based sustain for melee builds |
| **Omnividence** (Gloves) | Massive spell base damage + Void synergy | Void spellcaster glass cannon |
| **Exsanguinous + Last Steps of the Living** | Combo: Ward-from-missing-HP + Ward-from-movement | Best-in-slot defensive combo for Ward builds |
| **Legends Entwined** (Ring) | Counts as part of every set | Enables any set bonus without the full set |
| **Orian's Eye** (Amulet) | Nullifies Void damage, bonus Mana, stun immunity | Void resistance capping |
| **Sigeon's Reprisal** (Shield) | Damage on block | Retaliation tank; turns defense into offense |

**Key insight:** Top builds almost universally slot at least 1–2 build-defining uniques and craft around their effects. The Exsanguinous combo is the clearest example of a paradigm-shifting item — it inverts the usual HP priority completely.

_Source: [Valuable Uniques — Maxroll.gg](https://maxroll.gg/last-epoch/resources/valuable-uniques), [Best Uniques — SkyCoach](https://skycoach.gg/blog/last-epoch/articles/best-uniques-in-last-epoch)_

---

### 1.6 Passive Tree Structure & ROI Patterns

**How the passive tree works:**
- 5 base classes, each with 3 masteries (specializations)
- Points spent in base class tree and mastery tree; mastery gates the strongest nodes
- The Mastery choice is the single most identity-defining decision in a build
- **Most high-value nodes are deep in the mastery tree** — shallow nodes are typically filler

**ROI patterns from top builds:**

1. **Go deep into Mastery first** — keystones and class-defining nodes are deep; pathing to them is mandatory
2. **Synergy clusters > isolated nodes** — groups of nodes that each boost the same mechanic compound value
3. **"More" damage nodes are priority** — even 1-point "15% More Fire Damage" nodes are exceptional value
4. **Passive tree pathing** — intermediate nodes on the path to a keystone may have negative ROI individually but enable the keystone's massive value
5. **Cross-tree synergy** — some builds intentionally don't fully complete the mastery tree because the base class tree has complementary nodes worth taking
6. **Season 4 top mastery picks:** Falconer (Rogue) = top endgame corruption pusher; Runemaster (Mage) = top burst; Necromancer (Acolyte) = Wraith summoner (low mechanical barrier, high power)

**Skill specialization tree (per-skill):**
- Each specialized skill gets up to 20 levels of points to spend
- Same ROI principles apply: synergy > spread, multipliers > additive
- Many skills have a "transformation node" that fundamentally changes behavior (e.g., converting a melee skill to ranged, or a skill to trigger on crit)
- **Transformation nodes are often the highest single-point ROI in the game** — they open entirely new synergy chains

_Source: [Passives and Skills Overview — Maxroll.gg](https://maxroll.gg/last-epoch/resources/passives-and-skills), [Passives and Skills Guide — DVing.net](https://dving.net/guides/last-epoch/passives-and-skills)_

---

### 1.7 Top Meta Builds — What "Optimal" Actually Looks Like

**Season 4 Tier List Summary (Maxroll.gg):**

| Tier | Build | Class/Mastery | Why It's Strong |
|------|-------|--------------|-----------------|
| S | **Blast Rain Marksman** | Rogue / Marksman | Best AoE + single-target + mobility combo |
| S | **Bladestorm Bladedancer** | Rogue / Bladedancer | Insane mobility + sustained AoE + single-target |
| S | **Shadow Rend Bladedancer** | Rogue / Bladedancer | Massive AoE, Ward gen, range safety, Uber Aberroth killer |
| S | **Falconer (Ballista)** | Rogue / Falconer | Season 4 top corruption pusher; Falcon damage + mobility |
| A | **Torment Warlock** | Acolyte / Warlock | Top clear speed + multiple defensive layers |
| A | **Wraith Necromancer** | Acolyte / Necromancer | Powerful endgame summoner; high survivability |
| A | **Runemaster Elemental** | Mage / Runemaster | Massive burst windows; strong passive defenses |
| A | **Forge Strike Forge Guard** | Sentinel / Forge Guard | Strong tank; Block synergy |

**Common patterns across all S-tier builds:**
- All cap resistances and crit avoidance
- All have at least one "more" damage multiplier in the skill tree
- All run movement speed on boots as non-negotiable
- All have a clear damage scaling path (crit-based OR "more" node stacking)
- Most run 1–2 build-enabling uniques

_Source: [Build Guides — Maxroll.gg](https://maxroll.gg/last-epoch/build-guides), [Endgame Tier List S4 — Maxroll.gg](https://maxroll.gg/last-epoch/tierlists/corruption-tier-list), [Best Builds 2025 — ImmortalBoost](https://immortalboost.com/blog/last-epoch/builds-ranked/)_

---

### 1.8 Endgame Scaling — Corruption as the Optimization Target

**Corruption levels and what they demand:**

| Corruption | Challenge Level | Build Requirement |
|------------|----------------|-------------------|
| 0–100 | Campaign/story difficulty | Any functional build |
| 100–200 | Empowered Monolith baseline | Capped resistances + basic defenses |
| 200–300 | Serious endgame | 3 defensive layers + strong damage scaling |
| 300–500 | High-end endgame; Uber Aberroth unlock | Near-optimal gear; 500% Item Rarity target |
| 500–1000 | Elite territory | BiS or near-BiS; build must have no defensive gaps |
| 1000+ | Diminishing returns; prestige | Full optimization required |

**Key insight for the optimizer:** Most players target 300–500 corruption. The optimizer should model this as the default endgame target. Builds that sacrifice too much defense for damage fail in this range — the enemy damage scaling outpaces the time saved by killing faster. The sweet spot is builds that can kill fast enough to minimize time in danger.

_Source: [Empowered Monolith Guide — Maxroll.gg](https://maxroll.gg/last-epoch/monolith/empowered-guide), [Corruption Monolith Guide — LastEpoch.wiki](https://www.lastepoch.wiki/guide/last-epoch-corruption-monolith)_

---

## Part 2 — Competitive Landscape: The Build Tool Ecosystem

### 2.1 Key Players in the Last Epoch Build Optimization Space

| Tool | Type | Capabilities | Limitations |
|------|------|-------------|-------------|
| **LastEpochTools.com** | Web build planner | Passive tree, skills, items, affix explorer, community build database | Manual only — no scoring, no optimization engine, no AI |
| **LastEpochPlanner.com** | PoB-fork for LE | Stat calculations (Health, Armor, Ward, Resistances, DPS for some skills), character import | Limited skill coverage, no suggestion engine, still manual planning |
| **Maxroll.gg** | Guide + loot filter platform | Expert build guides, tier lists, build-aware loot filters (color-coded by value), filter strictness levels | No optimizer — guides are static; loot filters are rule-based, not dynamic |
| **Path of Building (PoE)** | Offline full optimizer | **Per-point power scoring on every passive node**, Power Report ranking all nodes, full damage simulation, gear comparison | PoE only — but is the template LEBO should learn from |
| **Solved Exile (PoE)** | AI constraint optimizer | Import build → get upgrade recommendations across tree + gems + gear + flasks simultaneously; constraint-based ("describe what you want"); combinatoric exploration | PoE only, early-stage; but represents the ceiling of what's possible |
| **LEBO (our product)** | AI optimizer for LE | Currently: AI suggestion generation from build context | The only AI-powered Last Epoch optimizer that exists |

**Competitive gap confirmed:** There is **no AI-powered build optimizer for Last Epoch** in the market. The entire field is manual planning tools. LEBO operates in an uncontested space.

_Source: [LastEpochTools — Build Planner](https://www.lastepochtools.com/planner/), [LastEpochPlanner — GitHub](https://github.com/Musholic/PathOfBuildingForLastEpoch), [Maxroll Loot Filters](https://maxroll.gg/last-epoch/resources/understanding-maxroll-loot-filters), [Solved Exile](https://solvedexile.com/)_

---

### 2.2 What Path of Building Actually Does (The Gold Standard to Emulate)

Path of Building is the most technically sophisticated build optimizer in any ARPG. Its approach is the blueprint for what LEBO's algorithm should do:

**Per-Point Power Scoring:**
- For every unallocated passive node on the tree, PoB calculates the **marginal DPS increase** (or defensive increase) of allocating that node
- Nodes are highlighted on the tree with a color/intensity proportional to their per-point value
- The "Power Report" ranks every node in the entire tree and all cluster jewels by per-point efficiency
- This lets players answer "where should my next 3 points go?" in seconds

**Full Damage Simulation Engine:**
- PoB calculates full DPS including: base damage, all modifiers (additive + multiplicative), crit math, ailment application, skill-specific multipliers
- Gear swapping shows exact DPS delta before equipping
- Passive tree pathing shows actual point cost to reach any node (including mandatory intermediate nodes)

**Key algorithm insight from PoB's architecture:**
> Efficiency = `(DPS_with_node - DPS_without_node) / points_cost_to_reach_node`

Where `points_cost_to_reach_node` accounts for the full path cost, not just the node's own point cost. A T2 keystone requiring 3 filler nodes to reach has an effective cost of 4 points, not 1.

_Source: [Path of Building Community Fork](https://pathofbuilding.community/), [Power Report Issue — GitHub](https://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/3704)_

---

### 2.3 What Solved Exile Does (The Ceiling to Aspire To)

Solved Exile represents the next evolution — what LEBO should eventually become:

**Core approach:**
1. **Import current build state** (passive tree, gear, skills)
2. **Specify optimization constraints** ("I want 50k+ DPS and 5k EHP")
3. **Engine explores combinatoric space** — tries combinations of passive reallocations, gear swaps, skill gem changes
4. **Returns ranked upgrade suggestions** — "allocate these 3 nodes," "swap this ring affix," "this gem does 40% more damage"

**What makes it feel like magic:**
- It reasons about the **interaction space** between passives + items + skills together, not in isolation
- A suggestion might be: "Swap your boots to Exsanguinous-combo, respec 5 passive points from Health to Crit, and allocate the Crit Mastery node — net result: +280% DPS, -30% EHP but Ward generation now exceeds current EHP"
- The optimizer understands **build archetypes implicitly** — it finds the coherent build that maximizes the constraint, not just the locally optimal next node

_Source: [Solved Exile](https://solvedexile.com/)_

---

### 2.4 How Maxroll Loot Filters Work (Affix Scoring in Practice)

Maxroll's loot filter system reveals how professional build optimizers think about gear scoring:

**The scoring model:**
1. Each build guide defines a **priority affix list** per slot
2. Filters use **color coding** to communicate value: gold = perfect roll, blue = acceptable, hidden = worthless
3. Filter strictness levels correspond to gear targets: Leveling → Empowered start → High-end endgame → BiS farming
4. Build-aware filtering: affixes from the build's planner are highlighted; everything else is hidden

**The key insight:** Maxroll's experts are essentially hand-coding a **weighted affix scoring function** per build. This is exactly what LEBO's AI should compute dynamically — instead of a human expert hand-specifying weights, the AI derives them from the build context.

_Source: [Understanding Maxroll Loot Filters](https://maxroll.gg/last-epoch/resources/understanding-maxroll-loot-filters), [Loot Filter Guide — Maxroll.gg](https://maxroll.gg/last-epoch/resources/loot-filter-guide)_

---

### 2.5 Competitive Positioning: Where LEBO Fits

**The gap LEBO fills:**

| Capability | LastEpochTools | Maxroll | PoB (PoE) | Solved Exile (PoE) | **LEBO** |
|-----------|---------------|---------|-----------|-------------------|---------|
| Passive tree planning | ✅ Manual | ✅ Guide | ✅ Manual+Score | ✅ Automated | ✅ Needs per-point scoring |
| Gear comparison | ✅ Manual | ✅ Loot filter | ✅ DPS delta | ✅ Automated | ✅ Needs affix scoring |
| Skill tree planning | ✅ Manual | ✅ Guide | ✅ Manual | ✅ Automated | ✅ Needs per-point scoring |
| AI suggestions | ❌ | ❌ | ❌ | ⚠️ PoE only | ✅ **Only LE tool with this** |
| Archetype-aware | ❌ | ✅ via guides | ⚠️ Implicit | ✅ | ✅ Needs explicit modeling |
| Natural language goals | ❌ | ❌ | ❌ | ✅ (experimental) | ✅ **Core differentiator** |

**LEBO's strongest differentiators:**
1. **AI-powered** — no other Last Epoch tool offers automated suggestions
2. **Natural language goals** — "glass cannon" / "juggernaut" / "speed farmer" is a human-first interface no other LE tool has
3. **Desktop native** — not a web tool; fast, private, offline-capable
4. **Integrated build context** — skills + passives + gear all read at once, enabling cross-domain suggestions

---

## Part 3 — Algorithm Design: Making the Optimizer Feel Like Magic

### 3.1 The Core Problem Statement

**Input:** Current build state (passive allocations, skill specializations, gear, player level, goal archetype)
**Output:** Ranked list of concrete changes — "allocate node X," "swap affix Y on slot Z," "reroute 3 points from A to B" — each with an estimated impact score

**Goal:** Feel like a world-class theorycrafting partner who instantly knows what matters and why.

---

### 3.2 The Build Score Function — The Heart of Everything

Before anything can be suggested, the optimizer needs to **score the current build** in a way that reflects the player's stated goal. This is a multi-dimensional scoring problem.

**Proposed composite score:**

```
BuildScore = w_dmg × DamageScore + w_surv × SurvivabilityScore + w_speed × SpeedScore
```

Where weights are derived from the player's stated archetype goal:

| Archetype | w_dmg | w_surv | w_speed |
|-----------|-------|--------|---------|
| Glass Cannon | 0.85 | 0.10 | 0.05 |
| Balanced | 0.55 | 0.35 | 0.10 |
| Juggernaut | 0.20 | 0.75 | 0.05 |
| Speed Farmer | 0.50 | 0.20 | 0.30 |

**DamageScore components:**
- Base damage pool × additive modifiers (Increased%)
- Multiplicative modifiers (More%)
- Crit contribution: `(Crit_Multi × Crit_Chance) + (1 - Crit_Chance)` — the average damage multiplier
- Skill-specific modifiers

**SurvivabilityScore components:**
- Effective HP = HP × (1 + Ward_ratio) × Endurance_reduction
- Defense layer count (reward for stacking multiple layers)
- Resistance coverage (penalize uncapped resistances heavily)
- Crit avoidance (binary bonus: 0 or 1 at cap)

**SpeedScore components:**
- Movement speed %
- Attack/cast speed
- Area of Effect coverage

_The AI's job is to evaluate each potential change as a **delta on this score** — `Δscore = score_after - score_before`._

---

### 3.3 Passive Tree Node Scoring Algorithm

**The per-point efficiency problem:**

For passive tree optimization, the key challenge is that nodes have a **path cost** — you can't take node X at depth 5 without first spending points on nodes 1–4 along the path.

**Recommended approach: Marginal Efficiency Scoring**

```
Efficiency(node) = ΔBuildScore(node) / EffectivePointCost(node)

EffectivePointCost(node) = points_in_node + points_in_unallocated_prerequisites
```

For each unallocated node in the tree:
1. Calculate the minimum-point path from current allocation to the node (BFS/Dijkstra on the tree graph)
2. Compute the `ΔBuildScore` of having the node allocated vs not
3. Sum the score contributions of ALL nodes on that path (not just the target)
4. Divide total path ΔBuildScore by total path cost in points

This finds routes where the **whole path** has high average value, not just the target node.

**Pruning rules for efficiency:**
- Skip nodes already allocated
- Skip nodes where path cost exceeds remaining budget
- Heavily weight "More" damage modifier nodes — these are worth ~3–5× an equivalent "Increased" node when the build already stacks Increased%
- Apply mastery depth bonus: nodes at depth 7–10 in the mastery tree get a 1.2× multiplier (game data shows highest-value nodes are deep)

**Algorithm type:** Modified Dijkstra on the tree graph, optimizing for ΔScore/cost rather than distance. O(N log N) where N = unallocated nodes.

_Source: [Optimal Skill Tree Growth — TommyOdland.com](https://tommyodland.com/articles/2020/optimal-skill-tree-growth/index.html), [Power Report — PoB GitHub](https://github.com/PathOfBuildingCommunity/PathOfBuilding/issues/3704)_

---

### 3.4 Budget-Constrained Multi-Point Optimization (N Points to Spend)

When a player has N points to allocate (not just 1), greedy per-point selection is **suboptimal** because:
- Early greedy choices may block higher-value paths
- Some paths have front-loaded costs and back-loaded rewards

**Recommended approach: Two-Phase Algorithm**

**Phase 1 — Greedy Shortlist:**
Run the per-point efficiency scoring to produce a ranked shortlist of top-20 candidate paths. This is fast (O(N log N)) and eliminates clearly suboptimal choices.

**Phase 2 — DP Budget Allocation:**
For the shortlisted paths, apply a bounded knapsack formulation:
- Items = path bundles (each path is a bundle of 1–8 nodes)
- Weights = total point cost of each bundle
- Values = cumulative ΔBuildScore of each bundle
- Capacity = remaining point budget

DP finds the **globally optimal combination** of path bundles within budget. State space is `paths × budget_levels` — manageable with a 20-item shortlist and typical budgets of 5–20 points.

**Output:** The specific set of node allocations that maximizes BuildScore for the given budget, in allocation order (cheapest-first to reach the destinations).

_Source: [Constrained Discrete Optimization DP — arXiv](https://arxiv.org/pdf/2105.06085), [Greedy vs DP — Educative.io](https://www.educative.io/blog/greedy-algorithm-vs-dynamic-programming)_

---

### 3.5 Gear Scoring Algorithm — Affix Weight Computation

Rather than hard-coding affix weights (like Maxroll's experts do manually), LEBO should **derive weights dynamically from the build context**:

**Affix Weight Formula:**
```
Weight(affix, build) = ΔBuildScore when this affix is present at T5 / baseline
```

Computed by temporarily injecting each affix into the build and measuring the score delta. Expensive to compute naively, but cacheable per build state.

**Practical optimization:**
- Pre-compute weight tables per archetype (Glass Cannon, Juggernaut, Balanced, Speed)
- Only recompute when the build changes materially (new class, mastery, or skill assignment)
- Sort affixes by weight × tier_value to rank upgrade opportunities

**Gear slot scoring:**
For each gear slot, rank all possible affixes by their weight × expected tier value. The top 2 prefix + top 2 suffix combinations define the "ideal" item for that slot. The gap between what the player currently has and this ideal = the opportunity score for that slot.

**Unique item detection:**
Flag when a build-enabling unique (Exsanguinous, Bleeding Heart, etc.) would change the archetype score significantly. These deserve special treatment — not just "better stats" but "different build strategy unlocked."

---

### 3.6 Archetype-Aware Suggestion Ranking

Not all improvements are equal. The AI should rank suggestions by how directly they serve the player's stated goal:

**Suggestion priority tiers:**

| Tier | Condition | Example |
|------|-----------|---------|
| **Critical** | Defensive floor not met | "Cap resistances before any damage investment" |
| **High** | Major efficiency gap | "3 points to Crit Mastery keystone: +180% avg damage" |
| **Medium** | Incremental improvement | "Upgrade ring affix from T3 to T5: +12% damage" |
| **Low** | Minor optimization | "Reorder skill tree allocation for same result cheaper" |

**The "defensive floor" rule** — modeled after how top builders actually play:
Before suggesting any offensive improvement, verify:
1. All resistances are capped ✅
2. Crit avoidance is at or near 100% ✅
3. At least one sustain layer is in place (leech / Ward / life regen) ✅

If any of these fail, they are **Critical** suggestions that rank above all damage improvements, regardless of archetype (even Glass Cannon needs defensive floors to clear 300+ corruption).

---

### 3.7 The "Magic" Factor — Cross-Domain Synergy Detection

What makes LEBO feel like magic is **detecting cross-domain synergies** that a manual tool would never surface:

**Examples of magic suggestions:**
1. "Your build uses Crit extensively but your passive tree has 0 Crit nodes — 4 points to the Crit Mastery cluster would increase your avg damage by 240%"
2. "You have Exsanguinous in your gear but your HP pool is only 800 — with Ward-from-HP mechanics, going to 2000 HP via hybrid health affixes would give you 4× more effective Ward"
3. "Your Marksman build is using melee crit chance affixes — these do nothing for ranged attacks. Swapping to Bow Critical Strike Chance would add 18% actual crit chance"
4. "You have 6 points allocated in the Mana tree but your build uses zero Mana abilities — those points are worth 0. Reallocating to Vitality gives you 240 HP"

**How to detect these:**
- Cross-reference affix types against the active skill damage types (melee/ranged/spell/etc.)
- Detect "zero-value" allocations: nodes allocated but whose bonuses never apply to the active skills
- Detect "synergy enablers": changes that unlock a secondary mechanic (e.g., getting enough Int to enable Ward Retention scaling with Exsanguinous)

---

### 3.8 Implementation Architecture for LEBO

Based on all research, here is the recommended algorithm pipeline:

```
[Build State] → [Score Engine] → [Passive Tree Scorer] → [Gear Scorer] → [Synergy Detector]
                                         ↓                       ↓                ↓
                              [Path Efficiency Rankings] [Affix Gap Rankings] [Zero-value / enabler flags]
                                                        ↓
                                         [Budget Knapsack Solver]
                                                        ↓
                                    [Prioritized Suggestion List]
                                                        ↓
                                  [Claude API: Narrative Generation]
```

**The Claude API's role in this pipeline:**
The algorithmic engine produces **ranked, scored, structured suggestions with data**. Claude then takes those structured suggestions and converts them into **natural language explanations** that feel like a knowledgeable friend explaining why something matters — not just "allocate node X" but "You're only 4 points away from the Crit Mastery keystone, and once you hit it your average damage nearly doubles because your crit chance is already at 85%."

This hybrid approach (deterministic scoring algorithm + LLM explanation) is what makes suggestions feel like magic rather than a spreadsheet.

**Estimated computation budget per suggestion run:**
- Score engine: <10ms (simple math, precomputed stat totals)
- Passive tree scan (150–200 nodes): <50ms with Dijkstra
- Gear affix scoring (4 affixes × 10 slots): <20ms with cache
- Knapsack solver (top 20 paths, 20-point budget): <5ms
- Claude API call for narrative: 2–5 seconds (the only slow part)

Total user-perceived latency: 2–5 seconds. The algorithm is not the bottleneck — the LLM is.

_Source: [Optimal Skill Tree Growth — TommyOdland.com](https://tommyodland.com/articles/2020/optimal-skill-tree-growth/index.html), [Multi-Objective Optimization — Medium](https://medium.com/@chongjingting/multi-objective-optimization-moo-1b29ece5b64f), [Greedy vs DP — Educative.io](https://www.educative.io/blog/greedy-algorithm-vs-dynamic-programming)_
