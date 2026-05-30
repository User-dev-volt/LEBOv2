---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'domain'
research_topic: 'Path of Building feature set, UI patterns, and ARPG build tool UX for Last Epoch'
research_goals: 'Understand what PoB does and what to adopt for Last Epoch specifically; analyze lastepochtools.com display patterns; guide UX/UI design to mimic the game aesthetic as closely as possible'
user_name: 'Alec'
date: '2026-05-18'
web_research_enabled: true
source_verification: true
---

# Research Report: ARPG Build Tool UX/UI — PoB & Last Epoch Patterns

**Date:** 2026-05-18
**Author:** Alec
**Research Type:** Domain — Competitive Tool Analysis + UX Pattern Mining

---

## Research Overview

This report surveys three sources of truth for LEBOv2's UX/UI design:

1. **Path of Building (PoB / PoB Community Fork)** — the gold standard desktop build planner for Path of Exile. Analyzed for feature inventory, UI layout, information hierarchy, and UX patterns the community has internalized as "normal" for ARPGs.
2. **lastepochtools.com** — the dominant community build planner for Last Epoch specifically. Analyzed for how it handles LE-specific mechanics and how closely it mirrors the game UI.
3. **Last Epoch in-game aesthetic** — color palette, rarity system, information density, and design language to inform visual fidelity goals.

**Methodology:** Web search + direct page fetches across 14 sources. All findings are verified against live content or DeepWiki architecture docs. Confidence noted inline where data is partial.

---

## Domain Research Scope Confirmation

**Research Topic:** Path of Building feature set, UI patterns, and ARPG build tool UX for Last Epoch
**Research Goals:** Understand what PoB does well → identify what to adopt for LE specifically → analyze how lastepochtools.com displays builds → guide LEBOv2 UX/UI to mimic the in-game aesthetic as closely as possible

**Research Methodology:**
- All claims verified against current public sources
- Multi-source validation for critical claims
- Confidence levels applied to uncertain data
- Actionable design recommendations grounded in findings

**Scope Confirmed:** 2026-05-18

---

## Section 1: Path of Building — Complete Feature & UI Inventory

### 1.1 Tab Architecture

PoB uses a **horizontal tab bar** in the top-left as the primary navigation. The right side of the window is always the passive skill tree; the left side changes based on the active tab. This split is fundamental to its mental model: the tree is always visible.

| Tab | What it shows |
|-----|--------------|
| **Tree** | Passive skill tree (entire right pane), class/ascendancy selector, Compare Trees dropdown, Power View toggle |
| **Skills** | Socket groups (active + support gem stacks), per-gem controls, DPS-sort options |
| **Items** | Equipment slots, crafting/modding interface, trade price lookup, item database search |
| **Config** | Combat simulation variables: enemy type/resistances, flask uptime, map mods, shock value, charge stacks |
| **Calcs** | Full stat breakdown — every calculated value: life/mana/ES, resistances, evasion, leech, DPS derivation chains |
| **Import/Export** | Pastebin / pobb.in URL, live character import from PoE API |
| **Notes** | Free-text scratchpad for the build |

### 1.2 Passive Skill Tree UI

The tree is rendered with a custom coordinate transformation system (world space → screen space via zoom/pan). Key design decisions:

- **Node types with distinct visuals:** standard passives, jewel sockets, mastery nodes, tattoo nodes — each loads different sprite data and renders distinctly
- **Allocated vs. unallocated** states are visually obvious at a glance
- **Power View / Node Power mode:** overlays a color-coded heatmap on the tree — red = offense nodes (stronger red = higher DPS gain per point), blue = defense nodes (stronger blue = higher EHP gain). This lets theorycrafters instantly spot the most efficient next nodes.
- **Search highlighting:** type a stat (e.g. "fire damage") and matching nodes glow/highlight across the entire tree
- **Power Report:** a separate ranked list that sorts ALL unallocated nodes by per-point DPS value — the single most powerful theorycraft tool in PoB
- **Compare Trees dropdown:** save named tree variants and flip between them to compare pathing strategies
- **Zoom and pan** are smooth; the tree never resets position between tab switches
- **Integration:** clicking a node instantly recalculates all stats in the Calcs tab in real time

### 1.3 Skills Tab (Gems)

PoB models skills as **socket groups** — an abstraction over "gems socketed in an item or passive node." Each group contains:
- Active skill gem + support gems
- Per-gem controls: gem name (searchable dropdown), level (with "match character level" option), quality (0–23), enabled/disabled toggle, statset selector (for multi-mode skills)
- Source label (which item slot or passive the group belongs to)

**DPS-Based Gem Sorting** is a standout feature: PoB temporarily simulates swapping each possible gem into the slot and color-codes the result — **green** = DPS increase, **red** = decrease, **yellow** = no change. This turns gem selection from guesswork into a ranked list.

Copy/paste of socket groups as formatted text enables easy sharing ("Lightning Strike 20/20").

### 1.4 Items Tab

- Full equipment slot layout with clickable slots
- Direct stat editing on any item
- "Craft Item" feature: add/remove/roll mods in the planner to test hypothetical gear
- Trade price API integration — shows current PoE.trade prices inline
- Searchable item database with filter by base type, unique name, affixes

### 1.5 Config Tab

The config tab is PoB's "simulation assumptions" layer — it sets the context for all DPS numbers:
- Enemy type (normal / rare / boss), enemy resistances, enemy life
- Flask uptime percentages
- Endgame buff stacks (frenzy charges, power charges, endurance charges)
- Map modifier debuffs (ele weakness, vulnerability)
- Skill-specific toggles (e.g., "Is enemy shocked?", "Is enemy frozen?")

Without this, DPS numbers are meaningless. **Confidence: high** — this is documented across multiple guides.

### 1.6 Calcs Tab

The most information-dense tab. Shows the full derivation of every stat:
- Offense: hit chance, crit chance, crit multi, total DPS, DoT DPS, combined DPS
- Defense: total life, ES, ward, evasion, armor, block, spell suppression, resistances (ele + chaos), EHP
- Speed: attack speed, cast speed, move speed
- Resource: mana cost, mana regen, life regen, ES recharge
- Color coding: **blue text** = fully supported and calculated, **red text** = unsupported (PoB can't compute it, often because a mod is too complex)

### 1.7 Core UX Patterns Worth Adopting

1. **Immediate/real-time feedback** — every change (node click, gem swap, item equip) propagates to all stat displays instantly. No "Recalculate" button ever.
2. **Progressive disclosure via tabs** — the user isn't overwhelmed; they navigate sequentially Tree → Skills → Items → Config → Calcs.
3. **Color-coded deltas** — green = better, red = worse, yellow = unchanged. Applied consistently to gems, items, nodes.
4. **The tree is always visible** — PoB never hides the passive tree behind a modal. It shares the screen permanently.
5. **Import from anywhere** — pastebin URL, site-specific URL, live API character — minimal friction to load community builds.
6. **Offline-first** — no network required to use it. Data is local.
7. **Power Report / per-node scoring** — the single biggest theorycraft feature competitors haven't matched.

---

## Section 2: lastepochtools.com — Build Planner Analysis

### 2.1 Design Philosophy

The explicit goal of lastepochtools.com (built by Dammitt) is to **mirror the game's own UI as closely as possible**. This is the most important design decision to understand: rather than inventing a new UI language, it ports the in-game screens to the web. Players don't need to learn a new tool — they already know how to use it because it looks like the game.

This is the single most important pattern to carry into LEBOv2.

### 2.2 Tab/Panel Structure

**Navigation shortcuts (keyboard-first):**
- `C` — character window (equipment + stats)
- `S` — skill tree (specialization)
- `P` — passives panel

**Planner sections:**
| Section | Contents |
|---------|----------|
| **Skills** | Skill specialization trees — each active skill has its own 20-node tree |
| **Passives** | Class + mastery passive trees |
| **Weaver Tree** | Weaver's Will passive system (LE 1.0+) |
| **Conditions** | Active buffs/debuffs for simulation (mirrors PoB's Config tab) |
| **Buffs** | Persistent buff states |
| **Quests** | Quest reward passive points tracking |
| **Equipment** | Item slots with affix selection |
| **Idols** | Grid-based idol placement (unique to LE) |
| **Blessings** | Monolith timeline blessings |

**Stat sheet sections:** General / Offense / Defense / Minion / Other — tabs within the stat panel, not top-level navigation.

### 2.3 Passive Tree Specifics

- Select mastery from a **dropdown** next to the character level display
- Must place **≥20 points** in base class before mastery tree unlocks
- Can place points in the **full mastery tree** + the left half of the other two masteries (matching in-game rules exactly)
- Left-click adds a point, right-click removes
- **Shift+click** for bulk point allocation
- Scrollable tooltips — if a tooltip overflows the viewport, mouse wheel scrolls it in place (never clips)

### 2.4 Stat Display Conventions

- Stats show **average values** by default
- A toggle at the bottom of the character stat sheet switches to **min/max** and **actual roll** views
- All stat updates are **real-time** — same as PoB

### 2.5 Equipment UI

- Up to 2 prefixes + 2 suffixes per slot (matching LE's affix system)
- Idols require both prefix AND suffix (mandatory — matching in-game behavior)
- Affix selection respects class restrictions and item type restrictions
- Uniques/set items do not allow affix editing
- `[Esc]` cancels equipment changes quickly

### 2.6 Key UX Differences vs. PoB

| Feature | PoB | lastepochtools.com |
|---------|-----|-------------------|
| Skill system model | Socket groups (gems in items) | Skill specialization trees (each skill has own tree) |
| Passive system | Single large tree | Class tree + mastery subtrees + Weaver Tree |
| Idol support | N/A | Full grid-based idol builder |
| Conditions tab | "Config" — very comprehensive | "Conditions" — present but simpler |
| Gem/skill DPS sorting | Yes (green/red/yellow) | Not prominently documented |
| Power Report | Yes — flagship feature | Not present (opportunity for LEBOv2) |
| Keyboard navigation | Limited | Strong (C/S/P shortcuts) |
| Offline | Yes (desktop app) | No (web-based) |

---

## Section 3: Last Epoch In-Game Aesthetic

### 3.1 Color Language

Last Epoch deliberately breaks from the "grimdark" ARPG aesthetic. The game uses a **vibrant color palette** — players frequently contrast it favorably with Diablo IV's muted greyness. Key characteristics:

- **Background panels:** dark stone/obsidian texture — deep charcoal/near-black, not pure black
- **Primary UI text:** off-white / warm white (not harsh #FFFFFF)
- **Accent color:** warm gold/amber — used for titles, headers, highlighted UI elements, interactive borders
- **Stat text:** white or light grey on dark panels
- **Active/selected states:** gold accent border or highlight

### 3.2 Item Rarity Color System

This is canonical and must be respected exactly in any build tool:

| Rarity | Color | Notes |
|--------|-------|-------|
| Common | White | No affixes |
| Magic | Blue | 1–2 affixes |
| Rare | Yellow | 3–4 affixes |
| Unique | Orange | Fixed unique stats |
| Set | Green | Unique with set bonus |
| Exalted | Purple | Tier 6–7 affixes |
| Legendary | Red | Rarest tier |

_Source: lastepochtools.com/guide/section/rarity_

### 3.3 Skill Tree Aesthetic (In-Game)

Based on community screenshots and forum posts, the in-game skill specialization trees use:
- Dark circular nodes with icon/glyph inside
- Gold/amber connecting lines between nodes
- Allocated nodes: glowing, bright, filled-in
- Unallocated nodes: dim, desaturated
- Locked nodes: greyed out with visual barrier indicator
- Warm lighting/glow on allocated paths

This is distinct from the passive tree, which uses a traditional ARPG node-graph layout but with the same color language.

### 3.4 Font & Typography Conventions

- Serif-adjacent titles for flavor/headers (matching medieval aesthetic)
- Clean sans-serif for stat values and numbers
- Gold text for item names at Rare+ rarity (matching their rarity color)
- Stat values in white; modifiers in relevant color (damage type colors for LE — e.g. fire = orange-red, cold = blue, lightning = yellow)

### 3.5 Damage Type Color Conventions

LE uses damage-type color coding throughout tooltips and UI:
- **Physical:** off-white / light grey
- **Fire:** orange-red
- **Cold:** blue / ice-blue
- **Lightning:** yellow
- **Void:** purple
- **Poison/Necrotic:** green
- **Armor Shred / Bleed:** red-brown

---

## Section 4: Feature Gap Analysis — What PoB Does That LE Tools Don't

| Feature | PoB | lastepochtools.com | LEBOv2 Opportunity |
|---------|-----|-------------------|--------------------|
| **Power Report** (rank nodes by per-point value) | ✅ | ❌ | **High priority — flagship differentiator** |
| **Node power heatmap** on tree | ✅ | ❌ | High priority |
| **DPS-based gem/skill sort** (green/red/yellow) | ✅ | Partial | Add to skill suggestions |
| **Compare Trees** (named tree variants) | ✅ | ❌ | Medium — useful for theorycrafters |
| **Config / simulation conditions** | ✅ (deep) | Basic | Medium — at least enemy type + debuffs |
| **Full Calcs breakdown** (derivation chains) | ✅ | Basic | Medium — show the "why" behind scores |
| **Import from URL/API** | ✅ | Partial | Lower priority for v1 |
| **Idol builder** | ❌ | ✅ | **Already planned — must ship** |
| **Weaver Tree** | ❌ | ✅ | Medium — unique to LE |
| **Skill specialization trees** | ❌ | ✅ | **Already in scope** |
| **Blessings** | ❌ | ✅ | Medium |
| **Offline desktop** | ✅ | ❌ | **LEBOv2 is Tauri — already wins here** |
| **AI optimization suggestions** | ❌ | ❌ | **LEBOv2's core differentiator** |

---

## Section 5: Design Recommendations for LEBOv2

### 5.1 Visual Fidelity — "Mimic the Game"

**Rule #1: Use Last Epoch's rarity color system exactly.** Every item name, tooltip header, and affix value should respect the canonical rarity colors (see Section 3.2). Players will notice immediately if these are wrong.

**Rule #2: Dark panel + gold accent is the LE aesthetic.** The current LEBOv2 design tokens already have `--color-accent-gold` — this is correct. Lean into it. Panel backgrounds should be deep charcoal (the current `--color-bg-base` / `--color-bg-surface` tokens). Avoid pure black (#000) and pure white (#FFF).

**Rule #3: Damage type colors in tooltips/stats.** When showing damage breakdowns, use LE's canonical damage-type colors (Section 3.4), not arbitrary colors.

**Rule #4: Skill tree nodes should mimic in-game look.** Allocated = glowing/bright with gold connecting lines. Unallocated = dim circles. Locked = greyed with visual barrier. This is what lastepochtools.com does and what players expect.

### 5.2 UX Patterns — Adopt from PoB

**Must adopt:**
- **Real-time stat propagation** — every node allocation, skill point, or item change updates all stat displays instantly. No "calculate" button.
- **Color-coded deltas** — when the AI suggests a node/change, show green (+) / red (-) / yellow (~) on affected stats. This is the most legible way to show optimization impact.
- **The tree is always visible** — the skill tree canvas should not be hidden behind a modal. It shares screen real estate with the context panel.
- **Progressive disclosure via tabs** — don't dump all panels on screen at once. Current LEBOv2 has left/center/right panels which is good; within each panel, use tabs for sub-sections.

**High priority additions (PoB features LE tools lack):**
- **Node power / suggestion overlay on tree** — when the AI generates suggestions, highlight the suggested nodes directly on the tree (the `--color-node-suggested` token is already defined for this). This is PoB's power heatmap, but powered by Claude instead of a formula.
- **Per-node score display** — when hovering a suggested node, show the expected stat delta (e.g., "+8% DPS, +2% EHP") in the tooltip. This is the "why" behind each suggestion.

### 5.3 UX Patterns — Adopt from lastepochtools.com

**Must adopt:**
- **Mirror in-game panel layouts** — especially for the skill specialization tree and passive tree. Players will use LEBOv2 alongside the game; the closer it matches, the less cognitive load.
- **Keyboard shortcuts** — `C` for character, `S` for skill tree, `P` for passives is already a known pattern in the community. Add these.
- **Scrollable tooltips** — tooltips that overflow the viewport should scroll in place, not clip or expand the layout.
- **Shift+click for bulk operations** — in the passive tree and skill trees.
- **Stat sheet tabs: General / Offense / Defense / Minion / Other** — this is the community-standard grouping for LE stat display. Match it.

**Medium priority:**
- **Conditions/Buffs panel** — a simplified Config tab equivalent. Let users set "is enemy hexed?", "do I have frenzy stacks?", etc. before running optimization. Without this, AI suggestions may not reflect the user's actual combat scenario.

### 5.4 LEBOv2-Specific Differentiators to Protect

These are things neither PoB nor lastepochtools.com has, and LEBOv2 should lead with:

1. **AI-powered optimization** (Claude API) — the entire reason the tool exists. The UX should make the AI suggestions feel like a first-class feature, not an afterthought panel.
2. **Offline desktop via Tauri** — lastepochtools.com is web-only. LEBOv2 runs locally, meaning faster response and no server dependency.
3. **API key stored in Stronghold** — users who care about privacy will appreciate that their Claude key never leaves the app.
4. **Build versioning / undo-redo** — PoB has this; lastepochtools.com doesn't prominently. LEBOv2 already has undo stack — surface it in the UI (a small undo/redo affordance in the tree controls area).

### 5.5 Information Hierarchy Recommendation

Based on what expert build planners (both PoB and LE community) find most valuable, recommend this priority order for panel real estate:

```
CENTER (largest):     Skill tree canvas — always visible
LEFT PANEL (260px):   Context inputs — gear, skills, idols, blessings
RIGHT PANEL (320px):  Stat sheet (General/Offense/Defense tabs) + AI suggestions
BOTTOM STATUS BAR:    Build score gauge, game data freshness, undo/redo
```

This maps directly to the current LEBOv2 panel layout, which is well-aligned with ARPG build tool conventions.

---

## Sources

- [Path of Building Community Fork](https://pathofbuilding.community/)
- [GitHub — PathOfBuildingCommunity/PathOfBuilding](https://github.com/PathOfBuildingCommunity/PathOfBuilding)
- [DeepWiki — Passive Skill Tree Architecture](https://deepwiki.com/PathOfBuildingCommunity/PathOfBuilding/5.1-passive-skill-tree)
- [DeepWiki — Skills Tab (PoB PoE2)](https://deepwiki.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/3.1-skills-tab)
- [How to Use Path of Building (2025) — Enthusiastic Gamer](https://ethugamer.com/path-of-exile/how-to-use-path-of-building-in-path-of-exile-2025-import-builds-plan-progression-master-the-interface/)
- [How to Use Path of Building — Civenge](https://civenge.com/how-to-use-path-of-building-planning-path-of-exile-builds/)
- [Path of Building — What Is It — pathofbuilding.net](https://pathofbuilding.net/what-is-the-path-of-building/)
- [Last Epoch Build Planner — lastepochtools.com](https://www.lastepochtools.com/planner/)
- [Last Epoch Tools Build Planner — Forum Thread](https://forum.lastepoch.com/t/last-epoch-tools-build-planner/28469)
- [Last Epoch Talent Calculator Tools — Pro Game Guides](https://progameguides.com/last-epoch/last-epoch-talent-calculator-tools-for-creating-builds/)
- [Rarity Guide — lastepochtools.com](https://www.lastepochtools.com/guide/section/rarity)
- [Last Epoch Loot Rarity Colors — Upcomer](https://upcomer.com/last-epoch-loot-rarity-colors-explained/)
- [Last Epoch Item Rarities — Sportskeeda](https://www.sportskeeda.com/mmo/last-epoch-item-rarities-explained)
- [Last Epoch UI Colors Forum Discussion](https://forum.lastepoch.com/t/ui-colors-too-dark/28920)
- [Path of Building Release for PoE2 — Maxroll](https://maxroll.gg/poe2/news/path-of-building-release-for-poe2)
