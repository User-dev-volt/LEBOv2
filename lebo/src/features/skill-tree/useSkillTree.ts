import { useState, useEffect, useCallback } from 'react'
import type { TreeData } from '../../shared/types/treeData'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useAppStore } from '../../shared/stores/appStore'

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
  handleNodeClick: (nodeId: string, button: 0 | 2) => void
  handleNodeSelect: (nodeId: string) => void
  handleNodeHover: (nodeId: string | null) => void
  handleNodeContextMenu: (nodeId: string, x: number, y: number) => void
  handleContextMenuClose: () => void
  handleMouseMove: (e: React.MouseEvent) => void
  handlePointerMove: (x: number, y: number) => void
  handleKeyboardNavigate: (nodeId: string | null, screenX: number, screenY: number) => void
}

export function useSkillTree(treeData: TreeData | null, slotId?: string): SkillTreeInteraction {
  const applyNodeChange = useBuildStore((s) => s.applyNodeChange)
  const applySkillNodeChange = useBuildStore((s) => s.applySkillNodeChange)
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId)

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [nodeError, setNodeError] = useState<{ nodeId: string; message: string } | null>(null)
  const [keyboardFocusedNodeId, setKeyboardFocusedNodeId] = useState<string | null>(null)
  const [keyboardPosition, setKeyboardPosition] = useState({ x: 0, y: 0 })
  const [flashNodeIds, setFlashNodeIds] = useState<string[] | null>(null)
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!nodeError) return
    const t = setTimeout(() => setNodeError(null), ERROR_DISPLAY_MS)
    return () => clearTimeout(t)
  }, [nodeError])

  // Allocate/deallocate — called from double-click or keyboard Enter/Space or context menu
  const handleNodeClick = useCallback(
    (nodeId: string, button: 0 | 2) => {
      if (!treeData) return
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
    [treeData, slotId, applyNodeChange, applySkillNodeChange]
  )

  // Single-click — selects a node (visual ring + store update), does not allocate
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
    },
    [setSelectedNodeId]
  )

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId)
    if (nodeId === null) setNodeError(null)
  }, [])

  // Right-click — open context menu positioned at screen coords
  const handleNodeContextMenu = useCallback((nodeId: string, x: number, y: number) => {
    setContextMenu({ nodeId, x, y })
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null)
  }, [])

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
    handleNodeClick,
    handleNodeSelect,
    handleNodeHover,
    handleNodeContextMenu,
    handleContextMenuClose,
    handleMouseMove,
    handlePointerMove,
    handleKeyboardNavigate,
  }
}
