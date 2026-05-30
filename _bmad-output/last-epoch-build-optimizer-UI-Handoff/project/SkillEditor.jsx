/* ============================================================
   Skill editor — slot list + specialization view
   ============================================================ */

const { SKILLS_BY_CLASS } = window.LEBO_DATA;

function SkillEditor({ state, dispatch }) {
  const [activeSlot, setActiveSlot] = useState(0);
  const [picker, setPicker] = useState(null);

  const slots = state.skills; // array of 5

  const classSkills = SKILLS_BY_CLASS[state.classId] || [];
  const SKILL_ICONS = {
    harvest: "skill-harvest",
    rip_blood: "skill-blood",
    marrow: "skill-bone",
    wraith: "skill-wraith",
    transplant: "skill-teleport",
    soul_feast: "skill-blood",
    skel_mage: "skill-wraith",
    bone_curse: "skill-bone",
    rev_volley: "skill-volley",
  };

  return (
    <div className="skill-editor">
      <div className="skill-slot-list">
        <div className="label" style={{ padding: "4px 6px 8px" }}>Skill Slots</div>
        {slots.map((s, i) => (
          <div
            key={i}
            className={`skill-slot-card ${activeSlot === i ? "active" : ""} ${!s ? "empty" : ""}`}
            onClick={() => {
              setActiveSlot(i);
              if (!s) setPicker(i);
            }}
          >
            <div className="skill-icon">
              {s ? (
                <Icon name={SKILL_ICONS[s.id] || "skill"} size={22} color="var(--accent-gold)" />
              ) : (
                <Icon name="plus" size={16} color="var(--text-muted)" />
              )}
            </div>
            <div className="skill-slot-info">
              <div className="skill-slot-slotnum">Slot {i + 1}</div>
              <div className="skill-slot-name">{s ? s.name : "Empty"}</div>
              {s && <div className="skill-slot-points">{s.spec} / 20 points</div>}
            </div>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: 8, borderTop: "1px solid var(--hairline)", marginTop: 6 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Click an empty slot to choose a skill from your class. Click a filled slot to specialize.
          </div>
        </div>
      </div>

      <div className="skill-canvas">
        {slots[activeSlot] ? (
          <SkillSpecCanvas slot={slots[activeSlot]} onClear={() => dispatch({ type: "skill:clear", index: activeSlot })} />
        ) : (
          <div className="skill-canvas-empty">
            <Icon name="skill" size={48} color="var(--text-faint)" />
            <div style={{ fontSize: 13 }}>No skill in slot {activeSlot + 1}</div>
            <button className="btn btn-gold" onClick={() => setPicker(activeSlot)}>
              <Icon name="plus" size={12} /> Choose Skill
            </button>
          </div>
        )}
      </div>

      {picker !== null && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="modal" style={{ width: 520 }}>
            <div className="modal-head">
              <div className="modal-title">Choose Skill for Slot {picker + 1}</div>
              <div className="modal-close" onClick={() => setPicker(null)}><Icon name="x" size={14} /></div>
            </div>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {classSkills.map((sk) => {
                const used = state.skills.some((s) => s && s.id === sk.id);
                return (
                  <div
                    key={sk.id}
                    className={`item-card ${used ? "btn-disabled" : ""}`}
                    style={{ opacity: used ? 0.4 : 1, gridTemplateColumns: "40px 1fr" }}
                    onClick={() => {
                      if (used) return;
                      dispatch({ type: "skill:set", index: picker, skill: { ...sk, spec: 0 } });
                      setPicker(null);
                    }}
                  >
                    <div className="item-card-icon" style={{ width: 40, height: 40 }}>
                      <Icon name={SKILL_ICONS[sk.id] || "skill"} size={22} color="var(--accent-gold)" />
                    </div>
                    <div className="item-card-info">
                      <div className="item-card-name">{sk.name}</div>
                      <div className="item-card-base">{sk.tag}</div>
                      {used && <div className="item-card-affix" style={{ color: "var(--data-negative)" }}>Already equipped</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Skill specialization canvas (decorative tree) ---------- */

function SkillSpecCanvas({ slot, onClear }) {
  const [allocated, setAllocated] = useState(new Set(["sp_root", "sp_a1", "sp_a2"]));

  // Generate a small skill spec tree layout
  const nodes = useMemo(() => {
    const out = [{ id: "sp_root", x: 0, y: -160, type: "root", name: slot.name, points: 1 }];
    for (let i = 0; i < 3; i++) {
      out.push({
        id: `sp_branch_${i}`,
        x: (i - 1) * 220,
        y: -40,
        type: "branch",
        name: ["Damage", "Survival", "Utility"][i],
      });
      for (let j = 0; j < 3; j++) {
        const angle = (j - 1) * 35;
        out.push({
          id: `sp_${i}_${j}`,
          x: (i - 1) * 220 + angle * 1.5,
          y: 80 + j * 80,
          type: "node",
          parent: `sp_branch_${i}`,
          name: ["Bigger", "Faster", "Stronger"][j] + " " + ["Strikes", "Recovery", "Echo"][i],
          desc: "+10% per point · max 5",
          maxPoints: 5,
        });
      }
    }
    return out;
  }, [slot]);

  const adjacency = useMemo(() => {
    const m = {};
    nodes.forEach((n) => {
      if (n.parent) {
        (m[n.parent] = m[n.parent] || []).push(n.id);
        (m[n.id] = m[n.id] || []).push(n.parent);
      }
      if (n.type === "branch") {
        (m["sp_root"] = m["sp_root"] || []).push(n.id);
        (m[n.id] = m[n.id] || []).push("sp_root");
      }
    });
    return m;
  }, [nodes]);

  const toggle = (id) => {
    const next = new Set(allocated);
    if (next.has(id)) next.delete(id);
    else if ((adjacency[id] || []).some((p) => next.has(p))) next.add(id);
    setAllocated(next);
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div style={{ position: "absolute", top: 14, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-gold)" }}>{slot.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{slot.tag} · {allocated.size - 1} / 20 specialization points</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-sm"><Icon name="reset" size={11} /> Reset</button>
          <button className="btn btn-sm" onClick={onClear}><Icon name="x" size={11} /> Remove from slot</button>
        </div>
      </div>

      <svg width="100%" height="100%" viewBox="-400 -220 800 540" style={{ display: "block" }}>
        {nodes.filter((n) => n.parent || n.type === "branch").map((n) => {
          const parent = n.parent ? nodes.find((x) => x.id === n.parent) : nodes.find((x) => x.id === "sp_root");
          const both = allocated.has(parent.id) && allocated.has(n.id);
          return (
            <line key={`l_${n.id}`} x1={parent.x} y1={parent.y} x2={n.x} y2={n.y}
              stroke={both ? "var(--accent-gold)" : "#2a2a35"} strokeWidth={both ? 2 : 1} />
          );
        })}
        {nodes.map((n) => {
          const r = n.type === "root" ? 24 : n.type === "branch" ? 16 : 11;
          const alloc = allocated.has(n.id);
          const avail = !alloc && (adjacency[n.id] || []).some((p) => allocated.has(p));
          const color = alloc ? "var(--node-allocated)" : avail ? "var(--node-available)" : "var(--node-locked)";
          return (
            <g key={n.id} onClick={() => toggle(n.id)} style={{ cursor: "pointer" }}>
              <circle cx={n.x} cy={n.y} r={r} fill={color} stroke={alloc ? "var(--accent-gold-soft)" : "rgba(255,255,255,0.08)"} strokeWidth={2} />
              {n.type === "root" && (
                <text x={n.x} y={n.y + 4} fill="#1A1308" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)">LV</text>
              )}
              <text x={n.x} y={n.y + r + 14} fill="var(--text-secondary)" textAnchor="middle" fontSize="10" fontFamily="var(--font-ui)">{n.name}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

window.SkillEditor = SkillEditor;
