import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useBuildStore } from '../../shared/stores/buildStore'

// Prevent PixiJS / WebGL init — replaces the entire SkillTreeCanvas module. Captures the last-rendered
// canvas props so a test can invoke onNodeClick directly (Story 3.5 weaver-guard, row h).
const canvasSpy = vi.hoisted(() => ({ props: null as any }))
vi.mock('./SkillTreeCanvas', () => ({
  SkillTreeCanvas: (props: any) => {
    canvasSpy.props = props
    return 'SKILL_TREE_CANVAS'
  },
}))

// Prevent Tauri event listener registration
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}))

// Prevent Tauri IPC calls inside useIconTextures
vi.mock('../icon-pipeline/useIconTextures', () => ({
  useIconTextures: () => new Map(),
}))

import { SkillTreeView } from './SkillTreeView'
import type { BuildState } from '../../shared/types/build'
import type { TreeData } from '../../shared/types/treeData'

const MOCK_BUILD: BuildState = {
  id: 'build-1',
  name: 'Test Build',
  classId: 'sentinel',
  masteryId: 'void_knight',
  characterLevel: 50,
  budgetEnforced: false,
  nodeAllocations: {},
  skillNodeAllocations: {},
  activeSkillLevels: {},
  weaverAllocations: {},
  contextData: { gear: [], skills: [], idols: [] },
  isPersisted: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  schemaVersion: 1,
}

const MOCK_WEAVER_TREE: TreeData = {
  nodes: [
    { id: 'weaver-hub', x: 0, y: 0, size: 'large', maxPoints: 1, connections: [], state: 'available' },
  ],
  edges: [],
}

const WEAVER_TAB_INDEX = 6

describe('SkillTreeView — Weaver tab conditional', () => {
  const initialGameData = useGameDataStore.getState()
  const initialBuildState = useBuildStore.getState()

  beforeEach(() => {
    useGameDataStore.setState(initialGameData, true)
    useBuildStore.setState(initialBuildState, true)
    useBuildStore.getState().setActiveBuild(MOCK_BUILD)
  })

  it('renders WeaverTreePlaceholder when weaverTreeData is null', () => {
    useGameDataStore.setState({ weaverTreeData: null })
    render(<SkillTreeView />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[WEAVER_TAB_INDEX])
    expect(
      screen.getByText(
        'Weaver Tree planning is in research. Node data is not available from community sources.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('SKILL_TREE_CANVAS')).not.toBeInTheDocument()
  })

  it('renders SkillTreeCanvas instead of WeaverTreePlaceholder when weaverTreeData is non-null', () => {
    useGameDataStore.setState({ weaverTreeData: MOCK_WEAVER_TREE, weaverGameNodes: {} })
    render(<SkillTreeView />)
    const tabs = screen.getAllByRole('tab')
    fireEvent.click(tabs[WEAVER_TAB_INDEX])
    expect(screen.getByText('SKILL_TREE_CANVAS')).toBeInTheDocument()
    expect(
      screen.queryByText(
        'Weaver Tree planning is in research. Node data is not available from community sources.'
      )
    ).not.toBeInTheDocument()
  })

  it('weaver shift+right-click does NOT remove-all — single applyWeaverNodeChange(-1), passive untouched (row h)', () => {
    useBuildStore.getState().setActiveBuild({
      ...MOCK_BUILD,
      weaverAllocations: { 'weaver-hub': 1 },
      nodeAllocations: { 'passive-x': 1 },
    })
    useGameDataStore.setState({ weaverTreeData: MOCK_WEAVER_TREE, weaverGameNodes: {} })
    render(<SkillTreeView />)
    fireEvent.click(screen.getAllByRole('tab')[WEAVER_TAB_INDEX])
    // Invoke the weaver canvas onNodeClick with shift+right — the weaver handler ignores shiftKey entirely.
    act(() => canvasSpy.props.onNodeClick('weaver-hub', 2, true))
    const build = useBuildStore.getState().activeBuild!
    // A single decrement cleared the weaver point; NOT a remove-all cascade.
    expect(build.weaverAllocations['weaver-hub']).toBeUndefined()
    // Passive tree is completely untouched — removeAllPoints (passive-only) never ran.
    expect(build.nodeAllocations['passive-x']).toBe(1)
  })
})
