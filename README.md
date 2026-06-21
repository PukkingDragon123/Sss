# 🧙 Wonky Wizard

> A spirit possesses **Wobblesworth the Sloshed**, the realm's drunkest wizard.
> First, steer his blind-drunk stagger **out of the tavern** without wrecking the
> place. Then black out… and wake in a **moonlit forest**, swarmed by monsters.
> Draw arcane hand-signs to sling spells and survive the night.

**Plays on desktop and mobile** (virtual joystick + draw-to-cast). Includes an
animated menu (live fight on the right), **3 save slots**, settings & credits, an
**idle/tycoon** layer for running your tavern, a multi-room hub (separate bedroom
& kitchen), **looted RPG gear** with rarity/levels + a Blacksmith, and tavern
mini-games (serve drinks / wash dishes / cook).

A self-contained 3D browser game: **floppy ragdoll-physics** characters (heavily
inspired by **Human: Fall Flat** — dangling verlet-physics limbs, soft pastel
lighting and soft shadows), **gesture-based spellcasting**, a **Vampire-Survivors-style
roguelite** swarm loop, and a tongue-in-cheek **story** with chores to finish.

### ▶ Play instantly (no download)

**https://raw.githack.com/PukkingDragon123/Sss/claude/modest-curie-3hphhi/index.html**

> Served straight from this branch via raw.githack.com. If you just pushed an
> update and still see the old build, the CDN is caching — add `?v=2` to the URL.

No build step, no installed dependencies, no asset files — every model is built
from primitives, every sound is synthesized with WebAudio, and Three.js is loaded
from a CDN at runtime.

---

## ▶️ Run it

The game uses ES modules + an import map, so it must be served over `http://`
(opening `index.html` straight from disk won't work). From this folder:

```bash
# any static server works — pick one:
python3 -m http.server 8000      # then open http://localhost:8000
# or
npx serve .
# or
npm start                        # alias for the python server above
```

Then open the printed URL in a modern browser (Chrome/Edge/Firefox/Safari).
You need WebGL and an internet connection (for the Three.js CDN).

> First load summons Three.js from `cdn.jsdelivr.net`. If the screen says it
> "couldn't summon the tavern", check your connection / that you're on `http://`.

---

## 🎮 How to play

You are the **spirit**; the wizard is your wobbly puppet. The night runs in two acts:

1. **The Tavern** — steer the hopelessly drunk wizard to the glowing **door**. Real
   ragdoll physics, very hard to control. Bump a patron (they block you) or knock
   furniture flying (it topples) and the spirit keeps score.
2. **The Forest** — you black out and wake in a moonlit wood, fighting a swarm of
   **goblins, bats, vampires, zombies** and the **Goblin King** boss.

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | **WASD** / arrows | **drag the left side** (virtual stick) |
| Aim | **mouse** | auto-aims nearest foe |
| **Cast** | hold **Right-Mouse** + draw a glyph | **draw on the right side**, or tap a spell |
| Quick-cast | keys **1 – 5** | tap a spell chip |
| Pause / Mute | **P**/**Esc**, **M** | on-screen ⏸ / 🔊 |
| Spell guide | **H** | 📖 button |

**The Tavern is a hub.** Between runs, wobble up to the glowing stations and press
**E** (tap ✋): the **Spell Table** (a skill tree — unlock & upgrade spells, then
**equip 3**), the **Cauldron** (brew **combos**), the **Wardrobe** (buy & wear
**equipment** — hat/robe/staff/charm with stat bonuses), the **Tavern Manager**
(bounty quests), and your **Room** (rest for a bonus, buy decorations). At the
**door** you pick a **stage**.

**Stages & waves.** Three stages — 🌲 **Forest**, 🦇 **Cave**, ⚰ **Graveyard** —
each with its own monsters, a **5-wave + boss** structure, enemies that **pour
out of portals**, and a **boss reveal** cinematic. Bosses: the Goblin King, the
Spider Queen, and the Skeleton King. Runs award **gold** (results/loot screen)
and everything is **saved** to your browser.

**Combos:** draw two equipped glyphs in quick succession to unleash a learned
combo — e.g. **△ then —** = 🔥 Fire Tornado, **◯ then ϟ** = Ice Storm, **∨ then ★**
= Holy Nova.

**Progression & accuracy:** you start with just **Fireball (△)** and **Gust (—)**;
**Lightning (Z)**, **Frost Splash (◯)** and **Heal (V)** are unlocked via level-up
cards. The cleaner you draw a glyph, the more damage it deals — a **near-perfect
glyph crits** (2×). The trail recolours live to show the predicted spell and its
quality; the 📖 guide shows exactly how to draw each one.

While you draw a glyph, **time slows down** — sketch your sign, then let go to
unleash it toward where you were aiming.

### The five hand-signs

| Glyph | Draw | Spell | Does |
| --- | --- | --- | --- |
| △ | a triangle | **Fireball** | lobs an exploding bolt — splash damage |
| ϟ | a `Z` zig-zag | **Lightning** | zaps the nearest foe and **chains** to others |
| ◯ | a circle | **Frost Splash** | bursts around you — damages + **slows** (also "water" for chores) |
| ∨ | a check / V | **Heal** | patches Wobblesworth up |
| — | a flat line | **Gust** | a cone of wind that **knocks foes back** (and sweeps dust) |

### The loop

- Foes **swarm** from the dark. Spells leave glowing **XP motes** — soak them up.
- **Level up** to pick a **boon** (more damage, bigger booms, +1 chain, "Liquid
  Courage" for risky power, "Sip of Coffee" to sober up, etc.).
- The landlady keeps assigning **chores** — a marker shows where. Cast the right
  kind of spell near it (e.g. **◯ Frost Splash** to wash dishes / douse the
  hearth, **— Gust** to sweep) to finish them for bonus XP.
- Survive the night and slay the final boss — **The Tab Collector** — to win.

---

## 🗂️ Project layout

```
index.html        # canvas, HUD/menus, Three.js import map
styles.css        # all UI styling
src/
  main.js         # bootstrap
  game.js         # the conductor: phases, state machine, main loop, camera
  wizard.js       # the wonky spring + verlet-ragdoll wizard rig
  tavern.js       # the opening drunk-walk level (props, patrons, the door)
  enemies.js      # the 5 monsters, wobbly AI, pooling
  spells.js       # the 5 spells, projectiles, chain lightning, effects
  recognizer.js   # $1 unistroke gesture recognizer
  input.js        # keyboard / pointer / glyph capture
  particles.js    # pooled particle bits + shockwave rings
  upgrades.js     # roguelite boon pool
  jobs.js         # chores (dishes / sweep / douse)
  story.js        # narrative beats + the swarm director
  ui.js           # HUD, story modal, level-up cards, toasts
  audio.js        # fully synthesized WebAudio SFX
test/
  sanity.mjs      # node tests for the recognizer + upgrade roller
```

## 🧪 Tests

The pure logic (gesture recognition, upgrade rolling) has node-runnable checks:

```bash
node test/sanity.mjs    # or: npm test
```

## 🛠️ Design notes

- **Human: Fall Flat-style ragdoll**: the arms are real **verlet-physics chains**
  (shoulder → elbow → hand) simulated in world space. They dangle, swing and flop
  behind the shoulders as the wizard staggers, and reach upward when casting.
- **Wonky body**: a chain of springs (torso → head → hat) that lag and overshoot,
  plus a constant drunk sway and random hiccups that fling the limbs.
- **Soft visuals**: pastel clay materials, soft ambient + key lighting, filmic
  tone mapping, and **PCF soft shadows** for that grounded, dreamy look.
- **Gesture casting** uses the classic **$1 unistroke recognizer**, with a small
  fix to scale 1-D gestures (the line) uniformly so they don't degrade into noise.
- **Performance**: particles, enemies and XP motes are **pooled**; spells avoid
  per-cast dynamic lights (additive glows instead) so the renderer never churns
  its light count mid-swarm.

Made wonky on purpose. 🍺
