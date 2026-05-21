import { create } from 'zustand'
import type { GameData, GameNode } from '../types/gameData'
import type { TreeData } from '../types/treeData'
import type { ItemDatabase } from '../types/itemDatabase'
import type { IdolData, BlessingsDatabase, ConditionsDatabase } from '../types/contextDatabase'

interface GameDataStore {
  gameData: GameData | null
  dataVersion: string | null
  dataUpdatedAt: string | null
  isStale: boolean
  stalenessAcknowledged: boolean
  versionsBehind: number
  isLoading: boolean
  isUpdating: boolean
  setGameData: (data: GameData) => void
  setDataVersion: (version: string) => void
  setDataUpdatedAt: (date: string) => void
  setIsStale: (stale: boolean) => void
  acknowledgeStaleness: () => void
  setVersionsBehind: (n: number) => void
  setIsLoading: (loading: boolean) => void
  setIsUpdating: (updating: boolean) => void
  weaverTreeData: TreeData | null
  weaverGameNodes: Record<string, GameNode>
  setWeaverTreeData: (data: TreeData | null) => void
  setWeaverGameNodes: (nodes: Record<string, GameNode>) => void
  itemDatabase: ItemDatabase | null
  setItemDatabase: (db: ItemDatabase | null) => void
  isItemDataStale: boolean
  itemDataStaleAcknowledged: boolean
  isItemDataUpdating: boolean
  setIsItemDataStale: (stale: boolean) => void
  acknowledgeItemDataStaleness: () => void
  setIsItemDataUpdating: (updating: boolean) => void

  idolData: IdolData | null
  setIdolData: (data: IdolData | null) => void
  isIdolDataStale: boolean
  idolDataStaleAcknowledged: boolean
  setIsIdolDataStale: (stale: boolean) => void
  acknowledgeIdolDataStaleness: () => void

  blessingsDatabase: BlessingsDatabase | null
  setBlessingsDatabase: (db: BlessingsDatabase | null) => void
  isBlessingsDataStale: boolean
  blessingsDataStaleAcknowledged: boolean
  setIsBlessingsDataStale: (stale: boolean) => void
  acknowledgeBlessingsDataStaleness: () => void

  conditionsDatabase: ConditionsDatabase | null
  setConditionsDatabase: (db: ConditionsDatabase | null) => void
}

export const useGameDataStore = create<GameDataStore>()((set) => ({
  gameData: null,
  dataVersion: null,
  dataUpdatedAt: null,
  isStale: false,
  stalenessAcknowledged: false,
  versionsBehind: 0,
  isLoading: false,
  isUpdating: false,
  weaverTreeData: null,
  weaverGameNodes: {},
  setGameData: (data) => set({ gameData: data }),
  setDataVersion: (version) => set({ dataVersion: version }),
  setDataUpdatedAt: (date) => set({ dataUpdatedAt: date }),
  setIsStale: (stale) => set({ isStale: stale }),
  acknowledgeStaleness: () => set({ stalenessAcknowledged: true }),
  setVersionsBehind: (n) => set({ versionsBehind: n }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsUpdating: (updating) => set({ isUpdating: updating }),
  setWeaverTreeData: (data) => set({ weaverTreeData: data }),
  setWeaverGameNodes: (nodes) => set({ weaverGameNodes: nodes }),
  itemDatabase: null,
  setItemDatabase: (db) => set({ itemDatabase: db }),
  isItemDataStale: false,
  itemDataStaleAcknowledged: false,
  isItemDataUpdating: false,
  setIsItemDataStale: (stale) => set({ isItemDataStale: stale }),
  acknowledgeItemDataStaleness: () => set({ itemDataStaleAcknowledged: true }),
  setIsItemDataUpdating: (updating) => set({ isItemDataUpdating: updating }),

  idolData: null,
  setIdolData: (data) => set({ idolData: data }),
  isIdolDataStale: false,
  idolDataStaleAcknowledged: false,
  setIsIdolDataStale: (stale) => set({ isIdolDataStale: stale }),
  acknowledgeIdolDataStaleness: () => set({ idolDataStaleAcknowledged: true }),

  blessingsDatabase: null,
  setBlessingsDatabase: (db) => set({ blessingsDatabase: db }),
  isBlessingsDataStale: false,
  blessingsDataStaleAcknowledged: false,
  setIsBlessingsDataStale: (stale) => set({ isBlessingsDataStale: stale }),
  acknowledgeBlessingsDataStaleness: () => set({ blessingsDataStaleAcknowledged: true }),

  conditionsDatabase: null,
  setConditionsDatabase: (db) => set({ conditionsDatabase: db }),
}))
