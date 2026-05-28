import { useMemo, useEffect } from 'react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import type { ConditionEntry } from '../../shared/types/contextDatabase'
import type { ActiveSkill } from '../../shared/types/build'

const EMPTY_SKILLS: ActiveSkill[] = []
const EMPTY_CONDITION_VALUES: Record<string, string | number | boolean> = {}

function ConditionRow({
  entry,
  value,
  onChange,
}: {
  entry: ConditionEntry
  value: string | number | boolean | undefined
  onChange: (id: string, value: string | number | boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={`condition-${entry.id}`}
        className="text-xs shrink-0"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {entry.displayLabel}
      </label>

      {entry.type === 'select' && (
        <select
          id={`condition-${entry.id}`}
          value={typeof value === 'string' ? value : String(entry.defaultValue)}
          onChange={(e) => onChange(entry.id, e.target.value)}
          className="text-xs rounded px-1 py-0.5"
          style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
        >
          {(entry.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {entry.type === 'range' && (
        <div className="flex items-center gap-1">
          <input
            id={`condition-${entry.id}`}
            type="range"
            min={entry.min ?? 0}
            max={entry.max ?? 100}
            step={entry.step ?? 1}
            value={typeof value === 'number' ? value : Number(entry.defaultValue)}
            onChange={(e) => onChange(entry.id, Number(e.target.value))}
            className="w-20"
            aria-valuemin={entry.min ?? 0}
            aria-valuemax={entry.max ?? 100}
            aria-valuenow={typeof value === 'number' ? value : Number(entry.defaultValue)}
          />
          <span className="text-xs w-8 text-right" style={{ color: 'var(--color-text-muted)' }}>
            {typeof value === 'number' ? value : entry.defaultValue}
          </span>
        </div>
      )}

      {entry.type === 'toggle' && (
        <input
          id={`condition-${entry.id}`}
          type="checkbox"
          checked={typeof value === 'boolean' ? value : Boolean(entry.defaultValue)}
          onChange={(e) => onChange(entry.id, e.target.checked)}
          className="w-4 h-4"
        />
      )}
    </div>
  )
}

export function ConditionsPanel() {
  const conditionsDatabase = useGameDataStore((s) => s.conditionsDatabase)
  const conditionValues = useBuildStore((s) => s.activeBuild?.conditionValues ?? EMPTY_CONDITION_VALUES)
  const setConditionValue = useBuildStore((s) => s.setConditionValue)
  const classId = useBuildStore((s) => s.activeBuild?.classId ?? '')
  const activeSkills = useBuildStore((s) => s.activeBuild?.contextData.skills ?? EMPTY_SKILLS)

  const visibleConditions = useMemo(() => {
    if (!conditionsDatabase) return []
    return conditionsDatabase.filter((entry) => {
      if (entry.category === 'universal') return true
      const { filter } = entry
      if (!filter) return true
      if (filter.classId && filter.classId !== classId) return false
      if (filter.skillTag) {
        const hasSkill = activeSkills.some(
          (s) => s.skillId.toLowerCase().includes(filter.skillTag!.toLowerCase()),
        )
        if (!hasSkill) return false
      }
      return true
    })
  }, [conditionsDatabase, classId, activeSkills])

  // Auto-clear stale build-specific condition values when their filter no longer matches.
  // Guard: skip ids already set to false to prevent re-triggering on every render after clear.
  useEffect(() => {
    if (!conditionsDatabase) return
    const visibleIds = new Set(visibleConditions.map((c) => c.id))
    const staleIds = Object.keys(conditionValues).filter((id) => {
      if (conditionValues[id] === false) return false
      const entry = conditionsDatabase.find((c) => c.id === id)
      return entry?.category === 'build-specific' && !visibleIds.has(id)
    })
    if (staleIds.length > 0) {
      staleIds.forEach((id) => setConditionValue(id, false))
    }
  }, [visibleConditions, conditionsDatabase, conditionValues, setConditionValue])

  if (!conditionsDatabase || conditionsDatabase.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--color-text-muted)', padding: '4px 0' }}>
        Conditions data not loaded.
      </p>
    )
  }

  const universalConditions = visibleConditions.filter((c) => c.category === 'universal')
  const buildSpecificConditions = visibleConditions.filter((c) => c.category === 'build-specific')

  return (
    <div className="flex flex-col gap-2 py-1">
      {universalConditions.map((entry) => (
        <ConditionRow
          key={entry.id}
          entry={entry}
          value={conditionValues[entry.id]}
          onChange={setConditionValue}
        />
      ))}

      {buildSpecificConditions.length > 0 && (
        <>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Build-specific
          </p>
          {buildSpecificConditions.map((entry) => (
            <ConditionRow
              key={entry.id}
              entry={entry}
              value={conditionValues[entry.id]}
              onChange={setConditionValue}
            />
          ))}
        </>
      )}
    </div>
  )
}
