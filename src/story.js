// story.js — narration + the forest swarm director.
// New flow: a cinematic in the tavern (drunk-walk to the door) -> black out ->
// wake in a moonlit forest -> survive the swarm and the Goblin King.
import * as THREE from 'three';

export const TAVERN_INTRO = {
  speaker: 'The Spirit',
  lines: [
    'Ahhh, a warm body at last! Tonight I haunt Wobblesworth the Sloshed — the realm\'s drunkest wizard.',
    'He\'s had... several. The room is spinning, and not for him. Your job: steer this sack of mead to the DOOR.',
    'He\'s VERY hard to control while sozzled. Try not to bump the patrons or knock the furniture flying.',
    'Drag the left side to stagger; aim for the glowing door. Off we wobble!',
  ],
};

// shown over the black screen after leaving the tavern
export const BLACKOUT_LINES = {
  speaker: 'The Spirit',
  lines: [
    'You stumble into the cold night air… the stars smear… your knees fold…',
    '…………',
    'You come to face-down in damp moss. A moonlit forest. This is NOT the way home.',
    'And those red eyes in the dark? Definitely not fireflies. On your feet, wizard — DRAW to cast!',
  ],
};

export class Director {
  constructor() { this.reset(); }

  reset() {
    this.t = 0;
    this.spawnAcc = 0;
    this._lastPulse = -1;
    this.bossStarted = false;
    this.beats = [
      { t: 7,   done: false, fn: (g) => g.showStory('The Spirit', ['Draw a △ to sling a Fireball at those things. Singe something!']) },
      { t: 26,  done: false, fn: (g) => { g.jobs.start('spores'); g.ui.showJob('Clear the Spores', 'Cursed spore-puffs! — Gust them away (north-east).'); g.showStory('The Spirit', ['Glowing spore-puffs — blow those away with a — Gust before we hallucinate worse than usual.']); } },
      { t: 70,  done: false, fn: (g) => g.showStory('The Spirit', ['More of them clawing out from between the trees. Wobble faster, you old soak!']) },
      { t: 96,  done: false, fn: (g) => { g.jobs.start('campfire'); g.ui.showJob('Douse the Campfire', 'It\'s spreading to the trees! ◯ Frost Splash it (north-west).'); g.showStory('The Spirit', ['A campfire\'s catching the woods alight — once you\'ve learned ◯ Frost, splash it out.']); } },
      { t: 150, done: false, fn: (g) => g.showStory('The Spirit', ['ZOMBIES and a VAMPIRE now? Hit them with everything — mash 1–5 if your glyphs go wobbly!']) },
      { t: 188, done: false, fn: (g) => { g.jobs.start('cauldron'); g.ui.showJob('Quench the Hex-Fire', 'A cursed cauldron blazes! ◯ Frost Splash it (far north).'); g.showStory('The Spirit', ['That cursed cauldron is boiling over with hex-fire. ◯ Frost Splash it cold!']); } },
      { t: 236, done: false, fn: (g) => g.showStory('The Spirit', ['…the ground is shaking. Something BIG and crowned is coming through the pines.']) },
      { t: 242, done: false, fn: (g) => g.startBoss() },
    ];
  }

  _spawnBatch(game) {
    const t = this.t;
    const hpScale = 1 + t * 0.008;
    let count = 1 + (Math.random() < Math.min(0.45, t / 300) ? 1 : 0);
    if (t > 150 && Math.random() < 0.2) count += 1;
    for (let i = 0; i < count; i++) {
      let type = 'goblin';
      const r = Math.random();
      if (t < 30) { type = r < 0.85 ? 'goblin' : 'bat'; }
      else if (t < 90) { type = r < 0.5 ? 'goblin' : (r < 0.82 ? 'bat' : 'zombie'); }
      else if (t < 180) { type = r < 0.38 ? 'goblin' : (r < 0.64 ? 'bat' : (r < 0.85 ? 'zombie' : 'vampire')); }
      else { type = r < 0.3 ? 'goblin' : (r < 0.52 ? 'bat' : (r < 0.78 ? 'zombie' : 'vampire')); }
      game.enemies.spawn(type, hpScale, game.wizard.pos);
    }
  }

  update(dt, game) {
    this.t += dt;

    const interval = Math.max(0.38, 1.7 - this.t * 0.0028);
    this.spawnAcc += dt;
    while (this.spawnAcc >= interval) {
      this.spawnAcc -= interval;
      if (game.enemies.count() < 90) this._spawnBatch(game);
    }

    if (this.t > 75 && Math.floor(this.t) % 60 === 0 && this._lastPulse !== Math.floor(this.t)) {
      this._lastPulse = Math.floor(this.t);
      const burst = 3 + Math.floor(this.t / 90);
      for (let i = 0; i < burst; i++) game.enemies.spawn(Math.random() < 0.7 ? 'goblin' : 'bat', 1 + this.t * 0.008, game.wizard.pos);
    }

    for (const b of this.beats) {
      if (!b.done && this.t >= b.t) { b.done = true; b.fn(game); }
    }
  }
}
