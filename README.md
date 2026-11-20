# Rage of the Mage

A browser RPG/RTS hybrid set in the world of **Belgarath the Sorcerer** and the **Belgariad**.

The Orb of Aldur has been stolen. Gather the Fellowship, cross the Fens of Vordai, and stand
against the Black Legions before the Sleeper wakes.

## Play

Open `index.html` through any static web server:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080/
```

No build step, no dependencies. Vanilla ES modules + Canvas + CSS.

## Features

- Story-first structure with RPG mechanics layered in — choices recruit allies and change the tale.
- Two hero classes: **Warrior** (sword & bow: Power Strike, Cleave, Aimed Shot) and **Mage** (Will Bolt, Flame of Aldur, Shield of the Will, Word of Unmaking, Spirit Light).
- **Movement choices** — click-to-move within a hero's stride, WASD/arrow nudges, a **Dash** that covers twice the ground at the cost of a moment's guard, and **Hold** to keep a hero on their ground.
- **Action choices** — Strike, Power Strike, Cleave (sweeps nearby foes), Aimed Shot, Guard (+3 DEF), and targeted spells: arm a spell, then click the foe or companion you mean to affect. Flame of Aldur splashes onto adjacent dead.
- **Animated 2D pixel-art sprites** — characters walk, lunge when striking, flash when hit, and fade when they fall.
- Real-time-with-pause tactical combat, tuned to an unhurried pace: units close in, trade blows, and recover from cooldowns; pause at any moment to issue orders.
- Companions drawn from the Belgariad: Belgarath, Polgara, Durnik, Silk, Barak.
- Magic follows Eddings lore: the Will and the Word, sorcery, witchcraft, demon magic, necromancy.

## Controls

| Input | Action |
| --- | --- |
| Click a hero / `1`–`4` / `Tab` | Select a hero |
| Click ground | Move within the hero's stride (walks as far toward the spot as it can) |
| `WASD` / arrow keys | Nudge the selected hero one tile |
| `F` | Dash: the next move covers twice the ground, but the hero cannot attack for a moment |
| `H` | Hold: the hero stops advancing and fights only what comes to them |
| Click a foe | Strike (or auto-cast the best damage spell) |
| `G` | Guard: +3 defense for five seconds |
| `Q` / `E` / `R` / `T` | Arm a spell, then click a foe or companion to cast it |
| `Space` | Pause / resume |
| `Esc` | Cancel an armed spell and clear the selection |

Warriors can use **Power Strike**, **Cleave**, and **Aimed Shot** from the action panel;
the mage's **Shield of the Will** and **Spirit Light** are cast on companions.

## Sprites

The sprite sheets under `assets/sprites/` are generated pixel art (32×32, four frames
per sheet, drawn facing right — the game mirrors them for units facing left).
They are plain PNGs written with nothing but the Python standard library:

```bash
python3 tools/make-sprites.py   # regenerates assets/sprites/*.png
```

`js/sprites.js` loads the sheets and picks the right one per unit.


## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Screen shell |
| `css/style.css` | Parchment theme and combat layout |
| `assets/sprites/` | Generated pixel-art character sheets (PNG) |
| `js/data.js` | Classes, spells, allies, enemies, encounters, passages, endings |
| `js/state.js` | Game state, unit creation, combat math, XP |
| `js/sprites.js` | Sprite sheet loading and unit→sprite mapping |
| `js/combat.js` | Real-time combat engine and animated Canvas renderer |
| `js/story.js` | Passage engine and effects |
| `js/ui.js` | Screen renderers and input |
| `js/main.js` | Bootstrap and event binding |
| `tools/make-sprites.py` | Sprite sheet generator (stdlib only) |
| `DESIGN.md` | Design document |

## License

Fan work, non-commercial. The Belgariad and its characters belong to the estate of David Eddings.
