import { describe, it, expect } from 'vitest'
import { computeOrphanedNodes } from './computeOrphanedNodes'
import type { TreeData, TreeNode } from '../../shared/types/treeData'

// Minimal node factory — computeOrphanedNodes reads only treeData.nodes (for id iteration) and
// treeData.edges (fromId=prereq, toId=dependent); x/y/size/maxPoints/connections/state are inert here.
const node = (id: string): TreeNode => ({
  id,
  x: 0,
  y: 0,
  size: 'medium',
  maxPoints: 5,
  connections: [],
  state: 'available',
})

// root → child (single hop)
const leafTree: TreeData = {
  nodes: [node('root'), node('child')],
  edges: [{ fromId: 'root', toId: 'child' }],
}

// root → A → B (chain)
const chainTree: TreeData = {
  nodes: [node('root'), node('A'), node('B')],
  edges: [
    { fromId: 'root', toId: 'A' },
    { fromId: 'A', toId: 'B' },
  ],
}

// root → A → B → C (multi-hop chain)
const multiHopTree: TreeData = {
  nodes: [node('root'), node('A'), node('B'), node('C')],
  edges: [
    { fromId: 'root', toId: 'A' },
    { fromId: 'A', toId: 'B' },
    { fromId: 'B', toId: 'C' },
  ],
}

// root → {A, B} → C (diamond): C requires BOTH A and B
const diamondTree: TreeData = {
  nodes: [node('root'), node('A'), node('B'), node('C')],
  edges: [
    { fromId: 'root', toId: 'A' },
    { fromId: 'root', toId: 'B' },
    { fromId: 'A', toId: 'C' },
    { fromId: 'B', toId: 'C' },
  ],
}

const allAllocated = (ids: string[]): Record<string, number> =>
  Object.fromEntries(ids.map((id) => [id, 1]))

describe('computeOrphanedNodes', () => {
  it('chain: removing the middle node orphans everything below it', () => {
    const alloc = allAllocated(['root', 'A', 'B'])
    expect(computeOrphanedNodes('A', alloc, chainTree)).toEqual(['B'])
  })

  it('chain: removing a leaf orphans nothing', () => {
    const alloc = allAllocated(['root', 'A', 'B'])
    expect(computeOrphanedNodes('B', alloc, chainTree)).toEqual([])
  })

  it('multi-hop: removing the top link cascades transitively', () => {
    const alloc = allAllocated(['root', 'A', 'B', 'C'])
    expect(computeOrphanedNodes('A', alloc, multiHopTree).sort()).toEqual(['B', 'C'])
  })

  it('diamond (STRICT .every): removing A orphans C — C also required B (D3)', () => {
    const alloc = allAllocated(['root', 'A', 'B', 'C'])
    expect(computeOrphanedNodes('A', alloc, diamondTree)).toEqual(['C'])
  })

  it('diamond (STRICT symmetry): removing B orphans C — separate fresh state', () => {
    const alloc = allAllocated(['root', 'A', 'B', 'C'])
    expect(computeOrphanedNodes('B', alloc, diamondTree)).toEqual(['C'])
  })

  it('diamond: removing C (the shared dependent) orphans nothing above it', () => {
    const alloc = allAllocated(['root', 'A', 'B', 'C'])
    expect(computeOrphanedNodes('C', alloc, diamondTree)).toEqual([])
  })

  it('leaf tree: removing the leaf orphans nothing, root stays', () => {
    const alloc = allAllocated(['root', 'child'])
    expect(computeOrphanedNodes('child', alloc, leafTree)).toEqual([])
  })

  it('removing a root orphans its only descendant', () => {
    const alloc = allAllocated(['root', 'child'])
    expect(computeOrphanedNodes('root', alloc, leafTree)).toEqual(['child'])
  })

  it('a root is never orphaned by removing a non-root node', () => {
    // Chain: remove the leaf B; root and A remain valid, neither orphaned.
    const alloc = allAllocated(['root', 'A', 'B'])
    const orphans = computeOrphanedNodes('B', alloc, chainTree)
    expect(orphans).not.toContain('root')
    expect(orphans).not.toContain('A')
  })

  it('partially-allocated diamond: only allocated dependents count as orphans', () => {
    // C is NOT allocated; removing A must not report an unallocated C.
    const alloc = allAllocated(['root', 'A', 'B'])
    expect(computeOrphanedNodes('A', alloc, diamondTree)).toEqual([])
  })

  it('unallocated target: no allocated node is affected', () => {
    // A is not allocated; removing it changes nothing for the valid remaining set.
    const alloc = allAllocated(['root'])
    expect(computeOrphanedNodes('A', alloc, chainTree)).toEqual([])
  })
})
