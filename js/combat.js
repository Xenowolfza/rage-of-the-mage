// ============================================================
//  Rage of the Mage — real-time combat engine (Rage of Mage 2 style)
// ============================================================
import { SPELLS, GRID } from "./data.js";
import { computeMovable, manhattan, resolveAttack, checkCombatEnd, unitByUid } from "./state.js";

export const CLASS_ICON = { warrior: "⚔️", mage: "🔥", ranger: "🏹" };
const UNIT_COLOR = {
  warrior: "#5a9e6a",
  mage: "#7fa3e8",
  ranger: "#c9a227",
  ally: "#5a9e6a",
  enemy: "#c0392b",
  boss: "#a8322a",
};

// Timing
const ATTACK_DELAY = 1100;   // ms between auto-attacks
const SPELL_COOLDOWN = 1900; // ms between spell casts
const MOVE_SPEED = 0.25;     // tiles per second (smooth movement)
const OPENING_GRACE = 1400;  // ms of quiet before the armies engage

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
  for (const u of playerUnits) { u.x = 1 + (pi % 3); u.y = 4 + Math.floor(pi / 3); pi++; }
  let ei = 0;
  for (const u of enemyUnits) { u.x = combat.terrain.w - 2 - (ei % 3); u.y = 3 + Math.floor(ei / 3); ei++; }
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

const MOVE_DELAY = 320; // ms between AI movement steps
const ENEMY_ATTACK_DELAY = 1350; // the dead are slow — heroes swing a little faster

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
//  Canvas rendering (real-time)
// ---------------------------------------------------------------
export function drawCombat(combat, canvas) {
  const ctx = canvas.getContext("2d");
  const { w, h } = combat.terrain;
  const ts = 56;

  // keep the drawing buffer in sync with the map size (14-wide maps overflow a fixed canvas)
  if (canvas.width !== w * ts) canvas.width = w * ts;
  if (canvas.height !== h * ts) canvas.height = h * ts;

  const gradient = ctx.createLinearGradient(0, 0, w * ts, h * ts);
  gradient.addColorStop(0, "#1a140e");
  gradient.addColorStop(1, "#261e14");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w * ts, h * ts);

  // grid tiles
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#241c14" : "#2e241a";
      ctx.fillRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
      ctx.strokeStyle = "#16100c";
      ctx.strokeRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
    }
  }

  // pause dim (banner is drawn after the units)
  if (combat.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w * ts, h * ts);
  }

  // units
  const sorted = [...combat.units].sort((a, b) => {
    if (a.side === b.side) return 0;
    return a.side === "player" ? -1 : 1;
  });

  const now = performance.now();
  for (const u of sorted) {
    if (u.alive === false) continue;
    const cx = u.x * ts + ts / 2;
    const cy = u.y * ts + ts / 2;

    // selection ring
    if (combat.selectedId === u.uid) {
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffd27a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // move-range halo
    if (combat.selectedId === u.uid) {
      ctx.fillStyle = "rgba(143, 202, 122, 0.12)";
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * ts, 0, Math.PI * 2);
      ctx.fill();
    }

    // cooldown flash
    const cd = getCooldown(combat, u.uid);
    const flashing = now < cd && u.side === "player";
    if (flashing) {
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.strokeStyle = "#c0392b";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // sprite token
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.fillStyle = u.isBoss ? UNIT_COLOR.boss : (u.side === "player" ? UNIT_COLOR[u.cls] || UNIT_COLOR.ally : UNIT_COLOR.enemy);
    ctx.fill();
    ctx.strokeStyle = u.side === "player" ? "#d8f0c8" : "#f6dcc8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // class icon
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(CLASS_ICON[u.cls] || "⚔️", cx, cy + 1);

    // hp bar
    const bw = 36;
    const bx = cx - bw / 2;
    const by = cy - 28;
    ctx.fillStyle = "#000";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = u.side === "player" ? "#7fae5a" : "#c0392b";
    ctx.fillRect(bx, by, (bw * Math.max(0, u.hp)) / Math.max(1, u.maxHp), 4);

    // mana bar
    if (u.mp && u.maxMp > 0) {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(bx - 1, by + 7, bw + 2, 4);
      ctx.fillStyle = "#7fa3e8";
      ctx.fillRect(bx, by + 7, (bw * Math.max(0, u.mp)) / Math.max(1, u.maxMp), 3);
    }

    // name
    ctx.fillStyle = u.side === "player" ? "#d8dcc8" : "#f0d8c8";
    ctx.font = "11px Georgia, serif";
    ctx.fillText(u.name, cx, cy + 28);

    // boss star
    if (u.isBoss) {
      ctx.fillStyle = "#ffd27a";
      ctx.font = "14px serif";
      ctx.fillText("★", cx + 24, cy - 26);
    }
  }

  // movable tiles
  if (combat.selectedId) {
    const u = combat.units.find((x) => x.uid === combat.selectedId);
    if (u && u.alive) {
      for (const t of combat.movable) {
        if (t.x === u.x && t.y === u.y) continue;
        ctx.fillStyle = "rgba(143, 202, 122, 0.14)";
        ctx.fillRect(t.x * ts + 2, t.y * ts + 2, ts - 4, ts - 4);
        ctx.strokeStyle = "rgba(143, 202, 122, 0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(t.x * ts + 2, t.y * ts + 2, ts - 4, ts - 4);
      }
    }
  }

  // pause banner on top of everything
  if (combat.paused) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h * ts - 46, w * ts, 46);
    ctx.fillStyle = "#ffd27a";
    ctx.font = "bold 20px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED — give orders, then resume", (w * ts) / 2, h * ts - 23);
  }
}
