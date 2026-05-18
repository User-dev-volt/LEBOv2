import { useState } from 'react'
import toast from 'react-hot-toast'
import { useBuildStore } from '../../shared/stores/buildStore'
import {
  loadBuild,
  renameBuild,
  saveBuild,
  deleteBuild as deleteBuildFromDb,
} from './buildPersistence'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import type { BuildMeta } from '../../shared/types/build'

export function SavedBuildsList() {
  const savedBuilds = useBuildStore((s) => s.savedBuilds)
  const activeBuild = useBuildStore((s) => s.activeBuild)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<BuildMeta | null>(null)

  if (savedBuilds.length === 0) return null

  async function handleLoad(id: string) {
    if (activeBuild && !activeBuild.isPersisted) {
      const capturedBuild = activeBuild
      toast(
        (t) => (
          <span>
            Unsaved build —{' '}
            <button
              className="underline font-medium"
              onClick={async () => {
                toast.dismiss(t.id)
                await saveBuild(capturedBuild).catch(() => {})
              }}
            >
              Save Now
            </button>
          </span>
        ),
        { duration: 4000 }
      )
    }
    try {
      await loadBuild(id)
    } catch {
      // error toast already shown by loadBuild
    }
    setMenuOpenId(null)
  }

  function startRename(build: BuildMeta) {
    setRenamingId(build.id)
    setRenameValue(build.name)
    setMenuOpenId(null)
  }

  async function submitRename(id: string) {
    const trimmed = renameValue.trim()
    if (trimmed) {
      try {
        await renameBuild(id, trimmed)
      } catch {
        // error toast already shown by renameBuild
      }
    }
    setRenamingId(null)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString()
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <p
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--color-text-muted)' }}
      >
        Saved Builds
      </p>

      {savedBuilds.map((build) => {
        const isActive = activeBuild?.id === build.id
        const isRenaming = renamingId === build.id
        const isMenuOpen = menuOpenId === build.id

        return (
          <div
            key={build.id}
            className="flex items-center gap-1 rounded px-2 py-1.5 group"
            style={{
              backgroundColor: isActive ? 'var(--color-bg-elevated)' : 'transparent',
            }}
          >
            {isRenaming ? (
              <div className="flex flex-1 items-center gap-1">
                <input
                  autoFocus
                  className="flex-1 text-sm rounded px-1 py-0.5 min-w-0 focus:outline focus:outline-1 focus:outline-[var(--color-accent-gold)]"
                  style={{
                    backgroundColor: 'var(--color-bg-base)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-accent-gold)',
                  }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitRename(build.id)
                    if (e.key === 'Escape') cancelRename()
                  }}
                />
                <button
                  aria-label="Confirm rename"
                  className="text-xs px-1"
                  style={{ color: 'var(--color-accent-gold)' }}
                  onClick={() => submitRename(build.id)}
                >
                  ✓
                </button>
                <button
                  aria-label="Cancel rename"
                  className="text-xs px-1"
                  style={{ color: 'var(--color-text-muted)' }}
                  onClick={cancelRename}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <button
                  className="flex-1 text-left min-w-0"
                  onClick={() => handleLoad(build.id)}
                >
                  <p
                    className="text-sm truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {build.name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {build.masteryId} · {formatDate(build.updatedAt)}
                  </p>
                </button>

                <div className="relative shrink-0">
                  <button
                    aria-label="Build options"
                    className="text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(isMenuOpen ? null : build.id)
                    }}
                  >
                    …
                  </button>

                  {isMenuOpen && (
                    <div
                      className="absolute right-0 top-full z-50 rounded shadow-lg overflow-hidden"
                      style={{
                        backgroundColor: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-bg-base)',
                        minWidth: '100px',
                      }}
                    >
                      <button
                        className="block w-full text-left px-3 py-1.5 text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                        onClick={() => startRename(build)}
                      >
                        Rename
                      </button>
                      <button
                        className="block w-full text-left px-3 py-1.5 text-sm"
                        style={{ color: 'var(--color-data-negative)' }}
                        onClick={() => {
                          setDeleteTarget(build)
                          setMenuOpenId(null)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}

      {deleteTarget && (
        <DeleteConfirmDialog
          buildName={deleteTarget.name}
          onConfirm={async () => {
            try {
              await deleteBuildFromDb(deleteTarget.id)
            } catch {
              // error toast already shown by deleteBuild
            }
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
