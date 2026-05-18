import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyTreeState } from './EmptyTreeState'
import { useAppStore } from '../../shared/stores/appStore'

const initialAppState = useAppStore.getState()

describe('EmptyTreeState', () => {
  beforeEach(() => {
    useAppStore.setState(initialAppState, true)
  })

  it('renders the empty state CTAs', () => {
    render(<EmptyTreeState />)
    expect(screen.getByText('Import a build or start fresh')).toBeInTheDocument()
    expect(screen.getByText('Create New Build')).toBeInTheDocument()
    expect(screen.getByText('Paste Build Code')).toBeInTheDocument()
  })

  it('"Create New Build" expands the left panel', async () => {
    useAppStore.setState({ activePanel: { left: 'collapsed', right: 'expanded' } })
    render(<EmptyTreeState />)
    await userEvent.click(screen.getByText('Create New Build'))
    expect(useAppStore.getState().activePanel.left).toBe('expanded')
  })

  it('"Create New Build" is a no-op if left panel is already expanded', async () => {
    useAppStore.setState({ activePanel: { left: 'expanded', right: 'expanded' } })
    render(<EmptyTreeState />)
    await userEvent.click(screen.getByText('Create New Build'))
    expect(useAppStore.getState().activePanel.left).toBe('expanded')
  })
})
