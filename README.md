# 🧙 Wonky Wizard

> **Wobblesworth the Sloshed**, the realm's drunkest wizard, gets blind drunk,
> **trashes the tavern** for fun, gets hurled out into the night, and wakes in a
> **moonlit forest** beside a glowing **wisp guide**. Draw arcane hand-signs to
> sling spells, survive the swarm — then work off the **debt** you racked up.

**Plays on desktop and mobile** (virtual joystick + draw-to-cast). Opens with a
**real cinematic cutscene system** — **5 scripted cutscenes** with a moving,
keyframed **camera** (push-ins + handheld sway), **letterbox** bars and
**portrait dialogue** (not plain text), playing out on **dedicated, dressed 3D sets**
built just for the cutscenes (a tavern bar with a **barkeep, a flickering fireplace,
barrels and a door** + a **moonlit forest campsite**, separate from the tavern you
actually play in): Wobblesworth **drinks himself silly**, you **spam-click a
smash QTE** to trash the bar, get **hurled in an arc out through the door**, wake by a
dead campfire in the woods where the **wisp guide** makes an **animated entrance**
(grows in with a particle burst, then bobs with orbiting motes) and **traces an arcane
glyph to teach you to draw** before your guided first fight and the morning-after
**scold**. Plus a **playstyle pick** before each venture (Pyromancer / Frostbinder /
Stormcaller / Brawler) that shapes your build, a glowing **wisp** that pipes up with
cozy tips & warnings, a persistent **main-quest tracker** that always names your next
step, **unique enemies with abilities** (ranged casters, chargers, splitters,
summoners, shielders, bombers), a **pay-the-debt main
quest**, **deck-building**
(curate which boons appear on level-up), **quest-gated facilities** (Equipment
Hall, Cauldron, Anvil, Library unlock as you claim bounties), **3 save slots**,
settings & credits, an **idle/tycoon** layer for running your tavern, a
**Clash-style den builder** (your
own room, up the stairs, that you lay out tile-by-tile), an **Equipment Hall** for
**looted RPG gear** with rarity/levels + a **gacha forge** (spend gold + gems to
cast random gear), a **persistent ✦ artifact collection** you carry up to 3 of into
a run, **crowned king bosses** with their own health bar, an **Arcane Library** (📖
Grimoire showcase, gem-funded **research**, and an inventory), a **two-currency
economy** — 💎 **gems** won in battle (spent on spells & research) and 🪙 **gold**
earned only by **working** — on a **day/night clock**, a **Slay-the-Spire path** of
left/right doors with choice & skill **events**, **abilities** that stack in a
top-left tray, the **4 elements** (🔥💧🌬️🪨) colouring every spell, build-defining
**✦ artifacts** dropped by region bosses (with a dramatic reveal), a
**chug-to-refill** drunk system, and a **carry-and-pour bar shift** for tips.

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

You steer **Wobblesworth**, a hopelessly drunk wizard — a wobbly ragdoll puppet. The night runs in two acts:

1. **The Tavern** — steer the hopelessly drunk wizard to the glowing **door**. Real
   ragdoll physics, very hard to control. Bump a patron (they block you) or knock
   furniture flying (it topples) and the night gets messier.
2. **The Forest** — you black out and wake in a moonlit wood, fighting a swarm of
   **goblins, bats, vampires, zombies** and the **Goblin King** boss.

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | **WASD** / arrows | **drag the left side** (virtual stick) |
| Aim | **mouse** | auto-aims nearest foe |
| **Cast** | hold **Right-Mouse** + draw a glyph | **draw on the right side**, or tap a spell |
| **Chug** (3s → full mana) | **Q** | tap the 🍺 button |
| Quick-cast | keys **1 – 3** | tap a spell chip |
| Pause / Mute | **P**/**Esc**, **M** | on-screen ⏸ / 🔊 |
| Spell guide | **H** | 📖 button |

**Mana is beer, and beer does not refill itself.** Spells cost mana; the only way
to get it back mid-fight is to **chug** (**Q** / 🍺): Wobblesworth pulls out his
tankard and **drinks for 3 seconds** (a progress bar fills) — then your mana snaps
to **FULL**. You can still stagger around while chugging, but every chug cranks up
the **drunkenness meter** — the screen swims, the wizard wobbles, your glyphs get
sloppier. **Beer abilities** change what a chug does (heal, shield, less woozy…).
Risk vs. reward: find a safe beat to commit to a chug.

**The Bar is your hub — and it's just a bar.** Between runs, wobble to the **bar**
to work a shift for tips, head out the **🚪 door** to pick a **stage**, or climb
the **🪜 stairs** to your **room** (a separate scene). Press **E** (tap ✋) to interact.

**Your den: a Clash-style builder.** Climb the **🪜 stairs** to your **room** (a
separate scene that starts bare but for a **bed** — rest there for an HP bonus).
Tap **🔨 Build** to lay out your den tile-by-tile: pick a building, tap a tile to
place it (tap a placed tile to sell it back at half). A tabbed palette splits
**🏛 Stations** from **🛋 Comforts** — the **Spell Table** (unlock/upgrade & equip
3 spells), **Cauldron** (combos), **Equipment Hall** (gear), **Anvil**
(forge/salvage), **Ledger** (tavern idle income) and **Quest Board** (bounties),
plus comforts that deepen your rest bonus. Walk up to a built station and press
**E** to use it.

**The world map.** Click the **🚪 door** for a **3D top-down world map** of the
realm — **8 regions** (🌲 Forest, 🦇 Cave, ⚰ Graveyard, 🐊 Swamp, ❄️ Frostspire,
🔥 **Infernal Depths**, 🤖 **Neon Clockwork**, 🌌 the Void), each its own little
island, that **unlock one by one** as you fell each boss. Monsters prowl the
overworld, fireflies drift, and the sea shimmers. **Tap a region** to scout its
danger tier and loot, then **Venture** to drop straight in.

**The path (Slay-the-Spire-style).** A region is a short run of forks. At each one
you pick a door — **LEFT or RIGHT** — and every door **shows what waits** beyond a
dark forest of lurking red eyes: ⚔️ a **Skirmish**, 💀 an **Elite Pack**, 💰 a
**Hidden Cache** (free loot), 🔥 a **Campfire** (full heal + max HP), ❓ a **Mystery**
(a choice-based dilemma with consequences) or ✶ a **Trial of Nerve** (a skill
challenge — stop the marker on the mark). The final fork leads to the boss. Clear
it to **conquer** the region, open the next, and claim its relic.

**Abilities & artifacts.** Level-ups let you **claim an ability** — stack damage,
life-on-kill, crit, mana and movement; they collect in a **tray, top-left**. You
can also gain abilities mid-fight by **interacting with the arena**: drink from a
**🍺 beer keg** for instant HP & mana, or **draw any glyph** at the **✦ rune
shrine** to channel one. Each region's **boss drops a very-OP ✦ artifact** —
build-defining relics like the Reaper's Tab (+120% damage) or Phoenix Feather — and
the **boss door tells you which one** you're fighting for.

**Combos:** draw two equipped glyphs in quick succession to unleash a learned
combo — e.g. **△ then —** = 🔥 Fire Tornado, **◯ then ϟ** = Ice Storm, **∨ then ★**
= Holy Nova.

**Progression & accuracy:** you start with just **Fireball (△)** and **Gust (—)**.
The full spellbook (a dozen signs — Lightning, Frost, Heal, Nova, Quake, Orb,
Blink and more) is **unlocked and levelled with 💎 gems at the Spell Table**; **equip
any 3** as your run loadout. Level-ups instead hand you **abilities**. The cleaner
you draw a glyph, the more damage it deals — a **near-perfect glyph crits** (2×).
The trail recolours live to show the predicted spell and its quality; the 📖 guide
shows exactly how to draw each one.

While you draw a glyph, **time slows down** — sketch your sign, then let go to
unleash it toward where you were aiming.

### The core hand-signs (a dozen more unlock at the Spell Table)

| Glyph | Draw | Spell | Does |
| --- | --- | --- | --- |
| △ | a triangle | **Fireball** | lobs an exploding bolt — splash damage |
| ϟ | a `Z` zig-zag | **Lightning** | zaps the nearest foe and **chains** to others |
| ◯ | a circle | **Frost Splash** | bursts around you — damages + **slows** (also "water" for chores) |
| ∨ | a check / V | **Heal** | patches Wobblesworth up |
| — | a flat line | **Gust** | a cone of wind that **knocks foes back** (and sweeps dust) |

### The loop

- Foes **swarm** from the dark. Spells leave glowing **XP motes** — soak them up.
- Spells cost **mana**; **chug** (**Q** / 🍺) — a 3-second drink — to refill it to
  full, at the cost of getting woozier. Hearts and 🧪 motes drop from foes too.
- **Level up** to **claim an ability** (more damage, bigger booms, +1 chain,
  "Liquid Courage" for risky power, "Sip of Coffee" to sober up, "Deep Flask" for
  bigger gulps…); they stack in your **top-left tray**. Grab more from **rune
  shrines** and **golden kegs** in the arena.
- Clear each **room**, pick a **door** (and its previewed prize), then fell the
  **region boss** to claim its **✦ artifact**, conquer the region and unlock the
  next on the world map.
- Before each venture, **pick a playstyle** — Pyromancer, Frostbinder, Stormcaller or
  Brawler — forcing a signature spell, weighting your level-up boons toward that build,
  and granting a passive. Your **wisp** chimes in with tips & warnings, and a corner
  **quest tracker** always shows your current goal and next step.
- **Money comes only from working** (or finishing quests). The Tipsy Toad has **4
  tables**; patrons sit down and wait with a 🍺 thought bubble. Walk up to **take
  their order**, go to the **bar to pour it**, then **carry the full mug back** to
  their table to **serve** — bump a patron or knock a table on the way and you'll
  **spill** (re-pour!). Each serve pays a tip; every few is a day's work. Spend
  gems & research at the **Arcane Library** between ventures.

---

## 🗂️ Project layout

```
index.html        # canvas, HUD/menus, Three.js import map
styles.css        # all UI styling
src/
  main.js         # bootstrap
  game.js         # the conductor: phases, state machine, main loop, camera
  cinematics.js   # the cutscene engine: camera keyframes, letterbox, dialogue,
                  #   dedicated bar/forest sets, smash QTE, wisp + draw lesson
  wizard.js       # the wonky spring + verlet-ragdoll wizard rig
  tavern.js       # the bar hub + your buildable room (props, patrons, stations)
  world.js        # the 3D top-down world map (island regions, unlock gating)
  enemies.js      # the monsters, wobbly AI, pooling
  spells.js       # the spells, projectiles, chain lightning, effects
  recognizer.js   # $1 unistroke gesture recognizer
  input.js        # keyboard / pointer / glyph capture
  particles.js    # pooled particle bits + shockwave rings
  upgrades.js     # the ability pool + the very-OP artifact pool
  meta.js         # save slots, gear, quests, den builder, idle tavern
  jobs.js         # chores (dishes / sweep / douse)
  story.js        # narrative beats, the 8 regions + the swarm director
  ui.js           # HUD, story modal, artifact cards, shop panels, toasts
  audio.js        # fully synthesized WebAudio SFX
test/
  sanity.mjs      # node tests for the recognizer + ability/artifact rollers
```

## 🧪 Tests

The pure logic (gesture recognition and ability/artifact rolling) has node-runnable checks:

```bash
npm test    # runs test/sanity.mjs
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
