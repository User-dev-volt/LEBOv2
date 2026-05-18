import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useAppStore } from '../../shared/stores/appStore'

// Mock useOptimizationStream — it registers Tauri event listeners we can't run in jsdom
vi.mock('../../shared/stores/useOptimizationStream', () => ({
  useOptimizationStream: vi.fn(),
  startOptimization: vi.fn(),
}))

// Mock @tauri-apps/api/event to prevent listen() side-effects
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}))

import { RightPanel } from './RightPanel'

const MOCK_BUILD = {
  id: 'build-1',
  name: 'Test Build',
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
  schemaVersion: 1 as const,
}

const BUILD_WITH_CONTEXT = {
  ...MOCK_BUILD,
  contextData: {
    gear: [{ slotId: 'helm', itemName: 'Iron Helm', affixes: [] }],
    skills: [],
    idols: [],
  },
}

describe('RightPanel', () => {
  const initialBuildState = useBuildStore.getState()
  const initialOptState = useOptimizationStore.getState()
  const initialAppState = useAppStore.getState()

  beforeEach(() => {
    useBuildStore.setState(initialBuildState, true)
    useOptimizationStore.setState(initialOptState, true)
    useAppStore.setState({ ...initialAppState, isOnline: true, isOnlineChecked: true }, true)
    vi.clearAllMocks()
  })

  it('renders panel in expanded state', () => {
    render(<RightPanel />)
    expect(screen.getByRole('complementary', { name: 'Right panel' })).toBeInTheDocument()
  })

  it('shows "Select a build to see scores" when no build is loaded', () => {
    useBuildStore.setState({ activeBuild: null })
    render(<RightPanel />)
    expect(screen.getByText(/Select a build to see scores/)).toBeInTheDocument()
  })

  it('renders disabled OptimizeButton when no build is loaded (AC3)', () => {
    useBuildStore.setState({ activeBuild: null })
    render(<RightPanel />)
    expect(screen.getByTestId('optimize-button')).toBeDisabled()
    expect(screen.getByTestId('optimize-button')).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders OptimizationSlider when a build is loaded', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<RightPanel />)
    expect(screen.getByRole('slider', { name: 'Optimization intent' })).toBeInTheDocument()
  })

  it('renders OptimizeButton when a build is loaded', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<RightPanel />)
    expect(screen.getByTestId('optimize-button')).toBeInTheDocument()
  })

  it('Optimize button is not disabled when build is loaded', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<RightPanel />)
    expect(screen.getByTestId('optimize-button')).not.toBeDisabled()
  })

  it('Optimize button shows loading state when isOptimizing', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useOptimizationStore.setState({ isOptimizing: true })
    render(<RightPanel />)
    expect(screen.getByTestId('optimize-button')).toHaveTextContent('Analyzing...')
  })

  it('shows context note when build has empty context data', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<RightPanel />)
    expect(screen.getByTestId('context-note')).toBeInTheDocument()
    expect(screen.getByText(/Add gear, skills, and idols/)).toBeInTheDocument()
  })

  it('does not show context note when build has gear', () => {
    useBuildStore.setState({ activeBuild: BUILD_WITH_CONTEXT })
    render(<RightPanel />)
    expect(screen.queryByTestId('context-note')).toBeNull()
  })

  it('dismisses context note when × button is clicked', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<RightPanel />)
    expect(screen.getByTestId('context-note')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('context-note')).toBeNull()
  })

  it('does not show OptimizationSlider or OptimizeButton when panel is collapsed', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useAppStore.setState({ activePanel: { left: 'expanded', right: 'collapsed' } })
    render(<RightPanel />)
    expect(screen.queryByRole('slider', { name: 'Optimization intent' })).toBeNull()
    expect(screen.queryByTestId('optimize-button')).toBeNull()
  })

  it('renders suggestions-list when build is loaded', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<RightPanel />)
    expect(screen.getByTestId('suggestions-list')).toBeInTheDocument()
  })

  it('renders suggestions-list even when no build is loaded', () => {
    useBuildStore.setState({ activeBuild: null })
    render(<RightPanel />)
    expect(screen.getByTestId('suggestions-list')).toBeInTheDocument()
  })

  it('does not contain the Story 3.4 placeholder text', () => {
    render(<RightPanel />)
    expect(screen.queryByText(/Suggestion list — Story 3\.4/)).toBeNull()
  })

  // Story 3.5: ScoreGauge preview score wiring

  it('ScoreGauge shows comparison mode when previewSuggestionRank is set', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useOptimizationStore.setState({
      scores: { damage: 10, survivability: 10, speed: 10 },
      previewSuggestionRank: 1,
      suggestions: [
        {
          rank: 1,
          nodeChange: { fromNodeId: null, toNodeId: 'n1', pointsChange: 1 },
          explanation: '',
          deltaDamage: 5,
          deltaSurvivability: 0,
          deltaSpeed: null,
          baselineScore: { damage: 10, survivability: 10, speed: 10 },
          previewScore: { damage: 15, survivability: 10, speed: 10 },
        },
      ],
    })
    render(<RightPanel />)
    // ScoreGauge in comparison mode renders "→" between baseline and preview values
    expect(screen.getByTestId('score-gauge')).toHaveTextContent('→')
  })

  // Story 5.2: Offline guard
  it('OptimizeButton is disabled when offline and activeBuild is present (AC4)', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useAppStore.setState({ isOnline: false })
    render(<RightPanel />)
    expect(screen.getByTestId('optimize-button')).toBeDisabled()
  })

  it('shows offline note when offline (AC4)', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useAppStore.setState({ isOnline: false, isOnlineChecked: true })
    render(<RightPanel />)
    expect(screen.getByTestId('offline-note')).toBeInTheDocument()
    expect(screen.getByText(/AI optimization requires internet connectivity/)).toBeInTheDocument()
  })

  it('OptimizeButton is enabled when online and activeBuild is present (AC5)', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useAppStore.setState({ isOnline: true })
    render(<RightPanel />)
    expect(screen.getByTestId('optimize-button')).not.toBeDisabled()
  })

  it('offline note is not shown when online', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useAppStore.setState({ isOnline: true })
    render(<RightPanel />)
    expect(screen.queryByTestId('offline-note')).toBeNull()
  })

  it('offline note is visible when offline and no activeBuild', () => {
    useBuildStore.setState({ activeBuild: null })
    useAppStore.setState({ isOnline: false, isOnlineChecked: true })
    render(<RightPanel />)
    expect(screen.getByTestId('offline-note')).toBeInTheDocument()
  })

  it('offline note is hidden while connectivity check is pending (isOnlineChecked=false)', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useAppStore.setState({ isOnline: false, isOnlineChecked: false })
    render(<RightPanel />)
    expect(screen.queryByTestId('offline-note')).toBeNull()
  })

  it('ScoreGauge shows single score when no preview active', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useOptimizationStore.setState({
      scores: { damage: 10, survivability: 10, speed: 10 },
      previewSuggestionRank: null,
      suggestions: [],
    })
    render(<RightPanel />)
    expect(screen.getByTestId('score-gauge')).not.toHaveTextContent('→')
  })
})
