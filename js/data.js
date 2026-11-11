// ============================================================
//  Rage of the Mage — game data (David Eddings / Belgarath setting)
// ============================================================

export const GAME = {
  title: "Rage of the Mage",
  subtitle: "In the world of Belgarath the Sorcerer",
  tagline: "In the age before the sleeping god stirred, the dead began to rise.",
};

export const GRID = { w: 10, h: 8, tile: 56 };

// ---------------------------------------------------------------
//  Magic / spell definitions (Sorcery = the Will and the Word)
// ---------------------------------------------------------------
export const SPELLS = {
  "will-bolt": {
    id: "will-bolt",
    name: "Will Bolt",
    school: "Sorcery",
    cost: 2,
    type: "damage",
    power: 10,
    range: 4,
    target: "enemy",
    desc: "A bolt of pure will. Single target.",
  },
  flame: {
    id: "flame",
    name: "Flame of Aldur",
    school: "Sorcery",
    cost: 3,
    type: "damage",
    power: 14,
    range: 3,
    target: "enemy",
    area: 1,
    desc: "Fire magic from the teachings of Aldur. Burns through the dead.",
  },
  "spirit-light": {
    id: "spirit-light",
    name: "Spirit Light",
    school: "Sorcery",
    cost: 2,
    type: "heal",
    power: 8,
    range: 3,
    target: "ally",
    desc: "Divine spirit light. Restores life to the fallen.",
  },
};

// ---------------------------------------------------------------
//  Character classes
// ---------------------------------------------------------------
export const CLASSES = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    icon: "⚔️",
    hp: 40,
    mp: 0,
    atk: 8,
    def: 6,
    magic: 0,
    moves: 3,
    weapon: "Rivan Steel Longsword",
    weaponBonus: 2,
    bow: "Hunter's Bow",
    bowRange: 4,
    spells: [],
    desc: "Sword and bow. High heart, steady blade. Wields the Rage — the Power Strike.",
  },
  mage: {
    id: "mage",
    name: "Mage",
    icon: "🔥",
    hp: 30,
    mp: 16,
    atk: 3,
    def: 3,
    magic: 9,
    moves: 2,
    weapon: "Staff of Aldur",
    weaponBonus: 1,
    spells: ["will-bolt", "flame"],
    desc: "Staff and sorcery — the Will and the Word. Spells of will, flame and spirit.",
  },
};

// ---------------------------------------------------------------
//  Allies
// ---------------------------------------------------------------
export const ALLIES = {
  belgarath: {
    id: "belgarath",
    name: "Belgarath",
    epithet: "The Old Wolf",
    cls: "mage",
    hp: 30, mp: 10, atk: 2, def: 2, magic: 8, moves: 2,
    spells: ["will-bolt", "flame", "spirit-light"],
    weapon: null, weaponBonus: 0, bow: null, bowRange: 0,
    desc: "Keeper of the Will and the Word. Seven thousand years old. The mentor of the age.",
  },
  polgara: {
    id: "polgara",
    name: "Polgara",
    epithet: "The Sorceress",
    cls: "warrior",
    hp: 34, mp: 8, atk: 7, def: 5, magic: 6, moves: 2,
    spells: ["flame", "spirit-light"],
    weapon: "Polgara's blade",
    weaponBonus: 2, bow: null, bowRange: 0,
    desc: "Sorceress-knight of the old line. Fierce, loyal, terrifying in battle.",
  },
  durnik: {
    id: "durnik",
    name: "Durnik",
    epithet: "The Blacksmith",
    cls: "warrior",
    hp: 44, mp: 0, atk: 9, def: 7, magic: 0, moves: 3,
    spells: [], weapon: "Durnik's hammer", weaponBonus: 2, bow: null, bowRange: 0,
    desc: "Blacksmith and warrior. Iron will, iron heart.",
  },
  silk: {
    id: "silk",
    name: "Silk",
    epithet: "The Scout",
    cls: "ranger",
    hp: 26, mp: 0, atk: 7, def: 4, magic: 0, moves: 4,
    spells: [], weapon: "Silk's blade", weaponBonus: 1, bow: "Silk's bow", bowRange: 5,
    desc: "Scout and spy of the old fellowship. Quick as a shadow.",
  },
  barak: {
    id: "barak",
    name: "Barak",
    epithet: "The Warrior",
    cls: "warrior",
    hp: 38, mp: 0, atk: 8, def: 6, magic: 0, moves: 3,
    spells: [], weapon: "Barak's axe", weaponBonus: 2, bow: null, bowRange: 0,
    desc: "Warrior of the old kingdoms. Old blood, old rage.",
  },
};

// ---------------------------------------------------------------
//  Enemies (the Black Legions / undead of the sleeping god)
// ---------------------------------------------------------------
export const ENEMIES = {
  skeleton: {
    id: "skeleton", name: "Skeleton", kind: "undead", isBoss: false,
    hp: 18, maxHp: 18, atk: 4, def: 2, magic: 0, magicDef: 0, moves: 2,
    spells: [], weaponBonus: 1, desc: "Risen from forgotten graves.",
  },
  zombie: {
    id: "zombie", name: "Zombie", kind: "undead", isBoss: false,
    hp: 26, maxHp: 26, atk: 5, def: 1, magic: 0, magicDef: 0, moves: 2,
    spells: [], weaponBonus: 0, desc: "The dead that hungered too long.",
  },
  ghoul: {
    id: "ghoul", name: "Ghoul", kind: "undead", isBoss: false,
    hp: 22, maxHp: 22, atk: 5, def: 1, magic: 0, magicDef: 0, moves: 3,
    spells: [], weaponBonus: 1, desc: "A pale runner of the fens. Quick and hungry.",
  },
  wraith: {
    id: "wraith", name: "Wraith", kind: "undead", isBoss: false,
    hp: 24, maxHp: 24, atk: 3, def: 2, magic: 8, magicDef: 5, moves: 3,
    spells: ["will-bolt"], weaponBonus: 0, desc: "A shadow that remembers being a man.",
  },
  wight: {
    id: "wight", name: "Wight", kind: "undead", isBoss: false,
    hp: 32, maxHp: 32, atk: 7, def: 3, magic: 0, magicDef: 0, moves: 2,
    spells: [], weaponBonus: 1, desc: "A chieftain of the dead.",
  },
  karand: {
    id: "karand", name: "Karand Zombie", kind: "undead", isBoss: false,
    hp: 42, maxHp: 42, atk: 6, def: 4, magic: 0, magicDef: 2, moves: 2,
    spells: [], weaponBonus: 2, desc: "The dead who walk in armour out of Karanda.",
  },
  witch: {
    id: "witch", name: "Fen Witch", kind: "witch", isBoss: true,
    hp: 56, maxHp: 56, atk: 4, def: 3, magic: 12, magicDef: 6, moves: 2,
    spells: ["flame", "will-bolt"], weaponBonus: 0, desc: "The Witch of the Fens. Old trade, older prices.",
  },
  necromancer: {
    id: "necromancer", name: "Necromancer", kind: "undead", isBoss: true,
    hp: 64, maxHp: 64, atk: 4, def: 3, magic: 11, magicDef: 4, moves: 2,
    spells: ["flame", "will-bolt"], weaponBonus: 0, desc: "Wielder of the dark art. The shadow behind the horde.",
  },
};

// ---------------------------------------------------------------
//  Encounters (tactical combat)
// ---------------------------------------------------------------
export const ENCOUNTERS = {
  "the-raid": {
    id: "the-raid",
    name: "The Fallen Hall",
    tagline: "Hold the dark at the door.",
    terrain: { w: 10, h: 8 },
    enemyIds: ["skeleton", "zombie"],
    xpReward: 20,
  },
  "the-ambush": {
    id: "the-ambush",
    name: "Night of Wolves",
    tagline: "Out of the dark, on two legs.",
    terrain: { w: 12, h: 8 },
    enemyIds: ["ghoul", "ghoul", "skeleton", "wraith"],
    xpReward: 30,
  },
  "the-fens": {
    id: "the-fens",
    name: "The Fens of Vordai",
    tagline: "The dead do not forgive the living who sleep.",
    terrain: { w: 12, h: 8 },
    enemyIds: ["skeleton", "zombie", "wight", "wraith"],
    xpReward: 35,
  },
  "the-witch-hut": {
    id: "the-witch-hut",
    name: "The Witch's Hut",
    tagline: "Old trade. Older prices.",
    terrain: { w: 12, h: 8 },
    enemyIds: ["witch", "wraith", "ghoul"],
    xpReward: 45,
  },
  "the-bridge": {
    id: "the-bridge",
    name: "The Old Stone Bridge",
    tagline: "The only crossing for a hundred miles.",
    terrain: { w: 14, h: 8 },
    enemyIds: ["karand", "karand", "wraith", "ghoul"],
    xpReward: 45,
  },
  "black-legions": {
    id: "black-legions",
    name: "The Black Legions",
    tagline: "When the dead march, only the living can answer.",
    terrain: { w: 14, h: 8 },
    enemyIds: ["zombie", "skeleton", "wight", "ghoul", "necromancer"],
    xpReward: 70,
  },
};

// ---------------------------------------------------------------
//  Story passages
// ---------------------------------------------------------------
export const PASSAGES = {
  "the-orb-stolen": {
    id: "the-orb-stolen",
    kicker: "Act I — The Theft",
    title: "The Orb of Aldur",
    paragraphs: [
      "Three nights before the moon took the color of old blood, the Orb of Aldur left the Rivan King's hall. The servants of the sleeping god came through the dark, and the dead answered the call.",
      "Belgarath the Sorcerer came to you at the edge of the fens — the Old Wolf, older than the kingdoms, keeper of the Will and the Word. “The Black Legions have risen,” he said. “And the Orb… the Orb is gone.”",
      "He looked at you the way he had looked at a thousand heroes before: the way a man looks at the sword already in his hand, or the staff already in his grip.",
    ],
    choices: [
      { text: "Stand with Belgarath and the fellowship.", next: "the-hall" },
      { text: "Ride out ahead of the Black Legions.", next: "the-hall" },
    ],
  },
  "the-hall": {
    id: "the-hall",
    kicker: "Act I — The Fallen Hall",
    title: "The Fallen Hall",
    paragraphs: [
      "You fought your way into the ruined hall. The Orb was not there — only the black tide, only the dead that Belgarath had promised would answer the sleeper’s call.",
      "“They took the Orb,” Belgarath said, “and they woke the sleepers. You are the shield I did not know I was preparing for.”",
      "The dead came pouring through the ash-choked doors. You met the first of the Black Legions.",
    ],
    choices: [
      { text: "Fight the Black Legions.", next: "the-fellowship", effect: { combat: "the-raid" } },
    ],
  },
  "the-fellowship": {
    id: "the-fellowship",
    kicker: "Act II — The Fellowship",
    title: "The Old Wolf's Armory",
    paragraphs: [
      "After the hall, Belgarath opened the armory of old stories and began to gather the fellowship that would walk the road.",
      "The Old Wolf spoke of Silk the scout, of Durnik the blacksmith, of Polgara the sorceress, of Barak the warrior. Each carried old debts from the last war with the dead.",
    ],
    choices: [
      { text: "Silk will ride with you.", next: "the-fellowship-2", effect: { recruit: "silk", questStage: "The Fellowship" } },
      { text: "Durnik will ride with you.", next: "the-fellowship-2", effect: { recruit: "durnik", questStage: "The Fellowship" } },
    ],
  },
  "the-fellowship-2": {
    id: "the-fellowship-2",
    kicker: "Act II — The Fellowship",
    title: "Two of the Living",
    paragraphs: [
      "“Two of the living will walk,” Belgarath said. “The road through the fens is not kind to lone wolves.”",
      "You chose your first companion. Now the second.",
    ],
    choices: [
      { text: "Polgara will lend her sorcery.", next: "the-road", effect: { recruit: "polgara" } },
      { text: "Barak will lend his axe.", next: "the-road", effect: { recruit: "barak" } },
    ],
  },
  "the-road": {
    id: "the-road",
    kicker: "Act II — The Long Road",
    title: "The Long Road",
    paragraphs: [
      "The road east was empty the way roads are only empty before a war — everyone with sense had already hidden.",
      "Milestones stood with their names chiselled off, so the dead could not read where they were going.",
      "Night fell faster than the road allowed. The fellowship had a choice to make.",
    ],
    choices: [
      { text: "Make camp at the roadside inn.", next: "the-ambush", effect: { questStage: "The Long Road" } },
      { text: "Push on through the dark.", next: "the-ambush", effect: { questStage: "The Long Road" } },
    ],
  },
  "the-ambush": {
    id: "the-ambush",
    kicker: "Act II — Night of Wolves",
    title: "Night of Wolves",
    paragraphs: [
      "They came out of the dark on two legs — pale runners of the fens, and a shadow that remembered being a man.",
      "“Ghouls,” Belgarath said, and reached for the Will. “And worse.”",
    ],
    choices: [
      { text: "Hold the firelight and fight.", next: "the-campfires", effect: { combat: "the-ambush" } },
    ],
  },
  "the-campfires": {
    id: "the-campfires",
    kicker: "Act II — Campfires",
    title: "Campfires",
    paragraphs: [
      "When the last ghoul fell, the night went quiet, and Belgarath sat down on a stone like a very old man who had earned the right.",
      "“One more walker joins, or one more gift is given,” he said. “Choose, and be careful about it.”",
    ],
    choices: [
      { text: "Belgarath will ride with you.", next: "the-fens", effect: { recruit: "belgarath" } },
      { text: "Take the Old Wolf's blessing for yourself.", next: "the-fens", effect: { bless: true } },
    ],
  },
  "the-fens": {
    id: "the-fens",
    kicker: "Act II — The Fens of Vordai",
    title: "The Fens of Vordai",
    paragraphs: [
      "The fens went quiet the way a grave goes quiet — everything already dead, everything listening.",
      "The fellowship made camp by the black waters. And the dead found them.",
    ],
    choices: [
      { text: "Meet the Black Legions in the fens.", next: "the-witch-hut", effect: { combat: "the-fens", questStage: "The Fens of Vordai" } },
    ],
  },
  "the-witch-hut": {
    id: "the-witch-hut",
    kicker: "Act III — The Witch of the Fens",
    title: "The Witch's Hut",
    paragraphs: [
      "Past the drowned trees stood a hut on bird-legs, and in its doorway a bent figure with a staff of root and bone.",
      "“You carry will,” the Witch of the Fens said. “My kind carried it before Aldur ever spoke. Let us weigh whose is heavier.”",
      "Beside her, shapes peeled away from the mud — shadows with faces, and a pale runner smiling.",
    ],
    choices: [
      { text: "Draw steel. The dead stay dead.", next: "the-bridge", effect: { combat: "the-witch-hut", questStage: "The Witch of the Fens" } },
      { text: "Answer her riddle with the Will.", next: "the-bridge", effect: { combat: "the-witch-hut", questStage: "The Witch of the Fens" } },
    ],
  },
  "the-bridge": {
    id: "the-bridge",
    kicker: "Act III — The Old Stone Bridge",
    title: "The Old Stone Bridge",
    paragraphs: [
      "The bridge was older than the kingdoms, and it was the only crossing for a hundred miles in any direction.",
      "On the far side, armoured dead out of Karanda waited with the patience of things that never tire.",
      "“We cross,” Belgarath said, “or we spend the war on the wrong bank.”",
    ],
    choices: [
      { text: "Take the crossing.", next: "the-black-legions", effect: { combat: "the-bridge" } },
    ],
  },
  "the-black-legions": {
    id: "the-black-legions",
    kicker: "Act IV — The Black Legions",
    title: "The Black Legions",
    paragraphs: [
      "The dead marched on the last free ground. Belgarath did not pray. He reached for the Will and the Word, and the fellowship answered.",
      "The living stood against the horde — and the shadow behind it.",
    ],
    choices: [
      { text: "Rally the living and strike the Black Legions.", next: "the-ending", effect: { combat: "black-legions", questStage: "The End" } },
    ],
  },
  "the-ending": {
    id: "the-ending",
    kicker: "Act III — The End",
    title: "The End of the Sleeping",
    paragraphs: [
      "The battle ended as all old wars end: with fire, will, and the terrible arithmetic of the dead.",
      "The horde broke. The necromancer fell. And the sleeping god… did not wake.",
    ],
    choices: [
      { text: "Claim the silence.", next: "the-ending-victory", effect: { ending: "the-sleeper" } },
    ],
  },
  "the-ending-victory": {
    id: "the-ending-victory",
    kicker: "Epilogue",
    title: "The Silence After",
    paragraphs: [
      "You did not kill a god. You made the dead listen — and then you sent them back to their rest.",
      "Belgarath the Sorcerer bowed his old head, and the Will and the Word sang quiet in his blood.",
      "The world of men had bought its one night of peace. It would not last. But tonight, the dead slept.",
    ],
    choices: [],
  },
};

// ---------------------------------------------------------------
//  Endings
// ---------------------------------------------------------------
export const ENDINGS = {
  "the-sleeper": {
    id: "the-sleeper",
    title: "The Sleeper Dreams On",
    victory: true,
    kicker: "Epilogue — Victory",
    text: [
      "The horde is broken. The necromancer is ash. The sleeping god Torak stirs still in his dark dream —",
      "but the Black Legions are gone, and the living have held the line with sword, staff, and will.",
      "You did not slay a god. You gave the old world its night back.",
    ],
  },
  "the-black-legion": {
    id: "the-black-legion",
    title: "The Black Legions",
    victory: false,
    kicker: "Epilogue — Defeat",
    text: [
      "The dark was too wide. The horde was too many, and the fellowship broke beneath the endless dead.",
      "The sleeping god opened his eye. The world of men wept fire, and Belgarath the Sorcerer… was very old, and very tired.",
      "The Black Legions won. The age of the gods ended in darkness.",
    ],
  },
};

// ---------------------------------------------------------------
//  Quests
// ---------------------------------------------------------------
export const QUESTS = [
  {
    id: "war-of-the-sleeping-god",
    name: "The War of the Sleeping God",
    stages: ["The Theft", "The Fellowship", "The Long Road", "The Fens of Vordai", "The Witch of the Fens", "The Black Legions", "The End"],
    stageIndex: 0,
  },
];

// ---------------------------------------------------------------
//  Combat resolution helpers
// ---------------------------------------------------------------
export function spellById(id) {
  return SPELLS[id] || null;
}

export function allyById(id) {
  return ALLIES[id] || null;
}
