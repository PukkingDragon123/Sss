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

  // ===== NEW gear variants — each draws its own subject and uses the rarity `col`
  //       as a highlight so loot still tints by rarity. Catalogued in GEAR_VARIANTS.
  //  -- hats --
  g_wizhat(g, tier, col) {
    const base = '#5a4fa0';
    tri(g, 8, 1, 10, 4.6, base);
    put(g, 9, 1, base); put(g, 10, 1, base); put(g, 10, 0, base);   // floppy tip
    rect(g, 2, 11, 12, 2, base);                                    // brim
    rect(g, 4, 9, 8, 1, col);                                       // hatband = rarity
    put(g, 8, 9, GOLD);
    put(g, 6, 6, GOLD); put(g, 9, 4, GOLD);                         // stars
    shade(g, base); shade(g, col);
    if (tier >= 1) sparkle(g, 5, 7);
    if (tier >= 3) { sparkle(g, 11, 10); put(g, 3, 12, col); put(g, 12, 12, col); }
  },
  g_crown(g, tier, col) {
    rect(g, 2, 9, 12, 4, GOLD);
    tri(g, 3, 5, 9, 1.5, GOLD); tri(g, 6, 4, 9, 1.5, GOLD); tri(g, 8, 3, 9, 1.6, GOLD); tri(g, 10, 4, 9, 1.5, GOLD); tri(g, 13, 5, 9, 1.5, GOLD);
    put(g, 3, 5, col); put(g, 8, 4, col); put(g, 13, 5, col);       // point jewels = rarity
    disc(g, 8, 11, 1.6, col);                                       // centre gem = rarity
    put(g, 5, 11, RED); put(g, 11, 11, BLUE);
    shade(g, GOLD);
    if (tier >= 1) sparkle(g, 12, 8);
    if (tier >= 3) sparkle(g, 4, 8);
  },
  g_hood(g, tier, col) {
    disc(g, 8, 8, 6, '#584a70');                                    // drape
    disc(g, 8, 9, 3.8, '#1c1430');                                  // dark face hole
    put(g, 6, 9, '#7fd0ff'); put(g, 10, 9, '#7fd0ff');             // glowing eyes
    disc(g, 8, 13, 1.5, col);                                       // throat clasp = rarity
    shade(g, '#584a70');
    put(g, 5, 4, lighten('#584a70', 0.4));
    if (tier >= 1) sparkle(g, 12, 5);
    if (tier >= 3) sparkle(g, 4, 6);
  },
  g_helm(g, tier, col) {
    disc(g, 8, 7, 5, IRON);
    rect(g, 3, 7, 11, 6, IRON);
    rect(g, 4, 8, 9, 1, DARK);                                      // visor slit
    put(g, 6, 11, DARK); put(g, 8, 11, DARK); put(g, 10, 11, DARK);
    rect(g, 7, 0, 2, 4, col); put(g, 6, 1, col); put(g, 9, 1, col); // plume = rarity
    shade(g, IRON); shade(g, col);
    put(g, 5, 5, lighten(IRON, 0.5));
    if (tier >= 1) sparkle(g, 12, 4);
  },
  g_circlet(g, tier, col) {
    for (let x = 2; x <= 13; x++) { const y = 9 + Math.round(Math.sin((x - 2) / 11 * Math.PI) * -2); put(g, x, y, GOLD); put(g, x, y + 1, GOLD); }
    disc(g, 8, 6, 1.8, col);                                        // crest gem = rarity
    put(g, 4, 8, col); put(g, 12, 8, col);
    shade(g, GOLD);
    put(g, 8, 5, lighten(col, 0.6));
    if (tier >= 1) sparkle(g, 8, 3);
    if (tier >= 3) { sparkle(g, 3, 6); sparkle(g, 13, 6); }
  },
  g_tricorne(g, tier, col) {
    disc(g, 8, 7, 3.4, '#2b2540');
    rect(g, 5, 5, 6, 4, '#2b2540');
    rect(g, 1, 8, 14, 2, '#2b2540');                               // brim
    tri(g, 2, 4, 9, 2.2, '#2b2540'); tri(g, 14, 4, 9, 2.2, '#2b2540'); // upturned points
    rect(g, 3, 8, 10, 1, col);                                      // trim = rarity
    disc(g, 4, 5, 1.2, col);                                        // cockade = rarity
    shade(g, '#2b2540');
    if (tier >= 1) sparkle(g, 11, 3);
    if (tier >= 3) sparkle(g, 8, 2);
  },
  g_strawhat(g, tier, col) {
    rect(g, 1, 10, 14, 2, '#d9b56a');                               // brim
    disc(g, 8, 8, 4, '#e0c078');                                    // dome
    for (let x = 3; x <= 13; x += 2) put(g, x, 11, darken('#d9b56a', 0.2));
    rect(g, 4, 9, 8, 1, col);                                       // ribbon = rarity
    shade(g, '#e0c078'); shade(g, '#d9b56a');
    if (tier >= 1) sparkle(g, 12, 6);
    if (tier >= 3) sparkle(g, 4, 6);
  },
  g_horns(g, tier, col) {
    const iv = '#efe4c8';
    disc(g, 8, 10, 4.2, '#5a4c3a'); rect(g, 4, 10, 8, 4, '#5a4c3a'); // cap
    line(g, 5, 9, 2, 3, 2, iv); line(g, 11, 9, 14, 3, 2, iv);        // horns
    put(g, 2, 2, iv); put(g, 14, 2, iv);
    disc(g, 8, 10, 1.6, col);                                        // brow gem = rarity
    shade(g, '#5a4c3a'); shade(g, iv);
    if (tier >= 1) sparkle(g, 8, 7);
    if (tier >= 3) { put(g, 2, 2, lighten(col, 0.4)); put(g, 14, 2, lighten(col, 0.4)); }
  },
  //  -- robes --
  g_cloak(g, tier, col) {
    rect(g, 3, 2, 10, 2, '#3a4a6a');
    taper(g, 8, 3, 14, 3, 6.5, '#3a4a6a');                          // flaring body
    rect(g, 8, 4, 1, 10, darken('#3a4a6a', 0.4));                   // split
    disc(g, 8, 3, 1.4, col);                                        // clasp = rarity
    shade(g, '#3a4a6a');
    if (tier >= 1) sparkle(g, 5, 6);
    if (tier >= 3) sparkle(g, 11, 9);
  },
  g_tunic(g, tier, col) {
    rect(g, 2, 4, 3, 3, '#6a8e4a'); rect(g, 11, 4, 3, 3, '#6a8e4a'); // sleeves
    rect(g, 5, 3, 6, 10, '#6a8e4a');
    rect(g, 7, 3, 2, 2, DARK);                                       // neck
    rect(g, 5, 9, 6, 1, col);                                        // belt = rarity
    shade(g, '#6a8e4a');
    put(g, 6, 5, lighten('#6a8e4a', 0.4));
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 11);
  },
  g_platemail(g, tier, col) {
    disc(g, 4, 5, 2.4, IRON); disc(g, 12, 5, 2.4, IRON);            // pauldrons
    rect(g, 4, 5, 8, 8, IRON);
    taper(g, 8, 12, 14, 4, 2.5, IRON);
    rect(g, 4, 8, 8, 1, darken(IRON, 0.3));
    line(g, 8, 6, 8, 12, 1, darken(IRON, 0.25));
    disc(g, 8, 6, 1.3, col);                                        // chest gem = rarity
    shade(g, IRON);
    put(g, 5, 5, lighten(IRON, 0.5));
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 12);
  },
  g_scales(g, tier, col) {
    rect(g, 4, 3, 8, 10, '#48695a');
    rect(g, 2, 4, 2, 3, '#48695a'); rect(g, 12, 4, 2, 3, '#48695a');
    taper(g, 8, 12, 13, 4, 3, '#48695a');
    for (let ry = 4; ry <= 12; ry++) for (let x = 4; x <= 11; x++) if ((x + ry) % 2 === 0) put(g, x, ry, '#6a9a80'); // scale texture
    disc(g, 8, 3, 1.3, col);                                        // collar clasp = rarity
    shade(g, '#48695a');
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 11);
  },
  g_ragrobe(g, tier, col) {
    rect(g, 5, 2, 6, 2, '#7a6a5a');
    taper(g, 8, 3, 12, 2.5, 5, '#8a7a68');
    rect(g, 2, 3, 2, 4, '#8a7a68'); rect(g, 12, 3, 2, 4, '#8a7a68');
    put(g, 4, 12, null); put(g, 6, 13, null); put(g, 9, 13, null); put(g, 11, 12, null); put(g, 8, 13, null); // ragged hem
    put(g, 6, 7, col); put(g, 10, 9, col);                          // patches = rarity
    shade(g, '#8a7a68');
    if (tier >= 1) sparkle(g, 5, 5);
    if (tier >= 3) sparkle(g, 11, 6);
  },
  g_royalrobe(g, tier, col) {
    taper(g, 8, 3, 13, 3, 6, col);                                  // body = rarity
    rect(g, 4, 2, 8, 2, '#f4f0e8');                                 // fur collar
    rect(g, 2, 3, 2, 5, '#f4f0e8'); rect(g, 12, 3, 2, 5, '#f4f0e8');
    rect(g, 7, 4, 2, 9, GOLD);                                      // gold placket
    put(g, 5, 3, DARK); put(g, 10, 3, DARK);                        // ermine spots
    shade(g, col); shade(g, GOLD);
    if (tier >= 1) sparkle(g, 5, 8);
    if (tier >= 3) { sparkle(g, 11, 10); put(g, 8, 6, SPARK); }
  },
  g_furcoat(g, tier, col) {
    rect(g, 4, 3, 8, 10, '#8a6a4a');
    rect(g, 2, 4, 2, 4, '#8a6a4a'); rect(g, 12, 4, 2, 4, '#8a6a4a');
    rect(g, 4, 2, 8, 2, '#b89a72'); put(g, 3, 3, '#b89a72'); put(g, 12, 3, '#b89a72'); // fur collar
    put(g, 6, 6, darken('#8a6a4a', 0.2)); put(g, 9, 8, darken('#8a6a4a', 0.2)); put(g, 7, 10, darken('#8a6a4a', 0.2));
    rect(g, 8, 4, 1, 9, darken('#8a6a4a', 0.35));                   // opening
    disc(g, 8, 6, 1.2, col);                                        // clasp = rarity
    shade(g, '#8a6a4a');
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 11);
  },
  //  -- staves --
  g_oakstaff(g, tier, col) {
    line(g, 5, 15, 9, 3, 2, '#6a4a2a');                             // gnarled shaft
    put(g, 6, 10, darken('#6a4a2a', 0.3)); put(g, 8, 6, darken('#6a4a2a', 0.3)); // knots
    line(g, 9, 5, 11, 3, 1, '#6a4a2a');                            // twig
    disc(g, 10, 3, 1.6, GREEN); disc(g, 8, 3, 1.4, GREEN);         // leaves
    disc(g, 9, 3, 1, col);                                          // fruit gem = rarity
    shade(g, '#6a4a2a'); shade(g, GREEN);
    if (tier >= 1) sparkle(g, 11, 2);
    if (tier >= 3) sparkle(g, 6, 5);
  },
  g_crystalstaff(g, tier, col) {
    line(g, 5, 15, 8, 6, 2, '#7a6a8a');
    tri(g, 8, 1, 5, 2.4, col);                                      // crystal = rarity
    taper(g, 8, 5, 6, 2.4, 1.2, col);
    put(g, 5, 5, col); put(g, 11, 5, col); put(g, 6, 4, col); put(g, 10, 4, col); // shards
    rect(g, 6, 6, 5, 1, GOLD);                                      // collar
    shade(g, col);
    put(g, 7, 3, lighten(col, 0.6));
    if (tier >= 1) sparkle(g, 11, 2);
    if (tier >= 3) { sparkle(g, 5, 3); sparkle(g, 8, 8); }
  },
  g_scythe(g, tier, col) {
    line(g, 6, 15, 9, 2, 2, '#5a4030');                             // snath
    line(g, 9, 2, 3, 3, 1, '#cfd6dd'); line(g, 3, 3, 2, 6, 1, '#cfd6dd'); // blade
    put(g, 5, 2, '#cfd6dd'); put(g, 7, 2, '#cfd6dd');
    put(g, 4, 3, col); put(g, 3, 4, col); put(g, 3, 5, col);        // glowing edge = rarity
    shade(g, '#5a4030');
    put(g, 6, 2, lighten('#cfd6dd', 0.4));
    if (tier >= 1) sparkle(g, 2, 7);
    if (tier >= 3) sparkle(g, 8, 4);
  },
  g_wand(g, tier, col) {
    line(g, 4, 13, 11, 5, 2, '#3a2f4a');
    put(g, 10, 6, GOLD); put(g, 11, 5, GOLD);                       // ferrule
    put(g, 12, 3, col); put(g, 11, 3, col); put(g, 13, 3, col); put(g, 12, 2, col); put(g, 12, 4, col); // star = rarity
    put(g, 11, 2, lighten(col, 0.5)); put(g, 13, 4, col);
    shade(g, '#3a2f4a');
    sparkle(g, 12, 3);
    if (tier >= 1) sparkle(g, 4, 12);
    if (tier >= 3) { put(g, 14, 5, col); put(g, 9, 8, col); }
  },
  g_trident(g, tier, col) {
    line(g, 8, 15, 8, 6, 2, '#4a6a7a');                             // haft
    rect(g, 5, 4, 1, 3, IRON); rect(g, 8, 3, 1, 4, IRON); rect(g, 11, 4, 1, 3, IRON); // prongs
    rect(g, 5, 6, 7, 1, IRON);
    put(g, 5, 3, IRON); put(g, 11, 3, IRON);
    disc(g, 8, 8, 1.3, col);                                        // gem = rarity
    shade(g, IRON); shade(g, '#4a6a7a');
    if (tier >= 1) sparkle(g, 8, 2);
    if (tier >= 3) sparkle(g, 12, 3);
  },
  g_bonestaff(g, tier, col) {
    line(g, 6, 15, 9, 3, 2, '#e8e0d0');                             // bone shaft
    put(g, 7, 12, darken('#e8e0d0', 0.2)); put(g, 8, 8, darken('#e8e0d0', 0.2)); // joints
    put(g, 7, 3, '#e8e0d0'); put(g, 11, 3, '#e8e0d0'); put(g, 6, 2, '#e8e0d0'); put(g, 12, 2, '#e8e0d0'); // claw
    disc(g, 9, 3, 1.8, col);                                        // held gem = rarity
    shade(g, '#e8e0d0');
    put(g, 8, 2, lighten(col, 0.6));
    if (tier >= 1) sparkle(g, 12, 5);
    if (tier >= 3) sparkle(g, 6, 6);
  },
  g_torchstaff(g, tier, col) {
    line(g, 7, 15, 8, 7, 2, '#6a4a2a');
    rect(g, 5, 6, 6, 1, GOLD);                                      // bowl rim
    taper(g, 8, 1, 6, 0.4, 2.8, '#ff7a2a');                         // flame
    taper(g, 8, 3, 6, 0.3, 1.6, '#ffd23a');
    put(g, 8, 4, '#fff6e0');
    put(g, 5, 6, col); put(g, 10, 6, col);                          // rim gems = rarity
    shade(g, '#6a4a2a'); shade(g, '#ff7a2a');
    if (tier >= 1) sparkle(g, 11, 2);
    if (tier >= 3) sparkle(g, 5, 3);
  },
  g_skullstaff(g, tier, col) {
    line(g, 8, 15, 8, 8, 2, '#3a2f2a');
    disc(g, 8, 5, 3.4, '#f2eee2'); rect(g, 6, 5, 5, 4, '#f2eee2');  // skull
    rect(g, 5, 4, 2, 2, col); rect(g, 9, 4, 2, 2, col);             // glowing eyes = rarity
    put(g, 8, 6, '#c9c2b0');
    put(g, 6, 8, DARK); put(g, 8, 8, DARK); put(g, 10, 8, DARK);    // teeth
    shade(g, '#f2eee2');
    if (tier >= 1) sparkle(g, 12, 2);
    if (tier >= 3) { put(g, 5, 4, lighten(col, 0.4)); put(g, 10, 4, lighten(col, 0.4)); }
  },
  //  -- charms --
  g_amulet(g, tier, col) {
    for (let a = -2.3; a <= -0.8; a += 0.2) put(g, 8 + Math.cos(a) * 5, 8 + Math.sin(a) * 6.5, GOLD);
    for (let a = Math.PI + 0.8; a <= Math.PI + 2.3; a += 0.2) put(g, 8 + Math.cos(a) * 5, 8 + Math.sin(a) * 6.5, GOLD); // chain
    disc(g, 8, 10, 3, GOLD);                                        // bezel
    disc(g, 8, 10, 2, col);                                         // stone = rarity
    taper(g, 8, 7, 9, 0.4, 1.6, col);
    shade(g, col);
    put(g, 7, 9, lighten(col, 0.7));
    if (tier >= 1) sparkle(g, 12, 5);
    if (tier >= 3) sparkle(g, 4, 5);
  },
  g_ring(g, tier, col) {
    disc(g, 8, 10, 4, GOLD);
    disc(g, 8, 10, 2.4, null);                                      // band hole
    disc(g, 8, 5, 2, col);                                          // gem = rarity
    rect(g, 6, 5, 5, 1, GOLD);                                      // setting
    shade(g, GOLD); shade(g, col);
    put(g, 8, 4, lighten(col, 0.6));
    if (tier >= 1) sparkle(g, 11, 3);
    if (tier >= 3) sparkle(g, 5, 8);
  },
  g_orb(g, tier, col) {
    disc(g, 8, 7, 4.4, col);                                        // orb = rarity
    disc(g, 6.5, 5.5, 1.6, lighten(col, 0.6));                      // glow
    rect(g, 5, 12, 6, 1, GOLD); put(g, 6, 11, GOLD); put(g, 9, 11, GOLD); rect(g, 6, 13, 4, 1, GOLD); // stand
    shade(g, col);
    put(g, 10, 9, darken(col, 0.3));
    if (tier >= 1) sparkle(g, 10, 4);
    if (tier >= 3) { sparkle(g, 5, 9); sparkle(g, 11, 6); }
  },
  g_rune(g, tier, col) {
    rect(g, 4, 3, 8, 11, '#7a7488');                                // stone tablet
    put(g, 4, 3, null); put(g, 11, 3, null);
    line(g, 8, 4, 8, 11, 1, col); line(g, 8, 6, 11, 4, 1, col); line(g, 8, 9, 5, 12, 1, col); // glyph = rarity
    shade(g, '#7a7488');
    if (tier >= 1) sparkle(g, 6, 5);
    if (tier >= 3) sparkle(g, 10, 10);
  },
  g_feather(g, tier, col) {
    line(g, 4, 14, 12, 3, 2, col);                                  // plume = rarity
    line(g, 4, 14, 12, 3, 1, darken(col, 0.25));                    // spine
    put(g, 13, 2, col); put(g, 3, 14, darken(col, 0.3));
    put(g, 6, 9, null); put(g, 9, 6, null);                         // barb notches
    rect(g, 3, 13, 3, 1, GOLD); put(g, 3, 14, GOLD);                // binding
    shade(g, col);
    if (tier >= 1) sparkle(g, 11, 3);
    if (tier >= 3) sparkle(g, 6, 11);
  },
  g_hourglass(g, tier, col) {
    rect(g, 3, 2, 10, 1, GOLD); rect(g, 3, 13, 10, 1, GOLD);
    line(g, 4, 3, 4, 12, 1, GOLD); line(g, 11, 3, 11, 12, 1, GOLD); // posts
    taper(g, 8, 3, 7, 3, 0.6, '#dfeef5'); taper(g, 8, 8, 12, 0.6, 3, '#dfeef5'); // glass
    taper(g, 8, 4, 6, 2.2, 0.4, col); rect(g, 6, 10, 5, 2, col); put(g, 8, 8, col); // sand = rarity
    shade(g, '#dfeef5'); shade(g, GOLD);
    if (tier >= 1) sparkle(g, 12, 2);
    if (tier >= 3) sparkle(g, 4, 14);
  },
  g_eyecharm(g, tier, col) {
    disc(g, 8, 9, 5, col);                                          // ring = rarity
    disc(g, 8, 9, 3.6, '#f0f4ff');
    disc(g, 8, 9, 2, BLUE);
    put(g, 8, 9, DARK); put(g, 7, 8, SPARK);
    rect(g, 7, 2, 2, 3, GOLD);
    disc(g, 8, 3, 1.4, GOLD); disc(g, 8, 3, 0.6, null);             // loop
    shade(g, col);
    if (tier >= 1) sparkle(g, 12, 5);
    if (tier >= 3) sparkle(g, 4, 12);
  },

  // ===== MORE gear variants (batch 2) — same rules: own subject + rarity `col` highlight
  //  -- hats --
  g_jester(g, tier, col) {
    const a = '#c23a5a', b = '#3a6ac2';
    tri(g, 3, 4, 9, 2.2, a); tri(g, 8, 2, 9, 2.4, b); tri(g, 13, 4, 9, 2.2, a); // three motley cones
    rect(g, 2, 9, 12, 2, b);                                        // cap band
    rect(g, 2, 9, 12, 1, a);
    put(g, 3, 3, col); put(g, 8, 1, col); put(g, 13, 3, col);       // bells = rarity
    shade(g, a); shade(g, b);
    if (tier >= 1) sparkle(g, 8, 5);
    if (tier >= 3) { put(g, 3, 3, lighten(col, 0.5)); put(g, 13, 3, lighten(col, 0.5)); }
  },
  g_halo(g, tier, col) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x - 8) / 6, dy = (y - 6) / 2.6, d = dx * dx + dy * dy;
      if (d <= 1 && d >= 0.34) put(g, x, y, GOLD);                  // flattened ring (perspective halo)
    }
    shade(g, GOLD);
    put(g, 3, 6, col); put(g, 13, 6, col);                         // rarity glow at ring ends
    if (tier >= 1) sparkle(g, 8, 3);
    if (tier >= 3) { put(g, 2, 6, lighten(col, 0.4)); put(g, 14, 6, lighten(col, 0.4)); sparkle(g, 11, 4); }
  },
  g_antlers(g, tier, col) {
    const horn = '#c9a86a', cap = '#5a4030';
    disc(g, 8, 11, 3.2, cap); rect(g, 5, 10, 6, 3, cap);           // fur cap
    line(g, 6, 10, 4, 3, 1, horn); line(g, 4, 6, 2, 4, 1, horn); line(g, 4, 5, 5, 2, 1, horn);
    line(g, 10, 10, 12, 3, 1, horn); line(g, 12, 6, 14, 4, 1, horn); line(g, 12, 5, 11, 2, 1, horn);
    disc(g, 8, 10, 1.3, col);                                       // brow gem = rarity
    shade(g, horn); shade(g, cap);
    if (tier >= 1) sparkle(g, 8, 8);
    if (tier >= 3) { put(g, 2, 4, lighten(col, 0.4)); put(g, 14, 4, lighten(col, 0.4)); }
  },
  g_tophat(g, tier, col) {
    const blk = '#2a2536';
    rect(g, 4, 1, 8, 9, blk);                                       // tall crown
    rect(g, 2, 10, 12, 2, blk);                                     // brim
    rect(g, 4, 8, 8, 1, col);                                       // hatband = rarity
    shade(g, blk);
    put(g, 5, 2, lighten(blk, 0.5));                                // sheen
    if (tier >= 1) sparkle(g, 10, 3);
    if (tier >= 3) { put(g, 5, 8, lighten(col, 0.5)); sparkle(g, 6, 5); }
  },
  g_bandana(g, tier, col) {
    const cloth = '#c23a4a';
    rect(g, 3, 5, 10, 4, cloth);                                    // wrap
    rect(g, 2, 6, 2, 2, cloth);                                     // side knot
    line(g, 2, 8, 1, 12, 1, cloth); line(g, 4, 8, 2, 13, 1, cloth); // trailing tails
    put(g, 6, 6, col); put(g, 9, 6, col); put(g, 11, 7, col);       // dots = rarity
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 8, 5);
    if (tier >= 3) sparkle(g, 5, 8);
  },
  g_mitre(g, tier, col) {
    const cloth = '#f0ead8';
    tri(g, 6, 2, 11, 3, cloth); tri(g, 10, 2, 11, 3, cloth);        // two peaks
    rect(g, 4, 8, 8, 4, cloth);
    put(g, 8, 2, null); put(g, 8, 3, null);                        // cleft
    rect(g, 4, 10, 8, 1, GOLD);                                     // trim
    rect(g, 7, 4, 2, 4, col); rect(g, 6, 5, 4, 2, col);            // cross = rarity
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 11, 4);
    if (tier >= 3) sparkle(g, 4, 4);
  },
  g_visor(g, tier, col) {
    const frame = '#3a4048';
    rect(g, 2, 4, 12, 2, frame);                                    // brow frame
    rect(g, 2, 6, 12, 3, col);                                      // tinted lens = rarity
    rect(g, 2, 9, 12, 1, frame);                                    // lower frame
    rect(g, 3, 11, 10, 1, frame);                                   // brim shadow
    put(g, 4, 7, lighten(col, 0.6)); put(g, 6, 7, lighten(col, 0.45)); // reflections
    shade(g, frame);
    if (tier >= 1) sparkle(g, 11, 5);
    if (tier >= 3) sparkle(g, 4, 5);
  },
  g_flowercrown(g, tier, col) {
    for (let x = 2; x <= 13; x++) { const y = 9 + Math.round(Math.sin((x - 2) / 11 * Math.PI) * -2); put(g, x, y, '#4fa050'); put(g, x, y + 1, '#3f8f3f'); } // vine
    disc(g, 4, 8, 1.4, col); disc(g, 8, 5, 1.6, col); disc(g, 12, 8, 1.4, col); // petals = rarity
    put(g, 4, 8, GOLD); put(g, 8, 5, GOLD); put(g, 12, 8, GOLD);   // flower centres
    put(g, 6, 7, '#ff9ad0'); put(g, 10, 7, '#ff9ad0');            // small blooms
    shade(g, col); shade(g, '#4fa050');
    if (tier >= 1) sparkle(g, 8, 3);
    if (tier >= 3) { sparkle(g, 3, 6); sparkle(g, 13, 6); }
  },
  //  -- robes --
  g_poncho(g, tier, col) {
    const cloth = '#c86a3a';
    taper(g, 8, 3, 12, 3, 6.5, cloth);                             // wide flare
    rect(g, 7, 2, 2, 2, DARK);                                      // neck hole
    rect(g, 2, 6, 12, 1, darken(cloth, 0.2));                       // weave line
    rect(g, 2, 8, 12, 1, col);                                      // stripe = rarity
    for (let x = 2; x <= 14; x += 2) put(g, x, 13, cloth);          // fringe
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 5, 6);
    if (tier >= 3) sparkle(g, 11, 10);
  },
  g_kimono(g, tier, col) {
    const cloth = '#b03a5a';
    rect(g, 4, 3, 8, 10, cloth);
    rect(g, 2, 4, 3, 5, cloth); rect(g, 11, 4, 3, 5, cloth);        // wide sleeves
    line(g, 8, 3, 5, 8, 1, '#f0ead8'); line(g, 8, 3, 11, 8, 1, '#f0ead8'); // crossed collar
    rect(g, 4, 9, 8, 2, col);                                       // obi sash = rarity
    put(g, 6, 6, GOLD); put(g, 10, 7, GOLD);                        // motifs
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 12, 4);
    if (tier >= 3) sparkle(g, 4, 11);
  },
  g_labcoat(g, tier, col) {
    const cloth = '#eef2f6';
    rect(g, 4, 3, 8, 10, cloth);
    rect(g, 2, 4, 3, 4, cloth); rect(g, 11, 4, 3, 4, cloth);        // arms
    line(g, 8, 3, 6, 7, 1, darken(cloth, 0.2)); line(g, 8, 3, 10, 7, 1, darken(cloth, 0.2)); // lapels
    rect(g, 8, 4, 1, 9, darken(cloth, 0.1));                        // placket
    put(g, 8, 6, DARK); put(g, 8, 9, DARK);                         // buttons
    rect(g, 9, 9, 3, 2, cloth); put(g, 10, 10, col);               // pocket + pen = rarity
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 11);
  },
  g_battlerobe(g, tier, col) {
    const cloth = '#5a3a6a';
    disc(g, 4, 5, 2.2, IRON); disc(g, 12, 5, 2.2, IRON);           // pauldrons
    rect(g, 5, 4, 6, 9, cloth);
    taper(g, 8, 12, 14, 3.5, 5, cloth);                            // battle skirt
    rect(g, 5, 8, 6, 1, GOLD);                                      // belt
    rect(g, 7, 10, 2, 4, darken(cloth, 0.25));                      // tasset split
    disc(g, 8, 6, 1.4, col);                                        // emblem = rarity
    shade(g, cloth); shade(g, IRON);
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 12);
  },
  g_vestments(g, tier, col) {
    const cloth = '#f2ead6';
    rect(g, 5, 2, 6, 2, cloth);
    taper(g, 8, 3, 13, 3, 5.5, cloth);
    rect(g, 2, 3, 2, 4, cloth); rect(g, 12, 3, 2, 4, cloth);        // sleeves
    rect(g, 6, 3, 1, 10, col); rect(g, 9, 3, 1, 10, col);          // stole = rarity
    rect(g, 7, 5, 2, 4, GOLD); rect(g, 6, 6, 4, 2, GOLD);          // cross
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 11, 5);
    if (tier >= 3) sparkle(g, 4, 10);
  },
  g_shroud(g, tier, col) {
    const cloth = '#3a3550';
    disc(g, 8, 5, 3.2, cloth);                                      // hood
    disc(g, 8, 6, 1.8, '#120e20');                                 // face void
    taper(g, 8, 6, 13, 3, 5, cloth);                               // drape
    put(g, 3, 13, null); put(g, 5, 14, null); put(g, 8, 14, null); put(g, 11, 14, null); put(g, 13, 13, null); // ragged hem
    put(g, 7, 6, col); put(g, 9, 6, col);                          // eyes = rarity
    disc(g, 8, 10, 1.2, col);                                       // heart glow = rarity
    shade(g, cloth);
    if (tier >= 1) sparkle(g, 12, 4);
    if (tier >= 3) sparkle(g, 4, 5);
  },
  g_harlequin(g, tier, col) {
    const a = '#c23a5a', b = '#3a6ac2';
    rect(g, 5, 3, 6, 10, a);
    rect(g, 2, 4, 3, 4, a); rect(g, 11, 4, 3, 4, a);               // sleeves
    taper(g, 8, 12, 14, 3, 4, a);                                  // skirt
    for (let y = 3; y <= 13; y++) for (let x = 2; x <= 13; x++) if (at(g, x, y) === a && ((x + y) % 4 < 2)) put(g, x, y, b); // diamond motley
    rect(g, 5, 2, 6, 1, '#f0ead8');                                // ruff collar
    put(g, 8, 6, col); put(g, 8, 9, col);                          // buttons = rarity
    shade(g, a); shade(g, b);
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 11);
  },
  //  -- staves --
  g_gnarlstaff(g, tier, col) {
    const wd = '#5a4028';
    line(g, 5, 15, 8, 6, 2, wd);                                    // twisting shaft
    put(g, 6, 12, darken(wd, 0.3)); put(g, 7, 9, darken(wd, 0.3));  // knots
    line(g, 8, 6, 5, 3, 1, wd); line(g, 8, 6, 11, 3, 1, wd);        // cradle branches
    put(g, 5, 3, wd); put(g, 11, 3, wd);
    disc(g, 8, 4, 2, col);                                          // cradled orb = rarity
    put(g, 7, 3, lighten(col, 0.6));
    shade(g, wd); shade(g, col);
    if (tier >= 1) sparkle(g, 11, 2);
    if (tier >= 3) sparkle(g, 5, 2);
  },
  g_starrod(g, tier, col) {
    line(g, 5, 15, 9, 7, 2, '#d8b96a');                            // golden rod
    taper(g, 9, 1, 5, 0.3, 2, col); taper(g, 9, 5, 8, 2, 0.3, col); // star spindle
    rect(g, 6, 4, 7, 1, col); put(g, 6, 3, col); put(g, 12, 3, col); put(g, 7, 6, col); put(g, 11, 6, col); // star arms = rarity
    put(g, 9, 4, SPARK);
    shade(g, col); shade(g, '#d8b96a');
    if (tier >= 1) sparkle(g, 13, 2);
    if (tier >= 3) sparkle(g, 5, 3);
  },
  g_scepter(g, tier, col) {
    line(g, 7, 15, 8, 6, 2, GOLD);                                 // golden shaft
    disc(g, 8, 4, 2.4, GOLD);                                      // ornate head
    put(g, 8, 1, GOLD); put(g, 5, 3, GOLD); put(g, 11, 3, GOLD);   // fleur points
    disc(g, 8, 4, 1.2, col);                                        // head gem = rarity
    rect(g, 6, 7, 4, 1, GOLD);                                      // collar
    put(g, 6, 9, col); put(g, 10, 9, col);                          // shaft jewels = rarity
    shade(g, GOLD); shade(g, col);
    if (tier >= 1) sparkle(g, 11, 2);
    if (tier >= 3) sparkle(g, 5, 5);
  },
  g_warhammer(g, tier, col) {
    const hd = '#7a8088';
    rect(g, 3, 2, 10, 5, hd);                                       // head block
    rect(g, 3, 2, 10, 1, lighten(hd, 0.4));
    rect(g, 3, 6, 10, 1, darken(hd, 0.3));
    rect(g, 4, 3, 1, 3, darken(hd, 0.2)); rect(g, 11, 3, 1, 3, darken(hd, 0.2)); // face bands
    disc(g, 8, 4, 1.2, col);                                        // core inlay = rarity
    line(g, 8, 7, 8, 15, 2, WOOD);                                  // haft
    rect(g, 6, 13, 5, 1, GOLD);                                     // grip wrap
    shade(g, hd);
    if (tier >= 1) sparkle(g, 12, 2);
    if (tier >= 3) sparkle(g, 4, 2);
  },
  g_spear(g, tier, col) {
    line(g, 8, 15, 8, 5, 2, '#6a4a2a');                            // shaft
    tri(g, 8, 1, 5, 2, IRON);                                       // blade
    taper(g, 8, 5, 7, 2, 0.3, IRON);
    rect(g, 7, 5, 2, 1, GOLD);                                      // ferrule
    put(g, 7, 6, col); put(g, 9, 6, col); put(g, 8, 7, col);        // tassel = rarity
    shade(g, IRON); shade(g, '#6a4a2a');
    put(g, 7, 3, lighten(IRON, 0.5));
    if (tier >= 1) sparkle(g, 11, 3);
    if (tier >= 3) sparkle(g, 5, 9);
  },
  g_flail(g, tier, col) {
    const bl = '#6a6a76';
    line(g, 4, 15, 6, 9, 2, WOOD);                                  // handle
    put(g, 7, 8, IRON); put(g, 8, 7, IRON); put(g, 9, 6, IRON);     // chain
    disc(g, 11, 5, 2.6, bl);                                        // spiked ball
    put(g, 11, 1, bl); put(g, 14, 5, bl); put(g, 11, 8, bl); put(g, 8, 4, bl); put(g, 13, 2, bl); put(g, 13, 8, bl); // spikes
    disc(g, 11, 5, 1, col);                                         // core = rarity
    shade(g, bl); shade(g, WOOD);
    if (tier >= 1) sparkle(g, 13, 3);
    if (tier >= 3) sparkle(g, 4, 13);
  },
  g_warfan(g, tier, col) {
    const paper = '#f0e8d0';
    for (let a = -1.15; a <= 1.15; a += 0.13) { const x = 8 + Math.sin(a) * 6.5, y = 12 - Math.cos(a) * 8; line(g, 8, 12, x, y, 1, paper); } // fan blades
    line(g, 8, 12, 8 + Math.sin(-1.15) * 6.8, 12 - Math.cos(-1.15) * 8.3, 1, DARK); // outer ribs
    line(g, 8, 12, 8 + Math.sin(1.15) * 6.8, 12 - Math.cos(1.15) * 8.3, 1, DARK);
    for (let a = -1.0; a <= 1.0; a += 0.16) put(g, 8 + Math.sin(a) * 6, 12 - Math.cos(a) * 7.4, col); // rim band = rarity
    disc(g, 8, 12, 1, GOLD);                                        // pivot
    shade(g, paper);
    if (tier >= 1) sparkle(g, 12, 4);
    if (tier >= 3) sparkle(g, 4, 4);
  },
  g_lanternstaff(g, tier, col) {
    line(g, 6, 15, 9, 6, 2, '#4a3a2a');                            // shaft
    put(g, 9, 5, IRON); put(g, 10, 4, IRON); put(g, 10, 3, IRON);   // hook
    rect(g, 8, 5, 5, 6, IRON);                                      // lantern frame
    rect(g, 9, 6, 3, 4, col);                                       // glowing glass = rarity
    put(g, 10, 7, lighten(col, 0.6));
    rect(g, 8, 5, 5, 1, GOLD); rect(g, 8, 10, 5, 1, GOLD);         // caps
    shade(g, IRON); shade(g, col);
    if (tier >= 1) sparkle(g, 13, 4);
    if (tier >= 3) sparkle(g, 5, 9);
  },
  //  -- charms --
  g_locket(g, tier, col) {
    for (let a = -2.3; a <= -0.8; a += 0.22) put(g, 8 + Math.cos(a) * 5, 7 + Math.sin(a) * 6, GOLD);
    for (let a = Math.PI + 0.8; a <= Math.PI + 2.3; a += 0.22) put(g, 8 + Math.cos(a) * 5, 7 + Math.sin(a) * 6, GOLD); // chain
    disc(g, 6.2, 9, 2.2, GOLD); disc(g, 9.8, 9, 2.2, GOLD);        // heart lobes
    taper(g, 8, 10, 14, 4.4, 0.4, GOLD);                            // heart point
    put(g, 8, 6, GOLD);                                             // bail
    disc(g, 8, 9, 1.3, col);                                        // inset gem = rarity
    shade(g, GOLD);
    put(g, 6, 8, lighten(GOLD, 0.4));
    if (tier >= 1) sparkle(g, 12, 4);
    if (tier >= 3) sparkle(g, 4, 5);
  },
  g_talisman(g, tier, col) {
    const paper = '#e8c86a';
    put(g, 8, 2, GOLD); put(g, 8, 3, GOLD);                         // cord
    rect(g, 5, 4, 6, 10, paper);                                    // hanging tag
    put(g, 5, 4, null); put(g, 10, 4, null);                        // clipped corners
    line(g, 8, 5, 8, 12, 1, col); line(g, 8, 7, 6, 9, 1, col); line(g, 8, 7, 10, 9, 1, col); put(g, 8, 12, col); // glyph = rarity
    shade(g, paper);
    if (tier >= 1) sparkle(g, 6, 6);
    if (tier >= 3) sparkle(g, 10, 11);
  },
  g_horseshoe(g, tier, col) {
    const sh = '#b0b6be';
    for (let a = 0.15; a <= Math.PI - 0.15; a += 0.1) { const x = 8 - Math.cos(a) * 5, y = 4 + Math.sin(a) * 7; put(g, x, y, sh); put(g, x, y + 1, sh); } // U band
    put(g, 6, 5, DARK); put(g, 10, 5, DARK); put(g, 4, 8, DARK); put(g, 12, 8, DARK); // nail holes
    disc(g, 8, 9, 1.3, col);                                        // lucky gem = rarity
    shade(g, sh);
    if (tier >= 1) sparkle(g, 8, 13);
    if (tier >= 3) { sparkle(g, 3, 6); sparkle(g, 13, 6); }
  },
  g_dreamcatcher(g, tier, col) {
    const ring = '#a06a3a';
    disc(g, 8, 6, 5, ring); disc(g, 8, 6, 3.6, null);              // hoop
    line(g, 5, 4, 11, 8, 1, col); line(g, 11, 4, 5, 8, 1, col); line(g, 8, 3, 8, 9, 1, col); // web = rarity
    put(g, 8, 6, col);                                              // bead = rarity
    line(g, 6, 11, 5, 15, 1, ring); line(g, 8, 11, 8, 15, 1, ring); line(g, 10, 11, 11, 15, 1, ring); // feather strings
    put(g, 5, 15, col); put(g, 8, 15, col); put(g, 11, 15, col);   // feather tips = rarity
    shade(g, ring);
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 4, 3);
  },
  g_compass(g, tier, col) {
    const body = '#c9a24a';
    disc(g, 8, 8, 5.4, body);                                       // brass case
    disc(g, 8, 8, 4, '#f2ead6');                                    // dial
    put(g, 8, 4, DARK); put(g, 8, 12, DARK); put(g, 4, 8, DARK); put(g, 12, 8, DARK); // ticks
    line(g, 8, 8, 11, 5, 1, col); line(g, 8, 8, 5, 11, 1, '#e8e8f0'); // needle = rarity
    put(g, 8, 8, DARK);
    rect(g, 7, 1, 2, 2, body);                                      // hinge
    shade(g, body);
    if (tier >= 1) sparkle(g, 11, 4);
    if (tier >= 3) sparkle(g, 4, 12);
  },
  g_luckydie(g, tier, col) {
    const top = '#f6efdc', lf = '#e2d8bf', rf = '#cabfa0';
    for (let y = 1; y <= 7; y++) { const half = 3.5 - Math.abs(y - 4); if (half >= 0) rect(g, Math.round(8 - half), y, Math.max(1, Math.round(half * 2)), 1, top); } // top diamond
    rect(g, 4, 7, 4, 6, lf); rect(g, 8, 7, 4, 6, rf);              // side faces
    put(g, 4, 12, null); put(g, 11, 12, null);                     // iso corners
    put(g, 8, 3, DARK);                                            // top pip
    put(g, 5, 9, DARK); put(g, 6, 11, DARK);                        // left pips
    put(g, 9, 9, col); put(g, 11, 9, col); put(g, 10, 10, col); put(g, 9, 11, col); put(g, 11, 11, col); // right face = rarity
    shade(g, top); shade(g, lf); shade(g, rf);
    if (tier >= 1) sparkle(g, 12, 3);
    if (tier >= 3) sparkle(g, 3, 4);
  },
  g_scarab(g, tier, col) {
    const body = '#2fa06a';
    disc(g, 8, 9, 4, body);                                         // carapace
    disc(g, 8, 4.5, 2, body);                                       // head
    rect(g, 7, 6, 2, 7, darken(body, 0.3));                         // wing split
    line(g, 5, 7, 5, 11, 1, darken(body, 0.2)); line(g, 11, 7, 11, 11, 1, darken(body, 0.2)); // wing seams
    put(g, 3, 8, DARK); put(g, 13, 8, DARK); put(g, 3, 11, DARK); put(g, 13, 11, DARK); put(g, 2, 7, DARK); put(g, 14, 7, DARK); // legs
    disc(g, 8, 9, 1.3, col);                                        // gem inlay = rarity
    put(g, 8, 4, col);                                              // head jewel = rarity
    shade(g, body);
    if (tier >= 1) sparkle(g, 12, 4);
    if (tier >= 3) sparkle(g, 4, 4);
  },

  // ===== spell icons — tinted by the spell's element colour; see SPELL_SPRITE =====
  spell_fireball(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff7a3a' : col;
    taper(g, 8, 3, 6, 0.4, 2.6, c);                                 // trailing flame
    disc(g, 8, 9, 4.4, c);
    disc(g, 8, 10, 2.4, '#ffd23a');
    put(g, 8, 10, '#fff6e0');
    put(g, 6, 5, '#ffd23a'); put(g, 10, 6, '#ffd23a');
    shade(g, c);
    sparkle(g, 11, 5);
  },
  spell_gust(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#a6dcef' : col;
    line(g, 2, 4, 9, 4, 2, c);
    put(g, 10, 5, c); put(g, 10, 6, c); put(g, 9, 7, c); put(g, 7, 7, c); // top curl
    line(g, 2, 9, 11, 9, 2, c);
    put(g, 12, 10, c); put(g, 12, 11, c); put(g, 11, 12, c); put(g, 9, 12, c); // low curl
    put(g, 3, 12, c); put(g, 5, 12, c);
    shade(g, c);
    put(g, 3, 4, lighten(c, 0.4));
  },
  spell_lightning(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#a6dcef' : col;
    line(g, 9, 1, 6, 7, 2, c); rect(g, 5, 7, 6, 1, c); line(g, 9, 8, 6, 15, 2, c);
    line(g, 9, 2, 6, 7, 1, '#ffffff'); line(g, 8, 8, 6, 14, 1, '#ffffff'); // hot core
    shade(g, c);
    sparkle(g, 11, 3);
  },
  spell_heal(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#5fb0ff' : col;
    rect(g, 6, 3, 4, 10, c); rect(g, 3, 6, 10, 4, c);               // plus
    disc(g, 8, 8, 1.6, '#eaffff');
    shade(g, c);
    sparkle(g, 12, 3); sparkle(g, 4, 12);
  },
  spell_frost(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#5fb0ff' : col;
    line(g, 8, 2, 8, 14, 2, c); line(g, 3, 5, 13, 11, 2, c); line(g, 13, 5, 3, 11, 2, c); // ice star
    disc(g, 8, 8, 1.8, '#eaffff');
    put(g, 8, 2, '#eaffff'); put(g, 8, 14, '#eaffff');
    shade(g, c);
    sparkle(g, 5, 4);
  },
  spell_spike(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#c9a06a' : col;
    tri(g, 8, 1, 12, 3, c);                                         // main spike
    tri(g, 4, 8, 12, 1.4, c); tri(g, 12, 8, 12, 1.4, c);           // side shards
    rect(g, 3, 12, 10, 1, darken(c, 0.3));                          // ground
    shade(g, c);
    put(g, 7, 5, lighten(c, 0.5));
    sparkle(g, 11, 4);
  },
  spell_nova(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff7a3a' : col;
    disc(g, 8, 8, 6, c); disc(g, 8, 8, 3.6, null); disc(g, 8, 8, 2, '#ffd23a'); // ring
    put(g, 8, 0, c); put(g, 8, 15, c); put(g, 0, 8, c); put(g, 15, 8, c);
    put(g, 2, 2, '#ffd23a'); put(g, 13, 2, '#ffd23a'); put(g, 2, 13, '#ffd23a'); put(g, 13, 13, '#ffd23a');
    shade(g, c);
    put(g, 8, 8, '#fff6e0');
  },
  spell_acid(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#5fb0ff' : col;
    const ac = '#8fd63a';
    disc(g, 7, 10, 3.8, ac);                                        // corrosive splat
    disc(g, 11, 5, 1.6, ac); disc(g, 13, 8, 1, ac);                // flung drops
    put(g, 6, 9, '#eaffca');
    put(g, 5, 12, darken(ac, 0.4)); put(g, 8, 11, darken(ac, 0.4)); // burn holes
    put(g, 10, 7, c); put(g, 13, 4, c);                            // element vapour
    shade(g, ac);
    sparkle(g, 12, 3);
  },
  spell_shield(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#c9a06a' : col;
    rect(g, 4, 2, 8, 7, c); taper(g, 8, 9, 13, 3.8, 0.6, c);        // shield
    rect(g, 7, 5, 2, 4, lighten(c, 0.5)); rect(g, 6, 6, 4, 2, lighten(c, 0.5)); // emblem
    rect(g, 8, 2, 1, 11, darken(c, 0.2));
    shade(g, c);
    sparkle(g, 11, 3);
  },
  spell_quake(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#c9a06a' : col;
    rect(g, 2, 8, 12, 4, c);                                        // ground slab
    line(g, 6, 8, 5, 12, 1, darken(c, 0.5)); line(g, 9, 8, 11, 12, 1, darken(c, 0.5)); // cracks
    disc(g, 5, 5, 1.2, c); disc(g, 10, 4, 1, c); put(g, 8, 6, c);   // flying rubble
    shade(g, c);
    put(g, 3, 8, lighten(c, 0.4));
    sparkle(g, 12, 3);
  },
  spell_orb(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff7a3a' : col;
    disc(g, 8, 8, 5, c);
    disc(g, 6.5, 6.5, 2, lighten(c, 0.6));
    put(g, 14, 8, c); put(g, 2, 8, c); put(g, 8, 2, '#ffd23a'); put(g, 8, 14, '#ffd23a'); // orbiting sparks
    disc(g, 8, 8, 1.4, '#fff6e0');
    shade(g, c);
    sparkle(g, 12, 4);
  },
  spell_blink(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#a6dcef' : col;
    rect(g, 1, 7, 3, 2, darken(c, 0.15)); rect(g, 3, 7, 2, 2, c);   // speed streak
    line(g, 6, 3, 11, 8, 2, c); line(g, 11, 8, 6, 13, 2, c);        // chevron
    line(g, 9, 3, 14, 8, 2, '#ffffff'); line(g, 14, 8, 9, 13, 2, '#ffffff'); // flicker chevron
    shade(g, c);
    sparkle(g, 12, 2);
  },

  // ===== combo emblems — punchy two-spell fusions; see COMBO_SPRITE =====
  combo_firetornado(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff7a3a' : col;
    rect(g, 3, 2, 10, 2, c); rect(g, 4, 4, 8, 2, '#ffd23a');
    rect(g, 5, 6, 6, 2, c); rect(g, 6, 8, 4, 2, '#ffd23a');
    rect(g, 7, 10, 2, 2, c); put(g, 7, 12, c); put(g, 8, 13, '#ffd23a'); // funnel
    shade(g, c);
    put(g, 4, 2, '#fff6e0');
    sparkle(g, 12, 3);
  },
  combo_icestorm(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#7fd0ff' : col;
    disc(g, 6, 5, 2.6, '#bfe0f0'); disc(g, 10, 5, 2.8, '#bfe0f0'); rect(g, 4, 5, 8, 2, '#bfe0f0'); // cloud
    put(g, 5, 8, c); put(g, 5, 9, c); put(g, 11, 8, c); put(g, 11, 9, c); // icicles
    line(g, 8, 7, 7, 11, 2, '#ffe86a'); line(g, 7, 11, 9, 14, 1, '#ffe86a'); // bolt
    put(g, 8, 10, c);
    shade(g, '#bfe0f0');
    sparkle(g, 3, 4);
  },
  combo_holynova(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ffe07a' : col;
    line(g, 8, 0, 8, 15, 1, c); line(g, 0, 8, 15, 8, 1, c);
    line(g, 2, 2, 14, 14, 1, c); line(g, 14, 2, 2, 14, 1, c);       // rays
    disc(g, 8, 8, 3.4, c);
    rect(g, 7, 5, 2, 7, '#fffbea'); rect(g, 5, 7, 6, 2, '#fffbea'); // heal cross
    shade(g, c);
    put(g, 8, 8, GOLD);
    sparkle(g, 11, 3);
  },
  combo_toxiccloud(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#8fd63a' : col;
    disc(g, 5.5, 8, 3, c); disc(g, 10.5, 8, 3.2, c); disc(g, 8, 6, 3, c); rect(g, 4, 8, 9, 3, c); // cloud
    put(g, 6, 7, DARK); put(g, 10, 7, DARK); put(g, 8, 10, DARK);   // skull hollows
    put(g, 5, 12, c); put(g, 9, 13, c); put(g, 12, 12, c);          // drips
    shade(g, c);
    put(g, 4, 6, lighten(c, 0.4));
    sparkle(g, 13, 4);
  },
  combo_bulwark(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#c9a06a' : col;
    rect(g, 3, 2, 10, 8, c); taper(g, 8, 10, 14, 4.8, 0.6, c);      // big shield
    rect(g, 7, 4, 2, 7, '#fffbea'); rect(g, 5, 6, 6, 2, '#fffbea'); // heal plus
    rect(g, 3, 2, 10, 1, lighten(c, 0.4));
    shade(g, c);
    sparkle(g, 12, 3);
  },
  combo_glacier(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#8fd8ff' : col;
    tri(g, 6, 2, 13, 4, c); tri(g, 11, 5, 13, 3, c); rect(g, 2, 11, 12, 3, c); // ice peak
    line(g, 6, 3, 4, 11, 1, lighten(c, 0.5)); line(g, 6, 3, 8, 11, 1, darken(c, 0.2)); // facets
    put(g, 5, 6, '#eaffff'); put(g, 10, 8, '#eaffff');
    shade(g, c);
    sparkle(g, 12, 3);
  },
  combo_flamedash(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#ff7a3a' : col;
    disc(g, 11, 5, 3, c); disc(g, 11, 5, 1.4, '#ffd23a');           // comet head
    line(g, 9, 7, 2, 14, 2, c); line(g, 9, 7, 3, 13, 1, '#ffd23a'); // trail
    put(g, 2, 14, '#fff6e0');
    shade(g, c);
    sparkle(g, 13, 2);
  },
  combo_thunderorb(g, tier, col) {
    const c = col === RARITY_HEX.common ? '#b97bff' : col;
    disc(g, 8, 8, 4.6, c); disc(g, 6.5, 6.5, 1.8, lighten(c, 0.5)); // orb
    line(g, 3, 4, 6, 8, 1, '#ffe86a'); line(g, 6, 8, 4, 12, 1, '#ffe86a');
    line(g, 13, 5, 10, 8, 1, '#ffe86a'); line(g, 10, 8, 12, 12, 1, '#ffe86a'); // arcs
    put(g, 8, 8, '#fffbea');
    shade(g, c);
    sparkle(g, 12, 3);
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

  // ===== creature / pet sprites — chunky friendly critters; `col` = eyes/glow/collar. see PET_SPRITE
  pet_wisp(g, tier, col) {
    disc(g, 8, 7, 4, '#eaf6ff');                                    // fluffy body
    put(g, 7, 12, '#cfeaff'); put(g, 8, 13, '#cfeaff'); put(g, 9, 12, '#bfe0f5'); // wispy tail
    put(g, 6, 7, DARK); put(g, 10, 7, DARK);                        // eyes
    put(g, 8, 9, '#ff9ad0');                                        // blush
    put(g, 3, 5, col); put(g, 13, 5, col); put(g, 8, 2, col); put(g, 3, 10, col); put(g, 13, 10, col); // glow motes = rarity
    shade(g, '#eaf6ff');
    put(g, 5, 5, SPARK);
    if (tier >= 1) sparkle(g, 12, 3);
  },
  pet_slime(g, tier, col) {
    const body = '#5fd08a';
    disc(g, 8, 10, 5, body); rect(g, 3, 10, 11, 3, body);          // blob
    put(g, 5, 6, body); put(g, 11, 7, body);                        // wobble bumps
    put(g, 6, 9, DARK); put(g, 10, 9, DARK);                        // eyes
    put(g, 6, 8, SPARK); put(g, 10, 8, SPARK);                      // eye shine
    put(g, 7, 11, darken(body, 0.25)); put(g, 8, 12, darken(body, 0.25)); put(g, 9, 11, darken(body, 0.25)); // smile
    disc(g, 8, 10, 1.2, col);                                       // core = rarity
    shade(g, body);
    put(g, 5, 8, lighten(body, 0.4));
    if (tier >= 1) sparkle(g, 12, 5);
  },
  pet_bat(g, tier, col) {
    const body = '#6a5a8c', web = '#584a78';
    disc(g, 8, 8, 3, body);                                         // round body
    tri(g, 6, 4, 6, 1, body); tri(g, 10, 4, 6, 1, body);           // ears
    taper(g, 3.5, 6, 11, 0.4, 2.6, web); put(g, 2, 7, web); put(g, 1, 8, web); // left wing
    taper(g, 12.5, 6, 11, 0.4, 2.6, web); put(g, 14, 7, web); put(g, 15, 8, web); // right wing
    put(g, 2, 11, null); put(g, 4, 11, null); put(g, 12, 11, null); put(g, 14, 11, null); // scallops
    put(g, 7, 7, col); put(g, 9, 7, col);                          // eyes = rarity
    put(g, 7, 10, SPARK); put(g, 9, 10, SPARK);                    // fangs
    shade(g, body); shade(g, web);
    if (tier >= 1) sparkle(g, 8, 4);
  },
  pet_golem(g, tier, col) {
    const st = '#8a8478';
    rect(g, 4, 5, 8, 7, st);                                        // body
    rect(g, 3, 6, 1, 4, st); rect(g, 12, 6, 1, 4, st);            // arms
    rect(g, 5, 12, 2, 2, st); rect(g, 9, 12, 2, 2, st);           // legs
    line(g, 6, 5, 7, 8, 1, darken(st, 0.25));                       // crack
    put(g, 4, 5, GREEN); put(g, 11, 5, GREEN);                     // moss
    put(g, 6, 7, col); put(g, 9, 7, col);                          // eyes = rarity
    disc(g, 8, 9, 1.3, col);                                        // core gem = rarity
    shade(g, st);
    put(g, 5, 6, lighten(st, 0.4));
    if (tier >= 1) sparkle(g, 12, 4);
  },
  pet_fairy(g, tier, col) {
    disc(g, 5, 6, 2.2, col); disc(g, 11, 6, 2.2, col);            // upper wings = rarity
    disc(g, 5.5, 10, 1.6, col); disc(g, 10.5, 10, 1.6, col);      // lower wings = rarity
    disc(g, 8, 6, 1.6, SKIN);                                       // head
    put(g, 7, 6, DARK); put(g, 9, 6, DARK);                        // eyes
    put(g, 6, 4, '#c98a3a'); put(g, 10, 4, '#c98a3a'); put(g, 8, 3, '#c98a3a'); // hair
    taper(g, 8, 8, 12, 1, 2.2, '#ffd23a');                          // dress
    shade(g, col); shade(g, '#ffd23a');
    put(g, 3, 5, SPARK); put(g, 13, 5, SPARK);
    if (tier >= 1) sparkle(g, 8, 13);
  },
  pet_drake(g, tier, col) {
    const body = '#4a9a6a';
    tri(g, 4, 3, 8, 2.2, col); tri(g, 12, 3, 8, 2.2, col);        // wings = rarity
    disc(g, 8, 9, 3.2, body);                                      // body
    disc(g, 8, 5, 2, body);                                        // head
    put(g, 6, 3, CREAM); put(g, 10, 3, CREAM);                    // horns
    rect(g, 7, 9, 2, 3, '#e8d8a0');                                // belly
    put(g, 7, 5, DARK); put(g, 9, 5, DARK);                        // eyes
    put(g, 12, 10, body); put(g, 13, 11, body);                    // tail
    put(g, 11, 5, '#ff9a3a');                                      // fire spark
    shade(g, body); shade(g, col);
    if (tier >= 1) sparkle(g, 3, 6);
    if (tier >= 3) sparkle(g, 13, 6);
  },
  pet_cat(g, tier, col) {
    const fur = '#e0a84a';
    disc(g, 8, 8, 3, fur);                                          // head
    tri(g, 5, 4, 7, 1.4, fur); tri(g, 11, 4, 7, 1.4, fur);        // ears
    rect(g, 5, 10, 6, 4, fur);                                     // sitting body
    line(g, 11, 12, 14, 10, 1, fur); put(g, 14, 9, fur);          // curling tail
    put(g, 6, 8, GREEN); put(g, 10, 8, GREEN);                    // eyes
    put(g, 8, 9, '#e08aa0');                                       // nose
    line(g, 2, 9, 4, 9, 1, '#fdfdfd'); line(g, 12, 9, 14, 9, 1, '#fdfdfd'); // whiskers
    rect(g, 5, 11, 6, 1, col);                                     // collar = rarity
    put(g, 8, 12, GOLD);                                           // bell
    shade(g, fur);
    if (tier >= 1) sparkle(g, 13, 3);
  },
  pet_owl(g, tier, col) {
    const body = '#9a7a4a';
    disc(g, 8, 8, 4.4, body);                                      // round body
    put(g, 4, 3, body); put(g, 5, 4, body); put(g, 12, 3, body); put(g, 11, 4, body); // ear tufts
    disc(g, 6, 7, 1.8, '#f6f0e0'); disc(g, 10, 7, 1.8, '#f6f0e0'); // eye discs
    put(g, 6, 7, col); put(g, 10, 7, col);                        // eyes = rarity
    put(g, 8, 9, AMBER); put(g, 8, 10, '#c9812f');                // beak
    disc(g, 8, 11, 2, lighten(body, 0.3));                         // belly
    put(g, 4, 9, darken(body, 0.2)); put(g, 12, 9, darken(body, 0.2)); // wing edges
    put(g, 6, 13, AMBER); put(g, 10, 13, AMBER);                  // feet
    shade(g, body);
    if (tier >= 1) sparkle(g, 12, 3);
  },

  // ===== furniture sprites — little readable pieces; `col` = accent trim/gem. see FURNITURE_SPRITE
  furn_sofa(g, tier, col) {
    const uph = '#7a5aa0';
    rect(g, 2, 6, 12, 4, uph);                                     // backrest
    rect(g, 2, 9, 12, 3, uph);                                     // seat
    rect(g, 2, 7, 2, 5, uph); rect(g, 12, 7, 2, 5, uph);          // armrests
    rect(g, 5, 9, 3, 2, col);                                      // cushion = rarity
    rect(g, 8, 9, 3, 2, lighten(uph, 0.2));                        // cushion
    put(g, 3, 12, WOOD); put(g, 12, 12, WOOD);                     // feet
    shade(g, uph);
    if (tier >= 1) sparkle(g, 12, 5);
  },
  furn_bookcase(g, tier, col) {
    const wd = '#7a4a2a';
    rect(g, 3, 2, 10, 12, wd);                                     // frame
    rect(g, 4, 3, 8, 10, darken(wd, 0.3));                         // interior
    rect(g, 4, 6, 8, 1, wd); rect(g, 4, 9, 8, 1, wd);            // shelves
    rect(g, 4, 3, 1, 3, RED); rect(g, 5, 3, 1, 3, BLUE); rect(g, 6, 3, 1, 3, GREEN); rect(g, 7, 3, 1, 3, col); rect(g, 8, 4, 1, 2, GOLD); rect(g, 10, 3, 1, 3, PURPLE); // row 1
    rect(g, 4, 7, 1, 2, BLUE); rect(g, 5, 7, 1, 2, col); rect(g, 7, 7, 1, 2, RED); rect(g, 9, 7, 1, 2, GREEN); // row 2
    rect(g, 4, 10, 1, 3, GREEN); rect(g, 6, 10, 1, 3, GOLD); rect(g, 8, 10, 1, 3, col); rect(g, 10, 11, 1, 2, RED); // row 3
    shade(g, wd);
    if (tier >= 1) sparkle(g, 11, 3);
  },
  furn_clock(g, tier, col) {
    const wd = '#6a4326';
    rect(g, 4, 1, 8, 14, wd);                                      // tall case
    rect(g, 5, 11, 6, 3, darken(wd, 0.3));                         // pendulum box
    disc(g, 8, 5, 3, '#f2ead6');                                   // face
    put(g, 8, 3, DARK); put(g, 8, 7, DARK); put(g, 6, 5, DARK); put(g, 10, 5, DARK); // ticks
    line(g, 8, 5, 8, 3, 1, col); line(g, 8, 5, 10, 6, 1, col);    // hands = rarity
    put(g, 8, 8, GOLD);
    disc(g, 8, 12, 1.2, col);                                      // pendulum bob = rarity
    shade(g, wd);
    if (tier >= 1) sparkle(g, 11, 2);
  },
  furn_piano(g, tier, col) {
    const wd = '#2a2530';
    rect(g, 2, 2, 12, 7, wd);                                      // body
    rect(g, 3, 3, 10, 3, darken(wd, 0.2));                         // upper panel
    rect(g, 2, 8, 12, 1, col);                                     // fallboard trim = rarity
    rect(g, 2, 9, 12, 2, '#f2ead6');                              // white keys
    for (let x = 3; x <= 12; x += 2) put(g, x, 9, DARK);          // black keys
    rect(g, 3, 11, 1, 3, wd); rect(g, 12, 11, 1, 3, wd);         // legs
    put(g, 8, 12, GOLD);                                          // pedal
    shade(g, wd);
    if (tier >= 1) sparkle(g, 5, 4);
  },
  furn_fountain(g, tier, col) {
    const st = '#a0a6b0';
    rect(g, 2, 11, 12, 2, st); taper(g, 8, 13, 14, 6, 4, st);     // lower basin
    rect(g, 3, 11, 10, 1, BLUE);                                   // pool
    rect(g, 7, 7, 2, 4, st);                                       // pedestal
    rect(g, 5, 7, 6, 1, st);                                       // upper basin
    put(g, 8, 3, col); put(g, 8, 4, col); put(g, 8, 5, col); put(g, 6, 5, col); put(g, 10, 5, col); put(g, 5, 6, col); put(g, 11, 6, col); // water jets = rarity
    disc(g, 8, 2, 1, lighten(col, 0.5));
    shade(g, st);
    if (tier >= 1) sparkle(g, 12, 9);
  },
  furn_aquarium(g, tier, col) {
    const glass = '#bfe6f0';
    rect(g, 2, 3, 12, 10, '#4a4a56');                             // frame
    rect(g, 3, 4, 10, 8, glass);                                  // water
    rect(g, 3, 10, 10, 2, '#c9a86a');                            // gravel
    line(g, 5, 11, 5, 7, 1, GREEN); line(g, 7, 11, 8, 8, 1, GREEN); // plants
    disc(g, 8, 7, 1.4, col);                                      // fish body = rarity
    put(g, 10, 6, col); put(g, 10, 7, col); put(g, 10, 8, col);  // tail
    put(g, 7, 7, DARK);                                           // eye
    put(g, 5, 5, '#eaffff'); put(g, 11, 5, SPARK); put(g, 6, 9, '#eaffff'); // bubbles
    shade(g, glass);
    if (tier >= 1) sparkle(g, 12, 4);
  },
  furn_chandelier(g, tier, col) {
    put(g, 8, 1, IRON); put(g, 8, 2, IRON);                       // chain
    rect(g, 4, 5, 8, 1, GOLD);                                    // frame bar
    rect(g, 3, 6, 1, 2, GOLD); rect(g, 12, 6, 1, 2, GOLD);       // arm drops
    disc(g, 8, 5, 1, GOLD);
    put(g, 3, 5, GOLD); put(g, 12, 5, GOLD);
    put(g, 3, 4, '#fff6e0'); put(g, 8, 3, '#fff6e0'); put(g, 12, 4, '#fff6e0'); // candle flames
    put(g, 5, 7, col); put(g, 8, 8, col); put(g, 11, 7, col);    // crystals = rarity
    put(g, 5, 8, lighten(col, 0.4)); put(g, 8, 9, lighten(col, 0.4)); put(g, 11, 8, lighten(col, 0.4));
    shade(g, GOLD);
    if (tier >= 1) sparkle(g, 8, 3);
    if (tier >= 3) { sparkle(g, 4, 4); sparkle(g, 12, 4); }
  },
  furn_throne(g, tier, col) {
    const gld = '#c9a24a';
    rect(g, 4, 1, 8, 9, gld);                                     // tall back
    put(g, 4, 0, gld); put(g, 11, 0, gld); put(g, 8, 0, col);    // finials + top gem
    rect(g, 5, 3, 6, 6, '#a03a4a');                              // velvet cushion
    disc(g, 8, 6, 1.4, col);                                      // back gem = rarity
    rect(g, 3, 9, 10, 3, gld);                                    // seat
    rect(g, 5, 10, 6, 1, col);                                    // seat cushion = rarity
    rect(g, 3, 9, 1, 5, gld); rect(g, 12, 9, 1, 5, gld);        // arms/legs
    shade(g, gld);
    if (tier >= 1) sparkle(g, 11, 2);
    if (tier >= 3) sparkle(g, 4, 2);
  },

  // ===== MONSTER CUISINE: plated dishes (menu book, order bubbles, service) =====
  dish_alebread(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);               // the plate
    rect(g, 2, 7, 7, 5, '#c98a3f'); rect(g, 3, 6, 5, 1, '#dda257'); shade(g, '#c98a3f'); // black-bread loaf
    put(g, 4, 8, '#f0d9a2'); put(g, 6, 9, '#f0d9a2');            // flour dusting
    rect(g, 10, 6, 4, 6, '#d8963f'); rect(g, 10, 5, 4, 1, '#f6e9c9'); // ale mug + foam
    rect(g, 14, 7, 1, 3, '#8a5a2e'); shade(g, '#d8963f');
  },
  dish_boarchop(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);
    disc(g, 7, 8, 4.2, '#b5493f'); shade(g, '#b5493f');          // seared chop
    rect(g, 5, 7, 5, 1, '#d87a5a');                              // pink centre stripe
    line(g, 11, 5, 14, 2, 2, '#f0e8d4'); put(g, 14, 2, '#fff');  // the bone
  },
  dish_tailskewer(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);
    line(g, 2, 12, 13, 2, 1, WOOD);                              // the skewer stick
    disc(g, 5, 9, 1.9, '#6aa050'); disc(g, 8, 6.5, 1.9, '#8ab060'); disc(g, 11, 4, 1.9, '#6aa050');
    shade(g, '#6aa050'); shade(g, '#8ab060');
    put(g, 5, 8, '#3a5a2c'); put(g, 11, 3, '#3a5a2c');           // char marks
  },
  dish_jellyflan(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);
    taper(g, 8, 5, 11, 3.4, 5.4, '#4ad0a8');                     // wobbling flan body
    rect(g, 5, 4, 6, 2, '#2e8a6e');                              // caramel cap
    shade(g, '#4ad0a8');
    put(g, 6, 7, '#bff2e0'); put(g, 7, 7, '#bff2e0');            // jiggle shine
  },
  dish_shroomstew(g) {
    taper(g, 8, 7, 13, 6, 4.6, '#7a4a2a'); shade(g, '#7a4a2a');  // crock bowl
    rect(g, 3, 6, 10, 2, '#a3542e');                             // stew surface
    disc(g, 6, 6, 1.4, '#d8465e'); put(g, 6, 5, '#f0d9a2');      // bobbing shroomcap
    put(g, 10, 6, '#f6e9c9'); put(g, 12, 5, '#f6e9c9');          // bubbles
    put(g, 8, 3, '#cfd8e0'); put(g, 9, 2, '#cfd8e0');            // steam
  },
  dish_wingplatter(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);
    for (const [wx, wy] of [[4, 9], [8, 7], [11, 9]]) {          // a pile of hydra wings
      taper(g, wx, wy - 2, wy + 2, 1.2, 2.4, '#d8905a');
      put(g, wx, wy + 3, '#f0e8d4');                             // bone tip
    }
    shade(g, '#d8905a');
    put(g, 8, 5, AMBER);                                          // glaze glint
  },
  dish_chamsteak(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);
    disc(g, 8, 8, 4.6, '#9a6ad0'); shade(g, '#9a6ad0');          // shifting steak
    rect(g, 5, 7, 6, 1, '#5fb85f'); rect(g, 5, 9, 6, 1, '#56b8ff'); // rainbow sear stripes
    put(g, 11, 6, '#ff5d6c');
  },
  dish_blubberpot(g) {
    taper(g, 8, 6, 13, 6.2, 4.8, '#3a3346'); shade(g, '#3a3346'); // iron hotpot
    rect(g, 2, 7, 2, 1, '#3a3346'); rect(g, 12, 7, 2, 1, '#3a3346'); // handles
    rect(g, 3, 5, 10, 2, '#8fb6d0');                              // glossy blubber broth
    put(g, 5, 5, '#d8ecf6'); put(g, 10, 5, '#d8ecf6');
    put(g, 7, 3, '#cfd8e0'); put(g, 9, 2, '#cfd8e0'); put(g, 6, 1, '#cfd8e0'); // big steam
  },
  dish_batsnack(g) {
    rect(g, 1, 12, 14, 2, CREAM); shade(g, CREAM);
    for (const [bx, by] of [[4, 9], [8, 8], [11, 10]]) disc(g, bx, by, 1.7, '#8a6a3a'); // crispy bites
    shade(g, '#8a6a3a');
    line(g, 10, 4, 13, 3, 1, '#8c6fb8'); line(g, 11, 5, 13, 5, 1, '#8c6fb8'); // a little wing garnish
  },
  dish_herbsalad(g) {
    taper(g, 8, 8, 13, 6, 4.4, '#e2cfa4'); shade(g, '#e2cfa4');  // wooden bowl
    for (const [lx, ly] of [[4, 6], [7, 5], [10, 6], [6, 7], [9, 7]]) disc(g, lx, ly, 1.5, '#5fb85f');
    shade(g, '#5fb85f');
    put(g, 6, 5, '#b9ff7a'); put(g, 9, 5, '#b9ff7a');            // fresh tips
    put(g, 8, 6, '#ff5d6c');                                      // one berry
  },

  // ===== raw ingredients (pantry strip, corpse pickups, caravan banking) =====
  ing_boarmeat(g) {
    disc(g, 7, 9, 4, '#c05a4a'); shade(g, '#c05a4a');            // the haunch
    rect(g, 5, 8, 4, 1, '#e8a08a');                              // marbling
    line(g, 10, 6, 13, 3, 2, '#f0e8d4'); put(g, 13, 2, '#fff');  // bone
  },
  ing_lizardtail(g) {
    for (let i = 0; i < 9; i++) { const a = i / 9 * 2.4; disc(g, 8 + Math.cos(a + 2.2) * 4, 8 + Math.sin(a + 2.2) * 4, 2.2 - i * 0.16, '#6aa050'); }
    shade(g, '#6aa050');
    put(g, 4, 5, '#a3d080'); put(g, 5, 6, '#a3d080');            // scale glints
  },
  ing_slimejelly(g) {
    rect(g, 4, 5, 8, 8, '#4ad0a8'); shade(g, '#4ad0a8');         // jelly cube
    rect(g, 6, 7, 2, 2, '#bff2e0');                              // inner shine
    put(g, 10, 10, '#2e8a6e');                                    // dense core fleck
  },
  ing_shroomcap(g) {
    disc(g, 8, 6, 5, '#d8465e'); rect(g, 2, 7, 12, 2, null);     // cap dome
    rect(g, 3, 6, 10, 2, '#d8465e');
    rect(g, 6, 8, 4, 5, '#f0d9a2');                              // stem
    shade(g, '#d8465e'); shade(g, '#f0d9a2');
    put(g, 5, 4, '#f6e9c9'); put(g, 10, 5, '#f6e9c9');           // spots
  },
  ing_hydrawing(g) {
    taper(g, 7, 3, 11, 2, 4.4, '#d8905a'); shade(g, '#d8905a');  // the drumstick
    rect(g, 6, 11, 3, 2, '#f0e8d4'); put(g, 5, 12, '#fff'); put(g, 9, 12, '#fff'); // bone knuckle
  },
  ing_chamflank(g) {
    rect(g, 3, 5, 10, 7, '#9a6ad0'); shade(g, '#9a6ad0');        // flank slab
    rect(g, 4, 7, 8, 1, '#56b8ff'); rect(g, 4, 9, 8, 1, '#5fb85f'); // colour-shift bands
  },
  ing_whaleblub(g) {
    rect(g, 3, 5, 10, 8, '#8fb6d0'); shade(g, '#8fb6d0');        // blubber block
    rect(g, 3, 5, 10, 2, '#d8ecf6');                              // rind
    put(g, 6, 9, '#eef6fa'); put(g, 9, 10, '#eef6fa');           // glisten
  },
  ing_batwing(g) {
    line(g, 3, 12, 8, 4, 2, '#8c6fb8');                           // leading edge
    tri(g, 8, 4, 12, 4.6, '#6a4f96');                             // membrane
    shade(g, '#6a4f96');
    line(g, 8, 5, 11, 11, 1, '#4a3568'); line(g, 8, 5, 13, 9, 1, '#4a3568'); // finger bones
  },
  ing_wildherb(g) {
    line(g, 8, 13, 8, 6, 1, '#47702c');                           // main stem
    line(g, 8, 10, 4, 5, 1, '#5fb85f'); line(g, 8, 10, 12, 5, 1, '#5fb85f'); // side sprigs
    disc(g, 4, 4, 1.4, '#5fb85f'); disc(g, 12, 4, 1.4, '#5fb85f'); disc(g, 8, 4, 1.6, '#7ac86e');
    shade(g, '#5fb85f');
    put(g, 8, 3, '#b9ff7a');
  },

  // ===== restaurant fixtures & flow icons (build plots, book, service bell) =====
  ico_table(g) {
    rect(g, 2, 6, 12, 2, WOOD);                                   // table top
    rect(g, 3, 5, 10, 1, '#f6e9c9');                              // table cloth edge
    rect(g, 4, 8, 2, 6, darken(WOOD, 0.2)); rect(g, 10, 8, 2, 6, darken(WOOD, 0.2)); // legs
    shade(g, WOOD);
  },
  ico_chair(g) {
    rect(g, 4, 2, 2, 8, WOOD);                                    // back post
    rect(g, 4, 8, 8, 2, WOOD);                                    // seat
    rect(g, 5, 3, 1, 4, darken(WOOD, 0.2));                       // back slat
    rect(g, 4, 10, 2, 4, darken(WOOD, 0.2)); rect(g, 10, 10, 2, 4, darken(WOOD, 0.2)); // legs
    shade(g, WOOD);
  },
  ico_bell(g) {
    taper(g, 8, 4, 10, 1.6, 5, GOLD); shade(g, GOLD);             // bell dome
    rect(g, 3, 11, 10, 1, darken(GOLD, 0.25));                    // rim
    put(g, 8, 2, darken(GOLD, 0.3)); put(g, 8, 13, '#3a3346');    // knob + clapper
    rect(g, 2, 13, 12, 1, WOOD);                                  // counter base
  },
  ico_book(g) {
    rect(g, 2, 3, 12, 10, '#7a4a2a'); shade(g, '#7a4a2a');        // leather cover
    rect(g, 3, 4, 10, 8, CREAM);                                  // pages
    rect(g, 8, 3, 1, 10, '#7a4a2a');                              // spine split
    rect(g, 4, 6, 3, 1, '#9aa3ad'); rect(g, 4, 8, 3, 1, '#9aa3ad'); // written lines
    rect(g, 9, 6, 3, 1, '#9aa3ad'); rect(g, 9, 8, 3, 1, '#9aa3ad');
    put(g, 12, 10, PURPLE); put(g, 11, 11, PURPLE);               // a whiff of magic
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

// gear-instance convenience: prefer the instance's own variant sprite, else the slot
export function gearImg(inst, cls = '') {
  if (!inst) return '';
  return spriteImg(inst.sprite || inst.slot, { rarity: inst.rarity }, cls, '?');
}

// ===== gear variant catalog: pick a distinct sprite per slot when rolling loot =====
// Each entry is { sprite: <RECIPES key>, name: <display noun> }.
export const GEAR_VARIANTS = {
  hat: [
    { sprite: 'g_wizhat', name: 'Wizard Hat' },
    { sprite: 'g_crown', name: 'Crown' },
    { sprite: 'g_hood', name: 'Hood' },
    { sprite: 'g_helm', name: 'Helm' },
    { sprite: 'g_circlet', name: 'Circlet' },
    { sprite: 'g_tricorne', name: 'Tricorne' },
    { sprite: 'g_strawhat', name: 'Straw Hat' },
    { sprite: 'g_horns', name: 'Horned Helm' },
    { sprite: 'g_jester', name: 'Jester Cap' },
    { sprite: 'g_halo', name: 'Halo' },
    { sprite: 'g_antlers', name: 'Antlers' },
    { sprite: 'g_tophat', name: 'Top Hat' },
    { sprite: 'g_bandana', name: 'Bandana' },
    { sprite: 'g_mitre', name: 'Mitre' },
    { sprite: 'g_visor', name: 'Visor' },
    { sprite: 'g_flowercrown', name: 'Flower Crown' },
  ],
  robe: [
    { sprite: 'g_cloak', name: 'Cloak' },
    { sprite: 'g_tunic', name: 'Tunic' },
    { sprite: 'g_platemail', name: 'Platemail' },
    { sprite: 'g_scales', name: 'Scale Mail' },
    { sprite: 'g_ragrobe', name: 'Rag Robe' },
    { sprite: 'g_royalrobe', name: 'Royal Robe' },
    { sprite: 'g_furcoat', name: 'Fur Coat' },
    { sprite: 'g_poncho', name: 'Poncho' },
    { sprite: 'g_kimono', name: 'Kimono' },
    { sprite: 'g_labcoat', name: 'Lab Coat' },
    { sprite: 'g_battlerobe', name: 'Battle Robe' },
    { sprite: 'g_vestments', name: 'Vestments' },
    { sprite: 'g_shroud', name: 'Shroud' },
    { sprite: 'g_harlequin', name: 'Harlequin Suit' },
  ],
  staff: [
    { sprite: 'g_oakstaff', name: 'Oak Staff' },
    { sprite: 'g_crystalstaff', name: 'Crystal Staff' },
    { sprite: 'g_scythe', name: 'Scythe' },
    { sprite: 'g_wand', name: 'Wand' },
    { sprite: 'g_trident', name: 'Trident' },
    { sprite: 'g_bonestaff', name: 'Bone Staff' },
    { sprite: 'g_torchstaff', name: 'Torch Staff' },
    { sprite: 'g_skullstaff', name: 'Skull Staff' },
    { sprite: 'g_gnarlstaff', name: 'Gnarled Staff' },
    { sprite: 'g_starrod', name: 'Star Rod' },
    { sprite: 'g_scepter', name: 'Scepter' },
    { sprite: 'g_warhammer', name: 'War Hammer' },
    { sprite: 'g_spear', name: 'Spear' },
    { sprite: 'g_flail', name: 'Flail' },
    { sprite: 'g_warfan', name: 'War Fan' },
    { sprite: 'g_lanternstaff', name: 'Lantern Staff' },
  ],
  charm: [
    { sprite: 'g_amulet', name: 'Amulet' },
    { sprite: 'g_ring', name: 'Ring' },
    { sprite: 'g_orb', name: 'Orb' },
    { sprite: 'g_rune', name: 'Rune' },
    { sprite: 'g_feather', name: 'Feather' },
    { sprite: 'g_hourglass', name: 'Hourglass' },
    { sprite: 'g_eyecharm', name: 'Eye Charm' },
    { sprite: 'g_locket', name: 'Locket' },
    { sprite: 'g_talisman', name: 'Talisman' },
    { sprite: 'g_horseshoe', name: 'Horseshoe' },
    { sprite: 'g_dreamcatcher', name: 'Dreamcatcher' },
    { sprite: 'g_compass', name: 'Compass' },
    { sprite: 'g_luckydie', name: 'Lucky Die' },
    { sprite: 'g_scarab', name: 'Scarab' },
  ],
};
// pick a random variant for a slot (returns { sprite, name } or null)
export function pickGearVariant(slot) { const a = GEAR_VARIANTS[slot] || []; return a.length ? a[Math.floor(Math.random() * a.length)] : null; }

// ===== pet id -> sprite recipe (cute companion critters) =====
export const PET_SPRITE = { wisp: 'pet_wisp', slime: 'pet_slime', bat: 'pet_bat', golem: 'pet_golem', fairy: 'pet_fairy', drake: 'pet_drake', cat: 'pet_cat', owl: 'pet_owl' };

// ===== furniture id -> sprite recipe (little decorative pieces) =====
export const FURNITURE_SPRITE = { sofa: 'furn_sofa', bookcase: 'furn_bookcase', clock: 'furn_clock', piano: 'furn_piano', fountain: 'furn_fountain', aquarium: 'furn_aquarium', chandelier: 'furn_chandelier', throne: 'furn_throne' };

// ===== spell id -> sprite recipe (icons tinted by each spell's element) =====
export const SPELL_SPRITE = {
  fireball: 'spell_fireball', gust: 'spell_gust', lightning: 'spell_lightning',
  heal: 'spell_heal', frost: 'spell_frost', spike: 'spell_spike', nova: 'spell_nova',
  acid: 'spell_acid', shield: 'spell_shield', quake: 'spell_quake', orb: 'spell_orb', blink: 'spell_blink',
};

// ===== combo id -> sprite recipe (two-spell fusion emblems) =====
export const COMBO_SPRITE = {
  firetornado: 'combo_firetornado', icestorm: 'combo_icestorm', holynova: 'combo_holynova',
  toxiccloud: 'combo_toxiccloud', bulwark: 'combo_bulwark', glacier: 'combo_glacier',
  flamedash: 'combo_flamedash', thunderorb: 'combo_thunderorb',
};

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
