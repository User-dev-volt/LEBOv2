import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IdolData, BlessingsDatabase, ConditionsDatabase } from '../../shared/types/contextDatabase'
import type { DataVersionCheckResult } from '../../shared/types/gameData'

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

import { invokeCommand } from '../../shared/utils/invokeCommand'
import {
  loadIdolData,
  loadBlessingsData,
  loadConditionsData,
  checkIdolDataFreshness,
  checkBlessingsDataFreshness,
  checkConditionsDataFreshness,
} from './contextDatabaseLoader'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

const mockInvoke = vi.mocked(invokeCommand)

const mockIdolData: IdolData = {
  version: 's4.1',
  defaultGrid: { rows: 5, cols: 5, blockedCells: [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2]] },
  altarVariants: [],
  idolTypes: [],
}

const mockBlessings: BlessingsDatabase = [
  {
    id: 'bfd-twisted-memory',
    timelineId: 'blood-frost-death',
    timelineName: 'Blood, Frost, and Death',
    displayName: 'Twisted Memory',
    statEffects: [{ statKey: 'increased_cold_damage', value: 30, modifierType: 'increased' }],
  },
]

const mockConditions: ConditionsDatabase = [
  {
    id: 'enemy_type',
    displayLabel: 'Enemy Type',
    category: 'universal',
    type: 'select',
    options: [{ value: 'standard_mob', label: 'Standard Mob' }],
    defaultValue: 'standard_mob',
  },
]

const staleResult: DataVersionCheckResult = {
  isStale: true,
  localVersion: 's4.0',
  remoteVersion: 's4.1',
  versionsBehind: 1,
}

const freshResult: DataVersionCheckResult = {
  isStale: false,
  localVersion: 's4.1',
  remoteVersion: 's4.1',
  versionsBehind: 0,
}

describe('loadIdolData', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('populates idolData in store on successful load', async () => {
    mockInvoke.mockResolvedValueOnce(mockIdolData)

    await loadIdolData()

    expect(mockInvoke).toHaveBeenCalledWith('load_idol_data')
    expect(useGameDataStore.getState().idolData).toEqual(mockIdolData)
  })

  it('leaves idolData null when invokeCommand throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('CONTEXT_DATA_ERROR: file not found'))

    await expect(loadIdolData()).rejects.toThrow()
    expect(useGameDataStore.getState().idolData).toBeNull()
  })
})

describe('loadBlessingsData', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('populates blessingsDatabase in store on successful load', async () => {
    mockInvoke.mockResolvedValueOnce(mockBlessings)

    await loadBlessingsData()

    expect(mockInvoke).toHaveBeenCalledWith('load_blessings_data')
    expect(useGameDataStore.getState().blessingsDatabase).toEqual(mockBlessings)
  })

  it('leaves blessingsDatabase null when invokeCommand throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('CONTEXT_DATA_ERROR: file not found'))

    await expect(loadBlessingsData()).rejects.toThrow()
    expect(useGameDataStore.getState().blessingsDatabase).toBeNull()
  })
})

describe('loadConditionsData', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('populates conditionsDatabase in store on successful load', async () => {
    mockInvoke.mockResolvedValueOnce(mockConditions)

    await loadConditionsData()

    expect(mockInvoke).toHaveBeenCalledWith('load_conditions_data')
    expect(useGameDataStore.getState().conditionsDatabase).toEqual(mockConditions)
  })

  it('leaves conditionsDatabase null when invokeCommand throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('CONTEXT_DATA_ERROR: file not found'))

    await expect(loadConditionsData()).rejects.toThrow()
    expect(useGameDataStore.getState().conditionsDatabase).toBeNull()
  })
})

describe('checkIdolDataFreshness', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('sets isIdolDataStale=true when result is stale', async () => {
    mockInvoke.mockResolvedValueOnce(staleResult)

    await checkIdolDataFreshness()

    expect(mockInvoke).toHaveBeenCalledWith('check_idol_data_freshness')
    expect(useGameDataStore.getState().isIdolDataStale).toBe(true)
  })

  it('leaves isIdolDataStale=false when result is fresh', async () => {
    mockInvoke.mockResolvedValueOnce(freshResult)

    await checkIdolDataFreshness()

    expect(useGameDataStore.getState().isIdolDataStale).toBe(false)
  })
})

describe('checkBlessingsDataFreshness', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('sets isBlessingsDataStale=true when result is stale', async () => {
    mockInvoke.mockResolvedValueOnce(staleResult)

    await checkBlessingsDataFreshness()

    expect(mockInvoke).toHaveBeenCalledWith('check_blessings_data_freshness')
    expect(useGameDataStore.getState().isBlessingsDataStale).toBe(true)
  })

  it('leaves isBlessingsDataStale=false when result is fresh', async () => {
    mockInvoke.mockResolvedValueOnce(freshResult)

    await checkBlessingsDataFreshness()

    expect(useGameDataStore.getState().isBlessingsDataStale).toBe(false)
  })
})

describe('checkConditionsDataFreshness', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('sets isConditionsDataStale=true when result is stale', async () => {
    mockInvoke.mockResolvedValueOnce(staleResult)

    await checkConditionsDataFreshness()

    expect(mockInvoke).toHaveBeenCalledWith('check_conditions_data_freshness')
    expect(useGameDataStore.getState().isConditionsDataStale).toBe(true)
  })

  it('leaves isConditionsDataStale=false when result is fresh', async () => {
    mockInvoke.mockResolvedValueOnce(freshResult)

    await checkConditionsDataFreshness()

    expect(useGameDataStore.getState().isConditionsDataStale).toBe(false)
  })
})
