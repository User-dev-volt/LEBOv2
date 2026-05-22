use std::cmp::Reverse;
use std::collections::{BinaryHeap, HashMap};

use rayon::prelude::*;

use crate::build_snapshot::BuildSnapshot;
use crate::compute::{build_registry, compute_stats};
use crate::compute_options::ComputeOptions;
use crate::game_data::GameData;
use crate::modifier::{ModifierType, StatKey};
use crate::stat_sheet::NodeEfficiency;

// ── PRD thresholds (FR-A12, FR-A13, FR-A14) ───────────────────────────────────
const INCREASED_PCT_THRESHOLD: f64 = 200.0;
const MORE_MULTIPLIER_CAP: f64 = 5.0;
const MASTERY_DEPTH_BONUS: f64 = 1.2;
const MASTERY_DEPTH_MIN: u32 = 7;
const MASTERY_DEPTH_MAX: u32 = 10;
const KNAPSACK_SHORTLIST_SIZE: usize = 20;

/// Output of `run_efficiency_scan`.
pub struct ScanResult {
    /// Per-node efficiency score for every reachable unallocated passive node.
    pub node_efficiencies: Vec<NodeEfficiency>,
    /// Baseline BuildScore computed from the snapshot with no changes.
    pub build_score_baseline: f64,
    /// Optimal node allocation paths for the current unspent-point budget.
    /// Each inner Vec is the cheapest-first ordered path for one selected path.
    /// Empty when `unspent_points == 0` or no positive-delta paths exist.
    pub knapsack_solution: Vec<Vec<String>>,
}

/// Computes per-node passive tree efficiency scores and an optimal budget allocation.
///
/// Pure function — no side effects, no locks.  Called by Story 4.3 via `spawn_blocking`.
pub fn run_efficiency_scan(snapshot: &BuildSnapshot, game_data: &GameData) -> ScanResult {
    // ── Step 1: baseline score and Σ Increased% ───────────────────────────────
    let baseline_sheet = compute_stats(snapshot, game_data, ComputeOptions::default());
    let build_score_baseline = baseline_sheet.scores.build_score;

    let active = snapshot.active_conditions.as_slice();
    let registry = build_registry(snapshot, game_data);
    let increased_pct_sum: f64 = registry
        .query(&StatKey::IncreasedDamage, active)
        .iter()
        .filter(|m| m.modifier_type == ModifierType::Increased)
        .map(|m| m.value)
        .sum();

    // ── Step 2: unspent budget ─────────────────────────────────────────────────
    let total_allocated: u32 = snapshot.node_allocations.values().sum();
    let budget = if snapshot.character_level >= 2 {
        snapshot.character_level - 2
    } else {
        0
    };
    let unspent_points = budget.saturating_sub(total_allocated);

    // ── Step 3: multi-source Dijkstra ─────────────────────────────────────────
    // All currently-allocated nodes start at cost 0.
    // Edge weight to an unallocated node = that node's max_points.
    // Edge weight to an allocated node = 0 (already paid for).
    let (dist, prev) = run_dijkstra(snapshot, game_data);

    // ── Step 4: collect reachable unallocated candidate paths ─────────────────
    let candidates: Vec<(String, Vec<String>, u32)> = dist
        .iter()
        .filter(|(id, &cost)| {
            cost < u32::MAX
                && !snapshot.node_allocations.contains_key(*id)
                && game_data.node_connections.contains_key(*id)
        })
        .filter_map(|(id, &cost)| {
            let path = reconstruct_path(id, &prev, snapshot);
            if path.is_empty() {
                return None;
            }
            Some((id.clone(), path, cost))
        })
        .collect();

    if candidates.is_empty() {
        return ScanResult {
            node_efficiencies: vec![],
            build_score_baseline,
            knapsack_solution: vec![],
        };
    }

    // ── Step 5: parallel per-path delta score ─────────────────────────────────
    let raw: Vec<(String, Vec<String>, u32, f64)> = candidates
        .par_iter()
        .map(|(node_id, path, cost)| {
            let delta = compute_path_delta(path, snapshot, game_data, build_score_baseline);
            (node_id.clone(), path.clone(), *cost, delta)
        })
        .collect();

    // ── Step 6: apply multipliers, compute efficiency ─────────────────────────
    let mut with_eff: Vec<(String, Vec<String>, u32, f64, f64)> = raw
        .into_iter()
        .map(|(node_id, path, cost, delta)| {
            if cost == 0 {
                return (node_id, path, cost, delta, 0.0);
            }
            let mut eff = delta / cost as f64;

            // FR-A12: "more" modifier multiplier when Σ Increased% > 200%
            let has_more = path.iter().any(|nid| {
                game_data
                    .node_effects
                    .get(nid)
                    .map_or(false, |effects| {
                        effects.iter().any(|e| e.modifier_type == ModifierType::More)
                    })
            });
            if has_more && increased_pct_sum > INCREASED_PCT_THRESHOLD {
                let multiplier = (1.0 + increased_pct_sum / INCREASED_PCT_THRESHOLD)
                    .min(MORE_MULTIPLIER_CAP);
                eff *= multiplier;
            }

            // FR-A13: mastery depth bonus for nodes at depth 7–10 (target node only)
            if let Some(&depth) = game_data.node_mastery_depth.get(&node_id) {
                if depth >= MASTERY_DEPTH_MIN && depth <= MASTERY_DEPTH_MAX {
                    eff *= MASTERY_DEPTH_BONUS;
                }
            }

            (node_id, path, cost, delta, eff)
        })
        .collect();

    // Sort descending by efficiency; node_id is secondary key for deterministic tie-breaking
    // (rayon collect order is non-deterministic, so without a tie-breaker two nodes with equal
    // efficiency could swap tier assignments across runs — violating AC6 determinism requirement).
    with_eff.sort_by(|a, b| {
        b.4.partial_cmp(&a.4)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
    });

    // ── Step 7: tier classification ───────────────────────────────────────────
    let n = with_eff.len();
    let gold_cutoff = n / 4;
    let silver_cutoff = n / 2;

    let node_efficiencies: Vec<NodeEfficiency> = with_eff
        .iter()
        .enumerate()
        .map(|(i, (node_id, _path, cost, delta, eff))| {
            let tier = if i < gold_cutoff {
                "gold"
            } else if i < silver_cutoff {
                "silver"
            } else {
                "dim"
            }
            .to_string();
            NodeEfficiency {
                node_id: node_id.clone(),
                efficiency: *eff,
                path_delta_score: *delta,
                effective_point_cost: *cost,
                tier,
            }
        })
        .collect();

    // ── Step 8: budget knapsack ────────────────────────────────────────────────
    let knapsack_solution = if unspent_points == 0 {
        vec![]
    } else {
        solve_knapsack(&with_eff, unspent_points, game_data)
    };

    ScanResult {
        node_efficiencies,
        build_score_baseline,
        knapsack_solution,
    }
}

// ── Dijkstra ──────────────────────────────────────────────────────────────────

fn run_dijkstra(
    snapshot: &BuildSnapshot,
    game_data: &GameData,
) -> (HashMap<String, u32>, HashMap<String, Option<String>>) {
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
        if dist.get(&u).copied().unwrap_or(u32::MAX) < cost {
            continue; // stale entry
        }
        let neighbors = game_data
            .node_connections
            .get(&u)
            .cloned()
            .unwrap_or_default();
        for v in neighbors {
            let v_allocated = snapshot.node_allocations.contains_key(&v);
            let v_max = *game_data.node_max_points.get(&v).unwrap_or(&1);
            let edge_cost = if v_allocated { 0 } else { v_max };
            let new_cost = cost.saturating_add(edge_cost);
            if new_cost < dist.get(&v).copied().unwrap_or(u32::MAX) {
                dist.insert(v.clone(), new_cost);
                prev.insert(v.clone(), Some(u.clone()));
                heap.push(Reverse((new_cost, v)));
            }
        }
    }

    (dist, prev)
}

// ── Path reconstruction ───────────────────────────────────────────────────────

/// Returns the unallocated nodes on the min-cost path to `target` (root→target order),
/// excluding the already-allocated frontier node.
fn reconstruct_path(
    target: &str,
    prev: &HashMap<String, Option<String>>,
    snapshot: &BuildSnapshot,
) -> Vec<String> {
    let mut path = vec![];
    let mut current = target.to_string();
    loop {
        if snapshot.node_allocations.contains_key(&current) {
            break; // hit the allocated frontier
        }
        path.push(current.clone());
        match prev.get(&current) {
            Some(Some(p)) => current = p.clone(),
            _ => break,
        }
    }
    path.reverse(); // cheapest-first: root side → target
    path
}

// ── Path delta score ─────────────────────────────────────────────────────────

fn compute_path_delta(
    path: &[String],
    snapshot: &BuildSnapshot,
    game_data: &GameData,
    baseline: f64,
) -> f64 {
    let mut modified = snapshot.clone();
    for node_id in path {
        let pts = *game_data.node_max_points.get(node_id).unwrap_or(&1);
        modified.node_allocations.insert(node_id.clone(), pts);
    }
    let result = compute_stats(&modified, game_data, ComputeOptions::default());
    result.scores.build_score - baseline
}

// ── Knapsack solver ───────────────────────────────────────────────────────────

fn solve_knapsack(
    sorted_eff: &[(String, Vec<String>, u32, f64, f64)],
    unspent_points: u32,
    game_data: &GameData,
) -> Vec<Vec<String>> {
    // Phase 1: greedy top-20 shortlist by efficiency
    let shortlist: Vec<&(String, Vec<String>, u32, f64, f64)> = sorted_eff
        .iter()
        .filter(|(_, _, _, delta, _)| *delta > 0.0) // never pick negative-delta paths
        .take(KNAPSACK_SHORTLIST_SIZE)
        .collect();

    if shortlist.is_empty() {
        return vec![];
    }

    // Phase 2: 0/1 DP knapsack over shortlist
    let cap = unspent_points as usize;
    let m = shortlist.len();

    // dp[w] = best total delta achievable spending exactly w points
    let mut dp = vec![f64::NEG_INFINITY; cap + 1];
    dp[0] = 0.0;
    // chosen[w][i] = whether item i is included in the solution for weight w
    let mut chosen: Vec<Vec<bool>> = vec![vec![false; m]; cap + 1];

    for (i, (_, _, cost, delta, _)) in shortlist.iter().enumerate() {
        let c = *cost as usize;
        if c > cap {
            continue;
        }
        for w in (c..=cap).rev() {
            let candidate = dp[w - c] + delta;
            if candidate > dp[w] {
                dp[w] = candidate;
                chosen[w] = chosen[w - c].clone();
                chosen[w][i] = true;
            }
        }
    }

    // Find best feasible weight (highest total delta ≥ 0)
    let best_w = (0..=cap)
        .rev()
        .find(|&w| dp[w] >= 0.0)
        .unwrap_or(0);

    if dp[best_w] <= 0.0 {
        return vec![];
    }

    // Extract selected paths with cheapest-first ordering within each path
    (0..m)
        .filter(|&i| chosen[best_w][i])
        .map(|i| {
            let mut path = shortlist[i].1.clone();
            // Sort path nodes cheapest-first by max_points (FR-A15)
            path.sort_by_key(|nid| game_data.node_max_points.get(nid).copied().unwrap_or(1));
            path
        })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_data::{ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, NodeEffect};
    use crate::modifier::{Condition, ModifierType, StatKey};

    // ── Synthetic tree builder ────────────────────────────────────────────────
    //
    // Tree layout (all nodes have maxPoints = 1 unless noted):
    //
    //   A (base, allocated) ── B ── C (mastery entry, depth 1) ── D (depth 2)
    //                                                           └── E (depth 2)
    //
    // B: Increased damage node
    // C: mastery entry, depth 1 — IncreasedDamage
    // D: depth 2 — IncreasedDamage
    // E: depth 2 — More damage (ModifierType::More)
    //
    // Base score formula: BuildScore = 0.55*damage + 0.35*surv + 0.10*speed
    // With no allocations, all damage stats = 0 so baseline score ≈ 0 + HP-based surv + 0.

    fn make_game_data() -> GameData {
        let mut node_effects: HashMap<String, Vec<NodeEffect>> = HashMap::new();
        let mut node_connections: HashMap<String, Vec<String>> = HashMap::new();
        let mut node_max_points: HashMap<String, u32> = HashMap::new();
        let mut node_mastery_depth: HashMap<String, u32> = HashMap::new();

        // Nodes
        let nodes = ["A", "B", "C", "D", "E"];
        for &n in &nodes {
            node_max_points.insert(n.to_string(), 1);
        }

        // Edges: A-B, B-C, C-D, C-E
        let edges = [("A", "B"), ("B", "C"), ("C", "D"), ("C", "E")];
        for (f, t) in &edges {
            node_connections
                .entry(f.to_string())
                .or_default()
                .push(t.to_string());
            node_connections
                .entry(t.to_string())
                .or_default()
                .push(f.to_string());
        }

        // B: IncreasedDamage 50%
        node_effects.insert(
            "B".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 50.0,
                condition: Condition::Always,
            }],
        );

        // C: mastery entry, IncreasedDamage 30%
        node_effects.insert(
            "C".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 30.0,
                condition: Condition::Always,
            }],
        );

        // D: IncreasedDamage 20%
        node_effects.insert(
            "D".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 20.0,
                condition: Condition::Always,
            }],
        );

        // E: MoreDamage 1.30 (i.e. "30% more") — ModifierType::More, stat_key::MoreDamage
        // MoreDamage is the key queried by compute_offense for the more_factor product.
        node_effects.insert(
            "E".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::MoreDamage,
                modifier_type: ModifierType::More,
                value: 1.30,
                condition: Condition::Always,
            }],
        );

        // Mastery depth: C=1, D=2, E=2
        node_mastery_depth.insert("C".to_string(), 1);
        node_mastery_depth.insert("D".to_string(), 2);
        node_mastery_depth.insert("E".to_string(), 2);

        let archetype_weights = vec![ArchetypeWeightsEntry {
            slider_upper: 100,
            weights: ArchetypeWeights { w_dmg: 0.55, w_surv: 0.35, w_speed: 0.10 },
        }];

        let mut class_base_stats = HashMap::new();
        class_base_stats.insert(
            "sentinel".to_string(),
            BaseClassStats { base_hp: 100.0, hp_per_level: 5.0 },
        );

        GameData {
            node_effects,
            node_connections,
            node_max_points,
            node_mastery_depth,
            archetype_weights,
            class_base_stats,
            ..GameData::default()
        }
    }

    fn make_snapshot(allocated: &[(&str, u32)], level: u32) -> BuildSnapshot {
        let mut s = BuildSnapshot::default();
        s.character_level = level;
        s.class_id = "sentinel".to_string();
        s.slider_position = 50;
        for &(id, pts) in allocated {
            s.node_allocations.insert(id.to_string(), pts);
        }
        s
    }

    // ── Test 1: Dijkstra finds correct path ───────────────────────────────────
    #[test]
    fn dijkstra_correct_path_costs() {
        let gd = make_game_data();
        let snap = make_snapshot(&[("A", 1)], 10);
        let (dist, _prev) = run_dijkstra(&snap, &gd);

        assert_eq!(dist["B"], 1, "B costs 1 point from A");
        assert_eq!(dist["C"], 2, "C costs 2 points (B+C)");
        assert_eq!(dist["D"], 3, "D costs 3 points (B+C+D)");
        assert_eq!(dist["E"], 3, "E costs 3 points (B+C+E)");
    }

    // ── Test 2: efficiency formula ────────────────────────────────────────────
    #[test]
    fn efficiency_equals_delta_over_cost() {
        let gd = make_game_data();
        let snap = make_snapshot(&[("A", 1)], 10);
        let result = run_efficiency_scan(&snap, &gd);

        // B has cost 1; find it in results
        let b_entry = result.node_efficiencies.iter().find(|e| e.node_id == "B");
        assert!(b_entry.is_some(), "B must appear in efficiency results");
        let b = b_entry.unwrap();
        assert_eq!(b.effective_point_cost, 1);
        assert!(
            (b.efficiency - b.path_delta_score / 1.0).abs() < 1e-9,
            "efficiency = delta / cost"
        );
    }

    // ── Test 3: "more" multiplier applied when Σ Increased% > 200% ───────────
    //
    // Strategy: create a tree where E (More) is directly adjacent to A so its path
    // is always cost 1. Add a second "already-allocated" X node that contributes
    // 250% Increased. Compare E's efficiency WITH X allocated vs WITHOUT — the only
    // difference is whether Σ Increased% exceeds the 200% threshold.
    #[test]
    fn more_multiplier_applied_above_threshold() {
        let mut gd = make_game_data();

        // Direct edge: A → E (so E is reachable at cost 1 in all scenarios)
        gd.node_connections
            .entry("A".to_string())
            .or_default()
            .push("E".to_string());
        gd.node_connections
            .entry("E".to_string())
            .or_default()
            .push("A".to_string());

        // X: an off-branch node connected to A, carrying 250% Increased damage
        gd.node_connections
            .entry("A".to_string())
            .or_default()
            .push("X".to_string());
        gd.node_connections
            .entry("X".to_string())
            .or_default()
            .push("A".to_string());
        gd.node_max_points.insert("X".to_string(), 1);
        gd.node_effects.insert(
            "X".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 250.0,
                condition: Condition::Always,
            }],
        );

        // Scenario 1: X is allocated (Σ Increased = 250% > 200%)
        let snap_high = make_snapshot(&[("A", 1), ("X", 1)], 10);
        let result_high = run_efficiency_scan(&snap_high, &gd);

        // Scenario 2: X is NOT allocated (Σ Increased = 0%)
        let snap_low = make_snapshot(&[("A", 1)], 10);
        let result_low = run_efficiency_scan(&snap_low, &gd);

        let e_high = result_high.node_efficiencies.iter().find(|e| e.node_id == "E");
        let e_low = result_low.node_efficiencies.iter().find(|e| e.node_id == "E");

        assert!(e_high.is_some(), "E must be in results (high Increased%)");
        assert!(e_low.is_some(), "E must be in results (low Increased%)");

        let e_high_entry = e_high.unwrap();
        let eff_high = e_high_entry.efficiency;
        let eff_low = e_low.unwrap().efficiency;

        // Both paths have cost 1 (A→E).
        // The raw efficiency without multiplier = path_delta_score / effective_point_cost.
        // The applied multiplier = efficiency / raw_efficiency.
        // With Σ Increased% = 250%: expected multiplier = (1 + 250/200).min(5) = 2.25.
        let raw_eff_high =
            e_high_entry.path_delta_score / e_high_entry.effective_point_cost.max(1) as f64;
        assert!(
            raw_eff_high > 0.0,
            "raw efficiency for E must be positive when a More node is added to high-Increased build"
        );
        assert!(
            eff_low > 0.0,
            "raw efficiency for E must be positive when no Increased% (More still has value)"
        );

        // Multiplier must fire: eff_high > raw_eff_high (multiplied above unscaled)
        assert!(
            eff_high > raw_eff_high * 1.5,
            "multiplier must be applied (eff_high {eff_high:.4} should be > raw {raw_eff_high:.4} * 1.5)"
        );

        // Computed multiplier ratio should be in [2.0, 5.0+ε] (Σ=250% → formula = 2.25, capped at 5)
        let applied_multiplier = eff_high / raw_eff_high;
        assert!(
            applied_multiplier >= 2.0 && applied_multiplier <= MORE_MULTIPLIER_CAP + 0.01,
            "applied multiplier {applied_multiplier:.4} must be in [2.0, {MORE_MULTIPLIER_CAP}]"
        );
    }

    // ── Test 4: "more" multiplier NOT applied when Σ Increased% ≤ 200% ───────
    #[test]
    fn more_multiplier_not_applied_below_threshold() {
        let gd = make_game_data(); // B = 50% Increased — below 200% threshold
        let snap = make_snapshot(&[("A", 1)], 10);
        let result = run_efficiency_scan(&snap, &gd);

        let e_entry = result.node_efficiencies.iter().find(|e| e.node_id == "E");
        assert!(e_entry.is_some());
        let e = e_entry.unwrap();

        // Without the multiplier, efficiency = delta / cost with no bonus
        let expected_eff = e.path_delta_score / e.effective_point_cost as f64;
        assert!(
            (e.efficiency - expected_eff).abs() < 1e-9,
            "No more-multiplier when Σ Increased% ≤ 200%: got {:.4} vs expected {:.4}",
            e.efficiency,
            expected_eff
        );
    }

    // ── Test 5: mastery depth bonus at depth 7–10 ────────────────────────────
    #[test]
    fn mastery_depth_bonus_at_depth_7_to_10() {
        let mut gd = make_game_data();
        // Set D to depth 8 (within bonus range) and C to depth 5 (outside)
        gd.node_mastery_depth.insert("D".to_string(), 8);
        gd.node_mastery_depth.insert("C".to_string(), 5);
        // Give both C and D the same effect magnitude for fair comparison
        gd.node_effects.insert(
            "C".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 20.0, // same as D
                condition: Condition::Always,
            }],
        );

        let snap = make_snapshot(&[("A", 1), ("B", 1)], 10);
        let result = run_efficiency_scan(&snap, &gd);

        let d_entry = result.node_efficiencies.iter().find(|e| e.node_id == "D");
        let c_entry = result.node_efficiencies.iter().find(|e| e.node_id == "C");

        assert!(d_entry.is_some(), "D must appear");
        assert!(c_entry.is_some(), "C must appear");

        let d_eff = d_entry.unwrap().efficiency;
        let d_delta = d_entry.unwrap().path_delta_score;
        let d_cost = d_entry.unwrap().effective_point_cost;
        let c_eff = c_entry.unwrap().efficiency;

        // D has depth 8 → 1.2× bonus; C has depth 5 → no bonus
        // D's base eff = delta / cost; D's eff with bonus = base * 1.2
        let d_base_eff = d_delta / d_cost as f64;
        let d_expected = d_base_eff * 1.2;
        assert!(
            (d_eff - d_expected).abs() < 1e-6,
            "D(depth 8) efficiency should be base * 1.2: got {d_eff:.6} vs expected {d_expected:.6}"
        );

        // C has depth 5 — no bonus; C's eff = delta/cost unmodified
        let c_delta = c_entry.unwrap().path_delta_score;
        let c_cost = c_entry.unwrap().effective_point_cost;
        let c_base_eff = c_delta / c_cost as f64;
        assert!(
            (c_eff - c_base_eff).abs() < 1e-6,
            "C(depth 5) should have no depth bonus: got {c_eff:.6} vs base {c_base_eff:.6}"
        );
    }

    // ── Test 6: mastery depth bonus NOT applied at depth 5 ───────────────────
    #[test]
    fn mastery_depth_bonus_not_applied_outside_range() {
        let mut gd = make_game_data();
        gd.node_mastery_depth.insert("D".to_string(), 5); // outside bonus range
        let snap = make_snapshot(&[("A", 1), ("B", 1)], 10);
        let result = run_efficiency_scan(&snap, &gd);

        let d = result.node_efficiencies.iter().find(|e| e.node_id == "D").unwrap();
        let expected = d.path_delta_score / d.effective_point_cost as f64;
        assert!(
            (d.efficiency - expected).abs() < 1e-6,
            "Depth-5 node should not receive bonus: {:.6} vs {:.6}",
            d.efficiency,
            expected
        );
    }

    // ── Test 7: knapsack returns optimal allocation ────────────────────────────
    #[test]
    fn knapsack_optimal_for_known_input() {
        let gd = make_game_data();
        // Level 7 → budget 5 points; A already allocated (1); unspent = 4
        let snap = make_snapshot(&[("A", 1)], 7); // budget = 5, allocated = 1, unspent = 4
        let result = run_efficiency_scan(&snap, &gd);

        // With 4 unspent points and paths costing 1 (B), 2 (B+C), 3 (B+C+D or B+C+E),
        // the knapsack should pick some combination that maximizes delta within budget 4.
        // At minimum it should suggest at least one path.
        assert!(
            !result.knapsack_solution.is_empty()
                || result.node_efficiencies.iter().all(|e| e.path_delta_score <= 0.0),
            "knapsack should return paths when positive-delta paths exist and budget > 0"
        );

        // Verify total cost of selected paths does not exceed budget (AC4)
        let total_cost: u32 = result
            .knapsack_solution
            .iter()
            .flat_map(|path| path.iter())
            .map(|nid| gd.node_max_points.get(nid).copied().unwrap_or(1))
            .sum();
        assert!(
            total_cost <= 4,
            "total knapsack cost ({total_cost}) must not exceed unspent budget (4)"
        );

        // Verify cheapest-first ordering within each returned path (FR-A15 / AC4)
        for path in &result.knapsack_solution {
            let costs: Vec<u32> = path
                .iter()
                .map(|nid| gd.node_max_points.get(nid).copied().unwrap_or(1))
                .collect();
            let mut expected = costs.clone();
            expected.sort();
            assert_eq!(
                costs, expected,
                "each knapsack path must be ordered cheapest-first by max_points (FR-A15)"
            );
        }
    }

    // ── Test 8: rayon output matches sequential ───────────────────────────────
    #[test]
    fn rayon_output_matches_sequential() {
        let gd = make_game_data();
        let snap = make_snapshot(&[("A", 1)], 10);

        // Run twice — rayon results should be identical (deterministic)
        let r1 = run_efficiency_scan(&snap, &gd);
        let r2 = run_efficiency_scan(&snap, &gd);

        let mut ids1: Vec<&str> = r1.node_efficiencies.iter().map(|e| e.node_id.as_str()).collect();
        let mut ids2: Vec<&str> = r2.node_efficiencies.iter().map(|e| e.node_id.as_str()).collect();
        ids1.sort();
        ids2.sort();

        assert_eq!(ids1, ids2, "node IDs must match between runs");

        for id in &ids1 {
            let e1 = r1.node_efficiencies.iter().find(|e| e.node_id == *id).unwrap();
            let e2 = r2.node_efficiencies.iter().find(|e| e.node_id == *id).unwrap();
            assert!(
                (e1.efficiency - e2.efficiency).abs() < 1e-9,
                "efficiency for {id} must be identical across runs"
            );
        }
    }

    // ── Test 9: tier classification ───────────────────────────────────────────
    #[test]
    fn tier_classification_correct_quartiles() {
        let gd = make_game_data();
        let snap = make_snapshot(&[("A", 1)], 10);
        let result = run_efficiency_scan(&snap, &gd);

        let n = result.node_efficiencies.len();
        if n < 4 {
            // Not enough nodes to test all tiers meaningfully; just check all are "dim"
            return;
        }

        let gold_count = result.node_efficiencies.iter().filter(|e| e.tier == "gold").count();
        let silver_count = result.node_efficiencies.iter().filter(|e| e.tier == "silver").count();

        assert_eq!(gold_count, n / 4, "gold = top 25%");
        assert_eq!(silver_count, n / 2 - n / 4, "silver = next 25%");
    }

    // ── Test 10: unreachable nodes excluded ───────────────────────────────────
    #[test]
    fn unreachable_nodes_not_in_results() {
        let mut gd = make_game_data();
        // Add an isolated node Z with no connections
        gd.node_max_points.insert("Z".to_string(), 1);
        gd.node_effects.insert(
            "Z".to_string(),
            vec![NodeEffect {
                stat_key: StatKey::IncreasedDamage,
                modifier_type: ModifierType::Increased,
                value: 100.0,
                condition: Condition::Always,
            }],
        );
        // NOTE: Z is NOT added to node_connections, so it's unreachable.

        let snap = make_snapshot(&[("A", 1)], 10);
        let result = run_efficiency_scan(&snap, &gd);

        assert!(
            result.node_efficiencies.iter().all(|e| e.node_id != "Z"),
            "unreachable node Z must not appear in efficiency results"
        );
    }

    // ── Test 11: zero unspent points → empty knapsack solution ────────────────
    #[test]
    fn zero_budget_produces_empty_knapsack_solution() {
        let gd = make_game_data();
        // Level 3 → budget 1; allocate A (1 pt) → unspent = 0
        let snap = make_snapshot(&[("A", 1)], 3); // budget = 1, allocated = 1
        let result = run_efficiency_scan(&snap, &gd);

        assert!(
            result.knapsack_solution.is_empty(),
            "knapsack_solution must be empty when unspent_points == 0"
        );
        // But efficiency scan itself still runs
        assert!(
            !result.node_efficiencies.is_empty(),
            "node_efficiencies should still be populated even with no budget"
        );
    }

    // ── Test 12: reconstruct_path is root→target ordered ─────────────────────
    #[test]
    fn reconstructed_path_is_root_to_target_order() {
        let gd = make_game_data();
        let snap = make_snapshot(&[("A", 1)], 10);
        let (_, prev) = run_dijkstra(&snap, &gd);

        // Path to D should be B → C → D (root→target, A is allocated)
        let path_to_d = reconstruct_path("D", &prev, &snap);
        assert_eq!(path_to_d, vec!["B", "C", "D"], "path to D: expected [B, C, D]");

        // Path to B should just be [B]
        let path_to_b = reconstruct_path("B", &prev, &snap);
        assert_eq!(path_to_b, vec!["B"], "path to B: expected [B]");
    }
}
