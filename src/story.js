// story.js — the night's pacing: narrative beats, the swarm director,
// chore hand-outs, and the final boss. One run ≈ a single rowdy night.
import * as THREE from 'three';

export const INTRO = {
  speaker: 'The Spirit',
  lines: [
    'Ahhh, a fresh body to haunt! And what a body — Wobblesworth the Sloshed, the realm\'s drunkest wizard.',
    'You are the mischievous spirit pulling his soggy strings tonight. Steer his stagger with WASD, point with the mouse.',
    'To cast, HOLD the right mouse button and DRAW a glyph — a hand-sign. Time slows while you sketch.',
    '△ flings a Fireball · Z is Lightning · ◯ a Frost Splash · V to Heal · — for a Gust. (Or smash 1–5 in a panic.)',
    'Survive the night, soak up the glowing motes to grow stronger… oh, and he DID promise to do the dishes. Cheers!',
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
      { t: 9,   done: false, fn: (g) => g.showStory('The Spirit', ['Go on — draw a △ and fling a Fireball at something rude.']) },
      { t: 28,  done: false, fn: (g) => { g.jobs.start('dishes'); g.ui.showJob('Wash the Dishes', 'Splash them clean: ◯ Frost Splash by the sink (north-west).'); g.showStory('The Landlady (muffled)', ['OI! While you\'re flailing about — the DISHES, wizard! Northwest corner!']); } },
      { t: 78,  done: false, fn: (g) => g.showStory('The Spirit', ['More of them slithering out of the woodwork. Wobble faster, you old soak!']) },
      { t: 96,  done: false, fn: (g) => { g.jobs.start('sweep'); g.ui.showJob('Sweep the Floor', 'Blow the dust bunnies away: — Gust (north-east).'); g.showStory('The Spirit', ['Dust bunnies. Enormous ones. Give them a good Gust (—) over east.']); } },
      { t: 150, done: false, fn: (g) => g.showStory('The Spirit', ['A BRUTE! Big, slow, cranky. Hit it with everything — glyphs be damned, mash 1–5!']) },
      { t: 188, done: false, fn: (g) => { g.jobs.start('douse'); g.ui.showJob('Douse the Hearth', 'The fire\'s out of control! ◯ Frost Splash it (far north).'); g.showStory('The Landlady (muffled)', ['The HEARTH\'S on fire, you menace! Frost Splash it before the whole pub goes up!']); } },
      { t: 236, done: false, fn: (g) => g.showStory('The Spirit', ['…something enormous is stomping up from the cellar. It smells of overdue rent.']) },
      { t: 242, done: false, fn: (g) => g.startBoss() },
    ];
  }

  // choose what to spawn based on how late the night is
  _spawnBatch(game) {
    const t = this.t;
    const hpScale = 1 + t * 0.011;
    let count = 1 + (Math.random() < Math.min(0.6, t / 220) ? 1 : 0);
    if (t > 120 && Math.random() < 0.25) count += 1;
    for (let i = 0; i < count; i++) {
      let type = 'goblin';
      const r = Math.random();
      if (t < 30) { type = r < 0.85 ? 'goblin' : 'bat'; }
      else if (t < 90) { type = r < 0.55 ? 'goblin' : (r < 0.9 ? 'bat' : 'brute'); }
      else if (t < 180) { type = r < 0.45 ? 'goblin' : (r < 0.78 ? 'bat' : 'brute'); }
      else { type = r < 0.4 ? 'goblin' : (r < 0.72 ? 'bat' : 'brute'); }
      game.enemies.spawn(type, hpScale, game.wizard.pos);
    }
  }

  update(dt, game) {
    this.t += dt;

    // difficulty-scaled spawn cadence
    const interval = Math.max(0.22, 1.35 - this.t * 0.0033);
    this.spawnAcc += dt;
    while (this.spawnAcc >= interval) {
      this.spawnAcc -= interval;
      if (game.enemies.count() < 120) this._spawnBatch(game);
    }

    // periodic swarm pulse to keep it spicy
    if (this.t > 60 && Math.floor(this.t) % 45 === 0 && this._lastPulse !== Math.floor(this.t)) {
      this._lastPulse = Math.floor(this.t);
      const burst = 4 + Math.floor(this.t / 60);
      for (let i = 0; i < burst; i++) game.enemies.spawn(Math.random() < 0.7 ? 'goblin' : 'bat', 1 + this.t * 0.011, game.wizard.pos);
    }

    for (const b of this.beats) {
      if (!b.done && this.t >= b.t) { b.done = true; b.fn(game); }
    }
  }
}
