import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { GEAR_SLOTS } from './gearData'
import { SKILL_SLOTS } from './skillData'
import { IDOL_SLOTS } from './idolData'
import { GearInput } from './GearInput'
import { SkillInput } from './SkillInput'
import { IdolInput } from './IdolInput'

export function ContextPanel() {
  const gear = useBuildStore((s) => s.activeBuild?.contextData.gear ?? [])
  const skills = useBuildStore((s) => s.activeBuild?.contextData.skills ?? [])
  const idols = useBuildStore((s) => s.activeBuild?.contextData.idols ?? [])

  const filledGearCount = gear.filter((g) => g.itemName.trim() !== '').length
  const filledSkillCount = skills.filter((s) => s.skillName.trim() !== '').length
  const filledIdolCount = idols.filter((i) => i.idolType.trim() !== '').length

  return (
    <div data-testid="context-panel" className="flex flex-col gap-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        Context
      </p>

      <div data-testid="context-section-gear">
        <Disclosure>
          <DisclosureButton
            className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            <span>Gear</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{filledGearCount} / {GEAR_SLOTS.length}</span>
          </DisclosureButton>
          <DisclosurePanel>
            <GearInput />
          </DisclosurePanel>
        </Disclosure>
      </div>

      <div data-testid="context-section-skills">
        <Disclosure>
          <DisclosureButton
            className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            <span>Active Skills</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{filledSkillCount} / {SKILL_SLOTS.length}</span>
          </DisclosureButton>
          <DisclosurePanel>
            <SkillInput />
          </DisclosurePanel>
        </Disclosure>
      </div>

      <div data-testid="context-section-idols">
        <Disclosure>
          <DisclosureButton
            className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            <span>Idols</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{filledIdolCount} / {IDOL_SLOTS.length}</span>
          </DisclosureButton>
          <DisclosurePanel>
            <IdolInput />
          </DisclosurePanel>
        </Disclosure>
      </div>
    </div>
  )
}
