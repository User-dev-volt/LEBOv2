export interface IdolGrid {
  rows: number
  cols: number
  blockedCells: [number, number][]
}

export interface IdolAffixTier {
  tier: number
  minValue: number
  maxValue: number
}

export interface IdolAffix {
  id: string
  displayName: string
  type: 'prefix' | 'suffix'
  tiers: IdolAffixTier[]
  statKey: string
  modifierType: 'increased' | 'more' | 'flat'
}

export interface IdolType {
  id: string
  displayName: string
  rows: number
  cols: number
  requiresBoth: boolean
  prefixPool: IdolAffix[]
  suffixPool: IdolAffix[]
}

export interface IdolData {
  version: string
  defaultGrid: IdolGrid
  altarVariants: unknown[]
  idolTypes: IdolType[]
}

export interface StatEffect {
  statKey: string
  value: number
  modifierType: 'increased' | 'more' | 'flat'
}

export interface BlessingEntry {
  id: string
  timelineId: string
  timelineName: string
  displayName: string
  statEffects: StatEffect[]
}

export type BlessingsDatabase = BlessingEntry[]

export interface ConditionOption {
  value: string
  label: string
}

export interface ConditionFilter {
  classId?: string
  skillTag?: string
}

export interface ConditionEntry {
  id: string
  displayLabel: string
  category: 'universal' | 'build-specific'
  type: 'select' | 'range' | 'toggle'
  options: ConditionOption[]
  min?: number
  max?: number
  step?: number
  defaultValue: boolean | number | string
  filter?: ConditionFilter
}

export type ConditionsDatabase = ConditionEntry[]
