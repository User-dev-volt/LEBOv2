import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { useAppStore } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import type { BuildState, GearItemV2, ActiveSkill, PlacedIdol } from '../../shared/types/build'
import type { GameData } from '../../shared/types/gameData'
import { LeftPanel } from './LeftPanel'
import { ClassGlyph } from './ClassGlyph'

vi.mock('../../shared/utils/invokeCommand', () => ({
  invokeCommand: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../shared/components/Toast', () => ({
  showInfoToast: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}))

import { showInfoToast } from '../../shared/components/Toast'

const GAME_DATA: GameData = {
  manifest: {
    schemaVersion: 1,
    gameVersion: '1.0',
    dataVersion: '1.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    classes: ['acolyte'],
  },
  classes: {
    acolyte: {
      classId: 'acolyte',
      className: 'Acolyte',
      baseTree: {},
      masteries: {
        necromancer: { masteryId: 'necromancer', masteryName: 'Necromancer', nodes: {} },
      },
      skills: [],
      skillTrees: {},
    },
  },
}

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

function gear(name: string): GearItemV2 {
  return { slotId: name, itemName: name, affixes: [] }
}

function skill(name: string): ActiveSkill {
  return { slotId: name, skillName: name, skillId: name }
}

function idol(id: string): PlacedIdol {
  return { id, row: 0, col: 0, idolTypeId: 'minor-1x1' }
}

describe('LeftPanel', () => {
  const appInitial = useAppStore.getState()
  const buildInitial = useBuildStore.getState()
  const gameInitial = useGameDataStore.getState()

  beforeEach(() => {
    useAppStore.setState({ ...appInitial }, true)
    useAppStore.setState({ activePanel: { left: 'expanded', right: 'expanded' }, centerTab: 'tree' })
    useGameDataStore.setState({ ...gameInitial, gameData: GAME_DATA })
    useBuildStore.setState({
      ...buildInitial,
      selectedClassId: 'acolyte',
      selectedMasteryId: 'necromancer',
      activeBuild: makeBuild(),
      savedBuilds: [],
    })
    vi.clearAllMocks()
  })

  // ── AC1: Active Build card identity ──────────────────────────────────────

  it('renders the build name and class · mastery display-name subtitle', () => {
    render(<LeftPanel />)
    expect(screen.getByText('My Build')).toBeInTheDocument()
    expect(screen.getByText('Acolyte · Necromancer')).toBeInTheDocument()
  })

  it('renders a class glyph (svg) inside the active build card', () => {
    const { container } = render(<LeftPanel />)
    // The card precedes the navigator; assert at least one inline svg renders for the glyph.
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  // ── AC3: navigator rows + fill counts + click ────────────────────────────

  it('renders all 6 navigator rows with their fill counts', () => {
    render(<LeftPanel />)
    const nav = screen.getByText('Build Sections').parentElement as HTMLElement
    expect(within(nav).getByText('Passive Tree')).toBeInTheDocument()
    expect(within(nav).getByText('Weaver')).toBeInTheDocument()
    expect(within(nav).getByText('Gear')).toBeInTheDocument()
    expect(within(nav).getByText('Active Skills')).toBeInTheDocument()
    expect(within(nav).getByText('Idols')).toBeInTheDocument()
    expect(within(nav).getByText('Blessings')).toBeInTheDocument()
    // Passive Tree and Weaver both read "0 pts" with no allocations.
    expect(within(nav).getAllByText('0 pts')).toHaveLength(2)
    expect(within(nav).getByText('0/11')).toBeInTheDocument()
    expect(within(nav).getByText('0 placed')).toBeInTheDocument()
  })

  it('clicking a navigator row sets centerTab', () => {
    render(<LeftPanel />)
    fireEvent.click(screen.getByText('Gear'))
    expect(useAppStore.getState().centerTab).toBe('gear')
  })

  it('renders the Weaver row and routes to the weaver tab', () => {
    render(<LeftPanel />)
    fireEvent.click(screen.getByText('Weaver'))
    expect(useAppStore.getState().centerTab).toBe('weaver')
  })

  it('marks the active navigator row with aria-current', () => {
    useAppStore.setState({ centerTab: 'idol' })
    render(<LeftPanel />)
    const idolRow = screen.getByText('Idols').closest('button') as HTMLElement
    expect(idolRow).toHaveAttribute('aria-current', 'true')
    const gearRow = screen.getByText('Gear').closest('button') as HTMLElement
    expect(gearRow).not.toHaveAttribute('aria-current')
  })

  // ── AC4: gate-threshold checkmarks ───────────────────────────────────────

  it('shows a checkmark on Gear when all 11 slots are filled', () => {
    const filledGear = Array.from({ length: 11 }, (_, i) => gear(`g${i}`))
    useBuildStore.setState({ activeBuild: makeBuild({ contextData: { gear: filledGear, skills: [], idols: [] } }) })
    render(<LeftPanel />)
    const gearRow = screen.getByText('Gear').closest('button') as HTMLElement
    expect(within(gearRow).getByText('11/11')).toBeInTheDocument()
    expect(gearRow.querySelector('svg')).toBeInTheDocument()
  })

  it('Active Skills shows no checkmark with 1 slot but a checkmark at 2', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ contextData: { gear: [], skills: [skill('a')], idols: [] } }) })
    const { rerender } = render(<LeftPanel />)
    const oneRow = screen.getByText('Active Skills').closest('button') as HTMLElement
    expect(within(oneRow).getByText('1/5')).toBeInTheDocument()
    expect(oneRow.querySelector('svg')).toBeNull()

    useBuildStore.setState({ activeBuild: makeBuild({ contextData: { gear: [], skills: [skill('a'), skill('b')], idols: [] } }) })
    rerender(<LeftPanel />)
    const twoRow = screen.getByText('Active Skills').closest('button') as HTMLElement
    expect(within(twoRow).getByText('2/5')).toBeInTheDocument()
    expect(twoRow.querySelector('svg')).toBeInTheDocument()
  })

  it('excludes empty (blank-name) gear and skill slots from the fill count', () => {
    useBuildStore.setState({
      activeBuild: makeBuild({
        contextData: { gear: [gear('helm'), gear(''), gear('   ')], skills: [skill('a'), skill('')], idols: [] },
      }),
    })
    render(<LeftPanel />)
    const gearRow = screen.getByText('Gear').closest('button') as HTMLElement
    expect(within(gearRow).getByText('1/11')).toBeInTheDocument()
    const skillRow = screen.getByText('Active Skills').closest('button') as HTMLElement
    expect(within(skillRow).getByText('1/5')).toBeInTheDocument()
    // Below their gate thresholds → no checkmark.
    expect(gearRow.querySelector('svg')).toBeNull()
    expect(skillRow.querySelector('svg')).toBeNull()
  })

  it('shows a checkmark on Passive Tree once at least 1 passive point is allocated', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ nodeAllocations: { n1: 1 } }) })
    render(<LeftPanel />)
    const treeRow = screen.getByText('Passive Tree').closest('button') as HTMLElement
    expect(within(treeRow).getByText('1 pts')).toBeInTheDocument()
    expect(treeRow.querySelector('svg')).toBeInTheDocument()
  })

  it('shows a checkmark on Idols once at least 1 idol is placed', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ idolGrid: [idol('i1')] }) })
    render(<LeftPanel />)
    const idolRow = screen.getByText('Idols').closest('button') as HTMLElement
    expect(within(idolRow).getByText('1 placed')).toBeInTheDocument()
    expect(idolRow.querySelector('svg')).toBeInTheDocument()
  })

  it('shows a checkmark on Blessings once at least 1 non-null blessing is set, ignoring null slots', () => {
    useBuildStore.setState({ activeBuild: makeBuild({ blessings: { s1: 'b1', s2: null } }) })
    render(<LeftPanel />)
    const blessingRow = screen.getByText('Blessings').closest('button') as HTMLElement
    expect(within(blessingRow).getByText('1/5')).toBeInTheDocument()
    expect(blessingRow.querySelector('svg')).toBeInTheDocument()
  })

  // ── AC5: Import Character button ─────────────────────────────────────────

  it('renders an enabled Import Character button (no Paste build code input)', () => {
    render(<LeftPanel />)
    const btn = screen.getByTestId('import-character-button')
    expect(btn).toBeInTheDocument()
    expect(btn).toBeEnabled()
    expect(screen.queryByPlaceholderText(/paste build code/i)).toBeNull()
  })

  it('clicking Import Character fires the coming-soon toast without mutating build/view/tab', () => {
    render(<LeftPanel />)
    fireEvent.click(screen.getByTestId('import-character-button'))
    expect(showInfoToast).toHaveBeenCalledWith('Character import is coming soon.')
    expect(useAppStore.getState().centerTab).toBe('tree')
    expect(useAppStore.getState().currentView).toBe('main')
    expect(useBuildStore.getState().activeBuild?.id).toBe('b1')
  })

  // ── AC6: Save button + accessibility ─────────────────────────────────────

  it('Save button reads "Save Build" (gold) when not persisted and "Saved" when persisted', () => {
    const { rerender } = render(<LeftPanel />)
    expect(screen.getByText('Save Build')).toBeInTheDocument()

    useBuildStore.setState({ activeBuild: makeBuild({ isPersisted: true }) })
    rerender(<LeftPanel />)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('has no axe violations', async () => {
    const { container } = render(<LeftPanel />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ClassGlyph', () => {
  const CLASS_IDS = ['acolyte', 'mage', 'primalist', 'rogue', 'sentinel'] as const

  function glyphPaths(classId: string): string[] {
    const { container } = render(<ClassGlyph classId={classId} />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg).toBeInTheDocument()
    return Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '')
  }

  it('renders a distinct, decorative glyph for every base class', () => {
    const signatures = new Set<string>()
    for (const id of CLASS_IDS) {
      const { container, unmount } = render(<ClassGlyph classId={id} />)
      const svg = container.querySelector('svg') as SVGElement
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      signatures.add(svg.innerHTML)
      unmount()
    }
    // Each class must produce a unique motif — no copy-paste duplication.
    expect(signatures.size).toBe(CLASS_IDS.length)
  })

  it('renders the generic circle fallback for an unknown classId', () => {
    const { container } = render(<ClassGlyph classId="unknown-class" />)
    const svg = container.querySelector('svg') as SVGElement
    expect(svg).toBeInTheDocument()
    expect(svg.querySelector('circle')).toBeInTheDocument()
    expect(svg.querySelector('path')).toBeNull()
  })

  it('does not reuse a class motif for the fallback', () => {
    const fallback = glyphPaths('unknown-class')
    expect(fallback).toEqual([]) // fallback is a lone <circle>, no paths
    for (const id of CLASS_IDS) {
      expect(glyphPaths(id).length).toBeGreaterThan(0)
    }
  })
})
