import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SavedBuildsList } from './SavedBuildsList'
import { useBuildStore } from '../../shared/stores/buildStore'
import type { BuildMeta, BuildState } from '../../shared/types/build'

vi.mock('./buildPersistence', () => ({
  loadBuild: vi.fn(),
  renameBuild: vi.fn(),
  saveBuild: vi.fn(),
  deleteBuild: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { dismiss: vi.fn() }),
}))

import { loadBuild, renameBuild, deleteBuild } from './buildPersistence'

const mockLoadBuild = vi.mocked(loadBuild)
const mockRenameBuild = vi.mocked(renameBuild)
const mockDeleteBuild = vi.mocked(deleteBuild)

const mockMeta: BuildMeta = {
  id: 'build-1',
  name: 'Void Knight',
  classId: 'sentinel',
  masteryId: 'void_knight',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
}

const mockActiveBuild: BuildState = {
  schemaVersion: 1,
  id: 'build-1',
  name: 'Void Knight',
  classId: 'sentinel',
  masteryId: 'void_knight',
  characterLevel: 1,
  budgetEnforced: false,
  nodeAllocations: {},
  skillNodeAllocations: {},
  activeSkillLevels: {},
  weaverAllocations: {},
  contextData: { gear: [], skills: [], idols: [] },
  isPersisted: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
}

const initialState = useBuildStore.getState()

describe('SavedBuildsList', () => {
  beforeEach(() => {
    useBuildStore.setState(initialState, true)
    mockLoadBuild.mockReset()
    mockRenameBuild.mockReset()
    mockDeleteBuild.mockReset()
    mockLoadBuild.mockResolvedValue(undefined)
    mockRenameBuild.mockResolvedValue(undefined)
    mockDeleteBuild.mockResolvedValue(undefined)
  })

  it('renders nothing when savedBuilds is empty', () => {
    const { container } = render(<SavedBuildsList />)
    expect(container.firstChild).toBeNull()
  })

  it('renders build names in the list', () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    expect(screen.getByText('Void Knight')).toBeInTheDocument()
    expect(screen.getByText('Saved Builds')).toBeInTheDocument()
  })

  it('calls loadBuild when a build item is clicked', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByText('Void Knight'))
    expect(mockLoadBuild).toHaveBeenCalledWith('build-1')
  })

  it('opens kebab menu on … button click', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    expect(screen.getByText('Rename')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows rename input when Rename is clicked', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    await userEvent.click(screen.getByText('Rename'))
    expect(screen.getByDisplayValue('Void Knight')).toBeInTheDocument()
  })

  it('calls renameBuild on Enter in rename input', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    await userEvent.click(screen.getByText('Rename'))
    const input = screen.getByDisplayValue('Void Knight')
    await userEvent.clear(input)
    await userEvent.type(input, 'New Name')
    await userEvent.keyboard('{Enter}')
    expect(mockRenameBuild).toHaveBeenCalledWith('build-1', 'New Name')
  })

  it('cancels rename on Escape', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    await userEvent.click(screen.getByText('Rename'))
    await userEvent.keyboard('{Escape}')
    expect(screen.getByText('Void Knight')).toBeInTheDocument()
    expect(mockRenameBuild).not.toHaveBeenCalled()
  })

  it('opens delete dialog when Delete is clicked', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    await userEvent.click(screen.getByText('Delete'))
    expect(screen.getByText(/Delete build\?/)).toBeInTheDocument()
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()
  })

  it('calls deleteBuild on confirm in delete dialog', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    await userEvent.click(screen.getByText('Delete'))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(mockDeleteBuild).toHaveBeenCalledWith('build-1'))
  })

  it('closes delete dialog on Cancel', async () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    render(<SavedBuildsList />)
    await userEvent.click(screen.getByLabelText('Build options'))
    await userEvent.click(screen.getByText('Delete'))
    await userEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/Delete build\?/)).not.toBeInTheDocument()
    expect(mockDeleteBuild).not.toHaveBeenCalled()
  })

  it('highlights active build', () => {
    useBuildStore.getState().setSavedBuilds([mockMeta])
    useBuildStore.getState().setActiveBuild(mockActiveBuild)
    render(<SavedBuildsList />)
    // Active build row has elevated background
    const nameEl = screen.getByText('Void Knight')
    const row = nameEl.closest('[style*="bg-elevated"]') ?? nameEl.closest('div[class*="rounded"]')
    expect(row).not.toBeNull()
  })
})
