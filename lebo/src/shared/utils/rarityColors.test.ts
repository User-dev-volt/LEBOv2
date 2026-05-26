import { describe, it, expect } from 'vitest'
import {
  RARITY_COLORS,
  getRarityColorForItemType,
  DAMAGE_TYPE_COLORS,
  getDamageTypeColor,
} from './rarityColors'

describe('RARITY_COLORS', () => {
  it('defines all 7 rarity entries', () => {
    expect(Object.keys(RARITY_COLORS)).toHaveLength(7)
  })

  it('common color is #E8E8E8', () => {
    expect(RARITY_COLORS.common).toBe('#E8E8E8')
  })

  it('magic color is #5B9BD5', () => {
    expect(RARITY_COLORS.magic).toBe('#5B9BD5')
  })

  it('rare color is #D4AF37', () => {
    expect(RARITY_COLORS.rare).toBe('#D4AF37')
  })

  it('unique color is #E87722', () => {
    expect(RARITY_COLORS.unique).toBe('#E87722')
  })

  it('set color is #4CAF50', () => {
    expect(RARITY_COLORS.set).toBe('#4CAF50')
  })

  it('exalted color is #9C27B0', () => {
    expect(RARITY_COLORS.exalted).toBe('#9C27B0')
  })

  it('legendary color is #C62828', () => {
    expect(RARITY_COLORS.legendary).toBe('#C62828')
  })
})

describe('getRarityColorForItemType', () => {
  it('returns unique color (#E87722) for type "unique"', () => {
    expect(getRarityColorForItemType('unique')).toBe('#E87722')
  })

  it('returns common color (#E8E8E8) for type "base"', () => {
    expect(getRarityColorForItemType('base')).toBe('#E8E8E8')
  })
})

describe('DAMAGE_TYPE_COLORS', () => {
  it('defines all 7 damage types', () => {
    expect(Object.keys(DAMAGE_TYPE_COLORS)).toHaveLength(7)
  })

  it('fire maps to var(--color-dmg-fire)', () => {
    expect(DAMAGE_TYPE_COLORS.fire).toBe('var(--color-dmg-fire)')
  })

  it('cold maps to var(--color-dmg-cold)', () => {
    expect(DAMAGE_TYPE_COLORS.cold).toBe('var(--color-dmg-cold)')
  })

  it('lightning maps to var(--color-dmg-lightning)', () => {
    expect(DAMAGE_TYPE_COLORS.lightning).toBe('var(--color-dmg-lightning)')
  })

  it('void maps to var(--color-dmg-void)', () => {
    expect(DAMAGE_TYPE_COLORS.void).toBe('var(--color-dmg-void)')
  })

  it('poison maps to var(--color-dmg-poison)', () => {
    expect(DAMAGE_TYPE_COLORS.poison).toBe('var(--color-dmg-poison)')
  })

  it('physical maps to var(--color-dmg-physical)', () => {
    expect(DAMAGE_TYPE_COLORS.physical).toBe('var(--color-dmg-physical)')
  })

  it('bleed maps to var(--color-dmg-bleed)', () => {
    expect(DAMAGE_TYPE_COLORS.bleed).toBe('var(--color-dmg-bleed)')
  })
})

describe('getDamageTypeColor', () => {
  it('returns the correct CSS var for fire', () => {
    expect(getDamageTypeColor('fire')).toBe('var(--color-dmg-fire)')
  })

  it('returns the correct CSS var for physical', () => {
    expect(getDamageTypeColor('physical')).toBe('var(--color-dmg-physical)')
  })

  it('returns the correct CSS var for bleed', () => {
    expect(getDamageTypeColor('bleed')).toBe('var(--color-dmg-bleed)')
  })
})
