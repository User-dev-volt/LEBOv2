import { useEffect, useRef, useState } from 'react'
import type { SkillEntry } from '../../shared/types/gameData'
import { invokeCommand } from '../../shared/utils/invokeCommand'

interface SkillPickerGridProps {
  baseClassName: string
  skills: SkillEntry[]
  selectedSkillId: string | null
  onSelect: (skillId: string) => void
  onClose: () => void
}

interface Section {
  title: string
  skills: SkillEntry[]
}

function groupSkills(baseClassName: string, skills: SkillEntry[]): Section[] {
  const baseClassSkills: SkillEntry[] = []
  const masteryMap = new Map<string, Section>()

  for (const skill of skills) {
    if (skill.masteryId === null) {
      baseClassSkills.push(skill)
    } else {
      if (!masteryMap.has(skill.masteryId)) {
        masteryMap.set(skill.masteryId, {
          title: `${skill.masteryName ?? skill.masteryId} Skills`,
          skills: [],
        })
      }
      masteryMap.get(skill.masteryId)!.skills.push(skill)
    }
  }

  const sections: Section[] = []
  if (baseClassSkills.length > 0) {
    sections.push({ title: `${baseClassName} Skills`, skills: baseClassSkills })
  }
  for (const section of masteryMap.values()) {
    sections.push(section)
  }
  return sections
}

function getAriaLabel(skill: SkillEntry): string {
  if (skill.masteryId === null) {
    return `${skill.skillName} (base class skill)`
  }
  return `${skill.skillName} (${skill.masteryName} skill, requires ${skill.masteryGatePoints} points)`
}

export function SkillPickerGrid({
  baseClassName,
  skills,
  selectedSkillId,
  onSelect,
  onClose,
}: SkillPickerGridProps) {
  const [focusedSkillId, setFocusedSkillId] = useState<string | null>(
    selectedSkillId ?? skills[0]?.skillId ?? null
  )
  const [iconPaths, setIconPaths] = useState<Map<string, string>>(new Map())
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const sections = groupSkills(baseClassName, skills)
  const flatSkills = sections.flatMap(s => s.skills)

  useEffect(() => {
    if (focusedSkillId) {
      cellRefs.current.get(focusedSkillId)?.focus()
    }
  }, [focusedSkillId])

  useEffect(() => {
    if (skills.length === 0) return
    void Promise.allSettled(
      skills.map(skill =>
        invokeCommand<string | null>('get_icon_cache_path', { skillId: skill.skillId }).then(
          path => [skill.skillId, path] as [string, string | null]
        )
      )
    ).then(results => {
      const pairs: [string, string][] = []
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value[1] !== null) {
          pairs.push([result.value[0], result.value[1]])
        }
      }
      setIconPaths(new Map(pairs))
    })
  }, [skills])

  function handleKeyDown(e: React.KeyboardEvent) {
    const currentIdx = flatSkills.findIndex(s => s.skillId === focusedSkillId)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIdx = currentIdx > 0 ? currentIdx - 1 : flatSkills.length - 1
      setFocusedSkillId(flatSkills[prevIdx]?.skillId ?? null)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIdx = currentIdx < flatSkills.length - 1 ? currentIdx + 1 : 0
      setFocusedSkillId(flatSkills[nextIdx]?.skillId ?? null)
    } else if (e.key === 'Enter' && focusedSkillId !== null) {
      e.preventDefault()
      onSelect(focusedSkillId)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div role="grid" aria-label="Skill picker" onKeyDown={handleKeyDown}>
      {sections.map(section => (
        <div key={section.title} role="rowgroup" aria-label={section.title}>
          <h3 aria-hidden="true">{section.title}</h3>
          <div role="row">
            {section.skills.map(skill => {
              const isSelected = skill.skillId === selectedSkillId
              const isFocused = skill.skillId === focusedSkillId
              const iconPath = iconPaths.get(skill.skillId)

              return (
                <button
                  key={skill.skillId}
                  role="gridcell"
                  aria-label={getAriaLabel(skill)}
                  tabIndex={isFocused ? 0 : -1}
                  className={`relative overflow-visible${isSelected ? ' border border-[var(--color-accent-gold)]' : ''}`}
                  ref={el => {
                    if (el) {
                      cellRefs.current.set(skill.skillId, el)
                    } else {
                      cellRefs.current.delete(skill.skillId)
                    }
                  }}
                  onClick={() => {
                    setFocusedSkillId(skill.skillId)
                    onSelect(skill.skillId)
                  }}
                  onFocus={() => setFocusedSkillId(skill.skillId)}
                >
                  <div className="[clip-path:var(--hex-clip-path)] w-full h-full">
                    {iconPath !== undefined ? (
                      <img src={iconPath} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{ backgroundColor: 'var(--color-node-available)', width: '100%', height: '100%' }}
                      />
                    )}
                  </div>
                  {skill.masteryGatePoints !== null && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-[var(--color-badge-mastery-gate)] text-[var(--color-accent-gold-dim)] border border-[var(--color-accent-gold-dim)] text-xs px-1"
                    >
                      {skill.masteryGatePoints}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
