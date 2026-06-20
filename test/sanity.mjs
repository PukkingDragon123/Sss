// sanity.mjs — node-runnable checks for the logic that has no Three.js / DOM
// dependency: the $1 gesture recognizer and the upgrade roller.
// Run with:  node test/sanity.mjs
import { Recognizer, TEMPLATES } from '../src/recognizer.js';
import { rollUpgrades, UPGRADES } from '../src/upgrades.js';

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

// ---- summary ----
console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'} — ${pass} checks passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
