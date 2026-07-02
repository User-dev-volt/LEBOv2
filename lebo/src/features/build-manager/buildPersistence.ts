import { showErrorToast, showInfoToast } from '../../shared/components/Toast'
import { invokeCommand } from '../../shared/utils/invokeCommand'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { BuildState, BuildMeta, AffixEntryV2, GearItemV2 } from '../../shared/types/build'
import type { FineTuneWeights } from '../../shared/types/optimization'
import { MAX_CHARACTER_LEVEL } from '../../shared/utils/budgetCalculator'

function migrateGoalPreset(
  preset: unknown
): { sliderPosition: number; fineTuneWeights: FineTuneWeights | null } {
  switch (preset) {
    case 'Maximize Damage':        return { sliderPosition: 100, fineTuneWeights: null }
    case 'Maximize Survivability': return { sliderPosition: 0,   fineTuneWeights: null }
    case 'Maximize Speed':         return { sliderPosition: 50,  fineTuneWeights: { damage: 25, survivability: 0, speed: 75 } }
    case 'Balanced':
    default:                       return { sliderPosition: 50,  fineTuneWeights: null }
  }
}

function isFineTuneWeights(v: unknown): v is FineTuneWeights {
  if (typeof v !== 'object' || v === null) return false
  const w = v as Record<string, unknown>
  return (
    typeof w.damage === 'number' && !isNaN(w.damage) &&
    typeof w.survivability === 'number' && !isNaN(w.survivability) &&
    typeof w.speed === 'number' && !isNaN(w.speed)
  )
}

export function migrateBuildState(raw: unknown): BuildState {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('STORAGE_ERROR: invalid build data')
  }
  const obj = raw as Record<string, unknown>
  const ctx = (typeof obj.contextData === 'object' && obj.contextData !== null)
    ? (obj.contextData as Record<string, unknown>)
    : null

  const sharedFields = {
    id: String(obj.id ?? crypto.randomUUID()),
    name: String(obj.name ?? ''),
    classId: String(obj.classId ?? ''),
    masteryId: String(obj.masteryId ?? ''),
    characterLevel: typeof obj.characterLevel === 'number'
      ? Math.max(1, Math.min(MAX_CHARACTER_LEVEL, obj.characterLevel))
      : 1,
    budgetEnforced: typeof obj.budgetEnforced === 'boolean' ? obj.budgetEnforced : false,
    nodeAllocations:
      typeof obj.nodeAllocations === 'object' && obj.nodeAllocations !== null
        ? (obj.nodeAllocations as Record<string, number>)
        : {},
    skillNodeAllocations:
      typeof obj.skillNodeAllocations === 'object' && obj.skillNodeAllocations !== null
        ? (obj.skillNodeAllocations as Record<string, Record<string, number>>)
        : {},
    activeSkillLevels:
      typeof obj.activeSkillLevels === 'object' && obj.activeSkillLevels !== null
        ? (obj.activeSkillLevels as Record<string, number>)
        : {},
    weaverAllocations:
      typeof obj.weaverAllocations === 'object' && obj.weaverAllocations !== null
        ? (obj.weaverAllocations as Record<string, number>)
        : {},
    idolGrid: Array.isArray(obj.idolGrid)
      ? (obj.idolGrid as BuildState['idolGrid'])
      : [],
    blessings:
      typeof obj.blessings === 'object' && obj.blessings !== null && !Array.isArray(obj.blessings)
        ? (obj.blessings as BuildState['blessings'])
        : {},
    activeConditions: Array.isArray(obj.activeConditions)
      ? (obj.activeConditions as BuildState['activeConditions'])
      : [],
    conditionValues:
      typeof obj.conditionValues === 'object' && obj.conditionValues !== null && !Array.isArray(obj.conditionValues)
        ? (obj.conditionValues as BuildState['conditionValues'])
        : {},
    skillRoles:
      typeof obj.skillRoles === 'object' && obj.skillRoles !== null && !Array.isArray(obj.skillRoles)
        ? (obj.skillRoles as BuildState['skillRoles'])
        : {},
    isPersisted: true as const,
    createdAt: String(obj.createdAt ?? new Date().toISOString()),
    updatedAt: String(obj.updatedAt ?? new Date().toISOString()),
  }

  if (typeof obj.schemaVersion === 'number' && obj.schemaVersion !== 1 && obj.schemaVersion !== 2) {
    throw new Error(`STORAGE_ERROR: unknown schemaVersion ${obj.schemaVersion}`)
  }

  // Idempotency: v2 builds pass through with defaults re-applied for safety
  if (obj.schemaVersion === 2) {
    return {
      ...sharedFields,
      schemaVersion: 2,
      contextData: {
        gear: (Array.isArray(ctx?.gear) ? ctx!.gear : []) as GearItemV2[],
        skills: Array.isArray(ctx?.skills) ? ctx!.skills as BuildState['contextData']['skills'] : [],
        idols: Array.isArray(ctx?.idols) ? ctx!.idols as BuildState['contextData']['idols'] : [],
      },
      sliderPosition: typeof obj.sliderPosition === 'number' && !isNaN(obj.sliderPosition) ? Math.max(0, Math.min(100, obj.sliderPosition)) : 50,
      fineTuneWeights: isFineTuneWeights(obj.fineTuneWeights) ? obj.fineTuneWeights : null,
    }
  }

  // v1 → v2: convert gear affixes from string[] to AffixEntryV2[]
  const rawGear = ctx?.gear
  const migratedGear: GearItemV2[] = Array.isArray(rawGear)
    ? rawGear.map((slot: unknown) => {
        const s = slot as Record<string, unknown>
        return {
          slotId: String(s.slotId ?? s.slot ?? ''),
          itemId: typeof s.itemId === 'string' ? s.itemId : undefined,
          itemName: String(s.itemName ?? ''),
          affixes: Array.isArray(s.affixes)
            ? s.affixes.map((a: unknown): AffixEntryV2 =>
                typeof a === 'string'
                  ? { name: a, tier: undefined, value: undefined }
                  : typeof a === 'object' && a !== null && typeof (a as Record<string, unknown>).name === 'string'
                    ? (a as AffixEntryV2)
                    : { name: '', tier: undefined, value: undefined }
              )
            : [],
        }
      })
    : []

  return {
    ...sharedFields,
    schemaVersion: 2,
    contextData: {
      gear: migratedGear,
      skills: Array.isArray(ctx?.skills) ? ctx!.skills as BuildState['contextData']['skills'] : [],
      idols: Array.isArray(ctx?.idols) ? ctx!.idols as BuildState['contextData']['idols'] : [],
    },
    ...migrateGoalPreset(obj.goalPreset),
  }
}

export async function saveBuild(build: BuildState): Promise<void> {
  const { setSavedBuilds, savedBuilds, setActiveBuildPersisted } = useBuildStore.getState()
  try {
    await invokeCommand('save_build', {
      id: build.id,
      name: build.name,
      classId: build.classId,
      masteryId: build.masteryId,
      schemaVersion: build.schemaVersion,
      data: JSON.stringify(build),
      createdAt: build.createdAt,
      updatedAt: build.updatedAt,
    })
    setActiveBuildPersisted()
    const existing = savedBuilds.find((b) => b.id === build.id)
    if (existing) {
      setSavedBuilds(
        savedBuilds.map((b) =>
          b.id === build.id ? { ...b, name: build.name, updatedAt: build.updatedAt } : b
        )
      )
    } else {
      const meta: BuildMeta = {
        id: build.id,
        name: build.name,
        classId: build.classId,
        masteryId: build.masteryId,
        createdAt: build.createdAt,
        updatedAt: build.updatedAt,
      }
      setSavedBuilds([meta, ...savedBuilds])
    }
    showInfoToast(`Build saved as ${build.name}`, { duration: 3000 })
  } catch (err) {
    showErrorToast('Failed to save build. Your work is safe in memory — try again.')
    throw err
  }
}

export async function loadBuildsList(): Promise<void> {
  const metas = await invokeCommand<BuildMeta[]>('load_builds_list')
  useBuildStore.getState().setSavedBuilds(metas)
}

export async function loadBuild(id: string): Promise<void> {
  const { setActiveBuild, setSelectedClass, setSelectedMastery } = useBuildStore.getState()
  try {
    const dataJson = await invokeCommand<string>('load_build', { id })
    const raw: unknown = JSON.parse(dataJson)
    const build = migrateBuildState(raw)
    setSelectedClass(build.classId)
    setSelectedMastery(build.masteryId)
    setActiveBuild(build)
  } catch (err) {
    showErrorToast('Failed to load build. Please try again.')
    throw err
  }
}

export async function deleteBuild(id: string): Promise<void> {
  const { activeBuild, savedBuilds, setSavedBuilds, clearActiveBuild } =
    useBuildStore.getState()
  try {
    await invokeCommand('delete_build', { id })
    setSavedBuilds(savedBuilds.filter((b) => b.id !== id))
    if (activeBuild?.id === id) {
      clearActiveBuild()
    }
  } catch (err) {
    showErrorToast('Failed to delete build. Please try again.')
    throw err
  }
}

export async function renameBuild(id: string, newName: string): Promise<void> {
  const { savedBuilds, setSavedBuilds, activeBuild, setActiveBuild } =
    useBuildStore.getState()
  try {
    await invokeCommand('rename_build', { id, newName })
    setSavedBuilds(savedBuilds.map((b) => (b.id === id ? { ...b, name: newName } : b)))
    if (activeBuild?.id === id) {
      setActiveBuild({ ...activeBuild, name: newName })
    }
  } catch (err) {
    showErrorToast('Failed to rename build. Please try again.')
    throw err
  }
}

export async function loadBuildsOnStartup(): Promise<void> {
  try {
    await loadBuildsList()
  } catch {
    // Non-fatal — app works without saved builds
  }
}
