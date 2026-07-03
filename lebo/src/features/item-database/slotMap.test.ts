import { describe, it, expect } from 'vitest'
import { GEAR_SLOT_TO_DB_SLOTS, dbSlotsForGearSlot } from './slotMap'
import { GEAR_SLOTS } from '../context-panel/gearData'

describe('slotMap', () => {
  it('maps helmet to both the base/unique (helm) and set (helmet) conventions', () => {
    expect(dbSlotsForGearSlot('helmet')).toEqual(['helm', 'helmet'])
  })

  it('maps body to both chest (base/unique) and body (set)', () => {
    expect(dbSlotsForGearSlot('body')).toEqual(['chest', 'body'])
  })

  it('maps both ring slots to the only shipped ring value (ring_1)', () => {
    expect(dbSlotsForGearSlot('ring1')).toEqual(['ring_1'])
    expect(dbSlotsForGearSlot('ring2')).toEqual(['ring_1'])
  })

  it('maps offhand to off_hand, the set off-hand hyphen variant, and catalyst', () => {
    expect(dbSlotsForGearSlot('offhand')).toEqual(['off_hand', 'off-hand', 'catalyst'])
  })

  it('returns [] for a DB slot that has no equippable gear slot', () => {
    expect(dbSlotsForGearSlot('blessing')).toEqual([])
    expect(dbSlotsForGearSlot('idol')).toEqual([])
    expect(dbSlotsForGearSlot('lens')).toEqual([])
    expect(dbSlotsForGearSlot('nonexistent')).toEqual([])
  })

  it('every GEAR_SLOTS id has a non-empty DB-slot mapping', () => {
    for (const { slotId } of GEAR_SLOTS) {
      expect(GEAR_SLOT_TO_DB_SLOTS[slotId]?.length ?? 0).toBeGreaterThan(0)
    }
  })
})
