/* ============================================================
   Left Panel
   - Import build
   - Class / Mastery
   - Save build
   - Saved builds list
   - Context list (acts as TAB NAVIGATOR for center canvas)
   ============================================================ */

const { CLASSES, SAVED_BUILDS } = window.LEBO_DATA;

function LeftPanel({ state, dispatch, collapsed, onToggleCollapsed }) {
  if (collapsed) {
    return (
      <div className="panel left collapsed">
        <div className="panel-collapse" onClick={onToggleCollapsed}><Icon name="chevron-right" size={11} /></div>
        <div className="collapsed-strip">
          <div className="strip-icon" title="Import"><Icon name="import" size={16} /></div>
          <div className="strip-icon" title="Save"><Icon name="save" size={16} /></div>
          <div style={{ height: 8 }} />
          {["tree","gear","skill","idol","blessing"].map((k, i) => (
            <div
              key={k}
              className={`strip-icon ${state.tab === ["tree","gear","skill","idol","blessing"][i] ? "active" : ""}`}
              onClick={() => dispatch({ type: "tab", value: ["tree","gear","skill","idol","blessing"][i] })}
            >
              <Icon name={k} size={16} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cls = CLASSES.find((c) => c.id === state.classId);
  const masteryOpts = cls.masteries.map((m) => ({ value: m, label: m }));
  const classOpts = CLASSES.map((c) => ({ value: c.id, label: c.name }));

  const gearCount = Object.values(state.gear).filter(Boolean).length;
  const skillCount = state.skills.filter(Boolean).length;
  const idolCount = state.idols.length;
  const blessingCount = Object.values(state.blessings).filter(Boolean).length;

  const contextRows = [
    { id: "tree",     icon: "tree",     name: "Passive Tree",   count: `${state.allocated.length} pts` },
    { id: "weave",    icon: "weave",    name: "Weaver Tree",    count: `${state.weaver} pts` },
    { id: "skill",    icon: "skill",    name: "Active Skills",  count: `${skillCount}/5`, full: skillCount === 5 },
    { id: "gear",     icon: "gear",     name: "Gear",           count: `${gearCount}/11`, full: gearCount === 11 },
    { id: "idol",     icon: "idol",     name: "Idols",          count: `${idolCount} placed` },
    { id: "blessing", icon: "blessing", name: "Blessings",      count: `${blessingCount}/5`, full: blessingCount === 5 },
  ];

  return (
    <div className="panel left">
      <div className="panel-collapse" onClick={onToggleCollapsed}><Icon name="chevron-left" size={11} /></div>

      <div className="panel-scroll">
        {/* Active build identity */}
        <div className="lp-section">
          <span className="label">Active Build</span>
          <div className="class-card" style={{ marginTop: 6 }}>
            <div className="class-card-mark"><Icon name="glyph-acolyte" size={18} color="var(--accent-gold)" /></div>
            <div>
              <div className="class-card-name">{state.buildName}</div>
              <div className="class-card-mastery">{cls.name} · {state.mastery}</div>
            </div>
          </div>
        </div>

        {/* Class & Mastery */}
        <div className="lp-section">
          <span className="label">Class</span>
          <div style={{ marginTop: 6 }}>
            <Select value={state.classId} onChange={(v) => dispatch({ type: "class", value: v })} options={classOpts} />
          </div>
        </div>
        <div className="lp-section">
          <span className="label">Mastery</span>
          <div style={{ marginTop: 6 }}>
            <Select value={state.mastery} onChange={(v) => dispatch({ type: "mastery", value: v })} options={masteryOpts} />
          </div>
        </div>

        <div className="divider" />

        {/* Context navigator */}
        <span className="label">Build Sections</span>
        <div className="context-list" style={{ marginTop: 6 }}>
          {contextRows.map((row) => (
            <div
              key={row.id}
              className={`context-row ${state.tab === row.id ? "active" : ""}`}
              onClick={() => dispatch({ type: "tab", value: row.id })}
            >
              <div className="context-icon"><Icon name={row.icon} size={15} /></div>
              <div className="context-name">{row.name}</div>
              <div className={`context-count ${row.full ? "full" : ""}`}>{row.count}</div>
            </div>
          ))}
        </div>

        <div className="divider" />

        {/* Save + Import */}
        <button
          className={`btn btn-lg btn-full ${state.unsaved ? "btn-gold" : ""}`}
          onClick={() => dispatch({ type: "save" })}
          style={{ marginBottom: 8 }}
        >
          <Icon name="save" size={14} />
          {state.unsaved ? "Save Build" : "Saved"}
        </button>

        <details className="lp-section" open={false}>
          <summary style={{ cursor: "pointer", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", padding: "6px 0" }}>
            Import Build Code
          </summary>
          <textarea className="input" rows={3} placeholder="Paste build code…" style={{ marginTop: 6 }} />
          <button className="btn btn-sm btn-full" style={{ marginTop: 6 }}>
            <Icon name="import" size={12} /> Import
          </button>
        </details>

        <div className="divider" />

        {/* Saved builds */}
        <span className="label">Saved Builds</span>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          {SAVED_BUILDS.map((b) => (
            <div key={b.id} className={`saved-build ${b.active ? "active" : ""}`}>
              <Icon name="glyph-skull" size={14} color={b.active ? "var(--accent-gold)" : "var(--text-muted)"} />
              <div className="saved-build-name">{b.name}</div>
              <div className="saved-build-meta">{b.mastery}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.LeftPanel = LeftPanel;
