//! Minion stat computation (minion count, minion HP, minion damage, minion speed). FR-10.
//! Story 1.5: `minion_damage_multi` is sourced from `StatKey::IncreasedMinionDamage` (passive
//! `DAMAGE`+`MINION` nodes, the `increased_minion_damage` idol affix, and a blessing) — a key the
//! loader already produces but nothing consumed before, so reading it carries zero parity risk.
//! `minion_count` has no shipped source; `minion_hp_multi` / `minion_speed` are conflated into the
//! player's MaxHp / AttackSpeed by the loader (`HEALTH`+`MINION` / `ATTACK_SPEED`+`MINION` nodes
//! without a DAMAGE tag fall into the player branches). De-conflating them would perturb the frozen
//! `effective_hp` / speed parity gate, so all three surface honest 0.0 here. Full minion correctness
//! is the tracked post–Epic-5 follow-up (see Story 1.5 Decision).

use crate::build_snapshot::BuildSnapshot;
use crate::modifier::{ModifierRegistry, StatKey};
use crate::stat_sheet::MinionStats;

pub(super) fn compute_minion(registry: &ModifierRegistry, active: &[String]) -> MinionStats {
    let raw_damage_multi: f64 = registry
        .query(&StatKey::IncreasedMinionDamage, active)
        .iter()
        .map(|m| m.value)
        .sum();
    // NaN/inf guard: a non-finite total would serialize as JSON `null`, breaking the TS `number`
    // contract. Mirrors `ailment::sum`. [Story 1.5 code review 2026-06-03]
    let minion_damage_multi = if raw_damage_multi.is_finite() { raw_damage_multi } else { 0.0 };

    MinionStats {
        // No shipped `+N minion` source found in the audit → honest 0.0, no dead key.
        minion_count: 0.0,
        minion_damage_multi,
        // Conflated into player MaxHp / AttackSpeed by the loader; left 0.0 to preserve the frozen
        // effective_hp / speed parity gate (deferred — Story 1.5 Decision).
        minion_hp_multi: 0.0,
        minion_speed: 0.0,
    }
}

/// Minion-skill-presence signal (Story 1.5 Decision 1). `GameData` carries no per-skill tag
/// metadata, so "≥1 minion skill assigned" cannot be read directly. Available signals: the
/// Primary Offense delivery type (`"minion"`) and the presence of any minion-scoped modifier in
/// the registry. Either fires the Minion sub-sheet. A non-primary minion skill with no minion
/// modifier won't trigger it until Epic-5 skill metadata loads — documented and acceptable.
pub(super) fn has_minion_skill(
    snapshot: &BuildSnapshot,
    registry: &ModifierRegistry,
    active: &[String],
) -> bool {
    // Trim + case-fold to match the tolerant delivery-type comparison used elsewhere
    // (`modifier.rs` `from_data_str`) — raw `== "minion"` would miss `"Minion"` / `" minion"`
    // and hide the Minion sub-sheet for a genuine minion build. [Story 1.5 code review 2026-06-03]
    if snapshot
        .primary_offense_delivery_type
        .as_deref()
        .map(|s| s.trim().eq_ignore_ascii_case("minion"))
        == Some(true)
    {
        return true;
    }
    [
        StatKey::IncreasedMinionDamage,
        StatKey::IncreasedMinionCount,
        StatKey::IncreasedMinionHp,
    ]
    .iter()
    .any(|key| !registry.query(key, active).is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modifier::{Condition, Modifier, ModifierType};

    fn registry_with(mods: Vec<(StatKey, f64)>) -> ModifierRegistry {
        let mut registry = ModifierRegistry::new();
        for (stat_key, value) in mods {
            registry.add(Modifier {
                stat_key,
                modifier_type: ModifierType::Increased,
                value,
                condition: Condition::Always,
                source: "test".to_string(),
            });
        }
        registry
    }

    #[test]
    fn minion_damage_multi_flows_from_sourced_key() {
        let registry = registry_with(vec![
            (StatKey::IncreasedMinionDamage, 25.0),
            (StatKey::IncreasedMinionDamage, 30.0),
        ]);
        let m = compute_minion(&registry, &[]);
        assert_eq!(m.minion_damage_multi, 55.0);
    }

    #[test]
    fn count_hp_speed_are_honest_zero() {
        // Even with minion damage present, the unsourced/conflated figures stay 0.0.
        let registry = registry_with(vec![(StatKey::IncreasedMinionDamage, 25.0)]);
        let m = compute_minion(&registry, &[]);
        assert_eq!(m.minion_count, 0.0);
        assert_eq!(m.minion_hp_multi, 0.0);
        assert_eq!(m.minion_speed, 0.0);
    }

    #[test]
    fn presence_via_primary_delivery_type() {
        let mut snapshot = BuildSnapshot::default();
        snapshot.primary_offense_delivery_type = Some("minion".to_string());
        assert!(has_minion_skill(&snapshot, &registry_with(vec![]), &[]));
    }

    #[test]
    fn presence_via_minion_modifier() {
        let snapshot = BuildSnapshot::default();
        let registry = registry_with(vec![(StatKey::IncreasedMinionDamage, 25.0)]);
        assert!(has_minion_skill(&snapshot, &registry, &[]));
    }

    #[test]
    fn absent_when_no_minion_signal() {
        let mut snapshot = BuildSnapshot::default();
        snapshot.primary_offense_delivery_type = Some("melee".to_string());
        assert!(!has_minion_skill(&snapshot, &registry_with(vec![]), &[]));
    }
}
