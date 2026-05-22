// @deprecated fields (idolPlacements, blessings, activeConditions) are stubs — Epic 3 populates them.
import type { BuildState, GearItemV2, AffixEntryV2 } from '../types/build'
import type { GameData } from '../types/gameData'

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
}

// Pattern 1: ONLY conversion point from BuildState → BuildSnapshot.
// Never pass BuildState directly to invokeCommand('compute_stats', ...).
export function toBuildSnapshot(build: BuildState, _gameData: GameData): BuildSnapshot {
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
    activeConditions: [],     // Epic 3 adds BuildState.activeConditions
    gearSlots: toGearSlots(build.contextData?.gear ?? []),
    idolPlacements: [],       // Epic 3 adds structured idol grid state (IdolItem has no row/col)
    blessings: [],            // Epic 3 adds BuildState.blessings
    // weaverAllocations intentionally excluded — Epic 4 adds weaver scoring to compute_stats
  }
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
