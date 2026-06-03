import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore, selectAvailablePassivePoints } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { calculateSkillPoints } from '../../shared/utils/budgetCalculator'
import { DAMAGE_TYPE_COLORS } from '../../shared/utils/rarityColors'
import type { DamageType } from '../../shared/types/itemDatabase'
import type { DefenseStats, StatSheet, StatWarning } from '../../shared/types/statSheet'

type ResistanceFieldKey = Extract<
  keyof DefenseStats,
  | 'fire_resistance'
  | 'cold_resistance'
  | 'lightning_resistance'
  | 'void_resistance'
  | 'necrotic_resistance'
  | 'poison_resistance'
  | 'physical_resistance'
>

// Order follows addendum F: Fire / Cold / Lightning / Void / Necrotic / Physical / Poison.
const RESISTANCES: Array<{ field: ResistanceFieldKey; warnType: string; label: string; damageTypeColor: string }> = [
  { field: 'fire_resistance',      warnType: 'fire_resistance_uncapped',      label: 'Fire Res',      damageTypeColor: 'var(--color-dmg-fire)'      },
  { field: 'cold_resistance',      warnType: 'cold_resistance_uncapped',      label: 'Cold Res',      damageTypeColor: 'var(--color-dmg-cold)'      },
  { field: 'lightning_resistance', warnType: 'lightning_resistance_uncapped', label: 'Lightning Res', damageTypeColor: 'var(--color-dmg-lightning)'  },
  { field: 'void_resistance',      warnType: 'void_resistance_uncapped',      label: 'Void Res',      damageTypeColor: 'var(--color-dmg-void)'      },
  { field: 'necrotic_resistance',  warnType: 'necrotic_resistance_uncapped',  label: 'Necrotic Res',  damageTypeColor: 'var(--color-dmg-necrotic)'  },
  { field: 'physical_resistance',  warnType: 'physical_resistance_uncapped',  label: 'Physical Res',  damageTypeColor: 'var(--color-dmg-physical)'  },
  { field: 'poison_resistance',    warnType: 'poison_resistance_uncapped',    label: 'Poison Res',    damageTypeColor: 'var(--color-dmg-poison)'    },
]

const TAB_CLASS =
  'px-3 py-1.5 text-xs transition-colors ' +
  'text-[var(--color-text-muted)] border-b-2 border-transparent ' +
  'data-[selected]:text-[var(--color-text-primary)] ' +
  'data-[selected]:border-[var(--color-accent-gold)] data-[selected]:font-semibold ' +
  'data-[focus]:outline data-[focus]:outline-2 ' +
  'data-[focus]:outline-[var(--color-accent-gold)] data-[focus]:outline-offset-[-2px]'

function findWarning(warnings: StatWarning[], type: string): StatWarning | undefined {
  return warnings.find((w) => w.warning_type === type)
}

function fmt(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  return value.toFixed(decimals)
}

function fmtInt(value: number | null | undefined): string {
  if (value == null) return '—'
  return Math.round(value).toLocaleString()
}

interface StatDeltas {
  damage_score: number
  avg_hit_damage: number
  avg_hit_damage_crit_weighted: number
  critical_strike_chance: number
  critical_strike_multiplier: number
  attack_speed: number | null
  cast_speed: number | null
  aoe_modifier: number
  effective_hp: number
  raw_hp: number
  ward: number
  endurance_percent: number
  endurance_threshold: number
  armor: number
  fire_resistance: number
  cold_resistance: number
  lightning_resistance: number
  void_resistance: number
  poison_resistance: number
  physical_resistance: number
  crit_avoidance: number
  dodge_chance: number
  score_damage: number
  score_survivability: number
  score_speed: number
  score_build: number
}

function computeStatDeltas(base: StatSheet, preview: StatSheet): StatDeltas {
  return {
    damage_score: preview.offense.damage_score - base.offense.damage_score,
    avg_hit_damage: preview.offense.avg_hit_damage - base.offense.avg_hit_damage,
    avg_hit_damage_crit_weighted: preview.offense.avg_hit_damage_crit_weighted - base.offense.avg_hit_damage_crit_weighted,
    critical_strike_chance: preview.offense.critical_strike_chance - base.offense.critical_strike_chance,
    critical_strike_multiplier: preview.offense.critical_strike_multiplier - base.offense.critical_strike_multiplier,
    attack_speed: preview.offense.attack_speed != null && base.offense.attack_speed != null
      ? preview.offense.attack_speed - base.offense.attack_speed
      : null,
    cast_speed: preview.offense.cast_speed != null && base.offense.cast_speed != null
      ? preview.offense.cast_speed - base.offense.cast_speed
      : null,
    aoe_modifier: preview.offense.aoe_modifier - base.offense.aoe_modifier,
    effective_hp: preview.defense.effective_hp - base.defense.effective_hp,
    raw_hp: preview.defense.raw_hp - base.defense.raw_hp,
    ward: preview.defense.ward - base.defense.ward,
    endurance_percent: preview.defense.endurance_percent - base.defense.endurance_percent,
    endurance_threshold: preview.defense.endurance_threshold - base.defense.endurance_threshold,
    armor: preview.defense.armor - base.defense.armor,
    fire_resistance: preview.defense.fire_resistance - base.defense.fire_resistance,
    cold_resistance: preview.defense.cold_resistance - base.defense.cold_resistance,
    lightning_resistance: preview.defense.lightning_resistance - base.defense.lightning_resistance,
    void_resistance: preview.defense.void_resistance - base.defense.void_resistance,
    poison_resistance: preview.defense.poison_resistance - base.defense.poison_resistance,
    physical_resistance: preview.defense.physical_resistance - base.defense.physical_resistance,
    crit_avoidance: preview.defense.crit_avoidance - base.defense.crit_avoidance,
    dodge_chance: preview.defense.dodge_chance - base.defense.dodge_chance,
    score_damage: preview.scores.damage_score - base.scores.damage_score,
    score_survivability: preview.scores.survivability_score - base.scores.survivability_score,
    score_speed: preview.scores.speed_score - base.scores.speed_score,
    score_build: preview.scores.build_score - base.scores.build_score,
  }
}

function DeltaBadge({ delta, unit = '' }: { delta: number; unit?: string }) {
  const sign = delta > 0 ? '+' : ''
  const color = delta > 0 ? 'var(--color-data-positive)' : 'var(--color-data-negative)'
  return (
    <span
      style={{ color, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginLeft: '0.25rem' }}
      aria-label={`${sign}${delta.toFixed(1)}${unit}`}
    >
      ({sign}{delta.toFixed(1)}{unit})
    </span>
  )
}

function GroupLabel({ label }: { label: string }) {
  return (
    <p
      className="text-[10px] font-semibold uppercase tracking-wide pt-2 pb-0.5"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {label}
    </p>
  )
}

interface StatRowProps {
  label: string
  value: string
  unit?: string
  warningGap?: number
  delta?: number
  labelColor?: string
}

function StatRow({ label, value, unit = '', warningGap, delta, labelColor }: StatRowProps) {
  const isWarning = warningGap !== undefined
  return (
    <div className="flex justify-between items-baseline py-0.5 min-w-0">
      <span className="text-xs shrink-0 mr-2" style={{ color: labelColor ?? 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-xs font-mono"
        style={{ color: isWarning ? 'var(--color-data-negative)' : 'var(--color-text-primary)' }}
      >
        {value}{unit}
        {isWarning && (
          <span
            className="ml-1 text-[10px]"
            style={{ color: 'var(--color-data-negative)' }}
          >
            (+{warningGap}% needed)
          </span>
        )}
        {delta !== undefined && delta !== 0 && (
          <DeltaBadge delta={delta} unit={unit} />
        )}
      </span>
    </div>
  )
}

export function StatSheetPanel() {
  const statSheet = useOptimizationStore((s) => s.statSheet)
  const isComputingStats = useOptimizationStore((s) => s.isComputingStats)
  const previewStatSheet = useOptimizationStore((s) => s.previewStatSheet)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const availablePassivePoints = useBuildStore(selectAvailablePassivePoints)
  const gameData = useGameDataStore((s) => s.gameData)

  const showMinionTab = statSheet?.minion != null

  const classData = activeBuild && gameData ? gameData.classes[activeBuild.classId] : null
  const className = classData?.className ?? '—'
  const masteryName = classData?.masteries[activeBuild?.masteryId ?? '']?.masteryName ?? '—'
  const spentPassivePoints = activeBuild
    ? Object.values(activeBuild.nodeAllocations).reduce((sum, v) => sum + v, 0)
    : 0

  const deltas = previewStatSheet !== null && statSheet !== null && !isComputingStats
    ? computeStatDeltas(statSheet, previewStatSheet)
    : null

  return (
    <section aria-label="Stat sheet">
      <div className="flex items-center justify-between px-4 py-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Stats
        </p>
        {isComputingStats && (
          <span
            className="text-[10px] animate-pulse"
            style={{ color: 'var(--color-text-muted)' }}
            aria-live="polite"
            aria-label="Computing stats"
            data-testid="stat-sheet-loading"
          >
            ●
          </span>
        )}
      </div>

      <TabGroup key={showMinionTab ? 'with-minion' : 'without-minion'}>
        <TabList
          className="flex px-2"
          style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}
        >
          <Tab className={TAB_CLASS} style={{ marginBottom: '-1px' }}>General</Tab>
          <Tab className={TAB_CLASS} style={{ marginBottom: '-1px' }}>Offense</Tab>
          <Tab className={TAB_CLASS} style={{ marginBottom: '-1px' }}>Defense</Tab>
          {showMinionTab && (
            <Tab className={TAB_CLASS} style={{ marginBottom: '-1px' }}>Minion</Tab>
          )}
          <Tab className={TAB_CLASS} style={{ marginBottom: '-1px' }}>Other</Tab>
        </TabList>

        <TabPanels>
          {/* General */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            <StatRow label="Class" value={className} />
            <StatRow label="Mastery" value={masteryName} />
            <StatRow label="Level" value={activeBuild?.characterLevel.toString() ?? '—'} />
            <StatRow
              label="Passive Points"
              value={activeBuild ? `${spentPassivePoints} / ${availablePassivePoints}` : '—'}
            />
            <StatRow
              label="Skill Slots"
              value={activeBuild ? activeBuild.contextData.skills.length.toString() : '—'}
            />
            {/* Idol cell-size accounting is an idol-grid concern not derivable from idolGrid alone — honest dash. */}
            <StatRow label="Idol Cells Used" value="—" />
            {activeBuild?.contextData.skills.map((skill, i) => {
              const level = activeBuild.activeSkillLevels[skill.slotId] ?? 1
              const spent = Object.values(
                activeBuild.skillNodeAllocations[skill.slotId] ?? {}
              ).reduce((s, v) => s + v, 0)
              const available = calculateSkillPoints(level)
              return (
                <StatRow
                  key={skill.slotId}
                  label={`Skill ${i + 1}: ${skill.skillName}`}
                  value={`Lv ${level} · ${spent}/${available} pts`}
                />
              )
            })}
            <GroupLabel label="Attributes" />
            <StatRow label="Strength" value={statSheet ? fmtInt(statSheet.attributes.strength) : '—'} />
            <StatRow label="Dexterity" value={statSheet ? fmtInt(statSheet.attributes.dexterity) : '—'} />
            <StatRow label="Intelligence" value={statSheet ? fmtInt(statSheet.attributes.intelligence) : '—'} />
            <StatRow label="Attunement" value={statSheet ? fmtInt(statSheet.attributes.attunement) : '—'} />
          </TabPanel>

          {/* Offense */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            <StatRow label="Build Score" value={statSheet ? fmt(statSheet.scores.build_score) : '—'} delta={deltas?.score_build} />
            <StatRow label="Damage Score" value={statSheet ? fmt(statSheet.offense.damage_score) : '—'} delta={deltas?.damage_score} />
            <StatRow label="Avg Hit" value={statSheet ? fmtInt(statSheet.offense.avg_hit_damage) : '—'} delta={deltas?.avg_hit_damage} />
            <StatRow label="Avg Hit (Crit)" value={statSheet ? fmtInt(statSheet.offense.avg_hit_damage_crit_weighted) : '—'} delta={deltas?.avg_hit_damage_crit_weighted} />
            <StatRow label="Crit Chance" value={statSheet ? fmt(statSheet.offense.critical_strike_chance) : '—'} unit="%" delta={deltas?.critical_strike_chance} />
            <StatRow label="Crit Multi" value={statSheet ? fmt(statSheet.offense.critical_strike_multiplier) : '—'} unit="%" delta={deltas?.critical_strike_multiplier} />
            <StatRow
              label="Attack Speed"
              value={statSheet?.offense.attack_speed != null ? fmt(statSheet.offense.attack_speed) : '—'}
              delta={deltas?.attack_speed ?? undefined}
            />
            <StatRow
              label="Cast Speed"
              value={statSheet?.offense.cast_speed != null ? fmt(statSheet.offense.cast_speed) : '—'}
              delta={deltas?.cast_speed ?? undefined}
            />
            <StatRow label="AoE Modifier" value={statSheet ? fmt(statSheet.offense.aoe_modifier) : '—'} delta={deltas?.aoe_modifier} />
            <StatRow label="Stun Chance" value={statSheet ? fmt(statSheet.offense.stun_chance) : '—'} unit="%" />
            {/* Per-type damage breakdown — empty today; renders nothing until the engine populates damage_types[]. */}
            {statSheet?.offense.damage_types.map((dt) => (
              <StatRow
                key={dt.damage_type}
                label={`${dt.damage_type.charAt(0).toUpperCase()}${dt.damage_type.slice(1)} Dmg`}
                value={`+${fmt(dt.increased)}% / x${fmt(dt.more)}`}
                labelColor={DAMAGE_TYPE_COLORS[dt.damage_type as DamageType] ?? 'var(--color-text-secondary)'}
              />
            ))}
            <GroupLabel label="Penetration" />
            <StatRow label="Elemental Pen" value={statSheet ? fmt(statSheet.offense.elemental_penetration) : '—'} unit="%" />
            <StatRow label="Physical Pen" value={statSheet ? fmt(statSheet.offense.physical_penetration) : '—'} unit="%" />
            <StatRow label="Void Pen" value={statSheet ? fmt(statSheet.offense.void_penetration) : '—'} unit="%" />
            <GroupLabel label="Ailment Chances" />
            <StatRow label="Bleed" value={statSheet ? fmt(statSheet.offense.bleed_chance) : '—'} unit="%" />
            <StatRow label="Ignite" value={statSheet ? fmt(statSheet.offense.ignite_chance) : '—'} unit="%" />
            <StatRow label="Poison" value={statSheet ? fmt(statSheet.offense.poison_chance) : '—'} unit="%" />
            <StatRow label="Freeze" value={statSheet ? fmt(statSheet.offense.freeze_chance) : '—'} unit="%" />
            <StatRow label="Shock" value={statSheet ? fmt(statSheet.offense.shock_chance) : '—'} unit="%" />
          </TabPanel>

          {/* Defense */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            {/* EHP triple replaces the single legacy Effective HP row; effective_hp still drives the delta badge (preview). */}
            <StatRow label="EHP vs Hits" value={statSheet ? fmtInt(statSheet.defense.ehp_vs_hits) : '—'} delta={deltas?.effective_hp} />
            <StatRow label="EHP vs DoTs" value={statSheet ? fmtInt(statSheet.defense.ehp_vs_dots) : '—'} />
            <StatRow label="EHP vs 1-Shots" value={statSheet ? fmtInt(statSheet.defense.ehp_vs_one_shots) : '—'} />
            <StatRow label="HP" value={statSheet ? fmtInt(statSheet.defense.raw_hp) : '—'} delta={deltas?.raw_hp} />
            <StatRow label="Ward" value={statSheet ? fmtInt(statSheet.defense.ward) : '—'} delta={deltas?.ward} />
            <StatRow label="Stable Ward" value={statSheet ? fmtInt(statSheet.defense.stable_ward) : '—'} />
            <StatRow label="Ward Retention" value={statSheet ? fmt(statSheet.defense.ward_retention) : '—'} unit="%" />
            <StatRow label="Armor" value={statSheet ? fmtInt(statSheet.defense.armor) : '—'} delta={deltas?.armor} />
            <StatRow label="Endurance" value={statSheet ? fmt(statSheet.defense.endurance_percent) : '—'} unit="%" delta={deltas?.endurance_percent} />
            <StatRow label="End. Threshold" value={statSheet ? fmtInt(statSheet.defense.endurance_threshold) : '—'} delta={deltas?.endurance_threshold} />
            {RESISTANCES.map(({ field, warnType, label, damageTypeColor }) => {
              const warn = statSheet ? findWarning(statSheet.warnings, warnType) : undefined
              return (
                <StatRow
                  key={field}
                  label={label}
                  value={statSheet ? fmt(statSheet.defense[field]) : '—'}
                  unit="%"
                  warningGap={warn?.gap}
                  delta={deltas?.[field as keyof StatDeltas] as number | undefined}
                  labelColor={damageTypeColor}
                />
              )
            })}
            <StatRow label="Dodge" value={statSheet ? fmt(statSheet.defense.dodge_chance) : '—'} unit="%" delta={deltas?.dodge_chance} />
            <StatRow label="Parry" value={statSheet ? fmt(statSheet.defense.parry_chance) : '—'} unit="%" />
            <StatRow label="Block" value={statSheet ? fmt(statSheet.defense.block_chance) : '—'} unit="%" />
            <StatRow label="Glancing Blow" value={statSheet ? fmt(statSheet.defense.glancing_blow_chance) : '—'} unit="%" />
            <StatRow label="Crit Avoidance" value={statSheet ? fmt(statSheet.defense.crit_avoidance) : '—'} unit="%" delta={deltas?.crit_avoidance} />
            <StatRow label="Reduced Crit Bonus" value={statSheet ? fmt(statSheet.defense.reduced_bonus_damage_from_crits) : '—'} unit="%" />
            <GroupLabel label="Ailment Avoidance" />
            <StatRow label="Chill" value={statSheet ? fmt(statSheet.defense.chill_avoidance) : '—'} unit="%" />
            <StatRow label="Stun" value={statSheet ? fmt(statSheet.defense.stun_avoidance) : '—'} unit="%" />
            <StatRow label="Bleed" value={statSheet ? fmt(statSheet.defense.bleed_avoidance) : '—'} unit="%" />
          </TabPanel>

          {/* Minion — only rendered when showMinionTab to match Tab count */}
          {showMinionTab && (
            <TabPanel className="px-3 py-2 space-y-0.5">
              <StatRow label="Minion Count" value={statSheet?.minion ? fmtInt(statSheet.minion.minion_count) : '—'} />
              <StatRow label="Minion Damage Multi" value={statSheet?.minion ? fmt(statSheet.minion.minion_damage_multi) : '—'} unit="%" />
              <StatRow label="Minion HP Multi" value={statSheet?.minion ? fmt(statSheet.minion.minion_hp_multi) : '—'} unit="%" />
              <StatRow label="Minion Speed" value={statSheet?.minion ? fmt(statSheet.minion.minion_speed) : '—'} unit="%" />
            </TabPanel>
          )}

          {/* Other */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            <StatRow label="Damage Score" value={statSheet ? fmt(statSheet.scores.damage_score) : '—'} delta={deltas?.score_damage} />
            <StatRow label="Surv. Score" value={statSheet ? fmt(statSheet.scores.survivability_score) : '—'} delta={deltas?.score_survivability} />
            <StatRow label="Speed Score" value={statSheet ? fmt(statSheet.scores.speed_score) : '—'} delta={deltas?.score_speed} />
            <StatRow label="Healing Effectiveness" value={statSheet ? fmt(statSheet.defense.healing_effectiveness) : '—'} unit="%" />
            {/* No StatSheet field exists for these — honest dashes, never fabricated (no new IPC). */}
            <StatRow label="Move Speed" value="—" />
            <StatRow label="Cooldown Recovery" value="—" />
            <StatRow label="Mana" value="—" />
            <StatRow label="Health Regen" value="—" />
            <StatRow label="Life Leech" value="—" />
            <StatRow label="Ward / sec" value="—" />
            <p className="text-[10px] pt-1" style={{ color: 'var(--color-text-muted)' }}>
              Move speed, CDR, mana, regen, leech, and ward/sec coming in a future update.
            </p>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </section>
  )
}
