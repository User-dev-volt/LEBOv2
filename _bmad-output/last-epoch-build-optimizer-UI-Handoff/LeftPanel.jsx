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
    { id: "tree",     icon: "tree",     name: "Passive Tree",   count: `${state.allocated.length} pts`, done: state.allocated.length >= 1 },
    { id: "weave",    icon: "weave",    name: "Weaver Tree",    count: `${state.weaver} pts`, done: state.weaver > 0 },
    { id: "skill",    icon: "skill",    name: "Active Skills",  count: `${skillCount}/5`, full: skillCount === 5, done: skillCount >= 2 },
    { id: "gear",     icon: "gear",     name: "Gear",           count: `${gearCount}/11`, full: gearCount === 11, done: gearCount === 11 },
    { id: "idol",     icon: "idol",     name: "Idols",          count: `${idolCount} placed`, done: idolCount >= 1 },
    { id: "blessing", icon: "blessing", name: "Blessings",      count: `${blessingCount}/5`, full: blessingCount === 5, done: blessingCount >= 1 },
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
              {row.done && <div className="context-check"><Icon name="check" size={12} color="var(--accent-gold)" stroke={2.4} /></div>}
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
            Import Character
          </summary>
          <ImportCharacter dispatch={dispatch} />
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

/* ============================================================
   Import Character — lastepochtools.com–style lookup
   Enter account + (optional) character, choose Online API or
   Offline save folder, fetch characters, pick one to import.
   ============================================================ */

const IMPORT_DB = {
  // account (lowercased) -> characters
  "alec#1842": [
    { name: "GravesongLich",   cls: "Acolyte",   mastery: "Lich",        level: 92, glyph: "glyph-skull" },
    { name: "FrostWeaver",     cls: "Mage",      mastery: "Sorcerer",    level: 78, glyph: "glyph-acolyte" },
    { name: "PackLeader",      cls: "Primalist", mastery: "Beastmaster", level: 64, glyph: "glyph-acolyte" },
  ],
  "demo#0001": [
    { name: "VoidPullKnight",  cls: "Sentinel",  mastery: "Void Knight", level: 100, glyph: "glyph-acolyte" },
    { name: "ShadowDaggers",   cls: "Rogue",     mastery: "Bladedancer", level: 88,  glyph: "glyph-acolyte" },
  ],
};

function ImportCharacter({ dispatch }) {
  const [source, setSource] = useState("online"); // online | offline
  const [account, setAccount] = useState("");
  const [character, setCharacter] = useState("");
  const [status, setStatus] = useState("idle");   // idle | loading | done | empty
  const [results, setResults] = useState([]);
  const [imported, setImported] = useState(null);

  const fetchChars = () => {
    if (!account.trim()) return;
    setStatus("loading");
    setResults([]);
    setImported(null);
    setTimeout(() => {
      const key = account.trim().toLowerCase();
      let chars = IMPORT_DB[key] || [
        // fallback: synthesize a couple from the account name so the demo always returns something
        { name: account.trim().replace(/[^a-z0-9]/gi, "") || "Hero", cls: "Acolyte", mastery: "Lich", level: 90, glyph: "glyph-skull" },
        { name: "AltCharacter", cls: "Sentinel", mastery: "Paladin", level: 55, glyph: "glyph-acolyte" },
      ];
      if (character.trim()) {
        chars = chars.filter((c) => c.name.toLowerCase().includes(character.trim().toLowerCase()));
      }
      setResults(chars);
      setStatus(chars.length ? "done" : "empty");
    }, 850);
  };

  const importChar = (c) => {
    setImported(c.name);
    dispatch({ type: "import:character", character: c });
  };

  return (
    <div className="import-card">
      <div className="source-seg">
        <div className={`source-seg-opt ${source === "online" ? "on" : ""}`} onClick={() => setSource("online")}>
          <Icon name="globe" size={12} /> Online
        </div>
        <div className={`source-seg-opt ${source === "offline" ? "on" : ""}`} onClick={() => setSource("offline")}>
          <Icon name="folder" size={12} /> Offline
        </div>
      </div>

      <div className="import-field">
        <span className="import-field-label">Account Name</span>
        <input
          className="input"
          placeholder={source === "online" ? "name#0000" : "save file account"}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchChars()}
        />
      </div>
      <div className="import-field">
        <span className="import-field-label">Character Name <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
        <input
          className="input"
          placeholder="filter by character…"
          value={character}
          onChange={(e) => setCharacter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchChars()}
        />
      </div>

      <button className="btn btn-sm btn-gold-outline btn-full" onClick={fetchChars} disabled={!account.trim()}>
        <Icon name="search" size={12} />
        {source === "online" ? "Look up online" : "Scan save folder"}
      </button>

      {source === "offline" && status === "idle" && (
        <div className="import-status">
          <Icon name="folder" size={11} /> Reads characters from your local save directory.
        </div>
      )}

      {status === "loading" && (
        <div className="import-status">
          <span className="import-spinner" />
          {source === "online" ? "Querying online database…" : "Reading save files…"}
        </div>
      )}

      {status === "empty" && (
        <div className="import-status" style={{ color: "var(--data-negative)" }}>
          <Icon name="x" size={11} /> No characters found for that account.
        </div>
      )}

      {status === "done" && (
        <div className="char-results">
          <div className="char-results-head">
            <span>{results.length} character{results.length !== 1 ? "s" : ""}</span>
            {source === "online" && (
              <span className="import-online-dot"><span className="dot" style={{ width: 5, height: 5 }} /> live</span>
            )}
          </div>
          {results.map((c) => (
            <div key={c.name} className="char-result" onClick={() => importChar(c)}>
              <div className="char-result-icon">
                <Icon name={c.glyph} size={15} color="var(--accent-gold)" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="char-result-name">{c.name}</div>
                <div className="char-result-meta">{c.cls} · {c.mastery}</div>
              </div>
              <div className="char-result-lvl">L{c.level}</div>
            </div>
          ))}
          {imported && (
            <div className="import-status" style={{ color: "var(--data-positive)" }}>
              <Icon name="check" size={11} /> Imported {imported}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.LeftPanel = LeftPanel;
