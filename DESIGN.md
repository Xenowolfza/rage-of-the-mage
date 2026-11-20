# Rage of the Mage — Design Document

**Working title:** Rage of the Mage
**Setting:** The fantasy world of David Eddings — *Belgarath the Sorcerer* (The Belgariad universe)
**Genre:** Browser-based fantasy RPG with story and tactical combat (in the spirit of *Rage of Mage 2*)
**Design pillar:** Story first, RPG mechanics layered in.

---

## 1. Premise

In the age when the gods still walked the young world, the sleeping god **Torak** stirred in his malice.
The **Orb of Aldur** — the artifact of immense power — was stolen from the hall of the Rivan King and
taken by the servants of the dark. The **Black Legions** of the risen dead marched for the first time in
recorded history.

**Belgarath the Sorcerer** — the Old Wolf, keeper of the **Will and the Word**, student of the god Aldur —
gathered a fellowship of heroes. You are the hero of the hour: you choose the **sword** or the **staff**.

## 2. Magic system (lore-accurate)

- **Sorcery** is the Will and the Word: willpower + spoken command → reality obeys.
- **Disciplines:** Sorcery (the Will and the Word), Witchcraft (spirits), Magic (demons), Necromancy (the
  dead — used by the enemy).
- Mage spells used in-game:
  - **Will Bolt** (Sorcery) — arcane missile, single target.
  - **Flame of Aldur** (Sorcery) — fire magic, destructive.
  - **Spirit Light** (Sorcery) — divine healing.

## 3. Character classes

- **Warrior** — sword & bow. High HP/attack, no magic. **Power Strike** (x1.5 damage, once per turn).
- **Mage** — staff & sorcery. Low HP, Mana, high magic. Spell list gated by level.

## 4. Allies (Rage of Mage 2 "ally system")

Belgarath, Polgara, Durnik, Silk, Barak — the fellowship. Player recruits companions through story choices.
Party capacity: player + 2 allies.

## 5. Combat design (real-time with pause, grid battlefield)

- Real-time-with-pause: heroes and the dead advance, strike and cast on cooldowns; pause any moment to issue orders.
- Unhurried pace — 3.2 s hero attacks, 4.0 s for the slower dead, 5.2 s spell recovery, 0.85 s AI movement steps, 3.6 s opening grace before engagement.
- **Movement options:** click-to-move within the hero's stride (BFS range, blocked by the living), one-tile WASD/arrow nudges, Dash (double stride, brief attack lockout), Hold (stop auto-advancing).
- **Action options:** Strike; Warrior Power Strike (1.6× damage), Cleave (55% splash to adjacent foes), Aimed Shot (+1 range, 40% crit); Guard (+3 DEF for 5 s).
- **Spell targeting:** arm a spell then click a target. Flame of Aldur splashes 45% onto foes beside its victim; Shield of the Will (+4 DEF) and Spirit Light (heal) target companions; Word of Unmaking is a heavy single-target spell.
- Animated pixel-art sprites (walk cycle, attack lunge, hit flash, death fade), shadows, painter's-order row sorting, stance/ward/hold markers.
- Undead AI: advance + attack; necromancer: cast Flame.
- Win: clear the Black Legions. Lose: the fellowship falls.

## 6. Story beats

- Act I — The Theft → Combat: The Fallen Hall (player alone vs undead raiders).
- Act II — The Fellowship → The Long Road → Night of Wolves → The Fens of Vordai (player + allies).
- Act III — The Witch's Hut (boss) → The Old Stone Bridge.
- Act IV — The Black Legions (horde + necromancer).

## 7. Progression

XP from victories → level ups → stat growth → mage spell unlocks.

## 8. Tech

Vanilla ES modules + Canvas + CSS, no build step, static file serving. Served with `python3 -m http.server`.
