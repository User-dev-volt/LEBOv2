import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ItemDatabase } from '../../shared/types/itemDatabase'
import type { DataVersionCheckResult } from '../../shared/types/gameData'

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

import { invokeCommand } from '../../shared/utils/invokeCommand'
import { loadItemDatabase, checkItemDataFreshness, triggerItemDataUpdate } from './itemDatabaseLoader'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

const mockInvoke = vi.mocked(invokeCommand)

const mockDb: ItemDatabase = {
  baseItems: [{ id: 'refuge-helmet', name: 'Refuge Helmet', baseType: 'Helmet', slot: 'helmet', implicitAffixIds: [] }],
  uniqueItems: [{ id: 'calamity', name: 'Calamity', baseType: 'Helmet', slot: 'helmet', affixes: [{ affixId: 'unique-calamity-0', fixedMinValue: 100, fixedMaxValue: 150 }] }],
  affixes: [{ id: 'affix-inevitable-prefix', name: 'Inevitable', type: 'prefix', itemSlots: [], tiers: [{ tier: 1, minValue: 4, maxValue: 4 }] }],
  setItems: [],
}

const staleResult: DataVersionCheckResult = {
  isStale: true,
  localVersion: '1.0.0',
  remoteVersion: '1.1.0',
  versionsBehind: 1,
}

const freshResult: DataVersionCheckResult = {
  isStale: false,
  localVersion: '1.1.0',
  remoteVersion: '1.1.0',
  versionsBehind: 0,
}

describe('loadItemDatabase', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('populates itemDatabase in store on successful load', async () => {
    mockInvoke.mockResolvedValueOnce(mockDb)

    await loadItemDatabase()

    expect(mockInvoke).toHaveBeenCalledWith('load_item_database')
    expect(useGameDataStore.getState().itemDatabase).toEqual(mockDb)
  })

  it('leaves itemDatabase null when invokeCommand throws', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('ITEM_DATA_ERROR: file not found'))

    await expect(loadItemDatabase()).rejects.toThrow()
    expect(useGameDataStore.getState().itemDatabase).toBeNull()
  })
})

describe('checkItemDataFreshness', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('sets isItemDataStale=true when result is stale', async () => {
    mockInvoke.mockResolvedValueOnce(staleResult)

    await checkItemDataFreshness()

    expect(mockInvoke).toHaveBeenCalledWith('check_item_data_freshness')
    expect(useGameDataStore.getState().isItemDataStale).toBe(true)
  })

  it('leaves isItemDataStale=false when result is fresh', async () => {
    mockInvoke.mockResolvedValueOnce(freshResult)

    await checkItemDataFreshness()

    expect(useGameDataStore.getState().isItemDataStale).toBe(false)
  })
})

describe('triggerItemDataUpdate', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialState, true)
    mockInvoke.mockReset()
  })

  it('sets isItemDataUpdating true then false, invokes update then load, clears isItemDataStale on success', async () => {
    const updatingStates: boolean[] = []
    useGameDataStore.subscribe((state) => {
      updatingStates.push(state.isItemDataUpdating)
    })

    useGameDataStore.setState({ isItemDataStale: true })

    mockInvoke
      .mockResolvedValueOnce(undefined)  // update_item_data
      .mockResolvedValueOnce(mockDb)     // load_item_database

    await triggerItemDataUpdate()

    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'update_item_data')
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'load_item_database')
    expect(useGameDataStore.getState().isItemDataStale).toBe(false)
    expect(useGameDataStore.getState().isItemDataUpdating).toBe(false)
    // Verify it went true then back to false
    expect(updatingStates).toContain(true)
    expect(updatingStates[updatingStates.length - 1]).toBe(false)
  })

  it('clears isItemDataUpdating even when update_item_data rejects', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('NETWORK_ERROR: timeout'))

    await expect(triggerItemDataUpdate()).rejects.toThrow()

    expect(useGameDataStore.getState().isItemDataUpdating).toBe(false)
  })

  it('clears isItemDataUpdating even when load_item_database rejects', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined)   // update_item_data succeeds
      .mockRejectedValueOnce(new Error('ITEM_DATA_ERROR: parse failed'))  // load fails

    await expect(triggerItemDataUpdate()).rejects.toThrow()

    expect(useGameDataStore.getState().isItemDataUpdating).toBe(false)
  })
})
