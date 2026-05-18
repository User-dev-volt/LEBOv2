import { describe, it, expect, beforeEach } from 'vitest'
import { useGameDataStore } from './gameDataStore'
import type { GameData } from '../types/gameData'

const initialState = useGameDataStore.getState()

const mockGameData: GameData = {
  manifest: {
    schemaVersion: 1,
    gameVersion: '1.0',
    dataVersion: 'v42',
    generatedAt: '2026-01-01T00:00:00Z',
    classes: ['acolyte', 'mage'],
  },
  classes: {
    acolyte: {
      classId: 'acolyte',
      className: 'Acolyte',
      baseTree: {},
      masteries: {
        lich: {
          masteryId: 'lich',
          masteryName: 'Lich',
          nodes: {
            'node-a': {
              id: 'node-a',
              name: 'Dark Path',
              pointCost: 1,
              maxPoints: 5,
              prerequisiteNodeIds: [],
              effectDescription: '+5% necrotic damage per point',
              tags: ['damage', 'necrotic'],
              position: { x: 0, y: 0 },
              size: 'medium' as const,
            },
          },
        },
      },
      skills: [],
      skillTrees: {},
    },
  },
}

describe('gameDataStore', () => {
  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
  })

  it('starts with null gameData and no version', () => {
    const s = useGameDataStore.getState()
    expect(s.gameData).toBeNull()
    expect(s.dataVersion).toBeNull()
    expect(s.isStale).toBe(false)
    expect(s.stalenessAcknowledged).toBe(false)
    expect(s.isLoading).toBe(false)
  })

  it('setGameData stores game data', () => {
    useGameDataStore.getState().setGameData(mockGameData)
    expect(useGameDataStore.getState().gameData).toEqual(mockGameData)
  })

  it('setDataVersion stores the version string', () => {
    useGameDataStore.getState().setDataVersion('v42')
    expect(useGameDataStore.getState().dataVersion).toBe('v42')
  })

  it('setIsStale marks data as stale', () => {
    useGameDataStore.getState().setIsStale(true)
    expect(useGameDataStore.getState().isStale).toBe(true)
  })

  it('acknowledgeStaleness sets stalenessAcknowledged', () => {
    useGameDataStore.getState().setIsStale(true)
    useGameDataStore.getState().acknowledgeStaleness()
    expect(useGameDataStore.getState().stalenessAcknowledged).toBe(true)
  })

  it('setGameData shape — classes.acolyte.masteries.lich.nodes accessible', () => {
    useGameDataStore.getState().setGameData(mockGameData)
    const state = useGameDataStore.getState()
    const node = state.gameData?.classes.acolyte.masteries.lich.nodes['node-a']
    expect(node).toBeDefined()
    expect(node?.id).toBe('node-a')
    expect(node?.pointCost).toBe(1)
    expect(node?.size).toBe('medium')
    expect(node?.position).toEqual({ x: 0, y: 0 })
  })

  it('setIsLoading toggles loading flag', () => {
    useGameDataStore.getState().setIsLoading(true)
    expect(useGameDataStore.getState().isLoading).toBe(true)
    useGameDataStore.getState().setIsLoading(false)
    expect(useGameDataStore.getState().isLoading).toBe(false)
  })

  it('dataUpdatedAt starts null and setDataUpdatedAt stores the date string', () => {
    expect(useGameDataStore.getState().dataUpdatedAt).toBeNull()
    useGameDataStore.getState().setDataUpdatedAt('2026-04-22T00:00:00Z')
    expect(useGameDataStore.getState().dataUpdatedAt).toBe('2026-04-22T00:00:00Z')
  })

  it('isUpdating starts false and setIsUpdating toggles it', () => {
    expect(useGameDataStore.getState().isUpdating).toBe(false)
    useGameDataStore.getState().setIsUpdating(true)
    expect(useGameDataStore.getState().isUpdating).toBe(true)
    useGameDataStore.getState().setIsUpdating(false)
    expect(useGameDataStore.getState().isUpdating).toBe(false)
  })

  it('versionsBehind starts at 0 and setVersionsBehind stores the count', () => {
    expect(useGameDataStore.getState().versionsBehind).toBe(0)
    useGameDataStore.getState().setVersionsBehind(2)
    expect(useGameDataStore.getState().versionsBehind).toBe(2)
  })
})
