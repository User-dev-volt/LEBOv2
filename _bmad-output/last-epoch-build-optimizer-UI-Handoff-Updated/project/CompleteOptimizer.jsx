/* ============================================================
   Complete Build Optimizer (FR-20 – FR-26)
   - Scope selector with completeness gates
   - Inline red gate alerts + "Go to section"
   - Skill suggestion from Popular Builds DB
   - Optimization Orb animation
   - Unified ranked results by domain
   ============================================================ */

const { POPULAR_BUILDS, IDOL_SUGGESTIONS, SKILLS_BY_CLASS: CBO_SKILLS } = window.LEBO_DATA;

const CBO_SECTIONS = [
  { id: "tree",     name: "Passive Tree",  icon: "tree",     defaultOn: true,  tab: "tree" },
  { id: "skill",    name: "Active Skills", icon: "skill",    defaultOn: true,  tab: "skill" },
  { id: "gear",     name: "Gear",          icon: "gear",     defaultOn: true,  tab: "gear" },
  { id: "idol",     name: "Idols",         icon: "idol",     defaultOn: true,  tab: "idol" },
  { id: "blessing", name: "Blessings",     icon: "blessing", defaultOn: true,  tab: "blessing" },
  { id: "weave",    name: "Weaver Tree",   icon: "weave",    defaultOn: false, tab: "weave" },
];

function evalGate(id, state) {
  switch (id) {
    case "tree": {
      const n = state.allocated.length;
      return { ok: n >= 1, status: `${n} pts`, fail: "Passive Tree requires at least 1 allocated point.", count: n };
    }
    case "skill": {
      const n = state.skills.filter(Boolean).length;
      return { ok: n >= 2, status: `${n}/5`, fail: `Active Skills requires at least 2 slots filled — ${2 - n} more needed.`, count: n, canSuggest: true };
    }
    case "gear": {
      const n = Object.values(state.gear).filter(Boolean).length;
      return { ok: n >= 11, status: `${n}/11`, fail: `Gear requires all 11 slots filled — ${11 - n} ${11 - n === 1 ? "slot is" : "slots are"} empty.`, count: n };
    }
    case "idol": {
      const n = state.idols.length;
      return { ok: true, status: `${n} placed`, fail: "", count: n };
    }
    case "blessing": {
      const n = Object.values(state.blessings).filter(Boolean).length;
      return { ok: n >= 1, status: `${n}/5`, fail: "Blessings requires at least 1 assignment.", count: n };
    }
    case "weave": {
      const n = state.weaver;
      return { ok: n > 0, status: n > 0 ? `${n} pts` : "0 budget", fail: "Weaver Tree has no available points — uncheck it or allocate Weaver budget.", count: n };
    }
    default: return { ok: true, status: "", fail: "" };
  }
}

const ORB_PHRASES = [
  "Ingesting build state…",
  "Evaluating passive efficiency…",
  "Scoring gear upgrade paths…",
  "Cross-referencing idol affixes…",
  "Weighing blessing timelines…",
  "Assembling narrative…",
];

function CompleteOptimizer({ state, dispatch, onBack, goToSection }) {
  const [checked, setChecked] = useState(() => {
    const o = {};
    CBO_SECTIONS.forEach((s) => (o[s.id] = s.defaultOn));
    return o;
  });
  const [alerts, setAlerts] = useState(null);      // array of failed section ids, or null
  const [skillSuggestOpen, setSkillSuggestOpen] = useState(false);
  const [phase, setPhase] = useState("setup");     // setup | running | results
  const [orbStep, setOrbStep] = useState(0);
  const [results, setResults] = useState(null);

  const gates = useMemo(() => {
    const g = {};
    CBO_SECTIONS.forEach((s) => (g[s.id] = evalGate(s.id, state)));
    return g;
  }, [state]);

  const toggle = (id) => {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
    setAlerts(null);
  };

  const checkedSections = CBO_SECTIONS.filter((s) => checked[s.id]);

  const run = () => {
    const failed = checkedSections.filter((s) => !gates[s.id].ok).map((s) => s.id);
    if (failed.length) { setAlerts(failed); return; }
    setAlerts(null);
    setPhase("running");
    setOrbStep(0);
  };

  // orb animation progression
  useEffect(() => {
    if (phase !== "running") return;
    let step = 0;
    const tokenCount = checkedSections.length;
    const iv = setInterval(() => {
      step += 1;
      setOrbStep(step);
      if (step > tokenCount + 1) {
        clearInterval(iv);
        setResults(buildResults(checkedSections, state));
        setPhase("results");
      }
    }, 620);
    return () => clearInterval(iv);
  }, [phase]);

  const phraseIdx = Math.min(orbStep, ORB_PHRASES.length - 1);

  if (phase === "results" && results) {
    return <CBOResults results={results} state={state} onBack={onBack} onRerun={() => { setPhase("setup"); setResults(null); }} goToSection={goToSection} />;
  }

  return (
    <div className="cbo">
      <div className="cbo-head">
        <div className="gearopt-back" onClick={onBack}>
          <Icon name="chevron-left" size={14} /> Back to Builder
        </div>
        <div style={{ width: 1, height: 18, background: "var(--hairline)" }} />
        <div>
          <div className="gearopt-title">Complete Build Optimizer</div>
          <div className="gearopt-sub">Reason across every build section at once for a unified upgrade roadmap.</div>
        </div>
      </div>

      <div className="cbo-scroll">
        <div className="cbo-inner">
          <div className="cbo-intro">
            <div className="cbo-intro-icon"><Icon name="zap" size={20} color="var(--accent-gold)" /></div>
            <div>
              <div className="cbo-intro-title">Choose what to optimize</div>
              <div className="cbo-intro-text">
                Check the build sections you want included. Each checked section is validated before the run —
                anything incomplete is flagged so you can fix it first. Unchecked sections are excluded from analysis.
              </div>
            </div>
          </div>

          <div className="label" style={{ marginBottom: 8 }}>Scope Selector</div>
          <div className="scope-list">
            {CBO_SECTIONS.map((s) => {
              const g = gates[s.id];
              const on = checked[s.id];
              const showAlert = alerts && alerts.includes(s.id);
              const statusCls = !on ? "off" : g.ok ? "ok" : (s.id === "weave" ? "warn" : "fail");
              return (
                <div key={s.id} className={`scope-item ${on ? "checked" : ""}`}>
                  <div className="scope-row" onClick={() => toggle(s.id)}>
                    <div className="scope-check">
                      {on && <Icon name="check" size={13} color="#1A1308" stroke={2.4} />}
                    </div>
                    <div className="scope-icon">
                      <Icon name={s.icon} size={18} color={on ? "var(--accent-gold)" : "var(--text-muted)"} />
                    </div>
                    <div>
                      <div className="scope-info-name">{s.name}</div>
                      <div className="scope-info-sub">
                        {s.id === "idol" ? "Optional — AI may suggest additions" :
                         s.id === "weave" ? "Opt-in — requires Weaver budget" :
                         g.ok ? "Ready" : "Incomplete"}
                      </div>
                    </div>
                    <div className={`scope-status ${statusCls}`}>{g.status}</div>
                  </div>

                  {showAlert && (
                    <div className="gate-alert">
                      <div className="gate-alert-icon"><Icon name="alert" size={16} /></div>
                      <div className="gate-alert-text">
                        {g.fail}
                        {g.canSuggest && <div className="sub">Don't know what to run? Pull a popular skill set for your mastery.</div>}
                      </div>
                      <div className="gate-actions">
                        {g.canSuggest && (
                          <button className="btn btn-sm btn-gold-outline" onClick={() => setSkillSuggestOpen((v) => !v)}>
                            Suggest skills
                          </button>
                        )}
                        <button className="btn btn-sm" onClick={() => goToSection(s.tab)}>
                          Go to {s.name}
                        </button>
                      </div>
                    </div>
                  )}

                  {showAlert && s.id === "skill" && skillSuggestOpen && (
                    <SkillSuggest state={state} dispatch={dispatch} onClose={() => setSkillSuggestOpen(false)} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="cbo-runbar">
            <div className="cbo-runbar-msg">
              {alerts ? (
                <span style={{ color: "var(--data-negative)" }}>
                  <Icon name="alert" size={11} /> {alerts.length} section{alerts.length > 1 ? "s" : ""} need attention before running.
                </span>
              ) : (
                <span>{checkedSections.length} sections in scope · estimated 2–4s analysis</span>
              )}
            </div>
            <button className="btn btn-gold btn-lg" onClick={run} disabled={checkedSections.length === 0}>
              <Icon name="zap" size={14} /> Run Complete Build Optimization
            </button>
          </div>
        </div>
      </div>

      {phase === "running" && (
        <OptimizationOrb sections={checkedSections} step={orbStep} phrase={ORB_PHRASES[phraseIdx]} />
      )}
    </div>
  );
}

/* ---------- Skill suggestion from Popular Builds DB ---------- */
function SkillSuggest({ state, dispatch, onClose }) {
  const assigned = state.skills.filter(Boolean).map((s) => s.id);
  const classSkills = CBO_SKILLS[state.classId] || [];
  const ICONS = { harvest: "skill-harvest", rip_blood: "skill-blood", marrow: "skill-bone", wraith: "skill-wraith", transplant: "skill-teleport", soul_feast: "skill-blood", skel_mage: "skill-wraith", bone_curse: "skill-bone", rev_volley: "skill-volley" };

  // match: same mastery, sort by overlap with assigned
  const matches = POPULAR_BUILDS
    .filter((b) => b.mastery === state.mastery || classSkills.length)
    .map((b) => ({ ...b, overlap: b.skills.filter((s) => assigned.includes(s)).length }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3);

  const apply = (build) => {
    // fill empty slots without overwriting assigned
    const next = [...state.skills];
    const toAdd = build.skills.filter((id) => !assigned.includes(id));
    let ai = 0;
    for (let i = 0; i < next.length && ai < toAdd.length; i++) {
      if (!next[i]) {
        const sk = classSkills.find((s) => s.id === toAdd[ai]) || { id: toAdd[ai], name: toAdd[ai], tag: "" };
        next[i] = { ...sk, spec: 0 };
        ai++;
      }
    }
    dispatch({ type: "skills:setAll", skills: next });
    onClose();
  };

  return (
    <div className="skillsugg">
      <div className="skillsugg-head">Popular {state.mastery} builds · matched to your assigned skills</div>
      {matches.map((b) => (
        <div key={b.name} className="skillsugg-row" onClick={() => apply(b)}>
          <div className="skillsugg-skills">
            {b.skills.map((sid) => (
              <div key={sid} className={`skillsugg-skill ${assigned.includes(sid) ? "have" : ""}`} title={sid}>
                <Icon name={ICONS[sid] || "skill"} size={14} color={assigned.includes(sid) ? "var(--accent-gold)" : "var(--text-muted)"} />
              </div>
            ))}
          </div>
          <div style={{ minWidth: 150 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{b.source} · {b.overlap} skill{b.overlap !== 1 ? "s" : ""} match</div>
          </div>
          <button className="btn btn-sm btn-gold-outline">Auto-fill</button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Optimization Orb ---------- */
function OptimizationOrb({ sections, step, phrase }) {
  const n = sections.length;
  const radius = 130;
  const total = n + 2;
  const progress = Math.min(100, Math.round((step / total) * 100));

  return (
    <div className="orb-overlay">
      <div className="orb-stage">
        <div className="orb-ring" style={{ width: 280, height: 280 }} />
        <div className="orb-ring" style={{ width: 200, height: 200 }} />
        <div className="orb-core" />
        {sections.map((s, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          const absorbed = step > i;
          const x = absorbed ? 0 : Math.cos(angle) * radius;
          const y = absorbed ? 0 : Math.sin(angle) * radius;
          return (
            <div
              key={s.id}
              className={`orb-token ${absorbed ? "absorbed" : ""}`}
              style={{ transform: `translate(${x}px, ${y}px) scale(${absorbed ? 0.4 : 1})` }}
            >
              <div className="orb-token-chip"><Icon name={s.icon} size={18} color="var(--accent-gold)" /></div>
              <div className="orb-token-label">{s.name}</div>
            </div>
          );
        })}
      </div>
      <div className="orb-status">
        <div className="orb-status-text">{phrase}</div>
        <div className="orb-status-sub">Analyzing {n} build sections · {progress}%</div>
        <div className="orb-progress"><div className="orb-progress-fill" style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  );
}

/* ---------- Build mock results ---------- */
function buildResults(sections, state) {
  const ids = sections.map((s) => s.id);
  const out = {};

  if (ids.includes("tree")) {
    out.tree = {
      icon: "tree", name: "Passive Tree", suggestions: [
        { name: "Death Magic", delta: 4.2, meta: "2 pts / 4 pts to reach", text: "+22% Necrotic & Cold damage — best per-point gain for your Rip Blood loop." },
        { name: "Aspect of Decay", delta: 3.1, meta: "1 pt / 3 pts to reach", text: "Converts 18% of damage taken to delayed necrotic; strong with leech." },
        { name: "Wraithwalk", delta: 1.8, meta: "1 pt / 1 pt to reach", text: "Move speed + dodge raises clear speed without hurting damage." },
      ],
    };
  }
  if (ids.includes("gear")) {
    out.gear = {
      icon: "gear", name: "Gear", suggestions: [
        { name: "Main Hand → Famine's Edge", delta: 18.4, badge: "swap", text: "Enemies take 30% increased damage — multiplies your entire damage loop." },
        { name: "Amulet → Heart of the Lich King", delta: 12.1, badge: "swap", text: "Spend health instead of mana, fitting the Rip Blood sustain pattern." },
        { name: "Boots → Striders of the Wandering Star", delta: -1.1, badge: "swap", text: "Loses some resistance, but +45% move speed for a low-armor glass build." },
      ],
    };
  }
  if (ids.includes("idol")) {
    out.idol = {
      icon: "idol", name: "Idols", suggestions: IDOL_SUGGESTIONS.map((s) => ({
        name: `${s.name} → row ${s.r + 1}, col ${s.c + 1}`, delta: s.delta, badge: s.shape, text: `${s.affix} — fills empty grid space without conflicting with placed idols.`,
      })),
    };
  }
  if (ids.includes("blessing")) {
    out.blessing = {
      icon: "blessing", name: "Blessings", suggestions: [
        { name: "The Last Ruin → Stone Memory", delta: 2.6, badge: "timeline", text: "Adds +8% physical resistance; your only empty blessing timeline." },
      ],
    };
  }
  if (ids.includes("skill")) {
    out.skill = {
      icon: "skill", name: "Active Skills", suggestions: [
        { name: "Specialize Bone Curse → Spreading Curse", delta: 3.4, badge: "node", text: "Curse propagation lifts single-target into AoE; big clear-speed gain." },
      ],
    };
  }

  return out;
}

/* ---------- Results view ---------- */
function CBOResults({ results, state, onBack, onRerun, goToSection }) {
  const [open, setOpen] = useState(() => {
    const o = {}; Object.keys(results).forEach((k) => (o[k] = true)); return o;
  });

  const allSuggestions = Object.values(results).flatMap((d) => d.suggestions);
  const totalGain = allSuggestions.filter((s) => s.delta > 0).reduce((a, s) => a + s.delta, 0);
  const best = allSuggestions.reduce((m, s) => Math.max(m, s.delta), 0);
  const domainCount = Object.keys(results).length;

  return (
    <div className="cbo">
      <div className="cbo-head">
        <div className="gearopt-back" onClick={onBack}>
          <Icon name="chevron-left" size={14} /> Back to Builder
        </div>
        <div style={{ width: 1, height: 18, background: "var(--hairline)" }} />
        <div>
          <div className="gearopt-title">Optimization Results</div>
          <div className="gearopt-sub">Ranked upgrades across {domainCount} build domains.</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={onRerun}><Icon name="reset" size={12} /> Re-run</button>
        <button className="btn btn-gold-outline" onClick={() => goToSection("tree")}>
          <Icon name="tree" size={12} /> Focus on Passive Tree
        </button>
      </div>

      <div className="cbo-scroll">
        <div className="cbo-results">
          <div className="cbo-summary">
            <div className="cbo-summary-card">
              <div className="cbo-summary-label">Current Score</div>
              <div className="cbo-summary-value" style={{ color: "var(--text-primary)" }}>{Math.round(state.score)}</div>
            </div>
            <div className="cbo-summary-card">
              <div className="cbo-summary-label">Potential Gain</div>
              <div className="cbo-summary-value pos">+{totalGain.toFixed(1)}</div>
            </div>
            <div className="cbo-summary-card">
              <div className="cbo-summary-label">Top Upgrade</div>
              <div className="cbo-summary-value gold">+{best.toFixed(1)}</div>
            </div>
            <div className="cbo-summary-card">
              <div className="cbo-summary-label">Suggestions</div>
              <div className="cbo-summary-value" style={{ color: "var(--text-primary)" }}>{allSuggestions.length}</div>
            </div>
          </div>

          {Object.entries(results).map(([key, d]) => {
            const isOpen = open[key];
            const domainBest = d.suggestions.reduce((m, s) => Math.max(m, s.delta), 0);
            return (
              <div key={key} className={`cbo-domain ${isOpen ? "open" : ""}`}>
                <div className="cbo-domain-head" onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
                  <Icon name={isOpen ? "chevron-down" : "chevron-right"} size={14} color="var(--text-muted)" />
                  <div className="cbo-domain-icon"><Icon name={d.icon} size={15} color="var(--accent-gold)" /></div>
                  <div className="cbo-domain-name">{d.name}</div>
                  <div className="cbo-domain-count">{d.suggestions.length} suggestion{d.suggestions.length !== 1 ? "s" : ""}</div>
                  <div className="cbo-domain-best">best +{domainBest.toFixed(1)}</div>
                </div>
                {isOpen && (
                  <div className="cbo-domain-body">
                    {d.suggestions.map((s, i) => (
                      <div key={i} className={`cbo-sugg ${s.delta < 0 ? "neg" : ""}`}>
                        <div className="cbo-sugg-rank">{String(i + 1).padStart(2, "0")}</div>
                        <div>
                          <div>
                            <span className="cbo-sugg-name">{s.name}</span>
                            {s.badge && <span className="cbo-sugg-badge">{s.badge}</span>}
                          </div>
                          <div className="cbo-sugg-text">{s.text}</div>
                          {s.meta && <div className="cbo-sugg-meta">{s.meta}</div>}
                        </div>
                        <div className={`cbo-sugg-delta ${s.delta > 0 ? "pos" : "neg"}`}>
                          {s.delta > 0 ? "+" : ""}{s.delta.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.CompleteOptimizer = CompleteOptimizer;
