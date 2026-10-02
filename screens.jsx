/* global React, MageSprite, SoldierSprite, AssassinSprite, CLASSES, glyphSVG */

const { useState: useStateS, useEffect: useEffectS } = React;

/* =========================================================
   Title screen
   ========================================================= */
function TitleScreen({ onStart, onContinue, onBestiary, onSettings, onTutorial, canContinue }) {
  return (
    <div className="title-screen">
      <div className="bg-runes" />
      <div className="title-wrap">
        <div className="title-crest">
          <svg width="96" height="96" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#ff7a33" strokeWidth="1.5" opacity="0.8" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#ff7a33" strokeWidth="1" opacity="0.5" />
            <path d="M50 20 L58 44 L82 44 L63 58 L70 82 L50 68 L30 82 L37 58 L18 44 L42 44 Z"
              fill="none" stroke="#ffd47a" strokeWidth="1.5" filter="drop-shadow(0 0 6px #ff7a33)" />
          </svg>
        </div>
        <h1 className="game-title"><em>Dungeon</em><span className="ampersand">&</span><em>Rune</em></h1>
        <div className="game-subtitle">Nine Runes. One Way Out.</div>
        <div className="menu-list">
          <button className="menu-btn primary" onClick={() => onStart("class")}>Begin Descent</button>
          <button className="menu-btn" onClick={onContinue}>{canContinue ? "Continue Run" : "Continue"}</button>
          <button className="menu-btn" onClick={onBestiary}>Bestiary</button>
          <button className="menu-btn" onClick={onSettings}>Settings</button>
          <button className="menu-btn" onClick={onTutorial}>Tutorial</button>
        </div>
      </div>
      <div className="menu-foot">— v0.1 · a crawler in the dark —</div>
    </div>
  );
}

function MenuPanel({ panel, settings, setSettings, onClose }) {
  if (!panel) return null;
  const titles = { settings: "Settings", tutorial: "Tutorial", bestiary: "Bestiary" };
  return (
    <div className="menu-overlay" onClick={onClose}>
      <section className="menu-panel" onClick={e => e.stopPropagation()}>
        <button className="tome-close" onClick={onClose}>✕ close</button>
        <h2>{titles[panel]}</h2>
        {panel === "settings" && (
          <div className="settings-content">
            <label className="setting-row">
              <span><strong>Speedrun timer</strong><small>Show elapsed run time in the dungeon HUD</small></span>
              <input type="checkbox" checked={settings.speedrunTimer} onChange={e => setSettings(s => ({ ...s, speedrunTimer: e.target.checked }))} />
            </label>
            <div className="control-list"><strong>Controls</strong><span>Move: WASD or arrow keys</span><span>Left click: first spell</span><span>Right click: second spell</span><span>Ctrl / Shift / Space: remaining spells</span><span>I: tome · M: map · Esc: close panels</span></div>
          </div>
        )}
        {panel === "tutorial" && (
          <div className="menu-copy">
            <p>Choose a vessel, then clear each chamber and follow the open door north. Walk over dropped potions to restore health or mana.</p>
            <p>Gather portal runes, spend gold with the Scribe, and use your five class abilities to survive the Warden.</p>
            <p>Move with WASD or arrow keys. Aim with the mouse; cast with left click, right click, Ctrl, Shift, and Space.</p>
          </div>
        )}
        {panel === "bestiary" && (
          <div className="bestiary-list">
            <div><strong>Goblin</strong><span>Quick close-range hunter</span></div>
            <div><strong>Bone Archer</strong><span>Keeps its distance and fires arrows</span></div>
            <div><strong>Cave Brute</strong><span>Slow, durable, heavy strikes</span></div>
            <div><strong>Wraith</strong><span>Weaves around you before diving in</span></div>
            <div><strong>Hex Shaman</strong><span>Repositions and launches magic bolts</span></div>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   Class select
   ========================================================= */
function ClassSelect({ onConfirm, onBack }) {
  const [sel, setSel] = useStateS("mage");
  const Sprite = sel === "mage" ? MageSprite : sel === "soldier" ? SoldierSprite : AssassinSprite;

  return (
    <div className="class-select">
      <div>
        <h2>— Choose Thy Vessel —</h2>
        <h1>Who walks the maze?</h1>
      </div>
      <div className="class-grid">
        {Object.values(CLASSES).map(c => {
          const SpriteC = c.id === "mage" ? MageSprite : c.id === "soldier" ? SoldierSprite : AssassinSprite;
          return (
            <div
              key={c.id}
              className={`class-card ${sel === c.id ? "selected" : ""} ${!c.playable ? "locked" : ""}`}
              onClick={() => c.playable && setSel(c.id)}
            >
              {!c.playable && <div className="locked-banner"><span>Preview</span></div>}
              <div className="class-portrait">
                <SpriteC scale={6} />
                <div className="floor-glyph" />
              </div>
              <div>
                <span className="class-tag">{c.tag}</span>
                <h3 className="class-name">{c.name}</h3>
                <p className="class-desc">{c.desc}</p>
                <div className="stat-row">
                  {Object.entries(c.stats).map(([k, v]) => (
                    <div className="stat" key={k}>
                      <span>{k}</span>
                      <div className="bar"><div className="fill" style={{ width: `${(v/10)*100}%` }} /></div>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="class-actions">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <div style={{ fontFamily: "var(--f-smallcaps)", letterSpacing: "0.3em", fontSize: 11, color: "var(--parch-3)" }}>
          Each class brings a different path through the maze.
        </div>
        <button className="btn primary" onClick={() => onConfirm(sel)}>Enter the Maze →</button>
      </div>
    </div>
  );
}

Object.assign(window, { TitleScreen, ClassSelect, MenuPanel });
