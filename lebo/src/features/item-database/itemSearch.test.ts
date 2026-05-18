import { describe, it, expect } from 'vitest'
import { searchItems } from './itemSearch'
import type { ItemDatabase } from '../../shared/types/itemDatabase'

function makeDatabase(overrides?: Partial<ItemDatabase>): ItemDatabase {
  return {
    baseItems: [],
    uniqueItems: [],
    affixes: [],
    ...overrides,
  }
}

describe('searchItems', () => {
  it('ranks prefix-matched items before substring-matched items', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Helm of Juggernaut', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
        { id: 'b2', name: 'Juggernaut Helm', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
      ],
    })
    const results = searchItems('Jugg', db)
    expect(results.length).toBeGreaterThanOrEqual(2)
    const firstName = results[0].name
    expect(firstName).toBe('Juggernaut Helm')
  })

  it('returns items containing the query as a substring', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Iron Helm', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
        { id: 'b2', name: 'Plate Helm', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
        { id: 'b3', name: 'Iron Sword', baseType: 'Sword', slot: 'mainhand', implicitAffixIds: [] },
      ],
    })
    const results = searchItems('helm', db)
    const names = results.map(r => r.name)
    expect(names).toContain('Iron Helm')
    expect(names).toContain('Plate Helm')
    expect(names).not.toContain('Iron Sword')
  })

  it('handles case-insensitive queries', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Juggernaut Helm', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
      ],
    })
    const upper = searchItems('JUGG', db)
    const lower = searchItems('jugg', db)
    expect(upper.length).toBe(lower.length)
    expect(upper[0].name).toBe('Juggernaut Helm')
  })

  it('surfaces the correct item within top 5 for a minor typo (fuzzy match)', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Juggernaut Helm', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
        { id: 'b2', name: 'Iron Shield', baseType: 'Shield', slot: 'offhand', implicitAffixIds: [] },
        { id: 'b3', name: 'Plate Boots', baseType: 'Boots', slot: 'feet', implicitAffixIds: [] },
      ],
    })
    // "Jugernaut" has Levenshtein distance 1 from "juggernaut" (missing one 'g')
    const results = searchItems('Jugernaut', db)
    const top5Names = results.slice(0, 5).map(r => r.name)
    expect(top5Names).toContain('Juggernaut Helm')
  })

  it('returns empty array when no items match', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Iron Helm', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
      ],
      uniqueItems: [
        { id: 'u1', name: 'Shining Ray', baseType: 'Staff', slot: 'twohand', affixes: [] },
      ],
    })
    const results = searchItems('xyzxyz', db)
    expect(results).toEqual([])
  })

  it('searches both base items and unique items, tagging type correctly', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Iron Ring', baseType: 'Ring', slot: 'ring', implicitAffixIds: [] },
      ],
      uniqueItems: [
        { id: 'u1', name: 'Ring of Despair', baseType: 'Ring', slot: 'ring', affixes: [] },
      ],
    })
    const results = searchItems('ring', db)
    const baseResult = results.find(r => r.id === 'b1')
    const uniqueResult = results.find(r => r.id === 'u1')
    expect(baseResult?.type).toBe('base')
    expect(uniqueResult?.type).toBe('unique')
  })

  it('sorts results with equal score alphabetically by name', () => {
    const db = makeDatabase({
      baseItems: [
        { id: 'b1', name: 'Helm of Iron', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
        { id: 'b2', name: 'Helm of Gold', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
        { id: 'b3', name: 'Helm of Silver', baseType: 'Helm', slot: 'head', implicitAffixIds: [] },
      ],
    })
    const results = searchItems('helm', db)
    // All are prefix matches (score 3), so sorted alphabetically
    expect(results[0].name).toBe('Helm of Gold')
    expect(results[1].name).toBe('Helm of Iron')
    expect(results[2].name).toBe('Helm of Silver')
  })

  it('does not cap results internally', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `b${i}`,
      name: `Iron Item ${i}`,
      baseType: 'Generic',
      slot: 'head',
      implicitAffixIds: [] as string[],
    }))
    const db = makeDatabase({ baseItems: items })
    const results = searchItems('iron', db)
    expect(results.length).toBe(20)
  })

  it('completes a search on 1400-item corpus within 50ms (performance benchmark)', () => {
    const baseItems = Array.from({ length: 900 }, (_, i) => ({
      id: `b${i}`,
      name: `Base Item Name ${i} Helm`,
      baseType: 'Helm',
      slot: 'head',
      implicitAffixIds: [] as string[],
    }))
    const uniqueItems = Array.from({ length: 500 }, (_, i) => ({
      id: `u${i}`,
      name: `Unique Item Name ${i} Ring`,
      baseType: 'Ring',
      slot: 'ring',
      affixes: [] as [],
    }))
    const db = makeDatabase({ baseItems, uniqueItems })

    const start = performance.now()
    searchItems('Ite', db)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
  })
})
