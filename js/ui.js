// ============================================================
//  Rage of the Mage — UI / screen rendering
// ============================================================
import { CLASSES, ALLIES, QUESTS, ENDINGS, SPELLS, GAME } from "./data.js";
import { gameState, characterToUnit, createAllyUnit, applyXp, startCombat, manhattan } from "./state.js";
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
function combatCanvasEl() {
  return document.getElementById("combat-canvas");
}

function renderCombatHeader(combat) {
  const nameEl = document.getElementById("combat-encounter-name");
  const phaseEl = document.getElementById("combat-phase");
  const logEl = document.getElementById("combat-log");
  if (nameEl) nameEl.textContent = combat.name;
  const hudBtn = document.getElementById("btn-combat-endturn");
  if (hudBtn && combat.phase !== "over") hudBtn.textContent = combat.paused ? "▶ Resume" : "⏸ Pause";
  const alive = combat.units.filter((u) => u.alive);
  if (phaseEl) {
    phaseEl.textContent = combat.phase === "over"
      ? (combat.result === "victory" ? "Victory" : "Defeat")
      : combat.paused
        ? "Paused — give orders, then resume"
        : `Battle raging — ${alive.filter((u) => u.side === "player").length} of yours, ${alive.filter((u) => u.side === "enemy").length} of theirs`;
  }
  if (logEl) {
    const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 8;
    logEl.innerHTML = combat.log.map((l) => `<div>${l}</div>`).join("");
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;
  }
}

function renderCombatUnits(combat) {
  const unitsEl = document.getElementById("combat-units");
  if (!unitsEl) return;
  let html = "";
  for (const u of combat.units) {
    if (!u.alive) continue;
    const icon = u.side === "player" ? (CLASS_ICON[u.cls] || "⚔️") : "💀";
    const sideLabel = u.side === "player" ? "Hero" : "Enemy";
    const bossTag = u.isBoss ? " ★ BOSS" : "";
    html += `<div class="list-item"><span class="name">${icon} ${u.name}${bossTag}</span><span class="meta">${sideLabel} · HP ${u.hp}/${u.maxHp}${u.mp ? ` · MP ${u.mp}/${u.maxMp}` : ""}</span></div>`;
  }
  unitsEl.innerHTML = html;
}

let lastActionsSig = "";

function renderCombatActions(combat, force) {
  const actionsEl = document.getElementById("combat-actions");
  if (!actionsEl) return;
  const cur = combat.units.find((u) => u.uid === combat.selectedId && u.alive) || null;
  const sig = [
    combat.selectedId,
    combat.paused,
    combat.phase,
    cur ? `${cur.uid}:${cur.hp}:${cur.mp}` : "-",
    combat.units.filter((u) => u.alive).map((u) => `${u.uid}:${u.hp}:${u.mp}`).join(","),
  ].join("|");
  if (!force && sig === lastActionsSig) return;
  lastActionsSig = sig;

  actionsEl.innerHTML = "";
  const holder = document.createElement("div");
  holder.className = "list-item";

  if (cur) {
    holder.innerHTML = `<span class="name">${CLASS_ICON[cur.cls] || "⚔️"} ${cur.name}</span><span class="meta">HP ${cur.hp}/${cur.maxHp}${cur.mp ? ` · MP ${cur.mp}/${cur.maxMp}` : ""}</span>`;
    const spellsWrap = document.createElement("div");
    spellsWrap.className = "row";
    for (const sid of cur.spells || []) {
      const s = SPELLS[sid];
      if (!s) continue;
      const now = performance.now();
      const onCd = now < getSpellCooldown(combat, cur.uid, s.id);
      const btn = document.createElement("button");
      btn.className = "btn btn-small";
      btn.type = "button";
      btn.textContent = onCd ? `${s.name} (recovering)` : `Cast ${s.name} (${s.cost} MP)`;
      btn.disabled = cur.mp < s.cost || onCd;
      btn.addEventListener("click", () => {
        const ok = castSpellAtSelected(combat, cur, sid);
        renderCombat();
        if (!ok) combatSay(combat, `${cur.name} cannot cast ${s.name} yet.`);
      });
      spellsWrap.appendChild(btn);
    }
    holder.appendChild(spellsWrap);
  } else {
    holder.innerHTML = `<span class="name">No hero selected</span><span class="meta">Click one of your tokens on the battlefield</span>`;
  }

  const pauseBtn = document.createElement("button");
  pauseBtn.id = "btn-combat-pause";
  pauseBtn.className = "btn btn-primary";
  pauseBtn.type = "button";
  pauseBtn.textContent = combat.paused ? "▶ Resume" : "⏸ Pause";
  pauseBtn.addEventListener("click", () => {
    tryPlayerAction(combat, { type: "pause" });
    renderCombat();
  });
  holder.appendChild(pauseBtn);

  actionsEl.appendChild(holder);
}

export function renderCombat() {
  const combat = gameState.combat;
  if (!combat) return;
  renderCombatHeader(combat);
  renderCombatUnits(combat);
  renderCombatActions(combat, true);
  const canvas = combatCanvasEl();
  if (canvas) drawCombat(combat, canvas);
}

export function renderCombatLive() {
  const combat = gameState.combat;
  if (!combat) return;
  renderCombatHeader(combat);
  renderCombatUnits(combat);
  renderCombatActions(combat, false);
  const canvas = combatCanvasEl();
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
  let targetUid = null;
  if (spell.type === "damage") {
    let target = null;
    let best = Infinity;
    for (const e of combat.units.filter((u) => u.side === "enemy" && u.alive)) {
      const d = manhattan(unit, e);
      if (d < best) { best = d; target = e; }
    }
    if (!target) return false;
    targetUid = target.uid;
  }
  const res = tryPlayerAction(combat, { type: "cast", spellId, targetUid });
  return res.ok;
}

export function endTurnCombat() {
  const combat = gameState.combat;
  if (!combat) return;
  if (combat.phase !== "over") tryPlayerAction(combat, { type: "pause" });
  const hudBtn = document.getElementById("btn-combat-endturn");
  if (hudBtn) hudBtn.textContent = combat.paused ? "▶ Resume" : "⏸ Pause";
  renderCombat();
  if (combat.phase === "over") {
    finishCombat(combat);
  }
}

let combatRaf = null;
let lastTime = 0;
let lastPanel = 0;
let combatOverHandled = null;

export function finishCombat(combat) {
  if (!combat || combatOverHandled === combat) return;
  combatOverHandled = combat;
  renderCombat();
  if (combat.result === "victory") {
    if (gameState.character && combat.xpReward) applyXp(gameState.character, combat.xpReward);
    resumeAfterCombatVictory();
    renderStory();
    showScreen("story");
  } else {
    gameState.ending = ENDINGS["the-black-legion"];
    renderEnd();
    showScreen("end");
  }
}

export function startCombatLoop() {
  stopCombatLoop();
  combatOverHandled = null;
  lastActionsSig = "";
  lastTime = performance.now();
  lastPanel = 0;

  function frame(now) {
    const combat = gameState.combat;
    if (!combat) { combatRaf = null; return; }

    const dt = Math.min(100, now - lastTime);
    lastTime = now;

    if (combat.phase !== "over") autoCombat(combat, dt);

    if (combat.phase === "over") {
      combatRaf = null;
      finishCombat(combat);
      return;
    }

    // canvas animates every frame; the DOM panels only refresh a few times a second
    const canvas = combatCanvasEl();
    if (canvas) drawCombat(combat, canvas);
    if (now - lastPanel > 250) {
      lastPanel = now;
      renderCombatHeader(combat);
      renderCombatUnits(combat);
      renderCombatActions(combat, false);
    }
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
    bind("end-new", newJourney);
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
      <p>Walk the story. Make choices. Fight the <b>Black Legions</b> in real-time battles.</p>
      <ul>
        <li>The battle flows on its own — your heroes and the dead close in and trade blows.</li>
        <li><b>Pause</b> to give orders: click one of your tokens to select it, click empty ground to move it, click an enemy to strike.</li>
        <li>Spells cost Mana and need time to recover; watch the red ring when a hero is mid-swing.</li>
        <li>Recruit companions through the story; your party grows as the tale unfolds.</li>
        <li>You win when the last enemy falls — and the story carries on.</li>
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
  if (x < 0 || y < 0 || x >= combat.terrain.w || y >= combat.terrain.h) return;

  const enemy = combat.units.find((u) => u.alive && u.side === "enemy" && u.x === x && u.y === y) || null;
  const own = combat.units.find((u) => u.alive && u.side === "player" && u.x === x && u.y === y) || null;

  if (own) {
    selectUnit(combat, own.uid);
    renderCombat();
    return;
  }

  if (enemy) {
    // the selected hero acts; if nobody is selected, the nearest hero steps up
    let actor = combat.units.find((u) => u.uid === combat.selectedId && u.alive && u.side === "player") || null;
    if (!actor) {
      actor = nearestTo(combat, enemy, "player");
      if (actor) selectUnit(combat, actor.uid);
    }
    if (!actor) { renderCombat(); return; }

    let res = tryPlayerAction(combat, { type: "attack", targetUid: enemy.uid });
    if (!res.ok) {
      const dmgSpell = (actor.spells || [])
        .map((sid) => SPELLS[sid])
        .filter((s) => s && s.type === "damage" && actor.mp >= s.cost)
        .sort((a, b) => (b.power || 0) - (a.power || 0))[0];
      if (dmgSpell) res = tryPlayerAction(combat, { type: "cast", spellId: dmgSpell.id, targetUid: enemy.uid });
    }
    if (!res.ok) {
      const why = res.reason === "cooldown" ? "still recovering"
        : res.reason === "out-of-range" ? "out of range — move closer first"
        : "cannot act right now";
      combatSay(combat, `${actor.name}: ${why}.`);
    }
    renderCombat();
    return;
  }

  // empty ground: move the selected hero there
  if (combat.selectedId) {
    const u = combat.units.find((u2) => u2.uid === combat.selectedId);
    if (u && u.alive) {
      u.x = x;
      u.y = y;
      u.face = 1;
      combat.movable = [];
      renderCombat();
    }
    return;
  }

  const hero = nearestTo(combat, { x, y }, "player");
  if (hero) {
    selectUnit(combat, hero.uid);
    renderCombat();
  }
}

function nearestTo(combat, point, side) {
  let best = null;
  let bestDist = Infinity;
  for (const u of combat.units) {
    if (!u.alive || u.side !== side) continue;
    const d = manhattan(point, u);
    if (d < bestDist) { bestDist = d; best = u; }
  }
  return best;
}

// ---------------------------------------------------------------
//  Actions
// ---------------------------------------------------------------
export function newJourney() {
  stopCombatLoop();
  combatOverHandled = null;
  lastActionsSig = "";
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
