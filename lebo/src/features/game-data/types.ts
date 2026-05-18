export interface RawNodeEffect {
  description: string
  tags: string[]
}

export interface RawGameNode {
  id: string
  name: string
  x: number
  y: number
  size: 'small' | 'medium' | 'large'
  maxPoints: number
  effects: RawNodeEffect[]
}

export interface RawEdge {
  fromId: string
  toId: string
}

export interface RawTreeData {
  nodes: RawGameNode[]
  edges: RawEdge[]
}

export interface RawMastery {
  id: string
  name: string
  passiveTree: RawTreeData
}

export interface RawSkillEntry {
  id: string
  name: string
  masteryId: string | null
  masteryGatePoints: number | null
  skillTree: RawTreeData
}

export interface RawClassData {
  id: string
  name: string
  baseTree: RawTreeData
  masteries: RawMastery[]
  skills: RawSkillEntry[]
}
