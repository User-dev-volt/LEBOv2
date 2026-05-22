import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/react'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore, selectAvailablePassivePoints } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { calculateSkillPoints } from '../../shared/utils/budgetCalculator'
import type { DefenseStats, StatWarning } from '../../shared/types/statSheet'

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

interface StatRowProps {
  label: string
  value: string
  unit?: string
  warningGap?: number
}

function StatRow({ label, value, unit = '', warningGap }: StatRowProps) {
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
      </span>
    </div>
  )
}

export function StatSheetPanel() {
  const statSheet = useOptimizationStore((s) => s.statSheet)
  const isComputingStats = useOptimizationStore((s) => s.isComputingStats)
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
            <StatRow label="Build Score" value={statSheet ? fmt(statSheet.scores.build_score) : '—'} />
            <StatRow label="Damage Score" value={statSheet ? fmt(statSheet.offense.damage_score) : '—'} />
            <StatRow label="Avg Hit" value={statSheet ? fmtInt(statSheet.offense.avg_hit_damage) : '—'} />
            <StatRow label="Avg Hit (Crit)" value={statSheet ? fmtInt(statSheet.offense.avg_hit_damage_crit_weighted) : '—'} />
            <StatRow label="Crit Chance" value={statSheet ? fmt(statSheet.offense.critical_strike_chance) : '—'} unit="%" />
            <StatRow label="Crit Multi" value={statSheet ? fmt(statSheet.offense.critical_strike_multiplier) : '—'} unit="%" />
            <StatRow
              label="Attack Speed"
              value={statSheet?.offense.attack_speed != null ? fmt(statSheet.offense.attack_speed) : '—'}
            />
            <StatRow
              label="Cast Speed"
              value={statSheet?.offense.cast_speed != null ? fmt(statSheet.offense.cast_speed) : '—'}
            />
            <StatRow label="AoE Modifier" value={statSheet ? fmt(statSheet.offense.aoe_modifier) : '—'} />
          </TabPanel>

          {/* Defense */}
          <TabPanel className="px-3 py-2 space-y-0.5">
            <StatRow label="Effective HP" value={statSheet ? fmtInt(statSheet.defense.effective_hp) : '—'} />
            <StatRow label="HP" value={statSheet ? fmtInt(statSheet.defense.raw_hp) : '—'} />
            <StatRow label="Ward" value={statSheet ? fmtInt(statSheet.defense.ward) : '—'} />
            <StatRow label="Armor" value={statSheet ? fmtInt(statSheet.defense.armor) : '—'} />
            <StatRow label="Endurance" value={statSheet ? fmt(statSheet.defense.endurance_percent) : '—'} unit="%" />
            <StatRow label="End. Threshold" value={statSheet ? fmtInt(statSheet.defense.endurance_threshold) : '—'} />
            {RESISTANCES.map(({ field, warnType, label }) => {
              const warn = statSheet ? findWarning(statSheet.warnings, warnType) : undefined
              return (
                <StatRow
                  key={field}
                  label={label}
                  value={statSheet ? fmt(statSheet.defense[field]) : '—'}
                  unit="%"
                  warningGap={warn?.gap}
                />
              )
            })}
            <StatRow label="Crit Avoidance" value={statSheet ? fmt(statSheet.defense.crit_avoidance) : '—'} unit="%" />
            <StatRow label="Dodge" value={statSheet ? fmt(statSheet.defense.dodge_chance) : '—'} unit="%" />
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
            <StatRow label="Damage Score" value={statSheet ? fmt(statSheet.scores.damage_score) : '—'} />
            <StatRow label="Surv. Score" value={statSheet ? fmt(statSheet.scores.survivability_score) : '—'} />
            <StatRow label="Speed Score" value={statSheet ? fmt(statSheet.scores.speed_score) : '—'} />
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
