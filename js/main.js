// ============================================================
//  Rage of the Mage — game bootstrap
// ============================================================
import { gameState, createCharacter } from "./state.js";
import { showScreen, renderCombat, renderStory, renderEnd, renderCompanions, renderQuests, renderStats, renderHow, onCombatCanvasClick, endTurnCombat, newJourney, startCombatLoop, stopCombatLoop, finishCombat } from "./ui.js";
import { autoCombat } from "./combat.js";
import { preloadSprites } from "./sprites.js";
import { startPassage } from "./story.js";

function bind(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

let selectedClass = null;

function updateClassSelection() {
  document.getElementById("class-warrior")?.classList.toggle("selected", selectedClass === "warrior");
  document.getElementById("class-mage")?.classList.toggle("selected", selectedClass === "mage");
}

function bindCreateScreen() {
  bind("class-warrior", () => { selectedClass = "warrior"; gameState.cls = "warrior"; updateClassSelection(); });
  bind("class-mage", () => { selectedClass = "mage"; gameState.cls = "mage"; updateClassSelection(); });
  bind("btn-start", startGame);
  bind("btn-back-title", () => showScreen("title"));
}

function boot() {
  preloadSprites();

  // Title screen buttons (exist in initial HTML)
  bind("btn-new-journey", () => { selectedClass = null; updateClassSelection(); showScreen("create"); bindCreateScreen(); });
  bind("btn-back-title", () => showScreen("title"));

  // How to Play
  bind("btn-how", () => { renderHow(); showScreen("how"); });

  // Companions / Quests (title entry points)
  bind("btn-companions", () => { renderCompanions(); showScreen("companions"); });
  bind("btn-quests", () => { renderQuests(); showScreen("quests"); });

  // Combat canvas + pause
  const canvas = document.getElementById("combat-canvas");
  if (canvas) canvas.addEventListener("click", (e) => onCombatCanvasClick(e));
  bind("btn-combat-endturn", () => endTurnCombat());

  showScreen("title");
}

// Debug handle for testing from the console: __rage.gameState, __rage.autoCombat(...)
window.__rage = { gameState, autoCombat, finishCombat, renderCombat };

function startGame() {
  const cls = gameState.cls || "warrior";
  gameState.character = createCharacter(cls, (document.getElementById("hero-name") || {}).value || "Garion");
  startPassage("the-orb-stolen");
  renderStory();
  showScreen("story");
}

boot();
