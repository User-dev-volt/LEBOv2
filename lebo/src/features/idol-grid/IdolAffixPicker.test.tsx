import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { IdolAffixPicker } from './IdolAffixPicker'
import type { IdolType } from '../../shared/types/contextDatabase'

const smallIdolType: IdolType = {
  id: 'small-1x1',
  displayName: 'Small Idol',
  rows: 1,
  cols: 1,
  requiresBoth: false,
  prefixPool: [
    {
      id: 'idol-small-fire-res',
      displayName: 'Fireward',
      type: 'prefix',
      statKey: 'fire_resistance',
      modifierType: 'flat',
      tiers: [
        { tier: 1, minValue: 3, maxValue: 4 },
        { tier: 2, minValue: 5, maxValue: 6 },
        { tier: 3, minValue: 7, maxValue: 9 },
      ],
    },
    {
      id: 'idol-small-cold-res',
      displayName: 'Frostward',
      type: 'prefix',
      statKey: 'cold_resistance',
      modifierType: 'flat',
      tiers: [
        { tier: 1, minValue: 3, maxValue: 4 },
        { tier: 2, minValue: 5, maxValue: 6 },
        { tier: 3, minValue: 7, maxValue: 9 },
      ],
    },
  ],
  suffixPool: [],
}

const humbleIdolType: IdolType = {
  id: 'humble-1x2',
  displayName: 'Humble Idol',
  rows: 1,
  cols: 2,
  requiresBoth: true,
  prefixPool: [
    {
      id: 'idol-humble-max-hp',
      displayName: 'Stalwart',
      type: 'prefix',
      statKey: 'max_hp',
      modifierType: 'flat',
      tiers: [
        { tier: 1, minValue: 20, maxValue: 30 },
        { tier: 2, minValue: 35, maxValue: 45 },
        { tier: 3, minValue: 50, maxValue: 65 },
      ],
    },
  ],
  suffixPool: [
    {
      id: 'idol-humble-crit-chance',
      displayName: 'Sharpshooting',
      type: 'suffix',
      statKey: 'critical_strike_chance',
      modifierType: 'flat',
      tiers: [
        { tier: 1, minValue: 5, maxValue: 7 },
        { tier: 2, minValue: 8, maxValue: 10 },
        { tier: 3, minValue: 12, maxValue: 15 },
      ],
    },
  ],
}

describe('IdolAffixPicker', () => {
  it('renders prefix-only for Small Idol (no suffix section)', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    render(
      <IdolAffixPicker
        idolType={smallIdolType}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
      />
    )
    expect(screen.getByRole('combobox', { name: /Select prefix affix/i })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /Select suffix affix/i })).not.toBeInTheDocument()
  })

  it('renders both prefix and suffix selects for Humble Idol', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
      />
    )
    expect(screen.getByRole('combobox', { name: /Select prefix affix/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Select suffix affix/i })).toBeInTheDocument()
  })

  it('prefix affix select in edit mode calls onPrefixChange with affixId and T1 tier', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    // Edit mode: no onConfirm prop
    render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
      />
    )
    const prefixSelect = screen.getByRole('combobox', { name: /Select prefix affix/i })
    fireEvent.change(prefixSelect, { target: { value: 'idol-humble-max-hp' } })
    expect(onPrefixChange).toHaveBeenCalledWith('idol-humble-max-hp', 1)
  })

  it('prefix tier change in edit mode calls onPrefixChange with updated tier', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    // Edit mode with initial prefix already set
    render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        prefixId="idol-humble-max-hp"
        prefixTier={1}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
      />
    )
    const tierSelect = screen.getByRole('combobox', { name: /Prefix tier/i })
    fireEvent.change(tierSelect, { target: { value: '3' } })
    expect(onPrefixChange).toHaveBeenCalledWith('idol-humble-max-hp', 3)
  })

  it('placement mode: Place button has aria-disabled when no prefix selected', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <IdolAffixPicker
        idolType={smallIdolType}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    const placeBtn = screen.getByRole('button', { name: /Place idol/i })
    expect(placeBtn).toHaveAttribute('aria-disabled', 'true')
  })

  it('placement mode: Place button disabled when Humble Idol has only prefix (requiresBoth)', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        prefixId="idol-humble-max-hp"
        prefixTier={1}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    const placeBtn = screen.getByRole('button', { name: /Place idol/i })
    expect(placeBtn).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent(/requires both a prefix and suffix/i)
  })

  it('placement mode: Place button enabled when both prefix and suffix set', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        prefixId="idol-humble-max-hp"
        prefixTier={2}
        suffixId="idol-humble-crit-chance"
        suffixTier={1}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    const placeBtn = screen.getByRole('button', { name: /Place idol/i })
    expect(placeBtn).toHaveAttribute('aria-disabled', 'false')
    expect(placeBtn).not.toBeDisabled()
  })

  it('placement mode: Place button calls onConfirm with correct state', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        prefixId="idol-humble-max-hp"
        prefixTier={2}
        suffixId="idol-humble-crit-chance"
        suffixTier={3}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Place idol/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      prefixId: 'idol-humble-max-hp',
      prefixTier: 2,
      suffixId: 'idol-humble-crit-chance',
      suffixTier: 3,
    })
  })

  it('placement mode: Cancel button calls onCancel', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <IdolAffixPicker
        idolType={smallIdolType}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Cancel idol placement/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('edit mode: no Place or Cancel buttons rendered', () => {
    const onPrefixChange = vi.fn()
    const onSuffixChange = vi.fn()
    render(
      <IdolAffixPicker
        idolType={smallIdolType}
        onPrefixChange={onPrefixChange}
        onSuffixChange={onSuffixChange}
        // no onConfirm → edit mode
      />
    )
    expect(screen.queryByRole('button', { name: /Place idol/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cancel idol placement/i })).not.toBeInTheDocument()
  })

  it('accessibility: no violations', async () => {
    const { container } = render(
      <IdolAffixPicker
        idolType={humbleIdolType}
        onPrefixChange={vi.fn()}
        onSuffixChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
