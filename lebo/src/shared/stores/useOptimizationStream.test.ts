import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Mock } from 'vitest'

// Mock @tauri-apps/api/event before importing the hook
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

// Mock invokeCommand
vi.mock('../utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

// Mock calculateScore
vi.mock('../../features/optimization/scoringEngine', () => ({
  calculateScore: vi.fn(() => ({ damage: 50, survivability: 30, speed: 10 })),
}))

// Mock buildStore
vi.mock('./buildStore', () => ({
  useBuildStore: {
    getState: vi.fn(() => ({
      activeBuild: {
        id: 'test',
        name: 'Test',
        classId: 'sentinel',
        masteryId: 'void_knight',
        nodeAllocations: { 'node_a': 2 },
        contextData: { gear: [], skills: [], idols: [] },
        isPersisted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 1,
        budgetEnforced: false,
        characterLevel: 1,
        activeSkillLevels: {},
      },
    })),
  },
}))

// Mock gameDataStore
vi.mock('./gameDataStore', () => ({
  useGameDataStore: {
    getState: vi.fn(() => ({
      gameData: { classes: {}, manifest: { schemaVersion: 1, gameVersion: '1.0', dataVersion: '1.0', generatedAt: '2026-01-01', classes: [] } },
      itemDatabase: null,
    })),
  },
}))

import { listen } from '@tauri-apps/api/event'
import { invokeCommand } from '../utils/invokeCommand'
import { calculatePassivePoints } from '../utils/budgetCalculator'
import { useBuildStore } from './buildStore'
import { useGameDataStore } from './gameDataStore'
import { useOptimizationStore } from './optimizationStore'
import { useOptimizationStream, startOptimization } from './useOptimizationStream'

const mockListen = listen as Mock
const mockInvokeCommand = invokeCommand as Mock

describe('useOptimizationStream', () => {
  const initialState = useOptimizationStore.getState()

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
    // Stamp the sentinel to match the mocked activeBuild id so event-handler tests
    // are not blocked by the optimizationBuildId guard added in story 7-6 review.
    useOptimizationStore.setState({ optimizationBuildId: 'test' })
    vi.clearAllMocks()

    // Default: listen returns a no-op unlisten fn
    mockListen.mockResolvedValue(vi.fn())
    mockInvokeCommand.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers four event listeners on mount', async () => {
    await act(async () => {
      renderHook(() => useOptimizationStream())
    })
    expect(mockListen).toHaveBeenCalledTimes(4)
    expect(mockListen).toHaveBeenCalledWith('optimization:suggestion-received', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('optimization:complete', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('optimization:error', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('optimization:model-active', expect.any(Function))
  })

  it('calls unlisten for all listeners on unmount', async () => {
    const unlistenFns = [vi.fn(), vi.fn(), vi.fn(), vi.fn()]
    let callCount = 0
    mockListen.mockImplementation(() => Promise.resolve(unlistenFns[callCount++]))

    const { unmount } = renderHook(() => useOptimizationStream())
    // Wait for async listener registration
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    unmount()

    expect(unlistenFns[0]).toHaveBeenCalled()
    expect(unlistenFns[1]).toHaveBeenCalled()
    expect(unlistenFns[2]).toHaveBeenCalled()
    expect(unlistenFns[3]).toHaveBeenCalled()
  })

  it('sets isOptimizing(false) on unmount', async () => {
    useOptimizationStore.getState().setIsOptimizing(true)

    const { unmount } = renderHook(() => useOptimizationStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    unmount()

    expect(useOptimizationStore.getState().isOptimizing).toBe(false)
  })

  it('startOptimization clears suggestions and sets isOptimizing(true)', async () => {
    useOptimizationStore.getState().addSuggestion({
      rank: 1,
      nodeChange: { fromNodeId: null, toNodeId: 'node_x', pointsChange: 1 },
      explanation: 'test',
      deltaDamage: 5,
      deltaSurvivability: null,
      deltaSpeed: null,
      baselineScore: { damage: 50, survivability: 30, speed: 10 },
      previewScore: { damage: 55, survivability: 30, speed: 10 },
    })

    await act(async () => {
      await startOptimization()
    })

    expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      sliderPosition: 50,
      fineTuneWeights: null,
    }))
  })

  it('startOptimization stores AUTH_ERROR when invokeCommand throws', async () => {
    mockInvokeCommand.mockRejectedValueOnce('AUTH_ERROR: no API key configured')

    await act(async () => {
      await startOptimization()
    })

    const { streamError, isOptimizing } = useOptimizationStore.getState()
    expect(streamError).not.toBeNull()
    expect(streamError?.type).toBe('AUTH_ERROR')
    expect(isOptimizing).toBe(false)
  })

  it('optimization:complete event sets isOptimizing(false)', async () => {
    let completeHandler: ((event: { payload: unknown }) => void) | undefined
    mockListen.mockImplementation((eventName: string, handler: (event: { payload: unknown }) => void) => {
      if (eventName === 'optimization:complete') completeHandler = handler
      return Promise.resolve(vi.fn())
    })

    useOptimizationStore.getState().setIsOptimizing(true)

    await act(async () => {
      renderHook(() => useOptimizationStream())
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      completeHandler?.({ payload: { suggestion_count: 3 } })
    })

    expect(useOptimizationStore.getState().isOptimizing).toBe(false)
  })

  it('optimization:error event sets streamError and clears isOptimizing', async () => {
    let errorHandler: ((event: { payload: { error_type: string; message: string } }) => void) | undefined
    mockListen.mockImplementation((eventName: string, handler: (event: { payload: unknown }) => void) => {
      if (eventName === 'optimization:error') errorHandler = handler as typeof errorHandler
      return Promise.resolve(vi.fn())
    })

    useOptimizationStore.getState().setIsOptimizing(true)

    await act(async () => {
      renderHook(() => useOptimizationStream())
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      errorHandler?.({ payload: { error_type: 'TIMEOUT', message: 'request exceeded 45 seconds' } })
    })

    const { streamError, isOptimizing } = useOptimizationStore.getState()
    expect(streamError?.type).toBe('TIMEOUT')
    expect(isOptimizing).toBe(false)
  })

  // Story 3.6: iterative workflow tests

  it('optimization:complete event sets hasOptimizationCompleted(true)', async () => {
    let completeHandler: ((event: { payload: unknown }) => void) | undefined
    mockListen.mockImplementation((eventName: string, handler: (event: { payload: unknown }) => void) => {
      if (eventName === 'optimization:complete') completeHandler = handler
      return Promise.resolve(vi.fn())
    })

    await act(async () => {
      renderHook(() => useOptimizationStream())
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      completeHandler?.({ payload: { suggestion_count: 0 } })
    })

    expect(useOptimizationStore.getState().hasOptimizationCompleted).toBe(true)
  })

  it('startOptimization clears skippedSuggestions', async () => {
    useOptimizationStore.getState().addSuggestion({
      rank: 1,
      nodeChange: { fromNodeId: null, toNodeId: 'node_x', pointsChange: 1 },
      explanation: 'test',
      deltaDamage: 5,
      deltaSurvivability: null,
      deltaSpeed: null,
      baselineScore: { damage: 50, survivability: 30, speed: 10 },
      previewScore: { damage: 55, survivability: 30, speed: 10 },
    })
    useOptimizationStore.getState().skipSuggestion(1)
    expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(1)

    await act(async () => { await startOptimization() })

    expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(0)
  })

  it('startOptimization clears previewSuggestionRank', async () => {
    useOptimizationStore.getState().setPreviewSuggestionRank(2)
    expect(useOptimizationStore.getState().previewSuggestionRank).toBe(2)

    await act(async () => { await startOptimization() })

    expect(useOptimizationStore.getState().previewSuggestionRank).toBeNull()
  })

  it('startOptimization passes sliderPosition and fineTuneWeights to invokeCommand', async () => {
    useOptimizationStore.getState().setSliderPosition(80)
    useOptimizationStore.getState().setFineTuneWeights({ damage: 40, survivability: 40, speed: 20 })

    await act(async () => { await startOptimization() })

    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      sliderPosition: 80,
      fineTuneWeights: { damage: 40, survivability: 40, speed: 20 },
    }))
  })

  it('optimization:suggestion-received adds suggestion to store', async () => {
    let suggestionHandler: ((event: { payload: unknown }) => void) | undefined
    mockListen.mockImplementation((eventName: string, handler: (event: { payload: unknown }) => void) => {
      if (eventName === 'optimization:suggestion-received') suggestionHandler = handler
      return Promise.resolve(vi.fn())
    })

    await act(async () => {
      renderHook(() => useOptimizationStream())
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      suggestionHandler?.({
        payload: {
          rank: 1,
          from_node_id: null,
          to_node_id: 'node_b',
          points_change: 2,
          explanation: 'Allocate node_b for better damage.',
        },
      })
    })

    expect(useOptimizationStore.getState().suggestions).toHaveLength(1)
    expect(useOptimizationStore.getState().suggestions[0].rank).toBe(1)
    expect(useOptimizationStore.getState().suggestions[0].nodeChange.toNodeId).toBe('node_b')
  })

  it('startOptimization passes levelContext when budgetEnforced is true', async () => {
    vi.mocked(useBuildStore.getState).mockReturnValueOnce({
      activeBuild: {
        id: 'test',
        name: 'Test',
        classId: 'sentinel',
        masteryId: 'void_knight',
        schemaVersion: 2,
        budgetEnforced: true,
        characterLevel: 40,
        nodeAllocations: { 'node_a': 2 },
        activeSkillLevels: { slot1: 10 },
        skillNodeAllocations: {},
        weaverAllocations: {},
        contextData: { gear: [], skills: [], idols: [] },
        isPersisted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    } as ReturnType<typeof useBuildStore.getState>)

    await act(async () => { await startOptimization() })

    const availablePassivePoints = calculatePassivePoints(40)
    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      levelContext: {
        characterLevel: 40,
        availablePassivePoints,
        allocatedPassivePoints: 2,
        unspentPassivePoints: availablePassivePoints - 2,
        activeSkillLevels: { slot1: 10 },
      },
    }))
  })

  it('startOptimization passes levelContext: null when budgetEnforced is false', async () => {
    await act(async () => { await startOptimization() })

    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      levelContext: null,
    }))
  })

  it('startOptimization passes structuredGear with resolved values for database-sourced gear', async () => {
    vi.mocked(useGameDataStore.getState).mockReturnValueOnce({
      gameData: { classes: {}, manifest: { schemaVersion: 1, gameVersion: '1.0', dataVersion: '1.0', generatedAt: '2026-01-01', classes: [] } },
      itemDatabase: {
        affixes: [{
          id: 'health_prefix',
          name: 'Health',
          type: 'prefix' as const,
          itemSlots: ['helmet'],
          tiers: [{ tier: 4, minValue: 260, maxValue: 300 }],
        }],
        baseItems: [],
        uniqueItems: [],
      },
    } as ReturnType<typeof useGameDataStore.getState>)

    vi.mocked(useBuildStore.getState).mockReturnValueOnce({
      activeBuild: {
        id: 'test',
        name: 'Test',
        classId: 'sentinel',
        masteryId: 'void_knight',
        schemaVersion: 2 as const,
        budgetEnforced: false,
        characterLevel: 1,
        nodeAllocations: {},
        activeSkillLevels: {},
        skillNodeAllocations: {},
        weaverAllocations: {},
        contextData: {
          gear: [{
            slotId: 'helmet',
            itemName: 'Runed Skullcap',
            affixes: [{ affixId: 'health_prefix', name: 'Health', tier: 4 }],
          }],
          skills: [],
          idols: [],
        },
        isPersisted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    } as ReturnType<typeof useBuildStore.getState>)

    await act(async () => { await startOptimization() })

    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      structuredGear: [{
        slot: 'helmet',
        itemName: 'Runed Skullcap',
        affixes: [{ name: 'Health', tier: 4, value: 280 }],
      }],
    }))
  })

  it('startOptimization passes structuredGear with empty affixes for free-text gear', async () => {
    vi.mocked(useBuildStore.getState).mockReturnValueOnce({
      activeBuild: {
        id: 'test',
        name: 'Test',
        classId: 'sentinel',
        masteryId: 'void_knight',
        schemaVersion: 2 as const,
        budgetEnforced: false,
        characterLevel: 1,
        nodeAllocations: {},
        activeSkillLevels: {},
        skillNodeAllocations: {},
        weaverAllocations: {},
        contextData: {
          gear: [{ slotId: 'body', itemName: 'Some good chest piece', affixes: [] }],
          skills: [],
          idols: [],
        },
        isPersisted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    } as ReturnType<typeof useBuildStore.getState>)

    await act(async () => { await startOptimization() })

    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      structuredGear: [{ slot: 'body', itemName: 'Some good chest piece', affixes: [] }],
    }))
  })

  it('startOptimization passes structuredGear: null when all gear slots are empty', async () => {
    await act(async () => { await startOptimization() })

    expect(mockInvokeCommand).toHaveBeenCalledWith('invoke_claude_api', expect.objectContaining({
      structuredGear: null,
    }))
  })
})
