import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore, selectAvailablePassivePoints } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { calculateSkillPoints } from '../../shared/utils/budgetCalculator'
import type { DefenseStats, StatSheet, StatWarning } from '../../shared/types/statSheet'

type ResistanceFieldKey = Extract<
  keyof DefenseStats,
  | 'fire_resistance'
  | 'cold_resistance'
  | 'lightning_resistance'
  | 'void_resistance'
  | 'poison_resistance'
  | 'physical_resistance'
>

const RESISTANCES: Array<{ field: ResistanceFieldKey; warnType: string; label: string }> = [
  { field: 'fire_resistance', warnType: 'fire_resistance_uncapped', label: 'Fire Res' },
  { field: 'cold_resistance', warnType: 'cold_resistance_uncapped', label: 'Cold Res' },
  { field: 'lightning_resistance', warnType: 'lightning_resistance_uncapped', label: 'Lightning Res' },
  { field: 'void_resistance', warnType: 'void_resistance_uncapped', label: 'Void Res' },
  { field: 'poison_resistance', warnType: 'poison_resistance_uncapped', label: 'Poison Res' },
  { field: 'physical_resistance', warnType: 'physical_resistance_uncapped', label: 'Physical Res' },
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

interface StatRowProps {
  label: string
  value: string
  unit?: string
  warningGap?: number
  delta?: number
}

function StatRow({ label, value, unit = '', warningGap, delta }: StatRowProps) {
  const isWarning = warningGap !== undefined
  return (
    <div className="flex justify-between items-baseline py-0.5 min-w-0">
      <span className="text-xs shrink-0 mr-2" style={{ color: 'var(--color-text-secondary)' }}>
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
          </TabPanel>

          {/* Defense */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            <StatRow label="Effective HP" value={statSheet ? fmtInt(statSheet.defense.effective_hp) : '—'} delta={deltas?.effective_hp} />
            <StatRow label="HP" value={statSheet ? fmtInt(statSheet.defense.raw_hp) : '—'} delta={deltas?.raw_hp} />
            <StatRow label="Ward" value={statSheet ? fmtInt(statSheet.defense.ward) : '—'} delta={deltas?.ward} />
            <StatRow label="Armor" value={statSheet ? fmtInt(statSheet.defense.armor) : '—'} delta={deltas?.armor} />
            <StatRow label="Endurance" value={statSheet ? fmt(statSheet.defense.endurance_percent) : '—'} unit="%" delta={deltas?.endurance_percent} />
            <StatRow label="End. Threshold" value={statSheet ? fmtInt(statSheet.defense.endurance_threshold) : '—'} delta={deltas?.endurance_threshold} />
            {RESISTANCES.map(({ field, warnType, label }) => {
              const warn = statSheet ? findWarning(statSheet.warnings, warnType) : undefined
              return (
                <StatRow
                  key={field}
                  label={label}
                  value={statSheet ? fmt(statSheet.defense[field]) : '—'}
                  unit="%"
                  warningGap={warn?.gap}
                  delta={deltas?.[field as keyof StatDeltas] as number | undefined}
                />
              )
            })}
            <StatRow label="Crit Avoidance" value={statSheet ? fmt(statSheet.defense.crit_avoidance) : '—'} unit="%" delta={deltas?.crit_avoidance} />
            <StatRow label="Dodge" value={statSheet ? fmt(statSheet.defense.dodge_chance) : '—'} unit="%" delta={deltas?.dodge_chance} />
          </TabPanel>

          {/* Minion — only rendered when showMinionTab to match Tab count */}
          {showMinionTab && (
            <TabPanel className="px-3 py-2">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Minion stats available once minion skill data is loaded.
              </p>
            </TabPanel>
          )}

          {/* Other */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            <StatRow label="Damage Score" value={statSheet ? fmt(statSheet.scores.damage_score) : '—'} delta={deltas?.score_damage} />
            <StatRow label="Surv. Score" value={statSheet ? fmt(statSheet.scores.survivability_score) : '—'} delta={deltas?.score_survivability} />
            <StatRow label="Speed Score" value={statSheet ? fmt(statSheet.scores.speed_score) : '—'} delta={deltas?.score_speed} />
            <StatRow label="Move Speed" value="—" />
            <StatRow label="Cooldown Recovery" value="—" />
            <StatRow label="Mana" value="—" />
            <p className="text-[10px] pt-1" style={{ color: 'var(--color-text-muted)' }}>
              Move speed, CDR, and mana coming in a future update.
            </p>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </section>
  )
}
