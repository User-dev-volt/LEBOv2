# Addendum — LEBOv2 Phase 3 PRD

**Purpose:** Technical depth, algorithm details, options considered, and reference material that informed the PRD but belongs downstream (architecture/implementation) rather than in requirements.

---

## A. Algorithm Blueprint (Stage 1–6 Pipeline)

From the domain research (`domain-last-epoch-build-optimization-research-2026-05-19.md`). This is the implementation specification for Epic A — the deterministic scoring engine.

### Stage 1 — Build Score Function
```
BuildScore = w_dmg × DamageScore + w_surv × SurvivabilityScore + w_speed × SpeedScore

DamageScore:
  base_damage = Σ(base damage from skills)
  additive_multiplier = 1 + Σ(all "increased" modifiers from passives, gear, blessings, conditions)
  multiplicative_multiplier = Π(all "more" modifiers)
  hit_damage = base_damage × additive_multiplier × multiplicative_multiplier
  crit_contribution = CritMulti × CritChance + (1 - CritChance)
  avg_damage = hit_damage × crit_contribution

SurvivabilityScore:
  effective_hp = raw_hp × (1 + ward_ratio) × endurance_reduction_factor
  layer_bonus = 1.0 + 0.1 × max(0, active_defensive_layers - 2)
  score = effective_hp × layer_bonus

SpeedScore:
  score = move_speed_pct × cast_or_attack_speed × aoe_coverage_modifier
```

### Archetype Weight Vectors

| Slider Position | w_dmg | w_surv | w_speed |
|----------------|-------|--------|---------|
| 0 (Full Juggernaut) | 0.20 | 0.75 | 0.05 |
| 25 | 0.35 | 0.55 | 0.10 |
| 50 (Balanced) | 0.55 | 0.35 | 0.10 |
| 75 | 0.70 | 0.22 | 0.08 |
| 100 (Full Glass Cannon) | 0.85 | 0.10 | 0.05 |

Fine-tune panel overrides these values directly when active.

### Stage 2 — Passive Tree Efficiency Scan
```
For each unallocated_node n in the passive tree:
  path = Dijkstra(current_allocation, n)  // minimizes point cost, not distance
  path_delta = Σ(ΔBuildScore for each node on path)
  effective_cost = Σ(point_cost for each unallocated node on path)
  efficiency[n] = path_delta / effective_cost

Apply multipliers:
  if node.modifierType == "more" and build.increased_pct > 200:
    efficiency[n] *= 3.0–5.0  // scaled by (1 + increased_pct / 200)
  if node.mastery_depth >= 7:
    efficiency[n] *= 1.2
```

### Stage 3 — Budget Knapsack Solver
```
Phase 1 (greedy shortlist):
  Sort efficiency[] descending
  Take top 20 candidate paths as bundles

Phase 2 (DP knapsack):
  Items = path_bundles (each with cost and value = path_delta)
  Capacity = unspent_points
  dp[i][w] = max(dp[i-1][w], dp[i-1][w-cost[i]] + value[i])
  Backtrack for allocation order (cheapest-first per path)
```

### Stage 4 — Gear Affix Scorer
```
// Skill-role context used to zero out inapplicable affixes
primary_skill = build.skill_roles["primary_offense"]
primary_damage_types = primary_skill.damage_types  // e.g., ["poison", "physical"]
primary_delivery = primary_skill.delivery_type     // e.g., "spell", "melee", "ranged"

For each affix a in the full affix database:
  if a.scope != primary_delivery AND a.scope != "generic":
    weight[a] = 0  // zero out affixes that don't apply (melee crit on spell build = 0)
    continue
  temp_build = current_build + affix_a at T5
  weight[a] = BuildScore(temp_build) - BuildScore(current_build)

For each gear slot s:
  ideal_prefixes = top 2 affixes with highest weight that are valid prefixes for slot s
  ideal_suffixes = top 2 affixes with highest weight that are valid suffixes for slot s
  upgrade_score[s] = Σ(weight[ideal] - weight[current]) for all affix positions in s

Cache weight[] per build state; invalidate on class/mastery/skill/role-designation change.
```

**Gear Optimization Screen — Weakest Slot:**
```
slots_ranked = sort(all_gear_slots, key=upgrade_score, descending=true)
priority_slot = slots_ranked[0]  // highest gap = weakest for this build

wishlist[s] = {
  prefixes: [(affix_name, tier_target, mechanical_reason), ...],  // top 2
  suffixes: [(affix_name, tier_target, mechanical_reason), ...],  // top 2
  current_efficiency: current_score / ideal_score,  // 0–100%
  upgrade_priority_rank: rank in slots_ranked
}
```

### Stage 5 — Cross-Domain Synergy Detection
```
Zero-value detection:
  For each allocated node n:
    if Σ(effect contributions to active build skills) == 0:
      flag as "zero-value reallocation" suggestion

Mismatched affix detection:
  For each affix on each gear slot:
    if affix.scope != build.active_skills[*].delivery_type:
      flag as "mismatched affix" suggestion with correct_scope

Synergy enabler threshold detection:
  For each build-enabling unique U in the database:
    delta = BuildScore(build with U equipped) - BuildScore(current build)
    if delta > 0.30 × BuildScore(current build):
      find stat thresholds required for U to be BiS
      gap = current_stats vs thresholds
      if gap is achievable within 3 gear slots:
        flag as "game-changer" suggestion
```

### Stage 6 — Claude Narrative Layer
```
Input to Claude:
  {
    suggestions: [
      {
        type: "passive_node" | "gear_upgrade" | "zero_value" | "game_changer",
        priority: "critical" | "high" | "medium" | "low",
        delta_build_score: float,
        delta_damage_pct: float,
        delta_ehp_pct: float,
        context: { node_name?, path_cost?, current_stat?, gap?, unique_name? },
        mechanical_reason: string  // deterministic explanation template
      }
    ],
    build_context: { class, mastery, active_skills, level, slider_position, conditions }
  }

Claude's task:
  For each suggestion, write a 1–3 sentence natural language explanation
  that references the delta values and mechanical reason.
  DO NOT reorder suggestions. DO NOT add suggestions.
  DO NOT contradict the delta values.
```

---

## B. Competitive Tool Reference

### Path of Building — The Gold Standard

PoB's `Efficiency = (DPS_with_node - DPS_without_node) / points_cost_to_reach_node` formula is the proven template. Key difference: PoB scores individual nodes, LEBO scores full paths (including intermediate nodes) — a better heuristic for LE's tree structure where most high-value nodes are deep.

PoB features that Phase 3 targets:
- Power Report → LEBO's Node Efficiency Overlay (FR-A25)
- Color-coded heatmap on tree → same via `--color-node-suggested` plus efficiency tier colors
- Full stat derivation (Calcs tab) → LEBO's stat sheet (narrower — no derivation chains in P3)
- Immediate stat recalculation → FR-B7

PoB features deferred:
- Compare Trees (named tree variants)
- Full derivation chain display (red/blue text in Calcs tab)
- Gem DPS-sort (PoE-specific; skill system is different in LE)

### Solved Exile — The Ceiling

Solved Exile's constraint-based optimization across tree + gear + skills simultaneously is the long-term aspiration. Phase 3 achieves ~70% of Solved Exile's capability for the passive tree domain. Full cross-domain optimization (tree + gear + idol + skills simultaneously) is post-Phase 3.

---

## C. S-Tier Affix Reference

For scoring engine validation — expected output when scoring common builds.

**Offensive (S-Tier):**
- Added Critical Strike Multiplier (T7 weapon): highest single-slot value for any crit build
- Increased Critical Strike Chance: required to reach 100% cap
- Adaptive Spell Damage: universally strong on casters

**Defensive (S-Tier):**
- Hybrid Health (`% Max Health as Flat Bonus`): multiplicatively better than flat health at high HP pools
- Endurance Threshold: extends damage reduction window
- Critical Strike Avoidance: near-mandatory; binary value at 100% cap
- Movement Speed (boots only): non-negotiable slot — always S-tier on boots

Scoring engine unit tests should verify these rank at or near top weight for the relevant archetypes.

---

## D. Defense Layer Mechanics Reference

| Layer | Scoring Model |
|-------|--------------|
| Health | Direct input to EHP |
| Ward | Multiplicative: `EHP × (1 + ward/hp)` for Ward-dominant builds |
| Endurance | Damage reduction factor when below threshold: `1 / (1 - endurance_dr%)` |
| Endurance Threshold | Percentage of HP below which Endurance DR applies — higher threshold = larger window |
| Resistances | Per-element damage reduction; uncapped = EHP loss |
| Armour | Non-linear physical DR — diminishing returns at high values |
| Crit Avoidance | Binary bonus: 0 or 1 at 100% cap. Score as +20% EHP at cap. |
| Dodge | Diminishing returns. Score as EHP multiplier: `1 / (1 - dodge_chance)` |
| Block | Sentinel-specific. Score as EHP multiplier for blocked hit distribution. |

**Layer count bonus:** Each layer beyond 2 that is "active" (above viable threshold) adds a flat 10% scoring bonus to SurvivabilityScore — rewarding builds that stack multiple layers simultaneously, matching the meta pattern.

---

## E. Idol Grid Spec (Default Layout)

The Last Epoch idol grid is a 5×5 space. The Phase 3 default layout has the following cells blocked (0-indexed, row×col):
- Four corners: (0,0), (0,4), (4,0), (4,4)
- Center: (2,2)
- Total active cells: ~20 (exact count depends on current season data — verify against lastepochtools.com/guide/section/idols)

**Idol size types (Phase 3 scope):**
| Type | Grid footprint | Notes |
|------|---------------|-------|
| Minor (1×1) | 1 cell | Universal — any class |
| Stout (1×2) | 1 col × 2 rows | Universal |
| Humble (2×1) | 2 cols × 1 row | Universal |
| Ornate (2×2) | 2 cols × 2 rows | Class-specific variants |
| Grand (1×3) | 1 col × 3 rows | Class-specific |
| Huge (3×1) | 3 cols × 1 row | Class-specific |
| Adorned (1×4) | 1 col × 4 rows | Class-specific, season-dependent |
| Large (4×1) | 4 cols × 1 row | Class-specific, season-dependent |

**Data file structure (proposed schema for `idol-grid.json`):**
```json
{
  "version": "1",
  "defaultGrid": {
    "rows": 5,
    "cols": 5,
    "blockedCells": [[0,0],[0,4],[4,0],[4,4],[2,2]]
  },
  "altarVariants": []  // empty in Phase 3; Phase 4 populates this array
}
```

Placement validation rules:
1. All cells the idol occupies must be within grid bounds
2. No cell may overlap another placed idol
3. All cells must be active (not in `blockedCells`)
4. For class-specific idol types, the equipped character class must match

**Deferred (Phase 4):** Idol Altar system — 13 altar subtypes each with a different cell layout and Refracted Slots (purple cells that amplify affix values). The `altarVariants` array in the data file is the extension point.

---

## F. Tree Background Implementation Notes

The current `pixiRenderer.ts` uses `background: 0x0a0a0b` in `app.init()` — a flat solid color. The Phase 3 implementation changes this to:

```typescript
// In initRenderer(), replace background: 0x0a0a0b with:
await app.init({
  canvas,
  background: 0x000000,  // transparent — TilingSprite handles the background
  backgroundAlpha: 0,
  antialias: true,
  autoDensity: true,
  resolution: window.devicePixelRatio || 1,
})

// Load the appropriate texture (cached at module level, loaded once)
const bgTexture = await Assets.load(
  config.treeLayout === 'weaver' ? 'bg_weaver_tile.webp' : 'bg_stone_tile.webp'
)
const background = new TilingSprite({ texture: bgTexture, width: app.screen.width, height: app.screen.height })
worldContainer.addChildAt(background, 0)  // insert before edgeGraphics

// Add damage-type tint overlay for skill trees (from RendererConfig.damageTint)
if (config.damageTint) {
  const tintOverlay = new Graphics()
  const [r, g, b, a] = config.damageTint  // rgba from FR-F5 palette
  tintOverlay.rect(0, 0, app.screen.width, app.screen.height).fill({ color: (r<<16)|(g<<8)|b, alpha: a })
  worldContainer.addChildAt(tintOverlay, 1)  // after background, before edges
}
```

**Asset sourcing decision tree:**
1. Check if game file extraction (via `icon_commands.rs`) can produce a stone tile (look for UI background textures in game asset paths)
2. If not available: generate `bg_stone_tile.webp` using a one-time Rust script with a Perlin noise crate → export as 256×256 WebP → commit to `src-tauri/resources/backgrounds/`
3. `bg_weaver_tile.webp`: same approach but with a high-frequency, high-contrast crystalline noise pattern tinted purple at generation time

Both textures should be committed as static resources, not generated at runtime.

---

## G. Season 4 Data Notes (formerly §E)

Season 4 (Shattered Omens) launched 2026-03-26. Key additions requiring game data update:

- **New Rogue skills** and Spellblade passive updates — new nodes in existing trees
- **Runes of Corruption** — new affix modification mechanic; new affix entries in the affix database
- **New uniques and set items** — some may be build-enabling uniques for the synergy detector (FR-A21)
- **Echo Chains** — new endgame navigation layer; no direct impact on scoring engine but blessings database may include new entries
- **Omen Windows** — new encounter type; no passive tree impact

The `modifierType` annotation (FR-A6, FR-G2) **is available** via the lastepochtools.com build planner and database (confirmed by Alec, OQ-1 resolution). This is a data ingestion task, not a manual annotation task: Epic G/A should source this field from the community DB and add it to the LEBO game data files. Similarly, affix `scope` / delivery type fields are expected to be present in the same source. Verify at ingestion time; if any affixes are missing scope data, fall back to the affix name heuristic (e.g., "Melee" in the name → `scope: "melee"`) rather than blocking.
