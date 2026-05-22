import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { GEAR_SLOTS } from './gearData'
import { SKILL_SLOTS } from './skillData'
import { GearInput } from './GearInput'
import { SkillInput } from './SkillInput'
import { IdolGrid } from '../idol-grid/IdolGrid'
import { BlessingsPanel } from '../blessings/BlessingsPanel'
import { ConditionsPanel } from '../conditions/ConditionsPanel'

export function ContextPanel() {
  const gear = useBuildStore((s) => s.activeBuild?.contextData.gear ?? [])
  const skills = useBuildStore((s) => s.activeBuild?.contextData.skills ?? [])
  const idolGrid = useBuildStore((s) => s.activeBuild?.idolGrid ?? [])
  const blessings = useBuildStore((s) => s.activeBuild?.blessings ?? {})
  const activeBlessingsCount = Object.values(blessings).filter((v) => v !== null).length
  const conditionValues = useBuildStore((s) => s.activeBuild?.conditionValues ?? {})
  const activeConditionsCount = Object.values(conditionValues).filter((v) => {
    if (typeof v === 'boolean') return v === true
    if (typeof v === 'number') return v !== 0
    if (typeof v === 'string') return v !== '' && v !== 'standard_mob'
    return false
  }).length

  const filledGearCount = gear.filter((g) => g.itemName.trim() !== '').length
  const filledSkillCount = skills.filter((s) => s.skillName.trim() !== '').length
  const filledIdolCount = idolGrid.length

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
            <span style={{ color: 'var(--color-text-muted)' }}>{filledIdolCount} placed</span>
          </DisclosureButton>
          <DisclosurePanel>
            <IdolGrid />
          </DisclosurePanel>
        </Disclosure>
      </div>

      <div data-testid="context-section-blessings">
        <Disclosure>
          <DisclosureButton
            className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            <span>Blessings</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{activeBlessingsCount} active</span>
          </DisclosureButton>
          <DisclosurePanel>
            <BlessingsPanel />
          </DisclosurePanel>
        </Disclosure>
      </div>

      <div data-testid="context-section-conditions">
        <Disclosure>
          <DisclosureButton
            className="w-full text-left text-xs px-2 py-1.5 rounded flex justify-between"
            style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}
          >
            <span>Conditions</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{activeConditionsCount} active</span>
          </DisclosureButton>
          <DisclosurePanel>
            <ConditionsPanel />
          </DisclosurePanel>
        </Disclosure>
      </div>
    </div>
  )
}
