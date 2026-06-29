import { describe, it, expect } from 'vitest'
import { nearestAllocatedPath } from './nearestAllocatedPath'
import type { TreeData, TreeNode } from './types'

function node(id: string, connections: string[], x = 0, y = 0): TreeNode {
  return { id, x, y, size: 'medium', maxPoints: 1, connections, state: 'available' }
}

// Linear chain A — B — C — D, connections bidirectional (mirrors buildConnectionMap).
const chain: TreeData = {
  nodes: [
    node('A', ['B'], 0, 0),
    node('B', ['A', 'C'], 10, 0),
    node('C', ['B', 'D'], 20, 0),
    node('D', ['C'], 30, 0),
  ],
  edges: [
    { fromId: 'A', toId: 'B' },
    { fromId: 'B', toId: 'C' },
    { fromId: 'C', toId: 'D' },
  ],
}

// Branching fixture: S forks to P (→ allocated G1 at depth 2) and Q (→ allocated G2 at depth 3).
const fork: TreeData = {
  nodes: [
    node('S', ['P', 'Q']),
    node('P', ['S', 'G1']),
    node('Q', ['S', 'R']),
    node('R', ['Q', 'G2']),
    node('G1', ['P']),
    node('G2', ['R']),
  ],
  edges: [],
}

describe('nearestAllocatedPath', () => {
  it('returns the exact shortest path from a suggested node to the nearest allocated node', () => {
    expect(nearestAllocatedPath(chain, { A: 1 }, 'D')).toEqual(['D', 'C', 'B', 'A'])
  })

  it('picks the nearest allocated target when several are reachable at different depths', () => {
    expect(nearestAllocatedPath(fork, { G1: 1, G2: 1 }, 'S')).toEqual(['S', 'P', 'G1'])
  })

  it('returns null when a direct prerequisite is already allocated (immediately allocatable)', () => {
    // B is adjacent to the allocated A → no path line needed.
    expect(nearestAllocatedPath(chain, { A: 1 }, 'B')).toBeNull()
  })

  it('returns null when no allocated node is reachable', () => {
    expect(nearestAllocatedPath(chain, {}, 'D')).toBeNull()
  })

  it('treats an allocation value of 0 as not allocated', () => {
    // nodeAllocations omits zero-value keys in practice; an explicit 0 must not count as allocated.
    expect(nearestAllocatedPath(chain, { A: 0 }, 'D')).toBeNull()
  })

  it('returns null for an unknown start node id', () => {
    expect(nearestAllocatedPath(chain, { A: 1 }, 'ZZ')).toBeNull()
  })
})
