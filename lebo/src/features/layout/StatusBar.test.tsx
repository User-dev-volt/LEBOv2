import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { StatusBar } from './StatusBar'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import type { BuildState } from '../../shared/types/build'

const initialAppState = useAppStore.getState()
const initialBuildState = useBuildStore.getState()
const initialGameDataState = useGameDataStore.getState()

function makeBuild(isPersisted: boolean): BuildState {
  return {
    schemaVersion: 2,
    sliderPosition: 50,
    fineTuneWeights: null,
    id: 'test-build',
    name: 'Test Build',
    classId: 'sentinel',
    masteryId: 'paladin',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    isPersisted,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('StatusBar', () => {
  beforeEach(() => {
    useAppStore.setState(initialAppState, true)
    useBuildStore.setState(initialBuildState, true)
    useGameDataStore.setState(initialGameDataState, true)
  })

  // ── Data segment ──────────────────────────────────────────────────────────

  it('hides the data segment when no version is set', () => {
    render(<StatusBar />)
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent('Data:')
  })

  it('shows the data version and date when both are set', () => {
    useGameDataStore.getState().setDataVersion('Season 4 (Shattered Omens)')
    useGameDataStore.getState().setDataUpdatedAt('2026-03-26T00:00:00Z')
    render(<StatusBar />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Data: Season 4 (Shattered Omens) — 2026-03-26'
    )
  })

  it('shows only the version when no date is set', () => {
    useGameDataStore.getState().setDataVersion('1.4.4')
    render(<StatusBar />)
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('Data: 1.4.4')
    expect(footer).not.toHaveTextContent('—')
  })

  // ── Unsaved-state segment ─────────────────────────────────────────────────

  it('shows a gold "Unsaved changes" indicator for a dirty build', () => {
    useBuildStore.setState({ activeBuild: makeBuild(false) })
    render(<StatusBar />)
    const dirty = screen.getByText('Unsaved changes')
    expect(dirty).toBeInTheDocument()
    expect(dirty.style.color).toBe('var(--color-accent-gold)')
  })

  it('shows "All changes saved" for a persisted build', () => {
    useBuildStore.setState({ activeBuild: makeBuild(true) })
    render(<StatusBar />)
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('shows neither saved nor unsaved when there is no active build', () => {
    render(<StatusBar />)
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/All changes saved/)).not.toBeInTheDocument()
  })

  // ── LLM provider segment ──────────────────────────────────────────────────

  it('shows Claude with its fixed model name', () => {
    useAppStore.getState().setLlmProvider('claude')
    render(<StatusBar />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('LLM: Claude · claude-sonnet-4-6')
  })

  it('shows OpenRouter with the honest "free rotation" label', () => {
    useAppStore.getState().setLlmProvider('openrouter')
    render(<StatusBar />)
    expect(screen.getByRole('contentinfo')).toHaveTextContent('LLM: OpenRouter · free rotation')
  })

  it('hides the LLM segment before a provider is resolved', () => {
    render(<StatusBar />)
    expect(screen.getByRole('contentinfo')).not.toHaveTextContent('LLM:')
  })

  // ── Connectivity announcement (sr-only) ───────────────────────────────────

  it('announces connectivity via an sr-only live region that flips with online state', () => {
    render(<StatusBar />)
    const region = screen.getByRole('contentinfo').querySelector('[aria-live="polite"]')
    expect(region).toHaveClass('sr-only')
    expect(region).toHaveTextContent('Offline')

    act(() => {
      useAppStore.getState().setOnline(true)
    })

    expect(
      screen.getByRole('contentinfo').querySelector('[aria-live="polite"]')
    ).toHaveTextContent('Online')
  })

  // ── Accessibility ─────────────────────────────────────────────────────────

  it('has no accessibility violations with all segments populated', async () => {
    useGameDataStore.getState().setDataVersion('Season 4 (Shattered Omens)')
    useGameDataStore.getState().setDataUpdatedAt('2026-03-26T00:00:00Z')
    useBuildStore.setState({ activeBuild: makeBuild(false) })
    useAppStore.getState().setLlmProvider('claude')
    const { container } = render(<StatusBar />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
