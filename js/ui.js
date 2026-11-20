// ============================================================
//  Rage of the Mage — UI / screen rendering
// ============================================================
import { CLASSES, ALLIES, QUESTS, ENDINGS, SPELLS, GAME } from "./data.js";
import { gameState, characterToUnit, createAllyUnit, applyXp, startCombat, manhattan } from "./state.js";
import { startPassage, renderPassage, chooseChoice, resumeAfterCombatVictory } from "./story.js";
import { drawCombat, tryPlayerAction, combatSay, selectUnit, CLASS_ICON, getCooldown, getSpellCooldown, autoCombat, nudgeUnit } from "./combat.js";

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

function actionButton(label, disabled, onClick, active) {
  const btn = document.createElement("button");
  btn.className = "btn btn-small" + (active ? " active" : "");
  btn.type = "button";
  btn.textContent = label;
  btn.disabled = !!disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function selectedHero(combat) {
  return combat.units.find((u) => u.uid === combat.selectedId && u.alive && u.side === "player") || null;
}

function reachFor(unit, mode) {
  if (mode === "aimed") return (unit.bowRange || 4) + 1;
  if (mode === "strike" && unit.bow) return unit.bowRange || 4;
  return 1;
}

function nearestEnemyInReach(combat, actor, mode) {
  const reach = reachFor(actor, mode);
  let best = null;
  let bestDist = Infinity;
  for (const e of combat.units) {
    if (!e.alive || e.side !== "enemy") continue;
    const d = manhattan(actor, e);
    if (d < 1 || d > reach) continue;
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function reasonText(reason) {
  switch (reason) {
    case "cooldown": return "still recovering";
    case "out-of-range": return "out of range — move closer first";
    case "dash-recovery": return "still off balance from the dash";
    case "no-mana": return "not enough mana";
    case "no-path": return "no way through";
    case "no-heal-target": return "no one needs healing";
    case "no-target": return "no target";
    case "blocked": return "the way is blocked";
    case "edge": return "the map edge";
    case "recovering": return "still moving";
    case "no-selection": return "no hero selected";
    default: return "cannot act right now";
  }
}

export function performAttack(mode = "strike") {
  const combat = gameState.combat;
  if (!combat || combat.phase === "over") return false;
  const actor = selectedHero(combat);
  if (!actor) { combatSay(combat, "Select a hero first — click a token or press 1–4."); renderCombat(); return false; }
  const target = nearestEnemyInReach(combat, actor, mode);
  if (!target) { combatSay(combat, `${actor.name}: no foe in reach — move closer or use another action.`); renderCombat(); return false; }
  const res = tryPlayerAction(combat, { type: "attack", mode, targetUid: target.uid });
  if (!res.ok) combatSay(combat, `${actor.name}: ${reasonText(res.reason)}.`);
  renderCombat();
  return res.ok;
}

export function armSpell(spellId) {
  const combat = gameState.combat;
  if (!combat) return false;
  const actor = selectedHero(combat);
  if (!actor) { combatSay(combat, "Select a hero before casting."); renderCombat(); return false; }
  const spell = SPELLS[spellId];
  if (!spell) return false;
  if (combat.pendingSpell === spellId) {
    combat.pendingSpell = null;
    combatSay(combat, "Spell cancelled.");
  } else {
    combat.pendingSpell = spellId;
    combatSay(combat, `${actor.name} readies ${spell.name} — choose a ${spell.type === "damage" ? "foe" : "companion"} on the field.`);
  }
  renderCombat();
  return true;
}

export function guardSelected() {
  const combat = gameState.combat;
  if (!combat || combat.phase === "over") return;
  const res = tryPlayerAction(combat, { type: "guard" });
  if (!res.ok) combatSay(combat, "Select a hero first.");
  renderCombat();
}

export function toggleHold() {
  const combat = gameState.combat;
  if (!combat || combat.phase === "over") return;
  const res = tryPlayerAction(combat, { type: "hold" });
  if (!res.ok) combatSay(combat, "Select a hero first.");
  renderCombat();
}

export function toggleDash() {
  const combat = gameState.combat;
  if (!combat || combat.phase === "over") return;
  combat.dashMode = !combat.dashMode;
  combatSay(combat, combat.dashMode
    ? "Dash ready — the next move covers twice the ground, but leaves the hero open."
    : "Dash cancelled.");
  renderCombat();
}

export function nudgeSelected(dx, dy) {
  const combat = gameState.combat;
  if (!combat || combat.phase === "over") return { ok: false, reason: "over" };
  if (!combat.selectedId) {
    const first = combat.units.find((u) => u.side === "player" && u.alive);
    if (first) selectUnit(combat, first.uid);
  }
  const res = nudgeUnit(combat, combat.selectedId, dx, dy);
  if (!res.ok) {
    const actor = selectedHero(combat);
    if (actor && res.reason !== "over") combatSay(combat, `${actor.name}: ${reasonText(res.reason)}.`);
  }
  renderCombat();
  return res;
}

function cycleHero(dir) {
  const combat = gameState.combat;
  if (!combat) return;
  const heroes = combat.units.filter((u) => u.side === "player" && u.alive);
  if (!heroes.length) return;
  const idx = heroes.findIndex((u) => u.uid === combat.selectedId);
  const next = heroes[(idx + dir + heroes.length) % heroes.length];
  selectUnit(combat, next.uid);
  combat.pendingSpell = null;
  renderCombat();
}

export function onCombatKey(e) {
  const combat = gameState.combat;
  if (!combat || gameState.screen !== "combat" || combat.phase === "over") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (key === " " || key === "Spacebar") {
    e.preventDefault();
    tryPlayerAction(combat, { type: "pause" });
    renderCombat();
    return;
  }
  if (key === "Escape") {
    combat.pendingSpell = null;
    combat.selectedId = null;
    combat.movable = [];
    renderCombat();
    return;
  }
  if (key === "Tab") {
    e.preventDefault();
    cycleHero(e.shiftKey ? -1 : 1);
    return;
  }
  if (/^[1-9]$/.test(key)) {
    const heroes = combat.units.filter((u) => u.side === "player" && u.alive);
    const hero = heroes[Number(key) - 1];
    if (hero) { selectUnit(combat, hero.uid); combat.pendingSpell = null; renderCombat(); }
    return;
  }
  if (lower === "q" || lower === "e" || lower === "r" || lower === "t") {
    const slot = { q: 0, e: 1, r: 2, t: 3 }[lower];
    const actor = selectedHero(combat);
    const sid = actor && (actor.spells || [])[slot];
    if (sid) armSpell(sid);
    return;
  }
  if (lower === "g") { guardSelected(); return; }
  if (lower === "h") { toggleHold(); return; }
  if (lower === "f") { toggleDash(); return; }

  const steps = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  };
  const step = steps[key] || steps[lower];
  if (step) {
    e.preventDefault();
    nudgeSelected(step[0], step[1]);
  }
}

export function renderCombatControls(combat) {
  const chips = document.getElementById("combat-hero-chips");
  if (chips) {
    const heroes = combat.units.filter((u) => u.side === "player" && u.alive);
    const sig = heroes.map((u, i) => `${i}:${u.uid}:${u.hp}:${combat.selectedId === u.uid ? 1 : 0}`).join("|");
    if (chips.dataset.sig !== sig) {
      chips.dataset.sig = sig;
      chips.innerHTML = "";
      heroes.forEach((u, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-small hero-chip" + (combat.selectedId === u.uid ? " active" : "");
        b.innerHTML = `<span class="chip-key">${i + 1}</span> ${u.name} <span class="chip-hp">${u.hp}/${u.maxHp}</span>`;
        b.addEventListener("click", () => {
          selectUnit(combat, u.uid);
          combat.pendingSpell = null;
          renderCombat();
        });
        chips.appendChild(b);
      });
    }
  }

  const sel = selectedHero(combat);
  const now = performance.now();

  const holdBtn = document.getElementById("btn-combat-hold");
  if (holdBtn) {
    holdBtn.disabled = !sel;
    holdBtn.textContent = sel && sel.hold ? "Hold ✓" : "Hold";
    holdBtn.classList.toggle("active", !!(sel && sel.hold));
  }

  const dashBtn = document.getElementById("btn-combat-dash");
  if (dashBtn) {
    dashBtn.textContent = combat.dashMode ? "Dash ✓" : "Dash";
    dashBtn.classList.toggle("active", !!combat.dashMode);
  }

  const guardBtn = document.getElementById("btn-combat-guard");
  if (guardBtn) {
    const guarding = !!(sel && now < (sel.guardUntil || 0));
    guardBtn.disabled = !sel;
    guardBtn.textContent = guarding ? "Guard ◆" : "Guard";
    guardBtn.classList.toggle("active", guarding);
  }

  const canvas = combatCanvasEl();
  if (canvas) canvas.style.cursor = combat.pendingSpell ? "crosshair" : "pointer";
}

function renderCombatActions(combat, force) {
  const actionsEl = document.getElementById("combat-actions");
  if (!actionsEl) return;
  const cur = selectedHero(combat);
  const now = performance.now();
  const cdLeft = cur ? Math.max(0, getCooldown(combat, cur.uid) - now) : 0;
  const sig = [
    combat.selectedId,
    combat.paused,
    combat.phase,
    combat.pendingSpell,
    cur ? `${cur.uid}:${cur.hp}:${cur.mp}:${cur.hold ? 1 : 0}:${cur.guardUntil > now ? 1 : 0}:${Math.ceil(cdLeft / 500)}` : "-",
    combat.units.filter((u) => u.alive).map((u) => `${u.uid}:${u.hp}:${u.mp}`).join(","),
  ].join("|");
  if (!force && sig === lastActionsSig) return;
  lastActionsSig = sig;

  actionsEl.innerHTML = "";
  const holder = document.createElement("div");
  holder.className = "list-item";

  if (cur) {
    const status = cur.hold ? "holding ground" : "advancing";
    holder.innerHTML = `<span class="name">${CLASS_ICON[cur.cls] || "⚔️"} ${cur.name}</span><span class="meta">HP ${cur.hp}/${cur.maxHp}${cur.mp ? ` · MP ${cur.mp}/${cur.maxMp}` : ""} · ${status}</span>`;

    // attacks
    const atkRow = document.createElement("div");
    atkRow.className = "row";
    const recovering = cdLeft > 0;
    const cdTag = recovering ? ` (${(cdLeft / 1000).toFixed(1)}s)` : "";
    atkRow.appendChild(actionButton(`Strike${cdTag}`, recovering, () => performAttack("strike")));
    if (cur.canPower) atkRow.appendChild(actionButton(`Power Strike${cdTag}`, recovering, () => performAttack("power")));
    if (cur.canCleave) atkRow.appendChild(actionButton(`Cleave${cdTag}`, recovering, () => performAttack("cleave")));
    if (cur.canAim) atkRow.appendChild(actionButton(`Aimed Shot${cdTag}`, recovering, () => performAttack("aimed")));
    holder.appendChild(atkRow);

    // stances
    const stanceRow = document.createElement("div");
    stanceRow.className = "row";
    stanceRow.appendChild(actionButton(cur.hold ? "Hold ✓" : "Hold", false, toggleHold, cur.hold));
    stanceRow.appendChild(actionButton(now < (cur.guardUntil || 0) ? "Guard ◆" : "Guard", false, guardSelected, now < (cur.guardUntil || 0)));
    holder.appendChild(stanceRow);

    // spells — arming one lets you pick the target
    const spells = (cur.spells || []).map((sid) => SPELLS[sid]).filter(Boolean);
    if (spells.length) {
      const spellRow = document.createElement("div");
      spellRow.className = "row";
      spells.forEach((s, i) => {
        const onCd = now < getSpellCooldown(combat, cur.uid, s.id);
        const armed = combat.pendingSpell === s.id;
        const key = ["Q", "E", "R", "T"][i] || "";
        const label = `${key ? `${key} · ` : ""}${s.name}${onCd ? " (recovering)" : ` (${s.cost} MP)`}`;
        spellRow.appendChild(actionButton(label, cur.mp < s.cost || onCd, () => armSpell(s.id), armed));
      });
      holder.appendChild(spellRow);
    }

    if (combat.pendingSpell) {
      const s = SPELLS[combat.pendingSpell];
      const hint = document.createElement("div");
      hint.className = "combat-hint armed";
      hint.textContent = `${s.name} armed — click a ${s.type === "damage" ? "foe" : "companion"} (Esc cancels).`;
      holder.appendChild(hint);
    }
  } else {
    holder.innerHTML = `<span class="name">No hero selected</span><span class="meta">Click a token, or press 1–4 / Tab.</span>`;
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
  renderCombatControls(combat);
  const canvas = combatCanvasEl();
  if (canvas) drawCombat(combat, canvas);
}

export function renderCombatLive() {
  const combat = gameState.combat;
  if (!combat) return;
  renderCombatHeader(combat);
  renderCombatUnits(combat);
  renderCombatActions(combat, false);
  renderCombatControls(combat);
  const canvas = combatCanvasEl();
  if (canvas) drawCombat(combat, canvas);
}

export function renderStory() {
  renderPassage();
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
        <li>The battle flows on its own — <b>pause</b> at any time (Space) to give orders.</li>
        <li><b>Move:</b> click empty ground and the selected hero walks as far as their stride allows, or nudge them a tile at a time with <b>WASD / arrow keys</b>. <b>Dash</b> (F) doubles the next stride but leaves the hero open for a moment. <b>Hold</b> (H) keeps a hero on their ground instead of charging.</li>
        <li><b>Attack:</b> click an enemy to strike. Warriors also have <b>Power Strike</b> (heavy blow), <b>Cleave</b> (sweeps nearby foes) and <b>Aimed Shot</b> with a bow. <b>Guard</b> (G) trades a moment of attack for +3 defense.</li>
        <li><b>Cast:</b> click a spell (hotkeys Q/E/R/T), then click a target. Flame of Aldur spreads to the dead beside its victim; Spirit Light and Shield of the Will must be cast on a companion.</li>
        <li>Hotkeys: 1–4 select a hero, Tab cycles, Esc cancels an armed spell, Space pauses.</li>
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
  const armed = combat.pendingSpell ? SPELLS[combat.pendingSpell] : null;
  let actor = selectedHero(combat);

  // an armed spell resolves against the next click
  if (armed) {
    const target = armed.type === "damage" ? enemy : own;
    if (!actor && target && armed.type === "damage") {
      actor = nearestTo(combat, target, "player");
      if (actor) selectUnit(combat, actor.uid);
    }
    if (!actor) { combatSay(combat, "Select a hero before casting."); renderCombat(); return; }
    if (target) {
      const res = tryPlayerAction(combat, { type: "cast", spellId: armed.id, targetUid: target.uid });
      if (res.ok) combat.pendingSpell = null;
      else combatSay(combat, `${actor.name}: ${reasonText(res.reason)}.`);
      renderCombat();
      return;
    }
    combatSay(combat, `Choose a ${armed.type === "damage" ? "foe" : "companion"} in range — Esc cancels.`);
    return;
  }

  if (own) {
    selectUnit(combat, own.uid);
    renderCombat();
    return;
  }

  if (enemy) {
    // the selected hero acts; if nobody is selected, the nearest hero steps up
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
    if (!res.ok) combatSay(combat, `${actor.name}: ${reasonText(res.reason)}.`);
    renderCombat();
    return;
  }

  // empty ground: move the selected hero as far toward that spot as the stride allows
  if (!actor) {
    const hero = nearestTo(combat, { x, y }, "player");
    if (hero) { selectUnit(combat, hero.uid); renderCombat(); }
    return;
  }
  const res = tryPlayerAction(combat, { type: "move", x, y, dash: !!combat.dashMode });
  if (!res.ok) combatSay(combat, `${actor.name}: ${reasonText(res.reason)}.`);
  if (res.ok && combat.dashMode) combat.dashMode = false;
  renderCombat();
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
