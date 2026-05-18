import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { UnspentCounter } from './UnspentCounter'

describe('UnspentCounter', () => {
  it('renders count in gold when count > 0', () => {
    const { container } = render(
      <UnspentCounter count={14} treeType="passive" budgetEnforced={true} />
    )
    // Count is the second child span (first is diamond icon)
    const spans = container.querySelectorAll('span > span')
    const countEl = spans[1] as HTMLElement
    expect(countEl.textContent).toBe('14')
    expect(countEl.style.color).toBe('var(--color-accent-gold)')
  })

  it('renders count in secondary color when count === 0', () => {
    const { container } = render(
      <UnspentCounter count={0} treeType="passive" budgetEnforced={true} />
    )
    const spans = container.querySelectorAll('span > span')
    const countEl = spans[1] as HTMLElement
    expect(countEl.textContent).toBe('0')
    expect(countEl.style.color).toBe('var(--color-text-secondary)')
  })

  it('renders diamond icon matching count color when count > 0', () => {
    const { container } = render(
      <UnspentCounter count={5} treeType="passive" budgetEnforced={true} />
    )
    const spans = container.querySelectorAll('span > span')
    const iconEl = spans[0] as HTMLElement
    expect(iconEl.textContent).toBe('◆')
    expect(iconEl.getAttribute('aria-hidden')).toBe('true')
    expect(iconEl.style.color).toBe('var(--color-accent-gold)')
  })

  it('renders diamond icon in secondary color when count === 0', () => {
    const { container } = render(
      <UnspentCounter count={0} treeType="passive" budgetEnforced={true} />
    )
    const spans = container.querySelectorAll('span > span')
    const iconEl = spans[0] as HTMLElement
    expect(iconEl.style.color).toBe('var(--color-text-secondary)')
  })

  it('shows "(Budget off)" label when budgetEnforced is false', () => {
    render(<UnspentCounter count={5} treeType="passive" budgetEnforced={false} />)
    expect(screen.getByText('(Budget off)')).toBeTruthy()
  })

  it('does not show "(Budget off)" label when budgetEnforced is true', () => {
    render(<UnspentCounter count={5} treeType="passive" budgetEnforced={true} />)
    expect(screen.queryByText('(Budget off)')).toBeNull()
  })

  it('has aria-live="polite" attribute', () => {
    const { container } = render(
      <UnspentCounter count={3} treeType="skill" budgetEnforced={false} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-live')).toBe('polite')
  })

  it('has correct aria-label for passive treeType', () => {
    const { container } = render(
      <UnspentCounter count={7} treeType="passive" budgetEnforced={true} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-label')).toBe('Unspent passive points: 7')
  })

  it('has correct aria-label for skill treeType', () => {
    const { container } = render(
      <UnspentCounter count={3} treeType="skill" budgetEnforced={true} />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('aria-label')).toBe('Unspent skill points: 3')
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(
      <UnspentCounter count={5} treeType="passive" budgetEnforced={false} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
