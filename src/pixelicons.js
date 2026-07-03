// pixelicons.js — procedural 16×16 pixel-art sprites for gear, tools, loot and
// every icon in the UI (the game renders NO emoji — each glyph is painted here).
// Shapes are painted onto a tiny grid, auto-shaded (top-left light / bottom-right
// dark) and auto-outlined, then upscaled with nearest-neighbour to stay crunchy.
// Everything is cached as a dataURL; on any failure callers get '' and keep
// their text fallback. No assets, no network.

const S = 16; // sprite grid size

// rarity palettes (match meta.RARITIES colours)
const RARITY_HEX = { common: '#cfcad6', rare: '#6fb0ff', epic: '#b97bff', legendary: '#ffcf5c' };
const OUTLINE = '#181026';
const WOOD = '#8a5a2e', GOLD = '#f4c04a', SPARK = '#ffffff', IRON = '#9aa3ad';
const RED = '#ff5d6c', GREEN = '#5fb85f', BLUE = '#56b8ff', PURPLE = '#9b7bff';
const CREAM = '#f6e9c9', DARK = '#3a3346', SKIN = '#f0c89a', AMBER = '#e8a33a';

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
// trapezoid of rows: centre cx, from yTop (half-width hTop) to yBot (half-width hBot)
function taper(g, cx, yTop, yBot, hTop, hBot, c) {
  for (let y = Math.round(yTop); y <= Math.round(yBot); y++) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const half = hTop + (hBot - hTop) * t;
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) put(g, x, y, c);
  }
}

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
  // ===== gear & loot (rarity-tinted) =====
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
    rect(g, 2, 7, 12, 6, WOOD);
    rect(g, 2, 4, 12, 3, mix(WOOD, '#ffffff', 0.18));
    rect(g, 2, 7, 12, 1, darken(WOOD, 0.3));
    rect(g, 4, 4, 1, 9, GOLD); rect(g, 11, 4, 1, 9, GOLD);
    rect(g, 7, 6, 2, 3, GOLD);
    put(g, 7, 7, col); put(g, 8, 7, col);
    shade(g, WOOD);
    if (tier >= 1) sparkle(g, 13, 3);
    if (tier >= 3) sparkle(g, 2, 3);
  },
  potion(g, tier, col) {
    rect(g, 6, 1, 4, 2, WOOD);
    rect(g, 7, 3, 2, 3, '#d8e8f0');
    disc(g, 8, 10, 4.4, '#cfe2ec');
    disc(g, 8, 11, 3.4, col);
    shade(g, col);
    put(g, 6, 8, '#ffffff');
    if (tier >= 1) sparkle(g, 12, 4);
  },
  hammer(g, tier, col) {
    rect(g, 3, 2, 10, 4, IRON);
    rect(g, 3, 2, 10, 1, lighten(IRON, 0.4));
    rect(g, 3, 5, 10, 1, darken(IRON, 0.3));
    put(g, 8, 3, col); put(g, 8, 4, col);
    line(g, 8, 6, 8, 14, 2, WOOD);
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

  // ===== currencies & resources =====
  coin(g) {
    disc(g, 8, 8, 5.4, GOLD);
    disc(g, 8, 8, 3.6, darken(GOLD, 0.18));
    disc(g, 8, 8, 2.6, GOLD);
    shade(g, GOLD);
    sparkle(g, 11, 4);
  },
  coins(g) {
    rect(g, 3, 10, 8, 2, GOLD); rect(g, 5, 7, 8, 2, GOLD); rect(g, 2, 4, 8, 2, GOLD);
    rect(g, 3, 11, 8, 1, darken(GOLD, 0.25)); rect(g, 5, 8, 8, 1, darken(GOLD, 0.25)); rect(g, 2, 5, 8, 1, darken(GOLD, 0.25));
    shade(g, GOLD); sparkle(g, 12, 3);
  },
  moneybag(g) {
    taper(g, 8, 6, 13, 2.4, 4.6, '#a97a44');
    rect(g, 6, 4, 4, 2, '#7a5230');
    rect(g, 5, 2, 6, 2, '#a97a44');
    shade(g, '#a97a44');
    put(g, 7, 9, GOLD); put(g, 9, 10, GOLD); put(g, 8, 8, darken('#a97a44', 0.3));
  },
  beer(g) {
    rect(g, 4, 5, 7, 9, AMBER);
    rect(g, 4, 2, 7, 3, '#fff6e8');
    put(g, 4, 1, '#fff6e8'); put(g, 7, 1, '#fff6e8'); put(g, 10, 1, '#fff6e8');
    line(g, 12, 6, 13, 6, 1, '#c9812f'); line(g, 13, 6, 13, 11, 1, '#c9812f'); line(g, 12, 11, 13, 11, 1, '#c9812f');
    rect(g, 4, 12, 7, 1, darken(AMBER, 0.28));
    shade(g, AMBER);
    put(g, 5, 7, lighten(AMBER, 0.5));
  },
  cheers(g) {
    rect(g, 2, 6, 5, 8, AMBER); rect(g, 9, 6, 5, 8, AMBER);
    rect(g, 2, 4, 5, 2, '#fff6e8'); rect(g, 9, 4, 5, 2, '#fff6e8');
    shade(g, AMBER);
    sparkle(g, 8, 2); put(g, 7, 3, SPARK); put(g, 9, 3, SPARK);
  },
  heart(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff5d6c' : col;  // bare 'heart' = red
    disc(g, 5.6, 6, 2.7, c); disc(g, 10.4, 6, 2.7, c);
    taper(g, 8, 7, 13, 5.4, 0.4, c);
    shade(g, c);
    put(g, 5, 5, lighten(c, 0.6)); put(g, 6, 4, lighten(c, 0.6));
  },
  herb(g) {
    line(g, 8, 13, 8, 5, 1, '#3f8f3f');
    disc(g, 5, 6, 1.7, GREEN); disc(g, 11, 5, 1.7, GREEN);
    disc(g, 6, 9, 1.7, GREEN); disc(g, 10, 9, 1.7, GREEN);
    disc(g, 8, 3, 1.5, GREEN);
    shade(g, GREEN);
  },
  mushroom(g) {
    disc(g, 8, 6, 5, '#d84a4a'); rect(g, 2, 7, 12, 1, null); rect(g, 0, 8, 16, 8, null);
    rect(g, 3, 6, 10, 2, '#d84a4a');
    rect(g, 6, 8, 4, 5, '#f3e6d0');
    shade(g, '#d84a4a'); shade(g, '#f3e6d0');
    put(g, 5, 4, '#fff0e0'); put(g, 10, 5, '#fff0e0'); put(g, 8, 3, '#fff0e0');
  },
  honey(g) {
    disc(g, 8, 9, 4.4, '#d8912f');
    rect(g, 5, 3, 6, 2, WOOD);
    rect(g, 4, 6, 8, 1, lighten('#d8912f', 0.3));
    shade(g, '#d8912f');
    put(g, 10, 13, '#f0b34a');
  },
  sun(g) {
    disc(g, 8, 8, 3.6, '#ffd23a');
    line(g, 8, 1, 8, 3, 1, '#ffd23a'); line(g, 8, 13, 8, 15, 1, '#ffd23a');
    line(g, 1, 8, 3, 8, 1, '#ffd23a'); line(g, 13, 8, 15, 8, 1, '#ffd23a');
    put(g, 3, 3, '#ffd23a'); put(g, 4, 4, '#ffd23a'); put(g, 12, 3, '#ffd23a'); put(g, 11, 4, '#ffd23a');
    put(g, 3, 12, '#ffd23a'); put(g, 4, 11, '#ffd23a'); put(g, 12, 12, '#ffd23a'); put(g, 11, 11, '#ffd23a');
    shade(g, '#ffd23a');
  },
  moon(g) {
    disc(g, 8, 8, 5.2, '#ffe9a0');
    disc(g, 10.6, 6.4, 4.4, null);
    shade(g, '#ffe9a0');
    put(g, 5, 6, darken('#ffe9a0', 0.15));
  },
  hourglass(g) {
    rect(g, 4, 2, 8, 1, WOOD); rect(g, 4, 13, 8, 1, WOOD);
    taper(g, 8, 3, 7, 3.4, 0.4, '#cfe2ec');
    taper(g, 8, 8, 12, 0.4, 3.4, '#cfe2ec');
    shade(g, '#cfe2ec');
    put(g, 8, 6, '#f0c04a'); put(g, 8, 7, '#f0c04a'); rect(g, 6, 11, 5, 2, '#f0c04a');
  },
  clock(g) {
    disc(g, 8, 8, 5.4, '#e8e8f0');
    disc(g, 8, 8, 4.4, '#f8f8ff');
    line(g, 8, 8, 8, 5, 1, DARK); line(g, 8, 8, 10, 9, 1, DARK);
    rect(g, 7, 1, 2, 1, GOLD);
    shade(g, '#e8e8f0');
  },
  skull(g) {
    disc(g, 8, 6, 4.6, '#f2eee2');
    rect(g, 5, 9, 6, 4, '#f2eee2');
    rect(g, 5, 5, 2, 2, '#22182e'); rect(g, 9, 5, 2, 2, '#22182e');
    put(g, 8, 8, '#22182e');
    put(g, 6, 11, '#22182e'); put(g, 8, 11, '#22182e'); put(g, 10, 11, '#22182e');
    shade(g, '#f2eee2');
  },
  book(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#7a4ea0' : col;
    rect(g, 3, 3, 10, 10, c);
    rect(g, 3, 3, 2, 10, darken(c, 0.3));
    rect(g, 12, 4, 1, 8, CREAM);
    rect(g, 7, 6, 3, 1, GOLD); put(g, 8, 7, GOLD); put(g, 8, 8, GOLD); put(g, 8, 9, GOLD); put(g, 7, 10, GOLD); put(g, 9, 10, GOLD);
    shade(g, c);
  },
  ledger(g) {
    rect(g, 3, 3, 10, 10, WOOD);
    rect(g, 3, 3, 2, 10, darken(WOOD, 0.3));
    rect(g, 12, 4, 1, 8, CREAM);
    disc(g, 8.5, 8, 1.7, GOLD);
    shade(g, WOOD);
  },
  scroll(g) {
    rect(g, 2, 3, 12, 2, '#d9c089');
    rect(g, 3, 5, 10, 7, '#f0e2c0');
    rect(g, 2, 12, 12, 2, '#d9c089');
    for (let x = 5; x <= 10; x += 2) { put(g, x, 7, '#8a7a5a'); put(g, x, 9, '#8a7a5a'); }
    shade(g, '#f0e2c0'); shade(g, '#d9c089');
  },
  bag(g) {
    rect(g, 4, 6, 8, 7, '#a9814f');
    rect(g, 4, 5, 8, 3, '#8a6a3c');
    line(g, 5, 5, 8, 2, 1, '#8a6a3c'); line(g, 11, 5, 8, 2, 1, '#8a6a3c');
    put(g, 8, 7, GOLD);
    shade(g, '#a9814f');
  },
  lock(g) {
    rect(g, 4, 7, 8, 7, GOLD);
    line(g, 5, 7, 5, 4, 1, IRON); line(g, 5, 4, 10, 4, 1, IRON); line(g, 10, 4, 10, 7, 1, IRON);
    put(g, 8, 10, DARK); put(g, 8, 11, DARK);
    shade(g, GOLD);
  },
  unlock(g) {
    rect(g, 4, 7, 8, 7, GOLD);
    line(g, 10, 7, 10, 3, 1, IRON); line(g, 10, 3, 14, 3, 1, IRON); put(g, 14, 4, IRON);
    put(g, 8, 10, DARK); put(g, 8, 11, DARK);
    shade(g, GOLD);
  },
  map(g) {
    rect(g, 2, 4, 12, 9, '#efe0bd');
    rect(g, 6, 4, 1, 9, '#d9c089'); rect(g, 10, 4, 1, 9, '#d9c089');
    put(g, 4, 7, RED); put(g, 5, 8, RED); put(g, 4, 9, RED); put(g, 5, 6, RED); put(g, 3, 6, RED); put(g, 3, 9, RED); // X marks
    put(g, 8, 6, '#8a7a5a'); put(g, 9, 8, '#8a7a5a'); put(g, 12, 10, '#8a7a5a');
    shade(g, '#efe0bd');
  },
  eye(g) {
    taper(g, 8, 5, 8, 1.2, 5.6, '#fdfdfd'); taper(g, 8, 9, 11, 5.4, 1.2, '#fdfdfd');
    disc(g, 8, 8, 2.2, BLUE);
    put(g, 8, 8, DARK); put(g, 8, 7, DARK);
    put(g, 7, 6, lighten(BLUE, 0.6));
    shade(g, '#fdfdfd');
  },
  bang(g) {
    rect(g, 6, 2, 4, 8, RED);
    rect(g, 6, 12, 4, 3, RED);
    shade(g, RED);
    put(g, 7, 3, lighten(RED, 0.5));
  },
  bubble(g) {
    rect(g, 3, 3, 11, 8, '#fdfdfd');
    put(g, 3, 3, null); put(g, 13, 3, null); put(g, 3, 10, null); put(g, 13, 10, null);
    tri(g, 6, 13, 10, 1.6, '#fdfdfd'); rect(g, 5, 11, 3, 1, '#fdfdfd');
    put(g, 6, 7, DARK); put(g, 8, 7, DARK); put(g, 10, 7, DARK);
    shade(g, '#fdfdfd');
  },
  target(g) {
    disc(g, 8, 8, 5.6, RED);
    disc(g, 8, 8, 3.8, '#fdfdfd');
    disc(g, 8, 8, 1.9, RED);
    shade(g, RED);
  },
  pin(g) {
    disc(g, 8, 6, 3.4, RED);
    taper(g, 8, 9, 13, 1.8, 0.2, RED);
    shade(g, RED);
    put(g, 7, 5, lighten(RED, 0.6));
  },
  gift(g) {
    rect(g, 3, 7, 10, 6, RED);
    rect(g, 2, 5, 12, 2, darken(RED, 0.2));
    rect(g, 7, 5, 2, 8, GOLD);
    put(g, 6, 4, GOLD); put(g, 9, 4, GOLD); put(g, 7, 3, GOLD); put(g, 8, 3, GOLD);
    shade(g, RED);
  },
  cardpack(g) {
    rect(g, 3, 3, 8, 11, '#d9d0b8');
    rect(g, 5, 2, 8, 11, '#f6f0e0');
    disc(g, 9, 7, 1.7, PURPLE);
    put(g, 6, 3, darken('#f6f0e0', 0.3)); put(g, 11, 11, darken('#f6f0e0', 0.3));
    shade(g, '#f6f0e0');
  },
  door(g) {
    rect(g, 3, 2, 10, 12, WOOD);
    rect(g, 4, 3, 8, 11, '#a9743c');
    rect(g, 7, 3, 1, 11, darken('#a9743c', 0.2)); rect(g, 10, 3, 1, 11, darken('#a9743c', 0.2));
    put(g, 3, 2, null); put(g, 12, 2, null);
    put(g, 11, 8, GOLD); put(g, 11, 9, GOLD);
    shade(g, '#a9743c');
  },
  stairs(g) {
    rect(g, 2, 12, 12, 2, '#b0a08a');
    rect(g, 5, 9, 9, 2, '#b0a08a');
    rect(g, 8, 6, 6, 2, '#b0a08a');
    rect(g, 11, 3, 3, 2, '#b0a08a');
    shade(g, '#b0a08a');
  },
  anvil(g) {
    rect(g, 3, 5, 11, 3, IRON);
    rect(g, 1, 5, 2, 2, IRON);
    rect(g, 6, 8, 4, 3, darken(IRON, 0.2));
    rect(g, 4, 11, 8, 2, IRON);
    shade(g, IRON);
    sparkle(g, 12, 3);
  },
  pause(g) {
    rect(g, 4, 3, 3, 10, CREAM);
    rect(g, 9, 3, 3, 10, CREAM);
    shade(g, CREAM);
  },
  sound(g) {
    rect(g, 2, 6, 3, 4, CREAM);
    for (let x = 5; x <= 8; x++) { const h = (x - 4); rect(g, x, 8 - h - 1, 1, (h + 1) * 2 + 1, CREAM); }
    put(g, 11, 6, CREAM); put(g, 12, 7, CREAM); put(g, 12, 8, CREAM); put(g, 12, 9, CREAM); put(g, 11, 10, CREAM);
    put(g, 13, 5, CREAM); put(g, 14, 6, CREAM); put(g, 14, 7, CREAM); put(g, 14, 8, CREAM); put(g, 14, 9, CREAM); put(g, 14, 10, CREAM); put(g, 13, 11, CREAM);
    shade(g, CREAM);
  },
  mute(g) {
    rect(g, 2, 6, 3, 4, CREAM);
    for (let x = 5; x <= 8; x++) { const h = (x - 4); rect(g, x, 8 - h - 1, 1, (h + 1) * 2 + 1, CREAM); }
    line(g, 10, 5, 14, 11, 1, RED); line(g, 14, 5, 10, 11, 1, RED);
    shade(g, CREAM);
  },
  cog(g) {
    disc(g, 8, 8, 4.4, IRON);
    rect(g, 7, 1, 2, 2, IRON); rect(g, 7, 13, 2, 2, IRON);
    rect(g, 1, 7, 2, 2, IRON); rect(g, 13, 7, 2, 2, IRON);
    put(g, 3, 3, IRON); put(g, 4, 4, IRON); put(g, 12, 3, IRON); put(g, 11, 4, IRON);
    put(g, 3, 12, IRON); put(g, 4, 11, IRON); put(g, 12, 12, IRON); put(g, 11, 11, IRON);
    disc(g, 8, 8, 1.6, null);
    shade(g, IRON);
  },
  hand(g) {
    rect(g, 5, 7, 7, 6, SKIN);
    rect(g, 5, 3, 1, 4, SKIN); rect(g, 7, 2, 1, 5, SKIN); rect(g, 9, 3, 1, 4, SKIN); rect(g, 11, 4, 1, 3, SKIN);
    rect(g, 3, 8, 2, 2, SKIN);
    rect(g, 6, 13, 5, 2, mix(SKIN, '#000000', 0.12));
    shade(g, SKIN);
  },
  bed(g) {
    rect(g, 2, 8, 12, 4, WOOD);
    rect(g, 2, 7, 12, 2, '#e6dff0');
    rect(g, 3, 5, 4, 3, '#fdfdfd');
    rect(g, 8, 6, 6, 3, '#b06fa0');
    rect(g, 2, 12, 1, 2, darken(WOOD, 0.2)); rect(g, 13, 12, 1, 2, darken(WOOD, 0.2));
    shade(g, '#e6dff0'); shade(g, WOOD);
  },
  chair(g) {
    rect(g, 4, 2, 2, 9, WOOD);
    rect(g, 4, 9, 8, 2, WOOD);
    rect(g, 4, 11, 1, 4, darken(WOOD, 0.15)); rect(g, 11, 11, 1, 4, darken(WOOD, 0.15));
    shade(g, WOOD);
  },
  tableicon(g) {
    rect(g, 2, 6, 12, 2, WOOD);
    rect(g, 3, 8, 2, 6, darken(WOOD, 0.15)); rect(g, 11, 8, 2, 6, darken(WOOD, 0.15));
    shade(g, WOOD);
  },
  lamp(g) {
    disc(g, 8, 8, 4.2, '#ff9a5a');
    rect(g, 4, 8, 9, 1, darken('#ff9a5a', 0.2));
    rect(g, 6, 2, 4, 2, DARK);
    rect(g, 6, 13, 4, 1, DARK);
    shade(g, '#ff9a5a');
    sparkle(g, 7, 6);
  },
  plant(g) {
    taper(g, 8, 10, 13, 3.2, 2.2, '#b0552f');
    line(g, 8, 9, 5, 4, 1, '#4fa050'); line(g, 8, 9, 11, 4, 1, '#4fa050'); line(g, 8, 9, 8, 3, 1, '#4fa050');
    disc(g, 5, 4, 1.2, GREEN); disc(g, 11, 4, 1.2, GREEN); disc(g, 8, 2.6, 1.2, GREEN);
    shade(g, '#b0552f'); shade(g, GREEN);
  },
  trophy(g) {
    rect(g, 5, 2, 6, 5, GOLD);
    put(g, 4, 3, GOLD); put(g, 3, 4, GOLD); put(g, 12, 3, GOLD); put(g, 13, 4, GOLD);
    taper(g, 8, 7, 9, 2.4, 0.8, GOLD);
    rect(g, 7, 9, 2, 2, GOLD);
    rect(g, 5, 11, 6, 2, GOLD);
    shade(g, GOLD);
    sparkle(g, 6, 3);
  },
  toolbox(g) {
    rect(g, 3, 7, 10, 6, '#c23a3a');
    rect(g, 3, 9, 10, 1, darken('#c23a3a', 0.25));
    rect(g, 6, 5, 4, 2, '#c23a3a'); rect(g, 7, 6, 2, 1, null);
    put(g, 8, 10, GOLD);
    shade(g, '#c23a3a');
  },
  cauldron(g) {
    rect(g, 3, 5, 10, 1, '#4a4356');
    disc(g, 8, 9, 4.6, DARK); rect(g, 4, 5, 8, 2, DARK);
    rect(g, 5, 6, 6, 1, '#7fe08a');
    put(g, 6, 4, '#7fe08a'); put(g, 10, 3, '#7fe08a'); put(g, 8, 4, lighten('#7fe08a', 0.4));
    put(g, 5, 14, DARK); put(g, 11, 14, DARK);
    shade(g, DARK);
  },
  swords(g) {
    line(g, 4, 12, 11, 3, 1, '#cfd6dd'); line(g, 12, 12, 5, 3, 1, '#cfd6dd');
    put(g, 11, 2, '#e8ecf4'); put(g, 5, 2, '#e8ecf4');
    rect(g, 3, 11, 2, 1, GOLD); rect(g, 11, 11, 2, 1, GOLD);
    put(g, 3, 13, WOOD); put(g, 13, 13, WOOD);
    shade(g, '#cfd6dd');
  },
  dagger(g) {
    taper(g, 8, 1, 9, 0.4, 1.6, '#cfd6dd');
    rect(g, 5, 9, 7, 1, GOLD);
    rect(g, 7, 10, 2, 4, WOOD);
    put(g, 8, 14, GOLD);
    shade(g, '#cfd6dd');
    put(g, 7, 3, lighten('#cfd6dd', 0.5));
  },
  campfire(g) {
    tri(g, 8, 2, 10, 3.4, '#ff7a2a');
    tri(g, 8, 5, 10, 1.8, '#ffd23a');
    put(g, 8, 9, '#fff6e0');
    line(g, 3, 13, 12, 11, 2, WOOD); line(g, 3, 11, 12, 13, 2, WOOD);
    shade(g, '#ff7a2a'); shade(g, WOOD);
  },
  dice(g) {
    rect(g, 3, 3, 10, 10, '#f6f0e0');
    put(g, 3, 3, null); put(g, 12, 3, null); put(g, 3, 12, null); put(g, 12, 12, null);
    put(g, 5, 5, DARK); put(g, 10, 5, DARK); put(g, 7, 8, DARK); put(g, 8, 8, DARK); put(g, 5, 10, DARK); put(g, 10, 10, DARK);
    shade(g, '#f6f0e0');
  },
  crown(g) {
    rect(g, 3, 9, 10, 4, GOLD);
    tri(g, 4, 4, 9, 1.5, GOLD); tri(g, 8, 3, 9, 1.7, GOLD); tri(g, 12, 4, 9, 1.5, GOLD);
    put(g, 5, 10, RED); put(g, 8, 11, BLUE); put(g, 11, 10, GREEN);
    shade(g, GOLD);
    sparkle(g, 13, 2);
  },
  question(g, tier, col) {
    const c = col === RARITY_HEX.common ? PURPLE : col;
    rect(g, 5, 2, 6, 2, c); rect(g, 4, 3, 2, 2, c);
    rect(g, 10, 3, 2, 3, c);
    rect(g, 8, 6, 3, 2, c); rect(g, 7, 8, 2, 2, c);
    rect(g, 7, 12, 2, 2, c);
    shade(g, c);
  },
  boot(g) {
    rect(g, 5, 2, 4, 7, '#8a5a2e');
    rect(g, 5, 9, 7, 4, '#8a5a2e');
    rect(g, 4, 12, 9, 2, darken('#8a5a2e', 0.3));
    rect(g, 5, 4, 4, 1, GOLD);
    shade(g, '#8a5a2e');
  },
  magnet(g) {
    rect(g, 4, 3, 3, 8, RED); rect(g, 9, 3, 3, 8, RED);
    rect(g, 4, 10, 8, 3, RED); rect(g, 7, 10, 2, 1, null);
    rect(g, 4, 3, 3, 2, '#e8e8f0'); rect(g, 9, 3, 3, 2, '#e8e8f0');
    shade(g, RED);
    sparkle(g, 13, 2);
  },
  coffee(g) {
    rect(g, 4, 6, 7, 6, '#f6f0e0');
    rect(g, 5, 6, 5, 1, '#6a4326');
    put(g, 12, 7, '#f6f0e0'); put(g, 13, 8, '#f6f0e0'); put(g, 12, 9, '#f6f0e0');
    put(g, 6, 4, '#cfd6dd'); put(g, 6, 3, '#cfd6dd'); put(g, 9, 4, '#cfd6dd'); put(g, 9, 2, '#cfd6dd');
    rect(g, 3, 12, 9, 1, '#d9d0b8');
    shade(g, '#f6f0e0');
  },
  cactus(g) {
    rect(g, 7, 3, 3, 9, '#4fa050');
    rect(g, 3, 5, 2, 3, '#4fa050'); rect(g, 4, 7, 3, 1, '#4fa050');
    rect(g, 12, 4, 2, 3, '#4fa050'); rect(g, 10, 6, 3, 1, '#4fa050');
    taper(g, 8, 12, 14, 3, 2.4, '#b0552f');
    shade(g, '#4fa050');
    put(g, 6, 5, SPARK); put(g, 9, 8, SPARK);
  },
  blood(g) {
    taper(g, 8, 2, 9, 0.3, 3.2, '#e04a5a');
    disc(g, 8, 10, 3.4, '#e04a5a');
    shade(g, '#e04a5a');
    put(g, 6, 9, lighten('#e04a5a', 0.55));
  },
  shield(g, tier, col) {
    const c = col === RARITY_HEX.common ? IRON : col;
    rect(g, 4, 2, 8, 7, c);
    taper(g, 8, 9, 13, 3.8, 0.6, c);
    rect(g, 7, 5, 2, 2, GOLD);
    rect(g, 8, 2, 1, 11, darken(c, 0.18));
    shade(g, c);
  },
  bolt(g) {
    line(g, 9, 1, 6, 6, 2, '#ffd23a');
    rect(g, 5, 6, 6, 2, '#ffd23a');
    line(g, 9, 8, 6, 14, 2, '#ffd23a');
    put(g, 6, 14, '#ffd23a');
    shade(g, '#ffd23a');
  },
  snowflake(g) {
    line(g, 8, 2, 8, 14, 1, '#bfe8ff');
    line(g, 3, 4, 13, 12, 1, '#bfe8ff');
    line(g, 13, 4, 3, 12, 1, '#bfe8ff');
    put(g, 7, 3, '#bfe8ff'); put(g, 9, 3, '#bfe8ff'); put(g, 7, 13, '#bfe8ff'); put(g, 9, 13, '#bfe8ff');
    disc(g, 8, 8, 1.2, '#eaf6ff');
  },
  tornado(g) {
    rect(g, 3, 2, 10, 2, '#cfe2ec');
    rect(g, 5, 5, 7, 2, '#cfe2ec');
    rect(g, 4, 8, 6, 2, '#cfe2ec');
    rect(g, 7, 11, 4, 2, '#cfe2ec');
    rect(g, 6, 14, 2, 1, '#cfe2ec');
    shade(g, '#cfe2ec');
  },
  fire(g) {
    taper(g, 8, 2, 7, 0.4, 3.6, '#ff7a2a');
    disc(g, 8, 10, 4.4, '#ff7a2a');
    taper(g, 8, 6, 9, 0.3, 2, '#ffd23a');
    disc(g, 8, 11, 2.4, '#ffd23a');
    put(g, 8, 12, '#fff6e0'); put(g, 7, 11, '#fff6e0');
    shade(g, '#ff7a2a');
  },
  drop(g) {
    taper(g, 8, 2, 9, 0.3, 3.2, BLUE);
    disc(g, 8, 10, 3.4, BLUE);
    shade(g, BLUE);
    put(g, 6, 9, lighten(BLUE, 0.55));
  },
  wind(g) {
    line(g, 2, 4, 11, 4, 1, '#cfeaff');
    put(g, 12, 5, '#cfeaff'); put(g, 12, 6, '#cfeaff'); put(g, 11, 7, '#cfeaff');
    line(g, 2, 8, 9, 8, 1, '#dff2ff');
    line(g, 2, 12, 12, 12, 1, '#cfeaff');
    put(g, 13, 11, '#cfeaff'); put(g, 13, 10, '#cfeaff');
  },
  rock(g) {
    disc(g, 8, 9, 4.8, '#9a8f7a');
    rect(g, 5, 5, 6, 2, '#9a8f7a');
    line(g, 6, 7, 9, 11, 1, darken('#9a8f7a', 0.2));
    put(g, 5, 6, GREEN); put(g, 6, 5, GREEN);
    shade(g, '#9a8f7a');
  },
  fang(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#f6f0e0' : col;
    taper(g, 8, 3, 13, 3.4, 0.3, c);
    rect(g, 5, 2, 7, 2, darken(c, 0.15));
    shade(g, c);
    put(g, 7, 5, lighten(c, 0.4));
  },
  anchor(g) {
    disc(g, 8, 3, 1.8, IRON); disc(g, 8, 3, 0.7, null);
    rect(g, 7, 5, 2, 7, IRON);
    rect(g, 5, 6, 6, 1, IRON);
    put(g, 4, 10, IRON); put(g, 3, 9, IRON); put(g, 4, 11, IRON); put(g, 5, 12, IRON); put(g, 6, 12, IRON);
    put(g, 12, 10, IRON); put(g, 13, 9, IRON); put(g, 12, 11, IRON); put(g, 11, 12, IRON); put(g, 10, 12, IRON);
    put(g, 8, 12, IRON); put(g, 8, 13, IRON);
    shade(g, IRON);
  },
  clover(g) {
    disc(g, 5.6, 6, 2.2, GREEN); disc(g, 10.4, 6, 2.2, GREEN); disc(g, 8, 9.6, 2.2, GREEN);
    line(g, 8, 11, 9, 14, 1, '#3f8f3f');
    shade(g, GREEN);
    sparkle(g, 12, 3);
  },
  storm(g) {
    disc(g, 6, 5.4, 2.6, '#cfd6e4'); disc(g, 10, 5.2, 2.8, '#cfd6e4');
    rect(g, 3, 5, 10, 3, '#cfd6e4');
    put(g, 9, 9, '#ffd23a'); put(g, 8, 10, '#ffd23a'); put(g, 8, 11, '#ffd23a'); put(g, 7, 12, '#ffd23a'); put(g, 7, 13, '#ffd23a');
    shade(g, '#cfd6e4');
  },
  feather(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#e8ecf4' : col;
    line(g, 4, 13, 11, 4, 2, c);
    line(g, 4, 13, 11, 4, 1, darken(c, 0.18));
    put(g, 12, 3, c); put(g, 3, 14, darken(c, 0.3));
    shade(g, c);
  },
  goblet(g) {
    rect(g, 4, 3, 8, 4, GOLD);
    rect(g, 5, 3, 6, 1, '#8a1f3a');
    taper(g, 8, 7, 9, 3, 0.8, GOLD);
    rect(g, 7, 9, 2, 3, GOLD);
    rect(g, 5, 12, 6, 1, GOLD);
    shade(g, GOLD);
  },
  bee(g) {
    disc(g, 8, 9, 3.2, '#ffd23a');
    rect(g, 6, 6, 1, 6, DARK); rect(g, 9, 6, 1, 6, DARK);
    disc(g, 5.4, 4.6, 1.7, '#eef4ff'); disc(g, 10.6, 4.6, 1.7, '#eef4ff');
    put(g, 12, 9, DARK); put(g, 13, 9, DARK);
    put(g, 5, 8, DARK);
    shade(g, '#ffd23a');
  },
  tree(g) {
    tri(g, 8, 1, 5, 3, '#3f8f3f');
    tri(g, 8, 4, 8, 4.4, '#4fa050');
    tri(g, 8, 7, 11, 5.6, '#3f8f3f');
    rect(g, 7, 12, 2, 3, WOOD);
    shade(g, '#4fa050'); shade(g, '#3f8f3f');
  },
  bat(g) {
    disc(g, 8, 8, 2.2, '#6a5a8c');
    put(g, 6, 5, '#6a5a8c'); put(g, 10, 5, '#6a5a8c');
    taper(g, 3.6, 6, 10, 0.4, 2.6, '#584a78'); taper(g, 12.4, 6, 10, 0.4, 2.6, '#584a78');
    put(g, 4, 6, '#584a78'); put(g, 12, 6, '#584a78');
    put(g, 7, 8, '#ffe08a'); put(g, 9, 8, '#ffe08a');
    shade(g, '#6a5a8c'); shade(g, '#584a78');
  },
  tomb(g) {
    rect(g, 4, 4, 8, 10, '#b8b2c4');
    rect(g, 5, 3, 6, 1, '#b8b2c4');
    rect(g, 7, 6, 2, 4, darken('#b8b2c4', 0.25)); rect(g, 6, 7, 4, 1, darken('#b8b2c4', 0.25));
    put(g, 3, 13, GREEN); put(g, 12, 13, GREEN); put(g, 13, 12, GREEN);
    shade(g, '#b8b2c4');
  },
  croc(g) {
    rect(g, 2, 7, 9, 4, '#5a9a4a');
    rect(g, 9, 5, 5, 6, '#5a9a4a');
    rect(g, 10, 3, 2, 2, '#5a9a4a');
    put(g, 11, 4, DARK);
    put(g, 3, 10, '#f6f0e0'); put(g, 5, 10, '#f6f0e0'); put(g, 7, 10, '#f6f0e0');
    put(g, 3, 8, DARK);
    shade(g, '#5a9a4a');
  },
  robot(g) {
    rect(g, 4, 4, 8, 8, '#9fb0bc');
    rect(g, 6, 7, 2, 2, '#4fd0e8'); rect(g, 9, 7, 2, 2, '#4fd0e8');
    rect(g, 6, 10, 5, 1, DARK); put(g, 7, 10, '#9fb0bc'); put(g, 9, 10, '#9fb0bc');
    rect(g, 7, 2, 2, 2, '#9fb0bc'); put(g, 8, 1, RED);
    put(g, 3, 7, IRON); put(g, 12, 7, IRON);
    shade(g, '#9fb0bc');
  },
  voidspiral(g) {
    disc(g, 8, 8, 5.6, '#2a1060');
    const arm = '#7a4ad0';
    put(g, 8, 4, arm); put(g, 10, 5, arm); put(g, 11, 7, arm); put(g, 10, 9, arm); put(g, 8, 10, arm); put(g, 6, 9, arm); put(g, 5, 7, arm); put(g, 6, 6, arm); put(g, 8, 7, arm);
    put(g, 4, 4, SPARK); put(g, 12, 11, SPARK); put(g, 11, 3, SPARK);
  },
  wisp(g) {
    disc(g, 8, 8, 3, '#dff4ff');
    put(g, 8, 3, '#7fd0ff'); put(g, 12, 5, '#7fd0ff'); put(g, 13, 9, '#7fd0ff'); put(g, 11, 12, '#7fd0ff'); put(g, 5, 13, '#7fd0ff'); put(g, 3, 9, '#7fd0ff'); put(g, 4, 5, '#7fd0ff');
    put(g, 2, 3, '#bfeaff'); put(g, 14, 4, '#bfeaff'); put(g, 13, 13, '#bfeaff');
    shade(g, '#dff4ff');
    put(g, 7, 7, SPARK);
  },
  wizard(g) {
    tri(g, 8, 0, 6, 4.4, '#6f5fc4');
    rect(g, 3, 6, 10, 2, '#6f5fc4');
    rect(g, 5, 5, 6, 1, GOLD);
    rect(g, 5, 8, 6, 3, '#f2e0c9');
    put(g, 6, 9, DARK); put(g, 9, 9, DARK);
    put(g, 8, 10, '#e06a55');
    rect(g, 5, 11, 6, 3, '#f7f4ec'); rect(g, 6, 14, 4, 1, '#f7f4ec');
    shade(g, '#6f5fc4'); shade(g, '#f7f4ec');
  },
  goblinface(g) {
    disc(g, 8, 9, 4.2, '#6fb04a');
    rect(g, 1, 7, 3, 2, '#6fb04a'); rect(g, 12, 7, 3, 2, '#6fb04a');
    put(g, 1, 6, '#6fb04a'); put(g, 14, 6, '#6fb04a');
    put(g, 6, 8, '#ffe08a'); put(g, 10, 8, '#ffe08a');
    rect(g, 6, 11, 5, 1, DARK); put(g, 7, 12, '#fdfdfd');
    put(g, 8, 9, darken('#6fb04a', 0.25));
    shade(g, '#6fb04a');
  },
  bomb(g) {
    disc(g, 8, 9, 4.4, DARK);
    rect(g, 7, 3, 3, 2, IRON);
    line(g, 9, 2, 12, 1, 1, WOOD);
    sparkle(g, 13, 1); put(g, 14, 0, '#ffd23a');
    shade(g, DARK);
    put(g, 6, 7, '#5a5470');
  },
  basket(g) {
    taper(g, 8, 7, 13, 5.4, 3.6, '#b0803c');
    for (let x = 4; x <= 12; x += 2) put(g, x, 9, darken('#b0803c', 0.2));
    for (let x = 5; x <= 11; x += 2) put(g, x, 11, darken('#b0803c', 0.2));
    put(g, 3, 6, '#8a6a3c'); put(g, 4, 4, '#8a6a3c'); put(g, 6, 3, '#8a6a3c'); put(g, 8, 2, '#8a6a3c'); put(g, 10, 3, '#8a6a3c'); put(g, 12, 4, '#8a6a3c'); put(g, 13, 6, '#8a6a3c');
    shade(g, '#b0803c');
  },
  balloon(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff6a8a' : col;
    disc(g, 8, 6, 4, c);
    put(g, 8, 10, darken(c, 0.25)); put(g, 8, 11, darken(c, 0.25));
    line(g, 8, 12, 7, 15, 1, '#d9d0b8');
    shade(g, c);
    put(g, 6, 4, lighten(c, 0.55));
  },
  star(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ffd23a' : col;
    taper(g, 8, 2, 8, 0.3, 2.4, c);
    taper(g, 8, 8, 14, 2.4, 0.3, c);
    taper(g, 8, 7, 9, 6.4, 6.4, c);
    for (let x = 2; x <= 14; x++) { const d = Math.abs(x - 8); if (d > 2.4) { put(g, x, 7, d < 5.5 ? c : null); put(g, x, 9, d < 5.5 ? c : null); } }
    put(g, 8, 8, SPARK);
    shade(g, c);
  },
  flower(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ffd23a' : col;
    disc(g, 8, 4.6, 1.9, c); disc(g, 4.6, 8, 1.9, c); disc(g, 11.4, 8, 1.9, c); disc(g, 8, 11.4, 1.9, c);
    disc(g, 5.6, 5.6, 1.6, c); disc(g, 10.4, 5.6, 1.6, c); disc(g, 5.6, 10.4, 1.6, c); disc(g, 10.4, 10.4, 1.6, c);
    disc(g, 8, 8, 1.8, '#b0552f');
    shade(g, c);
  },
  fist(g) {
    rect(g, 4, 6, 8, 6, SKIN);
    for (let x = 5; x <= 11; x += 2) put(g, x, 7, darken(SKIN, 0.18));
    rect(g, 3, 8, 2, 3, SKIN);
    rect(g, 6, 12, 5, 2, mix(SKIN, '#000000', 0.12));
    put(g, 13, 5, '#ffd23a'); put(g, 14, 7, '#ffd23a'); put(g, 13, 9, '#ffd23a');
    shade(g, SKIN);
  },
  rage(g) {
    disc(g, 8, 8, 4.6, '#ff6a5a');
    line(g, 5, 5, 7, 7, 1, DARK); line(g, 11, 5, 9, 7, 1, DARK);
    put(g, 6, 8, DARK); put(g, 10, 8, DARK);
    rect(g, 6, 11, 5, 1, DARK); put(g, 7, 11, '#fdfdfd'); put(g, 9, 11, '#fdfdfd');
    shade(g, '#ff6a5a');
  },
  spikeball(g) {
    disc(g, 8, 8, 3.6, '#8a7a66');
    put(g, 8, 3, '#8a7a66'); put(g, 8, 2, '#6a5c4c'); put(g, 8, 13, '#8a7a66'); put(g, 8, 14, '#6a5c4c');
    put(g, 3, 8, '#8a7a66'); put(g, 2, 8, '#6a5c4c'); put(g, 13, 8, '#8a7a66'); put(g, 14, 8, '#6a5c4c');
    put(g, 4, 4, '#6a5c4c'); put(g, 12, 4, '#6a5c4c'); put(g, 4, 12, '#6a5c4c'); put(g, 12, 12, '#6a5c4c');
    shade(g, '#8a7a66');
  },
  face(g) {
    disc(g, 8, 8.6, 4.4, SKIN);
    rect(g, 4, 4, 8, 2, '#6b4423'); put(g, 4, 6, '#6b4423'); put(g, 11, 6, '#6b4423');
    put(g, 6, 8, DARK); put(g, 10, 8, DARK);
    put(g, 6, 11, '#a05a4a'); put(g, 7, 12, '#a05a4a'); put(g, 8, 12, '#a05a4a'); put(g, 9, 12, '#a05a4a'); put(g, 10, 11, '#a05a4a');
    shade(g, SKIN);
  },
  happy(g) {
    disc(g, 8, 8, 4.6, '#ffd23a');
    put(g, 6, 7, DARK); put(g, 10, 7, DARK);
    put(g, 5, 10, DARK); put(g, 6, 11, DARK); put(g, 7, 12, DARK); put(g, 8, 12, DARK); put(g, 9, 12, DARK); put(g, 10, 11, DARK); put(g, 11, 10, DARK);
    shade(g, '#ffd23a');
  },
  candle(g) {
    rect(g, 6, 6, 4, 7, '#f6f0e0');
    put(g, 6, 7, '#fdfdfd'); put(g, 9, 9, '#fdfdfd');
    put(g, 8, 5, DARK);
    tri(g, 8, 1, 4, 1.4, '#ff9a3a'); put(g, 8, 3, '#ffd23a');
    rect(g, 4, 13, 8, 2, GOLD);
    shade(g, '#f6f0e0');
  },
  broom(g) {
    line(g, 3, 2, 9, 9, 1, WOOD);
    rect(g, 9, 9, 2, 1, GOLD);
    taper(g, 11, 10, 14, 1.4, 3.2, '#d8b96a');
    shade(g, '#d8b96a');
  },
  frame(g) {
    rect(g, 3, 3, 10, 10, GOLD);
    rect(g, 5, 5, 6, 6, BLUE);
    rect(g, 5, 9, 6, 2, GREEN);
    put(g, 6, 6, '#ffd23a');
    shade(g, GOLD);
  },
  wrench(g) {
    line(g, 5, 11, 10, 6, 2, IRON);
    disc(g, 11, 5, 2.6, IRON); rect(g, 11, 2, 3, 3, null);
    disc(g, 4, 12, 1.6, IRON);
    shade(g, IRON);
  },
  owl(g) {
    disc(g, 8, 9, 4.2, '#b0803c');
    put(g, 4, 4, '#b0803c'); put(g, 5, 5, '#b0803c'); put(g, 12, 4, '#b0803c'); put(g, 11, 5, '#b0803c');
    disc(g, 6, 7.6, 1.8, '#f6f0e0'); disc(g, 10, 7.6, 1.8, '#f6f0e0');
    put(g, 6, 8, DARK); put(g, 10, 8, DARK);
    put(g, 8, 9, '#ffd23a'); put(g, 8, 10, '#e8a33a');
    put(g, 6, 13, '#ffd23a'); put(g, 10, 13, '#ffd23a');
    shade(g, '#b0803c');
  },
  note(g) {
    disc(g, 5.6, 11.6, 2, CREAM);
    rect(g, 7, 3, 1, 8, CREAM);
    rect(g, 8, 3, 3, 2, CREAM); rect(g, 9, 5, 2, 1, CREAM);
    shade(g, CREAM);
  },
  cat(g) {
    disc(g, 8, 9, 4.2, '#b89a6a');
    tri(g, 5, 3, 6, 1.6, '#b89a6a'); tri(g, 11, 3, 6, 1.6, '#b89a6a');
    put(g, 6, 8, '#4fa050'); put(g, 10, 8, '#4fa050');
    put(g, 8, 10, '#e08aa0');
    line(g, 2, 9, 4, 9, 1, '#fdfdfd'); line(g, 12, 9, 14, 9, 1, '#fdfdfd');
    shade(g, '#b89a6a');
  },
  dragon(g) {
    rect(g, 3, 7, 8, 4, '#4a9a5a');
    rect(g, 9, 5, 5, 6, '#4a9a5a');
    put(g, 11, 3, '#e8d8a0'); put(g, 12, 2, '#e8d8a0');
    put(g, 11, 6, RED);
    put(g, 2, 8, '#ff7a2a'); put(g, 1, 8, '#ffd23a'); put(g, 2, 9, '#ff7a2a');
    put(g, 4, 10, '#f6f0e0'); put(g, 6, 10, '#f6f0e0');
    shade(g, '#4a9a5a');
  },
  ghost(g) {
    disc(g, 8, 7, 4.2, '#eaf2ff');
    rect(g, 4, 8, 9, 5, '#eaf2ff');
    put(g, 5, 13, null); put(g, 8, 13, null); put(g, 11, 13, null);
    put(g, 6, 6, DARK); put(g, 10, 6, DARK);
    put(g, 8, 9, DARK);
    shade(g, '#eaf2ff');
  },
  urn(g) {
    rect(g, 6, 2, 4, 2, '#c9803a');
    taper(g, 8, 4, 8, 2, 4.2, '#c9803a');
    taper(g, 8, 9, 12, 4.2, 2, '#c9803a');
    rect(g, 6, 13, 4, 1, '#c9803a');
    put(g, 3, 5, '#c9803a'); put(g, 12, 5, '#c9803a');
    for (let x = 5; x <= 11; x += 2) put(g, x, 7, darken('#c9803a', 0.25));
    shade(g, '#c9803a');
  },
  scales(g) {
    rect(g, 7, 3, 2, 9, WOOD);
    rect(g, 3, 3, 10, 1, GOLD);
    put(g, 3, 4, GOLD); put(g, 3, 5, GOLD); put(g, 13, 4, GOLD); put(g, 13, 5, GOLD);
    rect(g, 1, 6, 5, 1, GOLD); rect(g, 10, 6, 5, 1, GOLD);
    rect(g, 5, 12, 6, 2, WOOD);
    shade(g, GOLD); shade(g, WOOD);
  },
  alembic(g) {
    rect(g, 7, 1, 2, 5, '#cfe2ec');
    disc(g, 8, 10, 4.2, '#cfe2ec');
    disc(g, 8, 11, 3, PURPLE);
    put(g, 6, 8, '#fdfdfd');
    put(g, 10, 4, PURPLE); put(g, 12, 3, lighten(PURPLE, 0.4));
    shade(g, '#cfe2ec');
  },
  quill(g) {
    line(g, 5, 12, 11, 4, 2, '#e8ecf4');
    line(g, 5, 12, 11, 4, 1, '#cfd6e4');
    put(g, 4, 13, '#2a2230'); put(g, 3, 14, '#2a2230');
    put(g, 12, 3, '#e8ecf4');
    shade(g, '#e8ecf4');
  },
  rug(g) {
    rect(g, 2, 4, 12, 8, '#a04a4a');
    rect(g, 2, 4, 12, 1, GOLD); rect(g, 2, 11, 12, 1, GOLD);
    rect(g, 2, 5, 1, 6, GOLD); rect(g, 13, 5, 1, 6, GOLD);
    disc(g, 8, 8, 1.4, GOLD);
    for (let x = 3; x <= 13; x += 2) { put(g, x, 3, '#a04a4a'); put(g, x, 12, '#a04a4a'); }
    shade(g, '#a04a4a');
  },
  pad(g, tier, col) {
    rect(g, 3, 3, 10, 10, col);
    put(g, 3, 3, null); put(g, 12, 3, null); put(g, 3, 12, null); put(g, 12, 12, null);
    disc(g, 8, 8, 2, lighten(col, 0.35));
    shade(g, col);
  },
  check(g) {
    rect(g, 3, 3, 10, 10, '#3f8f3f');
    put(g, 3, 3, null); put(g, 12, 3, null); put(g, 3, 12, null); put(g, 12, 12, null);
    line(g, 5, 8, 7, 10, 1, '#fdfdfd'); line(g, 7, 10, 11, 5, 1, '#fdfdfd');
    shade(g, '#3f8f3f');
  },
  boom(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ffd23a' : col;
    disc(g, 8, 8, 2.6, c);
    const c2 = '#ff7a2a';
    line(g, 8, 1, 8, 4, 1, c2); line(g, 8, 12, 8, 15, 1, c2);
    line(g, 1, 8, 4, 8, 1, c2); line(g, 12, 8, 15, 8, 1, c2);
    put(g, 4, 4, c2); put(g, 3, 3, c2); put(g, 12, 4, c2); put(g, 13, 3, c2);
    put(g, 4, 12, c2); put(g, 3, 13, c2); put(g, 12, 12, c2); put(g, 13, 13, c2);
    put(g, 8, 8, SPARK);
    shade(g, c);
  },
  // media-style direction triangles (▶ / ◀ button faces)
  play(g, tier, col) {
    const c = col === RARITY_HEX.common ? CREAM : col;
    for (let x = 4; x <= 12; x++) { const half = (12 - x) * 0.62; rect(g, x, Math.round(8 - half), 1, Math.max(1, Math.round(half * 2 + 1)), c); }
    shade(g, c);
  },
  playl(g, tier, col) {
    const c = col === RARITY_HEX.common ? CREAM : col;
    for (let x = 4; x <= 12; x++) { const half = (x - 4) * 0.62; rect(g, x, Math.round(8 - half), 1, Math.max(1, Math.round(half * 2 + 1)), c); }
    shade(g, c);
  },
};

const TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
const _cache = new Map();
const _canvasCache = new Map();

function _paint(kind, opts = {}) {
  const rarity = opts.rarity || 'common';
  const color = opts.color || RARITY_HEX[rarity] || RARITY_HEX.common;
  const scale = opts.scale || 6;
  const recipe = RECIPES[kind];
  if (!recipe || typeof document === 'undefined') return null;
  const g = grid();
  recipe(g, TIER[rarity] ?? 0, color);
  outline(g);
  const c = document.createElement('canvas'); c.width = c.height = S * scale;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const col = g.px[y * S + x]; if (!col) continue; ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
  return c;
}

// dataURL of a pixel sprite ('' on failure). kind: any RECIPES key
// opts: { rarity: 'common'.., color: '#hex' override, scale: px multiple (default 6) }
export function spriteURL(kind, opts = {}) {
  const rarity = opts.rarity || 'common';
  const color = opts.color || RARITY_HEX[rarity] || RARITY_HEX.common;
  const scale = opts.scale || 6;
  const key = `${kind}|${rarity}|${color}|${scale}`;
  if (_cache.has(key)) return _cache.get(key);
  let url = '';
  try {
    const c = _paint(kind, opts);
    if (c) url = c.toDataURL('image/png');
  } catch (e) { url = ''; }
  _cache.set(key, url);
  return url;
}

// the sprite as a canvas (for drawing onto THREE.CanvasTexture surfaces); null on failure
export function spriteCanvas(kind, opts = {}) {
  const rarity = opts.rarity || 'common';
  const color = opts.color || RARITY_HEX[rarity] || RARITY_HEX.common;
  const scale = opts.scale || 6;
  const key = `${kind}|${rarity}|${color}|${scale}`;
  if (_canvasCache.has(key)) return _canvasCache.get(key);
  let c = null;
  try { c = _paint(kind, opts); } catch (e) { c = null; }
  _canvasCache.set(key, c);
  return c;
}

// DOM helper: an <img> pixel sprite, or the text fallback if drawing failed
export function spriteImg(kind, opts = {}, cls = '', fallback = '?') {
  const url = spriteURL(kind, opts);
  if (!url) return `<span class="pixgear-fb ${cls}">${fallback}</span>`;
  return `<img class="pixgear ${cls}" src="${url}" alt="" draggable="false">`;
}

// gear-instance convenience (slot maps 1:1 onto a sprite kind)
export function gearImg(inst, cls = '') {
  if (!inst) return '';
  return spriteImg(inst.slot, { rarity: inst.rarity }, cls, '?');
}

// ===== emoji → sprite map: every emoji the game data uses resolves to a recipe =====
// value: kind string, or [kind, '#color'] for a tinted variant
export const EMOJI_MAP = {
  '🪙': 'coin', '💰': 'moneybag', '🤑': 'coins', '♻': 'coins', '♻️': 'coins', '🛒': 'moneybag',
  '💎': ['gem', '#6fd0ff'], '🧊': ['gem', '#bfe8ff'],
  '🍺': 'beer', '🍻': 'cheers', '🍵': 'coffee', '☕': 'coffee', '🍷': 'goblet',
  '❤️': ['heart', '#ff5d6c'], '❤': ['heart', '#ff5d6c'], '💚': ['heart', '#6ee7a0'], '🖤': ['heart', '#4a4456'],
  '🧪': ['potion', '#56b8ff'], '⚗️': 'alembic', '⚗': 'alembic', '🔬': 'alembic',
  '🌿': 'herb', '🍄': 'mushroom', '🍯': 'honey',
  '☀️': 'sun', '☀': 'sun', '🌑': 'moon', '🌙': 'moon',
  '⏳': 'hourglass', '⏱️': 'clock', '⏱': 'clock',
  '☠️': 'skull', '☠': 'skull', '💀': 'skull',
  '📖': 'book', '📚': 'book', '📒': 'ledger', '📜': 'scroll', '🧾': 'scroll',
  '🎒': 'bag', '🔒': 'lock', '🔓': 'unlock',
  '🗺️': 'map', '🗺': 'map', '🧭': 'map',
  '👁️': 'eye', '👁': 'eye',
  '❗': 'bang', '❕': 'bang', '💬': 'bubble',
  '🎯': 'target', '📌': 'pin', '🎁': 'gift', '🃏': 'cardpack', '🂡': 'cardpack',
  '🚪': 'door', '🪜': 'stairs',
  '⚒️': 'anvil', '⚒': 'anvil', '🔩': 'anvil', '🏛': 'hammer', '🔨': 'hammer', '🔧': 'wrench', '🧰': 'toolbox',
  '⏸': 'pause', '⏸️': 'pause', '🔊': 'sound', '🔇': 'mute', '⚙': 'cog', '⚙️': 'cog',
  '✋': 'hand', '👆': 'hand', '👊': 'fist',
  '🛏': 'bed', '🛏️': 'bed', '🪑': 'chair', '🛋': 'chair', '🟤': 'tableicon', '🟫': 'rug',
  '🏮': 'lamp', '🪴': 'plant', '🏆': 'trophy', '🜲': 'cauldron',
  '⚔️': 'swords', '⚔': 'swords', '🗡️': 'dagger', '🗡': 'dagger', '🪓': 'swords',
  '🎲': 'dice', '👑': 'crown', '❓': 'question', '❔': 'question',
  '👟': 'boot', '🦵': 'boot', '🧲': 'magnet', '🌵': 'cactus', '🩸': 'blood',
  '🛡️': 'shield', '🛡': 'shield',
  '⚡': 'bolt', '🌩️': 'storm', '🌩': 'storm',
  '❄️': 'snowflake', '❄': 'snowflake', '🌀': 'tornado', '🌪️': 'tornado', '🌪': 'tornado',
  '🔥': 'fire', '💧': 'drop', '💦': 'drop', '🌬️': 'wind', '🌬': 'wind', '🪨': 'rock', '🗿': 'rock',
  '🦷': 'fang', '🧛': ['fang', '#ff5d6c'],
  '⚓': 'anchor', '🍀': 'clover',
  '🪶': 'feather', '🎐': ['feather', '#bfe8ff'], '🪽': ['feather', '#f0f4ff'],
  '🐝': 'bee', '🌲': 'tree', '🌳': 'tree', '🦇': 'bat', '⚰️': 'tomb', '⚰': 'tomb',
  '🐊': 'croc', '🐸': 'croc', '🐉': 'dragon', '🐲': 'dragon',
  '🤖': 'robot', '🌌': 'voidspiral',
  '✨': 'star', '⭐': 'star', '🌟': 'star', '⚜': ['star', '#ffd23a'], '⚜️': ['star', '#ffd23a'],
  '🧙': 'wizard', '🧙‍♂️': 'wizard', '👺': 'goblinface',
  '💣': 'bomb', '🧺': 'basket', '🎈': 'balloon',
  '🌼': ['flower', '#ffd23a'], '🌸': ['flower', '#ff9ad0'],
  '😤': 'rage', '😡': 'rage', '😠': 'rage', '💢': ['boom', '#ff5d6c'], '💥': 'boom',
  '🦔': 'spikeball',
  '🧑': 'face', '🧔': 'face', '👩': 'face', '🧓': 'face', '👵': 'face', '👰': 'face', '🤠': 'face', '🥷': 'face', '🤡': 'happy',
  '🎻': 'note', '🎵': 'note', '🕯️': 'candle', '🕯': 'candle', '🧹': 'broom', '🖼️': 'frame', '🖼': 'frame',
  '🦉': 'owl', '🐈': 'cat', '👻': 'ghost', '🏺': 'urn', '⚖️': 'scales', '⚖': 'scales',
  '📝': 'quill', '✍️': 'quill', '✍': 'quill',
  '😄': 'happy', '😊': 'happy', '🥴': 'happy', '😜': 'happy',
  '🎩': 'hat', '🧥': 'robe', '🪄': 'staff', '🔮': ['charm', '#b97bff'],
  '▶': 'play', '▶️': 'play', '◀': 'playl', '◀️': 'playl',
  '✅': 'check', '🔴': ['pad', '#e04a5a'], '🟢': ['pad', '#4fa050'], '🔵': ['pad', '#4a7ae0'], '🟡': ['pad', '#ffd23a'],
  '✦': ['star', '#ffcf5c'], '🥇': 'trophy', '🏅': 'trophy',
};

function _resolve(nameOrEmoji, opts = {}) {
  let kind = nameOrEmoji, extra = null;
  const m = EMOJI_MAP[nameOrEmoji];
  if (m) { if (Array.isArray(m)) { kind = m[0]; extra = m[1]; } else kind = m; }
  if (!RECIPES[kind]) return null;
  const o = { ...opts };
  if (extra && !o.color) o.color = extra;
  return { kind, opts: o };
}

// icon <img> from a recipe name OR an emoji (resolved through EMOJI_MAP).
// Unknown names return the input wrapped in a span (visible text fallback).
export function iconImg(nameOrEmoji, opts = {}, cls = '') {
  const r = _resolve(nameOrEmoji, opts);
  if (!r) return `<span class="pixi-fb ${cls}">${nameOrEmoji}</span>`;
  const url = spriteURL(r.kind, r.opts);
  if (!url) return `<span class="pixi-fb ${cls}">${nameOrEmoji}</span>`;
  return `<img class="pixi ${cls}" src="${url}" alt="" draggable="false">`;
}

// icon canvas from a recipe name OR an emoji, for THREE/2D-canvas surfaces
export function iconCanvas(nameOrEmoji, opts = {}) {
  const r = _resolve(nameOrEmoji, opts);
  if (!r) return null;
  return spriteCanvas(r.kind, r.opts);
}

// ---- pixify: swap every emoji inside a text string for an inline sprite <img> ----
// (unmapped pictographs are stripped so no raw emoji ever reaches the screen)
const _EMOJI_KEYS = Object.keys(EMOJI_MAP).sort((a, b) => b.length - a.length);
let _emojiRe = null;
function emojiRe() {
  if (_emojiRe) return _emojiRe;
  // strip leftover pictographs, but KEEP plain geometric/typographic glyphs
  // (direction triangles, stars, ticks) that render as monochrome text
  try { _emojiRe = new RegExp('(?![\\u25A0-\\u25FF\\u2605\\u2606\\u2713\\u2714\\u2736\\u27A4])\\p{Extended_Pictographic}[\\uFE0F\\u200D]*', 'gu'); }
  catch (e) { _emojiRe = /$^/g; }
  return _emojiRe;
}
const _escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function _pixifyRaw(s, cls) {
  for (const k of _EMOJI_KEYS) {
    if (s.indexOf(k) === -1) continue;
    const r = _resolve(k);
    const url = r ? spriteURL(r.kind, r.opts) : '';
    const rep = url ? `<img class="pixi ${cls}" src="${url}" alt="" draggable="false">` : '';
    s = s.split(k).join(rep);
  }
  s = s.replace(emojiRe(), '');
  return s.replace(/ {2,}/g, ' ');
}

// Turn a plain string (possibly containing emoji) into safe HTML with pixel icons.
export function pixify(text, cls = '') { return _pixifyRaw(_escapeHtml(text), cls); }
// Same, but for TRUSTED internal strings that already contain markup (<b> etc).
export function pixifyHtml(html, cls = '') { return _pixifyRaw(String(html), cls); }
