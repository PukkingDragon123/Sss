// story.js — stages, the wave director, and narration.
import * as THREE from 'three';

export const OPENING = {
  speaker: 'A Mischievous Spirit',
  lines: [
    'Death is so DULL. Centuries of drifting, and not a single body to borrow… until tonight.',
    'There — slumped over the bar, snoring into his beard: Wobblesworth the Sloshed, the realm\'s drunkest wizard.',
    'Perfect. A sack of mead and misfired magic, and absolutely no one home. Let us… move in.',
    'Up you get, old man. You and I are going to make some beautiful, catastrophic magic.',
  ],
};

export const TAVERN_INTRO = {
  speaker: 'The Spirit',
  lines: [
    'This is the Tipsy Toad. Old Barkeep Tomas took us in — drunks, spirits, possessed wizards — and gave us a bed upstairs and a job down here.',
    'But last night, monsters dragged poor Tomas into the dark and didn\'t bring him back. We are going to make them regret that.',
    'Down here it\'s just the bar: lurch to the bar to earn tips, or out the glowing door to venture. Up the stairs is YOUR room — bare for now.',
    'In your room, tap BUILD to lay out your den Clash-style — a Spell Table, an Arcane Library, Equipment Hall, Cauldron and more — then use them right there. Win 💎 gems out in the dark; earn 🪙 gold tending this bar. Avenge Tomas, and the Toad is yours.',
  ],
};

export const TUTORIAL = {
  speaker: '📖 How to Survive',
  lines: [
    '⚔️ CAST: hold Right-Mouse (or draw on the right half on phone) and trace a glyph. Cleaner lines hit harder — a PERFECT glyph CRITS. Or tap a spell / press 1–3 to quick-cast.',
    '🍺 MANA = BEER, and it does NOT refill itself. Press Q (or tap 🍺) to CHUG: a 3-second drink — watch the bar — that fills your mana to FULL. You can still move while chugging, but every chug makes the room spin.',
    '💎 vs 🪙: ventures pay in GEMS — spend them on spells & research. GOLD comes only from WORKING the bar or finishing quests. Two purses, two jobs.',
    '✦ ABILITIES: level-ups, kegs, shrines & events let you claim an ability — they stack in the tray, top-LEFT. The four elements (🔥💧🌬️🪨) colour every spell.',
    '🗺️ THE PATH: out the door lies the world map — tap a region, then venture in. After each step pick a door, LEFT or RIGHT: a fight, an elite, treasure, a campfire, a Mystery (a choice) or a Trial (a skill test). The final fork leads to the crowned boss, who drops a build-defining ✦ ARTIFACT — collect them and carry up to 3 into future runs (Inventory).',
    '🔨 YOUR ROOM: up the stairs, press BUILD to lay out stations — the Spell Table (learn spells with 💎), the Arcane Library (📖 Grimoire, Research & Inventory), Equipment Hall, Cauldron — then walk up to use them. Rest at the bed for bonus HP.',
    '🍺 WORK by day: walk up to a TABLE to take a patron\'s order (watch the thought bubble), pour it at the BAR, then carry the mug back to their table to SERVE. Bump a patron or knock a table while carrying and you\'ll spill! Tips are your gold.',
    'That\'s the lot. Now go make some beautiful, catastrophic magic.',
  ],
};

export const BLACKOUT_LINES = {
  speaker: 'The Spirit',
  lines: [
    'You knock back one for the road… the room tips… your knees buckle…',
    '…………',
  ],
};

export const STAGES = {
  forest: {
    id: 'forest', name: 'Moonlit Forest', bossType: 'goblinking', bossName: 'The Goblin King',
    roster: [{ t: 'goblin', w: 1 }, { t: 'bat', w: 1 }, { t: 'zombie', w: 3 }, { t: 'vampire', w: 4 }],
    theme: { bg: 0x16223a, fog: 0x1b2b44, fogD: 0.011, hemi: 0x9fb6e8, hemiG: 0x223a2a, dir: 0xcdd8ff, dirI: 1.5, amb: 0x3a4a6a, floor: 0x2f4a32, rug: 0x3f6440, scatter: 'trees' },
    intro: ['You come to face-down in cold moss — a moonlit forest. This is NOT the way home.', 'Red eyes blink awake between the trees. Up, wizard — DRAW to cast!'],
  },
  cave: {
    id: 'cave', name: 'Dripstone Cave', bossType: 'spiderqueen', bossName: 'The Spider Queen',
    roster: [{ t: 'rat', w: 1 }, { t: 'brutebat', w: 1 }, { t: 'spider', w: 3 }],
    theme: { bg: 0x14110e, fog: 0x18130f, fogD: 0.022, hemi: 0x7a6a5a, hemiG: 0x2a201a, dir: 0xffd9a0, dirI: 0.85, amb: 0x4a3a30, floor: 0x3a322c, rug: 0x4a3f36, scatter: 'rocks' },
    intro: ['Dripping dark, the stink of damp fur and old web. A cave.', 'Something skitters in the black. A great many somethings.'],
  },
  graveyard: {
    id: 'graveyard', name: 'Cursed Graveyard', bossType: 'skeletonking', bossName: 'The Skeleton King',
    roster: [{ t: 'skeleton', w: 1 }, { t: 'zombie', w: 1 }, { t: 'wraith', w: 3 }],
    theme: { bg: 0x101626, fog: 0x141b30, fogD: 0.016, hemi: 0x8fa0c8, hemiG: 0x20283a, dir: 0xbfd0ff, dirI: 1.1, amb: 0x33405a, floor: 0x33384a, rug: 0x3a3f52, scatter: 'graves' },
    intro: ['Crooked stones and cold mist. A graveyard — and the soil is moving.', 'The dead do not care for visitors. Make some room.'],
  },
  swamp: {
    id: 'swamp', name: 'Mire of Murmurs', bossType: 'bogwretch', bossName: 'The Bog Wretch',
    roster: [{ t: 'zombie', w: 1 }, { t: 'bat', w: 1 }, { t: 'spider', w: 2 }, { t: 'vampire', w: 4 }],
    theme: { bg: 0x16241c, fog: 0x18271d, fogD: 0.026, hemi: 0x7fae7a, hemiG: 0x1a2a1a, dir: 0xbfe0a0, dirI: 1.0, amb: 0x33503a, floor: 0x2a3a26, rug: 0x33482e, scatter: 'swamp' },
    intro: ['Knee-deep muck and the reek of rot. Something gurgles beneath the reeds.', 'Watch your step, wizard — the bog bites back.'],
  },
  frost: {
    id: 'frost', name: 'Frostspire Peaks', bossType: 'frostmaw', bossName: 'Frostmaw the Devourer',
    roster: [{ t: 'skeleton', w: 1 }, { t: 'brutebat', w: 1 }, { t: 'wraith', w: 2 }, { t: 'zombie', w: 4 }],
    theme: { bg: 0xbfd6ee, fog: 0xcfe2f4, fogD: 0.012, hemi: 0xdcefff, hemiG: 0x9fb6cf, dir: 0xffffff, dirI: 1.7, amb: 0x8fb0d8, floor: 0xc6d6e6, rug: 0xa8c0d8, scatter: 'ice' },
    intro: ['A howling white waste. The cold gnaws even at a spirit.', 'Move fast and hit hard, or freeze solid out here.'],
  },
  inferno: {
    id: 'inferno', name: 'Infernal Depths', bossType: 'demonlord', bossName: 'Azkar, Lord of Cinders',
    roster: [{ t: 'imp', w: 1 }, { t: 'goblin', w: 1 }, { t: 'hellhound', w: 2 }, { t: 'brutebat', w: 4 }],
    theme: { bg: 0x2a0c08, fog: 0x3a1008, fogD: 0.02, hemi: 0xff7a3a, hemiG: 0x5a1408, dir: 0xff9a4a, dirI: 1.4, amb: 0x7a2410, floor: 0x3a1410, rug: 0x6a2010, scatter: 'hell' },
    intro: ['Heat like a forge, and a sky the colour of embers. This is the pit itself.', 'The damned do not rest. Burn them again.'],
  },
  clockwork: {
    id: 'clockwork', name: 'Neon Clockwork', bossType: 'overmind', bossName: 'The Overmind',
    roster: [{ t: 'drone', w: 1 }, { t: 'rat', w: 1 }, { t: 'bot', w: 2 }, { t: 'spider', w: 4 }],
    theme: { bg: 0x0a1422, fog: 0x0c1a2c, fogD: 0.016, hemi: 0x3fd0e8, hemiG: 0x10242c, dir: 0x8fefff, dirI: 1.3, amb: 0x1f5a6a, floor: 0x16222e, rug: 0x123040, scatter: 'tech' },
    intro: ['Humming pylons and cold neon. Some clockwork god has woken, and it is not pleased.', 'Steel and circuitry — smash it to scrap.'],
  },
  void: {
    id: 'void', name: 'The Shattered Void', bossType: 'voidmaw', bossName: 'Voidmaw, the All-Hunger',
    roster: [{ t: 'wraith', w: 1 }, { t: 'bat', w: 1 }, { t: 'imp', w: 2 }, { t: 'vampire', w: 3 }],
    theme: { bg: 0x0a0612, fog: 0x0e0820, fogD: 0.018, hemi: 0x8f6fd0, hemiG: 0x150a28, dir: 0xc6a3ff, dirI: 1.2, amb: 0x3a2a5a, floor: 0x14102a, rug: 0x1f1840, scatter: 'void' },
    intro: ['Stars wheel underfoot. There is no up here, only the Hunger at the end of all things.', 'Finish it, spirit. Send the Void back to nothing.'],
  },
};

// the order stages unlock in (each cleared boss opens the next)
export const STAGE_ORDER = ['forest', 'cave', 'graveyard', 'swamp', 'frost', 'inferno', 'clockwork', 'void'];

const SPAWN_CAP = 100;

export class Director {
  constructor() { this.reset(); }
  reset() { this.stage = null; this.active = false; this.wave = 0; this.total = 0; this.state = 'idle'; this.timer = 0; this.toSpawn = 0; this.spawnTimer = 0; this.enc = null; }

  // enc: { waves, boss, hpScale } — drives one map-node encounter
  start(stage, enc) {
    this.stage = stage; this.active = true;
    this.enc = enc || { waves: 5, boss: true, hpScale: 1 };
    this.wave = 0; this.total = this.enc.waves; this.state = 'breather'; this.timer = 0.9;
    this.toSpawn = 0; this.spawnTimer = 0;
  }

  remaining() { return this.toSpawn; }

  // bigger, denser waves so a node is a meaty fight…
  _waveCount(w) { return Math.round((6 + w * 3) * (this.enc.sizeMult || 1)); }
  _pickType() {
    const w = this.wave;
    const opts = this.stage.roster.filter(r => w >= r.w);
    const pool = opts.length ? opts : this.stage.roster;
    return pool[Math.floor(Math.random() * pool.length)].t;
  }

  update(dt, game) {
    if (!this.active) return;
    if (this.state === 'breather') {
      this.timer -= dt;
      if (this.timer <= 0) this._beginWave(game);
    } else if (this.state === 'spawning') {
      this.spawnTimer -= dt;
      // …but they POUR out fast (snappy pacing), two at a time
      if (this.toSpawn > 0 && this.spawnTimer <= 0 && game.enemies.count() < SPAWN_CAP) {
        this.spawnTimer = 0.13;
        game.enemies.spawn(this._pickType(), (this.enc.hpScale || 1) + this.wave * 0.12, game.wizard.pos, game);
        this.toSpawn--;
        if (this.toSpawn > 0 && game.enemies.count() < SPAWN_CAP) { game.enemies.spawn(this._pickType(), (this.enc.hpScale || 1) + this.wave * 0.12, game.wizard.pos, game); this.toSpawn--; }
      }
      if (this.toSpawn <= 0) this.state = 'clearing';
    } else if (this.state === 'clearing') {
      if (game.enemies.countNonBoss() === 0) { this.state = 'breather'; this.timer = 1.0; }
    }
    // 'boss' state: just wait for the boss to die (game.onBossDead -> win)
  }

  _beginWave(game) {
    this.wave++;
    if (this.wave > this.total) {
      if (this.enc.boss) { this._beginBoss(game); }
      else { this.active = false; this.state = 'cleared'; if (game.onEncounterCleared) game.onEncounterCleared(); }
      return;
    }
    this.toSpawn = this._waveCount(this.wave);
    this.spawnTimer = 0.15;
    this.state = 'spawning';
    game.announceWave(this.wave, this.total, false);
  }
  _beginBoss(game) {
    this.state = 'boss';
    game.announceWave(this.total, this.total, true);
    game.startBossCinematic(this.stage);
  }
}
