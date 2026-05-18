import { useEffect, useRef } from 'react'

interface NodeContextMenuProps {
  nodeId: string
  position: { x: number; y: number }
  onAllocate: (nodeId: string) => void
  onRemove: (nodeId: string) => void
  onClose: () => void
}

const MENU_WIDTH = 160

export function NodeContextMenu({
  nodeId,
  position,
  onAllocate,
  onRemove,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const MENU_HEIGHT = 80 // two items × ~40px each
  const viewportWidth = window.innerWidth || 10000
  const viewportHeight = window.innerHeight || 10000
  const left = position.x + MENU_WIDTH > viewportWidth ? position.x - MENU_WIDTH : position.x
  const top = position.y + MENU_HEIGHT > viewportHeight ? position.y - MENU_HEIGHT : position.y

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '7px 12px',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--color-text-primary)',
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Node actions"
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 200,
        width: MENU_WIDTH,
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-bg-base)',
        borderRadius: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        role="menuitem"
        style={itemStyle}
        onClick={() => { onAllocate(nodeId); onClose() }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        Allocate
      </button>
      <button
        type="button"
        role="menuitem"
        style={itemStyle}
        onClick={() => { onRemove(nodeId); onClose() }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-surface)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        Remove
      </button>
    </div>
  )
}
