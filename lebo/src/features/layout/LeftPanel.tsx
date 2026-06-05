import { useAppStore, type CenterTab } from '../../shared/stores/appStore'
import { useBuildStore } from '../../shared/stores/buildStore'
import { useGameDataStore } from '../../shared/stores/gameDataStore'
import { getSectionStatus } from '../../shared/utils/buildSectionStatus'
import { showInfoToast } from '../../shared/components/Toast'
import { saveBuild } from '../build-manager/buildPersistence'
import { SavedBuildsList } from '../build-manager/SavedBuildsList'
import { PanelCollapseToggle } from './PanelCollapseToggle'
import { ClassGlyph } from './ClassGlyph'
import { ClassMasterySelector } from '../skill-tree/ClassMasterySelector'

const NAV_ROWS: { id: CenterTab; label: string }[] = [
  { id: 'tree', label: 'Passive Tree' },
  { id: 'weaver', label: 'Weaver' },
  { id: 'gear', label: 'Gear' },
  { id: 'skill', label: 'Active Skills' },
  { id: 'idol', label: 'Idols' },
  { id: 'blessing', label: 'Blessings' },
]

function CheckGlyph() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-accent-gold)"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M5 12l4 5L19 6" />
    </svg>
  )
}

export function LeftPanel() {
  const isCollapsed = useAppStore((s) => s.activePanel.left === 'collapsed')
  const setPanelState = useAppStore((s) => s.setPanelState)
  const centerTab = useAppStore((s) => s.centerTab)
  const setCenterTab = useAppStore((s) => s.setCenterTab)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const selectedClassId = useBuildStore((s) => s.selectedClassId)
  const gameData = useGameDataStore((s) => s.gameData)

  const selectedClass = selectedClassId && gameData ? gameData.classes[selectedClassId] : null
  const sections = getSectionStatus(activeBuild)

  async function handleSave() {
    if (!activeBuild) return
    await saveBuild(activeBuild)
  }

  function handleImportCharacter() {
    // Epic 7 / Story 7.1 wires this: replace the toast with the Character Import modal open.
    showInfoToast('Character import is coming soon.')
  }

  if (isCollapsed) {
    return (
      <aside
        className="relative shrink-0 flex flex-col border-r overflow-hidden"
        style={{
          width: '48px',
          backgroundColor: 'var(--color-bg-surface)',
          borderColor: 'var(--color-bg-elevated)',
        }}
        aria-label="Left panel"
      >
        <PanelCollapseToggle
          side="left"
          isCollapsed={isCollapsed}
          onToggle={() => setPanelState('left', 'expanded')}
        />
        <div className="flex flex-col items-center pt-10 gap-1.5 px-1">
          {NAV_ROWS.map((row) => {
            const isActive = centerTab === row.id
            return (
              <button
                key={row.id}
                type="button"
                title={row.label}
                onClick={() => setCenterTab(row.id)}
                className="w-9 h-9 flex items-center justify-center rounded text-xs font-mono"
                style={{
                  color: isActive ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)',
                  backgroundColor: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                }}
              >
                {row.id === 'tree' ? '⬡' : row.id === 'weaver' ? '✷' : row.id === 'gear' ? '⚔' : row.id === 'skill' ? '✦' : row.id === 'idol' ? '◈' : '✴'}
              </button>
            )
          })}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="relative shrink-0 flex flex-col border-r overflow-hidden"
      style={{
        width: '272px',
        backgroundColor: 'var(--color-bg-surface)',
        borderColor: 'var(--color-bg-elevated)',
      }}
      aria-label="Left panel"
    >
      <PanelCollapseToggle
        side="left"
        isCollapsed={isCollapsed}
        onToggle={() => setPanelState('left', 'collapsed')}
      />

      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-3">
        {/* Active build card */}
        {activeBuild && selectedClass && (
          <div className="mb-1">
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Active Build
            </p>
            <div
              className="flex items-center gap-2.5 px-2.5 py-2 rounded"
              style={{ backgroundColor: 'var(--color-bg-elevated)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded shrink-0"
                style={{
                  backgroundColor: 'var(--color-bg-base)',
                  border: '1px solid var(--color-accent-gold-dim)',
                }}
              >
                <ClassGlyph classId={activeBuild.classId} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                  {activeBuild.name}
                </p>
                <p className="text-[10px] uppercase tracking-wide truncate" style={{ color: 'var(--color-accent-gold)' }}>
                  {selectedClass.className} · {selectedClass.masteries[activeBuild.masteryId]?.masteryName ?? activeBuild.masteryId}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Class / Mastery selectors */}
        <ClassMasterySelector />

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)' }} />

        {/* Build sections navigator */}
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Build Sections
          </p>
          <div className="flex flex-col gap-0.5">
            {NAV_ROWS.map((row) => {
              const isActive = centerTab === row.id
              const status = sections[row.id]
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setCenterTab(row.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex items-center gap-2 px-2.5 py-2 rounded text-left w-full"
                  style={{
                    backgroundColor: isActive ? 'rgba(201,168,76,0.12)' : 'transparent',
                    border: `1px solid ${isActive ? 'rgba(201,168,76,0.25)' : 'transparent'}`,
                    transition: 'background-color 120ms',
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {row.label}
                  </span>
                  {status.done && <CheckGlyph />}
                  <span
                    className="ml-auto text-[10px] font-mono shrink-0"
                    style={{ color: status.full ? 'var(--color-data-positive)' : isActive ? 'var(--color-accent-gold-soft)' : 'var(--color-text-muted)' }}
                  >
                    {status.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)' }} />

        {/* Save button */}
        {activeBuild && (
          <button
            type="button"
            className="w-full py-2 rounded text-sm font-semibold"
            style={{
              backgroundColor: activeBuild.isPersisted ? 'var(--color-bg-elevated)' : 'var(--color-accent-gold)',
              color: activeBuild.isPersisted ? 'var(--color-text-secondary)' : 'var(--color-bg-base)',
              border: '1px solid transparent',
            }}
            onClick={handleSave}
          >
            {activeBuild.isPersisted ? 'Saved' : 'Save Build'}
          </button>
        )}

        {/* Import character */}
        <button
          type="button"
          data-testid="import-character-button"
          className="w-full py-2 rounded text-sm font-semibold"
          style={{
            backgroundColor: 'transparent',
            color: 'var(--color-accent-gold)',
            border: '1px solid var(--color-accent-gold-dim)',
          }}
          onClick={handleImportCharacter}
        >
          Import Character
        </button>

        <div style={{ height: 1, backgroundColor: 'var(--color-bg-elevated)' }} />

        {/* Saved builds */}
        <SavedBuildsList />
      </div>
    </aside>
  )
}
