import type { DamageType } from '../types/itemDatabase'

export const RARITY_COLORS: Record<string, string> = {
  common:    '#E8E8E8',
  magic:     '#5B9BD5',
  rare:      '#D4AF37',
  unique:    '#E87722',
  set:       '#4CAF50',
  exalted:   '#9C27B0',
  legendary: '#C62828',
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
