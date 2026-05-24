import { useBuildStore } from '../../shared/stores/buildStore'
import { SKILL_SLOTS } from '../context-panel/skillData'
import type { SkillRole } from '../../shared/types/build'

const ROLES: { role: SkillRole; label: string }[] = [
  { role: 'primary_offense', label: 'Primary' },
  { role: 'secondary_offense', label: 'Secondary' },
  { role: 'defensive', label: 'Defensive' },
  { role: 'utility', label: 'Utility' },
]

export function SkillRoleDesignator() {
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const setSkillRole = useBuildStore((s) => s.setSkillRole)
  const clearSkillRole = useBuildStore((s) => s.clearSkillRole)

  if (!activeBuild) return null

  const assignedSkills = activeBuild.contextData.skills
  const skillRoles = activeBuild.skillRoles ?? {}

  return (
    <div data-testid="skill-role-designator" className="flex flex-col gap-3">
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        Skill Roles
      </p>
      {SKILL_SLOTS.map(({ slotId, label }) => {
        const assignedSkill = assignedSkills.find((s) => s.slotId === slotId)
        const isEmpty = !assignedSkill
        const currentRole = skillRoles[slotId] ?? null

        return (
          <div key={slotId} className="flex flex-col gap-1">
            <span
              className="text-xs"
              style={{ color: isEmpty ? 'var(--color-text-muted)' : 'var(--color-text-secondary)' }}
            >
              {label}: {assignedSkill?.skillName ?? 'Empty'}
            </span>
            <div className="flex gap-1 flex-wrap">
              {ROLES.map(({ role, label: roleLabel }) => {
                const isActive = currentRole === role
                return (
                  <button
                    key={role}
                    data-testid={`role-button-${slotId}-${role}`}
                    disabled={isEmpty}
                    onClick={() => {
                      if (isActive) {
                        clearSkillRole(slotId)
                      } else {
                        setSkillRole(slotId, role)
                      }
                    }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: isActive ? 'var(--color-accent-gold)' : 'var(--color-bg-elevated)',
                      color: isActive ? 'var(--color-bg-base)' : 'var(--color-text-secondary)',
                      opacity: isEmpty ? 0.4 : 1,
                      cursor: isEmpty ? 'not-allowed' : 'pointer',
                      outline: isActive ? '2px solid var(--color-accent-gold)' : 'none',
                    }}
                    aria-pressed={isActive}
                    aria-label={`${roleLabel} role for ${assignedSkill?.skillName ?? label}`}
                  >
                    {roleLabel}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
