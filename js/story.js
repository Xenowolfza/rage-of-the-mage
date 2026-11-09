// ============================================================
//  Rage of the Mage — story / passage engine
// ============================================================
import { PASSAGES, ENDINGS, QUESTS } from "./data.js";
import { gameState, startCombat, characterToUnit, createAllyUnit, applyXp } from "./state.js";
import { showScreen, renderCombat, startCombatLoop } from "./ui.js";
import { startCombatRealTime } from "./combat.js";

export function getPassage(id) {
  return PASSAGES[id] || PASSAGES["the-orb-stolen"];
}

export function startPassage(id) {
  gameState.passageId = id;
}

export function renderPassage() {
  const p = getPassage(gameState.passageId);
  const kickerEl = document.getElementById("passage-kicker");
  const titleEl = document.getElementById("passage-title");
  const textEl = document.getElementById("passage-text");
  const choicesEl = document.getElementById("passage-choices");
  if (kickerEl) kickerEl.textContent = p.kicker;
  if (titleEl) titleEl.textContent = p.title;
  if (textEl) {
    textEl.innerHTML = "";
    for (const para of p.paragraphs) {
      const div = document.createElement("p");
      div.className = "passage-para";
      div.textContent = para;
      textEl.appendChild(div);
    }
  }
  if (choicesEl) {
    choicesEl.innerHTML = "";
    if (p.choices.length) {
      for (const c of p.choices) {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.type = "button";
        btn.textContent = c.text;
        btn.addEventListener("click", () => chooseChoice(gameState.passageId, c));
        choicesEl.appendChild(btn);
      }
    }
  }
  // quest stage tracking
  if (gameState.quest) {
    const stageName = p.kicker ? p.kicker.split("—")[0].trim() : null;
    if (stageName) {
      const idx = gameState.quest.stages.indexOf(stageName);
      if (idx >= 0) gameState.quest.stageIndex = idx;
    }
  }
}

export function renderStory() {
  renderPassage();
}

function applyEffect(effect) {
  if (!effect) return;
  if (effect.combat) {
    const partyUnits = [];
    const heroUnit = (gameState.character ? characterToUnit(gameState.character) : null);
    if (heroUnit) partyUnits.push(heroUnit);
    for (const ally of gameState.allies) partyUnits.push(createAllyUnit(ally));
    gameState.pendingNext = effect.next || "the-fellowship";
    gameState.combat = startCombat(effect.combat, partyUnits, gameState.pendingNext);
    startCombatRealTime(gameState.combat);
    gameState.screen = "combat";
    renderCombat();
    showScreen("combat");
    startCombatLoop();
  }
  if (effect.recruit) {
    if (!gameState.allies.includes(effect.recruit)) gameState.allies.push(effect.recruit);
  }
  if (effect.xp) { if (gameState.character) applyXp(gameState.character, effect.xp); }
  if (effect.flag) gameState.flags[effect.flag.key] = effect.flag.value;
  if (effect.questStage) {
    const q = gameState.quest;
    const idx = q.stages.indexOf(effect.questStage);
    if (idx >= 0) q.stageIndex = idx;
  }
  if (effect.ending) {
    gameState.ending = ENDINGS[effect.ending] || ENDINGS["the-sleeper"];
    gameState.screen = "end";
  }
}

export function chooseChoice(passageId, choice) {
  const p = PASSAGES[passageId];
  const idx = p.choices.findIndex((c) => c.text === choice.text);
  const c = p.choices[idx];
  applyEffect(c.effect);
  if (c.next) startPassage(c.next);
  renderStory();
}

export function resumeAfterCombatVictory() {
  const combat = gameState.combat;
  const nextId = combat ? combat.returnPassage : "the-fellowship";
  startPassage(nextId);
}

export { QUESTS };
