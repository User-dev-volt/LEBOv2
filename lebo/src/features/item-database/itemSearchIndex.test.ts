import { describe, it, expect } from 'vitest'
import { buildItemSearchIndex, queryItemIndex, CRAFTABLE_AFFIX_SLOTS } from './itemSearchIndex'
import type { ItemDatabase } from '../../shared/types/itemDatabase'

function makeDatabase(overrides?: Partial<ItemDatabase>): ItemDatabase {
  return { baseItems: [], uniqueItems: [], affixes: [], setItems: [], ...overrides }
}

// Real-shaped fixture: carries levelRequirement + implicit/affix display text (the 4.1.5 fields
// the modal filters and shows). Slots mirror the shipped 3-convention wrinkle: base/unique helms
// are `helm`, the set helm is `helmet`.
const richDb: ItemDatabase = makeDatabase({
  baseItems: [
    {
      id: 'jewelled-circlet', name: 'Jewelled Circlet', baseType: 'Circlet', slot: 'helm',
      implicitAffixIds: [], levelRequirement: 7,
      implicits: [{ text: '(5-25)% increased Spell Damage' }, { text: '+(10-35) Mana' }],
    },
    {
      id: 'iron-casque', name: 'Iron Casque', baseType: 'Plate Helm', slot: 'helm',
      implicitAffixIds: [], levelRequirement: 10, implicits: [{ text: '+14 Armor' }],
    },
    {
      id: 'refuge-helmet', name: 'Refuge Helmet', baseType: 'Helmet', slot: 'helm',
      implicitAffixIds: [], levelRequirement: 0, implicits: [],
    },
    {
      id: 'iron-sword', name: 'Iron Sword', baseType: 'Sword', slot: 'weapon',
      implicitAffixIds: [], levelRequirement: 2, implicits: [],
    },
  ],
  uniqueItems: [
    {
      id: 'calamity', name: 'Calamity', baseType: 'Circlet', slot: 'helm', levelRequirement: 44,
      affixes: [
        { affixId: 'c0', fixedMinValue: 20, fixedMaxValue: 80, text: '(20-80)% increased Fire Damage' },
        { affixId: 'c1', fixedMinValue: 100, fixedMaxValue: 150, text: '+(100-150)% Chance to Ignite' },
      ],
    },
    {
      id: 'snowblind', name: 'Snowblind Grasp', baseType: 'Gloves', slot: 'gloves', levelRequirement: 10,
      affixes: [{ affixId: 's0', fixedMinValue: 1, fixedMaxValue: 2, text: 'Cold conversion' }],
    },
  ],
  setItems: [
    {
      id: 'forgotten-helm', name: 'Vestments of the Forgotten', baseType: 'Helmet', slot: 'helmet',
      setName: 'Forgotten', description: 'A set helm.',
      affixes: [{ affixId: 'f0', fixedMinValue: 1, fixedMaxValue: 1, text: '+1 to All Attributes' }],
      setBonuses: [{ piecesRequired: 2, description: '20% increased Attack Speed' }],
    },
  ],
})

describe('buildItemSearchIndex', () => {
  it('indexes bases, uniques AND set items (sets were absent from the legacy scan)', () => {
    const index = buildItemSearchIndex(richDb)
    expect(index.items).toHaveLength(7)
    expect(index.items.filter((i) => i.type === 'base')).toHaveLength(4)
    expect(index.items.filter((i) => i.type === 'unique')).toHaveLength(2)
    expect(index.items.filter((i) => i.type === 'set')).toHaveLength(1)
  })

  it('computes min/max level bounds across the corpus (for the slider range)', () => {
    const index = buildItemSearchIndex(richDb)
    expect(index.minLevel).toBe(0)
    expect(index.maxLevel).toBe(44)
  })

  it('affix count: unique + set = affixes.length; base = the craftable rule constant', () => {
    const index = buildItemSearchIndex(richDb)
    expect(index.items.find((i) => i.id === 'calamity')!.affixCount).toBe(2)
    expect(index.items.find((i) => i.id === 'snowblind')!.affixCount).toBe(1)
    expect(index.items.find((i) => i.id === 'jewelled-circlet')!.affixCount).toBe(CRAFTABLE_AFFIX_SLOTS)
    // sets are FIXED, not craftable — real affix count, never the base constant (no fabricated "4 slots")
    expect(index.items.find((i) => i.id === 'forgotten-helm')!.affixCount).toBe(1)
  })

  it('precomputes real tooltip lines from base implicits and unique affix text (4.1.5 fields)', () => {
    const index = buildItemSearchIndex(richDb)
    expect(index.items.find((i) => i.id === 'jewelled-circlet')!.tooltipLines).toEqual([
      '(5-25)% increased Spell Damage',
      '+(10-35) Mana',
    ])
    expect(index.items.find((i) => i.id === 'calamity')!.tooltipLines).toContain('(20-80)% increased Fire Damage')
    // No implicit → empty (never a fabricated line)
    expect(index.items.find((i) => i.id === 'refuge-helmet')!.tooltipLines).toEqual([])
  })

  it('surfaces real set data in tooltip lines — affix text + setBonuses description (shipped sets carry power in setBonuses)', () => {
    const index = buildItemSearchIndex(richDb)
    expect(index.items.find((i) => i.id === 'forgotten-helm')!.tooltipLines).toEqual([
      '+1 to All Attributes',
      '20% increased Attack Speed',
    ])
  })
})

describe('queryItemIndex', () => {
  const index = buildItemSearchIndex(richDb)

  it('empty query returns the full set alphabetically (browse-all state)', () => {
    const results = queryItemIndex(index, '')
    expect(results).toHaveLength(7)
    expect(results[0].name).toBe('Calamity')
  })

  it('ranks and filters by query (prefix matches surface, non-matches drop)', () => {
    const results = queryItemIndex(index, 'Iron')
    const names = results.map((r) => r.name)
    expect(names).toContain('Iron Casque')
    expect(names).toContain('Iron Sword')
    expect(names).not.toContain('Calamity')
  })

  it('finds set items by name (previously unsearchable)', () => {
    const results = queryItemIndex(index, 'Vestments')
    expect(results).toHaveLength(1)
    expect(results[0].type).toBe('set')
  })

  it('slot filter narrows to the DB slots for a gear slot — set helm (helmet) included, wrong-slot excluded', () => {
    const helms = queryItemIndex(index, '', { slots: ['helm', 'helmet'] })
    const names = helms.map((r) => r.name)
    expect(names).toContain('Jewelled Circlet') // base, slot 'helm'
    expect(names).toContain('Calamity') // unique, slot 'helm'
    expect(names).toContain('Vestments of the Forgotten') // set, slot 'helmet'
    expect(names).not.toContain('Iron Sword') // weapon
    expect(names).not.toContain('Snowblind Grasp') // gloves
  })

  it('collection filter narrows by rarity-as-collection (Unique hides bases and sets)', () => {
    const uniques = queryItemIndex(index, '', { collection: 'unique' })
    expect(uniques.every((r) => r.type === 'unique')).toBe(true)
    expect(uniques.map((r) => r.name)).toEqual(['Calamity', 'Snowblind Grasp'])
  })

  it('item-level filter narrows by real levelRequirement (low shows, high hides)', () => {
    const lowLevel = queryItemIndex(index, '', { maxLevel: 9 })
    const names = lowLevel.map((r) => r.name)
    expect(names).toContain('Jewelled Circlet') // lvl 7
    expect(names).toContain('Refuge Helmet') // lvl 0
    expect(names).not.toContain('Iron Casque') // lvl 10
    expect(names).not.toContain('Calamity') // lvl 44
  })

  it('builds the index ONCE and answers many queries under 100ms each (NFR-5)', () => {
    const baseItems = Array.from({ length: 900 }, (_, i) => ({
      id: `b${i}`, name: `Base Item Name ${i} Helm`, baseType: 'Helm', slot: 'helm',
      implicitAffixIds: [] as string[], levelRequirement: i % 100,
    }))
    const uniqueItems = Array.from({ length: 500 }, (_, i) => ({
      id: `u${i}`, name: `Unique Item Name ${i} Ring`, baseType: 'Ring', slot: 'ring_1',
      levelRequirement: i % 100, affixes: [] as [],
    }))
    const setItems = Array.from({ length: 23 }, (_, i) => ({
      id: `s${i}`, name: `Set Item Name ${i} Body`, baseType: 'Body', slot: 'body',
      setName: 'S', affixes: [] as [], setBonuses: [] as [],
    }))
    const big = makeDatabase({ baseItems, uniqueItems, setItems })

    const bigIndex = buildItemSearchIndex(big) // built ONCE
    expect(bigIndex.items).toHaveLength(1423)

    for (const q of ['Ite', 'Ring', 'Body', 'name 5', '']) {
      const start = performance.now()
      queryItemIndex(bigIndex, q, { slots: ['helm', 'ring_1', 'body'], minLevel: 0, maxLevel: 100 })
      expect(performance.now() - start).toBeLessThan(100)
    }
  })
})
