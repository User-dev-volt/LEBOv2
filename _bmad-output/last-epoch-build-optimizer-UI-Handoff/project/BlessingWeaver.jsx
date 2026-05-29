/* ============================================================
   Blessing editor (center tab)
   Weaver tree (center tab)
   ============================================================ */

const { BLESSING_SLOTS } = window.LEBO_DATA;

function BlessingEditor({ state, dispatch }) {
  return (
    <div style={{ padding: 18, height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Blessings</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              One blessing per timeline. Each grants a passive stat to your character.
            </div>
          </div>
          <span className="chip mono">{Object.values(state.blessings).filter(Boolean).length} / 5 active</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {BLESSING_SLOTS.map((slot) => {
            const active = state.blessings[slot.id];
            return (
              <div key={slot.id} style={{
                background: "var(--bg-surface)",
                border: `1px solid ${active ? "var(--accent-gold-dim)" : "var(--hairline)"}`,
                borderRadius: 8,
                padding: 14,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name="blessing" size={14} color={active ? "var(--accent-gold)" : "var(--text-muted)"} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--accent-gold)" : "var(--text-secondary)", letterSpacing: "0.04em" }}>
                    {slot.title}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {slot.options.map((opt) => (
                    <div
                      key={opt}
                      onClick={() => dispatch({ type: "blessing:set", slotId: slot.id, value: opt })}
                      style={{
                        padding: "8px 10px",
                        background: active === opt ? "var(--accent-gold-tint)" : "var(--bg-elevated)",
                        border: `1px solid ${active === opt ? "var(--accent-gold-dim)" : "var(--hairline)"}`,
                        borderRadius: 5,
                        cursor: "pointer",
                        fontSize: 11,
                        color: active === opt ? "var(--accent-gold-soft)" : "var(--text-secondary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Weaver tree ---------- */

function WeaverTree({ state }) {
  // Hex-like cluster
  const [allocated, setAllocated] = useState(new Set(["w_root"]));
  const nodes = useMemo(() => {
    const out = [{ id: "w_root", x: 0, y: 0, size: 22 }];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      out.push({ id: `w_r1_${i}`, x: Math.cos(a) * 110, y: Math.sin(a) * 110, parent: "w_root", size: 14 });
    }
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2 + Math.PI / 6;
      out.push({ id: `w_r2_${i}`, x: Math.cos(a) * 220, y: Math.sin(a) * 220, parent: `w_r1_${i}`, size: 12 });
    }
    return out;
  }, []);

  const adj = useMemo(() => {
    const m = {};
    nodes.forEach((n) => {
      if (n.parent) { (m[n.id] = m[n.id] || []).push(n.parent); (m[n.parent] = m[n.parent] || []).push(n.id); }
    });
    return m;
  }, [nodes]);

  const toggle = (id) => {
    const next = new Set(allocated);
    if (next.has(id)) next.delete(id);
    else if ((adj[id] || []).some((p) => next.has(p))) next.add(id);
    setAllocated(next);
  };

  return (
    <div className="tree-canvas">
      <div className="tree-bg-grid" />
      <svg className="tree-svg" width="700" height="700" style={{ transform: "translate(-50%, -50%)" }}>
        <g transform="translate(350, 350)">
          {nodes.filter((n) => n.parent).map((n) => {
            const p = nodes.find((x) => x.id === n.parent);
            const both = allocated.has(p.id) && allocated.has(n.id);
            return <line key={`l_${n.id}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y}
              stroke={both ? "var(--accent-gold)" : "#2a2a35"} strokeWidth={both ? 2 : 1} opacity={both ? 1 : 0.5} />;
          })}
          {nodes.map((n) => {
            const alloc = allocated.has(n.id);
            const avail = !alloc && (adj[n.id] || []).some((p) => allocated.has(p));
            const color = alloc ? "var(--node-allocated)" : avail ? "var(--node-available)" : "var(--node-locked)";
            return (
              <g key={n.id} onClick={() => toggle(n.id)} style={{ cursor: "pointer" }}>
                <circle cx={n.x} cy={n.y} r={n.size} fill={color} stroke="rgba(255,255,255,0.1)" strokeWidth={2} />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="center-toolbar">
        <div className="toolbar-group">
          <button className="btn btn-ghost btn-sm"><Icon name="reset" size={12} /> Reset</button>
          <button className="btn btn-ghost btn-sm"><Icon name="fit" size={12} /> Fit</button>
        </div>
        <div style={{ flex: 1 }} />
        <div className="toolbar-group">
          <span className="chip chip-gold mono"><Icon name="bolt" size={11} /> {allocated.size} woven</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { BlessingEditor, WeaverTree });
