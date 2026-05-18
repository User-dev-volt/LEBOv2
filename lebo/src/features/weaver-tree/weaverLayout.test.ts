import { describe, it, expect } from 'vitest'
import { applyWeaverLayout, buildWeaverGameNodes } from './weaverLayout'
import type { RawWeaverNode, RawWeaverEdge } from './weaverLayout'

const HUB: RawWeaverNode = { id: 'hub', name: 'Hub', maxPoints: 1 }
const RING1_A: RawWeaverNode = { id: 'r1a', name: 'Ring 1 A', maxPoints: 3 }
const RING1_B: RawWeaverNode = { id: 'r1b', name: 'Ring 1 B', maxPoints: 2 }
const RING2_A: RawWeaverNode = { id: 'r2a', name: 'Ring 2 A', maxPoints: 1 }

const EDGES_SIMPLE: RawWeaverEdge[] = [
  { fromId: 'hub', toId: 'r1a' },
  { fromId: 'hub', toId: 'r1b' },
  { fromId: 'r1a', toId: 'r2a' },
]

describe('applyWeaverLayout', () => {
  it('returns empty tree for no nodes', () => {
    const result = applyWeaverLayout([], [])
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
  })

  it('returns correct node count', () => {
    const rawNodes = [HUB, RING1_A, RING1_B, RING2_A]
    const result = applyWeaverLayout(rawNodes, EDGES_SIMPLE)
    expect(result.nodes).toHaveLength(4)
  })

  it('all nodes have finite x and y coordinates', () => {
    const rawNodes = [HUB, RING1_A, RING1_B, RING2_A]
    const result = applyWeaverLayout(rawNodes, EDGES_SIMPLE)
    for (const node of result.nodes) {
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
      expect(Number.isNaN(node.x)).toBe(false)
      expect(Number.isNaN(node.y)).toBe(false)
    }
  })

  it('no two distinct nodes share the same (x, y) position', () => {
    const rawNodes = [HUB, RING1_A, RING1_B, RING2_A]
    const result = applyWeaverLayout(rawNodes, EDGES_SIMPLE)
    const positions = result.nodes.map((n) => `${n.x},${n.y}`)
    const unique = new Set(positions)
    expect(unique.size).toBe(result.nodes.length)
  })

  it('hub node (ring 0) is placed at origin (0, 0)', () => {
    const rawNodes = [HUB, RING1_A, RING1_B]
    const edges: RawWeaverEdge[] = [
      { fromId: 'hub', toId: 'r1a' },
      { fromId: 'hub', toId: 'r1b' },
    ]
    const result = applyWeaverLayout(rawNodes, edges)
    const hub = result.nodes.find((n) => n.id === 'hub')!
    expect(hub.x).toBe(0)
    expect(hub.y).toBe(0)
  })

  it('hub node gets size "large"', () => {
    const rawNodes = [HUB, RING1_A]
    const edges: RawWeaverEdge[] = [{ fromId: 'hub', toId: 'r1a' }]
    const result = applyWeaverLayout(rawNodes, edges)
    const hub = result.nodes.find((n) => n.id === 'hub')!
    expect(hub.size).toBe('large')
  })

  it('ring 1 nodes get size "medium"', () => {
    const rawNodes = [HUB, RING1_A, RING1_B]
    const edges: RawWeaverEdge[] = [
      { fromId: 'hub', toId: 'r1a' },
      { fromId: 'hub', toId: 'r1b' },
    ]
    const result = applyWeaverLayout(rawNodes, edges)
    const r1a = result.nodes.find((n) => n.id === 'r1a')!
    const r1b = result.nodes.find((n) => n.id === 'r1b')!
    expect(r1a.size).toBe('medium')
    expect(r1b.size).toBe('medium')
  })

  it('ring 2+ nodes get size "small"', () => {
    const rawNodes = [HUB, RING1_A, RING2_A]
    const edges: RawWeaverEdge[] = [
      { fromId: 'hub', toId: 'r1a' },
      { fromId: 'r1a', toId: 'r2a' },
    ]
    const result = applyWeaverLayout(rawNodes, edges)
    const r2a = result.nodes.find((n) => n.id === 'r2a')!
    expect(r2a.size).toBe('small')
  })

  it('edges reference only valid node IDs from rawNodes', () => {
    const rawNodes = [HUB, RING1_A, RING1_B, RING2_A]
    const result = applyWeaverLayout(rawNodes, EDGES_SIMPLE)
    const nodeIds = new Set(rawNodes.map((n) => n.id))
    for (const edge of result.edges) {
      expect(nodeIds.has(edge.fromId)).toBe(true)
      expect(nodeIds.has(edge.toId)).toBe(true)
    }
  })

  it('edges with unknown node IDs are filtered out', () => {
    const rawNodes = [HUB, RING1_A]
    const edges: RawWeaverEdge[] = [
      { fromId: 'hub', toId: 'r1a' },
      { fromId: 'hub', toId: 'ghost-node' },
    ]
    const result = applyWeaverLayout(rawNodes, edges)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].fromId).toBe('hub')
    expect(result.edges[0].toId).toBe('r1a')
  })

  it('single node with no edges gets position (0, 0)', () => {
    const result = applyWeaverLayout([HUB], [])
    expect(result.nodes[0].x).toBe(0)
    expect(result.nodes[0].y).toBe(0)
  })

  it('preserves maxPoints from rawNode', () => {
    const rawNodes = [HUB, RING1_A]
    const edges: RawWeaverEdge[] = [{ fromId: 'hub', toId: 'r1a' }]
    const result = applyWeaverLayout(rawNodes, edges)
    const hub = result.nodes.find((n) => n.id === 'hub')!
    const r1a = result.nodes.find((n) => n.id === 'r1a')!
    expect(hub.maxPoints).toBe(1)
    expect(r1a.maxPoints).toBe(3)
  })
})

describe('buildWeaverGameNodes', () => {
  it('returns a record keyed by node id', () => {
    const rawNodes = [HUB, RING1_A, RING1_B]
    const edges: RawWeaverEdge[] = [
      { fromId: 'hub', toId: 'r1a' },
      { fromId: 'hub', toId: 'r1b' },
    ]
    const result = buildWeaverGameNodes(rawNodes, edges)
    expect(Object.keys(result)).toContain('hub')
    expect(Object.keys(result)).toContain('r1a')
    expect(Object.keys(result)).toContain('r1b')
  })

  it('correct node count in result', () => {
    const rawNodes = [HUB, RING1_A, RING1_B, RING2_A]
    const result = buildWeaverGameNodes(rawNodes, EDGES_SIMPLE)
    expect(Object.keys(result)).toHaveLength(4)
  })

  it('sets prerequisiteNodeIds from edges', () => {
    const rawNodes = [HUB, RING1_A]
    const edges: RawWeaverEdge[] = [{ fromId: 'hub', toId: 'r1a' }]
    const result = buildWeaverGameNodes(rawNodes, edges)
    expect(result['r1a'].prerequisiteNodeIds).toContain('hub')
    expect(result['hub'].prerequisiteNodeIds).toHaveLength(0)
  })

  it('uses raw.prerequisiteIds when provided, ignoring edge-derived prereqs', () => {
    const nodeWithExplicitPrereqs: RawWeaverNode = { id: 'r1a', name: 'Ring 1 A', maxPoints: 3, prerequisiteIds: ['custom-prereq'] }
    const edges: RawWeaverEdge[] = [{ fromId: 'hub', toId: 'r1a' }]
    const result = buildWeaverGameNodes([HUB, nodeWithExplicitPrereqs], edges)
    expect(result['r1a'].prerequisiteNodeIds).toContain('custom-prereq')
    expect(result['r1a'].prerequisiteNodeIds).not.toContain('hub')
  })

  it('preserves name and maxPoints', () => {
    const rawNodes = [HUB]
    const result = buildWeaverGameNodes(rawNodes, [])
    expect(result['hub'].name).toBe('Hub')
    expect(result['hub'].maxPoints).toBe(1)
  })

  it('defaults effectDescription to empty string when not provided', () => {
    const rawNodes = [HUB]
    const result = buildWeaverGameNodes(rawNodes, [])
    expect(result['hub'].effectDescription).toBe('')
  })

  it('defaults tags to empty array when not provided', () => {
    const rawNodes = [HUB]
    const result = buildWeaverGameNodes(rawNodes, [])
    expect(result['hub'].tags).toEqual([])
  })
})
