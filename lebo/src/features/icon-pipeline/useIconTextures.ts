import { useState, useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Assets, Texture } from 'pixi.js'
import { getIconCachePath } from '../../shared/commands/iconCommands'
import { useAppStore } from '../../shared/stores/appStore'

export function useIconTextures(skillIds: string[]): Map<string, Texture> {
  const [iconTextures, setIconTextures] = useState<Map<string, Texture>>(new Map())
  const [pipelineReady, setPipelineReady] = useState(false)
  const loadedIdsRef = useRef<Set<string>>(new Set())
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    let unlisten: UnlistenFn | null = null

    listen<{ iconSource: 'game-files' | 'community-cdn' | 'placeholder' }>('icon-pipeline:initialized', (event) => {
      if (isMountedRef.current) {
        setPipelineReady(true)
        useAppStore.getState().setIconSource(event.payload.iconSource)
      }
    })
      .then((fn) => {
        // P1: if unmount raced the Promise, call unlisten immediately
        if (!isMountedRef.current) {
          fn()
        } else {
          unlisten = fn
        }
      })
      .catch(console.error)

    return () => {
      isMountedRef.current = false
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    if (!pipelineReady) return

    const newIds = skillIds.filter((id) => !loadedIdsRef.current.has(id))
    if (newIds.length === 0) return

    for (const skillId of newIds) {
      // P3: only mark as loaded after successful path resolution
      getIconCachePath(skillId)
        .then((path) => {
          if (path === null) return
          loadedIdsRef.current.add(skillId)
          const url = convertFileSrc(path)
          // P4: handle Assets.load rejection so failed textures don't produce unhandled rejections
          Assets.load<Texture>(url)
            .then((texture) => {
              // P2: guard against state update after unmount
              if (isMountedRef.current) {
                setIconTextures((prev) => new Map(prev).set(skillId, texture))
              }
            })
            .catch(console.error)
        })
        .catch(console.error)
    }
  }, [pipelineReady, skillIds])

  return iconTextures
}
