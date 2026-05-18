import type { ClassData, GameNode } from '../../shared/types/gameData'
import type { TreeData, TreeNode, TreeEdge } from './types'

// Vertical offset applied to mastery tree nodes so they appear below the base class tree
const MASTERY_Y_OFFSET = 1600

export function buildSkillTreeData(
  skillNodes: Record<string, GameNode>,
  allocations: Record<string, number>
): TreeData {
  const nodes: TreeNode[] = []
  const edges: TreeEdge[] = []
  appendTreeNodes(nodes, edges, skillNodes, allocations, 0)
  return { nodes, edges }
}

export function buildTreeData(
  classData: ClassData,
  masteryId: string | null,
  allocatedNodes: Record<string, number>
): TreeData {
  const nodes: TreeNode[] = []
  const edges: TreeEdge[] = []

  appendTreeNodes(nodes, edges, classData.baseTree, allocatedNodes, 0)

  if (masteryId !== null) {
    const mastery = classData.masteries[masteryId]
    if (mastery) {
      appendTreeNodes(nodes, edges, mastery.nodes, allocatedNodes, MASTERY_Y_OFFSET)
    }
  }

  return { nodes, edges }
}

function appendTreeNodes(
  nodes: TreeNode[],
  edges: TreeEdge[],
  gameNodes: Record<string, GameNode>,
  allocatedNodes: Record<string, number>,
  yOffset: number
): void {
  const connections = buildConnectionMap(gameNodes)

  for (const [nodeId, node] of Object.entries(gameNodes)) {
    nodes.push({
      id: nodeId,
      x: node.position.x,
      y: node.position.y + yOffset,
      size: node.size,
      maxPoints: node.maxPoints,
      connections: connections[nodeId] ?? [],
      state: allocatedNodes[nodeId]
        ? 'allocated'
        : node.prerequisiteNodeIds.every((id) => (allocatedNodes[id] ?? 0) > 0)
          ? 'available'
          : 'locked',
    })

    for (const prereqId of node.prerequisiteNodeIds) {
      edges.push({ fromId: prereqId, toId: nodeId })
    }
  }
}

function buildConnectionMap(gameNodes: Record<string, GameNode>): Record<string, string[]> {
  const map: Record<string, string[]> = {}

  for (const [nodeId, node] of Object.entries(gameNodes)) {
    if (!map[nodeId]) map[nodeId] = []
    for (const prereqId of node.prerequisiteNodeIds) {
      if (!map[prereqId]) map[prereqId] = []
      map[nodeId].push(prereqId)
      map[prereqId].push(nodeId)
    }
  }

  return map
}
