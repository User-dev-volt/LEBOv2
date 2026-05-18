import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RawClassData } from './types'
import type { DataVersionCheckResult, GameDataManifest } from '../../shared/types/gameData'

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

import { invokeCommand } from '../../shared/utils/invokeCommand'
import { initGameData, checkDataVersion, transformNode } from './gameDataLoader'
import { useGameDataStore } from '../../shared/stores/gameDataStore'

const mockInvoke = vi.mocked(invokeCommand)

const mockManifest: GameDataManifest = {
  schemaVersion: 1,
  gameVersion: '1.4.4',
  dataVersion: '1.0.0',
  generatedAt: '2026-04-22T00:00:00Z',
  classes: ['sentinel'],
}

const mockRawClasses: RawClassData[] = [
  {
    id: 'sentinel',
    name: 'Sentinel',
    baseTree: {
      nodes: [
        {
          id: 'sentinel-base-gladiator',
          name: 'Gladiator',
          x: 0,
          y: 0,
          size: 'large',
          maxPoints: 8,
          effects: [{ description: '+4 Melee Physical Damage per point', tags: ['MELEE', 'PHYSICAL'] }],
        },
      ],
      edges: [],
    },
    masteries: [
      {
        id: 'void_knight',
        name: 'Void Knight',
        passiveTree: {
          nodes: [
            {
              id: 'vk-node-a',
              name: 'Void Blade',
              x: 280,
              y: 0,
              size: 'large',
              maxPoints: 6,
              effects: [{ description: '+5% Void Damage', tags: ['VOID', 'DAMAGE'] }],
            },
            {
              id: 'vk-node-b',
              name: 'Echoes of the Void',
              x: 520,
              y: 200,
              size: 'medium',
              maxPoints: 5,
              effects: [{ description: '+8% Void Melee Damage', tags: ['VOID', 'MELEE'] }],
            },
          ],
          edges: [{ fromId: 'vk-node-a', toId: 'vk-node-b' }],
        },
      },
    ],
    skills: [],
  },
]

const initialState = useGameDataStore.getState()

describe('initGameData', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    useGameDataStore.setState(initialState, true)
  })

  it('calls initialize_game_data, load_game_data, get_manifest in order', async () => {
    const callOrder: string[] = []
    mockInvoke.mockImplementation(async (cmd) => {
      callOrder.push(cmd as string)
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      return undefined
    })

    await initGameData()

    expect(callOrder[0]).toBe('initialize_game_data')
    expect(callOrder[1]).toBe('load_game_data')
    expect(callOrder[2]).toBe('get_manifest')
  })

  it('sets isLoading = true before load and false after', async () => {
    const loadingStates: boolean[] = []
    mockInvoke.mockImplementation(async (cmd) => {
      loadingStates.push(useGameDataStore.getState().isLoading)
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      return undefined
    })

    await initGameData()

    expect(loadingStates[0]).toBe(true)
    expect(useGameDataStore.getState().isLoading).toBe(false)
  })

  it('populates gameData store with transformed classes', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      return undefined
    })

    await initGameData()

    const { gameData } = useGameDataStore.getState()
    expect(gameData).not.toBeNull()
    expect(gameData!.classes.sentinel).toBeDefined()
    expect(gameData!.classes.sentinel.masteries.void_knight).toBeDefined()
    expect(gameData!.classes.sentinel.masteries.void_knight.nodes['vk-node-b'].prerequisiteNodeIds).toEqual(['vk-node-a'])
  })

  it('populates gameData store with base tree nodes', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      return undefined
    })

    await initGameData()

    const { gameData } = useGameDataStore.getState()
    const baseNode = gameData!.classes.sentinel.baseTree['sentinel-base-gladiator']
    expect(baseNode).toBeDefined()
    expect(baseNode.name).toBe('Gladiator')
    expect(baseNode.pointCost).toBe(1)
    expect(baseNode.size).toBe('large')
    expect(baseNode.tags).toEqual(['MELEE', 'PHYSICAL'])
  })

  it('on invokeCommand rejection — sets isLoading = false and re-throws AppError', async () => {
    mockInvoke.mockRejectedValue('STORAGE_ERROR: could not read file')

    await expect(initGameData()).rejects.toMatchObject({ type: 'STORAGE_ERROR' })
    expect(useGameDataStore.getState().isLoading).toBe(false)
  })

  it('sets dataVersion from manifest.gameVersion after load', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      if (cmd === 'check_data_version') return { isStale: false, localVersion: '1.4.4', remoteVersion: '1.4.4', versionsBehind: 0 }
      return undefined
    })

    await initGameData()

    expect(useGameDataStore.getState().dataVersion).toBe('1.4.4')
  })

  it('sets dataUpdatedAt from manifest.generatedAt after load', async () => {
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      if (cmd === 'check_data_version') return { isStale: false, localVersion: '1.4.4', remoteVersion: '1.4.4', versionsBehind: 0 }
      return undefined
    })

    await initGameData()

    expect(useGameDataStore.getState().dataUpdatedAt).toBe('2026-04-22T00:00:00Z')
  })

  it('awaits both staleness checks before resolving', async () => {
    // With Promise.all, initGameData must not resolve until both async checks complete.
    // Each check introduces a real async tick; if fire-and-forget were used, the flags
    // would still be false when initGameData resolves.
    let checkDataVersionDone = false
    let checkItemFreshnessDone = false

    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'load_game_data') return mockRawClasses
      if (cmd === 'get_manifest') return mockManifest
      if (cmd === 'check_data_version') {
        await Promise.resolve() // yield to event loop
        checkDataVersionDone = true
        return { isStale: false, localVersion: '1.4.4', remoteVersion: '1.4.4', versionsBehind: 0 } as DataVersionCheckResult
      }
      if (cmd === 'check_item_data_freshness') {
        await Promise.resolve() // yield to event loop
        checkItemFreshnessDone = true
        return { isStale: false, localVersion: '1.0.0', remoteVersion: '1.0.0', versionsBehind: 0 } as DataVersionCheckResult
      }
      return undefined
    })

    await initGameData()

    expect(checkDataVersionDone).toBe(true)
    expect(checkItemFreshnessDone).toBe(true)
    expect(useGameDataStore.getState().isLoading).toBe(false)
  })
})

describe('checkDataVersion', () => {
  const initialState = useGameDataStore.getState()

  beforeEach(() => {
    mockInvoke.mockReset()
    useGameDataStore.setState(initialState, true)
  })

  it('sets isStale=true and versionsBehind when result is stale', async () => {
    const staleResult: DataVersionCheckResult = {
      isStale: true,
      localVersion: '1.4.4',
      remoteVersion: '1.4.5',
      versionsBehind: 1,
    }
    mockInvoke.mockResolvedValue(staleResult)

    await checkDataVersion()

    expect(useGameDataStore.getState().isStale).toBe(true)
    expect(useGameDataStore.getState().versionsBehind).toBe(1)
  })

  it('leaves isStale=false when result is up to date', async () => {
    const freshResult: DataVersionCheckResult = {
      isStale: false,
      localVersion: '1.4.4',
      remoteVersion: '1.4.4',
      versionsBehind: 0,
    }
    mockInvoke.mockResolvedValue(freshResult)

    await checkDataVersion()

    expect(useGameDataStore.getState().isStale).toBe(false)
    expect(useGameDataStore.getState().versionsBehind).toBe(0)
  })
})

describe('transformNode', () => {
  it('maps RawGameNode fields correctly to GameNode', () => {
    const raw = {
      id: 'test-node',
      name: 'Test Node',
      x: 100,
      y: 200,
      size: 'medium' as const,
      maxPoints: 5,
      effects: [{ description: '+10% Damage', tags: ['DAMAGE'] }],
    }
    const node = transformNode(raw, ['prereq-a', 'prereq-b'])

    expect(node.id).toBe('test-node')
    expect(node.name).toBe('Test Node')
    expect(node.pointCost).toBe(1)
    expect(node.maxPoints).toBe(5)
    expect(node.position).toEqual({ x: 100, y: 200 })
    expect(node.size).toBe('medium')
    expect(node.prerequisiteNodeIds).toEqual(['prereq-a', 'prereq-b'])
    expect(node.effectDescription).toBe('+10% Damage')
    expect(node.tags).toEqual(['DAMAGE'])
  })

  it('handles missing effects gracefully', () => {
    const raw = {
      id: 'empty-node',
      name: 'Empty',
      x: 0,
      y: 0,
      size: 'small' as const,
      maxPoints: 1,
      effects: [],
    }
    const node = transformNode(raw, [])

    expect(node.effectDescription).toBe('')
    expect(node.tags).toEqual([])
  })

  it('deduplicates tags across multiple effects', () => {
    const raw = {
      id: 'multi-effect',
      name: 'Multi',
      x: 0,
      y: 0,
      size: 'small' as const,
      maxPoints: 1,
      effects: [
        { description: '+5% Void Damage', tags: ['VOID', 'DAMAGE'] },
        { description: '+3% Void Resistance', tags: ['VOID', 'RESISTANCE'] },
      ],
    }
    const node = transformNode(raw, [])

    expect(node.tags).toEqual(['VOID', 'DAMAGE', 'RESISTANCE'])
    expect(node.tags.filter((t) => t === 'VOID').length).toBe(1)
  })
})
