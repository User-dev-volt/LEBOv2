import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'vitest-axe'
import { AffixTierControl } from './AffixTierControl'
import type { AffixEntry } from '../../shared/types/itemDatabase'

const mockAffixEntry: AffixEntry = {
  id: 'test-affix',
  name: 'Added Fire Damage',
  type: 'prefix',
  itemSlots: [],
  tiers: [
    { tier: 1, minValue: 1, maxValue: 5 },
    { tier: 2, minValue: 6, maxValue: 12 },
    { tier: 3, minValue: 13, maxValue: 20 },
    { tier: 4, minValue: 21, maxValue: 30 },
  ],
}

function renderControl(currentTier: number, onChange = vi.fn()) {
  return render(
    <AffixTierControl
      affixEntry={mockAffixEntry}
      currentTier={currentTier}
      onChange={onChange}
    />
  )
}

describe('AffixTierControl', () => {
  test('clicking pip 3 calls onChange(3)', async () => {
    const onChange = vi.fn()
    const { container } = renderControl(1, onChange)
    const pips = container.querySelectorAll('[aria-hidden="true"]')
    await userEvent.click(pips[2])
    expect(onChange).toHaveBeenCalledWith(3)
  })

  test('keyboard Right arrow at tier 2 calls onChange(3)', async () => {
    const onChange = vi.fn()
    renderControl(2, onChange)
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith(3)
  })

  test('keyboard Left arrow at tier 2 calls onChange(1)', async () => {
    const onChange = vi.fn()
    renderControl(2, onChange)
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenCalledWith(1)
  })

  test('keyboard Right arrow at max tier does NOT call onChange', async () => {
    const onChange = vi.fn()
    renderControl(4, onChange)
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('keyboard Left arrow at tier 1 does NOT call onChange', async () => {
    const onChange = vi.fn()
    renderControl(1, onChange)
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('aria-valuetext shows correct min–max string for current tier', () => {
    renderControl(2)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuetext', 'Tier 2: 6–12')
  })

  test('aria-valuetext shows single value when min equals max', () => {
    const singleValueAffix: AffixEntry = {
      ...mockAffixEntry,
      tiers: [{ tier: 1, minValue: 10, maxValue: 10 }],
    }
    render(
      <AffixTierControl affixEntry={singleValueAffix} currentTier={1} onChange={vi.fn()} />
    )
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuetext', 'Tier 1: 10')
  })

  test('single-tier: Left and Right arrow both do NOT call onChange', async () => {
    const onChange = vi.fn()
    const singleTierAffix: AffixEntry = {
      ...mockAffixEntry,
      tiers: [{ tier: 1, minValue: 10, maxValue: 10 }],
    }
    render(
      <AffixTierControl affixEntry={singleTierAffix} currentTier={1} onChange={onChange} />
    )
    const slider = screen.getByRole('slider')
    slider.focus()
    await userEvent.keyboard('{ArrowRight}')
    await userEvent.keyboard('{ArrowLeft}')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('axe accessibility: zero violations', async () => {
    const { container } = renderControl(2)
    expect(await axe(container)).toHaveNoViolations()
  })
})
