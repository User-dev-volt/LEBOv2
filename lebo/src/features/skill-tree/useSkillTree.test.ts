import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSkillTree } from './useSkillTree'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useAppStore } from '../../shared/stores/appStore'
import type { TreeData } from '../../shared/types/treeData'

const initialState = useBuildStore.getState()

// root (maxPoints: 5, no prerequisites) → child (maxPoints: 1, requires root)
const mockTreeData: TreeData = {
  nodes: [
    { id: 'root', x: 0, y: 0, size: 'large', maxPoints: 5, connections: ['child'], state: 'available' },
    { id: 'child', x: 100, y: 0, size: 'small', maxPoints: 1, connections: ['root'], state: 'available' },
  ],
  edges: [{ fromId: 'root', toId: 'child' }],
}

describe('useSkillTree', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    useBuildStore.getState().setSelectedClass('sentinel')
    useBuildStore.getState().setSelectedMastery('void_knight')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets hoveredNodeId on handleNodeHover', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeHover('root'))
    expect(result.current.hoveredNodeId).toBe('root')
  })

  it('clears hoveredNodeId and nodeError on handleNodeHover(null)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeHover('root'))
    act(() => {
      result.current.handleNodeHover(null)
      vi.runAllTimers()
    })
    expect(result.current.hoveredNodeId).toBeNull()
    expect(result.current.nodeError).toBeNull()
  })

  it('nodeError auto-clears after 2000ms', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    // child requires root — clicking child without root allocated triggers prerequisite error
    act(() => result.current.handleNodeClick('child', 0))
    expect(result.current.nodeError).not.toBeNull()
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.nodeError).toBeNull()
  })

  it('successful left-click does not set nodeError', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    expect(result.current.nodeError).toBeNull()
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('successive left-clicks add multiple points up to maxPoints', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('root', 0))
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(3)
  })

  it('right-click removes one point', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('root', 2))
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(1)
  })

  it('right-click on zero-point node does not set error', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 2))
    expect(result.current.nodeError).toBeNull()
  })

  it('handleKeyboardNavigate sets keyboardFocusedNodeId and keyboardPosition', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleKeyboardNavigate('root', 120, 240))
    expect(result.current.keyboardFocusedNodeId).toBe('root')
    expect(result.current.keyboardPosition).toEqual({ x: 120, y: 240 })
  })

  it('handleKeyboardNavigate(null) clears keyboardFocusedNodeId', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleKeyboardNavigate('root', 120, 240))
    act(() => result.current.handleKeyboardNavigate(null, 0, 0))
    expect(result.current.keyboardFocusedNodeId).toBeNull()
  })

  it('does nothing when treeData is null', () => {
    const { result } = renderHook(() => useSkillTree(null))
    act(() => result.current.handleNodeClick('root', 0))
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  // ── Review-finding fixes ────────────────────────────────────────────────

  it('handleNodeSelect sets selectedNodeId in appStore', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeSelect('root'))
    expect(useAppStore.getState().selectedNodeId).toBe('root')
  })

  it('handleNodeSelect does NOT allocate the node', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeSelect('root'))
    expect(useBuildStore.getState().activeBuild?.nodeAllocations['root']).toBeUndefined()
  })

  it('handleNodeContextMenu sets contextMenu state with nodeId and position', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeContextMenu('root', 200, 300))
    expect(result.current.contextMenu).toEqual({ nodeId: 'root', x: 200, y: 300 })
  })

  it('handleContextMenuClose clears contextMenu', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeContextMenu('root', 200, 300))
    act(() => result.current.handleContextMenuClose())
    expect(result.current.contextMenu).toBeNull()
  })

  it('handlePointerMove updates mousePosition without React event', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handlePointerMove(150, 250))
    expect(result.current.mousePosition).toEqual({ x: 150, y: 250 })
  })

  it('flashNodeIds is null initially', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    expect(result.current.flashNodeIds).toBeNull()
  })

  it('flashNodeIds is set to [nodeId] on blocked left-click (prerequisite not met)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    // child requires root — clicking child without root allocated triggers prerequisite block
    act(() => result.current.handleNodeClick('child', 0))
    expect(result.current.flashNodeIds).toEqual(['child'])
  })

  it('flashNodeIds creates a new array on each blocked click (re-trigger on same node)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('child', 0))
    const first = result.current.flashNodeIds
    act(() => result.current.handleNodeClick('child', 0))
    const second = result.current.flashNodeIds
    expect(first).not.toBe(second)
    expect(second).toEqual(['child'])
  })

  it('flashNodeIds is set to dependent nodeIds on blocked right-click decrement', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    // Allocate root and child, then try to remove root (blocked by child dependency)
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('child', 0))
    act(() => result.current.handleNodeClick('root', 2))
    expect(result.current.flashNodeIds).toEqual(['child'])
  })

  it('flashNodeIds is null on successful click', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    expect(result.current.flashNodeIds).toBeNull()
  })

  // ── Story 3.4: shift+click fill-to-max routing (FR-44) ──────────────────

  it('shift+left-click on the passive tree fills the node to max in one action (AC1)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0, true))
    // root.maxPoints = 5; unenforced auto-created build → fills to 5 in a single action
    // (contrast the successive-single-click test above: 3 clicks → 3).
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(5)
    expect(useBuildStore.getState().undoStack).toHaveLength(1)
  })

  it('shift+left-click on a skill slot does NOT bulk-fill — passive-only guard (AC1)', () => {
    // applySkillNodeChange does not auto-create a build, so seed one first.
    useBuildStore.getState().createBuild('Test Build')
    const { result } = renderHook(() => useSkillTree(mockTreeData, 'slot-0'))
    act(() => result.current.handleNodeClick('root', 0, true))
    const build = useBuildStore.getState().activeBuild!
    // slotId defined → single +1 via applySkillNodeChange, NOT a bulk fill to 5.
    expect(build.skillNodeAllocations['slot-0']?.['root']).toBe(1)
    // Passive tree is untouched.
    expect(build.nodeAllocations['root']).toBeUndefined()
  })

  it('shift+left-click is budget-limited through the hook on an enforced build (AC2)', () => {
    // Enforced build, level 6 (budget 4), root pre-filled to 2 → only 2 budget points unspent.
    useBuildStore.getState().createBuild('Test Build')
    useBuildStore.getState().setCharacterLevel(6)
    useBuildStore.getState().setBudgetEnforced(true)
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('root', 0))
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(2)
    // Shift+click fills only the 2 remaining budget points, not all 3 of node space → 4.
    act(() => result.current.handleNodeClick('root', 0, true))
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBe(4)
  })

  // ── Story 3.5: shift+right-click remove-all + orphan cascade (FR-45) ──────

  it('shift+right-click on a passive leaf removes it directly — no orphans, no confirm (AC1)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('child', 0))
    act(() => result.current.handleNodeClick('child', 2, true))
    const alloc = useBuildStore.getState().activeBuild!.nodeAllocations
    expect(alloc['child']).toBeUndefined()
    expect(alloc['root']).toBe(1)
    expect(result.current.pendingRemoval).toBeNull()
  })

  it('shift+right-click on a passive node with dependents sets pendingRemoval, removes nothing yet (AC2)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('child', 0))
    act(() => result.current.handleNodeClick('root', 2, true))
    expect(result.current.pendingRemoval).toEqual({ nodeId: 'root', orphanIds: ['child'] })
    const alloc = useBuildStore.getState().activeBuild!.nodeAllocations
    expect(alloc['root']).toBe(1)
    expect(alloc['child']).toBe(1)
  })

  it('confirmRemoval executes the cascade then clears pendingRemoval (AC2/AC4)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('child', 0))
    act(() => result.current.handleNodeClick('root', 2, true))
    act(() => result.current.confirmRemoval())
    expect(useBuildStore.getState().activeBuild!.nodeAllocations).toEqual({})
    expect(result.current.pendingRemoval).toBeNull()
  })

  it('cancelRemoval clears pendingRemoval and removes nothing (AC2)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('child', 0))
    act(() => result.current.handleNodeClick('root', 2, true))
    act(() => result.current.cancelRemoval())
    expect(result.current.pendingRemoval).toBeNull()
    expect(useBuildStore.getState().activeBuild!.nodeAllocations).toEqual({ root: 1, child: 1 })
  })

  it('shift+right-click on an unallocated passive node is a no-op (AC6)', () => {
    const { result } = renderHook(() => useSkillTree(mockTreeData))
    act(() => result.current.handleNodeClick('root', 2, true))
    expect(result.current.pendingRemoval).toBeNull()
    expect(useBuildStore.getState().activeBuild).toBeNull()
  })

  it('shift+right-click on a skill slot falls through to single decrement — passive-only guard (AC5)', () => {
    useBuildStore.getState().createBuild('Test Build')
    const { result } = renderHook(() => useSkillTree(mockTreeData, 'slot-0'))
    act(() => result.current.handleNodeClick('root', 0))
    act(() => result.current.handleNodeClick('root', 0))
    expect(useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']?.['root']).toBe(2)
    act(() => result.current.handleNodeClick('root', 2, true))
    // slotId defined → shift+right is ignored by the passive guard; single applySkillNodeChange(-1) runs.
    expect(useBuildStore.getState().activeBuild!.skillNodeAllocations['slot-0']?.['root']).toBe(1)
    expect(result.current.pendingRemoval).toBeNull()
    expect(useBuildStore.getState().activeBuild!.nodeAllocations['root']).toBeUndefined()
  })
})
