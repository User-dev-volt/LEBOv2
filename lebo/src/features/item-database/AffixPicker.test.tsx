import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { AffixPicker } from './AffixPicker'
import type { AffixEntry } from '../../shared/types/itemDatabase'

const mockAffixes: AffixEntry[] = [
  {
    id: 'affix-armor',
    name: 'Added Armor',
    type: 'implicit',
    itemSlots: ['helmet'],
    tiers: [
      { tier: 1, minValue: 10, maxValue: 20 },
      { tier: 2, minValue: 21, maxValue: 40 },
      { tier: 3, minValue: 41, maxValue: 60 },
    ],
  },
  {
    id: 'affix-life',
    name: 'Increased Health',
    type: 'prefix',
    itemSlots: ['body'],
    tiers: [
      { tier: 1, minValue: 10, maxValue: 20 },
      { tier: 2, minValue: 21, maxValue: 40 },
    ],
  },
  {
    id: 'affix-speed',
    name: 'Movement Speed',
    type: 'suffix',
    itemSlots: ['boots'],
    tiers: [{ tier: 1, minValue: 5, maxValue: 10 }],
  },
]

describe('AffixPicker', () => {
  it('renders an input with placeholder "Search affixes…"', () => {
    render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByPlaceholderText('Search affixes…')).toBeInTheDocument()
  })

  it('empty query shows affixes from allAffixes (up to cap of 8)', async () => {
    render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Added Armor')).toBeInTheDocument()
      expect(screen.getByText('Increased Health')).toBeInTheDocument()
      expect(screen.getByText('Movement Speed')).toBeInTheDocument()
    })
  })

  it('typing filters affixes by name', async () => {
    render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const input = screen.getByPlaceholderText('Search affixes…')
    await userEvent.type(input, 'health')

    await waitFor(() => {
      expect(screen.getByText('Increased Health')).toBeInTheDocument()
    })
    expect(screen.queryByText('Added Armor')).toBeNull()
    expect(screen.queryByText('Movement Speed')).toBeNull()
  })

  it('excludeIds hides excluded affixes from results', async () => {
    render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={['affix-armor']}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Increased Health')).toBeInTheDocument()
    })
    expect(screen.queryByText('Added Armor')).toBeNull()
  })

  it('selecting an option calls onSelect with the full AffixEntry and calls onClose', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={[]}
        onSelect={onSelect}
        onClose={onClose}
      />
    )
    await waitFor(() => {
      expect(screen.getByText('Movement Speed')).toBeInTheDocument()
    })
    await userEvent.click(screen.getByText('Movement Speed'))

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(mockAffixes[2])
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('pressing Escape calls onClose', async () => {
    const onClose = vi.fn()
    render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={[]}
        onSelect={vi.fn()}
        onClose={onClose}
      />
    )
    const input = screen.getByPlaceholderText('Search affixes…')
    await userEvent.type(input, '{Escape}')

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('axe accessibility: zero violations', async () => {
    const { container } = render(
      <AffixPicker
        allAffixes={mockAffixes}
        excludeIds={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
