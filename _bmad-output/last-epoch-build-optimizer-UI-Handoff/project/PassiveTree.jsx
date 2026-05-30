/* ============================================================
   Passive Tree canvas
   ============================================================ */

const { PASSIVE_NODES } = window.LEBO_DATA;

function PassiveTree({ state, dispatch }) {
  const [hover, setHover] = useState(null);     // node id
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const canvasRef = useRef(null);

  const allocated = state.allocated;
  const suggested = state.suggestedNodes;
  const tiers = state.suggestedTiers || {};

  const adjacency = useMemo(() => {
    const map = {};
    PASSIVE_NODES.forEach((n) => {
      if (n.parent) {
        (map[n.parent] = map[n.parent] || []).push(n.id);
        (map[n.id] = map[n.id] || []).push(n.parent);
      }
    });
    return map;
  }, []);

  const isAvailable = (id) => {
    if (allocated.includes(id)) return false;
    return (adjacency[id] || []).some((p) => allocated.includes(p));
  };

  const nodeColor = (id) => {
    if (allocated.includes(id)) return "var(--node-allocated)";
    if (suggested.includes(id)) return "var(--node-suggested)";
    if (isAvailable(id)) return "var(--node-available)";
    return "var(--node-locked)";
  };

  const nodeStrokeColor = (id) => {
    if (allocated.includes(id)) return "var(--accent-gold-soft)";
    if (suggested.includes(id)) return "#a094f0";
    if (isAvailable(id)) return "#6a99c0";
    return "#1a1a25";
  };

  const onMouseDown = (e) => {
    if (e.target.tagName === "circle") return;
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e) => {
    if (dragStart) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const onMouseUp = () => setDragStart(null);
  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.4, Math.min(2.5, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };

  const onNodeClick = (n, e) => {
    if (allocated.includes(n.id)) {
      // Shift+click on allocated = remove all (also handled by right-click)
      if (e && e.shiftKey) { removeWithChildren(n); return; }
      dispatch({ type: "deallocate", id: n.id });
    } else if (isAvailable(n.id)) {
      dispatch({ type: "allocate", id: n.id });
    } else if (e && e.shiftKey) {
      // Shift+click on a reachable-but-locked node: allocate the path toward it
      allocatePath(n);
    }
  };

  // Allocate every unallocated node on the chain from an allocated node to target
  const allocatePath = (target) => {
    // BFS from target back to nearest allocated node through parent links
    const path = [];
    let cur = target;
    const byId = Object.fromEntries(PASSIVE_NODES.map((n) => [n.id, n]));
    while (cur && !allocated.includes(cur.id)) {
      path.unshift(cur.id);
      cur = cur.parent ? byId[cur.parent] : null;
    }
    if (!cur) return; // no allocated root on this chain
    path.forEach((id) => dispatch({ type: "allocate", id }));
  };

  // Right-click / shift+click remove: deallocate node + any orphaned allocated children
  const removeWithChildren = (n) => {
    const children = (adjacency[n.id] || []).filter((cid) => {
      const child = PASSIVE_NODES.find((x) => x.id === cid);
      return child && child.parent === n.id && allocated.includes(cid);
    });
    if (children.length) {
      const names = children.map((cid) => PASSIVE_NODES.find((x) => x.id === cid)?.name).join(", ");
      if (!window.confirm(`Removing "${n.name}" will also deallocate: ${names}. Continue?`)) return;
      children.forEach((cid) => dispatch({ type: "deallocate", id: cid }));
    }
    dispatch({ type: "deallocate", id: n.id });
  };

  const onNodeContext = (n, e) => {
    e.preventDefault();
    if (allocated.includes(n.id)) removeWithChildren(n);
  };

  const onNodeEnter = (n, e) => {
    setHover(n.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 });
  };
  const onNodeMove = (e) => {
    if (hover) {
      const rect = canvasRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 });
    }
  };

  const hoveredNode = hover ? PASSIVE_NODES.find((n) => n.id === hover) : null;

  // edges
  const edges = useMemo(() => {
    return PASSIVE_NODES.filter((n) => n.parent).map((n) => {
      const p = PASSIVE_NODES.find((x) => x.id === n.parent);
      return { from: p, to: n, id: `e_${n.id}` };
    });
  }, []);

  return (
    <div
      ref={canvasRef}
      className="tree-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={(e) => { onMouseMove(e); onNodeMove(e); }}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="tree-bg-grid" />

      <svg
        className="tree-svg"
        width="900"
        height="900"
        style={{ transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})` }}
      >
        <g transform="translate(450, 450)">
          {/* edges */}
          {edges.map((e) => {
            const both = allocated.includes(e.from.id) && allocated.includes(e.to.id);
            const oneAlloc = allocated.includes(e.from.id) || allocated.includes(e.to.id);
            const sugg = suggested.includes(e.from.id) || suggested.includes(e.to.id);
            return (
              <line
                key={e.id}
                x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
                stroke={both ? "var(--accent-gold)" : (sugg ? "var(--node-suggested)" : (oneAlloc ? "#5d7e9c" : "#1a1a25"))}
                strokeWidth={both ? 2 : 1}
                opacity={both ? 0.9 : 0.55}
              />
            );
          })}

          {/* nodes */}
          {PASSIVE_NODES.map((n) => {
            const r = n.type === "keystone" ? 16 : n.type === "notable" ? 11 : 7;
            const isAlloc = allocated.includes(n.id);
            const isSugg = suggested.includes(n.id);
            const tier = tiers[n.id];
            const tierScale = tier === "gold" ? 1.4 : tier === "silver" ? 1.2 : 1.05;
            const tierColor = tier === "gold" ? "var(--accent-gold)" : tier === "silver" ? "#9FB0C0" : "var(--node-available)";
            return (
              <g key={n.id}>
                {isAlloc && (
                  <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke="var(--accent-gold)" strokeOpacity={0.25} strokeWidth={2} />
                )}
                {isSugg && (
                  <>
                    <circle cx={n.x} cy={n.y} r={r * tierScale + 4} fill="none" stroke={tierColor} strokeOpacity={tier === "dim" ? 0.5 : 0.85} strokeWidth={tier === "gold" ? 2.5 : 2}>
                      {tier === "gold" && <animate attributeName="stroke-opacity" values="0.85;0.3;0.85" dur="1.8s" repeatCount="indefinite" />}
                      {tier === "gold" && <animate attributeName="r" values={`${r*tierScale+4};${r*tierScale+8};${r*tierScale+4}`} dur="1.8s" repeatCount="indefinite" />}
                    </circle>
                    {tier !== "dim" && (
                      <circle cx={n.x} cy={n.y} r={r * tierScale + 9} fill="none" stroke={tierColor} strokeOpacity={tier === "gold" ? 0.4 : 0.25} strokeWidth={1} strokeDasharray="3,3">
                        <animateTransform attributeName="transform" type="rotate" from={`0 ${n.x} ${n.y}`} to={`360 ${n.x} ${n.y}`} dur="12s" repeatCount="indefinite" />
                      </circle>
                    )}
                  </>
                )}
                <circle
                  className="tree-node"
                  cx={n.x} cy={n.y} r={r}
                  fill={nodeColor(n.id)}
                  stroke={nodeStrokeColor(n.id)}
                  strokeWidth={n.type === "keystone" ? 2.5 : 1.5}
                  onMouseEnter={(e) => onNodeEnter(n, e)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => onNodeClick(n, e)}
                  onContextMenu={(e) => onNodeContext(n, e)}
                />
                {n.type === "keystone" && (
                  <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#1A1308" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" style={{ pointerEvents: "none" }}>K</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Toolbar */}
      <div className="center-toolbar">
        <div className="toolbar-group" style={{ paddingLeft: 6 }}>
          <Icon name="search" size={13} color="var(--text-muted)" />
          <input className="input" style={{ height: 22, border: "none", background: "transparent", width: 160 }} placeholder="Search nodes…" />
        </div>
        <div className="toolbar-group">
          <button className="btn btn-ghost btn-sm"><Icon name="reset" size={12} /> Reset</button>
          <button className="btn btn-ghost btn-sm"><Icon name="fit" size={12} /> Fit</button>
        </div>
        <div className="toolbar-group">
          <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 8px" }}>Level</span>
          <input className="input mono" style={{ width: 44, height: 22 }} defaultValue="92" />
        </div>
        <div style={{ flex: 1 }} />
        <div className="toolbar-group">
          <span className="chip chip-gold mono">
            <Icon name="bolt" size={11} /> {allocated.length} allocated
          </span>
          {suggested.length > 0 && (
            <span className="chip mono" style={{ background: "rgba(123, 104, 238, 0.14)", color: "var(--node-suggested)" }}>
              <Icon name="zap" size={11} /> {suggested.length} suggested
            </span>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div className="node-tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>
          <div className="node-tooltip-name">{hoveredNode.name}</div>
          <div className="node-tooltip-type">{hoveredNode.type}</div>
          <div className="node-tooltip-stats">
            <span className="node-tooltip-stat">{hoveredNode.desc}</span>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="zoom-controls">
        <div className="zoom-btn" onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}>+</div>
        <div className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>−</div>
        <div className="zoom-btn" onClick={() => { setZoom(1); setPan({x:0,y:0}); }}><Icon name="fit" size={12} /></div>
      </div>

      {/* Controls hint */}
      <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", gap: 14, fontSize: 10, color: "var(--text-muted)", background: "rgba(20,20,23,0.7)", backdropFilter: "blur(6px)", padding: "6px 10px", borderRadius: 5, border: "1px solid var(--hairline)" }}>
        <span><span className="mono" style={{ color: "var(--text-secondary)" }}>click</span> allocate</span>
        <span><span className="mono" style={{ color: "var(--text-secondary)" }}>shift+click</span> fill path</span>
        <span><span className="mono" style={{ color: "var(--text-secondary)" }}>right-click</span> remove</span>
      </div>
    </div>
  );
}

window.PassiveTree = PassiveTree;
