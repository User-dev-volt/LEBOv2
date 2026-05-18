import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccessibilityAnnouncer } from './useAccessibilityAnnouncer'
import { useOptimizationStore } from '../stores/optimizationStore'

function createLiveRegion(id: string) {
  const el = document.createElement('div')
  el.id = id
  document.body.appendChild(el)
  return el
}

describe('useAccessibilityAnnouncer', () => {
  let aiRegion: HTMLElement
  let errorRegion: HTMLElement
  const initialState = useOptimizationStore.getState()

  beforeEach(() => {
    useOptimizationStore.setState(initialState, true)
    aiRegion = createLiveRegion('ai-status-region')
    errorRegion = createLiveRegion('critical-error-region')
    vi.useFakeTimers()
  })

  afterEach(() => {
    document.body.removeChild(aiRegion)
    document.body.removeChild(errorRegion)
    vi.useRealTimers()
  })

  it('announces "Analyzing your build..." when isOptimizing transitions true', async () => {
    renderHook(() => useAccessibilityAnnouncer())
    act(() => {
      useOptimizationStore.getState().setIsOptimizing(true)
    })
    await vi.runAllTimersAsync()
    expect(aiRegion.textContent).toBe('Analyzing your build...')
  })

  it('announces completion with suggestion count when hasOptimizationCompleted transitions true', async () => {
    renderHook(() => useAccessibilityAnnouncer())
    act(() => {
      useOptimizationStore.setState({
        suggestions: [
          {
            rank: 1,
            nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: 1 },
            explanation: '',
            deltaDamage: 5,
            deltaSurvivability: 0,
            deltaSpeed: 0,
            baselineScore: { damage: 10, survivability: 10, speed: 10 },
            previewScore: { damage: 15, survivability: 10, speed: 10 },
          },
          {
            rank: 2,
            nodeChange: { fromNodeId: null, toNodeId: 'n2', pointsChange: 1 },
            explanation: '',
            deltaDamage: 2,
            deltaSurvivability: 0,
            deltaSpeed: 0,
            baselineScore: { damage: 10, survivability: 10, speed: 10 },
            previewScore: { damage: 12, survivability: 10, speed: 10 },
          },
        ],
        hasOptimizationCompleted: true,
      })
    })
    await vi.runAllTimersAsync()
    expect(aiRegion.textContent).toBe('Optimization complete. 2 suggestions available')
  })

  it('injects error message into critical-error-region when streamError changes', async () => {
    renderHook(() => useAccessibilityAnnouncer())
    act(() => {
      useOptimizationStore.getState().setStreamError({
        type: 'API_ERROR',
        message: 'API key is invalid',
      })
    })
    await vi.runAllTimersAsync()
    expect(errorRegion.textContent).toBe('API key is invalid')
  })

  it('clears ai-status-region when isOptimizing goes false without completion', async () => {
    renderHook(() => useAccessibilityAnnouncer())
    act(() => {
      useOptimizationStore.getState().setIsOptimizing(true)
    })
    await vi.runAllTimersAsync()
    act(() => {
      useOptimizationStore.getState().setIsOptimizing(false)
    })
    await vi.runAllTimersAsync()
    expect(aiRegion.textContent).toBe('')
  })
})
