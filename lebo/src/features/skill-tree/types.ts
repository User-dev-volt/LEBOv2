import type { Texture } from 'pixi.js'
import type { TreeData, HighlightedNodes, TreeNode } from '../../shared/types/treeData'
import type { NodeEfficiency } from '../../shared/types/statSheet'

export type { NodeSize, NodeState, HighlightedNodes, TreeNode, TreeEdge, TreeData } from '../../shared/types/treeData'

export interface RendererCallbacks {
  onNodeClick: (nodeId: string, button: 0 | 2) => void
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
    showOverlay?: boolean
  ): void
  resize(w: number, h: number): void
  destroy(): void
  getViewport(): { x: number; y: number; scale: number }
  addTickerListener(fn: () => void): () => void
  setReducedMotion(enabled: boolean): void
  triggerFlash(nodeIds: string[]): void
  fitToTree(nodes: TreeNode[]): void
  zoomIn(): void
  zoomOut(): void
}

export interface SkillTreeCanvasHandle {
  fitToTree(): void
  zoomIn(): void
  zoomOut(): void
}

export interface SkillTreeCanvasProps {
  treeData: TreeData
  treeLayout?: 'standard' | 'weaver'
  nodeAllocations: Record<string, number>
  highlightedNodes: HighlightedNodes
  iconTextures: Map<string, Texture>
  selectedNodeId?: string | null
  onNodeClick: (nodeId: string, button: 0 | 2) => void
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
