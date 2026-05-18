import type { TreeData, TreeNode, TreeEdge } from './types'

// Radial layout: 6 tiers, world-space ~3000×3000 (radius 1500 at outer tier)
const TIER_COUNTS = [1, 6, 18, 54, 162, 559] as const
const TIER_RADII = [0, 250, 550, 900, 1200, 1500] as const

const nodes: TreeNode[] = []
const edges: TreeEdge[] = []
const tierNodeIds: string[][] = []
const nodeMap = new Map<string, TreeNode>()

let globalIdx = 0

for (let tier = 0; tier < TIER_COUNTS.length; tier++) {
  const count = TIER_COUNTS[tier]
  const radius = TIER_RADII[tier]
  const tierIds: string[] = []

  for (let i = 0; i < count; i++) {
    // Offset by -π/2 so tier 1 starts at top, matching visual convention
    const angle = tier === 0 ? 0 : (2 * Math.PI * i) / count - Math.PI / 2
    const x = Math.round(radius * Math.cos(angle))
    const y = Math.round(radius * Math.sin(angle))

    // Size: 30% large (first 240), 50% medium (next 400), 20% small (last 160)
    const size =
      globalIdx < 240 ? 'large' : globalIdx < 640 ? 'medium' : ('small' as const)

    // State: 100 allocated → 50 suggested → 200 locked → ~450 available
    const state =
      globalIdx < 100
        ? 'allocated'
        : globalIdx < 150
          ? 'suggested'
          : globalIdx < 350
            ? 'locked'
            : ('available' as const)

    const id = `n${globalIdx}`
    tierIds.push(id)

    const node: TreeNode = { id, x, y, size, maxPoints: 1, connections: [], state }
    nodes.push(node)
    nodeMap.set(id, node)
    globalIdx++
  }

  tierNodeIds.push(tierIds)
}

// Connect each inner-tier node to 5 outer-tier nodes (angular proximity)
// Produces ~1200+ edges total across all tiers
for (let tier = 0; tier < TIER_COUNTS.length - 1; tier++) {
  const innerIds = tierNodeIds[tier]
  const outerIds = tierNodeIds[tier + 1]
  const outerCount = outerIds.length
  const innerCount = innerIds.length
  const connsPerInner = 5

  for (let i = 0; i < innerCount; i++) {
    const innerId = innerIds[i]
    const innerNode = nodeMap.get(innerId)!
    const baseOuterIdx = Math.round((i / innerCount) * outerCount)
    const halfSpan = Math.floor(connsPerInner / 2)

    for (let j = -halfSpan; j <= halfSpan; j++) {
      const outerIdx = ((baseOuterIdx + j) % outerCount + outerCount) % outerCount
      const outerId = outerIds[outerIdx]
      const outerNode = nodeMap.get(outerId)!

      if (!innerNode.connections.includes(outerId)) {
        innerNode.connections.push(outerId)
        outerNode.connections.push(innerId)
        edges.push({ fromId: innerId, toId: outerId })
      }
    }
  }
}

export const mockTreeData: TreeData = { nodes, edges }
