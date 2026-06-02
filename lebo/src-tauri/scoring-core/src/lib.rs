pub mod build_snapshot;
pub mod class_module;
pub mod classes;
pub mod compute;
pub mod compute_options;
pub mod game_data;
pub mod gear;
pub mod modifier;
pub mod scan;
pub mod stat_sheet;
pub mod synergy;

pub use build_snapshot::{AffixEntry, BuildSnapshot, GearSlotSnapshot, IdolPlacement};
pub use class_module::{ClassModule, ClassStats};
pub use compute::compute_stats;
pub use compute_options::ComputeOptions;
pub use game_data::{
    ArchetypeWeights, ArchetypeWeightsEntry, BaseClassStats, GameData, NodeEffect, UniqueItem,
};
pub use modifier::{
    AffixPosition, Condition, Modifier, ModifierRegistry, ModifierType, Scope, StatKey,
};
pub use gear::run_gear_scoring;
pub use scan::{run_efficiency_scan, ScanResult};
pub use stat_sheet::{
    AilmentStats, DamageTypeBreakdown, DefenseStats, GearAnalysis, MinionStats, NodeEfficiency,
    OffenseStats, ScoreComponents, StatSheet, StatWarning, SynergyFlag,
};
pub use synergy::run_synergy_detection;
