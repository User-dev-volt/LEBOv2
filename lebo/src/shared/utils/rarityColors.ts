import type { DamageType } from '../types/itemDatabase'

// Verified against Last Epoch's in-game palette (via LastEpochTools.com, 2026-06-04).
// Keys kept as-is (P4-8: no rename); `common` = LE "Normal" tier.
export const RARITY_COLORS: Record<string, string> = {
  common:    '#F4F4F4', // Normal — white
  magic:     '#3096D2', // azure
  rare:      '#E3D057', // gold
  unique:    '#BB5D0B', // orange-brown
  set:       '#6ADA76', // green
  exalted:   '#A672DB', // purple
  legendary: '#E12166', // red
}

export function getRarityColorForItemType(type: 'base' | 'unique'): string {
  return type === 'unique' ? RARITY_COLORS.unique : RARITY_COLORS.common
}

export const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  physical: 'var(--color-dmg-physical)',
  fire:     'var(--color-dmg-fire)',
  cold:     'var(--color-dmg-cold)',
  lightning: 'var(--color-dmg-lightning)',
  void:     'var(--color-dmg-void)',
  poison:   'var(--color-dmg-poison)',
  bleed:    'var(--color-dmg-bleed)',
}

export function getDamageTypeColor(type: DamageType): string {
  return DAMAGE_TYPE_COLORS[type]
}
