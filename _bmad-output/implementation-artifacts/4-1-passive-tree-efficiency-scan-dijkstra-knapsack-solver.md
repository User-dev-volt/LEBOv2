---
title: 'Passive Tree Efficiency Scan — Dijkstra + Knapsack Solver'
story_id: '4.1'
story_key: '4-1-passive-tree-efficiency-scan-dijkstra-knapsack-solver'
epic: 4
status: ready-for-dev
created: '2026-05-22'
---

## Story

**As a player,**
I want the optimization engine to compute the efficiency of every unallocated passive path using shortest-path traversal with "more" modifier and mastery depth bonuses, then solve for the optimal multi-point allocation within my budget,
**So that** optimization recommendations are the highest-value moves for my specific build, not guesses.

---

## Context

This is Story 4.1 — the first story in Epic 4 and the heaviest Rust story in the project. It is **pure Rust with zero TypeScript changes**. The Tauri command that exposes this to the frontend comes in Story 4.3. This story produces a working, tested Rust function that Story 4.3 will call.

**What came before:**
- Epic 2 built `scoring-core` with `compute_stats()`, `ModifierRegistry`, the `StatSheet` types, and all Stage 1 scoring math. Tests confirm formula correctness.
- Epic 3 wired blessings, idols, and conditions into `BuildSnapshot` and the registry.
- `optimizationStore.nodeEfficiencies: NodeEfficiency[] | null` is already defined in TypeScript (Story 2.5 planted the field). Story 4.4 wires it to the canvas; this story populates the data that flows into it.
- 895 TypeScript tests passing (903 total, 8 pre-existing failures unrelated to this work).

**What this story adds:**
1. Three new fields to `GameData` in `scoring-core/src/game_data.rs`: tree adjacency list, node max-points, and mastery depth map
2. Population of those fields in `src-tauri/src/services/game_data_loader.rs`
3. New `scoring-core/src/scan.rs` implementing `run_efficiency_scan()`
4. Exports from `scoring-core/src/lib.rs`

**What this story does NOT do:**
- Register a Tauri command (Story 4.3)
- Wire `nodeEfficiencies` to the canvas overlay (Story 4.4)
- Implement synergy or zero-value detection (Story 4.2)
- Any TypeScript changes whatsoever

---

## Acceptance Criteria

**Given** a passive tree with 50 unallocated nodes and a single allocated region
**When** `run_efficiency_scan()` is called in `scoring-core/scan.rs`
**Then** each unallocated node has `efficiency = path_delta_score / effective_point_cost`
**And** `effective_point_cost` correctly counts all unallocated prerequisites on the minimum-cost Dijkstra path

**Given** a build with Σ Increased% = 250% (above the 200% threshold) and a "more" damage node unallocated
**When** `run_efficiency_scan()` runs
**Then** that node's efficiency is multiplied by a factor between 3.0 and 5.0 (scaled by `1 + 250/200 = 2.25`, capped at 5×)
**And** an equivalent "increased" modifier node at the same point cost scores lower

**Given** a passive node at depth 8 in the mastery sub-tree
**When** `run_efficiency_scan()` runs
**Then** that node's efficiency includes the 1.2× mastery depth bonus
**And** a node at depth 5 does not receive this bonus

**Given** a player with 6 unspent points
**When** the budget knapsack solver runs after the efficiency scan
**Then** the greedy phase selects the top 20 highest-efficiency candidate paths as the shortlist
**And** the DP knapsack over the shortlist finds the globally optimal combination within the 6-point budget
**And** the output is an ordered allocation list with cheapest-first ordering within each path

**Given** `scoring-core` unit tests for `scan.rs`
**When** `cargo test -p scoring-core` runs
**Then** tests cover: correct Dijkstra path finding on a synthetic tree, "more" multiplier application, mastery depth bonus, knapsack output matching manual calculation for a 5-node example
**And** rayon parallelism produces identical output to a sequential reference implementation

**Given** a passive tree with 150 unallocated nodes
**When** `run_efficiency_scan()` runs using rayon
**Then** the scan completes in < 20ms on target hardware
**And** output is deterministic across repeated runs with the same input

---

## Tasks / Subtasks

- [ ] Task 1: Extend `GameData` in `scoring-core/src/game_data.rs`
  - [ ] Add `node_connections: HashMap<String, Vec<String>>` — undirected adjacency list
  - [ ] Add `node_max_points: HashMap<String, u32>` — max allocatable points per node
  - [ ] Add `node_mastery_depth: HashMap<String, u32>` — BFS distance from mastery entry node per mastery node
  - [ ] Keep all fields `#[derive(Default)]` so existing `GameData::default()` still compiles
- [ ] Task 2: Populate the new fields in `game_data_loader.rs`
  - [ ] Load base tree edges + mastery tree edges into `node_connections` (undirected: insert both directions)
  - [ ] Load `max_points` per node into `node_max_points` (from `RawGameNode.max_points`)
  - [ ] Run BFS from each mastery entry node; populate `node_mastery_depth` with depth ≥ 1 for mastery sub-tree nodes
  - [ ] Confirm `cargo build` still passes
- [ ] Task 3: Create `scoring-core/src/scan.rs`
  - [ ] Define `ScanResult` struct (public)
  - [ ] Implement multi-source Dijkstra to compute minimum-cost path to each unallocated node
  - [ ] Implement `compute_path_delta_score()` (calls `compute_stats` twice: baseline vs. snapshot + path nodes)
  - [ ] Apply "more" modifier multiplier (3–5×) when Σ Increased% > 200%
  - [ ] Apply 1.2× mastery depth bonus for nodes at depth 7–10
  - [ ] Parallelise per-path delta score computation with `rayon::prelude::*`
  - [ ] Implement `classify_efficiency_tiers()` (top 25% → gold, 25–50% → silver, rest → dim)
  - [ ] Implement two-phase budget solver: greedy top-20 shortlist + DP knapsack
  - [ ] Implement `run_efficiency_scan()` public function
  - [ ] Write unit tests in `#[cfg(test)]` at bottom of file (see Testing Requirements)
- [ ] Task 4: Wire up exports in `scoring-core/src/lib.rs`
  - [ ] Add `pub mod scan;`
  - [ ] Export `pub use scan::{run_efficiency_scan, ScanResult};`
  - [ ] Confirm `cargo test -p scoring-core` passes all new + existing tests

---

## Technical Requirements

### 1. Extend `GameData` (`scoring-core/src/game_data.rs`)

Add three fields to the `GameData` struct:

```rust
/// Undirected adjacency list for passive tree graph traversal.
/// Key: node_id. Value: list of directly connected node_ids.
/// Loaded from base_tree.edges + mastery.passive_tree.edges for all classes.
/// Used by the Dijkstra efficiency scan (Story 4.1) and synergy detector (Story 4.2).
pub node_connections: HashMap<String, Vec<String>>,

/// Maximum allocatable points per passive node (from RawGameNode.max_points).
/// Used as Dijkstra edge weight when computing EffectivePointCost.
pub node_max_points: HashMap<String, u32>,

/// BFS depth from mastery entry node for each mastery sub-tree node.
/// Key: node_id. Value: depth (1-indexed; mastery entry node is depth 1).
/// Only mastery sub-tree nodes have entries here; base tree nodes are absent.
/// Depth 7–10 nodes receive the 1.2× efficiency multiplier (FR-A13).
pub node_mastery_depth: HashMap<String, u32>,
```

All three use `HashMap<String, _>` with `Default` derivation (empty HashMap = default), so no changes to any existing `GameData::default()` call.

### 2. Populate new fields in `game_data_loader.rs`

Add to the per-class loading loop (after the existing node effects loop):

```rust
// node_connections: build undirected adjacency list from base tree edges
for edge in &class_data.base_tree.edges {
    node_connections
        .entry(edge.from_id.clone())
        .or_default()
        .push(edge.to_id.clone());
    node_connections
        .entry(edge.to_id.clone())
        .or_default()
        .push(edge.from_id.clone());
}

// node_max_points from base tree
for node in &class_data.base_tree.nodes {
    node_max_points.insert(node.id.clone(), node.max_points);
}

// Masteries: edges + max_points + BFS mastery depth
for mastery in &class_data.masteries {
    for edge in &mastery.passive_tree.edges {
        node_connections.entry(edge.from_id.clone()).or_default().push(edge.to_id.clone());
        node_connections.entry(edge.to_id.clone()).or_default().push(edge.from_id.clone());
    }
    for node in &mastery.passive_tree.nodes {
        node_max_points.insert(node.id.clone(), node.max_points);
    }

    // BFS from mastery entry node (depth 1 = the mastery entry node itself)
    // Mastery entry node = the node in the mastery passive_tree with no in-edges from within
    // the mastery tree (or: simply the first node listed, by convention in the class JSONs).
    if let Some(entry_node) = mastery.passive_tree.nodes.first() {
        let mut queue = std::collections::VecDeque::new();
        queue.push_back((entry_node.id.clone(), 1u32));
        let mastery_node_ids: std::collections::HashSet<_> =
            mastery.passive_tree.nodes.iter().map(|n| &n.id).collect();
        let mut visited = std::collections::HashSet::new();
        while let Some((node_id, depth)) = queue.pop_front() {
            if visited.contains(&node_id) { continue; }
            visited.insert(node_id.clone());
            node_mastery_depth.insert(node_id.clone(), depth);
            if let Some(neighbors) = node_connections.get(&node_id) {
                for neighbor in neighbors {
                    if mastery_node_ids.contains(neighbor) && !visited.contains(neighbor) {
                        queue.push_back((neighbor.clone(), depth + 1));
                    }
                }
            }
        }
    }
}
```

Add these to the `Ok(GameData { ... })` construction at the end of `build_scoring_game_data`.

**IMPORTANT**: The three new `HashMap` variables (`node_connections`, `node_max_points`, `node_mastery_depth`) must be declared before the per-class loop with `HashMap::new()`, then populated inside the loop, and finally passed into `GameData`.

### 3. Create `scoring-core/src/scan.rs`

#### Public API

```rust
use crate::build_snapshot::BuildSnapshot;
use crate::compute::{compute_stats};
use crate::compute_options::ComputeOptions;
use crate::game_data::GameData;
use crate::modifier::{ModifierType, StatKey};
use crate::stat_sheet::NodeEfficiency;
use rayon::prelude::*;
use std::collections::{BinaryHeap, HashMap, HashSet};
use std::cmp::Reverse;

pub struct ScanResult {
    /// Per-node efficiency scores, all reachable unallocated passive nodes.
    pub node_efficiencies: Vec<NodeEfficiency>,
    /// Baseline BuildScore computed from the snapshot as-is (no path changes).
    pub build_score_baseline: f64,
    /// Ordered list of node allocations the knapsack determined is optimal for the current budget.
    /// Each inner Vec is cheapest-first path ordering for a single path.
    pub knapsack_solution: Vec<Vec<String>>,
}

pub fn run_efficiency_scan(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
) -> ScanResult
```

#### Implementation outline

**Step 1 — Baseline score**
```rust
let baseline = compute_stats(snapshot, game_data, ComputeOptions::default());
let build_score_baseline = baseline.scores.build_score;
// Compute Σ Increased% from the current registry for the "more" multiplier threshold
let increased_pct_sum: f64 = {
    let reg = build_registry_from_snapshot(snapshot, game_data); // reuse private fn from compute.rs (make pub(crate))
    reg.query(StatKey::IncreasedDamage, &snapshot.active_conditions)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Increased)
        .map(|m| m.value)
        .sum()
};
```

**IMPORTANT**: `build_registry` is currently `fn build_registry(...)` (private) in `compute.rs`. Promoting it to `pub(crate)` is required so `scan.rs` can reuse it without duplicating logic. Only this one change to `compute.rs` is permitted — do not restructure it.

**Step 2 — Determine unspent budget**
```rust
let total_allocated: u32 = snapshot.node_allocations.values().sum();
let budget = if snapshot.character_level >= 2 {
    snapshot.character_level - 2  // standard LE passive budget
} else {
    0
};
let unspent_points = budget.saturating_sub(total_allocated);
```

**Step 3 — Multi-source Dijkstra**

Run from all currently-allocated nodes simultaneously. Dijkstra cost = total `node_max_points` of all unallocated nodes on the path (allocated nodes contribute cost 0).

```rust
// distances[node_id] = (minimum_effective_cost, predecessor_node_id)
let mut dist: HashMap<String, u32> = HashMap::new();
let mut prev: HashMap<String, Option<String>> = HashMap::new();
let mut heap: BinaryHeap<Reverse<(u32, String)>> = BinaryHeap::new();

// Seed: all currently-allocated nodes at cost 0
for node_id in snapshot.node_allocations.keys() {
    dist.insert(node_id.clone(), 0);
    prev.insert(node_id.clone(), None);
    heap.push(Reverse((0, node_id.clone())));
}

while let Some(Reverse((cost, u))) = heap.pop() {
    if dist.get(&u).copied().unwrap_or(u32::MAX) < cost { continue; }
    let neighbors = game_data.node_connections.get(&u).cloned().unwrap_or_default();
    for v in neighbors {
        let v_max = *game_data.node_max_points.get(&v).unwrap_or(&1);
        let v_allocated = snapshot.node_allocations.contains_key(&v);
        let edge_cost = if v_allocated { 0 } else { v_max };
        let new_cost = cost + edge_cost;
        if new_cost < dist.get(&v).copied().unwrap_or(u32::MAX) {
            dist.insert(v.clone(), new_cost);
            prev.insert(v.clone(), Some(u.clone()));
            heap.push(Reverse((new_cost, v)));
        }
    }
}
```

After Dijkstra: for each unallocated node, reconstruct the path of unallocated nodes by walking `prev` back to the allocated frontier.

**Step 4 — Parallel per-path delta score**

```rust
// Collect all reachable unallocated nodes + their paths
let candidates: Vec<(String, Vec<String>, u32)> = dist
    .iter()
    .filter(|(id, _)| !snapshot.node_allocations.contains_key(*id) && game_data.node_connections.contains_key(*id))
    .filter_map(|(id, &cost)| {
        if cost == u32::MAX { return None; }
        let path = reconstruct_path(id, &prev, snapshot);
        if path.is_empty() { return None; }
        Some((id.clone(), path, cost))
    })
    .collect();

// Parallel delta score computation
let raw_scores: Vec<(String, Vec<String>, u32, f64)> = candidates
    .par_iter()
    .map(|(node_id, path, cost)| {
        let delta = compute_path_delta(path, snapshot, game_data, build_score_baseline);
        (node_id.clone(), path.clone(), *cost, delta)
    })
    .collect();
```

**Step 5 — Apply multipliers and compute efficiency**

```rust
let efficiencies: Vec<(String, Vec<String>, u32, f64, f64)> = raw_scores
    .into_iter()
    .map(|(node_id, path, cost, delta)| {
        if cost == 0 { return (node_id, path, cost, delta, 0.0); }
        let mut eff = delta / cost as f64;

        // "more" modifier multiplier (FR-A12)
        let has_more_node = path.iter().any(|nid| {
            game_data.node_effects.get(nid)
                .map_or(false, |effects| effects.iter().any(|e| e.modifier_type == crate::modifier::ModifierType::More))
        });
        if has_more_node && increased_pct_sum > 200.0 {
            let multiplier = (1.0 + increased_pct_sum / 200.0).min(5.0);
            eff *= multiplier;
        }

        // Mastery depth bonus (FR-A13): applies to the target node only
        if let Some(&depth) = game_data.node_mastery_depth.get(&node_id) {
            if depth >= 7 && depth <= 10 {
                eff *= 1.2;
            }
        }

        (node_id, path, cost, delta, eff)
    })
    .collect();
```

**Step 6 — Tier classification**

Sort by efficiency descending. Top 25% → "gold", 25–50% → "silver", rest → "dim".

```rust
fn classify_tiers(efficiencies: &[f64]) -> Vec<String> {
    let n = efficiencies.len();
    if n == 0 { return vec![]; }
    let gold_cutoff = n / 4;
    let silver_cutoff = n / 2;
    efficiencies.iter().enumerate().map(|(i, _)| {
        if i < gold_cutoff { "gold".to_string() }
        else if i < silver_cutoff { "silver".to_string() }
        else { "dim".to_string() }
    }).collect()
}
```

**Step 7 — Budget knapsack solver**

Phase 1: Greedy top-20 by efficiency.
Phase 2: DP knapsack over shortlist within `unspent_points` budget.

```rust
// Phase 1: top 20 shortlist (sorted by efficiency desc)
let mut sorted = efficiencies.clone();
sorted.sort_by(|a, b| b.4.partial_cmp(&a.4).unwrap_or(std::cmp::Ordering::Equal));
let shortlist: Vec<_> = sorted.into_iter().take(20).collect();

// Phase 2: DP knapsack
// dp[w] = max total delta achievable with exactly w points spent
let budget = unspent_points as usize;
let mut dp = vec![f64::NEG_INFINITY; budget + 1];
dp[0] = 0.0;
let mut chosen = vec![vec![false; shortlist.len()]; budget + 1];

for (i, (_id, _path, cost, delta, _eff)) in shortlist.iter().enumerate() {
    let c = *cost as usize;
    if c > budget { continue; }
    // iterate backwards (0/1 knapsack, items are paths not individual nodes)
    for w in (c..=budget).rev() {
        let candidate = dp[w - c] + delta;
        if candidate > dp[w] {
            dp[w] = candidate;
            chosen[w] = chosen[w - c].clone();
            chosen[w][i] = true;
        }
    }
}

// Extract best solution
let best_w = (0..=budget).rev().find(|&w| dp[w].is_finite() && dp[w] >= 0.0).unwrap_or(0);
let knapsack_solution: Vec<Vec<String>> = (0..shortlist.len())
    .filter(|&i| chosen[best_w][i])
    .map(|i| {
        // Sort path nodes cheapest-first by max_points ascending (FR-A15)
        let mut path = shortlist[i].1.clone();
        path.sort_by_key(|nid| game_data.node_max_points.get(nid).copied().unwrap_or(1));
        path
    })
    .collect();
```

#### Helper functions

```rust
fn reconstruct_path(
    target: &str,
    prev: &HashMap<String, Option<String>>,
    snapshot: &BuildSnapshot,
) -> Vec<String> {
    // Walk prev back to the nearest allocated node (where prev is None or the node is allocated).
    // Returns only the UNALLOCATED nodes on the path (the ones that cost points), excluding
    // the allocated frontier node itself.
    let mut path = vec![];
    let mut current = target.to_string();
    loop {
        if snapshot.node_allocations.contains_key(&current) { break; }
        path.push(current.clone());
        match prev.get(&current) {
            Some(Some(p)) => current = p.clone(),
            _ => break,
        }
    }
    path.reverse(); // cheapest-first: root → target
    path
}

fn compute_path_delta(
    path: &[String],
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    baseline: f64,
) -> f64 {
    // Clone the snapshot, inject path nodes with their max_points as allocations
    let mut modified = snapshot.clone();
    for node_id in path {
        let pts = *game_data.node_max_points.get(node_id).unwrap_or(&1);
        modified.node_allocations.insert(node_id.clone(), pts);
    }
    let result = compute_stats(&modified, game_data, ComputeOptions::default());
    result.scores.build_score - baseline
}
```

### 4. Update `scoring-core/src/lib.rs`

Add:
```rust
pub mod scan;
pub use scan::{run_efficiency_scan, ScanResult};
```

**Required change to `scoring-core/src/compute.rs`**:
Change `fn build_registry(...)` to `pub(crate) fn build_registry(...)` so `scan.rs` can import it. Nothing else changes in `compute.rs`.

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lebo/src-tauri/scoring-core/src/game_data.rs` | MODIFY | Add 3 new fields to `GameData` struct |
| `lebo/src-tauri/src/services/game_data_loader.rs` | MODIFY | Populate `node_connections`, `node_max_points`, `node_mastery_depth` |
| `lebo/src-tauri/scoring-core/src/compute.rs` | MODIFY | Change `fn build_registry` visibility to `pub(crate)` only — no other changes |
| `lebo/src-tauri/scoring-core/src/scan.rs` | CREATE | `run_efficiency_scan()`, Dijkstra, delta scoring, knapsack — all with tests |
| `lebo/src-tauri/scoring-core/src/lib.rs` | MODIFY | Add `pub mod scan; pub use scan::{run_efficiency_scan, ScanResult};` |

**Do not touch:**
- Any TypeScript/React files
- `lib.rs` in the Tauri crate (no new command registered — that is Story 4.3)
- `compute.rs` beyond the `pub(crate)` visibility change to `build_registry`
- `stat_sheet.rs` — `NodeEfficiency` is already defined there (Story 2.1)
- `buildSnapshotSerializer.ts`, `optimizationStore.ts`, any frontend files

---

## Architecture & Pattern Compliance

**Pattern 3 (async locking):** `run_efficiency_scan` is a pure Rust function — no locks, no async. Story 4.3 will call it via `spawn_blocking` with a `RwLock::read().unwrap().clone()` pattern. This story is not responsible for that.

**Pattern 5 (error prefixes):** `run_efficiency_scan` returns `ScanResult` directly (infallible — worst case returns empty `node_efficiencies`). Any data-access failure (missing node_id, etc.) silently skips that node. No `Err()` return type at this layer.

**NFR-4 (data-driven):** All thresholds from the FRs are compile-time constants in `scan.rs`:
```rust
const INCREASED_PCT_THRESHOLD: f64 = 200.0;
const MORE_MULTIPLIER_MIN: f64 = 3.0;
const MORE_MULTIPLIER_CAP: f64 = 5.0;
const MASTERY_DEPTH_BONUS: f64 = 1.2;
const MASTERY_DEPTH_MIN: u32 = 7;
const MASTERY_DEPTH_MAX: u32 = 10;
const KNAPSACK_SHORTLIST_SIZE: usize = 20;
```
These are acceptable as Rust `const` because they encode game-design constants from the PRD (FR-A12, FR-A13, FR-A14) that are not season-patchable stat values. This is the documented exception to NFR-4.

**NFR-5 (ClassModule trait):** `run_efficiency_scan` is not class-aware in Phase 3. Class modules alter the registry in `compute_stats`, so the delta scores naturally incorporate class-specific modifiers when `compute_path_delta` is called. No extra work needed.

**rayon determinism:** Rayon `.par_iter().map()` with no shared mutable state produces deterministic results if the collect order is stable. Use `.collect::<Vec<_>>()` after `.par_iter()` and then sort the results afterwards — never rely on rayon output order.

**Build snapshot cloning in hot loop:** `compute_path_delta` clones `snapshot` per path. With ~150 paths and `BuildSnapshot` containing `HashMap<String, u32>` (typically 50–100 entries), each clone is ~2–5µs. 150 × 5µs = 750µs of clone overhead — well within the 20ms budget. Rayon amortizes this across cores.

**No `ComputeOptions` changes needed:** `run_efficiency_scan` calls `compute_stats` with `ComputeOptions::default()`. Stage 1 only (no optimization sub-stages). The `ComputeOptions` struct is intentionally empty for now.

---

## Testing Requirements

All tests are in `#[cfg(test)]` at the bottom of `scan.rs`.

### Test helpers needed

```rust
fn make_synthetic_tree() -> GameData {
    // A small 6-node linear tree: A → B → C → D (mastery sub-tree: C at depth 1, D at depth 2)
    // A is the base tree root, allocated. B, C, D are unallocated.
    // maxPoints: all = 1. edges: A–B, B–C (mastery boundary), C–D.
    // modifierType on D: More. modifierType on B and C: Increased.
    // ...
}

fn make_snapshot_with_allocation(allocated: &[(&str, u32)]) -> BuildSnapshot {
    let mut s = BuildSnapshot::default();
    s.character_level = 10; // budget = 8 points
    s.slider_position = 50;
    for (id, pts) in allocated {
        s.node_allocations.insert(id.to_string(), *pts);
    }
    s
}
```

### Tests (minimum 6 required by ACs)

1. **Dijkstra finds correct path on linear tree** — node D's `effective_point_cost` is 3 (B + C + D, each 1 point) when only A is allocated
2. **Efficiency formula** — with a known delta and cost, `efficiency = delta / cost`
3. **"more" multiplier applied when Σ Increased% > 200%** — verify multiplier between 3.0 and 5.0
4. **"more" multiplier NOT applied when Σ Increased% ≤ 200%** — efficiency is unscaled
5. **Mastery depth bonus at depth 7–10** — synthesize a node at depth 8; verify 1.2× applied
6. **Mastery depth bonus NOT applied at depth 5** — node at depth 5 not boosted
7. **Knapsack returns optimal allocation for 5-node example** — manually verify against expected result for known input
8. **Rayon output matches sequential output** — compute the same synthetic tree sequentially and via rayon; assert identical `NodeEfficiency` results (after sorting by `node_id`)
9. **Tier classification** — gold nodes are top 25%, silver next 25%, dim the rest
10. **Unreachable nodes excluded** — a node not connected to the allocated region gets no entry in `node_efficiencies`

### Verification commands

From `lebo/src-tauri/` (NOT from `lebo/`):
```bash
cargo test -p scoring-core        # all new tests pass; existing tests unchanged
cargo build -p scoring-core       # compiles cleanly
cargo build                        # full Tauri crate compiles (verifies game_data_loader changes)
```

From `lebo/`:
```bash
pnpm build                         # TypeScript build unaffected (no TS changes in this story)
```

---

## Dev Notes

- **`build_registry` visibility change**: This is the one change allowed to `compute.rs`. Change exactly one token: `fn build_registry` → `pub(crate) fn build_registry`. If the linter flags the function as unused from `compute.rs`'s own tests, suppress with `#[allow(dead_code)]` at module level if needed — but this is unlikely since `compute_stats` still calls it.

- **Adjacency list is undirected**: Insert both directions for every edge (`fromId → toId` AND `toId → fromId`). The passive tree in LE is undirected — you can traverse edges in both directions.

- **Mastery entry node identification**: The mastery entry node is the first node in `mastery.passive_tree.nodes` (by convention in the class JSONs — verified: `void-knight-passive-entry` is always index 0). This is the BFS root for mastery depth computation.

- **`snapshot.node_allocations` keys include base tree and mastery nodes**: The allocated set is all keys in `snapshot.node_allocations`. In the multi-source Dijkstra, seed ALL allocated nodes at cost 0, regardless of whether they're base-tree or mastery nodes.

- **Skill tree nodes are excluded**: `node_connections` loads only from `base_tree.edges` and `mastery.passive_tree.edges` — NOT from `skill.skill_tree.edges`. Skill trees have separate `skillNodeAllocations` in `BuildState`. The efficiency scan is passive-tree-only.

- **Dead-end handling in knapsack**: If `unspent_points == 0`, skip the knapsack entirely and return `knapsack_solution: vec![]`. The scan still runs and produces `node_efficiencies` — just no budget solution.

- **Negative delta nodes**: Some paths may produce a negative `path_delta_score` (e.g., they traverse a path that dilutes a "more" multiplier). Their efficiency is negative — they still appear in `node_efficiencies` with "dim" tier. The knapsack must never select negative-delta paths.

- **Cloning `BuildSnapshot` per path**: `BuildSnapshot` derives `Clone`. The `.node_allocations` HashMap is the only expensive part. Pre-cloning the snapshot once before the rayon loop and cloning from the pre-clone is marginally more efficient but not required — the correctness matters more than the micro-optimization.

- **`compute_path_delta` inserts `max_points` for path nodes**: Use `game_data.node_max_points.get(node_id).copied().unwrap_or(1)` — do NOT use 1 as a hard-coded fallback without the `unwrap_or`. The fallback is only for nodes whose max_points somehow aren't in the map (shouldn't happen in practice, but prevents panic).

- **Test determinism with rayon**: Rayon `.par_iter().map().collect()` output order is implementation-defined. Always sort the results by `node_id` before comparing in tests.

- **BFS for mastery depth avoids the base tree**: The BFS for mastery depth uses `mastery_node_ids: HashSet` to limit traversal to nodes within that mastery's `passive_tree.nodes`. This prevents the BFS from crossing back into base tree nodes via shared edges (the mastery root node connects to the base tree at the class boundary point).

- **Test baseline: 895 TS tests passing** — this story adds Rust tests only. Run `pnpm vitest` to confirm TS tests are unaffected (expected: still 895 passing / 8 pre-existing failures).

---

## Previous Story Intelligence (from 3.4)

- **Store patterns**: `ConditionsPanel` reads stores directly (not props). The consumer of `run_efficiency_scan` in Story 4.3 will also follow direct store access.
- **Mock patterns**: Tests use `vi.mock('...')` + `vi.fn()` — NOT `vi.mocked()`. Not relevant for this Rust-only story, but relevant for Story 4.4 tests.
- **Deferred from 3.3**: "The `Modifier` in `build_registry` may be missing `source: blessing_id.clone()`" — verified this is still in `compute.rs` (blessings use `source: blessing_id.clone()` — confirmed present). This issue is resolved in the existing code.
- **Test count baseline**: 895 TS tests passing (903 total, 8 pre-existing failures). This story adds Rust tests; the TS count should be unchanged.

---

## Dev Agent Record

### Agent Model Used
_(to be filled by dev agent)_

### Debug Log References
_(to be filled by dev agent)_

### Completion Notes List
_(to be filled by dev agent)_

### File List
_(to be filled by dev agent — list exact file paths modified)_

### Review Findings
_(to be filled by code review)_
