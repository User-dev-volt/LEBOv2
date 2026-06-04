import { describe, it, expect } from 'vitest'
import { buildSourceResolveContext, resolveSourceName, type SourceResolveContext } from './statSourceLabels'
import type { GameData, GameNode } from '../../shared/types/gameData'
import type { ItemDatabase } from '../../shared/types/itemDatabase'
import type { IdolData, BlessingsDatabase } from '../../shared/types/contextDatabase'
import type { ModifierSource } from '../../shared/types/statSheet'

// The resolver only reads `.name` / `.displayName` / `.id` off these shapes, so minimal casted
// fixtures exercise the real logic without standing up full game-data objects.
function makeCtxInputs() {
  const gameData = {
    classes: {
      sentinel: {
        baseTree: { base_node: { name: 'Base Node' } as GameNode },
        masteries: { paladin: { nodes: { mastery_node: { name: 'Mastery Node' } as GameNode } } },
        skillTrees: { rive: { skill_tree_node: { name: 'Skill Tree Node' } as GameNode } },
      },
    },
  } as unknown as GameData
  const itemDatabase = { affixes: [{ id: 'aff_fire', name: 'Fire Resistance Affix' }] } as unknown as ItemDatabase
  const idolData = {
    idolTypes: [
      {
        prefixPool: [{ id: 'idol_pre', displayName: 'Idol Prefix' }],
        suffixPool: [{ id: 'idol_suf', displayName: 'Idol Suffix' }],
      },
    ],
  } as unknown as IdolData
  const blessingsDatabase = [{ id: 'bless_fire', displayName: 'Blessing of Fire' }] as unknown as BlessingsDatabase
  const weaverGameNodes = { weaver_node: { name: 'Weaver Node' } as GameNode }
  return { gameData, classId: 'sentinel', itemDatabase, idolData, blessingsDatabase, weaverGameNodes }
}

function src(partial: Partial<ModifierSource> & { source_type: ModifierSource['source_type'] }): ModifierSource {
  return { source_label: 'raw_id', value: 10, modifier_type: 'flat', ...partial }
}

describe('buildSourceResolveContext', () => {
  it('merges node names from baseTree, masteries, skillTrees, and weaver nodes', () => {
    const ctx = buildSourceResolveContext(makeCtxInputs())
    expect(ctx.nodeNames).toMatchObject({
      base_node: 'Base Node',
      mastery_node: 'Mastery Node',
      skill_tree_node: 'Skill Tree Node',
      weaver_node: 'Weaver Node',
    })
    expect(ctx.itemAffixNames).toMatchObject({ aff_fire: 'Fire Resistance Affix' })
    expect(ctx.idolAffixNames).toMatchObject({ idol_pre: 'Idol Prefix', idol_suf: 'Idol Suffix' })
    expect(ctx.blessingNames).toMatchObject({ bless_fire: 'Blessing of Fire' })
  })

  it('returns empty maps when nothing is loaded (honest defaults)', () => {
    const ctx = buildSourceResolveContext({
      gameData: null,
      classId: null,
      itemDatabase: null,
      idolData: null,
      blessingsDatabase: null,
      weaverGameNodes: {},
    })
    expect(ctx.nodeNames).toEqual({})
    expect(ctx.itemAffixNames).toEqual({})
    expect(ctx.idolAffixNames).toEqual({})
    expect(ctx.blessingNames).toEqual({})
  })
})

describe('resolveSourceName', () => {
  const ctx: SourceResolveContext = buildSourceResolveContext(makeCtxInputs())

  it('resolves a passive_node label to the node display name', () => {
    expect(resolveSourceName(src({ source_type: 'passive_node', source_label: 'base_node' }), ctx)).toBe('Base Node')
  })

  it('resolves a gear_slot "{slot}:{affix}" label to "Slot · Affix Name"', () => {
    expect(resolveSourceName(src({ source_type: 'gear_slot', source_label: 'body_armor:aff_fire' }), ctx)).toBe(
      'Body Armor · Fire Resistance Affix'
    )
  })

  it('resolves idol and blessing labels to their display names', () => {
    expect(resolveSourceName(src({ source_type: 'idol', source_label: 'idol_pre' }), ctx)).toBe('Idol Prefix')
    expect(resolveSourceName(src({ source_type: 'blessing', source_label: 'bless_fire' }), ctx)).toBe('Blessing of Fire')
  })

  it('falls back to the raw label when no friendly name resolves (never blank, never fabricated)', () => {
    expect(resolveSourceName(src({ source_type: 'passive_node', source_label: 'unknown_node' }), ctx)).toBe('unknown_node')
    expect(resolveSourceName(src({ source_type: 'idol', source_label: 'unknown_idol' }), ctx)).toBe('unknown_idol')
    // gear with an unresolved affix keeps the prettified slot + raw affix id
    expect(resolveSourceName(src({ source_type: 'gear_slot', source_label: 'helmet:mystery' }), ctx)).toBe('Helmet · mystery')
    // gear label with no ":" separator passes through raw
    expect(resolveSourceName(src({ source_type: 'gear_slot', source_label: 'malformed' }), ctx)).toBe('malformed')
  })

  it('passes skill_node / condition labels through raw (forward-compat, none produced today)', () => {
    expect(resolveSourceName(src({ source_type: 'skill_node', source_label: 'skill_x' }), ctx)).toBe('skill_x')
    expect(resolveSourceName(src({ source_type: 'condition', source_label: 'low_health' }), ctx)).toBe('low_health')
  })
})
