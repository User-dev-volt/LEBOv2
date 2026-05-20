import { invokeCommand } from '../../shared/utils/invokeCommand'
import { normalizeAppError } from '../../shared/utils/errorNormalizer'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { checkItemDataFreshness } from '../item-database/itemDatabaseLoader'
import type { GameNode, GameData, ClassData, MasteryData, GameDataManifest, DataVersionCheckResult, SkillEntry } from '../../shared/types/gameData'
import type { RawClassData, RawGameNode, RawEdge, RawMastery, RawSkillEntry } from './types'

export async function initGameData(): Promise<void> {
  const { setIsLoading } = useGameDataStore.getState()
  setIsLoading(true)
  try {
    await invokeCommand('initialize_game_data')
    await loadAllClasses()
    await Promise.all([
      checkDataVersion().catch(() => {}),
      checkItemDataFreshness().catch(() => {}),
    ])
  } catch (error) {
    setIsLoading(false)
    throw normalizeAppError(error)
  }
  setIsLoading(false)
}

export async function checkDataVersion(): Promise<void> {
  const result = await invokeCommand<DataVersionCheckResult>('check_data_version')
  const { setIsStale, setVersionsBehind } = useGameDataStore.getState()
  setIsStale(result.isStale)
  setVersionsBehind(result.versionsBehind)
}

export async function refreshGameData(): Promise<void> {
  await loadAllClasses()
}

export async function triggerDataUpdate(): Promise<void> {
  const { setIsUpdating, setIsStale, setVersionsBehind } = useGameDataStore.getState()
  setIsUpdating(true)
  try {
    await invokeCommand('download_game_data_update')
    await refreshGameData()
    setIsStale(false)
    setVersionsBehind(0)
  } finally {
    setIsUpdating(false)
  }
}

async function loadAllClasses(): Promise<void> {
  const rawClasses = await invokeCommand<RawClassData[]>('load_game_data', { classId: null })
  const manifest = await invokeCommand<GameDataManifest>('get_manifest')
  transformAndStore(rawClasses, manifest)
  const { setDataVersion, setDataUpdatedAt } = useGameDataStore.getState()
  setDataVersion(manifest.gameVersion)
  setDataUpdatedAt(manifest.generatedAt)
}

function transformAndStore(rawClasses: RawClassData[], manifest: GameDataManifest): void {
  const classes: Record<string, ClassData> = {}
  for (const raw of rawClasses) {
    classes[raw.id] = transformClass(raw)
  }
  const gameData: GameData = { manifest, classes }
  useGameDataStore.getState().setGameData(gameData)
}

export function transformNode(raw: RawGameNode, prereqIds: string[]): GameNode {
  const tags = [...new Set(raw.effects.flatMap((e) => e.tags))]
  return {
    id: raw.id,
    name: raw.name,
    pointCost: 1,
    maxPoints: raw.maxPoints,
    prerequisiteNodeIds: prereqIds,
    effectDescription: raw.effects[0]?.description ?? '',
    tags,
    position: { x: raw.x, y: raw.y },
    size: raw.size,
    modifierType: raw.modifierType,
  }
}

function buildPrereqMap(edges: RawEdge[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const edge of edges) {
    if (!map[edge.toId]) map[edge.toId] = []
    map[edge.toId].push(edge.fromId)
  }
  return map
}

function transformTree(raw: { nodes: RawGameNode[]; edges: RawEdge[] }): Record<string, GameNode> {
  const prereqMap = buildPrereqMap(raw.edges)
  const nodes: Record<string, GameNode> = {}
  for (const rawNode of raw.nodes) {
    nodes[rawNode.id] = transformNode(rawNode, prereqMap[rawNode.id] ?? [])
  }
  return nodes
}

function transformMastery(raw: RawMastery): MasteryData {
  return {
    masteryId: raw.id,
    masteryName: raw.name,
    nodes: transformTree(raw.passiveTree),
  }
}

function transformSkillEntry(raw: RawSkillEntry, masteries: Record<string, MasteryData>): SkillEntry {
  return {
    skillId: raw.id,
    skillName: raw.name,
    masteryId: raw.masteryId,
    masteryName: raw.masteryId != null ? (masteries[raw.masteryId]?.masteryName ?? null) : null,
    masteryGatePoints: raw.masteryGatePoints ?? null,
    type: 'unknown',
  }
}

function transformClass(raw: RawClassData): ClassData {
  const masteries: Record<string, MasteryData> = {}
  for (const rawMastery of raw.masteries) {
    masteries[rawMastery.id] = transformMastery(rawMastery)
  }
  const skills: SkillEntry[] = raw.skills.map((s) => transformSkillEntry(s, masteries))
  const skillTrees: Record<string, Record<string, GameNode>> = {}
  for (const rawSkill of raw.skills) {
    skillTrees[rawSkill.id] = transformTree(rawSkill.skillTree)
  }
  return {
    classId: raw.id,
    className: raw.name,
    baseTree: transformTree(raw.baseTree),
    masteries,
    skills,
    skillTrees,
  }
}
