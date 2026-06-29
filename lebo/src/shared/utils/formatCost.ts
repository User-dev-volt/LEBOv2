// Shared point/path-cost formatting (FR-19/FR-18). The optimization suggestion card and the
// skill-tree canvas tooltip both render this line and cross-feature imports are forbidden.

export function formatPtCost(n: number): string {
  return `${n} pt${n === 1 ? '' : 's'}`
}

// e.g. "2 pts / 4 pts to reach". The "/ M pts to reach" clause is dropped when the node is directly
// reachable (pathCost === 0) — no fabricated "0 pts to reach".
export function formatCostLine(pointCost: number, pathCost: number): string {
  return pathCost > 0
    ? `${formatPtCost(pointCost)} / ${formatPtCost(pathCost)} to reach`
    : formatPtCost(pointCost)
}
