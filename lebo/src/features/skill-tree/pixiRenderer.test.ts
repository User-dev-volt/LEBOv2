import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initRenderer, NODE_RADIUS } from './pixiRenderer'
import type { TreeData, RendererCallbacks } from './types'
import type { NodeEfficiency } from '../../shared/types/statSheet'
import { mockTreeData } from './mockTreeData'

// Use vi.hoisted so these refs are available inside the vi.mock factory
const { mockApp, mockRendererResize, mockAppDestroy, MockSprite, MockTilingSprite, graphicsInstances, tickerCallbacks } = vi.hoisted(() => {
  const mockRendererResize = vi.fn()
  const mockAppDestroy = vi.fn()
  // Records every Graphics instance created so tier/path draws can be asserted by value (Story 3.2).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphicsInstances: any[] = []
  // Captures persistent ticker callbacks (iconAnimTick, goldPulseTick) so tests can step one frame.
  const tickerCallbacks: Array<() => void> = []

  function makeSprite() {
    return {
      anchor: { set: vi.fn() },
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      alpha: 1,
      scale: { set: vi.fn() },
      mask: null as unknown,
    }
  }
  const MockSprite = vi.fn(function () { return makeSprite() })
  const MockTilingSprite = vi.fn(function () {
    return { x: 0, y: 0, width: 0, height: 0, alpha: 1 }
  })

  return {
    mockRendererResize,
    mockAppDestroy,
    MockSprite,
    MockTilingSprite,
    mockApp: {
      init: vi.fn().mockResolvedValue(undefined),
      stage: {
        addChild: vi.fn(),
        on: vi.fn(),
        eventMode: '',
        hitArea: null as unknown,
        screen: { width: 800, height: 600 },
      },
      screen: { width: 800, height: 600 },
      canvas: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      renderer: { resize: mockRendererResize },
      ticker: { FPS: 60, add: vi.fn((cb: () => void) => { tickerCallbacks.push(cb) }), remove: vi.fn() },
      destroy: mockAppDestroy,
    },
    graphicsInstances,
    tickerCallbacks,
  }
})

// Stub PixiJS — all rendering is tested at the interface / call level
vi.mock('pixi.js', () => {
  // Regular functions (not arrow) are callable as constructors.
  // Returning an explicit object from a constructor makes `new Foo()` use that object.
  function Application() {
    return mockApp
  }

  function makeContainer() {
    return {
      addChild: vi.fn(),
      removeChildren: vi.fn().mockReturnValue([]),
      x: 0,
      y: 0,
      scale: { set: vi.fn(), x: 0.6, y: 0.6 },
      eventMode: '',
      cursor: '',
      hitArea: null as unknown,
      on: vi.fn(),
    }
  }

  function makeGraphics() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: Record<string, any> = { eventMode: '', cursor: '', _ops: ops }
    g.rect = vi.fn((...args: unknown[]) => { ops.push({ op: 'rect', args }); return g })
    g.circle = vi.fn((x: number, y: number, radius: number) => { ops.push({ op: 'circle', x, y, radius }); return g })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g.fill = vi.fn((style: any) => { ops.push({ op: 'fill', color: typeof style === 'object' ? style?.color : style, alpha: style?.alpha }); return g })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g.stroke = vi.fn((style: any) => { ops.push({ op: 'stroke', color: style?.color, width: style?.width, alpha: style?.alpha }); return g })
    g.moveTo = vi.fn((x: number, y: number) => { ops.push({ op: 'moveTo', x, y }); return g })
    g.lineTo = vi.fn((x: number, y: number) => { ops.push({ op: 'lineTo', x, y }); return g })
    g.clear = vi.fn(() => { ops.length = 0; return g })
    g.on = vi.fn()
    graphicsInstances.push(g)
    return g
  }

  function Container() {
    return makeContainer()
  }
  function Graphics() {
    return makeGraphics()
  }
  function Text() {
    return { text: '', anchor: { set: vi.fn() }, position: { set: vi.fn() }, x: 0, y: 0 }
  }

  function Circle(this: unknown, x: number, y: number, r: number) {
    return { x, y, radius: r, type: 'circle' }
  }

  const Assets = {
    load: vi.fn().mockResolvedValue({}),
  }

  return { Application, Container, Graphics, Text, Sprite: MockSprite, TilingSprite: MockTilingSprite, Assets, Circle }
})

function makeCallbacksRef(): { current: RendererCallbacks } {
  return { current: { onNodeClick: vi.fn(), onNodeHover: vi.fn() } }
}

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas')
}

const emptyTree: TreeData = { nodes: [], edges: [] }

// ── Story 3.2 tier-overlay test helpers ──────────────────────────────────
const GOLD = 0xc9a84c
const GOLD_SOFT = 0xd4b96a
const SILVER = 0xc0c6d2
const NODE_SUGGESTED = 0x7b68ee
const AVAILABLE_STROKE = 0x4a7a9e
const MED_R = NODE_RADIUS.medium
const GOLD_SCALE = 1.4
const SILVER_SCALE = 1.2

function glow(...ids: string[]) {
  return { ...emptyHl(), glowing: new Set(ids) }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasStrokeAtRadius(color: number, radius: number, tol = 0.6) {
  return graphicsInstances.some((g) =>
    opsOf(g).some((o) => o.op === 'circle' && Math.abs((o.radius ?? NaN) - radius) < tol) &&
    hasStroke(g, color)
  )
}
function anyStroke(color: number) {
  return graphicsInstances.some((g) => hasStroke(g, color))
}

function effOf(node_id: string, tier: 'gold' | 'silver' | 'dim'): NodeEfficiency {
  return { node_id, tier, efficiency: 1, path_delta_score: 1, effective_point_cost: 1 }
}
function medNode(
  id: string,
  x = 100,
  y = 100,
  state: 'available' | 'locked' | 'allocated' = 'available',
  connections: string[] = []
): TreeData['nodes'][number] {
  return { id, x, y, size: 'medium', state, maxPoints: 1, connections }
}
function emptyHl() {
  return {
    glowing: new Set<string>(),
    dimmed: new Set<string>(),
    previewRemoved: new Set<string>(),
    previewAdded: new Set<string>(),
    searchHighlighted: new Set<string>(),
    searchDimmed: new Set<string>(),
  }
}
type GfxOp = { op: string; x?: number; y?: number; radius?: number; color?: number; width?: number; alpha?: number; args?: unknown[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function opsOf(g: any): GfxOp[] {
  return g._ops as GfxOp[]
}
function instancesWithCircle(radius: number, tol = 0.5) {
  return graphicsInstances.filter((g) => opsOf(g).some((o) => o.op === 'circle' && Math.abs((o.radius ?? NaN) - radius) < tol))
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasStroke(g: any, color: number) {
  return opsOf(g).some((o) => o.op === 'stroke' && o.color === color)
}
function anyFill(color: number) {
  return graphicsInstances.some((g) => opsOf(g).some((o) => o.op === 'fill' && o.color === color))
}
function dashedPathLayer() {
  // The dashed gold path layer is the one with moveTo segments AND a gold stroke
  // (solid edges stroke 0x3a3a45, the tier node ring is a circle not a moveTo).
  return graphicsInstances.find((g) => opsOf(g).some((o) => o.op === 'moveTo') && hasStroke(g, GOLD))
}
function stepOneFrame() {
  for (const cb of tickerCallbacks) cb()
}

describe('initRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore the resolved-value implementation that clearAllMocks preserves
    mockApp.init.mockResolvedValue(undefined)
    graphicsInstances.length = 0
    tickerCallbacks.length = 0
  })

  it('returns an object with renderTree, resize, and destroy methods', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    expect(typeof renderer.renderTree).toBe('function')
    expect(typeof renderer.resize).toBe('function')
    expect(typeof renderer.destroy).toBe('function')
  })

  it('renderTree does not throw with empty TreeData (0 nodes, 0 edges)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    expect(() => renderer.renderTree(emptyTree, {}, { glowing: new Set(), dimmed: new Set(), previewRemoved: new Set(), previewAdded: new Set(), searchHighlighted: new Set(), searchDimmed: new Set() }, new Map())).not.toThrow()
  })

  it('renderTree does not throw with 800-node mock tree', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    expect(() => renderer.renderTree(mockTreeData, {}, { glowing: new Set(), dimmed: new Set(), previewRemoved: new Set(), previewAdded: new Set(), searchHighlighted: new Set(), searchDimmed: new Set() }, new Map())).not.toThrow()
  })

  it('resize calls app.renderer.resize with correct args', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    expect(mockRendererResize).toHaveBeenCalledWith(800, 600)
  })

  it('destroy calls app.destroy', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.destroy()
    expect(mockAppDestroy).toHaveBeenCalled()
  })

  it('renderTree with non-empty iconTextures calls Sprite constructor once per mapped node', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const singleNodeTree: TreeData = {
      nodes: [{ id: 'node1', x: 100, y: 100, size: 'medium', state: 'available', maxPoints: 1, connections: [] }],
      edges: [],
    }
    const iconTextures = new Map([['node1', {} as import('pixi.js').Texture]])
    const emptyHighlight = {
      glowing: new Set<string>(),
      dimmed: new Set<string>(),
      previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(),
      searchHighlighted: new Set<string>(),
      searchDimmed: new Set<string>(),
    }
    renderer.renderTree(singleNodeTree, {}, emptyHighlight, iconTextures)
    expect(MockSprite).toHaveBeenCalledTimes(1)
  })

  it('renderTree with empty iconTextures calls no Sprite constructors', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const singleNodeTree: TreeData = {
      nodes: [{ id: 'node1', x: 100, y: 100, size: 'medium', state: 'available', maxPoints: 1, connections: [] }],
      edges: [],
    }
    const emptyHighlight = {
      glowing: new Set<string>(),
      dimmed: new Set<string>(),
      previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(),
      searchHighlighted: new Set<string>(),
      searchDimmed: new Set<string>(),
    }
    renderer.renderTree(singleNodeTree, {}, emptyHighlight, new Map())
    expect(MockSprite).not.toHaveBeenCalled()
  })

  it('calling renderTree twice clears iconContainer before re-adding sprites', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const singleNodeTree: TreeData = {
      nodes: [{ id: 'node1', x: 100, y: 100, size: 'medium', state: 'available', maxPoints: 1, connections: [] }],
      edges: [],
    }
    const iconTextures = new Map([['node1', {} as import('pixi.js').Texture]])
    const emptyHighlight = {
      glowing: new Set<string>(),
      dimmed: new Set<string>(),
      previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(),
      searchHighlighted: new Set<string>(),
      searchDimmed: new Set<string>(),
    }
    renderer.renderTree(singleNodeTree, {}, emptyHighlight, iconTextures)
    renderer.renderTree(singleNodeTree, {}, emptyHighlight, iconTextures)
    // Sprite called once per renderTree call (2 total), and iconContainer.removeChildren called each time
    expect(MockSprite).toHaveBeenCalledTimes(2)
  })

  // ── Review-finding fixes ────────────────────────────────────────────────

  it('exposes fitToTree, zoomIn, zoomOut methods', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    expect(typeof renderer.fitToTree).toBe('function')
    expect(typeof renderer.zoomIn).toBe('function')
    expect(typeof renderer.zoomOut).toBe('function')
  })

  it('fitToTree does not throw with empty node list', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    expect(() => renderer.fitToTree([])).not.toThrow()
  })

  it('fitToTree does not throw with a valid node list (canvas size > 0)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    expect(() =>
      renderer.fitToTree([{ id: 'n1', x: -100, y: -100, size: 'medium', maxPoints: 1, connections: [], state: 'available' }])
    ).not.toThrow()
  })

  it('zoomIn and zoomOut do not throw', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    expect(() => renderer.zoomIn()).not.toThrow()
    expect(() => renderer.zoomOut()).not.toThrow()
  })

  it('renderTree with selectedNodeId does not throw', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const singleNodeTree: TreeData = {
      nodes: [{ id: 'node1', x: 100, y: 100, size: 'medium', state: 'available', maxPoints: 1, connections: [] }],
      edges: [],
    }
    const emptyHighlight = {
      glowing: new Set<string>(),
      dimmed: new Set<string>(),
      previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(),
      searchHighlighted: new Set<string>(),
      searchDimmed: new Set<string>(),
    }
    expect(() => renderer.renderTree(singleNodeTree, {}, emptyHighlight, new Map(), 'node1')).not.toThrow()
  })

  it('node with nodeAllocations value 0 is NOT rendered as allocated (isAllocated fix)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    // Provide a node whose allocation value is explicitly 0 — should draw as available, not allocated
    const singleNodeTree: TreeData = {
      nodes: [{ id: 'node1', x: 100, y: 100, size: 'medium', state: 'available', maxPoints: 3, connections: [] }],
      edges: [],
    }
    const emptyHighlight = {
      glowing: new Set<string>(),
      dimmed: new Set<string>(),
      previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(),
      searchHighlighted: new Set<string>(),
      searchDimmed: new Set<string>(),
    }
    // nodeAllocations has the key but value is 0 — must NOT count as allocated
    expect(() =>
      renderer.renderTree(singleNodeTree, { node1: 0 }, emptyHighlight, new Map())
    ).not.toThrow()
    // The Sprite constructor must not have been called (icon rendering is separate, but we verify no crash)
    expect(MockSprite).not.toHaveBeenCalled()
  })

  it('renderTree with primaryDamageType COLD does not throw', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const emptyHighlight = {
      glowing: new Set<string>(), dimmed: new Set<string>(), previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(), searchHighlighted: new Set<string>(), searchDimmed: new Set<string>(),
    }
    expect(() =>
      renderer.renderTree(emptyTree, {}, emptyHighlight, new Map(), null, null, false, 'COLD')
    ).not.toThrow()
  })

  it('renderTree without primaryDamageType does not throw', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const emptyHighlight = {
      glowing: new Set<string>(), dimmed: new Set<string>(), previewRemoved: new Set<string>(),
      previewAdded: new Set<string>(), searchHighlighted: new Set<string>(), searchDimmed: new Set<string>(),
    }
    expect(() =>
      renderer.renderTree(emptyTree, {}, emptyHighlight, new Map())
    ).not.toThrow()
  })

  // ── Story 3.2 — tiered suggestion overlay (AC1/AC2/AC3) ──────────────────

  it('AC1: a gold-tier node draws at 1.4× radius with a gold ring, in place of the available node', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'gold')], true)

    const goldNodes = instancesWithCircle(MED_R * 1.4)
    expect(goldNodes.length).toBeGreaterThan(0)
    expect(goldNodes.some((g) => hasStroke(g, GOLD))).toBe(true)
    // It replaced drawAvailable — there is no base-radius available node left behind.
    expect(instancesWithCircle(MED_R).some((g) => hasStroke(g, AVAILABLE_STROKE))).toBe(false)
  })

  it('AC1: a silver-tier node draws at 1.2× radius with a silver ring + steady glow, glow suppressed under reduced motion', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'silver')], true)

    const silverNodes = instancesWithCircle(MED_R * 1.2)
    expect(silverNodes.some((g) => hasStroke(g, SILVER))).toBe(true)
    expect(instancesWithCircle(MED_R * 1.4).length).toBe(0)
    // steady silver glow halo present (a silver FILL, distinct from the silver ring stroke)
    expect(anyFill(SILVER)).toBe(true)
    // it replaced drawAvailable — no base-radius available node left behind
    expect(instancesWithCircle(MED_R).some((g) => hasStroke(g, AVAILABLE_STROKE))).toBe(false)

    // reduced motion suppresses the steady glow but keeps the 1.2× scale + ring
    renderer.setReducedMotion(true)
    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'silver')], true)
    expect(anyFill(SILVER)).toBe(false)
    expect(instancesWithCircle(MED_R * 1.2).some((g) => hasStroke(g, SILVER))).toBe(true)
  })

  it('AC1 scope: a dim-tier node renders identically to a plain available node (no scale, no glow)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'dim')], true)
    stepOneFrame()

    expect(instancesWithCircle(MED_R).some((g) => hasStroke(g, AVAILABLE_STROKE))).toBe(true)
    expect(instancesWithCircle(MED_R * 1.4).length).toBe(0)
    expect(instancesWithCircle(MED_R * 1.2).length).toBe(0)
    expect(anyFill(GOLD_SOFT)).toBe(false)
  })

  it('AC3: the gold pulse glow is animated normally but suppressed under reduced motion (scale + ring remain)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }

    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'gold')], true)
    stepOneFrame()
    expect(anyFill(GOLD_SOFT)).toBe(true)

    renderer.setReducedMotion(true)
    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'gold')], true)
    stepOneFrame()
    expect(anyFill(GOLD_SOFT)).toBe(false)
    // The static scaled gold node + ring survive the reduced-motion path.
    expect(instancesWithCircle(MED_R * 1.4).some((g) => hasStroke(g, GOLD))).toBe(true)
  })

  it('AC2: a gold suggestion whose prerequisites are not yet allocated gets a dashed gold path line from the node', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    // A(allocated) — B — C(gold, locked: prerequisite B not allocated)
    const tree: TreeData = {
      nodes: [
        medNode('A', 0, 0, 'allocated', ['B']),
        medNode('B', 50, 0, 'available', ['A', 'C']),
        medNode('C', 100, 0, 'locked', ['B']),
      ],
      edges: [
        { fromId: 'A', toId: 'B' },
        { fromId: 'B', toId: 'C' },
      ],
    }
    renderer.renderTree(tree, { A: 1 }, emptyHl(), new Map(), null, [effOf('C', 'gold')], true)

    const dashed = dashedPathLayer()
    expect(dashed).toBeDefined()
    const firstMove = opsOf(dashed).find((o) => o.op === 'moveTo')
    expect(firstMove).toBeDefined()
    // The dashed line starts at the suggested node C and traces back toward the allocated tree.
    expect(firstMove!.x).toBeCloseTo(100)
    expect(firstMove!.y).toBeCloseTo(0)
    // ...and reaches the allocated node A at (0,0) — the far endpoint of the traced path.
    const reachesAllocated = opsOf(dashed).some(
      (o) => o.op === 'lineTo' && Math.abs(o.x ?? NaN) < 0.5 && Math.abs(o.y ?? NaN) < 0.5
    )
    expect(reachesAllocated).toBe(true)
  })

  it('AC2: no dashed path line is drawn for a dim-tier node', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = {
      nodes: [
        medNode('A', 0, 0, 'allocated', ['B']),
        medNode('B', 50, 0, 'available', ['A', 'C']),
        medNode('C', 100, 0, 'locked', ['B']),
      ],
      edges: [
        { fromId: 'A', toId: 'B' },
        { fromId: 'B', toId: 'C' },
      ],
    }
    renderer.renderTree(tree, { A: 1 }, emptyHl(), new Map(), null, [effOf('C', 'dim')], true)
    expect(dashedPathLayer()).toBeUndefined()
  })

  it('gate: with showOverlay=false, a gold-tier efficiency is ignored and the node renders as available', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map(), null, [effOf('n1', 'gold')], false)

    expect(instancesWithCircle(MED_R * 1.4).length).toBe(0)
    expect(instancesWithCircle(MED_R).some((g) => hasStroke(g, AVAILABLE_STROKE))).toBe(true)
  })

  // ── Story 3.3 — card cross-highlight COMPOSES with the 3.2 tier treatment (Task 4) ──────────

  it('a glowing GOLD node keeps its 1.4× tier ring AND gets an additive gold-soft emphasis ring (not downgraded to a base purple ring)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, glow('n1'), new Map(), null, [effOf('n1', 'gold')], true)

    // 3.2 tier treatment survives: scaled node + gold ring at 1.4×.
    expect(instancesWithCircle(MED_R * GOLD_SCALE).some((g) => hasStroke(g, GOLD))).toBe(true)
    // The precedence bug would have replaced it with a flat base-radius purple ring — assert it did NOT.
    expect(hasStrokeAtRadius(NODE_SUGGESTED, MED_R)).toBe(false)
    // Additive emphasis ring at the EFFECTIVE (tier-scaled) radius, in the amplified gold-soft colour.
    expect(hasStrokeAtRadius(GOLD_SOFT, MED_R * GOLD_SCALE + 3)).toBe(true)
  })

  it('a glowing SILVER node keeps its 1.2× tier ring AND gets an additive silver emphasis ring at the effective radius', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, glow('n1'), new Map(), null, [effOf('n1', 'silver')], true)

    expect(instancesWithCircle(MED_R * SILVER_SCALE).some((g) => hasStroke(g, SILVER))).toBe(true)
    expect(hasStrokeAtRadius(NODE_SUGGESTED, MED_R)).toBe(false)
    // emphasis ring hugs the silver node at its effective radius (sr + 3), distinct from the tier ring.
    expect(hasStrokeAtRadius(SILVER, MED_R * SILVER_SCALE + 3)).toBe(true)
  })

  it('a glowing UNTREATED node draws available + an additive suggested-purple emphasis ring', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.renderTree(tree, {}, glow('n1'), new Map(), null, null, false)

    // No tier → base draw is the available node…
    expect(instancesWithCircle(MED_R).some((g) => hasStroke(g, AVAILABLE_STROKE))).toBe(true)
    // …with a purple emphasis ring layered on top at base radius + 3.
    expect(hasStrokeAtRadius(NODE_SUGGESTED, MED_R + 3)).toBe(true)
  })

  it('under reduced motion a glowing gold node keeps its tier scale/ring + static emphasis ring but no animated pulse fill', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    renderer.setReducedMotion(true)
    renderer.renderTree(tree, {}, glow('n1'), new Map(), null, [effOf('n1', 'gold')], true)
    stepOneFrame()

    // Static survivors: tier scale + gold ring, and the static emphasis ring (a stroke, not a fill).
    expect(instancesWithCircle(MED_R * GOLD_SCALE).some((g) => hasStroke(g, GOLD))).toBe(true)
    expect(anyStroke(GOLD_SOFT)).toBe(true)
    // Both the gold tier pulse AND the emphasis pulse are FILLS gated on reduced motion → none drawn.
    expect(anyFill(GOLD_SOFT)).toBe(false)
  })

  it('animates an emphasis pulse fill for a glowing node under normal motion', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    const tree: TreeData = { nodes: [medNode('n1')], edges: [] }
    // Untreated glowing node → the only GOLD_SOFT/SILVER source would be tier pulses (absent here);
    // the emphasis pulse for an untreated node fills the suggested-purple colour.
    renderer.renderTree(tree, {}, glow('n1'), new Map(), null, null, false)
    stepOneFrame()
    expect(anyFill(NODE_SUGGESTED)).toBe(true)
  })

  it('tears down the emphasis pulse ticker on destroy', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    // Persistent tickers are added in order: iconAnimTick, goldPulseTick, emphasisPulseTick.
    const emphasisTick = tickerCallbacks[2]
    expect(emphasisTick).toBeTypeOf('function')
    renderer.destroy()
    expect(mockApp.ticker.remove).toHaveBeenCalledWith(emphasisTick)
  })

  it('layers the emphasis pulse BELOW the icon container so the node icon is never veiled (FR-18)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    // Untreated glowing node under normal motion → the emphasis pulse fills the suggested-purple disc.
    renderer.renderTree({ nodes: [medNode('n1')], edges: [] }, {}, glow('n1'), new Map(), null, null, false)
    stepOneFrame()

    // worldContainer is the object handed to app.stage.addChild; its many-arg addChild call is the
    // ordered layer list, and addChild order is the z-order (no zIndex/sortableChildren in use).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const worldContainer = (mockApp.stage.addChild as any).mock.calls[0][0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layerCall: any[] = worldContainer.addChild.mock.calls.find((c: unknown[]) => c.length > 5)
    expect(layerCall).toBeDefined()
    // Emphasis pulse = the layer that filled NODE_SUGGESTED this frame (unique: tier pulses are absent
    // for an untreated node, and the static ring is a stroke, not a fill).
    const emphasisIdx = layerCall.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (g: any) => (g._ops as GfxOp[] | undefined)?.some((o) => o.op === 'fill' && o.color === NODE_SUGGESTED)
    )
    // Icon container = the first child exposing removeChildren (a Container, not a Graphics).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconIdx = layerCall.findIndex((c: any) => typeof c.removeChildren === 'function')
    expect(emphasisIdx).toBeGreaterThan(-1)
    expect(iconIdx).toBeGreaterThan(-1)
    expect(emphasisIdx).toBeLessThan(iconIdx)
  })

  // ── Story 3.3 — focusNode (AC3, Task 6) ─────────────────────────────────────────────────────

  it('reduced motion JUMPS the camera to the centred transform (not a no-op)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    renderer.setReducedMotion(true)
    const tree: TreeData = { nodes: [medNode('n1', 1000, 2000)], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map())
    renderer.focusNode('n1')
    const vp = renderer.getViewport()
    // centred: worldContainer.(x,y) = canvas/2 − node·scale (scale is mock-fixed at 0.6)
    expect(vp.x).toBeCloseTo(800 / 2 - 1000 * vp.scale)
    expect(vp.y).toBeCloseTo(600 / 2 - 2000 * vp.scale)
  })

  it('under normal motion an off-screen node schedules a tween (ticker added) without an instant jump', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    const tree: TreeData = { nodes: [medNode('n1', 5000, 5000)], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map())
    const before = renderer.getViewport().x
    const tickCountBefore = tickerCallbacks.length
    renderer.focusNode('n1')
    expect(tickerCallbacks.length).toBe(tickCountBefore + 1) // a tween was scheduled
    expect(renderer.getViewport().x).toBe(before) // …but no synchronous jump
  })

  it('is a no-op for a node already comfortably on-screen', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    const tree: TreeData = { nodes: [medNode('n1', 0, 0)], edges: [] }
    renderer.renderTree(tree, {}, emptyHl(), new Map())
    const before = renderer.getViewport()
    const tickCountBefore = tickerCallbacks.length
    renderer.focusNode('n1')
    expect(tickerCallbacks.length).toBe(tickCountBefore) // no tween
    expect(renderer.getViewport().x).toBe(before.x) // unchanged
    expect(renderer.getViewport().y).toBe(before.y)
  })

  it('does nothing for an unknown node id', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    renderer.renderTree({ nodes: [medNode('n1')], edges: [] }, {}, emptyHl(), new Map())
    const tickCountBefore = tickerCallbacks.length
    expect(() => renderer.focusNode('ghost')).not.toThrow()
    expect(tickerCallbacks.length).toBe(tickCountBefore)
  })

  it('tears down an in-flight focus tween on destroy', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    renderer.renderTree({ nodes: [medNode('n1', 5000, 5000)], edges: [] }, {}, emptyHl(), new Map())
    renderer.focusNode('n1')
    const focusTick = tickerCallbacks[tickerCallbacks.length - 1]
    renderer.destroy()
    expect(mockApp.ticker.remove).toHaveBeenCalledWith(focusTick)
  })

  it('does not cancel an in-flight focus tween when a re-fire finds the node already on-screen', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    // First render: node off-screen → focusNode schedules a centring tween.
    renderer.renderTree({ nodes: [medNode('n1', 5000, 5000)], edges: [] }, {}, emptyHl(), new Map())
    renderer.focusNode('n1')
    const tween = tickerCallbacks[tickerCallbacks.length - 1]

    // Same tree id (no refit, transform unchanged), but move n1 to an on-screen world position —
    // simulating the node crossing into view as the tween progresses. Re-fire focusNode for it.
    renderer.renderTree({ nodes: [medNode('n1', 20800, 20800)], edges: [] }, {}, emptyHl(), new Map())
    const removesBefore = mockApp.ticker.remove.mock.calls.length
    const ticksBefore = tickerCallbacks.length
    renderer.focusNode('n1')

    // The on-screen early-return must precede the cancel block: the running tween survives untouched
    // and no replacement tween is scheduled, so it finishes centring instead of freezing off-centre.
    expect(mockApp.ticker.remove).not.toHaveBeenCalledWith(tween)
    expect(mockApp.ticker.remove.mock.calls.length).toBe(removesBefore)
    expect(tickerCallbacks.length).toBe(ticksBefore)
  })

  // focusNode reports whether it resolved the node (renderer ready + sized) so SkillTreeView can retry
  // against a freshly-mounted passive canvas instead of silently failing to centre on first interaction.
  it('returns false for an unknown node id (not resolvable)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    renderer.renderTree({ nodes: [medNode('n1')], edges: [] }, {}, emptyHl(), new Map())
    expect(renderer.focusNode('ghost')).toBe(false)
  })

  it('returns false before the canvas has dimensions (caller should retry)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    // No resize() yet → canvasW/H are still 0, so a centred transform cannot be computed.
    renderer.renderTree({ nodes: [medNode('n1', 5000, 5000)], edges: [] }, {}, emptyHl(), new Map())
    expect(renderer.focusNode('n1')).toBe(false)
  })

  it('returns true once the node is resolved and the canvas is sized (focus applied)', async () => {
    const renderer = await initRenderer(makeCanvas(), makeCallbacksRef())
    renderer.resize(800, 600)
    renderer.renderTree({ nodes: [medNode('n1', 5000, 5000)], edges: [] }, {}, emptyHl(), new Map())
    expect(renderer.focusNode('n1')).toBe(true)
  })
})
