use crate::build_snapshot::BuildSnapshot;
use crate::modifier::ModifierRegistry;
use crate::stat_sheet::StatSheet;

/// Type alias for class identifiers — matches the `classId` in `BuildSnapshot`.
pub type ClassId = String;

/// Class-specific derived stats computed after the base `StatSheet`.
/// Empty in Phase 3; Phase 4 adds class-specific fields per Paradox Class.
#[derive(Debug, Clone, Default)]
pub struct ClassStats {}

/// Trait for pluggable class-specific scoring modules (NFR-5).
/// Phase 3 ships five stubs. Paradox Classes implement this trait without
/// modifying the base scoring engine.
pub trait ClassModule: Send + Sync {
    fn class_id(&self) -> &ClassId;

    /// Registers class-specific modifiers into the registry before computation.
    /// E.g., mastery-granted flat stats, class-unique conditional bonuses.
    fn apply_modifiers(&self, registry: &mut ModifierRegistry, snapshot: &BuildSnapshot);

    /// Computes class-specific stats from the base sheet.
    /// Returns `None` if no class-specific adjustments are needed.
    fn compute_class_stats(&self, base: &StatSheet, snapshot: &BuildSnapshot) -> Option<ClassStats>;
}
