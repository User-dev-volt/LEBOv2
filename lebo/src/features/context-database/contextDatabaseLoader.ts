import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import type { BlessingsDatabase, ConditionsDatabase, IdolData } from '../../shared/types/contextDatabase'
import type { DataVersionCheckResult } from '../../shared/types/gameData'

export async function loadIdolData(): Promise<void> {
  try {
    const data = await invokeCommand<IdolData>('load_idol_data')
    useGameDataStore.getState().setIdolData(data)
  } catch (err) {
    useGameDataStore.getState().setIdolData(null)
    throw err
  }
}

export async function loadBlessingsData(): Promise<void> {
  try {
    const data = await invokeCommand<BlessingsDatabase>('load_blessings_data')
    useGameDataStore.getState().setBlessingsDatabase(data)
  } catch (err) {
    useGameDataStore.getState().setBlessingsDatabase(null)
    throw err
  }
}

export async function loadConditionsData(): Promise<void> {
  try {
    const data = await invokeCommand<ConditionsDatabase>('load_conditions_data')
    useGameDataStore.getState().setConditionsDatabase(data)
  } catch (err) {
    useGameDataStore.getState().setConditionsDatabase(null)
    throw err
  }
}

export async function checkIdolDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_idol_data_freshness')
  useGameDataStore.getState().setIsIdolDataStale(result.isStale)
}

export async function checkBlessingsDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_blessings_data_freshness')
  useGameDataStore.getState().setIsBlessingsDataStale(result.isStale)
}

export async function checkConditionsDataFreshness(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_conditions_data_freshness')
  useGameDataStore.getState().setIsConditionsDataStale(result.isStale)
}
