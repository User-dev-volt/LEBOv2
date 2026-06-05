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

  it('normal (common key) color is #F4F4F4', () => {
    expect(RARITY_COLORS.common).toBe('#F4F4F4')
  })

  it('magic color is #3096D2', () => {
    expect(RARITY_COLORS.magic).toBe('#3096D2')
  })

  it('rare color is #E3D057', () => {
    expect(RARITY_COLORS.rare).toBe('#E3D057')
  })

  it('unique color is #BB5D0B', () => {
    expect(RARITY_COLORS.unique).toBe('#BB5D0B')
  })

  it('set color is #6ADA76', () => {
    expect(RARITY_COLORS.set).toBe('#6ADA76')
  })

  it('exalted color is #A672DB', () => {
    expect(RARITY_COLORS.exalted).toBe('#A672DB')
  })

  it('legendary color is #E12166', () => {
    expect(RARITY_COLORS.legendary).toBe('#E12166')
  })
})

describe('getRarityColorForItemType', () => {
  it('returns unique color (#BB5D0B) for type "unique"', () => {
    expect(getRarityColorForItemType('unique')).toBe('#BB5D0B')
  })

  it('returns normal color (#F4F4F4) for type "base"', () => {
    expect(getRarityColorForItemType('base')).toBe('#F4F4F4')
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
