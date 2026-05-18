import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataStalenessBar } from './DataStalenessBar'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'

vi.mock('./gameDataLoader', () => ({
  triggerDataUpdate: vi.fn(),
}))

vi.mock('../item-database/itemDatabaseLoader', () => ({
  triggerItemDataUpdate: vi.fn(),
}))

import { triggerDataUpdate } from './gameDataLoader'
import { triggerItemDataUpdate } from '../item-database/itemDatabaseLoader'

const mockTriggerDataUpdate = vi.mocked(triggerDataUpdate)
const mockTriggerItemDataUpdate = vi.mocked(triggerItemDataUpdate)

const initialGameDataState = useGameDataStore.getState()
const initialOptimizationState = useOptimizationStore.getState()

describe('DataStalenessBar', () => {
  beforeEach(() => {
    useGameDataStore.setState(initialGameDataState, true)
    useOptimizationStore.setState(initialOptimizationState, true)
    mockTriggerDataUpdate.mockReset()
    mockTriggerDataUpdate.mockResolvedValue(undefined)
    mockTriggerItemDataUpdate.mockReset()
    mockTriggerItemDataUpdate.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Game data banner (existing tests, unchanged) ─────────────────────────

  it('does not render when isStale is false', () => {
    render(<DataStalenessBar />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not render when isStale=true but stalenessAcknowledged=true', () => {
    useGameDataStore.setState({ isStale: true, stalenessAcknowledged: true })
    render(<DataStalenessBar />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders amber banner with version count when isStale=true and not acknowledged', () => {
    useGameDataStore.setState({ isStale: true, stalenessAcknowledged: false, versionsBehind: 1 })
    render(<DataStalenessBar />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/1 version\(s\) behind/)).toBeInTheDocument()
    expect(screen.getByText('Update Now')).toBeInTheDocument()
    expect(screen.getByText('Continue with current data')).toBeInTheDocument()
  })

  it('"Update Now" is disabled and shows "Downloading…" when isUpdating=true', () => {
    useGameDataStore.setState({ isStale: true, stalenessAcknowledged: false, versionsBehind: 1, isUpdating: true })
    render(<DataStalenessBar />)
    const btn = screen.getByText('Downloading…')
    expect(btn).toBeDisabled()
  })

  it('"Update Now" is disabled when optimization is running', () => {
    useGameDataStore.setState({ isStale: true, stalenessAcknowledged: false, versionsBehind: 1 })
    useOptimizationStore.setState({ isOptimizing: true })
    render(<DataStalenessBar />)
    expect(screen.getByText('Update Now')).toBeDisabled()
  })

  it('"Continue with current data" calls acknowledgeStaleness', async () => {
    useGameDataStore.setState({ isStale: true, stalenessAcknowledged: false, versionsBehind: 1 })
    render(<DataStalenessBar />)
    await userEvent.click(screen.getByText('Continue with current data'))
    expect(useGameDataStore.getState().stalenessAcknowledged).toBe(true)
  })

  it('shows error message with Retry button when triggerDataUpdate rejects', async () => {
    mockTriggerDataUpdate.mockRejectedValue(new Error('Connection refused'))
    useGameDataStore.setState({ isStale: true, stalenessAcknowledged: false, versionsBehind: 1 })
    render(<DataStalenessBar />)
    await userEvent.click(screen.getByText('Update Now'))
    expect(await screen.findByText(/Update failed: Connection refused/)).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  // ── Item data banner (new tests) ─────────────────────────────────────────

  it('does not render item banner when isItemDataStale is false', () => {
    render(<DataStalenessBar />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not render item banner when isItemDataStale=true but itemDataStaleAcknowledged=true', () => {
    useGameDataStore.setState({ isItemDataStale: true, itemDataStaleAcknowledged: true })
    render(<DataStalenessBar />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders item data banner with correct text when isItemDataStale=true', () => {
    useGameDataStore.setState({ isItemDataStale: true, itemDataStaleAcknowledged: false })
    render(<DataStalenessBar />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Item database updated. Refresh?')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })

  it('"Update" button is disabled with aria-busy during isItemDataUpdating', () => {
    useGameDataStore.setState({ isItemDataStale: true, itemDataStaleAcknowledged: false, isItemDataUpdating: true })
    render(<DataStalenessBar />)
    const btn = screen.getByText('Downloading…')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('"Dismiss" calls acknowledgeItemDataStaleness', async () => {
    useGameDataStore.setState({ isItemDataStale: true, itemDataStaleAcknowledged: false })
    render(<DataStalenessBar />)
    await userEvent.click(screen.getByText('Dismiss'))
    expect(useGameDataStore.getState().itemDataStaleAcknowledged).toBe(true)
  })

  it('shows "Updated ✓" after successful update then disappears after 2s', async () => {
    let dismissCallback: (() => void) | undefined
    const realSetTimeout = globalThis.setTimeout.bind(globalThis)
    // Pass through all timeouts except the 2000ms dismiss one so userEvent still works
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((cb: TimerHandler, delay?: number): ReturnType<typeof setTimeout> => {
      if (delay === 2000) {
        dismissCallback = cb as () => void
        return 0 as unknown as ReturnType<typeof setTimeout>
      }
      return realSetTimeout(cb, delay)
    })

    useGameDataStore.setState({ isItemDataStale: true, itemDataStaleAcknowledged: false })
    render(<DataStalenessBar />)

    await userEvent.click(screen.getByText('Update'))

    expect(screen.getByText('Item database updated ✓')).toBeInTheDocument()
    expect(dismissCallback).toBeDefined()

    await act(async () => {
      dismissCallback!()
    })

    expect(useGameDataStore.getState().itemDataStaleAcknowledged).toBe(true)

    vi.restoreAllMocks()
  })

  it('shows error inline when triggerItemDataUpdate rejects — no toast', async () => {
    mockTriggerItemDataUpdate.mockRejectedValue(new Error('NETWORK_ERROR: timeout'))
    useGameDataStore.setState({ isItemDataStale: true, itemDataStaleAcknowledged: false })
    render(<DataStalenessBar />)

    await userEvent.click(screen.getByText('Update'))

    expect(await screen.findByText(/Update failed: NETWORK_ERROR: timeout/)).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    // acknowledgeItemDataStaleness must NOT have been called
    expect(useGameDataStore.getState().itemDataStaleAcknowledged).toBe(false)
  })

  it('both banners render simultaneously when both data types are stale', () => {
    useGameDataStore.setState({
      isStale: true,
      stalenessAcknowledged: false,
      versionsBehind: 1,
      isItemDataStale: true,
      itemDataStaleAcknowledged: false,
    })
    render(<DataStalenessBar />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
