// TEMPORARY review harness for Story 2.8 (StatusBar) screenshots. Delete after use.
import ReactDOM from 'react-dom/client'
import './assets/styles/global.css'
import { StatusBar } from './features/layout/StatusBar'
import { useAppStore } from './shared/stores/appStore'
import { useBuildStore } from './shared/stores/buildStore'
import { useGameDataStore } from './shared/stores/gameDataStore'
import type { BuildState } from './shared/types/build'

function makeBuild(isPersisted: boolean): BuildState {
  return {
    schemaVersion: 2,
    sliderPosition: 50,
    fineTuneWeights: null,
    id: 'preview-build',
    name: 'Preview Build',
    classId: 'sentinel',
    masteryId: 'paladin',
    characterLevel: 1,
    budgetEnforced: false,
    nodeAllocations: {},
    skillNodeAllocations: {},
    activeSkillLevels: {},
    weaverAllocations: {},
    contextData: { gear: [], skills: [], idols: [] },
    isPersisted,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

type Seed = {
  version?: string | null
  date?: string | null
  provider?: 'claude' | 'openrouter' | null
  build?: 'dirty' | 'saved' | 'none'
  online?: boolean
}

// Exposed so Playwright can drive the real stores between screenshots.
;(window as unknown as { __seed: (opts: Seed) => void }).__seed = (opts: Seed) => {
  useGameDataStore.setState({
    dataVersion: opts.version ?? null,
    dataUpdatedAt: opts.date ?? null,
  })
  useAppStore.setState({
    llmProvider: opts.provider ?? null,
    isOnline: !!opts.online,
  })
  useBuildStore.setState({
    activeBuild: opts.build === 'none' || opts.build === undefined ? null : makeBuild(opts.build === 'saved'),
  })
}

// Default seed: the "everything populated" happy path.
;(window as unknown as { __seed: (opts: Seed) => void }).__seed({
  version: 'Season 4 (Shattered Omens)',
  date: '2026-03-26T00:00:00Z',
  provider: 'claude',
  build: 'dirty',
  online: true,
})

document.body.style.margin = '0'
document.body.style.background = 'var(--color-bg-base)'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <div
    style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--color-bg-base)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
    }}
  >
    {/* a faux content area above so the footer's hairline border reads naturally */}
    <div style={{ flex: 1, background: 'var(--color-bg-surface)' }} />
    <StatusBar />
  </div>,
)
