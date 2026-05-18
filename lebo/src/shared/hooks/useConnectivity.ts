import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invokeCommand } from '../utils/invokeCommand'
import { useAppStore } from '../stores/appStore'

export function useConnectivity() {
  const setOnline = useAppStore((s) => s.setOnline)

  useEffect(() => {
    invokeCommand<boolean>('check_connectivity')
      .then((isOnline) => setOnline(isOnline))
      .catch(() => setOnline(false))

    let unlisten: (() => void) | undefined
    let cancelled = false
    listen<{ is_online: boolean }>('app:connectivity-changed', (event) => {
      setOnline(event.payload.is_online)
    }).then((fn) => {
      if (cancelled) {
        fn()
      } else {
        unlisten = fn
      }
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
