import { useEffect, useRef, useState, useMemo, useImperativeHandle } from 'react'
import type { SkillTreeCanvasProps, RendererCallbacks, RendererInstance } from './types'
import { initRenderer, NODE_RADIUS, type RendererConfig } from './pixiRenderer'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'

type NodeButton = { id: string; screenX: number; screenY: number; r: number }

// Epsilon for syncButtonPositions — avoids scheduling React re-renders on sub-pixel PixiJS float drift
const VIEWPORT_EPS = 0.5
const VIEWPORT_SCALE_EPS = 0.001

export function SkillTreeCanvas({
  ref,
  treeData,
  treeLayout,
  nodeAllocations,
  highlightedNodes,
  iconTextures,
  selectedNodeId,
  onNodeClick,
  onNodeHover,
  onNodeSelect,
  onNodeContextMenu,
  onKeyboardNavigate,
  onPointerMove,
  flashNodeIds,
}: SkillTreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<RendererInstance | null>(null)
  const callbacksRef = useRef<RendererCallbacks>({ onNodeClick, onNodeHover, onNodeSelect, onNodeContextMenu })
  const dataRef = useRef({ treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId })
  const treeDataRef = useRef(treeData)
  const bfsOrderRef = useRef<string[]>([])
  const focusedNodeIdRef = useRef<string | null>(null)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const lastViewportRef = useRef({ x: 0, y: 0, scale: 1 })
  // Chains init promises so React StrictMode's double-mount never runs two concurrent app.init() calls
  const initChainRef = useRef<Promise<unknown>>(Promise.resolve())
  const rendererConfigRef = useRef<RendererConfig>({ treeLayout })

  const [nodeButtons, setNodeButtons] = useState<NodeButton[]>([])
  const reducedMotion = useReducedMotion()
  const reducedMotionRef = useRef(reducedMotion)

  // Expose viewport control to parent via ref (React 19 ref-as-prop)
  useImperativeHandle(ref, () => ({
    fitToTree: () => rendererRef.current?.fitToTree(treeDataRef.current.nodes),
    zoomIn: () => rendererRef.current?.zoomIn(),
    zoomOut: () => rendererRef.current?.zoomOut(),
  }))

  // BFS order derived from directed edges (fromId → toId); roots are nodes with no incoming edge
  const bfsOrder = useMemo(() => {
    const children = new Map<string, string[]>()
    const hasParent = new Set<string>()
    for (const edge of treeData.edges) {
      if (!children.has(edge.fromId)) children.set(edge.fromId, [])
      children.get(edge.fromId)!.push(edge.toId)
      hasParent.add(edge.toId)
    }
    const roots = treeData.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id)
    const visited = new Set<string>()
    const order: string[] = []
    const queue = [...roots]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      order.push(id)
      for (const child of children.get(id) ?? []) {
        if (!visited.has(child)) queue.push(child)
      }
    }
    // Append isolated nodes not reachable from any root
    for (const node of treeData.nodes) {
      if (!visited.has(node.id)) order.push(node.id)
    }
    return order
  }, [treeData])

  // Keep refs current after every render
  useEffect(() => {
    callbacksRef.current = { onNodeClick, onNodeHover, onNodeSelect, onNodeContextMenu }
    dataRef.current = { treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId }
    treeDataRef.current = treeData
    bfsOrderRef.current = bfsOrder
    reducedMotionRef.current = reducedMotion
  })

  // Adjacency map built from TreeNode.connections (already bidirectional per node)
  const connectionMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const node of treeData.nodes) {
      map.set(node.id, node.connections)
    }
    return map
  }, [treeData])

  function syncButtonPositions() {
    const r = rendererRef.current
    const container = containerRef.current
    if (!r || !container) return
    const vp = r.getViewport()
    const last = lastViewportRef.current
    // Epsilon guard — avoids React re-renders from sub-pixel PixiJS float drift during idle
    if (
      Math.abs(vp.x - last.x) < VIEWPORT_EPS &&
      Math.abs(vp.y - last.y) < VIEWPORT_EPS &&
      Math.abs(vp.scale - last.scale) < VIEWPORT_SCALE_EPS
    ) return
    lastViewportRef.current = vp
    const { width, height } = container.getBoundingClientRect()
    const { x: panX, y: panY, scale } = vp
    const nodeMap = new Map(treeDataRef.current.nodes.map((n) => [n.id, n]))
    const visibleIds = new Set<string>()
    for (const n of treeDataRef.current.nodes) {
      const sx = panX + n.x * scale
      const sy = panY + n.y * scale
      if (sx > -50 && sx < width + 50 && sy > -50 && sy < height + 50) visibleIds.add(n.id)
    }
    // Preserve BFS graph order (root → children → grandchildren) for Tab traversal
    const buttons: NodeButton[] = []
    for (const id of bfsOrderRef.current) {
      if (!visibleIds.has(id)) continue
      const n = nodeMap.get(id)!
      buttons.push({
        id,
        screenX: panX + n.x * scale,
        screenY: panY + n.y * scale,
        r: NODE_RADIUS[n.size] * scale,
      })
    }
    setNodeButtons(buttons)
  }

  // Mount/unmount: init renderer + ResizeObserver + ticker + native pointermove
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    let renderer: RendererInstance | null = null
    let resizeObserver: ResizeObserver | null = null
    let unsubTicker: (() => void) | null = null
    let cancelled = false

    // Native pointermove listener — fires at pointer rate without React synthetic event batching
    const handleNativePointerMove = (e: PointerEvent) => {
      onPointerMove?.(e.clientX, e.clientY)
    }
    container.addEventListener('pointermove', handleNativePointerMove)

    const prevChain = initChainRef.current
    const thisChain = prevChain
      .then(async () => {
        if (cancelled) return undefined
        return initRenderer(canvas, callbacksRef, rendererConfigRef.current)
      })
      .then((r) => {
        if (!r) return
        if (cancelled) {
          r.destroy()
          return
        }
        renderer = r
        rendererRef.current = r

        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect
            r.resize(width, height)
          }
        })
        resizeObserver.observe(container)

        const { width, height } = container.getBoundingClientRect()
        r.resize(width, height)
        r.setReducedMotion(reducedMotionRef.current)
        const { treeData: td, nodeAllocations: na, highlightedNodes: hn, iconTextures: it, selectedNodeId: sid } = dataRef.current
        r.renderTree(td, na, hn, it, sid)

        syncButtonPositions()
        unsubTicker = r.addTickerListener(syncButtonPositions)
      })
      .catch((err) => {
        console.error('[SkillTreeCanvas] initRenderer failed:', err)
      })

    initChainRef.current = thisChain

    return () => {
      cancelled = true
      container.removeEventListener('pointermove', handleNativePointerMove)
      unsubTicker?.()
      resizeObserver?.disconnect()
      renderer?.destroy()
      rendererRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render whenever tree data or selection changes
  useEffect(() => {
    rendererRef.current?.renderTree(treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId)
  }, [treeData, nodeAllocations, highlightedNodes, iconTextures, selectedNodeId])

  // Propagate reduced motion preference to renderer and re-render so the change takes effect immediately
  useEffect(() => {
    const r = rendererRef.current
    if (!r) return
    r.setReducedMotion(reducedMotion)
    const { treeData: td, nodeAllocations: na, highlightedNodes: hn, iconTextures: it, selectedNodeId: sid } = dataRef.current
    r.renderTree(td, na, hn, it, sid)
  }, [reducedMotion])

  // Trigger flash animation — each failure creates a new array reference to re-run this effect
  useEffect(() => {
    if (!flashNodeIds || flashNodeIds.length === 0) return
    rendererRef.current?.triggerFlash(flashNodeIds)
  }, [flashNodeIds])

  function handleNodeKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onNodeClick(id, 0)
      return
    }

    if (e.key === 'Escape') {
      e.currentTarget.blur()
      onKeyboardNavigate(null, 0, 0)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (nodeButtons.length < 2) return
      const currentIdx = nodeButtons.findIndex((btn) => btn.id === id)
      if (currentIdx === -1) return
      const nextIdx = e.shiftKey
        ? (currentIdx - 1 + nodeButtons.length) % nodeButtons.length
        : (currentIdx + 1) % nodeButtons.length
      const nextId = nodeButtons[nextIdx]?.id
      if (nextId && nextId !== id) buttonRefs.current.get(nextId)?.focus()
      return
    }

    const arrowAngles: Record<string, number> = {
      ArrowRight: 0,
      ArrowDown: Math.PI / 2,
      ArrowLeft: Math.PI,
      ArrowUp: -Math.PI / 2,
    }
    const targetAngle = arrowAngles[e.key]
    if (targetAngle === undefined) return
    e.preventDefault()

    const connections = connectionMap.get(id) ?? []
    if (connections.length === 0) return
    const currentBtn = nodeButtons.find((b) => b.id === id)
    if (!currentBtn) return

    const buttonDataMap = new Map(nodeButtons.map((b) => [b.id, b]))
    let bestId: string | null = null
    let bestDiff = Infinity

    for (const connId of connections) {
      const connBtn = buttonDataMap.get(connId)
      if (!connBtn) continue
      const angle = Math.atan2(
        connBtn.screenY - currentBtn.screenY,
        connBtn.screenX - currentBtn.screenX
      )
      const diff = Math.abs(((angle - targetAngle) + Math.PI) % (2 * Math.PI) - Math.PI)
      if (diff < bestDiff) {
        bestDiff = diff
        bestId = connId
      }
    }

    if (bestId) {
      buttonRefs.current.get(bestId)?.focus()
    } else if (connections.length > 0 && containerRef.current) {
      // All connected nodes are off-screen in this direction — re-announce current position
      const rect = containerRef.current.getBoundingClientRect()
      onKeyboardNavigate(id, rect.left + currentBtn.screenX, rect.top + currentBtn.screenY)
    }
  }

  const zoomBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-bg-base)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    color: 'var(--color-text-secondary)',
    userSelect: 'none',
  }

  return (
    <div
      ref={containerRef}
      id="skill-tree-canvas"
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-hidden="true"
      />

      {/* Invisible button overlay — keyboard nav; pointer-events:none so mouse clicks reach PixiJS canvas */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {nodeButtons.map(({ id, screenX, screenY, r }, index) => {
          const node = treeData.nodes.find((n) => n.id === id)
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) buttonRefs.current.set(id, el)
                else buttonRefs.current.delete(id)
              }}
              aria-label={`${id} — ${node?.state ?? 'unknown'}`}
              className="sr-only focus:not-sr-only focus:absolute focus:outline focus:outline-2 focus:outline-[var(--color-accent-gold)] focus:rounded-full"
              style={{
                left: screenX - r,
                top: screenY - r,
                width: r * 2,
                height: r * 2,
                pointerEvents: 'auto',
              }}
              tabIndex={index === 0 ? 0 : -1}
              onKeyDown={(e) => handleNodeKeyDown(e, id)}
              onFocus={() => {
                focusedNodeIdRef.current = id
                const n = treeDataRef.current.nodes.find((n) => n.id === id)
                if (n && containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect()
                  onKeyboardNavigate(id, rect.left + screenX, rect.top + screenY)
                }
              }}
              onBlur={() => {
                focusedNodeIdRef.current = null
                onKeyboardNavigate(null, 0, 0)
              }}
              onClick={() => onNodeClick(id, 0)}
              onContextMenu={(e) => {
                e.preventDefault()
                onNodeClick(id, 2)
              }}
            />
          )
        })}
      </div>

      {/* Zoom controls — ± and Fit in the bottom-right graph corner (AC requirement).
          Rendered after keyboard-nav overlay so DOM order keeps node buttons first for tests. */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          style={zoomBtnStyle}
          onClick={() => rendererRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          style={zoomBtnStyle}
          onClick={() => rendererRef.current?.zoomOut()}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Fit tree to view"
          style={{ ...zoomBtnStyle, fontSize: 10, fontWeight: 600 }}
          onClick={() => rendererRef.current?.fitToTree(treeDataRef.current.nodes)}
        >
          Fit
        </button>
      </div>
    </div>
  )
}
