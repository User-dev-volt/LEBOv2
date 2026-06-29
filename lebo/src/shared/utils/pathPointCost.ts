import type { GameNode } from '../types/gameData'

// Frontend-derived "points to reach": the total point cost of the UNALLOCATED prerequisite chain
// between a suggested node and the nearest already-allocated node, walked over GameNode.prerequisiteNodeIds.
//
// Mirrors nearestAllocatedPath's parent-pointer BFS (head cursor not shift(), has()-guard against
// dangling ids) but over the directed PREREQUISITE graph in gameData — the in-renderer dashed-line
// helper walks the bidirectional treeData.connections instead.
//
// WHY frontend-derived: SuggestionResult carries no path cost, and NodeEfficiency.effective_point_cost
// is a full-path quantity keyed on the Claude-echoed to_node_id (Story 3.3 Source Audit — the
// displayed-but-not-sourced trap). This is deterministic gameData, immune to the echo miss.
//
// Excludes the target node's own cost (the card shows that separately as the point cost) and the
// allocated endpoint. Returns 0 when the node is directly reachable (a prerequisite is already
// allocated), already allocated, or no allocated anchor is reachable.
export function pathPointCost(
  nodes: Record<string, GameNode>,
  nodeAllocations: Record<string, number>,
  targetNodeId: string
): number {
  const target = nodes[targetNodeId]
  if (!target) return 0
  const isAllocated = (id: string): boolean => (nodeAllocations[id] ?? 0) > 0
  if (isAllocated(targetNodeId)) return 0

  // BFS toward prerequisites; parent pointers reconstruct the path once on the first allocated hit.
  const parent = new Map<string, string | null>([[targetNodeId, null]])
  const queue: string[] = [targetNodeId]
  let head = 0
  while (head < queue.length) {
    const currentId = queue[head++]
    const current = nodes[currentId]
    if (!current) continue
    for (const prereqId of current.prerequisiteNodeIds) {
      if (parent.has(prereqId)) continue
      // Skip dangling prerequisite ids absent from the node map — never sum a node we can't price.
      if (!nodes[prereqId]) continue
      parent.set(prereqId, currentId)
      if (isAllocated(prereqId)) {
        // Sum the cost of the unallocated interior nodes: walk parents from the discoverer of the
        // allocated node back up to (but excluding) the target; the allocated endpoint is never added.
        let sum = 0
        let p: string | null = currentId
        while (p !== null && p !== targetNodeId) {
          sum += nodes[p]?.pointCost ?? 0
          p = parent.get(p) ?? null
        }
        return sum
      }
      queue.push(prereqId)
    }
  }
  return 0
}
