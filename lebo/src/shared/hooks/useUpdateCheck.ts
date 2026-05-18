import { useEffect } from 'react'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useAppStore } from '../stores/appStore'

// Module-level variable — Update is a class with async methods, not Zustand-serializable.
// Set once on launch, read by AppHeader for download/install.
let _pendingUpdate: Update | null = null

export function getPendingUpdate(): Update | null {
  return _pendingUpdate
}

export function useUpdateCheck() {
  useEffect(() => {
    check()
      .then((update) => {
        _pendingUpdate = update
        if (update) {
          useAppStore.getState().setUpdateInfo({
            version: update.version,
            body: update.body ?? null,
          })
        }
      })
      .catch(() => {
        // Silent — update check failure is not user-facing (network may be offline)
      })
  }, [])
}
