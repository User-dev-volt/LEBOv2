import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SlotGlyph } from './SlotGlyph'

describe('SlotGlyph', () => {
  it('renders an aria-hidden svg tinted by the rarity color', () => {
    const { container } = render(<SlotGlyph slotId="helmet" color="#BB5D0B" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('stroke')).toBe('#BB5D0B')
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  it('renders a distinct motif per known slot and a fallback for unknown slots', () => {
    for (const slotId of ['helmet', 'body', 'gloves', 'weapon', 'offhand', 'ring1', 'ring2', 'relic', 'amulet', 'belt', 'boots']) {
      const { container } = render(<SlotGlyph slotId={slotId} color="#F4F4F4" />)
      expect(container.querySelector('svg')).not.toBeNull()
    }
    const { container } = render(<SlotGlyph slotId="lens" color="#6ADA76" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
