import type { TreeData, TreeNode } from './types'

// Frontend-derived path from a suggested node to the nearest allocated node, traced over the tree's
// bidirectional `connections` graph. WHY frontend-derived: the engine's NodeEfficiency overlay feed
// carries no route field and the knapsack route never reaches the canvas (Story 3.2 Source Audit),
// so AC2's dashed path line must be computed here from treeData.
//
// Returns null when a direct prerequisite is already allocated (the node is immediately allocatable,
// so no path line is needed) or when no allocated node is reachable.
export function nearestAllocatedPath(
  treeData: TreeData,
  nodeAllocations: Record<string, number>,
  startNodeId: string
): string[] | null {
  const nodeMap = new Map<string, TreeNode>(treeData.nodes.map((n) => [n.id, n]))
  const start = nodeMap.get(startNodeId)
  if (!start) return null

  const isAllocated = (id: string): boolean => (nodeAllocations[id] ?? 0) > 0
  if (isAllocated(startNodeId)) return null
  if (start.connections.some(isAllocated)) return null

  const visited = new Set<string>([startNodeId])
  const queue: string[][] = [[startNodeId]]
  while (queue.length > 0) {
    const path = queue.shift()!
    const current = nodeMap.get(path[path.length - 1])
    if (!current) continue
    for (const neighborId of current.connections) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)
      const nextPath = [...path, neighborId]
      if (isAllocated(neighborId)) return nextPath
      queue.push(nextPath)
    }
  }
  return null
}
