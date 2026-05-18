import type { TreeData, TreeNode, TreeEdge } from '../../shared/types/treeData'
import type { GameNode } from '../../shared/types/gameData'

export interface RawWeaverNode {
  id: string
  name: string
  maxPoints: number
  effectDescription?: string
  tags?: string[]
  prerequisiteIds?: string[]
}

export interface RawWeaverEdge {
  fromId: string
  toId: string
}

const RING_SPACING = 120

export function applyWeaverLayout(rawNodes: RawWeaverNode[], rawEdges: RawWeaverEdge[]): TreeData {
  if (rawNodes.length === 0) return { nodes: [], edges: [] }

  // Build adjacency for BFS: outgoing edges from each node
  const children = new Map<string, string[]>()
  const hasParent = new Set<string>()
  for (const edge of rawEdges) {
    if (!children.has(edge.fromId)) children.set(edge.fromId, [])
    children.get(edge.fromId)!.push(edge.toId)
    hasParent.add(edge.toId)
  }

  // Root nodes (no incoming edges) form ring 0; there should be exactly one hub
  const roots = rawNodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id)

  // BFS to assign ring numbers
  const ringOf = new Map<string, number>()
  const queue: string[] = [...roots]
  for (const rootId of roots) ringOf.set(rootId, 0)
  while (queue.length > 0) {
    const id = queue.shift()!
    const ring = ringOf.get(id)!
    for (const childId of children.get(id) ?? []) {
      if (!ringOf.has(childId)) {
        ringOf.set(childId, ring + 1)
        queue.push(childId)
      }
    }
  }

  // Nodes not reachable from any root default to ring 1
  for (const n of rawNodes) {
    if (!ringOf.has(n.id)) ringOf.set(n.id, 1)
  }

  // Group nodes by ring
  const byRing = new Map<number, string[]>()
  for (const [id, ring] of ringOf) {
    if (!byRing.has(ring)) byRing.set(ring, [])
    byRing.get(ring)!.push(id)
  }

  // Assign x/y positions: ring 0 → origin; ring N → radius N * RING_SPACING, evenly distributed
  const positions = new Map<string, { x: number; y: number }>()
  for (const [ring, ids] of byRing) {
    if (ring === 0) {
      for (const id of ids) positions.set(id, { x: 0, y: 0 })
      continue
    }
    const radius = ring * RING_SPACING
    ids.forEach((id, index) => {
      const angle = (2 * Math.PI * index) / ids.length
      positions.set(id, {
        x: Math.round(radius * Math.cos(angle)),
        y: Math.round(radius * Math.sin(angle)),
      })
    })
  }

  const nodeMap = new Map(rawNodes.map((n) => [n.id, n]))

  const nodes: TreeNode[] = rawNodes.map((raw) => {
    const ring = ringOf.get(raw.id) ?? 1
    const pos = positions.get(raw.id)!
    return {
      id: raw.id,
      x: pos.x,
      y: pos.y,
      size: ring === 0 ? 'large' : ring === 1 ? 'medium' : 'small',
      maxPoints: raw.maxPoints,
      connections: [
        ...(children.get(raw.id) ?? []),
        ...(raw.prerequisiteIds ?? rawEdges.filter((e) => e.toId === raw.id).map((e) => e.fromId)),
      ].filter((id) => nodeMap.has(id)),
      state: 'available',
    }
  })

  const edges: TreeEdge[] = rawEdges
    .filter((e) => nodeMap.has(e.fromId) && nodeMap.has(e.toId))
    .map((e) => ({ fromId: e.fromId, toId: e.toId }))

  return { nodes, edges }
}

export function buildWeaverGameNodes(rawNodes: RawWeaverNode[], rawEdges: RawWeaverEdge[]): Record<string, GameNode> {
  const prereqMap = new Map<string, string[]>()
  for (const edge of rawEdges) {
    if (!prereqMap.has(edge.toId)) prereqMap.set(edge.toId, [])
    prereqMap.get(edge.toId)!.push(edge.fromId)
  }

  const result: Record<string, GameNode> = {}
  for (const raw of rawNodes) {
    result[raw.id] = {
      id: raw.id,
      name: raw.name,
      pointCost: 1,
      maxPoints: raw.maxPoints,
      prerequisiteNodeIds: raw.prerequisiteIds ?? prereqMap.get(raw.id) ?? [],
      effectDescription: raw.effectDescription ?? '',
      tags: raw.tags ?? [],
      position: { x: 0, y: 0 },
      size: 'small',
    }
  }
  return result
}
