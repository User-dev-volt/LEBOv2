/* ============================================================
   Right Panel — Score Gauge, Archetype, Fine-Tune, Optimize,
   Suggestions, Stat Sheet
   ============================================================ */

function RightPanel({ state, dispatch, collapsed, onToggleCollapsed }) {
  if (collapsed) {
    return (
      <div className="panel right collapsed">
        <div className="panel-collapse" onClick={onToggleCollapsed}><Icon name="chevron-left" size={11} /></div>
        <div className="collapsed-strip">
          <div className="strip-icon" title="Score" style={{ color: "var(--accent-gold)" }}>
            <span className="mono" style={{ fontSize: 11 }}>{Math.round(state.score)}</span>
          </div>
          <div className="strip-icon" title="Suggestions"><Icon name="zap" size={16} /></div>
          <div className="strip-icon" title="Stats"><Icon name="filter" size={16} /></div>
        </div>
      </div>
    );
  }

  const arch = state.archetype; // 0..100, 0 = jugg, 100 = glass cannon
  const archZones = [
    { max: 20, name: "Juggernaut", sub: "Survivability first", color: "#2A4D7A" },
    { max: 40, name: "Bulwark",    sub: "Defense over offense", color: "#4A7A9E" },
    { max: 60, name: "Balanced",   sub: "Equal weight", color: "var(--accent-gold)" },
    { max: 80, name: "Aggressive", sub: "Offense over defense", color: "#C77840" },
    { max: 101,name: "Glass Cannon", sub: "Damage at all costs", color: "#C73232" },
  ];
  const zone = archZones.find((z) => arch < z.max);

  return (
    <div className="panel right">
      <div className="panel-collapse" onClick={onToggleCollapsed}><Icon name="chevron-right" size={11} /></div>

      <div className="panel-scroll">
        {/* Score gauge */}
        <ScoreGauge value={state.score} delta={state.scoreDelta} />

        <div className="score-trio">
          <div className="score-pill damage">
            <div className="score-pill-label">DMG</div>
            <div className="score-pill-value">{Math.round(state.subScores.damage)}</div>
          </div>
          <div className="score-pill surv">
            <div className="score-pill-label">SURV</div>
            <div className="score-pill-value">{Math.round(state.subScores.surv)}</div>
          </div>
          <div className="score-pill speed">
            <div className="score-pill-label">SPD</div>
            <div className="score-pill-value">{Math.round(state.subScores.speed)}</div>
          </div>
        </div>

        <div className="divider" />

        {/* Archetype */}
        <div className="label">Optimization Intent</div>
        <div className="archetype">
          <div className="archetype-labels">
            <span style={{ color: "#2A4D7A" }}>JUGGERNAUT</span>
            <span style={{ color: "var(--accent-gold)" }}>BALANCED</span>
            <span style={{ color: "#C73232" }}>GLASS CANNON</span>
          </div>
          <ArchetypeSlider value={arch} onChange={(v) => dispatch({ type: "archetype", value: v })} />
          <div className="archetype-zone" style={{ color: zone.color }}>{zone.name}</div>
          <div className="archetype-zone-sub">{zone.sub}</div>
        </div>

        {/* Fine Tune disclosure */}
        <details style={{ marginTop: 6 }} open>
          <summary style={{ cursor: "pointer", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 0", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="chevron-down" size={11} /> Fine Tune Weights
          </summary>
          <WeightRow cls="damage" label="Damage" value={state.weights.damage} onChange={(v) => dispatch({ type: "weight", key: "damage", value: v })} />
          <WeightRow cls="surv" label="Survival" value={state.weights.surv} onChange={(v) => dispatch({ type: "weight", key: "surv", value: v })} />
          <WeightRow cls="speed" label="Speed" value={state.weights.speed} onChange={(v) => dispatch({ type: "weight", key: "speed", value: v })} />
        </details>

        {/* Optimize button */}
        <button
          className="btn btn-gold btn-lg btn-full"
          onClick={() => dispatch({ type: "optimize" })}
          style={{
            marginTop: 12,
            ...(state.optimizing ? { animation: "pulse-gold 1.4s ease-in-out infinite" } : {}),
          }}
        >
          <Icon name="zap" size={14} />
          {state.optimizing ? "Analyzing…" : (state.suggestions.length ? "Re-Optimize" : "Optimize Build")}
        </button>

        <div className="divider" />

        {/* Suggestions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="label">AI Suggestions</span>
          {state.suggestions.length > 0 && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }} className="mono">{state.suggestions.length} ranked</span>
          )}
        </div>

        {state.suggestions.length === 0 ? (
          <div style={{ padding: 14, background: "var(--bg-elevated)", borderRadius: 5, border: "1px dashed var(--hairline-strong)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Click <strong style={{ color: "var(--accent-gold)" }}>Optimize Build</strong> to get AI-ranked passive node suggestions tailored to your archetype and gear.
            </div>
          </div>
        ) : (
          <div>
            {state.suggestions.map((s, i) => (
              <div
                key={s.id}
                className={`suggestion ${state.activeSuggestion === s.id ? "active" : ""}`}
                onClick={() => dispatch({ type: "suggestion:focus", id: s.id })}
              >
                <div className="suggestion-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>{String(i+1).padStart(2,"0")}</span>
                    {s.tier && <span style={{ width: 7, height: 7, borderRadius: 4, background: s.tier === "gold" ? "var(--accent-gold)" : s.tier === "silver" ? "#9FB0C0" : "var(--node-available)", boxShadow: s.tier === "gold" ? "0 0 6px var(--accent-gold-glow)" : "none" }} />}
                    <span className="suggestion-name">{s.name}</span>
                  </div>
                  <span className={`suggestion-delta ${s.delta > 0 ? "pos" : "neg"}`}>
                    {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)}
                  </span>
                </div>
                <div className="suggestion-text">{s.text}</div>
                {s.cost && <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{s.cost}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="divider" />

        {/* Stat sheet */}
        <div className="label" style={{ marginBottom: 6 }}>Stat Sheet</div>
        <StatSheet state={state} />
      </div>
    </div>
  );
}

/* ---------- Score gauge ---------- */
function ScoreGauge({ value, delta }) {
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const r = 64;
  const c = Math.PI * r * 1.5; // 3/4 arc
  return (
    <div className="score-gauge">
      <svg className="gauge-svg" width="180" height="160" viewBox="0 0 180 160">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B7030" />
            <stop offset="60%" stopColor="#C9A84C" />
            <stop offset="100%" stopColor="#D4B96A" />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="8"
          strokeDasharray={`${c} 9999`}
          transform="rotate(135 90 90)"
          strokeLinecap="round" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="url(#gauge-grad)" strokeWidth="8"
          strokeDasharray={`${c * pct} 9999`}
          transform="rotate(135 90 90)"
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 400ms ease" }} />
        {/* tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = -135 + (270 * i / 10);
          const rad = a * Math.PI / 180;
          const ox = 90 + Math.cos(rad) * (r + 8);
          const oy = 90 + Math.sin(rad) * (r + 8);
          const ix = 90 + Math.cos(rad) * (r + 4);
          const iy = 90 + Math.sin(rad) * (r + 4);
          const major = i % 2 === 0;
          return <line key={i} x1={ix} y1={iy} x2={ox} y2={oy} stroke={major ? "var(--text-muted)" : "var(--text-faint)"} strokeWidth={major ? 1.4 : 1} />;
        })}
      </svg>
      <div className="gauge-center">
        <div className="gauge-value mono">{Math.round(value)}</div>
        <div className="gauge-label">Build Score</div>
        {delta !== 0 && (
          <div className={`gauge-delta ${delta > 0 ? "pos" : "neg"}`}>
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Archetype slider ---------- */
function ArchetypeSlider({ value, onChange }) {
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleMove = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    onChange(p);
  };

  useEffect(() => {
    if (!drag) return;
    const mm = (e) => handleMove(e.clientX);
    const mu = () => setDrag(false);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); };
  }, [drag]);

  return (
    <div
      className="archetype-track"
      ref={trackRef}
      onMouseDown={(e) => { handleMove(e.clientX); setDrag(true); }}
    >
      <div className="archetype-thumb" style={{ left: `${value}%` }} />
    </div>
  );
}

/* ---------- Weight row ---------- */
function WeightRow({ cls, label, value, onChange }) {
  return (
    <div className={`weight-row ${cls}`}>
      <div className="weight-label">{label}</div>
      <input type="range" min="0" max="100" value={value} className="weight-slider" onChange={(e) => onChange(+e.target.value)} />
      <div className="weight-value">{value}</div>
    </div>
  );
}

/* ---------- Stat sheet ---------- */

// Source-group color coding
const SRC_COLORS = {
  Passives: "var(--accent-gold)",
  Gear: "var(--data-surv)",
  Idols: "var(--node-suggested)",
  Blessings: "var(--data-speed)",
  Skills: "var(--data-damage)",
  Conditions: "var(--text-muted)",
};

// A stat row: { name, value, cls?, gap?, sources?: [{group,label,val}], capNote? }
function buildStatData(state) {
  const lvl = 92;
  const minionActive = state.skills.some((s) => s && /wraith|skel|minion/i.test(s.id + (s.tag || "")));

  const res = (name, val, cap, sources) => ({
    name, value: cap && val < 75 ? `${val}%` : `${val}%`,
    cls: val >= 75 ? "pos" : "neg",
    gap: val < 75 ? `+${75 - val} to cap` : null,
    sources, capNote: { total: sources.reduce((a, s) => a + s.val, 0), cap: 75 },
  });

  return {
    general: [
      { name: "Class", value: state.classId.charAt(0).toUpperCase() + state.classId.slice(1) },
      { name: "Mastery", value: state.mastery },
      { name: "Level", value: String(lvl) },
      { name: "Passive Points", value: `${state.allocated.length} / 115` },
      { name: "Idol Cells Used", value: `${state.idolUsedCells} / 20` },
      { name: "Skill Slots", value: `${state.skills.filter(Boolean).length} / 5` },
      { name: "Strength", value: "18", sources: [
        { group: "Passives", label: "Acolyte's Pact", val: 4 },
        { group: "Gear", label: "Body — Strength T4", val: 9 },
        { group: "Idols", label: "Grand Idol (r2,c1)", val: 5 },
      ] },
      { name: "Dexterity", value: "12", sources: [
        { group: "Gear", label: "Gloves — Dexterity T3", val: 7 },
        { group: "Idols", label: "Grand Idol (r2,c1)", val: 5 },
      ] },
      { name: "Intelligence", value: "44", sources: [
        { group: "Passives", label: "Mind of the Reaper", val: 18 },
        { group: "Gear", label: "Helm — Intelligence T6", val: 20 },
        { group: "Blessings", label: "Ruin's Echo", val: 6 },
      ] },
      { name: "Attunement", value: "31", sources: [
        { group: "Passives", label: "Bone Hunger", val: 12 },
        { group: "Gear", label: "Amulet — Attunement T5", val: 19 },
      ] },
    ],
    offense: [
      { name: "Build Score", value: state.score.toFixed(1), cls: "crit" },
      { name: "Damage Score", value: state.subScores.damage.toFixed(1) },
      { name: "Avg Hit", value: "1,420" },
      { name: "Avg Hit (Crit-weighted)", value: "3,624" },
      { name: "Crit Chance", value: "32.4%", sources: [
        { group: "Passives", label: "Death's Embrace cluster", val: 14 },
        { group: "Gear", label: "Main — Crit Chance T4", val: 12.4 },
        { group: "Idols", label: "Grand Idol (r2,c1)", val: 6 },
      ] },
      { name: "Crit Multi", value: "210%", sources: [
        { group: "Skills", label: "base", val: 200 },
        { group: "Gear", label: "Gloves — Crit Multi T5", val: 10 },
      ] },
      { name: "Attack Speed", value: "1.42", sources: [
        { group: "Gear", label: "Gloves — Attack Speed T4", val: 14 },
      ] },
      { name: "Cast Speed", value: "1.18", sources: [
        { group: "Gear", label: "Main — Cast Speed T3", val: 11 },
        { group: "Passives", label: "Mind of the Reaper", val: 10 },
      ] },
      { name: "AoE Modifier", value: "1.0" },
      { name: "Necrotic Penetration", value: "+18%", sources: [
        { group: "Passives", label: "Frost Wreath", val: 18 },
      ] },
      { name: "Ignite Chance", value: "0%" },
      { name: "Bleed Chance", value: "0%" },
    ],
    defense: [
      { name: "Effective HP — vs Hits", value: "4,820", cls: "crit" },
      { name: "Effective HP — vs DoTs", value: "3,410" },
      { name: "Effective HP — vs 1-shots", value: "2,980" },
      { name: "Health", value: "2,140", sources: [
        { group: "Gear", label: "Main — Maximum Health T6", val: 88 },
        { group: "Gear", label: "Gloves — Health T4", val: 52 },
        { group: "Passives", label: "Festering Spite", val: 60 },
      ] },
      { name: "Stable Ward", value: "1,680", sources: [
        { group: "Passives", label: "Sanguine Bond", val: 900 },
        { group: "Gear", label: "Relic — Ward Retention T5", val: 780 },
      ] },
      { name: "Ward Retention", value: "+48%", sources: [
        { group: "Gear", label: "Relic — Ward Retention T5", val: 30 },
        { group: "Blessings", label: "Pale Crown", val: 18 },
      ] },
      { name: "Armor", value: "2,910 (44%)", sources: [
        { group: "Blessings", label: "Scaled Plate", val: 220 },
        { group: "Gear", label: "Body — Armor T6", val: 2690 },
      ] },
      { name: "Endurance", value: "60% to 540" },
      res("Fire Resistance", 75, true, [
        { group: "Passives", label: "Shadow Cascade cluster", val: 18 },
        { group: "Gear", label: "Gloves — Fire Res T4", val: 39 },
        { group: "Blessings", label: "Gift of Winter", val: 18 },
        { group: "Idols", label: "Grand Idol (r1,c3)", val: 8 },
      ]),
      res("Cold Resistance", 75, true, [
        { group: "Gear", label: "Body — Cold Res T5", val: 57 },
        { group: "Blessings", label: "Gift of Winter", val: 18 },
      ]),
      res("Lightning Resistance", 68, true, [
        { group: "Gear", label: "Boots — Lightning Res T4", val: 41 },
        { group: "Passives", label: "Aspect of Decay", val: 27 },
      ]),
      res("Void Resistance", 75, true, [
        { group: "Blessings", label: "Twisted Hearts", val: 30 },
        { group: "Gear", label: "Relic — Void Res T5", val: 45 },
      ]),
      res("Necrotic Resistance", 71, true, [
        { group: "Gear", label: "Amulet — Necrotic Res T4", val: 41 },
        { group: "Passives", label: "Death Magic", val: 30 },
      ]),
      { name: "Dodge", value: "1,240 (28%)", sources: [
        { group: "Idols", label: "Grand Idol (r2,c1)", val: 32 },
        { group: "Blessings", label: "Wing's Shadow", val: 80 },
      ] },
      { name: "Block Chance", value: "0%" },
      { name: "Glancing Blow", value: "Active", cls: "pos" },
      { name: "Crit Avoidance", value: "100%", cls: "pos" },
    ],
    minion: minionActive ? [
      { name: "Minion Count", value: "8" },
      { name: "Minion Damage Multi", value: "+186%", sources: [
        { group: "Passives", label: "Death Magic", val: 86 },
        { group: "Gear", label: "Helm — Minion Levels", val: 100 },
      ] },
      { name: "Minion HP Multi", value: "+92%" },
      { name: "Minion Speed", value: "+24%" },
    ] : null,
    other: [
      { name: "Survivability Score", value: state.subScores.surv.toFixed(1) },
      { name: "Speed Score", value: state.subScores.speed.toFixed(1) },
      { name: "Move Speed", value: "+42%", sources: [
        { group: "Idols", label: "Lesser Idol of Swiftness", val: 4 },
        { group: "Gear", label: "Boots — Move Speed T5", val: 28 },
        { group: "Passives", label: "Wraithwalk", val: 10 },
      ] },
      { name: "Cooldown Recovery", value: "+24%" },
      { name: "Mana", value: "184 (+8.4/s)" },
      { name: "Health Regen", value: "+42/s" },
      { name: "Life Leech", value: "4.2%" },
      { name: "Increased Healing", value: "+15%" },
    ],
  };
}

function StatSheet({ state }) {
  const [tab, setTab] = useState("general");
  const [tip, setTip] = useState(null); // {row, x, y}

  const data = useMemo(() => buildStatData(state), [state]);
  const minionActive = !!data.minion;

  const tabs = [
    { id: "general", label: "General" },
    { id: "offense", label: "Offense" },
    { id: "defense", label: "Defense" },
    ...(minionActive ? [{ id: "minion", label: "Minion" }] : []),
    { id: "other", label: "Other" },
  ];

  // ensure not stuck on hidden minion tab
  const activeTab = (tab === "minion" && !minionActive) ? "general" : tab;
  const rows = data[activeTab] || [];

  const onRowEnter = (row, e) => {
    if (!row.sources || !row.sources.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ row, x: r.left, y: r.top });
  };

  return (
    <div>
      <div className="stat-tabs">
        {tabs.map((t) => (
          <div key={t.id} className={`stat-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>
      <div>
        {rows.map((row) => {
          const hasSrc = row.sources && row.sources.length;
          return (
            <div
              key={row.name}
              className={`stat-row ${row.cls || ""} ${hasSrc ? "has-sources" : ""}`}
              onMouseEnter={(e) => onRowEnter(row, e)}
              onMouseLeave={() => setTip(null)}
            >
              <span className="stat-name">{row.name}</span>
              <span className={`stat-value ${row.cls === "pos" ? "pos" : row.cls === "neg" ? "neg" : ""}`}>
                {row.value}
                {row.gap && <span className="res-gap">({row.gap})</span>}
              </span>
            </div>
          );
        })}
      </div>

      {tip && <SourceTip row={tip.row} anchorX={tip.x} anchorY={tip.y} />}
    </div>
  );
}

/* ---------- Stat Source Attribution tooltip (FR-13) ---------- */
function SourceTip({ row, anchorX, anchorY }) {
  // group sources
  const groups = {};
  row.sources.forEach((s) => { (groups[s.group] = groups[s.group] || []).push(s); });

  const fmtVal = (v) => (typeof v === "number" ? `+${v % 1 === 0 ? v : v.toFixed(1)}` : v);

  const width = 280;
  const left = Math.max(8, anchorX - width - 10);
  const top = Math.min(window.innerHeight - 280, anchorY - 8);

  return (
    <div className="source-tip" style={{ left, top, width }}>
      <div className="source-tip-head">
        <span className="source-tip-name">{row.name}</span>
        <span className="source-tip-total">{row.value}</span>
      </div>
      <div className="source-tip-body">
        {Object.entries(groups).map(([g, items]) => (
          <div key={g} className="source-tip-group">
            <div className="source-tip-group-title">{g}</div>
            {items.map((s, i) => (
              <div key={i} className="source-tip-line">
                <span className="source-tip-line-name">
                  <span className="dot-src" style={{ background: SRC_COLORS[g] || "var(--text-muted)" }} />
                  {s.label}
                </span>
                <span className="source-tip-line-val">{fmtVal(s.val)}{typeof s.val === "number" && /%|Res|Chance|Speed|Pen|Retention|Multi|Endurance|Healing|Dodge/.test(row.name) ? "%" : ""}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {row.capNote && (
        <div className="source-tip-foot">
          <span>Total before cap</span>
          <span><span className="mono">{row.capNote.total % 1 === 0 ? row.capNote.total : row.capNote.total.toFixed(1)}%</span> <span className="source-tip-cap">(cap {row.capNote.cap}%)</span></span>
        </div>
      )}
    </div>
  );
}

window.RightPanel = RightPanel;
