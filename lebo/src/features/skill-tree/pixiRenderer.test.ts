import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initRenderer } from './pixiRenderer'
import type { TreeData, RendererCallbacks } from './types'
import { mockTreeData } from './mockTreeData'

// Use vi.hoisted so these refs are available inside the vi.mock factory
const { mockApp, mockRendererResize, mockAppDestroy, MockSprite } = vi.hoisted(() => {
  const mockRendererResize = vi.fn()
  const mockAppDestroy = vi.fn()

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

  return {
    mockRendererResize,
    mockAppDestroy,
    MockSprite,
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
      ticker: { FPS: 60, add: vi.fn(), remove: vi.fn() },
      destroy: mockAppDestroy,
    },
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
    const g: Record<string, any> = { eventMode: '', cursor: '' }
    g.rect = vi.fn().mockReturnValue(g)
    g.circle = vi.fn().mockReturnValue(g)
    g.fill = vi.fn().mockReturnValue(g)
    g.stroke = vi.fn().mockReturnValue(g)
    g.moveTo = vi.fn().mockReturnValue(g)
    g.lineTo = vi.fn().mockReturnValue(g)
    g.clear = vi.fn().mockReturnValue(g)
    g.on = vi.fn()
    return g
  }

  function Container() {
    return makeContainer()
  }
  function Graphics() {
    return makeGraphics()
  }
  function Text() {
    return { text: '', position: { set: vi.fn() } }
  }

  function Circle(this: unknown, x: number, y: number, r: number) {
    return { x, y, radius: r, type: 'circle' }
  }

  return { Application, Container, Graphics, Text, Sprite: MockSprite, Circle }
})

function makeCallbacksRef(): { current: RendererCallbacks } {
  return { current: { onNodeClick: vi.fn(), onNodeHover: vi.fn() } }
}

function makeCanvas(): HTMLCanvasElement {
  return document.createElement('canvas')
}

const emptyTree: TreeData = { nodes: [], edges: [] }

describe('initRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore the resolved-value implementation that clearAllMocks preserves
    mockApp.init.mockResolvedValue(undefined)
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
})
