import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { initGameData } from './features/game-data/gameDataLoader'
import { loadItemDatabase } from './features/item-database/itemDatabaseLoader'
import { loadIdolData, loadBlessingsData, loadConditionsData } from './features/context-database/contextDatabaseLoader'
import { loadSyntheticWeaverData } from './features/weaver-tree/weaverSyntheticData'
import { initializeIconPipeline } from './shared/commands/iconCommands'
import { loadBuildsOnStartup, saveBuild } from './features/build-manager/buildPersistence'
import { useAutoSave } from './features/build-manager/useAutoSave'
import { useConnectivity } from './shared/hooks/useConnectivity'
import { useUpdateCheck } from './shared/hooks/useUpdateCheck'
import { useAccessibilityAnnouncer } from './shared/hooks/useAccessibilityAnnouncer'
import { useBuildStore } from './shared/stores/buildStore'
import { useGameDataStore } from './shared/stores/gameDataStore'
import { useOptimizationStore } from './shared/stores/optimizationStore'
import { useStatSheet } from './shared/stores/useStatSheet'
import { useAppStore } from './shared/stores/appStore'
import { invokeCommand } from './shared/utils/invokeCommand'
import { useOptimizationStream } from './shared/stores/useOptimizationStream'
import { AppHeader } from './features/layout/AppHeader'
import { StatusBar } from './features/layout/StatusBar'
import { LeftPanel } from './features/layout/LeftPanel'
import { RightPanel } from './features/layout/RightPanel'
import { CenterCanvas } from './features/layout/CenterCanvas'
import { Settings } from './features/settings/Settings'
import { GearOptimizationView } from './features/gear-optimization/GearOptimizationView'
import { ErrorBoundary } from './shared/components/ErrorBoundary'

const TOASTER_OPTS = {
  style: {
    background: 'var(--color-bg-elevated)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-bg-hover)',
    fontSize: '0.875rem',
  },
}

export function App() {
  useAutoSave()
  useConnectivity()
  useUpdateCheck()
  useAccessibilityAnnouncer()
  useOptimizationStream()
  useStatSheet()
  const currentView = useAppStore((s) => s.currentView)

  useEffect(() => {
    initGameData().catch(console.error)
    loadBuildsOnStartup().catch(console.error)
    initializeIconPipeline().catch(console.error)
    loadItemDatabase().catch(console.error)
    loadIdolData().catch(console.error)
    loadBlessingsData().catch(console.error)
    loadConditionsData().catch(console.error)

    // Stub Weaver Tree loader — replace when real community node data is available (see story 4-3 Task 0)
    const { setWeaverTreeData, setWeaverGameNodes } = useGameDataStore.getState()
    const { treeData: weaverTreeData, gameNodes: weaverGameNodes } = loadSyntheticWeaverData()
    setWeaverTreeData(weaverTreeData)
    setWeaverGameNodes(weaverGameNodes)

    // Sequential vault reads — must be chained to avoid concurrent Stronghold access
    const { setLlmProvider, setApiKeyConfigured, setOpenRouterConfigured } = useAppStore.getState()
    invokeCommand<string>('get_llm_provider')
      .then(async (p) => {
        const provider = p as 'claude' | 'openrouter'
        setLlmProvider(provider)
        if (provider === 'openrouter') {
          const configured = await invokeCommand<boolean>('check_openrouter_configured').catch(() => false)
          setOpenRouterConfigured(configured as boolean)
        } else {
          const configured = await invokeCommand<boolean>('check_api_key_configured').catch(() => false)
          setApiKeyConfigured(configured as boolean)
        }
      })
      .catch(() => setLlmProvider('claude'))
  }, [])

  useEffect(() => {
    return useBuildStore.subscribe((state, prev) => {
      if (state.activeBuild?.id === prev.activeBuild?.id) return
      const build = state.activeBuild
      useOptimizationStore.getState().setSliderPosition(build?.sliderPosition ?? 50)
      useOptimizationStore.getState().setFineTuneWeights(build?.fineTuneWeights ?? null)
      useOptimizationStore.getState().clearSuggestions()
    })
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        const { activeBuild } = useBuildStore.getState()
        if (activeBuild) {
          saveBuild(activeBuild).catch(console.error)
        }
        return
      }

      // Escape is safe globally — fires before the input guard
      if (e.key === 'Escape') {
        useOptimizationStore.getState().setPreviewSuggestionRank(null)
        window.dispatchEvent(new CustomEvent('keyboard:escape'))
        return
      }

      // Undo/Redo — skip if text input focused (preserve native browser text undo/redo)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y')) {
        const target = e.target as HTMLElement
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable
        ) return
        e.preventDefault()
        if (e.key === 'z') useBuildStore.getState().undoNodeChange()
        else useBuildStore.getState().redoNodeChange()
        return
      }

      // Guard bare-key shortcuts: skip when typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement
      const isInputTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      if (isInputTarget) return

      // Skip bare-key shortcuts when in settings view (no optimize button or tree visible)
      const { currentView } = useAppStore.getState()
      if (currentView === 'settings') return

      // Skip bare-key shortcuts when modifier keys are held (avoid hijacking Ctrl+O, Alt+I, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // Center tab shortcuts: 1-5
      if (e.key === '1') { e.preventDefault(); useAppStore.getState().setCenterTab('tree'); return }
      if (e.key === '2') { e.preventDefault(); useAppStore.getState().setCenterTab('gear'); return }
      if (e.key === '3') { e.preventDefault(); useAppStore.getState().setCenterTab('skill'); return }
      if (e.key === '4') { e.preventDefault(); useAppStore.getState().setCenterTab('idol'); return }
      if (e.key === '5') { e.preventDefault(); useAppStore.getState().setCenterTab('blessing'); return }

      // Panel collapse shortcuts
      if (e.key === '[') {
        e.preventDefault()
        const { activePanel, setPanelState } = useAppStore.getState()
        setPanelState('left', activePanel.left === 'collapsed' ? 'expanded' : 'collapsed')
        return
      }
      if (e.key === ']') {
        e.preventDefault()
        const { activePanel, setPanelState } = useAppStore.getState()
        setPanelState('right', activePanel.right === 'collapsed' ? 'expanded' : 'collapsed')
        return
      }

      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        document.getElementById('optimize-button')?.focus()
        return
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        document.getElementById('build-import-input')?.focus()
        return
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <ErrorBoundary>
        {/* Settings is always mounted so in-flight saves survive navigation */}
        <div style={{ display: currentView === 'settings' ? 'block' : 'none' }}>
          <Settings />
        </div>
        {/* Gear Optimization is always mounted so in-flight state survives navigation */}
        <div style={{ display: currentView === 'gear-optimization' ? 'block' : 'none' }}>
          <GearOptimizationView />
        </div>
        <div
          className="flex flex-col overflow-hidden"
          style={{
            display: currentView === 'main' ? 'flex' : 'none',
            height: '100dvh',
            minWidth: '1280px',
            minHeight: '720px',
          }}
        >
          {/* Skip links — UX-DR15 accessibility */}
          <a
            href="#skill-tree-canvas"
            className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-3 focus:py-2 focus:text-sm"
            style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
          >
            Skip to tree
          </a>
          <a
            href="#suggestion-panel"
            className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-16 focus:z-50 focus:px-3 focus:py-2 focus:text-sm"
            style={{ backgroundColor: 'var(--color-accent-gold)', color: 'var(--color-bg-base)' }}
          >
            Skip to suggestions
          </a>

          {/* ARIA live regions — UX-DR15 */}
          <div aria-live="polite" aria-atomic="true" className="sr-only" id="import-progress-region" />
          <div aria-live="polite" aria-atomic="true" className="sr-only" id="ai-status-region" />
          <div aria-live="assertive" aria-atomic="true" className="sr-only" id="critical-error-region" />

          <AppHeader />

          <div className="flex flex-1 overflow-hidden">
            <LeftPanel />
            <CenterCanvas />
            <RightPanel />
          </div>

          <StatusBar />
        </div>
      </ErrorBoundary>
      <Toaster position="bottom-center" toastOptions={TOASTER_OPTS} />
    </>
  )
}
