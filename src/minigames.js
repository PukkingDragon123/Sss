// minigames.js — ten little Mario-Party-style stage games.
//
// HARD RULE: this module imports nothing and touches no DOM/Three. Every game's
// rules live in PURE functions (init/update/onInput/isOver/scoreOf/reward) so the
// test suite can drive them in node. Only draw(ctx,…) touches a 2D canvas, and it is
// called solely by ui.js inside the render loop (and is defensive).
//
// Contract per game:
//   id, name, how, dur(s), controls:[{id,label,big?,color?}]  (DOM buttons; [] = canvas-tap)
//   init(opts{rng}) -> state         (also sets state.timeLeft = dur)
//   update(state, dt)                (pure; dt seconds)
//   onInput(state, ev)               (ev: {type:'button',id} | {type:'pointer',nx,ny} | {type:'key',key})
//   isOver(state) -> bool            (early finish; driver also ends on timeLeft<=0)
//   scoreOf(state) -> 0..1
//   reward(score) -> {gems, cardChance}
//   draw(ctx, W, H, state)           (DRAW ONLY, defensive)

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const defaultReward = (s) => ({
  gems: Math.round(2 + s * 8),
  cardChance: s >= 0.95 ? 0.6 : s >= 0.7 ? 0.35 : s >= 0.4 ? 0.15 : 0.05,
});
const isTap = (ev) => ev.type === 'tap' || ev.type === 'pointer' || (ev.type === 'button' && ev.id === 'tap') || (ev.type === 'key' && (ev.key === ' ' || ev.key === 'Spacebar'));
const moveDir = (ev) => {
  if (ev.type === 'button') return ev.id === 'L' ? -1 : ev.id === 'R' ? 1 : 0;
  if (ev.type === 'key') return ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
  return 0;
};

// small shared canvas helpers (defensive draws)
function bg(ctx, W, H, top, bot) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function text(ctx, s, x, y, size, color = '#fff', align = 'center') {
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.font = `${size}px system-ui, sans-serif`; ctx.fillText(s, x, y);
}

// ----------------------------------------------------------------------------- 1. REFLEX
const reflex = {
  id: 'reflex', name: 'Bullseye', how: 'TAP when the ring is inside the gold band!', dur: 18,
  controls: [{ id: 'tap', label: 'TAP!', big: true }],
  init(o = {}) { const rng = o.rng || Math.random; return { rng, rounds: 5, round: 0, r: 1, speed: 0.55 + rng() * 0.1, band: 0.34, half: 0.12, results: [], timeLeft: 18 }; },
  update(s, dt) { s.r -= s.speed * dt; if (s.r <= 0.02) { s.results.push(0); s.r = 1; s.round++; } },
  onInput(s, ev) { if (!isTap(ev) || s.round >= s.rounds) return; const close = clamp(1 - Math.abs(s.r - s.band) / s.half, 0, 1); s.results.push(close); s.r = 1; s.round++; },
  isOver(s) { return s.round >= s.rounds; },
  scoreOf(s) { if (!s.results.length) return 0; return clamp(s.results.reduce((a, b) => a + b, 0) / s.rounds, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#102038', '#06101f'); const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.4; ctx.lineWidth = Math.max(6, W * 0.03); ctx.strokeStyle = '#3a5a3a'; ctx.beginPath(); ctx.arc(cx, cy, R * s.band, 0, 7); ctx.stroke(); ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(cx, cy, R * (s.band + s.half), 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, R * Math.max(0, s.band - s.half), 0, 7); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, W * 0.02); ctx.beginPath(); ctx.arc(cx, cy, R * clamp(s.r, 0, 1), 0, 7); ctx.stroke(); text(ctx, `${s.round}/${s.rounds}`, cx, H * 0.9, W * 0.06, '#bcd'); },
};

// ----------------------------------------------------------------------------- 2. MASH
const mash = {
  id: 'mash', name: 'Tug o\' War', how: 'MASH to drag the rope past the goblin!', dur: 12,
  controls: [{ id: 'tap', label: 'MASH!', big: true }],
  init(o = {}) { const rng = o.rng || Math.random; return { rng, rope: 0.5, ai: 0.16 + rng() * 0.05, pull: 0.045, timeLeft: 12 }; },
  update(s, dt) { s.rope = clamp(s.rope - s.ai * dt, 0, 1); },
  onInput(s, ev) { if (isTap(ev)) s.rope = clamp(s.rope + s.pull, 0, 1); },
  isOver(s) { return s.rope <= 0 || s.rope >= 1; },
  scoreOf(s) { return clamp(s.rope, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#2a1c30', '#140a18'); const y = H * 0.5; ctx.strokeStyle = '#caa'; ctx.lineWidth = Math.max(4, H * 0.012); ctx.beginPath(); ctx.moveTo(W * 0.08, y); ctx.lineTo(W * 0.92, y); ctx.stroke(); ctx.strokeStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(W / 2, y - H * 0.06); ctx.lineTo(W / 2, y + H * 0.06); ctx.stroke(); const kx = W * (0.12 + s.rope * 0.76); text(ctx, '🧙', kx - W * 0.06, y, W * 0.12); text(ctx, '👺', kx + W * 0.06, y, W * 0.12); text(ctx, s.rope >= 0.5 ? 'Pull!' : 'Losing!', W / 2, H * 0.86, W * 0.06, s.rope >= 0.5 ? '#8f8' : '#f88'); },
};

// ----------------------------------------------------------------------------- 3. DODGE
const dodge = {
  id: 'dodge', name: 'Rockfall', how: 'LEFT / RIGHT (or ◀ ▶) to dodge the falling rocks!', dur: 20,
  controls: [{ id: 'L', label: '◀' }, { id: 'R', label: '▶' }],
  init(o = {}) { const rng = o.rng || Math.random; return { rng, px: 0.5, rocks: [], spawn: 0.6, fall: 0.55, lives: 3, dur0: 20, timeLeft: 20 }; },
  update(s, dt) {
    s.spawn -= dt; if (s.spawn <= 0) { s.spawn = 0.55 + s.rng() * 0.45; s.rocks.push({ x: s.rng(), y: -0.05 }); }
    for (const r of s.rocks) r.y += s.fall * dt;
    for (const r of s.rocks) { if (!r.hit && r.y > 0.86 && r.y < 1.0 && Math.abs(r.x - s.px) < 0.09) { r.hit = true; s.lives--; } }
    s.rocks = s.rocks.filter(r => r.y < 1.1);
  },
  onInput(s, ev) { const d = moveDir(ev); if (d) s.px = clamp(s.px + d * 0.16, 0.05, 0.95); },
  isOver(s) { return s.lives <= 0; },
  scoreOf(s) { return clamp((s.dur0 - Math.max(0, s.timeLeft)) / s.dur0, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#241a14', '#0e0a06'); for (const r of s.rocks) text(ctx, '🪨', r.x * W, r.y * H, W * 0.09); text(ctx, '🧙', s.px * W, H * 0.92, W * 0.11); text(ctx, '❤'.repeat(Math.max(0, s.lives)), W * 0.5, H * 0.06, W * 0.05, '#f66'); },
};

// ----------------------------------------------------------------------------- 4. SIMON
const SIMON_COLORS = ['#e0556a', '#5fc97a', '#5aa6e0', '#e0c24a'];
const simon = {
  id: 'simon', name: 'Glyph Memory', how: 'Watch, then repeat the sequence!', dur: 30,
  controls: [{ id: 'c0', label: '🔴', color: '#e0556a' }, { id: 'c1', label: '🟢', color: '#5fc97a' }, { id: 'c2', label: '🔵', color: '#5aa6e0' }, { id: 'c3', label: '🟡', color: '#e0c24a' }],
  init(o = {}) { const rng = o.rng || Math.random; const s = { rng, seq: [], phase: 'show', showIdx: 0, showT: 0.6, inputIdx: 0, level: 0, target: 6, lit: -1, failed: false, timeLeft: 30 }; this._next(s); return s; },
  _next(s) { s.seq.push(Math.floor(s.rng() * 4)); s.level++; s.phase = 'show'; s.showIdx = 0; s.showT = 0.6; s.inputIdx = 0; s.lit = s.seq[0]; },
  update(s, dt) {
    if (s.phase !== 'show') return;
    s.showT -= dt;
    if (s.showT <= 0) { s.showIdx++; if (s.showIdx >= s.seq.length) { s.phase = 'input'; s.lit = -1; } else { s.lit = s.seq[s.showIdx]; s.showT = 0.6; } }
  },
  onInput(s, ev) {
    if (s.phase !== 'input') return;
    let i = -1;
    if (ev.type === 'button' && /^c[0-3]$/.test(ev.id)) i = Number(ev.id[1]);
    else if (ev.type === 'key' && '1234'.includes(ev.key)) i = Number(ev.key) - 1;
    else if (ev.type === 'pointer') i = clamp(Math.floor(ev.nx * 2), 0, 1) + clamp(Math.floor(ev.ny * 2), 0, 1) * 2;
    if (i < 0) return;
    s.lit = i;
    if (i === s.seq[s.inputIdx]) { s.inputIdx++; if (s.inputIdx >= s.seq.length) { if (s.level >= s.target) { s.phase = 'done'; } else this._next(s); } }
    else s.failed = true;
  },
  isOver(s) { return s.failed || s.level > s.target || s.phase === 'done'; },
  scoreOf(s) { return clamp((s.level - (s.failed ? 1 : 0)) / s.target, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#161024', '#08040f'); const pad = W * 0.06, cw = (W - pad * 3) / 2, ch = (H * 0.78 - pad * 3) / 2; for (let i = 0; i < 4; i++) { const c = i % 2, r = (i / 2) | 0; const x = pad + c * (cw + pad), y = pad + r * (ch + pad); ctx.fillStyle = SIMON_COLORS[i]; ctx.globalAlpha = s.lit === i ? 1 : 0.4; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, cw, ch, 12) : ctx.rect(x, y, cw, ch); ctx.fill(); ctx.globalAlpha = 1; } text(ctx, s.phase === 'show' ? 'Watch…' : s.phase === 'input' ? 'Repeat!' : 'Done!', W / 2, H * 0.93, W * 0.06, '#cbd'); },
};

// ----------------------------------------------------------------------------- 5. MOLE
const mole = {
  id: 'mole', name: 'Whack-a-Goblin', how: 'Tap goblins 👺, avoid bombs 💣!', dur: 20,
  controls: [], // canvas 3x3 grid
  init(o = {}) { const rng = o.rng || Math.random; return { rng, cells: new Array(9).fill(null), spawn: 0.5, hits: 0, misses: 0, timeLeft: 20 }; },
  update(s, dt) {
    for (let i = 0; i < 9; i++) { const c = s.cells[i]; if (c) { c.t -= dt; if (c.t <= 0) { if (c.type === 'mole') s.misses++; s.cells[i] = null; } } }
    s.spawn -= dt;
    if (s.spawn <= 0) { s.spawn = 0.45 + s.rng() * 0.4; const free = []; for (let i = 0; i < 9; i++) if (!s.cells[i]) free.push(i); if (free.length) { const i = free[(s.rng() * free.length) | 0]; s.cells[i] = { type: s.rng() < 0.78 ? 'mole' : 'bomb', t: 0.8 + s.rng() * 0.6 }; } }
  },
  onInput(s, ev) { if (ev.type !== 'pointer') return; const cx = clamp((ev.nx * 3) | 0, 0, 2), cy = clamp((ev.ny * 3) | 0, 0, 2); const i = cy * 3 + cx; const c = s.cells[i]; if (!c) { s.misses++; return; } if (c.type === 'mole') s.hits++; else s.misses += 2; s.cells[i] = null; },
  isOver() { return false; },
  scoreOf(s) { const tot = s.hits + s.misses; return tot <= 0 ? 0 : clamp(s.hits / tot, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#173018', '#08160a'); const m = W * 0.04, sz = (W - m * 4) / 3; for (let i = 0; i < 9; i++) { const c = i % 3, r = (i / 3) | 0; const x = m + c * (sz + m), y = m + r * (sz + m); ctx.fillStyle = '#2c4a2e'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, sz, sz, 10) : ctx.rect(x, y, sz, sz); ctx.fill(); const cell = s.cells[i]; if (cell) text(ctx, cell.type === 'mole' ? '👺' : '💣', x + sz / 2, y + sz / 2, sz * 0.6); } text(ctx, `👊 ${s.hits}`, W * 0.5, H * 0.95, W * 0.055, '#9f9'); },
};

// ----------------------------------------------------------------------------- 6. BALANCE
const balance = {
  id: 'balance', name: 'Tightrope', how: 'LEFT / RIGHT to stay balanced!', dur: 16,
  controls: [{ id: 'L', label: '◀ lean' }, { id: 'R', label: 'lean ▶' }],
  init(o = {}) { const rng = o.rng || Math.random; return { rng, tilt: 0, vel: 0, up: 0, n: 0, fell: false, timeLeft: 16 }; },
  update(s, dt) { s.vel += s.tilt * 0.9 * dt + (s.rng() - 0.5) * 0.9 * dt; s.tilt = clamp(s.tilt + s.vel * dt, -1.2, 1.2); s.up += (1 - Math.min(1, Math.abs(s.tilt))); s.n++; if (Math.abs(s.tilt) >= 1) s.fell = true; },
  onInput(s, ev) { const d = moveDir(ev); if (d) s.vel -= d * 0.42; },
  isOver(s) { return s.fell; },
  scoreOf(s) { return s.n ? clamp(s.up / s.n, 0, 1) : 0; },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#1a2438', '#0a1020'); const cx = W / 2 + s.tilt * W * 0.32, cy = H * 0.55; ctx.strokeStyle = '#caa'; ctx.lineWidth = Math.max(3, H * 0.01); ctx.beginPath(); ctx.moveTo(W * 0.1, H * 0.8); ctx.lineTo(W * 0.9, H * 0.8); ctx.stroke(); ctx.save(); ctx.translate(cx, cy); ctx.rotate(s.tilt * 0.6); text(ctx, '🧙', 0, 0, W * 0.13); ctx.restore(); text(ctx, Math.abs(s.tilt) > 0.7 ? 'Whoa!' : 'Steady', W / 2, H * 0.92, W * 0.06, Math.abs(s.tilt) > 0.7 ? '#f88' : '#8f8'); },
};

// ----------------------------------------------------------------------------- 7. CATCH
const catchg = {
  id: 'catch', name: 'Brew Catch', how: 'Catch 🍺, dodge 💣! LEFT / RIGHT', dur: 20,
  controls: [{ id: 'L', label: '◀' }, { id: 'R', label: '▶' }],
  init(o = {}) { const rng = o.rng || Math.random; return { rng, px: 0.5, items: [], spawn: 0.5, fall: 0.5, caught: 0, good: 0, bad: 0, timeLeft: 20 }; },
  update(s, dt) {
    s.spawn -= dt; if (s.spawn <= 0) { s.spawn = 0.5 + s.rng() * 0.4; const good = s.rng() < 0.72; if (good) s.good++; s.items.push({ x: s.rng(), y: -0.05, good }); }
    for (const it of s.items) it.y += s.fall * dt;
    for (const it of s.items) { if (!it.done && it.y > 0.86) { it.done = true; if (Math.abs(it.x - s.px) < 0.1) { if (it.good) s.caught++; else s.bad++; } } }
    s.items = s.items.filter(it => it.y < 1.1);
  },
  onInput(s, ev) { const d = moveDir(ev); if (d) s.px = clamp(s.px + d * 0.16, 0.05, 0.95); },
  isOver() { return false; },
  scoreOf(s) { if (s.good <= 0) return 0; return clamp((s.caught - s.bad) / s.good, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#201a10', '#0c0a04'); for (const it of s.items) text(ctx, it.good ? '🍺' : '💣', it.x * W, it.y * H, W * 0.08); text(ctx, '🧺', s.px * W, H * 0.92, W * 0.12); text(ctx, `🍺 ${s.caught}`, W * 0.5, H * 0.06, W * 0.055, '#fd8'); },
};

// ----------------------------------------------------------------------------- 8. RHYTHM
const rhythm = {
  id: 'rhythm', name: 'Beat Tap', how: 'TAP on every beat — stay in time!', dur: 18,
  controls: [{ id: 'tap', label: 'TAP!', big: true }],
  init(o = {}) { const rng = o.rng || Math.random; const iv = 0.7; const beats = []; for (let t = 1.0; t < 17; t += iv) beats.push(t); return { rng, now: 0, iv, beats, idx: 0, perfect: 0, good: 0, miss: 0, flash: 0, timeLeft: 18 }; },
  update(s, dt) { s.now += dt; if (s.flash > 0) s.flash -= dt; while (s.idx < s.beats.length && s.now > s.beats[s.idx] + 0.34) { s.miss++; s.idx++; } },
  onInput(s, ev) { if (!isTap(ev) || s.idx >= s.beats.length) return; const d = Math.abs(s.now - s.beats[s.idx]); if (d < 0.16) { s.perfect++; s.idx++; s.flash = 0.2; } else if (d < 0.34) { s.good++; s.idx++; s.flash = 0.1; } else { s.miss++; } },
  isOver(s) { return s.idx >= s.beats.length; },
  scoreOf(s) { return s.beats.length ? clamp((s.perfect + s.good * 0.5) / s.beats.length, 0, 1) : 0; },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, s.flash > 0 ? '#2a2050' : '#140e2a', '#06040f'); const next = s.beats[s.idx]; const d = next != null ? next - s.now : 1; const rr = clamp(Math.abs(d) / s.iv, 0, 1); const cx = W / 2, cy = H * 0.45, R = Math.min(W, H) * 0.34; ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = Math.max(4, W * 0.02); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, R * (1 + rr), 0, 7); ctx.stroke(); text(ctx, `✨ ${s.perfect}`, W / 2, H * 0.9, W * 0.06, '#bdf'); },
};

// ----------------------------------------------------------------------------- 9. STACK
const stack = {
  id: 'stack', name: 'Tower Stack', how: 'TAP to drop the block — stack them straight!', dur: 25,
  controls: [{ id: 'tap', label: 'DROP!', big: true }],
  init(o = {}) { const rng = o.rng || Math.random; return { rng, blocks: [{ x: 0.35, w: 0.3 }], cur: { x: 0, w: 0.3, dir: 1, speed: 0.5 + rng() * 0.1 }, placed: 0, target: 10, missed: false, timeLeft: 25 }; },
  update(s, dt) { const c = s.cur; c.x += c.dir * c.speed * dt; if (c.x <= 0) { c.x = 0; c.dir = 1; } if (c.x + c.w >= 1) { c.x = 1 - c.w; c.dir = -1; } },
  onInput(s, ev) {
    if (!isTap(ev)) return;
    const top = s.blocks[s.blocks.length - 1], c = s.cur;
    const l = Math.max(top.x, c.x), r = Math.min(top.x + top.w, c.x + c.w);
    if (r <= l) { s.missed = true; return; }
    const w = r - l; s.blocks.push({ x: l, w }); s.placed++;
    s.cur = { x: 0, w, dir: 1, speed: Math.min(1.1, c.speed + 0.06) };
  },
  isOver(s) { return s.missed || s.placed >= s.target; },
  scoreOf(s) { return clamp(s.placed / s.target, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#101828', '#060a14'); const bh = H * 0.07; const drawBlk = (b, i, moving) => { const y = H * 0.86 - i * bh; ctx.fillStyle = moving ? '#ffd34d' : `hsl(${200 + i * 12},55%,55%)`; ctx.fillRect(b.x * W, y, b.w * W, bh - 2); }; s.blocks.forEach((b, i) => drawBlk(b, i, false)); drawBlk(s.cur, s.blocks.length, true); text(ctx, `${s.placed}/${s.target}`, W / 2, H * 0.06, W * 0.06, '#cde'); },
};

// ----------------------------------------------------------------------------- 10. MATCH
const match = {
  id: 'match', name: 'Card Match', how: 'Tap cards to find the matching pairs!', dur: 30,
  controls: [], // canvas grid
  init(o = {}) { const rng = o.rng || Math.random; const pairs = 6, cols = 4; const vals = []; const faces = ['🍺', '🧙', '👺', '💎', '🔮', '⚔️']; for (let i = 0; i < pairs; i++) { vals.push(faces[i], faces[i]); } for (let i = vals.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = vals[i]; vals[i] = vals[j]; vals[j] = t; } const tiles = vals.map(v => ({ v, up: false, done: false })); return { rng, tiles, cols, pairs, matched: 0, first: -1, lockT: 0, lockPair: null, timeLeft: 30 }; },
  update(s, dt) { if (s.lockT > 0) { s.lockT -= dt; if (s.lockT <= 0 && s.lockPair) { s.tiles[s.lockPair[0]].up = false; s.tiles[s.lockPair[1]].up = false; s.lockPair = null; s.first = -1; } } },
  onInput(s, ev) {
    if (s.lockT > 0) return;
    let idx = -1;
    if (ev.type === 'pointer') { const rows = Math.ceil(s.tiles.length / s.cols); const c = clamp((ev.nx * s.cols) | 0, 0, s.cols - 1); const r = clamp((ev.ny * rows) | 0, 0, rows - 1); idx = r * s.cols + c; }
    if (idx < 0 || idx >= s.tiles.length) return;
    const t = s.tiles[idx]; if (t.up || t.done) return;
    t.up = true;
    if (s.first < 0) { s.first = idx; }
    else { if (s.tiles[s.first].v === t.v) { s.tiles[s.first].done = t.done = true; s.matched++; s.first = -1; } else { s.lockT = 0.7; s.lockPair = [s.first, idx]; } }
  },
  isOver(s) { return s.matched >= s.pairs; },
  scoreOf(s) { return clamp(s.matched / s.pairs, 0, 1); },
  reward: defaultReward,
  draw(ctx, W, H, s) { if (!ctx) return; bg(ctx, W, H, '#1a1230', '#0a0618'); const rows = Math.ceil(s.tiles.length / s.cols); const m = W * 0.03; const cw = (W - m * (s.cols + 1)) / s.cols, ch = (H * 0.86 - m * (rows + 1)) / rows; s.tiles.forEach((t, i) => { const c = i % s.cols, r = (i / s.cols) | 0; const x = m + c * (cw + m), y = m + r * (ch + m); ctx.fillStyle = t.done ? '#244' : (t.up ? '#46406a' : '#2a2444'); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, cw, ch, 8) : ctx.rect(x, y, cw, ch); ctx.fill(); if (t.up || t.done) text(ctx, t.v, x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.6); else text(ctx, '❓', x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.5, '#776'); }); text(ctx, `${s.matched}/${s.pairs}`, W / 2, H * 0.95, W * 0.05, '#cbd'); },
};

export const MINIGAMES = { reflex, mash, dodge, simon, mole, balance, catch: catchg, rhythm, stack, match };
export const MINIGAME_KEYS = Object.keys(MINIGAMES);
