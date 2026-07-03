// Maps a GEAR_SLOTS id (context-panel/gearData.ts) → the item-DB `slot` values valid for it.
//
// The shipped item DB uses THREE slot-naming conventions (data-verified 2026-07-03 over
// src-tauri/resources/items/*.json): base + unique items use `helm` / `chest` / `off_hand`;
// set items use `helmet` / `body` / `off-hand` (note the hyphen). Only `ring_1` exists in the
// data (no `ring_2`) — both ring slots map to it. `catalyst` is a caster off-hand item, so it
// maps to `offhand`. DB slots that have no equippable gear slot (`blessing`, `idol`, `lens`) are
// intentionally unmapped — those live in their own systems and must not surface in a gear picker.
export const GEAR_SLOT_TO_DB_SLOTS: Record<string, string[]> = {
  helmet: ['helm', 'helmet'],
  body: ['chest', 'body'],
  gloves: ['gloves'],
  belt: ['belt'],
  boots: ['boots'],
  ring1: ['ring_1'],
  ring2: ['ring_1'],
  amulet: ['amulet'],
  relic: ['relic'],
  weapon: ['weapon'],
  offhand: ['off_hand', 'off-hand', 'catalyst'],
}

// The DB `slot` values valid for a GEAR_SLOTS id, or [] when the id has no DB mapping.
export function dbSlotsForGearSlot(gearSlotId: string): string[] {
  return GEAR_SLOT_TO_DB_SLOTS[gearSlotId] ?? []
}
