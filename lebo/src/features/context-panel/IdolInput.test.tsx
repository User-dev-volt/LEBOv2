import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdolInput } from './IdolInput'
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

describe('IdolInput', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setActiveBuild(mockBuild)
  })

  it('renders all 6 idol slots', () => {
    render(<IdolInput />)
    const slotIds = ['idol1', 'idol2', 'idol3', 'idol4', 'idol5', 'idol6']
    for (const slotId of slotIds) {
      expect(screen.getByTestId(`idol-slot-${slotId}`)).toBeInTheDocument()
    }
  })

  it('idol type input updates the store', async () => {
    render(<IdolInput />)
    const typeInput = screen.getByTestId('idol-type-idol1')
    await userEvent.type(typeInput, 'Ornate Idol')
    const idols = useBuildStore.getState().activeBuild!.contextData.idols
    const slot = idols.find((i) => i.slotId === 'idol1')
    expect(slot?.idolType).toBe('Ornate Idol')
  })

  it('modifier add button appends modifier to the store', async () => {
    render(<IdolInput />)
    const modifierInput = screen.getByTestId('idol-modifier-input-idol1')
    const addButton = screen.getByTestId('idol-modifier-add-idol1')
    await userEvent.type(modifierInput, '+50% Poison Damage')
    await userEvent.click(addButton)
    const idols = useBuildStore.getState().activeBuild!.contextData.idols
    const slot = idols.find((i) => i.slotId === 'idol1')
    expect(slot?.modifiers).toContain('+50% Poison Damage')
  })

  it('modifier dismiss button removes the modifier from the store', async () => {
    useBuildStore.getState().setActiveBuild({
      ...mockBuild,
      contextData: {
        gear: [],
        skills: [],
        idols: [{ slotId: 'idol1', idolType: 'Grand Idol', modifiers: ['+10 HP', '+5 Armor'] }],
      },
    })
    render(<IdolInput />)
    const tag = screen.getByTestId('idol-modifier-tag-idol1-0')
    const dismissBtn = tag.querySelector('button')!
    await userEvent.click(dismissBtn)
    const idols = useBuildStore.getState().activeBuild!.contextData.idols
    const slot = idols.find((i) => i.slotId === 'idol1')
    expect(slot?.modifiers).not.toContain('+10 HP')
    expect(slot?.modifiers).toContain('+5 Armor')
  })

  it('pending modifier input clears when activeBuildId changes', async () => {
    render(<IdolInput />)
    const modifierInput = screen.getByTestId('idol-modifier-input-idol1')
    await userEvent.type(modifierInput, '+50% Poison')

    const newBuild: BuildState = { ...mockBuild, id: 'build-2', contextData: { gear: [], skills: [], idols: [] } }
    act(() => { useBuildStore.getState().setActiveBuild(newBuild) })

    expect((screen.getByTestId('idol-modifier-input-idol1') as HTMLInputElement).value).toBe('')
  })
})
