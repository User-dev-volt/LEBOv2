import type { BuildState, GearItemV2, AffixEntryV2, IdolGridState } from '../types/build'
import type { GameData } from '../types/gameData'

// Encodes structured conditionValues into the flat activeConditions string array
// used by the scoring engine.
//   boolean true  → condition.id (e.g. "sigil_of_hope_active")
//   string        → "on_" + value (e.g. "on_pinnacle_boss") — skipped if empty string
//   number != 0   → id + "_" + value (e.g. "power_charges_3")
export function encodeConditionValues(
  values: Record<string, string | number | boolean>
): string[] {
  const result: string[] = []
  for (const [id, value] of Object.entries(values)) {
    if (typeof value === 'boolean') {
      if (value) result.push(id)
    } else if (typeof value === 'number') {
      if (value !== 0) result.push(`${id}_${value}`)
    } else if (typeof value === 'string') {
      if (value) result.push(`on_${value}`)
    }
  }
  return result
}

// Pattern 2: TypeScript mirrors Rust camelCase input fields exactly.
interface AffixEntryTS {
  affixId: string
  tier: number
}

interface GearSlotSnapshotTS {
  itemId?: string
  prefixes: AffixEntryTS[]
  suffixes: AffixEntryTS[]
}

interface IdolPlacementTS {
  row: number
  col: number
  idolSize: string
  prefix?: AffixEntryTS
  suffix?: AffixEntryTS
}

export interface BuildSnapshot {
  nodeAllocations: Record<string, number>
  skillNodeAllocations: Record<string, Record<string, number>>
  characterLevel: number
  classId: string
  masteryId: string
  sliderPosition: number
  activeConditions: string[]
  gearSlots: Record<string, GearSlotSnapshotTS>
  idolPlacements: IdolPlacementTS[]
  blessings: string[]
  activeSkillLevels: Record<string, number>
  // Added in Story 5.3 — populates run_gear_scoring context fields
  skillRoles: Record<string, string>
  primaryOffenseDeliveryType: string | null
  primaryOffenseDamageElements: string[]
}

function extractPrimaryOffenseDeliveryType(
  build: BuildState,
  gameData: GameData,
): string | null {
  if (!build.skillRoles) return null

  const primarySlotId = Object.entries(build.skillRoles).find(
    ([, role]) => role === 'primary_offense',
  )?.[0]
  if (!primarySlotId) return null

  const activeSkill = build.contextData.skills.find((s) => s.slotId === primarySlotId)
  if (!activeSkill) return null

  const classData = gameData.classes?.[build.classId]
  if (!classData) return null

  const skillEntry = classData.skills.find((s) => s.skillId === activeSkill.skillId)
  if (!skillEntry) return null

  // 'unknown' → null (no delivery type filtering in gear scorer)
  return skillEntry.type === 'unknown' ? null : skillEntry.type
}

// Pattern 1: ONLY conversion point from BuildState → BuildSnapshot.
// Never pass BuildState directly to invokeCommand('compute_stats', ...).
export function toBuildSnapshot(build: BuildState, gameData: GameData): BuildSnapshot {
  return {
    nodeAllocations: { ...build.nodeAllocations },
    skillNodeAllocations: Object.fromEntries(
      Object.entries(build.skillNodeAllocations ?? {}).map(([slotId, allocs]) => [
        slotId,
        { ...allocs },
      ]),
    ),
    characterLevel: build.characterLevel,
    classId: build.classId,
    masteryId: build.masteryId,
    sliderPosition: Math.max(0, Math.min(100, build.sliderPosition ?? 50)),
    activeConditions: encodeConditionValues(build.conditionValues ?? {}),
    gearSlots: toGearSlots(build.contextData?.gear ?? []),
    idolPlacements: toIdolPlacements(build.idolGrid ?? []),
    blessings: Object.values(build.blessings ?? {}).filter((id): id is string => id !== null),
    activeSkillLevels: { ...(build.activeSkillLevels ?? {}) },
    // weaverAllocations intentionally excluded — Epic 4 adds weaver scoring to compute_stats
    skillRoles: { ...(build.skillRoles ?? {}) },
    primaryOffenseDeliveryType: extractPrimaryOffenseDeliveryType(build, gameData),
    primaryOffenseDamageElements: [], // No element data in SkillEntry for Phase 3; scorer degrades gracefully
  }
}

function toIdolPlacements(idolGrid: IdolGridState): IdolPlacementTS[] {
  return idolGrid.map((placed) => {
    const entry: IdolPlacementTS = {
      row: placed.row,
      col: placed.col,
      idolSize: placed.idolTypeId,
    }
    if (placed.prefixId !== undefined && placed.prefixTier !== undefined) {
      entry.prefix = { affixId: placed.prefixId, tier: placed.prefixTier }
    }
    if (placed.suffixId !== undefined && placed.suffixTier !== undefined) {
      entry.suffix = { affixId: placed.suffixId, tier: placed.suffixTier }
    }
    return entry
  })
}

function toGearSlots(gear: GearItemV2[]): Record<string, GearSlotSnapshotTS> {
  const slots: Record<string, GearSlotSnapshotTS> = {}
  for (const item of gear) {
    if (!item.slotId) continue
    const validAffixes = item.affixes
      .filter((a): a is AffixEntryV2 & { affixId: string; tier: number } =>
        a.affixId !== undefined && a.tier !== undefined,
      )
      .map((a): AffixEntryTS => ({ affixId: a.affixId, tier: a.tier }))
    slots[item.slotId] = {
      itemId: item.itemId,
      prefixes: validAffixes,  // no prefix/suffix distinction yet — all to prefixes
      suffixes: [],
    }
  }
  return slots
}
