import type { GameData, GameNode } from '../../shared/types/gameData'
import type { ItemDatabase } from '../../shared/types/itemDatabase'
import type { IdolData, BlessingsDatabase } from '../../shared/types/contextDatabase'
import type { ModifierSource } from '../../shared/types/statSheet'

// Best-effort, synchronous source-label resolution (Story 1.8 Task 3). All lookups are in-memory
// maps built once per stat sheet — no IPC, no async — so NFR-2's 50ms tooltip budget holds. The
// honest floor is the raw `source_label` ID Story 1.7 recorded: never blank, never fabricated.
export interface SourceResolveContext {
  nodeNames: Record<string, string>
  itemAffixNames: Record<string, string>
  idolAffixNames: Record<string, string>
  blessingNames: Record<string, string>
}

export function buildSourceResolveContext(input: {
  gameData: GameData | null
  classId: string | null
  itemDatabase: ItemDatabase | null
  idolData: IdolData | null
  blessingsDatabase: BlessingsDatabase | null
  weaverGameNodes: Record<string, GameNode>
}): SourceResolveContext {
  const nodeNames: Record<string, string> = {}
  const addNodes = (nodes: Record<string, GameNode> | undefined) => {
    if (!nodes) return
    for (const [id, node] of Object.entries(nodes)) nodeNames[id] = node.name
  }

  const cls = input.gameData && input.classId ? input.gameData.classes[input.classId] : null
  if (cls) {
    addNodes(cls.baseTree)
    for (const mastery of Object.values(cls.masteries)) addNodes(mastery.nodes)
    for (const tree of Object.values(cls.skillTrees)) addNodes(tree)
  }
  addNodes(input.weaverGameNodes)

  const itemAffixNames: Record<string, string> = {}
  for (const a of input.itemDatabase?.affixes ?? []) itemAffixNames[a.id] = a.name

  const idolAffixNames: Record<string, string> = {}
  for (const t of input.idolData?.idolTypes ?? []) {
    for (const a of [...t.prefixPool, ...t.suffixPool]) idolAffixNames[a.id] = a.displayName
  }

  const blessingNames: Record<string, string> = {}
  for (const b of input.blessingsDatabase ?? []) blessingNames[b.id] = b.displayName

  return { nodeNames, itemAffixNames, idolAffixNames, blessingNames }
}

function prettySlot(slot: string): string {
  return slot.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function resolveSourceName(source: ModifierSource, ctx: SourceResolveContext): string {
  const label = source.source_label
  switch (source.source_type) {
    case 'passive_node':
      return ctx.nodeNames[label] ?? label
    case 'gear_slot': {
      // Story 1.7 records gear sources as "{slot_id}:{affix_id}".
      const idx = label.indexOf(':')
      if (idx === -1) return label
      const slot = label.slice(0, idx)
      const affixId = label.slice(idx + 1)
      return `${prettySlot(slot)} · ${ctx.itemAffixNames[affixId] ?? affixId}`
    }
    case 'idol':
      return ctx.idolAffixNames[label] ?? label
    case 'blessing':
      return ctx.blessingNames[label] ?? label
    case 'skill_node':
    case 'condition':
    default:
      // None produced by Story 1.7 — forward-compat raw passthrough.
      return label
  }
}
