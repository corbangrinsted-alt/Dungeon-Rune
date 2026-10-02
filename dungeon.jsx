/* global React, MageSprite, SoldierSprite, AssassinSprite, GoblinSprite, BoneArcherSprite, BruteSprite, MerchantSprite, BossSprite, WardenSprite, CLASSES, SPELLS, UPGRADES, glyphSVG, RuneIcon, generateMap, MAP_PATH, MAP_W, MAP_H */

const { useState: uS, useEffect: uE, useRef: uR, useCallback: uC, useMemo: uM } = React;

/* =========================================================
   Dungeon room: movement, combat, spells, projectiles, glyphs
   ========================================================= */

const ROOM_W = 768;
const ROOM_H = 512;
const PLAYER_R = 14;
const WALL_PAD = 24;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(a, b) { const dx = a.x-b.x, dy = a.y-b.y; return Math.hypot(dx, dy); }
function enemySeparation(enemy, enemies) {
  let x = 0, y = 0;
  for (const other of enemies) {
    if (other === enemy || other.hp <= 0) continue;
    const dx = enemy.x - other.x, dy = enemy.y - other.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0 && distance < 52) {
      const weight = (52 - distance) / 52;
      x += (dx / distance) * weight;
      y += (dy / distance) * weight;
    }
  }
  return { x, y };
}
function formatRunTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function makeRoom(kind, seed = 1, floorIndex = 0) {
  if (kind === "merchant") {
    return { kind: "merchant", enemies: [], merchant: { x: ROOM_W/2, y: ROOM_H/2 - 40 } };
  }
  if (kind === "boss") {
    return { kind: "boss", enemies: [], pickups: [], boss: { id: "b1", x: ROOM_W/2, y: 160, hp: 180, maxHp: 180, r: 24, attackCd: 0.8, speed: 38, burstCd: 1.8, moveT: 0, phase: 1 } };
  }
  if (kind === "final") {
    return { kind: "final", enemies: [], pickups: [], boss: { id: "final", x: ROOM_W/2, y: 160, hp: 480, maxHp: 480, r: 28, attackCd: 0.8, speed: 46, burstCd: 2, moveT: 0, phase: 1 } };
  }
  const difficulty = clamp(floorIndex, 0, 11);
  const n = 6 + Math.min(3, Math.floor(difficulty / 2));
  const healthScale = 1 + Math.floor(difficulty / 3) * 0.12;
  const speedScale = 1 + Math.floor(difficulty / 4) * 0.07;
  const damageBonus = difficulty >= 9 ? 1 : 0;
  // A stable mix ensures each combat room introduces a varied enemy roster.
  const enemies = [];
  for (let i = 0; i < n; i++) {
    const type = ["goblin", "archer", "brute", "wraith", "shaman"][(i + seed) % 5];
    const baseStats = {
      goblin: { hp: 10, maxHp: 10, r: 10, speed: 48, damage: 1 },
      archer: { hp: 7, maxHp: 7, r: 10, speed: 38, damage: 1 },
      brute: { hp: 18, maxHp: 18, r: 15, speed: 28, damage: 2 },
      wraith: { hp: 9, maxHp: 9, r: 11, speed: 42, damage: 1 },
      shaman: { hp: 12, maxHp: 12, r: 11, speed: 26, damage: 1 },
    }[type];
    const maxHp = Math.ceil(baseStats.maxHp * healthScale);
    const stats = { ...baseStats, hp: maxHp, maxHp, speed: Math.round(baseStats.speed * speedScale), damage: baseStats.damage + damageBonus };
    const x = 120 + (i * 150) % (ROOM_W - 240);
    const y = 120 + ((i*i*73) % (ROOM_H - 240));
    enemies.push({
      id: `${type}-${i}-${seed}`,
      type, x, y, ...stats, attackCd: 0.8 + (i % 3) * 0.3,
      decisionT: 0.3 + ((i * 13 + seed) % 9) / 10,
      orbit: (i + seed) % 2 ? 1 : -1,
    });
  }
  const decor = Array.from({ length: 12 }, (_, i) => ({
    x: 54 + ((i * 137 + seed * 23) % (ROOM_W - 108)),
    y: 62 + ((i * 83 + seed * 31) % (ROOM_H - 124)),
    size: 3 + ((i + seed) % 5),
    rotate: (i * 37 + seed * 11) % 180,
  }));
  return { kind: "combat", enemies, pickups: [], decor };
}

/* ---------- Dungeon component ---------- */
function Dungeon({ state, setState, tweaks, settings }) {
  const classData = CLASSES[state.class] || CLASSES.mage;
  const classSpells = classData.spells;
  const roomRef = uR(null);
  const keys = uR({}); 
  const gamepadButtonsRef = uR([]);
  const [, force] = uS(0);
  const raf = uR(null);
  const last = uR(performance.now());
  const playerRef = uR({ x: ROOM_W/2, y: ROOM_H - 80, vx: 0, vy: 0, facing: 1 });
  const aimRef = uR({ x: ROOM_W/2 + 80, y: ROOM_H - 80 });
  const aimDirectionRef = uR({ x: 1, y: 0 });
  const roomElRef = uR(null);
  const projectilesRef = uR([]);
  const glyphsRef = uR([]);
  const dmgNumsRef = uR([]);
  const cooldownsRef = uR({});
  const roomRef2 = uR(makeRoom(state.currentRoomKind || "combat", state.roomSeed || 1, state.roomIndex));
  const [hurtFlash, setHurtFlash] = uS(0);
  const [tomeOpen, setTomeOpen] = uS(false);
  const [mapOpen, setMapOpen] = uS(false);
  const [merchantOpen, setMerchantOpen] = uS(false);
  const [bossBanner, setBossBanner] = uS(null);
  const [toast, setToast] = uS(null);

  // reset room on change
  uE(() => {
    roomRef2.current = makeRoom(state.currentRoomKind || "combat", state.roomSeed || 1, state.roomIndex);
    playerRef.current.x = ROOM_W/2;
    playerRef.current.y = ROOM_H - 80;
    projectilesRef.current = [];
    glyphsRef.current = [];
    if (state.currentRoomKind === "boss" || state.currentRoomKind === "final") {
      setBossBanner(state.currentRoomKind === "final" ? "The Warden" : "Shade of the Tenth");
      setTimeout(() => setBossBanner(null), 2500);
    }
    if (state.currentRoomKind === "merchant") {
      setTimeout(() => setMerchantOpen(true), 400);
    }
  }, [state.currentRoomKind, state.roomSeed, state.roomIndex]);

  const showToast = uC((txt) => {
    setToast(txt);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const usePotion = uC((index) => {
    const potion = (state.potions || [])[index];
    if (!potion) return;
    if (potion === "health" && state.hp >= state.maxHp) { showToast("Health is already full"); return; }
    if (potion === "mana" && state.mp >= state.maxMp) { showToast("Mana is already full"); return; }
    setState(s => {
      const potions = [...(s.potions || [])];
      if (!potions[index]) return s;
      potions.splice(index, 1);
      return {
        ...s,
        potions,
        hp: potion === "health" ? Math.min(s.maxHp, s.hp + 2) : s.hp,
        mp: potion === "mana" ? Math.min(s.maxMp, s.mp + 3) : s.mp,
      };
    });
    showToast(potion === "health" ? "+2 Health" : "+3 Mana");
  }, [state, setState, showToast]);

  const nextRoom = uC((advance = true) => {
    const seq = state.roomSequence;
    const idx = state.roomIndex + 1;
    if (idx >= seq.length) {
      setState(s => ({ ...s, runes: Math.min(9, s.runes + (s.currentRoomKind === "merchant" ? 0 : 1)), screen: "win" }));
      return;
    }
    const nextKind = seq[idx];
    setState(s => {
      const visited = new Set(s.visitedRooms);
      visited.add(idx);
      const runes = s.runes;
      return {
        ...s,
        roomIndex: idx,
        currentRoomKind: nextKind,
        roomSeed: idx * 17 + 3,
        visitedRooms: Array.from(visited),
        runes: Math.min(9, runes + (state.currentRoomKind === "merchant" ? 0 : 1)),
        mp: Math.min(s.maxMp, s.mp + 2),
      };
    });
  }, [state, setState]);

  const defeatBoss = uC((room) => {
    if (room.bossDefeatQueued) return;
    room.bossDefeatQueued = true;
    showToast("Portal Rune acquired ✦");
    setTimeout(() => nextRoom(true), 600);
  }, [nextRoom, showToast]);

  const hitEnemy = uC((room, enemy, damage) => {
    if (enemy.hp <= 0) return;
    enemy.hp = Math.max(0, enemy.hp - damage);
    dmgNumsRef.current.push({ id: Math.random().toString(36).slice(2), x: enemy.x, y: enemy.y - 20, v: damage, t: 0 });
    if (enemy.hp > 0) return;
    if (enemy === room.boss) {
      defeatBoss(room);
      return;
    }
    setState(s => ({ ...s, gold: s.gold + 3 }));
    const dropRoll = Math.random();
    if (dropRoll < 0.52) {
      room.pickups = room.pickups || [];
      room.pickups.push({
        id: Math.random().toString(36).slice(2),
        kind: dropRoll < 0.24 ? "health" : "mana",
        x: enemy.x, y: enemy.y, t: 0,
      });
    }
  }, [defeatBoss, setState]);

  const castSpell = uC((spellId) => {
    const spell = SPELLS[spellId];
    if (!spell) return;
    const cd = cooldownsRef.current[spellId] || 0;
    if (cd > 0) return;
    if (state.mp < spell.cost) { showToast("Not enough mana"); return; }
    cooldownsRef.current[spellId] = spell.cd;
    if (spell.cost > 0) setState(s => ({ ...s, mp: s.mp - spell.cost }));

    const p = playerRef.current;
    const { x: ax, y: ay } = aimDirectionRef.current;
    p.facing = ax < 0 ? -1 : 1;

    // add glyph drawing
    glyphsRef.current.push({
      id: Math.random().toString(36).slice(2),
      kind: spell.glyph, x: p.x, y: p.y + 6, t: 0, ttl: 1.3,
    });

    if (spell.type === "fireball") {
      projectilesRef.current.push({
        id: Math.random().toString(36).slice(2),
        kind: "fireball",
        x: p.x, y: p.y - 10, vx: 260 * ax, vy: 260 * ay,
        dmg: spell.dmg + (state.upgrades.find(u => u === "dmg1") ? 2 : 0),
        life: 1.2, r: 10, aoe: true,
      });
    } else if (spell.type === "thunder") {
      // AOE burst around player
      projectilesRef.current.push({
        id: Math.random().toString(36).slice(2),
        kind: "thunder",
        x: p.x, y: p.y - 8, vx: 0, vy: 0,
        dmg: spell.dmg, life: 3, r: 100, aoe: true,
      });
    } else if (spell.type === "dash") {
      const direction = spell.toward ? 1 : -1;
      p.x = clamp(p.x + ax * 120 * direction, WALL_PAD, ROOM_W - WALL_PAD);
      p.y = clamp(p.y + ay * 120 * direction, WALL_PAD + 24, ROOM_H - WALL_PAD);
    } else if (spell.type === "sleep") {
      // sleep all enemies in range
      roomRef2.current.enemies.forEach(e => {
        if (dist(e, p) < spell.range) { e.sleepT = 3.5; }
      });
    } else if (spell.type === "basic") {
      projectilesRef.current.push({
        id: Math.random().toString(36).slice(2),
        kind: "basic",
        x: p.x, y: p.y - 10, vx: 420 * ax, vy: 420 * ay,
        dmg: spell.dmg, life: 0.6, r: 6,
      });
    } else if (spell.type === "fan") {
      const angle = Math.atan2(ay, ax);
      [-0.28, 0, 0.28].forEach(offset => {
        const shotAngle = angle + offset;
        projectilesRef.current.push({
          id: Math.random().toString(36).slice(2), kind: "basic",
          x: p.x, y: p.y - 10, vx: Math.cos(shotAngle) * 360, vy: Math.sin(shotAngle) * 360,
          dmg: spell.dmg, life: 0.7, r: 5,
        });
      });
    } else if (spell.type === "smoke") {
      roomRef2.current.enemies.forEach(enemy => {
        if (dist(enemy, p) < spell.range) enemy.sleepT = 2.5;
      });
      p.guardT = Math.max(p.guardT || 0, 1.5);
    } else if (spell.type === "guard") {
      p.guardT = Math.max(p.guardT || 0, 3.5);
      showToast("Bulwark raised");
    } else if (spell.type === "quake") {
      const room = roomRef2.current;
      room.enemies.concat(room.boss ? [room.boss] : []).forEach(enemy => {
        if (dist(enemy, p) <= spell.range) {
          hitEnemy(room, enemy, spell.dmg + (state.upgrades.includes("dmg1") ? 1 : 0));
          if (enemy.hp > 0 && enemy !== room.boss) enemy.sleepT = 0.6;
        }
      });
    } else if (spell.type === "charge") {
      p.x = clamp(p.x + ax * 145, WALL_PAD, ROOM_W - WALL_PAD);
      p.y = clamp(p.y + ay * 145, WALL_PAD + 24, ROOM_H - WALL_PAD);
      const room = roomRef2.current;
      room.enemies.concat(room.boss ? [room.boss] : []).forEach(enemy => {
        if (dist(enemy, p) < (enemy.r || 10) + 24) {
          hitEnemy(room, enemy, spell.dmg + (state.upgrades.includes("dmg1") ? 1 : 0));
        }
      });
    } else if (spell.type === "slash" || spell.type === "melee") {
      p.attackT = 0.22;
      p.attackAngle = Math.atan2(ay, ax);
      const cx = p.x + ax * 28;
      const cy = (p.y - 10) + ay * 28;
      glyphsRef.current.push({
        id: Math.random().toString(36).slice(2),
        kind: "slash", x: cx, y: cy, t: 0, ttl: 0.28,
      });
      const room = roomRef2.current;
      const targets = room.enemies.concat(room.boss ? [room.boss] : []);
      for (const e of targets) {
        if (e.hp <= 0) continue;
        const dx2 = e.x - p.x, dy2 = e.y - (p.y - 10);
        const targetRadius = e.r || 10;
        const forward = dx2 * ax + dy2 * ay;
        const lateral = Math.abs(dx2 * ay - dy2 * ax);
        if (forward < -targetRadius * 0.4 || forward > spell.range + targetRadius) continue;
        if (lateral > 22 + targetRadius) continue;
        const dmg = spell.dmg + (state.upgrades.includes("dmg1") ? 1 : 0);
        // knockback
        e.x = clamp(e.x + ax * 14, WALL_PAD, ROOM_W - WALL_PAD);
        e.y = clamp(e.y + ay * 14, WALL_PAD + 24, ROOM_H - WALL_PAD);
        hitEnemy(room, e, dmg);
      }
    }
  }, [state, setState, showToast, hitEnemy]);

  // loop
  uE(() => {
    const onKey = (e) => {
      keys.current[e.key.toLowerCase()] = true;
      if (!e.repeat) {
        const key = e.key === " " ? "space" : e.key.toLowerCase() === "control" ? "ctrl" : e.key.toLowerCase();
        const spellId = classSpells.find(id => SPELLS[id].key === key);
        if (spellId) {
          if (key === "space") e.preventDefault();
          castSpell(spellId);
        }
        if (["1", "2", "3", "4"].includes(e.key)) usePotion(Number(e.key) - 1);
      }
      if (e.key.toLowerCase() === "i") setTomeOpen(v => !v);
      if (e.key.toLowerCase() === "m") setMapOpen(v => !v);
      if (e.key === "Escape") { setTomeOpen(false); setMapOpen(false); setMerchantOpen(false); }
    };
    const onKeyUp = (e) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      const paused = tomeOpen || mapOpen || merchantOpen;
      if (!paused) {
        const p = playerRef.current;
        let controllerX = 0, controllerY = 0;
        const pads = typeof navigator.getGamepads === "function" ? Array.from(navigator.getGamepads() || []) : [];
        const gamepad = pads.find(Boolean);
        if (gamepad) {
          const previousButtons = gamepadButtonsRef.current;
          const pressedButtons = gamepad.buttons.map(button => Boolean(button.pressed));
          [2, 0, 3, 1, 4].forEach((buttonIndex, spellIndex) => {
            if (pressedButtons[buttonIndex] && !previousButtons[buttonIndex] && classSpells[spellIndex]) {
              castSpell(classSpells[spellIndex]);
            }
          });
          [12, 13, 14, 15].forEach((buttonIndex, potionIndex) => {
            if (pressedButtons[buttonIndex] && !previousButtons[buttonIndex]) usePotion(potionIndex);
          });
          controllerX = Math.abs(gamepad.axes[0] || 0) > 0.18 ? gamepad.axes[0] : 0;
          controllerY = Math.abs(gamepad.axes[1] || 0) > 0.18 ? gamepad.axes[1] : 0;
          const aimX = gamepad.axes[2] || 0, aimY = gamepad.axes[3] || 0;
          const aimMagnitude = Math.hypot(aimX, aimY);
          if (aimMagnitude > 0.25) {
            aimDirectionRef.current = { x: aimX / aimMagnitude, y: aimY / aimMagnitude };
            aimRef.current.x = clamp(p.x + aimDirectionRef.current.x * 240, 0, ROOM_W);
            aimRef.current.y = clamp(p.y + aimDirectionRef.current.y * 240, 0, ROOM_H);
            p.facing = aimDirectionRef.current.x < 0 ? -1 : 1;
          }
          gamepadButtonsRef.current = pressedButtons;
        } else {
          gamepadButtonsRef.current = [];
        }

        // move player
        const k = keys.current;
        const sp = 80 + classData.stats.speed * 10 + (state.upgrades.includes("spd1") ? 40 : 0);
        let dx = 0, dy = 0;
        if (k["w"] || k["arrowup"]) dy -= 1;
        if (k["s"] || k["arrowdown"]) dy += 1;
        if (k["a"] || k["arrowleft"]) { dx -= 1; p.facing = -1; }
        if (k["d"] || k["arrowright"]) { dx += 1; p.facing = 1; }
        dx += controllerX;
        dy += controllerY;
        if (dx || dy) {
          const m = Math.hypot(dx, dy);
          p.x = clamp(p.x + (dx/m)*sp*dt, WALL_PAD, ROOM_W - WALL_PAD);
          p.y = clamp(p.y + (dy/m)*sp*dt, WALL_PAD + 24, ROOM_H - WALL_PAD);
        }

        // cooldowns
        for (const k2 in cooldownsRef.current) {
          cooldownsRef.current[k2] = Math.max(0, cooldownsRef.current[k2] - dt);
        }
        p.guardT = Math.max(0, (p.guardT || 0) - dt);
        p.attackT = Math.max(0, (p.attackT || 0) - dt);

        // projectiles
        projectilesRef.current = projectilesRef.current.filter(pr => {
          pr.life -= dt;
          pr.x += pr.vx * dt;
          pr.y += pr.vy * dt;
          const room = roomRef2.current;
          if (pr.hostile) {
            if (dist(pr, p) < pr.r + PLAYER_R) {
              pr.life = 0;
              if (performance.now() - (p.iframeT || 0) > 800) {
                p.iframeT = performance.now();
                setHurtFlash(performance.now());
                dmgNumsRef.current.push({ id: Math.random().toString(36).slice(2), x: p.x, y: p.y - 30, v: pr.dmg, t: 0, self: true });
                setState(s => {
                  const newHp = s.hp - Math.max(1, pr.dmg - (p.guardT > 0 ? 1 : 0));
                  if (newHp <= 0) return { ...s, hp: 0, screen: "death" };
                  return { ...s, hp: newHp };
                });
              }
            }
            return pr.life > 0 && pr.x > 0 && pr.x < ROOM_W && pr.y > 0 && pr.y < ROOM_H;
          }
          // Player shots only collide with enemies and bosses.
          const targets = room.enemies.concat(room.boss ? [room.boss] : []);
          for (const e of targets) {
            if (e.hp <= 0) continue;
            if (pr.hitIds && pr.hitIds.includes(e.id)) continue;
            if (dist(pr, e) < pr.r + (e.r || 10)) {
              const dmg = pr.dmg + (state.upgrades.includes("dmg1") ? 1 : 0);
              if (pr.aoe) {
                pr.hitIds = pr.hitIds || [];
                pr.hitIds.push(e.id);
              }
              hitEnemy(room, e, dmg);
              if (pr.kind !== "thunder") pr.life = 0;
              break;
            }
          }
          return pr.life > 0 && pr.x > 0 && pr.x < ROOM_W && pr.y > 0 && pr.y < ROOM_H;
        });

        // enemies
        const room = roomRef2.current;
        const allAlive = room.enemies.filter(e => e.hp > 0);
        for (const e of room.enemies) {
          if (e.hp <= 0) continue;
          if (e.sleepT) { e.sleepT -= dt; if (e.sleepT <= 0) delete e.sleepT; continue; }
          const toP = { x: p.x - e.x, y: p.y - e.y };
          const d = Math.hypot(toP.x, toP.y);
          e.decisionT -= dt;
          e.lungeCd = Math.max(0, (e.lungeCd || 0) - dt);
          if (e.decisionT <= 0) {
            e.decisionT = 0.55 + Math.random() * 1.2;
            e.orbit = Math.random() < 0.5 ? -1 : 1;
            e.preferredRange = 150 + Math.random() * 100;
          }
          const ux = toP.x / (d || 1), uy = toP.y / (d || 1);
          const sideX = -uy * e.orbit, sideY = ux * e.orbit;
          const separation = enemySeparation(e, allAlive);
          if (e.type === "archer" || e.type === "shaman") {
            const preferred = e.preferredRange || (e.type === "shaman" ? 190 : 205);
            const radial = d > preferred + 36 ? 1 : d < preferred - 36 ? -1 : 0;
            const moveX = ux * radial + sideX * (radial ? 0.55 : 1) + separation.x * 1.4;
            const moveY = uy * radial + sideY * (radial ? 0.55 : 1) + separation.y * 1.4;
            const moveMag = Math.hypot(moveX, moveY) || 1;
            e.x = clamp(e.x + (moveX / moveMag) * e.speed * dt, WALL_PAD + 12, ROOM_W - WALL_PAD - 12);
            e.y = clamp(e.y + (moveY / moveMag) * e.speed * dt, WALL_PAD + 36, ROOM_H - WALL_PAD - 12);
            e.attackCd -= dt;
            if (d < (e.type === "shaman" ? 340 : 280) && e.attackCd <= 0) {
              e.attackCd = e.type === "shaman" ? 2.3 : 1.8;
              const aimAngle = Math.atan2(toP.y, toP.x) + (Math.random() - 0.5) * 0.22;
              const shotSpeed = e.type === "shaman" ? 135 : 165;
              projectilesRef.current.push({
                id: Math.random().toString(36).slice(2), kind: e.type === "shaman" ? "shaman-shot" : "enemy-shot",
                x: e.x, y: e.y - 4, vx: Math.cos(aimAngle) * shotSpeed, vy: Math.sin(aimAngle) * shotSpeed,
                dmg: e.damage, life: 3, r: 7, hostile: true,
              });
            }
          } else if (d > (e.type === "brute" ? 34 : 30)) {
            const lunge = e.type === "wraith" && d < 190 && e.lungeCd <= 0 && Math.random() < 0.025;
            const steerX = ux + sideX * (e.type === "wraith" ? 0.8 : 0.42) + separation.x * 1.4;
            const steerY = uy + sideY * (e.type === "wraith" ? 0.8 : 0.42) + separation.y * 1.4;
            const steerMag = Math.hypot(steerX, steerY) || 1;
            const speed = e.speed * (lunge ? 2.7 : 1);
            e.x = clamp(e.x + (steerX / steerMag) * speed * dt, WALL_PAD + 12, ROOM_W - WALL_PAD - 12);
            e.y = clamp(e.y + (steerY / steerMag) * speed * dt, WALL_PAD + 36, ROOM_H - WALL_PAD - 12);
            if (lunge) e.lungeCd = 2.2 + Math.random() * 1.8;
          } else {
            const separationMagnitude = Math.hypot(separation.x, separation.y);
            if (separationMagnitude > 0) {
              e.x = clamp(e.x + (separation.x / separationMagnitude) * e.speed * 0.65 * dt, WALL_PAD + 12, ROOM_W - WALL_PAD - 12);
              e.y = clamp(e.y + (separation.y / separationMagnitude) * e.speed * 0.65 * dt, WALL_PAD + 36, ROOM_H - WALL_PAD - 12);
            }
            e.attackCd -= dt;
            if (e.attackCd <= 0 && performance.now() - (p.iframeT || 0) > 800) {
              e.attackCd = e.type === "brute" ? 1.4 : 1.1;
              p.iframeT = performance.now();
              setHurtFlash(performance.now());
              const damage = Math.max(1, e.damage - (p.guardT > 0 ? 1 : 0));
              dmgNumsRef.current.push({ id: Math.random().toString(36).slice(2), x: p.x, y: p.y - 30, v: damage, t: 0, self: true });
              setState(s => {
                const newHp = s.hp - damage;
                if (newHp <= 0) return { ...s, hp: 0, screen: "death" };
                return { ...s, hp: newHp };
              });
            }
          }
        }
        // boss behavior
        if (room.boss && room.boss.hp > 0) {
          const b = room.boss;
          if (b.phase === 1 && b.hp <= b.maxHp / 2) {
            b.phase = 2;
            b.speed *= 1.3;
            b.burstCd = 0.7;
            showToast(b.id === "final" ? "The Warden awakens" : "The Shade enrages");
          }
          b.attackCd -= dt;
          b.burstCd = (b.burstCd || 0) - dt;
          b.moveT = (b.moveT || 0) - dt;
          // drifting movement — side-step randomly, stay in top half
          if (b.moveT <= 0) {
            b.moveT = 1.2 + Math.random() * 1.2;
            const dxp = p.x - b.x;
            // 60% chase-x, 40% strafe
            const strafe = Math.random() < 0.4;
            b._vx = strafe ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dxp);
            b._vy = (Math.random() < 0.5 ? -1 : 1) * 0.4;
          }
          b.x = clamp(b.x + (b._vx || 0) * b.speed * dt, WALL_PAD + 40, ROOM_W - WALL_PAD - 40);
          b.y = clamp(b.y + (b._vy || 0) * b.speed * dt, WALL_PAD + 60, ROOM_H / 2);

          if (b.attackCd <= 0) {
            b.attackCd = b.phase === 2 ? 0.62 : 1.05;
            const dx2 = p.x - b.x, dy2 = p.y - b.y;
            const m = Math.hypot(dx2, dy2) || 1;
            projectilesRef.current.push({
              id: Math.random().toString(36).slice(2),
              kind: "fireball",
              x: b.x, y: b.y, vx: (dx2/m)*220, vy: (dy2/m)*220,
              dmg: 1, life: 3.5, r: 10, hostile: true,
            });
          }
          // triple-shot burst every 4s
          if (b.burstCd <= 0) {
            b.burstCd = b.phase === 2 ? 3 : 4.5;
            const dx2 = p.x - b.x, dy2 = p.y - b.y;
            const baseA = Math.atan2(dy2, dx2);
            const spread = b.id === "final" && b.phase === 2 ? [-0.7, -0.35, 0, 0.35, 0.7] : [-0.35, 0, 0.35];
            spread.forEach(off => {
              const a = baseA + off;
              projectilesRef.current.push({
                id: Math.random().toString(36).slice(2),
                kind: "thunder",
                x: b.x, y: b.y, vx: Math.cos(a)*180, vy: Math.sin(a)*180,
                dmg: 1, life: 3, r: 8, hostile: true,
              });
            });
          }
        }

        // room-clear → open doors → next
        if (room.kind === "combat" && allAlive.length === 0 && !room.cleared) {
          room.cleared = true;
          showToast("Room cleared — proceed ↑");
        }
        if (room.cleared && !room.advanceQueued && p.y < WALL_PAD + 30) {
          room.advanceQueued = true;
          nextRoom(true);
        }
        if (room.kind === "merchant" && !room.advanceQueued && p.y < WALL_PAD + 30) {
          room.advanceQueued = true;
          nextRoom(true);
        }

        // glyphs + dmg nums age
        glyphsRef.current = glyphsRef.current.filter(g => { g.t += dt; return g.t < g.ttl; });
        dmgNumsRef.current = dmgNumsRef.current.filter(d2 => { d2.t += dt; return d2.t < 0.8; });

        // Store collected potions for later use.
        if (room.pickups && room.pickups.length) {
          let potions = [...(state.potions || [])];
          let inventoryChanged = false;
          room.pickups = room.pickups.filter(pk => {
            pk.t += dt;
            if (dist(pk, p) < 22) {
              if (potions.length < 4) {
                potions.push(pk.kind);
                inventoryChanged = true;
                showToast(`${pk.kind === "health" ? "Health" : "Mana"} potion stored · ${potions.length}/4`);
                return false;
              }
              if (!pk.fullToast) {
                pk.fullToast = true;
                showToast("Potion pouch full");
              }
            }
            return pk.t < 14;
          });
          if (inventoryChanged) setState(s => ({ ...s, potions: potions.slice(0, 4) }));
        }
      }
      force(n => n + 1);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [state, setState, castSpell, usePotion, nextRoom, defeatBoss, hitEnemy, showToast, tomeOpen, mapOpen, merchantOpen]);

  const p = playerRef.current;
  const room = roomRef2.current;
  const primarySpell = SPELLS[classSpells[0]];
  const meleePreview = primarySpell && ["slash", "melee"].includes(primarySpell.type) ? primarySpell : null;
  const meleeAngle = Math.atan2(aimDirectionRef.current.y, aimDirectionRef.current.x);

  return (
    <div className="dungeon" data-hud={tweaks.hudDensity}>
      <div className="stage">
        <div className="room" data-camera={tweaks.camera} data-room-kind={room.kind} ref={roomElRef}
          onMouseMove={(e) => {
            const el = roomElRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const rx = ((e.clientX - r.left) / r.width) * ROOM_W;
            const ry = ((e.clientY - r.top) / r.height) * ROOM_H;
            aimRef.current.x = rx;
            aimRef.current.y = ry;
            const dx = rx - playerRef.current.x;
            const dy = ry - (playerRef.current.y - 10);
            const magnitude = Math.hypot(dx, dy) || 1;
            aimDirectionRef.current = { x: dx / magnitude, y: dy / magnitude };
            playerRef.current.facing = aimDirectionRef.current.x < 0 ? -1 : 1;
          }}
          onMouseDown={(e) => {
            const key = e.button === 0 ? "leftclick" : e.button === 2 ? "rightclick" : null;
            const spellId = classSpells.find(id => SPELLS[id].key === key);
            if (e.button === 2) e.preventDefault();
            if (spellId) castSpell(spellId);
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="floor" />
          {(room.decor || []).map((stone, i) => (
            <div key={`debris-${i}`} className={`floor-debris debris-${i % 3}`} style={{ left: stone.x, top: stone.y, width: stone.size * 2, height: stone.size, transform: `translate(-50%, -50%) rotate(${stone.rotate}deg)` }} />
          ))}
          {/* torches — wall sconces with flame */}
          {[[80,50],[ROOM_W-80,50],[80,ROOM_H-80],[ROOM_W-80,ROOM_H-80]].map(([x,y],i) => (
            <React.Fragment key={i}>
              <div className="torch-glow" style={{left:x, top:y}} />
              <div className="sconce" style={{left:x-10, top:y-14}}>
                <svg viewBox="0 0 20 28" width="20" height="28" style={{imageRendering:"pixelated"}}>
                  {/* bracket */}
                  <rect x="8" y="14" width="4" height="10" fill="#3a2514" />
                  <rect x="6" y="22" width="8" height="2" fill="#2a1810" />
                  <rect x="4" y="12" width="12" height="4" fill="#4a2f1a" />
                  <rect x="5" y="13" width="10" height="1" fill="#6a4428" />
                  {/* flame */}
                  <g className="flame">
                    <ellipse cx="10" cy="8" rx="5" ry="7" fill="#c04318" />
                    <ellipse cx="10" cy="9" rx="3.5" ry="5.5" fill="#ff7a33" />
                    <ellipse cx="10" cy="11" rx="2" ry="3" fill="#ffd47a" />
                  </g>
                </svg>
              </div>
            </React.Fragment>
          ))}

          {/* pickups */}
          {(room.pickups || []).map(pk => (
            <div key={pk.id} className={`pickup ${pk.kind}-potion`} style={{ left: pk.x, top: pk.y }} title={pk.kind === "health" ? "Health potion · restore 1 HP" : "Mana potion · restore 3 mana"}>
              <svg viewBox="0 0 16 20" width="18" height="22" style={{imageRendering:"pixelated"}}>
                <rect x="6" y="1" width="4" height="2" fill="#6a4428" />
                <rect x="5" y="3" width="6" height="2" fill="#3a2514" />
                <rect x="4" y="5" width="8" height="2" fill="#4a2f1a" />
                <rect x="3" y="7" width="10" height="10" fill={pk.kind === "health" ? "#6b1a25" : "#1a3a6b"} />
                <rect x="4" y="8" width="8" height="8" fill={pk.kind === "health" ? "#c43f45" : "#3d6ea8"} />
                <rect x="5" y="9" width="2" height="2" fill={pk.kind === "health" ? "#ffd47a" : "#8ab4e8"} />
                <rect x="3" y="17" width="10" height="2" fill={pk.kind === "health" ? "#3d1018" : "#0a1a33"} />
              </svg>
            </div>
          ))}
          <div className="walls">
            <div className="wall-top" />
            <div className="wall-bot" />
            <div className="wall-left" />
            <div className="wall-right" />
          </div>
          {/* doors */}
          {(room.cleared || room.kind === "merchant") && <div className="door" />}
          {room.kind === "combat" && !room.cleared && <div className="door locked" />}
          {state.roomIndex > 0 && <div className="door bot" />}

          {meleePreview && (
            <svg
              className="melee-preview"
              style={{ left: p.x, top: p.y - 32, width: meleePreview.range, height: 44, transform: `rotate(${meleeAngle}rad)` }}
              viewBox={`0 0 ${meleePreview.range} 44`}
              aria-hidden="true"
            >
              <path d={`M 0 10 L ${meleePreview.range} 0 L ${meleePreview.range} 44 L 0 34 Z`} />
              <line x1="0" y1="22" x2={meleePreview.range} y2="22" />
            </svg>
          )}

          {/* glyphs on floor */}
          {glyphsRef.current.map(g => (
            <div
              key={g.id}
              className={`glyph ${tweaks.glyphStyle} ${g.t > 0.5 ? "fade" : ""}`}
              style={{ left: g.x, top: g.y, width: 80, height: 80 }}
            >
              {glyphSVG(g.kind)}
            </div>
          ))}
          {p.attackT > 0 && (
            <div className="slash-arc" style={{ left: p.x + Math.cos(p.attackAngle) * 28, top: p.y - 10 + Math.sin(p.attackAngle) * 28, transform: `translate(-50%, -50%) rotate(${p.attackAngle}rad)` }}>
              <svg viewBox="0 0 100 80" aria-hidden="true">
                <path d="M 10 68 Q 32 8 91 16" />
                <path d="M 19 72 Q 40 25 84 22" />
              </svg>
            </div>
          )}

          {/* entities - sort by y for depth */}
          {[
            ...(room.merchant ? [{ type: "merchant", ...room.merchant }] : []),
            ...room.enemies.filter(e => e.hp > 0),
            ...(room.boss && room.boss.hp > 0 ? [{ type: "boss", ...room.boss }] : []),
            { type: "player", x: p.x, y: p.y, facing: p.facing, hurt: performance.now() - hurtFlash < 250 },
          ]
            .sort((a, b) => a.y - b.y)
            .map((ent, idx) => {
              if (ent.type === "player") {
                const PlayerSprite = state.class === "soldier" ? SoldierSprite : state.class === "assassin" ? AssassinSprite : MageSprite;
                return (
                  <div key="player" className={`entity mage ${ent.hurt ? "hurt" : ""} ${p.guardT > 0 ? "guarded" : ""}`} style={{ left: ent.x, top: ent.y, transform: `translate(-50%, -75%) scaleX(${ent.facing})` }}>
                    <div className="shadow" />
                    <div className={`player-art ${p.attackT > 0 ? "swinging" : ""}`}><PlayerSprite scale={2} bob={true} /></div>
                  </div>
                );
              }
              if (["goblin", "archer", "brute", "wraith", "shaman"].includes(ent.type)) {
                const EnemySprite = ent.type === "archer" || ent.type === "shaman" ? BoneArcherSprite : ent.type === "brute" ? BruteSprite : GoblinSprite;
                const enemyName = { goblin: "Goblin", archer: "Bone archer", brute: "Cave brute", wraith: "Wraith", shaman: "Hex shaman" }[ent.type];
                return (
                  <div key={ent.id} className={`entity enemy ${ent.type} ${ent.sleepT ? "sleeping" : ""}`} title={enemyName} style={{ left: ent.x, top: ent.y }}>
                    <div className="shadow" />
                    {ent.type === "wraith" ? <MageSprite scale={1.3} bob={false} /> : <EnemySprite scale={ent.type === "brute" ? 1.25 : 1.3} />}
                    <div className="hp-bar"><div className="fill" style={{ width: `${(ent.hp/ent.maxHp)*100}%` }} /></div>
                    {ent.sleepT && <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", fontFamily: "serif", fontStyle: "italic", color: "#dce6ff", fontSize: 14 }}>z</div>}
                  </div>
                );
              }
              if (ent.type === "merchant") {
                return (
                  <div key="merchant" className="entity merchant" style={{ left: ent.x, top: ent.y }} onClick={() => setMerchantOpen(true)}>
                    <div className="shadow" />
                    <MerchantSprite scale={1.4} />
                  </div>
                );
              }
              if (ent.type === "boss") {
                return (
                  <div key="boss" className={`entity boss ${ent.id === "final" ? "warden" : "shade"}`} style={{ left: ent.x, top: ent.y }}>
                    <div className="shadow" />
                    {ent.id === "final" ? <WardenSprite scale={2} /> : <BossSprite scale={2} />}
                    <div className="boss-nameplate">{ent.id === "final" ? "THE WARDEN" : "SHADE OF THE TENTH"} · PHASE {ent.phase}</div>
                    <div className="hp-bar"><div className="fill" style={{ width: `${(ent.hp/ent.maxHp)*100}%` }} /></div>
                  </div>
                );
              }
              return null;
            })}

          {/* aim reticle */}
          <div className="aim-reticle" style={{ left: aimRef.current.x, top: aimRef.current.y }}>
            <svg viewBox="0 0 20 20" width="20" height="20">
              <circle cx="10" cy="10" r="6" fill="none" stroke="#ff7a33" strokeWidth="1.2" opacity="0.85" />
              <line x1="10" y1="0" x2="10" y2="4" stroke="#ff7a33" strokeWidth="1.2" />
              <line x1="10" y1="16" x2="10" y2="20" stroke="#ff7a33" strokeWidth="1.2" />
              <line x1="0" y1="10" x2="4" y2="10" stroke="#ff7a33" strokeWidth="1.2" />
              <line x1="16" y1="10" x2="20" y2="10" stroke="#ff7a33" strokeWidth="1.2" />
            </svg>
          </div>

          {/* projectiles */}
          {projectilesRef.current.map(pr => (
            <div key={pr.id} className={`projectile ${pr.kind} ${pr.hostile ? "hostile" : ""}`} style={{ left: pr.x, top: pr.y }} />
          ))}

          {/* dmg numbers */}
          {dmgNumsRef.current.map(d2 => (
            <div key={d2.id} className={`dmg-num ${d2.self ? "self" : ""}`} style={{ left: d2.x, top: d2.y - d2.t * 40 }}>
              {d2.v}
            </div>
          ))}
        </div>
      </div>

      {/* HUD */}
      <div className="hud">
        <div className="hud-top">
          <div className="hud-left">
            <div className="plate">
              <span>{classData.resource}</span>
              <span className="big">{state.mp}/{state.maxMp}</span>
            </div>
            <div className="plate">
              <span>Gold</span>
              <span className="big">{state.gold}</span>
            </div>
          </div>
          <div className="hud-right">
            <div className="runes-tray" title="Portal Runes">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={`rune-slot ${i < state.runes ? "filled" : ""}`}>
                  {i < state.runes && <RuneIcon />}
                </div>
              ))}
            </div>
            <div className="plate">
              <span>Floor</span>
              <span className="big">{state.roomIndex + 1}/{state.roomSequence.length}</span>
            </div>
            {settings.speedrunTimer && (
              <div className="plate run-timer">
                <span>Time</span>
                <span className="big">{formatRunTime(Math.floor((Date.now() - (state.runStartedAt || Date.now())) / 1000))}</span>
              </div>
            )}
          </div>
        </div>

        <div className="health-hud" aria-label={`Health ${state.hp} of ${state.maxHp}`}>
          <div className="meter-heading"><span>HEALTH</span><strong>{state.hp} / {state.maxHp}</strong></div>
          <div className="meter-track"><div className="meter-fill health-fill" style={{ width: `${(state.hp / state.maxHp) * 100}%` }} /></div>
        </div>

        {room.boss && room.boss.hp > 0 && (
          <div className="boss-hud" aria-label={`${room.boss.id === "final" ? "The Warden" : "Shade of the Tenth"} health ${Math.ceil(room.boss.hp)} of ${room.boss.maxHp}`}>
            <div className="meter-heading"><span>{room.boss.id === "final" ? "THE WARDEN" : "SHADE OF THE TENTH"}</span><strong>{Math.ceil(room.boss.hp)} / {room.boss.maxHp}</strong></div>
            <div className="meter-track boss-meter"><div className="meter-fill boss-fill" style={{ width: `${(room.boss.hp / room.boss.maxHp) * 100}%` }} /></div>
            <div className="boss-phase">PHASE {room.boss.phase}</div>
          </div>
        )}

        {/* minimap */}
        <Minimap state={state} onClick={() => setMapOpen(true)} />

        <div className="controller-dock">
          <section className="control-cluster spell-control">
            <h3>SPELLS</h3>
            <div className="face-pad">
              {[
                { spellIndex: 2, face: "Y", position: "top" },
                { spellIndex: 0, face: "X", position: "left" },
                { spellIndex: 3, face: "O", position: "right" },
                { spellIndex: 1, face: "A", position: "bottom" },
              ].map(({ spellIndex, face, position }) => {
                const spellId = classSpells[spellIndex];
                if (!spellId) return null;
                const spell = SPELLS[spellId];
                const cooldown = cooldownsRef.current[spellId] || 0;
                return (
                  <button key={spellId} className={`face-spell ${position}`} title={`${face} button · ${spell.name}`} onClick={() => castSpell(spellId)}>
                    <span className="face-label">{face}</span>
                    <span className="face-glyph">{glyphSVG(spell.glyph, "ink")}</span>
                    <span className="face-name">{spell.name}</span>
                    {cooldown > 0 && <span className="control-cooldown">{cooldown.toFixed(1)}</span>}
                  </button>
                );
              })}
              {classSpells[4] && (
                <button className="face-spell center-spell" title={`Left bumper · ${SPELLS[classSpells[4]].name}`} onClick={() => castSpell(classSpells[4])}>
                  <span className="face-label">LB</span>
                  <span className="center-name">{SPELLS[classSpells[4]].name}</span>
                </button>
              )}
            </div>
            <div className="cluster-help">X · A · Y · O/B + LB</div>
          </section>

          <section className="control-cluster potion-control">
            <h3>POTIONS <span>{(state.potions || []).length}/4</span></h3>
            <div className="potion-pad">
              {[
                { slot: 0, direction: "up", glyph: "↑" },
                { slot: 1, direction: "down", glyph: "↓" },
                { slot: 2, direction: "left", glyph: "←" },
                { slot: 3, direction: "right", glyph: "→" },
              ].map(({ slot, direction, glyph }) => {
                const potion = (state.potions || [])[slot];
                return (
                  <button key={direction} className={`potion-slot ${direction} ${potion || "empty"}`} title={`D-pad ${direction} · ${potion ? `${potion} potion` : "empty"}`} onClick={() => usePotion(slot)}>
                    <span className="dpad-arrow">{glyph}</span>
                    <strong>{potion === "health" ? "HP" : potion === "mana" ? "MP" : "--"}</strong>
                    <small>{slot + 1}</small>
                  </button>
                );
              })}
              <div className="potion-center">D-PAD</div>
            </div>
            <div className="cluster-help">Tap a direction to use</div>
          </section>
        </div>

        <div className="hint-bar">
          <span><span className="kbd">WASD / LEFT STICK</span> Move</span>
          <span><span className="kbd">MOUSE / RIGHT STICK</span> Aim</span>
          <span><span className="kbd">1–4 / D-PAD</span> Potions</span>
          <span><span className="kbd">I</span> Tome</span>
          <span><span className="kbd">M</span> Map</span>
        </div>

        {toast && <div className="toast">{toast}</div>}
        {bossBanner && (
          <div className="boss-banner">
            <div className="eyebrow">— Warden of the Maze —</div>
            <div className="name">{bossBanner}</div>
          </div>
        )}
      </div>

      {/* overlays */}
      {tomeOpen && <Tome state={state} setState={setState} onClose={() => setTomeOpen(false)} />}
      {mapOpen && <MapScreen state={state} onClose={() => setMapOpen(false)} />}
      {merchantOpen && <MerchantShop state={state} setState={setState} onClose={() => setMerchantOpen(false)} />}
    </div>
  );
}

/* ---------- Minimap ---------- */
function Minimap({ state, onClick }) {
  const map = generateMap(state.roomSequence);
  const cells = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const room = map[y][x];
      let cls = "m-cell";
      if (room) {
        if (state.visitedRooms.includes(room.index)) cls += " visited";
        else cls += " known";
        if (room.index === state.roomIndex) cls += " current";
        if (room.type === "boss") cls += " boss";
        if (room.type === "final") cls += " final";
      }
      cells.push(<div key={`${x}-${y}`} className={cls} />);
    }
  }
  return (
    <div className="minimap" onClick={onClick}>
      {cells}
    </div>
  );
}

/* ---------- Tome ---------- */
function Tome({ state, setState, onClose }) {
  const owned = new Set(state.upgrades);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="tome" onClick={e => e.stopPropagation()}>
        <button className="tome-close" onClick={onClose}>✕ close</button>
        <div className="page left">
          <h2>— The Tome —</h2>
          <h3>Attributes</h3>
          <div className="ink-divider" />
          {[
            { k: "HP", v: state.maxHp, max: 10 },
            { k: "Damage", v: 4 + (owned.has("dmg1") ? 1 : 0), max: 10 },
            { k: "Range", v: 6 + (owned.has("rng1") ? 2 : 0), max: 10 },
            { k: "Speed", v: 6 + (owned.has("spd1") ? 1 : 0), max: 10 },
            { k: "Magic", v: 9 + (owned.has("mag1") ? 2 : 0), max: 10 },
            { k: "Crit", v: 5 + (owned.has("crit1") ? 1 : 0), max: 10 },
          ].map(r => (
            <div className="attr-row" key={r.k}>
              <span>{r.k}</span>
              <div className="bar"><div className="fill" style={{ width: `${(r.v/r.max)*100}%` }} /></div>
              <span>{r.v}</span>
            </div>
          ))}
          <div style={{ fontStyle: "italic", marginTop: 16, lineHeight: 1.5 }}>
            <em>"A page ripped is a spell undone. Rip only what you must."</em>
          </div>
        </div>
        <div className="page right">
          <h2>— Glyphs Inscribed —</h2>
          <h3>Upgrades</h3>
          <div className="ink-divider" />
          <div className="upgrade-grid">
            {UPGRADES.map(u => {
              const has = owned.has(u.id);
              return (
                <div key={u.id} className={`slot ${has ? "filled" : ""}`}>
                  {has ? glyphSVG(u.glyph) : <span style={{ opacity: 0.3, fontSize: 24 }}>·</span>}
                  <span className="label">{has ? u.label : "—"}</span>
                  {has && (
                    <button className="rip" title="Rip out page"
                      onClick={() => setState(s => ({ ...s, upgrades: s.upgrades.filter(x => x !== u.id) }))}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 26, fontSize: 12, fontFamily: "var(--f-smallcaps)", letterSpacing: "0.2em", color: "var(--ink-2)" }}>
            Find a merchant to scribe new glyphs.
          </div>
        </div>
        <div className="tome-foot">
          <span>Class · {state.class.toUpperCase()}</span>
          <span>Gold · {state.gold}</span>
          <span>Runes · {state.runes}/9</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- Merchant ---------- */
function MerchantShop({ state, setState, onClose }) {
  const [offers] = uS(() => {
    const owned = new Set(state.upgrades);
    const avail = UPGRADES.filter(u => !owned.has(u.id));
    const shuffled = [...avail].sort(() => 0.5 - Math.random()).slice(0, 3);
    return shuffled.map(u => ({ ...u, price: 10 + Math.floor(Math.random()*6) }));
  });
  const buy = (o) => {
    if (state.gold < o.price) return;
    if (state.upgrades.length >= 6) return;
    setState(s => ({ ...s, gold: s.gold - o.price, upgrades: [...s.upgrades, o.id] }));
    onClose();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="merchant-modal" onClick={e => e.stopPropagation()}>
        <button className="tome-close" onClick={onClose}>✕ close</button>
        <div className="sub">— A Hooded Figure —</div>
        <h2>The Scribe</h2>
        <p style={{ fontStyle: "italic", marginTop: 6, color: "var(--ink-2)" }}>
          "Three glyphs this eve. Gold in the palm, ink on the page. Choose."
        </p>
        <div className="offer-row">
          {offers.map(o => {
            const cant = state.gold < o.price || state.upgrades.length >= 6;
            return (
              <div key={o.id} className={`offer ${cant ? "cant" : ""}`} onClick={() => !cant && buy(o)}>
                <div className="glyph-preview">{glyphSVG(o.glyph)}</div>
                <h4>{o.label}</h4>
                <p><em>+{o.amt} {o.attr}</em></p>
                <div className="price">{o.price} ⛀ gold</div>
              </div>
            );
          })}
        </div>
        <div className="merchant-heal">
          <span>Restore up to 2 health · 8 gold</span>
          <button className="btn ink" disabled={state.hp >= state.maxHp || state.gold < 8} onClick={() => {
            if (state.hp >= state.maxHp || state.gold < 8) return;
            setState(s => ({ ...s, gold: s.gold - 8, hp: Math.min(s.maxHp, s.hp + 2) }));
            onClose();
          }}>Buy healing</button>
        </div>
        <div style={{ marginTop: 18, fontFamily: "var(--f-smallcaps)", letterSpacing: "0.25em", fontSize: 11, color: "var(--ink-2)", textAlign: "center" }}>
          Your Gold · {state.gold}   ·   Tome slots · {state.upgrades.length}/6
        </div>
      </div>
    </div>
  );
}

/* ---------- Map Screen ---------- */
function MapScreen({ state, onClose }) {
  const map = generateMap(state.roomSequence);
  const cells = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const room = map[y][x];
      let cls = "map-cell";
      if (!room) {
        cls += " empty";
      } else {
        cls += " room";
        const roomIdx = room.index;
        const kind = room.type;
        if (kind === "boss") cls += " boss";
        if (kind === "merchant") cls += " merchant";
        if (kind === "final") cls += " final";
        if (state.visitedRooms.includes(roomIdx) && roomIdx !== state.roomIndex) cls += " visited";
        if (roomIdx === state.roomIndex) cls += " current";
      }
      cells.push(<div key={`${x}-${y}`} className={cls} />);
    }
  }
  // Build SVG path overlay for dotted trail
  const visitedPath = [...state.visitedRooms].sort((a,b)=>a-b).concat([state.roomIndex]);
  const unique = [...new Set(visitedPath)].sort((a,b)=>a-b);
  const pts = unique.map(i => {
    const [cx, cy] = MAP_PATH[i];
    return { x: cx * 78 + 39, y: cy * 78 + 39 };
  });

  return (
    <div className="map-screen" onClick={onClose}>
      <div className="map-paper" onClick={e => e.stopPropagation()}>
        <button className="tome-close" onClick={onClose} style={{ color: "var(--ink-2)" }}>✕ close</button>
        <h2>The Maze</h2>
        <div className="sub">— Rooms Known · Path Taken —</div>
        <div style={{ position: "relative", margin: "0 auto", width: "fit-content" }}>
          <div className="map-grid">{cells}</div>
          <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width={MAP_W*78} height={MAP_H*78}>
            {pts.length > 1 && (
              <polyline
                points={pts.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke="#9a2a2a" strokeWidth="2.5"
                strokeDasharray="4 4" strokeLinecap="round"
              />
            )}
          </svg>
        </div>
        <div className="legend">
          <span className="vis">Visited</span>
          <span className="now">You Are Here</span>
          <span className="bos">Warden</span>
          <span>★ Final Chamber</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Dungeon });
