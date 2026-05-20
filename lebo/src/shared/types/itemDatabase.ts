export type DamageType =
  | 'fire'
  | 'cold'
  | 'lightning'
  | 'void'
  | 'poison'
  | 'physical'
  | 'bleed'

export interface AffixTier {
  tier: number
  minValue: number
  maxValue: number
}

export interface AffixEntry {
  id: string
  name: string
  type: 'prefix' | 'suffix' | 'implicit'
  itemSlots: string[]
  tiers: AffixTier[]
  modifierType?: 'increased' | 'more' | 'flat'
  scope?: 'melee' | 'ranged' | 'spell' | 'minion' | 'generic'
  damageType?: DamageType | null
}

export interface BaseItem {
  id: string
  name: string
  baseType: string
  slot: string
  implicitAffixIds: string[]
}

export interface UniqueItemAffix {
  affixId: string
  fixedMinValue: number
  fixedMaxValue: number
}

export interface UniqueItem {
  id: string
  name: string
  baseType: string
  slot: string
  affixes: UniqueItemAffix[]
}

export interface ItemDatabase {
  baseItems: BaseItem[]
  uniqueItems: UniqueItem[]
  affixes: AffixEntry[]
}

export interface SearchResult {
  id: string
  name: string
  baseType: string
  slot: string
  type: 'base' | 'unique'
}
