---
stepsCompleted: [1, 2]
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
