import { useBuildStore } from '../../shared/stores/buildStore'
import { SKILL_SLOTS } from './skillData'

export function SkillInput() {
  const skills = useBuildStore((s) => s.activeBuild?.contextData.skills ?? [])

  return (
    <div className="flex flex-col gap-3 px-1 pt-1">
      {SKILL_SLOTS.map(({ slotId, label }) => {
        const slot = skills.find((s) => s.slotId === slotId)
        return (
          <div key={slotId} data-testid={`skill-slot-${slotId}`} className="flex flex-col gap-1">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {label}
            </span>
            <div
              data-testid={`skill-name-${slotId}`}
              className="w-full text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-bg-base)',
                color: slot?.skillName ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                border: '1px solid var(--color-bg-elevated)',
                minHeight: '1.75rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {slot?.skillName || 'No skill selected'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
