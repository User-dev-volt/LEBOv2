import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { WeaverTreePlaceholder } from './WeaverTreePlaceholder'

describe('WeaverTreePlaceholder', () => {
  it('renders the placeholder message', () => {
    render(<WeaverTreePlaceholder />)
    expect(
      screen.getByText(
        'Weaver Tree planning is in research. Node data is not available from community sources.'
      )
    ).toBeTruthy()
  })

  it('has role="region" and aria-label="Weaver Tree"', () => {
    const { container } = render(<WeaverTreePlaceholder />)
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('role')).toBe('region')
    expect(root.getAttribute('aria-label')).toBe('Weaver Tree')
  })

  it('passes axe accessibility check', async () => {
    const { container } = render(<WeaverTreePlaceholder />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has CSS background-image for weaver texture', () => {
    const { container } = render(<WeaverTreePlaceholder />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.backgroundImage).toContain('bg_weaver_tile')
  })
})
