import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptimizeButton } from './OptimizeButton'

describe('OptimizeButton', () => {
  it('renders "Optimize" text in normal state', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={false} />)
    expect(screen.getByTestId('optimize-button')).toHaveTextContent('Optimize')
  })

  it('renders "Analyzing..." text when isOptimizing', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={true} />)
    expect(screen.getByTestId('optimize-button')).toHaveTextContent('Analyzing...')
  })

  it('renders loading indicator when isOptimizing', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={true} />)
    expect(screen.getByTestId('optimize-loading-indicator')).toBeInTheDocument()
  })

  it('does not render loading indicator in normal state', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={false} />)
    expect(screen.queryByTestId('optimize-loading-indicator')).toBeNull()
  })

  it('renders sub-text "This usually takes 20–30 seconds" when isOptimizing', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={true} />)
    expect(screen.getByText(/20.30 seconds/)).toBeInTheDocument()
  })

  it('does not render sub-text in normal state', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={false} />)
    expect(screen.queryByText(/20.30 seconds/)).toBeNull()
  })

  it('calls onOptimize when clicked in normal state', async () => {
    const onOptimize = vi.fn()
    render(<OptimizeButton onOptimize={onOptimize} disabled={false} isOptimizing={false} />)
    await userEvent.click(screen.getByTestId('optimize-button'))
    expect(onOptimize).toHaveBeenCalledTimes(1)
  })

  it('does not call onOptimize when disabled', async () => {
    const onOptimize = vi.fn()
    render(<OptimizeButton onOptimize={onOptimize} disabled={true} isOptimizing={false} />)
    await userEvent.click(screen.getByTestId('optimize-button'))
    expect(onOptimize).not.toHaveBeenCalled()
  })

  it('does not call onOptimize when isOptimizing', async () => {
    const onOptimize = vi.fn()
    render(<OptimizeButton onOptimize={onOptimize} disabled={false} isOptimizing={true} />)
    await userEvent.click(screen.getByTestId('optimize-button'))
    expect(onOptimize).not.toHaveBeenCalled()
  })

  it('sets aria-disabled="true" when disabled', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={true} isOptimizing={false} />)
    expect(screen.getByTestId('optimize-button')).toHaveAttribute('aria-disabled', 'true')
  })

  it('sets aria-disabled="true" when isOptimizing', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={true} />)
    expect(screen.getByTestId('optimize-button')).toHaveAttribute('aria-disabled', 'true')
  })

  it('sets aria-busy="true" when isOptimizing', () => {
    render(<OptimizeButton onOptimize={vi.fn()} disabled={false} isOptimizing={true} />)
    expect(screen.getByTestId('optimize-button')).toHaveAttribute('aria-busy', 'true')
  })
})
