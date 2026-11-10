// ============================================================
//  Rage of the Mage — real-time combat engine (Rage of Mage 2 style)
// ============================================================
import { SPELLS, GRID } from "./data.js";
import { computeMovable, manhattan, resolveAttack, checkCombatEnd, unitByUid } from "./state.js";
import { spriteImage, FRAME_COUNT, FRAME_SIZE } from "./sprites.js";

export const CLASS_ICON = { warrior: "⚔️", mage: "🔥", ranger: "🏹" };
const UNIT_COLOR = {
  warrior: "#5a9e6a",
  mage: "#7fa3e8",
  ranger: "#c9a227",
  ally: "#5a9e6a",
  enemy: "#c0392b",
  boss: "#a8322a",
};

// Timing — deliberately unhurried, so orders and spells have room to breathe
const ATTACK_DELAY = 2000;        // ms between hero auto-attacks
const ENEMY_ATTACK_DELAY = 2400;  // the dead are slower still
const SPELL_COOLDOWN = 3200;      // ms between spell casts
const MOVE_SPEED = 0.25;          // tiles per second (smooth movement)
const OPENING_GRACE = 2600;       // ms of quiet before the armies engage

export function combatSay(combat, msg) {
  combat.log.push(msg);
  if (combat.log.length > 60) combat.log.shift();
}

export function startCombatRealTime(combat) {
  combat.phase = "real-time";
  combat.paused = false;
  combat.startAt = performance.now() + OPENING_GRACE;
  combat.lastFrameTime = performance.now();
  combat.attackCooldowns = new Map(); // uid -> next-allowed-time
  combat.moveReady = new Map();       // uid -> next-allowed-move-time
  combat.spellCooldowns = new Map();  // uid -> Map<spellId, next-allowed-time>
  combat.selectedId = null;
  combat.movable = [];
  // position units on opposite sides
  const playerUnits = combat.units.filter((u) => u.side === "player");
  const enemyUnits = combat.units.filter((u) => u.side === "enemy");
  let pi = 0;
  for (const u of playerUnits) { u.x = 1 + (pi % 3); u.y = 4 + Math.floor(pi / 3); u.face = 1; u.ax = u.x; u.ay = u.y; pi++; }
  let ei = 0;
  for (const u of enemyUnits) { u.x = combat.terrain.w - 2 - (ei % 3); u.y = 3 + Math.floor(ei / 3); u.face = -1; u.ax = u.x; u.ay = u.y; ei++; }
}

export function selectUnit(combat, uid) {
  const u = unitByUid(combat, uid);
  if (!u || u.side !== "player" || u.alive === false) return false;
  combat.selectedId = u.uid;
  combat.movable = computeMovable(combat, u);
  return true;
}

export function canStrike(attacker, defender) {
  const dist = manhattan(attacker, defender);
  if (dist < 1) return false;
  if (attacker.bow) return dist <= (attacker.bowRange || 4);
  if (attacker.cls === "mage" || attacker.cls === "ranger") return false;
  return dist <= 1;
}

function canCast(attacker, defender, spell) {
  const dist = manhattan(attacker, defender);
  return dist >= 1 && dist <= spell.range;
}

export function getCooldown(combat, uid) {
  return (combat.attackCooldowns && combat.attackCooldowns.get(uid)) || 0;
}
function setCooldown(combat, uid, ms) {
  if (!combat.attackCooldowns) combat.attackCooldowns = new Map();
  combat.attackCooldowns.set(uid, performance.now() + ms);
}

function canMoveNow(combat, uid) {
  return performance.now() >= ((combat.moveReady && combat.moveReady.get(uid)) || 0);
}
function markMoved(combat, uid, ms) {
  if (!combat.moveReady) combat.moveReady = new Map();
  combat.moveReady.set(uid, performance.now() + ms);
}

export function getSpellCooldown(combat, uid, spellId) {
  const m = combat.spellCooldowns && combat.spellCooldowns.get(uid);
  return m ? (m.get(spellId) || 0) : 0;
}
function setSpellCooldown(combat, uid, spellId, ms) {
  if (!combat.spellCooldowns) combat.spellCooldowns = new Map();
  if (!combat.spellCooldowns.has(uid)) combat.spellCooldowns.set(uid, new Map());
  combat.spellCooldowns.get(uid).set(spellId, performance.now() + ms);
}

export function tryPlayerAction(combat, action) {
  if (combat.phase === "over") return { ok: false, reason: "over" };
  const unit = combat.units.find((u) => u.uid === combat.selectedId);
  if (!unit || unit.side !== "player" || unit.alive === false) return { ok: false, reason: "no-selection" };
  switch (action.type) {
    case "move": {
      const m = combat.movable.find((t) => t.x === action.x && t.y === action.y);
      if (!m) return { ok: false, reason: "not-reachable" };
      unit.x = action.x; unit.y = action.y;
      combat.movable = [];
      combat.selectedId = null;
      return { ok: true };
    }
    case "attack": {
      const defender = combat.units.find((u) => u.uid === action.targetUid && u.alive && u.side === "enemy");
      if (!defender) return { ok: false, reason: "no-target" };
      if (!canStrike(unit, defender) && !(unit.bow && manhattan(unit, defender) <= (unit.bowRange || 4)))
        return { ok: false, reason: "out-of-range" };
      const now = performance.now();
      if (now < getCooldown(combat, unit.uid)) return { ok: false, reason: "cooldown" };
      const res = resolveAttack(combat, unit, defender, null);
      setCooldown(combat, unit.uid, ATTACK_DELAY);
      if (defender.hp <= 0) defender.alive = false;
      return { ok: true };
    }
    case "cast": {
      const defender = combat.units.find((u) => u.uid === action.targetUid && u.alive && u.side === "enemy");
      const spell = (unit.spells || []).map((sid) => SPELLS[sid]).find((s) => s && s.id === action.spellId) || null;
      if (!spell) return { ok: false, reason: "no-spell" };
      if (spell.type === "damage" && (!defender || !canCast(unit, defender, spell)))
        return { ok: false, reason: "out-of-range" };
      const now = performance.now();
      if (now < getSpellCooldown(combat, unit.uid, spell.id)) return { ok: false, reason: "cooldown" };
      if (unit.mp < spell.cost) return { ok: false, reason: "no-mana" };

      if (spell.type === "heal") {
        const allies = combat.units.filter((u) => u.side === "player" && u.alive && u.hp < u.maxHp);
        let aTarget = null;
        let bestA = Infinity;
        for (const a of allies) { const d = manhattan(unit, a); if (d < bestA) { bestA = d; aTarget = a; } }
        if (!aTarget) return { ok: false, reason: "no-heal-target" };
        unit.mp -= spell.cost;
        setSpellCooldown(combat, unit.uid, spell.id, SPELL_COOLDOWN);
        aTarget.hp = Math.min(aTarget.maxHp, aTarget.hp + spell.power);
        combat.log.push(`${unit.name} casts ${spell.name} on ${aTarget.name} for ${spell.power}.`);
        return { ok: true };
      }

      unit.mp -= spell.cost;
      setSpellCooldown(combat, unit.uid, spell.id, SPELL_COOLDOWN);
      resolveAttack(combat, unit, defender, spell);
      return { ok: true };
    }
    case "pause": {
      combat.paused = !combat.paused;
      return { ok: true };
    }
    default:
      return { ok: false, reason: "bad-action" };
  }
}

const MOVE_DELAY = 600; // ms between AI movement steps

function nearestUnitFrom(u, list) {
  let best = null;
  let bestDist = Infinity;
  for (const other of list) {
    const d = manhattan(u, other);
    if (d < bestDist) { bestDist = d; best = other; }
  }
  return best;
}

function autoCastAt(combat, u, target, now) {
  if (!u.spells || !u.spells.length) return false;
  const spell = u.spells
    .map((sid) => SPELLS[sid])
    .filter((s) => s && s.type === "damage" && u.mp >= s.cost)
    .sort((a, b) => (b.power || 0) - (a.power || 0))[0];
  if (!spell) return false;
  if (now < getSpellCooldown(combat, u.uid, spell.id)) return false;
  const dist = manhattan(u, target);
  if (dist < 1 || dist > spell.range) return false;
  u.mp -= spell.cost;
  setSpellCooldown(combat, u.uid, spell.id, SPELL_COOLDOWN);
  resolveAttack(combat, u, target, spell);
  return true;
}

function stepToward(combat, u, target) {
  if (!canMoveNow(combat, u.uid)) return false;
  const reachable = computeMovable(combat, u);
  let bestMove = null;
  let bestScore = Infinity;
  for (const t of reachable) {
    if (t.dist <= 0) continue;
    const score = manhattan(t, target) + t.dist * 0.01;
    if (score < bestScore) { bestScore = score; bestMove = t; }
  }
  if (!bestMove) return false;
  u.face = Math.sign(target.x - u.x) || u.face || 1;
  u.x = bestMove.x;
  u.y = bestMove.y;
  markMoved(combat, u.uid, MOVE_DELAY);
  return true;
}

function runSide(combat, side, now) {
  const foes = combat.units.filter((u) => u.alive && u.side !== side);
  const actors = combat.units.filter((u) => u.alive && u.side === side);
  if (!foes.length) return;
  for (const u of actors) {
    const target = nearestUnitFrom(u, foes);
    if (!target) continue;

    // 1) shoot / strike if something is in weapon range and the swing is ready
    const inRange = canStrike(u, target) || (u.bow && manhattan(u, target) <= (u.bowRange || 4));
    if (inRange && now >= getCooldown(combat, u.uid)) {
      resolveAttack(combat, u, target, null);
      setCooldown(combat, u.uid, side === "enemy" ? ENEMY_ATTACK_DELAY : ATTACK_DELAY);
      continue;
    }

    // 2) cast a damage spell if it can reach
    if (autoCastAt(combat, u, target, now)) continue;

    // 3) otherwise close the distance
    stepToward(combat, u, target);
  }
}

export function autoCombat(combat, dt) {
  if (combat.phase !== "real-time" || combat.paused) return;
  const now = performance.now();
  if (combat.startAt && now < combat.startAt) return;
  runSide(combat, "player", now);
  runSide(combat, "enemy", now);
  checkCombatEnd(combat);
}

// ---------------------------------------------------------------
//  Canvas rendering — animated 2D sprites
// ---------------------------------------------------------------
const TILE = 56;
const DEATH_FADE = 750;

// cheap deterministic per-tile noise (same battlefield every frame)
function tileNoise(x, y, salt = 0) {
  let n = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n >>> 0) % 1000) / 1000;
}

function drawGround(ctx, w, h) {
  const gradient = ctx.createLinearGradient(0, 0, w * TILE, h * TILE);
  gradient.addColorStop(0, "#241b12");
  gradient.addColorStop(0.55, "#1e1710");
  gradient.addColorStop(1, "#170f0a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w * TILE, h * TILE);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = tileNoise(x, y);
      const light = (x + y) % 2 === 0 ? 0 : 5;
      const r = 46 + Math.round(n * 10) + light;
      ctx.fillStyle = `rgb(${r}, ${Math.round(r * 0.78)}, ${Math.round(r * 0.55)})`;
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);

      // dry grass tufts and pebbles for texture
      if (n < 0.16) {
        ctx.strokeStyle = "rgba(120, 130, 72, 0.45)";
        ctx.lineWidth = 1;
        const gx = x * TILE + 8 + n * 200;
        const gy = y * TILE + 12 + tileNoise(x, y, 7) * 30;
        ctx.beginPath();
        ctx.moveTo(gx, gy); ctx.lineTo(gx - 3, gy - 8);
        ctx.moveTo(gx + 3, gy); ctx.lineTo(gx + 4, gy - 9);
        ctx.moveTo(gx + 6, gy); ctx.lineTo(gx + 9, gy - 5);
        ctx.stroke();
      } else if (n > 0.93) {
        ctx.fillStyle = "rgba(60, 56, 48, 0.7)";
        ctx.beginPath();
        ctx.ellipse(x * TILE + 12 + n * 30, y * TILE + 38, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(10, 7, 5, 0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }

  // vignette
  const vg = ctx.createRadialGradient(
    (w * TILE) / 2, (h * TILE) / 2, TILE,
    (w * TILE) / 2, (h * TILE) / 2, Math.max(w, h) * TILE * 0.62
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w * TILE, h * TILE);
}

function drawShadow(ctx, cx, cy) {
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFallbackToken(ctx, u, cx, cy) {
  ctx.beginPath();
  ctx.arc(cx, cy, 19, 0, Math.PI * 2);
  ctx.fillStyle = u.isBoss ? UNIT_COLOR.boss : (u.side === "player" ? UNIT_COLOR[u.cls] || UNIT_COLOR.ally : UNIT_COLOR.enemy);
  ctx.fill();
  ctx.strokeStyle = u.side === "player" ? "#d8f0c8" : "#f6dcc8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(CLASS_ICON[u.cls] || "⚔️", cx, cy + 1);
}

function drawUnitSprite(ctx, u, cx, cy, now, alpha = 1) {
  const img = spriteImage(u);
  if (!img) {
    drawFallbackToken(ctx, u, cx, cy);
    return;
  }

  const facing = u.face || (u.side === "player" ? 1 : -1);
  const seed = (u.uid.charCodeAt(u.uid.length - 1) || 0) % 4;
  const frame = Math.floor(now / 170 + seed) % FRAME_COUNT;

  // lunge toward the target when a blow lands
  let lunge = 0;
  if (u.attackAt && now - u.attackAt < 260) {
    lunge = Math.sin(((now - u.attackAt) / 260) * Math.PI) * 9 * facing;
  }

  const size = TILE * 1.2;
  const dx = cx - size / 2 + lunge;
  const dy = cy - size * 0.74;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx + lunge, cy);
  ctx.scale(facing, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
    -size / 2, -size * 0.74, size, size
  );

  // white flash when struck
  if (u.hitAt && now - u.hitAt < 170) {
    ctx.filter = "brightness(2.6) saturate(0)";
    ctx.drawImage(
      img,
      frame * FRAME_SIZE, 0, FRAME_SIZE, FRAME_SIZE,
      -size / 2, -size * 0.74, size, size
    );
    ctx.filter = "none";
  }
  ctx.restore();

  // keep the shadow anchored under the feet while the sprite lunges
  drawShadow(ctx, cx, cy);
}

function drawUnitBars(ctx, combat, u, cx, cy, now) {
  const bw = 40;
  const bx = cx - bw / 2;
  const by = cy - TILE * 0.74 - 6;

  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
  const hpW = (bw * Math.max(0, u.hp)) / Math.max(1, u.maxHp);
  const hpColor = u.side === "player"
    ? (hpW / bw > 0.5 ? "#7fae5a" : hpW / bw > 0.25 ? "#d8a53a" : "#c0392b")
    : "#a8322a";
  ctx.fillStyle = hpColor;
  ctx.fillRect(bx, by, hpW, 5);

  if (u.maxMp > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(bx - 1, by + 8, bw + 2, 5);
    ctx.fillStyle = "#7fa3e8";
    ctx.fillRect(bx, by + 8, (bw * Math.max(0, u.mp)) / Math.max(1, u.maxMp), 3);
  }

  ctx.fillStyle = u.side === "player" ? "#e6ecd8" : "#f0d8c8";
  ctx.font = "11px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(u.name + (u.isBoss ? " ★" : ""), cx, cy + 27);

  // subtle "recovering" pip so the slower pace is readable
  if (u.side === "player" && now < getCooldown(combat, u.uid)) {
    ctx.fillStyle = "rgba(216, 165, 58, 0.85)";
    ctx.beginPath();
    ctx.arc(cx + 24, cy - TILE * 0.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCombat(combat, canvas) {
  const ctx = canvas.getContext("2d");
  const { w, h } = combat.terrain;

  // keep the drawing buffer in sync with the map size (14-wide maps overflow a fixed canvas)
  if (canvas.width !== w * TILE) canvas.width = w * TILE;
  if (canvas.height !== h * TILE) canvas.height = h * TILE;

  const now = performance.now();
  drawGround(ctx, w, h);

  // reachable tiles under everything else
  if (combat.selectedId) {
    const sel = combat.units.find((u) => u.uid === combat.selectedId && u.alive);
    if (sel) {
      for (const t of combat.movable) {
        if (t.x === sel.x && t.y === sel.y) continue;
        ctx.fillStyle = "rgba(143, 202, 122, 0.13)";
        ctx.fillRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
        ctx.strokeStyle = "rgba(143, 202, 122, 0.55)";
        ctx.lineWidth = 1;
        ctx.strokeRect(t.x * TILE + 2, t.y * TILE + 2, TILE - 4, TILE - 4);
      }
    }
  }

  // selected-unit halo
  const selected = combat.units.find((u) => u.uid === combat.selectedId && u.alive);
  if (selected) {
    const sx = (selected.ax ?? selected.x) * TILE + TILE / 2;
    const sy = (selected.ay ?? selected.y) * TILE + TILE / 2;
    ctx.fillStyle = "rgba(255, 210, 122, 0.10)";
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4 * TILE, 0, Math.PI * 2);
    ctx.fill();
  }

  // light dim while paused (banner is drawn last)
  if (combat.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(0, 0, w * TILE, h * TILE);
  }

  // smooth positions, then paint back-to-front by row
  const visible = [];
  for (const u of combat.units) {
    if (u.ax === undefined) { u.ax = u.x; u.ay = u.y; }
    const dx = (u.x ?? u.ax) - u.ax;
    const dy = (u.y ?? u.ay) - u.ay;
    if (Math.abs(dx) > 0.2) u.face = Math.sign(dx);
    u.ax += dx * 0.16;
    u.ay += dy * 0.16;
    if (Math.abs(dx) < 0.01) u.ax = u.x;
    if (Math.abs(dy) < 0.01) u.ay = u.y;

    if (u.alive === false) {
      if (!u.diedAt || now - u.diedAt > DEATH_FADE) continue;
    }
    visible.push(u);
  }
  visible.sort((a, b) => (a.ay ?? a.y) - (b.ay ?? b.y));

  for (const u of visible) {
    const cx = (u.ax ?? u.x) * TILE + TILE / 2;
    const cy = (u.ay ?? u.y) * TILE + TILE / 2;

    // selection ring on the ground
    if (combat.selectedId === u.uid && u.alive) {
      ctx.strokeStyle = "#ffd27a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 16, 21, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (u.alive === false) {
      const t = Math.min(1, (now - u.diedAt) / DEATH_FADE);
      drawUnitSprite(ctx, u, cx, cy + t * 6, now, 1 - t * 0.9);
      continue;
    }

    drawUnitSprite(ctx, u, cx, cy, now);
    drawUnitBars(ctx, combat, u, cx, cy, now);
  }

  // pause banner on top of everything
  if (combat.paused) {
    ctx.fillStyle = "rgba(12, 8, 5, 0.88)";
    ctx.fillRect(0, h * TILE - 48, w * TILE, 48);
    ctx.strokeStyle = "rgba(216, 165, 58, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, h * TILE - 47.5, w * TILE - 1, 47);
    ctx.fillStyle = "#ffd27a";
    ctx.font = "bold 20px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED — give orders, then resume", (w * TILE) / 2, h * TILE - 24);
  }
}
