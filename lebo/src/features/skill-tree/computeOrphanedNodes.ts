import type { TreeData } from '../../shared/types/treeData'

// Given the passive node `nodeId` is about to be cleared, returns the ids of every OTHER allocated node
// that would no longer be validly allocated once `nodeId` is gone — i.e. the transitive orphan cascade
// (excluding `nodeId` itself). Pure: no store/React import, like nearestAllocatedPath.
//
// STRICT `.every()` semantics (D3, Alec-confirmed): a dependent survives only when ALL of its
// prerequisites remain satisfied by a still-valid, root-reachable allocated path. On a diamond
// (C requires {A, B}), removing A orphans C even though B remains — matching how applyNodeChange /
// fillNodeToMax gate allocation. This diverges from a naive descendant-walk (which over-removes) and
// from a loose OR rule (which would leave allocation-invalid builds).
//
// Definitions grounded in real fields: allocated = (nodeAllocations[id] ?? 0) > 0; a node's
// prerequisites = edges where toId === id (edge fromId = prereq, toId = dependent); a root has no
// incoming edges (there is no isRoot flag — derive it). O(V+E): adjacency is built once, and a head
// cursor + valid-set make it cycle-safe.
export function computeOrphanedNodes(
  nodeId: string,
  nodeAllocations: Record<string, number>,
  treeData: TreeData,
): string[] {
  const isAllocated = (id: string) => (nodeAllocations[id] ?? 0) > 0

  // surviving = allocated, minus the node being cleared
  const surviving = new Set<string>()
  for (const n of treeData.nodes) {
    if (n.id !== nodeId && isAllocated(n.id)) surviving.add(n.id)
  }

  // directed adjacency, built ONCE → O(V+E) (do NOT edges.filter inside the loop)
  const prereqCount = new Map<string, number>() // id -> # prerequisites (full edge set)
  const dependentsOf = new Map<string, string[]>() // prereqId -> dependent ids
  for (const e of treeData.edges) {
    prereqCount.set(e.toId, (prereqCount.get(e.toId) ?? 0) + 1)
    const arr = dependentsOf.get(e.fromId)
    if (arr) arr.push(e.toId)
    else dependentsOf.set(e.fromId, [e.toId])
  }

  // flood-fill from surviving roots; a dependent becomes valid only when ALL prereqs are valid
  const valid = new Set<string>()
  const remaining = new Map<string, number>()
  const queue: string[] = []
  for (const id of surviving) {
    const pc = prereqCount.get(id) ?? 0
    if (pc === 0) {
      valid.add(id) // root
      queue.push(id)
    } else {
      remaining.set(id, pc)
    }
  }
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++] // head cursor, no Array.shift
    for (const dep of dependentsOf.get(cur) ?? []) {
      if (!surviving.has(dep) || valid.has(dep)) continue
      const left = (remaining.get(dep) ?? 0) - 1
      remaining.set(dep, left)
      if (left === 0) {
        // STRICT .every(): valid only when ALL prereqs are valid (D3, confirmed)
        valid.add(dep)
        queue.push(dep)
      }
    }
  }

  const orphans: string[] = []
  for (const id of surviving) if (!valid.has(id)) orphans.push(id)
  return orphans
}
