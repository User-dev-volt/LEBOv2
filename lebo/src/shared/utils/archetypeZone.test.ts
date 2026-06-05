import { describe, it, expect } from 'vitest'
import { getArchetypeZone } from './archetypeZone'

describe('getArchetypeZone', () => {
  it('maps the five bands by boundary', () => {
    expect(getArchetypeZone(0).name).toBe('Juggernaut')
    expect(getArchetypeZone(19).name).toBe('Juggernaut')
    expect(getArchetypeZone(20).name).toBe('Bulwark')
    expect(getArchetypeZone(39).name).toBe('Bulwark')
    expect(getArchetypeZone(40).name).toBe('Balanced')
    expect(getArchetypeZone(59).name).toBe('Balanced')
    expect(getArchetypeZone(60).name).toBe('Aggressive')
    expect(getArchetypeZone(79).name).toBe('Aggressive')
    expect(getArchetypeZone(80).name).toBe('Glass Cannon')
    expect(getArchetypeZone(100).name).toBe('Glass Cannon')
  })

  it('returns a var(--…) token for the color, never a raw hex', () => {
    for (const pos of [10, 30, 50, 70, 90]) {
      expect(getArchetypeZone(pos).colorVar).toMatch(/^var\(--/)
    }
  })

  it('returns the design sub-caption for each zone', () => {
    expect(getArchetypeZone(10).sub).toBe('Survivability first')
    expect(getArchetypeZone(30).sub).toBe('Defense over offense')
    expect(getArchetypeZone(50).sub).toBe('Equal weight')
    expect(getArchetypeZone(70).sub).toBe('Offense over defense')
    expect(getArchetypeZone(90).sub).toBe('Damage at all costs')
  })
})
