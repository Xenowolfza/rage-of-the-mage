// ============================================================
//  Rage of the Mage — game state, characters, units, combat setup
// ============================================================
import { CLASSES, ALLIES, ENEMIES, SPELLS, ENCOUNTERS } from "./data.js";

let counter = 1;
export const uid = (prefix) => `${prefix}-${counter++}`;

export function createCharacter(clsId, name) {
  const cls = CLASSES[clsId];
  const character = {
    name: name || "Garion",
    cls: clsId,
    hp: cls.hp,
    maxHp: cls.hp,
    mp: cls.mp,
    maxMp: cls.mp,
    atk: cls.atk,
    def: cls.def,
    magic: cls.magic,
    level: 1,
    xp: 0,
    spells: [...cls.spells],
    weapon: cls.weapon || null,
    weaponBonus: cls.weaponBonus || 0,
    bow: cls.bow || null,
    bowRange: cls.bowRange || 0,
    moves: cls.moves,
  };
  return character;
}

export function createAllyUnit(allyId) {
  const t = ALLIES[allyId];
  if (!t) return null;
  return {
    uid: uid("ally"),
    side: "player",
    kind: allyId,
    name: t.name,
    epithet: t.epithet,
    cls: t.cls,
    hp: t.hp, maxHp: t.hp,
    mp: t.mp, maxMp: t.mp,
    atk: t.atk, def: t.def, magic: t.magic,
    moves: t.moves,
    spells: [...t.spells],
    weapon: t.weapon, weaponBonus: t.weaponBonus, bow: t.bow, bowRange: t.bowRange,
    desc: t.desc,
    isAlly: true, isPlayer: true, isBoss: false, alive: true,
    x: 4, y: 3,
  };
}

export function createEnemyUnit(enemyId) {
  const t = ENEMIES[enemyId];
  if (!t) return null;
  return {
    uid: uid("enm"),
    side: "enemy",
    kind: enemyId,
    name: t.name,
    cls: "undead",
    hp: t.hp, maxHp: t.hp,
    mp: 0, maxMp: 0,
    atk: t.atk, def: t.def, magic: t.magic, magicDef: t.magicDef,
    moves: t.moves,
    spells: [...t.spells],
    weaponBonus: t.weaponBonus,
    desc: t.desc,
    isAlly: false, isPlayer: false, isBoss: !!t.isBoss, alive: true,
    x: 4, y: 3,
  };
}

export function applyXp(character, amount) {
  character.xp += amount;
  const need = character.level * 30;
  while (character.xp >= need) {
    character.xp -= need;
    character.level += 1;
    character.maxHp += 8; character.hp += 8;
    character.maxMp += 3; character.mp += 3;
    character.atk += 1; character.def += 1; character.magic += 1;
    if (character.cls === "mage") {
      if (character.level >= 2 && !character.spells.includes("flame")) character.spells.push("flame");
      if (character.level >= 4 && !character.spells.includes("spirit-light")) character.spells.push("spirit-light");
    }
  }
}

export function startCombat(encounterId, partyUnits, returnPassage) {
  const enc = ENCOUNTERS[encounterId];
  const units = [...partyUnits];
  for (const eid of enc.enemyIds) units.push(createEnemyUnit(eid));
  const playerUnits = units.filter((u) => u.side === "player");
  const enemyUnits = units.filter((u) => u.side === "enemy");
  const order = [...playerUnits.map((u) => u.uid), ...enemyUnits.map((u) => u.uid)];
  const combat = {
    id: encounterId,
    name: enc.name,
    tagline: enc.tagline,
    phase: "player",
    result: null,
    units,
    order,
    idx: 0,
    selectedId: null,
    movable: [],
    log: [],
    returnPassage: returnPassage || "the-fellowship",
    xpReward: enc.xpReward,
    terrain: { ...enc.terrain },
  };
  return combat;
}

export function unitByUid(combat, uidStr) {
  return combat.units.find((u) => u.uid === uidStr) || null;
}

export function currentUnit(combat) {
  if (combat.phase === "over") return null;
  const u = combat.units.find((x) => x.uid === combat.order[combat.idx]);
  return u || null;
}

export function enemyAlive(combat) {
  return combat.units.some((u) => u.side === "enemy" && u.alive);
}

export function playerAlive(combat) {
  return combat.units.some((u) => u.side === "player" && u.alive);
}

export function endUnitTurn(combat) {
  combat.idx = (combat.idx + 1) % combat.order.length;
  const u = combat.units.find((x) => x.uid === combat.order[combat.idx]);
  combat.phase = u.side === "player" ? "player" : "ai";
}

export function checkCombatEnd(combat) {
  const foesAlive = combat.units.some((u) => u.side === "enemy" && u.alive);
  const heroesAlive = combat.units.some((u) => u.side === "player" && u.alive);
  if (!foesAlive) { combat.phase = "over"; combat.result = "victory"; return true; }
  if (!heroesAlive) { combat.phase = "over"; combat.result = "defeat"; return true; }
  return false;
}

// BFS movement
export function computeMovable(combat, unit) {
  const { w, h } = combat.terrain;
  const dist = new Map();
  dist.set(`${unit.x},${unit.y}`, 0);
  const queue = [{ x: unit.x, y: unit.y, d: 0 }];
  const reachable = [];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d > 0) reachable.push({ x: cur.x, y: cur.y, dist: cur.d });
    if (cur.d >= unit.moves) continue;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (dist.has(key)) continue;
      dist.set(key, cur.d + 1);
      queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return reachable;
}

export function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

export function resolveAttack(combat, attacker, defender, spell) {
  let dmg, kind;
  if (spell) {
    dmg = Math.round(attacker.magic * 0.6) + (spell.power || 0) - defender.def - (defender.magicDef || 0);
    kind = `spell:${spell.id}`;
  } else {
    dmg = attacker.atk + (attacker.weaponBonus || 0) - defender.def;
    if (attacker.powerStriking) dmg = Math.round(dmg * 1.5);
    kind = "strike";
  }
  const crit = Math.random() < 0.15;
  if (crit) dmg = Math.round(dmg * 1.5);
  dmg = Math.max(1, dmg);
  defender.hp = Math.max(0, defender.hp - dmg);
  combat.log.push(
    spell
      ? `${attacker.name} casts ${spell.name} at ${defender.name} for ${dmg}${crit ? " (CRIT!)" : ""}.`
      : `${attacker.name} strikes ${defender.name} for ${dmg}${crit ? " (CRIT!)" : ""}.`
  );
  if (combat.log.length > 80) combat.log.shift();
  if (defender.hp <= 0) defender.alive = false;
  return { dmg, kind, crit };
}

export const gameState = {
  screen: "title",
  cls: null,
  character: null,
  allies: [],
  passageId: "the-orb-stolen",
  combat: null,
  quest: { name: "The War of the Sleeping God", stages: ["The Theft", "The Fellowship", "The Black Legions", "The End"], stageIndex: 0 },
  flags: {},
  ending: null,
  pendingNext: null,
};

export function characterToUnit(character) {
  if (!character) return null;
  return {
    uid: uid("hero"),
    side: "player",
    kind: "hero",
    name: character.name,
    cls: character.cls,
    hp: character.hp, maxHp: character.maxHp,
    mp: character.mp, maxMp: character.maxMp,
    atk: character.atk, def: character.def, magic: character.magic,
    moves: character.moves,
    spells: [...character.spells],
    weapon: character.weapon, weaponBonus: character.weaponBonus, bow: character.bow, bowRange: character.bowRange,
    powerStriking: character.cls === "warrior",
    isAlly: false, isPlayer: true, isBoss: false, alive: true,
    x: 4, y: 3,
  };
}
