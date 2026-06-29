import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useAppStore } from '../../shared/stores/appStore'

// Mock Tauri event to prevent side-effects
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}))

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn(() => Promise.resolve(null)),
}))

import { SuggestionsList } from './SuggestionsList'
import type { SuggestionResult } from '../../shared/types/optimization'
import type { GameData } from '../../shared/types/gameData'

const BASE_SCORE = { damage: 10, survivability: 10, speed: 10 }

function makeSuggestion(rank: number, toNodeId = `node-${rank}`): SuggestionResult {
  return {
    rank,
    nodeChange: { fromNodeId: null, toNodeId, pointsChange: 1 },
    explanation: 'Test',
    deltaDamage: rank,
    deltaSurvivability: 0,
    deltaSpeed: null,
    baselineScore: BASE_SCORE,
    previewScore: BASE_SCORE,
  }
}

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

describe('SuggestionsList', () => {
  const initialOptState = useOptimizationStore.getState()
  const initialBuildState = useBuildStore.getState()
  const initialGameDataState = useGameDataStore.getState()

  beforeEach(() => {
    useOptimizationStore.setState(initialOptState, true)
    useBuildStore.setState(initialBuildState, true)
    useGameDataStore.setState(initialGameDataState, true)
  })

  it('renders root with data-testid', () => {
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestions-list')).toBeInTheDocument()
  })

  it('shows empty state when no suggestions and not optimizing', () => {
    useOptimizationStore.setState({ suggestions: [], isOptimizing: false, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestions-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/Select an optimization goal/)).toBeInTheDocument()
  })

  it('does not show empty state when optimizing', () => {
    useOptimizationStore.setState({ suggestions: [], isOptimizing: true, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('suggestions-empty-state')).toBeNull()
  })

  it('does not show empty state when streamError is present', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'Something broke', type: 'UNKNOWN' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('suggestions-empty-state')).toBeNull()
  })

  it('shows skeleton when isOptimizing and no suggestions yet', () => {
    useOptimizationStore.setState({ suggestions: [], isOptimizing: true, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestion-skeletons')).toBeInTheDocument()
  })

  it('hides skeleton once suggestions arrive', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: true,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('suggestion-skeletons')).toBeNull()
  })

  it('shows count header when suggestions exist', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1), makeSuggestion(2), makeSuggestion(3)],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3 suggestions found')
  })

  it('uses singular "suggestion" when count is 1', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1 suggestion found')
  })

  it('does not show count header during skeleton phase', () => {
    useOptimizationStore.setState({ suggestions: [], isOptimizing: true, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('suggestions-count')).toBeNull()
  })

  it('renders a SuggestionCard per suggestion', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1), makeSuggestion(2)],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestion-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('suggestion-card-2')).toBeInTheDocument()
  })

  it('shows error banner when streamError is set', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'Could not reach AI engine.', type: 'NETWORK_ERROR' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('stream-error-banner')).toBeInTheDocument()
    expect(screen.getByText('Could not reach AI engine.')).toBeInTheDocument()
  })

  it('dismisses error banner when × button is clicked', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'Oops', type: 'UNKNOWN' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('stream-error-banner')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }))
    expect(useOptimizationStore.getState().streamError).toBeNull()
  })

  it('uses node name from gameData when available', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useGameDataStore.setState({
      gameData: {
        manifest: {
          schemaVersion: 1,
          gameVersion: '1.0',
          dataVersion: '1.0',
          generatedAt: '2026-01-01',
          classes: ['sentinel'],
        },
        classes: {
          sentinel: {
            classId: 'sentinel',
            className: 'Sentinel',
            baseTree: {},
            masteries: {
              void_knight: {
                masteryId: 'void_knight',
                masteryName: 'Void Knight',
                nodes: {
                  'node-1': {
                    id: 'node-1',
                    name: 'Void Cleave',
                    pointCost: 1,
                    maxPoints: 5,
                    prerequisiteNodeIds: [],
                    effectDescription: '',
                    tags: [],
                    position: { x: 0, y: 0 },
                    size: 'small',
                  },
                },
              },
            },
            skills: [],
            skillTrees: {},
          },
        },
      },
    })
    useOptimizationStore.setState({
      suggestions: [
        {
          rank: 1,
          nodeChange: { fromNodeId: null, toNodeId: 'node-1', pointsChange: 1 },
          explanation: '',
          deltaDamage: 1,
          deltaSurvivability: 0,
          deltaSpeed: null,
          baselineScore: BASE_SCORE,
          previewScore: BASE_SCORE,
        },
      ],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestion-node-name')).toHaveTextContent('Void Cleave')
  })

  it('falls back to nodeId when gameData not available', () => {
    useGameDataStore.setState({ gameData: null })
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1, 'unknown-node-xyz')],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestion-node-name')).toHaveTextContent('unknown-node-xyz')
  })

  // Story 3.5: interaction tests

  it('shows preview banner when previewSuggestionRank is set', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: 1,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('preview-banner')).toBeInTheDocument()
    expect(screen.getByTestId('preview-banner')).toHaveTextContent('Previewing suggestion #1')
  })

  it('hides preview banner when previewSuggestionRank is null', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('preview-banner')).toBeNull()
  })

  it('preview cancel button clears previewSuggestionRank', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: 1,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('preview-cancel-btn'))
    expect(useOptimizationStore.getState().previewSuggestionRank).toBeNull()
  })

  it('skip moves suggestion to skipped section', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      skippedSuggestions: [],
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('suggestion-skip-btn'))
    expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(1)
    expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
  })

  it('skipped section hidden when no skipped suggestions', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      skippedSuggestions: [],
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('skipped-section')).toBeNull()
  })

  it('skipped section visible when skipped suggestions exist', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      skippedSuggestions: [makeSuggestion(1)],
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('skipped-section')).toBeInTheDocument()
  })

  it('preview button toggles previewSuggestionRank for the card', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('suggestion-preview-btn'))
    expect(useOptimizationStore.getState().previewSuggestionRank).toBe(1)
  })

  it('hover enter sets highlightedNodeIds with glowing toNodeId', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1, 'target-node')],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByTestId('suggestion-card-1'))
    const highlighted = useOptimizationStore.getState().highlightedNodeIds
    expect(highlighted?.glowing.has('target-node')).toBe(true)
  })

  it('hover leave clears highlightedNodeIds', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1, 'target-node')],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.mouseEnter(screen.getByTestId('suggestion-card-1'))
    fireEvent.mouseLeave(screen.getByTestId('suggestion-card-1'))
    expect(useOptimizationStore.getState().highlightedNodeIds).toBeNull()
  })

  // Story 3.6: differentiated empty states

  it('shows initial empty state when hasOptimizationCompleted is false', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      hasOptimizationCompleted: false,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestions-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/Select an optimization goal/)).toBeInTheDocument()
    expect(screen.queryByTestId('suggestions-well-optimized')).toBeNull()
  })

  it('shows well-optimized message when optimization completed with zero results', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      hasOptimizationCompleted: true,
      goal: 'balanced',
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('suggestions-well-optimized')).toBeInTheDocument()
    expect(screen.getByText(/well-optimized for Balanced/)).toBeInTheDocument()
    expect(screen.queryByTestId('suggestions-empty-state')).toBeNull()
  })

  it('well-optimized message reflects the active goal label', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      hasOptimizationCompleted: true,
      goal: 'maximize_damage',
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByText(/well-optimized for Maximize Damage/)).toBeInTheDocument()
  })

  // Story 5.4: Retry button for retryable errors

  it('shows Retry button when streamError is retryable (API_ERROR)', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'API error', type: 'API_ERROR' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('retry-optimization-button')).toBeInTheDocument()
  })

  it('does not show Retry button when streamError is non-retryable (AUTH_ERROR)', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'No API key', type: 'AUTH_ERROR' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('retry-optimization-button')).toBeNull()
  })

  it('clicking Retry button calls onRetry prop', () => {
    const onRetry = vi.fn()
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'Network error', type: 'NETWORK_ERROR' },
    })
    render(<SuggestionsList onRetry={onRetry} />)
    fireEvent.click(screen.getByTestId('retry-optimization-button'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // Story 5.1: AUTH_ERROR "Go to Settings" link
  it('shows Go to Settings button when streamError type is AUTH_ERROR', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: {
        message: 'No API key configured. Add your Claude API key in Settings.',
        type: 'AUTH_ERROR',
      },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('auth-error-settings-link')).toBeInTheDocument()
    expect(screen.getByText('Go to Settings')).toBeInTheDocument()
  })

  it('does not show Go to Settings button for non-AUTH_ERROR errors', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'Something broke', type: 'NETWORK_ERROR' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('auth-error-settings-link')).toBeNull()
  })

  it('Go to Settings button navigates to settings view', () => {
    useAppStore.setState({ currentView: 'main' })
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: { message: 'No API key', type: 'AUTH_ERROR' },
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('auth-error-settings-link'))
    expect(useAppStore.getState().currentView).toBe('settings')
  })

  // Story 6.1: keyboard navigation tests

  it('ArrowDown moves keyboard focus to next suggestion card', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1), makeSuggestion(2)],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    const card1 = screen.getByTestId('suggestion-card-1')
    expect(document.activeElement).toBe(card1)
  })

  it('ArrowDown then ArrowDown moves focus to second card', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1), makeSuggestion(2)],
      isOptimizing: false,
      streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    const card2 = screen.getByTestId('suggestion-card-2')
    expect(document.activeElement).toBe(card2)
  })

  it('P key triggers setPreviewSuggestionRank for focused suggestion', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'P' })
    expect(useOptimizationStore.getState().previewSuggestionRank).toBe(1)
  })

  it('S key triggers skipSuggestion for focused suggestion', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1), makeSuggestion(2)],
      isOptimizing: false,
      streamError: null,
      skippedSuggestions: [],
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'S' })
    expect(useOptimizationStore.getState().skippedSuggestions).toHaveLength(1)
    expect(useOptimizationStore.getState().skippedSuggestions[0].rank).toBe(1)
  })

  it('Escape clears focused card and preview', () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: 1,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'Escape' })
    // After Escape, no card should be focused and preview should be cleared
    expect(useOptimizationStore.getState().previewSuggestionRank).toBeNull()
  })

  // Story 7.6: Clear suggestions button
  it('renders "Clear suggestions" button when suggestions are present and not optimizing', () => {
    useOptimizationStore.setState({ suggestions: [makeSuggestion(1)], isOptimizing: false })
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('clear-suggestions-button')).toBeInTheDocument()
  })

  it('clicking Clear suggestions calls clearSuggestions on the store', async () => {
    useOptimizationStore.setState({ suggestions: [makeSuggestion(1)], isOptimizing: false })
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    render(<SuggestionsList onRetry={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-suggestions-button'))
    })
    expect(useOptimizationStore.getState().suggestions).toHaveLength(0)
  })

  // Story 4.5: hover delta preview tests

  it('calls invokeCommand compute_stats on mouseenter when isComputingStats is false', async () => {
    const { invokeCommand } = await import('../../shared/utils/invokeCommand')
    vi.mocked(invokeCommand).mockClear()
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isComputingStats: false,
      isOptimizing: false,
    })
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useGameDataStore.setState({ gameData: { classes: {} } as unknown as GameData })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const card = screen.getByTestId('suggestion-card-1')
    fireEvent.mouseEnter(card)
    await act(async () => {})
    expect(vi.mocked(invokeCommand)).toHaveBeenCalledWith('compute_stats', expect.objectContaining({ snapshot: expect.any(Object) }))
  })

  it('does NOT call invokeCommand compute_stats on mouseenter when isComputingStats is true', async () => {
    const { invokeCommand } = await import('../../shared/utils/invokeCommand')
    vi.mocked(invokeCommand).mockClear()
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isComputingStats: true,
      isOptimizing: false,
    })
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useGameDataStore.setState({ gameData: { classes: {} } as unknown as GameData })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const card = screen.getByTestId('suggestion-card-1')
    fireEvent.mouseEnter(card)
    await act(async () => {})
    expect(vi.mocked(invokeCommand)).not.toHaveBeenCalledWith('compute_stats', expect.anything())
  })

  it('mouseleave clears previewStatSheet (AC2)', async () => {
    const { invokeCommand } = await import('../../shared/utils/invokeCommand')
    vi.mocked(invokeCommand).mockClear()
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isComputingStats: false,
      isOptimizing: false,
    })
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useGameDataStore.setState({ gameData: { classes: {} } as unknown as GameData })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const card = screen.getByTestId('suggestion-card-1')
    fireEvent.mouseEnter(card)
    await act(async () => {})
    fireEvent.mouseLeave(card)
    expect(useOptimizationStore.getState().previewStatSheet).toBeNull()
  })

  it('global keyboard:escape event clears focused card state', async () => {
    useOptimizationStore.setState({
      suggestions: [makeSuggestion(1)],
      isOptimizing: false,
      streamError: null,
      previewSuggestionRank: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    // Focus first card via ArrowDown
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    // Verify card received focus styling
    const card1 = screen.getByTestId('suggestion-card-1')
    expect(card1.style.outline).toBeTruthy()
    // Dispatch the global escape event (as App.tsx would) inside act so React re-renders
    await act(async () => {
      window.dispatchEvent(new CustomEvent('keyboard:escape'))
    })
    // After escape, focus styling should be cleared
    expect(card1.style.outline).toBeFalsy()
  })

  // Story 3.1: empty-budget notice (AC3)
  const EMPTY_BUDGET_NOTICE =
    'No unspent passive points available. Allocate additional points or use the Complete Build Optimizer for a full reallocation analysis.'

  it('renders the empty-budget notice when optimizationNotice is set and not optimizing', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      optimizationNotice: EMPTY_BUDGET_NOTICE,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('empty-budget-notice')).toBeInTheDocument()
    expect(screen.getByText(/No unspent passive points available/)).toBeInTheDocument()
  })

  it('empty-budget notice takes precedence over the generic empty-state copy', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      hasOptimizationCompleted: false,
      optimizationNotice: EMPTY_BUDGET_NOTICE,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.getByTestId('empty-budget-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('suggestions-empty-state')).toBeNull()
    expect(screen.queryByTestId('suggestions-well-optimized')).toBeNull()
  })

  it('does not render the empty-budget notice while optimizing', () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: true,
      streamError: null,
      optimizationNotice: EMPTY_BUDGET_NOTICE,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('empty-budget-notice')).toBeNull()
  })

  it('empty-budget notice has no axe violations', async () => {
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      optimizationNotice: EMPTY_BUDGET_NOTICE,
    })
    const { container } = render(<SuggestionsList onRetry={vi.fn()} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  // DN-1 (code review): the notice is gated on LIVE unspent points, so once the build regains
  // unspent points (a same-build edit) the stale notice auto-hides even though it is still in store.
  it('suppresses the empty-budget notice once the build has unspent points again', () => {
    useBuildStore.getState().setActiveBuild({ ...MOCK_BUILD, characterLevel: 10, nodeAllocations: {} })
    useOptimizationStore.setState({
      suggestions: [],
      isOptimizing: false,
      streamError: null,
      optimizationNotice: EMPTY_BUDGET_NOTICE,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    expect(screen.queryByTestId('empty-budget-notice')).toBeNull()
    // With no notice displayed, the generic empty-state copy returns.
    expect(screen.getByTestId('suggestions-empty-state')).toBeInTheDocument()
  })

  // ── Story 3.3 — card → tree cross-highlight activation (AC2) ──

  it('clicking a card activates the cross-highlight (glowing toNodeId)', () => {
    useOptimizationStore.setState({ suggestions: [makeSuggestion(1, 'target-node')], isOptimizing: false, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('suggestion-card-1'))
    expect(useOptimizationStore.getState().highlightedNodeIds?.glowing.has('target-node')).toBe(true)
  })

  it('clicking a card requests canvas focus (focusNodeId set + nonce bumped)', () => {
    useOptimizationStore.setState({ suggestions: [makeSuggestion(1, 'target-node')], isOptimizing: false, streamError: null })
    const before = useOptimizationStore.getState().focusNonce
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('suggestion-card-1'))
    expect(useOptimizationStore.getState().focusNodeId).toBe('target-node')
    expect(useOptimizationStore.getState().focusNonce).toBeGreaterThan(before)
  })

  it('keyboard-focusing a card (ArrowDown) activates the cross-highlight', () => {
    useOptimizationStore.setState({ suggestions: [makeSuggestion(1, 'kbd-node')], isOptimizing: false, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    const list = screen.getByRole('list', { name: /optimization suggestions/i })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    expect(useOptimizationStore.getState().highlightedNodeIds?.glowing.has('kbd-node')).toBe(true)
  })

  it('a SWAP suggestion activation glows the target and dims the source node', () => {
    const swap = { ...makeSuggestion(1), nodeChange: { fromNodeId: 'from-node', toNodeId: 'to-node', pointsChange: 1 } }
    useOptimizationStore.setState({ suggestions: [swap], isOptimizing: false, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('suggestion-card-1'))
    const hl = useOptimizationStore.getState().highlightedNodeIds
    expect(hl?.glowing.has('to-node')).toBe(true)
    expect(hl?.dimmed.has('from-node')).toBe(true)
  })

  it('announces the active selection in a polite live region', () => {
    useBuildStore.setState({ activeBuild: MOCK_BUILD })
    useOptimizationStore.setState({ suggestions: [makeSuggestion(1, 'target-node')], isOptimizing: false, streamError: null })
    render(<SuggestionsList onRetry={vi.fn()} />)
    fireEvent.click(screen.getByTestId('suggestion-card-1'))
    const region = screen.getByTestId('suggestions-live-region')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent(/Selected .*suggestion 1/)
  })

  it('renders the exact score delta and point/path cost for a known fixture (FR-19 value+element)', () => {
    const gn = (id: string, prerequisiteNodeIds: string[], pointCost: number) => ({
      id, name: id, pointCost, maxPoints: 5, prerequisiteNodeIds,
      effectDescription: '', tags: [], position: { x: 0, y: 0 }, size: 'small' as const,
    })
    useBuildStore.setState({ activeBuild: { ...MOCK_BUILD, nodeAllocations: { root: 1 } } })
    useGameDataStore.setState({
      gameData: {
        manifest: { schemaVersion: 1, gameVersion: '1', dataVersion: '1', generatedAt: 'x', classes: ['sentinel'] },
        classes: {
          sentinel: {
            classId: 'sentinel', className: 'Sentinel', baseTree: {},
            masteries: {
              void_knight: {
                masteryId: 'void_knight', masteryName: 'Void Knight',
                nodes: { root: gn('root', [], 1), mid: gn('mid', ['root'], 3), target: gn('target', ['mid'], 5) },
              },
            },
            skills: [], skillTrees: {},
          },
        },
      } as unknown as GameData,
    })
    useOptimizationStore.setState({
      suggestions: [{
        rank: 1,
        nodeChange: { fromNodeId: null, toNodeId: 'target', pointsChange: 2 },
        explanation: 'why',
        deltaDamage: 6, deltaSurvivability: 0, deltaSpeed: 0,
        baselineScore: { damage: 10, survivability: 10, speed: 10 },
        previewScore: { damage: 16, survivability: 10, speed: 10 },
      }],
      isOptimizing: false, streamError: null,
    })
    render(<SuggestionsList onRetry={vi.fn()} />)
    // composite: base round(30/3)=10, preview round(36/3)=12 → +2.0
    expect(screen.getByTestId('suggestion-score-delta')).toHaveTextContent('2.0')
    // point cost = |pointsChange| = 2; path cost = interior 'mid' (3) between target and allocated root.
    expect(screen.getByTestId('suggestion-cost')).toHaveTextContent('2 pts / 3 pts to reach')
  })
})
