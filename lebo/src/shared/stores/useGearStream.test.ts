import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Mock } from 'vitest'

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

vi.mock('../utils/buildSnapshotSerializer', () => ({
  toBuildSnapshot: vi.fn(() => ({
    nodeAllocations: {},
    skillNodeAllocations: {},
    characterLevel: 50,
    classId: 'rogue',
    masteryId: 'bladedancer',
    sliderPosition: 50,
    activeConditions: [],
    gearSlots: {},
    idolPlacements: [],
    blessings: [],
    activeSkillLevels: {},
    skillRoles: { 'slot-0': 'primary_offense' },
    primaryOffenseDeliveryType: 'spell',
    primaryOffenseDamageElements: [],
    primaryOffenseSkillName: null,
  })),
}))

vi.mock('../utils/invokeCommand', () => ({
  invokeCommand: vi.fn(),
}))

vi.mock('./buildStore', () => ({
  useBuildStore: {
    getState: vi.fn(() => ({
      activeBuild: {
        id: 'gear-test',
        name: 'Gear Test Build',
        classId: 'rogue',
        masteryId: 'bladedancer',
        nodeAllocations: {},
        contextData: { gear: [], skills: [], idols: [] },
        skillRoles: { 'slot-0': 'primary_offense' },
        isPersisted: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        schemaVersion: 2,
        budgetEnforced: false,
        characterLevel: 50,
        activeSkillLevels: {},
        weaverAllocations: {},
        skillNodeAllocations: {},
      },
    })),
  },
}))

vi.mock('./gameDataStore', () => ({
  useGameDataStore: {
    getState: vi.fn(() => ({
      gameData: {
        classes: {},
        manifest: { schemaVersion: 1, gameVersion: '1.0', dataVersion: 's4.1', generatedAt: '2026-01-01', classes: [] },
      },
    })),
  },
}))

import { listen } from '@tauri-apps/api/event'
import { invokeCommand } from '../utils/invokeCommand'
import { useOptimizationStore } from './optimizationStore'
import { useGearStream, startGearAnalysis } from './useGearStream'

const mockListen = listen as Mock
const mockInvokeCommand = invokeCommand as Mock

describe('useGearStream', () => {
  const initialState = useOptimizationStore.getState()

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
    vi.clearAllMocks()
    mockListen.mockResolvedValue(vi.fn())
    mockInvokeCommand.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers five event listeners on mount', async () => {
    await act(async () => {
      renderHook(() => useGearStream())
    })
    expect(mockListen).toHaveBeenCalledTimes(5)
    expect(mockListen).toHaveBeenCalledWith('gear:analysis-complete', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('gear:error', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('gear:narrative-chunk', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('gear:narrative-complete', expect.any(Function))
    expect(mockListen).toHaveBeenCalledWith('gear:narrative-error', expect.any(Function))
  })

  it('calls unlisten for all five listeners on unmount', async () => {
    const unlistenFns = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()]
    let callCount = 0
    mockListen.mockImplementation(() => Promise.resolve(unlistenFns[callCount++]))

    const { unmount } = renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    unmount()

    for (const fn of unlistenFns) {
      expect(fn).toHaveBeenCalled()
    }
  })

  it('sets isAnalyzingGear(false) on unmount', async () => {
    useOptimizationStore.getState().setIsAnalyzingGear(true)

    const { unmount } = renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    unmount()

    expect(useOptimizationStore.getState().isAnalyzingGear).toBe(false)
  })

  it('sets gearAnalysis and clears isAnalyzingGear on gear:analysis-complete', async () => {
    const gearAnalysis = {
      slot_rankings: [{ slot: 'helm', upgrade_score: 5.0, efficiency_percent: 80.0, ideal_prefix: [], ideal_suffix: [] }],
      priority_slot: 'helm',
    }

    let capturedCallback: ((event: { payload: typeof gearAnalysis }) => void) | null = null
    mockListen.mockImplementation((event: string, callback: (e: unknown) => void) => {
      if (event === 'gear:analysis-complete') capturedCallback = callback as typeof capturedCallback
      return Promise.resolve(vi.fn())
    })

    renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    useOptimizationStore.getState().setIsAnalyzingGear(true)

    await act(async () => {
      capturedCallback!({ payload: gearAnalysis })
    })

    expect(useOptimizationStore.getState().gearAnalysis).toEqual(gearAnalysis)
    expect(useOptimizationStore.getState().isAnalyzingGear).toBe(false)
    expect(useOptimizationStore.getState().isGeneratingNarrative).toBe(true)
  })

  it('appends chunks to gearNarrative on gear:narrative-chunk', async () => {
    let capturedChunkCallback: ((event: { payload: { chunk: string } }) => void) | null = null
    mockListen.mockImplementation((event: string, callback: (e: unknown) => void) => {
      if (event === 'gear:narrative-chunk') capturedChunkCallback = callback as typeof capturedChunkCallback
      return Promise.resolve(vi.fn())
    })

    renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      capturedChunkCallback!({ payload: { chunk: 'Your Poison' } })
      capturedChunkCallback!({ payload: { chunk: ' Eruption build' } })
    })

    expect(useOptimizationStore.getState().gearNarrative).toBe('Your Poison Eruption build')
  })

  it('sets isGeneratingNarrative false on gear:narrative-complete', async () => {
    let capturedCompleteCallback: ((event: unknown) => void) | null = null
    mockListen.mockImplementation((event: string, callback: (e: unknown) => void) => {
      if (event === 'gear:narrative-complete') capturedCompleteCallback = callback as typeof capturedCompleteCallback
      return Promise.resolve(vi.fn())
    })

    renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    useOptimizationStore.getState().setIsGeneratingNarrative(true)

    await act(async () => {
      capturedCompleteCallback!({})
    })

    expect(useOptimizationStore.getState().isGeneratingNarrative).toBe(false)
  })

  it('sets streamError and clears isGeneratingNarrative on gear:narrative-error', async () => {
    let capturedNarrativeErrorCallback: ((event: { payload: { error_type: string; message: string } }) => void) | null = null
    mockListen.mockImplementation((event: string, callback: (e: unknown) => void) => {
      if (event === 'gear:narrative-error') capturedNarrativeErrorCallback = callback as typeof capturedNarrativeErrorCallback
      return Promise.resolve(vi.fn())
    })

    renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    useOptimizationStore.getState().setIsGeneratingNarrative(true)

    await act(async () => {
      capturedNarrativeErrorCallback!({
        payload: { error_type: 'API_ERROR', message: 'rate limit reached' },
      })
    })

    expect(useOptimizationStore.getState().streamError).not.toBeNull()
    expect(useOptimizationStore.getState().isGeneratingNarrative).toBe(false)
  })

  it('sets streamError and clears isAnalyzingGear on gear:error', async () => {
    let capturedErrorCallback: ((event: { payload: { error_type: string; message: string } }) => void) | null = null
    mockListen.mockImplementation((event: string, callback: (e: unknown) => void) => {
      if (event === 'gear:error') capturedErrorCallback = callback as typeof capturedErrorCallback
      return Promise.resolve(vi.fn())
    })

    renderHook(() => useGearStream())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    useOptimizationStore.getState().setIsAnalyzingGear(true)

    await act(async () => {
      capturedErrorCallback!({
        payload: { error_type: 'SCORING_ERROR', message: 'game_data lock poisoned' },
      })
    })

    expect(useOptimizationStore.getState().streamError).not.toBeNull()
    expect(useOptimizationStore.getState().isAnalyzingGear).toBe(false)
  })
})

describe('startGearAnalysis', () => {
  const initialState = useOptimizationStore.getState()

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
    vi.clearAllMocks()
    mockInvokeCommand.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls invokeCommand with run_gear_scoring and snapshot', async () => {
    await startGearAnalysis()

    expect(mockInvokeCommand).toHaveBeenCalledWith(
      'run_gear_scoring',
      expect.objectContaining({ snapshot: expect.any(Object) }),
    )
  })

  it('sets isAnalyzingGear true before command, clears gearAnalysis and gearNarrative', async () => {
    useOptimizationStore.getState().setGearAnalysis({
      slot_rankings: [],
      priority_slot: '',
    })
    useOptimizationStore.getState().setGearNarrative('old narrative')

    let stateBeforeCommand = false
    mockInvokeCommand.mockImplementationOnce(() => {
      stateBeforeCommand = useOptimizationStore.getState().isAnalyzingGear
      return Promise.resolve(undefined)
    })

    await startGearAnalysis()

    expect(stateBeforeCommand).toBe(true)
    expect(useOptimizationStore.getState().gearAnalysis).toBeNull()
    expect(useOptimizationStore.getState().gearNarrative).toBeNull()
  })

  it('sets streamError and clears isAnalyzingGear on IPC error', async () => {
    mockInvokeCommand.mockRejectedValueOnce(new Error('SCORING_ERROR: lock poisoned'))

    await startGearAnalysis()

    expect(useOptimizationStore.getState().streamError).not.toBeNull()
    expect(useOptimizationStore.getState().isAnalyzingGear).toBe(false)
  })
})
