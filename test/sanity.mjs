// sanity.mjs — node-runnable checks for the logic that has no Three.js / DOM
// dependency: the $1 gesture recognizer and the upgrade roller.
// Run with:  node test/sanity.mjs
import { Recognizer, TEMPLATES } from '../src/recognizer.js';
import { rollUpgrades, UPGRADES } from '../src/upgrades.js';
import { MINIGAMES, MINIGAME_KEYS } from '../src/minigames.js';
import { CARDS, CARD_BY_ID, CARD_RARITY, applyCardPerks, rollCard } from '../src/cards.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };

// ---- build a recognizer with the in-game templates ----
const rec = new Recognizer();
rec.add('triangle', TEMPLATES.triangle);
rec.add('zigzag', TEMPLATES.zigzag);
rec.add('circle', TEMPLATES.circle);
rec.add('vee', TEMPLATES.vee);
rec.add('line', TEMPLATES.line);
rec.add('caret', TEMPLATES.caret);
rec.add('star', TEMPLATES.star);
rec.add('spiral', TEMPLATES.spiral);
rec.add('square', TEMPLATES.square);
rec.add('scurve', TEMPLATES.scurve);
rec.add('wshape', TEMPLATES.wshape);
rec.add('pigtail', TEMPLATES.pigtail);

// helper: scale + translate + rotate + jitter a template to mimic a sloppy draw
function messUp(points, { scale = 1, dx = 0, dy = 0, rot = 0, jitter = 0 } = {}) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  return points.map(p => {
    const x = p.x * scale, y = p.y * scale;
    return {
      x: x * cos - y * sin + dx + (Math.random() - 0.5) * jitter,
      y: x * sin + y * cos + dy + (Math.random() - 0.5) * jitter,
    };
  });
}

// densify so we have >= 8 raw points for shapes defined by few vertices
function densify(points, perSeg = 12) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      out.push({ x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

console.log('Gesture recognition:');
for (const name of Object.keys(TEMPLATES)) {
  // each template should recognize itself, even shifted/scaled/rotated/jittered
  let good = 0;
  const trials = 20;
  for (let i = 0; i < trials; i++) {
    const drawn = densify(messUp(TEMPLATES[name], {
      scale: 1 + Math.random() * 2,
      dx: (Math.random() - 0.5) * 400,
      dy: (Math.random() - 0.5) * 400,
      rot: (Math.random() - 0.5) * 0.5,
      jitter: 8,
    }));
    const res = rec.recognize(drawn);
    if (res && res.name === name) good++;
  }
  ok(good >= trials - 2, `template "${name}" recognised ${good}/${trials} (need >= ${trials - 2})`);
  console.log(`  • ${name}: ${good}/${trials}`);
}

// ---- upgrade roller ----
console.log('Upgrades:');
const stubEarly = { unlocked: new Set(['fireball', 'gust']) };   // 3 spells still locked
const stubLate = { unlocked: new Set(['fireball', 'gust', 'lightning', 'frost', 'heal']) };
for (let i = 0; i < 200; i++) {
  for (const g of [stubEarly, stubLate]) {
    const r = rollUpgrades(g, 3);
    ok(r.length === 3, 'rollUpgrades returns 3');
    const ids = new Set(r.map(u => u.id));
    ok(ids.size === 3, 'rollUpgrades returns distinct items');
    ok(r.every(u => typeof u.apply === 'function'), 'every upgrade has apply()');
    // locked-spell upgrades must never be offered before the unlock
    if (g === stubEarly) ok(!r.some(u => ['chain', 'frost', 'healup'].includes(u.id)), 'no locked-spell upgrades offered early');
  }
}
ok(UPGRADES.length >= 12, `upgrade pool is large enough (${UPGRADES.length})`);

// ---- party minigames (pure logic; canvas draw is never called here) ----
console.log('Minigames:');
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
ok(MINIGAME_KEYS.length === 10, `exactly 10 minigames (${MINIGAME_KEYS.length})`);
for (const k of MINIGAME_KEYS) {
  const mg = MINIGAMES[k];
  ok(typeof mg.init === 'function' && typeof mg.update === 'function' && typeof mg.onInput === 'function', `${k}: has init/update/onInput`);
  ok(typeof mg.isOver === 'function' && typeof mg.scoreOf === 'function' && typeof mg.reward === 'function', `${k}: has isOver/scoreOf/reward`);
  ok(mg.dur >= 10 && mg.dur <= 35, `${k}: duration sane (${mg.dur})`);
  // headless smoke: full duration, no input, seeded rng -> must terminate & score in [0,1]
  const st = mg.init({ rng: lcg(42) }); st.timeLeft = mg.dur; let f = 0;
  while (!mg.isOver(st) && st.timeLeft > 0 && f < 8000) { mg.update(st, 0.016); st.timeLeft -= 0.016; f++; }
  ok(f < 8000, `${k}: terminates`);
  const sc = mg.scoreOf(st);
  ok(typeof sc === 'number' && sc >= 0 && sc <= 1 && !Number.isNaN(sc), `${k}: idle score in [0,1] (${sc})`);
  const rw = mg.reward(sc);
  ok(rw && typeof rw.gems === 'number' && rw.gems >= 0 && typeof rw.cardChance === 'number', `${k}: reward shape`);
}
// good play beats idle on a representative of each input class
const playMash = (tap) => { const mg = MINIGAMES.mash, s = mg.init({ rng: lcg(1) }); s.timeLeft = mg.dur; let f = 0; while (!mg.isOver(s) && s.timeLeft > 0 && f < 2000) { mg.update(s, 0.016); if (tap && f % 3 === 0) mg.onInput(s, { type: 'button', id: 'tap' }); s.timeLeft -= 0.016; f++; } return mg.scoreOf(s); };
ok(playMash(true) > playMash(false), 'mash: tapping beats idle');
const sim = (() => { const mg = MINIGAMES.simon, s = mg.init({ rng: lcg(3) }); s.timeLeft = mg.dur; let f = 0; while (!mg.isOver(s) && s.timeLeft > 0 && f < 6000) { mg.update(s, 0.016); if (s.phase === 'input') mg.onInput(s, { type: 'button', id: 'c' + s.seq[s.inputIdx] }); s.timeLeft -= 0.016; f++; } return mg.scoreOf(s); })();
ok(sim > 0.9, `simon: perfect play wins (${sim.toFixed(2)})`);

// ---- collectible cards ----
console.log('Cards:');
ok(CARDS.length === 24, `exactly 24 cards (${CARDS.length})`);
ok(new Set(CARDS.map(c => c.id)).size === 24, 'card ids unique');
ok(CARDS.every(c => CARD_RARITY[c.rarity]), 'every card has a valid rarity');
const perks = applyCardPerks(null, CARDS.map(c => c.id));
ok(perks.gemMult >= 1 && perks.dmgMult >= 1 && perks.manaBonus >= 0, 'perks fold to sane values');
let owned = [];
for (let i = 0; i < 24; i++) { const id = rollCard(owned, lcg(i + 1)); ok(id && CARD_BY_ID[id] && !owned.includes(id), `rollCard draws fresh #${i}`); owned.push(id); }
ok(rollCard(owned, lcg(9)) === null, 'rollCard returns null when complete');

// ---- summary ----
console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} checks passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
