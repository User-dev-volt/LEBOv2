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
                    <span className="suggestion-name">{s.name}</span>
                  </div>
                  <span className={`suggestion-delta ${s.delta > 0 ? "pos" : "neg"}`}>
                    {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)}
                  </span>
                </div>
                <div className="suggestion-text">{s.text}</div>
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
function StatSheet({ state }) {
  const [tab, setTab] = useState("general");

  const tabs = ["general", "offense", "defense", "other"];

  const data = {
    general: [
      ["Class", state.classId.charAt(0).toUpperCase() + state.classId.slice(1)],
      ["Mastery", state.mastery],
      ["Level", "92"],
      ["Passive Points", `${state.allocated.length} / 115`],
      ["Idol Slots Used", `${state.idolUsedCells} / 20`],
      ["Skill Slots", `${state.skills.filter(Boolean).length} / 5`],
    ],
    offense: [
      ["Build Score", state.score.toFixed(1), "crit"],
      ["Damage Score", state.subScores.damage.toFixed(1)],
      ["Avg Hit", "1,420"],
      ["Avg Hit (Crit)", "3,624"],
      ["Crit Chance", "32.4%"],
      ["Crit Multi", "210%"],
      ["Attack Speed", "1.42"],
      ["Cast Speed", "1.18"],
      ["AoE Modifier", "1.0"],
    ],
    defense: [
      ["Effective HP", "4,820"],
      ["HP", "2,140"],
      ["Ward", "1,680"],
      ["Armor", "2,910 (44%)"],
      ["Endurance", "60% to 540"],
      ["Fire Res", "75%", "pos"],
      ["Cold Res", "75%", "pos"],
      ["Lightning Res", "68% (+7 needed)", "neg"],
      ["Void Res", "75%", "pos"],
    ],
    other: [
      ["Damage Score", state.subScores.damage.toFixed(1)],
      ["Surv. Score", state.subScores.surv.toFixed(1)],
      ["Speed Score", state.subScores.speed.toFixed(1)],
      ["Move Speed", "1.42 (+42%)"],
      ["Cooldown Recovery", "+24%"],
      ["Mana", "184 (+8.4/s)"],
      ["Health Regen", "+42/s"],
    ],
  };

  return (
    <div>
      <div className="stat-tabs">
        {tabs.map((t) => (
          <div key={t} className={`stat-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        ))}
      </div>
      <div>
        {data[tab].map(([k, v, cls]) => (
          <div key={k} className={`stat-row ${cls || ""}`}>
            <span className="stat-name">{k}</span>
            <span className={`stat-value ${cls === "pos" ? "pos" : cls === "neg" ? "neg" : ""}`}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

window.RightPanel = RightPanel;
