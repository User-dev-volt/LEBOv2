export interface FineTuneWeights {
  damage: number
  survivability: number
  speed: number
}

export interface LevelContext {
  characterLevel: number
  availablePassivePoints: number
  allocatedPassivePoints: number
  unspentPassivePoints: number
  activeSkillLevels: Record<string, number>
}

export interface StructuredGearAffix {
  name: string
  tier?: number
  value?: number
}

export interface StructuredGearSlot {
  slot: string
  itemName: string
  affixes: StructuredGearAffix[]
}

export type OptimizationGoal =
  | 'maximize_damage'
  | 'maximize_survivability'
  | 'maximize_speed'
  | 'balanced'

export interface BuildScore {
  damage: number | null
  survivability: number | null
  speed: number | null
}

export interface NodeChange {
  fromNodeId: string | null
  toNodeId: string
  pointsChange: number
}

export interface SuggestionResult {
  rank: number
  nodeChange: NodeChange
  explanation: string
  deltaDamage: number | null
  deltaSurvivability: number | null
  deltaSpeed: number | null
  baselineScore: BuildScore
  previewScore: BuildScore
}
