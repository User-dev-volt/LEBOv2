use crate::build_snapshot::BuildSnapshot;
use crate::class_module::{ClassId, ClassModule, ClassStats};
use crate::modifier::ModifierRegistry;
use crate::stat_sheet::StatSheet;

pub struct AcolyteModule {
    id: ClassId,
}

impl Default for AcolyteModule {
    fn default() -> Self {
        Self { id: "acolyte".to_string() }
    }
}

impl ClassModule for AcolyteModule {
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
