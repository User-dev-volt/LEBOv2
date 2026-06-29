import type { GameData } from '../types/gameData'

// Resolves a passive-tree node id to its display name — mastery nodes first, then the base tree, with
// a terminal `?? id` fallback so a name never renders empty. Shared because both the optimization
// suggestion card and the skill-tree canvas tooltip resolve names, and cross-feature imports are
// forbidden (route through shared/).
export function getNodeName(
  nodeId: string,
  gameData: GameData | null,
  classId: string,
  masteryId: string
): string {
  if (!gameData) return nodeId
  const classData = gameData.classes[classId]
  if (!classData) return nodeId
  return (
    classData.masteries[masteryId]?.nodes[nodeId]?.name ??
    classData.baseTree[nodeId]?.name ??
    nodeId
  )
}
