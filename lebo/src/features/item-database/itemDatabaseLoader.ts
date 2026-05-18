import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import type { ItemDatabase } from '../../shared/types/itemDatabase'
import type { DataVersionCheckResult } from '../../shared/types/gameData'

export async function loadItemDatabase(): Promise<void> {
  try {
    const db = await invokeCommand<ItemDatabase>('load_item_database')
    useGameDataStore.getState().setItemDatabase(db)
  } catch (err) {
    useGameDataStore.getState().setItemDatabase(null)
    throw err
  }
}

export async function checkItemDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_item_data_freshness')
  useGameDataStore.getState().setIsItemDataStale(result.isStale)
}

export async function triggerItemDataUpdate(): Promise<void> {
  const { setIsItemDataUpdating, setIsItemDataStale } = useGameDataStore.getState()
  setIsItemDataUpdating(true)
  try {
    await invokeCommand('update_item_data')
    await loadItemDatabase()
    setIsItemDataStale(false)
  } finally {
    setIsItemDataUpdating(false)
  }
}
