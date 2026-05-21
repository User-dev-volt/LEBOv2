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
  description?: string
}

export interface SetBonus {
  piecesRequired: number
  description: string
}

export interface SetItem {
  id: string
  name: string
  baseType: string
  slot: string
  setName: string
  affixes: UniqueItemAffix[]
  setBonuses: SetBonus[]
  description?: string
}

export interface ItemDatabase {
  baseItems: BaseItem[]
  uniqueItems: UniqueItem[]
  affixes: AffixEntry[]
  setItems: SetItem[]
}

export interface SearchResult {
  id: string
  name: string
  baseType: string
  slot: string
  type: 'base' | 'unique'
}
