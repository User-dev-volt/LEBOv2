use crate::build_snapshot::BuildSnapshot;
use crate::class_module::{ClassId, ClassModule, ClassStats};
use crate::modifier::ModifierRegistry;
use crate::stat_sheet::StatSheet;

pub struct SentinelModule {
    id: ClassId,
}

impl Default for SentinelModule {
    fn default() -> Self {
        Self { id: "sentinel".to_string() }
    }
}

impl ClassModule for SentinelModule {
    fn class_id(&self) -> &ClassId {
        &self.id
    }

    fn apply_modifiers(&self, _registry: &mut ModifierRegistry, _snapshot: &BuildSnapshot) {
        // Phase 3: no-op. Story 2.2 may add mastery-specific flat stats.
    }

    fn compute_class_stats(&self, _base: &StatSheet, _snapshot: &BuildSnapshot) -> Option<ClassStats> {
        None
    }
}
