/* global React, ReactDOM, TitleScreen, ClassSelect, MenuPanel, Dungeon, CLASSES, generateMap, MageSprite, glyphSVG */

const { useState: uSa, useEffect: uEa } = React;

function DeathScreen({ state, setState }) {
  const livesLeft = state.lives - 1;
  const noMore = livesLeft <= 0;
  return (
    <div className="death-screen">
      <div className="torn-page">
        <div className="sub">— You Have Fallen —</div>
        <h1>A page, torn.</h1>
        <div className="lives-glyph">
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#2a1a0c" strokeWidth="2" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#2a1a0c" strokeWidth="1.2" />
            {/* three thirds, with `state.lives - 1` remaining drawn */}
            {[0, 1, 2].map(i => {
              const a0 = -Math.PI/2 + (i * 2 * Math.PI / 3);
              const a1 = a0 + (2 * Math.PI / 3) - 0.1;
              const x0 = 50 + 38 * Math.cos(a0);
              const y0 = 50 + 38 * Math.sin(a0);
              const x1 = 50 + 38 * Math.cos(a1);
              const y1 = 50 + 38 * Math.sin(a1);
              const drawn = i < livesLeft;
              return (
                <path
                  key={i}
                  d={`M ${x0} ${y0} A 38 38 0 0 1 ${x1} ${y1}`}
                  fill="none"
                  stroke={drawn ? "#2a1a0c" : "#c9b28266"}
                  strokeWidth="3"
                  strokeDasharray={drawn ? "none" : "4 3"}
                />
              );
            })}
            {livesLeft > 0 && (
              <g>
                <path d="M50 32 L56 48 L72 48 L60 58 L64 74 L50 64 L36 74 L40 58 L28 48 L44 48 Z"
                  fill="none" stroke="#2a1a0c" strokeWidth="2" />
              </g>
            )}
          </svg>
        </div>
        <p>
          The page grows back — thin, yellowed, and <em>wanting</em>.<br/>
          One third of your glyph is missing.<br/>
          <strong>{livesLeft} {livesLeft === 1 ? "life" : "lives"} remain.</strong>
        </p>
        <div className="actions">
          {!noMore && (
            <button className="btn ink" onClick={() => {
              setState(s => ({
                ...s,
                hp: s.maxHp, mp: s.maxMp,
                lives: s.lives - 1,
                roomIndex: 0,
                currentRoomKind: s.roomSequence[0],
                visitedRooms: [0],
                screen: "dungeon",
                roomSeed: Date.now() % 97,
              }));
            }}>Respawn at Gate</button>
          )}
          {noMore && (
            <button className="btn ink" onClick={() => {
              setState(s => ({ ...s, screen: "title" }));
            }}>Return to Title</button>
          )}
          <button className="btn" onClick={() => setState(s => ({ ...s, screen: "title" }))}>Abandon Run</button>
        </div>
      </div>
    </div>
  );
}

function WinScreen({ setState }) {
  return (
    <div className="win-screen">
      <div className="inner">
        <div style={{ fontFamily: "var(--f-smallcaps)", letterSpacing: "0.5em", color: "var(--torch-1)" }}>— The Warden Falls —</div>
        <h1>Released.</h1>
        <p>Nine runes were gathered. The gate is open.</p>
        <button className="btn primary" style={{ marginTop: 20 }} onClick={() => setState(s => ({ ...s, screen: "title" }))}>Begin Again</button>
      </div>
    </div>
  );
}

/* ---------- Tweaks panel ---------- */
function TweaksPanel({ tweaks, setTweaks, open, onClose }) {
  const opt = (key, val) => {
    setTweaks(t => ({ ...t, [key]: val }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
  };
  const group = (key, options) => (
    <div className="tw-group">
      <label>{key.toUpperCase()}</label>
      <div className="tw-opts">
        {options.map(o => (
          <button key={o} className={tweaks[key] === o ? "active" : ""} onClick={() => opt(key, o)}>{o}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className={`tweaks-panel ${open ? "open" : ""}`}>
      <h3>Tweaks <span style={{ float: "right", cursor: "pointer", fontFamily: "monospace", color: "var(--parch-3)" }} onClick={onClose}>✕</span></h3>
      {group("palette", ["torchlit","deep-blue","candlelit","teal"])}
      {group("chrome", ["parchment","panel","modal"])}
      {group("glyphStyle", ["ink","chalk","rune"])}
      {group("camera", ["three-quarter","top-down","side-scroll"])}
      {group("hudDensity", ["full","minimal"])}
    </div>
  );
}

/* ---------- App ---------- */
function App() {
  const defaultSequence = ["combat","combat","merchant","boss","combat","combat","merchant","combat","combat","combat","combat","final"];
  const [state, setState] = uSa(() => {
    const saved = localStorage.getItem("dungeonRune_v1");
    if (saved) {
      try {
        const savedState = JSON.parse(saved);
        const classStats = (CLASSES[savedState.class] || CLASSES.mage).stats;
        const upgrades = savedState.upgrades || [];
        const maxHp = classStats.hp + (upgrades.includes("hp1") ? 1 : 0);
        const maxMp = classStats.magic;
        return {
          ...savedState,
          hasRunSave: savedState.hasRunSave || savedState.roomIndex > 0 || savedState.runes > 0,
          runStartedAt: Number.isFinite(savedState.runStartedAt) ? savedState.runStartedAt : Date.now(),
          potions: Array.isArray(savedState.potions) ? savedState.potions.slice(0, 4) : [],
          hp: Math.min(Number.isFinite(savedState.hp) ? savedState.hp : maxHp, maxHp),
          maxHp,
          mp: Math.min(Number.isFinite(savedState.mp) ? savedState.mp : maxMp, maxMp),
          maxMp,
        };
      } catch {}
    }
    return {
      screen: "title",
      class: "mage",
        hp: CLASSES.mage.stats.hp, maxHp: CLASSES.mage.stats.hp,
        mp: CLASSES.mage.stats.magic, maxMp: CLASSES.mage.stats.magic,
      gold: 12,
      lives: 3,
      runes: 0,
      upgrades: ["mag1"],
      potions: [],
      roomSequence: defaultSequence,
      roomIndex: 0,
      currentRoomKind: defaultSequence[0],
      visitedRooms: [0],
      roomSeed: 1,
      hasRunSave: false,
      runStartedAt: null,
    };
  });
  const [tweaks, setTweaks] = uSa(window.__TWEAKS__);
  const [tweaksOpen, setTweaksOpen] = uSa(false);
  const [menuPanel, setMenuPanel] = uSa(null);
  const [settings, setSettings] = uSa(() => {
    try { return { speedrunTimer: JSON.parse(localStorage.getItem("dungeonRune_settings") || "{}").speedrunTimer === true }; }
    catch { return { speedrunTimer: false }; }
  });

  // persist
  uEa(() => {
    localStorage.setItem("dungeonRune_v1", JSON.stringify(state));
  }, [state]);
  uEa(() => {
    localStorage.setItem("dungeonRune_settings", JSON.stringify(settings));
  }, [settings]);

  // edit mode bridge
  uEa(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === "__activate_edit_mode") setTweaksOpen(true);
      if (d.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // keyboard to reset (debug)
  uEa(() => {
    const h = (e) => {
      if (e.key === "~") { localStorage.removeItem("dungeonRune_v1"); location.reload(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="app" data-palette={tweaks.palette} data-chrome={tweaks.chrome} data-screen-label={state.screen}>
      {state.screen === "title" && (
        <>
          <TitleScreen
            canContinue={state.hasRunSave && state.hp > 0}
            onStart={() => { setMenuPanel(null); setState(s => ({ ...s, screen: "class" })); }}
            onContinue={() => {
              setMenuPanel(null);
              setState(s => s.hasRunSave && s.hp > 0 ? { ...s, screen: "dungeon" } : { ...s, screen: "class" });
            }}
            onBestiary={() => setMenuPanel("bestiary")}
            onSettings={() => setMenuPanel("settings")}
            onTutorial={() => setMenuPanel("tutorial")}
          />
          <MenuPanel panel={menuPanel} settings={settings} setSettings={setSettings} onClose={() => setMenuPanel(null)} />
        </>
      )}
      {state.screen === "class" && (
        <ClassSelect
          onConfirm={(cls) => {
            const stats = CLASSES[cls].stats;
            setState(s => ({
              ...s, class: cls, screen: "dungeon",
              hp: stats.hp, maxHp: stats.hp,
              mp: stats.magic, maxMp: stats.magic,
              gold: 12, lives: 3, runes: 0,
              upgrades: [],
              potions: [],
              roomIndex: 0, currentRoomKind: defaultSequence[0],
              visitedRooms: [0], roomSeed: Date.now() % 97,
              hasRunSave: true, runStartedAt: Date.now(),
            }));
          }}
          onBack={() => setState(s => ({ ...s, screen: "title" }))}
        />
      )}
      {state.screen === "dungeon" && (
        <Dungeon state={state} setState={setState} tweaks={tweaks} settings={settings} />
      )}
      {state.screen === "death" && <DeathScreen state={state} setState={setState} />}
      {state.screen === "win" && <WinScreen setState={setState} />}

      <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
