import { Application, Assets, Circle, Container, Graphics, Sprite, Text, TilingSprite } from 'pixi.js'
import type { Texture } from 'pixi.js'
import type { TreeData, TreeNode, HighlightedNodes, RendererCallbacks, RendererInstance } from './types'
import type { NodeEfficiency } from '../../shared/types/statSheet'
import { nearestAllocatedPath } from './nearestAllocatedPath'

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

// Suggestion-tier overlay colors (FR-17). Canonical values live in global.css design tokens;
// PixiJS needs numeric hex, so these mirror the tokens — keep them in sync.
const COLOR_SUGGESTED_GOLD = 0xc9a84c // --color-accent-gold
const COLOR_SUGGESTED_GOLD_SOFT = 0xd4b96a // --color-accent-gold-soft (gold pulse peak)
const COLOR_SUGGESTED_SILVER = 0xc0c6d2 // --color-node-suggested-silver
const GOLD_TIER_SCALE = 1.4
const SILVER_TIER_SCALE = 1.2
const GOLD_PULSE_PERIOD_MS = 1800
// Dashed gold path line (AC2) — PixiJS v8 Graphics has no native dash, so segments are hand-cut.
const DASH_LENGTH = 9
const DASH_GAP = 6

// Damage-type tint overlays for skill tree canvases (ARGB color + alpha)
const DAMAGE_TYPE_TINTS: Record<string, { color: number; alpha: number }> = {
  FIRE:      { color: 0xb45014, alpha: 0.18 },  // rgba(180,  80,  20, 0.18)
  COLD:      { color: 0x2864b4, alpha: 0.18 },  // rgba( 40, 100, 180, 0.18)
  LIGHTNING: { color: 0xb4a014, alpha: 0.18 },  // rgba(180, 160,  20, 0.18)
  VOID:      { color: 0x50148c, alpha: 0.18 },  // rgba( 80,  20, 140, 0.18)
  POISON:    { color: 0x1e7828, alpha: 0.18 },  // rgba( 30, 120,  40, 0.18)
}

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

// Gold-tier suggested node (FR-17): 1.4× scaled node drawn IN PLACE OF drawAvailable. The pulsing
// glow is a separate animated layer (goldPulseTick) so reduced-motion can drop it while this static
// scale + outline remains (AC3).
function drawSuggestedGold(g: Graphics, x: number, y: number, r: number) {
  const sr = r * GOLD_TIER_SCALE
  g.circle(x, y, sr).fill(0x141417)
  g.circle(x, y, sr).stroke({ color: COLOR_SUGGESTED_GOLD, width: 3 })
}

// Silver-tier suggested node (FR-17): 1.2× scaled node with a STEADY (non-animated) glow halo.
// The halo is gated on reduced-motion to mirror drawSuggested and AC3 ("the tiered draw skips the
// glow ring; scale + outline are retained").
function drawSuggestedSilver(g: Graphics, x: number, y: number, r: number, reducedMotion = false) {
  const sr = r * SILVER_TIER_SCALE
  if (!reducedMotion) {
    g.circle(x, y, sr + 5).fill({ color: COLOR_SUGGESTED_SILVER, alpha: 0.18 })
  }
  g.circle(x, y, sr).fill(0x141417)
  g.circle(x, y, sr).stroke({ color: COLOR_SUGGESTED_SILVER, width: 3 })
}

// Accumulate hand-cut dashed segments for a node path onto the shared dashed-path Graphics. The
// caller strokes once after the loop. Returns whether any segment was added.
function addDashedPathSegments(g: Graphics, nodeMap: Map<string, TreeNode>, path: string[]): boolean {
  let drew = false
  for (let i = 0; i < path.length - 1; i++) {
    const a = nodeMap.get(path[i])
    const b = nodeMap.get(path[i + 1])
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    if (dist === 0) continue
    const ux = dx / dist
    const uy = dy / dist
    let pos = 0
    while (pos < dist) {
      const end = Math.min(pos + DASH_LENGTH, dist)
      g.moveTo(a.x + ux * pos, a.y + uy * pos)
      g.lineTo(a.x + ux * end, a.y + uy * end)
      drew = true
      pos += DASH_LENGTH + DASH_GAP
    }
  }
  return drew
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
    backgroundAlpha: 0,  // TilingSprite handles the entire background
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  })

  // Background tile — 20000×20000 world-space TilingSprite centered at origin
  const BG_SIZE = 20000
  let bgSprite: TilingSprite | null = null
  try {
    const stoneTileTexture = await Assets.load<Texture>('/backgrounds/bg_stone_tile.png')
    bgSprite = new TilingSprite({ texture: stoneTileTexture, width: BG_SIZE, height: BG_SIZE })
    bgSprite.x = -BG_SIZE / 2
    bgSprite.y = -BG_SIZE / 2
  } catch {
    // Graceful degradation: stone texture unavailable; canvas background stays transparent
  }
  const bgTintGraphics = new Graphics()

  // Prevent browser context menu on right-click so right-click node action works
  const onContextMenu = (e: Event) => e.preventDefault()
  app.canvas.addEventListener('contextmenu', onContextMenu)

  const worldContainer = new Container()
  app.stage.addChild(worldContainer)

  const edgeGraphics = new Graphics()
  // Dashed gold path lines (AC2) — under all node layers, over the solid edges
  const dashedPathGraphics = new Graphics()
  const lockedGraphics = new Graphics()
  const availableGraphics = new Graphics()
  // Animated gold pulse glow (AC1 gold) — below the tier node so the node sits atop its glow
  const goldPulseGraphics = new Graphics()
  // Static scaled gold/silver suggested nodes (AC1) — below icons so icon sprites render on top
  const tierGraphics = new Graphics()
  const allocatedGraphics = new Graphics()
  const suggestedGraphics = new Graphics()
  const dimmedGraphics = new Graphics()
  const previewRemovedGraphics = new Graphics()
  const previewAddedGraphics = new Graphics()
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

  if (bgSprite) {
    worldContainer.addChild(bgSprite)       // first child — stone TilingSprite
  }
  worldContainer.addChild(bgTintGraphics)   // tint overlay (second, or first if no sprite)
  worldContainer.addChild(
    edgeGraphics,
    dashedPathGraphics,
    lockedGraphics,
    availableGraphics,
    goldPulseGraphics,
    tierGraphics,
    allocatedGraphics,
    iconContainer,
    dimmedGraphics,
    suggestedGraphics,
    previewRemovedGraphics,
    previewAddedGraphics,
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

  // Gold-tier pulse (AC1 gold / AC3): renderTree populates these targets; the ticker animates ONLY
  // this dedicated glow layer (never a full renderTree per frame) and reads reducedMotionEnabled
  // each frame so the reduced-motion fallback takes effect live.
  const goldPulseTargets: { x: number; y: number; r: number }[] = []
  const goldPulseTick = () => {
    goldPulseGraphics.clear()
    if (reducedMotionEnabled || goldPulseTargets.length === 0) return
    const t = performance.now() % GOLD_PULSE_PERIOD_MS
    const norm = (Math.sin((2 * Math.PI * t) / GOLD_PULSE_PERIOD_MS) + 1) / 2 // 0..1
    const alpha = 0.15 + 0.35 * norm
    for (const { x, y, r } of goldPulseTargets) {
      const glowR = r * GOLD_TIER_SCALE + 4 + 6 * norm
      goldPulseGraphics.circle(x, y, glowR).fill({ color: COLOR_SUGGESTED_GOLD_SOFT, alpha })
    }
  }
  app.ticker.add(goldPulseTick)

  function renderTree(
    data: TreeData,
    nodeAllocations: Record<string, number>,
    highlightedNodes: HighlightedNodes,
    iconTextures: Map<string, Texture>,
    selectedNodeId?: string | null,
    nodeEfficiencies?: NodeEfficiency[] | null,
    showOverlay?: boolean,
    primaryDamageType?: string
  ) {
    // Background tint overlay — cleared and redrawn once per renderTree call (not per frame)
    bgTintGraphics.clear()
    if (primaryDamageType) {
      const tint = DAMAGE_TYPE_TINTS[primaryDamageType]
      if (tint) {
        bgTintGraphics
          .rect(-BG_SIZE / 2, -BG_SIZE / 2, BG_SIZE, BG_SIZE)
          .fill({ color: tint.color, alpha: tint.alpha })
      }
    }

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
    dashedPathGraphics.clear()
    lockedGraphics.clear()
    availableGraphics.clear()
    goldPulseGraphics.clear()
    tierGraphics.clear()
    allocatedGraphics.clear()
    suggestedGraphics.clear()
    dimmedGraphics.clear()
    previewRemovedGraphics.clear()
    previewAddedGraphics.clear()
    searchDimOverlayGraphics.clear()
    searchHighlightGraphics.clear()
    selectionGraphics.clear()
    iconContainer.removeChildren()
    hitAreaContainer.removeChildren()
    labelContainer.removeChildren()
    goldPulseTargets.length = 0

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

    // Suggestion-tier overlay (FR-17) — same gate as the prior second pass: efficiencies present
    // AND the overlay toggled on. effMap drives the in-loop gold/silver branch. Passive tree only —
    // skill/weaver canvases never receive nodeEfficiencies, so this stays null there.
    const overlayActive = !!(nodeEfficiencies && nodeEfficiencies.length > 0 && showOverlay)
    const effMap = overlayActive ? new Map(nodeEfficiencies!.map((e) => [e.node_id, e])) : null
    let dashedPathDrawn = false

    for (const node of data.nodes) {
      const r = NODE_RADIUS[node.size]
      // Fix: key exists with value 0 means NOT allocated — must check value > 0
      const isAllocated = (nodeAllocations[node.id] ?? 0) > 0
      const isGlowing = highlightedNodes.glowing.has(node.id)
      const isDimmed = highlightedNodes.dimmed.has(node.id) && !isGlowing
      const isPreviewRemoved = highlightedNodes.previewRemoved.has(node.id)
      const isPreviewAdded = highlightedNodes.previewAdded.has(node.id)

      // System B tier (data-backed, hover-free). undefined when overlay is off or the node is
      // dim/untreated — those fall through to the natural available/locked style (AC2 distinctness).
      const tier = effMap?.get(node.id)?.tier

      if (isPreviewRemoved) {
        drawPreviewRemoved(previewRemovedGraphics, node.x, node.y, r)
      } else if (isPreviewAdded) {
        drawPreviewAdded(previewAddedGraphics, node.x, node.y, r)
      } else if (isAllocated || node.state === 'allocated') {
        drawAllocated(allocatedGraphics, node.x, node.y, r)
      } else if (isGlowing || node.state === 'suggested') {
        // System A hover glow stays orthogonal to the tier overlay (Story 3.3 substrate).
        drawSuggested(suggestedGraphics, node.x, node.y, r, reducedMotionEnabled)
      } else if (isDimmed) {
        drawDimmed(dimmedGraphics, node.x, node.y, r)
      } else if (tier === 'gold' || tier === 'silver') {
        // Gold/Silver get the tiered scale + glow IN PLACE OF available/locked (AC1). This branch
        // sits before `locked` so a gold/silver suggestion whose prerequisites are not yet allocated
        // (a locked-state node) still receives the treatment — exactly AC2's path-line case.
        if (tier === 'gold') {
          drawSuggestedGold(tierGraphics, node.x, node.y, r)
          goldPulseTargets.push({ x: node.x, y: node.y, r })
        } else {
          drawSuggestedSilver(tierGraphics, node.x, node.y, r, reducedMotionEnabled)
        }
        // AC2: dashed gold path to the nearest allocated node — drawn only when prerequisites are
        // not yet allocated (the helper returns null when a direct prerequisite is already allocated).
        const path = nearestAllocatedPath(data, nodeAllocations, node.id, nodeMap)
        if (path && addDashedPathSegments(dashedPathGraphics, nodeMap, path)) dashedPathDrawn = true
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
          callbacksRef.current.onNodeClick(node.id, 0, e.shiftKey)
          callbacksRef.current.onNodeSelect?.(node.id)
        }
      })
      hitAreaContainer.addChild(hit)
    }

    lastRenderedIconIds = newIconIds

    // Commit the accumulated dashed gold path segments in one stroke (AC2). PixiJS v8 strokes the
    // sub-paths built since the last fill/stroke; the tier node visuals come from the main loop above.
    if (dashedPathDrawn) {
      dashedPathGraphics.stroke({ color: COLOR_SUGGESTED_GOLD, width: 2 })
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
    app.ticker.remove(goldPulseTick)
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
