import { TabGroup, TabList, Tab } from '@headlessui/react'
import type { ActiveSkill } from '../../shared/types/build'

const SKILL_SLOT_LABELS = ['Skill 1', 'Skill 2', 'Skill 3', 'Skill 4', 'Skill 5']

interface SkillTreeTabBarProps {
  activeSkills: ActiveSkill[]
  selectedIndex: number
  onChange: (index: number) => void
  onSkillTabClick?: (slotIndex: number, element: HTMLButtonElement) => void
  iconUrls?: Map<string, string>   // skillId -> asset:// URL; absent means no icons shown
}

export function SkillTreeTabBar({ activeSkills, selectedIndex, onChange, onSkillTabClick, iconUrls }: SkillTreeTabBarProps) {
  const tabs = [
    { id: '__passive__', label: 'Passive Tree' },
    ...SKILL_SLOT_LABELS.map((fallback, i) => {
      const slotId = `slot-${i}`
      const assigned = activeSkills.find((s) => s.slotId === slotId)
      return { id: slotId, label: assigned?.skillName ?? fallback }
    }),
    { id: '__weaver__', label: 'Weaver Tree' },
  ]

  return (
    <TabGroup selectedIndex={selectedIndex} onChange={onChange}>
      <TabList
        className="flex"
        style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}
      >
        {tabs.map((tab, i) => {
          const selected = selectedIndex === i
          const isSkillTab = i >= 1 && i <= 5
          const isEmpty = isSkillTab && !activeSkills.find((s) => s.slotId === `slot-${i - 1}`)
          return (
            <Tab
              key={tab.id}
              className="px-4 py-2 text-sm transition-colors data-[focus]:outline data-[focus]:outline-2 data-[focus]:outline-[var(--color-accent-gold)] data-[focus]:outline-offset-[-2px]"
              style={{
                color: selected
                  ? 'var(--color-text-primary)'
                  : isEmpty
                    ? 'var(--color-text-disabled, var(--color-text-muted))'
                    : 'var(--color-text-muted)',
                fontWeight: selected ? 600 : 400,
                borderBottom: selected
                  ? '2px solid var(--color-accent-gold)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={isSkillTab ? (e) => onSkillTabClick?.(i - 1, e.currentTarget as HTMLButtonElement) : undefined}
            >
              {isSkillTab && (() => {
                const assignedSkill = activeSkills.find((s) => s.slotId === `slot-${i - 1}`)
                const iconUrl = assignedSkill ? iconUrls?.get(assignedSkill.skillId) : undefined
                return iconUrl ? (
                  <img
                    src={iconUrl}
                    alt=""
                    aria-hidden="true"
                    style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
                  />
                ) : null
              })()}
              {tab.label}
            </Tab>
          )
        })}
      </TabList>
    </TabGroup>
  )
}
