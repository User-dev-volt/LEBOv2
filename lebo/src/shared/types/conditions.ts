export type ConditionCategory = 'universal' | 'build-specific'

export interface ConditionFilter {
  classId?: string
  skillTag?: string
}

export interface ConditionEntry {
  id: string
  displayLabel: string
  category: ConditionCategory
  filter?: ConditionFilter
}

export interface ConditionsData {
  version: string
  conditions: ConditionEntry[]
}
