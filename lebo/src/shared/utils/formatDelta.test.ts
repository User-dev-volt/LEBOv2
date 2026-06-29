import { describe, it, expect } from 'vitest'
import { formatDelta, getDeltaIndicator, getDeltaColor } from './formatDelta'

describe('formatDelta', () => {
  it('prefixes a positive value with +', () => {
    expect(formatDelta(4)).toBe('+4')
  })
  it('keeps a negative value as-is', () => {
    expect(formatDelta(-2)).toBe('-2')
  })
  it('renders zero as ±0', () => {
    expect(formatDelta(0)).toBe('±0')
  })
  it('renders null as ?', () => {
    expect(formatDelta(null)).toBe('?')
  })
})

describe('getDeltaIndicator', () => {
  it('uses ▲ for positive, ▼ for negative, ◈ for zero/null', () => {
    expect(getDeltaIndicator(3)).toBe('▲')
    expect(getDeltaIndicator(-3)).toBe('▼')
    expect(getDeltaIndicator(0)).toBe('◈')
    expect(getDeltaIndicator(null)).toBe('◈')
  })
})

describe('getDeltaColor', () => {
  it('maps sign to the data tokens, neutral for zero/null', () => {
    expect(getDeltaColor(3)).toBe('var(--color-data-positive)')
    expect(getDeltaColor(-3)).toBe('var(--color-data-negative)')
    expect(getDeltaColor(0)).toBe('var(--color-data-neutral)')
    expect(getDeltaColor(null)).toBe('var(--color-data-neutral)')
  })
})
