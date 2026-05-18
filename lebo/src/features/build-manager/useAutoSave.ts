import { useEffect, useRef } from 'react'
import { useBuildStore } from '../../shared/stores/buildStore'
import { saveBuild } from './buildPersistence'

const AUTOSAVE_DEBOUNCE_MS = 500

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return useBuildStore.subscribe((state, prev) => {
      const build = state.activeBuild
      if (!build?.isPersisted) return
      if (state.activeBuild === prev.activeBuild) return

      // Ignore changes where only isPersisted changed (happens after setActiveBuildPersisted)
      const buildDataChanged =
        JSON.stringify({ ...build, isPersisted: false }) !==
        JSON.stringify({ ...prev.activeBuild, isPersisted: false })
      if (!buildDataChanged) return

      if (timerRef.current) clearTimeout(timerRef.current)
      const buildId = build.id
      timerRef.current = setTimeout(async () => {
        const current = useBuildStore.getState().activeBuild
        if (!current || current.id !== buildId) return
        await saveBuild(current).catch(() => {})
      }, AUTOSAVE_DEBOUNCE_MS)
    })
  }, [])
}
