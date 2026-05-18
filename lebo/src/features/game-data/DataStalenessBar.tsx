import { useState, useEffect, useRef } from 'react'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { useOptimizationStore } from '../../shared/stores/optimizationStore'
import { triggerDataUpdate } from './gameDataLoader'
import { triggerItemDataUpdate } from '../item-database/itemDatabaseLoader'

export function DataStalenessBar() {
  const isStale = useGameDataStore((s) => s.isStale)
  const stalenessAcknowledged = useGameDataStore((s) => s.stalenessAcknowledged)
  const versionsBehind = useGameDataStore((s) => s.versionsBehind)
  const isUpdating = useGameDataStore((s) => s.isUpdating)
  const acknowledgeStaleness = useGameDataStore((s) => s.acknowledgeStaleness)

  const isItemDataStale = useGameDataStore((s) => s.isItemDataStale)
  const itemDataStaleAcknowledged = useGameDataStore((s) => s.itemDataStaleAcknowledged)
  const isItemDataUpdating = useGameDataStore((s) => s.isItemDataUpdating)
  const acknowledgeItemDataStaleness = useGameDataStore((s) => s.acknowledgeItemDataStaleness)

  const isOptimizing = useOptimizationStore((s) => s.isOptimizing)

  const [updateError, setUpdateError] = useState<string | null>(null)
  const [itemUpdateError, setItemUpdateError] = useState<string | null>(null)
  const [showItemSuccess, setShowItemSuccess] = useState(false)
  const itemUpdateInFlight = useRef(false)
  const itemSuccessTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (itemSuccessTimer.current !== null) clearTimeout(itemSuccessTimer.current)
    }
  }, [])

  async function handleUpdate() {
    setUpdateError(null)
    try {
      await triggerDataUpdate()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function handleItemUpdate() {
    if (itemUpdateInFlight.current) return
    itemUpdateInFlight.current = true
    setItemUpdateError(null)
    try {
      await triggerItemDataUpdate()
      setShowItemSuccess(true)
      itemSuccessTimer.current = setTimeout(() => {
        setShowItemSuccess(false)
        acknowledgeItemDataStaleness()
      }, 2000)
    } catch (err) {
      setItemUpdateError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      itemUpdateInFlight.current = false
    }
  }

  const updateBlocked = isUpdating || isOptimizing
  const showGameDataBanner = isStale && !stalenessAcknowledged
  const showItemDataBanner = isItemDataStale && !itemDataStaleAcknowledged

  if (!showGameDataBanner && !showItemDataBanner) return null

  return (
    <div className="shrink-0">
      {showGameDataBanner && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between px-4 py-2 text-sm"
          style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
        >
          <span>
            {updateError ? (
              <>Update failed: {updateError}</>
            ) : (
              <>
                Game data is {versionsBehind} version(s) behind. Suggestions may be inaccurate.
              </>
            )}
          </span>
          <span className="flex items-center gap-2">
            {updateError ? (
              <button
                onClick={handleUpdate}
                className="font-semibold underline"
                style={{ color: 'var(--color-bg-base)' }}
              >
                Retry
              </button>
            ) : (
              <button
                onClick={handleUpdate}
                disabled={updateBlocked}
                className="font-semibold underline disabled:opacity-50"
                style={{ color: 'var(--color-bg-base)' }}
              >
                {isUpdating ? 'Downloading…' : 'Update Now'}
              </button>
            )}
            <button
              onClick={acknowledgeStaleness}
              className="opacity-75 hover:opacity-100"
              style={{ color: 'var(--color-bg-base)' }}
              aria-label="Continue with current data"
            >
              Continue with current data
            </button>
          </span>
        </div>
      )}

      {showItemDataBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between px-4 py-2 text-sm"
          style={{ backgroundColor: 'var(--color-accent-gold-soft)', color: 'var(--color-bg-base)' }}
        >
          <span>
            {showItemSuccess ? (
              <>Item database updated ✓</>
            ) : itemUpdateError ? (
              <>Update failed: {itemUpdateError}</>
            ) : (
              <>Item database updated. Refresh?</>
            )}
          </span>
          {!showItemSuccess && (
            <span className="flex items-center gap-2">
              {itemUpdateError ? (
                <button
                  onClick={handleItemUpdate}
                  className="font-semibold underline"
                  style={{ color: 'var(--color-bg-base)' }}
                >
                  Retry
                </button>
              ) : (
                <button
                  onClick={handleItemUpdate}
                  disabled={isItemDataUpdating}
                  aria-busy={isItemDataUpdating}
                  className="font-semibold underline disabled:opacity-50"
                  style={{ color: 'var(--color-bg-base)' }}
                >
                  {isItemDataUpdating ? 'Downloading…' : 'Update'}
                </button>
              )}
              <button
                onClick={acknowledgeItemDataStaleness}
                className="opacity-75 hover:opacity-100"
                style={{ color: 'var(--color-bg-base)' }}
                aria-label="Dismiss item data update"
              >
                Dismiss
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
