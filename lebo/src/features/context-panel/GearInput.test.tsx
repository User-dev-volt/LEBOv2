import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GearInput } from './GearInput'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { BuildState } from '../../shared/types/build'

const mockBuild: BuildState = {
  schemaVersion: 1,
  id: 'build-1',
  name: 'Test Lich',
  classId: 'acolyte',
  masteryId: 'lich',
  characterLevel: 1,
  budgetEnforced: false,
  nodeAllocations: {},
  skillNodeAllocations: {},
  activeSkillLevels: {},
  weaverAllocations: {},
  contextData: { gear: [], skills: [], idols: [] },
  isPersisted: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const initialState = useBuildStore.getState()

describe('GearInput', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(mockBuild)
  })

  it('renders all 11 gear slots', () => {
    render(<GearInput />)
    const slotIds = [
      'helmet', 'body', 'gloves', 'belt', 'boots',
      'ring1', 'ring2', 'amulet', 'relic', 'weapon', 'offhand',
    ]
    for (const slotId of slotIds) {
      expect(screen.getByTestId(`gear-slot-${slotId}`)).toBeInTheDocument()
    }
  })

  it('item name input updates the store', async () => {
    render(<GearInput />)
    const nameInput = screen.getByTestId('gear-item-name-helmet')
    await userEvent.type(nameInput, 'Iron Helm')
    const gear = useBuildStore.getState().activeBuild!.contextData.gear
    const helmet = gear.find((g) => g.slotId === 'helmet')
    expect(helmet?.itemName).toBe('Iron Helm')
  })

  it('affix add button appends affix to the store', async () => {
    render(<GearInput />)
    const affixInput = screen.getByTestId('gear-affix-input-helmet')
    const addButton = screen.getByTestId('gear-affix-add-helmet')
    await userEvent.type(affixInput, '+15% Void Damage')
    await userEvent.click(addButton)
    const gear = useBuildStore.getState().activeBuild!.contextData.gear
    const helmet = gear.find((g) => g.slotId === 'helmet')
    expect(helmet?.affixes).toContainEqual(expect.objectContaining({ name: '+15% Void Damage' }))
  })

  it('affix dismiss button removes the affix from the store', async () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      contextData: {
        gear: [{ slotId: 'helmet', itemName: 'Iron Helm', affixes: [{ name: '+10 HP' }, { name: '+5 Mana' }] }],
        skills: [],
        idols: [],
      },
    })
    render(<GearInput />)
    const tag = screen.getByTestId('gear-affix-tag-helmet-0')
    const dismissBtn = tag.querySelector('button')!
    await userEvent.click(dismissBtn)
    const gear = useBuildStore.getState().activeBuild!.contextData.gear
    const helmet = gear.find((g) => g.slotId === 'helmet')
    expect(helmet?.affixes).not.toContainEqual(expect.objectContaining({ name: '+10 HP' }))
    expect(helmet?.affixes).toContainEqual(expect.objectContaining({ name: '+5 Mana' }))
  })

  it('slot data is preserved when store gear is pre-populated', () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      contextData: {
        gear: [{ slotId: 'body', itemName: 'Dragon Plate', affixes: [{ name: '+20 Armor' }] }],
        skills: [],
        idols: [],
      },
    })
    render(<GearInput />)
    const nameInput = screen.getByTestId('gear-item-name-body') as HTMLInputElement
    expect(nameInput.value).toBe('Dragon Plate')
    expect(screen.getByTestId('gear-affix-tag-body-0')).toHaveTextContent('+20 Armor')
  })
})
