// pixelicons.js — procedural 16×16 pixel-art sprites for gear, tools & loot.
// Shapes are painted onto a tiny grid, auto-shaded (top-left light / bottom-right
// dark) and auto-outlined, then upscaled with nearest-neighbour to stay crunchy.
// Everything is cached as a dataURL; on any failure callers get '' and keep
// their emoji fallback. No assets, no network.

const S = 16; // sprite grid size

// rarity palettes (match meta.RARITIES colours)
const RARITY_HEX = { common: '#cfcad6', rare: '#6fb0ff', epic: '#b97bff', legendary: '#ffcf5c' };
const OUTLINE = '#181026';
const WOOD = '#8a5a2e', GOLD = '#f4c04a', SPARK = '#ffffff', IRON = '#9aa3ad';

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex([r, g, b]) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
const lighten = (c, t = 0.45) => mix(c, '#ffffff', t);
const darken = (c, t = 0.4) => mix(c, '#000000', t);

// a paintable grid: cells hold a colour string or null
function grid() { return { px: new Array(S * S).fill(null) }; }
function put(g, x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S && y < S) g.px[y * S + x] = c; }
function at(g, x, y) { return (x >= 0 && y >= 0 && x < S && y < S) ? g.px[y * S + x] : null; }
function rect(g, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(g, x, y, c); }
function disc(g, cx, cy, r, c) { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r + 0.4) put(g, x, y, c); } }
function line(g, x0, y0, x1, y1, w, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; for (let ox = 0; ox < w; ox++) for (let oy = 0; oy < w; oy++) put(g, x + ox - (w - 1) / 2, y + oy - (w - 1) / 2, c); }
}
// isoceles triangle: apex (ax,ay) down to a base at row by with half-width hw
function tri(g, ax, ay, by, hw, c) { for (let y = Math.round(ay); y <= by; y++) { const t = (y - ay) / Math.max(1, by - ay); const half = Math.max(0, hw * t); for (let x = Math.ceil(ax - half); x <= Math.floor(ax + half); x++) put(g, x, y, c); } }

// fake top-left lighting: the first pixel of each colour-run gets lighter, the
// last darker — reads as bevelled pixel art with zero hand-tuning.
function shade(g, base) {
  const light = lighten(base, 0.4), dark = darken(base, 0.34);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const c = at(g, x, y); if (c !== base) continue;
      const openL = at(g, x - 1, y) === null, openR = at(g, x + 1, y) === null;
      const openT = at(g, x, y - 1) === null;
      if (openL || openT) put(g, x, y, light);
      else if (openR || at(g, x, y + 1) === null) put(g, x, y, dark);
    }
  }
}
// draw a 1px outline around everything painted so far
function outline(g) {
  const src = g.px.slice();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (src[y * S + x] !== null) continue;
    const n = (x > 0 && src[y * S + x - 1]) || (x < S - 1 && src[y * S + x + 1]) || (y > 0 && src[(y - 1) * S + x]) || (y < S - 1 && src[(y + 1) * S + x]);
    if (n) g.px[y * S + x] = OUTLINE;
  }
}
function sparkle(g, x, y) { put(g, x, y, SPARK); put(g, x - 1, y, null); }

// ---- the sprite recipes (kind, rarity tier 0..3, base colour) ----
const RECIPES = {
  staff(g, tier, col) {
    line(g, 2, 14, 10, 6, 2, WOOD);
    if (tier >= 2) { put(g, 6, 10, GOLD); put(g, 7, 10, GOLD); put(g, 7, 9, GOLD); }   // gold band
    if (tier >= 3) { put(g, 3, 13, GOLD); put(g, 4, 13, GOLD); put(g, 4, 12, GOLD); } // second band
    disc(g, 11, 4, 2.6, col);
    shade(g, col);
    if (tier >= 1) { sparkle(g, 13, 2); sparkle(g, 9, 6); }
    if (tier >= 3) { sparkle(g, 14, 5); sparkle(g, 8, 2); }
  },
  hat(g, tier, col) {
    tri(g, 8, 0, 11, 5.2, col);                       // cone
    rect(g, 2, 11, 12, 2, col);                       // brim
    rect(g, 4, 9, 8, 1, GOLD);                        // band
    if (tier >= 2) { put(g, 8, 9, lighten(col, 0.6)); put(g, 8, 8, darken(col, 0.3)); } // buckle gem
    shade(g, col);
    if (tier >= 1) sparkle(g, 10, 3);
    if (tier >= 3) { sparkle(g, 5, 6); sparkle(g, 12, 10); put(g, 3, 12, GOLD); put(g, 12, 12, GOLD); }
  },
  robe(g, tier, col) {
    rect(g, 5, 2, 6, 2, col);                         // shoulders/collar
    for (let y = 3; y <= 13; y++) { const half = 2.2 + (y - 3) * 0.28; rect(g, Math.round(8 - half), y, Math.round(half * 2), 1, col); } // flowing body
    rect(g, 2, 3, 2, 4, col); rect(g, 12, 3, 2, 4, col); // sleeves
    rect(g, 5, 8, 6, 1, GOLD);                        // belt
    if (tier >= 2) { put(g, 8, 5, GOLD); put(g, 8, 6, GOLD); }  // brooch chain
    shade(g, col);
    put(g, 8, 2, OUTLINE); put(g, 8, 3, darken(col, 0.5));      // collar split
    if (tier >= 1) sparkle(g, 4, 11);
    if (tier >= 3) { sparkle(g, 11, 12); sparkle(g, 6, 4); }
  },
  charm(g, tier, col) {
    // chain: an open arc of gold links
    for (let a = -2.4; a <= -0.7; a += 0.16) put(g, 8 + Math.cos(a) * 5.5, 8.5 + Math.sin(a) * 6, GOLD);
    for (let a = Math.PI + 0.7; a <= Math.PI + 2.4; a += 0.16) put(g, 8 + Math.cos(a) * 5.5, 8.5 + Math.sin(a) * 6, GOLD);
    disc(g, 8, 9, 3.4, col);                          // the stone
    rect(g, 7, 4, 2, 2, GOLD);                        // the mount
    shade(g, col);
    put(g, 7, 8, lighten(col, 0.7));                  // facet glint
    if (tier >= 1) sparkle(g, 12, 5);
    if (tier >= 2) sparkle(g, 4, 12);
    if (tier >= 3) { sparkle(g, 12, 12); sparkle(g, 3, 5); }
  },
  chest(g, tier, col) {
    rect(g, 2, 7, 12, 6, WOOD);                       // box
    rect(g, 2, 4, 12, 3, mix(WOOD, '#ffffff', 0.18)); // lid
    rect(g, 2, 7, 12, 1, darken(WOOD, 0.3));          // lid seam
    rect(g, 4, 4, 1, 9, GOLD); rect(g, 11, 4, 1, 9, GOLD); // straps
    rect(g, 7, 6, 2, 3, GOLD);                        // latch
    put(g, 7, 7, col); put(g, 8, 7, col);             // latch gem = rarity
    shade(g, WOOD);
    if (tier >= 1) sparkle(g, 13, 3);
    if (tier >= 3) sparkle(g, 2, 3);
  },
  potion(g, tier, col) {
    rect(g, 6, 1, 4, 2, WOOD);                        // cork
    rect(g, 7, 3, 2, 3, '#d8e8f0');                   // neck
    disc(g, 8, 10, 4.4, '#cfe2ec');                   // glass
    disc(g, 8, 11, 3.4, col);                         // the liquid
    shade(g, col);
    put(g, 6, 8, '#ffffff');                          // glass glint
    if (tier >= 1) sparkle(g, 12, 4);
  },
  hammer(g, tier, col) {
    rect(g, 3, 2, 10, 4, IRON);                       // head
    rect(g, 3, 2, 10, 1, lighten(IRON, 0.4));
    rect(g, 3, 5, 10, 1, darken(IRON, 0.3));
    put(g, 8, 3, col); put(g, 8, 4, col);             // inlay = tier colour
    line(g, 8, 6, 8, 14, 2, WOOD);                    // handle
    shade(g, IRON);
    if (tier >= 1) sparkle(g, 12, 1);
    if (tier >= 3) { sparkle(g, 3, 1); put(g, 8, 13, GOLD); put(g, 7, 13, GOLD); }
  },
  gem(g, tier, col) {
    tri(g, 8, 3, 8, 5, col);
    for (let y = 8; y <= 12; y++) { const half = 5 * (1 - (y - 8) / 5); rect(g, Math.round(8 - half), y, Math.max(1, Math.round(half * 2)), 1, col); }
    shade(g, col);
    put(g, 6, 6, lighten(col, 0.7)); put(g, 7, 5, lighten(col, 0.7));
    if (tier >= 1) sparkle(g, 12, 4);
  },
};

const TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
const _cache = new Map();

// dataURL of a pixel sprite ('' on failure). kind: staff|hat|robe|charm|chest|potion|hammer|gem
// opts: { rarity: 'common'.., color: '#hex' override, scale: px multiple (default 6) }
export function spriteURL(kind, opts = {}) {
  const rarity = opts.rarity || 'common';
  const color = opts.color || RARITY_HEX[rarity] || RARITY_HEX.common;
  const scale = opts.scale || 6;
  const key = `${kind}|${rarity}|${color}|${scale}`;
  if (_cache.has(key)) return _cache.get(key);
  let url = '';
  try {
    const recipe = RECIPES[kind];
    if (recipe && typeof document !== 'undefined') {
      const g = grid();
      recipe(g, TIER[rarity] ?? 0, color);
      outline(g);
      const c = document.createElement('canvas'); c.width = c.height = S * scale;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const col = g.px[y * S + x]; if (!col) continue; ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
      url = c.toDataURL('image/png');
    }
  } catch (e) { url = ''; }
  _cache.set(key, url);
  return url;
}

// DOM helper: an <img> pixel sprite, or the emoji fallback if drawing failed
export function spriteImg(kind, opts = {}, cls = '', fallback = '❔') {
  const url = spriteURL(kind, opts);
  if (!url) return `<span class="pixgear-fb ${cls}">${fallback}</span>`;
  return `<img class="pixgear ${cls}" src="${url}" alt="" draggable="false">`;
}

// gear-instance convenience (slot maps 1:1 onto a sprite kind)
export function gearImg(inst, cls = '') {
  if (!inst) return '';
  return spriteImg(inst.slot, { rarity: inst.rarity }, cls, ({ hat: '🎩', robe: '🧥', staff: '🪄', charm: '🔮' })[inst.slot] || '🎒');
}
