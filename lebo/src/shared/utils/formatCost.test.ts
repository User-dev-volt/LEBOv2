import { describe, it, expect } from 'vitest'
import { formatPtCost, formatCostLine } from './formatCost'

describe('formatPtCost', () => {
  it('pluralizes correctly', () => {
    expect(formatPtCost(1)).toBe('1 pt')
    expect(formatPtCost(2)).toBe('2 pts')
    expect(formatPtCost(0)).toBe('0 pts')
  })
})

describe('formatCostLine', () => {
  it('renders the full FR-19 form when there is a path cost', () => {
    expect(formatCostLine(2, 4)).toBe('2 pts / 4 pts to reach')
    expect(formatCostLine(1, 3)).toBe('1 pt / 3 pts to reach')
  })

  it('drops the "to reach" clause when the node is directly reachable', () => {
    expect(formatCostLine(2, 0)).toBe('2 pts')
    expect(formatCostLine(1, 0)).toBe('1 pt')
  })
})
