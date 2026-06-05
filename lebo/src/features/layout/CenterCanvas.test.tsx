import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { useAppStore, type CenterTab } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { BuildState } from '../../shared/types/build'
import { CenterCanvas } from './CenterCanvas'

vi.mock('../skill-tree/SkillTreeView', () => ({
  SkillTreeView: () => <div data-testid="skill-tree-view" />,
}))
vi.mock('./tabs/GearTab', () => ({ GearTab: () => <div data-testid="gear-tab" /> }))
vi.mock('./tabs/SkillTab', () => ({ SkillTab: () => <div data-testid="skill-tab" /> }))
vi.mock('./tabs/IdolTab', () => ({ IdolTab: () => <div data-testid="idol-tab" /> }))
vi.mock('./tabs/BlessingTab', () => ({ BlessingTab: () => <div data-testid="blessing-tab" /> }))
vi.mock('../game-data/DataStalenessBar', () => ({ DataStalenessBar: () => null }))

function makeBuild(overrides: Partial<BuildState> = {}): BuildState {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    schemaVersion: 2,
    id: 'b1',
    name: 'My Build',
    classId: 'acolyte',
    masteryId: 'necromancer',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    idolGrid: [],
    blessings: {},
    activeConditions: [],
    skillRoles: {},
    sliderPosition: 50,
    fineTuneWeights: null,
    isPersisted: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function treeContainer(): HTMLElement {
  // The always-mounted SkillTreeView is wrapped in a div whose display is toggled.
  return screen.getByTestId('skill-tree-view').parentElement as HTMLElement
}

describe('CenterCanvas', () => {
  const appInitial = useAppStore.getState()
  const buildInitial = useBuildStore.getState()

  beforeEach(() => {
    useAppStore.setState({ ...appInitial }, true)
    useAppStore.setState({ centerTab: 'tree' })
    useBuildStore.setState({ ...buildInitial, activeBuild: makeBuild() })
    vi.clearAllMocks()
  })

  it('renders the six tabs in order with the divider between Weaver and Gear', () => {
    render(<CenterCanvas />)
    const labels = ['Passive Tree', 'Weaver', 'Gear', 'Skills', 'Idols', 'Blessings']
    const buttons = screen.getAllByRole('button')
    const tabButtons = buttons.filter((b) => labels.some((l) => b.textContent?.startsWith(l)))
    expect(tabButtons.map((b) => labels.find((l) => b.textContent?.startsWith(l)))).toEqual(labels)

    // The 1px divider sits as the first child of the Gear tab wrapper, before its button.
    const gearButton = screen.getByText('Gear').closest('button') as HTMLElement
    const wrapper = gearButton.parentElement as HTMLElement
    expect(wrapper.firstElementChild).not.toBe(gearButton)
    expect(wrapper.firstElementChild?.tagName).toBe('DIV')
    // No divider before Weaver.
    const weaverButton = screen.getByText('Weaver').closest('button') as HTMLElement
    const weaverWrapper = weaverButton.parentElement as HTMLElement
    expect(weaverWrapper.firstElementChild).toBe(weaverButton)
  })

  it('shows the Weaver badge = Σ weaverAllocations', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ weaverAllocations: { a: 2, b: 1 } }) })
    render(<CenterCanvas />)
    const weaverButton = screen.getByText('Weaver').closest('button') as HTMLElement
    expect(within(weaverButton).getByText('3')).toBeInTheDocument()
  })

  it('shows a 0 Weaver badge when there is no active build', () => {
    useBuildStore.setState({ activeBuild: null })
    render(<CenterCanvas />)
    const weaverButton = screen.getByText('Weaver').closest('button') as HTMLElement
    expect(within(weaverButton).getByText('0')).toBeInTheDocument()
  })

  it('clicking each tab sets centerTab to the matching id', () => {
    render(<CenterCanvas />)
    const cases: [string, CenterTab][] = [
      ['Weaver', 'weaver'],
      ['Gear', 'gear'],
      ['Skills', 'skill'],
      ['Idols', 'idol'],
      ['Blessings', 'blessing'],
      ['Passive Tree', 'tree'],
    ]
    for (const [label, id] of cases) {
      fireEvent.click(screen.getByText(label).closest('button') as HTMLElement)
      expect(useAppStore.getState().centerTab).toBe(id)
    }
  })

  it('keeps SkillTreeView shown and renders no context tab when centerTab is weaver', () => {
    useAppStore.setState({ centerTab: 'weaver' })
    render(<CenterCanvas />)
    expect(treeContainer().style.display).toBe('block')
    expect(screen.queryByTestId('gear-tab')).toBeNull()
    expect(screen.queryByTestId('skill-tab')).toBeNull()
    expect(screen.queryByTestId('idol-tab')).toBeNull()
    expect(screen.queryByTestId('blessing-tab')).toBeNull()
  })

  it('renders the Gear tab and hides SkillTreeView when centerTab is gear', () => {
    useAppStore.setState({ centerTab: 'gear' })
    render(<CenterCanvas />)
    expect(screen.getByTestId('gear-tab')).toBeInTheDocument()
    expect(treeContainer().style.display).toBe('none')
  })

  it('falls back to the tree tab when centerTab is invalid', () => {
    useAppStore.setState({ centerTab: 'bogus' as CenterTab })
    render(<CenterCanvas />)
    expect(treeContainer().style.display).toBe('block')
    expect(screen.queryByTestId('gear-tab')).toBeNull()
    const passiveButton = screen.getByText('Passive Tree').closest('button') as HTMLElement
    expect(passiveButton.style.color).toBe('var(--color-accent-gold)')
  })

  it('has no axe violations', async () => {
    const { container } = render(<CenterCanvas />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
