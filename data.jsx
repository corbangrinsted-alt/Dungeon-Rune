/* global React */

/* =========================================================
   Game data: classes, spells, upgrades, rooms
   ========================================================= */

const CLASSES = {
  mage: {
    id: "mage",
    name: "Mage",
    tag: "Versatile · AOE · Glass",
    desc: "A cloaked figure of darkness. Eyes glow in the void of a hood. Staff drifts untouched at its side.",
    resource: "Mana",
    stats: { hp: 3, damage: 2, speed: 6, magic: 9 },
    spells: ["basic_bolt", "fireball", "thunderwave", "dash_back", "sleep"],
    playable: true,
  },
  soldier: {
    id: "soldier",
    name: "Soldier",
    tag: "Vanguard · Guard · Heavy",
    desc: "A battered frontliner who trades speed for staying power, turning mana into crushing blows and brief protection.",
    resource: "Resolve",
    stats: { hp: 6, damage: 9, speed: 3, magic: 4 },
    spells: ["basic_slash", "shield_bash", "seismic_slam", "bulwark", "charge"],
    playable: true,
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    tag: "Fast · Stealth · Fragile",
    desc: "Fast-paced, few tricks. Teleport, vanish. Deadly from the dark, meek when watched.",
    resource: "Focus",
    stats: { hp: 5, damage: 4, speed: 11, magic: 6 },
    spells: ["basic_dagger", "shadowstep", "fan_knives", "smoke_bomb", "execution"],
    playable: true,
  },
  /*raff: {
    id: "raff",
    name: "Raff",
    tag: "Fast · Stealth · Fragile",
    desc: "GOD",
    resource: "Focus",
    stats: { hp: 1000, damage: 30, speed: 12, magic: 2000 },
    spells: ["basic_dagger", "shadowstep", "fan_knives", "smoke_bomb", "execution"],
    playable: true,
  },*/
};

const SPELLS = {
  basic_bolt: { key: "leftclick", name: "Bolt", cost: 0, cd: 0.25, type: "basic", dmg: 2, range: 200, glyph: "bolt" },
  fireball:   { key: "rightclick",     name: "Fireball", cost: 1, cd: 1.1, type: "fireball", dmg: 8, range: 260, glyph: "fire" },
  thunderwave:{ key: "ctrl",     name: "Thunder", cost: 4, cd: 1.6, type: "thunder", dmg: 2, range: 90, glyph: "thunder" },
  dash_back:  { key: "shift",     name: "Dash Back", cost: 1, cd: 0.9, type: "dash", dmg: 0, range: 90, glyph: "dash" },
  sleep:      { key: "space",     name: "Sleep", cost: 2, cd: 2.2, type: "sleep", dmg: 0, range: 160, glyph: "sleep" },
  basic_slash:{ key: "leftclick", name: "Slash", cost: 0, cd: 0.55, type: "slash", dmg: 10, range: 62, glyph: "slash" },
  shield_bash: { key: "rightclick", name: "Shield Bash", cost: 2, cd: 1.8, type: "slash", dmg: 12, range: 82, glyph: "upHp" },
  seismic_slam: { key: "ctrl", name: "Seismic Slam", cost: 3, cd: 4, type: "quake", dmg: 7, range: 112, glyph: "thunder" },
  bulwark: { key: "shift", name: "Bulwark", cost: 2, cd: 6, type: "guard", dmg: 0, range: 0, glyph: "upHp" },
  charge: { key: "space", name: "Shield Charge", cost: 1, cd: 3.5, type: "charge", dmg: 8, range: 105, glyph: "dash" },
  basic_dagger:{key: "leftclick", name: "Strike", cost: 0, cd: 0.1, type: "melee", dmg: 4, range: 42, glyph: "slash" },
  shadowstep: { key: "ctrl", name: "Shadowstep", cost: 1, cd: 1.2, type: "dash", toward: true, dmg: 0, range: 90, glyph: "dash" },
  fan_knives: { key: "rightclick", name: "Fan of Knives", cost: 2, cd: 2.2, type: "fan", dmg: 4, range: 240, glyph: "slash" },
  smoke_bomb: { key: "shift", name: "Smoke Bomb", cost: 2, cd: 4, type: "smoke", dmg: 0, range: 130, glyph: "sleep" },
  execution: { key: "space", name: "Execution", cost: 3, cd: 4.5, type: "melee", dmg: 12, range: 58, glyph: "fire" },
  basicatk:{ key: "Space", name: "atk", cost: 0, cd: 0.01, type: "slash", dmg: 30, range: 62, glyph: "slash" },
};

/* upgrade slots in the tome */
const UPGRADES = [
  { id: "dmg1",  attr: "damage",   label: "Kindling",     amt: 1, glyph: "upDmg" },
  { id: "rng1",  attr: "range",    label: "Far Reach",    amt: 40, glyph: "upRng" },
  { id: "spd1",  attr: "speed",    label: "Quick Foot",   amt: 1, glyph: "upSpd" },
  { id: "mag1",  attr: "magic",    label: "Deep Well",    amt: 2, glyph: "upMag" },
  { id: "hp1",   attr: "hp",       label: "Thick Hide",   amt: 1, glyph: "upHp" },
  { id: "crit1", attr: "crit",     label: "Keen Eye",     amt: 10, glyph: "upCrit" },
];

/* glyph SVG primitives used on the floor when casting & in tome/shop */
function glyphSVG(kind, className = "") {
  const common = { width: "100%", height: "100%", viewBox: "0 0 100 100" };
  switch (kind) {
    case "bolt":
      return (
        <svg {...common} className={className}>
          <circle cx="50" cy="50" r="34" className="draw" />
          <path d="M38 38 L62 62 M62 38 L38 62" className="draw" />
        </svg>
      );
    case "fire":
      return (
        <svg {...common} className={className}>
          <circle cx="50" cy="50" r="38" className="draw" />
          <circle cx="50" cy="50" r="28" className="draw" />
          <path d="M50 20 L58 40 L70 30 L62 52 L80 50 L60 62 L72 80 L50 66 L28 80 L40 62 L20 50 L38 52 L30 30 L42 40 Z" className="draw" />
        </svg>
      );
    case "thunder":
      return (
        <svg {...common} className={className}>
          <circle cx="50" cy="50" r="40" className="draw" />
          <path d="M50 18 L40 52 L52 52 L44 82 L62 46 L50 46 L60 18 Z" className="draw" />
        </svg>
      );
    case "dash":
      return (
        <svg {...common} className={className}>
          <circle cx="50" cy="50" r="34" className="draw" />
          <path d="M30 50 L55 50 L45 40 M55 50 L45 60" className="draw" />
          <path d="M65 30 L75 30 M70 25 L70 35" className="draw" />
        </svg>
      );
    case "sleep":
      return (
        <svg {...common} className={className}>
          <circle cx="50" cy="50" r="36" className="draw" />
          <path d="M35 40 Q50 30 65 40 Q50 50 35 50 Q50 50 65 60" className="draw" />
          <text x="50" y="66" fontFamily="serif" fontSize="20" fill="currentColor" stroke="none" textAnchor="middle" fontStyle="italic">Z</text>
        </svg>
      );
    case "slash":
      return (
        <svg {...common} className={className}>
          <path d="M20 70 Q50 20 80 30" className="draw" />
          <path d="M25 72 L78 28" className="draw" />
        </svg>
      );
    case "upDmg":
      return (
        <svg {...common}>
          <path d="M50 20 L70 80 L50 68 L30 80 Z" />
          <line x1="50" y1="28" x2="50" y2="68" />
        </svg>
      );
    case "upRng":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="10" />
          <path d="M15 50 L85 50 M78 45 L85 50 L78 55" />
          <path d="M60 30 L78 50 L60 70" />
        </svg>
      );
    case "upSpd":
      return (
        <svg {...common}>
          <path d="M20 60 L50 20 L45 45 L70 40 L40 80 L50 55 L25 60 Z" />
        </svg>
      );
    case "upMag":
      return (
        <svg {...common}>
          <path d="M50 20 L62 42 L85 44 L66 60 L72 82 L50 70 L28 82 L34 60 L15 44 L38 42 Z" />
          <circle cx="50" cy="55" r="6" />
        </svg>
      );
    case "upHp":
      return (
        <svg {...common}>
          <path d="M50 78 C 15 50 25 20 50 38 C 75 20 85 50 50 78 Z" />
        </svg>
      );
    case "upCrit":
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="30" />
          <circle cx="50" cy="50" r="14" />
          <circle cx="50" cy="50" r="3" />
          <line x1="20" y1="50" x2="35" y2="50" />
          <line x1="65" y1="50" x2="80" y2="50" />
          <line x1="50" y1="20" x2="50" y2="35" />
          <line x1="50" y1="65" x2="50" y2="80" />
        </svg>
      );
    default: return null;
  }
}

/* map layout: a connected route through a 7x5 grid */
const MAP_W = 7, MAP_H = 5;
const MAP_PATH = [[3,4],[3,3],[2,3],[2,2],[3,2],[4,2],[4,1],[5,1],[5,0],[4,0],[3,0],[2,0]];
function generateMap(sequence = []) {
  const cells = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  MAP_PATH.forEach(([x, y], index) => {
    if (sequence[index]) cells[y][x] = { type: sequence[index], index };
  });
  return cells;
}

Object.assign(window, { CLASSES, SPELLS, UPGRADES, glyphSVG, generateMap, MAP_PATH, MAP_W, MAP_H });
