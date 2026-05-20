export interface GameNode {
  id: string
  name: string
  pointCost: number
  maxPoints: number
  prerequisiteNodeIds: string[]
  effectDescription: string
  tags: string[]
  position: { x: number; y: number }
  size: 'small' | 'medium' | 'large'
  modifierType?: 'increased' | 'more' | 'flat'
}

export interface MasteryData {
  masteryId: string
  masteryName: string
  nodes: Record<string, GameNode>
}

export interface ClassData {
  classId: string
  className: string
  baseTree: Record<string, GameNode>
  masteries: Record<string, MasteryData>
  skills: SkillEntry[]
  skillTrees: Record<string, Record<string, GameNode>>
}

export interface GameDataManifest {
  schemaVersion: number
  gameVersion: string
  dataVersion: string
  generatedAt: string
  classes: string[]
  itemDataVersion?: string
  iconCacheVersion?: string
  iconSource?: string
}

export interface GameData {
  manifest: GameDataManifest
  classes: Record<string, ClassData>
}

export interface SkillEntry {
  skillId: string
  skillName: string
  masteryId: string | null
  masteryName: string | null
  masteryGatePoints: number | null
  type: 'spell' | 'melee' | 'ranged' | 'unknown'
}

export interface DataVersionCheckResult {
  isStale: boolean
  localVersion: string
  remoteVersion: string
  versionsBehind: number
}
