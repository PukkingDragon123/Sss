// story.js — stages, the wave director, and narration.
import * as THREE from 'three';

export const BLACKOUT_LINES = {
  speaker: 'Wobblesworth',
  lines: [
    'You knock back one for the road. The room tips. Your knees buckle.',
    '...',
  ],
};

export const STAGES = {
  forest: {
    id: 'forest', name: 'Sunlit Forest', bossType: 'goblinking', bossName: 'The Goblin King',
    roster: [{ t: 'goblin', w: 1 }, { t: 'bat', w: 1 }, { t: 'slime', w: 2 }, { t: 'brigand', w: 2 }, { t: 'zombie', w: 3 }, { t: 'mushroomcap', w: 3 }, { t: 'vampire', w: 4 }, { t: 'houndling', w: 3 }, { t: 'splitslime', w: 4 }, { t: 'bomber', w: 5 }],
    // bright MORNING woodland by default — warm sun, soft blue sky, lush green
    theme: {
      bg: 0x8fc6e8, fog: 0xc3ddec, fogD: 0.006, hemi: 0xcfe6ff, hemiG: 0x40663a, dir: 0xfff2d2, dirI: 1.75, amb: 0x6f8a72, floor: 0x4f8a48, rug: 0x5fa055, scatter: 'trees', rim: 0xfff0d0, rimI: 1.2,
      // the guided TUTORIAL fight plays at NIGHT (moonlit) — set apart from the rest
      night: { bg: 0x16223a, fog: 0x1b2b44, fogD: 0.011, hemi: 0x9fb6e8, hemiG: 0x223a2a, dir: 0xcdd8ff, dirI: 1.5, amb: 0x3a4a6a, floor: 0x2f4a32, rug: 0x3f6440, rim: 0xbfe0ff, rimI: 1.25 },
    },
    intro: ['A moonlit forest, far from home.', 'Red eyes wake in the trees. Draw a glyph to cast!'],
  },
  cave: {
    id: 'cave', name: 'Dripstone Cave', bossType: 'spiderqueen', bossName: 'The Spider Queen',
    roster: [{ t: 'rat', w: 1 }, { t: 'brutebat', w: 1 }, { t: 'spider', w: 3 }, { t: 'cultist', w: 3 }, { t: 'stonegolem', w: 4 }, { t: 'broodmother', w: 4 }],
    theme: { bg: 0x14110e, fog: 0x18130f, fogD: 0.022, hemi: 0x7a6a5a, hemiG: 0x2a201a, dir: 0xffd9a0, dirI: 0.85, amb: 0x4a3a30, floor: 0x3a322c, rug: 0x4a3f36, scatter: 'rocks', rim: 0xffb060, rimI: 1.05 },
    intro: ['Dripping dark, the stink of damp fur and old web. A cave.', 'Something skitters in the black. A great many somethings.'],
  },
  graveyard: {
    id: 'graveyard', name: 'Cursed Graveyard', bossType: 'skeletonking', bossName: 'The Skeleton King',
    roster: [{ t: 'skeleton', w: 1 }, { t: 'zombie', w: 1 }, { t: 'wispling', w: 2 }, { t: 'wraith', w: 3 }, { t: 'warden', w: 2 }, { t: 'cultist', w: 3 }, { t: 'bomber', w: 4 }],
    theme: { bg: 0x101626, fog: 0x141b30, fogD: 0.016, hemi: 0x8fa0c8, hemiG: 0x20283a, dir: 0xbfd0ff, dirI: 1.1, amb: 0x33405a, floor: 0x33384a, rug: 0x3a3f52, scatter: 'graves', rim: 0x9fd6ff, rimI: 1.3 },
    intro: ['Crooked stones and cold mist. A graveyard, and the soil is moving.', 'The dead do not care for visitors. Make some room.'],
  },
  swamp: {
    id: 'swamp', name: 'Mire of Murmurs', bossType: 'bogwretch', bossName: 'The Bog Wretch',
    roster: [{ t: 'zombie', w: 1 }, { t: 'bat', w: 1 }, { t: 'spider', w: 2 }, { t: 'vampire', w: 4 }, { t: 'splitslime', w: 2 }, { t: 'broodmother', w: 3 }],
    theme: { bg: 0x16241c, fog: 0x18271d, fogD: 0.026, hemi: 0x7fae7a, hemiG: 0x1a2a1a, dir: 0xbfe0a0, dirI: 1.0, amb: 0x33503a, floor: 0x2a3a26, rug: 0x33482e, scatter: 'swamp', rim: 0xbfe89a, rimI: 1.15 },
    intro: ['Knee-deep muck and the reek of rot. Something gurgles beneath the reeds.', 'Watch your step, wizard. The bog bites back.'],
  },
  frost: {
    id: 'frost', name: 'Frostspire Peaks', bossType: 'frostmaw', bossName: 'Frostmaw the Devourer',
    roster: [{ t: 'skeleton', w: 1 }, { t: 'brutebat', w: 1 }, { t: 'wraith', w: 2 }, { t: 'zombie', w: 4 }, { t: 'houndling', w: 2 }, { t: 'stonegolem', w: 3 }, { t: 'warden', w: 3 }],
    theme: { bg: 0xbfd6ee, fog: 0xcfe2f4, fogD: 0.012, hemi: 0xdcefff, hemiG: 0x9fb6cf, dir: 0xffffff, dirI: 1.7, amb: 0x8fb0d8, floor: 0xc6d6e6, rug: 0xa8c0d8, scatter: 'ice', rim: 0xeaf6ff, rimI: 1.5 },
    intro: ['A howling white waste. The cold gnaws right through you.', 'Move fast and hit hard, or freeze solid out here.'],
  },
  inferno: {
    id: 'inferno', name: 'Infernal Depths', bossType: 'demonlord', bossName: 'Azkar, Lord of Cinders',
    roster: [{ t: 'imp', w: 1 }, { t: 'goblin', w: 1 }, { t: 'hellhound', w: 2 }, { t: 'brutebat', w: 4 }, { t: 'bomber', w: 2 }, { t: 'houndling', w: 3 }, { t: 'cultist', w: 4 }],
    theme: { bg: 0x2a0c08, fog: 0x3a1008, fogD: 0.02, hemi: 0xff7a3a, hemiG: 0x5a1408, dir: 0xff9a4a, dirI: 1.4, amb: 0x7a2410, floor: 0x3a1410, rug: 0x6a2010, scatter: 'hell', rim: 0xff8a4a, rimI: 1.35 },
    intro: ['Heat like a forge, and a sky the colour of embers. This is the pit itself.', 'The damned do not rest. Burn them again.'],
  },
  clockwork: {
    id: 'clockwork', name: 'Neon Clockwork', bossType: 'overmind', bossName: 'The Overmind',
    roster: [{ t: 'drone', w: 1 }, { t: 'rat', w: 1 }, { t: 'bot', w: 2 }, { t: 'spider', w: 4 }, { t: 'warden', w: 2 }, { t: 'bomber', w: 3 }, { t: 'broodmother', w: 4 }],
    theme: { bg: 0x0a1422, fog: 0x0c1a2c, fogD: 0.016, hemi: 0x3fd0e8, hemiG: 0x10242c, dir: 0x8fefff, dirI: 1.3, amb: 0x1f5a6a, floor: 0x16222e, rug: 0x123040, scatter: 'tech', rim: 0x8fefff, rimI: 1.35 },
    intro: ['Humming pylons and cold neon. Some clockwork god has woken, and it is not pleased.', 'Steel and circuitry. Smash it to scrap.'],
  },
  void: {
    id: 'void', name: 'The Shattered Void', bossType: 'voidmaw', bossName: 'Voidmaw, the All-Hunger',
    roster: [{ t: 'wraith', w: 1 }, { t: 'bat', w: 1 }, { t: 'wispling', w: 2 }, { t: 'imp', w: 2 }, { t: 'vampire', w: 3 }, { t: 'cultist', w: 2 }, { t: 'warden', w: 3 }, { t: 'bomber', w: 3 }],
    theme: { bg: 0x0a0612, fog: 0x0e0820, fogD: 0.018, hemi: 0x8f6fd0, hemiG: 0x150a28, dir: 0xc6a3ff, dirI: 1.2, amb: 0x3a2a5a, floor: 0x14102a, rug: 0x1f1840, scatter: 'void', rim: 0xc6a3ff, rimI: 1.25 },
    intro: ['Stars wheel underfoot. There is no up here, only the Hunger at the end of all things.', 'Finish it, wizard. Send the Void back to nothing.'],
  },
};

// the order stages unlock in (each cleared boss opens the next)
export const STAGE_ORDER = ['forest', 'cave', 'graveyard', 'swamp', 'frost', 'inferno', 'clockwork', 'void'];

// ---- the 10 stages WITHIN a region ----
// Every region is a ten-stage ladder. Each stage has its own gimmick (shown to the
// player as a banner on entry), its own screen tint so it LOOKS different, a tweak to
// how the foes behave (hp / count / speed / damage), and a little optional mission for
// bonus 💎. Stage 1 is the entrance fight, 10 is the boss lair; 2–9 are the path forks.
//   hpMult/spawnMult feed the wave director; speedMult/dmgMult feed enemies.js via
//   game._stageMods; tint is a CSS colour layered over the scene.
//   mission: survive | slayer (combo) | speed (time) | nohit | boss
export const STAGE_GIMMICKS = [
  { name: 'Arrival',     icon: '🌑', desc: 'A gentle warm-up.',          tint: 'rgba(40,70,110,0.10)',  hpMult: 0.7,  spawnMult: 0.8, speedMult: 1.0,  dmgMult: 0.85, mission: 'survive', goal: 0,  reward: 6 },
  { name: 'The Swarm',   icon: '🐝', desc: 'Many weak foes — keep moving!', tint: 'rgba(120,180,60,0.12)', hpMult: 0.6,  spawnMult: 1.25, speedMult: 1.0, dmgMult: 0.8,  mission: 'slayer',  goal: 8,  reward: 10 },
  { name: 'Thick Hide',  icon: '🛡️', desc: 'Fewer foes, but tanky.',     tint: 'rgba(150,120,80,0.12)', hpMult: 1.3,  spawnMult: 0.7, speedMult: 0.9,  dmgMult: 0.9,  mission: 'speed',   goal: 45, reward: 12 },
  { name: 'Frenzy',      icon: '⚡', desc: 'Everything moves fast.',      tint: 'rgba(220,180,40,0.12)', hpMult: 0.75, spawnMult: 0.95, speedMult: 1.3, dmgMult: 0.9,  mission: 'nohit',   goal: 0,  reward: 14 },
  { name: 'Glass Fangs', icon: '🦷', desc: 'One-hit foes that bite.',    tint: 'rgba(200,60,80,0.13)',  hpMult: 0.5,  spawnMult: 1.0, speedMult: 1.1,  dmgMult: 1.2,  mission: 'nohit',   goal: 0,  reward: 16 },
  { name: 'The Horde',   icon: '💀', desc: 'A relentless tide.',         tint: 'rgba(110,70,150,0.13)', hpMult: 0.75, spawnMult: 1.4, speedMult: 1.0,  dmgMult: 0.9,  mission: 'slayer',  goal: 14, reward: 16 },
  { name: 'Juggernauts', icon: '🪨', desc: 'Slow, huge, hard to drop.',  tint: 'rgba(130,95,60,0.14)',  hpMult: 1.6,  spawnMult: 0.6, speedMult: 0.8,  dmgMult: 1.05, mission: 'speed',   goal: 55, reward: 18 },
  { name: 'Blitz',       icon: '🌪️', desc: 'Fast and many — chaos.',    tint: 'rgba(60,160,200,0.14)', hpMult: 0.8,  spawnMult: 1.2, speedMult: 1.25, dmgMult: 0.95, mission: 'nohit',   goal: 0,  reward: 20 },
  { name: 'Night Hunt',  icon: '🌙', desc: 'Hunters stalk in packs.',    tint: 'rgba(90,110,200,0.14)', hpMult: 0.95, spawnMult: 1.1, speedMult: 1.15, dmgMult: 1.0,  mission: 'slayer',  goal: 10, reward: 20 },
  { name: 'Gold Rush',   icon: '✨', desc: 'Clear it fast — fortune favours speed.', tint: 'rgba(220,190,80,0.14)', hpMult: 0.85, spawnMult: 1.05, speedMult: 1.1, dmgMult: 0.95, mission: 'speed',  goal: 50, reward: 24 },
  { name: 'The Gauntlet', icon: '🔥', desc: 'An elite pack guards the lair.', tint: 'rgba(220,90,40,0.15)', hpMult: 1.25, spawnMult: 0.95, speedMult: 1.05, dmgMult: 1.1, mission: 'slayer',  goal: 12, reward: 22 },
  { name: 'Boss Lair',   icon: '👑', desc: 'The champion awaits. End it.', tint: 'rgba(180,40,60,0.17)', hpMult: 0.9,  spawnMult: 1.0, speedMult: 1.0,  dmgMult: 0.95, mission: 'boss',    goal: 0,  reward: 0 },
];
export const STAGES_PER_REGION = 12; // two more levels per region (12-stage ladder)
// pick the gimmick for a given 1-based stage number (clamped to the ladder)
export function gimmickFor(stageNum) {
  const i = Math.max(1, Math.min(STAGE_GIMMICKS.length, stageNum)) - 1;
  return STAGE_GIMMICKS[i];
}

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
