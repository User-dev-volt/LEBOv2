# Weaver Tree Research Spike — Findings

**Date:** 2026-05-13  
**Story:** 4.1  
**Researcher:** Claude (claude-sonnet-4-6)

---

## 1. Data Sources Evaluated

| Source | URL | Weaver Tree Node Data Found | Format | License | Accessibility |
|--------|-----|----------------------------|--------|---------|---------------|
| tunklab.com | https://lastepoch.tunklab.com/ | ❌ No (has faction rank data only) | HTML (structured table) | Unknown / fan site | ✅ Accessible (SSL 526 resolved as of 2026-05-13) |
| lastepochtools.com | https://www.lastepochtools.com/ | Unknown (blocked) | Unknown | Unknown | ❌ HTTP 403 + Cloudflare challenge — automated and browser access both blocked |
| Musholic/PathOfBuildingForLastEpoch | https://github.com/Musholic/PathOfBuildingForLastEpoch | ❌ No | Lua | MIT | ✅ Accessible |
| prowner/last-epoch-data | https://github.com/prowner/last-epoch-data | ❌ No | TypeScript | Unlicensed | ✅ Accessible |
| Last Epoch Wiki (official) | https://wiki.lastepoch.com/wiki/Weaver_Tree | ❌ Offline | — | — | ❌ ECONNREFUSED |
| Last Epoch Fandom Wiki | https://lastepoch.fandom.com/wiki/Weaver_Tree | ❌ | — | — | ❌ HTTP 403 |
| GitHub topic search | https://github.com/topics/last-epoch | ❌ No | — | — | ✅ Accessible |
| maxroll.gg guides | https://maxroll.gg/last-epoch/resources/weaver-tree-strategies | Partial (human-readable node names only) | HTML | — | ✅ Accessible |
| aoeah.com | https://www.aoeah.com/ | ❌ No (strategy guide only) | HTML | — | ✅ Accessible |
| eld.gg | https://eld.gg/ | ❌ No (strategy guide only) | HTML | — | ✅ Accessible |
| mmojugg.com | https://mmojugg.com/ | ❌ No (strategy guide only) | HTML | — | ✅ Accessible |

**Summary:** No community source provides machine-readable Weaver Tree node data (node IDs, x/y positions, edge connections, or point costs per node). The lastepochtools.com planner is known to implement the Weaver Tree, but all access is blocked by Cloudflare — no data can be retrieved.

---

## 2. Node Data Format

**Result: No machine-readable node data found.**

Community guides (maxroll.gg, aoeah.com, eld.gg, mmojugg.com) name individual Weaver Tree nodes and describe their effects, but only as human-readable strategy content. None provides:

- Node IDs or internal identifiers
- x/y coordinates or positional data
- Edge/connection graph between nodes
- Point cost per individual node (all nodes appear to cost 1 point)
- Prerequisite relationships between nodes

**Partial node catalog (from community guides — effects only, no positions):**

| Node Name | Effect |
|-----------|--------|
| Imprint Slots | Additional item imprint slots |
| Anchored Reality | Increases Timeline Stability from enemy kills |
| Woven Fortune | Reward modifiers |
| Faded Nemesis | Nemesis mechanics |
| Warlord's Riches | Loot modifiers |
| Commoner's Riches | Drop chance for item piles from kills |
| Eclipsed Battleground | Removes Arena echoes from timeline |
| Duel Destruction / Dual Destruction | Champions may appear in pairs |
| Twin Mage Chance | Exiled Mage pair chance |
| Exalted Challenger | Exalted item chance |
| Heroic Gauntlet | Encounter modifiers |
| Favor Cache Spawn | Cache spawn chance |
| Fury and Fortune | Reward + difficulty modifiers |
| Prime Weaver | (endgame node) |
| Memories of Fortune | Low-value node |
| Crystal Growth | Low-value node |
| Primordial Ambush | Low-value node |

This list is **incomplete** — community guides (primarily maxroll.gg and aoeah.com strategy articles) mention roughly 15–20 named nodes out of an estimated total of ~70 (the ~70 figure comes from maxroll.gg's Weaver Tree guide, which states "roughly 70 nodes" — not machine-confirmed). No source provides the complete node catalog with structural data.

---

## 3. Point Pool Mechanics

**Fully confirmed from tunklab.com (`/faction/the_woven`) — verified 2026-05-13, game version 1.4.6:**

### Point Sources

**Source 1 — Woven Faction Ranks (13 points total):**

| Rank | Points Granted | Reputation Required |
|------|---------------|---------------------|
| 1 | +1 | 1 |
| 2 | +1 | 1,000 |
| 3 | +1 | 2,500 |
| 4 | +1 | 5,000 |
| 5 | +1 | 10,000 |
| 6 | +1 | 17,500 |
| 7 | +1 | 30,000 |
| 8 | +1 | 50,000 |
| 9 | +2 | 75,000 |
| 10 | +3 | 100,000 |

Formula: Ranks 1–8 yield 1 point each (8 points), Rank 9 yields 2 points, Rank 10 yields 3 points. **Total from ranks: 13 points.**

**Source 2 — Woven Echoes (40 points total):**

43 Woven Echoes exist (confirmed from tunklab.com `/woven-echoes`). Each completed-for-the-first-time echo grants Weaver Tree points. Most echoes give 1 point; "Tomb of Vessels" and "The Fading Brink" each give 2 points. Total from echoes: **~40 points** (approximate — the exact distribution of 0-point echoes is not confirmed; the tunklab page shows the total without a per-echo breakdown).

**Grand total: ~53 Weaver Tree points** (13 from ranks + ~40 from echoes — echo component is approximate).

### Per-Node Spending Cost

**All nodes cost 1 point each** (per community guides; no source provides a node with a different cost). This is consistent with the ~70 node count and ~53 total points — not all nodes can be allocated in a single playthrough.

### Separation from Passive Trees

**Confirmed separate pool.** Weaver Tree points are a completely distinct currency from class passive tree points and active skill tree points. They are earned exclusively through The Woven faction progression and Woven Echo completions — never through leveling characters.

### Visual Layout

The tree is described consistently across community sources as "web-based" — a radial web structure rather than a grid or linear tree. The number of tiers or rings is not documented by any accessible source. The total node count is approximately **70 nodes** (from community strategy guides; not machine-confirmed).

---

## 4. Coordinate Compatibility

**No coordinates exist in any accessible source — compatibility question is moot for GO/NO-GO.**

The existing `TreeData` type at `lebo/src/shared/types/treeData.ts` is:

```typescript
// Actual TreeNode interface:
export interface TreeNode {
  id: string
  x: number
  y: number
  size: NodeSize          // 'small' | 'medium' | 'large'
  maxPoints: number
  connections: string[]   // IDs of adjacent nodes (replaces per-node edge list)
  state: NodeState        // 'allocated' | 'available' | 'locked' | 'suggested'
}

// Actual TreeEdge interface:
export interface TreeEdge {
  fromId: string
  toId: string
}

export interface TreeData {
  nodes: TreeNode[]
  edges: TreeEdge[]
}
```

**Important:** `TreeNode` has **no `name` or `effects` fields**. These are display-layer concerns provided by the game data pipeline separately. If Weaver Tree data is ever available, Story 4.3 would need to either (a) extend `TreeNode` with Weaver-specific display fields, or (b) supply a parallel lookup map `weaverId → {name, effects}` alongside the `TreeData` structure — consistent with how the passive tree pipeline works.

Since no community source provides x/y coordinates:

- **Direct use**: Not possible — no coordinate data exists.
- **Algorithmic derivation**: Would require a complete node list with connection graph (edges). The connection graph does not exist in any accessible source either. Without edges, even a force-directed or radial layout algorithm cannot reconstruct the tree topology.
- **Comparison with passive trees**: Story 1.3b (`_bmad-output/_phase1-archive/implementation-artifacts/1-3b-game-data-pipeline-implementation.md`) derived passive tree positions algorithmically because the node IDs and edge list were available from the game data JSON. The Weaver Tree has neither.

**Bottom line:** No coordinate derivation path is currently feasible because the prerequisite (node list + edge graph) does not exist in any accessible form.

---

## 5. GO / NO-GO Recommendation

> **NO-GO for Story 4.3 (Weaver Tree Renderer).**

**Reason:** No machine-readable Weaver Tree node data exists in any community source. The minimum required inputs for Story 4.3 — node IDs, a complete node list, and an edge/connection graph — are unavailable. Without these, neither direct coordinate use nor algorithmic layout derivation is possible. lastepochtools.com has implemented the Weaver Tree in their planner (per community reports; direct verification was not possible — the site is Cloudflare-protected and inaccessible to both automated and browser-based inspection during this spike), meaning the data *exists* somewhere (likely extracted from game files directly), but the data format is unknown.

**What would change this to GO:**
1. A community data dump (JSON/Lua) of Weaver Tree nodes with IDs and connection graph becomes publicly accessible, OR
2. Direct game file extraction (Unity asset bundle extraction similar to the icon pipeline in Story 2.2) is attempted — but this is a separate research spike and not in scope for this story.

---

## 6. Impact on Story 4.2

**Story 4.2 (Weaver Tree placeholder tab) is NOT blocked.** It proceeds regardless of this spike outcome per AC #2.

**Recommended placeholder text** (based on NO-GO outcome):

> "Weaver Tree planning is in research. Node data is not yet available from community sources."

This is more precise than the generic message in the story's Dev Notes, because the specific blocker is now known: community data sources don't expose the node graph, not that the system is undocumented.

---

## 7. Impact on Story 4.3

**NO-GO outcome: Story 4.3 is deferred pending data availability.**

No changes to `gameDataStore.ts` or `buildStore.ts` are needed for the Story 4.2 placeholder path. The architecture decisions in `_bmad-output/planning-artifacts/architecture.md` Decision 7 remain valid as a forward plan:

| Aspect | Planned Value (deferred) |
|--------|--------------------------|
| Data field | `useGameDataStore.weaverTreeData: TreeData \| null` |
| Allocation tracking | `useBuildStore.weaverAllocations: Record<string, number>` |
| Renderer | `<SkillTreeCanvas treeLayout="weaver" />` + `weaverLayout()` in `pixiRenderer.ts` |
| Feature folder | `src/features/weaver-tree/` |
| Point pool label | `UnspentCounter` above Weaver Tree, separate from passive counter |

**Recommended re-evaluation triggers:**
- The Musholic/PathOfBuildingForLastEpoch repository adds Weaver Tree node data (repo is MIT-licensed and actively maintained at v0.12.0 as of April 2025; check for updates on next epic boundary)
- A community member publishes a data extraction from Last Epoch's Unity asset bundles covering Weaver Tree nodes
- lastepochtools.com makes their Weaver Tree data accessible via a public API or data download

**Story 4.3 becomes a re-spike + implementation story** when any of the above triggers fire. The implementation architecture is fully designed and requires no further planning.
