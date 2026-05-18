import type { FineTuneWeights } from './optimization'

export interface GearItem {
  slotId: string
  itemName: string
  affixes: string[]
}

export interface AffixEntryV2 {
  affixId?: string
  name: string
  tier?: number
  // Reserved for story 7-5 (structured gear context in optimization payload).
  // Not populated here — affixId+tier is enough to reconstruct min/max from the item DB.
  value?: number
}

export interface GearItemV2 {
  slotId: string
  itemId?: string
  itemName: string
  affixes: AffixEntryV2[]
}

export interface ActiveSkill {
  slotId: string
  skillName: string
  skillId: string
}

export interface IdolItem {
  slotId: string
  idolType: string
  modifiers: string[]
}

export interface BuildState {
  schemaVersion: 1 | 2
  id: string
  name: string
  classId: string
  masteryId: string
  characterLevel: number
  budgetEnforced: boolean
  nodeAllocations: Record<string, number>
  skillNodeAllocations: Record<string, Record<string, number>>
  activeSkillLevels: Record<string, number>
  weaverAllocations: Record<string, number>
  contextData: {
    gear: GearItemV2[]
    skills: ActiveSkill[]
    idols: IdolItem[]
  }
  sliderPosition?: number
  fineTuneWeights?: FineTuneWeights | null
  isPersisted: boolean
  createdAt: string
  updatedAt: string
}

export type ApplyNodeResult = { success: boolean; error?: string; blockedByDependents?: string[] }

export interface BuildMeta {
  id: string
  name: string
  classId: string
  masteryId: string
  createdAt: string
  updatedAt: string
}
