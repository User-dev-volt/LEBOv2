# Scoring Model — LEBOv2

**Version:** 1.0  
**Date:** 2026-04-24  
**Author:** Dev Agent (Story 3.1)  
**Status:** Final — used as specification for `scoringEngine.ts`

---

## Purpose

This document defines the scoring model used by `scoringEngine.ts` to produce a `BuildScore { damage, survivability, speed }` for a Last Epoch passive tree build. It serves as the source of truth for the algorithm, tag taxonomy, normalization cap, and composite formula.

---

## Data Source

Game nodes are loaded by `gameDataLoader.ts`, which transforms the raw JSON `effects[]` arrays into a flat merged `GameNode.tags: string[]`. The scoring engine consumes the transformed `GameData` from `useGameDataStore` and operates entirely on `node.tags`.

**Rule:** The engine never reads raw JSON — it always receives already-transformed `GameNode` objects.

---

## Tag Taxonomy

Tags are defined as `Set<string>` constants in `scoringEngine.ts`. Classification is axis-exclusive per node (one node → one axis contribution).

### Damage Axis Tags
```
DAMAGE, VOID, PHYSICAL, FIRE, COLD, LIGHTNING, NECROTIC, POISON, BLEED,
CHAOS, OFFENCE, PENETRATION, DOT, ARMOUR_SHRED, DOUBLE_STRIKE, KILL
```

### Survivability Axis Tags
```
DEFENCE, ARMOUR, HEALTH, WARD, ENDURANCE, BLOCK, DAMAGE_REDUCTION,
RESISTANCE, FORTIFY, SUSTAIN, LEECH
```

### Speed Axis Tags
```
MOVEMENT, ATTACK_SPEED, CAST_SPEED, COOLDOWN, SLOW
```

### Neutral Tags (contribute 0 to all axes)
```
MASTERY, MINION, AREA, AILMENT, SACRIFICE, DURATION, TIME, CONVERSION,
DEBUFF, MELEE (when no DAMAGE present)
```

---

## Tag Priority Resolution

When a node's tag list contains tags from multiple axes, survivability wins:

```
1. survivabilityTags.some(t => tags.includes(t))  → survivability
2. damageTags.some(t => tags.includes(t))          → damage  (no surv required)
3. speedTags.some(t => tags.includes(t))            → speed   (no surv, no damage)
4. else                                             → neutral (0 contribution)
```

**Examples from Void Knight:**
- `["VOID", "DAMAGE", "MELEE"]` → damage (VOID + DAMAGE, no surv tags)
- `["ENDURANCE", "VOID", "DEFENCE"]` → survivability (ENDURANCE + DEFENCE override VOID)
- `["VOID", "BLOCK", "DEFENCE"]` → survivability (BLOCK + DEFENCE override VOID)
- `["MOVEMENT", "BLOCK"]` → survivability (BLOCK present, wins over MOVEMENT)
- `["ATTACK_SPEED", "MINION"]` → speed (ATTACK_SPEED, no surv, no damage)
- `["MASTERY"]` → neutral

---

## Weighting Formula

For each allocated node:

```
weight = allocatedPoints × node.maxPoints
```

`maxPoints` serves as a proxy for node strength — larger nodes (6–8 max points) represent more powerful passives than small nodes (1–4 max points). This means:
- A 6-point node fully allocated: weight = 36
- A 4-point node fully allocated: weight = 16
- A 1-point node fully allocated: weight = 1

---

## Normalization Cap

```
RAW_SCORE_CAP = 650
```

### Derivation

Benchmark: fully allocated Void Knight (Sentinel base tree + full Void Knight mastery, all nodes at max points).

**Damage axis raw score breakdown:**

| Source | Nodes | Raw Weight |
|--------|-------|-----------|
| Sentinel base | gladiator(64), adamant(16) | 80 |
| VK mastery | void-blade(36), time-rot(25), void-herald(16), echoes(25), unstable-anomaly(16), void-erosion(16), dread-pact(25), rift-strike(16), fracture(25), wither(16), decay(16), dread-aura(25), hungering-void(36), void-sword(36), annihilation(25), endless-age(25), obliteration(25), reaper(36), abyssal-echo(25), void-mastery(64) | 529 |
| **Total** | | **609** |

**Survivability axis:** 396 (sentinel base: 239 + VK mastery: 157)  
**Speed axis:** 91 (sentinel base: 25 + VK mastery: 66)

Setting `RAW_SCORE_CAP = 650` produces:
- Damage: `min(100, round(609 / 650 × 100))` = **94** ✓ (god-tier VK damage build scores ~94)
- Survivability: `min(100, round(396 / 650 × 100))` = **61**
- Speed: `min(100, round(91 / 650 × 100))` = **14**

These values are intuitive for Void Knight — a damage-focused mastery with moderate survivability and limited speed.

The cap is conservative enough that a theoretical "ideal" build optimized purely for one axis might approach 94–98, never 100, preserving score headroom for future balance.

---

## Score Computation

```typescript
score = Math.min(100, Math.round((rawAxis / RAW_SCORE_CAP) * 100))
```

Applied to all three axes independently.

### Null vs Zero
- **null**: returned for all axes when classId/masteryId has no game data loaded (FR19 compliance)
- **0**: returned when class/mastery data exists but no nodes are allocated (empty build is scoreable)

---

## Composite Score Formula

```typescript
composite = Math.round(average of non-null axes)
```

If all axes are null → composite is null (no data).  
If any axes are non-null → composite averages only the non-null values.

Computed in `ScoreGauge.tsx`, not in `scoringEngine.ts` (presentation concern).

---

## Performance Benchmark

**Measured:** Not a runtime measurement — analytical estimate based on algorithm complexity.

**Algorithm complexity:** O(n) where n = `Object.keys(nodeAllocations).length`

**Maximum node count:** ~46 nodes (15 Sentinel base + 31 VK mastery). In practice, players allocate a subset.

**Operations per node:** 1 object lookup, 1 `some()` scan over ≤11 tags (surv check), 1 integer multiply, 1 switch.

**Expected wall-clock time:** < 1ms for a fully allocated build on any modern CPU. The 30ms budget (NFR6) is a conservative ceiling; this implementation is ~30× under it.

**Conclusion:** Web Worker migration is not required. Scoring runs synchronously on the main thread without blocking the renderer.

---

## Missing Node Handling

Nodes present in `build.nodeAllocations` but absent from `allNodes` (merged base + mastery trees) are silently skipped — they do not contribute null to any axis. This handles orphaned node IDs from data migrations without breaking score computation.

---

## Future Considerations

- **Multi-effect nodes:** Some real-game nodes have multiple effects spanning different axes. The current model merges all effect tags and classifies the node to a single axis (the most "defensive" axis wins). This is a deliberate simplification for MVP — per-effect scoring can be added in a future story without breaking the AC contract.
- **Node weight refinement:** The `allocatedPoints × maxPoints` proxy is intentionally simple. A per-stat weighting model (e.g., flat damage vs % damage multipliers) would require deeper game data and is deferred post-MVP.
