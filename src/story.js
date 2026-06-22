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
    'This is the Tipsy Toad. Old Barkeep Tomas takes in strays — drunks, spirits, possessed wizards. He gave us a bed and a job.',
    'But last night, monsters dragged poor Tomas into the dark and didn\'t bring him back. We are going to make them regret that.',
    'For now, you work here: tend the Spell Table, brew at the Cauldron, dress at the Wardrobe, take bounties from the Manager, and earn tips in the Kitchen.',
    'When you\'re ready, lurch out the door, pick a haunt, and hunt the beasts that took him. Avenge Tomas — and the Toad is yours.',
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
};

const SPAWN_CAP = 100;

export class Director {
  constructor() { this.reset(); }
  reset() { this.stage = null; this.active = false; this.wave = 0; this.total = 0; this.state = 'idle'; this.timer = 0; this.toSpawn = 0; this.spawnTimer = 0; this.enc = null; }

  // enc: { waves, boss, hpScale } — drives one map-node encounter
  start(stage, enc) {
    this.stage = stage; this.active = true;
    this.enc = enc || { waves: 5, boss: true, hpScale: 1 };
    this.wave = 0; this.total = this.enc.waves; this.state = 'breather'; this.timer = 1.8;
    this.toSpawn = 0; this.spawnTimer = 0;
  }

  remaining() { return this.toSpawn; }

  _waveCount(w) { return Math.round((4 + w * 2) * (this.enc.sizeMult || 1)); }
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
      if (this.toSpawn > 0 && this.spawnTimer <= 0 && game.enemies.count() < SPAWN_CAP) {
        this.spawnTimer = 0.35;
        game.enemies.spawn(this._pickType(), (this.enc.hpScale || 1) + this.wave * 0.1, game.wizard.pos, game);
        this.toSpawn--;
      }
      if (this.toSpawn <= 0) this.state = 'clearing';
    } else if (this.state === 'clearing') {
      if (game.enemies.countNonBoss() === 0) { this.state = 'breather'; this.timer = 2.2; }
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
    this.spawnTimer = 0.2;
    this.state = 'spawning';
    game.announceWave(this.wave, this.total, false);
  }
  _beginBoss(game) {
    this.state = 'boss';
    game.announceWave(this.total, this.total, true);
    game.startBossCinematic(this.stage);
  }
}
