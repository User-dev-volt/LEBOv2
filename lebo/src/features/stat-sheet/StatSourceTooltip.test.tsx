import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { StatSourceTooltip, formatContribution, type ResolvedSource } from './StatSourceTooltip'

const POS = { x: 100, y: 100 }

function src(partial: Partial<ResolvedSource> & { sourceType: ResolvedSource['sourceType'] }): ResolvedSource {
  return { name: 'Source', value: 10, modifierType: 'flat', ...partial }
}

describe('formatContribution', () => {
  it('formats flat with the row unit', () => {
    expect(formatContribution(src({ sourceType: 'passive_node', value: 12, modifierType: 'flat' }), '%')).toBe('+12%')
  })
  it('formats flat without a unit', () => {
    expect(formatContribution(src({ sourceType: 'passive_node', value: 30, modifierType: 'flat' }), '')).toBe('+30')
  })
  it('formats increased / more / conversion', () => {
    expect(formatContribution(src({ sourceType: 'gear_slot', value: 30, modifierType: 'increased' }), '%')).toBe('+30% increased')
    expect(formatContribution(src({ sourceType: 'gear_slot', value: 15, modifierType: 'more' }), '%')).toBe('+15% more')
    expect(formatContribution(src({ sourceType: 'gear_slot', value: 25, modifierType: 'conversion' }), '%')).toBe('25% conversion')
  })
  it('keeps the sign on negative values', () => {
    expect(formatContribution(src({ sourceType: 'idol', value: -5, modifierType: 'flat' }), '%')).toBe('-5%')
  })
})

describe('StatSourceTooltip', () => {
  it('renders role="tooltip" with the stat label', () => {
    render(
      <StatSourceTooltip
        id="t1"
        statLabel="Fire Res"
        position={POS}
        sources={[src({ sourceType: 'passive_node', name: 'Fire Node', value: 30 })]}
      />
    )
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Fire Res')
    expect(tip).toHaveTextContent('Fire Node')
    expect(tip).toHaveTextContent('+30')
  })

  it('groups sources into the six categories in the fixed FR-13 order, each item under its own header', () => {
    render(
      <StatSourceTooltip
        id="t2"
        statLabel="Mixed"
        position={POS}
        // Intentionally scrambled input order — output must follow the fixed order, and each item
        // must render under its own category header (names are distinct from the headers).
        sources={[
          src({ sourceType: 'condition', name: 'CondItem' }),
          src({ sourceType: 'gear_slot', name: 'GearItem' }),
          src({ sourceType: 'blessing', name: 'BlessItem' }),
          src({ sourceType: 'passive_node', name: 'PassiveItem' }),
          src({ sourceType: 'skill_node', name: 'SkillItem' }),
          src({ sourceType: 'idol', name: 'IdolItem' }),
        ]}
      />
    )
    const text = screen.getByRole('tooltip').textContent ?? ''
    // Header immediately followed by its item, in the fixed category order — proves placement,
    // not merely that the headers appear in order.
    const sequence = [
      'Passive Nodes',
      'PassiveItem',
      'Gear',
      'GearItem',
      'Idols',
      'IdolItem',
      'Blessings',
      'BlessItem',
      'Skills',
      'SkillItem',
      'Conditions',
      'CondItem',
    ]
    const positions = sequence.map((token) => text.indexOf(token))
    expect(positions.every((p) => p >= 0)).toBe(true)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
  })

  it('aggregates per-point duplicate sources into one line with a point count', () => {
    render(
      <StatSourceTooltip
        id="t2b"
        statLabel="Fire Res"
        unit="%"
        position={POS}
        // Story 1.7 records one source per allocated point: a 3-point node arrives as 3 entries.
        sources={[
          src({ sourceType: 'passive_node', name: 'Fervor', value: 5, modifierType: 'flat' }),
          src({ sourceType: 'passive_node', name: 'Fervor', value: 5, modifierType: 'flat' }),
          src({ sourceType: 'passive_node', name: 'Fervor', value: 5, modifierType: 'flat' }),
        ]}
      />
    )
    const tip = screen.getByRole('tooltip')
    // One collapsed line: summed value + point count.
    expect(screen.getAllByText('Fervor')).toHaveLength(1)
    expect(tip).toHaveTextContent('+15%')
    expect(tip).toHaveTextContent('(3 pts)')
  })

  it('shows "Base value only." for an empty source list', () => {
    render(<StatSourceTooltip id="t3" statLabel="Strength" position={POS} sources={[]} />)
    expect(screen.getByText('Base value only.')).toBeInTheDocument()
  })

  it('renders the below-cap footer (pre-cap total + gap to cap)', () => {
    render(
      <StatSourceTooltip
        id="t4"
        statLabel="Fire Res"
        unit="%"
        position={POS}
        sources={[src({ sourceType: 'passive_node', name: 'Node', value: 68 })]}
        capInfo={{ preCapTotal: 68, cap: 75, gap: 7 }}
      />
    )
    expect(screen.getByText(/Pre-cap total: 68%/)).toBeInTheDocument()
    expect(screen.getByText('+7% to cap')).toBeInTheDocument()
  })

  it('renders the at/over-cap footer with the cuttable overcap headroom', () => {
    render(
      <StatSourceTooltip
        id="t5"
        statLabel="Fire Res"
        unit="%"
        position={POS}
        sources={[src({ sourceType: 'passive_node', name: 'Node', value: 92 })]}
        capInfo={{ preCapTotal: 92, cap: 75, gap: null }}
      />
    )
    expect(screen.getByText(/Pre-cap total: 92%/)).toBeInTheDocument()
    // At/over cap: shows the cap and how much resistance can be cut (92 − 75 = 17).
    expect(screen.getByText(/capped at 75%/)).toBeInTheDocument()
    expect(screen.getByText(/17% over cap/)).toBeInTheDocument()
    // No below-cap "+N% to cap" prompt when at/over cap.
    expect(screen.queryByText(/to cap/)).toBeNull()
  })

  it('omits the overcap suffix when exactly at cap', () => {
    render(
      <StatSourceTooltip
        id="t5b"
        statLabel="Fire Res"
        unit="%"
        position={POS}
        sources={[src({ sourceType: 'passive_node', name: 'Node', value: 75 })]}
        capInfo={{ preCapTotal: 75, cap: 75, gap: null }}
      />
    )
    expect(screen.getByText('capped at 75%')).toBeInTheDocument()
    expect(screen.queryByText(/over cap/)).toBeNull()
  })

  it('has zero axe violations', async () => {
    render(
      <StatSourceTooltip
        id="t6"
        statLabel="Fire Res"
        unit="%"
        position={POS}
        sources={[
          src({ sourceType: 'passive_node', name: 'Node', value: 30 }),
          src({ sourceType: 'idol', name: 'Idol', value: 18 }),
        ]}
        capInfo={{ preCapTotal: 48, cap: 75, gap: 27 }}
      />
    )
    // `region` is a page-level landmark rule; a portaled overlay legitimately sits outside
    // landmarks, so it is disabled for this isolated tooltip render (false positive here).
    expect(await axe(document.body, { rules: { region: { enabled: false } } })).toHaveNoViolations()
  })
})
