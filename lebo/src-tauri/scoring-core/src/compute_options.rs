/// Options controlling scoring computation behavior.
#[derive(Debug, Clone, Default)]
pub struct ComputeOptions {
    /// Opt-in stat-source attribution (FR-12). `true` only on the display `compute_stats` call
    /// (Pattern P4-2); `Default` is `false`, so every scan/knapsack/gear/synergy/complete-opt
    /// loop path stays allocation-free and `StatSheet.stat_sources` returns `None`.
    pub track_sources: bool,
}
