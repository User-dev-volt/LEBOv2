import type { Texture } from 'pixi.js'
import type { TreeData, HighlightedNodes, TreeNode } from '../../shared/types/treeData'
import type { NodeEfficiency } from '../../shared/types/statSheet'

export type { NodeSize, NodeState, HighlightedNodes, TreeNode, TreeEdge, TreeData } from '../../shared/types/treeData'

export interface RendererCallbacks {
  onNodeClick: (nodeId: string, button: 0 | 2, shiftKey?: boolean) => void
  onNodeHover: (nodeId: string | null) => void
  onNodeSelect?: (nodeId: string) => void
  onNodeContextMenu?: (nodeId: string, screenX: number, screenY: number) => void
}

export interface RendererInstance {
  renderTree(
    data: TreeData,
    nodeAllocations: Record<string, number>,
    highlightedNodes: HighlightedNodes,
    iconTextures: Map<string, Texture>,
    selectedNodeId?: string | null,
    nodeEfficiencies?: NodeEfficiency[] | null,
    showOverlay?: boolean,
    primaryDamageType?: string
  ): void
  resize(w: number, h: number): void
  destroy(): void
  getViewport(): { x: number; y: number; scale: number }
  addTickerListener(fn: () => void): () => void
  setReducedMotion(enabled: boolean): void
  triggerFlash(nodeIds: string[]): void
  fitToTree(nodes: TreeNode[]): void
  // Returns true when the node was resolved (renderer ready + sized + node in the map) and the focus
  // was applied; false when not ready yet, so the caller can retry against a freshly-mounted canvas.
  focusNode(nodeId: string): boolean
  zoomIn(): void
  zoomOut(): void
}

export interface SkillTreeCanvasHandle {
  fitToTree(): void
  // Smoothly pans/zooms the off-screen node to centre (AC3, shared with Epic 6). Generic by id so
  // the caller never touches renderer internals; reduced motion jumps instantly (see pixiRenderer).
  focusNode(nodeId: string): boolean
  getViewport(): { x: number; y: number; scale: number }
  zoomIn(): void
  zoomOut(): void
}

export interface SkillTreeCanvasProps {
  treeData: TreeData
  treeLayout?: 'standard' | 'weaver'
  primaryDamageType?: string
  nodeAllocations: Record<string, number>
  highlightedNodes: HighlightedNodes
  iconTextures: Map<string, Texture>
  selectedNodeId?: string | null
  onNodeClick: (nodeId: string, button: 0 | 2, shiftKey?: boolean) => void
  onNodeHover: (nodeId: string | null) => void
  onNodeSelect?: (nodeId: string) => void
  onNodeContextMenu?: (nodeId: string, screenX: number, screenY: number) => void
  onKeyboardNavigate: (nodeId: string | null, screenX: number, screenY: number) => void
  onPointerMove?: (x: number, y: number) => void
  flashNodeIds?: string[]
  nodeEfficiencies?: NodeEfficiency[] | null
  showOverlay?: boolean
  ref?: React.Ref<SkillTreeCanvasHandle>
}
