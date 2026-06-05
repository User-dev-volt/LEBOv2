export interface ArchetypeZone {
  name: string
  sub: string
  colorVar: string
}

// Single source of truth for the Optimization Intent slider's five zones (UX-DR5).
// `position` is 0..100 (0 = Juggernaut / survivability-first, 100 = Glass Cannon / damage-first).
// colorVar returns a `var(--…)` token string so callers never inline a hex (Pattern P4-8).
export function getArchetypeZone(position: number): ArchetypeZone {
  if (position < 20) {
    return {
      name: 'Juggernaut',
      sub: 'Survivability first',
      colorVar: 'var(--color-slider-juggernaut)',
    }
  }
  if (position < 40) {
    return {
      name: 'Bulwark',
      sub: 'Defense over offense',
      colorVar: 'var(--color-node-available)',
    }
  }
  if (position < 60) {
    return {
      name: 'Balanced',
      sub: 'Equal weight',
      colorVar: 'var(--color-accent-gold)',
    }
  }
  if (position < 80) {
    return {
      name: 'Aggressive',
      sub: 'Offense over defense',
      colorVar: 'var(--color-zone-aggressive)',
    }
  }
  return {
    name: 'Glass Cannon',
    sub: 'Damage at all costs',
    colorVar: 'var(--color-slider-glass-cannon)',
  }
}
