export type NodeSize = 'small' | 'medium' | 'large'
export type NodeState = 'allocated' | 'available' | 'locked' | 'suggested'

export interface HighlightedNodes {
  glowing: Set<string>
  dimmed: Set<string>
  previewRemoved: Set<string>
  previewAdded: Set<string>
  searchHighlighted: Set<string>
  searchDimmed: Set<string>
}

export interface TreeNode {
  id: string
  x: number
  y: number
  size: NodeSize
  maxPoints: number
  connections: string[]
  state: NodeState
}

export interface TreeEdge {
  fromId: string
  toId: string
}

export interface TreeData {
  nodes: TreeNode[]
  edges: TreeEdge[]
}
