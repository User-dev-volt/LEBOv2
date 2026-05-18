import { create } from 'zustand'

export type PanelCollapseState = 'expanded' | 'collapsed'

interface PanelState {
  left: PanelCollapseState
  right: PanelCollapseState
}

interface AppStore {
  isOnline: boolean
  isOnlineChecked: boolean
  currentView: 'main' | 'settings'
  activePanel: PanelState
  isApiKeyConfigured: boolean | null
  isOpenRouterConfigured: boolean | null
  llmProvider: 'claude' | 'openrouter' | null
  updateInfo: { version: string; body: string | null } | null
  updateStatus: 'idle' | 'downloading' | 'ready' | 'error'
  updateProgress: number
  updateDismissed: boolean
  iconSource: 'game-files' | 'community-cdn' | 'placeholder' | null
  selectedNodeId: string | null
  setOnline: (online: boolean) => void
  setCurrentView: (view: 'main' | 'settings') => void
  setPanelState: (panel: 'left' | 'right', state: PanelCollapseState) => void
  setApiKeyConfigured: (v: boolean | null) => void
  setOpenRouterConfigured: (v: boolean | null) => void
  setLlmProvider: (v: 'claude' | 'openrouter' | null) => void
  setUpdateInfo: (info: { version: string; body: string | null } | null) => void
  setUpdateStatus: (status: 'idle' | 'downloading' | 'ready' | 'error') => void
  setUpdateProgress: (progress: number) => void
  setUpdateDismissed: (dismissed: boolean) => void
  setIconSource: (v: 'game-files' | 'community-cdn' | 'placeholder') => void
  setSelectedNodeId: (id: string | null) => void
}

export const useAppStore = create<AppStore>()((set) => ({
  isOnline: false,
  isOnlineChecked: false,
  currentView: 'main',
  activePanel: { left: 'expanded', right: 'expanded' },
  isApiKeyConfigured: null,
  isOpenRouterConfigured: null,
  llmProvider: null,
  updateInfo: null,
  updateStatus: 'idle',
  updateProgress: 0,
  updateDismissed: false,
  iconSource: null,
  selectedNodeId: null,
  setOnline: (online) => set({ isOnline: online, isOnlineChecked: true }),
  setCurrentView: (view) => set({ currentView: view }),
  setPanelState: (panel, state) =>
    set((s) => ({ activePanel: { ...s.activePanel, [panel]: state } })),
  setApiKeyConfigured: (v) => set({ isApiKeyConfigured: v }),
  setOpenRouterConfigured: (v) => set({ isOpenRouterConfigured: v }),
  setLlmProvider: (v) => set({ llmProvider: v }),
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setUpdateStatus: (status) => set({ updateStatus: status }),
  setUpdateProgress: (progress) => set({ updateProgress: progress }),
  setUpdateDismissed: (dismissed) => set({ updateDismissed: dismissed }),
  setIconSource: (v) => set({ iconSource: v }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
}))
