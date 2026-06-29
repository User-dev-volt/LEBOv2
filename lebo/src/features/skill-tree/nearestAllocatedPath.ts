import type { TreeData, TreeNode } from './types'

// Frontend-derived path from a suggested node to the nearest allocated node, traced over the tree's
// bidirectional `connections` graph. WHY frontend-derived: the engine's NodeEfficiency overlay feed
// carries no route field and the knapsack route never reaches the canvas (Story 3.2 Source Audit),
// so AC2's dashed path line must be computed here from treeData.
//
// Returns null when a direct prerequisite is already allocated (the node is immediately allocatable,
// so no path line is needed) or when no allocated node is reachable.
//
// `nodeMap` is an optional precomputed id→node map. renderTree already builds one per frame and passes
// it in so this stays O(edges) per call instead of rebuilding an O(nodes) map for every suggestion.
export function nearestAllocatedPath(
  treeData: TreeData,
  nodeAllocations: Record<string, number>,
  startNodeId: string,
  nodeMap?: Map<string, TreeNode>
): string[] | null {
  const nodes = nodeMap ?? new Map<string, TreeNode>(treeData.nodes.map((n) => [n.id, n]))
  const start = nodes.get(startNodeId)
  if (!start) return null

  const isAllocated = (id: string): boolean => (nodeAllocations[id] ?? 0) > 0
  if (isAllocated(startNodeId)) return null
  if (start.connections.some(isAllocated)) return null

  // BFS with parent pointers — reconstruct the path once on the first allocated hit, rather than
  // copying a growing path array at every visited node. A head cursor walks the queue instead of
  // Array.shift() (which is O(n) per dequeue → O(n^2) over the walk).
  const parent = new Map<string, string | null>([[startNodeId, null]])
  const queue: string[] = [startNodeId]
  let head = 0
  while (head < queue.length) {
    const currentId = queue[head++]
    const current = nodes.get(currentId)
    if (!current) continue
    for (const neighborId of current.connections) {
      if (parent.has(neighborId)) continue
      // Skip dangling connection ids absent from the node map — never route through or terminate at
      // a node the dashed-path drawer can't resolve (it would silently drop that segment).
      if (!nodes.has(neighborId)) continue
      parent.set(neighborId, currentId)
      if (isAllocated(neighborId)) {
        const path: string[] = [neighborId]
        let p: string | null = currentId
        while (p !== null) {
          path.push(p)
          p = parent.get(p) ?? null
        }
        return path.reverse()
      }
      queue.push(neighborId)
    }
  }
  return null
}
