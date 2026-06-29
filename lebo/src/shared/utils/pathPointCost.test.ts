import { describe, it, expect } from 'vitest'
import { pathPointCost } from './pathPointCost'
import type { GameNode } from '../types/gameData'

// pointCost values chosen distinct so the summed path cost pins to an exact integer.
function node(id: string, prerequisiteNodeIds: string[], pointCost: number): GameNode {
  return {
    id,
    name: id,
    pointCost,
    maxPoints: 1,
    prerequisiteNodeIds,
    effectDescription: '',
    tags: [],
    position: { x: 0, y: 0 },
    size: 'medium',
  }
}

// Linear prerequisite chain: D requires C requires B requires A.
const chain: Record<string, GameNode> = {
  A: node('A', [], 1),
  B: node('B', ['A'], 2),
  C: node('C', ['B'], 3),
  D: node('D', ['C'], 4),
}

describe('pathPointCost', () => {
  it('sums the unallocated interior prerequisites, excluding the target and the allocated anchor', () => {
    // Reaching D from allocated A: interior = C(3) + B(2) = 5 (D's own cost and A excluded).
    expect(pathPointCost(chain, { A: 1 }, 'D')).toBe(5)
  })

  it('returns 0 when a direct prerequisite is already allocated (immediately reachable)', () => {
    // B's prerequisite A is allocated → no interior nodes to buy.
    expect(pathPointCost(chain, { A: 1 }, 'B')).toBe(0)
  })

  it('counts only the cheaper reachable segment when an intermediate node is already allocated', () => {
    // C reached from allocated B: interior is empty (B is a direct prerequisite) → 0.
    expect(pathPointCost(chain, { B: 1 }, 'C')).toBe(0)
    // D reached from allocated B: interior = C(3) → 3.
    expect(pathPointCost(chain, { B: 1 }, 'D')).toBe(3)
  })

  it('returns 0 when the target itself is already allocated', () => {
    expect(pathPointCost(chain, { D: 1 }, 'D')).toBe(0)
  })

  it('returns 0 when no allocated anchor is reachable', () => {
    expect(pathPointCost(chain, {}, 'D')).toBe(0)
  })

  it('treats an allocation value of 0 as not allocated', () => {
    expect(pathPointCost(chain, { A: 0 }, 'D')).toBe(0)
  })

  it('returns 0 for an unknown target node', () => {
    expect(pathPointCost(chain, { A: 1 }, 'ZZ')).toBe(0)
  })

  it('picks the nearest allocated anchor across a branch', () => {
    // S requires P (→ allocated G1) and Q (→ R → allocated G2). Nearest is via P (1 hop interior-free).
    const fork: Record<string, GameNode> = {
      S: node('S', ['P', 'Q'], 1),
      P: node('P', ['G1'], 10),
      Q: node('Q', ['R'], 20),
      R: node('R', ['G2'], 30),
      G1: node('G1', [], 1),
      G2: node('G2', [], 1),
    }
    // Reaching S: BFS finds P then Q at depth 1; P's prereq G1 (allocated) is hit first at depth 2.
    // Interior between S and G1 = P(10). The deeper G2 route is not taken.
    expect(pathPointCost(fork, { G1: 1, G2: 1 }, 'S')).toBe(10)
  })
})
