import { useState, useEffect, useCallback, useRef } from 'react'
import type { TreeData } from '../../shared/types/treeData'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useAppStore } from '../../shared/stores/appStore'
import { computeOrphanedNodes } from './computeOrphanedNodes'

const ERROR_DISPLAY_MS = 2000

export interface SkillTreeInteraction {
  hoveredNodeId: string | null
  mousePosition: { x: number; y: number }
  nodeError: { nodeId: string; message: string } | null
  setNodeError: (err: { nodeId: string; message: string } | null) => void
  keyboardFocusedNodeId: string | null
  keyboardPosition: { x: number; y: number }
  flashNodeIds: string[] | null
  contextMenu: { nodeId: string; x: number; y: number } | null
  // Story 3.5: shift+right-click remove-all cascade. When removal would orphan other allocated nodes,
  // pendingRemoval holds the target + orphan ids so SkillTreeView can name them in a confirm dialog.
  pendingRemoval: { nodeId: string; orphanIds: string[] } | null
  confirmRemoval: () => void
  cancelRemoval: () => void
  handleNodeClick: (nodeId: string, button: 0 | 2, shiftKey?: boolean) => void
  handleNodeSelect: (nodeId: string) => void
  handleNodeHover: (nodeId: string | null) => void
  handleNodeContextMenu: (nodeId: string, x: number, y: number) => void
  handleContextMenuClose: () => void
  handleMouseMove: (e: React.MouseEvent) => void
  handlePointerMove: (x: number, y: number) => void
  handleKeyboardNavigate: (nodeId: string | null, screenX: number, screenY: number) => void
  handleTooltipEnter: () => void
  handleTooltipLeave: () => void
}

export function useSkillTree(treeData: TreeData | null, slotId?: string): SkillTreeInteraction {
  const applyNodeChange = useBuildStore((s) => s.applyNodeChange)
  const applySkillNodeChange = useBuildStore((s) => s.applySkillNodeChange)
  const fillNodeToMax = useBuildStore((s) => s.fillNodeToMax)
  const removeAllPoints = useBuildStore((s) => s.removeAllPoints)
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId)

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [nodeError, setNodeError] = useState<{ nodeId: string; message: string } | null>(null)
  const [keyboardFocusedNodeId, setKeyboardFocusedNodeId] = useState<string | null>(null)
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 })
  const [flashNodeIds, setFlashNodeIds] = useState<string[] | null>(null)
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<{ nodeId: string; orphanIds: string[] } | null>(null)

  const clearHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!nodeError) return
    const t = setTimeout(() => setNodeError(null), ERROR_DISPLAY_MS)
    return () => clearTimeout(t)
  }, [nodeError])

  // Cleanup hover timer on unmount
  useEffect(() => {
    return () => {
      if (clearHoverTimerRef.current !== null) clearTimeout(clearHoverTimerRef.current)
    }
  }, [])

  // Allocate/deallocate — called from double-click or keyboard Enter/Space or context menu
  const handleNodeClick = useCallback(
    (nodeId: string, button: 0 | 2, shiftKey?: boolean) => {
      if (!treeData) return

      // Shift+left-click on passive tree: allocate as many points as budget allows
      if (button === 0 && shiftKey && slotId === undefined) {
        const result = fillNodeToMax(nodeId, treeData)
        if (!result.success && result.error) {
          setNodeError({ nodeId, message: result.error })
          setFlashNodeIds([nodeId])
        }
        return
      }

      // Shift+right-click on passive tree: remove all points + orphan cascade (3.5, mirror shift+left).
      // Read allocations imperatively — this hook must NOT subscribe to allocations (that would re-render
      // the tree on every point change). Plain right-click (shiftKey falsy) falls through to the decrement.
      if (button === 2 && shiftKey && slotId === undefined) {
        const nodeAllocations = useBuildStore.getState().activeBuild?.nodeAllocations ?? {}
        if ((nodeAllocations[nodeId] ?? 0) <= 0) return // nothing to remove (AC6)
        const orphans = computeOrphanedNodes(nodeId, nodeAllocations, treeData)
        if (orphans.length === 0) removeAllPoints(nodeId, treeData) // AC1: no confirmation
        else setPendingRemoval({ nodeId, orphanIds: orphans }) // AC2: confirm names orphans
        return
      }

      const delta: 1 | -1 = button === 2 ? -1 : 1
      const result =
        slotId !== undefined
          ? applySkillNodeChange(slotId, nodeId, delta, treeData)
          : applyNodeChange(nodeId, delta, treeData)
      if (!result.success && result.error) {
        setNodeError({ nodeId, message: result.error })
        if (button === 2 && result.blockedByDependents && result.blockedByDependents.length > 0) {
          setFlashNodeIds([...result.blockedByDependents])
        } else {
          setFlashNodeIds([nodeId])
        }
      }
    },
    [treeData, slotId, applyNodeChange, applySkillNodeChange, fillNodeToMax, removeAllPoints]
  )

  // Single-click — selects a node (visual ring + store update), does not allocate
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
    },
    [setSelectedNodeId]
  )

  const handleNodeHover = useCallback((nodeId: string | null) => {
    if (nodeId !== null) {
      // Node entered: cancel any pending clear, show tooltip immediately
      if (clearHoverTimerRef.current !== null) {
        clearTimeout(clearHoverTimerRef.current)
        clearHoverTimerRef.current = null
      }
      setHoveredNodeId(nodeId)
    } else {
      // Node left: delay clear so mouse can travel to tooltip without it disappearing
      clearHoverTimerRef.current = setTimeout(() => {
        setHoveredNodeId(null)
        setNodeError(null)
        clearHoverTimerRef.current = null
      }, 50)
    }
  }, [])

  const handleTooltipEnter = useCallback(() => {
    // Mouse entered the tooltip — cancel the pending clear
    if (clearHoverTimerRef.current !== null) {
      clearTimeout(clearHoverTimerRef.current)
      clearHoverTimerRef.current = null
    }
  }, [])

  const handleTooltipLeave = useCallback(() => {
    // Mouse left the tooltip — clear hover immediately
    setHoveredNodeId(null)
    setNodeError(null)
  }, [])

  // Right-click — open context menu positioned at screen coords
  const handleNodeContextMenu = useCallback((nodeId: string, x: number, y: number) => {
    setContextMenu({ nodeId, x, y })
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Story 3.5: AC2 confirm/cancel for the shift+right-click orphan cascade. removeAllPoints recomputes
  // the cascade from live store state at confirm time (the modal blocks intervening edits).
  const confirmRemoval = useCallback(() => {
    if (!treeData || !pendingRemoval) return
    removeAllPoints(pendingRemoval.nodeId, treeData)
    setPendingRemoval(null)
  }, [treeData, pendingRemoval, removeAllPoints])

  const cancelRemoval = useCallback(() => setPendingRemoval(null), [])

  // Legacy: React synthetic event (kept for backward compat with existing tests)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY })
  }, [])

  // Native pointermove from SkillTreeCanvas — fires at PixiJS frame rate, no React batching lag
  const handlePointerMove = useCallback((x: number, y: number) => {
    setMousePosition({ x, y })
  }, [])

  const handleKeyboardNavigate = useCallback(
    (nodeId: string | null, screenX: number, screenY: number) => {
      setKeyboardFocusedNodeId(nodeId)
      if (nodeId !== null) setKeyboardPosition({ x: screenX, y: screenY })
    },
    []
  )

  return {
    hoveredNodeId,
    mousePosition,
    nodeError,
    setNodeError,
    keyboardFocusedNodeId,
    keyboardPosition,
    flashNodeIds,
    contextMenu,
    pendingRemoval,
    confirmRemoval,
    cancelRemoval,
    handleNodeClick,
    handleNodeSelect,
    handleNodeHover,
    handleNodeContextMenu,
    handleContextMenuClose,
    handleMouseMove,
    handlePointerMove,
    handleKeyboardNavigate,
    handleTooltipEnter,
    handleTooltipLeave,
  }
}
