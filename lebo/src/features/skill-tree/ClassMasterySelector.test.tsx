import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClassMasterySelector } from './ClassMasterySelector'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { GameData } from '../../shared/types/gameData'

const mockGameData: GameData = {
  manifest: {
    schemaVersion: 1,
    gameVersion: '1.4.4',
    dataVersion: '1.0.0',
    generatedAt: '2026-04-22T00:00:00Z',
    classes: ['sentinel', 'mage'],
  },
  classes: {
    sentinel: {
      classId: 'sentinel',
      className: 'Sentinel',
      baseTree: {},
      masteries: {
        void_knight: {
          masteryId: 'void_knight',
          masteryName: 'Void Knight',
          nodes: {},
        },
        forge_guard: {
          masteryId: 'forge_guard',
          masteryName: 'Forge Guard',
          nodes: {},
        },
        paladin: {
          masteryId: 'paladin',
          masteryName: 'Paladin',
          nodes: {},
        },
      },
      skills: [],
      skillTrees: {},
    },
    mage: {
      classId: 'mage',
      className: 'Mage',
      baseTree: {},
      masteries: {
        sorcerer: {
          masteryId: 'sorcerer',
          masteryName: 'Sorcerer',
          nodes: {},
        },
      },
      skills: [],
      skillTrees: {},
    },
  },
}

const initialBuildState = useBuildStore.getState()
const initialGameDataState = useGameDataStore.getState()

describe('ClassMasterySelector', () => {
  beforeEach(() => {
    useBuildStore.setState(initialBuildState, true)
    useGameDataStore.setState(initialGameDataState, true)
    useGameDataStore.setState({ gameData: mockGameData })
  })

  it('renders nothing when gameData is null', () => {
    useGameDataStore.setState({ gameData: null })
    const { container } = render(<ClassMasterySelector />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the class listbox with all available classes', () => {
    render(<ClassMasterySelector />)
    expect(screen.getByText('Select Class')).toBeInTheDocument()
  })

  it('shows masteries after selecting a class', async () => {
    render(<ClassMasterySelector />)
    await userEvent.click(screen.getByText('Select Class'))
    await userEvent.click(screen.getByText('Sentinel'))
    expect(useBuildStore.getState().selectedClassId).toBe('sentinel')
    expect(screen.getByText('Select Mastery')).toBeInTheDocument()
  })

  it('creates activeBuild with mastery name when mastery is selected', async () => {
    render(<ClassMasterySelector />)
    await userEvent.click(screen.getByText('Select Class'))
    await userEvent.click(screen.getByText('Sentinel'))
    await userEvent.click(screen.getByText('Select Mastery'))
    await userEvent.click(screen.getByText('Void Knight'))
    const s = useBuildStore.getState()
    expect(s.activeBuild).not.toBeNull()
    expect(s.activeBuild!.name).toBe('Void Knight')
    expect(s.activeBuild!.classId).toBe('sentinel')
    expect(s.activeBuild!.masteryId).toBe('void_knight')
    expect(s.activeBuild!.nodeAllocations).toEqual({})
  })

  it('clears activeBuild when a different class is selected', async () => {
    render(<ClassMasterySelector />)
    // Select sentinel + void knight → creates build
    await userEvent.click(screen.getByText('Select Class'))
    await userEvent.click(screen.getByText('Sentinel'))
    await userEvent.click(screen.getByText('Select Mastery'))
    await userEvent.click(screen.getByText('Void Knight'))
    expect(useBuildStore.getState().activeBuild).not.toBeNull()
    // Switch to Mage → build cleared
    await userEvent.click(screen.getByText('Sentinel'))
    await userEvent.click(screen.getByText('Mage'))
    expect(useBuildStore.getState().activeBuild).toBeNull()
    expect(useBuildStore.getState().selectedMasteryId).toBeNull()
  })
})
