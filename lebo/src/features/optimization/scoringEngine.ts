// @deprecated — replaced by useStatSheet + compute_stats Tauri command. Deletion in follow-up story.
import type { BuildScore } from '../../shared/types/optimization'
import type { BuildState } from '../../shared/types/build'
import type { GameData, GameNode } from '../../shared/types/gameData'

const DAMAGE_TAGS = new Set([
  'DAMAGE', 'VOID', 'PHYSICAL', 'FIRE', 'COLD', 'LIGHTNING',
  'NECROTIC', 'POISON', 'BLEED', 'CHAOS', 'OFFENCE', 'PENETRATION',
  'DOT', 'ARMOUR_SHRED', 'DOUBLE_STRIKE', 'KILL',
])

const SURVIVABILITY_TAGS = new Set([
  'DEFENCE', 'ARMOUR', 'HEALTH', 'WARD', 'ENDURANCE', 'BLOCK',
  'DAMAGE_REDUCTION', 'RESISTANCE', 'FORTIFY', 'SUSTAIN', 'LEECH',
])

const SPEED_TAGS = new Set(['MOVEMENT', 'ATTACK_SPEED', 'CAST_SPEED', 'COOLDOWN', 'SLOW'])

// Calibrated so a fully-allocated Void Knight damage build scores ~94.
// See docs/scoring-model.md for derivation (raw damage max = 609).
const RAW_SCORE_CAP = 650

function classifyNode(tags: string[]): 'damage' | 'survivability' | 'speed' | 'neutral' {
  if (tags.some((t) => SURVIVABILITY_TAGS.has(t))) return 'survivability'
  if (tags.some((t) => DAMAGE_TAGS.has(t))) return 'damage'
  if (tags.some((t) => SPEED_TAGS.has(t))) return 'speed'
  return 'neutral'
}

export function calculateScore(build: BuildState, gameData: GameData): BuildScore {
  const { classId, masteryId, nodeAllocations } = build

  if (!classId || !masteryId) {
    return { damage: null, survivability: null, speed: null }
  }

  const classData = gameData.classes[classId]
  if (!classData) return { damage: null, survivability: null, speed: null }

  const masteryData = classData.masteries[masteryId]
  if (!masteryData) return { damage: null, survivability: null, speed: null }

  const allNodes: Record<string, GameNode> = {
    ...classData.baseTree,
    ...masteryData.nodes,
  }

  let rawDamage = 0
  let rawSurv = 0
  let rawSpeed = 0

  for (const [nodeId, allocatedPoints] of Object.entries(nodeAllocations)) {
    if (allocatedPoints === 0) continue
    const node = allNodes[nodeId]
    if (!node) continue

    if (node.maxPoints === 0) {
      if (import.meta.env.DEV) console.warn(`[scoring] node with maxPoints=0 skipped: ${nodeId}`)
      continue
    }

    const weight = allocatedPoints * node.maxPoints
    switch (classifyNode(node.tags)) {
      case 'damage': rawDamage += weight; break
      case 'survivability': rawSurv += weight; break
      case 'speed': rawSpeed += weight; break
    }
  }

  return {
    damage: Math.min(100, Math.round((rawDamage / RAW_SCORE_CAP) * 100)),
    survivability: Math.min(100, Math.round((rawSurv / RAW_SCORE_CAP) * 100)),
    speed: Math.min(100, Math.round((rawSpeed / RAW_SCORE_CAP) * 100)),
  }
}
