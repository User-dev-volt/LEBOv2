import type { ItemDatabase, SearchResult } from '../../shared/types/itemDatabase'

export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

// Ranks an already-lowercased name against a lowercased query. Exported so the prebuilt
// search index (itemSearchIndex.ts) can score precomputed tokens without re-lowercasing per keystroke.
export function scoreLowered(nameLower: string, queryLower: string): number {
  if (nameLower.startsWith(queryLower)) return 3
  if (nameLower.includes(queryLower)) return 2
  // Fuzzy: check each word in the name individually so "Jugernaut" matches "Juggernaut Helm"
  const threshold = Math.floor(queryLower.length / 3) + 1
  const words = nameLower.split(/\s+/)
  for (const word of words) {
    if (levenshtein(word, queryLower) <= threshold) return 1
  }
  return 0
}

function scoreItem(name: string, queryLower: string): number {
  return scoreLowered(name.toLowerCase(), queryLower)
}

export function searchItems(query: string, database: ItemDatabase): SearchResult[] {
  const queryLower = query.toLowerCase()

  interface Scored extends SearchResult {
    score: number
  }

  const results: Scored[] = []

  for (const item of database.baseItems) {
    const score = scoreItem(item.name, queryLower)
    if (score > 0) {
      results.push({ id: item.id, name: item.name, baseType: item.baseType, slot: item.slot, type: 'base', score })
    }
  }

  for (const item of database.uniqueItems) {
    const score = scoreItem(item.name, queryLower)
    if (score > 0) {
      results.push({ id: item.id, name: item.name, baseType: item.baseType, slot: item.slot, type: 'unique', score })
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.name.localeCompare(b.name)
  })

  return results.map(r => ({
    id: r.id,
    name: r.name,
    baseType: r.baseType,
    slot: r.slot,
    type: r.type,
  }))
}
