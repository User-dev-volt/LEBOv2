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

  it('idolData starts null and staleness/updating flags start false', () => {
    const s = useGameDataStore.getState()
    expect(s.idolData).toBeNull()
    expect(s.isIdolDataStale).toBe(false)
    expect(s.idolDataStaleAcknowledged).toBe(false)
    expect(s.isIdolDataUpdating).toBe(false)
  })

  it('setIsIdolDataStale and acknowledgeIdolDataStaleness work correctly', () => {
    useGameDataStore.getState().setIsIdolDataStale(true)
    expect(useGameDataStore.getState().isIdolDataStale).toBe(true)
    useGameDataStore.getState().acknowledgeIdolDataStaleness()
    expect(useGameDataStore.getState().idolDataStaleAcknowledged).toBe(true)
  })

  it('setIsIdolDataUpdating toggles the updating flag', () => {
    useGameDataStore.getState().setIsIdolDataUpdating(true)
    expect(useGameDataStore.getState().isIdolDataUpdating).toBe(true)
    useGameDataStore.getState().setIsIdolDataUpdating(false)
    expect(useGameDataStore.getState().isIdolDataUpdating).toBe(false)
  })

  it('blessingsDatabase starts null and staleness/updating flags start false', () => {
    const s = useGameDataStore.getState()
    expect(s.blessingsDatabase).toBeNull()
    expect(s.isBlessingsDataStale).toBe(false)
    expect(s.blessingsDataStaleAcknowledged).toBe(false)
    expect(s.isBlessingsDataUpdating).toBe(false)
  })

  it('setIsBlessingsDataStale and acknowledgeBlessingsDataStaleness work correctly', () => {
    useGameDataStore.getState().setIsBlessingsDataStale(true)
    expect(useGameDataStore.getState().isBlessingsDataStale).toBe(true)
    useGameDataStore.getState().acknowledgeBlessingsDataStaleness()
    expect(useGameDataStore.getState().blessingsDataStaleAcknowledged).toBe(true)
  })

  it('setIsBlessingsDataUpdating toggles the updating flag', () => {
    useGameDataStore.getState().setIsBlessingsDataUpdating(true)
    expect(useGameDataStore.getState().isBlessingsDataUpdating).toBe(true)
    useGameDataStore.getState().setIsBlessingsDataUpdating(false)
    expect(useGameDataStore.getState().isBlessingsDataUpdating).toBe(false)
  })

  it('conditionsDatabase starts null and staleness/updating flags start false', () => {
    const s = useGameDataStore.getState()
    expect(s.conditionsDatabase).toBeNull()
    expect(s.isConditionsDataStale).toBe(false)
    expect(s.conditionsDataStaleAcknowledged).toBe(false)
    expect(s.isConditionsDataUpdating).toBe(false)
  })

  it('setIsConditionsDataStale and acknowledgeConditionsDataStaleness work correctly', () => {
    useGameDataStore.getState().setIsConditionsDataStale(true)
    expect(useGameDataStore.getState().isConditionsDataStale).toBe(true)
    useGameDataStore.getState().acknowledgeConditionsDataStaleness()
    expect(useGameDataStore.getState().conditionsDataStaleAcknowledged).toBe(true)
  })

  it('setIsConditionsDataUpdating toggles the updating flag', () => {
    useGameDataStore.getState().setIsConditionsDataUpdating(true)
    expect(useGameDataStore.getState().isConditionsDataUpdating).toBe(true)
    useGameDataStore.getState().setIsConditionsDataUpdating(false)
    expect(useGameDataStore.getState().isConditionsDataUpdating).toBe(false)
  })
})
