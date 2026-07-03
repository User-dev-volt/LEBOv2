import type { ItemDatabase, SearchResult } from '../../shared/types/itemDatabase'
import { scoreLowered } from './itemSearch'

// Documented Last Epoch rule: a craftable base item exposes 4 affix slots (2 prefix + 2 suffix).
// A single declared rule-constant — NOT per-item invented data (Story 4.2 Source Audit).
export const CRAFTABLE_AFFIX_SLOTS = 4

export interface IndexedItem extends SearchResult {
  // Precomputed at build time so per-keystroke query never re-lowercases (NFR-5 prebuilt index).
  nameLower: string
  levelRequirement: number
  affixCount: number
  // Real display text (base implicits / unique+set affix stat lines) — sourced by Story 4.1.5.
  tooltipLines: string[]
}

export interface ItemSearchIndex {
  items: IndexedItem[]
  minLevel: number
  maxLevel: number
}

export interface ItemFilter {
  slots?: string[] // DB `slot` values valid for the open gear slot (undefined = no slot scoping)
  collection?: 'base' | 'unique' | 'set' // rarity-as-collection (undefined = all)
  minLevel?: number
  maxLevel?: number
}

function nonEmptyTexts(texts: (string | undefined)[]): string[] {
  return texts.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
}

// Built ONCE from a loaded ItemDatabase (memoize at the call site). Precomputes lowercased name,
// level, affix count and tooltip lines across bases + uniques + SETS (set items were absent from
// the legacy per-keystroke `searchItems` scan). A query is then a filter + rank over precomputed
// tokens — no scan-from-scratch, no re-lowercasing, no new dependency (AR-8).
export function buildItemSearchIndex(db: ItemDatabase): ItemSearchIndex {
  const items: IndexedItem[] = []

  for (const b of db.baseItems) {
    items.push({
      id: b.id,
      name: b.name,
      baseType: b.baseType,
      slot: b.slot,
      type: 'base',
      nameLower: b.name.toLowerCase(),
      levelRequirement: b.levelRequirement ?? 0,
      affixCount: CRAFTABLE_AFFIX_SLOTS,
      tooltipLines: nonEmptyTexts((b.implicits ?? []).map((i) => i.text)),
    })
  }

  for (const u of db.uniqueItems) {
    items.push({
      id: u.id,
      name: u.name,
      baseType: u.baseType,
      slot: u.slot,
      type: 'unique',
      nameLower: u.name.toLowerCase(),
      levelRequirement: u.levelRequirement ?? 0,
      affixCount: u.affixes.length,
      tooltipLines: nonEmptyTexts(u.affixes.map((a) => a.text)),
    })
  }

  for (const s of db.setItems) {
    items.push({
      id: s.id,
      name: s.name,
      baseType: s.baseType,
      slot: s.slot,
      type: 'set',
      nameLower: s.name.toLowerCase(),
      // SetItem carries no levelRequirement in the shipped data — honest 0 (never level-gated out).
      levelRequirement: 0,
      // Sets are FIXED items, not craftable — their real affix count, never the base craft constant
      // (all shipped sets have affixes:[]; advertising "4 affix slots" would fabricate a value).
      affixCount: s.affixes.length,
      // Real set data lives in setBonuses[].description (shipped affixes[] is empty) — surface those
      // (plus any affix text) so the tooltip shows real bonuses, not a dead/empty hover surface.
      tooltipLines: nonEmptyTexts([
        ...s.affixes.map((a) => a.text),
        ...s.setBonuses.map((b) => b.description),
      ]),
    })
  }

  let minLevel = 0
  let maxLevel = 0
  for (const it of items) {
    if (it.levelRequirement < minLevel) minLevel = it.levelRequirement
    if (it.levelRequirement > maxLevel) maxLevel = it.levelRequirement
  }

  return { items, minLevel, maxLevel }
}

// Filter (slot / collection / level) then rank by query. Empty query returns the full filtered set
// alphabetically (the modal's "browse all" state). Keeps the legacy prefix/substring/fuzzy ranking.
export function queryItemIndex(
  index: ItemSearchIndex,
  query: string,
  filter?: ItemFilter,
): IndexedItem[] {
  const slots = filter?.slots
  const collection = filter?.collection
  const minLevel = filter?.minLevel
  const maxLevel = filter?.maxLevel

  const filtered = index.items.filter((it) => {
    if (slots && !slots.includes(it.slot)) return false
    if (collection && it.type !== collection) return false
    if (minLevel !== undefined && it.levelRequirement < minLevel) return false
    if (maxLevel !== undefined && it.levelRequirement > maxLevel) return false
    return true
  })

  const queryLower = query.trim().toLowerCase()
  if (queryLower.length === 0) {
    return filtered.slice().sort((a, b) => a.name.localeCompare(b.name))
  }

  const scored: { it: IndexedItem; score: number }[] = []
  for (const it of filtered) {
    const score = scoreLowered(it.nameLower, queryLower)
    if (score > 0) scored.push({ it, score })
  }
  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.it.name.localeCompare(b.it.name)))
  return scored.map((s) => s.it)
}
