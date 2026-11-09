// ============================================================
//  Rage of the Mage — UI / screen rendering
// ============================================================
import { CLASSES, ALLIES, QUESTS, ENDINGS, SPELLS, GAME } from "./data.js";
import { gameState, characterToUnit, createAllyUnit, applyXp, startCombat, resolveAttack, manhattan, currentUnit } from "./state.js";
import { startPassage, renderPassage, chooseChoice, resumeAfterCombatVictory } from "./story.js";
import { drawCombat, tryPlayerAction, combatSay, selectUnit, CLASS_ICON, getCooldown, getSpellCooldown, autoCombat } from "./combat.js";

const SCREENS = ["title", "create", "story", "combat", "end", "companions", "quests", "stats", "how"];

export function showScreen(name) {
  gameState.screen = name;
  for (const s of SCREENS) {
    const el = document.getElementById(`screen-${s}`);
    if (el) el.classList.toggle("active", s === name);
  }
}

// ---------------------------------------------------------------
//  Screen: Combat
// ---------------------------------------------------------------
export function renderCombat() {
  const combat = gameState.combat;
  const nameEl = document.getElementById("combat-encounter-name");
  const phaseEl = document.getElementById("combat-phase");
  const logEl = document.getElementById("combat-log");
  const unitsEl = document.getElementById("combat-units");
  const actionsEl = document.getElementById("combat-actions");
  const canvas = document.getElementById("combat-canvas");
  if (!combat) return;
  if (nameEl) nameEl.textContent = combat.name;
  const cur = currentUnit(combat);
  if (phaseEl) phaseEl.textContent = combat.phase === "over"
    ? (combat.result === "victory" ? "Victory" : "Defeat")
    : `Your move — ${cur ? cur.name : ""}`;
  if (logEl) logEl.innerHTML = combat.log.map((l) => `<div>${l}</div>`).join("");
  if (unitsEl) {
    let html = "";
    for (const u of combat.units) {
      if (!u.alive) continue;
      const icon = u.side === "player" ? (CLASS_ICON[u.cls] || "⚔️") : "💀";
      const sideLabel = u.side === "player" ? "Hero" : "Enemy";
      const bossTag = u.isBoss ? " ★ BOSS" : "";
      html += `<div class="list-item"><span class="name">${icon} ${u.name}${bossTag}</span><span class="meta">${sideLabel} · HP ${u.hp}/${u.maxHp}${u.mp ? ` · MP ${u.mp}/${u.maxMp}` : ""}${u.moves ? ` · Move ${u.moves}` : ""}</div>`;
    }
    unitsEl.innerHTML = html;
  }
  if (actionsEl) {
    actionsEl.innerHTML = "";
    const cur2 = combat.units.find((u) => u.uid === combat.selectedId);
    if (combat.phase === "real-time" && cur2 && cur2.side === "player" && cur2.alive) {
      const holder = document.createElement("div");
      holder.className = "list-item";
      holder.innerHTML = `<span class="name">${cur2.name}</span><span class="meta">HP ${cur2.hp}/${cur2.maxHp}${cur2.mp ? ` · MP ${cur2.mp}/${cur2.maxMp}` : ""}</span>`;
      const spellsWrap = document.createElement("div");
      spellsWrap.className = "row";
      for (const sid of cur2.spells || []) {
        const s = SPELLS[sid];
        if (!s) continue;
        const now = performance.now();
        const onCd = now < getSpellCooldown(combat, cur2.uid, s.id);
        const affordable = cur2.mp >= s.cost && !onCd;
        const btn = document.createElement("button");
        btn.className = "btn btn-small";
        btn.type = "button";
        btn.textContent = `Cast ${s.name} (${s.cost} MP)`;
        btn.disabled = !affordable;
        btn.addEventListener("click", () => castSpellAtSelected(combat, cur2, sid));
        spellsWrap.appendChild(btn);
      }
      holder.appendChild(spellsWrap);
      const pauseBtn = document.createElement("button");
      pauseBtn.className = "btn btn-primary";
      pauseBtn.type = "button";
      pauseBtn.textContent = combat.paused ? "Resume" : "Pause";
      pauseBtn.addEventListener("click", () => tryPlayerAction(combat, { type: "pause" }));
      holder.appendChild(pauseBtn);
      actionsEl.appendChild(holder);
    }
  }
  if (canvas) drawCombat(combat, canvas);
}

export function renderStory() {
  renderPassage();
}

export function castSpellAtSelected(combat, unit, spellId) {
  const cur = combat.units.find((u) => u.uid === combat.selectedId);
  if (!cur || cur.uid !== unit.uid) return false;
  const spell = SPELLS[spellId];
  if (!spell) return false;
  const enemies = combat.units.filter((u) => u.side === "enemy" && u.alive);
  if (!enemies.length) return false;
  let target = null;
  let best = Infinity;
  for (const e of enemies) {
    const d = manhattan(unit, e);
    if (d < best) { best = d; target = e; }
  }
  if (!target) return false;
  if (spell.type === "heal") {
    const allies = combat.units.filter((u) => u.side === "player" && u.alive);
    let allyTarget = null; let bestA = Infinity;
    for (const a of allies) { const d = manhattan(unit, a); if (d < bestA) { bestA = d; allyTarget = a; } }
    if (allyTarget && allyTarget.hp > 0 && allyTarget.hp < allyTarget.maxHp) {
      allyTarget.hp += spell.power;
      combat.log.push(`${unit.name} casts ${spell.name} on ${allyTarget.name} for ${spell.power}.`);
      return true;
    }
    return false;
  }
  if (manhattan(unit, target) < 1) { combat.log.push(`${unit.name} is too close to cast ${spell.name}.`); return false; }
  if (manhattan(unit, target) > spell.range) { combat.log.push(`${unit.name} cannot reach ${spell.name}.`); return false; }
  if (unit.mp < spell.cost) { combat.log.push(`${unit.name} lacks mana for ${spell.name}.`); return false; }
  unit.mp -= spell.cost;
  const res = resolveAttack(combat, unit, target, spell);
  combat.log.push(`${unit.name} casts ${spell.name} on ${target.name} for ${res.dmg}.`);
  if (target.hp <= 0) target.alive = false;
  return true;
}

export function endTurnCombat() {
  const combat = gameState.combat;
  if (!combat) return;
  tryPlayerAction(combat, { type: "pause" });
  renderCombat();
  if (combat.phase === "over") {
    stopCombatLoop();
    if (combat.result === "victory") {
      gameState.ending = ENDINGS["the-sleeper"];
      resumeAfterCombatVictory();
      renderStory();
      showScreen("story");
    } else if (combat.result === "defeat") {
      gameState.ending = ENDINGS["the-black-legion"];
      showScreen("end");
    }
  }
}

let combatRaf = null;
let lastTime = 0;

export function startCombatLoop() {
  lastTime = performance.now();
  function frame(now) {
    if (!gameState.combat || gameState.combat.phase === "over") {
      combatRaf = null;
      return;
    }
    const dt = now - lastTime;
    lastTime = now;
    autoCombat(gameState.combat, dt);
    renderCombat();
    combatRaf = requestAnimationFrame(frame);
  }
  combatRaf = requestAnimationFrame(frame);
}

export function stopCombatLoop() {
  if (combatRaf) cancelAnimationFrame(combatRaf);
  combatRaf = null;
}

// ---------------------------------------------------------------
//  Screen: End
// ---------------------------------------------------------------
export function renderEnd() {
  const endEl = document.getElementById("end-kicker");
  const titleEl = document.getElementById("end-title");
  const textEl = document.getElementById("end-text");
  const btnsEl = document.getElementById("end-buttons");
  const e = gameState.ending;
  if (!e) {
    if (endEl) endEl.textContent = "The End";
    if (titleEl) titleEl.textContent = "The End";
    if (textEl) textEl.innerHTML = "<p>You have no memory of this.</p>";
    if (btnsEl) btnsEl.innerHTML = `<button class="btn btn-primary" id="btn-end-new">New Journey</button>`;
    return;
  }
  if (endEl) endEl.textContent = e.kicker;
  if (titleEl) titleEl.textContent = e.title;
  if (textEl) {
    textEl.innerHTML = "";
    for (const para of e.text) {
      const p = document.createElement("p");
      p.className = "end-para";
      p.textContent = para;
      textEl.appendChild(p);
    }
  }
  if (btnsEl) btnsEl.innerHTML = `<button class="btn btn-primary" id="btn-end-new">New Journey</button>`;
  bind("end-new", newJourney);
}

// ---------------------------------------------------------------
//  Screen: Companions / Quests / Stats / How
// ---------------------------------------------------------------
export function renderCompanions() {
  const listEl = document.getElementById("companions-list");
  if (!listEl) return;
  if (!gameState.allies.length) {
    listEl.innerHTML = `<div class="list-item"><span class="meta">No companions yet. Journey onward through the story.</span></div>`;
    bindBack("companions-back");
    return;
  }
  let html = "";
  for (const aid of gameState.allies) {
    const a = ALLIES[aid];
    if (!a) continue;
    html += `<div class="list-item"><span class="name">${a.name} <span class="meta">(${a.epithet})</span></span><span class="meta">${a.desc}</span></div>`;
  }
  listEl.innerHTML = html;
  bindBack("companions-back");
}

export function renderQuests() {
  const listEl = document.getElementById("quests-list");
  if (!listEl) return;
  let html = "";
  for (const q of QUESTS) {
    html += `<div class="list-item"><span class="name">${q.name}</span><div class="quest-stage">Stage: ${q.stages[q.stageIndex] || q.stages[0]}</div></div>`;
  }
  listEl.innerHTML = html;
  bindBack("quests-back");
}

export function renderStats() {
  const sheetEl = document.getElementById("stats-sheet");
  if (!sheetEl) return;
  const c = gameState.character;
  if (!c) { sheetEl.innerHTML = "<p>No hero yet.</p>"; bindBack("stats-back"); return; }
  sheetEl.innerHTML = `
    <div class="stat-row"><span>Hero</span><span>${c.name}</span></div>
    <div class="stat-row"><span>Class</span><span>${CLASSES[c.cls]?.name || c.cls}</span></div>
    <div class="stat-row"><span>Level</span><span>${c.level}</span></div>
    <div class="stat-row"><span>XP</span><span>${c.xp}</span></div>
    <div class="stat-row"><span>HP</span><span>${c.hp}/${c.maxHp}</span></div>
    <div class="stat-row"><span>MP</span><span>${c.mp}/${c.maxMp}</span></div>
    <div class="stat-row"><span>Attack</span><span>${c.atk}</span></div>
    <div class="stat-row"><span>Defense</span><span>${c.def}</span></div>
    <div class="stat-row"><span>Magic</span><span>${c.magic}</span></div>
    <div class="stat-row"><span>Spells</span><span>${(c.spells || []).join(", ") || "—"}</span></div>
    <div class="stat-row"><span>Weapon</span><span>${c.weapon || "—"}</span></div>
  `;
  bindBack("stats-back");
}

export function renderHow() {
  const el = document.getElementById("screen-how");
  if (!el) return;
  el.innerHTML = `
    <div class="panel">
      <h2>How to Play</h2>
      <p>You are the hero of the age. Choose <b>Warrior</b> (sword &amp; bow, rage) or <b>Mage</b> (staff &amp; sorcery — the Will and the Word).</p>
      <p>Walk the story. Make choices. Fight the <b>Black Legions</b> in tactical battles.</p>
      <ul>
        <li>Move with click-to-move (highlight shows reachable tiles).</li>
        <li>Click an enemy to strike or cast.</li>
        <li>Wizards cast spells spending Mana; warriors strike or use <em>Power Strike</em>.</li>
        <li>Press <b>End Turn</b> when ready.</li>
        <li>Recruit companions through the story; your party holds three heroes.</li>
      </ul>
      <button class="btn btn-primary" id="btn-how-back">Back</button>
    </div>
  `;
  bindBack("how-back");
}

// ---------------------------------------------------------------
//  Combat canvas input
// ---------------------------------------------------------------
export function onCombatCanvasClick(e) {
  const canvas = document.getElementById("combat-canvas");
  if (!canvas || gameState.screen !== "combat" || !gameState.combat) return;
  const combat = gameState.combat;
  if (combat.phase === "over") return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * combat.terrain.w);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * combat.terrain.h);
  const enemy = combat.units.find((u) => u.alive && u.side === "enemy" && u.x === x && u.y === y) || null;
  const own = combat.units.find((u) => u.alive && u.side === "player" && u.x === x && u.y === y) || null;
  if (enemy) {
    const res = tryPlayerAction(combat, { type: "attack", targetUid: enemy.uid });
    renderCombat();
    return;
  }
  if (own) {
    selectUnit(combat, own.uid);
    renderCombat();
    return;
  }
  if (combat.selectedId) {
    const u = combat.units.find((x2) => x2.uid === combat.selectedId);
    if (u && u.alive) {
      u.x = x; u.y = y;
      combat.movable = [];
      combat.selectedId = null;
      renderCombat();
    }
    return;
  }
}

// ---------------------------------------------------------------
//  Actions
// ---------------------------------------------------------------
export function newJourney() {
  gameState.character = null;
  gameState.allies = [];
  gameState.passageId = "the-orb-stolen";
  gameState.combat = null;
  gameState.ending = null;
  gameState.flags = {};
  gameState.quest.stageIndex = 0;
  showScreen("create");
}

// Small helpers to bind back buttons rendered dynamically
function bindBack(id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", () => showScreen("title"));
}

function bind(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}
