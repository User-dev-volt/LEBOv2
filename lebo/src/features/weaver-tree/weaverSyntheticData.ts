// Synthetic Weaver Tree data — stub used while no community source exposes machine-readable
// Weaver node data (node IDs, positions, edge graph). Replace when real data is available.
// Re-evaluation triggers: see docs/weaver-tree-spike.md §7 and story 4-3 Dev Notes.
import type { TreeData } from '../../shared/types/treeData'
import type { GameNode } from '../../shared/types/gameData'
import { applyWeaverLayout, buildWeaverGameNodes } from './weaverLayout'
import type { RawWeaverNode, RawWeaverEdge } from './weaverLayout'

const STUB_NODES: RawWeaverNode[] = [
  { id: 'weaver-hub', name: 'Woven Heart', maxPoints: 1, effectDescription: 'The central node of the Weaver Tree. All paths begin here.', tags: ['Weaver'] },
  { id: 'ring1-corruption', name: 'Corruption Resonance', maxPoints: 3, effectDescription: '+5% Corruption Damage per point.', tags: ['Damage', 'Corruption'] },
  { id: 'ring1-vitality', name: 'Vital Weave', maxPoints: 3, effectDescription: '+15 Max Health per point.', tags: ['Defense', 'Life'] },
  { id: 'ring1-ward', name: 'Ward Lattice', maxPoints: 3, effectDescription: '+20 Ward Retention per point.', tags: ['Defense', 'Ward'] },
  { id: 'ring1-speed', name: 'Temporal Thread', maxPoints: 2, effectDescription: '+4% Movement Speed per point.', tags: ['Utility'] },
  { id: 'ring2-echo-a', name: 'Echo Surge', maxPoints: 2, effectDescription: '+8% chance to Echo a spell per point.', tags: ['Damage', 'Echo'] },
  { id: 'ring2-echo-b', name: 'Woven Endurance', maxPoints: 2, effectDescription: '+10% Endurance per point.', tags: ['Defense'] },
  { id: 'ring2-dmg-a', name: 'Fracture Strike', maxPoints: 1, effectDescription: 'Your attacks have a 15% chance to fracture the Weave, dealing bonus damage.', tags: ['Damage'] },
  { id: 'ring2-dmg-b', name: 'Void Thread', maxPoints: 2, effectDescription: '+6% Void Damage per point.', tags: ['Damage', 'Void'] },
  { id: 'ring2-utility', name: 'Phase Shift', maxPoints: 1, effectDescription: 'Gain a brief phase shift on using a movement skill.', tags: ['Utility', 'Defense'] },
  { id: 'ring3-keystone-a', name: 'Unraveling', maxPoints: 1, effectDescription: 'Keystone: Your critical strikes Unravel the Weave. Enemies lose 10% resistances for 3s.', tags: ['Keystone', 'Damage'] },
  { id: 'ring3-keystone-b', name: 'Woven Bastion', maxPoints: 1, effectDescription: 'Keystone: While you have Ward, you are immune to Ailments.', tags: ['Keystone', 'Defense'] },
]

const STUB_EDGES: RawWeaverEdge[] = [
  { fromId: 'weaver-hub', toId: 'ring1-corruption' },
  { fromId: 'weaver-hub', toId: 'ring1-vitality' },
  { fromId: 'weaver-hub', toId: 'ring1-ward' },
  { fromId: 'weaver-hub', toId: 'ring1-speed' },
  { fromId: 'ring1-corruption', toId: 'ring2-echo-a' },
  { fromId: 'ring1-corruption', toId: 'ring2-dmg-a' },
  { fromId: 'ring1-vitality', toId: 'ring2-echo-b' },
  { fromId: 'ring1-vitality', toId: 'ring2-dmg-b' },
  { fromId: 'ring1-ward', toId: 'ring2-utility' },
  { fromId: 'ring2-dmg-a', toId: 'ring3-keystone-a' },
  { fromId: 'ring2-echo-b', toId: 'ring3-keystone-b' },
]

export function loadSyntheticWeaverData(): { treeData: TreeData; gameNodes: Record<string, GameNode> } {
  return {
    treeData: applyWeaverLayout(STUB_NODES, STUB_EDGES),
    gameNodes: buildWeaverGameNodes(STUB_NODES, STUB_EDGES),
  }
}
