import { describe, it, expect, beforeEach } from 'vitest'
import { useBuildStore } from './buildStore'
import { useOptimizationStore } from './optimizationStore'
import type { BuildState } from '../types/build'
import type { FineTuneWeights } from '../types/optimization'

// Tests the cross-store sync logic wired in App.tsx via useBuildStore.subscribe.
// The subscriber callback is registered manually here to isolate the logic from
// App's Tauri/render dependencies. This confirms the logic is correct; the wiring
// in App.tsx is verified by the code structure and must be kept in sync with this test.
function registerBuildSwitchSubscriber() {
  return useBuildStore.subscribe((state, prev) => {
    if (state.activeBuild?.id === prev.activeBuild?.id) return
    const build = state.activeBuild
    useOptimizationStore.getState().setSliderPosition(build?.sliderPosition ?? 50)
    useOptimizationStore.getState().setFineTuneWeights(build?.fineTuneWeights ?? null)
    useOptimizationStore.getState().clearSuggestions()
  })
}

const initialBuildState = useBuildStore.getState()
const initialOptState = useOptimizationStore.getState()

function makeBuild(id: string, sliderPosition: number, fineTuneWeights: FineTuneWeights | null = null): BuildState {
  return {
    schemaVersion: 2,
    id,
    name: 'Test',
    classId: 'sentinel',
    masteryId: 'void_knight',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    isPersisted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sliderPosition,
    fineTuneWeights,
  }
}

describe('build switch sync (App.tsx subscriber logic — AC4)', () => {
  beforeEach(() => {
    useBuildStore.setState(initialBuildState, true)
    useOptimizationStore.setState(initialOptState, true)
  })

  it('syncs optimizationStore.sliderPosition to the loaded build value', () => {
    const unsubscribe = registerBuildSwitchSubscriber()
    useBuildStore.setState({ activeBuild: makeBuild('build-a', 75) })
    expect(useOptimizationStore.getState().sliderPosition).toBe(75)
    unsubscribe()
  })

  it('syncs optimizationStore.fineTuneWeights to the loaded build value', () => {
    const weights: FineTuneWeights = { damage: 60, survivability: 30, speed: 10 }
    const unsubscribe = registerBuildSwitchSubscriber()
    useBuildStore.setState({ activeBuild: makeBuild('build-b', 60, weights) })
    expect(useOptimizationStore.getState().fineTuneWeights).toEqual(weights)
    unsubscribe()
  })

  it('clears suggestions when active build switches', () => {
    const unsubscribe = registerBuildSwitchSubscriber()
    useOptimizationStore.setState({
      suggestions: [
        {
          rank: 1,
          nodeChange: { fromNodeId: null, toNodeId: 'node-1', pointsChange: 1 },
          explanation: 'test',
          deltaDamage: 1,
          deltaSurvivability: 0,
          deltaSpeed: null,
          baselineScore: { damage: 10, survivability: 10, speed: 10 },
          previewScore: { damage: 11, survivability: 10, speed: 10 },
        },
      ],
    })
    useBuildStore.setState({ activeBuild: makeBuild('build-c', 50) })
    expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
    unsubscribe()
  })

  it('defaults sliderPosition to 50 when loaded build has undefined sliderPosition', () => {
    const unsubscribe = registerBuildSwitchSubscriber()
    const buildWithoutSlider = { ...makeBuild('build-d', 0), sliderPosition: undefined }
    useBuildStore.setState({ activeBuild: buildWithoutSlider as BuildState })
    expect(useOptimizationStore.getState().sliderPosition).toBe(50)
    unsubscribe()
  })

  it('passes sliderPosition: 0 correctly (not swallowed by ?? 50)', () => {
    const unsubscribe = registerBuildSwitchSubscriber()
    useBuildStore.setState({ activeBuild: makeBuild('build-e', 0) })
    expect(useOptimizationStore.getState().sliderPosition).toBe(0)
    unsubscribe()
  })

  it('does not re-sync when the same build id is set again (same-id no-op)', () => {
    const unsubscribe = registerBuildSwitchSubscriber()
    useBuildStore.setState({ activeBuild: makeBuild('build-f', 30) })
    useOptimizationStore.setState({ sliderPosition: 99 })
    useBuildStore.setState({ activeBuild: makeBuild('build-f', 30) })
    expect(useOptimizationStore.getState().sliderPosition).toBe(99)
    unsubscribe()
  })

  it('resets slider to 50 and clears fineTuneWeights when activeBuild becomes null', () => {
    const unsubscribe = registerBuildSwitchSubscriber()
    useBuildStore.setState({ activeBuild: makeBuild('build-g', 80, { damage: 80, survivability: 10, speed: 10 }) })
    useBuildStore.setState({ activeBuild: null })
    expect(useOptimizationStore.getState().sliderPosition).toBe(50)
    expect(useOptimizationStore.getState().fineTuneWeights).toBeNull()
    unsubscribe()
  })
})
