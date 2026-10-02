/* global React */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* =========================================================
   Pixel sprite renderer
   Each sprite is a tiny palette-indexed grid, rendered to SVG <rect>s
   Palettes use named keys; data grids use single-char palette indices.
   ========================================================= */

const PIXEL = 1; // logical unit in the sprite-local coordinate system

function pixelsToSvg(grid, palette, { scale = 1, idleBob = false } = {}) {
  const h = grid.length;
  const w = Math.max(...grid.map(row => row.length));
  const rects = [];
  for (let y = 0; y < h; y++) {
    const row = grid[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const color = palette[ch];
      if (!color) continue;
      rects.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} shapeRendering="crispEdges" />
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w * scale} height={h * scale} style={{ imageRendering: "pixelated", display: "block" }}>
      <g className={idleBob ? "idle-bob" : ""}>{rects}</g>
    </svg>
  );
}

/* ---------- MAGE (from reference image, remade original) ---------- */
// 16 wide x 20 tall. Cloaked, glowing orange eyes, purple gem clasp, rust-purple cloak.
const MAGE_PALETTE = {
  a: "#3b2c47", // cloak dark
  b: "#564069", // cloak mid
  c: "#6e5282", // cloak light edge
  d: "#1a1320", // void/interior
  e: "#ff7a33", // eye glow
  f: "#ffd47a", // eye highlight
  g: "#8a4bd1", // gem
  h: "#b77ce8", // gem light
  i: "#2a1f36", // shadow
  s: "#0c0915", // outline
};
const MAGE = [
  "....ssssssss....",
  "...sbbbbbbbbs...",
  "..sbccbbccbbbs..",
  ".sbcbaaaaaacbbs.",
  ".sbaadddddaabcs.",
  ".sbadeddeddabcs.",
  ".sbadefdefdabcs.",
  ".sbaddddddcabcs.",
  ".sbaaabbbaaabcs.",
  ".sbcaabbaabcbbs.",
  ".sbcbaghabcbbbs.",
  ".sbbcaghhacbbbs.",
  ".sbbbaaaaabbbcs.",
  ".sbcbbiibbccbbs.",
  ".sbccbbiiibcbbs.",
  ".sbbcbcbiicbbbs.",
  ".sbbbcbbcbbbbcs.",
  ".sbbcbbbcbbbbbs.",
  "..sbbcbbcbbbbs..",
  "...ssssssssss...",
];

/* ---------- SOLDIER ---------- */
// Heavily armored bulky knight, worn & rusted plate, horned helm,
// glowing eye slit, oversized greatsword across the body.
const SOLDIER_PALETTE = {
  a: "#1c1a17", // deep shadow inside armor
  b: "#2e2a24", // armor darkest
  c: "#443d33", // armor dark
  d: "#5e5448", // armor mid
  e: "#7a6d5a", // armor highlight
  f: "#8a3a18", // rust
  g: "#c06a2a", // bright rust / oxidation
  h: "#ff7a33", // eye glow
  i: "#ffd47a", // eye core
  j: "#9a8a6a", // blade mid
  k: "#cfc2a4", // blade highlight
  l: "#3a2a1a", // leather grip
  m: "#cfa34a", // gold trim
  s: "#070504",
};
// 18 wide x 22 tall — bulkier frame than mage
const SOLDIER = [
  "..ssssssssssssss..",
  ".sbbcccccccccbbs..",
  ".sbcdddcfgfcdddbs.",
  ".sbcdeedffeeedbs..",
  "sbcddccfggfccddbs.",
  "sbcdcaaaaaaaacdbs.",
  "sbcdcahhiiihacdbs.",
  "sbcdcahiaaihacdbs.",
  "sbcdcahhiiihacdbs.",
  "sbcdccaaaaaaccdbs.",
  "sbcdcccmmmmcccdbskk",
  "sbcddddmmmmdddcbskj",
  ".sbbcdffffddcbbbsjk",
  ".sbcdgfffgfdcbbbsjj",
  ".sbcdfgfgfgdcbbbslj",
  ".sbcdcffffcdcbbbsjk",
  ".sbcdddmmdddcbbbsjj",
  ".sbccdddmdddccbbsjk",
  ".sbccddsssdcbbbsjj.",
  ".sbbccssssscbbbsjk.",
  ".ssbbss..ssbbbssjk.",
  "..ssss....sssss.ss.",
];

/* ---------- ASSASSIN ---------- */
const ASSASSIN_PALETTE = {
  a: "#1a1e2a", // hood dark
  b: "#2c3142", // hood mid
  c: "#3d4459", // hood light
  d: "#141722", // void
  e: "#c94444", // red eye slit
  f: "#d9d1b8", // skin
  g: "#6a523a", // leather
  s: "#05070b",
};
const ASSASSIN = [
  "....ssssss......",
  "...sbbccbbs.....",
  "..sbbccccbbs....",
  ".sbccaddacbbs...",
  ".sbcadeeeeads...",
  ".sbadffffdabs...",
  ".sbaddfffdabs...",
  ".sbbadddddabs...",
  ".sbbaaggaabbs...",
  ".sbbaggbgabbs...",
  ".sbbagggggabs...",
  ".sbbaggbggabs...",
  ".sbbagggggabs...",
  ".sbbaggbggabs...",
  ".sbbbaaaaabbs...",
  ".sbbaabbabbs....",
  ".sbbaabb.abbs...",
  ".sbaabs..sabs...",
  ".ssabs....sabs..",
  "..ss.......ss...",
];
/* ---------- RAFF ---------- */
const raff_PALETTE = {
  a: "#1a1e2a", // hood dark
  b: "#2c3142", // hood mid
  c: "#3d4459", // hood light
  d: "#141722", // void
  e: "#c94444", // red eye slit
  f: "#d9d1b8", // skin
  g: "#6a523a", // leather
  s: "#05070b",
};
const raff = [
  "....ssssss......",
  "...sbbccbbs.....",
  "..sbbccccbbs....",
  ".sbccaddacbbs...",
  ".sbcadeeeeads...",
  ".sbadffffdabs...",
  ".sbaddfffdabs...",
  ".sbbadddddabs...",
  ".sbbaaggaabbs...",
  ".sbbaggbgabbs...",
  ".sbbagggggabs...",
  ".sbbaggbggabs...",
  ".sbbagggggabs...",
  ".sbbaggbggabs...",
  ".sbbbaaaaabbs...",
  ".sbbaabbabbs....",
  ".sbbaabb.abbs...",
  ".sbaabs..sabs...",
  ".ssabs....sabs..",
  "..ss.......ss...",
];

/* ---------- GOBLIN ---------- */
const GOBLIN_PALETTE = {
  a: "#3d5e1f", // dark green
  b: "#5c8a2f", // mid green
  c: "#78a842", // light green
  d: "#2a1812", // leather
  e: "#8a3a22", // club
  f: "#f3c34a", // eye
  g: "#1a1010", // mouth
  s: "#08100a",
};
const GOBLIN = [
  "...ss...........",
  "..sbbs..........",
  ".sbccbs.........",
  "sbccccbs........",
  "sbcaafcbs.......",
  "sbcfgafcbs......",
  "sbcagggacbs.....",
  "sbbcaaaacbs.....",
  "sbbcaabbabs.eee.",
  "sbbaabbbbs.eees.",
  "ssabbaabss.eess.",
  "..ssbbsss..ees..",
  "...sabs....ees..",
  "...sabs....es...",
  "...ssss....s....",
  "................",
];

/* ---------- BONE ARCHER ---------- */
const ARCHER_PALETTE = {
  a: "#d7cbaa", b: "#a99b79", c: "#66583f", d: "#5b3926",
  e: "#a87943", f: "#8bd8ed", s: "#12100c",
};
const ARCHER = [
  "......ssss......",
  ".....sbbbbss....",
  "....sbaaaabbs...",
  "....sacaaacbs...",
  ".....sbbfbbbs...",
  "......sbbbs.....",
  ".....sbaabbs....",
  "....sbbccbbbs...",
  "...sbbd..dbbbs..",
  "...sbbd..dbbbs..",
  "....sbd..dbbs...",
  "....sbd..dbbs...",
  "...sbbd..dbbbs..",
  "..sbbb......s...",
  ".sbb..........s.",
  "................",
];

/* ---------- CAVE BRUTE ---------- */
const BRUTE_PALETTE = {
  a: "#3b4435", b: "#59684a", c: "#839065", d: "#2c241d",
  e: "#8b4e2c", f: "#e8b25c", s: "#10130f",
};
const BRUTE = [
  "....ssssssss....",
  "...sbbbbbbbbbs...",
  "..sbbcccbbcccbs..",
  ".sbbccffbccffccbs.",
  "sbbccbbbbbbbbccbs",
  "sbbbcdddddddcbbbs",
  "sbbddbbbbbbddbbbs",
  "sbcbbbbbbbbbbcbbs",
  "sbcbeebbbbbbeebbs",
  ".sbbbeebbbbeebbs..",
  ".sbbbbbbbbbbbbbs..",
  "..sbbbbbddbbbbbs...",
  "..sbbbbd..dbbbbs...",
  ".sbbbdd....ddbbbs..",
  ".sbbbs......sbbbs..",
  "..sss........sss...",
];

/* ---------- MERCHANT ---------- */
const MERCHANT_PALETTE = {
  a: "#4a2f1a",
  b: "#6a4428",
  c: "#8a5c3a",
  d: "#d9c18c",
  e: "#c99a4a",
  f: "#f3c34a", // gold
  g: "#1a1010",
  s: "#08100a",
};
const MERCHANT = [
  "...sssss........",
  "..saaabbs.......",
  ".sabbcbbas......",
  ".sabdddbas......",
  ".sadgdgdas......",
  ".sadddddds......",
  ".sadcccdas......",
  ".sabcccbbs......",
  "sabbeebbbbs.....",
  "sabeeeeebbs.....",
  "sabbbbbbbbs.....",
  "sabbffffbbs.....",
  "sabfbbbbfbs.....",
  "sabfbbbbfbs.....",
  ".sabbbbbba......",
  ".sabbs.sbba.....",
  ".sabs..sabs.....",
  "..ss....ss......",
  "................",
  "................",
];

/* ---------- BOSS (big dark wraith) ---------- */
const BOSS_PALETTE = {
  a: "#1a0a24",
  b: "#2d1540",
  c: "#3f1f5c",
  d: "#582a80",
  e: "#7a3faa",
  f: "#ff4a1f", // eye
  g: "#ffd47a",
  h: "#8a4bd1",
  i: "#b77ce8",
  s: "#04020a",
};
const BOSS = [
  "......sssssssssss......",
  ".....sbbbbbbbbbbbs.....",
  "....sbcccbbbcccbbs.....",
  "...sbccdddcddccbbbs....",
  "..sbccdeeeddedccbbbs...",
  "..sbcddefefedddcbbbs...",
  ".sbbcdddfdfdddcbbbbs...",
  ".sbbccdddddddcbbcbbbs..",
  ".sbbbccccccccbbbcbbbs..",
  ".sbcbbcbbbbbbccbbbbbs..",
  ".sbcbcbhhiihbbbbbbbbs..",
  ".sbbbbbhiihhbbbcbbbbs..",
  ".sbbcbbbhihbbbcbcbbbs..",
  ".sbbccbbbhbbbbbcbbbbs..",
  ".sbbbcbbbbbbbccbbbbbs..",
  ".sbbbbbbcbbbbccbbbbbs..",
  ".sbcbbbbbcbbbccbbbcbs..",
  ".sbbbcbbbbbbcbbbbcbbs..",
  ".sbbccbbcbbbbccbbbbbs..",
  "..sbbbcbbbbbbcbbbbbs...",
  "..sbbbbbbbcbbbbbbbbs...",
  "...sbbbbbbbbbbbbbbs....",
  "....sbbbbbbbbbbbbs.....",
  ".....sbbbbbbbbbs.......",
];

/* ---------- THE WARDEN ---------- */
const WARDEN_PALETTE = {
  a: "#21151b", b: "#38222a", c: "#59404a", d: "#7c2930",
  e: "#ad6633", f: "#f3c34a", g: "#d9cbaa", s: "#09070a",
};
const WARDEN = [
  "........f.f.f........",
  ".......sbbbbbbbs......",
  "......sbbccccbbs......",
  ".....sbbccfccbbbs.....",
  "....sbbccgggccbbbs....",
  "....sbbccgggccbbbs....",
  "...sbbcbbbbbbbcbbbs...",
  "..sbbccddbbbbddccbbs..",
  ".sbbbcddddddddccbbbbs.",
  "sbbbccddffddffddccbbbs",
  "sbbccbbddddddddbbccbbs",
  "sbbccbbceeeeee cbbccbbs",
  "sbbbcceeeeeeeeccbbbbs",
  ".sbbccbbbbbbbbccbbbs..",
  "..sbbccbbddbbccbbbs...",
  "...sbbccbbbbccbbbs....",
  "...sbbdccccccdbbbs....",
  "..sbbddbbbbbbddbbbs...",
  ".sbbbs..sbbbs..sbbbs..",
  "..sss....sss....sss...",
];

/* ---------- Exports ---------- */
function MageSprite({ scale = 2, bob = true }) {
  return pixelsToSvg(MAGE, MAGE_PALETTE, { scale, idleBob: bob });
}
function SoldierSprite({ scale = 2, bob = true }) {
  return pixelsToSvg(SOLDIER, SOLDIER_PALETTE, { scale, idleBob: bob });
}
function AssassinSprite({ scale = 2, bob = true }) {
  return pixelsToSvg(ASSASSIN, ASSASSIN_PALETTE, { scale, idleBob: bob });
}
function GoblinSprite({ scale = 1 }) {
  return pixelsToSvg(GOBLIN, GOBLIN_PALETTE, { scale });
}
function BoneArcherSprite({ scale = 1 }) {
  return pixelsToSvg(ARCHER, ARCHER_PALETTE, { scale });
}
function BruteSprite({ scale = 1 }) {
  return pixelsToSvg(BRUTE, BRUTE_PALETTE, { scale });
}
function MerchantSprite({ scale = 1.5 }) {
  return pixelsToSvg(MERCHANT, MERCHANT_PALETTE, { scale });
}
function BossSprite({ scale = 2 }) {
  return pixelsToSvg(BOSS, BOSS_PALETTE, { scale });
}
function WardenSprite({ scale = 2 }) {
  return pixelsToSvg(WARDEN, WARDEN_PALETTE, { scale });
}

/* heart / rune icons */
function RuneIcon({ glow = true, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path d="M10 2 L17 7 L14 17 L6 17 L3 7 Z" fill="none" stroke="#8a4bd1" strokeWidth="1.5"
        filter={glow ? "drop-shadow(0 0 3px #8a4bd1)" : "none"} />
      <circle cx="10" cy="10" r="2" fill="#b77ce8" />
    </svg>
  );
}

/* CSS for idle bob, injected once */
if (!document.getElementById("sprite-anim-style")) {
  const s = document.createElement("style");
  s.id = "sprite-anim-style";
  s.textContent = `
    @keyframes idleBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    .idle-bob { animation: idleBob 1.8s ease-in-out infinite; transform-origin: center bottom; }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  MageSprite, SoldierSprite, AssassinSprite,
  GoblinSprite, BoneArcherSprite, BruteSprite, MerchantSprite, BossSprite, WardenSprite,
  RuneIcon,
});
