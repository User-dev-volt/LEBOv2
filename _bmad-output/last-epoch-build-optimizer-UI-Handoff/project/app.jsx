/* ============================================================
   LEBO — Main App shell + state
   ============================================================ */

const { CLASSES: CLASSES_APP } = window.LEBO_DATA;

// ----------- initial state -----------
const initialState = {
  buildName: "Bone Curse Lich",
  classId: "acolyte",
  mastery: "Lich",
  tab: "tree",                      // tree | weave | gear | skill | idol | blessing
  view: "main",                     // main | gearopt | settings
  leftCollapsed: false,
  rightCollapsed: false,

  gear: {
    helm: null,
    amulet: null,
    chest: null,
    belt: null,
    boots: null,
    weapon: {
      id: "w2", name: "Necrotic Scepter", base: "Bone Scepter", rarity: "rare", affixes: 4,
      affixList: [
        { id: "ne_dmg", name: "Increased Necrotic Damage", range: [10, 80], maxTier: 7, tier: 5, unit: "%" },
        { id: "crit_ch", name: "Critical Strike Chance", range: [80, 240], maxTier: 7, tier: 4, unit: "%" },
        { id: "cast_spd", name: "Cast Speed", range: [5, 22], maxTier: 5, tier: 3, unit: "%" },
        { id: "hp_flat", name: "Maximum Health", range: [12, 110], maxTier: 7, tier: 6, unit: "" },
      ],
    },
    offhand: null,
    gloves: {
      id: "g2", name: "Ascetic Gloves", base: "Silken Gloves", rarity: "rare", affixes: 4,
      affixList: [
        { id: "crit_mul", name: "Critical Strike Multiplier", range: [12, 70], maxTier: 7, tier: 5, unit: "%" },
        { id: "atk_spd", name: "Attack Speed", range: [5, 18], maxTier: 5, tier: 4, unit: "%" },
        { id: "fire_res", name: "Fire Resistance", range: [16, 80], maxTier: 7, tier: 4, unit: "%" },
      ],
    },
    ring1: null,
    ring2: null,
    relic: null,
  },

  skills: [
    { id: "rip_blood", name: "Rip Blood", tag: "Spell · Necrotic", spec: 14 },
    { id: "transplant", name: "Transplant", tag: "Movement · Necrotic", spec: 8 },
    null, null, null,
  ],

  idols: [
    { placementId: "p1", id: "i_2x1_a", shape: "2x1", name: "Stout Idol of Conflagration", stat: "+18% Fire Damage", r: 0, c: 1 },
    { placementId: "p2", id: "i_2x2_a", shape: "2x2", name: "Grand Idol of the Wanderer", stat: "+32 Dodge, +6% Crit", r: 1, c: 0 },
    { placementId: "p3", id: "i_1x1_a", shape: "1x1", name: "Lesser Idol of Swiftness", stat: "+4% Movement Speed", r: 0, c: 0 },
  ],

  blessings: {
    bs1: "Twisted Memory (+30% cold)",
    bs2: "Gift of Winter (+18 cold res)",
    bs3: "Wing's Shadow (+80 dodge)",
    bs4: "Twisted Hearts (+30% void)",
    bs5: null,
  },

  allocated: ["n_origin", "n_inner_0", "n_inner_2", "n_outer_0", "n_outer_2"],
  suggestedNodes: [],
  weaver: 0,

  archetype: 65,
  weights: { damage: 60, surv: 40, speed: 30 },

  unsaved: true,
  score: 0,
  scoreDelta: 0,
  subScores: { damage: 0, surv: 0, speed: 0 },
  idolUsedCells: 0,

  suggestions: [],
  activeSuggestion: null,
  optimizing: false,
};

// derived scoring
function computeScores(state) {
  const gearCount = Object.values(state.gear).filter(Boolean).length;
  const allocCount = state.allocated.length;
  const idolCount = state.idols.length;
  const usedCells = state.idols.reduce((s, i) => {
    const dims = { "1x1": 1, "1x2": 2, "2x1": 2, "2x2": 4, "1x3": 3, "3x1": 3 };
    return s + (dims[i.shape] || 1);
  }, 0);

  const damageBase = 30 + gearCount * 4 + allocCount * 3 + idolCount * 2;
  const survBase = 24 + gearCount * 3 + allocCount * 1.4 + idolCount * 3;
  const speedBase = 12 + idolCount * 2 + Math.min(20, allocCount);

  // Archetype skew (0 jugg ... 100 glass cannon)
  const dmgSkew = (state.archetype / 100) * 0.6 + 0.7; // 0.7..1.3
  const survSkew = 1.3 - (state.archetype / 100) * 0.6;
  const speedSkew = 1.0;

  const wD = state.weights.damage / 50;
  const wS = state.weights.surv / 50;
  const wSp = state.weights.speed / 50;

  const damage = damageBase * dmgSkew * wD;
  const surv = survBase * survSkew * wS;
  const speed = speedBase * speedSkew * wSp;

  const score = Math.min(100, (damage * 0.45 + surv * 0.4 + speed * 0.15) * 0.65);

  return { score, sub: { damage, surv, speed }, usedCells };
}

// reducer
function reducer(state, action) {
  switch (action.type) {
    case "tab": return { ...state, tab: action.value, view: "main" };
    case "view": return { ...state, view: action.value };
    case "leftCollapsed": return { ...state, leftCollapsed: !state.leftCollapsed };
    case "rightCollapsed": return { ...state, rightCollapsed: !state.rightCollapsed };

    case "class":
      const cls = CLASSES_APP.find((c) => c.id === action.value);
      return { ...state, classId: action.value, mastery: cls.masteries[0], unsaved: true };
    case "mastery":
      return { ...state, mastery: action.value, unsaved: true };

    case "save":
      return { ...state, unsaved: false };

    case "allocate":
      return { ...state, allocated: [...state.allocated, action.id], unsaved: true };
    case "deallocate":
      // also deallocate children
      const adj = action.adjacency || {};
      return { ...state, allocated: state.allocated.filter((id) => id !== action.id), unsaved: true };

    case "archetype":
      return { ...state, archetype: action.value, unsaved: true };
    case "weight":
      return { ...state, weights: { ...state.weights, [action.key]: action.value }, unsaved: true };

    case "gear:set":
      return { ...state, gear: { ...state.gear, [action.slotId]: action.item }, unsaved: true };
    case "gear:setAffix": {
      const item = state.gear[action.slotId];
      if (!item) return state;
      const list = [...(item.affixList || [])];
      const next = { ...action.affix, maxTier: action.affix.tier, tier: action.tier };
      if (action.affixIdx === -1 || action.affixIdx >= list.length) list.push(next);
      else list[action.affixIdx] = next;
      return { ...state, gear: { ...state.gear, [action.slotId]: { ...item, affixList: list } }, unsaved: true };
    }
    case "gear:removeAffix": {
      const item = state.gear[action.slotId];
      if (!item) return state;
      const list = (item.affixList || []).filter((_, i) => i !== action.affixIdx);
      return { ...state, gear: { ...state.gear, [action.slotId]: { ...item, affixList: list } }, unsaved: true };
    }
    case "gear:setTier": {
      const item = state.gear[action.slotId];
      if (!item) return state;
      const list = [...(item.affixList || [])];
      list[action.affixIdx] = { ...list[action.affixIdx], tier: action.tier };
      return { ...state, gear: { ...state.gear, [action.slotId]: { ...item, affixList: list } }, unsaved: true };
    }

    case "idol:place": {
      const id = `p_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
      return { ...state, idols: [...state.idols, { ...action.def, placementId: id, r: action.r, c: action.c }], unsaved: true };
    }
    case "idol:remove":
      return { ...state, idols: state.idols.filter((i) => i.placementId !== action.placementId), unsaved: true };

    case "blessing:set":
      return { ...state, blessings: { ...state.blessings, [action.slotId]: action.value }, unsaved: true };

    case "skill:set": {
      const next = [...state.skills];
      next[action.index] = action.skill;
      return { ...state, skills: next, unsaved: true };
    }
    case "skill:clear": {
      const next = [...state.skills];
      next[action.index] = null;
      return { ...state, skills: next, unsaved: true };
    }

    case "optimize":
      return { ...state, optimizing: true };
    case "optimize:done":
      return { ...state, optimizing: false, suggestions: action.suggestions, suggestedNodes: action.nodes };
    case "suggestion:focus":
      return { ...state, activeSuggestion: action.id };

    case "_score":
      return {
        ...state,
        score: action.score,
        subScores: action.sub,
        idolUsedCells: action.usedCells,
        scoreDelta: action.score - state.score,
      };

    default: return state;
  }
}

/* ============================================================
   Main App
   ============================================================ */

function App() {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  const lastScoreRef = useRef(0);

  // Tweaks
  const t = useTweaks({ density: "comfy", aesthetic: "balanced", goldHue: "warm" });

  // Recompute scores when relevant inputs change
  useEffect(() => {
    const { score, sub, usedCells } = computeScores(state);
    if (Math.abs(score - lastScoreRef.current) > 0.01) {
      lastScoreRef.current = score;
      dispatch({ type: "_score", score, sub, usedCells });
    }
  }, [state.gear, state.allocated, state.idols, state.archetype, state.weights, state.skills]);

  // Optimize handler
  useEffect(() => {
    if (!state.optimizing) return;
    const t = setTimeout(() => {
      const suggestions = [
        { id: "n_outer_1", name: "Death Magic",        delta: +4.2, text: "+22% Necrotic & Cold damage. Best gain for your Rip Blood loop." },
        { id: "n_outer_4", name: "Aspect of Decay",    delta: +3.1, text: "Converts 18% damage taken to delayed necrotic — strong synergy with leech." },
        { id: "n_outer_5", name: "Wraithwalk",         delta: +1.8, text: "Move speed + dodge improves clear without hurting damage." },
        { id: "n_far_0",   name: "Keystone Path",      delta: -0.4, text: "Costs 6 points to reach; minor score gain on its own." },
      ];
      dispatch({ type: "optimize:done", suggestions, nodes: suggestions.map((s) => s.id) });
    }, 1200);
    return () => clearTimeout(t);
  }, [state.optimizing]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "1") dispatch({ type: "tab", value: "tree" });
      if (k === "2") dispatch({ type: "tab", value: "weave" });
      if (k === "3") dispatch({ type: "tab", value: "gear" });
      if (k === "4") dispatch({ type: "tab", value: "skill" });
      if (k === "5") dispatch({ type: "tab", value: "idol" });
      if (k === "6") dispatch({ type: "tab", value: "blessing" });
      if (k === "[") dispatch({ type: "leftCollapsed" });
      if (k === "]") dispatch({ type: "rightCollapsed" });
      if (k === "o") dispatch({ type: "optimize" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const tabs = [
    { id: "tree",     name: "Passive Tree",  icon: "tree",     badge: `${state.allocated.length}` },
    { id: "weave",    name: "Weaver",        icon: "weave",    badge: `${state.weaver}` },
    { divider: true },
    { id: "gear",     name: "Gear",          icon: "gear",     badge: `${Object.values(state.gear).filter(Boolean).length}/11` },
    { id: "skill",    name: "Skills",        icon: "skill",    badge: `${state.skills.filter(Boolean).length}/5` },
    { id: "idol",     name: "Idols",         icon: "idol",     badge: `${state.idols.length}` },
    { id: "blessing", name: "Blessings",     icon: "blessing", badge: `${Object.values(state.blessings).filter(Boolean).length}/5` },
  ];

  const mainBody = (
    <div className={`body ${state.leftCollapsed ? "left-collapsed" : ""} ${state.rightCollapsed ? "right-collapsed" : ""}`}>
      <LeftPanel state={state} dispatch={dispatch}
        collapsed={state.leftCollapsed}
        onToggleCollapsed={() => dispatch({ type: "leftCollapsed" })} />

      <div className="center">
        <div className="center-tabs">
          {tabs.map((t, i) => {
            if (t.divider) return <div key={`d_${i}`} className="center-tab-divider" />;
            return (
              <div
                key={t.id}
                className={`center-tab ${state.tab === t.id ? "active" : ""}`}
                onClick={() => dispatch({ type: "tab", value: t.id })}
              >
                <span className="tab-icon"><Icon name={t.icon} size={13} /></span>
                <span>{t.name}</span>
                <span className="tab-badge">{t.badge}</span>
              </div>
            );
          })}
        </div>
        <div className="center-body">
          {state.tab === "tree"     && <PassiveTree state={state} dispatch={dispatch} />}
          {state.tab === "weave"    && <WeaverTree  state={state} />}
          {state.tab === "gear"     && <GearEditor  state={state} dispatch={dispatch} />}
          {state.tab === "skill"    && <SkillEditor state={state} dispatch={dispatch} />}
          {state.tab === "idol"     && <IdolEditor  state={state} dispatch={dispatch} />}
          {state.tab === "blessing" && <BlessingEditor state={state} dispatch={dispatch} />}
        </div>
      </div>

      <RightPanel state={state} dispatch={dispatch}
        collapsed={state.rightCollapsed}
        onToggleCollapsed={() => dispatch({ type: "rightCollapsed" })} />
    </div>
  );

  return (
    <div className={`app density-${t.density}`}>
      <header className="header">
        <div className="header-logo">
          <span className="header-logo-mark">LEBO</span>
          <span className="header-logo-sub">Last Epoch Build Optimizer</span>
        </div>
        <nav className="header-nav">
          <div className={`header-nav-item ${state.view === "main" ? "active" : ""}`} onClick={() => dispatch({ type: "view", value: "main" })}>
            Builder
          </div>
          <div className={`header-nav-item ${state.view === "gearopt" ? "active" : ""}`} onClick={() => dispatch({ type: "view", value: "gearopt" })}>
            Gear Optimization
          </div>
          <div className={`header-nav-item ${state.view === "settings" ? "active" : ""}`} onClick={() => dispatch({ type: "view", value: "settings" })}>
            Settings
          </div>
        </nav>
        <div className="header-spacer" />
        <div className="header-right">
          <div className="header-status-dot">
            <span className="dot" /> Online
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            <span className="mono">v2.4.1</span>
          </div>
        </div>
      </header>

      {state.view === "main"     && mainBody}
      {state.view === "gearopt"  && <div className="body" style={{ gridTemplateColumns: "1fr" }}>
        <div className="center"><GearOptScreen state={state} dispatch={dispatch} onBack={() => dispatch({ type: "view", value: "main" })} /></div>
      </div>}
      {state.view === "settings" && <div className="body" style={{ gridTemplateColumns: "1fr" }}>
        <div className="center"><SettingsScreen onBack={() => dispatch({ type: "view", value: "main" })} /></div>
      </div>}

      <footer className="statusbar">
        <span>Data: <span style={{ color: "var(--text-secondary)" }}>Season 4 (Shattered Omens)</span> — <span className="mono">2026-03-26</span></span>
        <span className="statusbar-mid">
          {state.unsaved ? <span style={{ color: "var(--accent-gold)" }}>● Unsaved changes</span> : <span>● All changes saved</span>}
        </span>
        <span>LLM: <span style={{ color: "var(--text-secondary)" }}>OpenRouter</span> · <span className="mono">gemini-2.0-flash</span></span>
      </footer>

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Density">
          <TweakRadio
            value={t.density}
            onChange={(v) => t.setTweak("density", v)}
            options={[{ value: "compact", label: "Compact" }, { value: "comfy", label: "Comfy" }]}
          />
        </TweakSection>
        <TweakSection title="Quick actions">
          <TweakButton onClick={() => dispatch({ type: "view", value: "gearopt" })}>Open Gear Optimization</TweakButton>
          <TweakButton onClick={() => dispatch({ type: "view", value: "settings" })}>Open Settings</TweakButton>
          <TweakButton onClick={() => dispatch({ type: "optimize" })}>Run Optimize</TweakButton>
          <TweakButton onClick={() => dispatch({ type: "tab", value: "gear" })}>Jump to Gear</TweakButton>
          <TweakButton onClick={() => dispatch({ type: "tab", value: "idol" })}>Jump to Idols</TweakButton>
        </TweakSection>
        <TweakSection title="Layout">
          <TweakToggle label="Collapse left panel" value={state.leftCollapsed} onChange={() => dispatch({ type: "leftCollapsed" })} />
          <TweakToggle label="Collapse right panel" value={state.rightCollapsed} onChange={() => dispatch({ type: "rightCollapsed" })} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
