import type { DamageType } from '../types/itemDatabase'

export const RARITY_COLORS: Record<string, string> = {
  common:    '#C6C0B5', // Last Epoch "Normal" tier — key kept as `common` (P4-8: no rename)
  magic:     '#4A7A9E',
  rare:      '#C9A84C',
  unique:    '#D4805A',
  set:       '#5EBD78',
  exalted:   '#9C27B0',
  legendary: '#B068E8',
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
