import { Application, Circle, Container, Graphics, Sprite, Text } from 'pixi.js'
import type { Texture } from 'pixi.js'
import type { TreeData, TreeNode, HighlightedNodes, RendererCallbacks, RendererInstance } from './types'
import type { NodeEfficiency } from '../../shared/types/statSheet'

// PixiJS v8's logPrettyShaderError calls .split() on getShaderSource/getShaderInfoLog results,
// which throws if WebGL returns null (valid per spec). Patch before any Application init.
;(function patchWebGLNullInfoLogs() {
  const patch = (proto: WebGLRenderingContext) => {
    const origShaderSource = proto.getShaderSource
    ;(proto as unknown as Record<string, unknown>).getShaderSource = function (
      this: WebGLRenderingContext,
      shader: WebGLShader
    ) {
      return origShaderSource.call(this, shader) ?? ''
    }
    const origShader = proto.getShaderInfoLog
    ;(proto as unknown as Record<string, unknown>).getShaderInfoLog = function (
      this: WebGLRenderingContext,
      shader: WebGLShader
    ) {
      return origShader.call(this, shader) ?? ''
    }
    const origProgram = proto.getProgramInfoLog
    ;(proto as unknown as Record<string, unknown>).getProgramInfoLog = function (
      this: WebGLRenderingContext,
      program: WebGLProgram
    ) {
      return origProgram.call(this, program) ?? ''
    }
  }
  if (typeof WebGLRenderingContext !== 'undefined') {
    patch(WebGLRenderingContext.prototype)
  }
  if (typeof WebGL2RenderingContext !== 'undefined') {
    patch(WebGL2RenderingContext.prototype as unknown as WebGLRenderingContext)
  }
})()

export const NODE_RADIUS = { small: 12, medium: 18, large: 26 }

function drawAllocated(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill(0xc9a84c)
  g.circle(x, y, r).stroke({ color: 0xd4b96a, width: 2 })
}

function drawAvailable(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill(0x141417)
  g.circle(x, y, r).stroke({ color: 0x4a7a9e, width: 3 })
}

function drawLocked(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill(0x2a2a35)
  const o = r * 0.5
  g.moveTo(x - o, y - o).lineTo(x + o, y + o).stroke({ color: 0x5a5050, width: 2 })
  g.moveTo(x + o, y - o).lineTo(x - o, y + o).stroke({ color: 0x5a5050, width: 2 })
}

function drawSuggested(g: Graphics, x: number, y: number, r: number, reducedMotion = false) {
  if (!reducedMotion) {
    g.circle(x, y, r + 6).fill({ color: 0x7b68ee, alpha: 0.25 })
  }
  g.circle(x, y, r).fill(0x141417)
  g.circle(x, y, r).stroke({ color: 0x7b68ee, width: 3 })
}

function drawDimmed(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r).fill({ color: 0x2a2a35, alpha: 0.6 })
  g.circle(x, y, r).stroke({ color: 0x5a5070, width: 1 })
}

function drawPreviewRemoved(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 5).fill({ color: 0xff3333, alpha: 0.2 })
  g.circle(x, y, r).fill(0x1a0a0a)
  g.circle(x, y, r).stroke({ color: 0xff3333, width: 3 })
}

function drawPreviewAdded(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 5).fill({ color: 0x33ff77, alpha: 0.2 })
  g.circle(x, y, r).fill(0x0a1a0f)
  g.circle(x, y, r).stroke({ color: 0x33ff77, width: 3 })
}

function drawSearchDimOverlay(g: Graphics, x: number, y: number, r: number) {
  // Draws a semi-transparent dark overlay achieving ~40% visibility on the underlying node
  g.circle(x, y, r + 2).fill({ color: 0x0a0a0b, alpha: 0.6 })
}

function drawSearchHighlight(g: Graphics, x: number, y: number, r: number) {
  // Gold outer ring distinguishes search-matched nodes
  g.circle(x, y, r + 4).stroke({ color: 0xc9a84c, width: 2 })
}

function drawOverlayGold(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 4).stroke({ color: 0xFFD700, width: 2.5, alpha: 0.85 })
}

function drawOverlaySilver(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 3).stroke({ color: 0xAAAAAA, width: 2, alpha: 0.7 })
}

function drawOverlayDim(g: Graphics, x: number, y: number, r: number) {
  g.circle(x, y, r + 2).stroke({ color: 0x444455, width: 1.5, alpha: 0.45 })
}

export interface RendererConfig {
  treeLayout?: 'standard' | 'weaver'
}

export async function initRenderer(
  canvas: HTMLCanvasElement,
  callbacksRef: { current: RendererCallbacks },
  config: RendererConfig = {}
): Promise<RendererInstance> {
  const treeLayout = config.treeLayout ?? 'standard'
  const app = new Application()
  await app.init({
    canvas,
    background: 0x0a0a0b,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  })

  // Prevent browser context menu on right-click so right-click node action works
  const onContextMenu = (e: Event) => e.preventDefault()
  app.canvas.addEventListener('contextmenu', onContextMenu)

  const worldContainer = new Container()
  app.stage.addChild(worldContainer)

  const edgeGraphics = new Graphics()
  const lockedGraphics = new Graphics()
  const availableGraphics = new Graphics()
  const allocatedGraphics = new Graphics()
  const suggestedGraphics = new Graphics()
  const dimmedGraphics = new Graphics()
  const previewRemovedGraphics = new Graphics()
  const previewAddedGraphics = new Graphics()
  const overlayGraphics = new Graphics()
  const searchDimOverlayGraphics = new Graphics()
  const searchHighlightGraphics = new Graphics()
  // Text labels for point counts
  const labelContainer = new Container()
  // Flash animation layer — above labels, below selection/hit areas
  const flashContainer = new Container()
  // Icon sprites — above node backgrounds, below suggestion/preview overlays and labels
  const iconContainer = new Container()
  // Selection ring — above all node/label layers, below hit areas
  const selectionGraphics = new Graphics()
  // Pure interaction layer — no rendering, just hitArea containers
  const hitAreaContainer = new Container()

  worldContainer.addChild(
    edgeGraphics,
    lockedGraphics,
    availableGraphics,
    allocatedGraphics,
    iconContainer,
    dimmedGraphics,
    suggestedGraphics,
    previewRemovedGraphics,
    previewAddedGraphics,
    overlayGraphics,
    searchDimOverlayGraphics,
    searchHighlightGraphics,
    labelContainer,
    flashContainer,
    selectionGraphics,
    hitAreaContainer,
  )

  worldContainer.scale.set(0.6)

  // Pan — with 4px drag threshold so a short click drift doesn't pan
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  let dragging = false
  let dragOrigin = { x: 0, y: 0 }
  let panOrigin = { x: 0, y: 0 }
  const DRAG_THRESHOLD = 4

  app.stage.on('pointerdown', (e) => {
    dragOrigin = { x: e.global.x, y: e.global.y }
    panOrigin = { x: worldContainer.x, y: worldContainer.y }
  })
  app.stage.on('pointermove', (e) => {
    if (e.buttons === 0) return
    if (!dragging) {
      const dx = e.global.x - dragOrigin.x
      const dy = e.global.y - dragOrigin.y
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      dragging = true
    }
    worldContainer.x = panOrigin.x + (e.global.x - dragOrigin.x)
    worldContainer.y = panOrigin.y + (e.global.y - dragOrigin.y)
  })
  app.stage.on('pointerup', () => {
    dragging = false
  })
  app.stage.on('pointerupoutside', () => {
    dragging = false
  })

  // Zoom toward cursor — range 0.3x–2.5x (AC requirement)
  const MIN_ZOOM = 0.3
  const MAX_ZOOM = 2.5

  app.canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, worldContainer.scale.x * factor))

      const cursorWorldX = (e.offsetX - worldContainer.x) / worldContainer.scale.x
      const cursorWorldY = (e.offsetY - worldContainer.y) / worldContainer.scale.y
      worldContainer.scale.set(newScale)
      worldContainer.x = e.offsetX - cursorWorldX * newScale
      worldContainer.y = e.offsetY - cursorWorldY * newScale
    },
    { passive: false }
  )

  let lastRenderedNodeMap: Map<string, TreeNode> = new Map()
  let iconTexturesMap: Map<string, Texture> = new Map()
  let lastRenderedIconIds = new Set<string>()
  let lastTreeId: string | undefined

  // Canvas dimensions — tracked by resize(), used by fitToTree/zoomIn/zoomOut
  let canvasW = 0
  let canvasH = 0
  // If fitToTree is called before canvas has dimensions, defer until first valid resize
  let pendingFitNodes: TreeNode[] | null = null

  interface PendingIconAnim {
    sprite: Sprite
    startTime: number
    delay: number
  }
  let pendingIconAnimations: PendingIconAnim[] = []

  const iconAnimTick = () => {
    const now = performance.now()
    pendingIconAnimations = pendingIconAnimations.filter(({ sprite, startTime, delay }) => {
      if (now < startTime + delay) return true
      const elapsed = now - (startTime + delay)
      const ANIM_DURATION = 100
      const progress = Math.min(elapsed / ANIM_DURATION, 1)
      sprite.scale.set(0.7 + 0.3 * progress)
      sprite.alpha = progress
      return progress < 1
    })
  }
  app.ticker.add(iconAnimTick)

  function renderTree(
    data: TreeData,
    nodeAllocations: Record<string, number>,
    highlightedNodes: HighlightedNodes,
    iconTextures: Map<string, Texture>,
    selectedNodeId?: string | null,
    nodeEfficiencies?: NodeEfficiency[] | null,
    showOverlay?: boolean
  ) {
    iconTexturesMap = iconTextures
    lastRenderedNodeMap = new Map(data.nodes.map((n) => [n.id, n]))

    // Auto-fit when the tree changes (mastery switch or first load)
    const currentTreeId = data.nodes[0]?.id
    if (currentTreeId !== lastTreeId) {
      lastRenderedIconIds = new Set()
      lastTreeId = currentTreeId
      fitToTree(data.nodes)
    }
    const prevIconIds = lastRenderedIconIds
    const newIconIds = new Set<string>()

    edgeGraphics.clear()
    lockedGraphics.clear()
    availableGraphics.clear()
    allocatedGraphics.clear()
    suggestedGraphics.clear()
    dimmedGraphics.clear()
    previewRemovedGraphics.clear()
    previewAddedGraphics.clear()
    overlayGraphics.clear()
    searchDimOverlayGraphics.clear()
    searchHighlightGraphics.clear()
    selectionGraphics.clear()
    iconContainer.removeChildren()
    hitAreaContainer.removeChildren()
    labelContainer.removeChildren()

    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]))

    // Draw all edges as a single multi-segment path → one stroke call (vs 1205 individual strokes)
    for (const edge of data.edges) {
      const from = nodeMap.get(edge.fromId)
      const to = nodeMap.get(edge.toId)
      if (from && to) {
        edgeGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y)
      }
    }
    if (data.edges.length > 0) {
      edgeGraphics.stroke({ color: 0x3a3a45, width: 1.5 })
    }

    for (const node of data.nodes) {
      const r = NODE_RADIUS[node.size]
      // Fix: key exists with value 0 means NOT allocated — must check value > 0
      const isAllocated = (nodeAllocations[node.id] ?? 0) > 0
      const isGlowing = highlightedNodes.glowing.has(node.id)
      const isDimmed = highlightedNodes.dimmed.has(node.id) && !isGlowing
      const isPreviewRemoved = highlightedNodes.previewRemoved.has(node.id)
      const isPreviewAdded = highlightedNodes.previewAdded.has(node.id)

      if (isPreviewRemoved) {
        drawPreviewRemoved(previewRemovedGraphics, node.x, node.y, r)
      } else if (isPreviewAdded) {
        drawPreviewAdded(previewAddedGraphics, node.x, node.y, r)
      } else if (isAllocated || node.state === 'allocated') {
        drawAllocated(allocatedGraphics, node.x, node.y, r)
      } else if (isGlowing || node.state === 'suggested') {
        drawSuggested(suggestedGraphics, node.x, node.y, r, reducedMotionEnabled)
      } else if (isDimmed) {
        drawDimmed(dimmedGraphics, node.x, node.y, r)
      } else if (node.state === 'locked') {
        drawLocked(lockedGraphics, node.x, node.y, r)
      } else {
        drawAvailable(availableGraphics, node.x, node.y, r)
      }

      const isSearchHighlighted = highlightedNodes.searchHighlighted.has(node.id)
      const isSearchDimmed = highlightedNodes.searchDimmed.has(node.id)
      if (isSearchDimmed && !isGlowing) drawSearchDimOverlay(searchDimOverlayGraphics, node.x, node.y, r)
      if (isSearchHighlighted) drawSearchHighlight(searchHighlightGraphics, node.x, node.y, r)

      // Selection ring — white border around the selected node, drawn above all other node layers
      if (selectedNodeId === node.id) {
        selectionGraphics.circle(node.x, node.y, r + 4).stroke({ color: 0xffffff, width: 2.5 })
      }

      // Icon sprite — centered in node, clipped to circle
      const texture = iconTexturesMap.get(node.id)
      if (texture) {
        const sprite = new Sprite(texture)
        sprite.anchor.set(0.5, 0.5)
        sprite.x = node.x
        sprite.y = node.y
        const iconSize = r * 1.6
        sprite.width = iconSize
        sprite.height = iconSize

        const mask = new Graphics()
        mask.circle(node.x, node.y, r - 1).fill(0xffffff)
        sprite.mask = mask

        iconContainer.addChild(mask)
        iconContainer.addChild(sprite)
        newIconIds.add(node.id)

        if (!reducedMotionEnabled && !prevIconIds.has(node.id)) {
          sprite.scale.set(0)
          sprite.alpha = 0
          pendingIconAnimations.push({
            sprite,
            startTime: performance.now(),
            delay: pendingIconAnimations.length * 50,
          })
        }
      }

      // Point count label inside the node — only shown when points are allocated
      const currentPts = nodeAllocations[node.id] ?? 0
      if (currentPts > 0) {
        let labelColor: string
        if (isPreviewRemoved) {
          labelColor = '#ff5555'
        } else if (isPreviewAdded) {
          labelColor = '#44ff88'
        } else if (isAllocated || node.state === 'allocated') {
          labelColor = '#c9a84c'
        } else if (node.state === 'locked') {
          labelColor = '#3d3d50'
        } else {
          labelColor = '#4a6070'
        }

        const label = new Text({
          text: `${currentPts}/${node.maxPoints}`,
          style: {
            fontSize: 10,
            fontWeight: '700',
            fill: labelColor,
            fontFamily: 'monospace',
            align: 'center',
          },
        })
        label.anchor.set(0.5, 0.5)
        label.x = node.x
        label.y = node.y + r * 0.35
        labelContainer.addChild(label)
      }

      // Invisible hit area: Container + Circle hitArea — no GPU draw calls
      const hit = new Container()
      hit.eventMode = 'static'
      hit.cursor = 'pointer'
      hit.hitArea = new Circle(node.x, node.y, r + 4)
      hit.on('pointerover', () => callbacksRef.current.onNodeHover(node.id))
      hit.on('pointerout', () => callbacksRef.current.onNodeHover(null))
      hit.on('pointerdown', (e) => {
        e.stopPropagation()
        // stopPropagation prevents the stage pointerdown from updating dragOrigin/panOrigin.
        // Update them here so a drag starting from a node uses the correct origin.
        dragOrigin = { x: e.global.x, y: e.global.y }
        panOrigin = { x: worldContainer.x, y: worldContainer.y }
        if (e.button === 2) {
          callbacksRef.current.onNodeClick(node.id, 2)
          return
        }
      })
      hit.on('pointerup', (e) => {
        if (e.button !== 0) return
        // Only allocate+select if this was a clean click (no drag exceeded threshold)
        if (!dragging) {
          callbacksRef.current.onNodeClick(node.id, 0)
          callbacksRef.current.onNodeSelect?.(node.id)
        }
      })
      hitAreaContainer.addChild(hit)
    }

    lastRenderedIconIds = newIconIds

    // Efficiency overlay — drawn after main node loop so it sits above base node layers.
    // overlayGraphics is already cleared above; only draw when overlay is active.
    if (nodeEfficiencies && nodeEfficiencies.length > 0 && showOverlay) {
      const effMap = new Map(nodeEfficiencies.map((e) => [e.node_id, e]))
      for (const node of data.nodes) {
        const isAllocated = (nodeAllocations[node.id] ?? 0) > 0
        const isPreviewAdded = highlightedNodes.previewAdded.has(node.id)
        if (isAllocated || isPreviewAdded) continue
        const eff = effMap.get(node.id)
        if (!eff) continue
        const r = NODE_RADIUS[node.size]
        if (eff.tier === 'gold') drawOverlayGold(overlayGraphics, node.x, node.y, r)
        else if (eff.tier === 'silver') drawOverlaySilver(overlayGraphics, node.x, node.y, r)
        else drawOverlayDim(overlayGraphics, node.x, node.y, r)
      }
    }
  }

  let reducedMotionEnabled = false

  function setReducedMotion(enabled: boolean) {
    reducedMotionEnabled = enabled
  }

  function fitToTree(nodes: TreeNode[]) {
    if (nodes.length === 0) return
    if (canvasW === 0 || canvasH === 0) {
      pendingFitNodes = nodes
      return
    }
    pendingFitNodes = null
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const PADDING = 60
    const treeW = maxX - minX + PADDING * 2
    const treeH = maxY - minY + PADDING * 2
    const scaleX = canvasW / treeW
    const scaleY = canvasH / treeH
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(scaleX, scaleY)))
    worldContainer.scale.set(newScale)
    // Weaver tree: radial hub is at world (0,0) — center the viewport there.
    // Standard tree: center on bounding box midpoint.
    const treeCenterX = treeLayout === 'weaver' ? 0 : (minX + maxX) / 2
    const treeCenterY = treeLayout === 'weaver' ? 0 : (minY + maxY) / 2
    worldContainer.x = canvasW / 2 - treeCenterX * newScale
    worldContainer.y = canvasH / 2 - treeCenterY * newScale
  }

  function zoomIn() {
    const newScale = Math.min(MAX_ZOOM, worldContainer.scale.x * 1.25)
    const cx = canvasW / 2
    const cy = canvasH / 2
    const cursorWorldX = (cx - worldContainer.x) / worldContainer.scale.x
    const cursorWorldY = (cy - worldContainer.y) / worldContainer.scale.y
    worldContainer.scale.set(newScale)
    worldContainer.x = cx - cursorWorldX * newScale
    worldContainer.y = cy - cursorWorldY * newScale
  }

  function zoomOut() {
    const newScale = Math.max(MIN_ZOOM, worldContainer.scale.x / 1.25)
    const cx = canvasW / 2
    const cy = canvasH / 2
    const cursorWorldX = (cx - worldContainer.x) / worldContainer.scale.x
    const cursorWorldY = (cy - worldContainer.y) / worldContainer.scale.y
    worldContainer.scale.set(newScale)
    worldContainer.x = cx - cursorWorldX * newScale
    worldContainer.y = cy - cursorWorldY * newScale
  }

  function resize(w: number, h: number) {
    app.renderer.resize(w, h)
    app.stage.hitArea = app.screen
    canvasW = w
    canvasH = h
    // Execute any deferred fit that was requested before canvas had dimensions
    if (pendingFitNodes && w > 0 && h > 0) {
      fitToTree(pendingFitNodes)
    }
  }

  function destroy() {
    app.canvas.removeEventListener('contextmenu', onContextMenu)
    app.ticker.remove(iconAnimTick)
    pendingIconAnimations = []
    // false = do not remove canvas from DOM; React owns the canvas element's lifecycle
    app.destroy(false, { children: true })
  }

  function getViewport() {
    return { x: worldContainer.x, y: worldContainer.y, scale: worldContainer.scale.x }
  }

  function addTickerListener(fn: () => void): () => void {
    const cb = () => fn()
    app.ticker.add(cb)
    return () => app.ticker.remove(cb)
  }

  let activeTick: (() => void) | null = null

  function triggerFlash(nodeIds: string[]) {
    if (reducedMotionEnabled || nodeIds.length === 0) return

    if (activeTick) {
      app.ticker.remove(activeTick)
      activeTick = null
    }
    flashContainer.removeChildren()

    const DURATION = 150
    const START_SCALE = 1.05

    for (const nodeId of nodeIds) {
      const node = lastRenderedNodeMap.get(nodeId)
      if (!node) continue
      const r = NODE_RADIUS[node.size]

      const g = new Graphics()
      g.circle(0, 0, r).fill(0x2a2a35)
      g.circle(0, 0, r).stroke({ color: 0x5a5050, width: 2 })

      const c = new Container()
      c.x = node.x
      c.y = node.y
      c.scale.set(START_SCALE)
      c.addChild(g)
      flashContainer.addChild(c)
    }

    const startTime = performance.now()

    const tick = () => {
      const progress = Math.min((performance.now() - startTime) / DURATION, 1)
      const scale = START_SCALE - (START_SCALE - 1.0) * progress

      for (const child of flashContainer.children) {
        child.scale.set(scale)
      }

      if (progress >= 1) {
        flashContainer.removeChildren()
        app.ticker.remove(tick)
        activeTick = null
      }
    }

    activeTick = tick
    app.ticker.add(tick)
  }

  return {
    renderTree,
    resize,
    destroy,
    getViewport,
    addTickerListener,
    setReducedMotion,
    triggerFlash,
    fitToTree,
    zoomIn,
    zoomOut,
  }
}
