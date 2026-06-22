// Graph-logic tests for the Slay-the-Spire run map. Run with the loader that
// stubs `three`:  node --import ./test/register-loader.mjs test/mapgen.mjs
import { RunMap } from '../src/runmap.js';

const STAGE = { theme: { floor: 0x223322, rug: 0x334433, bg: 0, fog: 0, fogD: 0.01 } };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };

function bfsReachableTypes(map) {
  // every non-row0 node must have an incoming edge; boss reachable from row0
  const seen = new Set();
  const q = map.rows[0].map(n => n.i);
  q.forEach(i => seen.add(i));
  while (q.length) { const i = q.shift(); for (const j of map.nodes[i].to) if (!seen.has(j)) { seen.add(j); q.push(j); } }
  return seen;
}

for (let trial = 0; trial < 200; trial++) {
  const map = new RunMap({ add() {} });
  map.generate(STAGE);

  // structural
  ok(map.rows.length === 7, `trial ${trial}: 7 rows`);
  ok(map.rows[map.rows.length - 1].length === 1, `trial ${trial}: single boss node`);
  ok(map.rows[map.rows.length - 1][0].type === 'boss', `trial ${trial}: top node is boss`);
  ok(map.rows[0].every(n => n.type === 'fight'), `trial ${trial}: row0 all fights`);

  // every non-start node has an incoming edge
  for (let r = 1; r < map.rows.length; r++) for (const n of map.rows[r]) ok(n.from.length > 0, `trial ${trial}: node r${r} has incoming`);
  // every non-boss node has an outgoing edge
  for (let r = 0; r < map.rows.length - 1; r++) for (const n of map.rows[r]) ok(n.to.length > 0, `trial ${trial}: node r${r} has outgoing`);

  // full reachability from the start row, including the boss
  const seen = bfsReachableTypes(map);
  ok(seen.size === map.nodes.length, `trial ${trial}: all nodes reachable from start`);
  const boss = map.rows[map.rows.length - 1][0];
  ok(seen.has(boss.i), `trial ${trial}: boss reachable`);

  // reachability bookkeeping: start -> row0 reachable; after stepping, next row unlocks
  map.setCurrent(-1);
  ok(map.rows[0].every(n => map.isReachable(n.i)), `trial ${trial}: row0 reachable at start`);
  const first = map.rows[0][0];
  map.setCurrent(first.i);
  ok(first.done, `trial ${trial}: stepped node marked done`);
  ok([...first.to].every(j => map.isReachable(j)), `trial ${trial}: successors unlocked`);
  ok(!map.isReachable(first.i), `trial ${trial}: current node no longer a target`);
}

console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAIL'} — ${pass} checks passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
