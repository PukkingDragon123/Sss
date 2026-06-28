// runmap.js — pure generator for a Slay-the-Spire / Mewgenics style branching level map.
// Imports nothing (no DOM/Three) so it is node-testable. It only decides the GRAPH and
// each node's TYPE; the game turns a chosen node's type into a live encounter at run time.
//
// Layout: row 0 = entrance (single combat node), last row = boss (single node), the rows
// between are branching choice rows (1–`cols` nodes). Every node lies on at least one full
// path from the entrance to the boss, so the map is always fully traversable.

const TYPE_POOL = [
  ['combat', 5], ['minigame', 3], ['event', 3], ['treasure', 2], ['elite', 2], ['campfire', 2], ['skill', 2],
];
function pickType(rng) {
  let tot = 0; for (const [, w] of TYPE_POOL) tot += w;
  let r = rng() * tot;
  for (const [t, w] of TYPE_POOL) { r -= w; if (r <= 0) return t; }
  return TYPE_POOL[0][0];
}

export function generateRunMap(rng = Math.random, { rows = 10, cols = 3, paths = 5 } = {}) {
  rows = Math.max(3, rows); cols = Math.max(1, cols);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const mid = (cols - 1) >> 1;
  const node = (r, c) => { if (!grid[r][c]) grid[r][c] = { id: r + '_' + c, row: r, col: c, type: null, next: [], prev: [] }; return grid[r][c]; };
  const link = (a, b) => { if (!a.next.includes(b.id)) a.next.push(b.id); if (!b.prev.includes(a.id)) b.prev.push(a.id); };

  const entrance = node(0, mid);
  const boss = node(rows - 1, mid);

  // carve `paths` random walks from the entrance up to the row before the boss,
  // stepping the column by -1/0/+1 each row, then funnel into the boss.
  for (let p = 0; p < paths; p++) {
    let c = mid, cur = entrance;
    for (let r = 1; r <= rows - 2; r++) {
      const cand = [c - 1, c, c + 1].filter(x => x >= 0 && x < cols);
      const nc = cand[Math.floor(rng() * cand.length)];
      const nxt = node(r, nc); link(cur, nxt); cur = nxt; c = nc;
    }
    link(cur, boss);
  }

  const nodes = grid.flat().filter(Boolean);
  for (const n of nodes) {
    if (n === entrance) n.type = 'combat';
    else if (n === boss) n.type = 'boss';
    else if (n.row === rows - 2) n.type = rng() < 0.6 ? 'campfire' : pickType(rng); // a rest tends to sit before the boss
    else if (n.row === Math.floor(rows / 2)) n.type = rng() < 0.5 ? 'treasure' : pickType(rng);
    else n.type = pickType(rng);
  }

  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  return { nodes, byId, startId: entrance.id, bossId: boss.id, rows, cols };
}
