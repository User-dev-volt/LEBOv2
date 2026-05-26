import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { GearNarrativePanel } from './GearNarrativePanel'

describe('GearNarrativePanel', () => {
  it('renders nothing when narrative is null and not generating', () => {
    const { container } = render(<GearNarrativePanel narrative={null} isGenerating={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state when generating with no narrative yet', () => {
    render(<GearNarrativePanel narrative={null} isGenerating={true} />)
    expect(screen.getByTestId('gear-narrative-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('gear-narrative-text')).toBeNull()
  })

  it('shows narrative text when available and not generating', () => {
    render(<GearNarrativePanel narrative="Your Poison Eruption build needs better gear." isGenerating={false} />)
    expect(screen.getByTestId('gear-narrative-text')).toHaveTextContent('Poison Eruption')
    expect(screen.queryByTestId('gear-narrative-loading')).toBeNull()
  })

  it('shows narrative text without loading indicator when complete', () => {
    const { container } = render(
      <GearNarrativePanel narrative="Full narrative." isGenerating={false} />
    )
    const text = screen.getByTestId('gear-narrative-text')
    expect(text).toBeInTheDocument()
    // Cursor span should NOT be present when not generating
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('shows narrative text with cursor when streaming', () => {
    const { container } = render(
      <GearNarrativePanel narrative="Your Poison" isGenerating={true} />
    )
    expect(screen.getByTestId('gear-narrative-text')).toBeInTheDocument()
    // Streaming cursor present when isGenerating + narrative
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
    // Loading message hidden when narrative exists
    expect(screen.queryByTestId('gear-narrative-loading')).toBeNull()
  })

  it('shows the section heading when panel is visible', () => {
    render(<GearNarrativePanel narrative={null} isGenerating={true} />)
    expect(screen.getByText('Gear Analysis')).toBeInTheDocument()
  })

  it('passes axe accessibility check with narrative', async () => {
    const { container } = render(
      <GearNarrativePanel narrative="Full narrative text here." isGenerating={false} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('passes axe accessibility check in loading state', async () => {
    const { container } = render(
      <GearNarrativePanel narrative={null} isGenerating={true} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('passes axe accessibility check in streaming state', async () => {
    const { container } = render(
      <GearNarrativePanel narrative="Streaming text so far." isGenerating={true} />
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})
