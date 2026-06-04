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

  it('groups sources into the six categories in the fixed FR-13 order', () => {
    render(
      <StatSourceTooltip
        id="t2"
        statLabel="Mixed"
        position={POS}
        // Intentionally scrambled input order — output must follow the fixed order.
        sources={[
          src({ sourceType: 'condition', name: 'Cond' }),
          src({ sourceType: 'gear_slot', name: 'Gear' }),
          src({ sourceType: 'blessing', name: 'Bless' }),
          src({ sourceType: 'passive_node', name: 'Passive' }),
          src({ sourceType: 'skill_node', name: 'Skill' }),
          src({ sourceType: 'idol', name: 'Idol' }),
        ]}
      />
    )
    const text = screen.getByRole('tooltip').textContent ?? ''
    const order = ['Passive Nodes', 'Gear', 'Idols', 'Blessings', 'Skills', 'Conditions']
    const positions = order.map((h) => text.indexOf(h))
    expect(positions.every((p) => p >= 0)).toBe(true)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }
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

  it('renders the at/over-cap footer (pre-cap total above cap, capped at 75%)', () => {
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
    expect(screen.getByText('capped at 75%')).toBeInTheDocument()
    expect(screen.queryByText(/to cap/)).toBeNull()
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
